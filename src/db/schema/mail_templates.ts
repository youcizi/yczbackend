import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const mailTemplates = sqliteTable('mail_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').unique().notNull(),
  name: text('name').notNull(),
  subject: text('subject').notNull(),
  content: text('content').notNull(),
  vars: text('vars'), // 变量说明，JSON 字符串
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});
