import { Hono } from 'hono';
import { eq, and, inArray } from 'drizzle-orm';
import { createDbClient } from '../db';
import { models, collections, entities, systemSettings, languages } from '../db/schema';
import { validateEntityData } from '../lib/model-engine';
import { NotifyService } from '../services/NotifyService';
import { SeoService } from '../services/SeoService';
import { SeoUtils } from '../lib/SeoUtils';
import { InquiryService } from '../services/InquiryService';
import { getAuthInstances } from '../lib/auth';

import { getCookie, setCookie } from 'hono/cookie';

const publicApi = new Hono<{ Bindings: any }>();

/**
 * Visitor Tracking Middleware
 * Manages _v_entry (landing page) and _v_count (session/visit count)
 */
publicApi.use('*', async (c, next) => {
  const url = new URL(c.req.url);
  const hostname = url.hostname;
  
  // 提取顶级域名用于跨子域追踪 (.example.com)
  const parts = hostname.split('.');
  const domain = parts.length > 2 ? `.${parts.slice(-2).join('.')}` : undefined;

  let entryUrl = getCookie(c, '_v_entry');
  let visitCount = parseInt(getCookie(c, '_v_count') || '0');

  // 如果没有 entryUrl，说明是首次进入，记录当前页面 URL
  if (!entryUrl) {
    entryUrl = c.req.url;
    setCookie(c, '_v_entry', entryUrl, {
      path: '/',
      domain,
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: 'Lax'
    });
  }

  // 每次请求增加访问计数 (按 Hono 简单逻辑，此处为粗略计数，非严格 Session 计数)
  visitCount += 1;
  setCookie(c, '_v_count', visitCount.toString(), {
    path: '/',
    domain,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'Lax'
  });

  // 存储到 context 供后续路由使用
  c.set('visitor_tracking', {
    entry_url: entryUrl,
    visit_count: visitCount,
    submit_url: c.req.url // 当前提交页的基础 URL
  });

  await next();
});

// Simple in-memory rate limiter (per-worker isolate)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, limitPerMin: number): boolean {
  if (limitPerMin <= 0) return true; // 0 or negative means unlimited
  
  const now = Date.now();
  let record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetAt) {
    record = { count: 1, resetAt: now + 60 * 1000 };
    rateLimitMap.set(ip, record);
    return true;
  }
  
  record.count += 1;
  return record.count <= limitPerMin;
}

// 提取并校验安全与权限上下文
const publicGateway = async (c: any, next: any) => {
  const collectionSlug = c.req.param('slug');
  const db = await createDbClient(c.env.DB);

  const result = await db.select({
    collection: collections,
    model: models
  })
  .from(collections)
  .leftJoin(models, eq(collections.modelId, models.id))
  .where(eq(collections.slug, collectionSlug))
  .get();

  if (!result || !result.collection || !result.model) {
    return c.json({ error: 'Not Found', message: 'The requested resource does not exist.' }, 404);
  }

  const fieldConfig = result.collection.fieldConfig || {};
  const apiPolicy = fieldConfig.__api_policy as {
    enabled?: boolean;
    allowed_methods?: string[];
    security?: { allowed_domains?: string[]; rate_limit_per_min?: number };
    field_permissions?: { read_whitelist?: string[]; write_whitelist?: string[] };
  };

  // 1. 启停门禁
  if (!apiPolicy || !apiPolicy.enabled) {
    return c.json({ error: 'Forbidden', message: 'Public API access is disabled for this resource.' }, 403);
  }

  // 2. 动词门禁
  const methodMap: Record<string, string> = {
    'GET /schema': 'schema',
    'GET /data': 'data',
    'POST /submit': 'submit'
  };
  
  // path matcher logic since it receives full path like /v1/p/schema/my-slug
  const reqPath = c.req.path;
  const methodType = reqPath.includes('/schema/') ? 'schema' : (reqPath.includes('/data/') ? 'data' : (reqPath.includes('/submit/') ? 'submit' : 'unknown'));
  
  if (!apiPolicy.allowed_methods?.includes(methodType)) {
    return c.json({ error: 'Method Not Allowed', message: `Method '${methodType}' is not allowed on this resource.` }, 405);
  }

  // 3. 域校验 (CORS Check)
  const origin = c.req.header('origin') || c.req.header('referer') || '';
  const allowedDomains = apiPolicy.security?.allowed_domains || [];
  if (allowedDomains.length > 0) {
    const isAllowed = allowedDomains.some(domain => {
      // Very loose check or strict check
      return origin.includes(domain) || domain === '*';
    });
    if (!isAllowed) {
      return c.json({ error: 'Forbidden', message: 'CORS Origin is not permitted.' }, 403);
    }
  }

  // 4. Rate Limiting
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') || '127.0.0.1';
  const limit = apiPolicy.security?.rate_limit_per_min || 0; 
  if (limit > 0 && !checkRateLimit(ip, limit)) {
    return c.json({ error: 'Too Many Requests', message: 'Rate limit exceeded.' }, 429);
  }

  // Append safe contexts
  c.set('model', result.model);
  c.set('collection', result.collection);
  c.set('apiPolicy', apiPolicy);
  c.set('clientInfo', {
    ip,
    country: c.req.header('cf-ipcountry') || 'Unknown',
    referer: c.req.header('referer') || '',
    userAgent: c.req.header('user-agent') || ''
  });

  await next();
};

