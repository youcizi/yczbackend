import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/test-utils';
import { eq } from 'drizzle-orm';
import { pMemberProfiles, pMemberAddresses, pMemberTiers } from '../../db/schema/membership';

describe('Membership 插件 - 数据架构与隔离性测试 (TDD Step 1)', () => {
  let db: any;
  let sqlite: any;

  beforeEach(() => {
    // 初始化内存数据库
    const setup = createTestDb();
    db = setup.db;
    sqlite = setup.raw;
  });

  describe('1. 数据库建表校验', () => {
    it('三张核心表应已正确创建', () => {
      const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
      
      expect(tables).toContain('p_member_profiles');
      expect(tables).toContain('p_member_addresses');
      expect(tables).toContain('p_member_tiers');
    });
  });

  describe('2. 逻辑隔离性校验 (Logical Isolation)', () => {
    it('通过 tenant_id 隔离不同租户的会员档案', async () => {
      // 插入租户 1 的数据
      await db.insert(pMemberProfiles).values({
        tenantId: 1,
        memberId: 'm-001',
        name: '张三',
        accountType: 'individual'
      }).run();

      // 插入租户 2 的数据 (同名张三，但属于不同租户)
      await db.insert(pMemberProfiles).values({
        tenantId: 2,
        memberId: 'm-002',
        name: '李四', // 故意不同
        accountType: 'business'
      }).run();

      // 执行隔离查询：仅拉取租户 1 的数据
      const tenant1Data = await db.select()
        .from(pMemberProfiles)
        .where(eq(pMemberProfiles.tenantId, 1))
        .all();

      // 断言：结果不应包含租户 2 的数据
      expect(tenant1Data).toHaveLength(1);
      expect(tenant1Data[0].memberId).toBe('m-001');
      
      // 验证查询绝对不能返回 tenant_id: 2
      const hasTenant2 = tenant1Data.some((item: any) => item.tenantId === 2);
      expect(hasTenant2).toBe(false);
    });
  });
});
