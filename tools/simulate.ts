/**
 * Tool mô phỏng cân bằng — chạy nhiều "người chơi ảo" qua N ngày và in ra đường cong tiến độ.
 *
 * Vì sao cần: không thể chỉnh số cân bằng bằng cảm giác. Câu hỏi kiểu "đi 6.000 bước/ngày thì
 * mấy ngày lên được Nhà Sàn Gỗ?" hoặc "người đi 4.000 bước có bao giờ chết đói không?" chỉ trả
 * lời được bằng cách chơi thử vài trăm ngày — mà máy làm việc đó trong một giây.
 *
 * Con bot ở đây chơi như một người chơi TỬ TẾ nhưng KHÔNG tối ưu: ăn khi đói, uống khi khát,
 * chặt gỗ khi qua công viên, nâng cấp trại khi đủ đồ. Nếu con số cân bằng chỉ ổn với người chơi
 * tối ưu thì nó chưa ổn.
 *
 *   node tools/simulate.ts              # kịch bản mặc định, 30 ngày
 *   node tools/simulate.ts 60           # 60 ngày
 *   node tools/simulate.ts 30 --csv     # xuất CSV để dán vào spreadsheet
 */

import {
  beginBloodMoon,
  collectCrafts,
  consume,
  craft,
  createProfile,
  dailyLimitFor,
  findAction,
  finishBloodMoon,
  gather,
  getCampTier,
  openApp,
  runNightDefense,
  sampleHanoiPack,
  sleepAtCamp,
  storeInSafe,
  strikeBoss,
  upgradeCamp,
  wakeUp,
} from '../packages/game-core/src/index.ts';
import type { ProfileSave } from '../packages/game-core/src/index.ts';
import { isBloodMoonWindow, isNightDefenseWindow, toLocalTime } from '../packages/game-core/src/time.ts';

const PACK = sampleHanoiPack();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// Ba điểm chạm trong ngày, đúng nhịp sinh hoạt mà kế hoạch §5.7 mô tả.
const SPOTS = {
  morning: { lat: 21.0287, lon: 105.8524 }, // Hồ Gươm — múc nước trên đường đi làm
  noon: { lat: 21.0382, lon: 105.8497 }, // Chợ Đồng Xuân — đổi hàng giờ nghỉ trưa
  evening: { lat: 21.0128, lon: 105.8434 }, // Công viên Thống Nhất — chặt gỗ chiều về
};

interface Scenario {
  nameVi: string;
  stepsPerDay: number;
  /** Người chơi có ghé công viên/hồ để làm hành động chủ động không, hay chỉ đi bộ suông. */
  activePlayer: boolean;
  /** Có thủ trại mỗi tối không, hay để trại tự thủ. */
  defendsAtNight: boolean;
}

const SCENARIOS: Scenario[] = [
  { nameVi: 'Ít vận động (4.000 bước)', stepsPerDay: 4000, activePlayer: true, defendsAtNight: true },
  { nameVi: 'Trung bình (6.000 bước)', stepsPerDay: 6000, activePlayer: true, defendsAtNight: true },
  { nameVi: 'Chăm đi bộ (10.000 bước)', stepsPerDay: 10_000, activePlayer: true, defendsAtNight: true },
  { nameVi: 'Kịch trần (15.000 bước)', stepsPerDay: 15_000, activePlayer: true, defendsAtNight: true },
  { nameVi: 'Thụ động (6.000, không ghé POI)', stepsPerDay: 6000, activePlayer: false, defendsAtNight: false },
];

interface Outcome {
  scenario: Scenario;
  daysToTier2: number | null;
  daysToTier3: number | null;
  knockouts: number;
  nightsLost: number;
  bloodMoonWins: number;
  bloodMoonFights: number;
  minSatiety: number;
  minHydration: number;
  avgSatiety: number;
  finalSteps: number;
  finalLogs: number;
  cappedDays: number;
  daily: { day: number; campLevel: number; logs: number; satiety: number; hp: number }[];
}

