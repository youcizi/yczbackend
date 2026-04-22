import { createDbClient } from '../db';
import { models, collections } from '../db/schema';
import { eq } from 'drizzle-orm';
import { registry, registerDynamicPermissions } from '../lib/permission-registry';

/**
 * 模型规格库定义 (MODEL_LIBRARY)
 * 封装核心业务字段，确保初始化逻辑的一致性与专业性
 *
 * NOTE: 每个模块的 fieldConfig 会在初始化时直接写入 collections 表，
 * 确保 InquiryService 的线索聚合、公有 API 准入和通知钩子等功能开箱即用。
 */
export const MODEL_LIBRARY = {
  // ========================
  // 产品中心
  // ========================
  spec_templates: {
    name: '规格模板',
    slug: 'spec_templates',
    description: '标准化的产品规格定义模板，用于统一产品参数结构',
    fields: [
      { name: 'name', type: 'text', label: '模板名称', required: true, isListDisplay: true },
      { name: 'config', type: 'json', label: '规格配置 (JSON)', placeholder: '例：{"Material": "string"}' },
    ],
    menuGroup: '产品中心',
    icon: 'Settings2',
    menuOrder: 5,
    // NOTE: 规格模板无需公有 API 和通知，为管理内部使用
    fieldConfig: {},
  },
  b2b_category: {
    name: '产品分类',
    slug: 'b2b_category',
    description: '产品的多级树形分类体系',
    fields: [
      { name: 'name', type: 'text', label: '分类名称', required: true, isListDisplay: true },
      { name: 'parent_id', type: 'relation', label: '上级分类', relationConfig: { collectionSlug: 'b2b_category', displayField: 'name' } },
      { name: 'cover', type: 'image', label: '分类封面图' },
      { name: 'url_slug', type: 'text', label: 'URL 别名', required: true },
      { name: 'seo_title', type: 'text', label: 'SEO 标题' },
      { name: 'seo_description', type: 'textarea', label: 'SEO 描述' }
    ],
    menuGroup: '产品中心',
    icon: 'FolderTree',
    menuOrder: 1,
    // 开放公有 API 以供前端站点读取分类树
    fieldConfig: {
      __api_policy: {
        enabled: true,
        allowed_methods: ['schema', 'data'],
        security: { allowed_domains: ['*'], rate_limit_per_min: 0 },
        field_permissions: {
          read_whitelist: ['name', 'parent_id', 'cover', 'url_slug', 'seo_title', 'seo_description'],
          write_whitelist: []
        }
      },
      // NOTE: 关联字段配置 — 自引用分类树
      parent_id: { target_slug: 'b2b_category', display_field: 'name', targetCollectionSlug: 'b2b_category', displayField: 'name' }
    },
  },
  b2b_product: {
    name: '产品',
    slug: 'b2b_product',
    description: '外贸 B2B 核心产品数据，支持规格模板和多图展示',
    fields: [
      { name: 'title', type: 'text', label: '产品标题', required: true, isListDisplay: true },
      { name: 'category', type: 'relation', label: '所属分类', relationConfig: { collectionSlug: 'b2b_category', displayField: 'name' }, isListDisplay: true },
      { name: 'spec_template_id', type: 'relation', label: '应用规格模板', relationConfig: { collectionSlug: 'spec_templates', displayField: 'name' } },
      { name: 'spec_data', type: 'json', label: '规格参数' },
      { name: 'images', type: 'image', label: '产品图片 (多图)', multiple: true },
      { name: 'description', type: 'richtext', label: '详细描述' },
      { name: 'url_slug', type: 'text', label: 'URL 别名', required: true },
      { name: 'seo_title', type: 'text', label: 'SEO 标题' },
      { name: 'seo_description', type: 'textarea', label: 'SEO 描述' }
    ],
    menuGroup: '产品中心',
    icon: 'Package',
    menuOrder: 2,
    fieldConfig: {
      __api_policy: {
        enabled: true,
        allowed_methods: ['schema', 'data'],
        security: { allowed_domains: ['*'], rate_limit_per_min: 0 },
        field_permissions: {
          read_whitelist: ['title', 'category', 'spec_data', 'images', 'description', 'url_slug', 'seo_title', 'seo_description'],
          write_whitelist: []
        }
      },
      category: { target_slug: 'b2b_category', display_field: 'name', targetCollectionSlug: 'b2b_category', displayField: 'name' },
      spec_template_id: { target_slug: 'spec_templates', display_field: 'name', targetCollectionSlug: 'spec_templates', displayField: 'name' }
    },
  },

  // ========================
  // 商务互动 (询盘 & 留言)
  // ========================
  b2b_inquiry: {
    name: '客户询盘',
    slug: 'b2b_inquiry',
    description: '来自前端站点的产品询盘，自动归集到线索中心',
    fields: [
      { name: 'subject', type: 'text', label: '需求主题', isListDisplay: true },
      { name: 'product', type: 'relation', label: '关联产品', relationConfig: { collectionSlug: 'b2b_product', displayField: 'title' }, isListDisplay: true },
      { name: 'name', type: 'text', label: '联系人姓名', required: true, isListDisplay: true },
      { name: 'email', type: 'text', label: '电子邮箱', required: true, isListDisplay: true },
      { name: 'phone', type: 'text', label: '联系电话' },
      { name: 'country', type: 'text', label: '国家/地区', isListDisplay: true },
      { name: 'ip', type: 'text', label: '访客 IP', isListDisplay: true },
      { name: 'source', type: 'text', label: '流量来源' },
      { name: 'content', type: 'textarea', label: '具体需求', required: true }
    ],
    menuGroup: '商务互动',
    icon: 'Mail',
    menuOrder: 1,
    // IMPORTANT: category = 'inquiry' 是 InquiryService 聚合线索的关键标记
    fieldConfig: {
      category: 'inquiry',
      __api_policy: {
        enabled: true,
        allowed_methods: ['submit'],
        security: { allowed_domains: ['*'], rate_limit_per_min: 30 },
        field_permissions: {
          read_whitelist: [],
          write_whitelist: ['subject', 'product', 'name', 'email', 'phone', 'country', 'content', 'source']
        }
      },
      __notification_policy: {
        enabled: true,
        receiver_emails: [],
        sender_name: 'Site Inquiry Bot',
        mail_subject_template: '新询盘: {{subject}} - {{name}}',
        mail_body_template: '',
        webhook_url: ''
      },
      product: { target_slug: 'b2b_product', display_field: 'title', targetCollectionSlug: 'b2b_product', displayField: 'title' }
    },
  },
  online_message: {
    name: '在线留言',
    slug: 'online_message',
    description: '通用联系表单，自动归集到线索中心',
    fields: [
      { name: 'name', type: 'text', label: '姓名', required: true, isListDisplay: true },
      { name: 'email', type: 'text', label: '邮箱', required: true, isListDisplay: true },
      { name: 'phone', type: 'text', label: '电话' },
      { name: 'subject', type: 'text', label: '留言主题', isListDisplay: true },
      { name: 'content', type: 'textarea', label: '内容', required: true },
      { name: 'status', type: 'select', label: '处理状态', options: ['未读', '已读', '已回复'], defaultValue: '未读', isListDisplay: true },
      { name: 'ip', type: 'text', label: 'IP 地址' }
    ],
    menuGroup: '商务互动',
    icon: 'MessageSquare',
    menuOrder: 2,
    // IMPORTANT: 同样标记为线索类型，InquiryService 可通过 category 或 email 字段自动识别
    fieldConfig: {
      category: 'inquiry',
      __api_policy: {
        enabled: true,
        allowed_methods: ['submit'],
        security: { allowed_domains: ['*'], rate_limit_per_min: 30 },
        field_permissions: {
          read_whitelist: [],
          write_whitelist: ['name', 'email', 'phone', 'subject', 'content']
        }
      },
      __notification_policy: {
        enabled: true,
        receiver_emails: [],
        sender_name: 'Site Contact Bot',
        mail_subject_template: '新留言: {{subject}} - {{name}}',
        mail_body_template: '',
        webhook_url: ''
      },
      // NOTE: status 字段预设选项
      status: {
        options: [
          { key: '未读', value: '未读' },
          { key: '已读', value: '已读' },
          { key: '已回复', value: '已回复' }
        ]
      }
    },
  },

  // ========================
  // 内容管理
  // ========================
  post_category: {
    name: '文章分类',
    slug: 'post_category',
    description: '文章/博客的多级分类体系',
    fields: [
      { name: 'name', type: 'text', label: '分类名称', required: true, isListDisplay: true },
      { name: 'parent_id', type: 'relation', label: '上级分类', relationConfig: { collectionSlug: 'post_category', displayField: 'name' } },
      { name: 'url_slug', type: 'text', label: 'URL 别名', required: true },
      { name: 'seo_title', type: 'text', label: 'SEO 标题' },
      { name: 'seo_description', type: 'textarea', label: 'SEO 描述' }
    ],
    menuGroup: '内容管理',
    icon: 'Tags',
    menuOrder: 3,
    fieldConfig: {
      __api_policy: {
        enabled: true,
        allowed_methods: ['schema', 'data'],
        security: { allowed_domains: ['*'], rate_limit_per_min: 0 },
        field_permissions: {
          read_whitelist: ['name', 'parent_id', 'url_slug', 'seo_title', 'seo_description'],
          write_whitelist: []
        }
      },
      parent_id: { target_slug: 'post_category', display_field: 'name', targetCollectionSlug: 'post_category', displayField: 'name' }
    },
  },
  article: {
    name: '文章/博客',
    slug: 'article',
    description: '长文内容发布，支持富文本编辑和 SEO 优化',
    fields: [
      { name: 'title', type: 'text', label: '标题', required: true, isListDisplay: true },
      { name: 'category', type: 'relation', label: '所属分类', relationConfig: { collectionSlug: 'post_category', displayField: 'name' }, isListDisplay: true },
      { name: 'cover', type: 'image', label: '封面图' },
      { name: 'content', type: 'richtext', label: '正文' },
      { name: 'excerpt', type: 'textarea', label: '摘要' },
      { name: 'url_slug', type: 'text', label: 'URL 别名', required: true },
      { name: 'seo_title', type: 'text', label: 'SEO 标题' },
      { name: 'seo_description', type: 'textarea', label: 'SEO 描述' }
    ],
    menuGroup: '内容管理',
    icon: 'FileText',
    menuOrder: 1,
    fieldConfig: {
      __api_policy: {
        enabled: true,
        allowed_methods: ['schema', 'data'],
        security: { allowed_domains: ['*'], rate_limit_per_min: 0 },
        field_permissions: {
          read_whitelist: ['title', 'category', 'cover', 'content', 'excerpt', 'url_slug', 'seo_title', 'seo_description'],
          write_whitelist: []
        }
      },
      category: { target_slug: 'post_category', display_field: 'name', targetCollectionSlug: 'post_category', displayField: 'name' }
    },
  },
  page: {
    name: '独立页面',
    slug: 'page',
    description: '定制化页面，如 About Us、Contact、Landing Page 等',
    fields: [
      { name: 'title', type: 'text', label: '页面标题', required: true, isListDisplay: true },
      { name: 'slug', type: 'text', label: '路径 (Slug)', required: true, isListDisplay: true },
      { name: 'layout_type', type: 'select', label: '布局类型' },
      { name: 'content', type: 'richtext', label: '页面内容' },
      { name: 'seo_title', type: 'text', label: 'SEO 标题' },
      { name: 'seo_description', type: 'textarea', label: 'SEO 描述' }
    ],
    menuGroup: '内容管理',
    icon: 'Layout',
    menuOrder: 2,
    fieldConfig: {
      __api_policy: {
        enabled: true,
        allowed_methods: ['schema', 'data'],
        security: { allowed_domains: ['*'], rate_limit_per_min: 0 },
        field_permissions: {
          read_whitelist: ['title', 'slug', 'layout_type', 'content', 'seo_title', 'seo_description'],
          write_whitelist: []
        }
      },
      layout_type: {
        options: [
          { key: 'about', value: 'About Us' },
          { key: 'contact', value: 'Contact' },
          { key: 'landing', value: 'Landing Page' },
          { key: 'custom', value: 'Custom' }
        ]
      }
    },
  },

  // ========================
  // 系统设置 (通用)
  // ========================
  company_info: {
    name: '公司信息',
    slug: 'company_info',
    description: '企业基础信息（名称、地址、联系方式等），供前端 About 页面和 Footer 使用',
    fields: [
      { name: 'company_name', type: 'text', label: '公司名称', required: true, isListDisplay: true },
      { name: 'logo', type: 'image', label: 'Logo' },
      { name: 'slogan', type: 'text', label: 'Slogan / 标语' },
      { name: 'address', type: 'textarea', label: '公司地址' },
      { name: 'phone', type: 'text', label: '联系电话' },
      { name: 'email', type: 'text', label: '联系邮箱' },
      { name: 'social_links', type: 'json', label: '社交媒体链接 (JSON)', placeholder: '{"facebook":"...","linkedin":"..."}' },
      { name: 'about_content', type: 'richtext', label: '公司简介 (富文本)' }
    ],
    menuGroup: '系统设置',
    icon: 'Building2',
    menuOrder: 1,
    fieldConfig: {
      __api_policy: {
        enabled: true,
        allowed_methods: ['schema', 'data'],
        security: { allowed_domains: ['*'], rate_limit_per_min: 0 },
        field_permissions: {
          read_whitelist: ['company_name', 'logo', 'slogan', 'address', 'phone', 'email', 'social_links', 'about_content'],
          write_whitelist: []
        }
      }
    },
  },
  nav_menu: {
    name: '导航管理',
    slug: 'nav_menu',
    description: '站点导航菜单配置，支持 Header / Footer / Sidebar 多区域',
    fields: [
      { name: 'name', type: 'text', label: '菜单统称', required: true, isListDisplay: true },
      { name: 'slug', type: 'text', label: '唯一标识', placeholder: 'header/footer/sidebar', required: true, isListDisplay: true },
      { name: 'structure', type: 'json', label: '菜单结构 (JSON)', placeholder: '自定义嵌套逻辑' }
    ],
    menuGroup: '系统设置',
    icon: 'Menu',
    menuOrder: 10,
    fieldConfig: {
      __api_policy: {
        enabled: true,
        allowed_methods: ['schema', 'data'],
        security: { allowed_domains: ['*'], rate_limit_per_min: 0 },
        field_permissions: {
          read_whitelist: ['name', 'slug', 'structure'],
          write_whitelist: []
        }
      }
    },
  }
};

