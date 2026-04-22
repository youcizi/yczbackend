import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { createDbClient } from '../../../db';
import { PluginService } from '../../../services/PluginService';
import { requirePermission } from '../../../middleware/rbac';
import { adminsToRoles, roles } from '../../../db/schema';

const plugins = new Hono<{ Bindings: any }>();

/**
 * 获取全量插件列表 (管理页面使用)
 */
plugins.get('/', requirePermission('plugins.manage'), async (c) => {
  const db = await createDbClient(c.env.DB);
  const allPlugins = await PluginService.getAllPlugins(db);
  return c.json({ success: true, data: allPlugins });
});

/**
 * 更新插件状态
 */
plugins.patch('/:id', requirePermission('plugins.manage'), async (c) => {
  const id = Number(c.req.param('id'));
  const { isEnabled } = await c.req.json();
  const db = await createDbClient(c.env.DB);

  try {
    await PluginService.updatePluginStatus(db, id, isEnabled);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * 更新插件配置
 * 权限要求: 必须具备 SuperAdmin 角色
 */
plugins.patch('/:id/config', requirePermission('plugins.manage'), async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const db = await createDbClient(c.env.DB);
  const user = c.get('user') as any;

  try {
    // 1. 严格角色校验: 仅限 SuperAdmin
    const rolesList = await db.select({ name: roles.name })
      .from(adminsToRoles)
      .innerJoin(roles, eq(adminsToRoles.roleId, roles.id))
      .where(eq(adminsToRoles.adminId, user.id))
      .all();

    const isSuperAdmin = rolesList.some((r: any) => r.name === 'SuperAdmin');

    if (!isSuperAdmin) {
      console.warn(`🔒 [Plugins] Unauthorized config change attempt by ${user.username}`);
      return c.json({ success: false, error: '权限不足: 仅限超级管理员修改配置' }, 403);
    }

    const { config } = body;
    if (config === undefined) {
      return c.json({ success: false, error: '缺少 config 字段' }, 400);
    }

    // 调用 Service 进行更新 (Service 中含 JSON 解析与对象类型校验)
    await PluginService.updatePluginConfig(db, id, config);
    
    return c.json({ success: true });
  } catch (err: any) {
    // 针对 JSON 解析错误的特殊处理 (返回 400)
    if (err.message.includes('JSON') || err.message.includes('对象')) {
      return c.json({ success: false, error: err.message }, 400);
    }
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * 获取已启用的插件菜单 (供前端动态渲染)
 * 权限: 仅限拥有 plugins.manage 的管理员
 */
plugins.get('/menu', requirePermission('plugins.manage'), async (c) => {
  const db = await createDbClient(c.env.DB);
  const enabledPlugins = await PluginService.getEnabledPlugins(db);

  // 转换为前端菜单格式
  const menu = enabledPlugins.map(p => ({
    title: p.name,
    path: `/admin/plugins/${p.slug}`,
    icon: 'Plug', // 默认图标，后续可从 config 中扩展
    slug: p.slug
  }));

  return c.json({ success: true, data: menu });
});

/**
 * 检查特定插件状态
 * 权限: 仅限拥有 plugins.manage 的管理员
 */
plugins.get('/check/:slug', requirePermission('plugins.manage'), async (c) => {
  const slug = c.req.param('slug');
  const db = await createDbClient(c.env.DB);

  try {
    const plugin = await PluginService.checkPluginStatus(db, slug);

    if (!plugin) {
      return c.json({ success: false, error: '插件未找到' }, 404);
    }

    if (!plugin.isEnabled) {
      return c.json({ success: false, error: '插件已禁用' }, 404);
    }

    return c.json({ success: true, data: plugin });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * 插件 RPC 转发代理 (万能代理)
 * 路由: ALL /api/v1/plugins/proxy/:slug/*
 * 逻辑: 将请求透传给 BINDING_:slug 对应的 Service Binding
 */
plugins.all('/proxy/:slug/*', requirePermission('plugins.manage'), async (c) => {
  const slug = c.req.param('slug');
  const db = await createDbClient(c.env.DB);

  // 1. 校验插件是否启用
  const plugin = await PluginService.checkPluginStatus(db, slug);
  if (!plugin || !plugin.isEnabled) {
    return c.json({ success: false, error: '插件未启用或不存在' }, 404);
  }

  // 2. 获取对应的 Service Binding
  const bindingName = `BINDING_${slug}`;
  const binding = (c.env as any)[bindingName];

  if (!binding || typeof binding.fetch !== 'function') {
    console.error(`❌ [Plugin Proxy] Binding missing: ${bindingName}`);
    return c.json({ 
      success: false, 
      error: '插件执行引擎未配置 (Bad Gateway)',
      details: `请在 wrangler.toml 中增加 [[services]] 绑定: ${bindingName}`
    }, 502);
  }

  // 3. 构建待转发的请求
  // 提取剩余路径: /api/v1/plugins/proxy/slug/some/path -> /some/path
  const url = new URL(c.req.url);
  const pathParts = url.pathname.split('/');
  const proxyStartIndex = pathParts.indexOf('proxy');
  const remainingPath = '/' + pathParts.slice(proxyStartIndex + 2).join('/');
  
  // 克隆原始请求并定向到内部 Mock 域名 (Service Binding 会忽略域名，主要为了满足 Request 构造函数)
  const proxyUrl = `http://plugin-internal${remainingPath}${url.search}`;
  
  try {
    const proxyRequest = new Request(proxyUrl, c.req.raw);
    
    // 4. 执行转发
    console.log(`📡 [Plugin Proxy] Forwarding ${c.req.method} ${remainingPath} to ${bindingName}`);
    const response = await binding.fetch(proxyRequest);

    // 5. 返回透传结果 (保留原始响应的状态码和 Header)
    return new Response(response.body, response);
  } catch (err: any) {
    console.error(`❌ [Plugin Proxy] Forwarding error:`, err);
    return c.json({ success: false, error: '插件通信异常', details: err.message }, 504);
  }
});

export default plugins;
