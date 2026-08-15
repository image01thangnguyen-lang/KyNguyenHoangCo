import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTransitState,
  processTransitMovement,
  canCollectOutpost,
  collectOutpostSupply,
} from '../src/index.js';

test('VIỄN CHINH: Khởi tạo trạng thái du hành phương tiện', () => {
  const transit = createTransitState();
  assert.equal(transit.todayTransitMeters, 0);
  assert.equal(transit.lifetimeTransitMeters, 0);
  assert.equal(transit.transitPoints, 0);
  assert.deepEqual(transit.visitedOutpostsToday, []);
});

test('VIỄN CHINH: Linh Điểu thu thập thụ động khi đi xe buýt (15 - 80 km/h)', () => {
  let transit = createTransitState();
  let carried = {};

  // Đi xe buýt 3.5 km ở vận tốc 30 km/h
  const res1 = processTransitMovement(transit, carried, 3500, 30.0, 21.0285, 105.8542);
  assert.equal(res1.nextTransit.todayTransitMeters, 3500);
  assert.equal(res1.nextTransit.lifetimeTransitMeters, 3500);
  assert.equal(res1.scavengeCount, 3); // 3 mốc km vượt qua
  assert.equal(res1.dropsGained.length, 3);
  assert.ok(res1.eventsVi.length > 0);

  transit = res1.nextTransit;
  carried = res1.nextCarried;

  // Đi tiếp 7 km nữa (tổng 10.5 km)
  const res2 = processTransitMovement(transit, carried, 7000, 40.0, 21.035, 105.845);
  assert.equal(res2.nextTransit.todayTransitMeters, 10500);
  assert.equal(res2.scavengeCount, 7);
  assert.ok(res2.nextTransit.revealedCellIds?.length  > 0);
});

test('VIỄN CHINH: Vận tốc quá thấp (<12 km/h) không kích hoạt du hành xe buýt', () => {
  const transit = createTransitState();
  const res = processTransitMovement(transit, {}, 500, 4.5);
  assert.equal(res.scavengeCount, 0);
  assert.equal(res.dropsGained.length, 0);
});

test('VIỄN CHINH: Nhận Rương Tiếp Tế tại Tiền Đồn Trạm Dừng Xe Buýt', () => {
  let transit = createTransitState();
  let carried = {};

  assert.equal(canCollectOutpost(transit, 'stop_ho_guom'), true);

  const res1 = collectOutpostSupply(transit, carried, 'stop_ho_guom', 'Trạm Hồ Gươm');
  assert.equal(res1.ok, true);
  assert.equal(res1.nextTransit.transitPoints, 25);
  assert.ok(res1.nextCarried['boiled_water'] >= 2);
  assert.ok(res1.nextCarried['wild_berry'] >= 3);

  transit = res1.nextTransit;
  carried = res1.nextCarried;

  // Thử nhận lại cùng 1 trạm trong ngày -> bị từ chối
  assert.equal(canCollectOutpost(transit, 'stop_ho_guom'), false);
  const res2 = collectOutpostSupply(transit, carried, 'stop_ho_guom', 'Trạm Hồ Gươm');
  assert.equal(res2.ok, false);
});
