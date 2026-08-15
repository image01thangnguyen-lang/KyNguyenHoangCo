/**
 * Kỷ Nguyên Hoang Cổ — lõi game.
 *
 * Thuần TypeScript, không phụ thuộc engine, không đụng DOM/Node API, KHÔNG gọi mạng.
 * Cùng một lõi này chạy trong browser (prototype hiện tại), trong Node (test và công cụ cân
 * bằng), và sẽ chạy trong Unity khi dựng bản phát hành — lúc đó chỉ cần viết lại tầng UI,
 * còn `data/*.json` dùng lại nguyên vẹn.
 */

export * from './types.js';
export * from './balance.js';
export * from './rng.js';
export * from './time.js';
export * from './clock.js';
export * from './inventory.js';
export * from './survival.js';
export * from './gathering.js';
export * from './crafting.js';
export * from './nightDefense.js';
export * from './bloodMoon.js';
export * from './world.js';
export * from './weather.js';
export * from './story.js';
export * from './stepFilter.js';
export * from './safety.js';
export * from './save.js';
export * from './traps.js';
export * from './pets.js';
export * from './farming.js';
export * from './lunar.js';
export * from './coop.js';
export * from './merchant.js';
export * from './weekendQuests.js';
export * from './game.js';
