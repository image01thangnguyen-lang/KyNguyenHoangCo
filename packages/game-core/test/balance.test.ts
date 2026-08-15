import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BLOOD_MOON,
  CAMP_TIERS,
  DEVICE_CHECKS,
  GATHERING,
  ITEMS,
  RECIPES,
  STORY,
  ZONES,
  getCampTier,
  recipesAvailable,
  stationsUnlockedAt,
  validateBalance,
} from '../src/balance.ts';

test('bảng cân bằng không có tham chiếu hỏng', () => {
  assert.deepEqual(validateBalance(), []);
});

test('có khoảng 30 công thức chế tạo như §5.3', () => {
  assert.ok(RECIPES.length >= 28 && RECIPES.length <= 40, `đang có ${RECIPES.length} công thức`);
});

test('doanh trại đúng 3 cấp, cấp 3 là cấp cuối', () => {
  assert.equal(CAMP_TIERS.length, 3);
  assert.equal(getCampTier(3).upgradeToNext, null);
  assert.notEqual(getCampTier(1).upgradeToNext, null);
});

test('chi phí nâng cấp trại đúng con số trong kế hoạch §5.3', () => {
  const t1 = getCampTier(1).upgradeToNext!;
  assert.deepEqual(t1.inputs, [
    { itemId: 'log', qty: 70 },
    { itemId: 'sharp_stone', qty: 40 },
    { itemId: 'vine', qty: 20 },
  ]);

  const t2 = getCampTier(2).upgradeToNext!;
  assert.deepEqual(t2.inputs, [
    { itemId: 'log', qty: 300 },
    { itemId: 'sharp_stone', qty: 200 },
    { itemId: 'iron_ore', qty: 30 },
  ]);
});

test('chặt gỗ mở thêm lượt theo tổng bước trong ngày', () => {
  const chopWood = GATHERING.actions.find((action) => action.id === 'chop_wood')!;
  assert.equal(chopWood.dailyLimitPerPoi, 3);
  assert.deepEqual(chopWood.dailyLimitBySteps, [
    { minSteps: 6000, dailyLimitPerPoi: 4 },
    { minSteps: 10000, dailyLimitPerPoi: 5 },
    { minSteps: 15000, dailyLimitPerPoi: 6 },
  ]);
});

test('rìu đá đúng công thức mở màn: 3 cành + 2 đá + 2 dây (§5.3)', () => {
  const axe = RECIPES.find((r) => r.id === 'stone_axe')!;
  assert.deepEqual(axe.inputs, [
    { itemId: 'dry_branch', qty: 3 },
    { itemId: 'sharp_stone', qty: 2 },
    { itemId: 'vine', qty: 2 },
  ]);
});

test('station mở khoá luỹ tiến: trại cấp 3 vẫn dùng được lò nung của cấp 2', () => {
  assert.deepEqual(stationsUnlockedAt(1), ['campfire', 'drying_rack']);
  assert.ok(stationsUnlockedAt(3).includes('kiln'));
  assert.ok(stationsUnlockedAt(3).includes('forge'));
});

test('cấp 1 chỉ mở công thức cấp 1', () => {
  const available = recipesAvailable(1, ['campfire', 'drying_rack']);
  assert.ok(available.every((r) => r.tier === 1));
  assert.ok(available.some((r) => r.id === 'stone_axe'));
  assert.ok(!available.some((r) => r.id === 'iron_sword'));
});

test('bảng rơi đường mòn đúng tỉ lệ 50/30/20 của §5.2', () => {
  const table = GATHERING.dropTables.trail;
  assert.deepEqual(
    table.map((e) => [e.itemId, e.weight]),
    [
      ['dry_branch', 50],
      ['sharp_stone', 30],
      ['vine', 20],
    ],
  );
});

test('hệ số vùng đúng §5.2: rừng 2×, hoang dã 1,2×', () => {
  assert.equal(ZONES.forest.pickupMultiplier, 2);
  assert.equal(ZONES.wilderness.pickupMultiplier, 1.2);
  assert.equal(ZONES.trail.pickupMultiplier, 1);
});

test('trần thưởng 15.000 bước/ngày thống nhất giữa hai file dữ liệu', () => {
  assert.equal(GATHERING.dailyStepRewardCap, 15000);
  assert.equal(DEVICE_CHECKS.stepReward.dailyCap, GATHERING.dailyStepRewardCap);
});

test('mọi vật phẩm ăn/uống được đều có chỉ số hồi phục', () => {
  for (const item of ITEMS) {
    if (item.kind === 'food') assert.ok(item.satiety, `${item.id} là food nhưng không hồi đói`);
    if (item.kind === 'drink') assert.ok(item.hydration, `${item.id} là drink nhưng không hồi khát`);
  }
});

test('cốt truyện đủ 12 chương sử thi và mỗi chương có beat (§5.6 & Phụ lục B)', () => {
  assert.equal(STORY.chapters.length, 12);
  for (const chapter of STORY.chapters) {
    assert.ok(chapter.beats.length >= 3, `${chapter.id} chỉ có ${chapter.beats.length} beat`);
    assert.equal(chapter.beats[0]!.triggerSteps, 0, `${chapter.id} thiếu beat mở chương`);
  }
});

test('tutorial đúng 3 ngày, mở màn bằng nhiệm vụ đốt lửa (§3)', () => {
  assert.equal(STORY.tutorial.days.length, 3);
  assert.equal(STORY.tutorial.days[0]!.titleVi, 'Đốt lửa trước khi trời tối');
  const fireQuest = STORY.tutorial.days[0]!.quests.find((q) => q.objective.recipeId === 'campfire');
  assert.ok(fireQuest, 'ngày 1 phải có nhiệm vụ dựng lửa trại');
});

test('cổng demo cắt đúng cuối ngày 3, ngay trước Trăng Máu đầu tiên (§9)', () => {
  assert.equal(STORY.demo.freeThroughDay, 3);
  assert.deepEqual(STORY.demo.unlockPriceVnd, [99000, 149000]);
});

test('Trăng Máu offline: 3 độ khó, đánh bù giảm đúng 30% (§5.5)', () => {
  assert.equal(BLOOD_MOON.difficulties.length, 3);
  assert.equal(BLOOD_MOON.makeupFight.rewardMultiplier, 0.7);
  assert.equal(BLOOD_MOON.dayOfWeek, 6);
  assert.equal(BLOOD_MOON.startHour, 19);
  assert.equal(BLOOD_MOON.endHour, 22);
});

test('bản offline không còn khái niệm Tộc qua server', () => {
  assert.equal((BLOOD_MOON as Record<string, unknown>).maxTribeSize, undefined);
  assert.equal(BLOOD_MOON.localCoop.plannedVersion, '1.1');
});

test('cam kết không thu thập dữ liệu được ghi thẳng trong dữ liệu (§6.3)', () => {
  assert.equal(DEVICE_CHECKS.privacy.collectsNothing, true);
  assert.equal(DEVICE_CHECKS.privacy.storeRawGpsHistory, false);
  assert.equal(DEVICE_CHECKS.privacy.networkCallsAtRuntime, 'none');
});

test('giới hạn giờ chơi là nhắc nhở, không cưỡng chế (§6.2 bản offline)', () => {
  assert.equal(DEVICE_CHECKS.wellbeing.enforceHardLimit, false);
  assert.equal(DEVICE_CHECKS.wellbeing.softDailyMinutes, 180);
});

test('khoá an toàn 12 km/h không thương lượng (§6.1)', () => {
  assert.equal(DEVICE_CHECKS.safety.maxKmh, 12);
});
