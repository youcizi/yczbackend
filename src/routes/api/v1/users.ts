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
    await db.delete(schema.users).where(eq(schema.users.id, id)).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default users;
