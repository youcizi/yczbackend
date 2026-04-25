import { eq, inArray } from 'drizzle-orm';
import { permissions, rolePermissions, collections, models } from '../db/schema';

export interface PermissionDef {
  slug: string;
  name: string;
  description?: string;
  permCategory: string;
}

const CORE_PERMISSIONS: PermissionDef[] = [
  { slug: 'all', name: '超级权限', permCategory: 'System', description: '拥有系统所有操作权限' },
  { slug: 'admin.manage', name: '管理员管理', permCategory: 'System' },
  { slug: 'role.manage', name: '角色权限管理', permCategory: 'System' },
  { slug: 'languages.manage', name: '多语言管理', permCategory: 'System' },
  { slug: 'plugins.manage', name: '插件管理', permCategory: 'System' },

  // 站点管理
  { slug: 'site.view', name: '查看站点', permCategory: '站点管理' },
  { slug: 'site.edit', name: '编辑站点', permCategory: '站点管理' },
  { slug: 'site.delete', name: '删除站点', permCategory: '站点管理' },
  // NOTE: 初始化站点是高风险操作，独立鉴权
  { slug: 'site.init', name: '初始化站点', permCategory: '站点管理', description: '执行站点模板初始化操作，会覆盖现有数据' },

  // 附件管理
  { slug: 'media.manage', name: '附件管理', permCategory: '附件管理' },

  // 线索中心 (CRM Leads)
  { slug: 'leads.view', name: '查看线索', permCategory: '线索中心', description: '查看 CRM 线索列表及详情' },
  { slug: 'leads.manage', name: '管理线索', permCategory: '线索中心', description: '更新线索状态、跟进备注等操作' },

  // 系统设置
  { slug: 'settings.general', name: '常规设置', permCategory: '系统设置', description: '读取和修改站点常规配置项' },
  { slug: 'settings.mail', name: '邮件服务配置', permCategory: '系统设置', description: '配置 SMTP / SendGrid 等邮件发送服务' },
  { slug: 'settings.ai', name: 'AI 网关配置', permCategory: '系统设置', description: '管理 AI 提供商及模型分发矩阵' },
];

const CORE_SLUGS = CORE_PERMISSIONS.map(p => p.slug);

/**
 * 权限注册器
 * 用于在应用启动或模块加载时，自动同步权限条目到数据库
 */
export class PermissionRegistry {
  private static instance: PermissionRegistry;
  private pendingPermissions: Map<string, PermissionDef> = new Map();

  public constructor() {}

  public static getInstance(): PermissionRegistry {
    if (!PermissionRegistry.instance) {
      PermissionRegistry.instance = new PermissionRegistry();
    }
    return PermissionRegistry.instance;
  }

  /**
   * 注册权限定义 (暂存)
   */
  public register(def: PermissionDef) {
    if (!def.slug) {
      console.warn('⚠️ [Permission] 拒绝注册空 Slug 权限:', def);
      return;
    }
    this.pendingPermissions.set(def.slug, def);
    console.log(`📡 [Permission] 已登记权限: ${def.slug} (${def.name})`);
  }

