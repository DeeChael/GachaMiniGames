// ============================================================
// 构建后处理：把 JS / CSS 内联进 dist/index.html（单文件部署）
// 解决部署端对 .js 返回 application/octet-stream、
// module script 被浏览器 MIME 严格检查拦截导致白屏的问题
// 运行：npm run build（已接在 vite build 之后）
// ============================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
let html = readFileSync(join(dist, 'index.html'), 'utf8');

// 内联入口 JS（打包产物是单 chunk，无动态导入，可安全内联）
html = html.replace(
  /<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/,
  (_, src) => {
    const js = readFileSync(join(dist, src), 'utf8')
      // 防止 bundle 中出现的 </script> 提前闭合标签
      .replace(/<\/script/gi, '<\\/script');
    return `<script type="module">\n${js}\n</script>`;
  },
);

// 内联 CSS
html = html.replace(
  /<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/,
  (_, href) => `<style>\n${readFileSync(join(dist, href), 'utf8')}\n</style>`,
);

writeFileSync(join(dist, 'index.html'), html);
console.log('已将 JS/CSS 内联到 dist/index.html（单文件）');
