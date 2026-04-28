import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/test-utils';
import { members } from '../../db/schema';
import { pMemberProfiles, pMemberAddresses } from '../../db/schema/membership';
import { eq, and } from 'drizzle-orm';
// @ts-ignore
import { MembershipService } from '../../services/MembershipService';

describe('MembershipService 业务逻辑测试 (TDD Step 2)', () => {
  let db: any;

  beforeEach(async () => {
    const setup = createTestDb();
    db = setup.db;

    // 预置基础会员账户 (Identity 层)
    await db.insert(members).values({
      id: 'm-001',
      tenantId: 1,
      email: 'member@tenant1.com',
      passwordHash: 'xxx'
    }).run();

    await db.insert(members).values({
      id: 'm-002',
      tenantId: 2,
      email: 'member@tenant2.com',
      passwordHash: 'xxx'
    }).run();
  });

  it('1. updateProfile - 验证 Upsert 逻辑与隔离', async () => {
    // 首次调用：应自动创建 Profile 记录
    await MembershipService.updateProfile(db, 1, 'm-001', {
      name: '张三',
      accountType: 'individual'
    });

    const profile = await MembershipService.getProfile(db, 1, 'm-001');
    expect(profile.name).toBe('张三');
    expect(profile.email).toBe('member@tenant1.com');

    // 再次调用：应更新原记录而非新增
    await MembershipService.updateProfile(db, 1, 'm-001', { name: '张老三' });
    const updatedStatus = await MembershipService.getProfile(db, 1, 'm-001');
    expect(updatedStatus.name).toBe('张老三');
  });

  it('2. setDefaultAddress - 验证地址排他性', async () => {
    const addrA = await MembershipService.addAddress(db, 1, 'm-001', { detail: '地址A', isDefault: true });
    const addrB = await MembershipService.addAddress(db, 1, 'm-001', { detail: '地址B', isDefault: false });

    await MembershipService.setDefaultAddress(db, 1, 'm-001', addrB.id);

    const allAddresses = await db.select().from(pMemberAddresses).where(eq(pMemberAddresses.memberId, 'm-001')).all();
    
    const defaultAddr = allAddresses.find((a: any) => a.isDefault);
    expect(defaultAddr.id).toBe(addrB.id);
    expect(allAddresses.find((a: any) => a.id === addrA.id).isDefault).toBe(false);
  });

  it('3. Security - 验证跨租户操作有效拦截', async () => {
    // 尝试以租户 1 的身份去更新租户 2 的档案
    await MembershipService.updateProfile(db, 1, 'm-002', { name: '黑客' });
    
    // 结果：由于 tenant_id 不匹配，db 会找不到记录且 upsert 也会基于 tenant_id 限制
    const profile2 = await db.select().from(pMemberProfiles).where(eq(pMemberProfiles.memberId, 'm-002')).get();
    expect(profile2).toBeUndefined();
  });
});
