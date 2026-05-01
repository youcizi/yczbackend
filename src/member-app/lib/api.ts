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
    // 逻辑上只需清除 Cookie，后台登出接口可复用或调用专属接口
    const res = await fetch('/api/auth/admin/logout', { method: 'POST' }); // Lucia 会话清除通常通用
    return res.json();
  }
};
