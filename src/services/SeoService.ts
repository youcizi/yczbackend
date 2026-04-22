import { SeoUtils } from '../lib/SeoUtils';

/**
 * SEO 业务核心服务类
 */
export class SeoService {
  /**
   * GEO 语义化增强: 拼装结构化 JSON-LD 数据
   * 支持: Product, Article, Organization
   */
  static generateJsonLd(record: any, collectionSlug: string, schemaType: string, frontendUrl: string, defaultLocale: string) {
    const url = SeoUtils.buildCanonicalUrl(frontendUrl, record.locale, defaultLocale, collectionSlug, record.id);
    
    // 基础骨架 (必须包含 mainEntityOfPage 和 dateModified)
    const base: any = {
      "@context": "https://schema.org",
      "@type": schemaType || "Article",
      "mainEntityOfPage": { "@type": "WebPage", "@id": url },
      "datePublished": record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
      "dateModified": record.updatedAt instanceof Date ? record.updatedAt.toISOString() : (record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt)
    };

    // 针对 GEO/AI 权重的语义化增强
    const lowerType = schemaType?.toLowerCase();
    if (lowerType === 'product') {
      return {
        ...base,
        "@type": "Product",
        "name": record.name || record.title,
        "description": record.description || record.summary,
        "brand": { "@type": "Brand", "name": record.brand || "Default" },
        "offers": {
          "@type": "Offer",
          "url": url,
          "priceCurrency": "USD",
          "price": record.price || "0"
        }
      };
    } else if (lowerType === 'organization') {
      return {
        ...base,
        "@type": "Organization",
        "name": record.name || record.company_name || "Organization",
        "url": frontendUrl,
        "logo": record.logo || record.icon
      };
    }
    
    // 默认按照 Article 处理
    return {
      ...base,
      "headline": record.title || record.name,
      "author": { "@type": "Person", "name": record.author || "Admin" }
    };
  }

  /**
   * 优雅处理默认语种的 URL 缩减逻辑，生成 Sitemap 的 <url> 列表
   */
  static generateSitemapEntries(entityGroups: any[], frontendUrl: string, defaultLocale: string): string {
    return entityGroups.map(entry => {
      // canonical URL (自动处理默认语种缩减)
      const loc = SeoUtils.buildCanonicalUrl(frontendUrl, entry.locale, defaultLocale, entry.collectionSlug, entry.id);
      
      // 多语言交叉索引 (xhtml:link)
      // 同一个 translationGroup 的所有成员互为 alternate
      // 这里的 entry 应包含同组内的所有 alternate 信息
      const alternates = (entry.alternates || []).map((alt: any) => {
        const altUrl = SeoUtils.buildCanonicalUrl(frontendUrl, alt.locale, defaultLocale, alt.collectionSlug, alt.id);
        return `    <xhtml:link rel="alternate" hreflang="${alt.locale}" href="${altUrl}" />`;
      }).join('\n');

      return `  <url>\n    <loc>${loc}</loc>\n${alternates}\n    <lastmod>${new Date(entry.updatedAt).toISOString()}</lastmod>\n    <priority>0.8</priority>\n  </url>`;
    }).join('\n');
  }
}
