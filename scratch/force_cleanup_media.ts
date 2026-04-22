
import { createDbClient } from '../src/db';
import { entities, models, collections, permissions, rolePermissions } from '../src/db/schema';
import { eq, inArray } from 'drizzle-orm';

async function forceCleanup() {
  // 从环境变量获取 DB (D1 绑定)
  const db = await createDbClient(process.env.DB);
  console.log('🚀 Starting force cleanup of [media_library]...');

  try {
    // 1. 找到 media_library 集合
    const mediaColl = await db.select().from(collections).where(eq(collections.slug, 'media_library')).get();
    
    if (mediaColl) {
      console.log(`Found collection: ${mediaColl.name} (ID: ${mediaColl.id})`);
      
      // 2. 删除所有关联的 entity 数据 (脏数据根源)
      const deletedEntities = await db.delete(entities).where(eq(entities.collectionId, mediaColl.id)).returning();
      console.log(`✅ Deleted ${deletedEntities.length} residual entities.`);

      // 3. 删除集合
      await db.delete(collections).where(eq(collections.id, mediaColl.id));
      console.log(`✅ Deleted collection [media_library].`);
    }

    // 4. 找到 media_library 模型
    const mediaModel = await db.select().from(models).where(eq(models.slug, 'media_library')).get();
    if (mediaModel) {
      console.log(`Found model: ${mediaModel.name} (ID: ${mediaModel.id})`);
      
      // 5. 强制删除关联权限
      const permSlugs = ['view', 'edit', 'delete'].map(a => `entity:media_library:${a}`);
      await db.delete(rolePermissions).where(inArray(rolePermissions.permissionSlug, permSlugs));
      await db.delete(permissions).where(inArray(permissions.slug, permSlugs));
      console.log(`✅ Cleaned up associated permissions.`);

      // 6. 删除模型
      await db.delete(models).where(eq(models.id, mediaModel.id));
      console.log(`✅ Force deleted model [media_library].`);
    }

    console.log('✨ Cleanup complete.');
  } catch (err) {
    console.error('❌ Cleanup failed:', err);
  }
}

forceCleanup();
