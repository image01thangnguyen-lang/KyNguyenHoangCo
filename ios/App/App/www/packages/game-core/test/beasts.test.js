import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkNightAmbientThreat,
  checkBeastTerritory,
  raidBeastDen,
  createPlayerBeastState,
  HANOI_BEAST_DENS,
  HANOI_BEAST_TERRITORIES,
} from '../src/beasts.js';
import { createProfile } from '../src/save.js';

test('DÃ THÚ: Ban ngày (14h) không có áp lực bóng tối', () => {
  const res = checkNightAmbientThreat(21.0287, 105.8524, 14, {}, []);
  assert.equal(res.isNight, false);
  assert.equal(res.isThreatActive, false);
  assert.equal(res.hpDrained, 0);
});

test('DÃ THÚ: Ban đêm (21h) ở trong Thánh Địa Ánh Sáng (Nhà Thuốc Long Châu) an toàn tuyệt đối', () => {
  const safeHavens = [
    { lat: 21.0342, lon: 105.7965, nameVi: 'Thảo Dược Đường FPT Long Châu (Cầu Giấy)', radiusMeters: 50 },
  ];
  const res = checkNightAmbientThreat(21.0342, 105.7965, 21, {}, safeHavens);
  assert.equal(res.isNight, true);
  assert.equal(res.isThreatActive, false);
  assert.equal(res.isSafeHaven, true);
  assert.equal(res.safeHavenNameVi, 'Thảo Dược Đường FPT Long Châu (Cầu Giấy)');
  assert.equal(res.hpDrained, 0);
});

test('DÃ THÚ: Ban đêm (22h) có Đuốc Lửa trên tay toả hào quang xua tan bóng tối', () => {
  const carried = { torch: 1 };
  const res = checkNightAmbientThreat(21.05, 105.80, 22, carried, []);
  assert.equal(res.isNight, true);
  assert.equal(res.isThreatActive, false);
  assert.equal(res.hasTorch, true);
  assert.equal(res.torchRadiusMeters, 30);
  assert.equal(res.hpDrained, 0);
});

test('DÃ THÚ: Ban đêm (23h) không có đuốc ở đường vắng bị bóng tối bủa vây và hao hụt HP', () => {
  const res = checkNightAmbientThreat(21.05, 105.80, 23, {}, []);
  assert.equal(res.isNight, true);
  assert.equal(res.isThreatActive, true);
  assert.equal(res.hasTorch, false);
  assert.ok(res.hpDrained > 0);
});

test('DÃ THÚ: Nhận diện chính xác khi bước vào Lãnh Địa Quái Thú Sương Đỏ (Công viên Cầu Giấy)', () => {
  const terr = checkBeastTerritory(21.0242, 105.7895);
  assert.ok(terr !== null);
  assert.equal(terr?.id, 'terr_caugiay_park');
  assert.equal(terr?.dominantBeast, 'wolf');
  assert.equal(terr?.resourceMultiplier, 2.5);
});

test('DÃ THÚ: Đột Kích Hang Ổ Quái Vật nhận chiến lợi phẩm quý hiếm', () => {
  const prof = createProfile(0, 'Thợ Săn Tiền Sử', 1000);
  prof.player.carried = {
    dong_son_spear: 1,
    bronze_plate_armor: 1,
  };
  prof.player.survival.hp = 100;

  const res = raidBeastDen(prof.player, 'den_wolf_caugiay', 2000);
  assert.equal(res.ok, true);
  assert.equal(res.victory, true);
  assert.ok(res.lootGained.length > 0);
  assert.ok(res.nextPlayer.beastState?.raidedDenIds.includes('den_wolf_caugiay'));

  // Thử đột kích lại hang đã dẹp -> bị từ chối
  const res2 = raidBeastDen(res.nextPlayer, 'den_wolf_caugiay', 3000);
  assert.equal(res2.ok, false);
});