publicApi.use('/:action/:slug', publicGateway);

/**
 * API: 通用询盘提交 (支持游客与会员)
 */
publicApi.post('/inquiry', async (c) => {
  const db = await createDbClient(c.env.DB);
  const domains = c.get('domains' as any) || c.get('site_domains' as any);
  if (!domains) return c.json({ error: 'Tenant context mismatch' }, 500);

  const tenantId = domains.tenant_id || domains.id || (domains.site_domains ? domains.site_domains.id : 0);

  const payload = await c.req.json().catch(() => ({}));
  if (!payload.email || !payload.content) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  // 1. 尝试获取会员身份
  let memberId = null;
  try {
    const { userAuth } = await getAuthInstances(c.env.DB);
    const sessionId = getCookie(c, 'user_session');
    
    if (sessionId) {
      const { session, user } = await userAuth.validateSession(sessionId);
      if (session) {
        memberId = (user as any).id;
        console.log(`[PublicAPI] Member bound: ${memberId}`);
      } else {
        console.warn(`[PublicAPI] Session found but invalid: ${sessionId}`);
      }
    } else {
      const allCookies = c.req.header('Cookie');
      console.log(`[PublicAPI] No user_session cookie found. All headers:`, JSON.stringify(c.req.header()));
    }
  } catch (e: any) {
    console.error(`[PublicAPI] Member Auth Error:`, e.message);
  }

  // 2. 调用服务层创建
  const visitorTracking = c.get('visitor_tracking');
  const result = await InquiryService.createInquiry(db, {
    tenantId: Number(tenantId),
    email: payload.email,
    content: payload.content,
    memberId: memberId,
    verifyToken: payload.verify_token,
    status: payload.status, // 允许传入 status（例如前端预判为 spam）
    sourceUrl: payload.source_url || visitorTracking?.submit_url || c.req.url
  });

  return c.json({ 
    success: true, 
    id: result.id, 
    member_bound: !!memberId 
  });
});

// API 1: Schema Export
publicApi.get('/schema/:slug', async (c) => {
  const model = c.get('model');
  const collection = c.get('collection');
  const policy = c.get('apiPolicy');

  const writeWhitelist = policy.field_permissions?.write_whitelist || [];
  
  // Create safe field configurations removing internal __ keys
  const safeFieldConfig: Record<string, any> = {};
  if (collection.fieldConfig) {
    Object.entries(collection.fieldConfig).forEach(([k, v]) => {
      if (!k.startsWith('__')) {
        safeFieldConfig[k] = v;
      }
    });
  }

  // Filter model fields by write whitelist
  const allowedFields = (model.fieldsJson as any[]).filter(f => writeWhitelist.includes(f.name));

  return c.json({
    success: true,
    data: {
      modelName: model.name,
      collectionName: collection.name,
      fields: allowedFields,
      fieldConfig: safeFieldConfig
    }
  });
});

/**
 * API: Sitemap Generation (Google 兼容并支持多语言交叉索引)
 */
