import { describe, it, expect, beforeEach } from 'vitest';
import { createApplication } from '../../app';
import { createTestDb, createMockEnv } from '../helpers/test-utils';
import { passwordHasher } from '../../lib/auth';
import { PermissionRegistry } from '../../lib/permission-registry';

describe('插件配置中心集成测试 (TDD)', () => {
  let db: any;
  let rawDb: any;
  let mockEnv: any;
  let testApp: any;
  let testRegistry: PermissionRegistry;

  beforeEach(async () => {
    testRegistry = new PermissionRegistry();
    testRegistry.initCorePermissions();
    testApp = createApplication(testRegistry);
    
    const testCtx = createTestDb();
    rawDb = testCtx.raw;
    db = testCtx.db;
    mockEnv = createMockEnv(rawDb);

    // 1. 创建超级管理员 (SuperAdmin)
    const adminPass = await passwordHasher.hash('super-pass');
    rawDb.prepare("INSERT OR IGNORE INTO admins (id, username, hashed_password) VALUES ('super-01', 'superadmin', ?)").run(adminPass);
    rawDb.prepare("INSERT OR IGNORE INTO roles (name, scope) VALUES ('SuperAdmin', 'system')").run();
    const superRole = rawDb.prepare("SELECT id FROM roles WHERE name = 'SuperAdmin'").get();
    rawDb.prepare("INSERT OR IGNORE INTO admins_to_roles (admin_id, role_id, tenant_id) VALUES ('super-01', ?, 0)").run(superRole.id);

    // 2. 创建普通管理员 (仅仅有 plugins.manage 权限，但没有 SuperAdmin 角色)
    const managerPass = await passwordHasher.hash('manager-pass');
    rawDb.prepare("INSERT OR IGNORE INTO admins (id, username, hashed_password) VALUES ('manager-01', 'manager', ?)").run(managerPass);
    rawDb.prepare("INSERT OR IGNORE INTO roles (name, scope) VALUES ('PluginManager', 'system')").run();
    const managerRole = rawDb.prepare("SELECT id FROM roles WHERE name = 'PluginManager'").get();
    rawDb.prepare("INSERT OR IGNORE INTO admins_to_roles (admin_id, role_id, tenant_id) VALUES ('manager-01', ?, 0)").run(managerRole.id);

    await testRegistry.syncToDb(db, false);
    rawDb.prepare("INSERT OR IGNORE INTO role_permissions (role_id, permission_slug) VALUES (?, 'plugins.manage')").run(managerRole.id);
    // SuperAdmin 通常拥有所有权限，但在我们的逻辑中，SuperAdmin 角色名本身就是最高权限
  });

  const getLoginCookie = async (username: string, password: string) => {
    const res = await testApp.fetch(new Request('http://localhost/api/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    }), mockEnv);
    return res.headers.get('Set-Cookie') || '';
  };

  it('SuperAdmin 应该能够成功更新插件配置', async () => {
    const cookie = await getLoginCookie('superadmin', 'super-pass');
    
    // 预置插件
    rawDb.prepare("INSERT INTO plugins (slug, name, is_enabled) VALUES ('test-p', 'Test Plugin', 1)").run();
    const plugin = rawDb.prepare("SELECT id FROM plugins WHERE slug = 'test-p'").get();

    const newConfig = { apiKey: 'v4-secret', retryCount: 3 };
    const res = await testApp.fetch(new Request(`http://localhost/api/v1/plugins/${plugin.id}/config`, {
      method: 'PATCH',
      headers: { 
        'Cookie': cookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ config: newConfig })
    }), mockEnv);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // 验证数据库记录
    const updated = rawDb.prepare("SELECT config FROM plugins WHERE id = ?").get(plugin.id);
    expect(JSON.parse(updated.config)).toEqual(newConfig);
  });

  it('普通管理员 (即使有 plugins.manage) 也不允许修改配置', async () => {
    const cookie = await getLoginCookie('manager', 'manager-pass');
    
    rawDb.prepare("INSERT INTO plugins (slug, name, is_enabled) VALUES ('forbidden-p', 'Forbidden', 1)").run();
    const plugin = rawDb.prepare("SELECT id FROM plugins WHERE slug = 'forbidden-p'").get();

    const res = await testApp.fetch(new Request(`http://localhost/api/v1/plugins/${plugin.id}/config`, {
      method: 'PATCH',
      headers: { 
        'Cookie': cookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ config: { some: 'data' } })
    }), mockEnv);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('权限不足');
  });

  it('提交非法的 JSON 数据 (脏数据检测) 应返回 400', async () => {
    const cookie = await getLoginCookie('superadmin', 'super-pass');
    
    rawDb.prepare("INSERT INTO plugins (slug, name, is_enabled) VALUES ('dirty-p', 'Dirty', 1)").run();
    const plugin = rawDb.prepare("SELECT id FROM plugins WHERE slug = 'dirty-p'").get();

    // 提交数组 (虽然是合法 JSON，但不符合我们 Object 的要求)
    const res = await testApp.fetch(new Request(`http://localhost/api/v1/plugins/${plugin.id}/config`, {
      method: 'PATCH',
      headers: { 
        'Cookie': cookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ config: [1, 2, 3] })
    }), mockEnv);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('合法的 JSON 对象');
  });
});
