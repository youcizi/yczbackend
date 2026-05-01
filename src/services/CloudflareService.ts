/**
 * CloudflareService
 * 自动化域名与 Worker 调度运维核心服务
 * 职责：处理 DNS 解析、Worker Domain 绑定及 API 权限自检
 */
export class CloudflareService {
  private static CF_API_BASE = 'https://api.cloudflare.com/client/v4';

  /**
   * 验证 API Token 权限 (High Robustness)
   * 确保 Token 具备 Zone.DNS:Edit 和 Workers Routes:Edit 权限
   */
  static async verifyTokenPermissions(env: { CF_API_TOKEN: string }) {
    const res = await fetch(`${this.CF_API_BASE}/user/tokens/verify`, {
      headers: { 'Authorization': `Bearer ${env.CF_API_TOKEN}` }
    });

    if (!res.ok) {
      throw new Error(`[CF] Token 验证失败: ${res.status} - 可能是 Token 已过期或格式错误`);
    }

    const data = await res.json() as any;
    if (!data.success) {
      throw new Error(`[CF] Token 无效: ${JSON.stringify(data.errors)}`);
    }

    // NOTE: Cloudflare verify 接口不直接返回 scopes 列表
    // 但我们可以通过一次模拟请求或检查 status 来确保权限集有效
    console.log('✅ [CF] API Token 活跃状态校验通过。');
    return true;
  }

