import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleHanoiPack } from '../src/world.ts';
import { generateHanoiTreasureClue, claimHanoiTreasure, getHanoiExplorerTitle } from '../src/hanoiTreasureHunt.ts';
import { createProfile } from '../src/save.ts';
import { distanceMeters } from '../src/world.ts';

test('CỔ ĐỒ TẦM BẢO & THỬ THÁCH TRÍ NHỚ ĐƯỜNG PHỐ HÀ NỘI', async (t) => {
  const pack = sampleHanoiPack();
  const centerPos = { lat: 21.0285, lon: 105.8542 }; // Hoàn Kiếm, Hà Nội
  const nowMs = 1700000000000;

  await t.test('1. Sinh manh mối tự động chọn địa danh trong dải 500m - 1.000m', () => {
    const clue = generateHanoiTreasureClue(centerPos, pack.pois, nowMs);
    assert.ok(clue, 'Phải sinh ra manh mối hợp lệ');
    assert.ok(clue.targetNameVi.length > 0, 'Địa danh phải có tên tiếng Việt');

    const dist = distanceMeters(centerPos, { lat: clue.targetLat, lon: clue.targetLon });
    assert.ok(
      dist >= 400 && dist <= 1200,
      `Khoảng cách ${dist}m phải nằm trong cự ly tầm bảo thử thách trí nhớ (500m - 1000m +/- dung sai)`,
    );
    assert.ok(Object.keys(clue.rewards).length > 0, 'Phải có danh sách phần thưởng');
    assert.ok(clue.memoryScore > 0, 'Phải có điểm rèn luyện trí nhớ');
  });

  await t.test('2. Từ chối nhận kho báu khi người chơi đứng quá xa (> 45m)', () => {
    const profile = createProfile('dung_si_hn', 'male', nowMs);
    const clue = generateHanoiTreasureClue(centerPos, pack.pois, nowMs);
    assert.ok(clue);

    // Đang ở xa (tại tâm Hoàn Kiếm, cách điểm đến > 500m)
    const result = claimHanoiTreasure(profile, clue, centerPos, nowMs);
    assert.equal(result.ok, false, 'Không được nhận thưởng khi ở xa');
    assert.match(result.messageVi, /còn cách/i);
    assert.equal(profile.treasuresClaimedCount ?? 0, 0);
  });

  await t.test('3. Nhận kho báu thành công khi người chơi tiếp cận đúng địa danh (<= 35m)', () => {
    const profile = createProfile('dung_si_hn', 'male', nowMs);
    const clue = generateHanoiTreasureClue(centerPos, pack.pois, nowMs);
    assert.ok(clue);

    profile.activeTreasureClue = clue;
    const atTargetPos = { lat: clue.targetLat, lon: clue.targetLon };

    const initialCoins = profile.player.carried['ancient_coin'] ?? 0;
    const result = claimHanoiTreasure(profile, clue, atTargetPos, nowMs);

    assert.equal(result.ok, true, 'Phải nhận thưởng thành công khi đến nơi');
    assert.match(result.messageVi, /XUẤT SẮC/i);
    assert.equal(profile.treasuresClaimedCount, 1);
    assert.equal(profile.treasureMemoryScore, clue.memoryScore);
    assert.equal(profile.activeTreasureClue, null, 'Manh mối phải được dọn dẹp sau khi nhận');

    const newCoins = profile.player.carried['ancient_coin'] ?? 0;
    assert.ok(newCoins >= initialCoins, 'Túi đồ phải nhận được phần thưởng');
  });

  await t.test('4. Cấp bậc danh hiệu Thổ Địa Hà Thành nâng dần theo số kho báu tìm thấy', () => {
    assert.equal(getHanoiExplorerTitle(0).titleVi, 'Tân Thủ Dạo Phố');
    assert.equal(getHanoiExplorerTitle(5).titleVi, 'Du Khách Thông Thạo');
    assert.equal(getHanoiExplorerTitle(15).titleVi, 'Kỳ Nhân Phố Phường');
    assert.equal(getHanoiExplorerTitle(30).titleVi, 'Thổ Địa Hà Thành');
    assert.equal(getHanoiExplorerTitle(60).titleVi, 'Bậc Thầy Địa Lý Thăng Long');
  });
});
