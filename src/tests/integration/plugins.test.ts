import { describe, it, expect, beforeEach } from 'vitest';
import { createApplication } from '../../app';
import { createTestDb, createMockEnv } from '../helpers/test-utils';
import { passwordHasher } from '../../lib/auth';
import { PermissionRegistry } from '../../lib/permission-registry';

describe('插件系统集成测试 (TDD)', () => {
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

    // 预置管理员数据
    const hp = await passwordHasher.hash('admin-pass');
    rawDb.prepare("INSERT INTO admins (id, username, hashed_password) VALUES ('admin-01', 'admin', ?)").run(hp);
    rawDb.prepare("INSERT INTO roles (id, name, scope) VALUES (1, 'PluginManager', 'system')").run();
    rawDb.prepare("INSERT INTO admins_to_roles (admin_id, role_id, tenant_id) VALUES ('admin-01', 1, 0)").run();
    // 确保权限在数据库中
    await testRegistry.syncToDb(db, false);
    rawDb.prepare("INSERT INTO role_permissions (role_id, permission_slug) VALUES (1, 'plugins.manage')").run();
  });

  const getLoginCookie = async (username = 'admin', password = 'admin-pass') => {
    const res = await testApp.fetch(new Request('http://localhost/api/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    }), mockEnv);
    return res.headers.get('Set-Cookie') || '';
  };

  describe('权限边界测试', () => {
    it('非管理员 (Guest) 访问菜单应返回 401', async () => {
      const res = await testApp.fetch(new Request('http://localhost/api/v1/plugins/menu'), mockEnv);
      expect(res.status).toBe(401);
    });

    it('普通管理员如果没有 plugins.manage 权限应返回 403', async () => {
      // 创建一个没有权限的管理员
      const hp = await passwordHasher.hash('guest-pass');
      rawDb.prepare("INSERT INTO admins (id, username, hashed_password) VALUES ('guest-01', 'guest', ?)").run(hp);
      const cookie = await getLoginCookie('guest', 'guest-pass');

      const res = await testApp.fetch(new Request('http://localhost/api/v1/plugins/menu', {
        headers: { 'Cookie': cookie }
      }), mockEnv);
      expect(res.status).toBe(403);
    });

    it('具备权限的管理员可以正常获取菜单', async () => {
      const cookie = await getLoginCookie();
      
      // 插入一些测试插件
      rawDb.prepare("INSERT INTO plugins (slug, name, is_enabled) VALUES ('p1', 'Plugin 1', 1), ('p2', 'Plugin 2', 0)").run();

      const res = await testApp.fetch(new Request('http://localhost/api/v1/plugins/menu', {
        headers: { 'Cookie': cookie }
      }), mockEnv);
      
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].slug).toBe('p1');
    });
  });

  describe('业务逻辑与数据一致性', () => {
    it('检查已启用的插件应返回完整配置 (JSON 解析验证)', async () => {
      const cookie = await getLoginCookie();
      const config = { apiKey: 'secret-key', endpoint: 'https://api.test' };
      
      rawDb.prepare("INSERT INTO plugins (slug, name, is_enabled, config) VALUES (?, ?, ?, ?)").run(
        'digital-worker', 
        '数字员工', 
        1, 
        JSON.stringify(config)
      );

      const res = await testApp.fetch(new Request('http://localhost/api/v1/plugins/check/digital-worker', {
        headers: { 'Cookie': cookie }
      }), mockEnv);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.slug).toBe('digital-worker');
      // 验证 JSON 解析
      expect(body.data.config).toEqual(config);
    });

    it('检查不存在或已禁用的插件应返回 404', async () => {
      const cookie = await getLoginCookie();
      
      // 1. 不存在
      const res1 = await testApp.fetch(new Request('http://localhost/api/v1/plugins/check/none', {
        headers: { 'Cookie': cookie }
      }), mockEnv);
      expect(res1.status).toBe(404);

      // 2. 已禁用
      rawDb.prepare("INSERT INTO plugins (slug, name, is_enabled) VALUES ('disabled-p', 'Disabled', 0)").run();
      const res2 = await testApp.fetch(new Request('http://localhost/api/v1/plugins/check/disabled-p', {
        headers: { 'Cookie': cookie }
      }), mockEnv);
      expect(res2.status).toBe(404);
    });

    it('RPC 代理：成功透传请求至插件 Worker', async () => {
      const cookie = await getLoginCookie();
      
      // 1. 准备插件数据
      rawDb.prepare("INSERT INTO plugins (slug, name, is_enabled) VALUES ('dw', 'Digital Worker', 1)").run();
      
      // 2. 模拟 Service Binding
      mockEnv.BINDING_dw = {
        fetch: async (req: Request) => {
          const url = new URL(req.url);
          if (url.pathname === '/info') {
            return new Response(JSON.stringify({ version: '1.0.0', path: url.pathname }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          return new Response('Not Found', { status: 404 });
        }
      };

      // 3. 发起请求
      const res = await testApp.fetch(new Request('http://localhost/api/v1/plugins/proxy/dw/info', {
        headers: { 'Cookie': cookie }
      }), mockEnv);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.version).toBe('1.0.0');
      expect(body.path).toBe('/info');
    });

    it('RPC 代理：当 Service Binding 缺失时应返回 502', async () => {
      const cookie = await getLoginCookie();
      rawDb.prepare("INSERT INTO plugins (slug, name, is_enabled) VALUES ('missing-b', 'Missing Binding', 1)").run();

      const res = await testApp.fetch(new Request('http://localhost/api/v1/plugins/proxy/missing-b/any', {
        headers: { 'Cookie': cookie }
      }), mockEnv);

      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.error).toContain('插件执行引擎未配置');
    });

    it('管理接口：获取全量插件列表及更新状态', async () => {
      const cookie = await getLoginCookie();
      
      // 1. 预置两个插件 (一个启用，一个禁用)
      rawDb.prepare("INSERT INTO plugins (slug, name, is_enabled) VALUES ('p-all-1', 'P1', 1), ('p-all-2', 'P2', 0)").run();

      // 2. 测试全量获取
      const resGet = await testApp.fetch(new Request('http://localhost/api/v1/plugins', {
        headers: { 'Cookie': cookie }
      }), mockEnv);
      expect(resGet.status).toBe(200);
      const dataGet = await resGet.json();
      expect(dataGet.data).toHaveLength(2);

      // 3. 测试状态更新 (将 P2 启用)
      const p2 = dataGet.data.find((p: any) => p.slug === 'p-all-2');
      const resPatch = await testApp.fetch(new Request(`http://localhost/api/v1/plugins/${p2.id}`, {
        method: 'PATCH',
        headers: { 
          'Cookie': cookie,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isEnabled: true })
      }), mockEnv);
      expect(resPatch.status).toBe(200);

      // 4. 验证更新结果
      const resCheck = await testApp.fetch(new Request('http://localhost/api/v1/plugins/check/p-all-2', {
        headers: { 'Cookie': cookie }
      }), mockEnv);
      const dataCheck = await resCheck.json();
      expect(dataCheck.data.isEnabled).toBe(true);
    });
  });
});
