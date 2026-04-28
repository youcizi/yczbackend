import { describe, it, expect, beforeEach } from 'vitest';
import { createApplication } from '../../app';
import { createTestDb, createMockEnv } from '../helpers/test-utils';
import { passwordHasher } from '../../lib/auth';
import { PermissionRegistry } from '../../lib/permission-registry';
import { members } from '../../db/schema';
// @ts-ignore
import membershipApp from '../../plugins/membership/index';

describe('Membership 插件集成测试 (TDD Step 4)', () => {
    let rawDb: any;
    let mockEnv: any;
    let testApp: any;
    let adminCookie: string;

    beforeEach(async () => {
        const testRegistry = new PermissionRegistry();
        testRegistry.initCorePermissions();
        testApp = createApplication(testRegistry);
        
        const testCtx = createTestDb();
        rawDb = testCtx.raw;
        mockEnv = createMockEnv(rawDb);

        const hp = await passwordHasher.hash('admin-pass');
        rawDb.prepare("INSERT INTO admins (id, username, hashed_password) VALUES ('admin-01', 'admin', ?)").run(hp);
        // 关联至预置的 SuperAdmin 角色 (ID: 99)
        rawDb.prepare("INSERT INTO admins_to_roles (admin_id, role_id, tenant_id) VALUES ('admin-01', 99, 0)").run();
        await testRegistry.syncToDb(testCtx.db, false);
        // 显式补齐权限关联
        rawDb.prepare("INSERT OR IGNORE INTO role_permissions (role_id, permission_slug) VALUES (99, 'plugins.manage')").run();

        const loginRes = await testApp.fetch(new Request('http://localhost/api/auth/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin-pass' })
        }), mockEnv);
        adminCookie = loginRes.headers.get('Set-Cookie') || '';

        rawDb.prepare("INSERT INTO plugins (slug, name, is_enabled) VALUES ('membership', 'Membership Plugin', 1)").run();

        // 不再 Mock BINDING_membership，强制触发插件系统的 LOCAL_DISPATCH_REGISTRY 本地降级逻辑

        await testCtx.db.insert(members).values({ id: 'm-api-01', tenantId: 1, email: 'api-test@example.com', passwordHash: 'x' }).run();
    });

    it('1. GET /profile - 验证代理转发与上下文透传', async () => {
        const res = await testApp.fetch(new Request('http://localhost/api/v1/plugins/proxy/membership/profile', {
            headers: { 
                'Cookie': adminCookie,
                'X-Tenant-Id': '1',
                'X-Member-Id': 'm-api-01'
            }
        }), mockEnv);

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.email).toBe('api-test@example.com');
    });

    it('2. POST /internal/calculate-price - 验证内部定价接口', async () => {
        const res = await testApp.fetch(new Request('http://localhost/api/v1/plugins/proxy/membership/internal/calculate-price', {
            method: 'POST',
            headers: { 
                'Cookie': adminCookie,
                'Content-Type': 'application/json',
                'X-Tenant-Id': '1',
                'X-Member-Id': 'm-api-01'
            },
            body: JSON.stringify({ basePrice: 100 })
        }), mockEnv);

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.finalPrice).toBe(100);
    });
});
