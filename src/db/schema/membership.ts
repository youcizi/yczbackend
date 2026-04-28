import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { members } from './members';

/**
 * 1. 用户画像表 (p_member_profiles)
 * 支持 B2C/B2B 模式，支持多租户逻辑隔离
 */
export const pMemberProfiles = sqliteTable('p_member_profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tenantId: integer('tenant_id').notNull(),
  memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  avatar: text('avatar'),
  phone: text('phone'),
  tierId: integer('tier_id').references(() => pMemberTiers.id),
  accountType: text('account_type', { enum: ['individual', 'business'] }).notNull().default('individual'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (t) => ({
  tenantIdx: index('p_profile_tenant_idx').on(t.tenantId),
  tenantMemberIdx: index('p_profile_tenant_member_idx').on(t.tenantId, t.memberId),
}));

/**
 * 2. 多地址表 (p_member_addresses)
 */
export const pMemberAddresses = sqliteTable('p_member_addresses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tenantId: integer('tenant_id').notNull(),
  memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  countryCode: text('country_code').notNull().default('CN'),
  province: text('province'),
  city: text('city'),
  district: text('district'),
  detail: text('detail').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (t) => ({
  tenantMemberIdx: index('p_address_tenant_member_idx').on(t.tenantId, t.memberId),
}));

/**
 * 3. 会员等级与折扣率表 (p_member_tiers)
 */
export const pMemberTiers = sqliteTable('p_member_tiers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tenantId: integer('tenant_id').notNull(),
  name: text('name').notNull(), // 如: VIP, Gold
  discountRate: integer('discount_rate').notNull().default(100), // 85折即 85
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (t) => ({
  tenantIdx: index('p_tier_tenant_idx').on(t.tenantId),
}));
