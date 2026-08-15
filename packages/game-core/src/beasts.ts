/**
 * Hệ thống Dã Thú Tiền Sử & Đe Dọa Sinh Tồn Đa Tầng (§v2.2).
 *
 * Hợp nhất 3 cơ chế:
 *  1. Ranh giới bóng tối đêm & Điểm trú ẩn ánh sáng (Safe Havens: Nhà thuốc Long Châu, Pharmacity, Trạm xe buýt, Cafe).
 *  2. Lãnh địa dã thú sương đỏ (Threat Meter & X3 Tài nguyên).
 *  3. Lần dấu vết (Beast Tracks 🐾) & Đột kích Hang ổ quái vật (Beast Dens 🪨).
 */

import type {
  BeastDen,
  BeastTerritory,
  BeastTrack,
  Inventory,
  ItemId,
  ItemStack,
  PlayerBeastState,
  PlayerState,
  SurvivalState,
} from './types.ts';
import { distanceMeters, type LatLon } from './world.ts';
import { addItems, countOf } from './inventory.ts';

export function createPlayerBeastState(): PlayerBeastState {
  return {
    discoveredClues: 0,
    raidedDenIds: [],
    lastAmbientThreatCheckMs: 0,
  };
}

/** Danh sách các Hang Ổ Dã Thú cố định tại các vùng công viên & bãi hoang dã Hà Nội */
export const HANOI_BEAST_DENS: BeastDen[] = [
  // --- 1. CÁC HANG Ổ ĐẠI CỰ THÚ TRỌNG ĐIỂM (BOSS KHU VỰC) ---
  {
    id: 'den_wolf_caugiay',
    nameVi: 'Hang Sói Xám Tiền Sử (Công Viên Cầu Giấy)',
    beastType: 'wolf',
    level: 1,
    hp: 120,
    maxHp: 120,
    attack: 16,
    defense: 6,
    lat: 21.0242,
    lon: 105.7895,
    radiusMeters: 50,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'leather', min: 2, max: 4 },
      { itemId: 'raw_meat', min: 3, max: 6 },
      { itemId: 'ancient_coin', min: 10, max: 20 },
    ],
  },
  {
    id: 'den_tiger_maidich',
    nameVi: 'Động Hổ Răng Kiếm (Mai Dịch — Cầu Giấy)',
    beastType: 'tiger',
    level: 2,
    hp: 200,
    maxHp: 200,
    attack: 26,
    defense: 12,
    lat: 21.0375,
    lon: 105.7745,
    radiusMeters: 55,
    requiredClues: 2,
    isRaided: false,
    lootTable: [
      { itemId: 'leather', min: 4, max: 8 },
      { itemId: 'raw_meat', min: 5, max: 10 },
      { itemId: 'gold_ore', min: 2, max: 4 },
      { itemId: 'ancient_coin', min: 25, max: 45 },
    ],
  },
  {
    id: 'den_bear_thule',
    nameVi: 'Hang Gấu Hang Khổng Lồ (Thủ Lệ — Ba Đình)',
    beastType: 'bear',
    level: 3,
    hp: 320,
    maxHp: 320,
    attack: 34,
    defense: 20,
    lat: 21.0315,
    lon: 105.8085,
    radiusMeters: 60,
    requiredClues: 4,
    isRaided: false,
    lootTable: [
      { itemId: 'leather', min: 6, max: 12 },
      { itemId: 'raw_meat', min: 8, max: 15 },
      { itemId: 'copper_ore', min: 5, max: 10 },
      { itemId: 'ancient_coin', min: 40, max: 70 },
      { itemId: 'egg_mountain', min: 1, max: 1 },
    ],
  },
  {
    id: 'den_serpent_yenso',
    nameVi: 'Đầm Hắc Mãng Xà Cổ (Công Viên Yên Sở)',
    beastType: 'serpent',
    level: 4,
    hp: 450,
    maxHp: 450,
    attack: 42,
    defense: 25,
    lat: 20.9735,
    lon: 105.8612,
    radiusMeters: 75,
    requiredClues: 6,
    isRaided: false,
    lootTable: [
      { itemId: 'leather', min: 8, max: 16 },
      { itemId: 'pearl', min: 3, max: 6 },
      { itemId: 'gold_ore', min: 4, max: 8 },
      { itemId: 'ancient_coin', min: 60, max: 100 },
      { itemId: 'egg_forest', min: 1, max: 1 },
    ],
  },

  // --- 2. CÔNG VIÊN NHỎ & VƯỜN HOA: HOÀN KIẾM, BA ĐÌNH, HAI BÀ TRƯNG ---
  {
    id: 'den_fox_lythaito',
    nameVi: 'Tổ Cáo Đỏ Cổ Đại (Vườn Hoa Lý Thái Tổ)',
    beastType: 'wolf',
    level: 1,
    hp: 75,
    maxHp: 75,
    attack: 10,
    defense: 4,
    lat: 21.0295,
    lon: 105.8546,
    radiusMeters: 40,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'leather', min: 1, max: 3 },
      { itemId: 'wild_berry', min: 2, max: 4 },
      { itemId: 'ancient_coin', min: 8, max: 15 },
    ],
  },
  {
    id: 'den_rabbit_cotan',
    nameVi: 'Bãi Thỏ Rừng Cổ (Vườn Hoa Cổ Tân - Hoàn Kiếm)',
    beastType: 'wolf',
    level: 1,
    hp: 55,
    maxHp: 55,
    attack: 6,
    defense: 3,
    lat: 21.0245,
    lon: 105.8583,
    radiusMeters: 35,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'raw_meat', min: 2, max: 3 },
      { itemId: 'dry_branch', min: 3, max: 5 },
      { itemId: 'ancient_coin', min: 6, max: 12 },
    ],
  },
  {
    id: 'den_hedgehog_pasteur',
    nameVi: 'Tổ Nhím Gai Rừng Sâu (Vườn Hoa Pasteur)',
    beastType: 'wolf',
    level: 1,
    hp: 70,
    maxHp: 70,
    attack: 9,
    defense: 7,
    lat: 21.0165,
    lon: 105.8585,
    radiusMeters: 35,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'sharp_stone', min: 2, max: 4 },
      { itemId: 'wild_berry', min: 2, max: 5 },
      { itemId: 'ancient_coin', min: 8, max: 16 },
    ],
  },
  {
    id: 'den_snake_hangdau',
    nameVi: 'Ổ Rắn Lục Tiền Sử (Vườn Hoa Hàng Đậu - Ba Đình)',
    beastType: 'serpent',
    level: 1,
    hp: 65,
    maxHp: 65,
    attack: 14,
    defense: 3,
    lat: 21.0398,
    lon: 105.8452,
    radiusMeters: 35,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'seed_herb', min: 1, max: 2 },
      { itemId: 'raw_meat', min: 2, max: 4 },
      { itemId: 'ancient_coin', min: 10, max: 18 },
    ],
  },
  {
    id: 'den_boar_vanxuan',
    nameVi: 'Hang Lợn Rừng (Vườn Hoa Vạn Xuân - Quán Thánh)',
    beastType: 'bear',
    level: 1,
    hp: 95,
    maxHp: 95,
    attack: 14,
    defense: 6,
    lat: 21.0402,
    lon: 105.8435,
    radiusMeters: 40,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'raw_meat', min: 3, max: 5 },
      { itemId: 'leather', min: 2, max: 4 },
      { itemId: 'ancient_coin', min: 12, max: 22 },
    ],
  },
  {
    id: 'den_fox_thanhcong',
    nameVi: 'Tổ Cáo Đỏ Hồ Nước (Công Viên Indira Gandhi - Thành Công)',
    beastType: 'wolf',
    level: 1,
    hp: 85,
    maxHp: 85,
    attack: 12,
    defense: 5,
    lat: 21.0185,
    lon: 105.8155,
    radiusMeters: 45,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'leather', min: 2, max: 4 },
      { itemId: 'pearl', min: 1, max: 2 },
      { itemId: 'ancient_coin', min: 12, max: 20 },
    ],
  },

  // --- 3. CÔNG VIÊN NHỎ & VƯỜN HOA: ĐỐNG ĐA, THANH XUÂN, NAM TỪ LIÊM ---
  {
    id: 'den_deer_hoangcau',
    nameVi: 'Bãi Hươu Rừng (Vườn Hoa Trần Quang Diệu - Hoàng Cầu)',
    beastType: 'wolf',
    level: 1,
    hp: 90,
    maxHp: 90,
    attack: 11,
    defense: 5,
    lat: 21.0162,
    lon: 105.8235,
    radiusMeters: 40,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'raw_meat', min: 3, max: 5 },
      { itemId: 'leather', min: 2, max: 3 },
      { itemId: 'ancient_coin', min: 12, max: 20 },
    ],
  },
  {
    id: 'den_wolf_thanhxuan',
    nameVi: 'Bầy Sói Xám Nhỏ (Công Viên Thanh Xuân - Hồ Nhân Chính)',
    beastType: 'wolf',
    level: 1,
    hp: 110,
    maxHp: 110,
    attack: 15,
    defense: 6,
    lat: 21.0025,
    lon: 105.7975,
    radiusMeters: 50,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'leather', min: 2, max: 4 },
      { itemId: 'raw_meat', min: 3, max: 6 },
      { itemId: 'ancient_coin', min: 15, max: 25 },
    ],
  },
  {
    id: 'den_rabbit_phungkhoang',
    nameVi: 'Bãi Thỏ Cổ Sinh (Vườn Hoa Phùng Khoang)',
    beastType: 'wolf',
    level: 1,
    hp: 60,
    maxHp: 60,
    attack: 7,
    defense: 3,
    lat: 20.9895,
    lon: 105.7925,
    radiusMeters: 35,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'raw_meat', min: 2, max: 3 },
      { itemId: 'wild_berry', min: 3, max: 5 },
      { itemId: 'ancient_coin', min: 8, max: 14 },
    ],
  },
  {
    id: 'den_boar_metri',
    nameVi: 'Hang Lợn Rừng Mễ Trì (Công Viên Mễ Trì Hạ)',
    beastType: 'bear',
    level: 1,
    hp: 100,
    maxHp: 100,
    attack: 15,
    defense: 7,
    lat: 21.0145,
    lon: 105.7825,
    radiusMeters: 45,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'raw_meat', min: 3, max: 6 },
      { itemId: 'leather', min: 2, max: 4 },
      { itemId: 'ancient_coin', min: 14, max: 24 },
    ],
  },
  {
    id: 'den_fox_smartcity',
    nameVi: 'Tổ Cáo Hoàng Kim (Công Viên Vườn Nhật Smart City)',
    beastType: 'wolf',
    level: 2,
    hp: 130,
    maxHp: 130,
    attack: 18,
    defense: 8,
    lat: 21.0065,
    lon: 105.7465,
    radiusMeters: 50,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'leather', min: 3, max: 6 },
      { itemId: 'gold_ore', min: 1, max: 3 },
      { itemId: 'ancient_coin', min: 20, max: 35 },
    ],
  },

  // --- 4. CÔNG VIÊN NHỎ & VƯỜN HOA: CẦU GIẤY, TÂY HỒ, BẮC TỪ LIÊM ---
  {
    id: 'den_snake_nghiado',
    nameVi: 'Ổ Mãng Xà Rừng Cổ (Công Viên Nghĩa Đô)',
    beastType: 'serpent',
    level: 1,
    hp: 85,
    maxHp: 85,
    attack: 16,
    defense: 5,
    lat: 21.0405,
    lon: 105.7975,
    radiusMeters: 45,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'seed_herb', min: 2, max: 3 },
      { itemId: 'raw_meat', min: 3, max: 5 },
      { itemId: 'ancient_coin', min: 12, max: 22 },
    ],
  },
  {
    id: 'den_hedgehog_nghiatan',
    nameVi: 'Tổ Nhím Gai Rừng Rậm (Vườn Hoa Nghĩa Tân)',
    beastType: 'wolf',
    level: 1,
    hp: 70,
    maxHp: 70,
    attack: 10,
    defense: 8,
    lat: 21.0425,
    lon: 105.7925,
    radiusMeters: 35,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'sharp_stone', min: 3, max: 5 },
      { itemId: 'wild_berry', min: 3, max: 6 },
      { itemId: 'ancient_coin', min: 10, max: 18 },
    ],
  },
  {
    id: 'den_fox_trinhcongson',
    nameVi: 'Tổ Cáo Hồ Tây (Vườn Hoa Trịnh Công Sơn - Tây Hồ)',
    beastType: 'wolf',
    level: 1,
    hp: 80,
    maxHp: 80,
    attack: 11,
    defense: 4,
    lat: 21.0695,
    lon: 105.8195,
    radiusMeters: 40,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'leather', min: 2, max: 3 },
      { itemId: 'pearl', min: 1, max: 2 },
      { itemId: 'ancient_coin', min: 12, max: 20 },
    ],
  },
  {
    id: 'den_deer_hoabinh',
    nameVi: 'Bầy Hươu Sao Hoang Dã (Công Viên Hòa Bình)',
    beastType: 'wolf',
    level: 2,
    hp: 140,
    maxHp: 140,
    attack: 18,
    defense: 8,
    lat: 21.0655,
    lon: 105.7875,
    radiusMeters: 50,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'raw_meat', min: 4, max: 7 },
      { itemId: 'leather', min: 3, max: 5 },
      { itemId: 'copper_ore', min: 2, max: 4 },
      { itemId: 'ancient_coin', min: 20, max: 35 },
    ],
  },
  {
    id: 'den_wolf_anbinh',
    nameVi: 'Hang Sói Xám Đầm Nước (Công Viên Hồ An Bình)',
    beastType: 'wolf',
    level: 1,
    hp: 105,
    maxHp: 105,
    attack: 15,
    defense: 6,
    lat: 21.0545,
    lon: 105.7765,
    radiusMeters: 45,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'leather', min: 2, max: 4 },
      { itemId: 'raw_meat', min: 3, max: 5 },
      { itemId: 'ancient_coin', min: 14, max: 22 },
    ],
  },

  // --- 5. CÔNG VIÊN NHỎ & VƯỜN HOA: HÀ ĐÔNG, HOÀNG MAI, LONG BIÊN ---
  {
    id: 'den_boar_vanquan',
    nameVi: 'Hang Lợn Rừng Đầm Văn Quán (Công Viên Hồ Văn Quán - Hà Đông)',
    beastType: 'bear',
    level: 1,
    hp: 110,
    maxHp: 110,
    attack: 16,
    defense: 7,
    lat: 20.9785,
    lon: 105.7895,
    radiusMeters: 45,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'raw_meat', min: 3, max: 6 },
      { itemId: 'leather', min: 2, max: 4 },
      { itemId: 'ancient_coin', min: 15, max: 25 },
    ],
  },
  {
    id: 'den_fox_duongnoi',
    nameVi: 'Tổ Cáo Thiên Văn (Công Viên Thiên Văn Học - Dương Nội)',
    beastType: 'wolf',
    level: 1,
    hp: 90,
    maxHp: 90,
    attack: 13,
    defense: 5,
    lat: 20.9815,
    lon: 105.7465,
    radiusMeters: 45,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'leather', min: 2, max: 4 },
      { itemId: 'wild_berry', min: 3, max: 6 },
      { itemId: 'ancient_coin', min: 14, max: 24 },
    ],
  },
  {
    id: 'den_snake_denlu',
    nameVi: 'Ổ Mãng Xà Đầm Lừ (Công Viên Hồ Đền Lừ - Hoàng Mai)',
    beastType: 'serpent',
    level: 1,
    hp: 95,
    maxHp: 95,
    attack: 16,
    defense: 5,
    lat: 20.9885,
    lon: 105.8565,
    radiusMeters: 45,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'seed_herb', min: 2, max: 4 },
      { itemId: 'raw_meat', min: 3, max: 5 },
      { itemId: 'ancient_coin', min: 14, max: 24 },
    ],
  },
  {
    id: 'den_deer_linhdam',
    nameVi: 'Bầy Hươu Sao Bán Đảo (Công Viên Linh Đàm)',
    beastType: 'wolf',
    level: 1,
    hp: 115,
    maxHp: 115,
    attack: 15,
    defense: 6,
    lat: 20.9655,
    lon: 105.8285,
    radiusMeters: 50,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'raw_meat', min: 3, max: 6 },
      { itemId: 'leather', min: 2, max: 4 },
      { itemId: 'ancient_coin', min: 15, max: 26 },
    ],
  },
  {
    id: 'den_fox_ngoclam',
    nameVi: 'Tổ Cáo Đỏ Bến Sông (Vườn Hoa Ngọc Lâm - Long Biên)',
    beastType: 'wolf',
    level: 1,
    hp: 85,
    maxHp: 85,
    attack: 12,
    defense: 5,
    lat: 21.0485,
    lon: 105.8695,
    radiusMeters: 40,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'leather', min: 2, max: 3 },
      { itemId: 'wild_berry', min: 2, max: 5 },
      { itemId: 'ancient_coin', min: 12, max: 20 },
    ],
  },
];

