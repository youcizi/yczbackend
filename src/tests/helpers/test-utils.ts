import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../../db/schema.ts';

/**
 * 模拟 D1 接口的包装器 (针对 better-sqlite3)
 * 严格遵循 Cloudflare D1 SDK 异步接口规范
 */
export const createMockD1 = (db: any) => {
  const createPreparedStatement = (sql: string, boundParams: any[] = []) => {
    const rawStmt = db.prepare(sql);
    
    const stmt = {
      bind: (...args: any[]) => createPreparedStatement(sql, args),
      
      all: async (...runParams: any[]) => {
        let finalParams = (runParams.length > 0 ? runParams : boundParams) || [];
        if (finalParams.length === 1 && Array.isArray(finalParams[0])) {
          finalParams = finalParams[0];
        }
        try {
          return { 
            results: rawStmt.all(...finalParams), 
            success: true,
            meta: { duration: 0 }
          };
        } catch (e: any) {
          // 适配 better-sqlite3 对非返回数据语句报错消息的不同版本
          const msg = (e.message || '').toLowerCase();
          if (msg.includes('not return data') || msg.includes('no result set')) {
             const result = rawStmt.run(...finalParams);
             return { results: [], success: true, meta: { duration: 0, lastRowId: result.lastInsertRowid, changes: result.changes } };
          }
          console.error(`❌ [D1 Mock Error] all() failed. SQL: ${sql}`);
          throw e;
        }
      },
      
      run: async (...runParams: any[]) => {
        let finalParams = (runParams.length > 0 ? runParams : boundParams) || [];
        if (finalParams.length === 1 && Array.isArray(finalParams[0])) {
          finalParams = finalParams[0];
        }
        try {
          const result = rawStmt.run(...finalParams);
          return { 
            success: true, 
            meta: { duration: 0, lastRowId: result.lastInsertRowid, changes: result.changes } 
          };
        } catch (e) {
          console.error(`❌ [D1 Mock Error] run() failed. SQL: ${sql}`);
          console.error(`   Params:`, finalParams);
          throw e;
        }
      },
      
      first: async (...runParams: any[]) => {
        let finalParams = (runParams.length > 0 ? runParams : boundParams) || [];
        if (finalParams.length === 1 && Array.isArray(finalParams[0])) {
          finalParams = finalParams[0];
        }
        try {
          const row = rawStmt.get(...finalParams) as any;
          return row || null;
        } catch (e) {
          console.error(`❌ [D1 Mock Error] first() failed. SQL: ${sql}`);
          console.error(`   Params:`, finalParams);
          throw e;
        }
      },
      
      raw: async (...runParams: any[]) => {
        let finalParams = (runParams.length > 0 ? runParams : boundParams) || [];
        if (finalParams.length === 1 && Array.isArray(finalParams[0])) {
          finalParams = finalParams[0];
        }
        try {
          return rawStmt.raw().all(...finalParams);
        } catch (e) {
          console.error(`❌ [D1 Mock Error] raw() failed. SQL: ${sql}`);
          console.error(`   Params:`, finalParams);
          throw e;
        }
      }
    };
    
    return stmt;
  };

  return {
    prepare: (sql: string) => createPreparedStatement(sql),
    batch: async (stmts: any[]) => {
      // Drizzle D1 期望这是一个 Promise.all
      return Promise.all(stmts.map(s => s.all()));
    },
    exec: async (sql: string) => {
      db.exec(sql);
      return { count: 1, duration: 0 };
    }
  };
};

/**
 * 创建一个用于测试的内存数据库实例 (已初始化完整 Schema)
 */
