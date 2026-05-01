import { createDbClient, schema, eq } from '../db';

interface MailConfig {
  provider_type: 'resend' | 'smtp';
  resend_api_key?: string;
  sender_email?: string;
  smtp_config?: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
}

export class MailService {
  /**
   * 发送系统邮件
   */
  static async sendMail(
    env: any,
    options: {
      to: string | string[];
      subject: string;
      html: string;
      senderName?: string;
    }
  ) {
    const db = await createDbClient(env.DB);
    
    // 1. 获取全局邮件配置
    const record = await db.query.systemSettings.findFirst({
      where: eq(schema.systemSettings.key, 'mail_config')
    });

    if (!record) {
      console.warn('⚠️ [MailService] No mail_config found in system_settings.');
      return false;
    }

    const config: MailConfig = JSON.parse(record.value);
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    const senderEmail = config.sender_email || 'onboarding@resend.dev';
    const from = options.senderName ? `${options.senderName} <${senderEmail}>` : senderEmail;

    // 2. 根据不同的 Provider 发送
    if (config.provider_type === 'resend') {
      if (!config.resend_api_key) {
        throw new Error('Resend API Key is missing.');
      }
      
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.resend_api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: from,
          to: recipients,
          subject: options.subject,
          html: options.html
        })
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Resend API failed: ${res.status} ${err}`);
      }
      return true;
    } else if (config.provider_type === 'smtp') {
      // 模拟 SMTP 或使用外部 API。
      // 注意：Cloudflare Workers 环境原生不支持 TCP 端口直连 SMTP (除非使用 Socket 或 MailChannels)。
      console.log(`[MailService] Mock SMTP: Sending to ${recipients.join(',')}...`);
      // 如果有集成 MailChannels 等方案可在此实现
      return true;
    }

    return false;
  }
}
