import type { APIRoute } from 'astro';
import { app } from '../../app';

/**
 * Astro 路由处理器
 * 将所有 /api/* 请求转发给 Hono
 * 
 * NOTE: 这里的逻辑已经完全解耦到 src/app.ts，
 * 保持此文件作为 APIRoute 的轻量级桥接，以支持测试与 HMR。
 */
export const ALL: APIRoute = ({ request, locals }) => {
  // 统一环境获取逻辑：合并 Astro 环境变量、Cloudflare Runtime 与本地 process.env
  const env = {
    ...(globalThis as any).process?.env,
    ...(import.meta as any).env,
    ...((locals as any).runtime?.env || {})
  };
  
  // 注入环境并处理请求
  return app.fetch(request, env);
};
