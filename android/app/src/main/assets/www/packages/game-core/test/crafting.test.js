import test from 'node:test';
import assert from 'node:assert/strict';

import {
  collectCraft,
  createCampState,
  finishCampUpgrade,
  recipeBoard,
  startCampUpgrade,
  startCraft,
  upgradeProgress,
} from '../src/crafting.js';
import { dropFraction, moveToSafe, slotsUsed } from '../src/inventory.js';
                                                 

const T0 = Date.UTC(2026, 7, 14, 3, 0, 0);

const camp1 = ()            => createCampState(T0);
const campWithFire = ()            => ({ ...camp1(), stations: ['campfire'] });

test('chế rìu đá: trừ nguyên liệu ngay, trả sản phẩm khi thu', () => {
  const inv = { dry_branch: 5, sharp_stone: 3, vine: 2 };
  const attempt = startCraft({ recipeId: 'stone_axe', camp: camp1(), inventory: inv, nowMs: T0, atCamp: true });

  assert.equal(attempt.ok, true);
  assert.deepEqual(attempt.inventory, { dry_branch: 2, sharp_stone: 1 });
  assert.equal(attempt.inventory.stone_axe, undefined, 'chưa được trả sản phẩm khi mới bắt đầu');

  const collected = collectCraft('stone_axe', attempt.readyAtMs , attempt.readyAtMs , attempt.inventory, camp1());
  assert.equal(collected.ok, true);
  assert.equal(collected.inventory.stone_axe, 1);
});

test('thiếu nguyên liệu thì báo rõ còn thiếu gì', () => {
  const attempt = startCraft({
    recipeId: 'stone_axe',
    camp: camp1(),
    inventory: { dry_branch: 1 },
    nowMs: T0,
    atCamp: true,
  });

  assert.equal(attempt.ok, false);
  assert.match(attempt.reasonVi , /Còn thiếu/);
  assert.match(attempt.reasonVi , /Đá nhọn/);
});

test('chưa thu xong thì không nhận được sản phẩm', () => {
  const early = collectCraft('stone_axe', T0 + 15_000, T0, {}, camp1());
  assert.equal(early.ok, false);
  assert.match(early.reasonVi , /giây/);
});

test('đun nước cần lửa trại và phải ở trại (§5.3)', () => {
  const inv = { raw_water: 2, dry_branch: 2 };

  const noFire = startCraft({ recipeId: 'boiled_water', camp: camp1(), inventory: inv, nowMs: T0, atCamp: true });
  assert.equal(noFire.ok, false);
  assert.match(noFire.reasonVi , /Lửa trại/);

  const away = startCraft({ recipeId: 'boiled_water', camp: campWithFire(), inventory: inv, nowMs: T0, atCamp: false });
  assert.equal(away.ok, false);
  assert.match(away.reasonVi , /về trại/);

  const ok = startCraft({ recipeId: 'boiled_water', camp: campWithFire(), inventory: inv, nowMs: T0, atCamp: true });
  assert.equal(ok.ok, true);
});

test('công thức cấp cao bị khoá theo cấp trại', () => {
  const attempt = startCraft({
    recipeId: 'iron_sword',
    camp: camp1(),
    inventory: { iron_ingot: 99, rope: 99 },
    nowMs: T0,
    atCamp: true,
  });

  assert.equal(attempt.ok, false);
  assert.match(attempt.reasonVi , /cấp 3/);
});

test('vũ khí sắt cần bản vẽ từ thương nhân cổ', () => {
  const camp            = { ...camp1(), level: 3, stations: ['campfire', 'kiln', 'forge'] };
  const inv = { iron_ingot: 10, rope: 5, log: 10 };

  const noBlueprint = startCraft({
    recipeId: 'iron_sword',
    camp,
    inventory: inv,
    nowMs: T0,
    atCamp: true,
    knownRecipes: [],
  });
  assert.equal(noBlueprint.ok, false);
  assert.match(noBlueprint.reasonVi , /bản vẽ/);

  const withBlueprint = startCraft({
    recipeId: 'iron_sword',
    camp,
    inventory: inv,
    nowMs: T0,
    atCamp: true,
    knownRecipes: ['iron_sword'],
  });
  assert.equal(withBlueprint.ok, true);
});

test('xây station hai lần bị chặn', () => {
  const attempt = startCraft({
    recipeId: 'campfire',
    camp: campWithFire(),
    inventory: { dry_branch: 20, sharp_stone: 20 },
    nowMs: T0,
    atCamp: true,
  });

  assert.equal(attempt.ok, false);
  assert.match(attempt.reasonVi , /đã được xây/);
});

