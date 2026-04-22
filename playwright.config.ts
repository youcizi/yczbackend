// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/tests/e2e',
  timeout: 60 * 1000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,

  // 配置 HTML 报告输出到指定文件夹
  reporter: [
    ['html', {
      outputFolder: './test-reports/playwright-report',   // ← 关键配置
      open: 'never'                                      // 不要自动打开浏览器
    }],
    ['list']   // 保留终端简洁输出
  ],

  use: {
    baseURL: 'http://localhost:8787',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});