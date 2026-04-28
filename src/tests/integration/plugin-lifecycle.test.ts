import { describe, it, expect, beforeEach } from 'vitest';
import { createApplication } from '../../app';
import { createTestDb, createMockEnv } from '../helpers/test-utils';
import { PermissionRegistry } from '../../lib/permission-registry';
import { passwordHasher } from '../../lib/auth';

describe('插件生命周期 E2E 验证 (Step 6)', () => {
    let testCtx: any;
    let mockEnv: any;
    let testApp: any;
    let adminToken: string;

    beforeEach(async () => {
        const testRegistry = new PermissionRegistry();
        testRegistry.initCorePermissions();
        testApp = createApplication(testRegistry);
        
        testCtx = createTestDb();
        mockEnv = createMockEnv(testCtx.raw);

        // 1. 预置超级管理员
        const hp = await passwordHasher.hash('admin-pass');
        testCtx.raw.prepare("INSERT INTO admins (id, username, hashed_password) VALUES ('a-lifecycle', 'admin', ?)").run(hp);
        testCtx.raw.prepare("INSERT INTO admins_to_roles (admin_id, role_id, tenant_id) VALUES ('a-lifecycle', 99, 0)").run();
        await testRegistry.syncToDb(testCtx.db, false);
        testCtx.raw.prepare("INSERT OR IGNORE INTO role_permissions (role_id, permission_slug) VALUES (99, 'plugins.manage')").run();

        // 2. 登录获取 Token
        const loginRes = await testApp.fetch(new Request('http://localhost/api/auth/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin-pass' })
        }), mockEnv);
        const { token } = await loginRes.json();
        adminToken = token;
    });

    it('完整生命周期流程：发现 -> 安装 -> 菜单联动 -> 卸载', async () => {
        const headers = { 
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
            'X-Test-Bypass': 'true' // 测试环境下绕过鉴权，直接进入权限校验
        };

        // --- 1. 初始状态检查 (Marketplace) ---
        const availableRes = await testApp.fetch(new Request('http://localhost/api/v1/plugins/admin/available', {
            headers
        }), mockEnv);
        if (availableRes.status !== 200) {
            console.error('Available API failed:', await availableRes.text());
        }
        const available = await availableRes.json();
        const membership = available.data.find((p: any) => p.slug === 'membership');
        expect(membership).toBeDefined();
        expect(membership.isInstalled).toBe(false);

        // --- 2. 初始菜单检查 ---
        const menuBeforeRes = await testApp.fetch(new Request('http://localhost/api/v1/plugins/admin/menu', {
            headers
        }), mockEnv);
        const menuBefore = await menuBeforeRes.json();
        expect(menuBefore.data.find((m: any) => m.slug === 'membership')).toBeUndefined();

        // --- 3. 执行安装 ---
        const installRes = await testApp.fetch(new Request('http://localhost/api/v1/plugins/admin/install', {
            method: 'POST',
            headers,
            body: JSON.stringify({ slug: 'membership' })
        }), mockEnv);
        expect(installRes.status).toBe(200);

        // --- 4. 安装后状态确认 (Marketplace) ---
        const availableAfterRes = await testApp.fetch(new Request('http://localhost/api/v1/plugins/admin/available', {
            headers
        }), mockEnv);
        const availableAfter = await availableAfterRes.json();
        const membershipAfter = availableAfter.data.find((p: any) => p.slug === 'membership');
        expect(membershipAfter.isInstalled).toBe(true);

        // --- 5. 菜单实时联动确认 ---
        const menuAfterRes = await testApp.fetch(new Request('http://localhost/api/v1/plugins/admin/menu', {
            headers
        }), mockEnv);
        const menuAfter = await menuAfterRes.json();
        const menuEntry = menuAfter.data.find((m: any) => m.slug === 'membership');
        expect(menuEntry).toBeDefined();
        expect(menuEntry.path).toContain('/admin/plugins/membership');

        // --- 6. 执行卸载 ---
        const uninstallRes = await testApp.fetch(new Request('http://localhost/api/v1/plugins/admin/uninstall', {
            method: 'DELETE',
            headers,
            body: JSON.stringify({ slug: 'membership' })
        }), mockEnv);
        expect(uninstallRes.status).toBe(200);

        // --- 7. 卸载后菜单消失确认 ---
        const menuFinalRes = await testApp.fetch(new Request('http://localhost/api/v1/plugins/admin/menu', {
            headers
        }), mockEnv);
        const menuFinal = await menuFinalRes.json();
        expect(menuFinal.data.find((m: any) => m.slug === 'membership')).toBeUndefined();
    });
});
