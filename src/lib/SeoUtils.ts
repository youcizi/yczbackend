/**
 * SEO 专用工具类 - 处理模板解析与 URL 层级构建
 */
export class SeoUtils {
  /**
   * 模板变量解析: 支持 {{name}} - {{site_name}}
   * 解析失败时优雅返回空字符串，不保留 {{}} 占位符
   */
  static resolveTemplate(template: string, data: Record<string, any>): string {
    if (!template) return '';
    return template.replace(/\{\{(.*?)\}\}/g, (match, key) => {
      const val = data[key.trim()];
      // 注意: 如果字段缺失或为 null/undefined, 返回空字符串，不保留占位符
      return (val !== undefined && val !== null) ? String(val) : '';
    });
  }

  /**
   * 构建多语言友好的 Canonical URL
   * 逻辑：若为默认语种，则 URL 中不包含语言前缀
   * @param baseUrl 前端主域名 (frontend_url)
   * @param locale 实体当前语种
   * @param defaultLocale 系统默认语种
   * @param slug 业务集合标识
   * @param id 实体自增 ID
   */
  static buildCanonicalUrl(baseUrl: string, locale: string, defaultLocale: string, slug: string, id: string | number): string {
    const cleanBase = baseUrl.replace(/\/$/, ''); // 移除结尾斜杠
    const isDefault = locale === defaultLocale;
    
    // 默认语种路径缩减逻辑: /product/1 而非 /zh-CN/product/1
    const prefix = isDefault ? '' : `/${locale}`;
    
    return `${cleanBase}${prefix}/${slug}/${id}`;
  }
}
