/**
 * Quy đổi bước chân thành tài nguyên (§5.2) — vòng lặp cốt lõi của game.
 *
 * Ba quy tắc không được phá:
 *  1. Bước chân LUÔN được đếm đủ và hiển thị đủ, kể cả khi vượt trần thưởng
 *     (trần 15.000 chỉ ngừng cấp thêm đồ, không xoá công sức người chơi).
 *  2. Hệ số vùng được nhân trong MIỀN BƯỚC rồi mới chia 100, để hệ số 1,2× của vùng
 *     hoang dã không bị làm tròn xuống mất.
 *  3. Mọi lượt nhặt sinh từ seed xác định = hash(playerId, ngày, chỉ số lượt) → sync
 *     lặp lại không sinh thêm đồ.
 */

import { DROP_TABLES, GATHERING, WEATHER, ZONES, findItem, getItem } from './balance.ts';
import { addItems, countOf, emptyInventory } from './inventory.ts';
import { createRng, hashSeed, pickWeighted, randomInt, rollChance } from './rng.ts';
import { dayKey } from './time.ts';
import type { Inventory, ItemId, ItemStack, PickupResult, StepLedger, ZoneId } from './types.ts';

export function createStepLedger(nowMs: number, offsetMinutes?: number): StepLedger {
  return {
    day: dayKey(nowMs, offsetMinutes),
    totalSteps: 0,
    rewardedSteps: 0,
    carrySteps: 0,
    pickupCount: 0,
  };
}

export interface SyncStepsInput {
  playerId: string;
  ledger: StepLedger;
  /** Bước mới ghi nhận từ cảm biến kể từ lần sync trước. */
  newSteps: number;
  nowMs: number;
  /** Vùng người chơi đang đứng khi mở app. Không có POI nào ⇒ 'trail' hoặc 'wilderness'. */
  zone: ZoneId;
  /** Trời đang mưa ⇒ rừng cho thêm 25% (weather.json → effects.rain.forestPickupBonus). */
  raining?: boolean;
  offsetMinutes?: number;
}

export function syncSteps(input: SyncStepsInput): { ledger: StepLedger; result: PickupResult } {
  const { playerId, newSteps, nowMs, zone, raining = false, offsetMinutes } = input;

  if (newSteps < 0) throw new Error('syncSteps: số bước mới không thể âm');

  const today = dayKey(nowMs, offsetMinutes);
  const ledger: StepLedger =
    input.ledger.day === today ? { ...input.ledger } : createStepLedger(nowMs, offsetMinutes);

  ledger.totalSteps += newSteps;

  const remainingQuota = Math.max(0, GATHERING.dailyStepRewardCap - ledger.rewardedSteps);
  const rewardableSteps = Math.min(newSteps, remainingQuota);
  const cappedSteps = newSteps - rewardableSteps;
  ledger.rewardedSteps += rewardableSteps;

  let multiplier = ZONES[zone].pickupMultiplier;
  if (raining && zone === 'forest') multiplier *= 1 + WEATHER.effects.rain.forestPickupBonus;

  const effectiveSteps = ledger.carrySteps + rewardableSteps * multiplier;
  const pickups = Math.floor(effectiveSteps / GATHERING.stepsPerPickup);
  ledger.carrySteps = round2(effectiveSteps - pickups * GATHERING.stepsPerPickup);

  let gained = emptyInventory();
  for (let i = 0; i < pickups; i++) {
    const pickupIndex = ledger.pickupCount + i;
    const rng = createRng(hashSeed(playerId, ledger.day, 'pickup', pickupIndex, zone));
    const entry = pickWeighted(rng, DROP_TABLES[zone]);
    gained = addItems(gained, [{ itemId: entry.itemId, qty: randomInt(rng, entry.min, entry.max) }]);
  }
  ledger.pickupCount += pickups;

  return {
    ledger,
    result: { pickups, gained, cappedSteps, zone },
  };
}

// ------------------------------------------------------------------ hành động chủ động tại POI

