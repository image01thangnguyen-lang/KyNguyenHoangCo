/**
 * Test vòng lặp end-to-end: mô phỏng cả một tuần chơi qua facade `game.ts`.
 *
 * Đây là test quan trọng nhất trong bộ: nó chứng minh vòng lặp cốt lõi mà cả kế hoạch xoay
 * quanh — "đi bộ → nhặt → chế tạo → phòng thủ" — thực sự khép kín và tiến được, chứ không
 * phải một tập hợp module đúng riêng lẻ nhưng ghép lại thì tắc.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  beginBloodMoon,
  collectCrafts,
  consume,
  craft,
  finishBloodMoon,
  gather,
  hidePoi,
  openApp,
  playBeat,
  runNightDefense,
  storeInSafe,
  strikeBoss,
  trade,
  upgradeCamp,
} from '../src/game.js';
import { createProfile } from '../src/save.js';
import { sampleHanoiPack } from '../src/world.js';
                                                  

const PACK = sampleHanoiPack();
const HO_GUOM = { lat: 21.0287, lon: 105.8524 };
const CONG_VIEN = { lat: 21.0128, lon: 105.8434 };
const CHO = { lat: 21.0382, lon: 105.8497 };

// Thứ Hai 09/11/2026, 08:00 giờ Việt Nam.
const MONDAY_8H = Date.UTC(2026, 10, 9, 1, 0, 0);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function newProfile(nowMs = MONDAY_8H)              {
  return createProfile('Người thử', nowMs, 'tester');
}

function open(profile             , nowMs        , steps        , position = HO_GUOM) {
  return openApp({ profile, deviceMs: nowMs, newSteps: steps, position, pack: PACK });
}

test('mở app lần đầu: nhận tài nguyên từ bước chân và nghe beat mở màn', () => {
  const result = open(newProfile(), MONDAY_8H + HOUR, 1200);

  assert.ok(result.pickups > 0, 'phải có lượt nhặt');
  assert.ok(Object.keys(result.gained).length > 0);
  assert.equal(result.beats[0] .id, 'ch1b1');
  assert.match(result.beats[0] .textVi, /Lạc Lạc/);
  assert.ok(result.eventsVi.some((e) => e.includes('lượt nhặt')));
});

test('không cấp quyền vị trí thì game vẫn chơi được bằng vùng hoang dã', () => {
  const result = openApp({
    profile: newProfile(),
    deviceMs: MONDAY_8H + HOUR,
    newSteps: 1000,
    position: null,
    pack: PACK,
  });

  assert.ok(result.pickups > 0);
  assert.equal(result.view.location, null);
  assert.ok(result.view.mapFeatures.length > 0, 'vẫn phải có gì đó để vẽ trên bản đồ');
});

test('đứng ở Hồ Gươm thì vùng là Vùng Nước Ngọt', () => {
  const result = open(newProfile(), MONDAY_8H + HOUR, 500);

  assert.equal(result.view.location .zone, 'water');
  assert.equal(result.view.location .insidePoi .nameVi, 'Hồ Gươm');
});

test('đi bộ trong công viên ăn ít nhất gấp đôi so với vùng hệ số 1×', () => {
  const park = open(newProfile(), MONDAY_8H + HOUR, 1000, CONG_VIEN);
  const lake = open(newProfile(), MONDAY_8H + HOUR, 1000, HO_GUOM);

  assert.equal(park.view.location .zone, 'forest');
  assert.equal(lake.view.location .zone, 'water');
  // Rừng là 2×; hôm đó nếu trời mưa thì còn thêm 25% nữa, nên dùng "ít nhất".
  assert.ok(park.pickups >= lake.pickups * 2, `rừng ${park.pickups} vs nước ${lake.pickups}`);
});

test('VÒNG LẶP NGÀY 1: đi bộ → nhặt → dựng lửa trại → xong nhiệm vụ đầu tiên', () => {
  let profile = newProfile();

  // Đi bộ quanh khu phố cả buổi sáng.
  const morning = open(profile, MONDAY_8H + 2 * HOUR, 2000);
  profile = morning.profile;

  const branches = profile.player.carried.dry_branch ?? 0;
  const stones = profile.player.carried.sharp_stone ?? 0;
  assert.ok(branches > 0 && stones > 0, `nhặt được ${branches} cành, ${stones} đá`);

  // Bù cho đủ nguyên liệu rồi dựng lửa — mô phỏng một buổi chiều đi thêm.
  profile = {
    ...profile,
    player: {
      ...profile.player,
      carried: { ...profile.player.carried, dry_branch: 12, sharp_stone: 6 },
    },
  };

  const started = craft(profile, 'campfire', MONDAY_8H + 3 * HOUR, true);
  assert.equal(started.ok, true, started.messageVi);
  profile = started.profile;

  const collected = collectCrafts(profile, MONDAY_8H + 4 * HOUR);
  assert.equal(collected.ok, true);
  profile = collected.profile;

  assert.ok(profile.player.camp.stations.includes('campfire'), 'lửa trại phải có mặt ở trại');
});

test('nước thô phải đun mới an toàn, và đun cần lửa trại (§5.1)', () => {
  let profile = newProfile();
  profile = {
    ...profile,
    player: {
      ...profile.player,
      camp: { ...profile.player.camp, stations: ['campfire'] },
      carried: { raw_water: 3, dry_branch: 5 },
    },
  };

  const boil = craft(profile, 'boiled_water', MONDAY_8H, true);
  assert.equal(boil.ok, true);

  const done = collectCrafts(boil.profile, MONDAY_8H + 120_000);
  assert.equal(done.profile.player.carried.boiled_water, 1);

  const drink = consume(done.profile, 'boiled_water', MONDAY_8H + 121_000);
  assert.equal(drink.ok, true);
  assert.ok(drink.profile.player.survival.hydration > done.profile.player.survival.hydration);
});

test('chặt gỗ ở công viên cần rìu, và tôn trọng hạn mức mỗi POI mỗi ngày', () => {
  let profile = newProfile();
  profile = { ...profile, player: { ...profile.player, carried: { stone_axe: 1 } } };

  const first = gather({
    profile,
    actionId: 'chop_wood',
    poiId: 'p7',
    zone: 'forest',
    nowMs: MONDAY_8H,
    minigameScore: 0.9,
  });
  assert.equal(first.ok, true, first.messageVi);
  assert.ok(first.gained.log  >= 5);
  profile = first.profile;

  const tooSoon = gather({
    profile,
    actionId: 'chop_wood',
    poiId: 'p7',
    zone: 'forest',
    nowMs: MONDAY_8H + 5 * 60_000,
  });
  assert.equal(tooSoon.ok, false);
  assert.match(tooSoon.messageVi, /phút/);
});

test('6.000 bước mở lượt chặt thứ tư tại cùng POI', () => {
  let profile = newProfile();
  profile = {
    ...profile,
    player: {
      ...profile.player,
      carried: { stone_axe: 1 },
      steps: { ...profile.player.steps, totalSteps: 6000 },
    },
  };

  for (let use = 0; use < 4; use++) {
    const result = gather({
      profile,
      actionId: 'chop_wood',
      poiId: 'p7',
      zone: 'forest',
      nowMs: MONDAY_8H + use * HOUR,
    });
    assert.equal(result.ok, true, result.messageVi);
    profile = result.profile;
  }

  const exhausted = gather({
    profile,
    actionId: 'chop_wood',
    poiId: 'p7',
    zone: 'forest',
    nowMs: MONDAY_8H + 4 * HOUR,
  });
  assert.equal(exhausted.ok, false);
  assert.match(exhausted.messageVi, /4\/ngày/);
});

test('đổi hàng ở tàn tích thương nhân: 1 lượt/POI/ngày, bản vẽ mở công thức lò rèn', () => {
  let profile = newProfile();
  profile = { ...profile, player: { ...profile.player, carried: { log: 40 } } };

  const offers = trade(profile, 3, 'p3', MONDAY_8H); // 20 gỗ → 1 bản vẽ
  assert.equal(offers.ok, true, offers.messageVi);
  profile = offers.profile;

  assert.equal(profile.player.carried.blueprint, 1);
  assert.ok(profile.player.knownRecipes.includes('iron_sword'));

  const again = trade(profile, 3, 'p3', MONDAY_8H + HOUR);
  assert.equal(again.ok, false);
  assert.match(again.messageVi, /một lượt mỗi ngày/);
});

test('an toàn: đang di chuyển nhanh thì mọi tương tác POI bị khoá (§6.1)', () => {
  const profile = newProfile();
  const result = gather({
    profile,
    actionId: 'forage_berries',
    poiId: 'p7',
    zone: 'forest',
    nowMs: MONDAY_8H,
    speed: { last: null, consecutiveFast: 3, locked: true },
  });

  assert.equal(result.ok, false);
  assert.match(result.messageVi, /di chuyển quá nhanh/);
});

test('khoá phụ huynh chặn POI ngoài trời sau 21h nhưng không chặn chơi ở trại', () => {
  let profile = newProfile();
  profile = { ...profile, settings: { ...profile.settings, parentalNightLock: true } };

  const night = Date.UTC(2026, 10, 9, 15, 0, 0); // 22:00 giờ VN
  const blocked = gather({ profile, actionId: 'forage_berries', poiId: 'p7', zone: 'forest', nowMs: night });
  assert.equal(blocked.ok, false);
  assert.match(blocked.messageVi, /phụ huynh/);

  const crafting = craft(
    { ...profile, player: { ...profile.player, carried: { dry_branch: 12, sharp_stone: 6 } } },
    'campfire',
    night,
    true,
  );
  assert.equal(crafting.ok, true, 'chơi ở trại phải luôn được');
});

test('báo cáo POI ẩn nó ngay lập tức khỏi bản đồ, không cần chờ server (§6.1)', () => {
  let profile = newProfile();
  const before = open(profile, MONDAY_8H + HOUR, 100);
  assert.ok(before.view.mapFeatures.some((f) => f.id === 'p1'));

  const hidden = hidePoi(before.profile, 'p1');
  assert.equal(hidden.ok, true);
  profile = hidden.profile;

  const after = open(profile, MONDAY_8H + 2 * HOUR, 100);
  assert.ok(!after.view.mapFeatures.some((f) => f.id === 'p1'), 'POI bị báo cáo phải biến mất');
});

test('cất đồ vào két an toàn thì đêm thua cũng không mất', () => {
  let profile = newProfile();
  profile = { ...profile, player: { ...profile.player, carried: { blueprint: 2, log: 50 } } };

  const stored = storeInSafe(profile, [{ itemId: 'blueprint', qty: 2 }]);
  assert.equal(stored.ok, true);
  profile = stored.profile;

  const night = Date.UTC(2026, 10, 9, 14, 0, 0); // 21:00 giờ VN
  const defense = runNightDefense(profile, night, 0, false);

  assert.equal(defense.result.survived, false, 'trại trống thì phải thua');
  assert.equal(defense.profile.player.safeStorage.blueprint, 2, 'két an toàn không bị đụng');
  assert.ok(defense.profile.player.carried.log  < 50);
});

test('nâng cấp trại lên cấp 2 mở lò nung', () => {
  let profile = newProfile();
  profile = {
    ...profile,
    player: { ...profile.player, carried: { log: 70, sharp_stone: 40, vine: 20 } },
  };

  const started = upgradeCamp(profile, MONDAY_8H);
  assert.equal(started.ok, true, started.messageVi);
  profile = started.profile;

  const later = open(profile, MONDAY_8H + 2 * HOUR, 0);
  assert.equal(later.profile.player.camp.level, 2);
  assert.ok(later.eventsVi.some((e) => e.includes('Nhà Sàn Gỗ')));
});

test('vắng cả tuần rồi mở lại: không chết, không mất đồ, chỉ số ở mức sàn', () => {
  let profile = newProfile();
  profile = { ...profile, player: { ...profile.player, carried: { log: 100 } } };

  const back = open(profile, MONDAY_8H + 7 * DAY, 3000);

  assert.equal(back.knockedOut, false, 'đi công tác một tuần không được phạt mất đồ');
  assert.equal(back.profile.player.carried.log, 100);
  assert.ok(back.profile.player.survival.hp >= 15);
  assert.ok(back.eventsVi.some((e) => e.includes('mức sàn')));
});

test('lùi đồng hồ máy thì thời gian game đứng yên (§4.3)', () => {
  let profile = newProfile();
  profile = open(profile, MONDAY_8H + 5 * HOUR, 1000).profile;

  const rolledBack = open(profile, MONDAY_8H, 1000);

  assert.equal(rolledBack.clockRolledBack, true);
  assert.ok(rolledBack.eventsVi.some((e) => e.includes('Đồng hồ máy')));
});

test('trần 15.000 bước/ngày dừng thưởng nhưng vẫn ghi nhận đủ bước', () => {
  let profile = newProfile();
  let nowMs = MONDAY_8H;

  // Nhiều lần mở app trong ngày, mỗi lần một mẻ bước vừa phải.
  for (let i = 0; i < 5; i++) {
    nowMs += 2 * HOUR;
    profile = open(profile, nowMs, 5000).profile;
  }

  assert.equal(profile.player.steps.rewardedSteps, 15_000, 'thưởng dừng đúng ở trần');
  assert.equal(profile.player.steps.totalSteps, 25_000, 'nhưng số bước hiển thị vẫn đủ 25.000');
  assert.equal(profile.player.lifetime.steps, 25_000);
});

test('một mẻ bước khổng lồ được hoãn sang lần mở app sau chứ không bị xoá', () => {
  const result = open(newProfile(), MONDAY_8H + 12 * HOUR, 20_000);

  assert.ok(result.profile.pendingSteps > 0);
  assert.ok(result.eventsVi.some((e) => e.includes('để dành')));

  const next = open(result.profile, MONDAY_8H + 14 * HOUR, 0);
  assert.ok(next.profile.player.lifetime.steps > result.profile.player.lifetime.steps);
});

test('MỘT TUẦN CHƠI: tiến độ tăng đều và tới được Trăng Máu thứ Bảy', () => {
  let profile = newProfile();
  let nowMs = MONDAY_8H;
  const positions = [HO_GUOM, CONG_VIEN, CHO];

  // Thứ Hai đến thứ Sáu: mỗi ngày 3 lần mở app, mỗi lần khoảng 2.000 bước.
  for (let day = 0; day < 5; day++) {
    for (let session = 0; session < 3; session++) {
      nowMs = MONDAY_8H + day * DAY + (2 + session * 4) * HOUR;
      const result = open(profile, nowMs, 2000, positions[session] );
      profile = result.profile;
      for (const beat of result.beats) profile = playBeat(profile, beat.id);
    }
  }

  assert.ok(profile.player.lifetime.steps >= 25_000, `mới đi được ${profile.player.lifetime.steps} bước`);
  assert.ok(profile.player.lifetime.daysPlayed >= 5);
  assert.ok(profile.story.playedBeatIds.length >= 3, 'phải nghe được cả 3 beat của chương 1');
  assert.ok(profile.player.lifetime.visitedZones.length >= 2);

  // Thứ Bảy 20:00 — Trăng Máu.
  const saturday = Date.UTC(2026, 10, 14, 13, 0, 0);
  profile = open(profile, saturday, 500).profile;
  assert.equal(profile.player.lifetime.daysPlayed >= 6, true);

  const view = open(profile, saturday, 0).view;
  assert.equal(view.bloodMoon.active, true);
  assert.equal(view.bloodMoon.labelVi, 'TRĂNG MÁU ĐANG DÂNG');

  const begun = beginBloodMoon(profile, saturday, 'de');
  assert.equal(begun.ok, true, begun.messageVi);
  profile = begun.profile;
  assert.ok(profile.activeFight .totalHp > 0);

  // Đánh vài lượt rồi chốt sổ.
  for (let i = 0; i < 8; i++) {
    const hit = strikeBoss(profile, saturday + (i + 1) * 60_000, 0.85, 60);
    profile = hit.profile;
  }
  assert.ok(profile.activeFight .playerDamage > 0);

  const finished = finishBloodMoon(profile, saturday + 2 * HOUR);
  profile = finished.profile;

  assert.equal(profile.activeFight .settled, true);
  assert.ok(Object.keys(finished.settlement .rewards).length > 0, 'thắng hay thua đều phải có thưởng');
  assert.equal(profile.story.chapterIndex, 2, 'qua Trăng Máu là mở chương mới');
  assert.equal(profile.story.bloodMoonsCompleted, 1);
});

test('không đánh Trăng Máu hai lần trong cùng một tuần', () => {
  const saturday = Date.UTC(2026, 10, 14, 13, 0, 0);
  let profile = newProfile(saturday - 3 * DAY);

  profile = beginBloodMoon(profile, saturday, 'de').profile;
  profile = finishBloodMoon(profile, saturday + HOUR).profile;

  const again = beginBloodMoon(profile, saturday + 90 * 60_000, 'de');
  assert.equal(again.ok, false);
  assert.match(again.messageVi, /đã đánh rồi/);
});

test('bỏ lỡ thứ Bảy thì sáng Chủ Nhật vẫn đánh bù được với thưởng giảm', () => {
  const sunday = Date.UTC(2026, 10, 15, 1, 0, 0); // 08:00 giờ VN
  let profile = newProfile(sunday - 5 * DAY);

  const begun = beginBloodMoon(profile, sunday);
  assert.equal(begun.ok, true, begun.messageVi);
  assert.equal(begun.fight .isMakeup, true);
  profile = begun.profile;

  const settled = finishBloodMoon(profile, sunday + HOUR);
  assert.equal(settled.settlement .rewardMultiplier, 0.7);
});

test('demo cắt sau ngày 3, mở khoá xong thì tiến trình còn nguyên (§9)', () => {
  let profile = newProfile();
  profile = { ...profile, player: { ...profile.player, carried: { log: 77 } } };

  const day4 = open(profile, MONDAY_8H + 3 * DAY + HOUR, 1000);
  assert.equal(day4.view.demo.gated, true);
  assert.match(day4.view.demo.messageVi, /mua một lần|Mở khoá trọn đời/i);

  profile = { ...day4.profile, story: { ...day4.profile.story, unlocked: true } };
  const after = open(profile, MONDAY_8H + 3 * DAY + HOUR + 5 * 60_000, 100);

  assert.equal(after.view.demo.gated, false);
  assert.equal(after.profile.player.carried.log, 77, 'tiến trình demo phải được giữ nguyên');
});

test('khung nhìn cung cấp đủ dữ liệu cho UI vẽ một màn hình hoàn chỉnh', () => {
  const { view } = open(newProfile(), MONDAY_8H + HOUR, 1500);

  assert.ok(view.weather.conditionNameVi.length > 0);
  assert.ok(view.recipes.length > 20);
  assert.ok(view.quests.length === 3);
  assert.ok(view.mapFeatures.length > 0);
  assert.ok(view.tonight.verdictVi.length > 0);
  assert.ok(view.upgrade !== null);
  assert.ok(['day', 'evening', 'night'].includes(view.phase));
});
