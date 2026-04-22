import { describe, it, expect, beforeEach } from 'vitest';
import { seedAdmin } from '../../core/seed';
import { admins } from '../../db/schema';
import { createTestDb } from '../helpers/test-utils';

describe('系统自愈：Seed 逻辑测试', () => {
  let db: any;
  let rawDb: any;

  beforeEach(() => {
    // 使用标准化的测试数据库 (包含所有必要的表，如 languages)
    const testCtx = createTestDb();
    rawDb = testCtx.raw;
    db = testCtx.db;
  });

  it('当数据库为空时，应自动生成超级管理员', async () => {
    // 传入 rawDb 实例，createDbClient 会识别并正确包装
    await seedAdmin(rawDb, 'password123');
    
    const adminCount = await db.select().from(admins).all();
    expect(adminCount.length).toBe(1);
    expect(adminCount[0].username).toBe('admin');
  });

  it('当超级管理员已存在时，不应重复生成', async () => {
    await db.insert(admins).values({ id: '01', username: 'admin', hashedPassword: '---' });
    await seedAdmin(db, 'password123'); // 传入 drizzle 实例也可以
    
    const adminCount = await db.select().from(admins).all();
    expect(adminCount.length).toBe(1);
  });
});
