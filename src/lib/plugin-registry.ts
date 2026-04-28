/**
 * 插件代码映射注册表 (Vite/Workers 静态桥接层)
 * 
 * 由于 Cloudflare Workers 环境不支持运行时文件扫描，所有候选插件的代码必须在此处登记。
 * 只有当数据库中存在对应 slug 的记录且 is_enabled 为 1 时，对应的逻辑才会被挂载生效。
 */

// 1. 导入插件后端 Hono 应用
import membershipApp from '../plugins/membership/index';

// 2. 导入插件前端管理组件 (懒加载)
import { lazy } from 'react';
const MembershipAdmin = lazy(() => import('../plugins/membership/admin/MembershipManagement'));

// 3. 导入插件声明信息 (用于自动权限同步等)
import { MANIFEST as membershipManifest } from '../plugins/membership/manifest';

export interface PluginCodeBundle {
  backend: any;
  frontend: any;
  manifest: any;
}

export const PLUGIN_CODE_REGISTRY: Record<string, PluginCodeBundle> = {
  'membership': {
    backend: membershipApp,
    frontend: MembershipAdmin,
    manifest: membershipManifest
  }
};
