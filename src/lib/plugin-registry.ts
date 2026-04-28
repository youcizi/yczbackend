import { lazy } from 'react';

/**
 * 插件交响乐：核心资产注册表 (自动化集成版)
 * 
 * 这里的 PLUGIN_CODE_REGISTRY 现在由 ../lib/auto-registry.gen.ts 驱动。
 * 该文件是由 scripts/sync-plugins.mjs 在构建/开发前扫描 src/plugins 目录后自动生成的。
 */

export * from './auto-registry.gen';
