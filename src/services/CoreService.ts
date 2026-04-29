import { createDbClient } from '../db';
import { languages } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * CoreService: 系统核心基础服务
 */
export class CoreService {
  /**
   * 获取系统当前已开启的所有语种
   */
  static async getEnabledLanguages(db: any) {
    return await db.select()
      .from(languages)
      .where(eq(languages.status, 'active'))
      .all();
  }
}
