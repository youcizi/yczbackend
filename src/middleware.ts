import { defineMiddleware } from "astro:middleware";
import { getAuthInstances } from "./lib/auth";

/**
 * 鉴权中间件
 * 拦截 /admin/* 路径，强制管理员登录
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { url, locals, request, cookies, redirect } = context;

  // 1. 聚合多源环境对象 (Astro import.meta.env + Cloudflare Runtime + Node process)
  const localEnv = JSON.parse(JSON.stringify(locals || {}));
  const runtime = localEnv['runtime'] || {};
  const globalEnv = (globalThis as any)['process']?.['env'] || {};
  const metaEnv = (import.meta as any)['env'] || {};
  
  const env = {
    ...globalEnv,
    ...metaEnv,
    ...(runtime['env'] || {})
  };
  
  // 初始化鉴权实例 (如果 env.DB 缺失，createDbClient 会自动回退到本地 SQLite)
  // 改为 await 异步调用以支持动态加载原生驱动
  const { adminAuth } = await getAuthInstances(env.DB);

  // 2. 检查会话 (Session)
  const sessionId = cookies.get(adminAuth.sessionCookieName)?.value ?? null;
  
  if (!sessionId) {
    locals.user = null;
    locals.session = null;
  } else {
    const { session, user } = await adminAuth.validateSession(sessionId);
    
    if (session && session.fresh) {
      const sessionCookie = adminAuth.createSessionCookie(session.id);
      cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    }
    
    if (!session) {
      const sessionCookie = adminAuth.createBlankSessionCookie();
      cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    }
    
    locals.user = user;
    locals.session = session;
  }

  // 3. 路由拦截逻辑
  // 排除登录页面，防止循环重定向
  const isLoginPage = url.pathname === "/login";
  const isAdminPath = url.pathname.startsWith("/admin");

  if (isAdminPath && !locals.user && !isLoginPage) {
    console.log(`🔒 [Auth Middleware] 拦截未授权访问: ${url.pathname}，重定向至 /login`);
    return redirect("/login");
  }

  return next();
});
