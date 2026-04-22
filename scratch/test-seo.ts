import { SeoUtils } from './src/lib/SeoUtils';
import { SeoService } from './src/services/SeoService';

// Mock data
const frontendUrl = 'https://mysite.com';
const defaultLocale = 'en-US';

const groupEntries = [
  { id: 1, locale: 'en-US', collectionSlug: 'product', translationGroup: 'g1', updatedAt: new Date('2026-04-14T12:00:00Z') },
  { id: 2, locale: 'zh-CN', collectionSlug: 'product', translationGroup: 'g1', updatedAt: new Date('2026-04-14T12:00:00Z') },
  { id: 3, locale: 'jp-JP', collectionSlug: 'product', translationGroup: 'g1', updatedAt: new Date('2026-04-14T12:00:00Z') },
];

console.log('--- Unit Test: URL Generation ---');
groupEntries.forEach(e => {
  const url = SeoUtils.buildCanonicalUrl(frontendUrl, e.locale, defaultLocale, e.collectionSlug, e.id);
  console.log(`Locale: ${e.locale} -> URL: ${url}`);
});

console.log('\n--- Integration Test: Sitemap XML Fragment for Multi-lang ---');
const xml = SeoService.generateSitemapEntries(groupEntries.map(e => ({
  ...e,
  alternates: groupEntries
})), frontendUrl, defaultLocale);

console.log(xml);
