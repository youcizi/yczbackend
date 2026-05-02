import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { users } from './users';

/**
 * 余额变动日志 (Balance Logs)
 */
export const balanceLogs = sqliteTable('balance_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tenantId: integer('tenant_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  type: text('type', { enum: ['add', 'sub', 'set'] }).notNull(),
  amount: integer('amount').notNull(), // 变动金额 (分)
  before: integer('before').notNull(), // 变动前金额
  after: integer('after').notNull(),   // 变动后金额
  
  remark: text('remark'), // 备注
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (t) => ({
  tenantUserIdx: index('balance_tenant_user_idx').on(t.tenantId, t.userId),
}));

/**
 * 积分变动日志 (Points Logs)
 */
export const pointsLogs = sqliteTable('points_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tenantId: integer('tenant_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  type: text('type', { enum: ['add', 'sub', 'set'] }).notNull(),
  amount: integer('amount').notNull(), 
  before: integer('before').notNull(), 
  after: integer('after').notNull(),   
  
  remark: text('remark'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (t) => ({
  tenantUserIdx: index('points_tenant_user_idx').on(t.tenantId, t.userId),
}));
