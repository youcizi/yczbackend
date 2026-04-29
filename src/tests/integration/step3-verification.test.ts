import { describe, it, expect, beforeAll } from 'vitest';
import { MembershipService } from '../../plugins/membership/services/MembershipService';
import { IdentityService } from '../../services/IdentityService';
import { createDbClient, schema, eq, and } from '../../db';
import { pMemberTiers, pMemberProfiles } from '../../plugins/membership/schema/tiers';

// 模拟 D1 绑定 (Vitest 环境通常有自己的 Mock 逻辑)
const DB = (globalThis as any).DB;

describe('Step 3: Architectural Verification', () => {
  let db: any;
  const tenantId = 1;

  beforeAll(async () => {
    db = await createDbClient(DB);
    // 初始化数据
    await db.insert(schema.plugins).values({
      slug: 'membership',
      name: 'Membership Plugin',
      isEnabled: true,
      config: {},
      configSchema: {}
    }).onConflictDoNothing().run();

    // 插入一个等级及其中文翻译，但不插入英文
    await db.insert(pMemberTiers).values({
      id: 100,
      tenantId,
      name: 'Default Tier',
      discountRate: 90
    }).onConflictDoNothing().run();

    await db.insert(schema.pMemberTiersI18n).values({
      tierId: 100,
      langCode: 'zh-CN',
      name: '高级会员'
    }).onConflictDoNothing().run();
  });

  it('Requirement 3: I18n Fallback Logic', async () => {
    // 请求法语 (fr)，数据库中没有 fr，也没有 en 的翻译
    // 预期回退到 pMemberTiers.name (Default Tier)
    const tier = await MembershipService.getMyTier(db, tenantId, 'fake-id', 'fr');
    
    // 如果没有 profile 关联到该 id，getMyTier 会返回 null
    // 我们可以测试 getTiers
    const tiers = await MembershipService.getTiers(db, tenantId, 'fr');
    const target = tiers.find((t: any) => t.id === 100);
    
    expect(target).toBeDefined();
    expect(target.name).toBe('Default Tier'); // 回退成功
  });

  it('Requirement 4: E2E Registration Flow', async () => {
    const email = `test-${Date.now()}@example.com`;
    const password = 'password123';

    // 模拟注册
    const user = await IdentityService.register(DB, {
      tenantId,
      email,
      password,
      userType: 'member'
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe(email);

    // 验证核心 Users 表
    const dbUser = await db.select().from(schema.users).where(eq(schema.users.id, user.id)).get();
    expect(dbUser).toBeDefined();

    // 验证插件同步 Hooks：p_member_profiles 应该已自动创建
    const profile = await db.select().from(pMemberProfiles).where(eq(pMemberProfiles.memberId, user.id)).get();
    expect(profile).toBeDefined();
    expect(profile.tenantId).toBe(tenantId);
    console.log('✅ E2E Registration verified: Users & Profiles both created.');
  });
});
