/**
 * Ba chỉ số sinh tồn: Đói, Khát, Thể lực (§5.1).
 *
 * Điều chỉnh quan trọng nhất so với kịch bản v0: đói giảm CHỦ YẾU theo thời gian
 * (-5%/giờ), đi bộ chỉ cộng rất nhẹ (-1 điểm mỗi 1.000 bước). Nhờ vậy người đi bộ nhiều
 * luôn lãi ròng — xem test bất biến "đi bộ luôn có lãi" trong survival.test.ts.
 */

import { SURVIVAL, getItem } from './balance.ts';
import { rollChance } from './rng.ts';
import { HOUR_MS } from './time.ts';
import type { Inventory, ItemId, SurvivalState, SurvivalTickResult } from './types.ts';

const SUB_TICK_MINUTES = 10;
const SUB_TICK_MS = SUB_TICK_MINUTES * 60_000;

export function createSurvivalState(nowMs: number): SurvivalState {
  return {
    satiety: SURVIVAL.satiety.startValue,
    hydration: SURVIVAL.hydration.startValue,
    hp: SURVIVAL.hp.startValue,
    sickUntilMs: null,
    asleep: false,
    lastTickMs: nowMs,
  };
}

export interface TickOptions {
  /** Số bước ghi nhận trong khoảng thời gian này, phân bổ đều cho các sub-tick. */
  steps?: number;
  /** Ngủ tại trại thì hồi HP (§5.1). */
  atCamp?: boolean;
  /** Hệ số thời tiết: rét làm đói nhanh hơn, nắng gắt làm khát nhanh hơn (weather.json). */
  satietyDecayMultiplier?: number;
  hydrationDecayMultiplier?: number;
  /** Ba lô quá tải trọng lượng: đi bộ tốn gấp đôi độ Đói */
  isOverburdened?: boolean;
  /** Đang bị cảm lạnh do dầm mưa lâu */
  hypothermia?: boolean;
  /** Đang bị say nắng do đi trưa hè gắt */
  heatstroke?: boolean;
  /** Đồng hồ bị lùi (§4.3): đóng băng suy giảm thay vì trừng phạt. */
  frozen?: boolean;
}

const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

/**
 * Mô phỏng tiến từ `state.lastTickMs` tới `nowMs` theo từng nhịp 10 phút.
 *
 * Chia nhịp nhỏ thay vì nhân trực tiếp cả khoảng vì thứ tự các hiệu ứng có ý nghĩa:
 * chỉ số phải cạn TRƯỚC rồi HP mới bắt đầu tụt, nếu không người chơi offline 8 tiếng
 * sẽ bị trừ HP cho cả 8 tiếng dù chỉ thực sự cạn nước ở tiếng thứ 7.
 */
