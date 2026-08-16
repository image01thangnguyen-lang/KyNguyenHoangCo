/**
 * Chế tạo và nâng cấp doanh trại (§5.3).
 *
 * Craft là hành động server-authoritative có độ trễ: server trừ nguyên liệu ngay,
 * ghi mốc `readyAtMs`, và chỉ trả sản phẩm khi người chơi "thu" sau khi hết thời gian.
 * Trừ nguyên liệu trước giúp chống double-spend khi client gửi lặp yêu cầu.
 */

import {
  CAMP_TIERS,
  RECIPES,
  getCampTier,
  getDefenseStructure,
  getItem,
  getRecipe,
  recipesAvailable,
  stationsUnlockedAt,
} from './balance.ts';
import { addItems, countOf, hasAll, missingFrom, removeItems } from './inventory.ts';
import { farmPlotsForGridSize, type FarmPlot } from './farming.ts';
import type {
  CampState,
  CraftAttempt,
  DefenseStructureId,
  Inventory,
  ItemStack,
  PlayerState,
  RecipeDef,
  StationId,
} from './types.ts';

export interface ArtisanRank {
  level: number;
  titleVi: string;
  icon: string;
  requiredCrafts: number;
  nextCrafts: number | null;
  upgradeCostGold: number;
  maxConcurrentSlots: number;
  speedMultiplier: number;
  doubleOutputChance: number;
  descVi: string;
}

export const ARTISAN_RANKS: ArtisanRank[] = [
  {
    level: 1,
    titleVi: 'Thổ Dân Học Việc',
    icon: '🪵',
    requiredCrafts: 0,
    nextCrafts: 8,
    upgradeCostGold: 15,
    maxConcurrentSlots: 1,
    speedMultiplier: 1.0,
    doubleOutputChance: 0.0,
    descVi: 'Chế tác 1 món cùng lúc. Tốc độ tiêu chuẩn.',
  },
  {
    level: 2,
    titleVi: 'Thợ Thủ Công Hoang Cổ',
    icon: '⚒️',
    requiredCrafts: 8,
    nextCrafts: 25,
    upgradeCostGold: 45,
    maxConcurrentSlots: 2,
    speedMultiplier: 0.85,
    doubleOutputChance: 0.05,
    descVi: 'Chế tác 2 món cùng lúc. Nhanh hơn 15%. 5% tỉ lệ nhận x2 sản phẩm.',
  },
  {
    level: 3,
    titleVi: 'Nghệ Nhân Lành Nghề',
    icon: '🏺',
    requiredCrafts: 25,
    nextCrafts: 60,
    upgradeCostGold: 120,
    maxConcurrentSlots: 3,
    speedMultiplier: 0.7,
    doubleOutputChance: 0.12,
    descVi: 'Chế tác 3 món cùng lúc. Nhanh hơn 30%. 12% tỉ lệ nhận x2 sản phẩm.',
  },
  {
    level: 4,
    titleVi: 'Đại Sư Luyện Kim & Chế Tác',
    icon: '👑',
    requiredCrafts: 60,
    nextCrafts: null,
    upgradeCostGold: 0,
    maxConcurrentSlots: 4,
    speedMultiplier: 0.55,
    doubleOutputChance: 0.25,
    descVi: 'Chế tác 4 món cùng lúc. Nhanh hơn 45%. 25% tỉ lệ nhận x2 sản phẩm.',
  },
];

export function getArtisanRank(craftCount = 0, explicitLevel = 1): ArtisanRank & {
  currentCrafts: number;
  progressPercent: number;
  neededForNext: number;
} {
  let rankByCrafts = ARTISAN_RANKS[0];
  for (let i = ARTISAN_RANKS.length - 1; i >= 0; i--) {
    if (craftCount >= ARTISAN_RANKS[i].requiredCrafts) {
      rankByCrafts = ARTISAN_RANKS[i];
      break;
    }
  }

  const effectiveLevel = Math.max(explicitLevel, rankByCrafts.level);
  const rank = ARTISAN_RANKS[effectiveLevel - 1] ?? ARTISAN_RANKS[0];

  let progressPercent = 100;
  let neededForNext = 0;

  if (rank.nextCrafts !== null) {
    const prev = rank.requiredCrafts;
    const next = rank.nextCrafts;
    const current = Math.max(0, craftCount - prev);
    const total = next - prev;
    progressPercent = Math.min(100, Math.round((current / total) * 100));
    neededForNext = Math.max(0, next - craftCount);
  }

  return {
    ...rank,
    currentCrafts: craftCount,
    progressPercent,
    neededForNext,
  };
}

