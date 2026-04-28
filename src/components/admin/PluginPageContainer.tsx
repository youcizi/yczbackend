import React, { Suspense, useState, useEffect } from 'react';
import { PLUGIN_CODE_REGISTRY } from '../../lib/plugin-registry';
import { RefreshCcw, ShieldAlert, Lock, AlertCircle } from 'lucide-react';

interface PluginPageContainerProps {
  slug: string;
}

/**
 * 插件页面逻辑容器: 负责根据路由 Slug 动态挂载插件 UI 模块
 * 新增逻辑：必须校验插件在数据库中的 isEnabled 状态
 */
export const PluginPageContainer: React.FC<PluginPageContainerProps> = ({ slug }) => {
  const [status, setStatus] = useState<{ isEnabled: boolean; isInstalled: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bundle = PLUGIN_CODE_REGISTRY[slug];

  useEffect(() => {
    const checkStatus = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/v1/plugins/admin/available');
        if (!res.ok) throw new Error('无法校验插件运行状态');
        const { data } = await res.json();
        const p = data.find((item: any) => item.slug === slug);
        
        if (!p) {
          setError('PLUGIN_NOT_REGISTERED');
        } else {
          setStatus({ isEnabled: p.isEnabled, isInstalled: p.isInstalled });
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
  }, [slug]);

  // Loading 占位
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <RefreshCcw className="animate-spin text-blue-500 mb-2" size={24} />
        <span className="text-[10px] text-slate-400 font-mono tracking-tighter">VERIFYING ASSET STATUS...</span>
      </div>
    );
  }

  // 错误或代码缺失处理
  if (!bundle || error === 'PLUGIN_NOT_REGISTERED') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
        <ShieldAlert size={48} className="text-slate-300 mb-4" />
        <h3 className="text-lg font-bold text-slate-700">未定义的扩展资产</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-xs text-center px-4">
          标识码为 <code>{slug}</code> 的资产未在系统内完成登记，或物理代码已丢失。
        </p>
      </div>
    );
  }

  // 核心拦截：如果已登记但未启用，则视为 404/禁止访问
  if (status && !status.isEnabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] rounded-3xl bg-white shadow-xl shadow-slate-100 border border-slate-100 animate-in zoom-in-95 duration-300">
        <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mb-6">
          <Lock size={32} className="text-orange-500" />
        </div>
        <h3 className="text-xl font-black text-slate-800 tracking-tight">插件功能已冻结</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-sm text-center px-8 leading-relaxed">
           管理员已在“插件管理”中心停用了 <strong>{bundle.manifest.name}</strong> 的所有运行入口。请先开启该插件后再尝试访问。
        </p>
        <div className="mt-8">
           <a href="/admin/plugins" className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all">
             返回管理中心
           </a>
        </div>
      </div>
    );
  }

  const PluginComponent = bundle.frontend;

  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <RefreshCcw className="animate-spin text-blue-500 mb-2" size={24} />
        <span className="text-xs text-slate-400 font-mono tracking-tighter uppercase">Initializing {slug}...</span>
      </div>
    }>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
         <PluginComponent />
      </div>
    </Suspense>
  );
};