/**
 * 模块间依赖图（显式声明）
 * NOTE: 拓扑排序依赖此声明来决定初始化顺序
 * 如 b2b_product 依赖 b2b_category 和 spec_templates，它们必须先创建
 */
const MODULE_DEPENDENCIES: Record<string, string[]> = {
  spec_templates: [],
  b2b_category: [],
  b2b_product: ['b2b_category', 'spec_templates'],
  b2b_inquiry: ['b2b_product'],
  online_message: [],
  post_category: [],
  article: ['post_category'],
  page: [],
  company_info: [],
  nav_menu: [],
};

export interface ModuleTemplate {
  id: string;
  name: string;
  description: string;
  dependencies: string[];
  generate: (db: any) => Promise<{ modelId: number; collectionSlug: string }>;
}

export interface IndustrySuite {
  id: string;
  name: string;
  description: string;
  modules: ModuleTemplate[];
}

/**
 * 拓扑排序：对模块 ID 列表按依赖关系排序
 * 确保被依赖方永远在依赖方之前执行
 */
function topologicalSort(ids: string[], depGraph: Record<string, string[]>): string[] {
  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (id: string) => {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      console.warn(`⚠️ [Topo] 检测到循环依赖: ${id}，跳过`);
      return;
    }
    visiting.add(id);
    const deps = depGraph[id] || [];
    deps.forEach(dep => {
      if (ids.includes(dep)) visit(dep);
    });
    visiting.delete(id);
    visited.add(id);
    sorted.push(id);
  };

  ids.forEach(id => visit(id));
  return sorted;
}

