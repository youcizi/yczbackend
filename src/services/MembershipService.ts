import { eq, and, ne } from 'drizzle-orm';
import { members } from '../db/schema/members';
import { pMemberProfiles, pMemberAddresses, pMemberTiers } from '../db/schema/membership';

/**
 * MembershipService: 会员业务逻辑层
 * 核心原则：所有的数据库操作必须显式包含 tenantId 校验，确保多租户数据逻辑隔离。
 */
export class MembershipService {
  /**
   * 获取会员完整档案
   * 关联 members 表 (Identity) 和 p_member_profiles 表 (Detail)
   */
  static async getProfile(db: any, tenantId: number, memberId: string) {
    const result = await db.select({
      id: members.id,
      email: members.email,
      name: pMemberProfiles.name,
      avatar: pMemberProfiles.avatar,
      phone: pMemberProfiles.phone,
      accountType: pMemberProfiles.accountType,
      level: members.level,
      status: members.status,
    })
    .from(members)
    .leftJoin(pMemberProfiles, and(
      eq(pMemberProfiles.memberId, members.id),
      eq(pMemberProfiles.tenantId, tenantId)
    ))
    .where(and(
      eq(members.id, memberId),
      eq(members.tenantId, tenantId)
    ))
    .get();

    return result || null;
  }

  /**
   * 更新或创建会员资料 (Upsert)
   * 内部强制校验 tenantId 归属关系
   */
  static async updateProfile(db: any, tenantId: number, memberId: string, data: Partial<{
    name: string,
    avatar: string,
    phone: string,
    tierId: number,
    accountType: 'individual' | 'business'
  }>) {
    // 1. 鉴权：确认该 member 确实属于此租户
    const baseMember = await db.select().from(members)
      .where(and(eq(members.id, memberId), eq(members.tenantId, tenantId)))
      .get();
    
    if (!baseMember) {
      console.warn(`[MembershipService] Security Alert: Unauthorized profile update attempt for member ${memberId} in tenant ${tenantId}`);
      return null;
    }

    // 2. 检查 Profile 记录是否存在
    const existing = await db.select().from(pMemberProfiles)
      .where(and(eq(pMemberProfiles.memberId, memberId), eq(pMemberProfiles.tenantId, tenantId)))
      .get();

    if (existing) {
      // 更新现有记录
      return await db.update(pMemberProfiles)
        .set({ ...data })
        .where(and(eq(pMemberProfiles.memberId, memberId), eq(pMemberProfiles.tenantId, tenantId)))
        .run();
    } else {
      // 创建新记录
      return await db.insert(pMemberProfiles)
        .values({
          tenantId,
          memberId,
          name: data.name || '',
          avatar: data.avatar,
          phone: data.phone,
          tierId: data.tierId,
          accountType: data.accountType || 'individual'
        })
        .run();
    }
  }

  /**
   * 添加送货地址
   */
  static async addAddress(db: any, tenantId: number, memberId: string, data: {
    detail: string,
    countryCode?: string,
    isDefault?: boolean
  }) {
    const [inserted] = await db.insert(pMemberAddresses).values({
      tenantId,
      memberId,
      detail: data.detail,
      countryCode: data.countryCode || 'CN',
      isDefault: data.isDefault || false
    }).returning();

    // 如果新地址标记为默认，则通过排他逻辑处理
    if (data.isDefault) {
      await this.setDefaultAddress(db, tenantId, memberId, inserted.id);
    }

    return inserted;
  }

  /**
   * 设置默认地址 (排他性保障)
   * 确保用户在同一个租户下只有一个默认地址
   */
  static async setDefaultAddress(db: any, tenantId: number, memberId: string, addressId: number) {
    // 1. 将所有其它地址置为非默认
    await db.update(pMemberAddresses)
      .set({ isDefault: false })
      .where(and(
        eq(pMemberAddresses.memberId, memberId),
        eq(pMemberAddresses.tenantId, tenantId),
        ne(pMemberAddresses.id, addressId)
      ))
      .run();

    // 2. 将目标地址置为默认
    return await db.update(pMemberAddresses)
      .set({ isDefault: true })
      .where(and(
        eq(pMemberAddresses.id, addressId),
        eq(pMemberAddresses.memberId, memberId),
        eq(pMemberAddresses.tenantId, tenantId)
      ))
      .run();
  }

  /**
   * 获取会员折扣率 (1-100)
   * 严格保障多租户隔离：只有当 Profile 和 Tier 的 tenantId 均匹配时才生效
   */
  static async getMemberDiscount(db: any, tenantId: number, memberId: string): Promise<number> {
    try {
      const result = await db.select({
        discountRate: pMemberTiers.discountRate
      })
      .from(pMemberProfiles)
      .innerJoin(pMemberTiers, and(
        eq(pMemberProfiles.tierId, pMemberTiers.id),
        eq(pMemberTiers.tenantId, tenantId)
      ))
      .where(and(
        eq(pMemberProfiles.memberId, memberId),
        eq(pMemberProfiles.tenantId, tenantId)
      ))
      .get();

      return result?.discountRate || 100;
    } catch (e) {
      return 100;
    }
  }

  /**
   * 计算会员最终成交价
   * 逻辑：basePrice * (discountRate / 100)
   * 【B2B 阶梯价扩展说明】：
   * 未来若需支持阶梯定价，可在此方法中增加 quantity 参数，
   * 并查询新增的 p_member_price_tiers(tier_id, min_quantity, discount) 表进行二次叠加。
   */
  static async calculateMemberPrice(db: any, tenantId: number, memberId: string, basePrice: number): Promise<number> {
    const discount = await this.getMemberDiscount(db, tenantId, memberId);
    return Math.round(basePrice * (discount / 100) * 100) / 100;
  }
}
