/**
 * 会员中心 API 客户端 (参考实现)
 */
export const memberApi = {
  // 登录
  async login(data: any) {
    const res = await fetch('/api/auth/member/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // 注册
  async register(data: any) {
    const res = await fetch('/api/auth/member/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  
  // 发送验证码
  async sendCode(email: string) {
    const res = await fetch('/api/auth/member/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return res.json();
  },

  // 获取个人资料
  async getProfile() {
    const res = await fetch('/api/auth/member/me');
    return res.json();
  },

  // 更新个人资料
  async updateProfile(data: any) {
    const res = await fetch('/api/auth/member/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // 修改密码
  async resetPassword(data: any) {
    const res = await fetch('/api/auth/member/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // 登出
  async logout() {
    const res = await fetch('/api/auth/member/logout', { method: 'POST' });
    return res.json();
  }
};
