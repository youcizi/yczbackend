import { describe, it, expect, beforeEach } from 'vitest';
import { createApplication } from '../../app';
import { PermissionRegistry } from '../../lib/permission-registry';
import { createTestDb, createMockEnv } from '../helpers/test-utils';
import { passwordHasher } from '../../lib/auth';

describe('Media 独立化系统集成测试 (Phase 6+)', () => {
  let mockEnv: any;
  let rawDb: any;
  let testApp: any;
  let adminCookie: string;
  let testRegistry: PermissionRegistry;

  beforeEach(async () => {
    testRegistry = new PermissionRegistry();
    testRegistry.initCorePermissions();
    testApp = createApplication(testRegistry);

    const testCtx = createTestDb();
    rawDb = testCtx.raw;
    mockEnv = createMockEnv(rawDb);
    mockEnv.DEFAULT_ADMIN_PASSWORD = 'password-must-be-long-123';

    // 预设管理员
    const hp = await passwordHasher.hash('pass');
    rawDb.prepare("INSERT INTO admins (id, username, hashed_password) VALUES ('a1', 'admin', ?)").run(hp);
    rawDb.prepare("REPLACE INTO roles (id, name, scope) VALUES (99, 'SuperAdmin', 'system')").run();
    rawDb.prepare("REPLACE INTO admins_to_roles (admin_id, role_id, tenant_id) VALUES ('a1', 99, 0)").run();
    rawDb.prepare("REPLACE INTO role_permissions (role_id, permission_slug) VALUES (99, 'all')").run();

    const loginRes = await testApp.fetch(new Request('http://localhost/api/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'pass' })
    }), mockEnv);
    const fullCookie = loginRes.headers.get('Set-Cookie') || '';
    // 关键修复：从 Set-Cookie 中提取纯 clean cookie (admin_session=...)，不带 Path, HttpOnly 等属性
    adminCookie = fullCookie.split(';')[0];
    
    // 注入权限
    testRegistry.register({ slug: 'media.manage', name: 'M', permCategory: 'S' });
    rawDb.prepare("REPLACE INTO permissions (slug, name, perm_category) VALUES ('media.manage', 'M', 'S')").run();
    rawDb.prepare("REPLACE INTO role_permissions (role_id, permission_slug) VALUES (99, 'media.manage')").run();
  });

  it('验证 Media 列表导出与权限闭环', async () => {
    const res = await testApp.fetch(new Request('http://localhost/api/v1/media', {
      headers: { 
        'Cookie': adminCookie
      }
    }), mockEnv);
    
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.data)).toBe(true);
  });
});
