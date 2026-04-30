import { Hono } from 'hono';
import auth from './routes/auth';
import apiV1 from './routes/api-v1';
import rbac from './routes/rbac-routes';
import entities from './routes/entities';
import media from './routes/media';
import webhooks from './routes/webhooks';
import publicApi from './routes/public-api';
import settings from './routes/settings';
import infra from './routes/infra';
import plugins from './routes/api/v1/plugins';
import users from './routes/api/v1/users';
import ai, { publicAiGateway } from './routes/ai';
import { validateConfig } from './lib/config';
import { getAuthInstances } from './lib/auth';
import { createDbClient, sql } from './db';
import { models, collections } from './db/schema';
import { seedAdmin } from './core/seed';
import { PermissionRegistry, registry as globalRegistry } from './lib/permission-registry';
import { requirePermission } from './middleware/rbac';
import { domainDispatcher } from './middleware/dispatch';
import { ImageProxy } from './services/ImageProxy';
import { IdentityService } from './services/IdentityService';

// 权限自动同步进度锁 (利用 Worker 内存或 Promise 状态，防止并发冲突)
let syncPromise: Promise<void> | null = null;
let isSynced = false;

/**
 * 核心初始化逻辑 (含权限同步、数据库 Radar 补全)
 * 封装为独立函数以支持并发控制
 */
async function performSystemSync(c: any, registry: PermissionRegistry) {
  const db = await createDbClient(c.env.DB);
  console.log(`📡 [System] 正在启动 Schema Radar (Environment: ${c.env.NODE_ENV || 'local'})...`);

  // [Schema Migration Radar] 自动补全数据库缺失表与列 (必须在业务查询之前执行)
  if (c.env.NODE_ENV !== 'production') {
    try {
      // 核心 RBAC 架构
      await db.run(sql`CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, scope TEXT DEFAULT 'tenant', description TEXT, created_at INTEGER)`);
      await db.run(sql`CREATE TABLE IF NOT EXISTS permissions (slug TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, perm_category TEXT, plugin_slug TEXT)`);
      await db.run(sql`CREATE TABLE IF NOT EXISTS role_permissions (role_id INTEGER NOT NULL, permission_slug TEXT NOT NULL, PRIMARY KEY(role_id, permission_slug))`);

      // 核心模型架构
      await db.run(sql`CREATE TABLE IF NOT EXISTS models (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, fields_json TEXT NOT NULL, description TEXT, metadata TEXT, created_at INTEGER)`);
      await db.run(sql`CREATE TABLE IF NOT EXISTS collections (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, model_id INTEGER NOT NULL, description TEXT, icon TEXT DEFAULT 'Layers', sort INTEGER DEFAULT 0, menu_group TEXT, menu_order INTEGER DEFAULT 0, parent_id INTEGER, relation_settings TEXT, field_config TEXT, permission_config TEXT, metadata TEXT, created_at INTEGER)`);
      await db.run(sql`CREATE TABLE IF NOT EXISTS sites (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, domain TEXT UNIQUE NOT NULL, status TEXT DEFAULT 'active', theme_data TEXT, site_config TEXT, metadata TEXT, created_at INTEGER)`);
      await db.run(sql`CREATE TABLE IF NOT EXISTS entities (id INTEGER PRIMARY KEY AUTOINCREMENT, collection_id INTEGER NOT NULL, data_json TEXT NOT NULL, locale TEXT DEFAULT 'en-US', translation_group TEXT, created_by TEXT, metadata TEXT, created_at INTEGER, updated_at INTEGER)`);
      await db.run(sql`CREATE TABLE IF NOT EXISTS admins (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, hashed_password TEXT NOT NULL, created_at INTEGER)`);
      await db.run(sql`CREATE TABLE IF NOT EXISTS admin_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES admins(id), expires_at INTEGER NOT NULL)`);
      await db.run(sql`CREATE TABLE IF NOT EXISTS admins_to_roles (admin_id TEXT NOT NULL, role_id INTEGER NOT NULL, tenant_id INTEGER DEFAULT 0, PRIMARY KEY(admin_id, role_id, tenant_id))`);

      await db.run(sql`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, tenant_id INTEGER NOT NULL, email TEXT NOT NULL, password_hash TEXT NOT NULL, user_type TEXT NOT NULL, status TEXT DEFAULT 'active', created_at INTEGER, updated_at INTEGER, UNIQUE(tenant_id, email))`);
      await db.run(sql`CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, type TEXT DEFAULT 'registered', level INTEGER DEFAULT 1)`);
      await db.run(sql`CREATE TABLE IF NOT EXISTS admins (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL)`);
      await db.run(sql`CREATE TABLE IF NOT EXISTS languages (code TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT DEFAULT 'active', is_default INTEGER DEFAULT 0, created_at INTEGER)`);
      await db.run(sql`CREATE TABLE IF NOT EXISTS plugins (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, config TEXT, config_schema TEXT, is_enabled INTEGER DEFAULT 0, created_at INTEGER, updated_at INTEGER)`);
      await db.run(sql`CREATE TABLE IF NOT EXISTS media_items (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL, filename TEXT NOT NULL, mime_type TEXT NOT NULL, size INTEGER NOT NULL, is_remote INTEGER DEFAULT 0, created_by TEXT, metadata TEXT, created_at INTEGER)`);
      await db.run(sql`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, description TEXT, updated_at INTEGER)`);
      await db.run(sql`CREATE TABLE IF NOT EXISTS p_member_profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, member_id TEXT NOT NULL, name TEXT, avatar TEXT, phone TEXT, account_type TEXT DEFAULT 'individual', tier_id INTEGER DEFAULT 1, metadata TEXT, created_at INTEGER)`);
      await db.run(sql`CREATE TABLE IF NOT EXISTS p_member_tiers (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, name TEXT NOT NULL, discount_rate INTEGER DEFAULT 100, created_at INTEGER)`);
      await db.run(sql`CREATE TABLE IF NOT EXISTS p_member_tiers_i18n (id INTEGER PRIMARY KEY AUTOINCREMENT, tier_id INTEGER NOT NULL, lang_code TEXT NOT NULL, name TEXT NOT NULL, UNIQUE(tier_id, lang_code))`);

      // 核心业务：询盘
      await db.run(sql`CREATE TABLE IF NOT EXISTS inquiries (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, member_id TEXT, email TEXT NOT NULL, content TEXT NOT NULL, verify_token TEXT, status TEXT DEFAULT 'pending', source_url TEXT, metadata TEXT, created_at INTEGER, updated_at INTEGER)`);
      console.log('✨ [System] Schema Radar: 核心系统与会员插件表验证完成');

      // 增量字段补全 (自愈)
      const alters = [
        `ALTER TABLE inquiries ADD COLUMN source_url TEXT`,
        `ALTER TABLE roles ADD COLUMN scope TEXT DEFAULT 'tenant'`,
        `ALTER TABLE admins_to_roles ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 0`,
        `ALTER TABLE permissions ADD COLUMN perm_category TEXT`,
        `ALTER TABLE permissions ADD COLUMN plugin_slug TEXT`,
        `ALTER TABLE collections ADD COLUMN menu_group TEXT`,
        `ALTER TABLE collections ADD COLUMN menu_order INTEGER DEFAULT 0`,
        `ALTER TABLE collections ADD COLUMN field_config TEXT`
      ];
      for (const cmd of alters) {
        try { await db.run(sql.raw(cmd)); } catch (e) { }
      }
    } catch (e) {
      console.error('❌ [System] Schema Radar 关键错误:', e);
    }
  }

  registry.initCorePermissions();

  // 全量自动扫描业务集合并补全权限
  try {
    const allCollections = await db.select().from(collections).all();
    allCollections.forEach(item => {
      registry.registerDynamicPermissions(item, 'collection');
    });

    // --- 新增：扫描并同步已启用的插件权限 ---
    try {
      const { PluginService } = await import('./services/PluginService');
      const { PLUGIN_CODE_REGISTRY } = await import('./lib/plugin-registry');

      const enabledPlugins = await PluginService.getEnabledPlugins(db);
      for (const p of enabledPlugins) {
        const bundle = PLUGIN_CODE_REGISTRY[p.slug];
        if (bundle) {
          const manifest = await bundle.getManifest();
          if (manifest && manifest.permissions) {
            registry.registerPluginPermissions(p, manifest.permissions);
          }
        }
      }
    } catch (pluginError) {
      console.warn('⚠️ [System] 插件权限预热失败:', pluginError);
    }

    // 权威同步落地到数据库 (清理孤儿权限)
    await registry.syncToDb(db, true);
    isSynced = true;
    console.log('✅ [System] Permission Radar 同步完成。');
  } catch (e) {
    console.warn('⚠️ [System] 动态权限同步跳过 (数据库可能尚未就绪):', e);
    syncPromise = null;
  }
}