function simulate(scenario: Scenario, days: number, seedName: string): Outcome {
  // Bắt đầu 8h sáng thứ Hai để nhịp tuần khớp với Trăng Máu tối thứ Bảy.
  const start = Date.UTC(2026, 10, 9, 1, 0, 0);
  let profile = createProfile(seedName, start, `sim-${seedName}`);

  const out: Outcome = {
    scenario,
    daysToTier2: null,
    daysToTier3: null,
    knockouts: 0,
    nightsLost: 0,
    bloodMoonWins: 0,
    bloodMoonFights: 0,
    minSatiety: 100,
    minHydration: 100,
    avgSatiety: 0,
    finalSteps: 0,
    finalLogs: 0,
    cappedDays: 0,
    daily: [],
  };

  let satietySum = 0;
  let samples = 0;

  for (let day = 0; day < days; day++) {
    const sessions: { at: keyof typeof SPOTS; hour: number; share: number }[] = [
      { at: 'morning', hour: 8, share: 0.35 },
      { at: 'noon', hour: 12, share: 0.2 },
      { at: 'evening', hour: 18, share: 0.45 },
    ];

    for (const session of sessions) {
      const nowMs = start + day * DAY + (session.hour - 8) * HOUR;
      const steps = Math.round(scenario.stepsPerDay * session.share);

      const opened = openApp({
        profile,
        deviceMs: nowMs,
        newSteps: steps,
        position: SPOTS[session.at],
        pack: PACK,
      });
      profile = opened.profile;

      if (opened.knockedOut) out.knockouts++;
      if (opened.eventsVi.some((e) => e.includes('trần thưởng'))) out.cappedDays++;

      profile = keepAlive(profile, nowMs);
      if (scenario.activePlayer) profile = doActions(profile, nowMs, session.at);
      profile = buildStuff(profile, nowMs);

      const survival = profile.player.survival;
      out.minSatiety = Math.min(out.minSatiety, survival.satiety);
      out.minHydration = Math.min(out.minHydration, survival.hydration);
      satietySum += survival.satiety;
      samples++;
    }

    // Tối: phòng thủ trại, hoặc Trăng Máu nếu là tối thứ Bảy.
    const nightMs = start + day * DAY + 13 * HOUR; // 21:00 giờ VN
    if (isBloodMoonWindow(nightMs)) {
      profile = fightBoss(profile, nightMs, out);
    } else if (isNightDefenseWindow(nightMs)) {
      const stashed = stashValuables(profile);
      const result = runNightDefense(stashed, nightMs, scenario.defendsAtNight ? 0.7 : 0, scenario.defendsAtNight);
      profile = result.profile;
      if (!result.result.survived) out.nightsLost++;
    }

    // Ngủ tại trại sau khi đêm xong. Không ngủ thì 14 tiếng từ tối tới sáng sẽ vắt kiệt cả
    // đói lẫn khát và người chơi ngất mỗi sáng — đó là lỗi của bot, không phải của cân bằng.
    profile = sleepAtCamp(profile, nightMs + HOUR).profile;
    profile = wakeUp(profile, start + (day + 1) * DAY).profile;

    if (out.daysToTier2 === null && profile.player.camp.level >= 2) out.daysToTier2 = day + 1;
    if (out.daysToTier3 === null && profile.player.camp.level >= 3) out.daysToTier3 = day + 1;

    out.daily.push({
      day: day + 1,
      campLevel: profile.player.camp.level,
      logs: profile.player.carried.log ?? 0,
      satiety: Math.round(profile.player.survival.satiety),
      hp: Math.round(profile.player.survival.hp),
    });
  }

  out.avgSatiety = satietySum / Math.max(1, samples);
  out.finalSteps = profile.player.lifetime.steps;
  out.finalLogs = (profile.player.carried.log ?? 0) + (profile.player.safeStorage.log ?? 0);
  return out;
}

