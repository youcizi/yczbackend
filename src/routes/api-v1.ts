import { Hono } from 'hono';
import { TemplateService } from '../services/TemplateService';
import crmRoutes from './crm';

const apiV1 = new Hono<{ Bindings: any }>();

apiV1.route('/crm', crmRoutes);

apiV1.post('/system/init-template', async (c) => {
  try {
    const result = await TemplateService.initB2BTemplate(c.env.DB);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

apiV1.get('/system/templates', async (c) => {
  const suites = TemplateService.getIndustrySuites();
  // 为了前端显示，我们需要简单处理一下 modules，主要暴露 ID 和依赖
  const data = suites.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    modules: s.modules.map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
      dependencies: m.dependencies || []
    }))
  }));
  return c.json(data);
});

apiV1.post('/system/init-custom', async (c) => {
  const { moduleIds } = await c.req.json();
  if (!moduleIds || !Array.isArray(moduleIds)) {
    return c.json({ error: 'moduleIds is required and must be an array' }, 400);
  }
  try {
    const result = await TemplateService.initCustomModules(c.env.DB, moduleIds);
    return c.json(result);
  } catch (err: any) {
    console.error(`❌ [InitCustom] Error:`, err); // 关键：在 500 前抓取真实报错
    return c.json({ error: err.message, stack: err.stack }, 500);
  }
});

apiV1.get('/sites', (c) => c.json({ message: 'List sites' }));
apiV1.post('/sites', (c) => c.json({ message: 'Create site' }));

export default apiV1;
