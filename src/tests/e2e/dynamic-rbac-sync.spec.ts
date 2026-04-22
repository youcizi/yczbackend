import { test, expect } from '@playwright/test';

test.describe('动态 RBAC 权限同步深度审计', () => {
  
  test('验证：创建集合即自动生成权限，删除集合即自动清理权限', async ({ page }) => {
    // 监听控制台错误 (零 ReferenceError 审计)
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    // 1. 登录
    await page.goto('/login');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(admin|dashboard)/);

    const uniqueId = Date.now();
    const modelName = `RBAC_Model_${uniqueId}`;
    const modelSlug = `rbac_model_${uniqueId}`;
    const collName = `RBAC_Coll_${uniqueId}`;
    const collSlug = `rbac_coll_${uniqueId}`;

    // 2. 创建模型
    await page.goto('/admin/models');
    await page.click('button:has-text("新建模型")');
    const modelDialog = page.locator('div[role="dialog"]');
    await modelDialog.locator('#name').fill(modelName);
    await modelDialog.locator('#slug').fill(modelSlug);
    await modelDialog.getByPlaceholder('e.g. title').fill('title');
    await modelDialog.getByPlaceholder('e.g. 标题').fill('标题');
    await modelDialog.getByRole('button', { name: /添加/ }).click();
    await modelDialog.getByRole('button', { name: "保存模型定义" }).click();
    await page.waitForLoadState('networkidle');

    // 3. 创建业务集合 (触发权限创建)
    await page.goto('/admin/collections');
    await page.click('button:has-text("创建新集合")');
    const collDialog = page.locator('div[role="dialog"]');
    await collDialog.getByPlaceholder('如：官方博客').fill(collName);
    await collDialog.getByPlaceholder('blog').fill(collSlug);
    await collDialog.locator('select').first().selectOption({ label: `${modelName} (${modelSlug})` });
    await collDialog.getByRole('button', { name: "确认创建" }).click();
    await page.waitForLoadState('networkidle');

    // 4. 核心验证：跳转到角色管理，校验动态权限是否已在列表中呈现
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');

    // 目前系统中有一个 SuperAdmin 角色，点击其编辑按钮
    const roleRow = page.locator('tr').filter({ hasText: 'SuperAdmin' });
    await expect(roleRow).toBeVisible();
    
    // 定位编辑按钮 (基于 RolesManagement.tsx:239-241)
    // 使用 svg.lucide-edit-2 或者更通用的 selector
    await roleRow.locator('button').first().click();
    
    // 进入权限网格，检查是否存在新增的权限分类和条目
    // 权限分类通常带有 "业务集合: RBAC_Coll_..." 字样
    await page.waitForTimeout(1000); // 等待 Sheet 动画和数据加载稳定
    const editingSheet = page.getByRole('dialog').filter({ hasText: /编辑职能权限|定义新角色/ }).last();
    await expect(editingSheet).toContainText(`业务集合: ${collName}`, { timeout: 15000 });
    await expect(editingSheet).toContainText(`查看${collName}`);
    await expect(editingSheet).toContainText(`编辑/保存${collName}`);
    await expect(editingSheet).toContainText(`删除${collName}`);

    // 5. 权威同步验证：回到集合列表，删除该集合
    await page.goto('/admin/collections');
    const deleteRow = page.locator('tr').filter({ hasText: collName });
    await expect(deleteRow).toBeVisible();
    await deleteRow.locator('button:has(svg.lucide-trash2)').click();
    await page.click('button:has-text("执行解绑")');
    await page.waitForLoadState('networkidle');

    // 6. 核心验证：再次回到角色管理，确认对应的权限分类和条目已消失 (权威清理)
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');
    await roleRow.locator('button').first().click();
    
    // 确认此时列表中不应存在该集合的权限
    const finalSheet = page.getByRole('dialog').filter({ hasText: /编辑职能权限|定义新角色/ }).last();
    await expect(finalSheet).not.toContainText(`业务集合: ${collName}`, { timeout: 15000 });
    await expect(finalSheet).not.toContainText(`查看${collName}`);

    // 7. ReferenceError 校验
    const refErrors = consoleErrors.filter(e => e.includes('ReferenceError'));
    expect(refErrors.length, `RBAC 流程不应产生 JS 报错。已发现: ${refErrors.join('; ')}`).toBe(0);
  });
});