/**
 * 管理后台子应用 (Admin Sub-App)
 * 挂载所有 /api/* 相关的管理路由与鉴权逻辑
 */
function createAdminApp() {
  const admin = new Hono<{ Bindings: any }>().basePath('/api');

  // 1. 租户与域名调度 (必须保留，用于子应用内部 Context 获取)
  admin.use('*', domainDispatcher);

  // 2. 会话管理 (Session Hygiene)
  admin.use('/*', async (c, next) => {
    // 排除权限校验: 登录、公开入口、消费端 API
    if (c.req.path.includes('/auth/admin/login') ||
      c.req.path.includes('/auth/seed') ||
      c.req.path.includes('/v1/p/') ||
      c.req.path.includes('/v1/s/')
    ) return await next();

    try {
      const { adminAuth } = await getAuthInstances(c.env.DB);
      const sessionId = adminAuth.readSessionCookie(c.req.header('Cookie') ?? '');

      if (!sessionId) {
        c.set('user', null);
        c.set('session', null);
        return await next();
      }

      const { session, user } = await adminAuth.validateSession(sessionId);

      if (session && session.fresh) {
        c.header('Set-Cookie', adminAuth.createSessionCookie(session.id).serialize(), { append: true });
      }

      if (!session) {
        // 会话失效，强制清理浏览器 Cookie
        c.header('Set-Cookie', adminAuth.createBlankSessionCookie().serialize(), { append: true });
      }

      c.set('user', user);
      c.set('session', session as any);
      await next();
    } catch (e) { await next(); }
  });

  // 3. 开发工具：Seed 种子路由 (Restore)
  auth.get('/seed', async (c) => {
    if (c.env.NODE_ENV !== 'development' && c.env.NODE_ENV !== 'test') {
      return c.json({ error: 'Only allowed in development' }, 403);
    }
    try {
      await seedAdmin(c.env.DB, c.env.DEFAULT_ADMIN_PASSWORD);
      return c.json({ message: 'Seed Success' });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // 种子数据：填充初始测试用户 (仅开发环境)
  auth.get('/seed-users', async (c) => {
    if (process.env.NODE_ENV === 'production') {
      return c.json({ error: 'Only allowed in development' }, 403);
    }
    try {
      const dbModule = await import('./db');
      const db = await dbModule.createDbClient(c.env.DB);
      const schema = dbModule.schema;
      const { generateId } = await import('lucia');
      const { passwordHasher } = await import('./lib/auth');
      const passwordHash = await passwordHasher.hash('password123');
      const results = [];
      
      // 1. 种子管理员
      const adminId = generateId(15);
      await db.insert(schema.users).values({
        id: adminId,
        tenantId: 1,
        email: 'admin@system.com',
        passwordHash,
        userType: 'admin',
        status: 'active'
      }).onConflictDoNothing().run();

      await db.insert(schema.admins).values({
        id: adminId,
        username: '超级管理员'
      }).onConflictDoNothing().run();
      
      results.push({ email: 'admin@system.com', type: 'admin' });

      // 2. 种子普通用户 (Member 身份)
      for (let i = 1; i <= 5; i++) {
        const email = `user${i}@example.com`;
        const userId = generateId(15);
        try {
          await db.insert(schema.users).values({
            id: userId,
            tenantId: 1,
            email,
            passwordHash,
            userType: 'member',
            status: 'active'
          }).onConflictDoNothing().run();

          await db.insert(schema.members).values({
            id: userId,
            type: 'registered',
            level: i
          }).onConflictDoNothing().run();

          results.push({ email, type: 'member', id: userId });
        } catch (e: any) {
          results.push({ email, status: 'failed', reason: e.message });
        }
      }
      return c.json({ message: 'Seed Users Complete', results });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // 4. 业务路由组 (v1)
  const v1 = new Hono<{ Bindings: any }>();
  v1.use('/rbac/*', requirePermission('role.manage'));
  v1.use('/settings/*', requirePermission(['settings.general', 'settings.mail', 'settings.ai', 'role.manage']));
  v1.use('/infra/*', requirePermission('role.manage'));

  v1.route('/rbac', rbac);
  v1.route('/entities', entities);
  v1.route('/media', media);
  v1.route('/settings', settings);
  v1.route('/infra', infra);
  v1.route('/plugins', plugins);
  v1.route('/users', users);
  v1.all('/s/*', async (c) => {
    // 延迟加载商城网关枢纽 (已重构为全动态 Hub)
    const sf = (await import('./routes/front-api')).default;
    return sf.fetch(c.req.raw, c.env);
  });
  v1.route('/ai', ai);
  v1.route('/', apiV1);

  // 5. 挂载子路由
  admin.route('/auth', auth);
  admin.route('/v1', v1);
  admin.route('/webhooks', webhooks);

  // 6. AI 公开网关 (Restore Middleware)
  admin.use('/v1/p/ai/*', publicAiGateway);
  admin.route('/v1/p/ai', ai);
  admin.route('/v1/p', publicApi);

  return admin;
}

/**
 * 根调度器 (Master Dispatcher)
 */
export function createApplication(registry: PermissionRegistry = globalRegistry) {
  const master = new Hono<{ Bindings: any }>();
  const adminApp = createAdminApp();

  // 1. 全局域名调度
  master.use('*', domainDispatcher);

  // 2. 全局系统初始化拦截器 (利用 global Promise 确保单次运行)
  master.use('*', async (c, next) => {
    try {
      const config = validateConfig(c.env);
      c.set('config' as any, config);

      if (!isSynced && !syncPromise) {
        syncPromise = performSystemSync(c, registry).finally(() => {
          syncPromise = null;
        });
      }

      await next();
    } catch (err: any) {
      console.error('❌ [System Init] Critical Error:', err);
      return c.json({ error: 'System Initialization Failed', details: err.message }, 500);
    }
  });

  // 3. 主分发路径
  master.all('*', async (c) => {
    const target = c.get('dispatch_target' as any);
    const path = c.req.path;

    if (target === 'img') {
      const key = path.split('/').pop() || '';
      return await ImageProxy.serve(c, key);
    }

    if (target === 'api') {
      // 挂载公开 API (内部会再次运行 domainDispatcher 以补全 context)
      return await publicApi.fetch(c.req.raw, c.env);
    }

    // 默认分发给 Admin 子应用
    return await adminApp.fetch(c.req.raw, c.env);
  });

  return master;
}

export const app = createApplication();