export function tickSurvival(
  state: SurvivalState,
  nowMs: number,
  options: TickOptions = {},
): SurvivalTickResult {
  if (options.frozen) {
    // Đồng hồ máy bị lùi: dừng đồng hồ game lại, không suy giảm, không hồi phục (§4.3).
    return {
      survival: { ...state, lastTickMs: nowMs },
      hpLost: 0,
      knockedOut: false,
      hoursSimulated: 0,
      cappedByOfflineLimit: false,
    };
  }

  const elapsedMs = Math.max(0, nowMs - state.lastTickMs);
  const maxMs = SURVIVAL.offlineCatchUp.maxHoursSimulated * HOUR_MS;
  const cappedByOfflineLimit = elapsedMs > maxMs;
  const simulatedMs = Math.min(elapsedMs, maxMs);

  const subTicks = Math.floor(simulatedMs / SUB_TICK_MS);
  const stepsPerSubTick = subTicks > 0 ? (options.steps ?? 0) / subTicks : 0;

  let { satiety, hydration, hp, sickUntilMs, hypothermiaUntilMs, heatstrokeUntilMs, fatiguedUntilMs, lastSleepMs } = state;
  const asleep = state.asleep;
  const hpBefore = hp;
  let knockedOut = false;

  // Nếu ngủ tại doanh trại: chữa lành cảm lạnh, say nắng và giải tỏa kiệt sức
  if (asleep && options.atCamp) {
    hypothermiaUntilMs = null;
    heatstrokeUntilMs = null;
    fatiguedUntilMs = null;
    lastSleepMs = nowMs;
  } else {
    // Kiểm tra nếu không ngủ quá 36 giờ (game time) thì dính kiệt sức
    const timeSinceSleepMs = nowMs - (lastSleepMs ?? state.lastTickMs);
    if (timeSinceSleepMs > 36 * HOUR_MS) {
      fatiguedUntilMs = nowMs + 4 * HOUR_MS;
    }
  }

  for (let i = 0; i < subTicks; i++) {
    const tickEndMs = state.lastTickMs + (i + 1) * SUB_TICK_MS;
    const sick = sickUntilMs !== null && tickEndMs < sickUntilMs;
    const sickMul = sick ? SURVIVAL.sickness.decayMultiplierWhileSick : 1;
    const hoursFraction = SUB_TICK_MINUTES / 60;

    const satietyRate = asleep
      ? SURVIVAL.satiety.decayPerHourAsleep
      : SURVIVAL.satiety.decayPerHourAwake;
    const hydrationRate = asleep
      ? SURVIVAL.hydration.decayPerHourAsleep
      : SURVIVAL.hydration.decayPerHourAwake;

    let satietyWeather = options.satietyDecayMultiplier ?? 1;
    let hydrationWeather = options.hydrationDecayMultiplier ?? 1;

    // Cảm lạnh do dầm mưa: đói nhanh hơn 30%
    if (hypothermiaUntilMs && tickEndMs < hypothermiaUntilMs) {
      satietyWeather *= 1.3;
    }

    // Say nắng trưa hè: khát nhanh hơn 100%
    if (heatstrokeUntilMs && tickEndMs < heatstrokeUntilMs) {
      hydrationWeather *= 2.0;
    }

    // Quá tải trọng lượng: đi bộ tốn gấp đôi độ Đói (-2 điểm/1000 bước)
    const stepDecayMultiplier = options.isOverburdened ? 2.0 : 1.0;

    satiety -= satietyRate * hoursFraction * sickMul * satietyWeather;
    satiety -= (stepsPerSubTick / 1000) * SURVIVAL.satiety.decayPer1000Steps * stepDecayMultiplier;
    hydration -= hydrationRate * hoursFraction * sickMul * hydrationWeather;
    hydration -= (stepsPerSubTick / 1000) * SURVIVAL.hydration.decayPer1000Steps;

    satiety = clamp(satiety, 0, SURVIVAL.satiety.max);
    hydration = clamp(hydration, 0, SURVIVAL.hydration.max);

    // Khát tụt HP nhanh hơn đói (§5.1).
    if (hydration <= 0) hp -= SURVIVAL.hydration.emptyHpLossPer10Min;
    if (satiety <= 0) hp -= SURVIVAL.satiety.emptyHpLossPer10Min;

    if (hydration > 0 && satiety > 0) {
      if (asleep && options.atCamp) {
        hp += SURVIVAL.hp.regenPerHourAsleepAtCamp * hoursFraction;
      } else if (satiety >= SURVIVAL.hp.wellFedThreshold) {
        hp += SURVIVAL.hp.regenPerHourIdleWellFed * hoursFraction;
      }
    }

    hp = clamp(hp, 0, SURVIVAL.hp.max);
    if (hp <= 0) {
      knockedOut = true;
      break;
    }
  }

  if (sickUntilMs !== null && nowMs >= sickUntilMs) sickUntilMs = null;
  if (hypothermiaUntilMs && nowMs >= hypothermiaUntilMs) hypothermiaUntilMs = null;
  if (heatstrokeUntilMs && nowMs >= heatstrokeUntilMs) heatstrokeUntilMs = null;
  if (fatiguedUntilMs && nowMs >= fatiguedUntilMs) fatiguedUntilMs = null;

  if (cappedByOfflineLimit) {
    satiety = Math.max(satiety, SURVIVAL.offlineCatchUp.floorSatiety);
    hydration = Math.max(hydration, SURVIVAL.offlineCatchUp.floorHydration);
    hp = Math.max(hp, SURVIVAL.offlineCatchUp.floorHp);
    knockedOut = false;
  }

  const survival: SurvivalState = {
    satiety: round1(satiety),
    hydration: round1(hydration),
    hp: round1(hp),
    sickUntilMs,
    asleep,
    lastTickMs: nowMs,
    hypothermiaUntilMs,
    heatstrokeUntilMs,
    fatiguedUntilMs,
    lastSleepMs: lastSleepMs ?? state.lastTickMs,
  };

  return {
    survival,
    hpLost: round1(Math.max(0, hpBefore - survival.hp)),
    knockedOut,
    hoursSimulated: round1(simulatedMs / HOUR_MS),
    cappedByOfflineLimit,
  };
}

