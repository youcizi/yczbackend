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

// 权限自动同步进度锁 (利用 Worker 内存或 Promise 状态，防止并发冲突)
let syncPromise: Promise<void> | null = null;
let isSynced = false;

/**
 * 核心初始化逻辑 (含权限同步、数据库 Radar 补全)
 * 封装为独立函数以支持并发控制
 */
async function performSystemSync(c: any, registry: PermissionRegistry) {
  const db = await createDbClient(c.env.DB);
  registry.initCorePermissions();

  // 全量自动扫描业务集合并补全权限
  try {
    const tableCheck = await db.run(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='collections'`);
    const tableExists = tableCheck.results && tableCheck.results.length > 0;

    if (tableExists) {
      const allCollections = await db.select().from(collections).all();
      allCollections.forEach(item => {
        registry.registerDynamicPermissions(item, 'collection');
      });
    }

    // [Schema Migration Radar] 自动补全数据库缺失表与列 (仅在开发模式通过 SQL 自愈)
    if (c.env.NODE_ENV === 'development') {
      try {
        // 核心 RBAC 架构
        await db.run(sql`CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, scope TEXT DEFAULT 'tenant', description TEXT, created_at INTEGER)`);
        await db.run(sql`CREATE TABLE IF NOT EXISTS permissions (slug TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, perm_category TEXT)`);
        await db.run(sql`CREATE TABLE IF NOT EXISTS role_permissions (role_id INTEGER NOT NULL, permission_slug TEXT NOT NULL, PRIMARY KEY(role_id, permission_slug))`);
        
        // 核心模型架构
        await db.run(sql`CREATE TABLE IF NOT EXISTS models (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, fields_json TEXT NOT NULL, description TEXT, metadata TEXT, created_at INTEGER)`);
        await db.run(sql`CREATE TABLE IF NOT EXISTS collections (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, model_id INTEGER NOT NULL, description TEXT, icon TEXT DEFAULT 'Layers', sort INTEGER DEFAULT 0, menu_group TEXT, menu_order INTEGER DEFAULT 0, parent_id INTEGER, relation_settings TEXT, field_config TEXT, permission_config TEXT, metadata TEXT, created_at INTEGER)`);
        await db.run(sql`CREATE TABLE IF NOT EXISTS sites (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, domain TEXT UNIQUE NOT NULL, status TEXT DEFAULT 'active', theme_data TEXT, site_config TEXT, metadata TEXT, created_at INTEGER)`);

        // 核心业务：询盘
        await db.run(sql`CREATE TABLE IF NOT EXISTS inquiries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          site_id INTEGER,
          form_name TEXT,
          visitor_id TEXT,
          email TEXT,
          phone TEXT,
          content TEXT,
          metadata TEXT,
          source_url TEXT,
          referrer TEXT,
          created_at INTEGER
        )`);
        console.log('✨ [System] Schema Radar: 核心系统表验证完成');
      } catch (e) {}

      try {
        await db.run(sql`ALTER TABLE inquiries ADD COLUMN source_url TEXT`);
        await db.run(sql`ALTER TABLE roles ADD COLUMN scope TEXT DEFAULT 'tenant'`);
        await db.run(sql`ALTER TABLE admins_to_roles ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 0`);
        await db.run(sql`ALTER TABLE permissions ADD COLUMN perm_category TEXT`);
        console.log('✨ [System] Schema Radar: 字段补全执行成功');
      } catch (e) {}
    }

    // 权威同步落地到数据库 (清理孤儿权限)
    await registry.syncToDb(db, true);
    isSynced = true;
    console.log('✅ [System] Permission Radar 同步完成。');
  } catch (e) {
    console.warn('⚠️ [System] 动态权限同步跳过 (数据库可能尚未就绪):', e);
    // 如果失败，允许下次请求重试
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
    // 排除特定路由
    if (c.req.path.includes('/auth/admin/login') || c.req.path.includes('/auth/seed')) return await next();
    
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
