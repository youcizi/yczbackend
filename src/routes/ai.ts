import { Hono } from 'hono';
import { streamText } from 'hono/streaming';
import { eq } from 'drizzle-orm';
import { createDbClient } from '../db';
import { systemSettings } from '../db/schema';
import { GatewayManager } from '../services/GatewayManager';
import { AiStreamingService } from '../services/AiStreamingService';

const ai = new Hono<{ Bindings: any }>();

/**
 * 助手：从配置或环境变量中获取 CF 凭据
 */
const getCfCredentials = (c: any, config: any) => {
  return {
    accountId: c.env.CF_ACCOUNT_ID || config.accountId,
    apiToken: c.env.CF_API_TOKEN || config.apiToken,
  };
};

/**
 * 公开访问中间件
 */
export const publicAiGateway = async (c: any, next: any) => {
  const db = await createDbClient(c.env.DB);
  const aiConfigRow = await db.select().from(systemSettings).where(eq(systemSettings.key, 'ai_config')).get();
  const siteMdRow = await db.select().from(systemSettings).where(eq(systemSettings.key, 'site_metadata')).get();

  const aiConfig = aiConfigRow ? JSON.parse(aiConfigRow.value) : {};
  const siteMetadata = siteMdRow ? JSON.parse(siteMdRow.value) : {};

  if (!aiConfig.enabled) {
    return c.json({ error: 'FORBIDDEN', message: 'AI 功能暂未开启。' }, 403);
  }

  const origin = c.req.header('origin') || c.req.header('referer') || '';
  const frontendUrl = siteMetadata.frontend_url || '';
  if (frontendUrl && !origin.includes(frontendUrl)) {
    return c.json({ error: 'FORBIDDEN', message: '域名校验失败。' }, 403);
  }

  await next();
};

/**
 * AI 流式对话接口
 */
ai.post('/chat', async (c) => {
  const db = await createDbClient(c.env.DB);
  const { providerId, modelId, messages, role = 'backend' } = await c.req.json();

  const aiConfigRow = await db.select().from(systemSettings).where(eq(systemSettings.key, 'ai_config')).get();
  if (!aiConfigRow) return c.json({ error: 'CONFIG_MISSING' }, 400);

  const config = JSON.parse(aiConfigRow.value);
  const { accountId, apiToken } = getCfCredentials(c, config);

  // 根据角色或指定 ID 查找 Provider
  const targetProviderId = providerId || (role === 'frontend' ? config.assignments?.frontend : config.assignments?.backend);
  const provider = config.providers?.find((p: any) => p.id === targetProviderId) || config.providers?.[0];

  if (!provider) return c.json({ error: 'PROVIDER_NOT_FOUND' }, 404);

  const activeModelId = modelId || (role === 'text' ? config.assignments?.text?.modelId : provider.models?.[0]?.id);

  try {
    const activeGatewayId = await GatewayManager.checkAndCreateGateway(accountId, apiToken, provider.gatewayId || 'main-gateway');
    
    // 灵活路由判定
    let targetUrl = (provider.baseUrl || '').replace(/\/+$/, '');
    let endpoint = '';

    if (provider.type === 'custom' && provider.routingMode === 'manual') {
      // 原生模式：直接请求完整地址
      // 注意：此时 targetUrl 就是最终地址，我们不再拼接 path
      endpoint = ''; 
    } else if (provider.type === 'openai' || provider.type === 'custom') {
      // 标准模式：根据地址智能补全 v1 路径
      if (!targetUrl) {
        targetUrl = GatewayManager.generateGatewayUrl(accountId, activeGatewayId, provider.type);
      }
      endpoint = targetUrl.includes('/v1') ? '/chat/completions' : '/v1/chat/completions';
    } else {
      // Workers AI 模式
      targetUrl = GatewayManager.generateGatewayUrl(accountId, activeGatewayId, provider.type);
      endpoint = `/${activeModelId}`;
    }
    
    const authHeader = (provider.type === 'openai' || provider.type === 'custom') 
      ? `Bearer ${provider.apiKey}` 
      : `Bearer ${apiToken}`;

    const response = await fetch(`${targetUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        model: (provider.type === 'openai' || provider.type === 'custom') ? activeModelId : undefined,
        stream: true
      })
    });

    return streamText(c, async (stream) => {
      if (!response.body) return;
      c.header('Content-Type', 'text/event-stream');
      const transformedStream = AiStreamingService.transformStream(response.body, provider.type);
      const reader = transformedStream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await stream.write(value);
      }
    });

  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * AI 图片生成接口 (NEW)
 */
ai.post('/image', async (c) => {
  const db = await createDbClient(c.env.DB);
  const { prompt, providerId, modelId } = await c.req.json();

  const aiConfigRow = await db.select().from(systemSettings).where(eq(systemSettings.key, 'ai_config')).get();
  const config = aiConfigRow ? JSON.parse(aiConfigRow.value) : {};
  const { accountId, apiToken } = getCfCredentials(c, config);

  const targetProviderId = providerId || config.assignments?.image?.providerId;
  const provider = config.providers?.find((p: any) => p.id === targetProviderId);
  const activeModelId = modelId || config.assignments?.image?.modelId;

  if (!provider || !activeModelId) return c.json({ error: 'IMAGE_PROVIDER_CONFIG_ERR' }, 400);

  try {
    const activeGatewayId = await GatewayManager.checkAndCreateGateway(accountId, apiToken, provider.gatewayId || 'image-gateway');
    
    let targetUrl = '';
    if (provider.type === 'custom' && provider.baseUrl) {
      targetUrl = provider.baseUrl.endsWith('/') ? provider.baseUrl.slice(0, -1) : provider.baseUrl;
    } else {
      targetUrl = GatewayManager.generateGatewayUrl(accountId, activeGatewayId, provider.type);
    }
    
    // 不同 Provider 的图片生成 Endpoint 不同
    const endpoint = (provider.type === 'openai' || provider.type === 'custom') 
      ? '/v1/images/generations' 
      : `/${activeModelId}`;
      
    const authHeader = (provider.type === 'openai' || provider.type === 'custom') 
      ? `Bearer ${provider.apiKey}` 
      : `Bearer ${apiToken}`;

    const response = await fetch(`${targetUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify((provider.type === 'openai' || provider.type === 'custom') 
        ? { prompt, model: activeModelId, n: 1, size: '1024x1024' } 
        : { prompt })
    });

    const result = await response.json();
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default ai;
