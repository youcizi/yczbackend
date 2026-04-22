import { describe, it, expect, beforeEach } from 'vitest';
import { createApplication } from '@/app';
import { passwordHasher } from '@/lib/auth';
import { createTestDb, createMockEnv } from '../helpers/test-utils';
import { PermissionRegistry } from '@/lib/permission-registry';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { schema } from '@/db';

describe('Inquiry 系统架构对齐与安全集成测试', () => {
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
    
    // 1. [Real Identity] 注入站点域名配置，确保 domainDispatcher 链路能跑通
    const siteConfig = {
      id: 1, 
      tenant_id: 1, // 双保险
      main_domain: 'localhost',
      admin_domain: 'admin.localhost',
      api_domain: 'api.localhost',
      public_domains: []
    };
    rawDb.prepare("REPLACE INTO system_settings (key, value) VALUES ('site_domains', ?)").run(JSON.stringify(siteConfig));
    rawDb.prepare("REPLACE INTO sites (id, name, domain) VALUES (1, 'Shop A', 'localhost')").run();
  });

  describe('场景 1: 双轨提交校验 (游客 vs 会员)', () => {
    it('游客模式下提交：member_id 应为 null', async () => {
      const res = await testApp.fetch(new Request('http://admin.localhost/api/v1/p/inquiry', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Host': 'admin.localhost' // 触发真实域意识
        },
        body: JSON.stringify({
          email: 'visitor@guest.com',
          content: 'Hello from guest'
        })
      }), mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.member_bound).toBe(false);

      // 验证数据库底层
      const row = rawDb.prepare("SELECT * FROM inquiries WHERE id = ?").get(data.id);
      expect(row.member_id).toBeNull();
      expect(row.tenant_id).toBe(1);
    });

    it('会员模式下提交：应自动关联当前登录的 member_id', async () => {
      const hp = await passwordHasher.hash('member-pass');
      const memberId = 'm001';
      
      // 1. 模拟会员中心注册记录 (Drizzle 优先)
      rawDb.prepare("INSERT INTO members (id, tenant_id, email, password_hash) VALUES (?, 1, 'member@shop.com', ?)").run(memberId, hp);
      
      // 2. 模拟登录并获取 Cookie
      const loginRes = await testApp.fetch(new Request('http://admin.localhost/api/auth/member/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Host': 'admin.localhost'
        },
        body: JSON.stringify({ email: 'member@shop.com', password: 'member-pass' })
      }), mockEnv);
      
      if (loginRes.status !== 200) {
        const err = await loginRes.json();
        console.error('Login failed:', JSON.stringify(err));
      }
      expect(loginRes.status).toBe(200); // 确保登录成功
      const setCookie = loginRes.headers.get('Set-Cookie') || '';
      const cookie = setCookie.split(';')[0]; // 仅保留 key=value 部分

      // 3. 提交询盘
      const res = await testApp.fetch(new Request('http://admin.localhost/api/v1/p/inquiry', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Cookie': cookie,
          'Host': 'admin.localhost'
        },
        body: JSON.stringify({
          email: 'member@shop.com',
          content: 'Authenticated Inquiry'
        })
      }), mockEnv);

      if (res.status !== 200) {
        const err = await res.json();
        console.error('Inquiry submission failed:', JSON.stringify(err));
      }
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.member_bound).toBe(true);

      // 验证数据库底层关联
      const row = rawDb.prepare("SELECT * FROM inquiries WHERE id = ?").get(data.id);
      expect(row.member_id).toBe(memberId);
    });
  });

  describe('场景 2: 租户隔离安全性审计', () => {
    it('租户 A 的后台管理系统应无法查询到租户 B 的询盘数据', async () => {
       const db = drizzle(rawDb, { schema });
       
       // 1. 准备数据：跨租户的两条询盘 (Drizzle 优先，确保字段映射正确)
       await db.insert(schema.inquiries).values([
         { id: 10, tenantId: 1, email: 'a@1.com', content: 'A content' },
         { id: 11, tenantId: 2, email: 'b@2.com', content: 'B content' }
       ]).run();

       // 2. 设置租户 A 的管理员
       const hp = await passwordHasher.hash('pass');
       await db.insert(schema.admins).values({ id: 'a1', username: 'adminA', hashedPassword: hp }).run();
       await db.insert(schema.adminsToRoles).values({ adminId: 'a1', roleId: 99, tenantId: 1 }).run();

       const login = await testApp.fetch(new Request('http://localhost/api/auth/admin/login', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ username: 'adminA', password: 'pass' })
       }), mockEnv);
       const cookie = login.headers.get('Set-Cookie') || '';

       // 3. 以 A 管理员身份请求列表
       const listRes = await testApp.fetch(new Request('http://admin.localhost/api/v1/crm/inquiries', {
         headers: { 'Cookie': cookie, 'Host': 'localhost' }
       }), mockEnv);
       
       const list = await listRes.json();
       // 验证：列表中仅应包含 tenant_id 为 1 的数据 (id=10)
       expect(list.data.some((i: any) => i.id === 10)).toBe(true);
       expect(list.data.every((i: any) => i.tenantId === 1)).toBe(true);
    });
  });
});
