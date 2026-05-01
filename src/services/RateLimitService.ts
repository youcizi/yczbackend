export class RateLimitService {
  /**
   * 检查并增加访问计数
   * @param kv KV Namespace 绑定
   * @param key 唯一标识 (如 IP 或 Email)
   * @param limit 限制次数
   * @param windowSeconds 窗口时间 (秒)
   */
  static async checkRateLimit(kv: any, key: string, limit: number, windowSeconds: number): Promise<{ success: boolean, remaining: number }> {
    if (!kv) {
      console.warn('⚠️ [RateLimit] KV binding is missing, skipping rate limit check.');
      return { success: true, remaining: limit };
    }

    const kvKey = `rl:${key}`;
    const current = await kv.get(kvKey);
    const count = current ? parseInt(current) : 0;

    if (count >= limit) {
      return { success: false, remaining: 0 };
    }

    const nextCount = count + 1;
    // 使用默认过期时间
    await kv.put(kvKey, nextCount.toString(), { expirationTtl: windowSeconds });

    return { success: true, remaining: limit - nextCount };
  }

  /**
   * 重置计数 (如登录成功后)
   */
  static async resetRateLimit(kv: any, key: string) {
    if (!kv) return;
    await kv.delete(`rl:${key}`);
  }
}
