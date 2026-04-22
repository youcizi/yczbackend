import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';

const PAGES_DIR = path.resolve(process.cwd(), 'src/pages/admin');
const SIDEBAR_FILE = path.resolve(process.cwd(), 'src/components/Sidebar.tsx');

// 递归扫描目录获取所有物理路由
function getAstroPages(dir: string, base = ''): string[] {
  const files = fs.readdirSync(dir);
  let pages: string[] = [];

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const relPath = path.join(base, file).replace(/\\/g, '/');

    if (fs.statSync(fullPath).isDirectory()) {
      pages = pages.concat(getAstroPages(fullPath, relPath));
    } else if (file.endsWith('.astro')) {
      // 转换 Astro 文件路径为 URL 模式 (如 index.astro -> "" , [slug].astro -> ":slug")
      let url = relPath.replace(/\.astro$/, '');
      if (url.endsWith('/index')) url = url.slice(0, -6);
      if (url === 'index') url = '';
      
      // 处理动态参数 [slug] -> :slug
      url = url.replace(/\[(\w+)\]/g, ':$1');
      
      pages.push('/admin' + (url ? '/' + url : ''));
    }
  }
  return pages;
}

describe('物理路由完整性审计 (Anti-404)', () => {
  const physicalRoutes = getAstroPages(PAGES_DIR);
  const sidebarContent = fs.readFileSync(SIDEBAR_FILE, 'utf-8');

  it('验证 Sidebar.tsx 中的静态链接是否有物理文件支撑', () => {
    // 匹配 href: '/admin/...' 格式的链接
    const hrefRegex = /href:\s*['"](\/admin[^'"]*)['"]/g;
    let match;
    const errors: string[] = [];

    while ((match = hrefRegex.exec(sidebarContent)) !== null) {
      const url = match[1];
      // 检查该 URL 是否在物理表或能通过正则匹配
      const exists = physicalRoutes.some(route => {
        if (route === url) return true;
        // 处理动态匹配 (简单的)
        const pattern = new RegExp('^' + route.replace(/:\w+/g, '[^/]+') + '$');
        return pattern.test(url);
      });

      if (!exists) {
        errors.push(`侧边栏引用了不存在的路由: ${url}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`\n❌ [路由漏点检测失败]:\n${errors.join('\n')}\n请在 src/pages/admin 下补齐缺失的 .astro 文件。`);
    }
  });

  it('验证动态集合链接规则 (/admin/collections/:slug)', () => {
    const dynamicPattern = '/admin/collections/:slug';
    const exists = physicalRoutes.some(route => route === dynamicPattern);
    expect(exists).toBe(true);
  });

  it('禁止干扰测试的编码文件名 (如 %5Bslug%5D.astro)', () => {
    const files = fs.readdirSync(PAGES_DIR, { recursive: true }) as string[];
    const encodedFiles = files.filter(f => f.includes('%5B') || f.includes('%5D'));
    
    if (encodedFiles.length > 0) {
      throw new Error(`\n❌ [物理路径命名错误]:\n检测到含有 URL 编码的文件名: ${encodedFiles.join(', ')}\n这会导致 Astro 动态路由失效。请确保文件名使用字面括号 [slug].astro`);
    }
  });
});
