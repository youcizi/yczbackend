import { eq } from 'drizzle-orm';
import { admins, roles, permissions, rolePermissions, adminsToRoles, languages } from '../db/schema';
import { createDbClient } from '../db';
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

  // 1. 注册并同步核心权限
  initCorePermissions();
  await registry.syncToDb(db);

  // 2. 创建超级管理员角色 (如果不存在)
  let superRole = await db.select().from(roles).where(eq(roles.name, 'SuperAdmin')).get();
  
  if (!superRole) {
    const [inserted] = await db.insert(roles).values({
      name: 'SuperAdmin',
      description: '系统最高权限组'
    }).returning();
    superRole = inserted;
    console.log("✅ [Seed] 创建超级管理员角色成功");
  }

  // 3. 为超级管理员角色绑定 'all' 权限
  await db.insert(rolePermissions).values({
    roleId: superRole.id,
    permissionSlug: 'all'
  }).onConflictDoNothing();

  // 4. 获取或创建管理员账号
  const adminId = "super-admin-01";
  
  // 先尝试按用户名查找
  let existingAdmin = await db.select().from(admins).where(eq(admins.username, username)).get();
  
  if (!existingAdmin) {
    await db.insert(admins).values({
      id: adminId,
      username,
      hashedPassword,
    }).onConflictDoNothing();
    existingAdmin = await db.select().from(admins).where(eq(admins.username, username)).get();
  }

  // 5. 绑定管理员到角色
  if (existingAdmin) {
    await db.insert(adminsToRoles).values({
      adminId: existingAdmin.id,
      roleId: superRole.id,
      tenantId: 0
    }).onConflictDoNothing();
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
