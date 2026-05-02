import React from 'react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (p: any) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, onLogout }) => {
  return (
    <aside className="w-full lg:w-64 bg-white border-r border-slate-100 flex flex-col p-6 space-y-6">
      <div className="flex items-center gap-3 px-2">
        <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black shadow-lg shadow-blue-100">M</div>
        <span className="font-black text-xl tracking-tight">会员中心</span>
      </div>
      
      <nav className="flex-1 space-y-1">
        <button 
          onClick={() => onNavigate('dashboard')} 
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${
            currentPage === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          控制台概览
        </button>
        <button 
          onClick={() => onNavigate('profile')} 
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${
            currentPage === 'profile' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          个人资料
        </button>
        <button 
          onClick={() => onNavigate('security')} 
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${
            currentPage === 'security' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          安全设置
        </button>
      </nav>

      <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-2xl font-bold transition-all mt-auto border border-transparent hover:border-red-100">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        安全退出
      </button>
    </aside>
  );
};