  /**
   * 同步到数据库
   * @param db Drizzle 数据库实例
   * @param authoritative 是否启用权威同步 (删除数据库中不在注册表范围内的权限)
   */
  public async syncToDb(db: any, authoritative: boolean = false) {
    const defs = Array.from(this.pendingPermissions.values());
    const registeredSlugsInMem = defs.map(d => d.slug);

    try {
      // 1. 批量写入/更新当前内存中的权限 (使用 D1 友好的“查-写”模式代替 onConflict)
      for (const def of defs) {
        try {
          const existing = await db.select().from(permissions).where(eq(permissions.slug, def.slug)).get();
          
          if (existing) {
            await db.update(permissions)
              .set({
                name: def.name,
                description: def.description,
                permCategory: def.permCategory
              })
              .where(eq(permissions.slug, def.slug))
              .run();
          } else {
            await db.insert(permissions).values({
              slug: def.slug,
              name: def.name,
              description: def.description,
              permCategory: def.permCategory
            }).run();
          }
        } catch (e) {
          console.warn(`⚠️ [Permission] 同步单个权限失败 (${def.slug}):`, e);
        }
      }

      // 2. 权威同步：清理数据库中的孤儿权限
      if (authoritative) {
        // A. 获取数据库中现存的所有权限
        const dbPermissions = await db.select().from(permissions).all();
        
        // B. 动态构建“物理合法”权限白名单 (内存记录 + 核心权限)
        // 注意：如果不依赖内存，可以直接从 collections/models 表实时生成合法 Slugs
        const activeCollections = await db.select({ slug: collections.slug }).from(collections).all();
        const activeModels = await db.select({ slug: models.slug }).from(models).all();
        
        const legalDynamicSlugs = [
          ...activeCollections.flatMap(c => [`collection:${c.slug}:view`, `collection:${c.slug}:edit`, `collection:${c.slug}:delete`]),
          ...activeModels.flatMap(m => [`entity:${m.slug}:view`, `entity:${m.slug}:edit`, `entity:${m.slug}:delete`]),
        ];

        const allLegalSlugs = new Set([...CORE_SLUGS, ...registeredSlugsInMem, ...legalDynamicSlugs]);

        // C. 识别孤儿
        const orphans = dbPermissions.filter((p: any) => !allLegalSlugs.has(p.slug));
        
        console.log(`📡 [Permission] 权威同步审计: DB(${dbPermissions.length}), 合法池(${allLegalSlugs.size}), 命中孤儿(${orphans.length})`);

        if (orphans.length > 0) {
          const orphanSlugs = orphans.map((p: any) => p.slug);
          console.log(`🧹 [Permission] 即将清理 ${orphans.length} 条孤儿权限: ${orphanSlugs.slice(0, 3).join(', ')}...`);
          
          try {
            // 原子清理关联与主体
            await db.delete(rolePermissions).where(inArray(rolePermissions.permissionSlug, orphanSlugs));
            await db.delete(permissions).where(inArray(permissions.slug, orphanSlugs));
            console.log(`✅ [Permission] 权威同步清理成功`);
          } catch (delError) {
            console.error(`❌ [Permission] 孤儿清理失败 (物理冲突):`, delError);
          }
        }
      }

      console.log(`✅ [Permission] 权限同步完成 (共登记 ${defs.length} 条)`);
    } catch (err) {
      console.error('❌ [Permission] 同步权限失败:', err);
    }
  }

  /**
   * 获取所有已登记权限
   */
  public getAll(): PermissionDef[] {
    return Array.from(this.pendingPermissions.values());
  }

  /**
   * 清空所有登记的权限
   */
  public clear() {
    this.pendingPermissions.clear();
    console.log('🧹 [Permission] 注册表已清空');
  }

  /**
   * 取消注册权限
   */
  public unregister(slug: string) {
    this.pendingPermissions.delete(slug);
    console.log(`🧹 [Permission] 已注销权限: ${slug}`);
  }

  /**
   * 检查权限是否存在 (用于测试结果验证)
   */
  public has(slug: string): boolean {
    return this.pendingPermissions.has(slug);
  }

  /**
   * 初始化核心权限
   */
  public initCorePermissions() {
    this.clear(); // 强制初始化，防止残留
    CORE_PERMISSIONS.forEach(p => this.register(p));
  }

  /**
   * 动态模型/集合权限映射器
   */
  public registerDynamicPermissions(item: { slug: string, name: string }, type: 'entity' | 'collection') {
    const actions = [
      { action: 'view', name: '查看' },
      { action: 'edit', name: '编辑/保存' },
      { action: 'delete', name: '删除' }
    ];
    
    actions.forEach(a => {
      this.register({
        slug: `${type}:${item.slug}:${a.action}`,
        name: `${a.name}${item.name}`,
        permCategory: `${type === 'entity' ? '模型' : '业务集合'}: ${item.name}`,
      });
    });
  }
}

// 导出单例
export const registry = PermissionRegistry.getInstance();

/**
 * 兼容性保留（转发至单例）
 */
export const initCorePermissions = () => registry.initCorePermissions();
export const registerDynamicPermissions = (item: { slug: string, name: string }, type: 'entity' | 'collection') => 
  registry.registerDynamicPermissions(item, type);
