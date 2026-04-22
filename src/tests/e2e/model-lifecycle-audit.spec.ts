import { test, expect } from '@playwright/test';

test.describe('模型生命周期与动态字段深度审计', () => {
  
  test('验证：模型创建 -> 集合绑定 -> 枚举选项配置 -> 数据映射渲染', async ({ page }) => {
    // 监听控制台错误
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
    const modelName = `Model_${uniqueId}`;
    const modelSlug = `model_${uniqueId}`;
    const collName = `Coll_${uniqueId}`;
    const collSlug = `coll_${uniqueId}`;

    // 2. 创建复杂模型
    await page.goto('/admin/models');
    await page.click('button:has-text("新建模型")');
    
    // 等待对话框完全可见
    const dialog = page.locator('div[role="dialog"]');
    await expect(dialog).toBeVisible();

    await dialog.locator('#name').fill(modelName);
    await dialog.locator('#slug').fill(modelSlug);

    const addField = async (label: string, type: string, key: string) => {
      const fieldForm = dialog.locator('div.bg-slate-50'); // 刚才修复的 grid 容器
      await fieldForm.getByPlaceholder('e.g. 标题').fill(label);
      await fieldForm.locator('select').selectOption(type);
      await fieldForm.getByPlaceholder('e.g. title').fill(key);
      await fieldForm.getByRole('button', { name: /添加/ }).click();
      await page.waitForTimeout(200); // 避免连续点击过快
    };

    // 添加多种类型的枚举与文本字段
    await addField('标题', 'text', 'title');
    await addField('状态单选', 'radio', 'status');
    await addField('多选标签', 'checkbox', 'tag_list'); // 修改 key 避免关键词冲突
    await addField('下拉选择', 'select', 'category');

    await dialog.getByRole('button', { name: "保存模型定义" }).click();
    await page.waitForTimeout(1000); 

    // 3. 创建业务集合
    await page.goto('/admin/collections');
    await page.click('button:has-text("创建新集合")');
    
    const collDialog = page.locator('div[role="dialog"]');
    await expect(collDialog).toBeVisible();

    await collDialog.getByPlaceholder('如：官方博客').fill(collName);
    await collDialog.getByPlaceholder('blog').fill(collSlug);
    // 选择刚创建的模型
    await collDialog.locator('select').first().selectOption({ label: `${modelName} (${modelSlug})` });
    await collDialog.getByRole('button', { name: "确认创建" }).click();
    await page.waitForTimeout(1000);

    // 4. 配置枚举选项 (OptionEditor)
    const row = page.locator('tr', { hasText: collName });
    await expect(row).toBeVisible();
    await row.locator('button:has(svg.lucide-settings)').click(); // 使用 svg 类名定位
    
    const configDialog = page.locator('div[role="dialog"]');
    await expect(configDialog).toBeVisible();

    const configureOptions = async (fieldLabel: string, options: {k: string, v: string}[]) => {
      // 查找包含该字段名称的配置块 (使用更稳定的选择器)
      const fieldBlock = configDialog.locator('div.border.rounded-lg', { hasText: fieldLabel });
      await expect(fieldBlock).toBeVisible();
      
      for (const opt of options) {
        await fieldBlock.getByRole('button', { name: "追加选项行" }).click();
        const lastRow = fieldBlock.locator('div.grid.grid-cols-12').last();
        await lastRow.getByPlaceholder('eg. active').fill(opt.k);
        await lastRow.getByPlaceholder('eg. 激活状态').fill(opt.v);
      }
    };

    await configureOptions('状态单选', [{k: 'on', v: '在线'}, {k: 'off', v: '离线'}]);
    await configureOptions('多选标签', [{k: 'hot', v: '热门'}, {k: 'new', v: '新品'}]);
    
    await configDialog.getByRole('button', { name: "保存配置" }).click();
    await page.waitForTimeout(500);

    // 5. 进入内容管理，添加记录
    await page.goto(`/admin/collections/${collSlug}`);
    await page.click('button:has-text("新增记录")');

    await expect(page.getByRole('heading', { name: '新增记录' })).toBeVisible();
    
    await page.fill('input[id="title"]', `TEST_TITLE_${uniqueId}`);
    
    // 点击单选 (Radio) - 在线
    // Radix UI 的 Label 关联可能需要更精准的定位
    await page.click('label:has-text("在线")');
    
    // 点击多选 (Checkbox) - 热门 + 新品
    await page.click('label:has-text("热门")');
    await page.click('label:has-text("新品")');

    await page.click('button:has-text("保存更改")');
    
    // 验证保存成功并跳转返回列表
    await expect(page).not.toHaveURL(/.*\/new$/);

    // 6. 核心校验：列表展示名称映射
    const tableHeader = page.locator('thead');
    const tableBody = page.locator('tbody');
    
    await expect(tableBody).toContainText(`TEST_TITLE_${uniqueId}`);
    // 验证映射逻辑是否正确渲染 Label
    await expect(tableBody).toContainText('在线'); 
    await expect(tableBody).toContainText('热门, 新品');

    // 7. 清理工作
    await page.goto('/admin/collections');
    const deleteRow = page.locator('tr', { hasText: collName });
    await deleteRow.locator('button:has(svg.lucide-trash2)').click();
    await page.click('button:has-text("执行解绑")');

    await page.goto('/admin/models');
    const modelRow = page.locator('tr', { hasText: modelName });
    await modelRow.locator('button:has(svg.lucide-trash2)').click();
    await page.click('button:has-text("彻底删除")');


    // Final ReferenceError check
    const refErrors = consoleErrors.filter(e => e.includes('ReferenceError'));
    expect(refErrors.length, `全链路不应存在 JS 报错。已发现: ${refErrors.join('; ')}`).toBe(0);
  });
});
