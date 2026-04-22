import * as schema from './schema';
import path from 'node:path';
import fs from 'node:fs';

/**
 * 仅限本地开发使用的 SQLite 驱动加载器
 * 核心逻辑：使用项目根目录下的 local.db 文件
 */
export async function getLocalDbClient() {
  // 1. 动态加载驱动包
  const { drizzle: drizzleSqlite } = await import('drizzle-orm/better-sqlite3');
  const betterSqlite3 = await import('better-sqlite3');
  
  // 兼容 CJS/ESM 导入差异
  let Database = (betterSqlite3 as any).default || betterSqlite3;
  
  if (typeof Database !== 'function') {
    throw new Error(`❌ [DB Local] better-sqlite3 构造函数获取失败。请确保已在本地安装: pnpm add -D better-sqlite3`);
  }

  // 2. 确定路径 (项目根目录下的 local.db)
  const rootDir = process.cwd();
  const dbPath = path.resolve(rootDir, 'local.db');
  console.log(`🔌 [DB Local] 正在挂载本地数据库: ${dbPath}`);

  // 确保目录存在
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // 3. 初始化实例
  // @ts-ignore
  const sqlite = new Database(dbPath);
  
  // 执行安全引导逻辑 (创建核心表并同步缺失字段)
  bootstrapSchema(sqlite);

  return drizzleSqlite(sqlite, { schema });
}

/**
 * 安全引导：确保核心业务表存在，且字段与 schema.ts 同步 (适用于本地开发环境)
 */
function bootstrapSchema(db: any) {
  // A. 基础建表逻辑 (使用 IF NOT EXISTS)
  const initSql = `
    CREATE TABLE IF NOT EXISTS sites (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, domain TEXT UNIQUE NOT NULL, status TEXT DEFAULT 'active', theme_data TEXT, site_config TEXT, metadata TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now')));
    CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, description TEXT, updated_at INTEGER);
    CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, scope TEXT DEFAULT 'tenant', description TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now')));
    CREATE TABLE IF NOT EXISTS permissions (slug TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, perm_category TEXT);
    CREATE TABLE IF NOT EXISTS role_permissions (role_id INTEGER NOT NULL, permission_slug TEXT NOT NULL, PRIMARY KEY (role_id, permission_slug), FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE, FOREIGN KEY (permission_slug) REFERENCES permissions(slug) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS admins (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, hashed_password TEXT NOT NULL, created_at INTEGER DEFAULT (strftime('%s', 'now')));
    CREATE TABLE IF NOT EXISTS admin_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL, FOREIGN KEY (user_id) REFERENCES admins(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS admins_to_roles (admin_id TEXT NOT NULL, role_id INTEGER NOT NULL, tenant_id INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (admin_id, role_id, tenant_id), FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE, FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS admin_site_access (admin_id TEXT NOT NULL, site_id INTEGER NOT NULL, PRIMARY KEY (admin_id, site_id), FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE, FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE);
    
    -- 新版多租户会员体系
    CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, tenant_id INTEGER NOT NULL, email TEXT NOT NULL, password_hash TEXT NOT NULL, type TEXT DEFAULT 'registered', status TEXT DEFAULT 'active', level INTEGER DEFAULT 1, metadata TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now')), updated_at INTEGER);
    CREATE TABLE IF NOT EXISTS member_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL, FOREIGN KEY (user_id) REFERENCES members(id) ON DELETE CASCADE);
    
    -- 线索与询盘系统
    CREATE TABLE IF NOT EXISTS inquiries (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, member_id TEXT, email TEXT NOT NULL, content TEXT NOT NULL, verify_token TEXT, status TEXT DEFAULT 'pending', source_url TEXT, metadata TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now')), updated_at INTEGER, FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL);
    
    CREATE TABLE IF NOT EXISTS models (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, fields_json TEXT NOT NULL, description TEXT, metadata TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now')));
    CREATE TABLE IF NOT EXISTS collections (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, model_id INTEGER NOT NULL, description TEXT, icon TEXT DEFAULT 'Layers', sort INTEGER DEFAULT 0, menu_group TEXT, menu_order INTEGER DEFAULT 0, parent_id INTEGER, relation_settings TEXT, field_config TEXT, permission_config TEXT, metadata TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now')), FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE, FOREIGN KEY (parent_id) REFERENCES collections(id));
    CREATE TABLE IF NOT EXISTS entities (id INTEGER PRIMARY KEY AUTOINCREMENT, collection_id INTEGER NOT NULL, data_json TEXT NOT NULL, locale TEXT DEFAULT 'en-US', translation_group TEXT, created_by TEXT, metadata TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now')), updated_at INTEGER, FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS languages (code TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT DEFAULT 'active', is_default INTEGER DEFAULT 0, created_at INTEGER DEFAULT (strftime('%s', 'now')));
    CREATE TABLE IF NOT EXISTS media_items (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL, filename TEXT NOT NULL, mime_type TEXT NOT NULL, size INTEGER NOT NULL, is_remote INTEGER DEFAULT 0, created_by TEXT, metadata TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now')));
    CREATE TABLE IF NOT EXISTS plugins (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      slug TEXT UNIQUE NOT NULL, 
      name TEXT NOT NULL, 
      config TEXT, 
      is_enabled INTEGER NOT NULL DEFAULT 0, 
      created_at INTEGER, 
      updated_at INTEGER
    );
  `;
  db.exec(initSql);

  // B. 字段自愈逻辑
  const syncColumns = (tableName: string, requiredColumns: Record<string, string>) => {
    try {
      const existingColumns = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
      const existingNames = existingColumns.map(c => c.name);
      
      for (const [colName, colType] of Object.entries(requiredColumns)) {
        if (!existingNames.includes(colName)) {
          console.log(`🚧 [DB Sync] 正在为 ${tableName} 表同步缺失字段: ${colName}`);
          db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colType};`);
        }
      }
    } catch (e) {
      console.warn(`⚠️ [DB Sync] 同步表 ${tableName} 字段失败:`, e);
    }
  };

  syncColumns('roles', { 'scope': "TEXT DEFAULT 'tenant'" });
  syncColumns('admins_to_roles', { 'tenant_id': 'INTEGER NOT NULL DEFAULT 0' });

  syncColumns('collections', {
    'menu_group': 'TEXT',
    'menu_order': 'INTEGER DEFAULT 0',
    'parent_id': 'INTEGER',
    'relation_settings': 'TEXT',
    'field_config': 'TEXT',
    'permission_config': 'TEXT',
    'metadata': 'TEXT'
  });

  syncColumns('entities', {
    'locale': "TEXT DEFAULT 'en-US'",
    'translation_group': 'TEXT',
    'created_by': 'TEXT',
    'metadata': 'TEXT',
    'updated_at': 'INTEGER'
  });

  syncColumns('inquiries', {
    'source_url': 'TEXT',
    'metadata': 'TEXT'
  });

  console.log('✅ [DB Bootstrap] 本地核心数据表已同步/校验完成');
}
