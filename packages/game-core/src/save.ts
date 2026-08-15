/**
 * Lưu cục bộ (§3, §4.1, §4.3 bản 2.0).
 *
 * Không tài khoản, không đám mây bắt buộc. Một máy chứa tối đa 2 hồ sơ — thiết kế thẳng cho
 * tình huống rất Việt Nam: hai anh em dùng chung một cái điện thoại.
 *
 * Save có checksum để phát hiện file hỏng (mất điện giữa lúc ghi, storage đầy), KHÔNG phải để
 * chống sửa: với game chơi đơn giá thấp, người muốn sửa save chỉ tự phá trải nghiệm của họ,
 * và mã hoá nặng chỉ đổi lấy độ phức tạp cùng nguy cơ khoá nhầm người chơi thật.
 *
 * Module này thuần dữ liệu — không đụng localStorage hay filesystem. Tầng ứng dụng quyết định
 * lưu ở đâu, nhờ vậy cùng một code chạy được trên web, Unity và trong test.
 */

import { DEVICE_CHECKS } from './balance.ts';
import { createCampState } from './crafting.ts';
import { createStepLedger } from './gathering.ts';
import { createSurvivalState } from './survival.ts';
import { createStoryState } from './story.ts';
import { createClockState } from './clock.ts';
import { hashSeed } from './rng.ts';
import { dayKey } from './time.ts';
import type { ClockState } from './clock.ts';
import type { StoryState } from './story.ts';
import type { BloodMoonFight } from './bloodMoon.ts';
import type { Gender, Inventory, LifetimeStats, PlayerState } from './types.ts';

export interface CraftJob {
  recipeId: string;
  readyAtMs: number;
}

export interface DeployedTrap {
  id: string;
  cellId: string;
  readyAtMs: number;
  expiresAtMs: number;
}

/** Số lần đã dùng mỗi hành động tại mỗi POI trong ngày, và mốc hồi chiêu. */
export interface PoiUsage {
  day: string;
  uses: Record<string, number>;
  lastUsedAtMs: Record<string, number>;
}

export interface Settings {
  /** §6.2 — khoá POI ngoài trời sau 21h, do phụ huynh bật, mặc định tắt. */
  parentalNightLock: boolean;
  /** §2 — đồng bộ thời tiết thật nếu tình cờ có mạng, mặc định tắt. */
  realWeatherSync: boolean;
  narrationAudio: boolean;
  haptics: boolean;
  /** Chế độ tiết kiệm pin & hạ nhiệt máy di động (giảm FPS render, tối ưu GPU), mặc định BẬT */
  batterySaver?: boolean;
  /** POI người chơi tự ẩn qua nút báo cáo (§6.1) — ẩn ngay trên máy. */
  hiddenPoiIds: string[];
}

export function defaultSettings(): Settings {
  return {
    parentalNightLock: false,
    realWeatherSync: false,
    narrationAudio: true,
    haptics: true,
    batterySaver: true,
    hiddenPoiIds: [],
  };
}

export interface ProfileSave {
  player: PlayerState;
  story: StoryState;
  clock: ClockState;
  settings: Settings;
  craftJobs: CraftJob[];
  traps: DeployedTrap[];
  poiUsage: PoiUsage;
  activeFight: BloodMoonFight | null;
  /** Tuần (theo mốc bắt đầu khung Trăng Máu) mà hồ sơ này đã đánh xong — chặn đánh bù trùng. */
  lastBloodMoonWeekStartMs: number | null;
  /** Bước đã ghi nhận nhưng hoãn sang lần mở app sau (trần bùng nổ ở stepFilter) — không mất. */
  pendingSteps: number;
  /** Ngày cuối cùng đã ghi nhận hoạt động, để đếm daysPlayed và reset hạn mức POI. */
  lastActiveDay: string;
  lastPlayedMs: number;
}

export interface SaveFile {
  formatVersion: number;
  /** Hồ sơ theo khe: tối đa 2 (§3). */
  profiles: (ProfileSave | null)[];
  activeSlot: number;
  savedAtMs: number;
  checksum: string;
}

export function emptyLifetime(): LifetimeStats {
  return {
    steps: 0,
    collected: {},
    craftedRecipeIds: [],
    visitedZones: [],
    performedActionIds: [],
    nightDefenseWins: 0,
    nightDefenseLosses: 0,
    bloodMoonWins: 0,
    daysPlayed: 1,
  };
}

