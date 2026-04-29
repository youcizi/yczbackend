import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { MembershipService } from '../../plugins/membership/services/MembershipService';
import membershipPlugin from '../../plugins/membership/index';
import { pMemberTiers, pMemberTiersI18n, pMemberProfiles } from '../../plugins/membership/schema/tiers';
import { members } from '../../db/schema/members';
import { createTestDb, createMockD1 } from '../helpers/test-utils';
import { hookManager } from '../../lib/plugin-hooks';

describe('Membership V2.0 集成测试', () => {
  let db: any; // Drizzle instance for data prep
  let d1: any; // D1 mock for app injection
  let app: Hono;

  beforeEach(async () => {
    const setup = createTestDb();
    db = setup.db;
    d1 = createMockD1(setup.raw);

    // 清理并重新初始化插件 (防止多次注册导致 Hooks 叠加)
    hookManager.clear();
    MembershipService.initPlugin();

    // 准备数据
    await db.insert(pMemberTiers).values({ id: 1, tenantId: 1, name: 'Gold', discountRate: 90 }).run();
    await db.insert(pMemberTiersI18n).values({ tierId: 1, langCode: 'zh-CN', name: '黄金会员' }).run();
    
    await db.insert(members).values({ id: 'm1', tenantId: 1, email: 'test@ycz.me', passwordHash: '' }).run();
    await db.insert(pMemberProfiles).values({ tenantId: 1, memberId: 'm1', name: 'User 1', tierId: 1 }).run();

    // 构造 Mock App
    app = new Hono<{ Bindings: any }>();
    app.use('/membership/*', async (c, next) => {
      c.set('current_member', { id: 'm1' });
      c.set('domains', { id: 1 });
      await next();
    });
    app.route('/membership', membershipPlugin.storefront);
  });

  it('1. /my-tier 应该根据 X-Language 返回正确翻译', async () => {
    // 中文请求
    const reqZh = new Request('http://localhost/membership/my-tier', {
      headers: { 'X-Language': 'zh-CN' }
    });
    const resZh = await app.fetch(reqZh, { DB: d1 });
    const dataZh = await resZh.json() as any;
    expect(dataZh.data.name).toBe('黄金会员');

    // 英文请求 (兜底)
    const reqEn = new Request('http://localhost/membership/my-tier', {
      headers: { 'X-Language': 'en-US' }
    });
    const resEn = await app.fetch(reqEn, { DB: d1 });
    const dataEn = await resEn.json() as any;
    expect(dataEn.data.name).toBe('Gold');
  });

  it('2. order:pricing 钩子应该正确应用会员折扣', async () => {
    const context = { db, tenantId: 1, member: { id: 'm1' } };
    const pricingData = { basePrice: 100, discountAmount: 0, finalPrice: 100, appliedPlugins: [] };
    
    const result = await hookManager.emit('order:pricing', context, pricingData);
    
    expect(result.finalPrice).toBe(90);
    expect(result.discountAmount).toBe(10);
    expect(result.appliedPlugins).toContain('membership');
  });
});