/** Ăn và uống khi chỉ số xuống thấp — ưu tiên đồ đã nấu, chỉ uống nước thô khi bí. */
function keepAlive(profile: ProfileSave, nowMs: number): ProfileSave {
  let current = profile;

  if (current.player.survival.hydration < 45) {
    for (const drink of ['boiled_water', 'raw_water']) {
      if ((current.player.carried[drink] ?? 0) > 0) {
        current = consume(current, drink, nowMs).profile;
        break;
      }
    }
  }

  if (current.player.survival.satiety < 45) {
    for (const food of ['grilled_meat', 'grilled_fish', 'dried_meat', 'wild_berry']) {
      if ((current.player.carried[food] ?? 0) > 0) {
        current = consume(current, food, nowMs).profile;
        break;
      }
    }
  }

  return current;
}

function doActions(profile: ProfileSave, nowMs: number, spot: keyof typeof SPOTS): ProfileSave {
  let current = profile;
  const attempt = (
    actionId: string,
    poiId: string,
    zone: 'forest' | 'water' | 'merchant' | 'trail',
    actionAtMs = nowMs,
  ): boolean => {
    // Điểm minigame 0,65: người chơi bình thường, không phải cao thủ.
    const result = gather({
      profile: current,
      actionId,
      poiId,
      zone,
      nowMs: actionAtMs,
      distanceMeters: 5,
      minigameScore: 0.65,
    });
    if (result.ok) current = result.profile;
    return result.ok;
  };

  // Chặt gỗ ở MỌI điểm chạm: người chơi thật đi ngang vạt cây trên đường đi làm lẫn lúc về.
  // Khi đã đi đủ bước, bot ở lại công viên làm thêm các lượt đã mở; mỗi lượt cách nhau đúng
  // hồi chiêu để đo hiệu quả thực của cơ chế, không coi chúng là gỗ miễn phí.
  attempt('chop_wood', 'p7', 'forest');
  if (spot === 'evening') {
    const chopWood = findAction('chop_wood');
    const limit = chopWood ? dailyLimitFor(chopWood, current.player.steps.totalSteps) : 0;
    let nextAttemptMs = nowMs + HOUR;
    while ((current.poiUsage.uses['p7:chop_wood'] ?? 0) < (limit ?? 0)) {
      if (!attempt('chop_wood', 'p7', 'forest', nextAttemptMs)) break;
      nextAttemptMs += HOUR;
    }
  }
  for (let i = 0; i < 3; i++) attempt('forage_berries', 'p7', 'forest');

  if (spot === 'evening') {
    attempt('collect_trap', 'p7', 'forest');
    attempt('set_trap', 'p7', 'forest');
  }

  if (spot === 'morning') {
    attempt('draw_water', 'p1', 'water');
    attempt('fish', 'p1', 'water');
  }

  if (spot === 'noon') {
    attempt('draw_water', 'p1', 'water');
  }

  return current;
}

/** Thứ tự xây dựng của một người chơi tử tế: lửa → rìu → nấu ăn → hàng rào → nâng cấp trại. */
function buildStuff(profile: ProfileSave, nowMs: number): ProfileSave {
  let current = collectCrafts(profile, nowMs).profile;

  // Mỗi công thức kèm số lượng TỐI ĐA người chơi muốn giữ trong người. Thiếu trần này thì bot
  // chế 90 cái bẫy thỏ trong 30 ngày và ngốn sạch dây leo lẽ ra để dành nâng cấp trại —
  // một hành vi không người chơi nào có, và nó bóp méo toàn bộ kết quả cân bằng.
  const queue: [recipeId: string, outputId: string, keepAtMost: number][] = [
    ['campfire', 'campfire', 1],
    ['stone_axe', 'stone_axe', 1],
    ['stone_spear', 'stone_spear', 1],
    ['thorn_fence', 'thorn_fence', 4],
    ['drying_rack', 'drying_rack', 1],
    ['fishing_rod', 'fishing_rod', 1],
    ['rabbit_trap', 'rabbit_trap', 2],
    ['boiled_water', 'boiled_water', 4],
    ['grilled_meat', 'grilled_meat', 3],
    ['grilled_fish', 'grilled_fish', 3],
  ];

  for (const [recipeId, outputId, keepAtMost] of queue) {
    const held =
      (current.player.carried[outputId] ?? 0) +
      (current.player.camp.defenseStructures[outputId as 'thorn_fence'] ?? 0) +
      (current.player.camp.stations.includes(outputId as 'campfire') ? 1 : 0) +
      current.craftJobs.filter((job) => job.recipeId === recipeId).length;

    if (held >= keepAtMost) continue;

    const result = craft(current, recipeId, nowMs, true);
    if (result.ok) current = result.profile;
  }

  // Nâng cấp trại được ưu tiên trên mọi thứ ngốn gỗ: người chơi biết mình đang tiết kiệm cho
  // cái gì. Chỉ khi trại đã kịch cấp mới đem gỗ đi xây tường.
  const upgrade = upgradeCamp(current, nowMs);
  if (upgrade.ok) {
    current = upgrade.profile;
  } else if (current.player.camp.level >= 2) {
    for (const recipeId of ['rope', 'wooden_wall', 'spike_trap']) {
      const result = craft(current, recipeId, nowMs, true);
      if (result.ok) current = result.profile;
    }
  }

  return collectCrafts(current, nowMs + 1).profile;
}