export function createProfile(displayName: string, nowMs: number, gender: Gender = 'male', id?: string): ProfileSave {
  const player: PlayerState = {
    id: id ?? `p${hashSeed(displayName, nowMs).toString(36)}`,
    displayName,
    gender,
    survival: createSurvivalState(nowMs),
    carried: {},
    safeStorage: {},
    camp: createCampState(nowMs),
    steps: createStepLedger(nowMs),
    lifetime: emptyLifetime(),
    knownRecipes: [],
    strengthLevel: 1,
    createdAtMs: nowMs,
  };

  return {
    player,
    story: createStoryState(),
    clock: createClockState(nowMs),
    settings: defaultSettings(),
    craftJobs: [],
    traps: [],
    poiUsage: { day: dayKey(nowMs), uses: {}, lastUsedAtMs: {} },
    activeFight: null,
    lastBloodMoonWeekStartMs: null,
    pendingSteps: 0,
    lastActiveDay: dayKey(nowMs),
    lastPlayedMs: nowMs,
  };
}

export function createSaveFile(nowMs: number): SaveFile {
  return sign({
    formatVersion: DEVICE_CHECKS.save.formatVersion,
    profiles: Array.from({ length: DEVICE_CHECKS.save.profileSlots }, () => null),
    activeSlot: 0,
    savedAtMs: nowMs,
    checksum: '',
  });
}

// ------------------------------------------------------------------ checksum

/**
 * FNV-1a 32-bit trên bản JSON đã sắp xếp khoá.
 *
 * Phải sắp xếp khoá vì thứ tự thuộc tính của object có thể khác nhau giữa các lần chạy —
 * không sắp xếp thì save hợp lệ vẫn bị báo hỏng, đúng kiểu lỗi chỉ lộ ra sau khi phát hành.
 */
export function computeChecksum(save: Omit<SaveFile, 'checksum'>): string {
  return hashSeed(stableStringify(save)).toString(16).padStart(8, '0');
}

export function sign(save: SaveFile): SaveFile {
  const { checksum: _ignored, ...rest } = save;
  return { ...save, checksum: computeChecksum(rest) };
}

export interface LoadResult {
  ok: boolean;
  save: SaveFile | null;
  /** Save đọc được nhưng checksum lệch — vẫn cho chơi tiếp, chỉ cảnh báo. */
  checksumMismatch: boolean;
  messageVi?: string;
}

/**
 * Nạp save.
 *
 * Checksum lệch KHÔNG chặn người chơi: file có thể lệch vì bản cập nhật đổi cấu trúc, vì
 * người chơi tự sửa, hoặc vì lỗi ghi. Chặn ở đây nghĩa là xoá sạch tiến trình của một người
 * chơi vô tội — cái giá đó cao hơn nhiều so với việc để một người tự sửa save chơi tiếp.
 */
export function loadSave(raw: string): LoadResult {
  let parsed: SaveFile;
  try {
    parsed = JSON.parse(raw) as SaveFile;
  } catch {
    return { ok: false, save: null, checksumMismatch: false, messageVi: 'File save không đọc được.' };
  }

  if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.profiles)) {
    return { ok: false, save: null, checksumMismatch: false, messageVi: 'File save sai định dạng.' };
  }

  if (parsed.formatVersion > DEVICE_CHECKS.save.formatVersion) {
    return {
      ok: false,
      save: null,
      checksumMismatch: false,
      messageVi: `File save thuộc phiên bản ${parsed.formatVersion}, mới hơn bản game đang chạy. Hãy cập nhật game.`,
    };
  }

  const { checksum, ...rest } = parsed;
  const expected = computeChecksum(rest);
  const mismatch = checksum !== expected;

  return {
    ok: true,
    save: migrate(parsed),
    checksumMismatch: mismatch,
    messageVi: mismatch
      ? 'Save có dấu hiệu bị sửa hoặc ghi dở. Game vẫn chạy tiếp bình thường.'
      : undefined,
  };
}

export function serializeSave(save: SaveFile, nowMs: number): string {
  return JSON.stringify(sign({ ...save, savedAtMs: nowMs }));
}

/** Nâng cấp save cũ lên cấu trúc hiện tại. Mỗi bản phát hành đổi cấu trúc phải thêm một nhánh ở đây. */
function migrate(save: SaveFile): SaveFile {
  let out = save;

  if (out.profiles.length < DEVICE_CHECKS.save.profileSlots) {
    const profiles = [...out.profiles];
    while (profiles.length < DEVICE_CHECKS.save.profileSlots) profiles.push(null);
    out = { ...out, profiles };
  }

  return { ...out, formatVersion: DEVICE_CHECKS.save.formatVersion };
}

// ------------------------------------------------------------------ xuất / nhập file sao lưu