test('số công trình phòng thủ bị chặn theo sức chứa của cấp trại', () => {
  const inv = { log: 999, rope: 999, sharp_stone: 999 };

  const roomy            = { ...camp1(), level: 2, defenseStructures: { wooden_wall: 4 } };
  const ok = startCraft({ recipeId: 'spike_trap', camp: roomy, inventory: inv, nowMs: T0, atCamp: true });
  assert.equal(ok.ok, true);

  // Trại cấp 2 chứa tối đa 8 công trình; 6 tường + 2 bẫy là đã đầy.
  const full            = { ...camp1(), level: 2, defenseStructures: { wooden_wall: 6, spike_trap: 2 } };
  const blocked = startCraft({ recipeId: 'spike_trap', camp: full, inventory: inv, nowMs: T0, atCamp: true });
  assert.equal(blocked.ok, false);
  assert.match(blocked.reasonVi , /công trình phòng thủ/);
});

test('mỗi loại công trình có trần riêng', () => {
  const camp            = { ...camp1(), level: 3, defenseStructures: { wooden_wall: 6 } };
  const blocked = startCraft({
    recipeId: 'wooden_wall',
    camp,
    inventory: { log: 999, rope: 999 },
    nowMs: T0,
    atCamp: true,
  });

  assert.equal(blocked.ok, false);
  assert.match(blocked.reasonVi , /Tối đa 6/);
});

test('nâng cấp trại: trừ nguyên liệu, chờ, rồi lên cấp và mở lò nung', () => {
  const inv = { log: 80, sharp_stone: 50, vine: 25 };
  const started = startCampUpgrade(camp1(), inv, T0);

  assert.equal(started.ok, true);
  assert.deepEqual(started.inventory, { log: 10, sharp_stone: 10, vine: 5 });
  assert.notEqual(started.camp.upgradeCompleteAtMs, null);

  const tooEarly = finishCampUpgrade(started.camp, T0 + 1000);
  assert.equal(tooEarly.upgraded, false);

  const done = finishCampUpgrade(started.camp, started.completeAtMs );
  assert.equal(done.upgraded, true);
  assert.equal(done.camp.level, 2);
  assert.equal(done.camp.upgradeCompleteAtMs, null);
});

test('không nâng cấp được khi thiếu nguyên liệu', () => {
  const attempt = startCampUpgrade(camp1(), { log: 10 }, T0);
  assert.equal(attempt.ok, false);
  assert.match(attempt.reasonVi , /Còn thiếu/);
});

test('tiến độ nâng cấp hiển thị đúng tỉ lệ', () => {
  const half = upgradeProgress(camp1(), { log: 35, sharp_stone: 20, vine: 10 });
  assert.ok(half);
  assert.ok(Math.abs(half.ratio - 0.5) < 0.001);

  assert.equal(upgradeProgress({ ...camp1(), level: 3 }, {}), null);
});

test('bảng công thức đánh dấu đúng khoá / thiếu / làm được', () => {
  const board = recipeBoard(camp1(), { dry_branch: 3, sharp_stone: 2, vine: 2 });

  const axe = board.find((r) => r.recipe.id === 'stone_axe') ;
  assert.equal(axe.craftable, true);
  assert.equal(axe.locked, false);

  const sword = board.find((r) => r.recipe.id === 'iron_sword') ;
  assert.equal(sword.locked, true);
  assert.match(sword.lockReasonVi , /cấp 3/);

  const boiled = board.find((r) => r.recipe.id === 'boiled_water') ;
  assert.equal(boiled.locked, true);
  assert.match(boiled.lockReasonVi , /Lửa trại/);
});

test('ngất rơi 30% đồ mang, nhưng bản vẽ và lõi nâng cấp không bao giờ mất', () => {
  const { kept, lost } = dropFraction({ log: 100, blueprint: 3, upgrade_core: 2 }, 0.3);

  assert.equal(lost.log, 30);
  assert.equal(kept.log, 70);
  assert.equal(kept.blueprint, 3);
  assert.equal(kept.upgrade_core, 2);
  assert.equal(lost.blueprint, undefined);
});

test('két an toàn giới hạn theo cấp trại', () => {
  const many = Array.from({ length: 7 }, (_, i) => ({ itemId: 'blueprint', qty: 20 * (i + 1) }));
  const overflow = moveToSafe({ blueprint: 500 }, {}, [{ itemId: 'blueprint', qty: 500 }], 1);

  assert.equal(overflow.ok, false);
  assert.match(overflow.reasonVi , /két an toàn|Két an toàn/i);
  assert.ok(many.length > 0);

  const ok = moveToSafe({ blueprint: 20 }, {}, [{ itemId: 'blueprint', qty: 20 }], 1);
  assert.equal(ok.ok, true);
  assert.equal(ok.safe.blueprint, 20);
  assert.equal(ok.carried.blueprint, undefined);
});

test('slotsUsed tính theo kích thước stack của từng vật phẩm', () => {
  assert.equal(slotsUsed({ dry_branch: 200 }), 1);
  assert.equal(slotsUsed({ dry_branch: 201 }), 2);
  assert.equal(slotsUsed({}), 0);
});
