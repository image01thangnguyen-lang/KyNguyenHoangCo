import test from 'node:test';
import assert from 'node:assert/strict';

import { GATHERING } from '../src/balance.js';
import {
  createStepLedger,
  dailyLimitFor,
  expectedDailyYield,
  findAction,
  merchantOffers,
  performGatherAction,
  syncSteps,
} from '../src/gathering.js';
import { filterSteps, looksLikeShaking, rewardableToday } from '../src/stepFilter.js';

const T0 = Date.UTC(2026, 7, 14, 3, 0, 0);
const P = 'player-test';

const total = (inv                        ) =>
  Object.values(inv).reduce((sum, qty) => sum + qty, 0);

test('100 bước = 1 lượt nhặt trên đường mòn (§5.2)', () => {
  const { result } = syncSteps({
    playerId: P,
    ledger: createStepLedger(T0),
    newSteps: 1000,
    nowMs: T0,
    zone: 'trail',
  });

  assert.equal(result.pickups, 10);
  assert.ok(total(result.gained) >= 10);
});

test('rừng nhân đôi lượt nhặt', () => {
  const forest = syncSteps({ playerId: P, ledger: createStepLedger(T0), newSteps: 1000, nowMs: T0, zone: 'forest' });
  assert.equal(forest.result.pickups, 20);
});

test('vùng hoang dã giữ nguyên hệ số 1,2× không bị làm tròn mất', () => {
  // 500 bước × 1,2 = 600 ⇒ 6 lượt. Nếu nhân sau khi chia sẽ chỉ ra 5 lượt.
  const { result, ledger } = syncSteps({
    playerId: P,
    ledger: createStepLedger(T0),
    newSteps: 500,
    nowMs: T0,
    zone: 'wilderness',
  });

  assert.equal(result.pickups, 6);
  assert.equal(ledger.carrySteps, 0);
});

test('bước lẻ được giữ lại cho lần sync sau, không bị mất', () => {
  let ledger = createStepLedger(T0);
  const first = syncSteps({ playerId: P, ledger, newSteps: 150, nowMs: T0, zone: 'trail' });
  assert.equal(first.result.pickups, 1);
  assert.equal(first.ledger.carrySteps, 50);

  ledger = first.ledger;
  const second = syncSteps({ playerId: P, ledger, newSteps: 50, nowMs: T0 + 60_000, zone: 'trail' });
  assert.equal(second.result.pickups, 1, '50 bước lẻ cũ + 50 mới phải thành 1 lượt');
});

test('trần 15.000 bước/ngày: ngừng thưởng nhưng VẪN đếm đủ bước', () => {
  const ledger = { ...createStepLedger(T0), rewardedSteps: 14_900, totalSteps: 14_900 };
  const { result, ledger: after } = syncSteps({
    playerId: P,
    ledger,
    newSteps: 1000,
    nowMs: T0,
    zone: 'trail',
  });

  assert.equal(result.cappedSteps, 900);
  assert.equal(result.pickups, 1);
  assert.equal(after.totalSteps, 15_900, 'số bước hiển thị phải đủ, không bị cắt');
  assert.equal(after.rewardedSteps, GATHERING.dailyStepRewardCap);
});

test('sổ bước tự reset khi sang ngày mới', () => {
  const ledger = { ...createStepLedger(T0), rewardedSteps: 15_000, totalSteps: 20_000 };
  const nextDay = T0 + 24 * 3_600_000;
  const { ledger: after } = syncSteps({ playerId: P, ledger, newSteps: 100, nowMs: nextDay, zone: 'trail' });

  assert.equal(after.totalSteps, 100);
  assert.equal(after.rewardedSteps, 100);
});

test('RNG xác định: cùng người chơi, cùng ngày, cùng chỉ số lượt ⇒ cùng kết quả', () => {
  const a = syncSteps({ playerId: P, ledger: createStepLedger(T0), newSteps: 2000, nowMs: T0, zone: 'trail' });
  const b = syncSteps({ playerId: P, ledger: createStepLedger(T0), newSteps: 2000, nowMs: T0, zone: 'trail' });

  assert.deepEqual(a.result.gained, b.result.gained);
});

