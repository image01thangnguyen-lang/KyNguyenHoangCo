/** Thao tác kho đồ. Mọi hàm đều thuần khiết — trả về kho mới, không sửa kho truyền vào. */

import { getCampTier, getItem } from './balance.ts';
import type { Inventory, ItemId, ItemStack } from './types.ts';

export function emptyInventory(): Inventory {
  return {};
}

export function countOf(inv: Inventory, itemId: ItemId): number {
  return inv[itemId] ?? 0;
}

export function slotsUsed(inv: Inventory): number {
  let slots = 0;
  for (const [itemId, qty] of Object.entries(inv)) {
    if (qty <= 0) continue;
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

/** Chuyển đồ giữa balo và két an toàn, có kiểm tra số ô của két theo cấp trại. */
export function moveToSafe(
  carried: Inventory,
  safe: Inventory,
  moves: ItemStack[],
  campLevel: number,
): { carried: Inventory; safe: Inventory; ok: boolean; reasonVi?: string } {
  if (!hasAll(carried, moves)) {
    return { carried, safe, ok: false, reasonVi: 'Bạn không mang đủ số lượng đó.' };
  }

  const nextSafe = addItems(safe, moves);
  const limit = getCampTier(campLevel).safeStorageSlots;
  if (slotsUsed(nextSafe) > limit) {
    return { carried, safe, ok: false, reasonVi: `Két an toàn chỉ có ${limit} ô. Nâng cấp trại để mở thêm.` };
  }

  return { carried: removeItems(carried, moves), safe: nextSafe, ok: true };
}
