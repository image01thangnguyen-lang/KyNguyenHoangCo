import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advanceAfterBloodMoon,
  createStoryState,
  demoGate,
  markBeatPlayed,
  pendingBeats,
  questBoard,
  settleQuests,
  unlockFullGame,
} from '../src/story.js';
import {
  computeChecksum,
  createProfile,
  createSaveFile,
  exportBackup,
  importBackup,
  loadSave,
  profileDayNumber,
  putProfile,
  serializeSave,
  setActiveSlot,
  slotSummaries,
  totalInventory,
} from '../src/save.js';
                                                     

const T0 = Date.UTC(2026, 7, 14, 3, 0, 0);
const DAY = 86_400_000;

const emptySnapshot = ()                => ({
  lifetimeCollected: {},
  craftedRecipeIds: [],
  visitedZones: [],
  performedActionIds: [],
  nightDefenseWins: 0,
  lifetimeSteps: 0,
  campLevel: 1,
});

// ---------------------------------------------------------------- cốt truyện

test('beat mở chương phát ngay từ bước đầu tiên', () => {
  const state = createStoryState();
  const beats = pendingBeats(state, 0);

  assert.equal(beats.length, 1);
  assert.equal(beats[0] .id, 'ch1b1');
});

test('beat tiếp theo mở khoá theo cột mốc số bước (§5.6)', () => {
  let state = createStoryState();
  state = markBeatPlayed(state, 'ch1b1');

  assert.equal(pendingBeats(state, 100).length, 0);
  assert.equal(pendingBeats(state, 600).length, 1);
  assert.equal(pendingBeats(state, 2000).length, 2, 'đi một mạch xa thì xếp hàng nhiều beat');
});

test('beat đã phát không phát lại', () => {
  let state = createStoryState();
  for (const beat of pendingBeats(state, 5000)) state = markBeatPlayed(state, beat.id);

  assert.equal(pendingBeats(state, 5000).length, 0);
});

test('mỗi Trăng Máu mở một chương mới, cột mốc bước tính lại từ đầu chương', () => {
  const state = createStoryState();
  const after = advanceAfterBloodMoon(state, 12_000);

  assert.equal(after.state.chapterIndex, 2);
  assert.equal(after.state.chapterStartSteps, 12_000);
  assert.equal(after.unlockedChapter .titleVi, 'Chương 2 — Tiếng vọng từ lòng đất');
  assert.equal(pendingBeats(after.state, 12_000)[0] .id, 'ch2b1');
});

test('hết chương 8 thì mở Chế độ Vô Tận — game offline có cái kết thật (§5.6)', () => {
  let state = createStoryState();
  for (let i = 0; i < 7; i++) {
    state = advanceAfterBloodMoon(state, i * 10_000).state;
  }

  assert.equal(state.chapterIndex, 8);
  assert.equal(state.endlessUnlocked, true);

  const beyond = advanceAfterBloodMoon(state, 100_000);
  assert.equal(beyond.unlockedChapter, null);
  assert.equal(beyond.state.bloodMoonsCompleted, 8);
});

test('nhiệm vụ ngày 1 chấm theo số liệu tích luỹ', () => {
  const state = createStoryState();
  const board = questBoard(state, { ...emptySnapshot(), lifetimeCollected: { dry_branch: 8 } });

  const q1 = board.find((q) => q.id === 'd1q1') ;
  assert.equal(q1.done, true);
  assert.equal(q1.have, 8);

  const q2 = board.find((q) => q.id === 'd1q2') ;
  assert.equal(q2.done, false);
});

test('xong hết nhiệm vụ trong ngày thì sang ngày tutorial kế tiếp', () => {
  const state = createStoryState();
  const done                = {
    ...emptySnapshot(),
    lifetimeCollected: { dry_branch: 10, sharp_stone: 5 },
    craftedRecipeIds: ['campfire'],
  };

  const settled = settleQuests(state, done);
  assert.equal(settled.newlyCompleted.length, 3);
  assert.equal(settled.dayAdvanced, true);
  assert.equal(settled.state.tutorialDay, 2);
  assert.match(settled.messageVi , /Nước và lưỡi rìu/);
});

test('nhiệm vụ đã nhận thưởng không nhận lại lần hai', () => {
  const state = createStoryState();
  const snap                = { ...emptySnapshot(), lifetimeCollected: { dry_branch: 8 } };

  const first = settleQuests(state, snap);
  assert.equal(first.newlyCompleted.length, 1);
  assert.ok(first.rewards.length > 0);

  const second = settleQuests(first.state, snap);
  assert.equal(second.newlyCompleted.length, 0);
  assert.equal(second.rewards.length, 0);
});

test('hết ngày 3 thì tutorial đóng lại', () => {
  let state = { ...createStoryState(), tutorialDay: 3 };
  const snap                = {
    ...emptySnapshot(),
    lifetimeCollected: { log: 6 },
    performedActionIds: ['set_trap'],
    nightDefenseWins: 1,
  };

  state = settleQuests(state, snap).state;
  assert.equal(state.tutorialDay, 0);
  assert.equal(questBoard(state, snap).length, 0);
});

test('cổng demo cắt sau ngày 3 và mở lại sau khi mua (§9)', () => {
  const state = createStoryState();

  assert.equal(demoGate(state, 1).gated, false);
  assert.equal(demoGate(state, 3).gated, false);
  assert.equal(demoGate(state, 4).gated, true);
  assert.match(demoGate(state, 4).messageVi, /Mở khoá trọn đời/);

  assert.equal(demoGate(unlockFullGame(state), 40).gated, false);
});

