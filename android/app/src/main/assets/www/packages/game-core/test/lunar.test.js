import test from 'node:test';
import assert from 'node:assert/strict';
import { convertSolarToLunar, getActiveLunarEvent } from '../src/lunar.js';

test('ÂM LỊCH: Chuyển đổi ngày dương sang ngày âm Việt Nam chuẩn xác', () => {
  // Tết Giáp Thìn 2024: Dương lịch 10/02/2024 -> Mùng 1 Tết (1/1/2024 âm)
  const tet2024 = convertSolarToLunar(10, 2, 2024);
  assert.equal(tet2024.day, 1);
  assert.equal(tet2024.month, 1);

  // Tết Ất Tỵ 2025: Dương lịch 29/01/2025 -> Mùng 1 Tết (1/1/2025 âm)
  const tet2025 = convertSolarToLunar(29, 1, 2025);
  assert.equal(tet2025.day, 1);
  assert.equal(tet2025.month, 1);

  // Tết Trung Thu 2024: Dương lịch 17/09/2024 -> 15/8 âm
  const trungThu2024 = convertSolarToLunar(17, 9, 2024);
  assert.equal(trungThu2024.day, 15);
  assert.equal(trungThu2024.month, 8);

  // Tết Đoan Ngọ 2024: Dương lịch 10/06/2024 -> 5/5 âm
  const doanNgo2024 = convertSolarToLunar(10, 6, 2024);
  assert.equal(doanNgo2024.day, 5);
  assert.equal(doanNgo2024.month, 5);
});

test('SỰ KIỆN ÂM LỊCH: Tự động kích hoạt sự kiện Tết, Trung Thu và Lễ Hội Thần Lửa', () => {
  // Thời điểm Mùng 1 Tết 2024 (10/02/2024 10:00:00)
  const tetMs = new Date('2024-02-10T10:00:00+07:00').getTime();
  const tetEvent = getActiveLunarEvent(tetMs);
  assert.ok(tetEvent);
  assert.equal(tetEvent.id, 'tet_nguyen_dan');
  assert.equal(tetEvent.harvestMultiplier, 2.0);
  assert.equal(tetEvent.campDefenseBonus, 25);

  // Thời điểm Trung Thu 2024 (17/09/2024 20:00:00)
  const trungThuMs = new Date('2024-09-17T20:00:00+07:00').getTime();
  const ttEvent = getActiveLunarEvent(trungThuMs);
  assert.ok(ttEvent);
  assert.equal(ttEvent.id, 'tet_trung_thu');
  assert.equal(ttEvent.incubationMultiplier, 2.0);

  // Ngày thường (15/03/2024) không có sự kiện
  const normalMs = new Date('2024-03-15T12:00:00+07:00').getTime();
  const normalEvent = getActiveLunarEvent(normalMs);
  assert.equal(normalEvent, null);
});
