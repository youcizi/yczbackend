import { Hono } from 'hono';
import { getAuthInstances, passwordHasher } from '../lib/auth';
import { createDbClient, schema, eq, sql, and, desc } from '../db';
import { generateId } from 'lucia';
import { seedAdmin } from '../core/seed';

const auth = new Hono<{ Bindings: any }>();

/**
 * 管理员登录接口
 */
auth.post('/admin/login', async (c) => {
  const { username, password } = await c.req.json();
  const { adminAuth } = await getAuthInstances(c.env.DB);
  const db = await createDbClient(c.env.DB);

  // 1. 联合查询：从 admins 表找到用户，并从 users 表获取哈希密码
  let existingAdmin = await db.select({
    id: schema.admins.id,
    username: schema.admins.username,
    passwordHash: schema.users.passwordHash,
    status: schema.users.status
  })
  .from(schema.admins)
  .innerJoin(schema.users, eq(schema.admins.id, schema.users.id))
  .where(eq(schema.admins.username, username))
  .get();

  // 1.1 物理数据自愈：如果数据库为空，则触发种子回填
  if (!existingAdmin) {
    const adminCount = await db.select({ count: sql<number>`count(*)` }).from(schema.admins).get();
    if (!adminCount || adminCount.count === 0) {
      console.log('🌱 [Auth] 检测到数据库空白，正在执行自动种子初始化...');
      await seedAdmin(c.env.DB);
      // 重新查询
      existingAdmin = await db.select({
        id: schema.admins.id,
        username: schema.admins.username,
        passwordHash: schema.users.passwordHash,
        status: schema.users.status
      })
      .from(schema.admins)
      .innerJoin(schema.users, eq(schema.admins.id, schema.users.id))
      .where(eq(schema.admins.username, username))
      .get();
    }
  }

  if (!existingAdmin || existingAdmin.status !== 'active') {
    return c.json({ error: '用户名或密码错误或账号已禁用' }, 401);
  }

  // 2. 校验密码
  const validPassword = await passwordHasher.verify(existingAdmin.passwordHash, password);

  if (!validPassword) {
    return c.json({ error: '用户名或密码错误' }, 401);
  }

  // 3. 创建会话
  const session = await adminAuth.createSession(existingAdmin.id, {});
  const sessionCookie = adminAuth.createSessionCookie(session.id);
  c.header('Set-Cookie', sessionCookie.serialize(), { append: true });

  return c.json({ message: '登录成功' });
});


/**
 * 管理员登出接口
 */
auth.post('/admin/logout', async (c) => {
  const { adminAuth } = await getAuthInstances(c.env.DB);
  const authHeader = c.req.header('Cookie');
  const sessionId = adminAuth.readSessionCookie(authHeader ?? '');

  if (sessionId) {
    await adminAuth.invalidateSession(sessionId);
  }

  const sessionCookie = adminAuth.createBlankSessionCookie();
  c.header('Set-Cookie', sessionCookie.serialize(), { append: true });

  return c.json({ message: '已安全登出' });
});

/**
 * 获取当前管理员信息
 */
auth.get('/admin/me', async (c) => {
  const { adminAuth } = await getAuthInstances(c.env.DB);
  const authHeader = c.req.header('Cookie');
  const sessionId = adminAuth.readSessionCookie(authHeader ?? '');
  if (!sessionId) return c.json({ error: 'Unauthorized' }, 401);

  const { user } = await adminAuth.validateSession(sessionId);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  return c.json({ user });
});

/**
 * 会员登录接口 (Member Auth)
 */
auth.post('/member/login', async (c) => {
  const { email, password, cfToken } = await c.req.json();
  const { RateLimitService } = await import('../services/RateLimitService');
  const { TurnstileService } = await import('../services/TurnstileService');

  // 1. 频率限制 (基于 Email) - 5分钟内最多 5 次尝试
  const rl = await RateLimitService.checkRateLimit(c.env.RATE_LIMITER, `login:${email}`, 5, 300);
  if (!rl.success) {
    return c.json({ error: '登录尝试过于频繁，请稍后再试' }, 429);
  }

  // 2. 人机验证
  if (c.env.TURNSTILE_SECRET_KEY) {
    // 开发环境降级处理：如果是测试 Key 或者是 localhost 环境，使用测试 Secret
    const isLocal = c.req.header('host')?.includes('localhost') || c.req.header('host')?.includes('127.0.0.1');
    const secret = isLocal ? "1x00000000000000000000000000000000" : c.env.TURNSTILE_SECRET_KEY;
    
    const isHuman = await TurnstileService.verifyToken(secret, cfToken);
    if (!isHuman) {
      return c.json({ error: '安全验证失败，请重新尝试' }, 403);
    }
  }

  const { userAuth } = await getAuthInstances(c.env.DB);
  const db = await createDbClient(c.env.DB);
  
  const domains = c.get('site_domains' as any) || c.get('domains' as any);
  let tenantId = domains?.tenant_id || domains?.id || 1; 

  // 3. 联合查询
  const result = await db.select({
    id: schema.users.id,
    passwordHash: schema.users.passwordHash,
    status: schema.users.status,
    email: schema.users.email
  })
  .from(schema.users)
  .innerJoin(schema.members, eq(schema.users.id, schema.members.id))
  .where(and(
    eq(schema.users.email, email),
    eq(schema.users.tenantId, Number(tenantId)),
    eq(schema.users.userType, 'member')
  ))
  .get();

  if (!result || result.status !== 'active') {
    return c.json({ error: '邮箱或密码错误' }, 401);
  }

  // 4. 校验密码
  const validPassword = await passwordHasher.verify(result.passwordHash, password);
  if (!validPassword) {
    return c.json({ error: '邮箱或密码错误' }, 401);
  }

  // 5. 登录成功，重置频率限制
  await RateLimitService.resetRateLimit(c.env.RATE_LIMITER, `login:${email}`);

  // 6. 创建会话
  const session = await userAuth.createSession(result.id, {});
  const sessionCookie = userAuth.createSessionCookie(session.id);
  c.header('Set-Cookie', sessionCookie.serialize(), { append: true });

  return c.json({ message: '登录成功', user: { email: result.email } });
});

