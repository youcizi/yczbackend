import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemberAuthService } from '../../services/MemberAuthService';

describe('Member Identity System (Multi-tenant TDD)', () => {
  const mockDb = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    get: vi.fn(),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    all: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Case A: 注册隔离 - 同一邮箱在 Shop_1 和 Shop_2 应被视为独立账号', async () => {
    // 1. 模拟在 Shop 1 已注册
    mockDb.get.mockImplementationOnce(() => Promise.resolve({ id: 'm1', email: 'v@test.com', tenantId: 1 }));
    
    await expect(MemberAuthService.register(mockDb, 1, 'v@test.com', 'pwd123'))
      .rejects.toThrow('该邮箱在当前店铺已注册');

    // 2. 模拟在 Shop 2 未注册
    mockDb.get.mockImplementationOnce(() => Promise.resolve(null));
    mockDb.returning.mockResolvedValueOnce([{ id: 'm2', email: 'v@test.com', tenantId: 2 }]);
    
    const newMember = await MemberAuthService.register(mockDb, 2, 'v@test.com', 'pwd123');
    
    expect(newMember.tenantId).toBe(2);
    expect(newMember.id).toBe('m2');
  });

  it('Case B: 身份越权 - 验证租户级 Profile 获取', async () => {
    // 模拟数据：属于租户 1 的会员
    const memberData = { id: 'm1', email: 'v@test.com', tenantId: 1 };
    
    // 正确租户查询
    mockDb.get.mockResolvedValueOnce(memberData);
    const profile = await MemberAuthService.getProfile(mockDb, 1, 'm1');
    expect(profile.id).toBe('m1');

    // 错误租户查询 (模拟数据库未返回数据，因为 where 条件带了 tenantId)
    mockDb.get.mockResolvedValueOnce(null);
    await expect(MemberAuthService.getProfile(mockDb, 2, 'm1'))
      .rejects.toThrow('会员不存在或租户不匹配');
  });
});
