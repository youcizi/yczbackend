import { eq } from 'drizzle-orm';
import { admins, roles, permissions, rolePermissions, adminsToRoles, languages } from '../db/schema';
import { createDbClient, schema } from '../db';
import { passwordHasher } from '../lib/auth';
import { initCorePermissions, registry } from '../lib/permission-registry';

/**
 * 种子数据：初始化超级管理员
 */
export const seedAdmin = async (d1: any, password?: string) => {
  const db = await createDbClient(d1);
  
  const username = "admin";
  const pass = password || "admin123";
  const hashedPassword = await passwordHasher.hash(pass);


  console.log("🌱 [Seed] 开始初始化动态 RBAC 系统...");

  // 1. 显式确保 'all' 权限存在 (避免 ON CONFLICT 语法兼容性问题)
  const existingAll = await db.select().from(permissions).where(eq(permissions.slug, 'all')).get();
  if (!existingAll) {
    await db.insert(permissions).values({
      slug: 'all',
      name: '所有权限',
      permCategory: 'core'
    });
    console.log("✅ [Seed] 核心权限 'all' 载入成功");
  }

  // 2. 显式创建/更新超级管理员角色 (ID: 1)
  const existingRole = await db.select().from(roles).where(eq(roles.id, 1)).get();
  if (!existingRole) {
    await db.insert(roles).values({
      id: 1,
      name: 'SuperAdmin',
      description: '系统最高权限组',
      scope: 'system'
    });
    console.log("✅ [Seed] 超级管理员角色 'SuperAdmin' 创建成功");
  }

  // 同步其他动态权限
  initCorePermissions();
  await registry.syncToDb(db, true);

  // 3. 最终绑定关系
  console.log(`🔗 [Seed] 正在绑定 'all' 权限到 SuperAdmin...`);
  const existingRP = await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, 1)).limit(1).get();
  if (!existingRP) {
    await db.insert(rolePermissions).values({
      roleId: 1,
      permissionSlug: 'all'
    }).run();
  }
  console.log("✅ [Seed] 权限绑定完成");

  // 4. 获取或创建管理员账号
  const adminId = "super-admin-01";
  
  // 先尝试按 ID 或用户名查找
  let existingUser = await db.select().from(admins).where(eq(admins.username, username)).get();
  
  if (!existingUser) {
    // 必须同步插入核心认证表和管理员业务表
    await db.batch([
      db.insert(schema.users).values({
        id: adminId,
        tenantId: 0,
        email: 'admin@system.com',
        passwordHash: hashedPassword,
        userType: 'admin',
        status: 'active'
      }).onConflictDoNothing(),
      db.insert(admins).values({
        id: adminId,
        username,
      }).onConflictDoNothing()
    ]);
    existingUser = await db.select().from(admins).where(eq(admins.username, username)).get();
  }

  // 5. 绑定管理员到角色
  if (existingUser) {
    const existingBinding = await db.select().from(adminsToRoles)
      .where(eq(adminsToRoles.adminId, existingUser.id))
      .get();
    if (!existingBinding) {
      await db.insert(adminsToRoles).values({
        adminId: existingUser.id,
        roleId: 1,
        tenantId: 0
      }).run();
    }
  }

  // 6. 初始化默认语种 (en-US, zh-CN)
  console.log("🌍 [Seed] 初始化多语言系统...");
  const langs = [
    { code: 'en-US', name: 'English (US)', isDefault: true, status: 'active' as const },
    { code: 'zh-CN', name: '简体中文', isDefault: false, status: 'active' as const }
  ];
  for (const lang of langs) {
    await db.insert(languages).values(lang).onConflictDoNothing();
  }

  console.log(`✅ [Seed] 超级管理员 [${username}] 初始化成功！`);
  return { username, password: pass };
};
