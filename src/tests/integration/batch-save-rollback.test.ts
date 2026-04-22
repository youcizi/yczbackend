import { describe, it, expect, beforeEach } from 'vitest';
import { createApplication } from '../../app';
import { PermissionRegistry } from '../../lib/permission-registry';
import { createTestDb, createMockEnv } from '../helpers/test-utils';
import { passwordHasher } from '../../lib/auth';

describe('Batch Save Transaction Rollback Audit', () => {
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

    // 初始化模型和集合
    rawDb.prepare("INSERT INTO models (id, name, slug, fields_json) VALUES (1, 'M1', 'm1', '[{\"name\":\"t\",\"required\":true}]')").run();
    rawDb.prepare("INSERT INTO collections (id, name, slug, model_id) VALUES (1, 'C1', 'c1', 1)").run();
    
    // 注入权限
    testRegistry.register({ slug: 'collection:c1:edit', name: 'e', permCategory: 'C' });
    rawDb.prepare("REPLACE INTO permissions (slug, name, perm_category) VALUES ('collection:c1:edit', 'e', 'C')").run();
    rawDb.prepare("REPLACE INTO role_permissions (role_id, permission_slug) VALUES (1, 'collection:c1:edit')").run();
  });

  it('负向路径：当批量请求中某一项格式损坏时，应全量回滚且不产生脏数据', async () => {
    const payload = {
      items: [
        { t: 'Valid 1' },
        { wrong: 'No T here' }, // 这将导致校验失败
        { t: 'Valid 2' }
      ]
    };

    const res = await testApp.fetch(new Request('http://localhost/api/v1/entities/c1/batch-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify(payload)
    }), mockEnv);

    expect(res.status).toBe(400);

    // 验证事务回滚：数据库中不应有任何记录
    const count = rawDb.prepare("SELECT count(*) as c FROM entities WHERE collection_id = 1").get().c;
    expect(count).toBe(0);
  });
});