// ---------------------------------------------------------------- lưu

test('save mới có 2 khe hồ sơ trống (§3)', () => {
  const save = createSaveFile(T0);

  assert.equal(save.profiles.length, 2);
  assert.ok(save.profiles.every((p) => p === null));
  assert.ok(slotSummaries(save).every((s) => s.empty));
});

test('hai anh em dùng chung máy, mỗi người một hồ sơ độc lập', () => {
  let save = createSaveFile(T0);
  save = putProfile(save, 0, createProfile('Anh', T0));
  save = putProfile(save, 1, createProfile('Em', T0));

  const summaries = slotSummaries(save);
  assert.equal(summaries[0] .displayName, 'Anh');
  assert.equal(summaries[1] .displayName, 'Em');
  assert.notEqual(save.profiles[0] .player.id, save.profiles[1] .player.id);

  save = setActiveSlot(save, 1);
  assert.equal(save.activeSlot, 1);
});

test('khe hồ sơ ngoài phạm vi bị từ chối', () => {
  const save = createSaveFile(T0);
  assert.throws(() => putProfile(save, 5, createProfile('X', T0)), /Khe hồ sơ không hợp lệ/);
});

test('checksum ổn định bất kể thứ tự khoá trong object', () => {
  const a = { formatVersion: 1, profiles: [], activeSlot: 0, savedAtMs: T0 };
  const b = { savedAtMs: T0, activeSlot: 0, profiles: [], formatVersion: 1 };

  assert.equal(computeChecksum(a         ), computeChecksum(b         ));
});

test('save ghi rồi đọc lại khớp checksum', () => {
  let save = createSaveFile(T0);
  save = putProfile(save, 0, createProfile('Anh', T0));

  const loaded = loadSave(serializeSave(save, T0));
  assert.equal(loaded.ok, true);
  assert.equal(loaded.checksumMismatch, false);
  assert.equal(loaded.save .profiles[0] .player.displayName, 'Anh');
});

test('save bị sửa tay vẫn chơi được, chỉ cảnh báo — không xoá tiến trình người chơi', () => {
  let save = createSaveFile(T0);
  save = putProfile(save, 0, createProfile('Anh', T0));

  const tampered = JSON.parse(serializeSave(save, T0));
  tampered.profiles[0].player.carried = { iron_ingot: 9999 };

  const loaded = loadSave(JSON.stringify(tampered));
  assert.equal(loaded.ok, true, 'không được chặn người chơi');
  assert.equal(loaded.checksumMismatch, true);
  assert.match(loaded.messageVi , /vẫn chạy tiếp/);
});

test('file save hỏng hoặc sai định dạng được báo rõ', () => {
  assert.equal(loadSave('{{{').ok, false);
  assert.equal(loadSave('{"formatVersion":1}').ok, false);
});

test('save của bản game mới hơn thì từ chối thay vì đọc bừa', () => {
  const future = JSON.stringify({ formatVersion: 99, profiles: [], activeSlot: 0, savedAtMs: T0, checksum: 'x' });
  const loaded = loadSave(future);

  assert.equal(loaded.ok, false);
  assert.match(loaded.messageVi , /cập nhật game/);
});

test('xuất rồi nhập lại file sao lưu giữ nguyên tiến trình (§2: đổi máy vẫn giữ được)', () => {
  let save = createSaveFile(T0);
  const profile = createProfile('Anh', T0);
  profile.player.carried = { log: 42 };
  profile.player.camp.level = 2;
  save = putProfile(save, 0, profile);

  const backup = exportBackup(save, T0, '0.2.0');
  const imported = importBackup(backup);

  assert.equal(imported.ok, true);
  assert.equal(imported.save .profiles[0] .player.carried.log, 42);
  assert.equal(imported.save .profiles[0] .player.camp.level, 2);
  assert.match(imported.messageVi, /Đã nhập 1 hồ sơ/);
});

test('nhập nhầm file lạ thì báo rõ, không làm hỏng save đang có', () => {
  assert.match(importBackup('{"magic":"SOMETHING-ELSE"}').messageVi, /không phải file sao lưu/);
  assert.equal(importBackup('không phải json').ok, false);
});

test('số ngày của hồ sơ tính từ 1 và tăng theo thời gian thật', () => {
  const profile = createProfile('Anh', T0);

  assert.equal(profileDayNumber(profile, T0), 1);
  assert.equal(profileDayNumber(profile, T0 + 2 * DAY + 3600_000), 3);
});

test('tổng kho gộp cả đồ mang lẫn két an toàn', () => {
  const profile = createProfile('Anh', T0);
  profile.player.carried = { log: 10, vine: 2 };
  profile.player.safeStorage = { log: 5, blueprint: 1 };

  assert.deepEqual(totalInventory(profile), { log: 15, vine: 2, blueprint: 1 });
});

test('cài đặt mặc định tôn trọng cam kết offline và quyền riêng tư', () => {
  const profile = createProfile('Anh', T0);

  assert.equal(profile.settings.realWeatherSync, false, 'không được mặc định gọi mạng');
  assert.equal(profile.settings.parentalNightLock, false, 'khoá phụ huynh là tuỳ chọn');
  assert.deepEqual(profile.settings.hiddenPoiIds, []);
});