/** Danh sách các Lãnh Địa Dã Thú Sương Đỏ (Vùng Đỏ) */
export const HANOI_BEAST_TERRITORIES: BeastTerritory[] = [
  {
    id: 'terr_caugiay_park',
    nameVi: 'Lãnh Địa Sói Rừng (Khu Sinh Thái Cầu Giấy)',
    lat: 21.0242,
    lon: 105.7895,
    radiusMeters: 140,
    threatLevel: 2,
    resourceMultiplier: 2.5,
    dominantBeast: 'wolf',
  },
  {
    id: 'terr_nghiado_park',
    nameVi: 'Rừng Rậm Dã Thú (Công Viên Nghĩa Đô)',
    lat: 21.0405,
    lon: 105.7975,
    radiusMeters: 130,
    threatLevel: 2,
    resourceMultiplier: 2.5,
    dominantBeast: 'tiger',
  },
  {
    id: 'terr_thule_zoo',
    nameVi: 'Lãnh Địa Bách Thú Cổ Đại (Thủ Lệ)',
    lat: 21.0315,
    lon: 105.8085,
    radiusMeters: 150,
    threatLevel: 3,
    resourceMultiplier: 3.0,
    dominantBeast: 'bear',
  },
  {
    id: 'terr_yenso_swamp',
    nameVi: 'Vùng Đầm Lầy Thủy Quái (Yên Sở)',
    lat: 20.9735,
    lon: 105.8612,
    radiusMeters: 220,
    threatLevel: 4,
    resourceMultiplier: 3.5,
    dominantBeast: 'serpent',
  },
];

