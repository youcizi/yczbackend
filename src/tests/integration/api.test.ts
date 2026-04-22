import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createApplication } from '@/app';
import { passwordHasher } from '@/lib/auth';
import { PermissionRegistry } from '@/lib/permission-registry';
import { createTestDb, createMockEnv } from '../helpers/test-utils';
import { admins } from '@/db/schema';

describe('API 集成测试', () => {
  let mockEnv: any;
  let rawDb: any;
  let testApp: any;
  let testRegistry: PermissionRegistry;

  beforeEach(async () => {
    testRegistry = new PermissionRegistry();
    testRegistry.initCorePermissions();
    testApp = createApplication(testRegistry);

    const testCtx = createTestDb();
    rawDb = testCtx.raw;
    mockEnv = createMockEnv(rawDb);
    mockEnv.DEFAULT_ADMIN_PASSWORD = 'test-password-seed-123';
    
    const hashedPassword = await passwordHasher.hash('test-password-123');
    rawDb.prepare('INSERT INTO admins (id, username, hashed_password) VALUES (?, ?, ?)')
      .run('test-admin-id', 'test_tester', hashedPassword);
  });

  it('POST /api/auth/admin/login - 成功登录应返回 Set-Cookie', async () => {
    const res = await testApp.fetch(
      new Request('http://localhost/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'test_tester', password: 'test-password-123' }),
      }),
      mockEnv
    );

    expect(res.status).toBe(200);
    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toContain('admin_session');
  });

  it('GET /api/v1/rbac/permissions - 未认证用户应被 401 拦截', async () => {
    const res = await testApp.fetch(
      new Request('http://localhost/api/v1/rbac/permissions'),
      mockEnv
    );
    expect(res.status).toBe(401); 
  });

  it('登录信息错误时应返回 401', async () => {
    const res = await testApp.fetch(
      new Request('http://localhost/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'test_tester', password: 'wrong-password' }),
      }),
      mockEnv
    );

    expect(res.status).toBe(401);
  });
});
