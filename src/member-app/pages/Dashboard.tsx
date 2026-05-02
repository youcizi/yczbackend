import React from 'react';
import { Sidebar } from '../components/Sidebar';

export const Dashboard: React.FC<{ user: any, onNavigate: (p: any) => void, onLogout: () => void }> = ({ user, onNavigate, onLogout }) => {
  // 格式化余额 (分为单位转元)
  const formatBalance = (cents: number = 0) => {
    return (cents / 100).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' });
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar currentPage="dashboard" onNavigate={onNavigate} onLogout={onLogout} />

      {/* 主内容区 */}
      <main className="flex-1 p-6 lg:p-12 space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900">
              {user?.nickname || user?.email?.split('@')[0]}，欢迎回来！
            </h1>
            <p className="text-slate-500 font-medium">今天是 {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
          </div>
          <div className="flex items-center gap-3 bg-white p-2 pr-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden shadow-inner">
              {user?.avatar ? (
                <img src={user.avatar} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="text-sm font-bold">{user?.nickname?.[0] || user?.email?.[0]?.toUpperCase()}</div>
              )}
            </div>
            <div>
              <div className="text-[10px] font-black uppercase text-slate-400 leading-tight tracking-widest">会员等级</div>
              <div className="text-sm font-bold text-blue-600 leading-tight">LV.{user?.level || 1} 尊贵会员</div>
            </div>
          </div>
        </header>

        {/* 统计卡片 */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="h-12 w-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mb-6">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">活跃积分</div>
            <div className="text-3xl font-black text-slate-900">{user?.points?.toLocaleString() || 0}</div>
          </div>
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center mb-6">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">账户余额</div>
            <div className="text-3xl font-black text-slate-900">{formatBalance(user?.balance)}</div>
          </div>
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mb-6">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">认证状态</div>
            <div className="text-3xl font-black text-slate-900">{user?.status === 'active' ? '已认证' : '待激活'}</div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 详细资料卡片 */}
          <section className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8">
            <h3 className="text-xl font-black text-slate-900 mb-6">基本档案</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-slate-50">
                <span className="text-sm font-medium text-slate-400">电子邮箱</span>
                <span className="text-sm font-bold text-slate-700">{user?.email}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-50">
                <span className="text-sm font-medium text-slate-400">联系电话</span>
                <span className="text-sm font-bold text-slate-700">{user?.phone || '未绑定'}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-50">
                <span className="text-sm font-medium text-slate-400">性别</span>
                <span className="text-sm font-bold text-slate-700">
                  {user?.gender === 'male' ? '男' : user?.gender === 'female' ? '女' : '保密'}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-50">
                <span className="text-sm font-medium text-slate-400">生日</span>
                <span className="text-sm font-bold text-slate-700">{user?.birthday || '未设置'}</span>
              </div>
            </div>
          </section>

          {/* 个人简介 */}
          <section className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8">
            <h3 className="text-xl font-black text-slate-900 mb-6">个人简介</h3>
            <div className="bg-slate-50 rounded-2xl p-6 min-h-[140px] text-slate-600 text-sm font-medium leading-relaxed italic">
              {user?.bio || "该用户很懒，还没有写下任何介绍..."}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};
