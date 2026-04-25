import { Hono } from 'hono';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { createDbClient } from '../db';
import { models, collections, entities, languages } from '../db/schema';
import { requirePermission } from '../lib/rbac';
import { validateEntityData } from '../lib/model-engine';
import { getAuthInstances } from '../lib/auth';

const entitiesRouter = new Hono<{ Bindings: any }>();

/**
 * 动态权限校验辅助逻辑
 * 根据 HTTP 方法和 Slug 动态计算所需权限并拦截
 */
const dynamicGuard = async (c: any, next: any) => {
  let collectionSlug = c.req.param('slug');
  // 防御性处理：有些环境下的 Hono 参数可能会误包含领先的斜杠
  if (collectionSlug?.startsWith('/')) collectionSlug = collectionSlug.substring(1);
  
  const db = await createDbClient(c.env.DB);

  // 1. 安全兜底：验证 Collection 是否存在，并联查对应的 Model
  const result = await db.select({
    collection: collections,
    model: models
  }).from(collections)
    .innerJoin(models, eq(collections.modelId, models.id))
    .where(eq(collections.slug, collectionSlug))
    .get();

  if (!result) {
    return c.json({ error: `Collection [${collectionSlug}] not found` }, 404);
  }

  // 2. 根据方法映射 Action
  let action = 'view';
  if (c.req.method === 'POST') action = 'edit';
  if (c.req.method === 'PATCH') action = 'edit';
  if (c.req.method === 'DELETE') action = 'delete';

  // 3. 构造 Slug: collection:[slug]:[action]
  const requiredPerm = `collection:${collectionSlug}:${action}`;
  
  // 4. 深度权限校验 (集合配置级)
  const user = c.get('user');
  const isAdmin = c.get('isAdmin'); // 从 rbac 中置入
  const userRoles = c.get('userRoles') || [];

  if (!isAdmin && result.collection.permissionConfig) {
    const config = result.collection.permissionConfig;
    // 检查用户拥有的任何一个角色是否在配置中允许该操作
    const allowed = userRoles.some((role: string) => {
      const roleCfg = config[role];
      if (!roleCfg) return false;
      if (action === 'view') return roleCfg.canView !== false;
      if (action === 'edit') {
        // PATCH 是 Update，POST 是 Create
        return c.req.method === 'POST' ? roleCfg.canCreate !== false : roleCfg.canUpdate !== false;
      }
      if (action === 'delete') return roleCfg.canDelete !== false;
      return true;
    });

    if (!allowed && !isAdmin) {
      return c.json({ error: `权限不足: 该集合已禁止您所属角色进行 [${action}] 操作` }, 403);
    }

    // 记录级隔离检查标志
    const ownerOnly = userRoles.some((role: string) => config[role]?.ownerOnly);
    if (ownerOnly) {
      c.set('ownerOnlyMode', true);
    }
  }

  // 注入数据到上下文
  c.set('currentCollection', result.collection);
  c.set('currentModel', result.model);

  return requirePermission(requiredPerm)(c, next);
};

/**
 * 关联数据自动回填 (Populate)
 * 优先级：Collection.relationSettings > Model.fieldsJson 中的默认配置
 */
