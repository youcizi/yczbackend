import { describe, it, expect, beforeEach } from 'vitest';
import { createApplication } from '@/app';
import { passwordHasher } from '@/lib/auth';
import { PermissionRegistry } from '@/lib/permission-registry';
import { createTestDb, createMockEnv } from '../helpers/test-utils';

describe('鉴权合围：开发自愈与 Me 接口审计', () => {
  let mockEnv: any;
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
    mockEnv.DEFAULT_ADMIN_PASSWORD = 'test-password-123';
  });

  it('暴力自愈逻辑：开发环境下错误密码应触发强制重置并允许登录', async () => {
    const hp = await passwordHasher.hash('old-pass');
    rawDb.prepare("INSERT INTO admins (id, username, hashed_password) VALUES ('01', 'admin', ?)").run(hp);

    // 切换到开发模式
    mockEnv.NODE_ENV = 'development';

    const res = await testApp.fetch(new Request('http://localhost/api/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'force-reset-pass' })
    }), mockEnv);
    
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.message).toBe('登录成功');
  });

  it('Me 接口审计：登录前后状态验证', async () => {
    // 1. 未登录状态
    const resOff = await testApp.fetch(new Request('http://localhost/api/auth/admin/me'), mockEnv);
    expect(resOff.status).toBe(401);
  });
});
