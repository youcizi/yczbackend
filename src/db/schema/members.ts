import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from './users';

/**
 * 多租户会员业务表 (Extended Profile)
 */
export const members = sqliteTable('members', {
  // 关联核心用户 ID
  id: text('id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  
  // 会员类型: registered (已注册) | guest (访客)
  type: text('type', { enum: ['registered', 'guest'] }).default('registered'),
  
  // 会员等级 (预留)
  level: integer('level').default(1),
  
  // 扩展元数据 (收货地址、偏好等)
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
});
