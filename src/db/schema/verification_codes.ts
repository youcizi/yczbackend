import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const verificationCodes = sqliteTable('verification_codes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull(),
  code: text('code').notNull(),
  type: text('type', { enum: ['register', 'reset_password'] }).default('register'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