async function populateEntities(db: any, entitiesList: any[], fields: any[], fieldConfig: any = {}) {
  const mergedConfigs: Record<string, any> = {};
  
  // 1. 获取模型中的关系配置
  fields.filter(f => f.type === 'relation' || f.type === 'relation_single' || f.type === 'relation_multi').filter(f => f.relationConfig?.collectionSlug).forEach(f => {
    mergedConfigs[f.name] = f.relationConfig;
  });

  // 2. 获取集合级的覆盖配置
  if (fieldConfig) {
    Object.entries(fieldConfig).forEach(([fieldName, config]: [string, any]) => {
      if (config.target_slug || config.targetCollectionSlug) {
        mergedConfigs[fieldName] = {
          collectionSlug: config.target_slug || config.targetCollectionSlug,
          displayField: config.display_field || config.displayField || 'name'
        };
      }
    });
  }

  const enumFields = fields.filter(f => ['radio', 'checkbox', 'select', 'multi_select'].includes(f.type));
  const fieldNames = Object.keys(mergedConfigs);

  const mapEnumValues = (data: any, displayValues: any) => {
    enumFields.forEach(f => {
      const config = fieldConfig[f.name];
      if (config?.options) {
        const val = data[f.name];
        if (val !== undefined && val !== null && val !== '') {
          const optionsMap = Object.fromEntries(config.options.map((opt: any) => [String(opt.key), opt.value]));
          if (Array.isArray(val)) {
            displayValues[f.name] = val.map(v => optionsMap[String(v)] || v).join(', ');
          } else {
            displayValues[f.name] = optionsMap[String(val)] || val;
          }
        }
      }
    });
  };

  // 如果没有任何关系字段，仅执行列表转换与枚举映射
  if (fieldNames.length === 0) {
    return entitiesList.map(r => {
      const data = typeof r.dataJson === 'string' ? JSON.parse(r.dataJson) : r.dataJson;
      const displayValues: Record<string, string> = {};
      mapEnumValues(data, displayValues);

      return { 
        id: r.id, 
        locale: r.locale,
        translationGroup: r.translationGroup,
        createdBy: r.createdBy,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        collectionId: r.collectionId,
        metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
        ...data,
        _displayValues: displayValues
      };
    });
  }

  // 获取所有唯一的目标集合 Slug
  const targetSlugs = [...new Set(Object.values(mergedConfigs).map(c => c.collectionSlug))];
  const targetCollections = await db.select().from(collections).where(inArray(collections.slug, targetSlugs as string[])).all();
  const slugToIdMap = Object.fromEntries(targetCollections.map(c => [c.slug, c.id]));

  return await Promise.all(entitiesList.map(async (entity) => {
    const data = typeof entity.dataJson === 'string' ? JSON.parse(entity.dataJson) : entity.dataJson;
    const displayValues: Record<string, string> = {};

    // 关系字段回填
    for (const fieldName of fieldNames) {
      const targetId = data[fieldName];
      if (!targetId) continue;

      const config = mergedConfigs[fieldName];
      const targetCollId = slugToIdMap[config.collectionSlug];
      if (!targetCollId) continue;

      const targetEntity = await db.select().from(entities).where(and(
        eq(entities.id, parseInt(targetId)),
        eq(entities.collectionId, targetCollId)
      )).get();

      if (targetEntity) {
        const targetData = typeof targetEntity.dataJson === 'string' ? JSON.parse(targetEntity.dataJson) : targetEntity.dataJson;
        const displayField = config.displayField || 'name';
        displayValues[fieldName] = targetData[displayField] || `ID: ${targetId}`;
      } else {
        displayValues[fieldName] = `[已删除] ID: ${targetId}`;
      }
    }

    // 枚举与多选映射
    mapEnumValues(data, displayValues);

    return {
      id: entity.id,
      locale: entity.locale,
      translationGroup: entity.translationGroup,
      createdBy: entity.createdBy,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      collectionId: entity.collectionId,
      metadata: typeof entity.metadata === 'string' ? JSON.parse(entity.metadata) : entity.metadata,
      ...data,
      _displayValues: displayValues
    };
  }));
}

/**
 * 关联 ID 存在性物理校验
 */
