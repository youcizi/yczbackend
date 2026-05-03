import { Hono } from 'hono';
import { createDbClient } from '../db';
import { mailMessages } from '../db/schema';

const webhooks = new Hono<{ Bindings: any }>();

webhooks.post('/stripe', (c) => c.json({ message: 'Stripe webhook handler' }));
webhooks.post('/github', (c) => c.json({ message: 'Github webhook handler' }));

/**
 * 邮件入站 Webhook (Inbound Email)
 * 用于接收外部服务商推送的客户回复
 */
webhooks.post('/mail/inbound', async (c) => {
  try {
    const body = await c.req.json();
    const db = await createDbClient(c.env.DB);
    
    // 适配常见服务商 (如 Resend Inbound, SendGrid Parse) 的字段
    const from = body.from || body.sender || body.from_email;
    const to = body.to || body.recipient || body.to_email;
    const subject = body.subject || 'No Subject';
    const content = body.text || body.content || body.body || '';
    
    if (!from || !content) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // 生成或提取会话 ID (Thread ID)
    // 生产环境建议通过消息头中的 Message-ID / In-Reply-To 追踪，此处简易实现
    const threadId = body.thread_id || from.replace(/[@.]/g, '_');

    await db.insert(mailMessages).values({
      threadId,
      fromEmail: from,
      toEmail: to,
      subject,
      content,
      direction: 'inbound',
      status: 'unread'
    });

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default webhooks;
