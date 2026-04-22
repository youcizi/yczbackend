import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { inquiries } from '../db/schema/inquiries';
import { collections, entities, models } from '../db/schema';

/**
 * InquiryService: 询盘与线索管理服务
 */
export class InquiryService {
  /**
   * 获取询盘统计数据 (用于仪表盘)
   */
  static async getLeadsStats(db: any) {
    try {
      // 1. 获取总数
      const totalResult = await db.select({ count: sql<number>`count(*)` }).from(inquiries).get();
      const total = totalResult?.count || 0;

      // 2. 获取今日新增
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const todayResult = await db.select({ count: sql<number>`count(*)` })
        .from(inquiries)
        .where(sql`${inquiries.createdAt} >= ${startOfToday.getTime()}`)
        .get();
      const today = todayResult?.count || 0;

      // 3. 高转化页面排行
      const topPages = await db.select({
        url: inquiries.sourceUrl,
        count: sql<number>`count(*)`
      })
      .from(inquiries)
      .where(sql`${inquiries.sourceUrl} is not null`)
      .groupBy(inquiries.sourceUrl)
      .orderBy(sql`count(*) desc`)
      .limit(5)
      .all();

      return {
        total,
        today,
        topPages: topPages.map((p: any) => ({ url: p.url || 'Unknown', count: p.count }))
      };
    } catch (e) {
      console.error('Failed to get leads stats:', e);
      return { total: 0, today: 0, topPages: [] };
    }
  }

  /**
   * 创建询盘记录
   * @param db 数据库客户端
   * @param data 询盘数据
   */
  static async createInquiry(db: any, data: {
    tenantId: number,
    email: string,
    content: string,
    memberId?: string | null,
    verifyToken?: string,
    status?: 'pending' | 'spam',
    sourceUrl?: string,
    metadata?: any
  }) {
    // 1. 基础数据清洗 (预防 XSS)
    const cleanContent = data.content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    // 2. 落库
    const result = await db.insert(inquiries).values({
      tenantId: data.tenantId,
      email: data.email,
      content: cleanContent,
      memberId: data.memberId || null,
      verifyToken: data.verifyToken,
      status: data.status || 'pending',
      sourceUrl: data.sourceUrl,
      metadata: data.metadata || {}
    }).returning();

    return result[0];
  }

  /**
   * 获取询盘列表 (后台管理)
   * @param db 数据库客户端
   * @param tenantId 租户 ID
   */
  static async listInquiries(db: any, tenantId: number) {
    return await db.select()
      .from(inquiries)
      .where(eq(inquiries.tenantId, tenantId))
      .orderBy(desc(inquiries.createdAt))
      .all();
  }

  /**
   * 获取所有聚合线索 (核心 CRM 数据源)
   * 包含新版 inquiries 和旧版 entities 线索
   */
  static async getAllLeads(db: any) {
    // 1. 获取新版询盘
    const newInquiries = await db.select().from(inquiries).orderBy(desc(inquiries.createdAt)).all();
    const mappedInquiries = newInquiries.map(item => ({
      id: item.id,
      sourceName: 'Inquiry System',
      collectionSlug: 'inquiry',
      data: {
        email: item.email,
        content: item.content,
        sourceUrl: item.sourceUrl
      },
      meta: item.metadata || {
        crm_governance: { status: item.status, notes: [] },
        visitor_tracking: { submit_url: item.sourceUrl }
      },
      createdAt: item.createdAt,
      _type: 'inquiry'
    }));

    // 2. 获取旧版线索
    const legacyLeads = await this.legacy_listLeads(db);
    const mappedLegacy = legacyLeads.map((item: any) => ({
      ...item,
      _type: 'legacy'
    }));

    // 3. 聚合排序
    return [...mappedInquiries, ...mappedLegacy].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * 更新线索状态与备注
   */
  static async updateCrmStatus(db: any, id: number, status: string, note?: string, user: string = 'admin') {
    // 首先尝试在 inquiries 表中查找 (简单起见，此处暂假设 ID 是唯一的，实际应区分来源)
    // 实际上 getAllLeads 返回了 _type，但前端 Patch 请求目前只带了 ID
    // TODO: 生产环境建议前端在 Patch 时带上来源类型
    
    // 1. 尝试更新新版询盘
    const inquiry = await db.select().from(inquiries).where(eq(inquiries.id, id)).get();
    if (inquiry) {
      const meta = inquiry.metadata || { crm_governance: { status: inquiry.status, notes: [] } };
      if (note) {
        if (!meta.crm_governance) meta.crm_governance = { status: inquiry.status, notes: [] };
        meta.crm_governance.notes.push({ time: new Date().toISOString(), content: note, user });
      }
      if (status) {
        meta.crm_governance.status = status;
      }
      
      const [updated] = await db.update(inquiries)
        .set({ 
          status: (status as any) || inquiry.status, 
          metadata: meta 
        })
        .where(eq(inquiries.id, id))
        .returning();
      return updated.metadata?.crm_governance;
    }

    // 2. 尝试更新旧版 entities (Legacy)
    const entity = await db.select().from(entities).where(eq(entities.id, id)).get();
    if (entity) {
      const meta = entity.metadata || { crm_governance: { status: 'pending', notes: [] } };
      if (note) {
        if (!meta.crm_governance) meta.crm_governance = { status: 'pending', notes: [] };
        meta.crm_governance.notes.push({ time: new Date().toISOString(), content: note, user });
      }
      if (status) {
        meta.crm_governance.status = status;
      }

      const [updated] = await db.update(entities)
        .set({ metadata: meta })
        .where(eq(entities.id, id))
        .returning();
      return updated.metadata?.crm_governance;
    }

    throw new Error('Lead not found');
  }

  /**
   * [Legacy] 线索扫描逻辑 (全量扫描模式)
   */
  static async legacy_listLeads(db: any) {
    const allCollections = await db.select({
      id: collections.id,
      name: collections.name,
      fieldConfig: collections.fieldConfig,
      modelFields: models.fieldsJson
    })
    .from(collections)
    .innerJoin(models, eq(collections.modelId, models.id))
    .all();

    const inquiryColIds = allCollections.filter(col => {
      const config = col.fieldConfig || {};
      const fields = typeof col.modelFields === 'string' ? JSON.parse(col.modelFields) : col.modelFields;
      return config.category === 'inquiry' || (fields && fields.some((f: any) => f.name.toLowerCase().includes('email')));
    }).map(c => c.id);

    if (inquiryColIds.length === 0) return [];

    const rawLeads = await db.select({
      id: entities.id,
      sourceName: collections.name,
      data: entities.dataJson,
      meta: entities.metadata,
      createdAt: entities.createdAt
    })
    .from(entities)
    .innerJoin(collections, eq(entities.collectionId, collections.id))
    .where(inArray(entities.collectionId, inquiryColIds))
    .orderBy(desc(entities.createdAt))
    .all();

    return rawLeads;
  }
}