export function createTestDb() {
  const sqlite = new Database(':memory:');
  
  // 1. 初始化最新 Schema (必须与 production 保持高度一致)
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      name TEXT NOT NULL, 
      domain TEXT UNIQUE NOT NULL, 
      status TEXT DEFAULT 'active', 
      theme_data TEXT, 
      site_config TEXT, 
      metadata TEXT, 
      created_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, description TEXT, updated_at INTEGER);
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      name TEXT UNIQUE NOT NULL, 
      scope TEXT DEFAULT 'tenant', 
      description TEXT, 
      created_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS permissions (slug TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, perm_category TEXT, plugin_slug TEXT);
    CREATE TABLE IF NOT EXISTS role_permissions (role_id INTEGER NOT NULL, permission_slug TEXT NOT NULL, PRIMARY KEY(role_id, permission_slug));
    CREATE TABLE IF NOT EXISTS admins (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, hashed_password TEXT NOT NULL, created_at INTEGER);
    CREATE TABLE IF NOT EXISTS admin_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS admins_to_roles (
      admin_id TEXT NOT NULL, 
      role_id INTEGER NOT NULL, 
      tenant_id INTEGER NOT NULL DEFAULT 0, 
      PRIMARY KEY (admin_id, role_id, tenant_id)
    );
    CREATE TABLE IF NOT EXISTS admin_site_access (admin_id TEXT NOT NULL, site_id INTEGER NOT NULL, PRIMARY KEY (admin_id, site_id));
    
    -- 会员与询盘系统 (Multi-Tenant)
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY, 
      tenant_id INTEGER NOT NULL, 
      email TEXT NOT NULL, 
      password_hash TEXT NOT NULL, 
      type TEXT DEFAULT 'registered', 
      status TEXT DEFAULT 'active', 
      level INTEGER DEFAULT 1, 
      metadata TEXT, 
      created_at INTEGER, 
      updated_at INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS member_unique_idx ON members (tenant_id, email);

    CREATE TABLE IF NOT EXISTS member_sessions (
      id TEXT PRIMARY KEY, 
      user_id TEXT NOT NULL, 
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      tenant_id INTEGER NOT NULL, 
      member_id TEXT, 
      email TEXT NOT NULL, 
      content TEXT NOT NULL, 
      verify_token TEXT, 
      status TEXT DEFAULT 'pending', 
      created_at INTEGER, 
      updated_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS inquiry_tenant_idx ON inquiries (tenant_id, created_at);

    -- 动态模型引擎
    CREATE TABLE IF NOT EXISTS models (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, fields_json TEXT NOT NULL, description TEXT, metadata TEXT, created_at INTEGER);
    CREATE TABLE IF NOT EXISTS collections (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, model_id INTEGER NOT NULL, description TEXT, icon TEXT DEFAULT 'Layers', sort INTEGER DEFAULT 0, menu_group TEXT, menu_order INTEGER DEFAULT 0, parent_id INTEGER, relation_settings TEXT, field_config TEXT, permission_config TEXT, metadata TEXT, created_at INTEGER);
    CREATE TABLE IF NOT EXISTS entities (id INTEGER PRIMARY KEY AUTOINCREMENT, collection_id INTEGER NOT NULL, data_json TEXT NOT NULL, locale TEXT DEFAULT 'en-US', translation_group TEXT, created_by TEXT, metadata TEXT, created_at INTEGER, updated_at INTEGER);
    CREATE TABLE IF NOT EXISTS languages (code TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT DEFAULT 'active', is_default INTEGER DEFAULT 0, created_at INTEGER);
    CREATE TABLE IF NOT EXISTS media_items (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL, filename TEXT NOT NULL, mime_type TEXT NOT NULL, size INTEGER NOT NULL, is_remote INTEGER DEFAULT 0, created_by TEXT, metadata TEXT, created_at INTEGER);
    CREATE TABLE IF NOT EXISTS plugins (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      slug TEXT UNIQUE NOT NULL, 
      name TEXT NOT NULL, 
      config TEXT, 
      config_schema TEXT,
      is_enabled INTEGER DEFAULT 0, 
      created_at INTEGER, 
      updated_at INTEGER
    );

    -- Membership Plugin Tables
    CREATE TABLE IF NOT EXISTS p_member_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      member_id TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar TEXT,
      phone TEXT,
      tier_id INTEGER,
      account_type TEXT DEFAULT 'individual',
      created_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS p_profile_tenant_idx ON p_member_profiles (tenant_id, member_id);

    CREATE TABLE IF NOT EXISTS p_member_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      member_id TEXT NOT NULL,
      country_code TEXT DEFAULT 'CN',
      province TEXT,
      city TEXT,
      district TEXT,
      detail TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS p_address_tenant_idx ON p_member_addresses (tenant_id, member_id);

    CREATE TABLE IF NOT EXISTS p_member_tiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      discount_rate INTEGER DEFAULT 100,
      created_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS p_tier_tenant_idx ON p_member_tiers (tenant_id);

    CREATE TABLE IF NOT EXISTS p_member_tiers_i18n (
      tier_id INTEGER NOT NULL,
      lang_code TEXT NOT NULL,
      name TEXT NOT NULL,
      PRIMARY KEY (tier_id, lang_code)
    );
  `;
  
  sqlite.exec(schemaSql);

  // 2. 注入全局默认数据 (Gold Base 要求 - Drizzle 优先重构)
  const db = drizzle(sqlite, { schema });
  
  // 使用同步执行（better-sqlite3 配合 drizzle-orm）确保基础环境就绪
  db.insert(schema.sites).values({
    id: 1,
    name: 'Default Site',
    domain: 'localhost'
  }).run();

  db.insert(schema.roles).values({
    id: 99,
    name: 'SuperAdmin',
    scope: 'system'
  }).run();

  db.insert(schema.permissions).values({
    slug: 'all',
    name: 'Super Permission'
  }).run();

  db.insert(schema.rolePermissions).values({
    roleId: 99,
    permissionSlug: 'all'
  }).run();
  
  return {
    raw: sqlite,
    db
  };
}

/**
 * 模拟完整的 Request Env
 */
export function createMockEnv(sqliteInstance: any) {
  return {
    DB: createMockD1(sqliteInstance),
    NODE_ENV: 'test',
    SECRET_KEY: 'test-secret-key-1234567890',
    DEFAULT_ADMIN_PASSWORD: 'test-password-must-be-long'
  };
}
