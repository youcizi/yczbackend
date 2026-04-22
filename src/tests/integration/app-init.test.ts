import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApplication } from '@/app';
import * as dbUtils from '@/db';
import { registry } from '@/lib/permission-registry';

// Mock 数据库连接，强制模拟失败路径
vi.mock('@/db', async () => {
  const actual = await vi.importActual<typeof dbUtils>('@/db');
  return {
    ...actual,
    createDbClient: vi.fn()
  };
});

describe('系统初始化：环境鲁棒性测试', () => {
  beforeEach(() => {
    registry.clear(); // 清空单例状态，防止干扰
    vi.clearAllMocks();
  });

  it('当数据库初始化抛出异常时，应捕获并返回 500', async () => {
    const { createDbClient } = await import('@/db');
    (createDbClient as any).mockRejectedValue(new Error('Mock DB Sync Failed'));

    const app = createApplication();
    const emptyEnv = { 
      NODE_ENV: 'test',
      DEFAULT_ADMIN_PASSWORD: 'test-password-123'
    };

    // 访问任意路径以触发初始化中间件
    const res = await app.fetch(
      new Request('http://localhost/api/any-init-route'), 
      emptyEnv
    );

    expect(res.status).toBe(500);
    const data: any = await res.json();
    expect(data.error).toBe('System Initialization Failed');
    expect(data.details).toBe('Mock DB Sync Failed');
  });
});