async function validateRelations(db: any, rawData: any, fields: any[], fieldConfig: any = {}, depth = 0) {
  if (depth > 0) return;
  const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

  // 合并配置
  const mergedConfigs: Record<string, any> = {};
  fields.filter(f => f.type === 'relation' || f.type === 'relation_single' || f.type === 'relation_multi').filter(f => f.relationConfig?.collectionSlug).forEach(f => {
    mergedConfigs[f.name] = { ...f.relationConfig, label: f.label };
  });

  if (fieldConfig) {
    Object.entries(fieldConfig).forEach(([fieldName, config]: [string, any]) => {
      const field = fields.find(f => f.name === fieldName);
      if (config.target_slug || config.targetCollectionSlug) {
        mergedConfigs[fieldName] = {
          collectionSlug: config.target_slug || config.targetCollectionSlug,
          label: field?.label || fieldName,
          multiple: field?.type === 'relation_multi' || field?.multiple // 透传多选配置
        };
      }
    });
  }

  // 自动为 image 类型映射 media_library (如果未显式配置)
  fields.filter(f => f.type === 'image' || f.type === 'multi_image').forEach(f => {
    if (!mergedConfigs[f.name]) {
      mergedConfigs[f.name] = {
        collectionSlug: 'media_library',
        label: f.label,
        multiple: f.type === 'multi_image' || f.multiple
      };
    }
  });

  for (const [fieldName, config] of Object.entries(mergedConfigs)) {
    const rawVal = data[fieldName];
    if (!rawVal) continue;

    const ids = Array.isArray(rawVal) ? rawVal : [rawVal];
    const targetColl = await db.select().from(collections).where(eq(collections.slug, config.collectionSlug)).get();
    
    // 如果目标集合不存在且不是 media_library，则报错；如果是 media_library 但不存在，静默跳过（允许未初始化媒体库）
    if (!targetColl) {
      if (config.collectionSlug === 'media_library') continue;
      throw new Error(`关联的目标集合 [${config.collectionSlug}] 不存在`);
    }

    for (const targetId of ids) {
      const exists = await db.select().from(entities).where(and(
        eq(entities.id, parseInt(targetId)),
        eq(entities.collectionId, targetColl.id)
      )).get();

      if (!exists) {
        throw new Error(`字段 [${config.label}] 关联的 ID [${targetId}] 在目标集合 [${config.collectionSlug}] 中不存在`);
      }
    }
  }
}

/**
 * 枚举值合法性校验与去重逻辑
 */
function sanitizeAndValidateEnums(data: any, fields: any[], fieldConfig: any = {}) {
  const errors: string[] = [];
  
  fields.forEach(field => {
    const val = data[field.name];
    if (val === undefined || val === null) return;

    // 去重处理
    if (field.type === 'checkbox' || field.type === 'multi_select' || field.type === 'relation_multi' || field.type === 'multi_image' || field.type === 'multi_file') {
      if (Array.isArray(val)) {
        data[field.name] = Array.from(new Set(val));
      }
    }

    // 枚举校验
    if (['radio', 'select', 'multi_select', 'checkbox'].includes(field.type)) {
      const config = fieldConfig[field.name];
      const options = config?.options || field.options;
      
      if (Array.isArray(options) && options.length > 0) {
        const allowedKeys = new Set(options.map((opt: any) => String(opt.key)));
        
        const valuesToCheck = Array.isArray(data[field.name]) ? data[field.name] : [data[field.name]];
        
        for (const v of valuesToCheck) {
          if (!allowedKeys.has(String(v))) {
             errors.push(`字段 [${field.label}] 提交了非法的选项值: ${v}`);
          }
        }
      }
    }
  });
  
  return { valid: errors.length === 0, errors };
}

/**
 * 树形结构循环引用校验 (防御逻辑漏洞)
 */