test('hai người chơi khác nhau nhận kết quả khác nhau', () => {
  const a = syncSteps({ playerId: 'anh', ledger: createStepLedger(T0), newSteps: 3000, nowMs: T0, zone: 'trail' });
  const b = syncSteps({ playerId: 'em', ledger: createStepLedger(T0), newSteps: 3000, nowMs: T0, zone: 'trail' });

  assert.notDeepEqual(a.result.gained, b.result.gained);
});

test('mưa cho rừng thêm 25% lượt nhặt', () => {
  const dry = syncSteps({ playerId: P, ledger: createStepLedger(T0), newSteps: 1000, nowMs: T0, zone: 'forest' });
  const wet = syncSteps({
    playerId: P,
    ledger: createStepLedger(T0),
    newSteps: 1000,
    nowMs: T0,
    zone: 'forest',
    raining: true,
  });

  assert.equal(dry.result.pickups, 20);
  assert.equal(wet.result.pickups, 25);
});

test('chặt gỗ cần rìu đá', () => {
  const noAxe = performGatherAction({
    playerId: P,
    actionId: 'chop_wood',
    zone: 'forest',
    poiId: 'poi1',
    nowMs: T0,
    usesToday: 0,
    lastUsedAtMs: null,
    carried: {},
  });

  assert.equal(noAxe.ok, false);
  assert.match(noAxe.reasonVi , /Rìu đá/);
});

test('chặt gỗ cho 5–9 gỗ lớn, chơi minigame tốt thì nghiêng về cận trên (§5.2)', () => {
  const base = {
    playerId: P,
    actionId: 'chop_wood',
    zone: 'forest'         ,
    poiId: 'poi1',
    nowMs: T0,
    usesToday: 0,
    lastUsedAtMs: null,
    carried: { stone_axe: 1 },
  };

  const good = performGatherAction({ ...base, minigameScore: 1 });
  const bad = performGatherAction({ ...base, minigameScore: 0 });

  assert.ok(good.gained.log  >= 5 && good.gained.log  <= 9);
  assert.ok(bad.gained.log  >= 5 && bad.gained.log  <= 9);
  assert.ok(good.gained.log  >= bad.gained.log );
});

test('chặt gỗ mở thêm lượt khi đạt mốc bước trong ngày', () => {
  const chopWood = findAction('chop_wood') ;
  assert.equal(dailyLimitFor(chopWood, 4000), 3);
  assert.equal(dailyLimitFor(chopWood, 6000), 4);
  assert.equal(dailyLimitFor(chopWood, 10000), 5);
  assert.equal(dailyLimitFor(chopWood, 15000), 6);

  const exhausted = performGatherAction({
    playerId: P,
    actionId: 'chop_wood',
    zone: 'forest',
    poiId: 'poi1',
    nowMs: T0,
    usesToday: 4,
    stepsToday: 6000,
    lastUsedAtMs: null,
    carried: { stone_axe: 1 },
  });

  assert.equal(exhausted.ok, false);
  assert.match(exhausted.reasonVi , /4\/ngày/);
});

test('múc nước phải đứng trong 20 m mép nước (§5.2)', () => {
  const far = performGatherAction({
    playerId: P,
    actionId: 'draw_water',
    zone: 'water',
    poiId: 'ho',
    nowMs: T0,
    usesToday: 0,
    lastUsedAtMs: null,
    carried: {},
    distanceMeters: 45,
  });
  assert.equal(far.ok, false);

  const near = performGatherAction({
    playerId: P,
    actionId: 'draw_water',
    zone: 'water',
    poiId: 'ho',
    nowMs: T0,
    usesToday: 0,
    lastUsedAtMs: null,
    carried: {},
    distanceMeters: 12,
  });
  assert.equal(near.ok, true);
  assert.equal(near.gained.raw_water, 3);
});

