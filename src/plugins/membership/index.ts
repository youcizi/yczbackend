import { Hono } from 'hono';
import { MembershipService } from './services/MembershipService';
import { createDbClient } from '../../db';

/**
 * [CLIENT] Storefront Frontend API 
 * 云端商城/移动端专用路由
 * 挂载点: /api/v1/s/membership
 */
const sfApp = new Hono<{ Bindings: any }>();

// 身份从主网关 c.get('current_member') 获取
sfApp.get('/profile', async (c) => {
  const db = await createDbClient(c.env.DB);
  const member = c.get('current_member' as any);
  // 从域名调度中间件获取租户上下文
  const domains = c.get('domains' as any) || { id: 1 }; 
  
  const profile = await MembershipService.getProfile(db, domains.id, member.id);
  if (!profile) return c.json({ error: 'Profile Missing' }, 404);
  
  return c.json({ success: true, data: profile });
});

/**
 * [ADMIN] Plugin Management API
 * 插件管理后台专用路由
 * 挂载点: /api/v1/plugins/proxy/membership
 */
const adminApp = new Hono<{ Bindings: any }>();

adminApp.get('/tiers', async (c) => {
  const db = await createDbClient(c.env.DB);
  const locale = c.req.query('locale') || 'en-US';
  const tiers = await MembershipService.getTiers(db, 1, locale);
  return c.json({ success: true, data: tiers });
});

// 开发文档要求的导出格式
export default {
  admin: adminApp,
  storefront: sfApp,
  init: () => MembershipService.initPlugin()
};
