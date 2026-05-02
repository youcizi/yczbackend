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

  // 1. 基础档案增强
  nickname: text('nickname'),
  avatar: text('avatar'),
  phone: text('phone'),
  gender: text('gender', { enum: ['unknown', 'male', 'female'] }).default('unknown'),
  birthday: text('birthday'), // 存储为 YYYY-MM-DD
  bio: text('bio'),           // 个性签名

  // 2. 资产系统
  balance: integer('balance').default(0).notNull(), // 余额 (单位: 分)
  points: integer('points').default(0).notNull(),   // 积分

  // 扩展元数据 (收货地址、偏好等)
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
});
