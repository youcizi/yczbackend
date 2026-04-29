import { verify } from 'hono/jwt';
import { createMiddleware } from 'hono/factory';

/**
 * 核心身份验证中间件 (解析 JWT)
 */
export const identityAuth = (secret: string) => createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  let token = '';

  // 1. 尝试从 Header 获取
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } 
  // 2. 尝试从 Cookie 获取
  else {
    const cookieHeader = c.req.header('Cookie') || '';
    const match = cookieHeader.match(/token=([^;]+)/);
    token = match ? match[1] : '';
  }

  if (!token) {
    return c.json({ error: 'UNAUTHORIZED', message: '未提供认证 Token' }, 401);
  }

  try {
    const payload = await verify(token, secret);
    // 将用户信息注入 Context
    c.set('user', payload);
    await next();
  } catch (err) {
    return c.json({ error: 'INVALID_TOKEN', message: 'Token 已失效或非法' }, 401);
  }
});

/**
 * 管理员权限校验
 */
export const isAdmin = createMiddleware(async (c, next) => {
  const user = c.get('user' as any);
  if (!user || user.userType !== 'admin') {
    return c.json({ error: 'FORBIDDEN', message: '权限不足：需要管理员身份' }, 403);
  }
  await next();
});

/**
 * 普通会员权限校验
 */
export const isMember = createMiddleware(async (c, next) => {
  const user = c.get('user' as any);
  if (!user || user.userType !== 'member') {
    return c.json({ error: 'FORBIDDEN', message: '权限不足：需要会员身份' }, 403);
  }
  await next();
});