async function checkCircularRelation(db: any, currentId: number, targetParentId: any, collectionId: number, parentField: string) {
  if (!targetParentId) return; // 设为根节点，无风险
  
  let checkId = parseInt(targetParentId);
  const visited = new Set<number>(); // 防死循环安全保护

  while (checkId) {
    if (checkId === currentId) {
      throw new Error(`检测到循环引用：不能将分类的父级指向其自身或其子分类下的节点，这将导致数据结构逻辑错误。`);
    }

    if (visited.has(checkId)) break; // 已经检查过该节点，跳出
    visited.add(checkId);

    // 向上追溯一级
    const parentEntity = await db.select().from(entities).where(and(
      eq(entities.id, checkId),
      eq(entities.collectionId, collectionId)
    )).get();

    if (!parentEntity) break;

    const parentData = typeof parentEntity.dataJson === 'string' ? JSON.parse(parentEntity.dataJson) : parentEntity.dataJson;
    const nextParentId = parentData[parentField];
    
    if (nextParentId && nextParentId !== checkId) {
      checkId = parseInt(nextParentId);
    } else {
      break;
    }
  }
}

/**
 * 列表查询 (GET /api/v1/entities/:slug)
 */
entitiesRouter.get('/:slug', dynamicGuard, async (c) => {
  const db = await createDbClient(c.env.DB);
  const collection = c.get('currentCollection');
  const model = c.get('currentModel');
  const isAdmin = c.get('isAdmin');
  const ownerOnly = c.get('ownerOnlyMode');
  const user = c.get('user');
  
  let whereClause = eq(entities.collectionId, collection.id);
  // 记录级隔离：如果开启且非管理员，只查自己的
  if (ownerOnly && !isAdmin && user) {
    whereClause = and(whereClause, eq(entities.createdBy, user.id)) as any;
  }

  const rawResults = await db.select()
    .from(entities)
    .where(whereClause)
    .all();

  // 执行 Populate
  const actualConfig = collection.fieldConfig || collection.relationSettings || {};
  const results = await populateEntities(db, rawResults, model.fieldsJson as any[], actualConfig);

  // 合并关联设置到模型定义，方便前端渲染
  const fieldsWithSettings = (model.fieldsJson as any[]).map(f => {
    const setting = actualConfig[f.name];
    
    // Inject options for enums
    if (['radio', 'select', 'multi_select', 'checkbox'].includes(f.type) && setting?.options) {
      f.options = setting.options;
    }

    if (setting || f.type === 'image' || f.type === 'multi_image') {
      const targetSlug = setting?.target_slug || setting?.targetCollectionSlug || (f.type === 'image' || f.type === 'multi_image' ? 'media_library' : null);
      if (!targetSlug) return f;

      return {
        ...f,
        type: (f.type === 'image' || f.type === 'multi_image') && !setting ? f.type : f.type, // keep type intact
        relationConfig: {
          collectionSlug: targetSlug,
          displayField: setting?.display_field || setting?.displayField || 'name'
        },
        // 媒体钩子预留
        isMedia: targetSlug === 'media_library' || 
                 targetSlug.includes('image') || 
                 targetSlug.includes('file')
      };
    }
    return f;
  });

  return c.json({
    data: results.sort((a, b) => b.createdAt - a.createdAt),
    model: {
      name: collection.name,
      slug: collection.slug,
      fieldsJson: fieldsWithSettings
    }
  });
});

/**
 * 详情渲染 (GET /api/v1/entities/:slug/:id)
 */
