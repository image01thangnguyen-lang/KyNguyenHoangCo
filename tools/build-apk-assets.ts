/**
 * Script đóng gói toàn bộ mã nguồn Web thành static assets cho Android APK.
 * Chạy bằng Node 24 thuần — không cần npm package.
 */

import { mkdir, readFile, writeFile, readdir, cp, rm } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_DIR = join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'www');

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function transformTsToJs(srcPath: string, destPath: string): Promise<void> {
  const content = await readFile(srcPath, 'utf8');
  let js = stripTypeScriptTypes(content);
  // Thay thế các import/export có đuôi .ts thành .js để WebView load đúng
  js = js.replace(/from\s+['"]([^'"]+)\.ts['"]/g, "from '$1.js'");
  js = js.replace(/import\s+['"]([^'"]+)\.ts['"]/g, "import '$1.js'");
  await ensureDir(dirname(destPath));
  await writeFile(destPath, js, 'utf8');
}

async function copyAndTransformTree(srcDir: string, destDir: string): Promise<void> {
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const src = join(srcDir, entry.name);
    const dest = join(destDir, entry.name);

    if (entry.isDirectory()) {
      await copyAndTransformTree(src, dest);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.ts')) {
        const destJs = dest.slice(0, -3) + '.js';
        await transformTsToJs(src, destJs);
      } else if (entry.name.endsWith('.html')) {
        // Đổi src="...main.ts" thành src="...main.js" trong các file HTML
        let html = await readFile(src, 'utf8');
        html = html.replace(/\.ts(["'])/g, '.js$1');
        // Đánh dấu môi trường APK production
        if (entry.name === 'index.html') {
          html = html.replace('<head>', '<head>\n    <script>window.__IS_APK__ = true;</script>');
        }
        await ensureDir(dirname(dest));
        await writeFile(dest, html, 'utf8');
      } else {
        await ensureDir(dirname(dest));
        await cp(src, dest);
      }
    }
  }
}

export async function buildApkAssets(): Promise<void> {
  console.log('🔄 Bắt đầu đóng gói web assets cho Android APK...');
  await rm(OUT_DIR, { recursive: true, force: true });
  await ensureDir(OUT_DIR);

  // 1. Copy và convert apps/game
  console.log('📦 Xử lý apps/game...');
  const appGameSrc = join(ROOT, 'apps', 'game');
  await copyAndTransformTree(appGameSrc, join(OUT_DIR, 'apps', 'game'));

  // 2. Copy và convert packages/game-core
  console.log('📦 Xử lý packages/game-core...');
  const coreSrc = join(ROOT, 'packages', 'game-core');
  await copyAndTransformTree(coreSrc, join(OUT_DIR, 'packages', 'game-core'));

  // 3. Copy thư mục 3D models (GLB & FBX)
  console.log('🦖 Xử lý models (3D & FBX)...');
  const modelsSrc = join(ROOT, 'models');
  await cp(modelsSrc, join(OUT_DIR, 'models'), { recursive: true });
  await cp(modelsSrc, join(OUT_DIR, 'apps', 'game', 'models'), { recursive: true });

  // 4. Tạo file index.html chuyển tiếp ở gốc www
  console.log('📄 Tạo root index.html chuyển tiếp...');
  const rootIndexHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0; url=apps/game/index.html" />
    <title>Kỷ Nguyên Hoang Cổ</title>
    <script>
      window.location.replace("apps/game/index.html");
    </script>
  </head>
  <body style="background:#12100d;margin:0;"></body>
</html>`;
  await writeFile(join(OUT_DIR, 'index.html'), rootIndexHtml, 'utf8');

  console.log('✅ Đã đóng gói thành công toàn bộ assets vào:', OUT_DIR);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildApkAssets().catch((err) => {
    console.error('❌ Lỗi đóng gói assets:', err);
    process.exit(1);
  });
}
