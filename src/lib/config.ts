import { z } from 'zod';

/**
 * 全局配置 Schema
 * 包含环境变量校验逻辑
 */
export const ConfigSchema = z.object({
  // 数据库 ID (生产环境必须，开发环境可选)
  D1_DATABASE_ID: z.string().optional(),
  
  // API 密钥（示例：用于 AI 翻译或采集）
  OPENAI_API_KEY: z.string().optional(),
  EXTERNAL_SERP_KEY: z.string().optional(),

  // 系统运行环境
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // 默认管理员 Seed 密码 (开发环境提供默认值以防报错)
  DEFAULT_ADMIN_PASSWORD: z.string().min(8, 'DEFAULT_ADMIN_PASSWORD 必须至少 8 位').default('trade123456'),

  // 默认语言
  DEFAULT_LANGUAGE: z.string().default('zh-CN'),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * 校验并获取配置
 * @param env 原始环境变量对象 (优先使用)
 */
export function validateConfig(env: Record<string, any>): Config {
  // 合并环境：优先使用传入的 env，其次使用系统环境变量
  // 在 Astro Dev 模式下，.env 变量通常存在于 process.env 中
  const mergedEnv = {
    ...(globalThis as any).process?.env,
    ...env
  };

  const result = ConfigSchema.safeParse(mergedEnv);
  
  if (!result.success) {
    const errors = result.error.format();
    console.error('❌ [Config] 配置校验失败 Details:', JSON.stringify(errors, null, 2));
    console.error('❌ [Config] Merged Env keys:', Object.keys(mergedEnv));
    throw new Error('系统配置错误，请检查环境变量设置');
  }
  
  return result.data;
}

/**
 * 预设系统常量
 */
export const SYSTEM_PRESETS = {
  VERSION: '1.0.0-beta',
  MAX_SITES_PER_USER: 5,
  SUPPORT_THEMES: ['default', 'elegant'] as const,
};
