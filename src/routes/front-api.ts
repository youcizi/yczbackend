import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { getAuthInstances } from '../lib/auth';
import { PLUGIN_CODE_REGISTRY } from '../lib/plugin-registry';
import { PluginService } from '../services/PluginService';
import { createDbClient } from '../db';

/**
 * 消费者前端 API 网关 (Storefront API)
 * 路径: /api/v1/s
 */
const sf = new Hono<{ Bindings: any }>();

// 1. [核心保护] 插件可用性预检中间件 (必须在鉴权之前)
// 逻辑：识别路径中的插件 slug，校验数据库 isEnabled 状态
sf.use('/:slug/*', async (c, next) => {
  const slug = c.req.param('slug');
  // 如果不是插件路由(如原生 checkout)，跳过
  if (!PLUGIN_CODE_REGISTRY[slug]) return await next();

  const db = await createDbClient(c.env.DB);
  const plugin = await PluginService.checkPluginStatus(db, slug);
  if (!plugin || !plugin.isEnabled) {
    console.warn(`🚫 [Storefront Gateway] Blocked access to inactive plugin: ${slug}`);
    return c.json({ error: 'Plugin Inactive', message: `该扩展功能 (${slug}) 当前未开启` }, 404);
  }
  await next();
});

// 2. 会员会话鉴权中间件
sf.use('*', async (c, next) => {
  try {
    const { userAuth } = await getAuthInstances(c.env.DB);
    const sessionId = getCookie(c, 'user_session');
    
    if (!sessionId) {
      return c.json({ error: 'Unauthorized', message: '请先登录会员账号' }, 419);
    }
    
    const { session, user } = await userAuth.validateSession(sessionId);
    if (!session) {
      return c.json({ error: 'Session Expired', message: '登录已失效，请重新进入' }, 419);
    }

    c.set('current_member', user);
    c.set('member_session', session);
    
    await next();
  } catch (e: any) {
    return c.json({ error: 'Auth Error', details: e.message }, 500);
  }
});

// 3. 动态分发网关 (路由动态路由)
// 使用 .all 配合通配符，避免 .route 静态挂载带来的非子应用实例报错
Object.keys(PLUGIN_CODE_REGISTRY).forEach((slug) => {
  sf.all(`/${slug}/*`, async (c) => {
    const getApp = PLUGIN_CODE_REGISTRY[slug].getStorefrontApp;
    const app = await getApp();
    
    if (!app) {
      console.warn(`[Gateway] Plugin sub-app not found: ${slug}`);
      return c.json({ error: 'Plugin Module Not Found' }, 404);
    }

    // 手动执行子应用的 fetch 逻辑，透传请求与环境上下文
    return app.fetch(c.req.raw, c.env);
  });
});

// 系统不再在此处硬编码任何业务逻辑，全量下放至插件 Hook 处理
export default sf;