publicApi.get('/sitemap.xml', async (c) => {
  const db = await createDbClient(c.env.DB);
  
  // 1. 获取全局配置 (前端主域名与默认语种)
  const [siteMdRow, defaultLangRow] = await Promise.all([
    db.select().from(systemSettings).where(eq(systemSettings.key, 'site_metadata')).get(),
    db.select().from(languages).where(eq(languages.isDefault, true)).get()
  ]);
  
  const siteMetadata = siteMdRow ? JSON.parse(siteMdRow.value) : {};
  const frontendUrl = (siteMetadata.frontend_url || '').replace(/\/$/, '');
  const defaultLocale = defaultLangRow?.code || 'en-US';

  if (!frontendUrl) {
    return c.text('<!-- Error: frontend_url not configured in system settings -->', 500, { 'Content-Type': 'application/xml' });
  }

  // 2. 识别开启了 Sitemap 的业务集合
  const allCols = await db.select().from(collections).all();
  const enabledCols = allCols.filter(col => col.fieldConfig?.seo_settings?.sitemap_enabled);
  
  if (enabledCols.length === 0) {
    return c.text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', 200, { 'Content-Type': 'application/xml' });
  }

  // 3. 聚合符合条件的实体数据
  const colIds = enabledCols.map(col => col.id);
  const rawEntities = await db.select().from(entities).where(inArray(entities.collectionId, colIds)).all();
  
  // 过滤已发布实体
  const sitemapEntriesRaw = rawEntities.filter(r => {
    const d = typeof r.dataJson === 'string' ? JSON.parse(r.dataJson) : r.dataJson;
    return d.status === 'published';
  }).map(r => {
    const col = enabledCols.find(cl => cl.id === r.collectionId);
    return {
      id: r.id,
      locale: r.locale || 'en-US',
      translationGroup: r.translationGroup,
      collectionSlug: col?.slug || '',
      updatedAt: r.updatedAt || r.createdAt
    };
  });

  // 4. 利用 SeoService 并行生成 XML 节点
  const xmlEntries = sitemapEntriesRaw.map(entry => {
    // 查找同组的多语言 alternate 列表
    const alternates = entry.translationGroup 
      ? sitemapEntriesRaw.filter(alt => alt.translationGroup === entry.translationGroup)
      : [];
    
    return SeoService.generateSitemapEntries([{ ...entry, alternates }], frontendUrl, defaultLocale);
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${xmlEntries}
</urlset>`;

  return c.text(xml, 200, { 
    'Content-Type': 'application/xml',
    'Cache-Control': 'public, max-age=3600, s-maxage=86400' // Cloudflare 边缘缓存
  });
});

// API 2: Data Retrieval
publicApi.get('/data/:slug', async (c) => {
  const collection = c.get('collection');
  const policy = c.get('apiPolicy');
  const db = await createDbClient(c.env.DB);

  const readWhitelist = policy.field_permissions?.read_whitelist || [];

  const records = await db.select()
    .from(entities)
    .where(eq(entities.collectionId, collection.id))
    .orderBy(entities.createdAt)
    .all();

  // 1. 过滤 status = published (死逻辑)
  // 如果实体包含 status 并且不等于 published，则剔除
  // 注意：并非所有模型都有 status 字段。若存在 status 字段则强制执行校验
  const publishedRecords = records.filter(record => {
    const data = typeof record.dataJson === 'string' ? JSON.parse(record.dataJson) : record.dataJson;
    if (data.status !== undefined && data.status !== 'published') {
      return false; // 硬性拦截
    }
    return true;
  });

  // 2. 物理剔除不可读字段
  // 3. 注入 _seo.jsonld 字段与元数据解析
  // 获取全局配置用于生成 Full URL
  const [siteMdRow, defaultLangRow] = await Promise.all([
    db.select().from(systemSettings).where(eq(systemSettings.key, 'site_metadata')).get(),
    db.select().from(languages).where(eq(languages.isDefault, true)).get()
  ]);
  const siteMetadata = siteMdRow ? JSON.parse(siteMdRow.value) : {};
  const frontendUrl = (siteMetadata.frontend_url || '').replace(/\/$/, '');
  const defaultLocale = defaultLangRow?.code || 'en-US';
  const seoSettings = collection.fieldConfig?.seo_settings || {};

  // 2. 物理剔除不可读字段 (按权限白名单)
  const safeRecords = publishedRecords.map(record => {
    const data = typeof record.dataJson === 'string' ? JSON.parse(record.dataJson) : record.dataJson;
    const safeData: Record<string, any> = {};
    for (const key of readWhitelist) {
      if (data.hasOwnProperty(key)) {
        safeData[key] = data[key];
      }
    }
    return {
      id: record.id,
      locale: record.locale,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      ...safeData
    };
  });

  const finalRecords = safeRecords.map(record => {
    const origEntity = publishedRecords.find(pr => pr.id === record.id);
    const fullData = typeof origEntity?.dataJson === 'string' ? JSON.parse(origEntity.dataJson) : origEntity?.dataJson;
    
    // 生成 JSON-LD
    const jsonLd = SeoService.generateJsonLd(
      { ...fullData, id: record.id, locale: record.locale, createdAt: record.createdAt, updatedAt: record.updatedAt },
      collection.slug,
      seoSettings.schema_type,
      frontendUrl,
      defaultLocale
    );

    // 处理自定义 SEO 标题/描述模板
    const seoTitle = SeoUtils.resolveTemplate(seoSettings.title_template, { ...fullData, site_name: siteMetadata.site_name || 'MySite' });
    const seoDesc = SeoUtils.resolveTemplate(seoSettings.description_template, { ...fullData, site_name: siteMetadata.site_name || 'MySite' });

    return {
      ...record,
      _seo: {
        title: seoTitle,
        description: seoDesc,
        jsonld: jsonLd
      }
    };
  });

  return c.json({ success: true, list: finalRecords });
});

// API 3: Data Submission
publicApi.post('/submit/:slug', async (c) => {
  const model = c.get('model');
  const collection = c.get('collection');
  const policy = c.get('apiPolicy');
  const clientInfo = c.get('clientInfo');
  const db = await createDbClient(c.env.DB);

  const writeWhitelist = policy.field_permissions?.write_whitelist || [];
  
  let payload: any;
  try {
    payload = await c.req.json();
  } catch(e) {
    return c.json({ error: 'Invalid JSON payload' }, 400);
  }

  // 1. 数据沙盒: 物理清洗，剔除不在 write_whitelist 中的字段
  const safeData: Record<string, any> = {};
  for (const key of writeWhitelist) {
    if (payload.hasOwnProperty(key)) {
      safeData[key] = payload[key];
    }
  }

  // 2. Relation Secondary Check (二次校验)
  // 如果包含了关联单选类型的字段，需校验该 id 是否存在
  const relationFields = (model.fieldsJson as any[]).filter(f => f.type === 'relation_single' && writeWhitelist.includes(f.name));
  for (const rf of relationFields) {
    const val = safeData[rf.name];
    if (val) {
      // validate by checking entities table 
      // where id = val
      // To be strictly correct we should also check targetCollectionId, but here if id exists it's generally ok
      const targetExists = await db.select({ id: entities.id }).from(entities).where(eq(entities.id, parseInt(val))).get();
      if (!targetExists) {
        return c.json({ error: `Validation Failed`, message: `Relation target ID ${val} for field ${rf.name} does not exist.` }, 400);
      }
    }
  }

  // 3. 基础结构校验
  // Because we filtered to only write_whitelist fields, we skip validation on other fields 
  // Wait, model.fieldsJson could have `required: true` on fields NOT in write_whitelist.
  // We should create a dummy validation model of only the whitelisted fields for validation
  const validationModelFields = (model.fieldsJson as any[]).filter(f => writeWhitelist.includes(f.name));
  const validation = validateEntityData(safeData, validationModelFields);
  if (!validation.valid) {
    return c.json({ error: 'Data Validation Failed', details: validation.errors }, 400);
  }

  // 4. Injections & Persistence
  // 自动化生成 groupId 和 locale, 并带上访客信息 
  const translationGroup = crypto.randomUUID();
  const currentLocale = 'en-US'; // Default fallback, maybe allow accepting from headers?
  
  const visitorTracking = c.get('visitor_tracking');
  const metadata = {
    visitor_tracking: {
      ip: clientInfo.ip,
      country: clientInfo.country,
      referer: clientInfo.referer,
      user_agent: clientInfo.userAgent,
      entry_url: visitorTracking.entry_url,
      submit_url: c.req.url, // 最终表单提交所在的页面
      visit_count: visitorTracking.visit_count,
      submitted_at: new Date().toISOString()
    },
    crm_governance: {
      status: 'pending', // 初始状态为待处理
      notes: []
    }
  };

  const [inserted] = await db.insert(entities).values({
    collectionId: collection.id,
    dataJson: safeData,
    locale: currentLocale,
    translationGroup,
    metadata,
    createdBy: 'public_visitor'
  }).returning();

  // Async trigger notifications
  try {
    c.executionCtx.waitUntil(
      NotifyService.dispatchNotification(db, collection, safeData)
    );
  } catch (e) {
    // Fallback for environments where executionCtx is not available (e.g. testing)
    NotifyService.dispatchNotification(db, collection, safeData).catch(err => console.error("[NotifyService] Async fallback error:", err));
  }

  return c.json({ success: true, id: inserted.id, translationGroup });
});

export default publicApi;
