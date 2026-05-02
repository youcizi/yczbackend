import { Hono } from 'hono';
import { IdentityService } from '../../../services/IdentityService';
import { createDbClient, schema, eq, and, sql, desc } from '../../../db';
import { passwordHasher } from '../../../lib/auth';
import { requirePermission } from '../../../middleware/rbac';

const users = new Hono<{ Bindings: any }>();

/**
 * 获取用户列表 (仅限 Member 类型，确保与系统管理员隔离)
 */
users.get('/', requirePermission('user.view'), async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('pageSize') || '20');
  const search = c.req.query('search') || '';
  
  const db = await createDbClient(c.env.DB);
  
  // 1. 构建查询条件
  const whereClause = and(
    eq(schema.users.userType, 'member'),
    search ? sql`(${schema.users.email} LIKE ${'%' + search + '%'} OR ${schema.members.nickname} LIKE ${'%' + search + '%'})` : undefined
  );

  // 2. 查询总数
  const totalResult = await db.select({ count: sql<number>`count(*)` })
    .from(schema.users)
    .leftJoin(schema.members, eq(schema.users.id, schema.members.id))
    .where(whereClause)
    .get();
  
  const total = totalResult?.count || 0;

  // 3. 分页查询数据
  const userList = await db.select({
    id: schema.users.id,
    email: schema.users.email,
    userType: schema.users.userType,
    status: schema.users.status,
    createdAt: schema.users.createdAt,
    level: schema.members.level,
    nickname: schema.members.nickname,
    avatar: schema.members.avatar,
    phone: schema.members.phone,
    gender: schema.members.gender,
    birthday: schema.members.birthday,
    balance: schema.members.balance,
    points: schema.members.points,
    bio: schema.members.bio,
  })
  .from(schema.users)
  .leftJoin(schema.members, eq(schema.users.id, schema.members.id))
  .where(whereClause)
  .orderBy(desc(schema.users.createdAt))
  .limit(pageSize)
  .offset((page - 1) * pageSize)
  .all();
  
  return c.json({
    success: true,
    data: userList,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  });
});

/**
 * 用户搜索 (用于余额/积分管理时的下拉选择)
 */
users.get('/search', requirePermission('user.view'), async (c) => {
  const q = c.req.query('q') || '';
  const db = await createDbClient(c.env.DB);
  
  const results = await db.select({
    id: schema.users.id,
    email: schema.users.email,
    nickname: schema.members.nickname,
  })
  .from(schema.users)
  .leftJoin(schema.members, eq(schema.users.id, schema.members.id))
  .where(and(
    eq(schema.users.userType, 'member'),
    sql`${schema.users.email} LIKE ${'%' + q + '%'} OR ${schema.members.nickname} LIKE ${'%' + q + '%'}`
  ))
  .limit(20)
  .all();
  
  return c.json({ success: true, data: results });
});

/**
 * 创建用户 (强制为 Member 类型)
 */
