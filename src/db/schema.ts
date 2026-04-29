import { sqliteTable, text, integer, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core';
import { users } from './schema/users';
export * from './schema/users';
export * from './schema/members';
export * from './schema/inquiries';

// ============================================================================
// [PLUGIN SCHEMAS] - 插件专属 Schema 挂载点 (由脚本自动生成，请勿手动修改)
// ============================================================================
export * from './auto-schema.gen';

/**
 * 站点配置表
 */
export const sites = sqliteTable('sites', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  domain: text('domain').unique().notNull(),
  status: text('status', { enum: ['active', 'inactive'] }).default('active'),
  // 视觉布局数据 (Sections, Blocks, Themes)
  themeData: text('theme_data', { mode: 'json' }).$type<{
    sections: any[];
    global_styles: Record<string, any>;
  }>(),
  // 运行配置 (SEO, Social, Analytics)
  siteConfig: text('site_config', { mode: 'json' }).$type<Record<string, any>>(),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

/**
 * 系统全局设置 (API Keys, 系统参数)
 */
export const systemSettings = sqliteTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
});

/**
 * 后端角色表
 */
export const roles = sqliteTable('roles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').unique().notNull(),
  scope: text('scope', { enum: ['system', 'tenant'] }).default('tenant'), // system: 全局/系统级 | tenant: 租户/商户级
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

/**
 * 后端权限条目表 (SlugBased)
 */
export const permissions = sqliteTable('permissions', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  permCategory: text('perm_category'), // 所属模块归类
  pluginSlug: text('plugin_slug'),     // 逻辑归属：null 代表核心系统 | slug 代表所属插件
});

/**
 * 角色 - 权限关联表
 */
export const rolePermissions = sqliteTable('role_permissions', {
  roleId: integer('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionSlug: text('permission_slug').notNull().references(() => permissions.slug, { onDelete: 'cascade' }),
}, (t) => ({
  pk: [t.roleId, t.permissionSlug],
}));

/**
 * 管理员 - 角色分配表 (多对多)
 */
export const adminsToRoles = sqliteTable('admins_to_roles', {
  adminId: text('admin_id').notNull().references(() => admins.id, { onDelete: 'cascade' }),
  roleId: integer('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  tenantId: integer('tenant_id').notNull().default(0), // 0 代表系统全局或默认租户
}, (t) => ({
  pk: [t.adminId, t.roleId, t.tenantId],
}));

/**
 * 管理员 - 站点管辖控制表
 */
export const adminSiteAccess = sqliteTable('admin_site_access', {
  adminId: text('admin_id').notNull().references(() => admins.id, { onDelete: 'cascade' }),
  siteId: integer('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: [t.adminId, t.siteId],
}));

/**
 * 管理员业务表 (Extended Profile)
 */
export const admins = sqliteTable('admins', {
  id: text('id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  username: text('username').unique().notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

/**
 * 管理员会话表
 */
export const adminSessions = sqliteTable('admin_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => admins.id),
  expiresAt: integer('expires_at').notNull(),
});

/**
 * 会员会话表
 */
export const memberSessions = sqliteTable('member_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => members.id),
  expiresAt: integer('expires_at').notNull(),
});

/**
 * 动态模型定义表
 */
export const models = sqliteTable('models', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(), // 用于权限名和路由名，例: 'product'
  fieldsJson: text('fields_json', { mode: 'json' }).$type<{
    name: string;
    type: string;
    label: string;
    placeholder?: string;
    required?: boolean;
    options?: any[]; // 用于 Select 等类型
  }[]>().notNull(),
  description: text('description'),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

/**
 * 业务集合定义表 (Collections)
 * 本表将模型实例化。例如：模型是“文章”，集合可以是“博客”或“教程”。
 */
export const collections = sqliteTable('collections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  modelId: integer('model_id').notNull().references(() => models.id, { onDelete: 'cascade' }),
  description: text('description'),
  icon: text('icon').default('Layers'), // 侧边栏图标
  sort: integer('sort').default(0),      // 排序权重
  menuGroup: text('menu_group'),         // 多级菜单分组
  menuOrder: integer('menu_order').default(0), // 菜单内置排序
  parentId: integer('parent_id').references((): any => collections.id), // 父级集合ID (树形结构)
  relationSettings: text('relation_settings', { mode: 'json' }).$type<Record<string, { targetCollectionSlug: string; displayField: string }>>(),
  fieldConfig: text('field_config', { mode: 'json' }).$type<Record<string, any>>(),
  permissionConfig: text('permission_config', { mode: 'json' }).$type<Record<string, {
    canView?: boolean;
    canCreate?: boolean; 
    canUpdate?: boolean;
    canDelete?: boolean;
    ownerOnly?: boolean; // 记录级隔离开关
  }>>(),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

/**
 * 动态实体数据表
 * 数据现在关联至具体的 Collection (集合)，而不是直接关联 Model。
 */
export const entities = sqliteTable('entities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  collectionId: integer('collection_id').notNull().references(() => collections.id, { onDelete: 'cascade' }),
  dataJson: text('data_json', { mode: 'json' }).$type<Record<string, any>>().notNull(),
  locale: text('locale').default('en-US'), // 语种编码 (默认 en-US)
  translationGroup: text('translation_group'), // 翻译组 ID (UUID)
  createdBy: text('created_by'), // 关联管理员 ID
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
});

/**
 * 语言管理字典表
 */
export const languages = sqliteTable('languages', {
  code: text('code').primaryKey(), // 唯一编码, 如 'zh-CN', 'en-US'
  name: text('name').notNull(),    // 语言名称
  status: text('status', { enum: ['active', 'inactive'] }).default('active'),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

/**
 * 独立媒体资源表 (脱离模型引擎)
 */
export const mediaItems = sqliteTable('media_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  url: text('url').notNull(),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  isRemote: integer('is_remote', { mode: 'boolean' }).default(false),
  createdBy: text('created_by'),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

/**
 * 插件元数据表
 */
export const plugins = sqliteTable('plugins', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').unique().notNull(), // 用于服务绑定识别及路由
  name: text('name').notNull(),
  config: text('config', { mode: 'json' }).$type<Record<string, any>>(), // 插件私有配置
  configSchema: text('config_schema', { mode: 'json' }).$type<Record<string, any>>(), // 插件配置约束 (可选)
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
});
