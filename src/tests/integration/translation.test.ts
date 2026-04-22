import { describe, it, expect, beforeEach } from 'vitest';
import { createApplication } from '../../app';
import { PermissionRegistry } from '../../lib/permission-registry';
import { createTestDb, createMockEnv } from '../helpers/test-utils';
import { passwordHasher } from '../../lib/auth';

describe('Translation 多语言联动集成测试', () => {
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
    rawDb.prepare("INSERT INTO models (id, name, slug, fields_json) VALUES (1, 'M1', 'm1', '[{\"name\":\"title\",\"type\":\"text\"}]')").run();
    rawDb.prepare("INSERT INTO collections (id, name, slug, model_id) VALUES (1, 'C1', 'c1', 1)").run();
    
    // 初始化语言
    rawDb.prepare("INSERT INTO languages (code, name, is_default, status) VALUES ('en-US', 'English', 1, 'active')").run();
    rawDb.prepare("INSERT INTO languages (code, name, is_default, status) VALUES ('zh-CN', 'Chinese', 0, 'active')").run();
  });

  it('Scenario A: 创建主语言记录产生 translation_group', async () => {
    const res = await testApp.fetch(new Request('http://localhost/api/v1/entities/c1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ title: 'Hello', locale: 'en-US' })
    }), mockEnv);
    
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.translationGroup).toBeDefined();
    expect(data.locale).toBe('en-US');
  });

  it('Scenario B: 创建关联语言记录成功', async () => {
    // 1. 创建英文版
    const res1 = await testApp.fetch(new Request('http://localhost/api/v1/entities/c1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ title: 'Hello', locale: 'en-US' })
    }), mockEnv);
    const en = await res1.json();

    // 2. 创建中文版 (传入同样的 translationGroup)
    const res2 = await testApp.fetch(new Request('http://localhost/api/v1/entities/c1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ title: '你好', locale: 'zh-CN', translationGroup: en.translationGroup })
    }), mockEnv);

    expect(res2.status).toBe(200);
    const zh = await res2.json();
    expect(zh.translationGroup).toBe(en.translationGroup);
    expect(zh.locale).toBe('zh-CN');
  });
});
