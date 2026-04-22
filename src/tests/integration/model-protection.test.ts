import { describe, it, expect, beforeEach } from 'vitest';
import { createApplication } from '../../app';
import { PermissionRegistry } from '../../lib/permission-registry';
import { createTestDb, createMockEnv } from '../helpers/test-utils';
import { passwordHasher } from '../../lib/auth';

describe('Model Protection 深度校验审计', () => {
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
    rawDb.prepare("REPLACE INTO roles (id, name, scope) VALUES (1, 'SuperAdmin', 'system')").run();
    rawDb.prepare("REPLACE INTO admins_to_roles (admin_id, role_id, tenant_id) VALUES ('a1', 1, 0)").run();
    rawDb.prepare("REPLACE INTO role_permissions (role_id, permission_slug) VALUES (1, 'all')").run();

    const loginRes = await testApp.fetch(new Request('http://localhost/api/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'pass' })
    }), mockEnv);
    adminCookie = loginRes.headers.get('Set-Cookie') || '';
  });

  it('验证模型在包含数据时禁止修改字段类型', async () => {
    // 1. 创建模型
    const mRes = await testApp.fetch(new Request('http://localhost/api/v1/rbac/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ name: 'M1', slug: 'm1', fieldsJson: [{ name: 'f1', type: 'text' }] })
    }), mockEnv);
    const model = await mRes.json();

    // 2. 创建集合并插入数据
    rawDb.prepare("INSERT INTO collections (id, name, slug, model_id) VALUES (1, 'C1', 'c1', ?)").run(model.id);
    rawDb.prepare("INSERT INTO entities (id, collection_id, data_json) VALUES (1, 1, '{}')").run();

    // 3. 尝试修改字段类型 (应被拦截)
    const patchRes = await testApp.fetch(new Request(`http://localhost/api/v1/rbac/models/${model.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ name: 'M1', fieldsJson: [{ name: 'f1', type: 'number' }] })
    }), mockEnv);

    expect(patchRes.status).toBe(400);
    const err = await patchRes.json();
    expect(err.error).toContain('已有数据，禁止修改');
  });
});
