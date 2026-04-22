import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import cloudflare from '@astrojs/cloudflare';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://astro.build/config
export default defineConfig({
  output: 'server', // 开启 SSR 模式
  adapter: cloudflare({
    runtime: { mode: 'off' },
    platformProxy: {
      enabled: true,
      configPath: 'wrangler.toml',
    },
  }),
  vite: {
    plugins: [
      {
        name: 'ignore-native-modules',
        enforce: 'pre', // 确保在其他插件之前运行
        resolveId(id) {
          // 仅在生产环境构建时拦截
          if (process.env.NODE_ENV !== 'production') return null;

          const targets = [
            'better-sqlite3',
            'drizzle-orm/better-sqlite3',
            '@node-rs/bcrypt',
            '@node-rs/argon2',
            'oslo/password'
          ];
          if (targets.some(t => id === t || id.startsWith(t + '/'))) {
            return '\0ignore-native';
          }
          return null;
        },
        load(id) {
          if (id === '\0ignore-native') {
            return `
              export default {};
              export const hash = () => Promise.resolve('');
              export const verify = () => Promise.resolve(true);
              export const Scrypt = function() {
                this.hash = () => Promise.resolve('');
                this.verify = () => Promise.resolve(true);
              };
              export const drizzle = () => ({
                select: () => ({ from: () => ({ where: () => ({ get: () => Promise.resolve({}), all: () => Promise.resolve([]) }) }) }),
                insert: () => ({ values: () => ({ onConflictDoNothing: () => Promise.resolve({}), returning: () => ({ get: () => Promise.resolve({}) }) }) }),
              });
              export const sql = () => ({});
            `;
          }
        }
      }
    ],
    ssr: {
      // 生产环境将 Node 内置模块外置，利用 Cloudflare nodejs_compat
      // 包含带 node: 前缀和不带前缀的版本，确保 esbuild 不会尝试打包它们
      external: process.env.NODE_ENV === 'production' ? [
        'node:events', 'events',
        'node:fs', 'fs',
        'node:path', 'path',
        'node:util', 'util',
        'node:stream', 'stream',
        'node:buffer', 'buffer',
        'node:crypto', 'crypto',
        'node:os', 'os'
      ] : [],
      noExternal: process.env.NODE_ENV === 'production' ? ['drizzle-orm'] : []
    }
  },
  integrations: [react(), tailwind()],
  server: {
    port: 8787
  }
});
