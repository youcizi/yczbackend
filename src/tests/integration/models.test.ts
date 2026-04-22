import { describe, it, expect, beforeEach } from 'vitest';
import { createApplication } from '@/app';
import { passwordHasher } from '@/lib/auth';
import { PermissionRegistry } from '@/lib/permission-registry';
import { createTestDb, createMockEnv } from '../helpers/test-utils';

describe('模型定义层深度校验测试', () => {
  let mockEnv: any;
  let superAdminCookie: string;
  let testApp: any;
  let testRegistry: PermissionRegistry;
  let rawDb: any;

  beforeEach(async () => {
    testRegistry = new PermissionRegistry();
    testRegistry.initCorePermissions();
    testApp = createApplication(testRegistry);

    const testCtx = createTestDb();
    rawDb = testCtx.raw;
    mockEnv = createMockEnv(rawDb);
    mockEnv.DEFAULT_ADMIN_PASSWORD = 'test-password-long-enough';

    // 创建管理员并赋予管理权限
    const hp = await passwordHasher.hash('pass');
    rawDb.prepare("REPLACE INTO roles (id, name, scope) VALUES (1, 'Admin', 'tenant')").run();
    rawDb.prepare("REPLACE INTO permissions (slug, name, perm_category) VALUES ('role.manage', 'RoleManage', 'System')").run();
    rawDb.prepare("REPLACE INTO role_permissions (role_id, permission_slug) VALUES (1, 'role.manage')").run();
    rawDb.prepare("INSERT INTO admins (id, username, hashed_password) VALUES ('a1', 'admin', ?)").run(hp);
    rawDb.prepare("REPLACE INTO admins_to_roles (admin_id, role_id, tenant_id) VALUES ('a1', 1, 0)").run();

    const loginRes = await testApp.fetch(new Request('http://localhost/api/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'pass' })
    }), mockEnv);
    
    expect(loginRes.status).toBe(200);
    superAdminCookie = loginRes.headers.get('Set-Cookie') || '';
  });

  it('非法字段命名拦截验证 (以数字开头)', async () => {
    const res = await testApp.fetch(new Request('http://localhost/api/v1/rbac/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': superAdminCookie },
      body: JSON.stringify({
        name: '错误模型',
        slug: 'bad_model',
        fieldsJson: [{ name: '123title', type: 'text', label: '标题' }]
      })
    }), mockEnv);

    expect(res.status).toBe(400);
    const data: any = await res.json();
    expect(data.error).toBe('模型定义不合法');
    expect(data.details).toContain('必须以字母或下划线开头');
  });

  it('模型 Slug 唯一性验证 (409 Conflict)', async () => {
    const res1 = await testApp.fetch(new Request('http://localhost/api/v1/rbac/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': superAdminCookie },
      body: JSON.stringify({ 
        name: '重复模型', 
        slug: 'duplicate', 
        fieldsJson: [{ name: 'f1', type: 'text', label: 'F1' }] 
      })
    }), mockEnv);
    expect(res1.status).toBe(200);

    const res2 = await testApp.fetch(new Request('http://localhost/api/v1/rbac/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': superAdminCookie },
      body: JSON.stringify({ 
        name: '重复模型2', 
        slug: 'duplicate', 
        fieldsJson: [{ name: 'f1', type: 'text', label: 'F1' }] 
      })
    }), mockEnv);

    expect(res2.status).toBe(409);
  });

  it('权限实时同步验证 (无需重启 Worker)', async () => {
    const slug = 'realtime_sync';
    const createRes = await testApp.fetch(new Request('http://localhost/api/v1/rbac/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': superAdminCookie },
      body: JSON.stringify({ 
        name: '同步测试', 
        slug, 
        fieldsJson: [{ name: 'f1', type: 'text', label: 'F1' }] 
      })
    }), mockEnv);
    expect(createRes.status).toBe(200);

    const res = await testApp.fetch(new Request('http://localhost/api/v1/rbac/permissions', {
      headers: { 'Cookie': superAdminCookie }
    }), mockEnv);

    expect(res.status).toBe(200);
    const perms: any[] = await res.json();
    const slugs = perms.map(p => p.slug);
    
    expect(slugs).toContain(`entity:${slug}:view`);
    expect(slugs).toContain(`entity:${slug}:edit`);
    expect(slugs).toContain(`entity:${slug}:delete`);
  });
});
