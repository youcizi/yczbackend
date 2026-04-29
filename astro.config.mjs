import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import cloudflare from '@astrojs/cloudflare';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { vitePluginWeaver } from './src/lib/vite-plugin-weaver';

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
    optimizeDeps: {
      exclude: ['@astrojs/cloudflare']
    },
    plugins: [
      vitePluginWeaver(),
      {
        name: 'ignore-native-modules',
        enforce: 'pre',
        resolveId(id) {
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
