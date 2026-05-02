import React, { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { memberApi } from '../lib/api';

export const Profile: React.FC<{ user: any, onNavigate: (p: any) => void, onUpdate: () => void, onLogout: () => void }> = ({ user, onNavigate, onUpdate, onLogout }) => {
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [gender, setGender] = useState(user?.gender || 'unknown');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleUpdate = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await memberApi.updateProfile({ nickname, gender });
      if (res.error) throw new Error(res.error);
      setMessage({ type: 'success', text: '资料更新成功！' });
      onUpdate(); // 刷新父组件状态
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar currentPage="profile" onNavigate={onNavigate} onLogout={onLogout} />

      <main className="flex-1 p-6 lg:p-12 space-y-8">
        <header>
          <h1 className="text-3xl font-black text-slate-900">个人基本资料</h1>
          <p className="text-slate-500 font-medium">管理您的公开信息与账户设置</p>
        </header>

        <div className="max-w-2xl bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-8">
          {message.text && (
            <div className={`p-4 rounded-2xl text-sm font-bold border ${
              message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-100 text-red-600'
            }`}>
              {message.text}
            </div>
          )}
          <div className="flex items-center gap-6 pb-8 border-b border-slate-50">
            <div className="h-24 w-24 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-300 relative group overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path></svg>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">{user?.nickname || user?.email}</h3>
              <p className="text-sm text-slate-500">账号 ID: {user?.id?.substring(0, 8)}...</p>
              <div className="mt-2 inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-black uppercase">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                已激活会员
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">登录邮箱</label>
              <input readOnly value={user?.email} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-500 font-bold outline-none cursor-not-allowed" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">昵称 / 姓名</label>
              <input 
                placeholder="尚未设置" 
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-all" 
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">性别</label>
              <select 
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-all appearance-none"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="unknown">未设置</option>
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
            </div>
          </div>

          <div className="pt-4">
            <button 
              disabled={loading}
              onClick={handleUpdate}
              className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95 disabled:opacity-50"
            >
              {loading ? '正在保存...' : '更新资料'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