export interface ArtisanUpgradeResult {
  ok: boolean;
  messageVi: string;
  player: PlayerState;
  newLevel: number;
}

export function upgradeArtisanRankWithGold(player: PlayerState): ArtisanUpgradeResult {
  const currentLevel = player.artisanLevel ?? 1;
  if (currentLevel >= 4) {
    return {
      ok: false,
      messageVi: 'Bạn đã đạt Cấp Bậc Tối Thượng — Đại Sư Luyện Kim & Chế Tác!',
      player,
      newLevel: currentLevel,
    };
  }

  const currentRank = ARTISAN_RANKS[currentLevel - 1];
  const nextRank = ARTISAN_RANKS[currentLevel];
  const costGold = currentRank.upgradeCostGold;

  const currentGold = countOf(player.carried, 'ancient_coin');
  if (currentGold < costGold) {
    return {
      ok: false,
      messageVi: `Chưa đủ Đồng Vàng Cổ để tấn phong lên "${nextRank.titleVi}" (Cần ${costGold} 🪙, hiện có ${currentGold} 🪙).`,
      player,
      newLevel: currentLevel,
    };
  }

  const updatedCarried = removeItems(player.carried, [{ itemId: 'ancient_coin', qty: costGold }]);
  const updatedPlayer: PlayerState = {
    ...player,
    carried: updatedCarried,
    artisanLevel: currentLevel + 1,
  };

  return {
    ok: true,
    messageVi: `🎉 Tấn phong thành công! Bạn đã trở thành ${nextRank.titleVi} (${nextRank.maxConcurrentSlots} ô chế tạo, +${Math.round((1 - nextRank.speedMultiplier) * 100)}% tốc độ).`,
    player: updatedPlayer,
    newLevel: currentLevel + 1,
  };
}

export function createCampState(nowMs: number, homeCell: string | null = null): CampState {
  return {
    level: 1,
    stations: [],
    defenseStructures: {},
    upgradeCompleteAtMs: null,
    homeCell,
  };
}

export interface CraftContext {
  recipeId: string;
  camp: CampState;
  inventory: Inventory;
  nowMs: number;
  /** Người chơi phải ở trại mới dùng được công trình chế tạo (lửa trại, lò nung, lò rèn). */
  atCamp: boolean;
  knownRecipes?: string[];
  currentCraftJobsCount?: number;
  totalCraftCount?: number;
  artisanLevel?: number;
}