export interface GatherActionDef {
  id: string;
  nameVi: string;
  zone: ZoneId | 'any';
  minigame?: { kind: string; durationSeconds: number };
  requiresTool?: ItemId;
  requiresWithinMeters?: number;
  cooldownMinutes?: number;
  dailyLimitPerPoi?: number;
  /** Các mốc bước trong ngày mở thêm lượt ở cùng một POI, đã sắp xếp tăng dần. */
  dailyLimitBySteps?: { minSteps: number; dailyLimitPerPoi: number }[];
  consumes?: ItemStack[];
  deploy?: { readyAfterMinutes: number; expiresAfterMinutes: number };
  yield: { itemId: ItemId; min: number; max: number; chance?: number }[];
  hpCost?: number;
  satietyCost?: number;
  trades?: { give: ItemStack[]; get: ItemStack[] }[];
}

export const GATHER_ACTIONS = GATHERING.actions as unknown as GatherActionDef[];

export function findAction(id: string): GatherActionDef | undefined {
  return GATHER_ACTIONS.find((a) => a.id === id);
}

export function actionsFor(zone: ZoneId): GatherActionDef[] {
  return GATHER_ACTIONS.filter((a) => a.zone === zone || a.zone === 'any');
}

/** Hạn mức hiện tại của một hành động, tính từ tổng bước đã ghi nhận trong ngày. */
export function dailyLimitFor(action: GatherActionDef, stepsToday: number): number | undefined {
  let limit = action.dailyLimitPerPoi;
  for (const tier of action.dailyLimitBySteps ?? []) {
    if (stepsToday < tier.minSteps) break;
    limit = tier.dailyLimitPerPoi;
  }
  return limit;
}

export interface ActionContext {
  playerId: string;
  actionId: string;
  zone: ZoneId;
  poiId: string;
  nowMs: number;
  /** Số lần đã dùng action này tại POI này trong hôm nay. */
  usesToday: number;
  /** Tổng bước đã ghi nhận trong ngày, kể cả phần vượt trần lượt nhặt tự động. */
  stepsToday?: number;
  lastUsedAtMs: number | null;
  carried: Inventory;
  /** Khoảng cách tới POI (mét) — server tự tính, client không được tự khai. */
  distanceMeters?: number;
  /** Điểm minigame 0..1, quyết định sản lượng nằm ở đâu giữa min và max. */
  minigameScore?: number;
  offsetMinutes?: number;
}

export interface ActionResult {
  ok: boolean;
  reasonVi?: string;
  gained: Inventory;
  consumed: ItemStack[];
  hpCost: number;
  satietyCost: number;
  cooldownUntilMs: number | null;
  deployReadyAtMs?: number;
  deployExpiresAtMs?: number;
}

const fail = (reasonVi: string): ActionResult => ({
  ok: false,
  reasonVi,
  gained: {},
  consumed: [],
  hpCost: 0,
  satietyCost: 0,
  cooldownUntilMs: null,
});

