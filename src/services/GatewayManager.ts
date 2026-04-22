/**
 * GatewayManager
 * 自动化管理 Cloudflare AI Gateway
 * 职责：检查、创建并生成 AI 网关 URL
 */
export class GatewayManager {
  private static CF_API_BASE = 'https://api.cloudflare.com/client/v4';

  /**
   * 幂等式确保指定名称的 AI Gateway 已创建
   * @param accountId Cloudflare Account ID
   * @param apiToken 拥有 Account.AI Gateway:Edit 权限的 Token
   * @param gatewayId 网关唯一标识，建议如 'main-gateway'
   */
  static async checkAndCreateGateway(accountId: string, apiToken: string, gatewayId: string) {
    const gatewayUrl = `${this.CF_API_BASE}/accounts/${accountId}/ai-gateway/gateways/${gatewayId}`;

    // 1. 发起探测请求
    const getResponse = await fetch(gatewayUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    // 若已经存在 (200 OK)，直接返回
    if (getResponse.status === 200) {
      console.log(`✅ [GatewayManager] AI Gateway '${gatewayId}' 已经存在。`);
      return gatewayId;
    }

    // 2. 若返回 404，发起创建请求
    if (getResponse.status === 404) {
      console.log(`🚀 [GatewayManager] 发现网关缺失，正在申请创建: ${gatewayId}`);
      
      const createResponse = await fetch(`${this.CF_API_BASE}/accounts/${accountId}/ai-gateway/gateways`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: gatewayId,
          settings: {
            cache_enabled: true,
            collect_logs: true,
            logpersistance_enabled: true
          }
        })
      });

      // 如果返回 409 (Conflict)，说明并发或已存在，逻辑上视为成功
      if (createResponse.status === 201 || createResponse.status === 409) {
        console.log(`📦 [GatewayManager] AI Gateway '${gatewayId}' 创建成功或已存在。`);
        return gatewayId;
      }

      const errorText = await createResponse.text();
      throw new Error(`[GatewayManager] AI Gateway 创建失败: ${createResponse.status} - ${errorText}`);
    }

    const errorText = await getResponse.text();
    throw new Error(`[GatewayManager] 探测网关状态异常: ${getResponse.status} - ${errorText}`);
  }

  /**
   * 动态生成适配提供商的网关前缀 URL
   */
  static generateGatewayUrl(accountId: string, gatewayId: string, provider: 'openai' | 'workers-ai') {
    return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/${provider}`;
  }
}
