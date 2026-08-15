/** Thao tác kho đồ. Mọi hàm đều thuần khiết — trả về kho mới, không sửa kho truyền vào. */

import { getCampTier, getItem } from './balance.ts';
import type { Inventory, ItemId, ItemStack } from './types.ts';

export function emptyInventory(): Inventory {
  return {};
}

export function countOf(inv: Inventory | undefined | null, itemId: ItemId): number {
  return inv?.[itemId] ?? 0;
}

export function slotsUsed(inv: Inventory): number {
  let slots = 0;
  for (const [itemId, qty] of Object.entries(inv)) {
    if (qty <= 0 || itemId === 'ancient_coin') continue;
    slots += Math.ceil(qty / getItem(itemId).stack);
  }
  return slots;
}

export function addItems(inv: Inventory, gains: Inventory | ItemStack[]): Inventory {
  const next: Inventory = { ...inv };
  const entries: [ItemId, number][] = Array.isArray(gains)
    ? gains.map((s) => [s.itemId, s.qty])
    : Object.entries(gains);

  for (const [itemId, qty] of entries) {
    if (qty === 0) continue;
    next[itemId] = (next[itemId] ?? 0) + qty;
    if (next[itemId]! <= 0) delete next[itemId];
  }
  return next;
}

export function hasAll(inv: Inventory, needs: ItemStack[]): boolean {
  return needs.every((need) => countOf(inv, need.itemId) >= need.qty);
}

/** Trả về danh sách nguyên liệu còn thiếu — dùng để hiện "thiếu 4 gỗ lớn" trên UI chế tạo. */
export function missingFrom(inv: Inventory, needs: ItemStack[]): ItemStack[] {
  return needs
    .map((need) => ({ itemId: need.itemId, qty: need.qty - countOf(inv, need.itemId) }))
    .filter((s) => s.qty > 0);
}

export function removeItems(inv: Inventory, needs: ItemStack[]): Inventory {
  if (!hasAll(inv, needs)) {
    throw new Error(`Không đủ nguyên liệu: ${missingFrom(inv, needs).map((s) => `${s.itemId}×${s.qty}`).join(', ')}`);
  }
  return addItems(inv, needs.map((s) => ({ itemId: s.itemId, qty: -s.qty })));
}

export function totalWeight(inv: Inventory): number {
  let weight = 0;
  for (const [itemId, qty] of Object.entries(inv)) {
    if (qty <= 0 || itemId === 'ancient_coin') continue;
    weight += getItem(itemId).weight * qty;
  }
  return weight;
}

export function isOverCapacity(inv: Inventory, campLevel: number): boolean {
  return slotsUsed(inv) > getCampTier(campLevel).storageSlots;
}

/**
 * Ngất hoặc thua phòng thủ đêm: rơi một tỉ lệ đồ ĐANG MANG (§5.1, §5.4).
 * Vật phẩm có cờ `safe` (bản vẽ, lõi nâng cấp) không bao giờ rơi — mất bản vẽ là mất tiến độ,
 * quá nặng tay với một game dành cho gia đình.
 */
export function dropFraction(
  inv: Inventory,
  ratio: number,
): { kept: Inventory; lost: Inventory } {
  const kept: Inventory = {};
  const lost: Inventory = {};

  for (const [itemId, qty] of Object.entries(inv)) {
    if (qty <= 0) continue;
    if (getItem(itemId).safe) {
      kept[itemId] = qty;
      continue;
    }
    const lostQty = Math.floor(qty * ratio);
    if (lostQty > 0) lost[itemId] = lostQty;
    if (qty - lostQty > 0) kept[itemId] = qty - lostQty;
  }

  return { kept, lost };
}

/** Các cấp độ nâng cấp Két An Toàn Tiền Sử bằng Đồng Vàng Cổ (ancient_coin) */
export interface SafeVaultTier {
  level: number;
  nameVi: string;
  slots: number;
  upgradeCostGold: number;
}

