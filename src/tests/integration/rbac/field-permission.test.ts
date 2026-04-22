import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createApplication } from '../../../app';
import { createDbClient } from '../../../db';
import { mediaItems, entities, admins, roles, adminsToRoles } from '../../../db/schema';
import { createTestDb, createMockEnv } from '../../helpers/test-utils';
import { PermissionRegistry } from '../../../lib/permission-registry';

describe('RBAC 深度权限与隔离集成测试 (Stage 6)', () => {
  let app: any;
  let mockEnv: any;
  let rawDb: any;
  let testRegistry: PermissionRegistry;

  beforeEach(async () => {
    // 为每个测试实例化独立的权限注册表
    testRegistry = new PermissionRegistry();
    testRegistry.initCorePermissions();
    app = createApplication(testRegistry);
    
    // 使用统一的测试数据库初始化工具
    const testCtx = createTestDb();
    rawDb = testCtx.raw;
    mockEnv = createMockEnv(rawDb);
  });

  const setupAuth = async (db: any, username: string, roleName: string) => {
    const adminId = `user-${username}`;
    // 适配新 Schema：必须包含 hashedPassword
    await db.insert(admins).values({ id: adminId, username, hashedPassword: 'pass' }).onConflictDoNothing().run();
    
    // 适配新 Schema：admin 与 role 必须通过关联表连接，且处理 roleName 唯一冲突
    await db.insert(roles).values({ name: roleName, scope: roleName === 'SuperAdmin' ? 'system' : 'tenant' })
      .onConflictDoNothing()
      .run();
    
    const role = await db.select().from(roles).where(eq(roles.name, roleName)).get();
    
    await db.insert(adminsToRoles).values({ 
      adminId: adminId, 
      roleId: role.id,
      tenantId: 0 // 系统级默认租户
    }).onConflictDoNothing().run();
    
    return adminId;
  };

  it('模拟 A：普通 Editor 角色删除他人的文件应该被拦截 (403)', async () => {
    const db = await createDbClient(mockEnv.DB);
    const adminId = await setupAuth(db, 'admin_user', 'SuperAdmin');
    const editorId = await setupAuth(db, 'editor_user', 'Editor');

    // 1. 管理员上传一个文件
    const [file] = await db.insert(mediaItems).values({
      url: '/a.jpg', filename: 'a.jpg', mimeType: 'image/jpeg', size: 100, createdBy: adminId
    }).returning();

    // 2. Editor 尝试删除
    const res = await app.fetch(new Request(`http://localhost/api/v1/media/${file.id}`, {
      method: 'DELETE',
      headers: { 'X-Test-Bypass': 'true', 'X-Test-User-ID': editorId } 
    }), mockEnv);

    expect(res.status).toBe(403);
  });

  it('模拟 B：SuperAdmin 角色删除他人的记录应该成功 (Admin 覆盖)', async () => {
    const db = await createDbClient(mockEnv.DB);
    const adminId = await setupAuth(db, 'super', 'SuperAdmin');
    const userA_Id = await setupAuth(db, 'userA', 'Editor');

    // 1. 用户 A 创建一条记录
    const [item] = await db.insert(entities).values({
      collectionId: 1, dataJson: { name: 'secret' }, createdBy: userA_Id
    }).returning();

    // 2. 管理员删除
    const res = await app.fetch(new Request(`http://localhost/api/v1/entities/post/${item.id}`, {
      method: 'DELETE',
      headers: { 'X-Test-Bypass': 'true', 'X-Test-User-ID': adminId }
    }), mockEnv);

    // 预期：Admin 拥有特权，bypass ownership check
    expect(res.status).not.toBe(403); 
  });
});
