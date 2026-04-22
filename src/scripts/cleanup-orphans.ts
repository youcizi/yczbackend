import { eq, notInArray, sql } from 'drizzle-orm';
import { createDbClient } from '../db';
import { entities, collections } from '../db/schema';

/**
 * [自愈逻辑] 清理所有关联集合已失效的实体脏数据 (Orphan Cleanup)
 */
export async function cleanupOrphanEntities(dbEnv: any) {
  const db = await createDbClient(dbEnv);
  console.log('🧹 [Cleanup] 正在扫描孤立实体数据...');

  try {
    // 1. 查找所有不在 collections 表中的 collection_id
    // SQLite 子查询：DELETE FROM entities WHERE collection_id NOT IN (SELECT id FROM collections)
    const validCollectionIdsQuery = db.select({ id: collections.id }).from(collections);
    const orphanCountRes = await db.select({ count: sql`count(*)` })
      .from(entities)
      .where(notInArray(entities.collectionId, validCollectionIdsQuery))
      .get() as { count: number };

    if (orphanCountRes && orphanCountRes.count > 0) {
      console.warn(`🚨 [Cleanup] 发现 ${orphanCountRes.count} 条孤立记录，正在物理清除...`);
      
      const result = await db.delete(entities)
        .where(notInArray(entities.collectionId, validCollectionIdsQuery))
        .run();

      console.log(`✅ [Cleanup] 成功清除销毁 ${orphanCountRes.count} 条脏数据。`);
      return { cleaned: orphanCountRes.count };
    } else {
      console.log('✨ [Cleanup] 未发现脏数据，系统状态健康。');
      return { cleaned: 0 };
    }
  } catch (err) {
    console.error('❌ [Cleanup] 执行清理失败:', err);
    throw err;
  }
}