export const SAFE_VAULT_TIERS: SafeVaultTier[] = [
  { level: 1, nameVi: 'Rương Đá Thô Sơ', slots: 6, upgradeCostGold: 0 },
  { level: 2, nameVi: 'Hòm Gỗ Bọc Sắt', slots: 12, upgradeCostGold: 25 },
  { level: 3, nameVi: 'Hầm Đá Gia Cố', slots: 18, upgradeCostGold: 60 },
  { level: 4, nameVi: 'Mật Thất Kiên Cố', slots: 24, upgradeCostGold: 120 },
  { level: 5, nameVi: 'Kim Khí Bảo Khố', slots: 32, upgradeCostGold: 250 },
  { level: 6, nameVi: 'Thần Kho Bất Diệt', slots: 42, upgradeCostGold: 500 },
];

export function getSafeCapacity(campLevel = 1, safeVaultLevel = 1): number {
  const campSlots = getCampTier(campLevel)?.safeStorageSlots ?? 6;
  const vaultTier = SAFE_VAULT_TIERS.find((t) => t.level === safeVaultLevel) ?? SAFE_VAULT_TIERS[0];
  return Math.max(campSlots, vaultTier.slots);
}

/** Nâng cấp sức chứa Két An Toàn bằng Đồng Vàng Cổ */
export function upgradeSafeVault(player: PlayerState): {
  ok: boolean;
  messageVi: string;
  player: PlayerState;
  newLevel: number;
} {
  const currentLevel = Math.max(1, player.safeVaultLevel ?? 1);
  if (currentLevel >= SAFE_VAULT_TIERS.length) {
    return {
      ok: false,
      messageVi: 'Két an toàn đã đạt Cấp Tối Thượng — Thần Kho Bất Diệt (42 ô)!',
      player,
      newLevel: currentLevel,
    };
  }

  const nextTier = SAFE_VAULT_TIERS[currentLevel];
  const cost = nextTier.upgradeCostGold;
  const currentGold = countOf(player.carried, 'ancient_coin');

  if (currentGold < cost) {
    return {
      ok: false,
      messageVi: `Chưa đủ Đồng Vàng Cổ để nâng cấp lên "${nextTier.nameVi}" (Cần ${cost} 🪙, hiện có ${currentGold} 🪙).`,
      player,
      newLevel: currentLevel,
    };
  }

  const updatedCarried = removeItems(player.carried, [{ itemId: 'ancient_coin', qty: cost }]);
  const updatedPlayer: PlayerState = {
    ...player,
    carried: updatedCarried,
    safeVaultLevel: currentLevel + 1,
  };

  return {
    ok: true,
    messageVi: `🎉 Nâng cấp Két An Toàn thành công! Đạt "${nextTier.nameVi}" (Sức chứa mở rộng: ${nextTier.slots} ô an toàn).`,
    player: updatedPlayer,
    newLevel: currentLevel + 1,
  };
}

/** Chuyển đồ từ Balo vào Két An Toàn, kiểm tra số ô sức chứa tối đa. */
export function moveToSafe(
  carried: Inventory,
  safe: Inventory,
  moves: ItemStack[],
  campLevel = 1,
  safeVaultLevel = 1,
): { carried: Inventory; safe: Inventory; ok: boolean; reasonVi?: string } {
  if (!hasAll(carried, moves)) {
    return { carried, safe, ok: false, reasonVi: 'Bạn không mang đủ số lượng đó.' };
  }

  const nextSafe = addItems(safe, moves);
  const limit = getSafeCapacity(campLevel, safeVaultLevel);
  if (slotsUsed(nextSafe) > limit) {
    return { carried, safe, ok: false, reasonVi: `Két an toàn chỉ có ${limit} ô. Hãy nâng cấp Két bằng Vàng để mở thêm ô.` };
  }

  return { carried: removeItems(carried, moves), safe: nextSafe, ok: true };
}

/** Lấy đồ từ Két An Toàn ra Balo / Túi Đang Mang. */
export function moveFromSafe(
  carried: Inventory,
  safe: Inventory,
  moves: ItemStack[],
): { carried: Inventory; safe: Inventory; ok: boolean; reasonVi?: string } {
  if (!hasAll(safe, moves)) {
    return { carried, safe, ok: false, reasonVi: 'Trong két an toàn không đủ số lượng vật phẩm đó.' };
  }

  return { carried: addItems(carried, moves), safe: removeItems(safe, moves), ok: true };
}
