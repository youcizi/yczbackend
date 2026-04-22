import { test, expect } from '@playwright/test';

test.describe('内容管理全链路 CRUD 审计 (终极版)', () => {
  
  test('验证：增、删、改完整交互流及零 ReferenceError', async ({ page }) => {
    // 监听控制台错误
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        process.env.DEBUG_TEST && console.log(`[Browser Console Error] ${msg.text()}`);
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      process.env.DEBUG_TEST && console.log(`[Browser Page Error] ${err.message}`);
      consoleErrors.push(err.message);
    });

    // 1. 登录
    await page.goto('/login');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(admin|dashboard)/);

    // 2. 环境自愈：确保存在测试模型和集合
    const uniqueId = Date.now();
    const modelName = `AUDIT Model ${uniqueId}`;
    const modelSlug = `audit-model-${uniqueId}`;
    const collName = `AUDIT Coll ${uniqueId}`;
    const collSlug = `audit-coll-${uniqueId}`;

    // A. 创建模型 (直接导航以规避侧边栏延迟)
    await page.goto('/admin/models');
    await page.click('button:has-text("新建模型")');
    await page.fill('#name', modelName);
    await page.fill('#slug', modelSlug);
    await page.fill('[placeholder="e.g. title"]', 'title');
    await page.fill('[placeholder="e.g. 标题"]', '标题');
    await page.click('button:has-text("添加")');
    await page.click('button:has-text("保存模型定义")');
    await page.waitForLoadState('networkidle');

    // B. 创建集合 (直接导航)
    await page.goto('/admin/collections');
    await page.click('button:has-text("创建新集合")');
    await page.fill('[placeholder="如：官方博客"]', collName);
    await page.fill('[placeholder="blog"]', collSlug);
    // 使用最宽松的 .first() 定位，彻底无视同页面的其他 Select (如 Astro Dev Toolbar)
    await page.locator('select').first().selectOption({ label: `${modelName} (${modelSlug})` });
    await page.click('button:has-text("确认创建")');
    await page.waitForLoadState('networkidle');

    // 3. 进入集合管理 (直接通过 URL 进入)
    await page.goto(`/admin/collections/${collSlug}`);

    // --- CRUD: CREATE (Multi-language) ---
    await page.click('button:has-text("新增记录")');
    const englishTitle = `EN Record ${uniqueId}`;
    await page.fill('input[id="title"]', englishTitle);

    // --- MediaPicker Integration Check ---
    // 假设模型中有 image 字段 (EntryForm 会渲染 MediaPicker)
    const pickerBtn = page.locator('button:has-text("点击选取")').first();
    if (await pickerBtn.isVisible({ timeout: 2000 })) {
       await pickerBtn.click();
       const mediaDialog = page.getByRole('dialog').filter({ hasText: /附件库|选取附件/ }).last();
       await expect(mediaDialog).toBeVisible();
       // 模拟选择第一个附件 (如果有)
       const firstMedia = mediaDialog.locator('img').first();
       if (await firstMedia.isVisible()) {
          await firstMedia.click();
       } else {
          // 如果没有附件，尝试上传一个测试文件 (如果环境支持)
          await mediaDialog.locator('button:has-text("取消")').click();
       }
    }

    // 模拟 Tab 切换到“中文” (假设测试环境中已预设 zh-CN)
    // 根据 EntryForm.tsx，新增模式下是 grid 中的按钮
    const zhTab = page.locator('button', { hasText: 'Chinese' });
    if (await zhTab.isVisible()) {
       await zhTab.click();
       const chineseTitle = `中文记录 ${uniqueId}`;
       await page.fill('input[id="title"]', chineseTitle);
    }

    // --- CREATE Save ---
    const createPromise = page.waitForResponse(r => r.url().includes(`/api/v1/entities/${collSlug}`) && r.status() === 200);
    await page.click('button:has-text("保存更改")');
    await createPromise;
    
    // 深度校验：保存后 Dialog 应该关闭
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500); // 增加列表刷新缓冲

    // 验证新记录在表格中出现
    await expect(page.locator('table')).toContainText(englishTitle);

    // --- CRUD: UPDATE ---
    const row = page.locator('tr').filter({ hasText: englishTitle });
    await row.hover();
    await row.locator('[data-testid="edit-button"]').click();
    
    const updatedTitle = `Record Updated ${uniqueId}`;
    await page.fill('input[id="title"]', updatedTitle);

    const updatePromise = page.waitForResponse(r => r.url().includes(`/api/v1/entities/${collSlug}`) && r.status() === 200);
    await page.click('button:has-text("保存更改")');
    await updatePromise;
    
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    await expect(page.locator('table')).toContainText(updatedTitle);

    // --- CRUD: DELETE ---
    const updatedRow = page.locator('tr', { hasText: updatedTitle }).last();
    await updatedRow.hover();
    await updatedRow.locator('[data-testid="delete-button"]').click();
    
    const confirmBtn = page.getByTestId('confirm-delete-button');
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });

    const deletePromise = page.waitForResponse(r => r.url().includes(`/api/v1/entities/${collSlug}`) && r.status() === 200);
    await confirmBtn.click();
    await deletePromise;

    // 验证删除成功
    await expect(page.locator('table')).not.toContainText(updatedTitle, { timeout: 10000 });

    // 4. 最终 ReferenceError 审计
    const refErrors = consoleErrors.filter(e => e.includes('ReferenceError'));
    expect(refErrors.length, `不应存在任何 ReferenceError。已发现: ${refErrors.join('; ')}`).toBe(0);
  });
});
