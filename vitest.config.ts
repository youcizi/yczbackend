// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/helpers/setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './src/tests'),
    },
    include: ['src/tests/{unit,integration}/**/*.{test,spec}.{ts,tsx}'],

    server: {
      deps: {
        inline: [/@lucia-auth\/adapter-drizzle/, /oslo/, /lucia/]
      }
    },

    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'lcov'],   // 保留 text 用于控制台查看
      reportsDirectory: './test-reports/coverage',   // ← 改成根目录下的 test-reports
      clean: true,                                   // 每次运行前清空
      reportOnFailure: true,                         // ← 重要！即使测试失败也生成报告
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/tests/**/*', 'src/db/**/*', '**/node_modules/**'],
    },
  },
});