import { eq, and, ne, inArray } from 'drizzle-orm';
import { members } from '../../../db/schema/members';
import { pMemberProfiles, pMemberAddresses, pMemberTiers, pMemberTiersI18n } from '../schema/tiers';
import { hookManager } from '../../../lib/plugin-hooks';
import { CoreService } from '../../../services/CoreService';

/**
 * MembershipService: 会员业务逻辑层
 */
export class MembershipService {
  /**
   * 插件初始化：注册系统钩子
   */
  static initPlugin() {
    // 订阅定价计算钩子 (对齐 V2.0 命名)
    hookManager.on('order:pricing', async (ctx, data) => {
      const { db, tenantId, member } = ctx;
      if (!member?.id) return data;

      const discount = await this.getMemberDiscount(db, tenantId, member.id);
      if (discount < 100) {
        const finalPrice = Math.round(data.basePrice * (discount / 100) * 100) / 100;
        return {
          ...data,
          discountAmount: (data.discountAmount || 0) + (data.basePrice - finalPrice),
          finalPrice: finalPrice,
          appliedPlugins: [...(data.appliedPlugins || []), 'membership']
        };
      }
      return data;
    });
    console.log('✅ [Membership] Hook "order:pricing" 已就绪');
  }

  /**
   * 获取多语言会员等级列表
   */
  static async getTiers(db: any, tenantId: number, locale: string = 'en-US') {
    const rows = await db.select({
      id: pMemberTiers.id,
      discountRate: pMemberTiers.discountRate,
      baseName: pMemberTiers.name,
      translatedName: pMemberTiersI18n.name,
    })
    .from(pMemberTiers)
    .leftJoin(pMemberTiersI18n, and(
      eq(pMemberTiersI18n.tierId, pMemberTiers.id),
      eq(pMemberTiersI18n.langCode, locale)
    ))
    .where(eq(pMemberTiers.tenantId, tenantId))
    .all();

    // 同时获取所有语种的翻译（用于后台编辑）
    const allI18n = await db.select()
      .from(pMemberTiersI18n)
      .where(inArray(pMemberTiersI18n.tierId, rows.map((r: any) => r.id).concat([0])))
      .all();

    return rows.map((r: any) => ({
      ...r,
      name: r.translatedName || r.baseName,
      translations: allI18n.filter((i: any) => i.tierId === r.id)
    }));
  }

  /**
   * 保存等级（含多语言字段动态写入）
   */
  static async saveTier(db: any, tenantId: number, data: {
    id?: number,
    name: string,
    discountRate: number,
    translations: Record<string, string> // { 'zh-CN': '金牌会员', 'en-US': 'Gold' }
  }) {
    let tierId = data.id;

    if (tierId) {
      await db.update(pMemberTiers)
        .set({ name: data.name, discountRate: data.discountRate })
        .where(and(eq(pMemberTiers.id, tierId), eq(pMemberTiers.tenantId, tenantId)))
        .run();
    } else {
      const [inserted] = await db.insert(pMemberTiers)
        .values({ tenantId, name: data.name, discountRate: data.discountRate })
        .returning();
      tierId = inserted.id;
    }

    // 同步翻译表
    const enabledLangs = await CoreService.getEnabledLanguages(db);
    for (const lang of enabledLangs) {
      const translation = data.translations[lang.code];
      if (translation) {
        // Upsert 翻译
        const existing = await db.select().from(pMemberTiersI18n)
          .where(and(eq(pMemberTiersI18n.tierId, tierId!), eq(pMemberTiersI18n.langCode, lang.code)))
          .get();
        
        if (existing) {
          await db.update(pMemberTiersI18n)
            .set({ name: translation })
            .where(and(eq(pMemberTiersI18n.tierId, tierId!), eq(pMemberTiersI18n.langCode, lang.code)))
            .run();
        } else {
          await db.insert(pMemberTiersI18n)
            .values({ tierId: tierId!, langCode: lang.code, name: translation })
            .run();
        }
      }
    }

    return { id: tierId };
  }

  /**
   * 获取当前会员等级 (商城端 API 使用)
   */
  static async getMyTier(db: any, tenantId: number, memberId: string, locale: string = 'en-US') {
    const profile = await db.select({
      tierId: pMemberProfiles.tierId
    })
    .from(pMemberProfiles)
    .where(and(eq(pMemberProfiles.memberId, memberId), eq(pMemberProfiles.tenantId, tenantId)))
    .get();

    if (!profile?.tierId) return null;

    return await db.select({
      id: pMemberTiers.id,
      discountRate: pMemberTiers.discountRate,
      baseName: pMemberTiers.name,
      translatedName: pMemberTiersI18n.name,
    })
    .from(pMemberTiers)
    .leftJoin(pMemberTiersI18n, and(
      eq(pMemberTiersI18n.tierId, pMemberTiers.id),
      eq(pMemberTiersI18n.langCode, locale)
    ))
    .where(eq(pMemberTiers.id, profile.tierId))
    .get()
    .then((r: any) => r ? { ...r, name: r.translatedName || r.baseName } : null);
  }

  static async getProfile(db: any, tenantId: number, memberId: string) {
    return await db.select({
      id: members.id,
      email: members.email,
      name: pMemberProfiles.name,
      avatar: pMemberProfiles.avatar,
      phone: pMemberProfiles.phone,
      accountType: pMemberProfiles.accountType,
    })
    .from(members)
    .leftJoin(pMemberProfiles, and(
      eq(pMemberProfiles.memberId, members.id),
      eq(pMemberProfiles.tenantId, tenantId)
    ))
    .where(and(eq(members.id, memberId), eq(members.tenantId, tenantId)))
    .get();
  }

  static async getMemberDiscount(db: any, tenantId: number, memberId: string): Promise<number> {
    const result = await db.select({
      discountRate: pMemberTiers.discountRate
    })
    .from(pMemberProfiles)
    .innerJoin(pMemberTiers, eq(pMemberProfiles.tierId, pMemberTiers.id))
    .where(and(eq(pMemberProfiles.memberId, memberId), eq(pMemberProfiles.tenantId, tenantId)))
    .get();

    return result?.discountRate || 100;
  }
}