/** Kiểm tra + trừ nguyên liệu. KHÔNG cộng sản phẩm — sản phẩm trả ở `collectCraft`. */
export function startCraft(ctx: CraftContext): CraftAttempt & { inventory: Inventory } {
  const recipe = getRecipe(ctx.recipeId);

  if (recipe.tier > ctx.camp.level) {
    return {
      ok: false,
      reasonVi: `${recipe.nameVi} cần doanh trại cấp ${recipe.tier} (${getCampTier(recipe.tier).nameVi}).`,
      inventory: ctx.inventory,
    };
  }

  if (recipe.station) {
    if (!ctx.camp.stations.includes(recipe.station)) {
      return {
        ok: false,
        reasonVi: `Cần xây ${stationName(recipe.station)} trước.`,
        inventory: ctx.inventory,
      };
    }
    if (!ctx.atCamp) {
      return {
        ok: false,
        reasonVi: `${stationName(recipe.station)} nằm ở trại — hãy về trại để chế tạo.`,
        inventory: ctx.inventory,
      };
    }
  }

  if (recipe.outputKind === 'station' && ctx.camp.stations.includes(recipe.outputId as StationId)) {
    return { ok: false, reasonVi: `${recipe.nameVi} đã được xây rồi.`, inventory: ctx.inventory };
  }

  if (recipe.outputKind === 'defense') {
    const structureId = recipe.outputId as DefenseStructureId;
    const def = getDefenseStructure(structureId);
    const current = ctx.camp.defenseStructures[structureId] ?? 0;
    if (current >= def.maxCount) {
      return {
        ok: false,
        reasonVi: `Tối đa ${def.maxCount} ${def.nameVi}.`,
        inventory: ctx.inventory,
      };
    }
    const totalStructures = totalDefenseCount(ctx.camp);
    const limit = getCampTier(ctx.camp.level).maxDefenseStructures;
    if (totalStructures >= limit) {
      return {
        ok: false,
        reasonVi: `Trại cấp ${ctx.camp.level} chỉ chứa ${limit} công trình phòng thủ. Nâng cấp trại để xây thêm.`,
        inventory: ctx.inventory,
      };
    }
  }

  if (ctx.knownRecipes && !ctx.knownRecipes.includes(recipe.id) && requiresBlueprint(recipe)) {
    return {
      ok: false,
      reasonVi: `Bạn chưa có bản vẽ của ${recipe.nameVi}. Đổi bản vẽ ở tàn tích thương nhân cổ.`,
      inventory: ctx.inventory,
    };
  }

  if (!hasAll(ctx.inventory, recipe.inputs)) {
    const missing = missingFrom(ctx.inventory, recipe.inputs)
      .map((s) => `${s.qty} ${getItem(s.itemId).nameVi}`)
      .join(', ');
    return { ok: false, reasonVi: `Còn thiếu: ${missing}.`, inventory: ctx.inventory };
  }

  // Kiểm tra giới hạn số ô chế tạo cùng lúc theo Cấp Bậc Thợ
  const rank = getArtisanRank(ctx.totalCraftCount ?? 0, ctx.artisanLevel ?? 1);
  if (ctx.currentCraftJobsCount !== undefined && ctx.currentCraftJobsCount >= rank.maxConcurrentSlots) {
    const nextRank = rank.nextCrafts ? ARTISAN_RANKS[rank.level] : null;
    return {
      ok: false,
      reasonVi: `Hàng đợi chế tác đã đầy (${ctx.currentCraftJobsCount}/${rank.maxConcurrentSlots} ô). Cần nâng cấp lên "${nextRank ? nextRank.titleVi : 'Cấp tối đa'}" hoặc đợi món đang làm xong!`,
      inventory: ctx.inventory,
    };
  }

  // Áp dụng tốc độ chế tác rút ngắn theo cấp bậc thợ
  const durationSeconds = Math.max(1, Math.round(recipe.seconds * rank.speedMultiplier));

  return {
    ok: true,
    consumed: recipe.inputs,
    produced: { kind: recipe.outputKind, id: recipe.outputId, qty: recipe.outputQty },
    readyAtMs: ctx.nowMs + durationSeconds * 1000,
    inventory: removeItems(ctx.inventory, recipe.inputs),
  };
}

export interface CollectResult {
  ok: boolean;
  reasonVi?: string;
  inventory: Inventory;
  camp: CampState;
  messageVi?: string;
  isDoubleBonus?: boolean;
}

