/**
 * Hệ thống đặt bẫy và thu bẫy theo toạ độ địa lý thực tế.
 * 
 * - Đặt bẫy tại chính toạ độ GPS của người chơi.
 * - Bẫy Thỏ (Nhỏ), Hươu (Vừa), Cự Thú (Lớn) và Rọ Bắt Cá Tiền Sử (Dưới Nước).
 * - Sau thời gian chờ, bẫy sập và bắt được thú/cá.
 * - Người chơi đi tới gần toạ độ bẫy (<= 35m) để thu hoạch.
 */

import { distanceMeters } from './world.js';
import { addItems, countOf, removeItems } from './inventory.js';
                                                                          

                               
                
                 
                 
                  
                          
                                                              
                 
 

export const FISH_TRAP_TIERS                 = [
  {
    level: 1,
    nameVi: 'Rọ Tre Đan Thô',
    waitMs: 8 * 60 * 1000, // 8 phút
    fishQty: 2,
    upgradeCostGold: 0,
    descVi: 'Bắt 2 cá tươi',
  },
  {
    level: 2,
    nameVi: 'Lồng Lưới Bện Thừng',
    waitMs: 6 * 60 * 1000, // 6 phút
    fishQty: 4,
    upgradeCostGold: 30,
    bonusItem: { itemId: 'ancient_coin', nameVi: 'Đồng tiền cổ dưới nước', qty: 1 },
    descVi: 'Bắt 4 cá tươi + 1 Đồng Vàng Cổ',
  },
  {
    level: 3,
    nameVi: 'Rọ Đáy Sông Gia Cố',
    waitMs: 4 * 60 * 1000, // 4 phút
    fishQty: 7,
    upgradeCostGold: 75,
    bonusItem: { itemId: 'ancient_coin', nameVi: 'Đồng tiền cổ dưới nước', qty: 2 },
    descVi: 'Bắt 7 cá tươi + 2 Đồng Vàng Cổ',
  },
  {
    level: 4,
    nameVi: 'Ngư Lồng Kim Khí',
    waitMs: 2.5 * 60 * 1000, // 2.5 phút
    fishQty: 10,
    upgradeCostGold: 160,
    bonusItem: { itemId: 'gold_ore', nameVi: 'Quặng vàng đáy sông', qty: 2 },
    descVi: 'Bắt 10 cá tươi + 2 Quặng vàng',
  },
  {
    level: 5,
    nameVi: 'Long Ngư Thần Lồng',
    waitMs: 90 * 1000, // 1.5 phút (Siêu tốc)
    fishQty: 16,
    upgradeCostGold: 350,
    bonusItem: { itemId: 'upgrade_core', nameVi: 'Lõi nâng cấp cổ vật', qty: 1 },
    descVi: 'Bắt 16 cá tươi + 1 Lõi nâng cấp trại',
  },
];

export function getFishTrapTier(level = 1)               {
  const safeLvl = Math.max(1, Math.min(FISH_TRAP_TIERS.length, level));
  return FISH_TRAP_TIERS[safeLvl - 1];
}

/** Nâng cấp Lồng Bắt Cá bằng Đồng Vàng Cổ */
export function upgradeFishTrapWithGold(player             )   
              
                    
                      
                   
  {
  const currentLevel = Math.max(1, player.fishTrapLevel ?? 1);
  if (currentLevel >= FISH_TRAP_TIERS.length) {
    return {
      ok: false,
      messageVi: 'Lồng Bắt Cá đã đạt Cấp Tối Thượng — Long Ngư Thần Lồng!',
      player,
      newLevel: currentLevel,
    };
  }

  const nextTier = FISH_TRAP_TIERS[currentLevel];
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
  const updatedPlayer              = {
    ...player,
    carried: updatedCarried,
    fishTrapLevel: currentLevel + 1,
  };

  return {
    ok: true,
    messageVi: `🎉 Nâng cấp Lồng Bắt Cá thành công! Đạt "${nextTier.nameVi}" (${nextTier.descVi}).`,
    player: updatedPlayer,
    newLevel: currentLevel + 1,
  };
}

export const TRAP_CONFIG = {
  rabbit_trap: {
    tier: 'small'         ,
    nameVi: 'Bẫy Thỏ (Nhỏ)',
    waitMs: 10 * 60 * 1000,
    catchItems: [
      { itemId: 'raw_meat'          , nameVi: 'Thịt tươi', qty: 1 },
      { itemId: 'leather'          , nameVi: 'Da thú dày', qty: 1 },
    ],
  },
  deer_trap: {
    tier: 'medium'         ,
    nameVi: 'Bẫy Hươu (Vừa)',
    waitMs: 15 * 60 * 1000,
    catchItems: [
      { itemId: 'raw_meat'          , nameVi: 'Thịt tươi', qty: 3 },
      { itemId: 'leather'          , nameVi: 'Da thú dày', qty: 2 },
      { itemId: 'ancient_coin'          , nameVi: 'Đồng tiền cổ', qty: 1 },
    ],
  },
  beast_trap: {
    tier: 'large'         ,
    nameVi: 'Bẫy Cự Thú (Lớn)',
    waitMs: 20 * 60 * 1000,
    catchItems: [
      { itemId: 'raw_meat'          , nameVi: 'Thịt tươi', qty: 6 },
      { itemId: 'leather'          , nameVi: 'Da thú dày', qty: 4 },
      { itemId: 'gold_ore'          , nameVi: 'Quặng vàng', qty: 2 },
    ],
  },
  fish_trap: {
    tier: 'water'         ,
    nameVi: 'Rọ Bắt Cá Tiền Sử',
    waitMs: 8 * 60 * 1000,
    catchItems: [
      { itemId: 'raw_fish'          , nameVi: 'Cá tươi', qty: 2 },
      { itemId: 'ancient_coin'          , nameVi: 'Đồng tiền cổ dưới nước', qty: 1 },
    ],
  },
};

