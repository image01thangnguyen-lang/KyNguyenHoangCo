/**
 * Dev server tự viết — không phụ thuộc npm.
 *
 * Vì sao không dùng Vite/webpack: dự án này cố ý giữ zero-dependency (xem package.json).
 * Việc duy nhất một bundler thực sự cần làm ở đây là bóc kiểu TypeScript để browser hiểu
 * được, mà Node 24 đã có sẵn API `module.stripTypeScriptTypes`. Toàn bộ phần còn lại chỉ là
 * phục vụ file tĩnh.
 *
 * Hệ quả: `packages/game-core/src/*.ts` chạy y nguyên ở cả ba nơi — Node (test), browser
 * (game), và sau này là công cụ cân bằng — mà không có bước build nào ở giữa.
 *
 * Chạy: node tools/dev-server.ts [port]
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 5173);
const ENTRY = '/apps/game/index.html';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.ts': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
};

/** Chặn path traversal: mọi đường dẫn phải nằm trong thư mục dự án. */
function resolveSafe(urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath.split('?')[0]!.split('#')[0]!);
  const target = normalize(join(ROOT, decoded));
  return target.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep) || target === ROOT.slice(0, -1)
    ? target
    : null;
}

const server = createServer(async (req, res) => {
  const urlPath = req.url ?? '/';

  // Chuyển hướng THẬT chứ không phục vụ thẳng index.html tại "/": nếu phục vụ thẳng thì URL
  // tài liệu vẫn là "/", và mọi đường dẫn tương đối trong trang ("./src/main.ts") sẽ trỏ sai.
  if (urlPath === '/' || urlPath === '/apps/game' || urlPath === '/apps/game/') {
    res.writeHead(302, { location: ENTRY });
    res.end();
    return;
  }

  const filePath = resolveSafe(urlPath);

  if (!filePath) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Đường dẫn không hợp lệ.');
    return;
  }

  try {
    const info = await stat(filePath);
    const finalPath = info.isDirectory() ? join(filePath, 'index.html') : filePath;
    const ext = extname(finalPath);

    let body: string | Buffer = await readFile(finalPath);

    if (ext === '.ts') {
      // Chỉ bóc kiểu, không transform: giữ nguyên số dòng nên stack trace trong browser
      // vẫn trỏ đúng dòng của file .ts gốc.
      body = stripTypeScriptTypes(body.toString('utf8'), { mode: 'strip' });
    }

    const headers: Record<string, string> = {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      // Không cache ở dev: sửa file là F5 thấy ngay, không bị HTTP cache giữ bản cũ.
      'cache-control': 'no-store',
    };

    // Service worker nằm trong apps/game/ nhưng phải cache được cả packages/game-core/,
    // nên cần cho phép nó đăng ký ở scope gốc.
    if (finalPath.endsWith('sw.js')) headers['service-worker-allowed'] = '/';

    res.writeHead(200, headers);
    res.end(body);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`Không tìm thấy: ${urlPath}`);
      return;
    }
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Lỗi máy chủ: ${(error as Error).message}`);
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  KỶ NGUYÊN HOANG CỔ — prototype offline');
  console.log('  ─────────────────────────────────────');
  console.log(`  Mở:        http://localhost:${PORT}/`);
  console.log(`  Thư mục:   ${ROOT}`);
  console.log('  Dừng:      Ctrl+C');
  console.log('');
  console.log('  Lưu ý: server này CHỈ để phát triển. Game khi chạy không gọi mạng lần nào —');
  console.log('  ngắt Wi-Fi sau khi tải xong trang, mọi thứ vẫn chạy đầy đủ.');
  console.log('');
});
