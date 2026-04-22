import { Hono } from 'hono';
import { InquiryService } from '../services/InquiryService';
import { createDbClient } from '../db';
import { requirePermission } from '../lib/rbac';

const crmRoutes = new Hono<{ Bindings: any }>();

// GET /api/v1/crm/inquiries - 获取当前租户的专用询盘列表 (Dedicated Module)
crmRoutes.get('/inquiries', async (c) => {
  const db = await createDbClient(c.env.DB);
  const domains = c.get('domains' as any) || c.get('site_domains' as any);
  
  // 必须具备租户上下文
  if (!domains) return c.json({ error: 'Tenant context mismatch' }, 500);
  const tenantId = domains.tenant_id || domains.id || (domains.site_domains ? domains.site_domains.id : 0);

  try {
    const list = await InquiryService.listInquiries(db, Number(tenantId));
    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET /api/v1/crm/leads - 获取聚合后的线索列表 (Legacy Engine)
crmRoutes.get('/leads', async (c) => {
  const db = await createDbClient(c.env.DB);
  try {
    const leads = await InquiryService.getAllLeads(db);
    return c.json(leads);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET /api/v1/crm/stats - 获取线索统计数据
crmRoutes.get('/stats', async (c) => {
  const db = await createDbClient(c.env.DB);
  try {
    const stats = await InquiryService.getLeadsStats(db);
    return c.json(stats);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// PATCH /api/v1/crm/leads/:id/status - 更新线索状态或备注
crmRoutes.patch('/leads/:id/status', async (c) => {
  const id = parseInt(c.req.param('id'));
  const body = await c.req.json();
  const db = await createDbClient(c.env.DB);
  const user = (c.get('user') as any) || { username: 'admin' };

  try {
    const result = await InquiryService.updateCrmStatus(
      db, 
      id, 
      body.status, 
      body.note, 
      body.username || user.username
    );
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default crmRoutes;