/** Đặt bẫy tại vị trí toạ độ địa lý hiện tại của người chơi. */
export function placeTrap(
  player             ,
  trapItemId                                                          ,
  at        ,
  nowMs        ,
)                                                                             {
  if (countOf(player.carried, trapItemId) < 1) {
    return { ok: false, player, messageVi: `Bạn không có ${trapItemId} trong túi để đặt.` };
  }

  const currentTraps = player.traps ?? [];
  const maxTraps = 6;
  const activeTraps = currentTraps.filter((t) => !t.collected);

  if (activeTraps.length >= maxTraps) {
    return { ok: false, player, messageVi: `Bạn chỉ có thể đặt tối đa ${maxTraps} bẫy cùng lúc ngoài thế giới.` };
  }

  let waitDuration = TRAP_CONFIG[trapItemId].waitMs;
  let trapName = TRAP_CONFIG[trapItemId].nameVi;

  if (trapItemId === 'fish_trap') {
    const fTier = getFishTrapTier(player.fishTrapLevel ?? 1);
    waitDuration = fTier.waitMs;
    trapName = `Rọ Cá (${fTier.nameVi})`;
  }

  const newTrap             = {
    id: `trap_${nowMs}_${Math.floor(Math.random() * 1000)}`,
    trapItemId,
    nameVi: trapName,
    tier: TRAP_CONFIG[trapItemId].tier,
    lat: at.lat,
    lon: at.lon,
    placedAtMs: nowMs,
    readyAtMs: nowMs + waitDuration,
    caughtItem: null,
    collected: false,
  };

  const carried = removeItems(player.carried, [{ itemId: trapItemId, qty: 1 }]);
  const updatedPlayer              = {
    ...player,
    carried,
    traps: [...currentTraps, newTrap],
  };

  return {
    ok: true,
    player: updatedPlayer,
    messageVi: `Đã đặt ${trapName} tại đây! Hãy quay lại thu hoạch sau khi bắt được mồi.`,
    trap: newTrap,
  };
}

/** Cập nhật trạng thái các bẫy (kiểm tra sập bẫy). */
export function tickTraps(
  traps              ,
  nowMs        ,
  playerFishTrapLevel = 1,
  hasScareChime = false,
)               {
  return traps.map((trap) => {
    if (trap.collected) return trap;

    let caughtItem = trap.caughtItem;
    let scavenged = trap.scavenged ?? false;

    if (!caughtItem && nowMs >= trap.readyAtMs) {
      if (trap.trapItemId === 'fish_trap') {
        const fTier = getFishTrapTier(playerFishTrapLevel);
        caughtItem = fTier.bonusItem && Math.random() < 0.4
          ? fTier.bonusItem
          : { itemId: 'raw_fish'          , nameVi: 'Cá tươi béo ngậy', qty: fTier.fishQty };
      } else {
        const config = TRAP_CONFIG[trap.trapItemId];
        caughtItem = config.catchItems[Math.floor(Math.random() * config.catchItems.length)] ?? config.catchItems[0];
      }
    }

    // Phạt bẫy bỏ quên: Nếu đã sập quá 24 tiếng mà chưa thu, dã thú/quạ hoang ăn vụng 50% thịt (trừ khi có Chuông Tre Đuổi Quạ)
    if (!hasScareChime && caughtItem && !scavenged && nowMs - trap.readyAtMs > 24 * 3600_000) {
      scavenged = true;
      caughtItem = {
        ...caughtItem,
        qty: Math.max(1, Math.floor(caughtItem.qty * 0.5)),
      };
    }

    return {
      ...trap,
      caughtItem,
      scavenged,
    };
  });
}

/** Thu hoạch bẫy khi người chơi tới gần toạ độ bẫy (<= 35 mét). */
export function collectTrap(
  player             ,
  trapId        ,
  playerAt        ,
  nowMs        ,
)                                                                                                                    {
  const hasChime = (player.carried['bamboo_scare_chime'] ?? 0) > 0;
  const traps = tickTraps(player.traps ?? [], nowMs, player.fishTrapLevel ?? 1, hasChime);
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
      messageVi: `Đang rình mồi... Chưa bắt được con nào. Còn khoảng ${min}p${sec}s!`,
    };
  }

  // Thu hồi bẫy + nhận chiến lợi phẩm vào túi
  const caught = trap.caughtItem;
  let carried = addItems(player.carried, [{ itemId: caught.itemId, qty: caught.qty }]);
  // Trả lại khung bẫy vào túi
  carried = addItems(carried, [{ itemId: trap.trapItemId, qty: 1 }]);

  const updatedTraps = traps.filter((t) => t.id !== trapId);
  const updatedPlayer              = {
    ...player,
    carried,
    traps: updatedTraps,
  };

  const messageVi = trap.scavenged
    ? `⚠️ Bẫy để quên quá 24h nên một phần thịt đã bị quạ/dã thú ăn vụng! Thu được ${caught.nameVi} ×${caught.qty} và thu hồi ${trap.nameVi}.`
    : `🎯 Thu bẫy thành công! Nhận được ${caught.nameVi} ×${caught.qty} và thu hồi ${trap.nameVi}.`;

  return {
    ok: true,
    player: updatedPlayer,
    messageVi,
    gained: caught,
  };
}