export interface ConsumeResult {
  ok: boolean;
  reasonVi?: string;
  survival: SurvivalState;
  gotSick: boolean;
  messageVi?: string;
}

/**
 * Ăn/uống một vật phẩm. Nước thô có 40% nhiễm bệnh (§5.1) — dùng "tỉ lệ nhiễm bệnh"
 * thay cho "trừ máu cứng" của kịch bản v0 để cảm giác tự nhiên hơn và vẫn dạy được
 * người chơi rằng phải đun nước.
 */
export function consumeItem(
  survival: SurvivalState,
  itemId: ItemId,
  nowMs: number,
  rng: () => number,
): ConsumeResult {
  const item = getItem(itemId);
  const isConsumable =
    item.kind === 'food' || item.kind === 'drink' || item.kind === 'consumable';

  if (!isConsumable) {
    return { ok: false, reasonVi: `${item.nameVi} không dùng để ăn hoặc uống.`, survival, gotSick: false };
  }

  let { satiety, hydration, hp, sickUntilMs, hypothermiaUntilMs, heatstrokeUntilMs, fatiguedUntilMs, lastSleepMs } = survival;
  satiety = clamp(satiety + (item.satiety ?? 0), 0, SURVIVAL.satiety.max);
  hydration = clamp(hydration + (item.hydration ?? 0), 0, SURVIVAL.hydration.max);
  hp = clamp(hp + (item.hp ?? 0), 0, SURVIVAL.hp.max);

  if (item.curesSickness) sickUntilMs = null;
  if ((item as any).curesHypothermia) hypothermiaUntilMs = null;
  if ((item as any).curesFatigue) {
    fatiguedUntilMs = null;
    lastSleepMs = nowMs;
  }

  let gotSick = false;
  let messageVi: string | undefined;

  if (item.infectionRisk && rollChance(rng, SURVIVAL.sickness.rawWaterInfectionChance)) {
    gotSick = true;
    hp = clamp(hp - SURVIVAL.sickness.hpLoss, 0, SURVIVAL.hp.max);
    sickUntilMs = nowMs + SURVIVAL.sickness.durationMinutes * 60_000;
    messageVi = 'Nước chưa đun có mùi lạ. Bạn bắt đầu đau bụng — lần sau hãy đun sôi trước khi uống.';
  }

  return {
    ok: true,
    survival: {
      ...survival,
      satiety: round1(satiety),
      hydration: round1(hydration),
      hp: round1(hp),
      sickUntilMs,
      hypothermiaUntilMs,
      heatstrokeUntilMs,
      fatiguedUntilMs,
      lastSleepMs,
    },
    gotSick,
    messageVi,
  };
}

/** Ngất: tỉnh lại ở trại, rơi 30% đồ đang mang, kho trong trại còn nguyên (§5.1). */
export function applyKnockout(survival: SurvivalState): SurvivalState {
  return {
    ...survival,
    hp: SURVIVAL.knockout.respawnHp,
    satiety: Math.max(survival.satiety, SURVIVAL.knockout.respawnSatiety),
    hydration: Math.max(survival.hydration, SURVIVAL.knockout.respawnHydration),
    asleep: false,
  };
}

/**
 * Dự phóng mức tiêu hao một ngày — dùng cho test bất biến "đi bộ luôn có lãi"
 * và cho bảng cân bằng của designer.
 */
export function projectDailyDrain(
  steps: number,
  hoursAwake = 16,
): { satiety: number; hydration: number } {
  return {
    satiety:
      SURVIVAL.satiety.decayPerHourAwake * hoursAwake +
      SURVIVAL.satiety.decayPerHourAsleep * (24 - hoursAwake) +
      (steps / 1000) * SURVIVAL.satiety.decayPer1000Steps,
    hydration:
      SURVIVAL.hydration.decayPerHourAwake * hoursAwake +
      SURVIVAL.hydration.decayPerHourAsleep * (24 - hoursAwake) +
      (steps / 1000) * SURVIVAL.hydration.decayPer1000Steps,
  };
}

/** Tính tổng trọng lượng (kg) của các vật phẩm trong túi đồ. */
export function calculateCarriedWeight(carried: Inventory): number {
  let total = 0;
  for (const [itemId, qty] of Object.entries(carried)) {
    if (qty <= 0) continue;
    const def = getItem(itemId);
    total += (def.weight ?? 1) * qty;
  }
  return round1(total);
}

