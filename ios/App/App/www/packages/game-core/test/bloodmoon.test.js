import test from 'node:test';
import assert from 'node:assert/strict';

import { BLOOD_MOON } from '../src/balance.js';
import {
  allyDps,
  attackBoss,
  bloodMoonStatus,
  bossHpFor,
  settleBloodMoon,
  startBloodMoon,
  tickAllies,
} from '../src/bloodMoon.js';
import { createCampState } from '../src/crafting.js';
import { campDefensePower, forecastTonight, resolveNightDefense } from '../src/nightDefense.js';
import { createRng } from '../src/rng.js';
import { isBloodMoonWindow, isMakeupWindow } from '../src/time.js';
                                                 

// Thứ Bảy 14/11/2026, 20:00 giờ Việt Nam (13:00 UTC).
const SATURDAY_20H = Date.UTC(2026, 10, 14, 13, 0, 0);
// Chủ Nhật 15/11/2026, 08:00 giờ Việt Nam.
const SUNDAY_8H = Date.UTC(2026, 10, 15, 1, 0, 0);
// Thứ Tư 11/11/2026, 10:00 giờ Việt Nam.
const WEDNESDAY_10H = Date.UTC(2026, 10, 11, 3, 0, 0);

const base = ()            => createCampState(SATURDAY_20H);

const fortress = ()            => ({
  ...base(),
  level: 3,
  stations: ['campfire', 'kiln', 'forge'],
  defenseStructures: { stone_wall: 4, watch_tower: 2, ballista: 2, spike_trap: 4 },
});

test('khung giờ Trăng Máu đúng thứ Bảy 19–22h giờ máy', () => {
  assert.equal(isBloodMoonWindow(SATURDAY_20H), true);
  assert.equal(isBloodMoonWindow(WEDNESDAY_10H), false);
  assert.equal(isMakeupWindow(SUNDAY_8H), true);
});

test('không đánh được ngoài khung giờ, và báo còn bao lâu', () => {
  const result = startBloodMoon({ profileId: 'p1', camp: base(), nowMs: WEDNESDAY_10H });

  assert.equal(result.ok, false);
  assert.match(result.reasonVi , /thứ Bảy/);
  assert.match(result.reasonVi , /giờ nữa/);
});

test('HP boss tăng theo cấp doanh trại (§5.5)', () => {
  const l1 = bossHpFor(1, 'thuong');
  const l2 = bossHpFor(2, 'thuong');
  const l3 = bossHpFor(3, 'thuong');

  assert.equal(l1, BLOOD_MOON.hpBase);
  assert.ok(l2 > l1);
  assert.ok(l3 > l2);
});

test('ba độ khó đổi cả HP lẫn phần thưởng', () => {
  assert.ok(bossHpFor(2, 'de') < bossHpFor(2, 'thuong'));
  assert.ok(bossHpFor(2, 'kho') > bossHpFor(2, 'thuong'));
});

test('công trình phòng thủ đóng vai đồng đội, tự góp sát thương', () => {
  assert.equal(allyDps(base()), 0, 'trại trống thì không có đồng đội nào');
  assert.ok(allyDps(fortress()) > 0);

  const started = startBloodMoon({ profileId: 'p1', camp: fortress(), nowMs: SATURDAY_20H });
  const after = tickAllies(started.fight , fortress(), SATURDAY_20H + 60_000);

  assert.ok(after.allyDamage > 0);
  assert.ok(after.remainingHp < started.fight .totalHp);
});

test('đánh trúng điểm yếu gây sát thương cao hơn hẳn', () => {
  const started = startBloodMoon({ profileId: 'weak-test', camp: base(), nowMs: SATURDAY_20H });
  const fight = started.fight ;
  const weakTo = BLOOD_MOON.bosses.find((b) => b.id === fight.bossId) .weakTo;

  const plain = attackBoss({
    fight,
    camp: base(),
    carried: { stone_spear: 1 },
    nowMs: SATURDAY_20H + 1000,
    performance: 0.8,
    durationSeconds: 30,
  });

  const smart = attackBoss({
    fight,
    camp: base(),
    carried: { stone_spear: 1, [weakTo]: 1 },
    nowMs: SATURDAY_20H + 1000,
    performance: 0.8,
    durationSeconds: 30,
  });

  assert.equal(smart.usedWeakness, true);
  assert.ok(smart.damageDealt > plain.damageDealt);
});

test('sát thương bị chặn trần cứng, không thể một phát hạ boss', () => {
  const started = startBloodMoon({ profileId: 'p1', camp: fortress(), nowMs: SATURDAY_20H, difficultyId: 'kho' });
  const result = attackBoss({
    fight: started.fight ,
    camp: fortress(),
    carried: { iron_sword: 1 },
    nowMs: SATURDAY_20H + 1000,
    performance: 999,
    durationSeconds: 10_000,
  });

  assert.ok(result.damageDealt <= 260 * 180, 'phải bị kẹp cả theo giây lẫn theo trần mỗi giây');
  assert.ok(result.fight.remainingHp >= 0);
});

test('hết khung giờ thì không đánh được nữa', () => {
  const started = startBloodMoon({ profileId: 'p1', camp: base(), nowMs: SATURDAY_20H });
  const late = attackBoss({
    fight: started.fight ,
    camp: base(),
    carried: {},
    nowMs: started.fight .endMs + 1000,
  });

  assert.equal(late.ok, false);
  assert.match(late.reasonVi , /Trăng đã lặn/);
});

