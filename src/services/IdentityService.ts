import { sign } from 'hono/jwt';
import { generateId } from 'lucia';
import { createDbClient, schema, eq, and } from '../db';
import { passwordHasher } from '../lib/auth';
import { hookManager } from '../lib/plugin-hooks';

export class IdentityService {
  /**
   * 注册新用户 (包含核心表与业务表同步创建)
   */
  static async register(d1: any, data: { 
    tenantId: number, 
    email: string, 
    password: string, 
    userType: 'admin' | 'member', 
    username?: string 
  }) {
    const db = await createDbClient(d1);
    const userId = generateId(15);
    const passwordHash = await passwordHasher.hash(data.password);

    // 开启事务确保数据一致性
    const user = await db.transaction(async (tx: any) => {
      // 1. 创建核心认证记录
      await tx.insert(schema.users).values({
        id: userId,
        tenantId: data.tenantId,
        email: data.email,
        passwordHash,
        userType: data.userType,
        status: 'active'
      }).run();

      // 2. 创建业务关联记录
      if (data.userType === 'admin') {
        await tx.insert(schema.admins).values({
          id: userId,
          username: data.username || data.email.split('@')[0],
        }).run();
      } else {
        await tx.insert(schema.members).values({
          id: userId,
          type: 'registered',
          level: 1
        }).run();
      }

      // 3. 获取完整用户信息用于返回
      return await tx.select().from(schema.users).where(eq(schema.users.id, userId)).get();
    });

    // 🚀 核心钩子：身份注册完成 (用于插件扩展逻辑)
    if (user) {
      await hookManager.emit('identity:registered', { user });
    }

    return user;
  }

  /**
   * 统一身份认证
   */
  static async authenticate(d1: any, tenantId: number, email: string, password: string) {
    const db = await createDbClient(d1);
    
    const user = await db.select()
      .from(schema.users)
      .where(and(
        eq(schema.users.email, email),
        eq(schema.users.tenantId, tenantId)
      ))
      .get();

    if (!user) return null;

    // 校验状态
    if (user.status !== 'active') {
      throw new Error('ACCOUNT_DISABLED');
    }

    const valid = await passwordHasher.verify(user.passwordHash, password);
    if (!valid) return null;

    return user;
  }

  /**
   * 签发 JWT Token
   */
  static async generateToken(user: any, secret: string) {
    const payload = {
      sub: user.id,
      email: user.email,
      userType: user.userType,
      tenantId: user.tenantId,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7), // 默认 7 天有效期
    };
    return await sign(payload, secret);
  }
}
