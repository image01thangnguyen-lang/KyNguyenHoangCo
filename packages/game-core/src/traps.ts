/**
 * Hệ thống đặt bẫy và thu bẫy theo toạ độ địa lý thực tế.
 * 
 * - Đặt bẫy tại chính toạ độ GPS của người chơi.
 * - Bẫy nhỏ (Thỏ), vừa (Hươu), lớn (Cự Thú).
 * - Sau thời gian chờ (10-20 phút), bẫy sập và bắt được thú.
 * - Người chơi phải đi tới gần toạ độ bẫy (<= 35m) mới thu hoạch được.
 */

import { distanceMeters } from './world.ts';
import { addItems, countOf, removeItems } from './inventory.ts';
import type { ItemId, LatLon, PlacedTrap, PlayerState } from './types.ts';

export const TRAP_CONFIG = {
  rabbit_trap: {
    tier: 'small' as const,
    nameVi: 'Bẫy Thỏ (Nhỏ)',
    waitMs: 10 * 60 * 1000, // 10 phút
    catchItems: [
      { itemId: 'raw_meat' as ItemId, nameVi: 'Thịt tươi', qty: 1 },
      { itemId: 'leather' as ItemId, nameVi: 'Da thú dày', qty: 1 },
    ],
  },
  deer_trap: {
    tier: 'medium' as const,
    nameVi: 'Bẫy Hươu (Vừa)',
    waitMs: 15 * 60 * 1000, // 15 phút
    catchItems: [
      { itemId: 'raw_meat' as ItemId, nameVi: 'Thịt tươi', qty: 3 },
      { itemId: 'leather' as ItemId, nameVi: 'Da thú dày', qty: 2 },
      { itemId: 'ancient_coin' as ItemId, nameVi: 'Đồng tiền cổ', qty: 1 },
    ],
  },
  beast_trap: {
    tier: 'large' as const,
    nameVi: 'Bẫy Cự Thú (Lớn)',
    waitMs: 20 * 60 * 1000, // 20 phút
    catchItems: [
      { itemId: 'raw_meat' as ItemId, nameVi: 'Thịt tươi', qty: 6 },
      { itemId: 'leather' as ItemId, nameVi: 'Da thú dày', qty: 4 },
      { itemId: 'gold_ore' as ItemId, nameVi: 'Quặng vàng', qty: 2 },
    ],
  },
};

/** Đặt bẫy tại vị trí toạ độ địa lý hiện tại của người chơi. */
export function placeTrap(
  player: PlayerState,
  trapItemId: 'rabbit_trap' | 'deer_trap' | 'beast_trap',
  at: LatLon,
  nowMs: number,
): { ok: boolean; player: PlayerState; messageVi: string; trap?: PlacedTrap } {
  if (countOf(player.carried, trapItemId) < 1) {
    return { ok: false, player, messageVi: `Bạn không có ${trapItemId} trong túi để đặt.` };
  }

  const currentTraps = player.traps ?? [];
  const maxTraps = 5;
  const activeTraps = currentTraps.filter((t) => !t.collected);

  if (activeTraps.length >= maxTraps) {
    return { ok: false, player, messageVi: `Bạn chỉ có thể đặt tối đa ${maxTraps} bẫy cùng lúc ngoài thế giới.` };
  }

  const config = TRAP_CONFIG[trapItemId];
  const newTrap: PlacedTrap = {
    id: `trap_${nowMs}_${Math.floor(Math.random() * 1000)}`,
    trapItemId,
    nameVi: config.nameVi,
    tier: config.tier,
    lat: at.lat,
    lon: at.lon,
    placedAtMs: nowMs,
    readyAtMs: nowMs + config.waitMs,
    caughtItem: null,
    collected: false,
  };

  const carried = removeItems(player.carried, [{ itemId: trapItemId, qty: 1 }]);
  const updatedPlayer: PlayerState = {
    ...player,
    carried,
    traps: [...currentTraps, newTrap],
  };

  return {
    ok: true,
    player: updatedPlayer,
    messageVi: `Đã đặt ${config.nameVi} tại đây! Hãy quay lại thu bẫy sau khi thú sập bẫy.`,
    trap: newTrap,
  };
}

/** Cập nhật trạng thái các bẫy (kiểm tra sập bẫy). */
export function tickTraps(traps: PlacedTrap[], nowMs: number): PlacedTrap[] {
  return traps.map((trap) => {
    if (trap.collected) return trap;
    if (trap.caughtItem) return trap;

    if (nowMs >= trap.readyAtMs) {
      const config = TRAP_CONFIG[trap.trapItemId];
      // Chọn 1 phần thưởng từ danh sách
      const reward = config.catchItems[Math.floor(Math.random() * config.catchItems.length)] ?? config.catchItems[0];
      return {
        ...trap,
        caughtItem: reward,
      };
    }
    return trap;
  });
}

/** Thu hoạch bẫy khi người chơi tới gần toạ độ bẫy (<= 35 mét). */
export function collectTrap(
  player: PlayerState,
  trapId: string,
  playerAt: LatLon,
  nowMs: number,
): { ok: boolean; player: PlayerState; messageVi: string; gained?: { itemId: ItemId; nameVi: string; qty: number } } {
  const traps = tickTraps(player.traps ?? [], nowMs);
  const trap = traps.find((t) => t.id === trapId);

  if (!trap) {
    return { ok: false, player, messageVi: 'Không tìm thấy bẫy này.' };
  }
  if (trap.collected) {
    return { ok: false, player, messageVi: 'Bẫy này đã được thu hoạch trước đó.' };
  }

  const dist = distanceMeters(playerAt, { lat: trap.lat, lon: trap.lon });
  if (dist > 35) {
    return {
      ok: false,
      player,
      messageVi: `Bạn đang ở cách bẫy ${Math.round(dist)}m. Hãy lại gần trong bán kính 30m để thu bẫy!`,
    };
  }

  if (!trap.caughtItem) {
    const remainSec = Math.max(1, Math.round((trap.readyAtMs - nowMs) / 1000));
    const min = Math.floor(remainSec / 60);
    const sec = remainSec % 60;
    return {
      ok: false,
      player,
      messageVi: `Bẫy đang rình mồi... Thú chưa sập bẫy. Còn khoảng ${min}p${sec}s!`,
    };
  }

  // Thu hồi bẫy + nhận chiến lợi phẩm vào túi
  const caught = trap.caughtItem;
  let carried = addItems(player.carried, [{ itemId: caught.itemId, qty: caught.qty }]);
  // Trả lại khung bẫy vào túi
  carried = addItems(carried, [{ itemId: trap.trapItemId, qty: 1 }]);

  const updatedTraps = traps.filter((t) => t.id !== trapId);
  const updatedPlayer: PlayerState = {
    ...player,
    carried,
    traps: updatedTraps,
  };

  return {
    ok: true,
    player: updatedPlayer,
    messageVi: `🎯 Thu bẫy thành công! Nhận được ${caught.nameVi} ×${caught.qty} và thu hồi ${trap.nameVi}.`,
    gained: caught,
  };
}