test('thắng thì nhận thưởng đầy đủ, thua vẫn có thưởng tham gia', () => {
  const started = startBloodMoon({ profileId: 'p1', camp: base(), nowMs: SATURDAY_20H });
  const won = settleBloodMoon(
    { ...started.fight , remainingHp: 0, playerDamage: started.fight .totalHp },
    base(),
    SATURDAY_20H + 3600_000,
  );
  assert.equal(won.victory, true);
  assert.ok(Object.keys(won.rewards).length > 0);

  const lost = settleBloodMoon(started.fight , base(), SATURDAY_20H + 3600_000);
  assert.equal(lost.victory, false);
  assert.ok(Object.keys(lost.rewards).length > 0, 'thua vẫn phải có thưởng tham gia');
  assert.match(lost.summaryVi, /Tuần sau/);
});

test('đánh bù sáng Chủ Nhật giảm đúng 30% thưởng (§5.5)', () => {
  const makeup = startBloodMoon({ profileId: 'p1', camp: base(), nowMs: SUNDAY_8H });

  assert.equal(makeup.ok, true);
  assert.equal(makeup.fight .isMakeup, true);
  assert.match(makeup.introVi , /vây trại|đánh bù/i);

  const settled = settleBloodMoon(
    { ...makeup.fight , remainingHp: 0, playerDamage: makeup.fight .totalHp },
    base(),
    SUNDAY_8H + 1000,
  );
  assert.equal(settled.rewardMultiplier, 0.7);
});

test('khung đánh bù nằm ngay sáng hôm sau đêm vừa bỏ lỡ', () => {
  const makeup = startBloodMoon({ profileId: 'p1', camp: base(), nowMs: SUNDAY_8H }).fight ;

  assert.ok(makeup.startMs <= SUNDAY_8H, 'trận đánh bù phải đã bắt đầu');
  assert.ok(makeup.endMs > SUNDAY_8H);
  assert.ok(SUNDAY_8H - makeup.startMs < 6 * 3_600_000);
});

test('boss xoay vòng theo tuần và khác nhau giữa hai hồ sơ trên cùng máy', () => {
  const anh = startBloodMoon({ profileId: 'anh', camp: base(), nowMs: SATURDAY_20H }).fight ;
  const em = startBloodMoon({ profileId: 'em', camp: base(), nowMs: SATURDAY_20H }).fight ;
  const nextWeek = startBloodMoon({
    profileId: 'anh',
    camp: base(),
    nowMs: SATURDAY_20H + 7 * 86_400_000,
  }).fight ;

  assert.ok(anh.bossId !== em.bossId || anh.bossId !== nextWeek.bossId, 'boss phải có xoay vòng');
});

test('HUD đếm ngược tới Trăng Máu kế tiếp', () => {
  const wed = bloodMoonStatus(WEDNESDAY_10H, false);
  assert.equal(wed.active, false);
  assert.match(wed.labelVi, /Trăng Máu sau/);

  const sat = bloodMoonStatus(SATURDAY_20H, false);
  assert.equal(sat.active, true);
  assert.equal(sat.labelVi, 'TRĂNG MÁU ĐANG DÂNG');
});

// ---------------------------------------------------------------- phòng thủ đêm

test('trại trống bị chọc thủng, pháo đài trụ được', () => {
  const rng = createRng(7);

  const weak = resolveNightDefense({
    camp: base(),
    carried: { log: 100 },
    nowMs: SATURDAY_20H,
    online: false,
    rng,
    ignoreWindow: true,
  });
  assert.equal(weak.survived, false);
  assert.ok(weak.lostItems.log  > 0, 'thua thì mất đồ đang mang');

  const strong = resolveNightDefense({
    camp: fortress(),
    carried: { log: 100 },
    nowMs: SATURDAY_20H,
    online: true,
    playerPerformance: 1,
    rng,
    ignoreWindow: true,
  });
  assert.equal(strong.survived, true);
  assert.equal(strong.wavesCleared, strong.totalWaves);
});

test('offline vẫn tự thủ nhưng yếu hơn có người canh (§5.4)', () => {
  const camp            = { ...base(), level: 2, defenseStructures: { wooden_wall: 5, spike_trap: 3 } };

  const online = resolveNightDefense({
    camp,
    carried: {},
    nowMs: SATURDAY_20H,
    online: true,
    playerPerformance: 1,
    rng: createRng(1),
    ignoreWindow: true,
  });
  const offline = resolveNightDefense({
    camp,
    carried: {},
    nowMs: SATURDAY_20H,
    online: false,
    rng: createRng(1),
    ignoreWindow: true,
  });

  assert.ok(online.playerPower > offline.playerPower);
});

test('thua phòng thủ chỉ mất đồ ngoài két an toàn', () => {
  const result = resolveNightDefense({
    camp: base(),
    carried: { log: 40, blueprint: 2 },
    nowMs: SATURDAY_20H,
    online: false,
    rng: createRng(3),
    ignoreWindow: true,
  });

  assert.equal(result.survived, false);
  assert.equal(result.lostItems.blueprint, undefined, 'bản vẽ không bao giờ mất');
  assert.equal(result.carried.blueprint, 2);
});

test('ngoài khung giờ đêm thì không có đợt tấn công nào', () => {
  const result = resolveNightDefense({
    camp: base(),
    carried: {},
    nowMs: WEDNESDAY_10H,
    online: true,
    rng: createRng(1),
  });

  assert.equal(result.totalWaves, 0);
  assert.equal(result.survived, true);
});

test('sức phòng thủ cộng dồn từ công trình', () => {
  assert.ok(campDefensePower(fortress()) > campDefensePower(base()));
});

test('dự báo đêm nói thẳng cho người chơi biết có nên lo không', () => {
  assert.match(forecastTonight(base()).verdictVi, /chọc thủng/);
  assert.match(forecastTonight(fortress()).verdictVi, /vững|đủ trụ/);
});