/**
 * 行业模板服务：支持一键初始化预设业务模型
 */
export class TemplateService {
  /**
   * 获取所有可用模块定义
   */
  static getAvailableModules(): ModuleTemplate[] {
    return Object.values(MODEL_LIBRARY).map(def => ({
      id: def.slug,
      name: def.name,
      description: def.description || `${def.name} 核心业务模块`,
      dependencies: MODULE_DEPENDENCIES[def.slug] || [],
      generate: async (db) => {
        // 1. 幂等检查 Model
        const [exists] = await db.select().from(models).where(eq(models.slug, def.slug)).limit(1).all();
        let modelId = exists?.id;
        
        if (!modelId) {
          const [inserted] = await db.insert(models).values({
            name: def.name,
            slug: def.slug,
            fieldsJson: def.fields,
            description: def.description
          }).returning();
          modelId = inserted.id;
        }

        // 2. 幂等插入 Collection（含 fieldConfig 注入）
        const collectionData = {
          name: def.name === '产品' ? '产品列表' : def.name,
          slug: def.slug,
          modelId: modelId,
          menuGroup: def.menuGroup,
          menuOrder: def.menuOrder,
          icon: def.icon,
          description: def.description,
          // NOTE: 直接注入 fieldConfig，让公有 API、通知钩子、关联字段配置等开箱即用
          fieldConfig: def.fieldConfig || {},
        };
        
        await db.insert(collections).values(collectionData).onConflictDoNothing().run();

        // 3. 权限自愈 (Permission Self-Healing)
        registerDynamicPermissions(collectionData, 'collection');
        await registry.syncToDb(db);
        console.log(`📡 [Template] 模块初始化完成: ${def.slug} (fieldConfig 已注入)`);

        return { modelId, collectionSlug: def.slug };
      }
    }));
  }