/**
 * 发送验证码接口
 */
auth.post('/member/send-code', async (c) => {
  const { email } = await c.req.json();
  if (!email) return c.json({ error: '邮箱不能为空' }, 400);

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const db = await createDbClient(c.env.DB);
  const { MailService } = await import('../services/MailService');

  // 1. 存入数据库，有效期 10 分钟
  await db.insert(schema.verificationCodes).values({
    email,
    code,
    type: 'register',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000)
  });

  // 2. 发送邮件
  try {
    await MailService.sendMail(c.env, {
      to: email,
      subject: '您的注册验证码',
      html: `
        <div style="font-family: Arial; padding: 20px;">
          <h2>欢迎注册</h2>
          <p>您的验证码是：<strong style="font-size: 24px; color: #2563eb;">${code}</strong></p>
          <p>有效期为 10 分钟，请尽快完成注册。</p>
        </div>
      `,
      senderName: 'YCZ.ME 独立站系统'
    });
    return c.json({ success: true, message: '验证码已发送' });
  } catch (err: any) {
    console.error('Send code failed:', err);
    return c.json({ error: '验证码发送失败: ' + err.message }, 500);
  }
});

/**
 * 会员注册接口
 */
auth.post('/member/register', async (c) => {
  const { email, password, code } = await c.req.json();
  if (!code) return c.json({ error: '请填写验证码' }, 400);

  const { IdentityService } = await import('../services/IdentityService');
  const db = await createDbClient(c.env.DB);
  
  // 1. 校验验证码
  const record = await db.query.verificationCodes.findFirst({
    where: (vc, { eq, and, gt }) => and(
      eq(vc.email, email),
      eq(vc.code, code),
      eq(vc.type, 'register'),
      gt(vc.expiresAt, new Date())
    ),
    orderBy: (vc, { desc }) => [desc(vc.createdAt)]
  });

  if (!record) {
    return c.json({ error: '验证码错误或已过期' }, 400);
  }

  const domains = c.get('site_domains' as any) || c.get('domains' as any);
  let tenantId = domains?.tenant_id || domains?.id || 1;

  try {
    const user = await IdentityService.register(c.env.DB, {
      tenantId: Number(tenantId),
      email,
      password,
      userType: 'member',
      level: 1
    });

    // 2. 注册成功后使验证码失效
    await db.delete(schema.verificationCodes).where(eq(schema.verificationCodes.id, record.id));

    return c.json({ success: true, userId: user.id });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

/**
 * 获取当前会员信息
 */
auth.get('/member/me', async (c) => {
  const { userAuth } = await getAuthInstances(c.env.DB);
  const authHeader = c.req.header('Cookie');
  const sessionId = userAuth.readSessionCookie(authHeader ?? '');
  
  if (!sessionId) return c.json({ error: 'Unauthorized' }, 401);

  const { user } = await userAuth.validateSession(sessionId);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  // 补充获取详细资料
  const db = await createDbClient(c.env.DB);
  const profile = await db.select({
    id: schema.users.id,
    email: schema.users.email,
    level: schema.members.level,
    status: schema.users.status
  })
  .from(schema.users)
  .leftJoin(schema.members, eq(schema.users.id, schema.members.id))
  .where(eq(schema.users.id, user.id))
  .get();

  return c.json({ user: profile });
});

/**
 * 会员修改密码
 */
auth.post('/member/reset-password', async (c) => {
  const { userAuth } = await getAuthInstances(c.env.DB);
  const { oldPassword, newPassword } = await c.req.json();
  const authHeader = c.req.header('Cookie');
  const sessionId = userAuth.readSessionCookie(authHeader ?? '');
  
  if (!sessionId) return c.json({ error: 'Unauthorized' }, 401);
  const { user } = await userAuth.validateSession(sessionId);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const db = await createDbClient(c.env.DB);
  const userData = await db.select().from(schema.users).where(eq(schema.users.id, user.id)).get();
  
  if (!userData) return c.json({ error: 'User not found' }, 404);

  const valid = await passwordHasher.verify(userData.passwordHash, oldPassword);
  if (!valid) return c.json({ error: '旧密码错误' }, 400);

  const newHash = await passwordHasher.hash(newPassword);
  await db.update(schema.users).set({ passwordHash: newHash }).where(eq(schema.users.id, user.id)).run();

  return c.json({ success: true, message: '密码已修改' });
});

export default auth;
