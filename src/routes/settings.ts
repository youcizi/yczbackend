import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { createDbClient } from '../db';
import { systemSettings, languages } from '../db/schema';
import { requirePermission } from '../middleware/rbac';

const settingsRoutes = new Hono<{ Bindings: any }>();

/**
 * GET /api/v1/settings/languages
 * 获取系统支持的语种列表 (用于 I18n 表单动态渲染)
 */
settingsRoutes.get('/languages', async (c) => {
  const db = await createDbClient(c.env.DB);
  const list = await db.select().from(languages).all();
  return c.json({ success: true, data: list });
});

// GET /api/v1/settings/mail_config
settingsRoutes.get('/mail_config', requirePermission(['settings.mail', 'role.manage']), async (c) => {
  const db = await createDbClient(c.env.DB);
  const record = await db.query.systemSettings.findFirst({
    where: eq(systemSettings.key, 'mail_config')
  });

  if (!record) {
    return c.json({
      provider_type: 'resend',
      resend_api_key: '',
      smtp_config: { host: '', port: 465, user: '', pass: '' }
    });
  }

  const config = JSON.parse(record.value);
  
  // Mask keys
  if (config.resend_api_key && config.resend_api_key.length > 5) {
    config.resend_api_key = config.resend_api_key.slice(0, 5) + '*'.repeat(10);
  }
  if (config.smtp_config && config.smtp_config.pass) {
    config.smtp_config.pass = '********';
  }

  return c.json(config);
});

// POST /api/v1/settings/mail_config
settingsRoutes.post('/mail_config', requirePermission(['settings.mail', 'role.manage']), async (c) => {
  const body = await c.req.json();
  const db = await createDbClient(c.env.DB);
  
  const existing = await db.query.systemSettings.findFirst({
    where: eq(systemSettings.key, 'mail_config')
  });

  let configToSave = { ...body };

  // If masked, merge with existing
  if (existing) {
    const oldConfig = JSON.parse(existing.value);
    if (configToSave.resend_api_key && configToSave.resend_api_key.includes('***')) {
      configToSave.resend_api_key = oldConfig.resend_api_key;
    }
    if (configToSave.smtp_config?.pass === '********') {
      configToSave.smtp_config.pass = oldConfig.smtp_config.pass;
    }
  }

  const valueStr = JSON.stringify(configToSave);

  if (existing) {
    await db.update(systemSettings)
      .set({ value: valueStr, updatedAt: new Date() })
      .where(eq(systemSettings.key, 'mail_config'));
  } else {
    await db.insert(systemSettings)
      .values({ key: 'mail_config', value: valueStr });
  }

  return c.json({ success: true });
});

// GET /api/v1/settings/site_metadata
settingsRoutes.get('/site_metadata', requirePermission(['settings.general', 'role.manage']), async (c) => {
  const db = await createDbClient(c.env.DB);
  const record = await db.query.systemSettings.findFirst({
    where: eq(systemSettings.key, 'site_metadata')
  });

  if (!record) {
    return c.json({
      frontend_url: '',
      site_name: '',
      default_seo_templates: { title: '{{name}} - {{site_name}}', description: '{{description}}' }
    });
  }

  return c.json(JSON.parse(record.value));
});

// POST /api/v1/settings/site_metadata
settingsRoutes.post('/site_metadata', requirePermission(['settings.general', 'role.manage']), async (c) => {
  const body = await c.req.json();
  const db = await createDbClient(c.env.DB);
  
  const existing = await db.query.systemSettings.findFirst({
    where: eq(systemSettings.key, 'site_metadata')
  });

  const valueStr = JSON.stringify(body);

  if (existing) {
    await db.update(systemSettings)
      .set({ value: valueStr, updatedAt: new Date() })
      .where(eq(systemSettings.key, 'site_metadata'));
  } else {
    await db.insert(systemSettings)
      .values({ key: 'site_metadata', value: valueStr });
  }

  return c.json({ success: true });
});

