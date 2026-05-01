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
      console.warn(`🔒 [RBAC] 拦截未登录访问: Path: ${c.req.path}`);
      return c.json({ error: '未授权访问: 请先登录' }, 401);
    }

    // 1. 提取 tenant_id
    let tenantId = 0;
    const domains = c.get('domains' as any) || c.get('site_domains' as any);
    if (domains && domains.tenant_id) {
      tenantId = Number(domains.tenant_id);
    } 
    const paramId = c.req.param('tenantId');
    if (paramId) {
      tenantId = Number(paramId);
    }

    // 2. 执行校验
    const db = await createDbClient(c.env.DB);
    const actions = Array.isArray(action) ? action : [action];
    
    let hasAccess = false;
    for (const a of actions) {
      if (await RbacService.checkPermission(db, user.id, a, tenantId)) {
        hasAccess = true;
        break;
      }
    }

    if (hasAccess) {
      c.set('activeTenantId' as any, tenantId);
      await next();
    } else {
      console.warn(`🔒 [RBAC] 越权拦截: 用户 ${user.username || user.id} 尝试访问 [${action}]，租户ID: [${tenantId}]`);
      return c.json({ 
        error: '权限不足', 
        required: action,
        tenantId: tenantId
      }, 403);
    }
  });
};
