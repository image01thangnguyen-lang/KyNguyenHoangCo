import test from 'node:test';
import assert from 'node:assert/strict';

import { createProfile } from '../src/save.js';
import { addItems } from '../src/inventory.js';
import {
  collectTrap,
  FISH_TRAP_TIERS,
  getFishTrapTier,
  placeTrap,
  tickTraps,
  upgradeFishTrapWithGold,
} from '../src/traps.js';

const NOW = 1_700_000_000_000;
const HANOI_POS = { lat: 21.0285, lon: 105.8542 };

test('đặt bẫy thỏ tại toạ độ thật: trừ bẫy trong túi và lưu vào danh sách bẫy', () => {
  let profile = createProfile('Thổ Dân', NOW, 'male');
  profile.player.carried = addItems(profile.player.carried, [{ itemId: 'rabbit_trap', qty: 2 }]);

  const res = placeTrap(profile.player, 'rabbit_trap', HANOI_POS, NOW);
  assert.equal(res.ok, true);
  assert.equal(res.player.carried['rabbit_trap'], 1);
  assert.equal(res.player.traps?.length, 1);
  assert.equal(res.player.traps?.[0].tier, 'small');
  assert.equal(res.player.traps?.[0].lat, HANOI_POS.lat);
});

test('không đặt được bẫy nếu không có trong túi', () => {
  const profile = createProfile('Thổ Dân', NOW, 'male');
  const res = placeTrap(profile.player, 'rabbit_trap', HANOI_POS, NOW);
  assert.equal(res.ok, false);
  assert.match(res.messageVi, /không có/);
});

test('mô phỏng thời gian chờ sập bẫy', () => {
  let profile = createProfile('Thổ Dân', NOW, 'male');
  profile.player.carried = addItems(profile.player.carried, [{ itemId: 'deer_trap', qty: 1 }]);

  const res = placeTrap(profile.player, 'deer_trap', HANOI_POS, NOW);
  assert.equal(res.ok, true);

  // Chưa đủ thời gian (mới trôi qua 1 phút)
  let traps = tickTraps(res.player.traps ?? [], NOW + 60_000);
  assert.equal(traps[0].caughtItem, null);

  // Đã đủ thời gian (trôi qua 16 phút)
  traps = tickTraps(res.player.traps ?? [], NOW + 16 * 60_000);
  assert.ok(traps[0].caughtItem);
  assert.ok(traps[0].caughtItem.qty > 0);
});

test('thu bẫy: đứng xa bị từ chối, đứng gần (<=35m) thu được chiến lợi phẩm và thu hồi bẫy', () => {
  let profile = createProfile('Thổ Dân', NOW, 'male');
  profile.player.carried = addItems(profile.player.carried, [{ itemId: 'beast_trap', qty: 1 }]);

  const placeRes = placeTrap(profile.player, 'beast_trap', HANOI_POS, NOW);
  const trapId = placeRes.trap .id;

  // Đã sập bẫy
  const readyMs = NOW + 25 * 60_000;
  let player = {
    ...placeRes.player,
    traps: tickTraps(placeRes.player.traps ?? [], readyMs),
  };

  // Đứng cách xa 500m -> không thu được
  const farPos = { lat: 21.035, lon: 105.8542 };
  const farCollect = collectTrap(player, trapId, farPos, readyMs);
  assert.equal(farCollect.ok, false);
  assert.match(farCollect.messageVi, /lại gần/);

  // Đứng ngay cạnh bẫy (10m) -> thu thành công
  const nearPos = { lat: 21.02855, lon: 105.8542 };
  const nearCollect = collectTrap(player, trapId, nearPos, readyMs);
  assert.equal(nearCollect.ok, true);
  assert.ok(nearCollect.gained);
  assert.equal(nearCollect.player.carried['beast_trap'], 1); // Thu hồi bẫy
  assert.ok((nearCollect.player.carried[nearCollect.gained.itemId] ?? 0) >= nearCollect.gained.qty);
  assert.equal(nearCollect.player.traps?.length, 0); // Bẫy đã được dọn
});

test('RỌ BẮT CÁ: Đặt bẫy nước, nâng cấp bằng Đồng Vàng Cổ và thu hoạch cá', () => {
  let profile = createProfile('Ngư Dân', NOW, 'male');
  profile.player.carried = { fish_trap: 2, ancient_coin: 50 };
  assert.equal(getFishTrapTier(1).nameVi, 'Rọ Tre Đan Thô');

  // Nâng cấp Lồng Cá từ Cấp 1 lên Cấp 2 (Tốn 30 Đồng Vàng)
  const upRes = upgradeFishTrapWithGold(profile.player);
  assert.equal(upRes.ok, true);
  assert.equal(upRes.newLevel, 2);
  assert.equal(upRes.player.carried.ancient_coin, 20);
  assert.match(upRes.messageVi, /Lồng Lưới Bện Thừng/);

  // Nâng tiếp lên Cấp 3 (Cần 75 Đồng Vàng, nhưng chỉ còn 20) -> Bị từ chối
  const upFail = upgradeFishTrapWithGold(upRes.player);
  assert.equal(upFail.ok, false);
  assert.match(upFail.messageVi, /Chưa đủ Đồng Vàng Cổ/);

  // Đặt Rọ Bắt Cá Cấp 2
  const placeRes = placeTrap(upRes.player, 'fish_trap', HANOI_POS, NOW);
  assert.equal(placeRes.ok, true);
  assert.equal(placeRes.player.traps?.length, 1);
  assert.equal(placeRes.player.traps?.[0].tier, 'water');
  assert.equal(placeRes.trap?.readyAtMs, NOW + 6 * 60_000); // 6 phút cho cấp 2

  // Chờ đủ 6 phút sập bẫy cá
  const tickedTraps = tickTraps(placeRes.player.traps ?? [], NOW + 6 * 60_000, 2);
  assert.ok(tickedTraps[0].caughtItem);
  assert.ok(tickedTraps[0].caughtItem.qty > 0);

  // Thu hồi rọ cá
  const collected = collectTrap(
    { ...placeRes.player, traps: tickedTraps },
    tickedTraps[0].id,
    HANOI_POS,
    NOW + 6 * 60_000,
  );
  assert.equal(collected.ok, true);
  assert.equal(collected.player.carried.fish_trap, 2); // Đã thu hồi lại rọ cá
  assert.ok((collected.player.carried.raw_fish ?? 0) > 0 || (collected.player.carried.ancient_coin ?? 0) > 20);
});
