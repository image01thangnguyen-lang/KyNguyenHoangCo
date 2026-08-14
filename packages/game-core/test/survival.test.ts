import test from 'node:test';
import assert from 'node:assert/strict';

import { SURVIVAL } from '../src/balance.ts';
import { createRng } from '../src/rng.ts';
import {
  applyKnockout,
  consumeItem,
  createSurvivalState,
  projectDailyDrain,
  survivalWarnings,
  tickSurvival,
} from '../src/survival.ts';
import { expectedDailyYield } from '../src/gathering.ts';

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 7, 14, 3, 0, 0); // 10:00 giờ Việt Nam

test('đói giảm 5 điểm mỗi giờ khi thức, khát giảm 8 (§5.1)', () => {
  const start = createSurvivalState(T0);
  const { survival } = tickSurvival(start, T0 + 2 * HOUR);

  assert.equal(survival.satiety, start.satiety - 10);
  assert.equal(survival.hydration, start.hydration - 16);
});

test('đi bộ chỉ trừ 1 điểm đói mỗi 1.000 bước', () => {
  const start = createSurvivalState(T0);
  const idle = tickSurvival(start, T0 + HOUR).survival;
  const walker = tickSurvival(start, T0 + HOUR, { steps: 5000 }).survival;

  assert.equal(Math.round((idle.satiety - walker.satiety) * 10) / 10, 5);
});

test('BẤT BIẾN: nghịch lý độ đói của kịch bản v0 đã được sửa', () => {
  // v0: 15% đói mỗi 1.000 bước ⇒ 10.000 bước ngốn 150% thanh đói, người đi bộ nhiều chết trước.
  // v2: chi phí theo bước phải là phần rất nhỏ so với chi phí theo thời gian.
  const timeCost = SURVIVAL.satiety.decayPerHourAwake * 16;
  const stepCost = (10_000 / 1000) * SURVIVAL.satiety.decayPer1000Steps;

  assert.equal(stepCost, 10);
  assert.ok(
    stepCost / timeCost < 0.2,
    `chi phí bước chiếm ${((stepCost / timeCost) * 100).toFixed(0)}% chi phí thời gian, quá cao`,
  );
});

test('chi phí sinh tồn một ngày nằm trong tầm với của một ngày kiếm ăn bình thường', () => {
  // Tổng tiêu hao cả ngày lớn hơn 100 là đúng thiết kế: người chơi PHẢI ăn uống trong ngày,
  // đó chính là lý do tồn tại của vòng lặp nấu nướng. Nhưng nó không được vượt quá sức kiếm
  // ăn của một ngày chơi bình thường, nếu không game biến thành việc vặt.
  const drain = projectDailyDrain(10_000, 16);

  const threeGrilledMeals = 3 * 40; // items.json: grilled_meat
  const fourBoiledWaters = 4 * 50; // items.json: boiled_water

  assert.ok(drain.satiety <= threeGrilledMeals, `đói/ngày = ${drain.satiety}`);
  assert.ok(drain.hydration <= fourBoiledWaters, `khát/ngày = ${drain.hydration}`);
});

test('BẤT BIẾN: đi bộ luôn lãi ròng — một quả dại bù được cả 10.000 bước', () => {
  const stepCostFor10k = (10_000 / 1000) * SURVIVAL.satiety.decayPer1000Steps;
  const oneBerry = 10; // items.json: wild_berry

  assert.ok(
    oneBerry >= stepCostFor10k,
    'chi phí đói của 10.000 bước phải nhỏ hơn giá trị một quả dại nhặt được trên đường',
  );
});

test('BẤT BIẾN: 10.000 bước tích luỹ nhanh gấp ~2,5 lần 4.000 bước (§5.1)', () => {
  const low = expectedDailyYield(4000, 'trail');
  const high = expectedDailyYield(10_000, 'trail');

  const total = (inv: Record<string, number>) =>
    Object.values(inv).reduce((sum, qty) => sum + qty, 0);

  const ratio = total(high) / total(low);
  assert.ok(Math.abs(ratio - 2.5) < 0.01, `tỉ lệ đang là ${ratio.toFixed(2)}`);
});

test('HP chỉ bắt đầu tụt SAU khi chỉ số cạn, không tụt cho cả quãng offline', () => {
  const start = { ...createSurvivalState(T0), satiety: 100, hydration: 8, hp: 100 };
  // Khát cạn sau 1 giờ; mô phỏng 2 giờ ⇒ chỉ 1 giờ bị trừ HP, không phải 2.
  const { survival } = tickSurvival(start, T0 + 2 * HOUR);

  const oneHourOfDamage = SURVIVAL.hydration.emptyHpLossPer10Min * 6;
  assert.ok(survival.hp > 100 - oneHourOfDamage * 2);
  assert.ok(survival.hp < 100);
});

