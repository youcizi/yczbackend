/**
 * 存储服务 - 接入真实的 Cloudflare R2
 * 实现物理文件存储与元数据同步
 */
export interface UploadResult {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

export class StorageService {
  /**
   * 上传文件至 R2
   * @param file 由 c.req.parseBody 获取的文件对象 (File/Blob)
   * @param bucket R2 绑定对象 (c.env.MEDIA_BUCKET)
   */
  static async upload(file: any, bucket: any): Promise<UploadResult> {
    const filename = file.name || `file_${Date.now()}`;
    const mimeType = file.type || 'application/octet-stream';
    const size = file.size || 0;
    
    // 生成唯一 Key 防止冲突
    const key = `media/${Date.now()}_${filename}`;

    if (!bucket) {
      throw new Error('R2 存储桶尚未绑定，请检查核心配置。');
    }

    // 转换为 ArrayBuffer 或直接推送到 R2
    const content = typeof file.arrayBuffer === 'function' ? await file.arrayBuffer() : file.content;
    
    await bucket.put(key, content, {
      httpMetadata: { contentType: mimeType }
    });

    // 返回分发路由 URL
    // 我们通过后端自建的 /api/v1/media/file/:key 路由分发文件
    const url = `/api/v1/media/file/${key}`;

    return {
      url,
      filename,
      mimeType,
      size
    };
  }
}
