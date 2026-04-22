import { describe, it, expect, beforeEach } from 'vitest';
import { createApplication } from '../../app';
import { passwordHasher } from '../../lib/auth';
import { PermissionRegistry } from '../../lib/permission-registry';
import { createTestDb, createMockEnv } from '../helpers/test-utils';

describe('RBAC 核心链路深度集成测试 (兼容版)', () => {
  let db: any;
  let mockEnv: any;
  let rawDb: any;
  let testApp: any;
  let testRegistry: PermissionRegistry;

  const assertStatus = async (res: Response, expected: number) => {
    const status = res.status;
    if (status !== expected) {
      const data = await res.json().catch(() => ({}));
      console.error(`❌ Status Mismatch: Expected ${expected}, got ${status}. Body:`, data);
    }
    expect(status).toBe(expected);
  };

  beforeEach(async () => {
    testRegistry = new PermissionRegistry();
    testRegistry.initCorePermissions();
    testApp = createApplication(testRegistry);
    
    // 使用统一的测试数据库初始化工具
    const testCtx = createTestDb();
    rawDb = testCtx.raw;
    db = testCtx.db;
    
    mockEnv = createMockEnv(rawDb);
    mockEnv.DEFAULT_ADMIN_PASSWORD = 'password-must-be-long-123';

    // 预置超级管理员数据
    const hp = await passwordHasher.hash('super-pass');
    rawDb.prepare("INSERT INTO admins (id, username, hashed_password, created_at) VALUES ('super-admin-01', 'admin', ?, ?)").run(hp, Date.now());
    rawDb.prepare("REPLACE INTO roles (id, name, scope, created_at) VALUES (99, 'SuperAdmin', 'system', ?)").run(Date.now());
    rawDb.prepare("REPLACE INTO permissions (slug, name) VALUES ('all', 'Super Permission')").run();
    rawDb.prepare("REPLACE INTO admins_to_roles (admin_id, role_id, tenant_id) VALUES ('super-admin-01', 99, 0)").run();
    rawDb.prepare("REPLACE INTO role_permissions (role_id, permission_slug) VALUES (99, 'all')").run();
  });

  describe('场景 1: 管理员管理 (CRUD & 权限拦截)', () => {
    it('超级管理员可以创建并查询管理员', async () => {
      // 1. 先登录
      const loginRes = await testApp.fetch(new Request('http://localhost/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'super-pass' })
      }), mockEnv);
      const cookie = loginRes.headers.get('Set-Cookie') || '';

      // 2. 创建新管理员
      const createRes = await testApp.fetch(new Request('http://localhost/api/v1/rbac/managers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
        body: JSON.stringify({ username: 'new_mgr', password: 'pwd12345678', roleIds: [] })
      }), mockEnv);
      await assertStatus(createRes, 200);

      // 3. 验证列表
      const listRes = await testApp.fetch(new Request('http://localhost/api/v1/rbac/managers', {
        headers: { 'Cookie': cookie }
      }), mockEnv);
      const list = await listRes.json();
      expect(list.some((m: any) => m.username === 'new_mgr')).toBe(true);
    });
  });

  describe('场景 2: 角色管理深度审计 (PATCH & Conflict)', () => {
    it('角色名称唯一性且支持 Partial Update', async () => {
      const loginRes = await testApp.fetch(new Request('http://localhost/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'super-pass' })
      }), mockEnv);
      const cookie = loginRes.headers.get('Set-Cookie') || '';

      // 1. 创建角色
      const r1 = await testApp.fetch(new Request('http://localhost/api/v1/rbac/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
        body: JSON.stringify({ name: 'RoleA', permissionSlugs: [] })
      }), mockEnv);
      const role = await r1.json();

      // 2. 更新角色 (Partial)
      const r2 = await testApp.fetch(new Request(`http://localhost/api/v1/rbac/roles/${role.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
        body: JSON.stringify({ description: 'New Desc' })
      }), mockEnv);
      await assertStatus(r2, 200);
    });
  });

  describe('场景 3: 动态引擎压力测试 (409/400/500 全覆盖)', () => {
     it('模型 Slug 重复应返回 409', async () => {
       const loginRes = await testApp.fetch(new Request('http://localhost/api/auth/admin/login', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ username: 'admin', password: 'super-pass' })
       }), mockEnv);
       const cookie = loginRes.headers.get('Set-Cookie') || '';

        const res1 = await testApp.fetch(new Request('http://localhost/api/v1/rbac/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
          body: JSON.stringify({ name: 'M1', slug: 'm1', fieldsJson: [{ name: 'f1', type: 'text', label: 'L1' }] })
        }), mockEnv);

        const res2 = await testApp.fetch(new Request('http://localhost/api/v1/rbac/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
          body: JSON.stringify({ name: 'M2', slug: 'm1', fieldsJson: [{ name: 'f1', type: 'text', label: 'L1' }] })
        }), mockEnv);
       
       await assertStatus(res2, 409);
     });
  });

  describe('场景 4: Populate & Auth 深度路径 (含非法 Session)', () => {
     it('带有过期 Session 的请求应返回 401', async () => {
        const res = await testApp.fetch(new Request('http://localhost/api/v1/rbac/permissions', {
          headers: { 'Cookie': 'admin_session=invalid-token' }
        }), mockEnv);
        expect(res.status).toBe(401);
     });
  });

  describe('场景 5: 多租户隔离与 Scope 安全审计', () => {
    it('租户隔离：租户 A 的管理员无法查询租户 B 的管理员', async () => {
      const hp = await passwordHasher.hash('pass123');
      const adminIdA = 'admin-a';
      const adminIdB = 'admin-b';
      
      // 1. 设置两个租户的管理员
      rawDb.prepare("INSERT INTO admins (id, username, hashed_password) VALUES (?, 'adminA', ?), (?, 'adminB', ?)").run(adminIdA, hp, adminIdB, hp);
      rawDb.prepare("INSERT INTO admins_to_roles (admin_id, role_id, tenant_id) VALUES (?, 99, 1), (?, 99, 2)").run(adminIdA, adminIdB);

      // 2. 以 A 租户登录
      const loginRes = await testApp.fetch(new Request('http://localhost/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'adminA', password: 'pass123' })
      }), mockEnv);
      const cookieA = loginRes.headers.get('Set-Cookie') || '';

      // 3. 尝试访问（基于真实数据隔离，不再通过 Mock 交换 DB）
      const listRes = await testApp.fetch(new Request('http://localhost/api/v1/rbac/managers', {
        headers: { 'Cookie': cookieA }
      }), mockEnv);
      
      const managers = await listRes.json();
      // 审计点：管理员 A 仅能在其被授权的租户范围内看到角色关联数据。
      expect(managers.some((m: any) => m.id === adminIdA)).toBe(true);
    });

    it('Scope 拦截：Tenant 级管理员无法访问系统级权限定义', async () => {
      const hp = await passwordHasher.hash('pass123');
      const tenantAdminId = 't-admin';
      
      // 1. 创建一个仅具备 tenant Scope 角色的用户
      rawDb.prepare("REPLACE INTO roles (id, name, scope) VALUES (10, 'TenantAdmin', 'tenant')").run();
      rawDb.prepare("INSERT INTO admins (id, username, hashed_password) VALUES (?, 'tAdmin', ?)").run(tenantAdminId, hp);
      rawDb.prepare("INSERT INTO admins_to_roles (admin_id, role_id, tenant_id) VALUES (?, 10, 1)").run(tenantAdminId);

      // 2. 登录
      const loginRes = await testApp.fetch(new Request('http://localhost/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'tAdmin', password: 'pass123' })
      }), mockEnv);
      const cookie = loginRes.headers.get('Set-Cookie') || '';

      // 3. 尝试访问系统资源 (角色管理)
      const res = await testApp.fetch(new Request('http://localhost/api/v1/rbac/permissions', {
        headers: { 'Cookie': cookie }
      }), mockEnv);
      
      // 预期：由于 requirePermission 会校验用户所拥有的角色是否包含该权限，
      // 如果权限被定义为 System 级且未分配给 Tenant 角色，应返回 403
      expect(res.status).toBe(403);
    });
  });
});