/**
 * Chi phí nâng cấp Thể Lực / Sức Khỏe bằng Đồng Vàng Cổ (Cấp 1..10).
 * Mỗi cấp tăng +5kg tải trọng ba lô.
 */
export const STRENGTH_UPGRADE_COSTS: Record<number, number> = {
  1: 10,
  2: 20,
  3: 35,
  4: 50,
  5: 70,
  6: 95,
  7: 125,
  8: 160,
  9: 200,
};

export const MAX_STRENGTH_LEVEL = 10;

export function getStrengthUpgradeInfo(currentLevel = 1): { cost: number; nextCapacity: number; isMax: boolean } {
  const isMax = currentLevel >= MAX_STRENGTH_LEVEL;
  const cost = STRENGTH_UPGRADE_COSTS[currentLevel] ?? 200;
  const nextCapacity = 45 + currentLevel * 5;
  return { cost, nextCapacity, isMax };
}

/** Tải trọng tối đa của ba lô (chuẩn 45kg, +5kg mỗi cấp Thể Lực, +30kg nếu có Ba Lô Da Voi, +25kg nếu có linh thú thồ hàng). */
export function maxWeightCapacity(pets?: any[], carried?: Inventory, strengthLevel = 1): number {
  const bonusStrength = Math.max(0, strengthLevel - 1) * 5;
  let capacity = 45 + bonusStrength;
  if (carried && (carried['giant_backpack'] ?? 0) > 0) {
    capacity += 30;
  }
  const activePet = pets?.find((p) => p.isActive);
  if (activePet && (activePet.petId === 'mammoth' || activePet.petId === 'horse' || activePet.petId === 'rhino')) {
    capacity += 25;
  }
  return capacity;
}

/**
 * Nâng cấp Sức Khỏe / Thể Lực bằng Đồng Vàng Cổ (ancient_coin).
 */
export function upgradeStrength(player: PlayerState): { player: PlayerState; success: boolean; messageVi: string } {
  const currentLvl = player.strengthLevel ?? 1;
  if (currentLvl >= MAX_STRENGTH_LEVEL) {
    return { player, success: false, messageVi: 'Thể lực của bạn đã đạt đến cảnh giới tối đa (Cấp 10 - Thể Lực Kim Cương)!' };
  }

  const { cost } = getStrengthUpgradeInfo(currentLvl);
  const carriedCoin = player.carried['ancient_coin'] ?? 0;
  const safeCoin = player.safeStorage['ancient_coin'] ?? 0;
  const totalCoin = carriedCoin + safeCoin;

  if (totalCoin < cost) {
    return {
      player,
      success: false,
      messageVi: `Không đủ Đồng Vàng Cổ! Cần ${cost} Đồng Vàng để nâng lên Cấp ${currentLvl + 1} (Bạn đang có: ${totalCoin} Vàng).`,
    };
  }

  // Khấu trừ Đồng Vàng Cổ (ưu tiên trừ trong túi trước, thiếu thì trừ trong két)
  const updatedCarried = { ...player.carried };
  const updatedSafe = { ...player.safeStorage };

  if (carriedCoin >= cost) {
    updatedCarried['ancient_coin'] = carriedCoin - cost;
    if (updatedCarried['ancient_coin'] === 0) delete updatedCarried['ancient_coin'];
  } else {
    const remaining = cost - carriedCoin;
    delete updatedCarried['ancient_coin'];
    updatedSafe['ancient_coin'] = safeCoin - remaining;
    if (updatedSafe['ancient_coin'] === 0) delete updatedSafe['ancient_coin'];
  }

  const newLvl = currentLvl + 1;
  const updatedPlayer: PlayerState = {
    ...player,
    carried: updatedCarried,
    safeStorage: updatedSafe,
    strengthLevel: newLvl,
  };

  const newCap = maxWeightCapacity(updatedPlayer.pets, updatedPlayer.carried, newLvl);
  return {
    player: updatedPlayer,
    success: true,
    messageVi: `💪 Chúc mừng! Đã nâng Thể Lực lên Cấp ${newLvl}! Sức chứa ba lô tăng lên ${newCap}kg (+5kg).`,
  };
}

/** Kiểm tra túi đồ có bị quá tải trọng lượng không. */
export function isOverburdened(carried: Inventory, maxWeight = 45): boolean {
  return calculateCarriedWeight(carried) > maxWeight;
}

/**
 * Kiểm tra thức ăn tươi sống (thịt tươi, cá tươi) bị ôi thiu theo thời gian.
 * Mặc định: quá 36h bị ôi thiu.
 * Nếu có Muối Mỏ (mineral_salt): kéo dài thời gian tươi ngon lên 7 ngày (168h)!
 */
