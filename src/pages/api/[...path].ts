import type { APIRoute } from 'astro';
import { app } from '../../app';

/**
 * Astro 路由处理器
 * 将所有 /api/* 请求转发给 Hono
 * 
 * NOTE: 这里的逻辑已经完全解耦到 src/app.ts，
 * 保持此文件作为 APIRoute 的轻量级桥接，以支持测试与 HMR。
 */
export const ALL: APIRoute = async ({ request, locals }) => {
  // 统一环境获取逻辑：合并 Astro 环境变量、Cloudflare Runtime 与本地 process.env
  // 统一环境获取逻辑 (适配 Astro v6 + Cloudflare 标准)
  let cfEnv: any = {};
  try {
    // 优先使用 Astro v6 推荐的虚拟模块获取 bindings
    // @ts-ignore
    const cf = await import('cloudflare:workers');
    cfEnv = cf.env;
  } catch (e) {
    // 回退到 locals (兼容部分开发工具注入)
    cfEnv = (locals as any).runtime || (locals as any);
  }

  const env = {
    ...(globalThis as any).process?.env,
    ...(import.meta as any).env,
    ...cfEnv,
    // 显式确保核心绑定存在 (冗余覆盖以提高兼容性)
    DB: cfEnv.DB,
    SESSION: cfEnv.SESSION,
    IMAGES: cfEnv.IMAGES,
  };
  
  // 注入环境并处理请求
  return app.fetch(request, env);
};
