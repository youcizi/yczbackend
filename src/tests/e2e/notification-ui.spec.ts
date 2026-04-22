import { test, expect } from '@playwright/test';

test.describe('Notification Hook UI & Variable Hints Audit', () => {
  
  test('Variable hints should dynamically update based on the selected collection model', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(admin|dashboard)/);

    // 2. Preparation: Create two different models
    const uniqueId = Date.now();
    
    // Model A: Inquiry
    await page.goto('/admin/models');
    await page.click('button:has-text("新建模型")');
    await page.fill('#name', `ModelA ${uniqueId}`);
    await page.fill('#slug', `model-a-${uniqueId}`);
    await page.fill('[placeholder="e.g. title"]', 'field_a');
    await page.fill('[placeholder="e.g. 标题"]', 'Field A Label');
    await page.click('button:has-text("添加")');
    await page.click('button:has-text("保存模型定义")');
    await page.waitForLoadState('networkidle');

    // Model B: Feedback
    await page.goto('/admin/models');
    await page.click('button:has-text("新建模型")');
    await page.fill('#name', `ModelB ${uniqueId}`);
    await page.fill('#slug', `model-b-${uniqueId}`);
    await page.fill('[placeholder="e.g. title"]', 'field_b');
    await page.fill('[placeholder="e.g. 标题"]', 'Field B Label');
    await page.click('button:has-text("添加")');
    await page.click('button:has-text("保存模型定义")');
    await page.waitForLoadState('networkidle');

    // 3. Create collections for both
    await page.goto('/admin/collections');
    await page.click('button:has-text("创建新集合")');
    await page.fill('[placeholder="如：官方博客"]', `CollA ${uniqueId}`);
    await page.fill('[placeholder="blog"]', `coll-a-${uniqueId}`);
    await page.locator('select').first().selectOption({ label: `ModelA ${uniqueId} (model-a-${uniqueId})` });
    await page.click('button:has-text("确认创建")');
    await page.waitForLoadState('networkidle');

    await page.goto('/admin/collections');
    await page.click('button:has-text("创建新集合")');
    await page.fill('[placeholder="如：官方博客"]', `CollB ${uniqueId}`);
    await page.fill('[placeholder="blog"]', `coll-b-${uniqueId}`);
    await page.locator('select').first().selectOption({ label: `ModelB ${uniqueId} (model-b-${uniqueId})` });
    await page.click('button:has-text("确认创建")');
    await page.waitForLoadState('networkidle');

    // 4. Verify Variable Hints for CollA
    await page.goto('/admin/collections');
    // Find the row for CollA and click the settings button
    const rowA = page.locator('tr').filter({ hasText: `CollA ${uniqueId}` });
    await rowA.locator('button').filter({ has: page.locator('svg') }).click(); // Click the gear icon

    await page.click('button:has-text("通知钩子")');
    await page.click('button:has-text("启用通知钩子")'); // Toggle switch via label if it's a switch
    // Check if the switch is on. If it's a Radix switch, it might be different. 
    // Let's assume the switch is interactive and the label works or just click the switch.
    await page.locator('button[role="switch"]').click();

    // Assert that {{field_a}} is present in hints
    await expect(page.locator('button:has-text("{{field_a}}")')).toBeVisible();
    await expect(page.locator('button:has-text("{{field_b}}")')).not.toBeVisible();

    // 5. Verify Variable Hints for CollB
    await page.click('button:has-text("取消")'); // Close dialog
    const rowB = page.locator('tr').filter({ hasText: `CollB ${uniqueId}` });
    await rowB.locator('button').filter({ has: page.locator('svg') }).click();

    await page.click('button:has-text("通知钩子")');
    await page.locator('button[role="switch"]').click();

    await expect(page.locator('button:has-text("{{field_b}}")')).toBeVisible();
    await expect(page.locator('button:has-text("{{field_a}}")')).not.toBeVisible();

    // 6. Test Copy Functionality
    await page.click('button:has-text("{{field_b}}")');
    // Verify toast (if using lucide-toast or shadcn toast)
    await expect(page.locator('text=已复制')).toBeVisible();
  });
});