entitiesRouter.get('/:slug/:id', dynamicGuard, async (c) => {
  const db = await createDbClient(c.env.DB);
  const id = parseInt(c.req.param('id'));
  const collection = c.get('currentCollection');
  const model = c.get('currentModel');
  const isAdmin = c.get('isAdmin');
  const ownerOnly = c.get('ownerOnlyMode');
  const user = c.get('user');

  let whereClause = and(
    eq(entities.id, id),
    eq(entities.collectionId, collection.id)
  );

  if (ownerOnly && !isAdmin && user) {
    whereClause = and(whereClause, eq(entities.createdBy, user.id)) as any;
  }

  // 1. 获取主数据
  const result = await db.select()
    .from(entities)
    .where(whereClause)
    .get();

  if (!result) {
    return c.json({ error: 'Entity not found' }, 404);
  }

  // 2. 联查翻译组信息 (Translations)
  let translations: any[] = [];
  if (result.translationGroup) {
    translations = await db.select({
      id: entities.id,
      locale: entities.locale
    })
    .from(entities)
    .where(and(
      eq(entities.translationGroup, result.translationGroup),
      eq(entities.collectionId, collection.id)
    ))
    .all();
  }

  // 3. 单条 Populate
  const actualConfig = collection.fieldConfig || collection.relationSettings || {};
  const populated = await populateEntities(db, [result], model.fieldsJson as any[], actualConfig);

  // 合并设置到模型定义
  const fieldsWithSettings = (model.fieldsJson as any[]).map(f => {
    const setting = actualConfig[f.name];
    if (['radio', 'select', 'multi_select', 'checkbox'].includes(f.type) && setting?.options) {
      f.options = setting.options;
    }
    if (setting || f.type === 'image' || f.type === 'multi_image') {
      const targetSlug = setting?.target_slug || setting?.targetCollectionSlug || (f.type === 'image' || f.type === 'multi_image' ? 'media_library' : null);
      if (!targetSlug) return f;
      return {
        ...f,
        relationConfig: {
          collectionSlug: targetSlug,
          displayField: setting?.display_field || setting?.displayField || 'name'
        },
        isMedia: targetSlug === 'media_library' || targetSlug.includes('image') || targetSlug.includes('file')
      };
    }
    return f;
  });

  return c.json({
    data: {
      ...populated[0],
      translations // 附带同组译文清单
    },
    model: {
      name: collection.name,
      slug: collection.slug,
      fieldsJson: fieldsWithSettings
    }
  });
});

/**
 * 新增实体 (POST /api/v1/entities/:slug)
 */
entitiesRouter.post('/:slug', dynamicGuard, async (c) => {
  const db = await createDbClient(c.env.DB);
  const collection = c.get('currentCollection');
  const model = c.get('currentModel');
  const data = await c.req.json();

  try {
    const actualConfig = collection.fieldConfig || collection.relationSettings || {};
    
    // 1.1 业务级数据清洗与枚举校验
    const enumValidation = sanitizeAndValidateEnums(data, model.fieldsJson as any[], actualConfig);
    if (!enumValidation.valid) {
      return c.json({ error: '选项校验不合法', details: enumValidation.errors }, 400);
    }

    // 1.2 结构化校验 (纯函数)
    const validation = validateEntityData(data, model.fieldsJson as any[]);
    if (!validation.valid) {
      return c.json({ error: '数据格式不合法', details: validation.errors }, 400);
    }

    // 2. 关系物理校验 (DB 异步检查)
    await validateRelations(db, data, model.fieldsJson as any[], actualConfig);

    // 3. 多语言逻辑处理
    const user = c.get('user');
    const config = c.get('config');
    const locale = data.locale || config?.DEFAULT_LANGUAGE || 'en-US';
    
    // 自动生成或继承翻译组 ID
    const translationGroup = data.translationGroup || crypto.randomUUID();

    // 3.1 语种冲突校验：同一组内禁止重复创建相同语种
    if (data.translationGroup) {
      const existingLocale = await db.select().from(entities).where(and(
        eq(entities.translationGroup, translationGroup),
        eq(entities.locale, locale)
      )).get();
      
      if (existingLocale) {
        return c.json({ error: `该内容已存在 [${locale}] 语种版本，请直接在列表中切换至该语种进行编辑。` }, 409);
      }
    }

    // 4. 写入
    const [newEntity] = await db.insert(entities).values({
      collectionId: collection.id,
      dataJson: data,
      locale,
      translationGroup,
      createdBy: user?.id
    }).returning();

    return c.json(newEntity);
  } catch (err: any) {
    console.error(`❌ [Entities] Post Error:`, err.message);
    return c.json({ error: err.message }, 400);
  }
});

/**
 * 更新实体 (PATCH /api/v1/entities/:slug/:id)
 */
