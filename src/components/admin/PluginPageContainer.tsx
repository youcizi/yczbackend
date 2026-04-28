import React, { Suspense } from 'react';
import { PLUGIN_CODE_REGISTRY } from '../../lib/plugin-registry';
import { RefreshCcw, ShieldAlert, Code } from 'lucide-react';

interface PluginPageContainerProps {
  slug: string;
}

/**
 * 插件页面逻辑容器: 负责根据路由 Slug 动态挂载插件 UI 模块
 */
export const PluginPageContainer: React.FC<PluginPageContainerProps> = ({ slug }) => {
  const bundle = PLUGIN_CODE_REGISTRY[slug];

  if (!bundle) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
        <ShieldAlert size={48} className="text-slate-300 mb-4" />
        <h3 className="text-lg font-bold text-slate-700">插件代码未定义</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-xs text-center">
          在 <code>src/lib/plugin-registry.ts</code> 中未找到标识码为 <code>{slug}</code> 的代码映射。
        </p>
      </div>
    );
  }

  const PluginComponent = bundle.frontend;

  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <RefreshCcw className="animate-spin text-blue-500 mb-2" size={24} />
        <span className="text-xs text-slate-400 font-mono tracking-tighter">BOOTSTRAPPING {slug.toUpperCase()}...</span>
      </div>
    }>
      <div className="animate-in fade-in duration-500">
         <PluginComponent />
      </div>
    </Suspense>
  );
};
