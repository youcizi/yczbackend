import React, { useState } from 'react';
import { memberApi } from '../lib/api';

export const Security: React.FC<{ onNavigate: (p: any) => void }> = ({ onNavigate }) => {
  const [formData, setFormData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.newPassword !== formData.confirmPassword) {
      return setMessage({ type: 'error', text: '新密码两次输入不一致' });
    }
    
    setLoading(true);
    setMessage({ type: '', text: '' });
    
    try {
      const res = await memberApi.resetPassword({
        oldPassword: formData.oldPassword,
        newPassword: formData.newPassword
      });
      if (res.error) throw new Error(res.error);
      setMessage({ type: 'success', text: '密码修改成功！' });
      setFormData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="w-full lg:w-64 bg-white border-r border-slate-100 flex flex-col p-6 space-y-6">
        <div className="flex items-center gap-3 px-2">
          <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black shadow-lg">M</div>
          <span className="font-black text-xl tracking-tight">会员中心</span>
        </div>
        <nav className="flex-1 space-y-1">
          <button onClick={() => onNavigate('dashboard')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-2xl font-bold transition-all">
            控制台概览
          </button>
          <button onClick={() => onNavigate('profile')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-2xl font-bold transition-all">
            个人资料
          </button>
          <button onClick={() => onNavigate('security')} className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-600 rounded-2xl font-bold transition-all">
            安全设置
          </button>
        </nav>
      </aside>

      <main className="flex-1 p-6 lg:p-12 space-y-8">
        <header>
          <h1 className="text-3xl font-black text-slate-900">账号安全</h1>
          <p className="text-slate-500 font-medium">定期更换密码以保障您的账户安全</p>
        </header>

        <div className="max-w-md bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-6">
          <h3 className="text-xl font-bold text-slate-900 mb-2">修改登录密码</h3>
          
          {message.text && (
            <div className={`p-4 rounded-2xl text-sm font-bold border ${
              message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-100 text-red-600'
            }`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">当前旧密码</label>
              <input
                type="password"
                required
                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                value={formData.oldPassword}
                onChange={e => setFormData({ ...formData, oldPassword: e.target.value })}
              />
            </div>
            
            <div className="h-px bg-slate-50 my-2"></div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">设置新密码</label>
              <input
                type="password"
                required
                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                value={formData.newPassword}
                onChange={e => setFormData({ ...formData, newPassword: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">确认新密码</label>
              <input
                type="password"
                required
                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                value={formData.confirmPassword}
                onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
              />
            </div>

            <div className="pt-4">
              <button
                disabled={loading}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all"
              >
                {loading ? '正在保存...' : '确认修改密码'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};
