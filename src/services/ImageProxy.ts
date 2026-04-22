import { Context } from 'hono';

/**
 * ImageProxy
 * 基于 Cloudflare R2 的高性能流式图片代理
 * 职责：从存储桶并发读取内容，处理 Range 请求，并自动适配 MIME 类型
 */
export class ImageProxy {
  
  /**
   * 处理 R2 资源读取请求
   * @param c Hono 上下文
   * @param key R2 对象键 (通常是文件名)
   */
  static async serve(c: Context, key: string) {
    const bucket = c.env.MEDIA_BUCKET as R2Bucket;
    if (!bucket) {
      return c.json({ error: 'R2 bucket not bound' }, 500);
    }

    // 1. 获取请求头中的 Range (用于音视频或大图分段加载)
    const rangeHeader = c.req.header('range');
    
    // 2. 从 R2 获取对象
    const object = await bucket.get(key, {
      range: rangeHeader
    });

    if (!object) {
      return c.json({ error: 'Image not found' }, 404);
    }

    // 3. 推断 Content-Type
    const contentType = this.getContentType(key);

    // 4. 构建响应头
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Content-Type', contentType);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    
    // 处理 ETag 以支持 304 缓存
    headers.set('ETag', object.httpEtag);

    // 5. 流式返回数据
    return new Response(object.body, {
      status: rangeHeader ? 206 : 200,
      headers
    });
  }

  /**
   * 简单的 MIME 类型推断逻辑
   */
  private static getContentType(key: string): string {
    const ext = key.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      'webp': 'image/webp',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
      'avif': 'image/avif',
      'mp4': 'video/mp4',
      'pdf': 'application/pdf'
    };

    return mimeMap[ext || ''] || 'application/octet-stream';
  }
}
