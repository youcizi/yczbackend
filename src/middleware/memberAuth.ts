import { createMiddleware } from 'hono/factory';
import { getAuthInstances } from '../lib/auth';

/**
 * memberAuth: 具备租户校验能力的会员认证中间件
 */
export const memberAuth = createMiddleware(async (c, next) => {
  // 1. 获取当前访问域名的租户目标
  const domains = c.get('domains' as any) || c.get('site_domains' as any);
  if (!domains) {
    return c.json({ error: '域名环境未就绪' }, 500);
  }

  // 假设我们的 domains 对象中有 site_id 或 tenant_id
  const currentTenantId = domains.tenant_id || domains.id || (domains.site_domains ? domains.site_domains.id : 0);
  
  // 2. 校验会话
  try {
    const { userAuth } = await getAuthInstances(c.env.DB);
    const sessionId = userAuth.readSessionCookie(c.req.header('Cookie') ?? '');
    
    if (!sessionId) {
      return c.json({ error: '请先登录' }, 401);
    }
    
    const { session, user } = await userAuth.validateSession(sessionId);
    
    if (!session) {
      return c.json({ error: '会话已失效' }, 401);
    }

    // 3. 核心安全校验: 跨店登录劫持防御
    // 验证 Token 中的 tenantId 是否与当前域名的 tenantId 匹配
    // (注意: 会员的 tenantId 应该存储在 user 属性或 session 中)
    const memberTenantId = (user as any).tenantId; 

    if (memberTenantId !== undefined && memberTenantId !== Number(currentTenantId)) {
        console.warn(`🚨 [Security] 跨店登录企图: 会员(Tenant:${memberTenantId}) 尝试访问 店铺(Tenant:${currentTenantId})`);
        return c.json({ 
          error: '身份非法', 
          message: '您的账号不属于当前店铺，请重新登录' 
        }, 403);
    }

    // 将会员信息和租户信息注入上下文
    c.set('member', user);
    c.set('session', session);
    c.set('activeTenantId', currentTenantId);

    await next();
  } catch (err: any) {
    console.error('❌ [MemberAuth] Error:', err);
    return c.json({ error: '身份校验系统异常' }, 500);
  }
});