/** Thu sản phẩm sau khi hết thời gian chế tạo. */
export function collectCraft(
  recipeId: string,
  readyAtMs: number,
  nowMs: number,
  inventory: Inventory,
  camp: CampState,
  totalCraftCount = 0,
  artisanLevel = 1,
): CollectResult {
  if (nowMs < readyAtMs) {
    const secondsLeft = Math.ceil((readyAtMs - nowMs) / 1000);
    return { ok: false, reasonVi: `Còn ${secondsLeft} giây nữa mới xong.`, inventory, camp };
  }

  const recipe = getRecipe(recipeId);
  const rank = getArtisanRank(totalCraftCount, artisanLevel);
  const isDouble = Math.random() < rank.doubleOutputChance;
  const finalQty = isDouble ? recipe.outputQty * 2 : recipe.outputQty;

  if (recipe.outputKind === 'item') {
    const doubleMsg = isDouble ? ` ✨ [Đại Sư ${rank.titleVi}] Bạn may mắn nhận x2 sản phẩm (${finalQty} món)!` : '';
    return {
      ok: true,
      inventory: addItems(inventory, [{ itemId: recipe.outputId, qty: finalQty }]),
      camp,
      messageVi: `Đã chế tạo ${finalQty} ${recipe.nameVi}.${doubleMsg}`,
      isDoubleBonus: isDouble,
    };
  }

  if (recipe.outputKind === 'station') {
    const stationId = recipe.outputId as StationId;
    if (camp.stations.includes(stationId)) {
      return { ok: false, reasonVi: `${recipe.nameVi} đã có ở trại.`, inventory, camp };
    }
    return {
      ok: true,
      inventory,
      camp: { ...camp, stations: [...camp.stations, stationId] },
      messageVi: `${recipe.nameVi} đã sẵn sàng ở trại.`,
    };
  }

  const structureId = recipe.outputId as DefenseStructureId;
  return {
    ok: true,
    inventory,
    camp: {
      ...camp,
      defenseStructures: {
        ...camp.defenseStructures,
        [structureId]: (camp.defenseStructures[structureId] ?? 0) + recipe.outputQty,
      },
    },
    messageVi: `${recipe.nameVi} đã dựng xong quanh trại.`,
  };
}

/** Công thức cấp 3 dùng lò rèn cần bản vẽ — tạo lý do để ghé thương nhân cổ. */
function requiresBlueprint(recipe: RecipeDef): boolean {
  return recipe.tier === 3 && recipe.station === 'forge';
}

function stationName(id: StationId): string {
  return (
    RECIPES.find((r) => r.outputKind === 'station' && r.outputId === id)?.nameVi ?? String(id)
  );
}

export function totalDefenseCount(camp: CampState): number {
  return Object.values(camp.defenseStructures).reduce((sum, n) => sum + (n ?? 0), 0);
}

// ------------------------------------------------------------------ nâng cấp doanh trại

export interface UpgradeAttempt {
  ok: boolean;
  reasonVi?: string;
  inventory: Inventory;
  camp: CampState;
  completeAtMs?: number;
}

export function startCampUpgrade(
  camp: CampState,
  inventory: Inventory,
  nowMs: number,
): UpgradeAttempt {
  if (camp.upgradeCompleteAtMs !== null) {
    return { ok: false, reasonVi: 'Trại đang trong quá trình nâng cấp.', inventory, camp };
  }

  const tier = getCampTier(camp.level);
  if (!tier.upgradeToNext) {
    return { ok: false, reasonVi: `${tier.nameVi} đã là cấp cao nhất hiện có.`, inventory, camp };
  }

  if (!hasAll(inventory, tier.upgradeToNext.inputs)) {
    const missing = missingFrom(inventory, tier.upgradeToNext.inputs)
      .map((s) => `${s.qty} ${getItem(s.itemId).nameVi}`)
      .join(', ');
    return { ok: false, reasonVi: `Còn thiếu: ${missing}.`, inventory, camp };
  }

  const completeAtMs = nowMs + tier.upgradeToNext.seconds * 1000;
  return {
    ok: true,
    inventory: removeItems(inventory, tier.upgradeToNext.inputs),
    camp: { ...camp, upgradeCompleteAtMs: completeAtMs },
    completeAtMs,
  };
}

export function finishCampUpgrade(camp: CampState, nowMs: number): { camp: CampState; upgraded: boolean; messageVi?: string } {
  if (camp.upgradeCompleteAtMs === null || nowMs < camp.upgradeCompleteAtMs) {
    return { camp, upgraded: false };
  }

  const nextLevel = (camp.level + 1) as 1 | 2 | 3;
  const nextTier = getCampTier(nextLevel);
  const stations = Array.from(new Set([...camp.stations]));

  return {
    camp: { ...camp, level: nextLevel, stations, upgradeCompleteAtMs: null },
    upgraded: true,
    messageVi: `Doanh trại đã thành ${nextTier.nameVi}. Mở khoá: ${nextTier.unlocksStations.map(stationName).join(', ') || 'công thức cấp ' + nextLevel}.`,
  };
}

/** Danh sách công thức hiển thị trên UI, kèm trạng thái đủ/thiếu nguyên liệu. */
export interface RecipeView {
  recipe: RecipeDef;
  craftable: boolean;
  missing: ItemStack[];
  locked: boolean;
  lockReasonVi?: string;
}