entitiesRouter.patch('/:slug/:id', dynamicGuard, async (c) => {
  const db = await createDbClient(c.env.DB);
  const id = parseInt(c.req.param('id'));
  const collection = c.get('currentCollection');
  const model = c.get('currentModel');
  const data = await c.req.json();

  try {
    const isAdmin = c.get('isAdmin');
    const ownerOnly = c.get('ownerOnlyMode');
    const user = c.get('user');

    // 物理存在性与归属权校验
    let whereClause = and(
      eq(entities.id, id),
      eq(entities.collectionId, collection.id)
    );
    if (ownerOnly && !isAdmin && user) {
      whereClause = and(whereClause, eq(entities.createdBy, user.id)) as any;
    }

    const existing = await db.select().from(entities).where(whereClause).get();
    if (!existing) return c.json({ error: '记录不存在或无权操作' }, 404);

    const actualConfig = collection.fieldConfig || collection.relationSettings || {};
    
    // 1.0 洗刷与枚举校验
    const enumValidation = sanitizeAndValidateEnums(data, model.fieldsJson as any[], actualConfig);
    if (!enumValidation.valid) {
       return c.json({ error: '选项校验不合法', details: enumValidation.errors }, 400);
    }

    // 1.1 结构化校验
    const validation = validateEntityData(data, model.fieldsJson as any[]);
    if (!validation.valid) {
      return c.json({ error: '数据格式不合法', details: validation.errors }, 400);
    }

    // 2. 关系物理校验
    await validateRelations(db, data, model.fieldsJson as any[], actualConfig);

    // 2.1 树形循环引用专项审计
    // 自动判定：如果数据中存在 parent_id 字段，且当前是针对该字段的更新
    if (data.parent_id) {
       await checkCircularRelation(db, id, data.parent_id, collection.id, 'parent_id');
    }

    // 3. 更新
    const result = await db.update(entities)
      .set({ dataJson: data, updatedAt: new Date() })
      .where(whereClause)
      .run();

    const changes = result.meta?.changes ?? result.changes;
    if (changes === 0) return c.json({ error: 'Entity not found' }, 404);

    return c.json({ success: true });
  } catch (err: any) {
    console.error(`❌ [Entities] Patch 失败 [${id}]:`, err);
    return c.json({ error: err.message }, 400);
  }
});

/**
 * 删除实体 (DELETE /api/v1/entities/:slug/:id)
 */
entitiesRouter.delete('/:slug/:id', dynamicGuard, async (c) => {
  const db = await createDbClient(c.env.DB);
  const id = parseInt(c.req.param('id'));
  const collection = c.get('currentCollection');
  const isAdmin = c.get('isAdmin');
  const ownerOnly = c.get('ownerOnlyMode');
  const user = c.get('user');

  let whereClause = and(
    eq(entities.id, id),
    eq(entities.collectionId, collection.id)
  );
  if (ownerOnly && !isAdmin && user) {
    whereClause = and(whereClause, eq(entities.createdBy, user.id)) as any;
  }

  try {
    const cascade = c.req.query('cascade') === 'true';
    
    // 1. 获取物理记录以确定翻译组
    const existing = await db.select().from(entities).where(and(
      eq(entities.id, id),
      eq(entities.collectionId, collection.id)
    )).get();

    if (!existing) return c.json({ error: 'Entity not found' }, 404);

    let deleteWhere = whereClause;
    
    // 2. 如果开启级联删除且存在翻译组，扩充删除范围
    if (cascade && existing.translationGroup) {
      deleteWhere = and(
        eq(entities.translationGroup, existing.translationGroup),
        eq(entities.collectionId, collection.id)
      ) as any;
      console.log(`🧨 [Entities] 正在级联删除翻译组: ${existing.translationGroup}`);
    }

    const result = await db.delete(entities)
      .where(deleteWhere)
      .run();

    const changes = result.meta?.changes ?? result.changes;

    return c.json({ success: true, count: changes });
  } catch (err: any) {
    console.error('❌ [Entities] 删除失败:', err);
    return c.json({ error: err.message }, 400);
  }
});

