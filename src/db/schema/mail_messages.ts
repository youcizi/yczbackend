import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

/**
 * 邮件往来记录表 (用于收件箱与回复追踪)
 */
export const mailMessages = sqliteTable('mail_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  threadId: text('thread_id').notNull(), // 用于聚合会话
  fromEmail: text('from_email').notNull(),
  toEmail: text('to_email').notNull(),
  subject: text('subject'),
  content: text('content').notNull(),
  direction: text('direction', { enum: ['inbound', 'outbound'] }).notNull(),
  status: text('status', { enum: ['unread', 'read', 'replied'] }).default('unread'),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (t) => ({
  threadIdx: index('mail_thread_idx').on(t.threadId),
  fromIdx: index('mail_from_idx').on(t.fromEmail),
}));
