import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { members } from './members';

/**
 * 询盘系统表 (Inquiry System)
 */
export const inquiries = sqliteTable('inquiries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // 租户隔离
  tenantId: integer('tenant_id').notNull(),
  
  // 会员绑定 (可选，游客为 null)
  memberId: text('member_id').references(() => members.id, { onDelete: 'set null' }),
  
  // 冗余设计：即便绑定了会员，也冗余存储 email
  // 理由：防止会员修改邮箱后历史联系方式丢失，且统一查询逻辑
  email: text('email').notNull(),
  
  // 询盘内容
  content: text('content').notNull(),
  
  // 安全校验: Cloudflare Turnstile Token
  verifyToken: text('verify_token'),
  
  // 数据状态: pending (待处理) | replied (已回复) | spam (垃圾邮件/机器人) | closed (已关闭)
  status: text('status', { enum: ['pending', 'replied', 'spam', 'closed'] }).default('pending'),
  
  // 来源页面 URL
  sourceUrl: text('source_url'),
  
  // 扩展元数据 (CRM 状态、跟进备注、访客足迹等)
  metadata: text('metadata', { mode: 'json' }).$type<{
    visitor_tracking?: {
      entry_url?: string;
      submit_url?: string;
      visit_count?: number;
      ip?: string;
    };
    crm_governance?: {
      status: string;
      notes: Array<{ time: string; content: string; user: string }>;
    };
  }>(),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
}, (t) => ({
  // 后台管理性能优化索引
  inquiryTenantIdx: index('inquiry_tenant_idx').on(t.tenantId, t.createdAt),
  // 来源页面查询优化
  inquirySourceIdx: index('inquiry_source_idx').on(t.sourceUrl),
}));