test('múc nước có hồi chiêu 30 phút', () => {
  const tooSoon = performGatherAction({
    playerId: P,
    actionId: 'draw_water',
    zone: 'water',
    poiId: 'ho',
    nowMs: T0 + 10 * 60_000,
    usesToday: 1,
    lastUsedAtMs: T0,
    carried: {},
    distanceMeters: 5,
  });

  assert.equal(tooSoon.ok, false);
  assert.match(tooSoon.reasonVi , /phút/);
});

test('hái quả giới hạn 10 lượt mỗi POI mỗi ngày (§5.2)', () => {
  const exhausted = performGatherAction({
    playerId: P,
    actionId: 'forage_berries',
    zone: 'forest',
    poiId: 'cv',
    nowMs: T0,
    usesToday: 10,
    lastUsedAtMs: T0,
    carried: {},
  });

  assert.equal(exhausted.ok, false);
  assert.match(exhausted.reasonVi , /hết lượt/);
});

test('đặt bẫy thu được sau ít nhất 2 giờ (§5.2)', () => {
  const result = performGatherAction({
    playerId: P,
    actionId: 'set_trap',
    zone: 'trail',
    poiId: 'duong',
    nowMs: T0,
    usesToday: 0,
    lastUsedAtMs: null,
    carried: { rabbit_trap: 1 },
  });

  assert.equal(result.ok, true);
  assert.equal(result.deployReadyAtMs, T0 + 120 * 60_000);
});

test('thương nhân cổ chỉ hiện lượt đổi đủ hàng', () => {
  const poor = merchantOffers({});
  assert.ok(poor.every((o) => !o.affordable));

  const rich = merchantOffers({ grilled_meat: 5 });
  assert.ok(rich.some((o) => o.affordable));
});

test('lọc bước: mẫu quá đều bị coi là máy lắc', () => {
  const shaking = Array.from({ length: 60 }, () => 500);
  const walking = Array.from({ length: 60 }, (_, i) => 480 + (i % 7) * 60 + (i % 3) * 40);

  assert.equal(looksLikeShaking(shaking), true);
  assert.equal(looksLikeShaking(walking), false);
});

test('lọc bước: nhịp phi lý bị kẹp lại nhưng phần dư KHÔNG bị xoá', () => {
  const result = filterSteps({ rawNewSteps: 9000, elapsedMs: 10 * 60_000 });

  assert.equal(result.flaggedCadence, true);
  assert.equal(result.accepted + result.deferred + result.rejected, 9000);
  assert.ok(result.deferred > 0);
});

test('lọc bước: mẻ quá lớn được hoãn sang lần sau chứ không mất', () => {
  const result = filterSteps({ rawNewSteps: 20_000, elapsedMs: 12 * 3_600_000 });

  assert.equal(result.accepted, 6000);
  assert.equal(result.deferred, 14_000);
  assert.equal(result.rejected, 0);
});

test('lọc bước: mẫu máy lắc bị loại hẳn', () => {
  const result = filterSteps({
    rawNewSteps: 3000,
    elapsedMs: 30 * 60_000,
    stepIntervalsMs: Array.from({ length: 60 }, () => 500),
  });

  assert.equal(result.flaggedShake, true);
  assert.equal(result.accepted, 0);
  assert.equal(result.rejected, 3000);
});

test('rewardableToday phản ánh đúng trần ngày', () => {
  assert.deepEqual(rewardableToday(0, 1000), { rewardable: 1000, overCap: 0, capReached: false });
  assert.deepEqual(rewardableToday(14_500, 1000), { rewardable: 500, overCap: 500, capReached: true });
  assert.deepEqual(rewardableToday(15_000, 1000), { rewardable: 0, overCap: 1000, capReached: true });
});

test('sản lượng kỳ vọng bị chặn ở trần ngày', () => {
  const at15k = total(expectedDailyYield(15_000));
  const at30k = total(expectedDailyYield(30_000));

  assert.equal(at15k, at30k);
});
