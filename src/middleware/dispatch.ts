import { Context, Next } from 'hono';
import { createDbClient } from '../db';
import { systemSettings } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * 域名配置协议 v2
 */
export interface SiteDomains {
  main_domain: string;      // 基础域名，如 ycz.me
  admin_domain?: string;    // 管理后台，默认 admin.{main_domain}
  api_domain?: string;      // 公开接口，默认 api.{main_domain}
  img_domain?: string;      // 图片代理，默认 img.{main_domain}
  public_domains: string[]; // 其他自定义域名
}

// 内存缓存 (Memory Cache)
let RUNTIME_CACHE: SiteDomains | null = null;
let CACHE_EXPIRY = 0;
const CACHE_TTL = 30 * 1000; // 内存缓存 30 秒

/**
 * 获取域名映射并执行自动补全
 */
async function getValidatedMapping(env: any): Promise<SiteDomains | null> {
  const now = Date.now();
  if (RUNTIME_CACHE && now < CACHE_EXPIRY) return RUNTIME_CACHE;

  let config: SiteDomains | null = null;

  // 1. 尝试 KV
  try {
    if (env.NS_CONFIG) {
      config = await env.NS_CONFIG.get('site_domains', { type: 'json' });
    }
  } catch (e) {}

  // 2. 尝试 D1
  if (!config) {
    try {
      const db = await createDbClient(env.DB);
      const row = await db.select().from(systemSettings).where(eq(systemSettings.key, 'site_domains')).get();
      if (row?.value) {
        config = JSON.parse(row.value);
        if (env.NS_CONFIG) await env.NS_CONFIG.put('site_domains', row.value);
      }
    } catch (e) {}
  }

  if (!config || !config.main_domain) return null;

  // 3. 执行推断逻辑 (Inference Logic)
  // 如果子域名未定义，则按规范生成默认值
  const base = config.main_domain;
  const processed: SiteDomains = {
    ...config,
    admin_domain: config.admin_domain || `admin.${base}`,
    api_domain: config.api_domain || `api.${base}`,
    img_domain: config.img_domain || `img.${base}`,
    public_domains: config.public_domains || []
  };

  RUNTIME_CACHE = processed;
  CACHE_EXPIRY = now + CACHE_TTL;
  return processed;
}

/**
 * Master Dispatcher Middleware
 */
export const domainDispatcher = async (c: Context, next: Next) => {
  const hostname = new URL(c.req.url).hostname;
  const config = await getValidatedMapping(c.env);
  
  // 识别分发目标 (Targeting)
  let target: 'admin' | 'api' | 'img' | 'public' = 'public';

  // 本地开发逻辑：如果是 localhost 且没有配置，默认进入 admin；如果有配置，则按配置识别
  if (!config) {
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      c.set('dispatch_target' as any, 'admin');
    } else {
      c.set('dispatch_target' as any, 'admin'); // 兜底
    }
    return await next();
  }

  if (hostname === config.admin_domain) {
    target = 'admin';
  } else if (hostname === config.api_domain) {
    target = 'api';
  } else if (hostname === config.img_domain) {
    target = 'img';
  } else {
    // 识别公开站逻辑：主域名、显式声明的公共域名、以及不属于系统域名的所有其他域名均视为公开站（Storefront）
    const isMain = hostname === config.main_domain;
    const isDeclaredPublic = config.public_domains.some(d => hostname === d || hostname.endsWith(`.${d}`));
    
    // 如果既不是系统保留域名，默认进入 public 模式
    // 只有明确匹配 admin_domain 才允许进入后台
    target = 'public'; 
  }

  c.set('dispatch_target' as any, target);
  c.set('site_domains' as any, config);

  await next();
};
