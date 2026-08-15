/**
 * Service worker — thứ biến prototype web này thành một game THẬT SỰ offline.
 *
 * Sau lần tải đầu tiên, tắt Wi-Fi và mở lại: mọi thứ vẫn chạy đủ. Đó chính là lời hứa ở
 * mục 0 của kế hoạch v2.0 — "chỉ cần mạng đúng hai lúc: tải app lần đầu, và lúc thanh toán".
 *
 * Chiến lược: cache-first cho mọi thứ. Game không có nội dung động nào cần lấy từ mạng, nên
 * không có lý do gì phải đi hỏi mạng trước. Cập nhật diễn ra bằng cách đổi CACHE_VERSION.
 */

const CACHE_VERSION = 'khc-v0.6.5';

const CORE = '/packages/game-core';

const PRECACHE = [
  '/',
  '/apps/game/index.html',
  '/apps/game/styles.css',
  '/apps/game/manifest.webmanifest',
  '/apps/game/icon.svg',

  '/apps/game/src/main.ts',
  '/apps/game/src/mapView.ts',
  '/apps/game/src/panels.ts',
  '/apps/game/src/itemIcons.ts',
  '/apps/game/src/minigames.ts',
  '/apps/game/src/fights.ts',
  '/apps/game/src/pedometer.ts',
  '/apps/game/src/platform.ts',

  `${CORE}/src/index.ts`,
  `${CORE}/src/types.ts`,
  `${CORE}/src/balance.ts`,
  `${CORE}/src/rng.ts`,
  `${CORE}/src/time.ts`,
  `${CORE}/src/clock.ts`,
  `${CORE}/src/inventory.ts`,
  `${CORE}/src/survival.ts`,
  `${CORE}/src/gathering.ts`,
  `${CORE}/src/crafting.ts`,
  `${CORE}/src/nightDefense.ts`,
  `${CORE}/src/bloodMoon.ts`,
  `${CORE}/src/world.ts`,
  `${CORE}/src/weather.ts`,
  `${CORE}/src/story.ts`,
  `${CORE}/src/stepFilter.ts`,
  `${CORE}/src/safety.ts`,
  `${CORE}/src/save.ts`,
  `${CORE}/src/game.ts`,

  `${CORE}/data/survival.json`,
  `${CORE}/data/items.json`,
  `${CORE}/data/gathering.json`,
  `${CORE}/data/recipes.json`,
  `${CORE}/data/camp.json`,
  `${CORE}/data/monsters.json`,
  `${CORE}/data/poi-mapping.json`,
  `${CORE}/data/device-checks.json`,
  `${CORE}/data/weather.json`,
  `${CORE}/data/story.json`,
  `${CORE}/data/osm-roads-hanoi.json`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      // addAll thất bại toàn bộ nếu một file lỗi; nạp từng file để một đường dẫn sai
      // không làm hỏng cả bản cache offline.
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'reload' });
            if (response.ok) await cache.put(url, response);
          } catch {
            /* bỏ qua: sẽ được cache lại ở lần fetch đầu tiên khi chạy */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE_VERSION).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) return cached;

      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_VERSION);
          cache.put(request, response.clone());
        }
        return response;
      } catch {
        // Mất mạng và chưa cache: nếu là điều hướng trang thì trả về vỏ app.
        if (request.mode === 'navigate') {
          const shell = await caches.match('/apps/game/index.html');
          if (shell) return shell;
        }
        return new Response('Chưa có bản offline cho tài nguyên này.', {
          status: 504,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        });
      }
    })(),
  );
});
