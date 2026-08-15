/**
 * Phòng thủ doanh trại ban đêm (§5.4) — CHƠI HOÀN TOÀN TẠI NHÀ.
 *
 * Đây là cơ chế thay thế cho "ra ngoài sau 20h bị quái đuổi, phải chạy 200 m ngoài đời"
 * trong kịch bản v0. Không hàm nào trong module này thưởng cho việc ra đường ban đêm.
 * Chất kinh dị đến từ âm thanh, ánh sáng và nhịp rung ở tầng client, không từ rủi ro thật.
 */

import { COMBAT, NIGHT_DEFENSE, getCampTier, getDefenseStructure, getItem, getMonster } from './balance.ts';
import { addItems, dropFraction, emptyInventory } from './inventory.ts';
import { rollChance } from './rng.ts';
import { isNightDefenseWindow } from './time.ts';
import type {
  CampState,
  DefenseStructureId,
  Inventory,
  NightDefenseResult,
  RewardEntry,
} from './types.ts';

/** Sức phòng thủ tĩnh của trại = nền theo cấp + tổng công trình đã xây. */
export function campDefensePower(camp: CampState): number {
  let power = getCampTier(camp.level).baseDefense;
  for (const [id, count] of Object.entries(camp.defenseStructures)) {
    if (!count) continue;
    power += getDefenseStructure(id).defense * count;
  }
  return power;
}

/** Kiểm tra xem túi đồ có mùi máu tươi nồng nặc (>= 10 thịt/cá sống) thu hút thú dữ hay không (trừ khi có Túi Hương Ngải Cứu). */
export function hasBloodScent(carried: Inventory): boolean {
  if ((carried['herb_scent_pouch'] ?? 0) > 0) return false;
  const rawCount = (carried['raw_meat'] ?? 0) + (carried['raw_fish'] ?? 0);
  return rawCount >= 10;
}

/** Sát thương người chơi góp thêm khi trực tiếp thủ trại (vũ khí + khiên đang mang). */
export function playerCombatPower(
  carried: Inventory,
  campLevel: number,
  isFatigued = false,
): number {
  let best = COMBAT.playerBaseAttack;
  let defense = 0;

  for (const [itemId, qty] of Object.entries(carried)) {
    if (qty <= 0) continue;
    const item = getItem(itemId);
    if (item.attack) best = Math.max(best, item.attack);
    if (item.defense) defense += item.defense;
  }

  let total = (best + defense) * (1 + COMBAT.campLevelAttackBonus * campLevel);
  if (isFatigued) {
    total *= 0.7; // Giảm 30% sức đánh khi bị kiệt sức do thức đêm > 36h
  }
  return total;
}

/** Đợt quái mạnh dần theo cấp trại để đêm nào cũng còn là thử thách. */
function waveThreat(waveIndex: number, campLevel: number, bloodScentMultiplier = 1, repellentReduction = 0): number {
  const wave = NIGHT_DEFENSE.waves[waveIndex];
  if (!wave) return 0;
  const raw = wave.monsters.reduce(
    (sum, entry) => sum + getMonster(entry.id).threat * entry.count,
    0,
  );
  return raw * (1 + 0.6 * (campLevel - 1)) * bloodScentMultiplier * (1 - repellentReduction);
}

export function waveRosterVi(waveIndex: number): string {
  const wave = NIGHT_DEFENSE.waves[waveIndex];
  if (!wave) return '';
  return wave.monsters.map((e) => `${e.count} ${getMonster(e.id).nameVi}`).join(', ');
}

