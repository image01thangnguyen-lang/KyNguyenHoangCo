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

  let { satiety, hydration, hp, sickUntilMs } = state;
  const asleep = state.asleep;
  const hpBefore = hp;
  let knockedOut = false;

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

    const satietyWeather = options.satietyDecayMultiplier ?? 1;
    const hydrationWeather = options.hydrationDecayMultiplier ?? 1;

    satiety -= satietyRate * hoursFraction * sickMul * satietyWeather;
    satiety -= (stepsPerSubTick / 1000) * SURVIVAL.satiety.decayPer1000Steps;
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

  if (cappedByOfflineLimit) {
    // Người chơi vắng nhiều ngày: đóng băng ở mức sàn thay vì để chết ngay lúc mở app.
    //
    // Sàn này cũng HUỶ luôn trạng thái ngất. Đi công tác một tuần rồi mở app ra là mất 30%
    // đồ đang mang thì đó là trừng phạt người chơi vì có cuộc sống ngoài game — đúng thứ mà
    // trụ cột thiết kế không cho phép. Ngất vẫn xảy ra bình thường với quãng vắng dưới 24 giờ.
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
    // Luôn nhảy tới nowMs, kể cả khi bị cắt bởi trần 24h — nếu không sẽ mô phỏng lại
    // cùng khoảng thời gian ở lần sync sau.
    lastTickMs: nowMs,
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

  let { satiety, hydration, hp, sickUntilMs } = survival;
  satiety = clamp(satiety + (item.satiety ?? 0), 0, SURVIVAL.satiety.max);
  hydration = clamp(hydration + (item.hydration ?? 0), 0, SURVIVAL.hydration.max);
  hp = clamp(hp + (item.hp ?? 0), 0, SURVIVAL.hp.max);

  if (item.curesSickness) sickUntilMs = null;

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
    survival: { ...survival, satiety: round1(satiety), hydration: round1(hydration), hp: round1(hp), sickUntilMs },
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

/** Gợi ý cho HUD: chỉ số nào đang nguy hiểm nhất. */
export function survivalWarnings(survival: SurvivalState): string[] {
  const warnings: string[] = [];
  if (survival.hydration <= 15) warnings.push('Khát cháy cổ — cần nước ngay.');
  else if (survival.hydration <= 35) warnings.push('Bạn đang khát.');
  if (survival.satiety <= 15) warnings.push('Đói rã rời — cần ăn ngay.');
  else if (survival.satiety <= 35) warnings.push('Bạn đang đói.');
  if (survival.hp <= 30) warnings.push('Thể lực rất thấp — hãy về trại nghỉ.');
  if (survival.sickUntilMs !== null) warnings.push('Bạn đang bị bệnh: chỉ số tụt nhanh hơn 50%.');
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
