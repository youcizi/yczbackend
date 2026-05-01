import React, { useState } from 'react';
import { memberApi } from '../lib/api';

export const Register: React.FC<{ onNavigate: (p: any) => void }> = ({ onNavigate }) => {
  const [formData, setFormData] = useState({ email: '', password: '', confirmPassword: '', code: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isSending, setIsSending] = useState(false);

  const handleSendCode = async () => {
    if (!formData.email) return setError('请先输入邮箱');
    setIsSending(true);
    try {
      const res = await memberApi.sendCode(formData.email);
      if (res.error) throw new Error(res.error);
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      return setError('两次输入的密码不一致');
    }
    if (!formData.code) {
      return setError('请输入验证码');
    }
    setLoading(true);
    setError('');
    try {
      const res = await memberApi.register({ 
        email: formData.email, 
        password: formData.password,
        code: formData.code
      });
      if (res.error) throw new Error(res.error);
      alert('注册成功，请登录');
      onNavigate('login');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12">
      <div className="w-full max-w-[400px] space-y-8">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-200">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-black tracking-tight text-slate-900">加入我们</h2>
          <p className="mt-2 text-sm text-slate-500">仅需几秒钟，开启您的会员之旅</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-600 border border-red-100">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">电子邮箱</label>
              <input
                type="email"
                required
                className="mt-1 block w-full rounded-2xl border-none bg-white px-5 py-4 text-slate-900 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                placeholder="name@company.com"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">验证码</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  className="mt-1 block flex-1 rounded-2xl border-none bg-white px-5 py-4 text-slate-900 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                  placeholder="6位验证码"
                  value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value })}
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={countdown > 0 || isSending}
                  className="mt-1 px-4 rounded-2xl bg-slate-100 text-sm font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-50 transition-all whitespace-nowrap"
                >
                  {countdown > 0 ? `${countdown}s` : isSending ? '发送中...' : '发送验证码'}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">设置密码</label>
              <input
                type="password"
                required
                className="mt-1 block w-full rounded-2xl border-none bg-white px-5 py-4 text-slate-900 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                placeholder="••••••••"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">确认密码</label>
              <input
                type="password"
                required
                className="mt-1 block w-full rounded-2xl border-none bg-white px-5 py-4 text-slate-900 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-5 py-4 text-sm font-bold text-white shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all"
          >
            {loading ? '正在注册...' : '立即注册'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500">
          已有账号？{' '}
          <button onClick={() => onNavigate('login')} className="font-bold text-indigo-600 hover:underline">
            返回登录
          </button>
        </p>
      </div>
    </div>
  );
};