users.post('/', requirePermission('user.create'), async (c) => {
  const body = await c.req.json();
  try {
    const user = await IdentityService.register(c.env.DB, {
      tenantId: 1, // 默认租户
      email: body.email,
      password: body.password,
      userType: 'member', // 强制锁定为会员类型
      level: body.level || 1,
    });
    return c.json({ success: true, user });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * 更新用户 (支持所有新字段)
 */
users.put('/:id', requirePermission('user.update'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const db = await createDbClient(c.env.DB);

  try {
    const batchQueries = [];

    // 1. 核心表更新
    const userUpdate: any = {
      status: body.status,
      updatedAt: new Date()
    };
    if (body.password) {
      userUpdate.passwordHash = await passwordHasher.hash(body.password);
    }
    batchQueries.push(
      db.update(schema.users).set(userUpdate).where(eq(schema.users.id, id))
    );

    // 2. 业务表 (Member) 更新
    const memberUpdate: any = {
      level: body.level,
      nickname: body.nickname,
      avatar: body.avatar,
      phone: body.phone,
      gender: body.gender,
      birthday: body.birthday,
      bio: body.bio,
      updatedAt: new Date()
    };
    
    // 过滤掉 undefined
    Object.keys(memberUpdate).forEach(key => memberUpdate[key] === undefined && delete memberUpdate[key]);

    batchQueries.push(
      db.update(schema.members).set(memberUpdate).where(eq(schema.members.id, id))
    );

    await db.batch(batchQueries as any);

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * 删除用户
 */
users.delete('/:id', requirePermission('user.delete'), async (c) => {
  const id = c.req.param('id');
  const db = await createDbClient(c.env.DB);
  try {
    // 强制级联清理 (手动模式，以防 D1 环境下外键级联失效)
    const batchQueries = [
      db.delete(schema.apiTokens).where(eq(schema.apiTokens.userId, id)),
      db.delete(schema.memberSessions).where(eq(schema.memberSessions.userId, id)),
      db.delete(schema.adminSessions).where(eq(schema.adminSessions.userId, id)),
      db.delete(schema.members).where(eq(schema.members.id, id)),
      db.delete(schema.admins).where(eq(schema.admins.id, id)),
      db.delete(schema.users).where(eq(schema.users.id, id))
    ];
    
    await db.batch(batchQueries as any);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * [API Management] 获取所有 API 令牌
 */
users.get('/tokens/all', requirePermission('user.api_manage'), async (c) => {
  const db = await createDbClient(c.env.DB);
  const tokens = await db.select({
    id: schema.apiTokens.id,
    userId: schema.apiTokens.userId,
    email: schema.users.email,
    name: schema.apiTokens.name,
    token: schema.apiTokens.token,
    status: schema.apiTokens.status,
    lastUsedAt: schema.apiTokens.lastUsedAt,
    createdAt: schema.apiTokens.createdAt
  })
  .from(schema.apiTokens)
  .innerJoin(schema.users, eq(schema.apiTokens.userId, schema.users.id))
  .all();
  
  return c.json({ success: true, data: tokens });
});

/**
 * [API Management] 为用户颁发新令牌
 */
users.post('/:id/tokens', requirePermission('user.api_manage'), async (c) => {
  const userId = c.req.param('id');
  const { name } = await c.req.json();
  const db = await createDbClient(c.env.DB);
  
  const tokenValue = 'at_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  try {
    await db.insert(schema.apiTokens).values({
      userId,
      name: name || 'Default Token',
      token: tokenValue,
      status: 'active'
    }).run();
    
    return c.json({ success: true, token: tokenValue });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * [API Management] 撤销令牌
 */
users.delete('/tokens/:tokenId', requirePermission('user.api_manage'), async (c) => {
  const tokenId = c.req.param('tokenId');
  const db = await createDbClient(c.env.DB);
  
  try {
    await db.delete(schema.apiTokens).where(eq(schema.apiTokens.id, parseInt(tokenId))).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * [BALANCE] 获取余额变动日志
 */
users.get('/balance/logs', requirePermission('user.balance_manage'), async (c) => {
  const db = await createDbClient(c.env.DB);
  const logs = await db.select({
    id: schema.balanceLogs.id,
    userId: schema.balanceLogs.userId,
    email: schema.users.email,
    nickname: schema.members.nickname,
    type: schema.balanceLogs.type,
    amount: schema.balanceLogs.amount,
    before: schema.balanceLogs.before,
    after: schema.balanceLogs.after,
    remark: schema.balanceLogs.remark,
    createdAt: schema.balanceLogs.createdAt
  })
  .from(schema.balanceLogs)
  .innerJoin(schema.users, eq(schema.balanceLogs.userId, schema.users.id))
  .leftJoin(schema.members, eq(schema.balanceLogs.userId, schema.members.id))
  .orderBy(desc(schema.balanceLogs.createdAt))
  .all();
  
  return c.json({ success: true, data: logs });
});

/**
 * [BALANCE] 调整余额
 */
users.post('/balance/adjust', requirePermission('user.balance_manage'), async (c) => {
  const { userId, type, amount, remark } = await c.req.json();
  const db = await createDbClient(c.env.DB);
  
  try {
    const member = await db.select().from(schema.members).where(eq(schema.members.id, userId)).get();
    if (!member) return c.json({ error: '用户不存在' }, 404);
    
    const before = member.balance;
    let after = before;
    let changeAmount = amount;
    
    if (type === 'add') after += amount;
    else if (type === 'sub') after -= amount;
    else if (type === 'set') {
      after = amount;
      changeAmount = amount - before;
    }
    
    await db.batch([
      db.update(schema.members).set({ balance: after }).where(eq(schema.members.id, userId)),
      db.insert(schema.balanceLogs).values({
        tenantId: 1,
        userId,
        type,
        amount: changeAmount,
        before,
        after,
        beforeAmount: before,
        afterAmount: after,
        remark
      })
    ]);
    
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * [POINTS] 获取积分变动日志
 */
users.get('/points/logs', requirePermission('user.points_manage'), async (c) => {
  const db = await createDbClient(c.env.DB);
  const logs = await db.select({
    id: schema.pointsLogs.id,
    userId: schema.pointsLogs.userId,
    email: schema.users.email,
    nickname: schema.members.nickname,
    type: schema.pointsLogs.type,
    amount: schema.pointsLogs.amount,
    before: schema.pointsLogs.before,
    after: schema.pointsLogs.after,
    remark: schema.pointsLogs.remark,
    createdAt: schema.pointsLogs.createdAt
  })
  .from(schema.pointsLogs)
  .innerJoin(schema.users, eq(schema.pointsLogs.userId, schema.users.id))
  .leftJoin(schema.members, eq(schema.pointsLogs.userId, schema.members.id))
  .orderBy(desc(schema.pointsLogs.createdAt))
  .all();
  
  return c.json({ success: true, data: logs });
});

/**
 * [POINTS] 调整积分
 */
users.post('/points/adjust', requirePermission('user.points_manage'), async (c) => {
  const { userId, type, amount, remark } = await c.req.json();
  const db = await createDbClient(c.env.DB);
  
  try {
    const member = await db.select().from(schema.members).where(eq(schema.members.id, userId)).get();
    if (!member) return c.json({ error: '用户不存在' }, 404);
    
    const before = member.points;
    let after = before;
    let changeAmount = amount;
    
    if (type === 'add') after += amount;
    else if (type === 'sub') after -= amount;
    else if (type === 'set') {
      after = amount;
      changeAmount = amount - before;
    }
    
    await db.batch([
      db.update(schema.members).set({ points: after }).where(eq(schema.members.id, userId)),
      db.insert(schema.pointsLogs).values({
        tenantId: 1,
        userId,
        type,
        amount: changeAmount,
        before,
        after,
        beforeAmount: before,
        afterAmount: after,
        remark
      })
    ]);
    
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default users;
