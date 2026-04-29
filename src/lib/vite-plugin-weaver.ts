import { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

interface Injection {
  file: string;
  target: string;
  find: string;
  position: 'beforeBegin' | 'afterBegin' | 'beforeEnd' | 'afterEnd';
  code: string;
  pluginSlug: string;
}

/**
 * System Weaver: 零侵入织入引擎
 * 在构建阶段根据插件声明，动态将代码注入主系统组件
 */
export function vitePluginWeaver(): Plugin {
  let injections: Injection[] = [];

  return {
    name: 'vite-plugin-weaver',
    enforce: 'pre',

    async configResolved(config) {
      const pluginsDir = path.resolve(config.root, 'src/plugins');
      if (!fs.existsSync(pluginsDir)) return;

      const plugins = fs.readdirSync(pluginsDir);
      for (const plugin of plugins) {
        const injectPath = path.resolve(pluginsDir, plugin, 'inject.ts');
        if (fs.existsSync(injectPath)) {
          try {
            // 这里简单解析 inject.ts (因为是在构建环境，可以用 dynamic import 或简单的正则提取)
            // 严谨起见，这里假设 inject.ts 遵循 export const injections = [...]
            const content = fs.readFileSync(injectPath, 'utf-8');
            
            // 改进的正则提取：支持单引号、双引号、反引号
            const injectionBlocks = content.match(/\{[\s\S]*?file:[\s\S]*?\}/g) || [];
            for (const block of injectionBlocks) {
              const getValue = (key: string) => {
                const re = new RegExp(`${key}:\\s*([\`\\'\\"])([\\s\\S]*?)\\1`);
                const m = block.match(re);
                return m ? m[2] : null;
              };

              const file = getValue('file');
              const find = getValue('find');
              const pos = getValue('position');
              const code = getValue('code');
              
              if (file && find && pos && code) {
                injections.push({
                  file,
                  target: '',
                  find,
                  position: pos as any,
                  code,
                  pluginSlug: plugin
                });
              }
            }
          } catch (e) {
            console.error(`[Weaver] Failed to load injections from ${plugin}:`, e);
          }
        }
      }
      console.log(`[Weaver] Scanned ${injections.length} injections from plugins.`);
    },

    transform(code, id) {
      const relativePath = path.relative(process.cwd(), id).replace(/\\/g, '/');
      const fileInjections = injections.filter(inj => relativePath.endsWith(inj.file));

      if (fileInjections.length === 0) return null;

      let newCode = code;
      
      if (!newCode.includes('import { PluginGate }')) {
        newCode = `import { PluginGate } from '../core/PluginGate';\n` + newCode;
      }

      for (const inj of fileInjections) {
        const wrappedCode = `\n<PluginGate slug="${inj.pluginSlug}">${inj.code}</PluginGate>\n`;
        const tags = inj.find.split('>').map(t => t.trim());

        /**
         * 递归处理标签嵌套
         */
        const processNested = (content: string, tagIndex: number): string => {
          const tag = tags[tagIndex];
          const isLast = tagIndex === tags.length - 1;
          
          const pattern = new RegExp(`(<${tag}[^>]*>)([\\s\\S]*?)(<\\/${tag}>)`, 'g');
          
          return content.replace(pattern, (match, p1, p2, p3) => {
            if (isLast) {
              if (inj.position === 'beforeEnd' || inj.position === 'append') {
                return `${p1}${p2}${wrappedCode}${p3}`;
              } else if (inj.position === 'afterBegin' || inj.position === 'prepend') {
                return `${p1}${wrappedCode}${p2}${p3}`;
              }
              return match;
            } else {
              // 递归处理下一级
              const newInner = processNested(p2, tagIndex + 1);
              return `${p1}${newInner}${p3}`;
            }
          });
        };

        newCode = processNested(newCode, 0);
      }

      return {
        code: newCode,
        map: null
      };
    }
  };
}