export function recipeBoard(camp: CampState, inventory: Inventory, knownRecipes: string[] = []): RecipeView[] {
  const unlockedStations = stationsUnlockedAt(camp.level);

  return RECIPES.map((recipe) => {
    const missing = missingFrom(inventory, recipe.inputs);
    let locked = false;
    let lockReasonVi: string | undefined;

    if (recipe.tier > camp.level) {
      locked = true;
      lockReasonVi = `Cần doanh trại cấp ${recipe.tier}`;
    } else if (recipe.station && !camp.stations.includes(recipe.station)) {
      locked = true;
      lockReasonVi = unlockedStations.includes(recipe.station)
        ? `Cần xây ${stationName(recipe.station)}`
        : `Cần doanh trại cấp cao hơn để xây ${stationName(recipe.station)}`;
    } else if (requiresBlueprint(recipe) && !knownRecipes.includes(recipe.id)) {
      locked = true;
      lockReasonVi = 'Cần bản vẽ từ thương nhân cổ';
    }

    return { recipe, craftable: !locked && missing.length === 0, missing, locked, lockReasonVi };
  });
}

/** Tiến độ tới lần nâng cấp kế tiếp — hiển thị trên màn hình trại. */
export function upgradeProgress(
  camp: CampState,
  inventory: Inventory,
): { ratio: number; needs: (ItemStack & { have: number })[] } | null {
  const tier = getCampTier(camp.level);
  if (!tier.upgradeToNext) return null;

  const needs = tier.upgradeToNext.inputs.map((input) => ({
    ...input,
    have: Math.min(countOf(inventory, input.itemId), input.qty),
  }));

  const totalNeeded = needs.reduce((sum, n) => sum + n.qty, 0);
  const totalHave = needs.reduce((sum, n) => sum + n.have, 0);
  return { ratio: totalNeeded > 0 ? totalHave / totalNeeded : 1, needs };
}

export { recipesAvailable, CAMP_TIERS };

/**
 * Chi phí Di Dời Doanh Trại:
 * 1. Phương thức 'materials': Dùng 15 Gỗ lớn, 10 Khối đá, 5 Dây bện + 20 Đồng Vàng Cổ.
 * 2. Phương thức 'gold': Thuê Thương Nhân Caravan vận chuyển trọn gói bằng 50 Đồng Vàng Cổ.
 */
export const RELOCATE_CAMP_COST_MATERIALS: ItemStack[] = [
  { itemId: 'log', qty: 15 },
  { itemId: 'stone_block', qty: 10 },
  { itemId: 'rope', qty: 5 },
  { itemId: 'ancient_coin', qty: 20 },
];

export const RELOCATE_CAMP_COST_GOLD: ItemStack[] = [
  { itemId: 'ancient_coin', qty: 50 },
];

export interface RelocateCampResult {
  ok: boolean;
  messageVi: string;
  player: PlayerState;
  newHomeCell?: string;
}

export function relocateCamp(
  player: PlayerState,
  newCellId: string,
  method: 'materials' | 'gold' = 'materials',
  exactLat?: number,
  exactLon?: number,
): RelocateCampResult {
  if (player.camp.homeCell === newCellId && (!exactLat || player.camp.exactLat === exactLat)) {
    return {
      ok: false,
      messageVi: 'Vị trí mới trùng với vị trí Doanh Trại hiện tại.',
      player,
    };
  }

  const cost = method === 'gold' ? RELOCATE_CAMP_COST_GOLD : RELOCATE_CAMP_COST_MATERIALS;

  // Kiểm tra tài nguyên trong carried
  if (!hasAll(player.carried, cost)) {
    const missing = missingFrom(player.carried, cost);
    return {
      ok: false,
      messageVi: `Không đủ tài nguyên di dời trại: thiếu ${missing.map((m) => `${m.itemId} × ${m.qty}`).join(', ')}.`,
      player,
    };
  }

  const updatedCarried = removeItems(player.carried, cost);
  const updatedPlayer: PlayerState = {
    ...player,
    carried: updatedCarried,
    camp: {
      ...player.camp,
      homeCell: newCellId,
      exactLat,
      exactLon,
    },
  };

  return {
    ok: true,
    messageVi: `🏕️ Di dời Doanh Trại thành công! Toàn bộ cơ sở vật chất, két an toàn và nông trại đã được chuyển đến vùng đất mới.`,
    player: updatedPlayer,
    newHomeCell: newCellId,
  };
}