test('vắng quá 24 giờ thì chỉ số dừng ở mức sàn, không giết người chơi lúc mở app', () => {
  const start = createSurvivalState(T0);
  const result = tickSurvival(start, T0 + 14 * 24 * HOUR);

  assert.equal(result.cappedByOfflineLimit, true);
  assert.ok(result.survival.hp >= SURVIVAL.offlineCatchUp.floorHp);
  assert.ok(result.survival.satiety >= SURVIVAL.offlineCatchUp.floorSatiety);
  assert.equal(result.survival.lastTickMs, T0 + 14 * 24 * HOUR, 'phải nhảy tới hiện tại, không mô phỏng lại');
});

test('đồng hồ bị lùi thì đóng băng suy giảm thay vì trừng phạt (§4.3)', () => {
  const start = createSurvivalState(T0);
  const { survival, hoursSimulated } = tickSurvival(start, T0 + 5 * HOUR, { frozen: true });

  assert.equal(survival.satiety, start.satiety);
  assert.equal(survival.hydration, start.hydration);
  assert.equal(hoursSimulated, 0);
});

test('thời tiết rét làm đói nhanh hơn, nắng gắt làm khát nhanh hơn', () => {
  const start = createSurvivalState(T0);
  const normal = tickSurvival(start, T0 + 4 * HOUR).survival;
  const cold = tickSurvival(start, T0 + 4 * HOUR, { satietyDecayMultiplier: 1.2 }).survival;
  const hot = tickSurvival(start, T0 + 4 * HOUR, { hydrationDecayMultiplier: 1.35 }).survival;

  assert.ok(cold.satiety < normal.satiety);
  assert.ok(hot.hydration < normal.hydration);
});

test('ngủ tại trại hồi thể lực', () => {
  const start = { ...createSurvivalState(T0), hp: 40, asleep: true };
  const { survival } = tickSurvival(start, T0 + 6 * HOUR, { atCamp: true });

  assert.ok(survival.hp > 40, `HP sau khi ngủ là ${survival.hp}`);
});

test('nước sôi hồi 50 khát và không bao giờ gây bệnh', () => {
  const start = { ...createSurvivalState(T0), hydration: 20 };
  const alwaysSick = () => 0;
  const result = consumeItem(start, 'boiled_water', T0, alwaysSick);

  assert.equal(result.survival.hydration, 70);
  assert.equal(result.gotSick, false);
});

test('nước thô hồi 20 khát nhưng có rủi ro bệnh 40% (§5.1)', () => {
  const start = { ...createSurvivalState(T0), hydration: 20, hp: 100 };

  const unlucky = consumeItem(start, 'raw_water', T0, () => 0.1);
  assert.equal(unlucky.gotSick, true);
  assert.equal(unlucky.survival.hp, 100 - SURVIVAL.sickness.hpLoss);
  assert.notEqual(unlucky.survival.sickUntilMs, null);

  const lucky = consumeItem(start, 'raw_water', T0, () => 0.9);
  assert.equal(lucky.gotSick, false);
  assert.equal(lucky.survival.hydration, 40);
});

test('tỉ lệ bệnh của nước thô xấp xỉ 40% trên mẫu lớn', () => {
  const rng = createRng(12345);
  const start = { ...createSurvivalState(T0), hydration: 10 };
  let sick = 0;

  for (let i = 0; i < 4000; i++) {
    if (consumeItem(start, 'raw_water', T0, rng).gotSick) sick++;
  }

  const rate = sick / 4000;
  assert.ok(Math.abs(rate - 0.4) < 0.03, `tỉ lệ đo được ${(rate * 100).toFixed(1)}%`);
});

test('ngất thì tỉnh ở trại với HP hồi một phần', () => {
  const knocked = applyKnockout({ ...createSurvivalState(T0), hp: 0, satiety: 0, hydration: 0 });

  assert.equal(knocked.hp, SURVIVAL.knockout.respawnHp);
  assert.equal(knocked.satiety, SURVIVAL.knockout.respawnSatiety);
  assert.equal(knocked.asleep, false);
});

test('cảnh báo HUD xuất hiện đúng ngưỡng', () => {
  const warnings = survivalWarnings({ ...createSurvivalState(T0), hydration: 10, satiety: 12, hp: 20 });

  assert.ok(warnings.some((w) => w.includes('Khát')));
  assert.ok(warnings.some((w) => w.includes('Đói')));
  assert.ok(warnings.some((w) => w.includes('Thể lực')));
});
