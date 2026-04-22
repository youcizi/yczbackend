import { Hono } from 'hono';
import { CloudflareService } from '../services/CloudflareService';

const infra = new Hono<{ Bindings: any }>();

/**
 * DNS 解析健康检查
 */
infra.get('/dns-check', async (c) => {
  const domain = c.req.query('domain');
  if (!domain) return c.json({ error: 'Domain required' }, 400);

  try {
    await CloudflareService.verifyTokenPermissions(c.env);

    let zoneId = '';
    try {
      zoneId = await CloudflareService.getZoneId(c.env, domain);
    } catch (e) {
      return c.json({ 
        zone_found: false, 
        cname_correct: false, 
        recommendation: '该域名未在当前账户托管，请先在 Cloudflare 中添加站点。' 
      });
    }

    // 执行 DoH 探测
    const dohUrl = `https://cloudflare-dns.com/dns-query?name=${domain}&type=CNAME`;
    const dnsRes = await fetch(dohUrl, {
      headers: { 'Accept': 'application/dns-json' }
    });
    const dnsData = await dnsRes.json() as any;
    const answers = dnsData.Answer || [];
    const isCnameCorrect = answers.some((a: any) => a.type === 5);

    return c.json({
      zone_found: true,
      zone_id: zoneId,
      cname_correct: isCnameCorrect,
      recommendation: isCnameCorrect 
        ? '解析正常，可以执行 Worker 绑定。' 
        : '未检出 CNAME 解析，请先添加 CNAME 指向本项目。'
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * 执行域名物理绑定任务 (流水线模式)
 */
infra.post('/bind-domain', async (c) => {
  const { domain } = await c.req.json();
  if (!domain) return c.json({ error: '域名不能为空' }, 400);

  const env = c.env;
  let currentStep = '权限自检';

  try {
    await CloudflareService.verifyTokenPermissions(env);

    currentStep = '解析域名托管状态';
    const zoneId = await CloudflareService.getZoneId(env, domain);

    currentStep = '配置 DNS 记录 (CNAME)';
    // 自动生成 Worker 宿主地址 (CF 标准格式)
    const workerHost = `${env.CF_ACCOUNT_ID}.workers.dev`; 
    await CloudflareService.upsertCnameRecord(env, zoneId, domain, workerHost);

    currentStep = '激活 Worker Domain 映射';
    await CloudflareService.bindWorkerDomain(env, zoneId, domain, 'backend');

    return c.json({ 
      success: true, 
      message: `域名 ${domain} 已成功激活并完成解析绑定。` 
    });

  } catch (err: any) {
    console.error(`❌ [Bind-Domain Error] @ ${currentStep}:`, err);
    return c.json({
      success: false,
      step: currentStep,
      error: err.message,
      recommendation: `在 [${currentStep}] 阶段失败：${err.message}`
    }, 500);
  }
});

export default infra;