export interface DefenseContext {
  camp: CampState;
  /** Đồ đang mang — phần bị mất khi trại bị chọc thủng. */
  carried: Inventory;
  nowMs: number;
  /** Người chơi có đang mở app thủ trại trực tiếp hay không (§5.4: offline vẫn tự thủ). */
  online: boolean;
  /** Điểm chơi 0..1 khi online: bố trí bẫy, canh nhịp phản công. */
  playerPerformance?: number;
  /** Trạng thái kiệt sức do thức trắng đêm */
  isFatigued?: boolean;
  /** Trạng thái mùi máu tươi thu hút quái vật */
  bloodScent?: boolean;
  rng: () => number;
  /** Bỏ qua kiểm tra khung giờ — dùng cho test và cho chế độ mô phỏng của designer. */
  ignoreWindow?: boolean;
}

export interface DefenseOutcome extends NightDefenseResult {
  carried: Inventory;
  camp: CampState;
}

export function resolveNightDefense(ctx: DefenseContext): DefenseOutcome {
  if (!ctx.ignoreWindow && !isNightDefenseWindow(ctx.nowMs)) {
    return {
      survived: true,
      wavesCleared: 0,
      totalWaves: 0,
      playerPower: 0,
      monsterThreat: 0,
      structureDamage: {},
      lostItems: {},
      rewards: {},
      logVi: [
        `Đêm chưa xuống. Đợt tấn công diễn ra trong khung ${NIGHT_DEFENSE.windowStartHour}:00–${NIGHT_DEFENSE.windowEndHour}:00.`,
      ],
      carried: ctx.carried,
      camp: ctx.camp,
    };
  }

  const performance = clamp01(ctx.playerPerformance ?? 0.5);
  const structural = campDefensePower(ctx.camp);
  const efficiency = ctx.online ? 1 : NIGHT_DEFENSE.offlineDefenseEfficiency;
  const active = ctx.online
    ? playerCombatPower(ctx.carried, ctx.camp.level, ctx.isFatigued ?? false) * (0.5 + performance)
    : 0;

  let pool = structural * efficiency + active;
  const playerPower = pool;

  const logVi: string[] = [];
  const structureDamage: Partial<Record<DefenseStructureId, number>> = {};
  let wavesCleared = 0;
  let totalThreat = 0;
  let survived = true;

  const hasScent = ctx.bloodScent ?? hasBloodScent(ctx.carried);
  const scentMul = hasScent ? 1.4 : 1.0;

  if (hasScent) {
    logVi.push('🩸 Mùi máu tươi nồng nặc trong ba lô đã thu hút thêm dã thú khát máu (+40% đe doạ)!');
  }

  logVi.push(
    ctx.online
      ? `Bạn thắp đuốc, đứng sau tường. Sức phòng thủ ${Math.round(pool)}.`
      : `Trại tự phòng thủ trong đêm (hiệu suất ${Math.round(efficiency * 100)}%). Sức phòng thủ ${Math.round(pool)}.`,
  );

  for (let i = 0; i < NIGHT_DEFENSE.waves.length; i++) {
    const threat = waveThreat(i, ctx.camp.level, scentMul);
    totalThreat += threat;
    logVi.push(`Đợt ${i + 1}: ${waveRosterVi(i)} lao ra từ bóng tối (đe doạ ${Math.round(threat)}).`);

    if (pool < threat) {
      survived = false;
      logVi.push('Tường vỡ. Chúng tràn vào trại.');
      break;
    }

    wavesCleared++;
    // Thủ được vẫn hao mòn — người chơi phải sửa/xây thêm trước Trăng Máu thứ Bảy.
    const wear = threat * 0.35;
    pool -= wear;
    accumulateWear(ctx.camp, structureDamage, wear);
    logVi.push(`Đợt ${i + 1} bị đẩy lui. Công trình hư hại ${Math.round(wear)}.`);
  }

  let carried = ctx.carried;
  let lostItems: Inventory = {};
  let rewards: Inventory = emptyInventory();

  if (survived) {
    rewards = rollRewards(NIGHT_DEFENSE.victoryReward as RewardEntry[], ctx.rng);
    carried = addItems(carried, rewards);
    logVi.push('Trời hửng sáng. Trại còn nguyên.');
  } else {
    const drop = dropFraction(carried, NIGHT_DEFENSE.breachLossRatio);
    carried = drop.kept;
    lostItems = drop.lost;
    logVi.push(
      Object.keys(lostItems).length > 0
        ? `Mất ${describe(lostItems)}. Két an toàn trong trại không bị đụng tới.`
        : 'May mắn: bạn chẳng mang gì đáng để mất.',
    );
  }

  const camp = survived ? ctx.camp : consumeBreakableTraps(ctx.camp);

  return {
    survived,
    wavesCleared,
    totalWaves: NIGHT_DEFENSE.waves.length,
    playerPower: Math.round(playerPower),
    monsterThreat: Math.round(totalThreat),
    structureDamage,
    lostItems,
    rewards,
    logVi,
    carried,
    camp,
  };
}

