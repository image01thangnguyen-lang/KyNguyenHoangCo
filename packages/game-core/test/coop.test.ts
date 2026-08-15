import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoopRoom, joinCoopRoom, startCoopBattle, processCoopRound, resolveCoopRewards } from '../src/coop.ts';
import type { ProfileSave } from '../src/types.ts';

function createMockProfile(name: string, campDef = 50, weaponId: any = 'stone_spear'): ProfileSave {
  return {
    id: `profile_${name}`,
    name,
    createdAt: Date.now(),
    lastPlayedAt: Date.now(),
    level: 5,
    dayCount: 10,
    camp: {
      level: 2,
      defense: campDef,
      furnaceBuilt: true,
      forgeBuilt: false,
      towerBuilt: false,
      chestLevel: 1,
      farmPlots: [],
    },
    player: {
      hp: 100,
      hunger: 80,
      thirst: 80,
      stamina: 90,
      gender: 'male',
      inventory: [{ itemId: weaponId, qty: 1 }],
      safeChest: [],
      pets: [{ petId: 'saber_cub', nameVi: 'Hổ Con', level: 1, intimacy: 10, isActive: true, bonusVi: '+25% ATK' }],
      traps: [],
    },
    quests: {
      completedIds: [],
      activeChapterIndex: 3,
      chapterStepProgress: 0,
      claimedChapterRewardIndices: [],
      dailyTutorialDay: 3,
      completedTutorialQuestIds: [],
      unlockedStoryBeatIds: [],
    },
    stats: {
      totalSteps: 25000,
      daysSurvived: 10,
      nightsDefended: 3,
      bloodMoonsWon: 1,
      trapsHarvested: 5,
      farmHarvests: 2,
      petsFed: 3,
    },
  };
}

test('CO-OP: Khởi tạo phòng, mời đồng đội và tính tổng thủ trại chung', () => {
  const host = createMockProfile('AnhHai', 40);
  let room = createCoopRoom('ROOM_01', 'peer_host', host, 'normal');

  assert.equal(room.members.length, 1);
  assert.equal(room.sharedDefense, 40);
  assert.equal(room.status, 'lobby');

  const member = createMockProfile('EmGai', 30);
  room = joinCoopRoom(room, 'peer_guest', member);

  assert.equal(room.members.length, 2);
  assert.equal(room.sharedDefense, 70); // 40 + 30
});

test('CO-OP: Bắt đầu trận chiến và hiệp đấu tiêu diệt Boss', () => {
  const host = createMockProfile('Thợ Săn 1', 50, 'iron_spear');
  const guest = createMockProfile('Thợ Săn 2', 50, 'stone_spear');

  let room = createCoopRoom('ROOM_99', 'p1', host, 'normal');
  room = joinCoopRoom(room, 'p2', guest);
  room = startCoopBattle(room);

  assert.equal(room.status, 'fighting');
  assert.ok(room.boss);
  assert.ok(room.boss.hp > 0);

  // Hiệp 1: p1 tấn công, p2 dựng rào chắn
  room = processCoopRound(room, [
    { peerId: 'p1', action: 'attack' },
    { peerId: 'p2', action: 'reinforce' },
  ]);

  assert.ok(room.round >= 2);
  assert.ok(room.members[0]!.damageContribution > 0);

  // Ép máu boss về 0 để kiểm tra chiến thắng và nhận thưởng
  room.boss.hp = 10;
  room = processCoopRound(room, [
    { peerId: 'p1', action: 'attack' },
  ]);

  assert.equal(room.status, 'victory');
  const rewards = resolveCoopRewards(room);
  assert.equal(rewards.length, 2);
  assert.ok(rewards[0]!.items.length > 0);
});