// ============================================================================
// HỆ THỐNG MỞ RỘNG DIỆN TÍCH DOANH TRẠI BẰNG VÀNG (SQUARE GRID EXPANSION)
// ============================================================================

export interface CampExpansionInfo {
  currentGridSize: number;
  currentTiles: number;
  nextGridSize: number;
  nextTiles: number;
  costGold: number;
  currentMaxPlots: number;
  nextMaxPlots: number;
  isMax: boolean;
}

export function getCampExpansionInfo(camp: CampState): CampExpansionInfo {
  const currentGridSize = camp.gridSize ?? 3;
  const isMax = currentGridSize >= 7;
  const nextGridSize = isMax ? currentGridSize : currentGridSize + 1;

  // Chi phí mở rộng theo bậc diện tích:
  // 3x3 (9 ô) -> 4x4 (16 ô): 50 vàng
  // 4x4 (16 ô) -> 5x5 (25 ô): 120 vàng
  // 5x5 (25 ô) -> 6x6 (36 ô): 250 vàng
  // 6x6 (36 ô) -> 7x7 (49 ô): 450 vàng
  const costs: Record<number, number> = { 3: 50, 4: 120, 5: 250, 6: 450 };
  const costGold = costs[currentGridSize] ?? 500;

  return {
    currentGridSize,
    currentTiles: currentGridSize * currentGridSize,
    nextGridSize,
    nextTiles: nextGridSize * nextGridSize,
    costGold,
    currentMaxPlots: farmPlotsForGridSize(currentGridSize),
    nextMaxPlots: farmPlotsForGridSize(nextGridSize),
    isMax,
  };
}

export function expandCampTerritory(
  camp: CampState,
  player: PlayerState,
  nowMs: number,
): { camp: CampState; player: PlayerState; success: boolean; messageVi: string } {
  const info = getCampExpansionInfo(camp);
  if (info.isMax) {
    return { camp, player, success: false, messageVi: 'Lãnh thổ doanh trại đã đạt diện tích tối đại (7x7 = 49 ô vuông)!' };
  }

  const currentGold = countOf(player.carried, 'ancient_coin');
  if (currentGold < info.costGold) {
    return {
      camp,
      player,
      success: false,
      messageVi: `Không đủ Đồng Vàng Cổ! Cần ${info.costGold} 🪙 (Hiện có: ${currentGold} 🪙).`,
    };
  }

  // Trừ vàng cổ
  const updatedCarried = removeItems(player.carried, [{ itemId: 'ancient_coin', qty: info.costGold }]);

  // Cập nhật gridSize mới
  const nextGridSize = info.nextGridSize;
  const nextCamp: CampState = {
    ...camp,
    gridSize: nextGridSize,
  };

  // Mở thêm các luống đất trồng tương ứng diện tích mới
  const targetPlots = farmPlotsForGridSize(nextGridSize);
  const existingPlots = (camp.farmPlots ?? []) as FarmPlot[];
  const nextPlots: FarmPlot[] = [...existingPlots];
  while (nextPlots.length < targetPlots) {
    nextPlots.push({
      index: nextPlots.length,
      cropId: null,
      plantedAtMs: null,
      waterLevel: 1,
      lastWateredMs: null,
      readyToHarvest: false,
      wilted: false,
      fertilized: false,
    });
  }
  nextCamp.farmPlots = nextPlots;

  const updatedPlayer: PlayerState = {
    ...player,
    carried: updatedCarried,
    camp: nextCamp,
  };

  return {
    camp: nextCamp,
    player: updatedPlayer,
    success: true,
    messageVi: `👑 Mở rộng diện tích Doanh Trại thành công lên ${nextGridSize}x${nextGridSize} (${nextGridSize * nextGridSize} ô vuông)! Mở thêm ${targetPlots - existingPlots.length} luống đất trồng và không gian xây dựng.`,
  };
}


