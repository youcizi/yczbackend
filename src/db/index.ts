import * as schema from './schema';
import { InferSelectModel, InferInsertModel, eq, sql } from 'drizzle-orm';

/**
 * 统一数据库客户端缓存
 */
const clientCache = new Map<any, any>();
const initPromises = new Map<any, Promise<any>>();

/**
 * 获取数据库客户端 (Unified Interface)
 * 兼容 Cloudflare D1 (生产), Better-SQLite3 (本地), 以及测试环境
 */
export const createDbClient = async (d1: any) => {
  // 1. 优先从同步缓存获取
  if (d1 && clientCache.has(d1)) {
    return clientCache.get(d1);
  }
  if (!d1 && clientCache.has('LOCAL_SQLITE')) {
     return clientCache.get('LOCAL_SQLITE');
  }

  // 1.1 锁定初始化过程，防止并发请求导致多次加载驱动或死锁
  const lockKey = d1 || 'LOCAL_SQLITE';
  if (initPromises.has(lockKey)) {
    return await initPromises.get(lockKey);
  }

  const initTask = (async () => {
    // 1.2 再次检查缓存 (防止 Promise 链竞争)
    if (clientCache.has(lockKey)) return clientCache.get(lockKey);

    // 探测是否为 Drizzle 客户端 (透传)
    if (d1 && (typeof d1.select === 'function' || typeof d1.query === 'function')) {
      clientCache.set(d1, d1);
      return d1;
    }

    // 环境判定
    const isNode = typeof process !== 'undefined' && !!process.versions?.node;
    const isDev = import.meta.env.DEV || (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production');
    const isTest = typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || !!process.env.VITEST);

    // 模式 A: 极致坚韧的 D1 绑定提取 (适配 Astro 6 + Wrangler Proxy)
    // 1. 如果传入的是 Drizzle 实例，直接返回
    if (d1 && (typeof d1.select === 'function' || typeof d1.query === 'function')) {
      return d1;
    }

    // 2. 判定是否为 D1 接口 (线上或本地代理)
    let d1Binding = d1;
    
    // 如果 d1 是空的，尝试从 Astro.locals 或全局环境强制捞取 (针对本地开发环境注入延迟的情况)
    if (!d1Binding || Object.keys(d1Binding).length === 0) {
       // @ts-ignore
       d1Binding = d1?.DB || d1?.env?.DB;
    }

    const isD1 = d1Binding && (typeof d1Binding.prepare === 'function' || typeof d1Binding.batch === 'function');
    
    if (isD1) {
      try {
        const { drizzle: drizzleD1 } = await import('drizzle-orm/d1');
        const client = drizzleD1(d1Binding, { schema });
        clientCache.set(d1, client); // 缓存原始 key
        return client;
      } catch (e) {
        console.error('❌ [DB D1] 初始化驱动失败:', e);
        throw e;
      }
    }

    // 模式 B: 开发环境异常处理
    if (isDev && !isTest) {
      console.error('❌ [DB Admin] 致命错误：数据库绑定 (D1) 丢失！');
      console.warn('当前获得的 d1 对象内容:', typeof d1, d1 ? Object.keys(d1) : 'null');
      throw new Error('Database Binding Missing (D1 REQUIRED)');
    }

    throw new Error(`❌ [DB Error] 无法初始化数据库驱动。d1Type=${typeof d1}`);
  })();

  initPromises.set(lockKey, initTask);
  
  try {
    const client = await initTask;
    return client;
  } finally {
    // 任务完成后可以清理 Promise 缓存，也可以保留
  }
};

export abstract class BaseRepository<T extends Record<string, any>> {
  constructor(protected db: any) {}
}

export { schema, eq, sql };
export type Site = InferSelectModel<typeof schema.sites>;
export type NewSite = InferInsertModel<typeof schema.sites>;
export type Setting = InferSelectModel<typeof schema.settings>;
export * from 'drizzle-orm';