/** Cất bản vẽ và lõi nâng cấp vào két trước khi đêm xuống — điều người chơi hiểu chuyện sẽ làm. */
function stashValuables(profile: ProfileSave): ProfileSave {
  let current = profile;
  for (const itemId of ['blueprint', 'upgrade_core']) {
    const qty = current.player.carried[itemId] ?? 0;
    if (qty > 0) {
      const result = storeInSafe(current, [{ itemId, qty }]);
      if (result.ok) current = result.profile;
    }
  }
  return current;
}

function fightBoss(profile: ProfileSave, nowMs: number, out: Outcome): ProfileSave {
  const begun = beginBloodMoon(profile, nowMs, 'thuong');
  if (!begun.ok || !begun.fight) return profile;

  let current = begun.profile;
  out.bloodMoonFights++;

  // Đánh liên tục trong khung giờ còn lại, mỗi lượt 30 giây.
  for (let i = 0; i < 60; i++) {
    const at = nowMs + i * 30_000;
    if (at >= begun.fight.endMs) break;
    const hit = strikeBoss(current, at, 0.7, 30);
    current = hit.profile;
    if (hit.defeated) break;
  }

  const settled = finishBloodMoon(current, nowMs + HOUR);
  if (settled.settlement?.victory) out.bloodMoonWins++;
  return settled.profile;
}

// ---------------------------------------------------------------- in kết quả

function pad(text: string, width: number): string {
  return text.length >= width ? text.slice(0, width) : text + ' '.repeat(width - text.length);
}

