# AI 协作与工程架构规约 (v2.0 - 稳固版)

## 1. 核心架构规约 (Architecture Rules)

### 1.1 多语言模型 (Internationalization)
- **物理关联**：多语言记录必须通过 `translation_group` (UUID) 物理关联。
- **状态同步**：前端使用 `translationsMap` 管理内存状态，通过 `batch-save` 接口统一提交。
- **批量保存**：Payload 必须符合 `[{locale, dataJson: {...}, translationGroup}]` 结构。

### 1.2 导航与布局 (Navigation)
- **分级权重**：菜单由 `menu_group` 分组，组内按 `menu_order` (升序) 排序。
- **动态发现**：侧边栏必须通过 `collections-updated` 事件监听实时数据变更，实现零刷新更新。

### 1.3 权限系统 (Dynamic RBAC)
- **即时注册**：新 `Model` 或 `Collection` 创建后，后端必须立即调用 `registry.register` 并触发 `syncToDb`。
- **自动授权**：系统级超级管理员角色 (SuperAdmin) 的权限集必须包含 `all`。
- **动态守卫**：业务路由必须使用 `dynamicGuard` 配合 `requirePermission` 进行原子化拦截。

## 2. 交付与测试规约 (Testing & Delivery)

### 测试规范 (Test Hardening)

* **同步更新**：凡涉及 `entities` 数据结构变更（如新增字段），必须同步更新 `CollectionTestFactory` 与 `integration/entities.test.ts` 的 Mock Schema。
* **深度断言**：禁止仅校验 HTTP 200。涉及实体写入的测试，必须包含以下深度断言：
    * 验证 `translation_group` 为合法 UUID。
    * 验证同组内不同语种记录 of `translation_group` 必须完全相等。
    * 验证 `data_json` 的嵌套结构符合后端预期。
* **权限同步规范**：所有涉及动态权限（如业务集合、模型权限）的查询接口（如 `GET /permissions`）必须直接读取数据库（Database-First），禁止仅依赖内存中的单例注册表，以防止多实例/Isolate 环境下的数据不一致。
* **E2E 真实化**：E2E 测试必须模拟 Tab 切换交互，并检查保存后的 URL 重定向（验证 ID 回填）。

### 2.1 自动化验收
- **Check-All 机制**：交付前必须运行 `pnpm check-all`。
- **UI 零白屏**：所有渲染路径必须包含对 `data.length === 0` 的兜底，关键路径使用 `ErrorBoundary`。

### 2.2 交付报告 (Report Template)
 AI 回复必须包含：
- **状态**：✅ 全部通过 / ⚠️ 待修复
- **变更点**：[模型 A / 接口 B / UI C]
- **验证项**：已通过 [功能点 X] 的冒烟测试。

## 3. 安全防护规约 (Security)
- **事务一致性**：批量保存必须封装在 `db.transaction` (D1) 或 `BEGIN/COMMIT` (SQLite) 块中。
- **防泄露**：API 返回实体数据前，必须通过 `populateEntities` 剥离敏感系统元数据。

## 🛠 核心约束 (Core Constraints)

### [Rule: Schema Consistency] - 必须执行
1. **禁止前端 SQL 拼接**：严禁在前端代码或 Service 层直接构建原始 SQL 字符串。
2. **统一写入入口**：所有针对 `entities` 表的增删改必须通过 `upsertEntityWithTranslation` 统一函数处理。
3. **ID 强回填**：Batch Save 接口成功后，必须将后端生成的物理 `id` 同步回前端的 `translationsMap`，以确保内存 Map 的状态与数据库完全镜像。
4. **幂等性保障**：在执行任何插入前，必须检查 `translation_group` + `locale` 的唯一性，防止数据重影。