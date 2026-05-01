import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './users';

/**
 * 会员 API 令牌表
 * 用于前台会员通过 REST API 访问系统插件资源
 */
export const apiTokens = sqliteTable('api_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // 关联用户
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // 令牌名称 (用于标识，如 "移动端应用", "VSCode 插件")
  name: text('name').notNull(),
  
  // 令牌原始值 (通常为加密存储或带前缀的随机串)
  token: text('token').unique().notNull(),
  
  // 状态: active (活跃) | revoked (已撤销)
  status: text('status', { enum: ['active', 'revoked'] }).default('active'),
  
  // 过期时间 (可选)
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  
  // 最后使用时间
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
