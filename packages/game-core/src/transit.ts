/**
 * Hệ thống Đa Phương Thức Di Chuyển & Du Hành Viễn Chinh (§v2.1).
 *
 * Dành cho người chơi di chuyển bằng phương tiện công cộng (Xe buýt, Metro, Ô tô, ngồi sau Xe máy)
 * với vận tốc từ 15 km/h đến 80 km/h:
 *  1. LINH ĐIỂU THU THẬP THỤ ĐỘNG (Passive Scavenging): Tự động gom tài nguyên đại trà theo từng km.
 *  2. TIỀN ĐỒN TRẠM DỪNG (Bus Stop Outposts): Nhận rương tiếp tế khi xe dừng đón trả khách.
 *  3. MỞ SƯƠNG MÙ BẢN ĐỒ (Fog of War Cartography): Quét sáng bản đồ theo lộ trình xe buýt.
 *  4. ĐIỂM VIỄN CHINH (Transit Points): Đổi skin và bản vẽ độc quyền.
 */

import type { Inventory, ItemId, ItemStack, PlayerTransitState } from './types.ts';
import { cellAt } from './world.ts';

export interface TransitConfig {
  minSpeedKmh: number;
  maxSpeedKmh: number;
  metersPerScavenge: number;
  tier1Meters: number; // 0 - 10km: 100%
  tier2Meters: number; // 10 - 25km: 50% + Điểm Viễn Chinh
}

export const TRANSIT_CONFIG: TransitConfig = {
  minSpeedKmh: 12.0,
  maxSpeedKmh: 85.0,
  metersPerScavenge: 1000,
  tier1Meters: 10_000,
  tier2Meters: 25_000,
};

export function createTransitState(): PlayerTransitState {
  return {
    todayTransitMeters: 0,
    lifetimeTransitMeters: 0,
    transitPoints: 0,
    visitedOutpostsToday: [],
    revealedCellIds: [],
    lastTransitMs: 0,
  };
}

export interface TransitScavengeDrop {
  itemId: ItemId;
  nameVi: string;
  qty: number;
}

export interface TransitMovementResult {
  nextTransit: PlayerTransitState;
  nextCarried: Inventory;
  dropsGained: TransitScavengeDrop[];
  pointsGained: number;
  scavengeCount: number;
  revealedCellsCount: number;
  eventsVi: string[];
}

/** Danh mục tài nguyên rơi thụ động khi đi xe (tài nguyên đại trà) */
const TRANSIT_DROP_POOL: { itemId: ItemId; nameVi: string; min: number; max: number; weight: number }[] = [
  { itemId: 'dry_branch', nameVi: 'Cành khô', min: 1, max: 3, weight: 35 },
  { itemId: 'sharp_stone', nameVi: 'Đá nhọn', min: 1, max: 2, weight: 25 },
  { itemId: 'clay', nameVi: 'Đất sét', min: 1, max: 2, weight: 15 },
  { itemId: 'wild_berry', nameVi: 'Quả dại', min: 1, max: 2, weight: 15 },
  { itemId: 'fiber', nameVi: 'Sợi thực vật', min: 1, max: 2, weight: 10 },
];

/**
 * Xử lý khi người chơi di chuyển bằng phương tiện với tốc độ cao (15 - 80 km/h).
 */
