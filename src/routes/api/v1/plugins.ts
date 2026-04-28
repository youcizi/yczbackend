import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { createDbClient } from '../../../db';
import { PluginService } from '../../../services/PluginService';
import { requirePermission } from '../../../middleware/rbac';
import { adminsToRoles, roles } from '../../../db/schema';
import { PLUGIN_CODE_REGISTRY } from '../../../lib/plugin-registry';

// 自动根据注册表构建本地分发映射 (单 Worker 模式)
const LOCAL_DISPATCH_REGISTRY: Record<string, any> = {};
Object.entries(PLUGIN_CODE_REGISTRY).forEach(([slug, bundle]) => {
  if (bundle.backend) LOCAL_DISPATCH_REGISTRY[slug] = bundle.backend;
});

const plugins = new Hono<{ Bindings: any }>();
const admin = new Hono<{ Bindings: any }>();

// 所有 admin 接口均需要 plugins.manage 权限
admin.use('*', requirePermission('plugins.manage'));

/**
 * [ADMIN] GET /admin/available
 * 查看所有已登记插件及其安装状态
 */
admin.get('/available', async (c) => {
  const db = await createDbClient(c.env.DB);
  const installed = await PluginService.getAllPlugins(db);
  
  // 结合代码注册表，补充元数据 (版本、作者等)
  const result = installed.map(p => {
    const bundle = PLUGIN_CODE_REGISTRY[p.slug];
    return {
      slug: p.slug,
      name: p.name,
      description: p.description,
      version: bundle?.manifest.version || 'v1.0.0',
      author: bundle?.manifest.author || 'Unknown',
      isInstalled: true,
      isEnabled: p.isEnabled === 1,
      dbId: p.id,
      isCodePresent: !!bundle
    };
  });

  return c.json({ success: true, data: result });
});

/**
 * [ADMIN] POST /admin/register
 * 手动登记新插件 (管理员在浏览器输入 slug 名)
 */
admin.post('/register', async (c) => {
  const data = await c.req.json();
  const db = await createDbClient(c.env.DB);
  
  try {
    await PluginService.registerPluginManually(db, data);
    return c.json({ success: true, message: `插件 ${data.slug} 登记成功` });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

/**
 * [PUBLIC] GET /menu
 * 获取已启用的插件菜单 (供前端侧边栏渲染)
 * 注意：此路由需在 admin 之前注册，且不需要 plugins.manage 权限，
 * 因为它负责渲染外部菜单入口，权限控制由侧边栏内部 handles。
 */
plugins.get('/menu', async (c) => {
  const db = await createDbClient(c.env.DB);
  const data = await PluginService.getAdminMenus(db);
  return c.json({ success: true, data });
});

/**
 * [ADMIN] POST /admin/install
 * 安装插件 (注册元数据至 DB)
 */
admin.post('/install', async (c) => {
  const { slug } = await c.req.json();
  const bundle = PLUGIN_CODE_REGISTRY[slug];
  if (!bundle) return c.json({ error: '未找到插件代码映射，请检查 src/lib/plugin-registry.ts' }, 404);

  const db = await createDbClient(c.env.DB);
  await PluginService.installPlugin(db, slug, {
    name: bundle.manifest.name,
    description: bundle.manifest.description,
    author: bundle.manifest.author
  });
  return c.json({ success: true, message: `${bundle.manifest.name} 安装成功` });
});

/**
 * [ADMIN] POST /admin/toggle
 * 启用/禁用插件
 */
admin.post('/toggle', async (c) => {
  const { slug, enabled } = await c.req.json();
  const db = await createDbClient(c.env.DB);
  await PluginService.togglePlugin(db, slug, enabled);
  return c.json({ success: true, enabled });
});

/**
 * [ADMIN] DELETE /admin/uninstall
 * 卸载插件 (仅移除元数据)
 */
admin.delete('/uninstall', async (c) => {
  const { slug } = await c.req.json();
  const db = await createDbClient(c.env.DB);
  await PluginService.uninstallPlugin(db, slug);
  return c.json({ success: true, message: '插件已卸载' });
});

// 挂载 Admin 子路由
plugins.route('/admin', admin);

/**
 * [ADMIN] PATCH /admin/config
 * 更新插件配置 (仅限 SuperAdmin)
 */
admin.patch('/config', async (c) => {
  const { slug, config } = await c.req.json();
  if (!slug) return c.json({ error: '缺少插件标识' }, 400);

  const db = await createDbClient(c.env.DB);
  const user = c.get('user') as any;

  // 如果处于 Bypass 模式 (测试环境)，且没有 user，跳过严格角色校验
  const isTestBypass = c.req.header('X-Test-Bypass') === 'true';
  
  if (user) {
    // 严格角色校验: 仅限 SuperAdmin
    const rolesList = await db.select({ name: roles.name })
      .from(adminsToRoles)
      .innerJoin(roles, eq(adminsToRoles.roleId, roles.id))
      .where(eq(adminsToRoles.adminId, user.id))
      .all();

    if (!rolesList.some((r: any) => r.name === 'SuperAdmin')) {
      return c.json({ success: false, error: '权限不足: 需要超级管理员权限' }, 403);
    }
  } else if (!isTestBypass) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    // 这里我们将原本基于 ID 的 update 封装为基于 Slug 的 Service 方法
    await PluginService.updatePluginConfigBySlug(db, slug, config);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

/**
 * [PUBLIC] 插件路由万能代理 (RPC Proxy)
 * ALL /proxy/:slug/* -> 转发给插件 Hono 应用
 */
plugins.all('/proxy/:slug/*', async (c) => {
  const slug = c.req.param('slug');
  const db = await createDbClient(c.env.DB);

  // 1. 拦截未启用或未安装的插件
  const plugin = await PluginService.checkPluginStatus(db, slug);
  if (!plugin || !plugin.isEnabled) {
    return c.json({ success: false, error: '插件不可用' }, 404);
  }

  // 计算相对路径
  const url = new URL(c.req.url);
  const pathParts = url.pathname.split('/');
  const proxyStartIndex = pathParts.indexOf('proxy');
  const remainingPath = '/' + pathParts.slice(proxyStartIndex + 2).join('/');

  // 2. 尝试本地降级分发 (单 Worker 逻辑)
  const localApp = LOCAL_DISPATCH_REGISTRY[slug];
  if (localApp) {
    console.log(`🏠 [Local Dispatch] RPC -> ${slug}: ${c.req.method} ${remainingPath}`);
    
    let body: any = null;
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      body = await c.req.raw.clone().arrayBuffer();
    }

    return localApp.request(remainingPath, {
      method: c.req.method,
      headers: c.req.header(),
      body: body
    }, c.env);
  }

  // 3. 尝试 Service Binding 转发 (多 Worker 逻辑)
  const bindingName = `BINDING_${slug}`;
  const binding = (c.env as any)[bindingName];

  if (binding && typeof binding.fetch === 'function') {
    console.log(`📡 [Binding] RPC -> ${bindingName}: ${c.req.method} ${remainingPath}`);
    const proxyUrl = `http://plugin-internal${remainingPath}${url.search}`;
    const response = await binding.fetch(new Request(proxyUrl, c.req.raw.clone()));
    return new Response(response.body, response);
  }

  return c.json({ success: false, error: '未找到插件执行链路' }, 502);
});

export default plugins;
