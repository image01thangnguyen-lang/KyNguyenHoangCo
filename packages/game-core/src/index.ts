/**
 * Kỷ Nguyên Hoang Cổ — lõi game.
 *
 * Thuần TypeScript, không phụ thuộc engine, không đụng DOM/Node API, KHÔNG gọi mạng.
 * Cùng một lõi này chạy trong browser (prototype hiện tại), trong Node (test và công cụ cân
 * bằng), và sẽ chạy trong Unity khi dựng bản phát hành — lúc đó chỉ cần viết lại tầng UI,
 * còn `data/*.json` dùng lại nguyên vẹn.
 */

export * from './types.ts';
export * from './balance.ts';
export * from './rng.ts';
export * from './time.ts';
export * from './clock.ts';
export * from './inventory.ts';
export * from './survival.ts';
export * from './gathering.ts';
export * from './crafting.ts';
export * from './nightDefense.ts';
export * from './bloodMoon.ts';
export * from './world.ts';
export * from './weather.ts';
export * from './story.ts';
export * from './stepFilter.ts';
export * from './safety.ts';
export * from './save.ts';
export * from './traps.ts';
export * from './pets.ts';
export * from './farming.ts';
export * from './lunar.ts';
export * from './coop.ts';
export * from './merchant.ts';
export * from './weekendQuests.ts';
export * from './game.ts';
