import { defineMiddleware } from "astro:middleware";
import { getAuthInstances } from "./lib/auth";

/**
 * 鉴权中间件
 * 拦截 /admin/* 路径，强制管理员登录
 */
export const onRequest = defineMiddleware(async (context, next) => {
    const { cookies, redirect, locals, url, request } = context;
    let DB: any;

    try {
        // Astro 6 推荐：通过虚拟模块获取环境绑定
        // @ts-ignore
        const cf = await import('cloudflare:workers');
        DB = cf.env?.DB || cf.DB;
    } catch (e) {
        // 兜底方案：从 locals 提取
        DB = (locals as any).DB || (locals as any).runtime?.DB;
    }

    if (!DB) {
        console.warn('⚠️ [Middleware] 仍未发现 D1 绑定，请检查 wrangler.toml。');
    } else {
        console.log('✅ [Middleware] D1 绑定提取成功');
        // [Crucial Fix] 将提取到的 D1 绑定注入 locals，供后续页面使用
        (locals as any).DB = DB;
        if (!(locals as any).runtime) (locals as any).runtime = {};
        (locals as any).runtime.DB = DB;
    }

  try {
    // Astro v6 推荐通过 cloudflare:workers 获取 bindings
    // @ts-ignore
    const cf = await import('cloudflare:workers');
    DB = cf.env.DB;
  } catch (e) {
    // 回退方案：从 locals 尝试提取 (兼容 platformProxy)
    DB = (locals as any).runtime?.DB || (locals as any).DB;
  }
  
  const env = {
    ...((globalThis as any).process?.env || {}),
    ...((import.meta as any).env || {}),
    DB: DB
  };
  
  // 初始化鉴权实例 (显式传入 D1 绑定)
  const { adminAuth } = await getAuthInstances(DB);

  // 2. 检查会话 (Session)
  const sessionId = cookies.get(adminAuth.sessionCookieName)?.value ?? null;
  
  if (!sessionId) {
    locals.user = null;
    locals.session = null;
  } else {
    try {
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
    } catch (e) {
      // 如果表不存在（常见于本地 D1 初次使用），优雅降级
      console.warn('⚠️ [Auth Middleware] 数据库会话查询失败，可能表尚未创建:', (e as any).message);
      locals.user = null;
      locals.session = null;
    }
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
