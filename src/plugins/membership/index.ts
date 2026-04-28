import { Hono } from 'hono';
import { MembershipService } from '../../services/MembershipService';
import { createDbClient } from '../../db';

/**
 * Membership 插件入口应用
 * 设计原则：
 * 1. 独立性：内部逻辑不依赖主应用路由，仅通过 Service 层进行跨模块调用。
 * 2. 身份隔离：通过网关透传的 X-Tenant-Id 和 X-Member-Id 强制执行 D1 逻辑隔离。
 */
const app = new Hono<{ Bindings: any }>();

// 身份上下文提取助手
const getAuthContext = (c: any) => {
  const tenantId = Number(c.req.header('X-Tenant-Id'));
  const memberId = c.req.header('X-Member-Id');
  if (!tenantId || !memberId) {
    throw new Error('未授权的操作上下文: 缺少身份透传 Headers');
  }
  return { tenantId, memberId };
};

/**
 * [PUBLIC/MEMBER] GET /profile
 * 获取会员基础资料及等级
 */
app.get('/profile', async (c) => {
  try {
    const { tenantId, memberId } = getAuthContext(c);
    const db = await createDbClient(c.env.DB);
    const profile = await MembershipService.getProfile(db, tenantId, memberId);
    
    if (!profile) {
      return c.json({ error: 'Profile not found' }, 404);
    }
    
    return c.json(profile);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

/**
 * [PUBLIC/MEMBER] POST /profile
 * 更新会员画像 (支持 Upsert)
 */
app.post('/profile', async (c) => {
  try {
    const { tenantId, memberId } = getAuthContext(c);
    const body = await c.req.json();
    const db = await createDbClient(c.env.DB);
    
    await MembershipService.updateProfile(db, tenantId, memberId, body);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

/**
 * [INTERNAL] POST /internal/calculate-price
 * 用于结算系统调用，返回会员折扣后的价格
 */
app.post('/internal/calculate-price', async (c) => {
  try {
    const { tenantId, memberId } = getAuthContext(c);
    const { basePrice } = await c.req.json();
    if (typeof basePrice !== 'number') throw new Error('Invalid basePrice');

    const db = await createDbClient(c.env.DB);
    const finalPrice = await MembershipService.calculateMemberPrice(db, tenantId, memberId, basePrice);
    
    return c.json({ finalPrice });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default app;