export function checkFoodSpoilage(
  carried: Inventory,
  elapsedHours: number,
): { carried: Inventory; spoiledCount: number; messageVi?: string } {
  const maxFreshHours = (carried['mineral_salt'] ?? 0) > 0 ? 168 : 36;
  if (elapsedHours < maxFreshHours) {
    return { carried, spoiledCount: 0 };
  }

  let spoiledCount = 0;
  const updated = { ...carried };

  const rawMeat = updated['raw_meat'] ?? 0;
  if (rawMeat > 0) {
    spoiledCount += rawMeat;
    delete updated['raw_meat'];
  }

  const rawFish = updated['raw_fish'] ?? 0;
  if (rawFish > 0) {
    spoiledCount += rawFish;
    delete updated['raw_fish'];
  }

  if (spoiledCount > 0) {
    updated['spoiled_meat'] = (updated['spoiled_meat'] ?? 0) + spoiledCount;
    return {
      carried: updated,
      spoiledCount,
      messageVi: `⚠️ ${spoiledCount} miếng thịt/cá tươi đã bị ôi thiu do để lâu! Có thể dùng làm phân bón luống đất.`,
    };
  }

  return { carried, spoiledCount: 0 };
}

/** Gợi ý cho HUD: chỉ số nào đang nguy hiểm nhất hoặc trạng thái bất lợi. */
export function survivalWarnings(
  survival: SurvivalState,
  carried?: Inventory,
  pets?: any[],
  nowMs?: number,
): string[] {
  const warnings: string[] = [];
  const currentTime = nowMs ?? Date.now();

  if (survival.hydration <= 15) warnings.push('Khát cháy cổ — cần nước ngay.');
  else if (survival.hydration <= 35) warnings.push('Bạn đang khát.');
  if (survival.satiety <= 15) warnings.push('Đói rã rời — cần ăn ngay.');
  else if (survival.satiety <= 35) warnings.push('Bạn đang đói.');
  if (survival.hp <= 30) warnings.push('Thể lực rất thấp — hãy về trại nghỉ.');
  if (survival.sickUntilMs !== null && currentTime < survival.sickUntilMs) {
    warnings.push('Bạn đang bị bệnh: chỉ số tụt nhanh hơn 50%.');
  }
  if (survival.hypothermiaUntilMs && currentTime < survival.hypothermiaUntilMs) {
    if (!carried || (carried['rain_fur_cloak'] ?? 0) <= 0) {
      warnings.push('❄️ Đang bị cảm lạnh do dầm mưa: Đói nhanh hơn 30%. Về trại sưởi ấm!');
    }
  }
  if (survival.heatstrokeUntilMs && currentTime < survival.heatstrokeUntilMs) {
    if (!carried || (carried['sun_hat'] ?? 0) <= 0) {
      warnings.push('☀️ Đang bị say nắng trưa hè: Khát nhanh gấp đôi. Cần uống nước!');
    }
  }
  if (survival.fatiguedUntilMs && currentTime < survival.fatiguedUntilMs) {
    warnings.push('💤 Đang bị kiệt sức do thức đêm > 36h: Giảm 30% sức đánh. Hãy về trại ngủ!');
  }

  if (carried) {
    const totalW = calculateCarriedWeight(carried);
    const maxW = maxWeightCapacity(pets, carried);
    if (totalW > maxW) {
      warnings.push(`⚖️ Ba lô quá tải (${totalW}/${maxW}kg): Đi bộ tiêu hao Đói gấp đôi!`);
    }
    const hasHerbPouch = (carried['herb_scent_pouch'] ?? 0) > 0;
    const rawCount = (carried['raw_meat'] ?? 0) + (carried['raw_fish'] ?? 0);
    if (rawCount >= 10 && !hasHerbPouch) {
      warnings.push(`🩸 Mang ${rawCount} thịt tươi: Mùi máu sẽ thu hút bầy quái đêm lúc 20:00!`);
    }
  }

  return warnings;
}

export function foodValue(inv: Inventory): number {
  let total = 0;
  for (const [itemId, qty] of Object.entries(inv)) {
    total += (getItem(itemId).satiety ?? 0) * qty;
  }
  return total;
}

export function drinkValue(inv: Inventory): number {
  let total = 0;
  for (const [itemId, qty] of Object.entries(inv)) {
    total += (getItem(itemId).hydration ?? 0) * qty;
  }
  return total;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
