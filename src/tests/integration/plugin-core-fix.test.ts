import { describe, it, expect, beforeEach } from 'vitest';
import { createApplication } from '../../app';
import { createTestDb, createMockEnv } from '../helpers/test-utils';
import { PluginService } from '../../services/PluginService';
import { PermissionRegistry } from '../../lib/permission-registry';

describe('Plugin System Core Fix (Step 7)', () => {
    let testCtx: any;
    let mockEnv: any;
    let testApp: any;
    const slug = 'membership';

    beforeEach(async () => {
        const testRegistry = new PermissionRegistry();
        testRegistry.initCorePermissions();
        testApp = createApplication(testRegistry);
        
        testCtx = createTestDb();
        mockEnv = createMockEnv(testCtx.raw);

        // 1. 初始化基础权限到 DB
        await testRegistry.syncToDb(testCtx.db, false);
        
        // 2. 模拟登记插件
        await PluginService.registerPluginManually(testCtx.db, {
            slug,
            name: 'Membership Test',
            description: 'Test TDD'
        });
    });

    it('Should persist enabled status in Drizzle/D1 as boolean', async () => {
        const db = testCtx.db;
        
        // 1. 初始状态为禁用
        let p = await PluginService.checkPluginStatus(db, slug);
        expect(p?.isEnabled).toBe(false);

        // 2. 调用开启接口
        const res = await testApp.fetch(new Request(`http://localhost/api/v1/plugins/admin/toggle`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Test-Bypass': 'true' 
            },
            body: JSON.stringify({ slug, enabled: true })
        }), mockEnv);
        
        expect(res.status).toBe(200);

        // 3. 再次校验状态
        p = await PluginService.checkPluginStatus(db, slug);
        expect(p?.isEnabled).toBe(true);
    });

    it('Should return dynamic menus via /api/v1/plugins/menu (404 FIX)', async () => {
        const db = testCtx.db;
        
        // 1. 开启插件
        await PluginService.togglePlugin(db, slug, true);

        // 2. 请求菜单 (注意：此路由已被移出 admin 分支，不需要管理权限)
        const res = await testApp.fetch(new Request('http://localhost/api/v1/plugins/menu'), mockEnv);
        expect(res.status).toBe(200);
        
        const { data } = await res.json();
        const membershipMenu = data.find((m: any) => m.slug === slug);
        expect(membershipMenu).toBeDefined();
        expect(membershipMenu.title).toBe('会员管理');
    });

    it('Should proxy RPC requests even after recent logic restructuring', async () => {
        const db = testCtx.db;
        
        // 1. 开启插件
        await PluginService.togglePlugin(db, slug, true);

        // 2. 代理转发测试
        const res = await testApp.fetch(new Request('http://localhost/api/v1/plugins/proxy/membership/profile', {
            headers: {
                'X-Test-Bypass': 'true'
            }
        }), mockEnv);

        // 状态码不应为 404 (说明找到了路由并转发)
        expect(res.status).not.toBe(404);
    });
});
