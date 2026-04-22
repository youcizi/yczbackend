import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * 多租户会员表 (Identity System)
 */
export const members = sqliteTable('members', {
  // 会员唯一 ID (建议使用 nanoid 或 UUID)
  id: text('id').primaryKey(),
  
  // 租户隔离标识 (对应 sites.id)
  tenantId: integer('tenant_id').notNull(),
  
  // 会员账号
  email: text('email').notNull(),
  
  // 认证信息
  passwordHash: text('password_hash').notNull(),
  
  // 会员类型: registered (已注册) | guest (访客)
  type: text('type', { enum: ['registered', 'guest'] }).default('registered'),
  
  // 账号状态
  status: text('status', { enum: ['active', 'banned'] }).default('active'),
  
  // 会员等级 (预留)
  level: integer('level').default(1),
  
  // 扩展元数据 (收货地址、偏好等)
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
}, (t) => ({
  // 核心约束：同一个租户下 email 必须唯一
  memberUniqueIdx: uniqueIndex('member_unique_idx').on(t.tenantId, t.email),
}));
