import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isWeekend,
  getWeekendKey,
  getWeekendQuestBoard,
  claimWeekendQuest,
  WEEKEND_QUESTS,
} from '../src/weekendQuests.ts';
import { createProfile } from '../src/save.ts';

describe('NHIỆM VỤ DÃ NGOẠI CUỐI TUẦN HÀ NỘI', () => {
  it('nhận diện chính xác ngày Thứ Bảy và Chủ Nhật', () => {
    // 2026-08-15 là Thứ Bảy (UTC+7)
    const saturdayMs = new Date('2026-08-15T10:00:00+07:00').getTime();
    assert.equal(isWeekend(saturdayMs), true);

    // 2026-08-16 là Chủ Nhật (UTC+7)
    const sundayMs = new Date('2026-08-16T14:00:00+07:00').getTime();
    assert.equal(isWeekend(sundayMs), true);

    // 2026-08-17 là Thứ Hai (UTC+7)
    const mondayMs = new Date('2026-08-17T09:00:00+07:00').getTime();
    assert.equal(isWeekend(mondayMs), false);
  });

  it('sinh khoá tuần ổn định để reset sau mỗi tuần', () => {
    const satMs = new Date('2026-08-15T10:00:00+07:00').getTime();
    const sunMs = new Date('2026-08-16T20:00:00+07:00').getTime();
    assert.equal(getWeekendKey(satMs), getWeekendKey(sunMs));
  });

  it('chấm hoàn thành khi người chơi ghé thăm Hồ Tây', () => {
    const satMs = new Date('2026-08-15T10:00:00+07:00').getTime();
    const player = createProfile('Thợ Săn', satMs, 'male').player;
    const poiTayHo = {
      id: 'tay_ho',
      zone: 'water' as const,
      nameVi: 'Hồ Tây Lộng Gió (Hồ Nước Ngọt Khổng Lồ)',
      lat: 21.055,
      lon: 105.82,
      radiusMeters: 200,
    };

    const board = getWeekendQuestBoard(player, satMs, poiTayHo);
    assert.equal(board.isWeekendActive, true);

    const tayHoQuest = board.quests.find((q) => q.quest.id === 'wq_tay_ho');
    assert.ok(tayHoQuest);
    assert.equal(tayHoQuest.done, true);
    assert.equal(tayHoQuest.claimed, false);

    // Nhận thưởng
    const claimRes = claimWeekendQuest(player, 'wq_tay_ho', satMs, poiTayHo);
    assert.equal(claimRes.ok, true);
    assert.ok((claimRes.player.carried['ancient_coin'] ?? 0) >= 20);

    // Nhận lại lần 2 bị từ chối
    const claimRes2 = claimWeekendQuest(claimRes.player, 'wq_tay_ho', satMs, poiTayHo);
    assert.equal(claimRes2.ok, false);
  });

  it('chấm hoàn thành khi đạt mốc 6.000 bước cuối tuần', () => {
    const sunMs = new Date('2026-08-16T15:00:00+07:00').getTime();
    const player = createProfile('Thợ Săn', sunMs, 'female').player;
    player.steps.totalSteps = 6500;

    const board = getWeekendQuestBoard(player, sunMs, null);
    const stepsQuest = board.quests.find((q) => q.quest.id === 'wq_steps');
    assert.ok(stepsQuest);
    assert.equal(stepsQuest.done, true);

    const claimRes = claimWeekendQuest(player, 'wq_steps', sunMs, null);
    assert.equal(claimRes.ok, true);
    assert.ok((claimRes.player.carried['upgrade_core'] ?? 0) >= 2);
  });
});