  /**
   * 获取行业套件定义
   */
  static getIndustrySuites(): IndustrySuite[] {
    const all = this.getAvailableModules();
    return [
      {
        id: 'b2b',
        name: '外贸 B2B',
        description: '深度优化的外贸展示套件，含产品中心（规格模板 + 分类 + 产品）、询盘/留言、公司信息与导航管理。',
        modules: all.filter(m => [
          'spec_templates', 'b2b_category', 'b2b_product',
          'b2b_inquiry', 'online_message',
          'company_info', 'nav_menu'
        ].includes(m.id))
      },
      {
        id: 'brand',
        name: '品牌官网',
        description: '强调品牌调性、内容运营的企业官网套件，含文章/博客、独立页面、产品展示、留言和公司信息。',
        modules: all.filter(m => [
          'post_category', 'article', 'page',
          'b2b_category', 'b2b_product',
          'online_message', 'company_info', 'nav_menu'
        ].includes(m.id))
      },
      {
        id: 'blog',
        name: '内容博客',
        description: '轻量级内容发布中心，适合个人或团队运营技术博客、教程站点。',
        modules: all.filter(m => ['post_category', 'article', 'page', 'nav_menu'].includes(m.id))
      },
      {
        id: 'custom',
        name: '自定义装配',
        description: '自由勾选模型注册表中的所有模块，构建您的专属系统。',
        modules: all
      }
    ];
  }

