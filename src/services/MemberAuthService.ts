import { eq, and } from 'drizzle-orm';
import { members } from '../db/schema/members';
import { passwordHasher } from '../lib/auth';

/**
 * MemberAuthService: 具备租户隔离能力的会员身份服务
 */
export class MemberAuthService {
  /**
   * 注册新会员
   * @param db 数据库客户端
   * @param tenantId 租户 ID (site_id)
   * @param email 会员邮箱
   * @param password 原始密码
   * @param metadata 扩展元数据
   */
  static async register(db: any, tenantId: number, email: string, password: string, metadata?: Record<string, any>) {
    // 1. 严格检查唯一性 (按租户隔离)
    const existing = await db.select()
      .from(members)
      .where(and(
        eq(members.email, email),
        eq(members.tenantId, tenantId)
      ))
      .get();

    if (existing) {
      throw new Error('该邮箱在当前店铺已注册');
    }

    // 2. 哈希加密
    const passwordHash = await passwordHasher.hash(password);
    
    // 3. 生成 ID 并落库 (建议使用分布式 ID 或 UUID)
    const id = Math.random().toString(36).substring(2, 12) + Date.now().toString(36);

    const result = await db.insert(members).values({
      id,
      tenantId,
      email,
      passwordHash,
      metadata: metadata || {},
      status: 'active',
      type: 'registered'
    }).returning();

    return result[0];
  }

  /**
   * 登录验证
   */
  static async login(db: any, tenantId: number, email: string, password: string) {
    // 强制同时验证 tenantId
    const member = await db.select()
      .from(members)
      .where(and(
        eq(members.email, email),
        eq(members.tenantId, tenantId)
      ))
      .get();

    if (!member) {
      throw new Error('用户不存在或该店铺暂无此账号');
    }

    const isValid = await passwordHasher.verify(member.passwordHash, password);
    if (!isValid) {
      throw new Error('密码错误');
    }

    if (member.status === 'banned') {
      throw new Error('您的账号已被禁用');
    }

    return member;
  }

  /**
   * 获取会员基本信息
   */
  static async getProfile(db: any, tenantId: number, memberId: string) {
    // 强制增加 tenantId 过滤，防止越权查询
    const member = await db.select()
      .from(members)
      .where(and(
        eq(members.id, memberId),
        eq(members.tenantId, tenantId)
      ))
      .get();

    if (!member) {
      throw new Error('会员不存在或租户不匹配');
    }

    return member;
  }
}
