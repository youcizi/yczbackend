import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React 错误边界组件
 * 捕获渲染阶段崩溃并展示友好提示 UI
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // 更新 state 以便下一次渲染能够显示降级 UI
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[200px] flex flex-col items-center justify-center p-8 bg-red-50/50 border border-red-100 rounded-xl space-y-4 animate-in fade-in duration-300">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 shadow-sm">
            <AlertTriangle size={24} />
          </div>
          
          <div className="text-center">
            <h3 className="text-lg font-bold text-slate-800">渲染出错了</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              此功能模块在加载过程中遇到致命错误。这通常是由于组件配置缺失或逻辑漏洞导致的。
            </p>
          </div>

          <div className="bg-slate-900/5 p-4 rounded-lg w-full max-w-xl">
             <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">错误代码</span>
             </div>
             <p className="text-xs font-mono text-red-700 break-all leading-relaxed">
               {this.state.error?.name}: {this.state.error?.message}
             </p>
          </div>

          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RotateCcw size={14} />
            重试加载
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