function printTable(results: Outcome[], days: number): void {
  console.log(`\nMÔ PHỎNG ${days} NGÀY — mỗi ngày 3 lần mở app\n`);

  const header = [
    pad('Kịch bản', 32),
    pad('Lên C2', 8),
    pad('Lên C3', 8),
    pad('Ngất', 6),
    pad('Thua đêm', 9),
    pad('Boss', 7),
    pad('Đói min', 8),
    pad('Gỗ cuối', 9),
    pad('Bước', 9),
  ].join('');
  console.log(header);
  console.log('─'.repeat(header.length));

  for (const r of results) {
    console.log(
      [
        pad(r.scenario.nameVi, 32),
        pad(r.daysToTier2 ? `ngày ${r.daysToTier2}` : '—', 8),
        pad(r.daysToTier3 ? `ngày ${r.daysToTier3}` : '—', 8),
        pad(String(r.knockouts), 6),
        pad(String(r.nightsLost), 9),
        pad(`${r.bloodMoonWins}/${r.bloodMoonFights}`, 7),
        pad(String(Math.round(r.minSatiety)), 8),
        pad(String(r.finalLogs), 9),
        pad(r.finalSteps.toLocaleString('vi-VN'), 9),
      ].join(''),
    );
  }

  console.log('\nĐỐI CHIẾU VỚI KẾ HOẠCH §5.3');
  const target2 = getCampTier(1).upgradeToNext!.estimatedPlayDays;
  const target3 = getCampTier(2).upgradeToNext!.estimatedPlayDays;
  console.log(`  Cấp 2 dự kiến: ${target2} ngày chơi đều · Cấp 3 dự kiến: ${target3} ngày`);

  const normal = results.find((r) => r.scenario.stepsPerDay === 6000 && r.scenario.activePlayer);
  if (normal) {
    const verdict2 =
      normal.daysToTier2 === null
        ? 'KHÔNG ĐẠT — người chơi 6.000 bước không bao giờ lên nổi cấp 2'
        : normal.daysToTier2 <= 5
          ? 'khớp'
          : `LỆCH — thực tế ngày ${normal.daysToTier2}, kế hoạch nói 3–4`;
    console.log(`  Người chơi 6.000 bước lên cấp 2: ${verdict2}`);
  }

  console.log('\nBẤT BIẾN "ĐI BỘ LUÔN CÓ LÃI"');
  const sorted = [...results].filter((r) => r.scenario.activePlayer).sort((a, b) => a.scenario.stepsPerDay - b.scenario.stepsPerDay);
  let monotonic = true;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    const prevDays = prev.daysToTier2 ?? 9999;
    const currDays = curr.daysToTier2 ?? 9999;
    if (currDays > prevDays) {
      monotonic = false;
      console.log(`  VI PHẠM: ${curr.scenario.nameVi} lên cấp 2 CHẬM HƠN ${prev.scenario.nameVi}`);
    }
  }
  if (monotonic) console.log('  OK — đi bộ nhiều hơn không bao giờ tiến chậm hơn.');
}

function printCsv(results: Outcome[]): void {
  console.log('kich_ban,ngay,cap_trai,go_lon,doi,hp');
  for (const r of results) {
    for (const row of r.daily) {
      console.log(`"${r.scenario.nameVi}",${row.day},${row.campLevel},${row.logs},${row.satiety},${row.hp}`);
    }
  }
}

/**
 * Chạy mỗi kịch bản với nhiều seed rồi lấy trung vị.
 *
 * Một lần chạy đơn lẻ lệch ±2 ngày chỉ vì bảng rơi ngẫu nhiên, đủ để báo động giả cho bất
 * biến "đi bộ luôn có lãi". Trung vị của 5 lần loại được nhiễu đó.
 */
function median(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (known.length === 0) return null;
  // Quá nửa số lần chạy không đạt thì coi như không đạt.
  if (known.length <= values.length / 2) return null;
  return known[Math.floor(known.length / 2)]!;
}

function aggregate(scenario: Scenario, days: number, seeds: number): Outcome {
  const runs = Array.from({ length: seeds }, (_, s) => simulate(scenario, days, `${scenario.stepsPerDay}-${s}`));
  const first = runs[0]!;
  const avg = (pick: (o: Outcome) => number) => runs.reduce((sum, r) => sum + pick(r), 0) / runs.length;

  return {
    ...first,
    daysToTier2: median(runs.map((r) => r.daysToTier2)),
    daysToTier3: median(runs.map((r) => r.daysToTier3)),
    knockouts: Math.round(avg((r) => r.knockouts)),
    nightsLost: Math.round(avg((r) => r.nightsLost)),
    bloodMoonWins: Math.round(avg((r) => r.bloodMoonWins)),
    bloodMoonFights: first.bloodMoonFights,
    minSatiety: Math.min(...runs.map((r) => r.minSatiety)),
    avgSatiety: avg((r) => r.avgSatiety),
    finalLogs: Math.round(avg((r) => r.finalLogs)),
  };
}

const days = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 30);
const asCsv = process.argv.includes('--csv');
const seeds = asCsv ? 1 : 5;

const results = SCENARIOS.map((scenario) => aggregate(scenario, days, seeds));

if (asCsv) printCsv(results);
else printTable(results, days);
