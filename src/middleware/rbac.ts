import { createMiddleware } from 'hono/factory';
import { createDbClient } from '../db';
import { RbacService } from '../services/RbacService';

/**
 * requirePermission- 具备租户感知的增强型 Hono 中间件
 * @param action 需要校验的权限标识 (Slug) 或 权限标识数组 (OR 逻辑)
 */
export const requirePermission = (action: string | string[]) => {
  return createMiddleware(async (c, next) => {
    const user = c.get('user') as any;

    if (!user) {
      // 允许本地测试绕过 (如果环境变量设置)
      const isTest = c.env.NODE_ENV === 'test' || !!process.env.VITEST;
      if (isTest && c.req.header('X-Test-Bypass') === 'true') {
        return await next();
      }
      return c.json({ error: '未授权访问: 请先登录' }, 401);
    }

    // 1. 提取 tenant_id
    // 优先级: 请求参数 > domains 上下文 > 默认 0 (系统级)
    let tenantId = 0;
    
    // 尝试从 domains 上下文获取 (由 domainDispatcher 设置)
    const domains = c.get('domains' as any) || c.get('site_domains' as any);
    if (domains && domains.tenant_id) {
      tenantId = Number(domains.tenant_id);
    } 
    
    // 如果 URL 中有明确的 tenantId 参数，优先级最高
    const paramId = c.req.param('tenantId');
    if (paramId) {
      tenantId = Number(paramId);
    }

    // 2. 执行校验
    const db = await createDbClient(c.env.DB);
    
    // 如果传入的是数组，只要满足其中一个即可 (OR 逻辑)
    const actions = Array.isArray(action) ? action : [action];
    
    let hasAccess = false;
    for (const a of actions) {
      if (await RbacService.checkPermission(db, user.id, a, tenantId)) {
        hasAccess = true;
        break;
      }
    }

    if (hasAccess) {
      // 在上下文中存储当前租户 ID 供后续路线使用
      c.set('activeTenantId' as any, tenantId);
      await next();
    } else {
      console.warn(`🔒 [RBAC] 越权拦截: 用户 ${user.username} 尝试访问 [${action}]，租户ID: [${tenantId}]`);
      return c.json({ 
        error: '权限不足', 
        required: action,
        tenantId: tenantId
      }, 403);
    }
  });
};
