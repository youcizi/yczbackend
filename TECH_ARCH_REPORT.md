# Backend Management Core: 技术架构与开发规范 (AI 系统指令版)

本文档旨在总结本本地代码库的核心架构元信息，作为 AI 助手（Gemini Gem）的系统指令，指导后续的功能扩展、维护与测试。

## 1. 技术栈底座 (Tech Stack)

*   **核心框架**: [Astro](https://astro.build/) (SSR 模式) + [Hono](https://hono.dev/) (API 路由)。
*   **后端逻辑**: 完全基于 TypeScript，采用模块化 Service 层设计。
*   **前端框架**: React (通过 `@astrojs/react` 集成)，用于管理后台动态 UI 模块。
*   **数据库 (DB)**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite)，配合 [Drizzle ORM](https://orm.drizzle.team/) 进行类型安全的数据操作。
*   **存储 (Storage)**: [Cloudflare R2](https://developers.cloudflare.com/r2/) 用于文件与媒体资源存储，配合 `ImageProxy` 服务。
*   **鉴权 (Auth)**: Lucia Auth (Drizzle Adapter)，支持多 Session 管理（Admin & Member 分离）。
*   **网络/运行态**: 运行于 Cloudflare Workers，遵循 Edge Computing 限制。

## 2. 插件系统协议 (Plugin System Protocol)

系统通过 **Cloudflare Service Bindings** 实现插件化扩展，解耦核心逻辑与业务插件。

*   **通信协议**: 核心系统充当代理（Reverse Proxy），通过 `/api/v1/plugins/proxy/:slug/*` 路由透传请求。
*   **注册机制**: 插件元数据存储在 `plugins` 表中（Slug, Name, Config, Enabled）。
*   **挂载模式**: 在主应用 `app.ts` 中通过 `v1.route('/plugins', plugins)` 挂载插件管理路由。
*   **核心接口 (Plugin Interface)**:
    ```ts
    // 每一个插件都是一个独立的 Hono Sub-App (Worker)
    interface PluginInfo {
      name: string;
      version: string;
      capabilities: string[]; // ['chat', 'seo', 'automation']
      uischema: {
        type: 'plugin-dashboard'; // 指示前端渲染模式
        slug: string;
      };
      config?: Record<string, any>; // 插件私有运行配置
    }
    ```
*   **RPC 转发**: 利用 `c.env[BINDING_:slug]` 获取 Service 对象并调用 `fetch` 方法。

## 3. TDD 规范 (Testing Standards)

*   **工具链**: Vitest (单元/集成测试) + Playwright (E2E 测试)。
*   **文件命名**: `src/tests/**/*.test.ts` (单元/集成)，`tests/e2e/**/*.spec.ts` (Playwright)。
*   **Mock 数据**: 
    *   使用 `better-sqlite3` 模拟本地 D1 环境。
    *   `CollectionTestFactory` 用于动态生成业务集合与实体的测试数据。
*   **测试套件结构**:
    ```ts
    describe('[Module] Name', () => {
      beforeEach(() => { /* 初始化 DB / Registry */ });
      it('should fulfill requirement X', async () => {
        // 使用深度断言 (Deep Assertions)
        // 验证 translation_group, data_json 结构等
      });
    });
    ```
*   **必运行流程**: 提交前必须执行 `pnpm check-all`。

## 4. 项目目录结构 (Directory Structure)

```text
src/
├── app.ts            # 根调度器, Permission Radar (权限自动同步)
├── core/             # 系统内核 (Seed, System Initialization)
├── db/               # 数据库 Schema 定义 (Drizzle) 与迁移
├── lib/              # 通用工具类 (PermissionRegistry, Auth Helpers)
├── middleware/       # 拦截器 (RBAC Guard, Domain Dispatcher)
├── plugins/          # 内部插件实现逻辑
├── routes/           # API 路由分发 (分组管理)
├── services/         # 核心业务逻辑 (ImageProxy, RbacService, PluginService)
├── tests/            # TDD 目录 (Unit, Integration, Factories, E2E)
└── pages/            # Astro 页面 (管理后台入口)
```

## 5. 数据与路由模式 (Data & Routing Patterns)

*   **Metadata-driven**: 采用“模型-集合-实体”架构。`models` 定义结构，`collections` 实例化模型，`entities` 存储扁平化的 `dataJson` 负载。
*   **Permission Radar**: 
    *   系统启动时利用 `PermissionRegistry` 自动扫描 `collections` 表。
    *   动态生成 `collection:slug:view|edit|delete` 格式的权限 Slug。
*   **路由分发 (Master Dispatcher)**:
    *   `domainDispatcher` 识别请求宿主及其关联的租户/站点上下文。
    *   `app.ts` 中的主 `fetch` 逻辑根据 `dispatch_target` 将流量导向 Admin、Public API 或 Image Proxy。

## 6. 代码风格与禁令 (Hard Rules)

1.  **禁止硬编码权限**: 必须通过 `requirePermission(['slug'])` 中间件进行声明式拦截。
2.  **严禁原生 SQL**: 必须使用 Drizzle ORM 构建查询，禁止直接拼接 SQL 字符串。
3.  **事务一致性**: 所有涉及 `entities` 表的批量写入（Batch Save）必须封装在 `db.transaction` 块中。
4.  **异步强制**: 考虑到 Worker 环境，所有 I/O 操作（DB, KV, Fetch）必须使用 `await`。
5.  **ID 强回填**: 前端 Batch Save 成功后，后端必须返回物理 ID，前端必须同步回内存 `translationsMap`。
6.  **国际化链路**: 多语言记录必须共享同一个 `translation_group` (UUID)，禁止孤儿记录。
7.  **输入校验**: 所有对外 API 入口必须使用 `Zod` 或 `Pydantic` (若涉及 Python 端) 进行严格 Schema 校验。