// GET /api/v1/settings/ai_config
settingsRoutes.get('/ai_config', requirePermission(['settings.ai', 'role.manage']), async (c) => {
  const db = await createDbClient(c.env.DB);
  const record = await db.query.systemSettings.findFirst({
    where: eq(systemSettings.key, 'ai_config')
  });

  if (!record) {
    return c.json({
      success: true,
      value: JSON.stringify({
        accountId: '',
        gatewayId: 'main-ai-gateway',
        apiToken: '',
        openaiKey: '',
        workersAiToken: '',
        enabled: true
      })
    });
  }

  const config = JSON.parse(record.value);
  
  // Mask keys for safety
  const mask = (s: string) => s && s.length > 8 ? s.slice(0, 4) + '****' + s.slice(-4) : '********';
  if (config.apiToken) config.apiToken = mask(config.apiToken);
  if (config.openaiKey) config.openaiKey = mask(config.openaiKey);
  if (config.workersAiToken) config.workersAiToken = mask(config.workersAiToken);

  return c.json({ success: true, value: JSON.stringify(config) });
});

// POST /api/v1/settings/ai_config
settingsRoutes.post('/ai_config', requirePermission(['settings.ai', 'role.manage']), async (c) => {
  const { value } = await c.req.json();
  const db = await createDbClient(c.env.DB);
  const newConfig = JSON.parse(value);
  
  const existing = await db.query.systemSettings.findFirst({
    where: eq(systemSettings.key, 'ai_config')
  });

  if (existing) {
    const oldConfig = JSON.parse(existing.value);
    // Restore masked keys if they wasn't changed
    const restore = (key: string) => {
      if (newConfig[key] && newConfig[key].includes('****')) {
        newConfig[key] = oldConfig[key];
      }
    };
    restore('apiToken');
    restore('openaiKey');
    restore('workersAiToken');

    await db.update(systemSettings)
      .set({ value: JSON.stringify(newConfig), updatedAt: new Date() })
      .where(eq(systemSettings.key, 'ai_config'));
  } else {
    await db.insert(systemSettings)
      .values({ key: 'ai_config', value: JSON.stringify(newConfig) });
  }

  return c.json({ success: true });
});

// GET /api/v1/settings/site_domains
settingsRoutes.get('/site_domains', requirePermission(['settings.general', 'role.manage']), async (c) => {
  const db = await createDbClient(c.env.DB);
  const record = await db.query.systemSettings.findFirst({
    where: eq(systemSettings.key, 'site_domains')
  });

  if (!record) {
    return c.json({
      admin_domain: '',
      api_domain: '',
      public_domains: []
    });
  }

  return c.json(JSON.parse(record.value));
});

// POST /api/v1/settings/site_domains
settingsRoutes.post('/site_domains', requirePermission(['settings.general', 'role.manage']), async (c) => {
  const body = await c.req.json();
  const db = await createDbClient(c.env.DB);
  
  const existing = await db.query.systemSettings.findFirst({
    where: eq(systemSettings.key, 'site_domains')
  });

  const valueStr = JSON.stringify(body);

  if (existing) {
    await db.update(systemSettings)
      .set({ value: valueStr, updatedAt: new Date() })
      .where(eq(systemSettings.key, 'site_domains'));
  } else {
    await db.insert(systemSettings)
      .values({ key: 'site_domains', value: valueStr });
  }

  // --- 关键指令：清除高性能调度器缓存 ---
  if (c.env.NS_CONFIG) {
    c.executionCtx.waitUntil(c.env.NS_CONFIG.delete('site_domains'));
  }

  return c.json({ success: true });
});

// GET /api/v1/settings/member_levels
settingsRoutes.get('/member_levels', async (c) => {
  const db = await createDbClient(c.env.DB);
  const record = await db.query.systemSettings.findFirst({
    where: eq(systemSettings.key, 'member_levels')
  });

  if (!record) {
    const defaultLevels = [
      { level: 1, name: '普通会员' },
      { level: 2, name: '铜牌会员' },
      { level: 3, name: '银牌会员' },
      { level: 4, name: '金牌会员' },
      { level: 5, name: '钻石会员' }
    ];
    return c.json({ success: true, data: defaultLevels });
  }

  return c.json({ success: true, data: JSON.parse(record.value) });
});

// POST /api/v1/settings/member_levels
settingsRoutes.post('/member_levels', requirePermission(['settings.general', 'role.manage']), async (c) => {
  const body = await c.req.json();
  const db = await createDbClient(c.env.DB);
  
  const existing = await db.query.systemSettings.findFirst({
    where: eq(systemSettings.key, 'member_levels')
  });

  const valueStr = JSON.stringify(body);

  if (existing) {
    await db.update(systemSettings)
      .set({ value: valueStr, updatedAt: new Date() })
      .where(eq(systemSettings.key, 'member_levels'));
  } else {
    await db.insert(systemSettings)
      .values({ key: 'member_levels', value: valueStr });
  }

  return c.json({ success: true });
});

export default settingsRoutes;