  /**
   * 模块化按需生成（带拓扑排序）
   */
  static async initCustomModules(dbEnv: any, moduleIds: string[]) {
    const db = await createDbClient(dbEnv);
    const available = this.getAvailableModules();
    
    // 1. 解析依赖并合并
    const toGenerateIds = new Set<string>();
    const resolveBatch = (ids: string[]) => {
      ids.forEach(id => {
        const mod = available.find(m => m.id === id);
        if (mod) {
          toGenerateIds.add(id);
          if (mod.dependencies) resolveBatch(mod.dependencies);
        }
      });
    };
    resolveBatch(moduleIds);

    // 2. 拓扑排序，确保依赖先于被依赖方执行
    const sortedIds = topologicalSort(Array.from(toGenerateIds), MODULE_DEPENDENCIES);

    const results = [];
    for (const id of sortedIds) {
      const mod = available.find(m => m.id === id);
      if (mod) {
        // 幂等检查：避免重复初始化
        const existing = await db.select().from(collections).where(eq(collections.slug, id)).get();
        if (!existing) {
          console.log(`🚀 [Template] 正在初始化模块: ${id}`);
          await mod.generate(db);
          results.push(id);
        } else {
          console.log(`⏭️ [Template] 模块已存在，跳过: ${id}`);
        }
      }
    }

    return { success: true, count: results.length, generated: results };
  }

  /**
   * 初始化外贸 B2B 套件 (保留原接口兼容性)
   */
  static async initB2BTemplate(dbEnv: any) {
    return this.initCustomModules(dbEnv, [
      'spec_templates', 'b2b_category', 'b2b_product',
      'b2b_inquiry', 'online_message',
      'company_info', 'nav_menu'
    ]);
  }
}
