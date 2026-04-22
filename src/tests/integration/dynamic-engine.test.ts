import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createApplication } from '@/app';
import { passwordHasher } from '@/lib/auth';
import { PermissionRegistry } from '@/lib/permission-registry';
import { createTestDb, createMockEnv } from '../helpers/test-utils';
import { admins, roles, adminsToRoles } from '@/db/schema';

describe('E2E: 动态模型引擎全链路测试', () => {
  let mockEnv: any;
  let rawDb: any;
  let superAdminCookie: string;
  let testApp: any;
  let testRegistry: PermissionRegistry;

  beforeEach(async () => {
    testRegistry = new PermissionRegistry();
    testRegistry.initCorePermissions();
    testApp = createApplication(testRegistry);
    
    const testCtx = createTestDb();
    rawDb = testCtx.raw;
    mockEnv = createMockEnv(rawDb);
    mockEnv.DEFAULT_ADMIN_PASSWORD = 'super-password-123';

    // 预设管理员
    const hp = await passwordHasher.hash('super-password-123');
    rawDb.prepare("INSERT INTO admins (id, username, hashed_password) VALUES ('a1', 'super_admin', ?)").run(hp);
    rawDb.prepare("REPLACE INTO roles (id, name, scope) VALUES (99, 'SuperAdmin', 'system')").run();
    rawDb.prepare("REPLACE INTO admins_to_roles (admin_id, role_id, tenant_id) VALUES ('a1', 99, 0)").run();
    rawDb.prepare("REPLACE INTO role_permissions (role_id, permission_slug) VALUES (99, 'all')").run();

    // 2. 登录获取 Cookie
    const loginRes = await testApp.fetch(new Request('http://localhost/api/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'super_admin', password: 'super-password-123' })
    }), mockEnv);
    superAdminCookie = loginRes.headers.get('Set-Cookie') || '';
  });

  it('步骤 A: 创建模型 (定义字段结构)', async () => {
    const res = await testApp.fetch(new Request('http://localhost/api/v1/rbac/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': superAdminCookie },
      body: JSON.stringify({
        name: '文章模型',
        slug: 'post',
        fieldsJson: [
          { name: 'title', type: 'text', label: '标题', required: true },
          { name: 'content', type: 'richtext', label: '正文' },
          { name: 'status', type: 'text', label: '状态' }
        ]
      })
    }), mockEnv);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.slug).toBe('post');
  });

  it('步骤 B: 创建集合 (绑定模型到路径)', async () => {
    // 先创建模型
    const mRes = await testApp.fetch(new Request('http://localhost/api/v1/rbac/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': superAdminCookie },
      body: JSON.stringify({ name: 'M1', slug: 'm1', fieldsJson: [{ name: 'title', type: 'text', label: 'T' }] })
    }), mockEnv);
    const model = await mRes.json();

    const res = await testApp.fetch(new Request('http://localhost/api/v1/rbac/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': superAdminCookie },
      body: JSON.stringify({
        name: '技术博客',
        slug: 'blog',
        modelId: model.id
      })
    }), mockEnv);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.slug).toBe('blog');
  });

  it('步骤 C: 提交有效数据成功', async () => {
    // 准备模型和集合
    rawDb.prepare("INSERT INTO models (id, name, slug, fields_json) VALUES (2, 'M2', 'm2', '[{\"name\":\"t\",\"type\":\"text\",\"required\":true}]')").run();
    rawDb.prepare("INSERT INTO collections (id, name, slug, model_id) VALUES (2, 'C2', 'c2', 2)").run();

    const res = await testApp.fetch(new Request('http://localhost/api/v1/entities/c2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': superAdminCookie },
      body: JSON.stringify({ t: 'Hello Word' })
    }), mockEnv);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.dataJson.t).toBe('Hello Word');
  });

  it('步骤 D: 拦截必填项缺失', async () => {
    rawDb.prepare("INSERT INTO models (id, name, slug, fields_json) VALUES (3, 'M3', 'm3', '[{\"name\":\"req\",\"type\":\"text\",\"required\":true}]')").run();
    rawDb.prepare("INSERT INTO collections (id, name, slug, model_id) VALUES (3, 'C3', 'c3', 3)").run();

    const res = await testApp.fetch(new Request('http://localhost/api/v1/entities/c3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': superAdminCookie },
      body: JSON.stringify({ other: 'val' })
    }), mockEnv);

    expect(res.status).toBe(400);
  });

  it('步骤 E: 验证数据类型不匹配 (Number)', async () => {
    rawDb.prepare("INSERT INTO models (id, name, slug, fields_json) VALUES (4, 'M4', 'm4', '[{\"name\":\"price\",\"type\":\"number\"}]')").run();
    rawDb.prepare("INSERT INTO collections (id, name, slug, model_id) VALUES (4, 'C4', 'c4', 4)").run();

    const res = await testApp.fetch(new Request('http://localhost/api/v1/entities/c4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': superAdminCookie },
      body: JSON.stringify({ price: 'abc' }) // 应拦截字符串
    }), mockEnv);

    expect(res.status).toBe(400);
  });

  it('步骤 F: 验证 JSON 格式校验', async () => {
    rawDb.prepare("INSERT INTO models (id, name, slug, fields_json) VALUES (5, 'M5', 'm5', '[{\"name\":\"config\",\"type\":\"json\"}]')").run();
    rawDb.prepare("INSERT INTO collections (id, name, slug, model_id) VALUES (5, 'C5', 'c5', 5)").run();

    const res = await testApp.fetch(new Request('http://localhost/api/v1/entities/c5', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': superAdminCookie },
      body: JSON.stringify({ config: '{ invalid json' })
    }), mockEnv);

    // 实际上我们在 Service 层通过 JSON.parse 校验，前端传过来的已经是解析后的 Object。
    // 如果传普通字符串给 JSON 字段，应被拦截。
    expect(res.status).toBe(400);
  });

  it('步骤 G: 提交非法 Enum 值应拦截', async () => {
    const fields = [{ name: 'status', type: 'select', options: [{ label: 'A', key: 'a' }] }];
    rawDb.prepare("INSERT INTO models (id, name, slug, fields_json) VALUES (6, 'M6', 'm6', ?)").run(JSON.stringify(fields));
    rawDb.prepare("INSERT INTO collections (id, name, slug, model_id) VALUES (6, 'C6', 'c6', 6)").run();

    const res = await testApp.fetch(new Request('http://localhost/api/v1/entities/c6', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': superAdminCookie },
      body: JSON.stringify({ status: 'illegal' })
    }), mockEnv);

    expect(res.status).toBe(400);
  });

  it('步骤 H: 提交合法 Enum 值成功保存', async () => {
    const fields = [{ name: 'status', type: 'select', options: [{ label: 'A', key: 'a' }] }];
    rawDb.prepare("INSERT INTO models (id, name, slug, fields_json) VALUES (7, 'M7', 'm7', ?)").run(JSON.stringify(fields));
    rawDb.prepare("INSERT INTO collections (id, name, slug, model_id) VALUES (7, 'C7', 'c7', 7)").run();

    const res = await testApp.fetch(new Request('http://localhost/api/v1/entities/c7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': superAdminCookie },
      body: JSON.stringify({ status: 'a' })
    }), mockEnv);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.dataJson.status).toBe('a');
  });
});