export function performGatherAction(ctx: ActionContext, rng?: () => number): ActionResult {
  const action = findAction(ctx.actionId);
  if (!action) return fail(`Hành động không tồn tại: ${ctx.actionId}`);

  if (action.zone !== 'any' && action.zone !== ctx.zone) {
    return fail(`"${action.nameVi}" chỉ làm được ở ${ZONES[action.zone].nameVi}.`);
  }

  if (
    action.requiresWithinMeters !== undefined &&
    ctx.distanceMeters !== undefined &&
    ctx.distanceMeters > action.requiresWithinMeters
  ) {
    return fail(`Bạn cần đứng trong ${action.requiresWithinMeters} m để ${action.nameVi.toLowerCase()}.`);
  }

  if (action.requiresTool && countOf(ctx.carried, action.requiresTool) < 1) {
    return fail(`Cần có ${getItem(action.requiresTool).nameVi} để ${action.nameVi.toLowerCase()}.`);
  }

  const dailyLimit = dailyLimitFor(action, ctx.stepsToday ?? 0);
  if (dailyLimit !== undefined && ctx.usesToday >= dailyLimit) {
    return fail(`Hôm nay điểm này đã hết lượt (${dailyLimit}/ngày). Thử điểm khác nhé.`);
  }

  if (action.cooldownMinutes && ctx.lastUsedAtMs !== null) {
    const readyAt = ctx.lastUsedAtMs + action.cooldownMinutes * 60_000;
    if (ctx.nowMs < readyAt) {
      const minutesLeft = Math.ceil((readyAt - ctx.nowMs) / 60_000);
      return fail(`Còn ${minutesLeft} phút nữa mới làm lại được.`);
    }
  }

  for (const need of action.consumes ?? []) {
    if (countOf(ctx.carried, need.itemId) < need.qty) {
      return fail(`Cần ${need.qty} ${getItem(need.itemId).nameVi}.`);
    }
  }

  const roll = rng ?? createRng(hashSeed(ctx.playerId, ctx.poiId, ctx.actionId, ctx.nowMs));
  const score = clamp01(ctx.minigameScore ?? (action.minigame ? 0.5 : 1));

  let gained = emptyInventory();
  for (const entry of action.yield) {
    if (entry.chance !== undefined && !rollChance(roll, entry.chance)) continue;
    const span = entry.max - entry.min;
    // Minigame làm tốt ⇒ nghiêng về cận trên; vẫn giữ một chút ngẫu nhiên để không nhàm.
    const base = entry.min + span * score;
    const jitter = span > 0 ? (roll() - 0.5) * 0.5 : 0;
    const qty = Math.max(entry.min, Math.min(entry.max, Math.round(base + jitter)));
    gained = addItems(gained, [{ itemId: entry.itemId, qty }]);
  }

  const result: ActionResult = {
    ok: true,
    gained,
    consumed: action.consumes ?? [],
    hpCost: action.hpCost ?? 0,
    satietyCost: action.satietyCost ?? 0,
    cooldownUntilMs: action.cooldownMinutes ? ctx.nowMs + action.cooldownMinutes * 60_000 : null,
  };

  if (action.deploy) {
    result.deployReadyAtMs = ctx.nowMs + action.deploy.readyAfterMinutes * 60_000;
    result.deployExpiresAtMs = ctx.nowMs + action.deploy.expiresAfterMinutes * 60_000;
  }

  return result;
}

// ------------------------------------------------------------------ thương nhân cổ

export interface TradeOffer {
  index: number;
  give: ItemStack[];
  get: ItemStack[];
  affordable: boolean;
  labelVi: string;
}

export function merchantOffers(carried: Inventory): TradeOffer[] {
  const action = findAction('merchant_trade');
  return (action?.trades ?? []).map((trade, index) => ({
    index,
    give: trade.give,
    get: trade.get,
    affordable: trade.give.every((need) => countOf(carried, need.itemId) >= need.qty),
    labelVi: `${describe(trade.give)} → ${describe(trade.get)}`,
  }));
}

function describe(stacks: ItemStack[]): string {
  return stacks.map((s) => `${s.qty} ${findItem(s.itemId)?.nameVi ?? s.itemId}`).join(' + ');
}

/**
 * Ước lượng sản lượng một ngày để designer cân bằng nhanh (dùng trong test bất biến).
 * Trả về kho đồ trung bình kỳ vọng, không phải một lần roll.
 */
export function expectedDailyYield(steps: number, zone: ZoneId = 'trail'): Inventory {
  const rewarded = Math.min(steps, GATHERING.dailyStepRewardCap);
  const pickups = (rewarded * ZONES[zone].pickupMultiplier) / GATHERING.stepsPerPickup;
  const table = DROP_TABLES[zone];
  const totalWeight = table.reduce((sum, e) => sum + e.weight, 0);

  let expected = emptyInventory();
  for (const entry of table) {
    const share = entry.weight / totalWeight;
    const avgQty = (entry.min + entry.max) / 2;
    expected = addItems(expected, [{ itemId: entry.itemId, qty: pickups * share * avgQty }]);
  }
  return expected;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
