# Backend Mangement Core Architecture (管理中枢架构)

本文档概述了 `apps/backend` 的核心架构设计，旨在构建一个高性能、可扩展的跨境电商管理平台。

## 1. 核心架构组件

### 1.1 RBAC 权限模型 (Role-Based Access Control)
系统采用三级权限模型，通过 `admins.role` 字段定义：
- **SuperAdmin (super)**: 拥有系统完整权限，包括管理员管理、系统配置。
- **Editor (editor)**: 拥有站点内容、产品、订单的处理权限，无系统配置权限。
- **Viewer (viewer)**: 仅拥有数据查看权限，无法执行任何变动操作。

**权限校验流**:
`Request -> Auth Middleware (Session) -> RBAC Middleware (Role Check) -> Logic`

### 1.2 系统配置中心 (System Settings)
统一管理全局敏感配置，存储于 `system_settings` 表：
- **Provider Keys**: OpenAI Key, Cloudflare API Token, Stripe Secret.
- **Environment Params**: 站点默认后缀、全局汇率、系统维护状态。

### 1.3 配置驱动的主题契约 (Config-Driven Theme)
`sites.theme_data` 采用 JSON 结构，解耦视觉与逻辑：
```json
{
  "global_styles": {
    "colors": { "primary": "#hex", "accent": "#hex" },
    "typography": { "base_font": "Inter" }
  },
  "sections": [
    { "type": "hero", "content": { "title": "...", "bg": "..." }, "order": 0 },
    { "type": "product_grid", "settings": { "columns": 4 }, "order": 1 }
  ]
}
```

### 1.4 事件钩子系统 (Hooks System)
基于 `EventEmitter` 的中台解耦机制：
- **生命周期**: 
  - `site.created`: 触发自動部署脚本地
  - `product.created`: 触发搜索索引更新
  - `admin.login`: 触发安全日志记录

---

## 2. 模块扩展路径

### 2.1 AI 自动翻译模块 (AI Translation)
1. **策略**: 在 `EventEmitter` 中监听 `product.created` 或 `article.created` 事件。
2. **实现**: 
   - 触发 `TranslationService`。
   - 调用 `SystemSettings` 获取 AI API Key。
   - 异步更新各语言版本的字段内容。
3. **扩展**: 在 UI 界面增加“智能翻译”按钮，调用同一 Service。

### 2.2 Stripe 支付集成 (Payment Gateway)
1. **策略**: 注册 `order.payment_intent_needed` 钩子。
2. **实现**:
   - 后端生成 `Stripe Session`。
   - 前端跳转支付页面。
   - 配置 `webhook` 路由，更新订单状态并触发 `order.paid` 事件。
3. **安全**: 密钥从 `SystemSettings` 中动态读取。

---

## 3. 技术栈
- **Framework**: Astro (SSR) + Hono (API)
- **ORM**: Drizzle + D1
- **Auth**: Lucia Auth
- **UI**: React + TailwindCSS (Admin Components)
