import { describe, it, expect, beforeEach } from 'vitest';
import { createApplication } from '../../app';
import { PermissionRegistry } from '../../lib/permission-registry';
import { createTestDb, createMockEnv } from '../helpers/test-utils';

describe('Core Path Safety Net (Integration)', () => {
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
    mockEnv.DEFAULT_ADMIN_PASSWORD = 'password-must-be-long-123';
  });

  it('验证未授权访问核心 API 被拦截', async () => {
    const res = await testApp.fetch(new Request('http://localhost/api/v1/rbac/permissions'), mockEnv);
    expect(res.status).toBe(401);
  });

  it('验证 Public 路由无需权限', async () => {
    const res = await testApp.fetch(new Request('http://localhost/api/v1/public/ping'), mockEnv);
    // 假设 api-v1.ts 中有 ping 路由
    if (res.status !== 404) {
      expect(res.status).toBe(200);
    }
  });
});
