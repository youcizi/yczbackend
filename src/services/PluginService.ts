import { eq, inArray } from 'drizzle-orm';
import { plugins, permissions } from '../db/schema';
import { PLUGIN_CODE_REGISTRY } from '../lib/plugin-registry';

/**
 * 插件管理服务
 * 处理插件的元数据查询、状态检查及缓存逻辑
 */
export class PluginService {
  /**
   * 检查插件状态
   * @param db 数据库实例
   * @param slug 插件标识符
   * @returns 插件详细信息或 null
   */
  static async checkPluginStatus(db: any, slug: string) {
    if (!slug) {
      throw new Error('插件 Slug 不能为空');
    }

    // 1. 尝试从缓存获取 (预留位置)
    const cached = await this.cacheGet(slug);
    if (cached) return cached;

    // 2. 查询 D1 数据库
    const result = await db.select().from(plugins).where(eq(plugins.slug, slug)).get();

    // 3. 写入缓存 (预留位置)
    if (result) {
      await this.cacheSet(slug, result);
    }

    return result;
  }

  /**
   * 获取所有已启用的插件
   * @param db 数据库实例
   */
  static async getEnabledPlugins(db: any) {
    return await db.select()
      .from(plugins)
      .where(eq(plugins.isEnabled, true))
      .all();
  }

  /**
   * 获取所有注册的插件 (包含禁用的)
   */
  static async getAllPlugins(db: any) {
    return await db.select().from(plugins).all();
  }

  /**
   * 更新插件启用状态
   */
  static async updatePluginStatus(db: any, id: number, isEnabled: boolean) {
    return await db.update(plugins)
      .set({ isEnabled, updatedAt: new Date() })
      .where(eq(plugins.id, id))
      .run();
  }

  /**
   * 安装插件
   */
  static async installPlugin(db: any, slug: string, metadata: { name: string; description?: string; author?: string }) {
    return await this.registerPlugin(db, {
      slug,
      name: metadata.name,
      description: metadata.description || '',
      version: '1.0.0',
      author: metadata.author || '',
      isEnabled: true // 默认安装即激活
    });
  }

  /**
   * 卸载插件 (仅删除元数据)
   */
  static async uninstallPlugin(db: any, slug: string) {
    await db.delete(plugins).where(eq(plugins.slug, slug)).run();
    await this.clearCache();
    return true;
  }

  /**
   * 切换启禁用状态
   */
  static async togglePlugin(db: any, slug: string, enabled: boolean) {
    // 修正: Drizzle mode: boolean 期待 boolean 类型
    await db.update(plugins)
      .set({ isEnabled: enabled, updatedAt: new Date() })
      .where(eq(plugins.slug, slug))
      .run();

    if (enabled) {
      const bundle = PLUGIN_CODE_REGISTRY[slug];
      if (bundle && bundle.manifest.permissions) {
        // 动态注入到内存注册表
        const { registry } = await import('../lib/permission-registry');
        registry.registerPluginPermissions({ slug, name: bundle.manifest.name }, bundle.manifest.permissions);
        // 执行同步到 DB
        await registry.syncToDb(db, true);
      }
    }

    await this.clearCache();
    return true;
  }

  /**
   * 获取所有已启用插件的管理后台菜单
   */
  static async getAdminMenus(db: any) {
    const enabledPlugins = await this.getEnabledPlugins(db);
    const menus = [];

    for (const p of enabledPlugins) {
      const bundle = PLUGIN_CODE_REGISTRY[p.slug];
      if (bundle && bundle.manifest.adminMenu) {
        menus.push({
          ...bundle.manifest.adminMenu,
          slug: p.slug
        });
      }
    }

    return menus;
  }

  /**
   * 手动登记新插件 (供管理后台使用)
   */
  static async registerPluginManually(db: any, data: { slug: string; name: string; description: string }) {
    // 1. 验证代码是否存在于注册表
    const bundle = PLUGIN_CODE_REGISTRY[data.slug];
    if (!bundle) {
      throw new Error(`[代码认证失败] 在 src/plugins/ 未找到 slug 为 "${data.slug}" 的插件代码。请先在代码层面完成导入。`);
    }

    const manifest = bundle.manifest;

    // 2. 插入元数据
    const result = await this.registerPlugin(db, {
      slug: data.slug,
      name: data.name || manifest.name,
      description: data.description || manifest.description,
      version: manifest.version,
      author: manifest.author,
      isEnabled: false // 初始默认为停用，需手动激活
    });

    return result;
  }

  /**
   * 注册/更新插件元数据 (内部调用)
   */
  static async registerPlugin(db: any, data: { 
    slug: string; 
    name: string; 
    description: string; 
    version: string; 
    author: string;
    isEnabled?: boolean;
  }) {
    // Upsert 逻辑
    const existing = await db.select().from(plugins).where(eq(plugins.slug, data.slug)).get();
    
    if (existing) {
      await db.update(plugins)
        .set({
          name: data.name,
          description: data.description,
          version: data.version,
          author: data.author,
          isEnabled: data.isEnabled ?? existing.isEnabled,
          updatedAt: new Date(),
        })
        .where(eq(plugins.slug, data.slug))
        .run();
    } else {
      await db.insert(plugins).values({
        slug: data.slug,
        name: data.name,
        description: data.description,
        version: data.version,
        author: data.author,
        isEnabled: data.isEnabled ?? true,
        configSchema: {}
      }).run();
    }
    
    await this.clearCache();
    return true;
  }

  private static async clearCache() {
    // @ts-ignore
    this.cache = null;
  }

  /**
   * 更新插件配置 (基于 Slug)
   */
  static async updatePluginConfigBySlug(db: any, slug: string, config: any) {
    await db.update(plugins)
      .set({ config, updatedAt: new Date() })
      .where(eq(plugins.slug, slug))
      .run();
    
    await this.clearCache();
  }

  /**
   * 更新插件配置 (含 Schema 容错与脏数据检测)
   * @param db 数据库实例
   * @param id 插件 ID
   * @param config 配置对象
   */
  static async updatePluginConfig(db: any, id: number, config: any) {
    try {
      // 1. 脏数据检测：验证是否为合法的 JSON 对象
      // 如果传入的是字符串，尝试解析；如果是对象，验证其合法性
      let finalConfig = config;
      if (typeof config === 'string') {
        finalConfig = JSON.parse(config);
      }

      if (finalConfig === null || typeof finalConfig !== 'object' || Array.isArray(finalConfig)) {
        throw new Error('配置必须是一个合法的 JSON 对象');
      }

      // 2. 执行更新
      const result = await db.update(plugins)
        .set({ 
          config: finalConfig, 
          updatedAt: new Date() 
        })
        .where(eq(plugins.id, id))
        .run();

      // 3. 清理该插件的缓存 (如果有)
      // TODO: 缓存失效逻辑
      
      return result;
    } catch (err: any) {
      console.error(`❌ [PluginService] Update Config Error for ID ${id}:`, err);
      throw new Error(`配置保存失败: ${err.message}`);
    }
  }

  /**
   * 从缓存读取 (桩函数)
   * // TODO: Cloudflare KV Implementation
   */
  private static async cacheGet(slug: string): Promise<any | null> {
    // 暂未实现 KV 绑定时直接返回空
    return null;
  }

  /**
   * 写入缓存 (桩函数)
   * // TODO: Cloudflare KV Implementation
   */
  private static async cacheSet(slug: string, data: any): Promise<void> {
    // 暂未实现
    return;
  }
}
