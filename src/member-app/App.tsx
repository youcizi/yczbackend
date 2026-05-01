import React, { useState, useEffect } from 'react';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Profile } from './pages/Profile';
import { Security } from './pages/Security';
import { memberApi } from './lib/api';

/**
 * 会员项目主入口 (Reference SPA)
 */
export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'login' | 'register' | 'dashboard' | 'profile' | 'security'>('login');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 初始化检查登录状态
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await memberApi.getProfile();
      if (res.user) {
        setUser(res.user);
        if (currentPage === 'login' || currentPage === 'register') {
          setCurrentPage('dashboard');
        }
      }
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await memberApi.logout();
    setUser(null);
    setCurrentPage('login');
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-pulse text-slate-400 font-bold">正在接入身份验证系统...</div>
      </div>
    );
  }

  // 简单路由映射
  const renderPage = () => {
    switch (currentPage) {
      case 'login': 
        return <Login onNavigate={setCurrentPage} onLoginSuccess={checkAuth} />;
      case 'register': 
        return <Register onNavigate={setCurrentPage} />;
      case 'dashboard': 
        return <Dashboard user={user} onNavigate={setCurrentPage} onLogout={handleLogout} />;
      case 'profile': 
        return <Profile user={user} onNavigate={setCurrentPage} onUpdate={checkAuth} />;
      case 'security': 
        return <Security onNavigate={setCurrentPage} />;
      default: 
        return <Login onNavigate={setCurrentPage} onLoginSuccess={checkAuth} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      {renderPage()}
    </div>
  );
};
