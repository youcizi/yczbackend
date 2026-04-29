import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * 核心认证表 (Unified Identity)
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  userType: text('user_type', { enum: ['admin', 'member'] }).notNull(),
  status: text('status', { enum: ['active', 'inactive', 'banned'] }).default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
}, (t) => ({
  unq: uniqueIndex('user_tenant_email_idx').on(t.tenantId, t.email),
}));
