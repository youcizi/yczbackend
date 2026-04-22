import * as schema from './schema';
import { InferSelectModel, InferInsertModel, eq, sql } from 'drizzle-orm';

/**
 * 统一数据库客户端缓存
 */
const clientCache = new Map<any, any>();

/**
 * 获取数据库客户端 (Unified Interface)
 * 兼容 Cloudflare D1 (生产), Better-SQLite3 (本地), 以及测试环境
 */
export const createDbClient = async (d1: any) => {
  // 1. 优先从缓存获取
  if (d1 && clientCache.has(d1)) {
    return clientCache.get(d1);
  }

  // 1.1 探测是否为 Drizzle 客户端 (透传)
  if (d1 && (typeof d1.select === 'function' || typeof d1.query === 'function')) {
    return d1;
  }

  // 环境判定
  const isNode = typeof process !== 'undefined' && !!process.versions?.node;
  const isDev = import.meta.env.DEV || (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production');
  const isTest = typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || !!process.env.VITEST);

  // 模式 A: D1 模式 (线上或本地代理)
  const hasD1 = d1 && typeof d1.batch === 'function';
  if (hasD1) {
    try {
      const { drizzle: drizzleD1 } = await import('drizzle-orm/d1');
      const client = drizzleD1(d1, { schema });
      clientCache.set(d1, client);
      return client;
    } catch (e) {
      console.error('❌ [DB D1] 初始化失败:', e);
      if (!isDev && !isTest) throw e;
    }
  }

  // 模式 B: 探测原始 SQLite 实例 (Better-SQLite3)
  // 许多集成测试会传一个 Database 实例或包装过的 Mock 对象
  const rawSqlite = d1?.db || d1;
  if (rawSqlite && (rawSqlite.constructor?.name === 'Database' || (typeof rawSqlite.exec === 'function' && typeof rawSqlite.prepare === 'function'))) {
    try {
        const { drizzle: drizzleSqlite } = await import('drizzle-orm/better-sqlite3');
        const client = drizzleSqlite(rawSqlite, { schema });
        clientCache.set(d1, client);
        return client;
    } catch (e) {
        console.warn('⚠️ [DB Compat] 包装原始 SQLite 实例失败:', e);
    }
  }

  // 模式 C: 本地开发环境自动回退 (local.db)
  if (isNode && isDev && !isTest) {
    try {
      const { getLocalDbClient } = await import('./local-driver');
      const client = await getLocalDbClient();
      clientCache.set('LOCAL_SQLITE', client);
      return client;
    } catch (err) {
      console.error('❌ [DB Local] 初始化本地 SQLite 失败:', err);
      throw err;
    }
  }

  throw new Error(`❌ [DB Error] 无法初始化数据库驱动。hasD1=${!!hasD1}, isTest=${isTest}, d1Type=${typeof d1}`);
};

export abstract class BaseRepository<T extends Record<string, any>> {
  constructor(protected db: any) {}
}

export { schema, eq, sql };
export type Site = InferSelectModel<typeof schema.sites>;
export type NewSite = InferInsertModel<typeof schema.sites>;
export type Setting = InferSelectModel<typeof schema.settings>;
export * from 'drizzle-orm';