export interface NightThreatCheckResult {
  isNight: boolean;
  isThreatActive: boolean;
  isSafeHaven: boolean;
  safeHavenNameVi?: string;
  hasTorch: boolean;
  torchRadiusMeters: number;
  hpDrained: number;
  messageVi?: string;
}

/**
 * Kiểm tra Áp lực Màn Đêm và Điểm Trú Ẩn Ánh Sáng.
 * Ban đêm (sau 18h hoặc trước 6h):
 *  - Nếu ở trong tầm 50m của Thánh Địa Ánh Sáng (Nhà thuốc Long Châu/Pharmacity, Cafe, Trạm xe buýt, Căn cứ) -> An toàn tuyệt đối.
 *  - Nếu có Đuốc Lửa trong ba lô (`torch` > 0) -> An toàn tuyệt đối (toả hào quang 30m).
 *  - Nếu đi đường tối không có đuốc -> Bị bóng tối rình rập, hao hụt HP nhẹ.
 */
export function checkNightAmbientThreat(
  playerLat: number,
  playerLon: number,
  hour: number,
  carried: Inventory,
  safeHavenFeatures: { lat: number; lon: number; nameVi: string; radiusMeters?: number }[],
): NightThreatCheckResult {
  const isNight = hour >= 18 || hour < 6;

  if (!isNight) {
    return {
      isNight: false,
      isThreatActive: false,
      isSafeHaven: false,
      hasTorch: false,
      torchRadiusMeters: 0,
      hpDrained: 0,
    };
  }

  const hasTorch = (carried['torch'] ?? 0) > 0;

  // Kiểm tra xem có đang ở trong Điểm Trú Ẩn Ánh Sáng không
  let currentSafeHaven: string | undefined = undefined;
  for (const feat of safeHavenFeatures) {
    const d = distanceMeters({ lat: playerLat, lon: playerLon }, { lat: feat.lat, lon: feat.lon });
    const radius = Math.max(feat.radiusMeters || 0, 50);
    if (d <= radius) {
      currentSafeHaven = feat.nameVi;
      break;
    }
  }

  if (currentSafeHaven) {
    return {
      isNight: true,
      isThreatActive: false,
      isSafeHaven: true,
      safeHavenNameVi: currentSafeHaven,
      hasTorch,
      torchRadiusMeters: hasTorch ? 30 : 0,
      hpDrained: 0,
      messageVi: `✨ Bạn đang ở trong Thánh Địa Ánh Sáng (${currentSafeHaven}) — An toàn tuyệt đối khỏi bóng đêm!`,
    };
  }

  if (hasTorch) {
    return {
      isNight: true,
      isThreatActive: false,
      isSafeHaven: false,
      hasTorch: true,
      torchRadiusMeters: 30,
      hpDrained: 0,
      messageVi: '🔥 Ngọn đuốc trên tay đang rực sáng, xua tan mọi dã thú bóng đêm.',
    };
  }

  // Đi trong đêm tối không đuốc ngoài vùng an toàn
  return {
    isNight: true,
    isThreatActive: true,
    isSafeHaven: false,
    hasTorch: false,
    torchRadiusMeters: 0,
    hpDrained: 4,
    messageVi: '🌑 Màn đêm lạnh lẽo bủa vây! Hãy thắp Đuốc Lửa hoặc tìm Nhà thuốc / Trạm dừng sáng đèn để trú ẩn.',
  };
}