/**
 * 批量保存多语言实体 (POST /api/v1/entities/:slug/batch-save)
 * 适配逻辑：
 * 1. 严格 Locale 冲突校验。
 * 2. 事务兼容性：支持 D1 batch 和标准 SQLite 事务回退。
 * 3. 自动生成并广播 TranslationGroup (UUID)。
 */
entitiesRouter.post('/:slug/batch-save', dynamicGuard, async (c) => {
  const db = await createDbClient(c.env.DB);
  const collection = c.get('currentCollection');
  const model = c.get('currentModel');
  const user = c.get('user');
  const payload = await c.req.json(); 

  if (!Array.isArray(payload) || payload.length === 0) {
    return c.json({ error: '无效的数据负载' }, 400);
  }

  // 1. Locale 唯一性校验
  const locales = payload.map(item => item.locale);
  if (new Set(locales).size !== locales.length) {
    return c.json({ error: '保存请求中包含重复的语言标识' }, 400);
  }

  // 2. UUID 判定
  let commonGroup = payload.find(item => item.translationGroup)?.translationGroup;
  if (!commonGroup) {
     commonGroup = crypto.randomUUID();
  }

    try {
    const actualConfig = collection.fieldConfig || collection.relationSettings || {};
    const batchOps: any[] = [];
    const metaResults: any[] = [];

    // 1. 预处理与校验
    for (const entry of payload) {
      const data = entry.dataJson || {};
      const businessKeys = Object.keys(data).filter(k => !['id', 'locale', 'translationGroup', 'createdBy'].includes(k));
      if (businessKeys.length === 0 && !entry.id) continue;

      // 执行业务校验 (枚举/必填)
      const enumValidation = sanitizeAndValidateEnums(data, model.fieldsJson as any[], actualConfig);
      if (!enumValidation.valid) throw new Error(`[${entry.locale}] 选项结构错误: ${enumValidation.errors.join(';')}`);
      
      const validation = validateEntityData(data, model.fieldsJson as any[]);
      if (!validation.valid) throw new Error(`数据校验失败: ${validation.errors.join('; ')}`);

      if (entry.id) {
        batchOps.push(
          db.update(entities)
            .set({ dataJson: data, updatedAt: new Date(), translationGroup: commonGroup })
            .where(and(eq(entities.id, parseInt(entry.id)), eq(entities.collectionId, collection.id)))
        );
        metaResults.push({ locale: entry.locale, id: parseInt(entry.id), translationGroup: commonGroup });
      } else {
        batchOps.push(
          db.insert(entities).values({
            collectionId: collection.id,
            dataJson: data,
            locale: entry.locale,
            translationGroup: commonGroup,
            createdBy: user?.id
          }).returning()
        );
        metaResults.push({ locale: entry.locale, needsId: true, translationGroup: commonGroup });
      }
    }

    // 2. 执行原子批处理 (Cloudflare D1 最佳实践)
    if (batchOps.length > 0) {
      const batchResults = await db.batch(batchOps as any);
      
      // 回填新增记录的真实 ID (如果有的话)
      metaResults.forEach((meta, idx) => {
        if (meta.needsId) {
          const inserted = batchResults[idx];
          // D1 batch 返回的通常是结果数组的子集
          const rowData = Array.isArray(inserted) ? inserted[0] : inserted;
          meta.id = rowData?.id;
          delete meta.needsId;
        }
      });
    }

    return c.json({ 
      success: true, 
      translationGroup: commonGroup,
      list: metaResults 
    });

  } catch (err: any) {
    console.error(`❌ [Entities] BatchSave Error:`, err);
    return c.json({ error: err.message }, 500);
  }
});

export default entitiesRouter;
