import { test, expect } from '@playwright/test';

test.describe('公共 API 与治理引警深度安全审计', () => {
  let sessionCookie: string = '';
  // 我们将创建一个特定的 slug 供测试
  const collSlug = `public_api_test_${Date.now()}`;
  const targetCollSlug = `target_coll_${Date.now()}`;
  let collId: number;
  let targetCollId: number;

  test.beforeAll(async ({ request }) => {
    // 1. 获取 Admin Token
    const res = await request.post('/api/auth/admin/login', {
      data: { username: 'admin', password: 'admin123' },
    });
    expect(res.ok()).toBeTruthy();
    const headers = res.headers();
    const cookieHeader = headers['set-cookie'] || '';
    // 从 headers 中提取 cookie 用于后续 Admin API
    sessionCookie = cookieHeader;
    
    // 2. 创建基础关联集合 (Target)
    const m1Res = await request.post('/api/v1/rbac/models', {
      headers: { cookie: sessionCookie },
      data: {
        name: 'Target Model',
        slug: `t_model_${Date.now()}`,
        fieldsJson: [{ name: 'name', label: '名称', type: 'text' }]
      }
    });
    const m1 = await m1Res.json();
    
    const c1Res = await request.post('/api/v1/rbac/collections', {
      headers: { cookie: sessionCookie },
      data: {
        name: 'Target Collection',
        slug: targetCollSlug,
        modelId: m1.id
      }
    });
    const c1 = await c1Res.json();
    targetCollId = c1.id;
    
    // 初始化一条 Target 数据
    await request.post(`/api/v1/entities/${targetCollSlug}`, {
      headers: { cookie: sessionCookie },
      data: { name: 'Target Item 1' }
    });

    // 3. 创建测试源集合
    const m2Res = await request.post('/api/v1/rbac/models', {
      headers: { cookie: sessionCookie },
      data: {
        name: 'Source Model',
        slug: `s_model_${Date.now()}`,
        fieldsJson: [
          { name: 'title', label: '标题', type: 'text' },
          { name: 'content', label: '内容', type: 'text' },
          { name: 'internal_note', label: '内部备注', type: 'text' },
          { name: 'status', label: '状态', type: 'text' },
          { name: 'target_rel', label: '目标关联', type: 'relation_single' },
        ]
      }
    });
    const m2 = await m2Res.json();

    const c2Res = await request.post('/api/v1/rbac/collections', {
      headers: { cookie: sessionCookie },
      data: {
        name: 'Public API Source',
        slug: collSlug,
        modelId: m2.id
      }
    });
    const c2 = await c2Res.json();
    collId = c2.id;

    // 4. 配置 API Governance Policy
    const policySettings = {
       target_rel: { targetCollectionSlug: targetCollSlug, displayField: 'name' }, // field config
       __api_policy: {
         enabled: true,
         allowed_methods: ['schema', 'data', 'submit'],
         security: {
           allowed_domains: ['https://trusted.com'],
           rate_limit_per_min: 0 // 关闭防刷方便测试
         },
         field_permissions: {
           read_whitelist: ['title', 'content'], // internal_note 和 status 被屏蔽
           write_whitelist: ['title', 'content', 'target_rel']
         }
       }
    };

    await request.patch(`/api/v1/rbac/collections/${c2.id}`, {
      headers: { cookie: sessionCookie },
      data: {
        name: 'Public API Source',
        slug: collSlug, 
        modelId: m2.id,
        fieldConfig: policySettings
      }
    });
  });

  test.describe('防渗透测试 (Penetration & Sanitization)', () => {
    test('[跨域测试] 非法 Origin 请求应被拒绝 403', async ({ request }) => {
      const res = await request.get(`/api/v1/p/schema/${collSlug}`, {
        headers: { Origin: 'https://evil.com' }
      });
      expect(res.status()).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Forbidden');
    });

    test('[动作拦截] 未开放的 Method 应当被拒绝 405', async ({ request }) => {
      // 动态关闭 schema，只开 data, submit
      await request.patch(`/api/v1/rbac/collections/${collId}`, {
        headers: { cookie: sessionCookie },
        data: {
          fieldConfig: {
            __api_policy: {
              enabled: true,
              allowed_methods: ['data', 'submit'],
              security: { allowed_domains: ['*'] }
            }
          }
        }
      });

      const res = await request.get(`/api/v1/p/schema/${collSlug}`, {
        headers: { Origin: 'https://trusted.com' }
      });
      expect(res.status()).toBe(405);
      
      // 恢复 schema 以供后续测试
      await request.patch(`/api/v1/rbac/collections/${collId}`, {
         headers: { cookie: sessionCookie },
         data: {
           fieldConfig: {
             __api_policy: {
               enabled: true,
               allowed_methods: ['schema', 'data', 'submit'],
               security: { allowed_domains: ['*'] },
               field_permissions: {
                 read_whitelist: ['title', 'content'],
                 write_whitelist: ['title', 'content', 'target_rel']
               }
             }
           }
         }
       });
    });

    test('[内部键值隔离] Schema 获取不应暴露 __ 内部键并必须遵守 write_whitelist', async ({ request }) => {
      const res = await request.get(`/api/v1/p/schema/${collSlug}`, {
        headers: { Origin: 'https://trusted.com' }
      });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      
      // 验证内部键被剥离
      expect(body.data.fieldConfig).not.toHaveProperty('__api_policy');
      
      // 验证返回的字段定义只包含 write_whitelist 中定义的
      const returnedFields = body.data.fields.map((f: any) => f.name);
      expect(returnedFields).toContain('title');
      expect(returnedFields).not.toContain('internal_note'); // 拦截成功
      expect(returnedFields).not.toContain('status');
    });

    test('[数据沙盒与关联测试] 强行注入未授权字段必定被丢弃，关联字段被严格校验', async ({ request }) => {
      // 1. 首先尝试包含错误的 target_rel ID，应当被校验阻断
      const badRelRes = await request.post(`/api/v1/p/submit/${collSlug}`, {
        headers: { Origin: 'https://trusted.com' },
        data: {
          title: 'Hacked Title',
          content: 'Hacked Content',
          status: 'published', // <- 这是恶意的覆盖尝试
          internal_note: 'You are hacked',
          target_rel: '99999' // 虚假的 ID
        }
      });
      expect(badRelRes.status()).toBe(400); // 必须被 Relation Schema 拦截

      // 2. 提供合法的 target_rel ID（目前只有一个 ID 应当为 1，或者我们需要从 target 获取）
      // 获取那条记录的真实 ID 
      const targetListRes = await request.get(`/api/v1/entities/${targetCollSlug}`, { headers: { cookie: sessionCookie } });
      const targetList = await targetListRes.json();
      const realTargetId = targetList.data[0].id;

      const goodRes = await request.post(`/api/v1/p/submit/${collSlug}`, {
        headers: { Origin: 'https://trusted.com', 'cf-connecting-ip': '8.8.8.8', 'cf-ipcountry': 'US' },
        data: {
          title: 'Safe Title',
          content: 'Safe Content',
          status: 'published', // 这个应当被剥离
          internal_note: 'You are hacked again', // 应当被剥离
          target_rel: String(realTargetId) 
        }
      });
      expect(goodRes.ok()).toBeTruthy();

      // 验证最终数据库中储存的键值 (Admin 权限查看底层)
      const inspectRes = await request.get(`/api/v1/entities/${collSlug}`, { headers: { cookie: sessionCookie } });
      const inspectData = await inspectRes.json();
      console.log('inspectData:', inspectData);
      
      // Let's filter to find the one we just inserted using the response id
      const goodResBody = await goodRes.json();
      const record = inspectData.data.find((r: any) => r.id === goodResBody.id);
      
      const metadata = record.metadata;

      // 强校验：沙盒隔离验证
      expect(record).toHaveProperty('title', 'Safe Title');
      expect(record).not.toHaveProperty('status'); // 彻底丢弃
      expect(record).not.toHaveProperty('internal_note'); // 彻底丢弃

      // 强校验：透明化元数据注入
      expect(metadata).toHaveProperty('public_submission');
      expect(metadata.public_submission).toHaveProperty('ip', '8.8.8.8');
      expect(metadata.public_submission).toHaveProperty('country', 'US');
      expect(record).toHaveProperty('translationGroup');
    });

    test('[泄露测试] 死逻辑与读白名单校验', async ({ request }) => {
      // 1. 由后端插入一条 status = 'draft'，和一条 status = 'published' 的记录
      await request.post(`/api/v1/entities/${collSlug}`, {
        headers: { cookie: sessionCookie },
        data: { title: 'Draft Post', status: 'draft', internal_note: 'Secret Draft' }
      });
      await request.post(`/api/v1/entities/${collSlug}`, {
        headers: { cookie: sessionCookie },
        data: { title: 'Published Post', status: 'published', internal_note: 'Secret Pub' }
      });

      // 2. 调用公共 /data 接口
      const res = await request.get(`/api/v1/p/data/${collSlug}`, {
        headers: { Origin: 'https://trusted.com' }
      });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      const list = body.list;

      // 3. 强校验：死逻辑 (只能读到 published，甚至我们刚提交那条没 status 的也读不到，因为我们只筛选 status !== published)
      // 注意：我们在后端写的逻辑是 -> 如果存在 status 且 !== 'published' 则排除。没有 status 的能被包含。
      const draftPost = list.find((item: any) => item.title === 'Draft Post');
      expect(draftPost).toBeUndefined(); // 被死逻辑干掉

      const publishedPost = list.find((item: any) => item.title === 'Published Post');
      expect(publishedPost).toBeDefined();

      // 4. 强校验：数据物理剥离
      // 我们请求到了 publishedPost，它有 internal_note，但 read_whitelist 没有它。
      const keys = Object.keys(publishedPost);
      expect(keys).not.toContain('internal_note');
      expect(keys).not.toContain('status'); // Read whitelist 里没有 status
      expect(keys).toContain('title'); 
    });
  });
});
