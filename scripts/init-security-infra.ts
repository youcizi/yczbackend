import { CloudflareService } from '../src/services/CloudflareService';
import fs from 'fs';
import path from 'path';

async function main() {
  const wranglerPath = path.join(process.cwd(), 'wrangler.toml');
  let wranglerContent = fs.readFileSync(wranglerPath, 'utf8');

  // 1. 解析配置
  const accountIdMatch = wranglerContent.match(/CF_ACCOUNT_ID\s*=\s*"([^"]+)"/);
  const apiTokenMatch = wranglerContent.match(/CF_API_TOKEN\s*=\s*"([^"]+)"/);

  if (!accountIdMatch || !apiTokenMatch) {
    console.error('❌ [Setup] wrangler.toml 中未找到 CF_ACCOUNT_ID 或 CF_API_TOKEN');
    process.exit(1);
  }

  const env = {
    CF_ACCOUNT_ID: accountIdMatch[1],
    CF_API_TOKEN: apiTokenMatch[1]
  };

  console.log('🚀 [Setup] 正在初始化 Cloudflare 安全基础设施...');

  try {
    // 2. 创建 KV RATE_LIMITER
    const kvId = await CloudflareService.ensureKvNamespace(env, 'RATE_LIMITER');
    console.log(`✅ [Setup] KV RATE_LIMITER ID: ${kvId}`);

    // 3. 创建 Turnstile Widget
    // 增加 localhost 支持本地开发调试
    const turnstile = await CloudflareService.ensureTurnstileWidget(
      env, 
      'Member Login Protection', 
      ['ycz.me', 'localhost', '127.0.0.1'] as any
    );
    console.log(`✅ [Setup] Member Turnstile Site Key: ${turnstile.siteKey}`);

    const adminTurnstile = await CloudflareService.ensureTurnstileWidget(
      env,
      'Admin Login Protection',
      ['ycz.me', 'localhost', '127.0.0.1'] as any
    );
    console.log(`✅ [Setup] Admin Turnstile Site Key: ${adminTurnstile.siteKey}`);

    // 4. 更新 wrangler.toml
    // 检查是否已有 RATE_LIMITER 绑定
    if (!wranglerContent.includes('binding = "RATE_LIMITER"')) {
      const kvEntry = `\n[[kv_namespaces]]\nbinding = "RATE_LIMITER"\nid = "${kvId}"\n`;
      wranglerContent = wranglerContent.replace('# KV 缓存绑定 (用于域名调度)', '# KV 缓存绑定 (用于域名调度)' + kvEntry);
    }

    // 更新环境变量
    if (!wranglerContent.includes('TURNSTILE_SITE_KEY')) {
      const varsUpdate = `\nTURNSTILE_SITE_KEY = "${turnstile.siteKey}"\nTURNSTILE_SECRET_KEY = "${turnstile.secretKey}"\n`;
      wranglerContent = wranglerContent.replace('[vars]', '[vars]' + varsUpdate);
    }
    
    if (!wranglerContent.includes('TURNSTILE_ADMIN_SITE_KEY')) {
      const adminVarsUpdate = `\nTURNSTILE_ADMIN_SITE_KEY = "${adminTurnstile.siteKey}"\nTURNSTILE_ADMIN_SECRET_KEY = "${adminTurnstile.secretKey}"\n`;
      wranglerContent = wranglerContent.replace('[vars]', '[vars]' + adminVarsUpdate);
    }

    fs.writeFileSync(wranglerPath, wranglerContent);
    console.log('🎉 [Setup] wrangler.toml 已更新。');

  } catch (err: any) {
    console.error('❌ [Setup] 失败:', err.message);
    process.exit(1);
  }
}

main();
