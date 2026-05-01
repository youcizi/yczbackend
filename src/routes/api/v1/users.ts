import { Hono } from 'hono';
import { IdentityService } from '../../../services/IdentityService';
import { createDbClient, schema, eq, and } from '../../../db';
import { passwordHasher } from '../../../lib/auth';
import { requirePermission } from '../../../middleware/rbac';

const users = new Hono<{ Bindings: any }>();

/**
 * 获取用户列表 (仅限 Member 类型，确保与系统管理员隔离)
 */
users.get('/', requirePermission('user.view'), async (c) => {
  const db = await createDbClient(c.env.DB);
  const userList = await db.select({
    id: schema.users.id,
    email: schema.users.email,
    userType: schema.users.userType,
    status: schema.users.status,
    createdAt: schema.users.createdAt,
    level: schema.members.level,
  })
  .from(schema.users)
  .leftJoin(schema.members, eq(schema.users.id, schema.members.id))
  .where(eq(schema.users.userType, 'member'))
  .all();
  
  return c.json(userList);
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
 * 更新用户 (支持 Level 更新)
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
    batchQueries.push(
      db.update(schema.members).set({ level: body.level }).where(eq(schema.members.id, id))
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

export default users;
