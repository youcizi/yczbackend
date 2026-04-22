import { eq } from 'drizzle-orm';
import { plugins } from '../db/schema';

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
