import React, { useState, useEffect, useRef } from 'react';
import { memberApi } from '../lib/api';

export const Login: React.FC<{ onNavigate: (p: any) => void, onLoginSuccess: () => void }> = ({ onNavigate, onLoginSuccess }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const turnstileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const siteKey = (window as any).TURNSTILE_SITE_KEY;
    if (!siteKey) {
      console.warn('⚠️ [Turnstile] Site key is missing.');
      return;
    }

    // @ts-ignore
    if (window.turnstile) {
      // @ts-ignore
      window.turnstile.render(turnstileRef.current, {
        sitekey: siteKey,
        callback: (token: string) => {
          setTurnstileToken(token);
        },
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnstileToken) {
      return setError('请完成人机验证');
    }

    setLoading(true);
    setError('');
    try {
      const res = await memberApi.login({ ...formData, cfToken: turnstileToken });
      if (res.error) {
        // 失败后重置验证码
        // @ts-ignore
        if (window.turnstile) window.turnstile.reset();
        setTurnstileToken('');
        throw new Error(res.error);
      }
      onLoginSuccess();
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
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-200">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-black tracking-tight text-slate-900">欢迎回来</h2>
          <p className="mt-2 text-sm text-slate-500">请输入您的凭据以访问会员中心</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-600 border border-red-100 animate-shake">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">邮箱账号</label>
              <input
                type="email"
                required
                className="mt-1 block w-full rounded-2xl border-none bg-white px-5 py-4 text-slate-900 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                placeholder="name@company.com"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">登录密码</label>
              <input
                type="password"
                required
                className="mt-1 block w-full rounded-2xl border-none bg-white px-5 py-4 text-slate-900 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                placeholder="••••••••"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-center" ref={turnstileRef}></div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-4 text-sm font-bold text-white shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all"
          >
            {loading ? '身份校验中...' : '立即登录'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500">
          还没有账号？{' '}
          <button onClick={() => onNavigate('register')} className="font-bold text-blue-600 hover:underline">
            立即加入会员
          </button>
        </p>
      </div>
    </div>
  );
};
