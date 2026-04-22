import { Hono } from 'hono';
import { eq, inArray, sql } from 'drizzle-orm';
import { createDbClient } from '../db';
import { roles, permissions, rolePermissions, admins, adminsToRoles, adminSiteAccess, adminSessions, models, collections, languages, entities } from '../db/schema';
import { generateId } from "lucia";
import { registry } from '../lib/permission-registry';
import { getAuthInstances, passwordHasher } from '../lib/auth';
import { validateModelDefinition } from '../lib/model-engine';

const rbac = new Hono<{ Bindings: any }>();

/**
 * 0. 语言管理 (Languages)
 */
rbac.get('/languages', async (c) => {
  const db = await createDbClient(c.env.DB);
  const all = await db.select().from(languages).all();
  return c.json(all);
});

rbac.post('/languages', async (c) => {
  const db = await createDbClient(c.env.DB);
  const data = await c.req.json();
  try {
    const [newItem] = await db.insert(languages).values({
      code: data.code,
      name: data.name,
      status: data.status || 'active',
      isDefault: !!data.isDefault
    }).returning();
    return c.json(newItem);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

rbac.patch('/languages/:code', async (c) => {
  const db = await createDbClient(c.env.DB);
  const code = c.req.param('code');
  const data = await c.req.json();
  try {
    if (data.isDefault) {
      await db.update(languages).set({ isDefault: false }).run();
    }
    await db.update(languages).set(data).where(eq(languages.code, code)).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

rbac.patch('/languages/default/:code', async (c) => {
  const db = await createDbClient(c.env.DB);
  const code = c.req.param('code');
  try {
    // 1. 全部取消默认
    await db.update(languages).set({ isDefault: false }).run();
    // 2. 设置指定语种为默认且启用
    await db.update(languages)
      .set({ isDefault: true, status: 'active' })
      .where(eq(languages.code, code))
      .run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

rbac.put('/languages', async (c) => {
  const db = await createDbClient(c.env.DB);
  const data = await c.req.json();
  try {
    const { code, ...updateData } = data;
    await db.update(languages).set(updateData).where(eq(languages.code, code)).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

rbac.delete('/languages/:code', async (c) => {
  const db = await createDbClient(c.env.DB);
  const code = c.req.param('code');
  try {
    const lang = await db.select().from(languages).where(eq(languages.code, code)).get();
    if (lang?.isDefault) return c.json({ error: '默认语种不可删除' }, 403);
    await db.delete(languages).where(eq(languages.code, code)).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * 1. 权限列表 (从 Registry 获取最新的所有可用权限)
 */
rbac.get('/permissions', async (c) => {
  const db = await createDbClient(c.env.DB);
  // 直接从数据库获取所有权限，确保动态生成的权限（如新建集合）能即时可见
  // 按分类（permCategory）和标识（slug）排序，确保前端展示整齐有序
  const allPerms = await db.select()
    .from(permissions)
    .orderBy(permissions.permCategory, permissions.slug)
    .all();
  return c.json(allPerms);
});

/**
 * 2. 角色管理 (Roles)
 */
rbac.get('/roles', async (c) => {
  const db = await createDbClient(c.env.DB);
  const allRoles = await db.select().from(roles).all();
  
  // 同时获取每个角色的权限集合
  const rolesWithPerms = await Promise.all(allRoles.map(async (role) => {
    const perms = await db.select({ slug: rolePermissions.permissionSlug })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, role.id));
    return { ...role, permissions: perms.map(p => p.slug) };
  }));

  return c.json(rolesWithPerms);
});

rbac.get('/roles/:id', async (c) => {
  const db = await createDbClient(c.env.DB);
  const id = parseInt(c.req.param('id'));
  const role = await db.select().from(roles).where(eq(roles.id, id)).get();
  
  if (!role) return c.json({ error: '角色不存在' }, 404);

  const perms = await db.select({ slug: rolePermissions.permissionSlug })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, id));

  return c.json({ ...role, permissions: perms.map(p => p.slug) });
});

rbac.post('/roles', async (c) => {
  const db = await createDbClient(c.env.DB);
  const { name, description, scope, permissionSlugs } = await c.req.json();
  try {
    const [newRole] = await db.insert(roles).values({ 
      name, 
      description, 
      scope: scope || 'tenant' 
    }).returning();
    let slugsToInsert = permissionSlugs || [];
    if (name === 'SuperAdmin') {
      slugsToInsert = Array.from(new Set(['all', ...slugsToInsert]));
    }
    if (slugsToInsert.length > 0) {
      await db.insert(rolePermissions).values(
        slugsToInsert.map((slug: string) => ({
          roleId: newRole.id,
          permissionSlug: slug
        }))
      );
    }
    return c.json(newRole);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

rbac.patch('/roles/:id', async (c) => {
  const db = await createDbClient(c.env.DB);
  const id = parseInt(c.req.param('id'));
  const { name, description, scope, permissionSlugs } = await c.req.json();
  try {
    const currentRole = await db.select().from(roles).where(eq(roles.id, id)).get();
    let finalSlugs = permissionSlugs || [];
    if (currentRole?.name === 'SuperAdmin') {
      finalSlugs = Array.from(new Set(['all', ...finalSlugs]));
    }
    await db.update(roles)
      .set({ name, description, scope: scope || currentRole?.scope })
      .where(eq(roles.id, id));
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
    if (finalSlugs.length > 0) {
      await db.insert(rolePermissions).values(
        finalSlugs.map((slug: string) => ({
          roleId: id,
          permissionSlug: slug
        }))
      );
    }
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

rbac.delete('/roles/:id', async (c) => {
  const db = await createDbClient(c.env.DB);
  const id = parseInt(c.req.param('id'));

  try {
    const role = await db.select().from(roles).where(eq(roles.id, id)).get();
    if (!role) return c.json({ error: '角色不存在' }, 404);
    if (role.name === 'SuperAdmin') {
      return c.json({ error: '系统核心角色不可删除' }, 403);
    }

    const ops = [
      db.delete(rolePermissions).where(eq(rolePermissions.roleId, id)),
      db.delete(adminsToRoles).where(eq(adminsToRoles.roleId, id)),
      db.delete(roles).where(eq(roles.id, id))
    ];

    if (typeof db.batch === 'function') {
      await db.batch(ops as any);
    } else {
      for (const op of ops) await op;
    }

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

rbac.get('/managers', async (c) => {
  const db = await createDbClient(c.env.DB);
  const allAdmins = await db.select({
    id: admins.id,
    username: admins.username,
    createdAt: admins.createdAt
  }).from(admins).all();

  const managersWithRoles = await Promise.all(allAdmins.map(async (admin) => {
    const userRoles = await db.select({
      id: roles.id,
      name: roles.name,
      tenantId: adminsToRoles.tenantId
    }).from(adminsToRoles)
      .innerJoin(roles, eq(adminsToRoles.roleId, roles.id))
      .where(eq(adminsToRoles.adminId, admin.id));
    
    return { ...admin, roles: userRoles };
  }));

  return c.json(managersWithRoles);
});

rbac.get('/managers/:id', async (c) => {
  const db = await createDbClient(c.env.DB);
  const id = c.req.param('id');
  const admin = await db.select({
    id: admins.id,
    username: admins.username,
    createdAt: admins.createdAt
  }).from(admins).where(eq(admins.id, id)).get();

  if (!admin) return c.json({ error: '管理员不存在' }, 404);

  const userRoles = await db.select({
    id: roles.id,
    name: roles.name,
    tenantId: adminsToRoles.tenantId
  }).from(adminsToRoles)
    .innerJoin(roles, eq(adminsToRoles.roleId, roles.id))
    .where(eq(adminsToRoles.adminId, id));

  return c.json({ ...admin, roles: userRoles });
});

rbac.post('/managers', async (c) => {
  const db = await createDbClient(c.env.DB);
  const { username, password, roleIds } = await c.req.json();
  const hashedPassword = await passwordHasher.hash(password);
  const adminId = generateId(15);

  try {
    const ops: any[] = [
      db.insert(admins).values({ id: adminId, username, hashedPassword })
    ];

    if (roleIds && roleIds.length > 0) {
      ops.push(
        db.insert(adminsToRoles).values(
          roleIds.map((rid: number) => ({ adminId, roleId: rid }))
        )
      );
    }

    if (typeof db.batch === 'function') {
      await db.batch(ops);
    } else {
      for (const op of ops) await op;
    }
    
    return c.json({ id: adminId, username });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

rbac.patch('/managers/:id', async (c) => {
  const db = await createDbClient(c.env.DB);
  const id = c.req.param('id');
  const { password, roleIds } = await c.req.json();

  try {
    const { adminAuth } = await getAuthInstances(c.env.DB);
    const authHeader = c.req.header('Cookie');
    const sessionId = adminAuth.readSessionCookie(authHeader ?? '');
    
    if (sessionId) {
      const { user } = await adminAuth.validateSession(sessionId);
      if (user?.id === id) {
        return c.json({ error: '出于系统安全考虑，禁止通过后台管理接口修改当前正在登录的账号。' }, 400);
      }
    }

    if (id === 'super-admin-01' && roleIds) {
      return c.json({ error: '系统初始超级管理员角色不可更改。' }, 403);
    }

    const ops: any[] = [];

    if (password && password.trim() !== '') {
      const hashedPassword = await passwordHasher.hash(password);
      ops.push(db.update(admins).set({ hashedPassword }).where(eq(admins.id, id)));
    }

    if (roleIds) {
      ops.push(db.delete(adminsToRoles).where(eq(adminsToRoles.adminId, id)));
      if (roleIds.length > 0) {
        ops.push(
          db.insert(adminsToRoles).values(
            roleIds.map((rid: number) => ({ adminId: id, roleId: rid }))
          )
        );
      }
    }

    if (ops.length === 0) return c.json({ message: 'No changes provided' });

    if (typeof db.batch === 'function') {
      await db.batch(ops);
    } else {
      for (const op of ops) await op;
    }

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

rbac.delete('/managers/:id', async (c) => {
  const db = await createDbClient(c.env.DB);
  const id = c.req.param('id');

  if (id === 'super-admin-01') {
    return c.json({ error: '系统初始超级管理员不可删除' }, 403);
  }

  try {
    const { adminAuth } = await getAuthInstances(c.env.DB);
    const authHeader = c.req.header('Cookie');
    const sessionId = adminAuth.readSessionCookie(authHeader ?? '');
    
    if (sessionId) {
      const { user } = await adminAuth.validateSession(sessionId);
      if (user?.id === id) {
        return c.json({ error: '无法删除当前正在登录的账号' }, 400);
      }
    }

    const ops = [
      db.delete(adminsToRoles).where(eq(adminsToRoles.adminId, id)),
      db.delete(adminSiteAccess).where(eq(adminSiteAccess.adminId, id)),
      db.delete(adminSessions).where(eq(adminSessions.userId, id)),
      db.delete(admins).where(eq(admins.id, id))
    ];

    if (typeof db.batch === 'function') {
      await db.batch(ops as any);
    } else {
      for (const op of ops) await op;
    }

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * 4. 动态模型管理 (Models)
 */
rbac.get('/models', async (c) => {
  const db = await createDbClient(c.env.DB);
  const allModels = await db.select().from(models).all();
  return c.json(allModels);
});

rbac.post('/models', async (c) => {
  const db = await createDbClient(c.env.DB);
  const body = await c.req.json();
  const { name, slug, fieldsJson, description } = body;
  try {
    // 容错处理：确保 fieldsJson 是对象数组
    const normalizedFields = typeof fieldsJson === 'string' ? JSON.parse(fieldsJson) : fieldsJson;
    
    const validation = validateModelDefinition({ name, slug, fieldsJson: normalizedFields });
    if (!validation.valid) {
      return c.json({ error: '模型定义不合法', details: validation.error }, 400);
    }

    const existing = await db.select().from(models).where(eq(models.slug, slug)).get();
    if (existing) {
      return c.json({ error: `模型标识 [${slug}] 已存在` }, 409);
    }

    const [newModel] = await db.insert(models).values({
      name,
      slug,
      fieldsJson: normalizedFields,
      description
    }).returning();

    const actions = [
      { action: 'view', name: '查看' },
      { action: 'edit', name: '编辑/新增' },
      { action: 'delete', name: '删除' }
    ];

    const permsToInsert = actions.map(a => ({
      slug: `entity:${slug}:${a.action}`,
      name: `${a.name}${name}`,
      permCategory: `模型: ${name}`,
      description: `动态模型 ${name} 的${a.name}权限`
    }));

    for (const p of permsToInsert) {
      try {
        await db.insert(permissions).values(p).onConflictDoNothing();
        registry.register(p);
      } catch (e) {}
    }

    return c.json(newModel);
  } catch (err: any) {
    console.error('❌ [RBAC] 创建模型失败:', err);
    return c.json({ error: err.message }, 500);
  }
});

/**
 * 更新模型定义 (智能编辑模式)
 * 逻辑：若模型已有关联集合且集合中有数据，则锁定 Key 和 Type。
 */
rbac.patch('/models/:id', async (c) => {
  const db = await createDbClient(c.env.DB);
  const id = parseInt(c.req.param('id'));
  const { name, fieldsJson, description } = await c.req.json();

  try {
    const oldModel = await db.select().from(models).where(eq(models.id, id)).get();
    if (!oldModel) return c.json({ error: '模型不存在' }, 404);

    // 1. 检查数据存在性，决定是否进入锁定模式
    const relatedColls = await db.select({ id: collections.id }).from(collections).where(eq(collections.modelId, id)).all();
    const collIds = relatedColls.map(rc => rc.id);
    
    let hasData = false;
    if (collIds.length > 0) {
      const dataCount = await db.select({ count: sql`count(*)` }).from(entities)
        .where(inArray(entities.collectionId, collIds)).get();
      hasData = (dataCount?.count || 0) > 0;
    }

    // 2. 字段层级深度校验
    if (hasData) {
      const oldFields = oldModel.fieldsJson || [];
      const newFields = fieldsJson || [];

      // 检查：禁止删除或修改已有字段的 name 和 type
      for (const oldF of oldFields) {
        const matchingNew = newFields.find((nf: any) => nf.name === oldF.name);
        if (!matchingNew) {
          return c.json({ error: `模型已有数据，禁止删除原有字段 [${oldF.name}]。` }, 400);
        }
        if (matchingNew.type !== oldF.type) {
          return c.json({ error: `模型已有数据，禁止修改已有字段 [${oldF.name}] 的数据类型。` }, 400);
        }
      }
    }

    // 3. 执行更新
    await db.update(models).set({
      name,
      fieldsJson,
      description,
      // slug 不允许修改，因为它涉及权限和路由分发基座
    }).where(eq(models.id, id));

    return c.json({ success: true, hasDataWarning: hasData });
  } catch (err: any) {
    console.error('❌ [RBAC] 更新模型失败:', err);
    return c.json({ error: err.message }, 500);
  }
});

rbac.delete('/models/:id', async (c) => {
  const db = await createDbClient(c.env.DB);
  const id = parseInt(c.req.param('id'));

  try {
    const model = await db.select().from(models).where(eq(models.id, id)).get();
    if (!model) return c.json({ error: '模型不存在' }, 404);

    // 1. 删除前审计：排除 media_library 等已解耦或不存在的集合引用
    const relatedCollections = await db.select()
      .from(collections)
      .where(eq(collections.modelId, id))
      .all();
    
    if (relatedCollections.length > 0) {
      const collNames = relatedCollections.map(c => c.name).join(', ');
      return c.json({ 
        error: `无法删除模型：仍有 [${relatedCollections.length}] 个业务集合 (${collNames}) 正在引用此定义。`, 
        details: '请先删除这些关联集合。' 
      }, 400);
    }

    const actions = ['view', 'edit', 'delete'];
    const permSlugs = actions.map(a => `entity:${model.slug}:${a}`);
    
    await db.delete(permissions).where(inArray(permissions.slug, permSlugs));
    permSlugs.forEach(slug => registry.unregister(slug));

    await db.delete(models).where(eq(models.id, id));

    return c.json({ success: true });
  } catch (err: any) {
    console.error('❌ [RBAC] 删除模型失败:', err);
    return c.json({ error: err.message }, 500);
  }
});

/**
 * 5. 业务集合管理 (Collections)
 */
rbac.get('/collections', async (c) => {
  const db = await createDbClient(c.env.DB);
  const results = await db.select({
    id: collections.id,
    name: collections.name,
    slug: collections.slug,
    modelId: collections.modelId,
    description: collections.description,
    icon: collections.icon,
    sort: collections.sort,
    menuGroup: collections.menuGroup,
    menuOrder: collections.menuOrder,
    parentId: collections.parentId,
    relationSettings: collections.relationSettings,
    fieldConfig: collections.fieldConfig,
    createdAt: collections.createdAt,
    modelName: models.name
  }).from(collections).innerJoin(models, eq(collections.modelId, models.id)).all();
  return c.json(results);
});

rbac.post('/collections', async (c) => {
  const db = await createDbClient(c.env.DB);
  const body = await c.req.json();
  const { 
    name, slug, modelId, description, icon, sort, 
    menuGroup, menuOrder, relationSettings, fieldConfig, parentId
  } = body;

  try {
    // 1. 唯一性冲突拦截
    const existing = await db.select().from(collections).where(eq(collections.slug, slug)).get();
    if (existing) {
      return c.json({ error: `业务集合标识 [${slug}] 已存在，请更换标识或先删除旧集合。` }, 409);
    }

    // 2. 防御性清理：物理强制删除可能残留的“僵尸权限”记录
    const legacyPerms = ['view', 'edit', 'delete'].map(a => `collection:${slug}:${a}`);
    await db.delete(permissions).where(inArray(permissions.slug, legacyPerms));
    legacyPerms.forEach(s => registry.unregister(s));

    // 3. 执行插入
    const inserted = await db.insert(collections).values({
      name,
      slug,
      modelId,
      description,
      icon,
      sort: sort || 0,
      menuGroup,
      menuOrder: menuOrder || 0,
      parentId: parentId || null,
      relationSettings: relationSettings || {},
      fieldConfig: fieldConfig || relationSettings || {} // progressive fallback
    }).returning();

    if (!inserted || inserted.length === 0) {
      throw new Error("数据插入成功但未能返回有效记录");
    }
    const newCollection = inserted[0];

    // 4. 创建权限点并分配给超级管理员
    const permActions = [
      { action: 'view', name: '查看' },
      { action: 'edit', name: '编辑/新增' },
      { action: 'delete', name: '删除' }
    ];

    // 获取受保护的 SuperAdmin 角色 ID
    const superRole = await db.select().from(roles).where(eq(roles.name, 'SuperAdmin')).get();

    for (const a of permActions) {
      const p = {
        slug: `collection:${slug}:${a.action}`,
        name: `${a.name}${name}`,
        permCategory: `业务集合: ${name}`,
        description: `业务集合 ${name} 的${a.name}权限`
      };
      
      try {
        await db.insert(permissions).values(p).onConflictDoNothing();
        registry.register(p);

        // 如果是查看权限且找到了超级管理员角色，则自动关联
        if (a.action === 'view' && superRole) {
          await db.insert(rolePermissions).values({
            roleId: superRole.id,
            permissionSlug: p.slug
          }).onConflictDoNothing();
        }
      } catch (regErr) {
        console.warn(`⚠️ [RBAC] 权限注册/关联失败 (${p.slug}):`, regErr);
      }
    }

    // 5. 最终同步权限雷达 (启用权威同步)
    await registry.syncToDb(db, true);

    return c.json(newCollection);
  } catch (err: any) {
    console.error('❌ [RBAC] 创建业务集合失败:', err);
    return c.json({ error: err.message || '内部服务器错误' }, 500);
  }
});

rbac.patch('/collections/:id', async (c) => {
  const db = await createDbClient(c.env.DB);
  const id = parseInt(c.req.param('id'));
  const body = await c.req.json();
  const { name, description, icon, sort, menuGroup, menuOrder, relationSettings, fieldConfig, parentId } = body;

  try {
    await db.update(collections)
      .set({ 
        name, 
        description, 
        icon, 
        sort, 
        menuGroup,
        menuOrder,
        parentId: parentId === undefined ? undefined : parentId,
        relationSettings: relationSettings || {},
        fieldConfig: fieldConfig || relationSettings || {}
      })
      .where(eq(collections.id, id));
    
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * 批量更新分组信息 (名称和图标)
 * NOTE: 分组是一个虚拟概念，物理上存储在每个 collection 的 menuGroup 字段中
 */
rbac.patch('/collections/group/:oldName', async (c) => {
  const db = await createDbClient(c.env.DB);
  const oldName = decodeURIComponent(c.req.param('oldName'));
  const { newName, icon } = await c.req.json();
  
  try {
    const updateData: any = {};
    if (newName) updateData.menuGroup = newName;
    if (icon) updateData.icon = icon;
    
    if (Object.keys(updateData).length === 0) {
      return c.json({ error: '没有提供更新数据' }, 400);
    }

    await db.update(collections)
      .set(updateData)
      .where(eq(collections.menuGroup, oldName))
      .run();
      
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

rbac.delete('/collections/:id', async (c) => {
  const db = await createDbClient(c.env.DB);
  const id = parseInt(c.req.param('id'));
  try {
    const item = await db.select().from(collections).where(eq(collections.id, id)).get();
    if (!item) return c.json({ error: '集合不存在' }, 404);

    // 1. 获取所有关联权限 Slugs
    const slugSuffixes = ['view', 'edit', 'delete'];
    const permSlugs = slugSuffixes.map(a => `collection:${item.slug}:${a}`);

    // 2. 物理删除关联数据
    // 注意：显式清理 role_permissions 以防级联约束未在物理库生效，避免 500 错误
    await db.delete(rolePermissions).where(inArray(rolePermissions.permissionSlug, permSlugs));
    await db.delete(permissions).where(inArray(permissions.slug, permSlugs));
    
    // 3. 同步注销内存注册表
    permSlugs.forEach(s => registry.unregister(s));

    // 4. 删除集合本身
    await db.delete(collections).where(eq(collections.id, id));
    
    // 5. 触发权限同步 (确认落地并清理孤儿)
    await registry.syncToDb(db, true);
    
    return c.json({ success: true });
  } catch (err: any) {
    console.error('❌ [RBAC] 删除集合失败:', err);
    return c.json({ error: err.message }, 500);
  }
});

export default rbac;
