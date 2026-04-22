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

// 权限自动同步记录标识 (利用 Worker 内存缓存一次同步，防止重复 IO)
let isSynced = false;

/**
 * 管理后台子应用 (Admin Sub-App)
 * 挂载所有 /api/* 相关的管理路由与鉴权逻辑
 */
function createAdminApp(registry: PermissionRegistry) {
  const admin = new Hono<{ Bindings: any }>().basePath('/api');

  // 0. 租户与域名调度 (Tenant & Domain Context)
  admin.use('*', domainDispatcher);

  // 1. 系统初始化与权限雷达 (Permission Radar)
  admin.use('*', async (c, next) => {
    try {
      const config = validateConfig(c.env);
      c.set('config' as any, config);
      
      // 仅在非同步状态或开发模式下执行同步
      if (!isSynced || c.env.NODE_ENV === 'development') {
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

          // [Schema Migration Radar] 自动补全数据库缺失列 (仅在开发模式通过 ALTER TABLE 自愈)
          if (c.env.NODE_ENV === 'development') {
            try {
              // 1. 补全 roles.scope
              await db.run(sql`ALTER TABLE roles ADD COLUMN scope TEXT DEFAULT 'tenant'`);
              console.log('✨ [System] Schema Radar: 补全 [roles.scope] 成功');
            } catch (e) {}

            try {
              // 2. 补全 admins_to_roles.tenant_id
              await db.run(sql`ALTER TABLE admins_to_roles ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 0`);
              console.log('✨ [System] Schema Radar: 补全 [admins_to_roles.tenant_id] 成功');
            } catch (e) {}
          }

          // 权威同步落地到数据库 (清理孤儿权限)
          await registry.syncToDb(db, true);
          isSynced = true;
          console.log('✅ [System] Permission Radar 同步完成。');
        } catch (e) {
          console.warn('⚠️ [System] 动态权限同步跳过 (数据库可能尚未就绪):', e);
        }
      }
      await next();
    } catch (err: any) {
      console.error('❌ [AdminApp] Start Error:', err);
      return c.json({ error: 'System Initialization Failed', details: err.message }, 500);
    }
  });

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
  const adminApp = createAdminApp(registry);

  // 挂载 Host 调度
  master.use('*', domainDispatcher);

  // 主分发逻辑
  master.all('*', async (c) => {
    const target = c.get('dispatch_target' as any);
    const path = c.req.path;

    if (target === 'img') {
      const key = path.split('/').pop() || '';
      return await ImageProxy.serve(c, key);
    }

    if (target === 'api') {
      return await publicApi.fetch(c.req.raw, c.env);
    }

    // 默认分发给 Admin 子应用
    return await adminApp.fetch(c.req.raw, c.env);
  });

  return master;
}

export const app = createApplication();
