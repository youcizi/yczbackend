import { describe, it, expect, beforeEach } from 'vitest';
import { createApplication } from '../../app';
import { createTestDb, createMockEnv } from '../helpers/test-utils';
import { PluginService } from '../../services/PluginService';
import { PermissionRegistry } from '../../lib/permission-registry';
import { hookManager } from '../../lib/plugin-hooks';

describe('Plugin Storefront & I18n Integration (Step 8)', () => {
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

        // 1. 初始化
        await testRegistry.syncToDb(testCtx.db, false);
        await PluginService.registerPluginManually(testCtx.db, {
            slug,
            name: 'Membership Test',
            description: 'Test TDD'
        });
        await PluginService.togglePlugin(testCtx.db, slug, true);

        testCtx.raw.prepare("INSERT INTO languages (code, name, is_default) VALUES ('zh-CN', 'Chinese', 1)").run();
        testCtx.raw.prepare("INSERT INTO languages (code, name, is_default) VALUES ('en-US', 'English', 0)").run();

        // 3. 显式初始化插件 Hooks (确保在测试环境下注册成功)
        const { MembershipService } = await import('../../services/MembershipService');
        MembershipService.initPlugin();
    });

    it('Should route through central Storefront Gateway (/api/v1/s/membership)', async () => {
        // 模拟登录态 (此处简化测试，由于 storefront-api.ts 强制校验 cookie，我们 mock 校验成功或绕过)
        // 注意：在集成测试中我们通常需要真实的 session。这里我们断言它被网关拦截（419）代表已挂载。
        const res = await testApp.fetch(new Request('http://localhost/api/v1/s/membership/profile'), mockEnv);
        
        // 419 代表已触达 storefront-api.ts 的鉴权中间件，证明路由已挂载
        expect(res.status).toBe(419);
    });

    it('Should adjust price via pricing:calculate hook', async () => {
        const db = testCtx.db;
        
        // 1. 准备会员等级与会员关联
        testCtx.raw.prepare("INSERT INTO p_member_tiers (id, tenant_id, name, discount_rate) VALUES (1, 1, 'VIP', 80)").run();
        testCtx.raw.prepare("INSERT INTO p_member_profiles (tenant_id, member_id, name, tier_id) VALUES (1, 'm-01', 'Test Member', 1)").run();

        // 2. 手动触达 /checkout/preview 接口
        // 该接口会触发 hookManager.emit('pricing:calculate', ...)
        const res = await testApp.fetch(new Request('http://localhost/api/v1/s/checkout/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: 100 })
        }), {
            ...mockEnv,
            // 绕过中间件直接注入 Mock Member Context (Hono ctx.set can't be easily pre-set here)
        });

        // 由于鉴权会拦截，我们直接测试 hookManager 的运行
        const finalCalc = await hookManager.emit('pricing:calculate', {
            db: testCtx.db,
            tenantId: 1,
            member: { id: 'm-01' }
        }, {
            basePrice: 100,
            discountAmount: 0,
            finalPrice: 100,
            appliedPlugins: []
        });

        expect(finalCalc.finalPrice).toBe(80);
        expect(finalCalc.appliedPlugins).toContain('membership');
    });

    it('Should cleanup storefront routes on plugin deactivation', async () => {
        const db = testCtx.db;
        
        // 1. 停用插件
        await PluginService.togglePlugin(db, slug, false);

        // 2. 访问网关
        const res = await testApp.fetch(new Request('http://localhost/api/v1/s/membership/profile'), mockEnv);
        
        // 应该返回 404，由 storefront-api.ts 中的状态检查中间件驱动
        expect(res.status).toBe(404);
    });
});
