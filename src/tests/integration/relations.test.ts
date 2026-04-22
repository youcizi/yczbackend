import { describe, it, expect, beforeEach } from 'vitest';
import { createApplication } from '../../app';
import { PermissionRegistry } from '../../lib/permission-registry';
import { createTestDb, createMockEnv } from '../helpers/test-utils';
import { passwordHasher } from '../../lib/auth';

describe('Relation 关联完整性集成测试', () => {
  let mockEnv: any;
  let rawDb: any;
  let testApp: any;
  let adminCookie: string;
  let testRegistry: PermissionRegistry;

  beforeEach(async () => {
    testRegistry = new PermissionRegistry();
    testRegistry.initCorePermissions();
    testApp = createApplication(testRegistry);

    const testCtx = createTestDb();
    rawDb = testCtx.raw;
    mockEnv = createMockEnv(rawDb);
    mockEnv.DEFAULT_ADMIN_PASSWORD = 'password-must-be-long-123';

    // 预设管理员
    const hp = await passwordHasher.hash('pass');
    rawDb.prepare("INSERT INTO admins (id, username, hashed_password) VALUES ('a1', 'admin', ?)").run(hp);
    rawDb.prepare("REPLACE INTO roles (id, name, scope) VALUES (1, 'SuperAdmin', 'system')").run();
    rawDb.prepare("REPLACE INTO admins_to_roles (admin_id, role_id, tenant_id) VALUES ('a1', 1, 0)").run();
    rawDb.prepare("REPLACE INTO role_permissions (role_id, permission_slug) VALUES (1, 'all')").run();

    const loginRes = await testApp.fetch(new Request('http://localhost/api/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'pass' })
    }), mockEnv);
    adminCookie = loginRes.headers.get('Set-Cookie') || '';

    // 初始化模型和集合
    // 1. Tag 模型
    rawDb.prepare("INSERT INTO models (id, name, slug, fields_json) VALUES (10, 'TagM', 'tag_m', '[{\"name\":\"name\",\"type\":\"text\"}]')").run();
    rawDb.prepare("INSERT INTO collections (id, name, slug, model_id) VALUES (10, 'Tags', 'tags', 10)").run();
    
    // 2. Post 模型 (含关联)
    const postFields = [
      { name: 'title', type: 'text' },
      { name: 'tagId', type: 'relation', relationConfig: { collectionSlug: 'tags', displayField: 'name' } }
    ];
    rawDb.prepare("INSERT INTO models (id, name, slug, fields_json) VALUES (11, 'PostM', 'post_m', ?)").run(JSON.stringify(postFields));
    rawDb.prepare("INSERT INTO collections (id, name, slug, model_id) VALUES (11, 'Posts', 'posts', 11)").run();
    
    // 注入权限
    const perms = [
      { slug: 'collection:tags:view', name: 'v_tag', permCategory: 'C' },
      { slug: 'collection:tags:edit', name: 'e_tag', permCategory: 'C' },
      { slug: 'collection:posts:view', name: 'v_post', permCategory: 'C' },
      { slug: 'collection:posts:edit', name: 'e_post', permCategory: 'C' }
    ];
    for(const p of perms) {
      testRegistry.register(p);
      rawDb.prepare("INSERT INTO permissions (slug, name, perm_category) VALUES (?, ?, ?)").run(p.slug, p.name, p.permCategory);
    }
  });

  it('Scenario: 跨集合关联创建与自动展示逻辑', async () => {
    // 1. 创建 Tag
    const tagRes = await testApp.fetch(new Request('http://localhost/api/v1/entities/tags', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
       body: JSON.stringify({ name: 'Vue.js' })
    }), mockEnv);
    const tag = await tagRes.json();

    // 2. 创建 Post 关联此 Tag
    const postRes = await testApp.fetch(new Request('http://localhost/api/v1/entities/posts', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
       body: JSON.stringify({ title: 'Vue 3 Guide', tagId: tag.id })
    }), mockEnv);
    expect(postRes.status).toBe(200);

    // 3. 验证列表转译
    const listRes = await testApp.fetch(new Request('http://localhost/api/v1/entities/posts', {
       headers: { 'Cookie': adminCookie }
    }), mockEnv);
    const list = await listRes.json();
    const item = list.data[0];
    expect(item.tagId).toBe(tag.id);
    expect(item._displayValues.tagId).toBe('Vue.js');
  });
});
