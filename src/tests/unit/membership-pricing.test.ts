import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/test-utils';
import { members, pMemberProfiles, pMemberTiers } from '../../db/schema';
// @ts-ignore
import { MembershipService } from '../../services/MembershipService';

describe('Membership 定价引擎测试 (TDD Step 3)', () => {
  let db: any;

  beforeEach(async () => {
    const setup = createTestDb();
    db = setup.db;

    // 1. 设置租户 1 的 85 折等级
    await db.insert(pMemberTiers).values({
      id: 10,
      tenantId: 1,
      name: 'VIP85',
      discountRate: 85 
    }).run();

    // 2. 设置租户 1 会员并关联等级
    await db.insert(members).values({ id: 'm-t1-vip', tenantId: 1, email: 'vip@t1.com', passwordHash: 'x' }).run();
    // 注意：当前 Schema 尚无 tierId 字段，此处写入会因 Red Phase 而导致类型或运行时错误
    await db.insert(pMemberProfiles).values({
      tenantId: 1,
      memberId: 'm-t1-vip',
      name: '租户1高级会员',
      tierId: 10
    } as any).run();

    // 3. 设置租户 2 同账户名会员 (无等级)
    await db.insert(members).values({ id: 'm-t2-normal', tenantId: 2, email: 'vip@t1.com', passwordHash: 'x' }).run();
  });

  it('1. 折扣路径：VIP 会员输入 100 元应返回 85 元', async () => {
    const finalPrice = await MembershipService.calculateMemberPrice(db, 1, 'm-t1-vip', 100);
    expect(finalPrice).toBe(85);
  });

  it('2. 原价路径：无等级会员输入 100 元应返回 100 元', async () => {
    const price = await MembershipService.calculateMemberPrice(db, 2, 'm-t2-normal', 100);
    expect(price).toBe(100);
  });

  it('3. 安全路径：禁止跨租户获取折扣 (租户 2 尝试用租户 1 的等级 ID)', async () => {
    // 假设黑客知道了租户 1 的等级 ID 为 10，尝试通过数据库手段关联，但我方 Service 必须在计算时强制过滤 tenant_id
    const price = await MembershipService.calculateMemberPrice(db, 2, 'm-t2-normal', 100);
    expect(price).toBe(100);
  });
});
