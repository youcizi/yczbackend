import { describe, it, expect, beforeEach } from 'vitest';
import { createApplication } from '../../app';
import { createTestDb, createMockEnv } from '../helpers/test-utils';
import { passwordHasher } from '../../lib/auth';
import { PermissionRegistry } from '../../lib/permission-registry';
// @ts-ignore
import { PluginService } from '../../services/PluginService';

describe('插件挂载与可见性 E2E 测试 (TDD Step 5)', () => {
  let db: any;
  let rawDb: any;
  let mockEnv: any;
  let testApp: any;
  let adminCookie: string;

  beforeEach(async () => {
    const testRegistry = new PermissionRegistry();
    testRegistry.initCorePermissions();
    testApp = createApplication(testRegistry);
    
    const testCtx = createTestDb();
    db = testCtx.db;
    rawDb = testCtx.raw;
    mockEnv = createMockEnv(rawDb);

    // 预置管理员
    const hp = await passwordHasher.hash('admin-pass');
    rawDb.prepare("INSERT INTO admins (id, username, hashed_password) VALUES ('admin-01', 'admin', ?)").run(hp);
    // 关联至预置的 SuperAdmin 角色 (ID: 99)
    rawDb.prepare("INSERT INTO admins_to_roles (admin_id, role_id, tenant_id) VALUES ('admin-01', 99, 0)").run();
    await testRegistry.syncToDb(db, false);

    const loginRes = await testApp.fetch(new Request('http://localhost/api/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin-pass' })
    }), mockEnv);
    adminCookie = loginRes.headers.get('Set-Cookie') || '';
  });

  it('1. 自动注册审计：Service 应能正确向数据库持久化插件元数据', async () => {
    // 此处 registerPlugin 尚未实现，测试将因 ReferenceError 失败
    await PluginService.registerPlugin(db, {
      slug: 'membership',
      name: '会员系统',
      description: '统一会员画像与等级定价引擎'
    });

    const res = await testApp.fetch(new Request('http://localhost/api/v1/plugins', {
      headers: { 'Cookie': adminCookie }
    }), mockEnv);
    
    const body = await res.json();
    const membership = body.data.find((p: any) => p.slug === 'membership');
    
    expect(membership).toBeDefined();
    expect(membership.isEnabled).toBe(true);
  });

  it('2. 侧边栏挂载：通过侧边栏接口展示插件入口', async () => {
    await PluginService.registerPlugin(db, { slug: 'membership', name: '会员系统' });

    const res = await testApp.fetch(new Request('http://localhost/api/v1/plugins/menu', {
      headers: { 'Cookie': adminCookie }
    }), mockEnv);
    
    const body = await res.json();
    const hasMenu = body.data.some((m: any) => m.path.includes('/membership'));
    expect(hasMenu).toBe(true);
  });
});
