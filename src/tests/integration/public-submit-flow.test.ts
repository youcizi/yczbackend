import { describe, it, expect, beforeEach } from 'vitest';
import { createApplication } from '../../app';
import { PermissionRegistry } from '../../lib/permission-registry';
import { createTestDb, createMockEnv } from '../helpers/test-utils';

describe('Public Submission Flow Integration Tests', () => {
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
    
    // 配置 NotifyService 可能需要的环境变量但设置为空或测试值
    mockEnv.RESEND_API_KEY = ''; 

    // 初始化模型和集合 (公开提交通常针对 Inquiry)
    rawDb.prepare("REPLACE INTO models (id, name, slug, fields_json) VALUES (50, 'InquiryM', 'inquiry', '[{\"name\":\"name\",\"type\":\"text\"}]')").run();
    const config = JSON.stringify({
      __api_policy: {
        enabled: true,
        allowed_methods: ['submit'],
        security: { allowed_domains: ['*'] },
        field_permissions: { write_whitelist: ['name'] }
      }
    });
    rawDb.prepare("REPLACE INTO collections (id, name, slug, model_id, field_config) VALUES (50, 'Inquiries', 'inquiries', 50, ?)").run(config);
  });

  it('should return 200 even if NotifyService fails', async () => {
    const res = await testApp.fetch(new Request('http://localhost/api/v1/p/submit/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User' })
    }), mockEnv);

    // 即使通知失败，提交也应该是成功的
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});
