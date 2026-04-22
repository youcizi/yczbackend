import { Hono } from 'hono';

/**
 * 示例插件: 数字员工 (Digital Worker)
 * 这是一个独立的 Worker 应用，将通过 Service Binding 与主系统通信
 */
const app = new Hono();

// 插件基础信息接口
app.get('/info', (c) => {
  return c.json({
    name: 'Digital Worker Plugin',
    version: '1.0.5',
    status: 'healthy',
    capabilities: ['chat', 'workflow', 'automation'],
    uischema: {
      type: 'plugin-dashboard',
      slug: 'digital-worker'
    }
  });
});

// 处理具体业务逻辑的示例接口
app.post('/jobs', async (c) => {
  const body = await c.req.json();
  return c.json({
    success: true,
    jobId: 'dw-' + Math.random().toString(36).slice(2),
    received: body
  });
});

export default app;