export interface BackupFile {
  magic: 'KHC-BACKUP';
  formatVersion: number;
  exportedAtMs: number;
  gameVersion: string;
  save: SaveFile;
}

/**
 * Xuất file sao lưu (§2: "đổi máy vẫn giữ được tiến trình").
 * Đây là mạng lưới an toàn duy nhất của người chơi khi không có cloud save.
 */
export function exportBackup(save: SaveFile, nowMs: number, gameVersion: string): string {
  const backup: BackupFile = {
    magic: 'KHC-BACKUP',
    formatVersion: DEVICE_CHECKS.save.formatVersion,
    exportedAtMs: nowMs,
    gameVersion,
    save: sign({ ...save, savedAtMs: nowMs }),
  };
  return JSON.stringify(backup, null, 2);
}

export function suggestBackupFileName(nowMs: number): string {
  return `ky-nguyen-hoang-co-${dayKey(nowMs)}${DEVICE_CHECKS.save.backupFileExtension}`;
}

export interface ImportResult {
  ok: boolean;
  save: SaveFile | null;
  messageVi: string;
}

export function importBackup(raw: string): ImportResult {
  let backup: BackupFile;
  try {
    backup = JSON.parse(raw) as BackupFile;
  } catch {
    return { ok: false, save: null, messageVi: 'File sao lưu không đọc được.' };
  }

  if (backup?.magic !== 'KHC-BACKUP') {
    return { ok: false, save: null, messageVi: 'Đây không phải file sao lưu của Kỷ Nguyên Hoang Cổ.' };
  }

  const loaded = loadSave(JSON.stringify(backup.save));
  if (!loaded.ok || !loaded.save) {
    return { ok: false, save: null, messageVi: loaded.messageVi ?? 'File sao lưu hỏng.' };
  }

  const profileCount = loaded.save.profiles.filter(Boolean).length;
  return {
    ok: true,
    save: loaded.save,
    messageVi: loaded.checksumMismatch
      ? `Đã nhập ${profileCount} hồ sơ. Lưu ý: checksum không khớp, file có thể đã bị sửa.`
      : `Đã nhập ${profileCount} hồ sơ từ bản sao lưu ngày ${dayKey(backup.exportedAtMs)}.`,
  };
}

// ------------------------------------------------------------------ thao tác khe hồ sơ

export function putProfile(save: SaveFile, slot: number, profile: ProfileSave | null): SaveFile {
  if (slot < 0 || slot >= save.profiles.length) {
    throw new Error(`Khe hồ sơ không hợp lệ: ${slot}`);
  }
  const profiles = [...save.profiles];
  profiles[slot] = profile;
  return sign({ ...save, profiles });
}

export function activeProfile(save: SaveFile): ProfileSave | null {
  return save.profiles[save.activeSlot] ?? null;
}

export function setActiveSlot(save: SaveFile, slot: number): SaveFile {
  if (slot < 0 || slot >= save.profiles.length) {
    throw new Error(`Khe hồ sơ không hợp lệ: ${slot}`);
  }
  return sign({ ...save, activeSlot: slot });
}

/** Tổng quan các khe để vẽ màn hình chọn hồ sơ. */
export interface SlotSummary {
  slot: number;
  empty: boolean;
  displayName?: string;
  gender?: Gender;
  campLevel?: number;
  chapterIndex?: number;
  lifetimeSteps?: number;
  lastPlayedMs?: number;
}

export function slotSummaries(save: SaveFile): SlotSummary[] {
  return save.profiles.map((profile, slot) => {
    if (!profile) return { slot, empty: true };
    return {
      slot,
      empty: false,
      displayName: profile.player.displayName,
      gender: profile.player.gender ?? 'male',
      campLevel: profile.player.camp.level,
      chapterIndex: profile.story.chapterIndex,
      lifetimeSteps: profile.player.lifetime.steps,
      lastPlayedMs: profile.lastPlayedMs,
    };
  });
}

/** Số ngày hồ sơ đã tồn tại, tính từ 1 — dùng cho cổng demo (§9). */
export function profileDayNumber(profile: ProfileSave, nowMs: number): number {
  const days = Math.floor((nowMs - profile.player.createdAtMs) / 86_400_000);
  return Math.max(1, days + 1);
}

export function totalInventory(profile: ProfileSave): Inventory {
  const out: Inventory = { ...profile.player.carried };
  for (const [itemId, qty] of Object.entries(profile.player.safeStorage)) {
    out[itemId] = (out[itemId] ?? 0) + qty;
  }
  return out;
}

/** JSON có thứ tự khoá ổn định — điều kiện bắt buộc để checksum tái lập được. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}
