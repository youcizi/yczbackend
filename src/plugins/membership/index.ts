import { Hono } from 'hono';
import { MembershipService } from './services/MembershipService';
import { createDbClient } from '../../db';

/**
 * [CLIENT] Storefront Frontend API 
 * 挂载点: /api/v1/s/membership
 */
const sfApp = new Hono<{ Bindings: any }>();

import sfApi from './api-front';

// 身份共享：直接使用网关解析出的 current_member 上下文
sfApp.route('/', sfApi); // 挂载注册等前台接口

sfApp.get('/my-tier', async (c) => {
  const db = await createDbClient(c.env.DB);
  const member = c.get('current_member' as any);
  const domains = c.get('domains' as any) || { id: 1 }; 
  const lang = c.req.header('X-Language') || 'en-US';
  
  const tier = await MembershipService.getMyTier(db, domains.id, member.id, lang);
  return c.json({ success: true, data: tier });
});

sfApp.get('/profile', async (c) => {
  const db = await createDbClient(c.env.DB);
  const member = c.get('current_member' as any);
  const domains = c.get('domains' as any) || { id: 1 }; 
  
  const profile = await MembershipService.getProfile(db, domains.id, member.id);
  if (!profile) return c.json({ error: 'Profile Missing' }, 404);
  
  return c.json({ success: true, data: profile });
});

/**
 * [ADMIN] Plugin Management API
 * 挂载点: /api/v1/plugins/proxy/membership
 */
const adminApp = new Hono<{ Bindings: any }>();

adminApp.get('/tiers', async (c) => {
  const db = await createDbClient(c.env.DB);
  const locale = c.req.query('locale') || 'en-US';
  const tiers = await MembershipService.getTiers(db, 1, locale);
  return c.json({ success: true, data: tiers });
});

adminApp.post('/tiers', async (c) => {
  const db = await createDbClient(c.env.DB);
  const body = await c.req.json();
  const result = await MembershipService.saveTier(db, 1, body);
  return c.json({ success: true, data: result });
});

// 导出插件配置
const membershipPlugin = {
  admin: adminApp,
  storefront: sfApp,
  init: () => MembershipService.initPlugin()
};

export default membershipPlugin;
export { adminApp, sfApp };
