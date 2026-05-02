import { Hono } from 'hono';
import { IdentityService } from '../../services/IdentityService';

const api = new Hono<{ Bindings: any }>();

/**
 * 会员自助注册接口
 * 对接系统核心 IdentityService
 */
api.post('/register', async (c) => {
  const { email, password } = await c.req.json();
  
  // 从网关上下文中获取当前租户 ID
  const domains = c.get('domains' as any) || { id: 1 };
  const tenantId = domains.id;

  try {
    // 1. 调用核心身份服务进行注册
    const user = await IdentityService.register(c.env.DB, {
      tenantId,
      email,
      password,
      userType: 'member'
    });

    // 2. 返回结果 (注意：MembershipService 已经通过 hook 自动完成了档案初始化)
    return c.json({ 
      success: true, 
      message: '会员注册成功',
      data: {
        userId: user.id,
        email: user.email
      }
    });
  } catch (err: any) {
    console.error('[Membership API] Registration Error:', err);
    return c.json({ 
      success: false, 
      message: err.message || '注册失败' 
    }, 400);
  }
});

export default api;
