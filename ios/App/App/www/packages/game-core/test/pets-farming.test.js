import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EGGS,
  PETS,
  startIncubation,
  tickEggIncubation,
  feedPet,
  activePetBonus,
  createInitialFarmPlots,
  plantInPlot,
  waterPlot,
  harvestPlot,
  tickFarmPlots,
} from '../src/index.js';

test('Ấp trứng bằng bước chân: đủ số bước thì trứng nở ra linh thú', () => {
  const egg = EGGS[0] ;
  let incubating = startIncubation(egg.id, 1000);
  assert.equal(incubating.hatched, false);
  assert.equal(incubating.requiredSteps, egg.requiredSteps);

  // Đi 1.500 bước (tổng 2.500) -> chưa đủ 3.000 bước
  let result = tickEggIncubation(incubating, 2500);
  assert.equal(result.incubating.hatched, false);
  assert.equal(result.newlyHatchedPet, null);

  // Đi thêm 1.600 bước (tổng 4.100) -> đã vượt 3.000 bước từ điểm xuất phát 1.000
  result = tickEggIncubation(result.incubating, 4100);
  assert.equal(result.incubating.hatched, true);
  assert.ok(result.newlyHatchedPet);
  assert.ok(result.newlyHatchedPet.petId);
  assert.equal(result.newlyHatchedPet.level, 1);
});

test('Cho thú cưng ăn tăng độ thân thiết và cấp độ', () => {
  const pet = {
    petId: 'saber_cub',
    nameVi: 'Hổ Con Răng Kiếm',
    level: 1,
    friendship: 85,
    isActive: true,
  };

  const fed = feedPet(pet, 'raw_meat'); // Món ưa thích (+25)
  assert.equal(fed.ok, true);
  assert.equal(fed.pet.level, 2); // Đã lên cấp 2
});

test('Bonus từ linh thú xuất chiến', () => {
  const pets = [
    { petId: 'saber_cub', nameVi: 'Hổ Con', level: 1, friendship: 50, isActive: true },
    { petId: 'baby_mammoth', nameVi: 'Voi Nhỏ', level: 2, friendship: 50, isActive: true },
    { petId: 'ancient_falcon', nameVi: 'Chim Ưng', level: 1, friendship: 50, isActive: false },
  ];

  const bonus = activePetBonus(pets);
  assert.ok(bonus.attackBonus > 0);
  assert.ok(bonus.carryBonus > 0);
  assert.equal(bonus.gatherBonus, 0); // chim ưng không active
});

test('Trồng trọt: gieo hạt, mưa tự tưới nước, và thu hoạch nông sản', () => {
  let plots = createInitialFarmPlots(1); // 2 luống
  assert.equal(plots.length, 2);

  const startMs = 1_000_000;
  const planted = plantInPlot(plots, 0, 'wild_berry_crop', startMs);
  assert.equal(planted.ok, true);
  plots = planted.plots;

  // Mô phỏng 5 giờ sau + trời mưa (mưa tự tưới đủ nước)
  const fiveHoursLaterMs = startMs + 5 * 3600_000;
  plots = tickFarmPlots(plots, 1, fiveHoursLaterMs, true);

  assert.equal(plots[0]?.readyToHarvest, true);

  const harvested = harvestPlot(plots, 0);
  assert.equal(harvested.ok, true);
  assert.ok((harvested.rewards['wild_berry'] ?? 0) >= 8);
  assert.equal(harvested.plots[0]?.cropId, null);
});