export function processTransitMovement(
  transit: PlayerTransitState | undefined,
  carried: Inventory,
  distanceMeters: number,
  speedKmh: number,
  playerLat?: number,
  playerLon?: number,
): TransitMovementResult {
  const currentTransit: PlayerTransitState = transit ? { ...transit } : createTransitState();
  const nextCarried: Inventory = { ...carried };
  const dropsGained: TransitScavengeDrop[] = [];
  const eventsVi: string[] = [];
  let pointsGained = 0;
  let scavengeCount = 0;

  if (distanceMeters <= 0 || speedKmh < TRANSIT_CONFIG.minSpeedKmh) {
    return {
      nextTransit: currentTransit,
      nextCarried,
      dropsGained,
      pointsGained: 0,
      scavengeCount: 0,
      revealedCellsCount: 0,
      eventsVi,
    };
  }

  const prevToday = currentTransit.todayTransitMeters;
  const newToday = prevToday + distanceMeters;
  currentTransit.todayTransitMeters = newToday;
  currentTransit.lifetimeTransitMeters += distanceMeters;

  // Tính toán số mốc 1.0 km (1000m) vượt qua trong lần di chuyển này
  const prevKm = Math.floor(prevToday / TRANSIT_CONFIG.metersPerScavenge);
  const newKm = Math.floor(newToday / TRANSIT_CONFIG.metersPerScavenge);
  scavengeCount = Math.max(0, newKm - prevKm);

  if (scavengeCount > 0 && speedKmh <= TRANSIT_CONFIG.maxSpeedKmh) {
    for (let i = 0; i < scavengeCount; i++) {
      const currentKmTraveled = prevKm + i + 1;
      const currentDistance = currentKmTraveled * TRANSIT_CONFIG.metersPerScavenge;

      // Phân cấp Diminishing Returns:
      if (currentDistance <= TRANSIT_CONFIG.tier1Meters) {
        // Giai đoạn 1: 0 - 10km (100% sản lượng tài nguyên)
        const drop = pickRandomTransitDrop();
        nextCarried[drop.itemId] = (nextCarried[drop.itemId] || 0) + drop.qty;
        dropsGained.push(drop);
      } else if (currentDistance <= TRANSIT_CONFIG.tier2Meters) {
        // Giai đoạn 2: 10 - 25km (50% sản lượng + Điểm Viễn Chinh)
        pointsGained += 15;
        if (Math.random() < 0.5) {
          const drop = pickRandomTransitDrop();
          nextCarried[drop.itemId] = (nextCarried[drop.itemId] || 0) + drop.qty;
          dropsGained.push(drop);
        }
      } else {
        // Giai đoạn 3: > 25km (Chỉ tích lũy Điểm Viễn Chinh biểu trưng, không rơi tài nguyên thô)
        pointsGained += 5;
      }
    }

    if (dropsGained.length > 0) {
      const summary = dropsGained.map((d) => `+${d.qty} ${d.nameVi}`).join(', ');
      eventsVi.push(`🦅 Linh Điểu gom được dọc đường: ${summary}!`);
    }
    if (pointsGained > 0) {
      currentTransit.transitPoints += pointsGained;
      eventsVi.push(`✨ +${pointsGained} Điểm Viễn Chinh (Du hành đường dài)!`);
    }
  }

  // Mở sương mù bản đồ (Fog of War)
  let revealedCellsCount = 0;
  if (playerLat !== undefined && playerLon !== undefined) {
    const cell = cellAt(playerLat, playerLon);
    if (!currentTransit.revealedCellIds) currentTransit.revealedCellIds = [];
    if (!currentTransit.revealedCellIds.includes(cell.id)) {
      currentTransit.revealedCellIds.push(cell.id);
      revealedCellsCount++;
      if (currentTransit.revealedCellIds.length % 5 === 0) {
        eventsVi.push(`🗺️ Đã mở sáng ${currentTransit.revealedCellIds.length} ô Cổ Đồ trên toàn thành phố!`);
      }
    }
  }

  return {
    nextTransit: currentTransit,
    nextCarried,
    dropsGained,
    pointsGained,
    scavengeCount,
    revealedCellsCount,
    eventsVi,
  };
}

function pickRandomTransitDrop(): TransitScavengeDrop {
  const totalWeight = TRANSIT_DROP_POOL.reduce((s, p) => s + p.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const entry of TRANSIT_DROP_POOL) {
    if (roll < entry.weight) {
      const qty = Math.floor(entry.min + Math.random() * (entry.max - entry.min + 1));
      return { itemId: entry.itemId, nameVi: entry.nameVi, qty };
    }
    roll -= entry.weight;
  }

  return { itemId: 'dry_branch', nameVi: 'Cành khô', qty: 2 };
}

// ---------------------------------------------------------------- TIỀN ĐỒN TRẠM DỪNG (BUS STOPS)

export interface OutpostCollectResult {
  ok: boolean;
  messageVi: string;
  nextTransit: PlayerTransitState;
  nextCarried: Inventory;
  rewards: ItemStack[];
}

/**
 * Kiểm tra xem người chơi có thể nhận tiếp tế từ Tiền Đồn Trạm Dừng này không (mỗi trạm 1 lần/ngày).
 */
export function canCollectOutpost(transit: PlayerTransitState | undefined, outpostId: string): boolean {
  if (!transit || !transit.visitedOutpostsToday) return true;
  return !transit.visitedOutpostsToday.includes(outpostId);
}

/**
 * Nhận Rương Tiếp Tế khi xe buýt/phương tiện dừng tại Tiền Đồn Trạm Dừng.
 */
export function collectOutpostSupply(
  transit: PlayerTransitState | undefined,
  carried: Inventory,
  outpostId: string,
  outpostNameVi: string,
): OutpostCollectResult {
  const nextTransit: PlayerTransitState = transit ? { ...transit } : createTransitState();
  const nextCarried: Inventory = { ...carried };

  if (!canCollectOutpost(nextTransit, outpostId)) {
    return {
      ok: false,
      messageVi: `Tiền Đồn "${outpostNameVi}" đã được nhận tiếp tế hôm nay. Hãy ghé lại ngày mai!`,
      nextTransit,
      nextCarried,
      rewards: [],
    };
  }

  if (!nextTransit.visitedOutpostsToday) nextTransit.visitedOutpostsToday = [];
  nextTransit.visitedOutpostsToday.push(outpostId);
  nextTransit.transitPoints += 25;

  // Phần thưởng tiếp tế trạm dừng: Nước ngọt (Nước sôi), Lương thực & Điểm Viễn Chinh
  const rewards: ItemStack[] = [
    { itemId: 'boiled_water', qty: 2 },
    { itemId: 'wild_berry', qty: 3 },
    { itemId: 'clay', qty: 2 },
  ];

  for (const r of rewards) {
    nextCarried[r.itemId] = (nextCarried[r.itemId] || 0) + r.qty;
  }

  return {
    ok: true,
    messageVi: `🚏 Đã nhận Rương Tiếp Tế từ Tiền Đồn "${outpostNameVi}" (+2 Nước Sôi, +3 Quả Dại, +25 Điểm Viễn Chinh)!`,
    nextTransit,
    nextCarried,
    rewards,
  };
}