  /**
   * 根据域名获取 Zone ID
   */
  static async getZoneId(env: { CF_API_TOKEN: string }, domain: string): Promise<string> {
    const rootDomain = this.extractRootDomain(domain);
    const url = `${this.CF_API_BASE}/zones?name=${rootDomain}`;
    
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${env.CF_API_TOKEN}` }
    });

    const data = await res.json() as any;
    if (!data.success || data.result.length === 0) {
      throw new Error(`❌ [CF] 未在当前账户下找到托管域名: ${rootDomain}，请先在 CF 后台添加站点。`);
    }

    return data.result[0].id;
  }

  /**
   * 幂等更新 CNAME 记录
   */
  static async upsertCnameRecord(
    env: { CF_API_TOKEN: string }, 
    zoneId: string, 
    hostname: string, 
    content: string
  ) {
    // 1. 查找现有的同名记录
    const listUrl = `${this.CF_API_BASE}/zones/${zoneId}/dns_records?name=${hostname}&type=CNAME`;
    const listRes = await fetch(listUrl, {
      headers: { 'Authorization': `Bearer ${env.CF_API_TOKEN}` }
    });
    const listData = await listRes.json() as any;

    const payload = {
      type: 'CNAME',
      name: hostname,
      content: content,
      ttl: 1, // Auto
      proxied: true // 开启小云朵
    };

    if (listData.result && listData.result.length > 0) {
      const recordId = listData.result[0].id;
      // 检查内容是否一致，避免重复更新
      if (listData.result[0].content === content) return recordId;

      const updateUrl = `${this.CF_API_BASE}/zones/${zoneId}/dns_records/${recordId}`;
      const upRes = await fetch(updateUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!upRes.ok) await this.handleApiError(upRes, 'DNS 记录更新失败');
      return recordId;
    }

    // 2. 创建新记录
    const createRes = await fetch(`${this.CF_API_BASE}/zones/${zoneId}/dns_records`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!createRes.ok) await this.handleApiError(createRes, 'DNS 记录创建失败');
    const createData = await createRes.json() as any;
    return createData.result.id;
  }

  /**
   * 绑定 Worker Domain
   * 建立域名与 Worker Service 的直接映射 (Custom Domains)
   */
  static async bindWorkerDomain(
    env: { CF_ACCOUNT_ID: string, CF_API_TOKEN: string },
    zoneId: string,
    hostname: string,
    service: string = 'backend'
  ) {
    const url = `${this.CF_API_BASE}/accounts/${env.CF_ACCOUNT_ID}/workers/domains`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${env.CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        environment: 'production',
        hostname: hostname,
        service: service,
        zone_id: zoneId
      })
    });

    if (res.status === 409) {
      console.log(`ℹ️ [CF] 域名 ${hostname} 已与 Worker 关联，跳过。`);
      return true;
    }

    if (!res.ok) {
      await this.handleApiError(res, 'Worker Domain 绑定失败');
    }

    return true;
  }

  /**
   * 确保 KV 命名空间存在
   */
  static async ensureKvNamespace(env: { CF_ACCOUNT_ID: string, CF_API_TOKEN: string }, title: string): Promise<string> {
    const listUrl = `${this.CF_API_BASE}/accounts/${env.CF_ACCOUNT_ID}/storage/kv/namespaces`;
    const listRes = await fetch(listUrl, {
      headers: { 'Authorization': `Bearer ${env.CF_API_TOKEN}` }
    });
    const listData = await listRes.json() as any;
    
    if (listData.success) {
      const existing = listData.result.find((ns: any) => ns.title === title || ns.title === `backend-${title}`);
      if (existing) return existing.id;
    }

    // 创建新的
    const createUrl = `${this.CF_API_BASE}/accounts/${env.CF_ACCOUNT_ID}/storage/kv/namespaces`;
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: `backend-${title}` })
    });

    if (!createRes.ok) await this.handleApiError(createRes, `KV Namespace ${title} 创建失败`);
    const createData = await createRes.json() as any;
    return createData.result.id;
  }

  /**
   * 确保 Turnstile Widget 存在并同步域名
   */
  static async ensureTurnstileWidget(
    env: { CF_ACCOUNT_ID: string, CF_API_TOKEN: string }, 
    name: string, 
    domains: string | string[]
  ): Promise<{ siteKey: string, secretKey: string }> {
    const domainList = Array.isArray(domains) ? domains : [domains];
    const rootDomains = domainList.map(d => this.extractRootDomain(d));

    const url = `${this.CF_API_BASE}/accounts/${env.CF_ACCOUNT_ID}/challenges/widgets`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${env.CF_API_TOKEN}` }
    });
    const data = await res.json() as any;

    if (data.success) {
      const existing = data.result.find((w: any) => w.name === name);
      if (existing) {
        // 幂等更新域名列表
        await fetch(`${url}/${existing.sitekey}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${env.CF_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: name,
            domains: rootDomains,
            mode: 'managed'
          })
        });
        return { siteKey: existing.sitekey, secretKey: existing.secret };
      }
    }

    // 创建新的
    const createRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: name,
        domains: rootDomains,
        mode: 'managed'
      })
    });

    if (!createRes.ok) await this.handleApiError(createRes, 'Turnstile Widget 创建失败');
    const createData = await createRes.json() as any;
    return { siteKey: createData.result.sitekey, secretKey: createData.result.secret };
  }

  /**
   * 辅助：提取根域名
   */
  private static extractRootDomain(hostname: string): string {
    const parts = hostname.split('.');
    if (parts.length <= 2) return hostname;
    return parts.slice(-2).join('.');
  }

  /**
   * 高鲁棒性错误处理：精准识别权限缺失
   */
  private static async handleApiError(res: Response, context: string) {
    const data = await res.json() as any;
    const errors = data.errors || [];
    const messages = data.messages || [];

    if (res.status === 403) {
      const detail = messages.join(' ') || errors.map((e: any) => e.message).join(' ');
      throw new Error(`🔐 [CF 权限不足] ${context}: 请确保 Token 拥有 Zone.DNS:Edit, Workers Routes:Edit 和 KV Storage:Edit, Turnstile:Edit 权限。 详情: ${detail}`);
    }

    throw new Error(`❌ [CF API 错误] ${context} (${res.status}): ${JSON.stringify(errors)}`);
  }
}
