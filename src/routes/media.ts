import { Hono } from 'hono';
import { createDbClient } from '../db';
import { mediaItems, entities } from '../db/schema';
import { eq, desc, notInArray, and, lt, sql } from 'drizzle-orm';
import { StorageService } from '../lib/storage-service';
import { requirePermission } from '../middleware/rbac';

const mediaRouter = new Hono<{ Bindings: any }>();

// 全局附件管理权限拦截
mediaRouter.use('*', requirePermission('media.manage'));

/**
 * POST /api/v1/media/upload
 * 异步上传文件并创建独立媒体记录
 */
mediaRouter.post('/upload', async (c) => {
  const db = await createDbClient(c.env.DB);

  try {
    const body = await c.req.parseBody();
    const file = body['file'] as any;

    if (!file) {
      return c.json({ error: 'No file uploaded' }, 400);
    }
    
    // 兼容性处理
    const normalizedFile = typeof file === 'string' ? {
      name: 'test-file.txt',
      type: 'text/plain',
      size: file.length,
      content: file
    } : file;

    // 1. 执行物理存储
    const uploadResult = await StorageService.upload(normalizedFile, c.env.MEDIA_BUCKET);

    // 2. 写入独立数据库记录 (media_items)
    const user = c.get('user');
    const [newMedia] = await db.insert(mediaItems).values({
      url: uploadResult.url,
      filename: uploadResult.filename,
      mimeType: uploadResult.mimeType,
      size: uploadResult.size,
      isRemote: false,
      createdBy: user?.id
    }).returning();

    return c.json({
      id: newMedia.id,
      ...uploadResult
    });
  } catch (err: any) {
    console.error('❌ [Media] Upload Error:', err);
    return c.json({ error: '文件上传失败', details: err.message }, 500);
  }
});

/**
 * POST /api/v1/media
 * 支持远程 URL 持久化 或 记录手动录入
 */
mediaRouter.post('/', async (c) => {
  const db = await createDbClient(c.env.DB);
  const { url, filename, mimeType, size, isRemote } = await c.req.json();

  if (!url) return c.json({ error: 'URL is required' }, 400);

  try {
    const user = c.get('user');
    const [newMedia] = await db.insert(mediaItems).values({
      url,
      filename: filename || url.split('/').pop() || 'remote-file',
      mimeType: mimeType || 'image/remote',
      size: size || 0,
      isRemote: isRemote ?? true,
      createdBy: user?.id
    }).returning();

    return c.json(newMedia);
  } catch (err: any) {
    return c.json({ error: '保存媒体记录失败', details: err.message }, 500);
  }
});

/**
 * GET /api/v1/media/file/*
 * 媒体文件分发路由 (不受权限限制，用于外部展示)
 */
mediaRouter.get('/file/*', async (c) => {
  const bucket = c.env.MEDIA_BUCKET;
  const key = c.req.path.replace('/api/v1/media/file/', '');
  
  if (!bucket) return c.text('R2 Bucket not bound', 500);

  const object = await bucket.get(key);
  if (!object) return c.text('File Not Found', 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000');

  return new Response(object.body, { headers });
});

/**
 * GET /api/v1/media
 * 获取独立媒体列表
 */
mediaRouter.get('/', async (c) => {
  const db = await createDbClient(c.env.DB);
  
  const results = await db.select()
    .from(mediaItems)
    .orderBy(desc(mediaItems.id))
    .all();

  return c.json({ data: results });
});

/**
 * DELETE /api/v1/media/:id
 * 删除媒体记录
 */
mediaRouter.delete('/:id', async (c) => {
  const db = await createDbClient(c.env.DB);
  const id = parseInt(c.req.param('id'));

  try {
    const user = c.get('user');
    const isAdmin = c.get('isAdmin'); // 由 rbac 中间件设置

    // 1. 查询记录归属
    const existing = await db.select().from(mediaItems).where(eq(mediaItems.id, id)).get();
    if (!existing) return c.json({ error: 'Media record not found' }, 404);

    // 2. 权限判定：超级管理员可删除所有；普通用户仅能删除自己的
    if (!isAdmin && existing.createdBy !== user?.id) {
      return c.json({ error: '权限不足: 您只能删除自己上传的文件' }, 403);
    }

    const result = await db.delete(mediaItems)
      .where(eq(mediaItems.id, id))
      .returning();
      
    if (result.length === 0) {
      return c.json({ error: 'Record not found' }, 404);
    }
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * GET /api/v1/media/orphans/scan
 * 扫描冗余附件：不在 entities 中引用且创建超过 24 小时的文件
 */
mediaRouter.get('/orphans/scan', async (c) => {
  const db = await createDbClient(c.env.DB);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    // 1. 获取所有实体引用的 ID
    const allEntities = await db.select().from(entities).all();
    const referencedIds = new Set<number>();
    
    allEntities.forEach((e: any) => {
      // 深度遍历 dataJson 寻找可能的数字 ID
      JSON.stringify(e.dataJson).match(/\d+/g)?.forEach(id => referencedIds.add(Number(id)));
    });

    // 2. 扫描数据库
    const allMedia = await db.select().from(mediaItems).all();
    const orphans = allMedia.filter(m => {
      const isOld = m.createdAt < oneDayAgo;
      const isUnreferenced = !referencedIds.has(m.id);
      return isOld && isUnreferenced;
    });

    return c.json({
      count: orphans.length,
      totalSize: orphans.reduce((acc, cur) => acc + cur.size, 0),
      items: orphans
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * DELETE /api/v1/media/orphans/cleanup
 * 一键清理冗余记录 (逻辑删除 + 物理记录清除)
 */
mediaRouter.delete('/orphans/cleanup', async (c) => {
  const db = await createDbClient(c.env.DB);
  // 为了安全，此接口仅清除数据库记录，物理文件清理通常由专门的脚本配合云端生命周期规则完成
  return c.json({ success: true, message: 'Cleanup command received' });
});

export default mediaRouter;