/** Chia phần hao mòn cho các công trình có HP theo tỉ lệ sức phòng thủ chúng đóng góp. */
function accumulateWear(
  camp: CampState,
  into: Partial<Record<DefenseStructureId, number>>,
  wear: number,
): void {
  const entries = Object.entries(camp.defenseStructures).filter(([id, count]) => {
    if (!count) return false;
    return getDefenseStructure(id).hp !== undefined;
  }) as [DefenseStructureId, number][];

  const totalDefense = entries.reduce(
    (sum, [id, count]) => sum + getDefenseStructure(id).defense * count,
    0,
  );
  if (totalDefense <= 0) return;

  for (const [id, count] of entries) {
    const share = (getDefenseStructure(id).defense * count) / totalDefense;
    into[id] = Math.round((into[id] ?? 0) + wear * share);
  }
}

/** Bẫy chông dùng một lần: bị tiêu hao khi trại bị chọc thủng. */
function consumeBreakableTraps(camp: CampState): CampState {
  const next = { ...camp.defenseStructures };
  let changed = false;

  for (const [id, count] of Object.entries(next) as [DefenseStructureId, number][]) {
    if (!count) continue;
    if (!getDefenseStructure(id).consumedOnBreach) continue;
    const remaining = Math.max(0, count - Math.ceil(count / 2));
    if (remaining !== count) changed = true;
    if (remaining === 0) delete next[id];
    else next[id] = remaining;
  }

  return changed ? { ...camp, defenseStructures: next } : camp;
}

export function rollRewards(entries: RewardEntry[], rng: () => number): Inventory {
  let out = emptyInventory();
  for (const entry of entries) {
    if (rollChance(rng, entry.chance)) {
      out = addItems(out, [{ itemId: entry.itemId, qty: entry.qty }]);
    }
  }
  return out;
}

function describe(inv: Inventory): string {
  return Object.entries(inv)
    .map(([itemId, qty]) => `${qty} ${getItem(itemId).nameVi}`)
    .join(', ');
}

/** Dự báo cho HUD buổi chiều: "trại của bạn liệu có trụ được đêm nay?" */
export function forecastTonight(camp: CampState): {
  power: number;
  requiredPower: number;
  verdictVi: string;
} {
  const power = campDefensePower(camp) * NIGHT_DEFENSE.offlineDefenseEfficiency;
  const requiredPower = Math.max(
    ...NIGHT_DEFENSE.waves.map((_, i) => waveThreat(i, camp.level)),
  );

  const ratio = requiredPower > 0 ? power / requiredPower : 2;
  const verdictVi =
    ratio >= 1.4
      ? 'Trại rất vững. Đêm nay ngủ được.'
      : ratio >= 1
        ? 'Trại đủ trụ, nhưng sát nút. Nên xây thêm một tường.'
        : 'Trại sẽ bị chọc thủng. Hãy gửi đồ quý vào két an toàn và xây thêm phòng thủ.';

  return { power: Math.round(power), requiredPower: Math.round(requiredPower), verdictVi };
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