/**
 * Kiểm tra xem người chơi có đang bước vào Lãnh Địa Quái Thú Sương Đỏ hay không.
 */
export function checkBeastTerritory(
  playerLat: number,
  playerLon: number,
): BeastTerritory | null {
  for (const terr of HANOI_BEAST_TERRITORIES) {
    const d = distanceMeters({ lat: playerLat, lon: playerLon }, { lat: terr.lat, lon: terr.lon });
    if (d <= terr.radiusMeters) {
      return terr;
    }
  }
  return null;
}

export interface DenRaidResult {
  ok: boolean;
  messageVi: string;
  victory: boolean;
  hpLost: number;
  remainingPlayerHp: number;
  lootGained: ItemStack[];
  nextPlayer: PlayerState;
}

/**
 * Tính toán lực chiến và Đột Kích Hang Ổ Quái Thú.
 */
export function raidBeastDen(
  player: PlayerState,
  denId: string,
  nowMs: number,
): DenRaidResult {
  const den = HANOI_BEAST_DENS.find((d) => d.id === denId);
  if (!den) {
    return {
      ok: false,
      messageVi: 'Không tìm thấy Hang Ổ dã thú này!',
      victory: false,
      hpLost: 0,
      remainingPlayerHp: player.survival.hp,
      lootGained: [],
      nextPlayer: player,
    };
  }

  const beastState: PlayerBeastState = player.beastState
    ? { ...player.beastState }
    : createPlayerBeastState();

  if (beastState.raidedDenIds.includes(den.id)) {
    return {
      ok: false,
      messageVi: `Hang Ổ "${den.nameVi}" đã bị bạn dẹp tan. Dã thú chưa kịp quay lại làm tổ!`,
      victory: false,
      hpLost: 0,
      remainingPlayerHp: player.survival.hp,
      lootGained: [],
      nextPlayer: player,
    };
  }

  // 1. Tính toán lực tấn công của người chơi dựa trên trang bị
  let playerAtk = 12; // Đấm tay / Gậy thô cơ bản
  if (countOf(player.carried, 'divine_gold_blade') > 0) playerAtk = 55;
  else if (countOf(player.carried, 'dong_son_spear') > 0) playerAtk = 42;
  else if (countOf(player.carried, 'iron_sword') > 0) playerAtk = 32;
  else if (countOf(player.carried, 'iron_spear') > 0) playerAtk = 26;
  else if (countOf(player.carried, 'stone_spear') > 0) playerAtk = 18;

  // 2. Tính toán giáp phòng thủ của người chơi
  let playerDef = 4;
  if (countOf(player.carried, 'bronze_plate_armor') > 0) playerDef += 25;
  if (countOf(player.carried, 'iron_shield') > 0) playerDef += 16;
  else if (countOf(player.carried, 'wooden_shield') > 0) playerDef += 8;

  // 3. Bonus từ Linh thú đồng hành xuất chiến
  const activePet = player.pets?.find((p: any) => p.isActive);
  if (activePet) {
    playerAtk += Math.round(activePet.level * 4);
    playerDef += Math.round(activePet.level * 2);
  }

  // Mô phỏng trận đánh
  const roundsToKillDen = Math.ceil(den.hp / Math.max(5, playerAtk - den.defense));
  const damagePerRound = Math.max(3, den.attack - playerDef);
  const totalHpLost = Math.min(player.survival.hp - 1, roundsToKillDen * damagePerRound);

  const nextPlayer: PlayerState = {
    ...player,
    carried: { ...player.carried },
    survival: {
      ...player.survival,
      hp: Math.max(1, player.survival.hp - totalHpLost),
    },
    beastState: {
      ...beastState,
      raidedDenIds: [...beastState.raidedDenIds, den.id],
    },
  };

  // Trao phần thưởng diệt hang ổ
  const lootGained: ItemStack[] = [];
  for (const entry of den.lootTable) {
    const qty = Math.floor(entry.min + Math.random() * (entry.max - entry.min + 1));
    if (qty > 0) {
      nextPlayer.carried[entry.itemId] = (nextPlayer.carried[entry.itemId] || 0) + qty;
      lootGained.push({ itemId: entry.itemId, qty });
    }
  }

  return {
    ok: true,
    messageVi: `⚔️ Đột kích đại thắng Hang Ổ "${den.nameVi}"! Tổ dã thú đã bị quét sạch.`,
    victory: true,
    hpLost: totalHpLost,
    remainingPlayerHp: nextPlayer.survival.hp,
    lootGained,
    nextPlayer,
  };
}
