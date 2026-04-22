import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { globSync } from 'glob';

describe('符号级物理审计 2.1 (Semantic Integrity Audit)', () => {
  const files = globSync('src/**/*.{ts,tsx,astro}', { cwd: process.cwd() });
  
  files.forEach(file => {
    it(`审计符号定义: ${file}`, () => {
      const content = fs.readFileSync(file, 'utf-8');
      const dir = path.dirname(path.resolve(process.cwd(), file));
      
      const importRegex = /import\s+(?:([\w\s{},*]+)\s+from\s+)?['"](.*?)['"]/g;
      let match;
      const errors: string[] = [];

      while ((match = importRegex.exec(content)) !== null) {
        let symbolsString = match[1]?.trim();
        const importPath = match[2];
        
        if (!importPath || (!importPath.startsWith('.') && !importPath.startsWith('@/'))) continue;
        
        // 1. 物理路径解析
        let resolvedPath = '';
        if (importPath.startsWith('@/')) {
          resolvedPath = path.resolve(process.cwd(), 'src', importPath.slice(2));
        } else {
          resolvedPath = path.resolve(dir, importPath);
        }

        const extensions = ['', '.tsx', '.ts', '.astro', '.js', '/index.tsx', '/index.ts'];
        let actualFile = '';
        const exists = extensions.some(ext => {
           const fullPath = resolvedPath + ext;
           if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
             actualFile = fullPath;
             return true;
           }
           return false;
        });

        if (!exists) {
          errors.push(`缺失物理文件: "${importPath}"`);
          continue;
        }

        // 2. 深度符号审计 (仅针对 TS/TSX)
        if (symbolsString && actualFile && (actualFile.endsWith('.ts') || actualFile.endsWith('.tsx'))) {
          const targetContent = fs.readFileSync(actualFile, 'utf-8');
          
          // 如果目标文件存在 export *，则由于动态解析成本过高，暂予免检（通常为 Drizzle 这类库）
          if (targetContent.includes('export *')) continue;

          // 解析命名导出
          if (symbolsString.includes('{')) {
            const namedImports = symbolsString
              .match(/\{([\s\S]*?)\}/)?.[1]
              .split(',')
              .map(s => s.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]) // 关键修复：剥离 type 前缀
              .filter(s => s && s !== 'type') || [];
              
            namedImports.forEach(sym => {
              // 兼容异步、类型、常量、接口等多种导出申明
              const exportRegex = new RegExp(`export\\s+(?:const|function|let|interface|type|class|enum|async\\s+function)\\s+${sym}\\b|export\\s+\\{[^}]*?\\b${sym}\\b[^}]*?\\}`, 'm');
              if (!exportRegex.test(targetContent)) {
                errors.push(`符号缺失: "${sym}" 在源文件 ${path.basename(actualFile)} 中未定义`);
              }
            });
          }
          
          // 默认导出校验
          const defaultImport = symbolsString.startsWith('{') ? null : symbolsString.split(',')[0].trim();
          if (defaultImport && !defaultImport.includes('*') && defaultImport !== 'type') {
             const cleanDefault = defaultImport.replace(/^type\s+/, ''); // 剥离 type 前缀
             if (!targetContent.includes('export default') && !targetContent.includes('as default')) {
               errors.push(`默认导出缺失: "${cleanDefault}" 在源文件 ${path.basename(actualFile)} 中未定义`);
             }
          }
        }
      }

      if (errors.length > 0) {
        throw new Error(`\n❌ [导出损坏]: 在文件 ${file} 中发现以下无效引用：\n${errors.join('\n')}`);
      }
    });
  });
});
