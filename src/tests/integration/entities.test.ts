import { describe, it, expect, beforeEach } from 'vitest';
import { createApplication } from '../../app';
import { passwordHasher } from '../../lib/auth';
import { PermissionRegistry } from '../../lib/permission-registry';
import { CollectionTestFactory } from '../helpers/CollectionTestFactory';
import { ModelField } from '../../lib/model-engine';
import { createTestDb, createMockEnv } from '../helpers/test-utils';

describe('动态模型与内容管理全链路参数化审计', () => {
  let db: any;
  let mockEnv: any;
  let rawDb: any;
  let adminCookie: string;
  let factory: CollectionTestFactory;
  let testRegistry: PermissionRegistry;
  let testApp: any;

  // 定义不同的测试场景 (参数化核心)
  const testCases = [
    {
      name: '基础模型 (仅文本)',
      slug: 'basic_post',
      fields: [
        { name: 'title', type: 'text' as const, label: '标题', required: true }
      ]
    },
    {
      name: '复杂约束模型 (多类型)',
      slug: 'complex_product',
      fields: [
        { name: 'name', type: 'text' as const, label: '名称', required: true },
        { name: 'price', type: 'number' as const, label: '价格', required: true },
        { name: 'meta', type: 'json' as const, label: '元数据' }
      ]
    },
    {
       name: '关联模型 (Choice B 自愈验证)',
       slug: 'article',
       targetSlug: 'category',
       fields: [
         { name: 'subject', type: 'text' as const, label: '主题', required: true },
         { 
           name: 'categoryId', 
           type: 'relation' as const, 
           label: '分类', 
           required: true,
           relationConfig: { collectionSlug: 'category', displayField: 'name' }
         }
       ]
    },
    {
       name: 'V2.0 增强复合场景 (多图+复杂JSON)',
       slug: 'v2_complex',
       fields: [
         { name: 'gallery', type: 'image' as const, label: '作品集', multiple: true },
         { name: 'config', type: 'json' as const, label: '高级配置', required: true },
         { name: 'content', type: 'richtext' as const, label: '正文详情' }
       ]
    }
  ];

  beforeEach(async () => {
    testRegistry = new PermissionRegistry();
    testRegistry.initCorePermissions();
    testApp = createApplication(testRegistry);

    const testCtx = createTestDb();
    rawDb = testCtx.raw;
    db = testCtx.db;
    mockEnv = createMockEnv(rawDb);
    mockEnv.DEFAULT_ADMIN_PASSWORD = 'test-password-must-be-long';

    // 创建管理员并登录
    const hashedPassword = await passwordHasher.hash('admin-pass');
    rawDb.prepare("INSERT INTO admins (id, username, hashed_password) VALUES ('admin-01', 'admin', ?)").run(hashedPassword);
    rawDb.prepare("REPLACE INTO roles (id, name, scope) VALUES (99, 'SuperAdmin', 'system')").run();
    rawDb.prepare("REPLACE INTO admins_to_roles (admin_id, role_id, tenant_id) VALUES ('admin-01', 99, 0)").run();
    
    // 给 SuperAdmin 注入 '*' (all) 权限
    const allPerm = { slug: 'all', name: 'Super', permCategory: 'System' };
    testRegistry.register(allPerm);
    rawDb.prepare("REPLACE INTO permissions (slug, name, perm_category) VALUES (?, ?, ?)").run(allPerm.slug, allPerm.name, allPerm.permCategory);
    rawDb.prepare("REPLACE INTO role_permissions (role_id, permission_slug) VALUES (99, 'all')").run();

    const loginRes = await testApp.fetch(new Request('http://localhost/api/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin-pass' })
    }), mockEnv);
    adminCookie = loginRes.headers.get('Set-Cookie') || '';
    factory = new CollectionTestFactory(testApp, mockEnv, adminCookie);
  });

  describe.each(testCases)('参数化场景审计: $name', ({ slug, fields, targetSlug }) => {
    
    beforeEach(async () => {
      // 预设目标集合
      if (targetSlug) {
        rawDb.prepare("INSERT OR IGNORE INTO models (id, name, slug, fields_json) VALUES (99, 'TargetModel', ?, '[{\"name\":\"name\",\"type\":\"text\"}]')").run(`${targetSlug}_model`);
        rawDb.prepare("INSERT OR IGNORE INTO collections (id, name, slug, model_id, relation_settings) VALUES (99, 'TargetCollection', ?, 99, '{}')").run(targetSlug);
        await CollectionTestFactory.setupPermissions(rawDb, targetSlug, testRegistry);
      }

      // 预设主模型与集合
      rawDb.prepare("INSERT OR IGNORE INTO models (id, name, slug, fields_json) VALUES (1000, ?, ?, ?)").run(`${slug}_model`, `${slug}_model`, JSON.stringify(fields));
      rawDb.prepare("INSERT OR IGNORE INTO collections (name, slug, model_id, relation_settings) VALUES (?, ?, 1000, '{}')").run(slug, slug);
      
      // 动态注册权限
      await CollectionTestFactory.setupPermissions(rawDb, slug, testRegistry);
    });

    it(`[${slug}] CRUD: 可以成功创建、查询、更新和删除记录`, async () => {
      const payload = factory.generateValidPayload(fields);
      for (const field of fields) {
        if (field.type === 'relation') {
          payload[field.name] = await factory.setupRelationDependency(field);
        }
      }

      const createRes = await factory.create(slug, payload);
      expect(createRes.status).toBe(200);
      const newRecord = await createRes.json();
      expect(newRecord.id).toBeDefined();

      const listRes = await factory.list(slug);
      const listData = await listRes.json();
      expect(listData.data.some((r: any) => r.id === newRecord.id)).toBe(true);

      const updatePayload = factory.generateValidPayload(fields);
      for (const field of fields) { if (field.type === 'relation') updatePayload[field.name] = payload[field.name]; }
      
      const updateRes = await factory.update(slug, newRecord.id, updatePayload);
      expect(updateRes.status).toBe(200);

      const deleteRes = await factory.delete(slug, newRecord.id);
      expect(deleteRes.status).toBe(200);
    });

    it(`[${slug}] 拦截验证: 缺失必填字段应返回 400`, async () => {
      const requiredFields = fields.filter(f => f.required);
      if (requiredFields.length === 0) return;

      const targetField = requiredFields[0];
      const invalidPayload = factory.generateInvalidPayload(fields, targetField.name, 'required');

      const res = await factory.create(slug, invalidPayload);
      expect(res.status).toBe(400);
    });
  });

  describe('基础稳定性与错误边界', () => {
    it('权限拦截: 无 Cookie 的请求应返回 401', async () => {
        // 创建一个临时集合以确保路径存在
        rawDb.prepare("REPLACE INTO models (id, name, slug, fields_json) VALUES (999, 'M', 'm', '[]')").run();
        rawDb.prepare("REPLACE INTO collections (id, name, slug, model_id) VALUES (999, 'C', 'p', 999)").run();
        
        const res = await testApp.fetch(new Request('http://localhost/api/v1/entities/p'), mockEnv);
        expect(res.status).toBe(401);
    });
  });

  describe('业务集合级动态关联专项审计 (Depth: 1)', () => {
    const slug = 'dynamic_article';
    const targetSlug = 'dynamic_category';
    const fields: ModelField[] = [
      { name: 'title', type: 'text' as const, label: '标题', required: true },
      { name: 'categoryId', type: 'text' as const, label: '分类ID' }
    ];
    const relationSettings = {
      categoryId: { targetCollectionSlug: targetSlug, displayField: 'name' }
    };

    beforeEach(async () => {
      rawDb.prepare("INSERT INTO models (id, name, slug, fields_json) VALUES (2000, 'CatModel', 'cat_model', '[{\"name\":\"name\",\"type\":\"text\"}]')").run();
      rawDb.prepare("INSERT INTO collections (id, name, slug, model_id) VALUES (200, '分类库', ?, 2000)").run(targetSlug);
      
      rawDb.prepare("INSERT INTO models (id, name, slug, fields_json) VALUES (2001, 'ArtModel', 'art_model', ?)").run(JSON.stringify(fields));
      rawDb.prepare("INSERT INTO collections (id, name, slug, model_id, relation_settings) VALUES (201, '动态文章', ?, 2001, ?)").run(slug, JSON.stringify(relationSettings));

      await CollectionTestFactory.setupPermissions(rawDb, slug, testRegistry);
      await CollectionTestFactory.setupPermissions(rawDb, targetSlug, testRegistry);
    });

    it('根据 Collection 级配置实现 ID 到展示文本的动态转译', async () => {
      const catRes = await factory.create(targetSlug, { name: '技术教程' });
      const cat = await catRes.json();

      const artRes = await factory.create(slug, { title: 'D1 深度指南', categoryId: cat.id });
      expect(artRes.status).toBe(200);

      const listRes = await factory.list(slug);
      const listData = await listRes.json();
      const item = listData.data[0];

      expect(item.categoryId).toBe(cat.id);
      expect(item._displayValues.categoryId).toBe('技术教程');
    });
  });
});
