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
    hp: 140,
    maxHp: 140,
    attack: 16,
    defense: 6,
    lat: 21.0242,
    lon: 105.7895,
    radiusMeters: 50,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'leather', min: 1, max: 2 },
      { itemId: 'raw_meat', min: 1, max: 2 },
      { itemId: 'ancient_coin', min: 2, max: 5 },
    ],
  },
  {
    id: 'den_tiger_maidich',
    nameVi: 'Động Hổ Răng Kiếm (Mai Dịch — Cầu Giấy)',
    beastType: 'tiger',
    level: 2,
    hp: 240,
    maxHp: 240,
    attack: 26,
    defense: 12,
    lat: 21.0375,
    lon: 105.7745,
    radiusMeters: 55,
    requiredClues: 2,
    isRaided: false,
    lootTable: [
      { itemId: 'leather', min: 2, max: 3 },
      { itemId: 'raw_meat', min: 2, max: 4 },
      { itemId: 'gold_ore', min: 1, max: 2 },
      { itemId: 'ancient_coin', min: 5, max: 10 },
    ],
  },
  {
    id: 'den_bear_thule',
    nameVi: 'Hang Gấu Hang Khổng Lồ (Thủ Lệ — Ba Đình)',
    beastType: 'bear',
    level: 3,
    hp: 380,
    maxHp: 380,
    attack: 34,
    defense: 20,
    lat: 21.0315,
    lon: 105.8085,
    radiusMeters: 60,
    requiredClues: 4,
    isRaided: false,
    lootTable: [
      { itemId: 'leather', min: 2, max: 4 },
      { itemId: 'raw_meat', min: 3, max: 5 },
      { itemId: 'copper_ore', min: 2, max: 3 },
      { itemId: 'ancient_coin', min: 8, max: 16 },
      { itemId: 'egg_mountain', min: 1, max: 1 },
    ],
  },
  {
    id: 'den_serpent_yenso',
    nameVi: 'Đầm Hắc Mãng Xà Cổ (Công Viên Yên Sở)',
    beastType: 'serpent',
    level: 4,
    hp: 550,
    maxHp: 550,
    attack: 42,
    defense: 25,
    lat: 20.9735,
    lon: 105.8612,
    radiusMeters: 75,
    requiredClues: 6,
    isRaided: false,
    lootTable: [
      { itemId: 'leather', min: 3, max: 5 },
      { itemId: 'pearl', min: 1, max: 2 },
      { itemId: 'gold_ore', min: 1, max: 2 },
      { itemId: 'ancient_coin', min: 15, max: 25 },
      { itemId: 'egg_forest', min: 1, max: 1 },
    ],
  },

  // --- 2. CÔNG VIÊN NHỎ & VƯỜN HOA: HOÀN KIẾM, BA ĐÌNH, HAI BÀ TRƯNG ---
  {
    id: 'den_fox_lythaito',
    nameVi: 'Tổ Cáo Đỏ Cổ Đại (Vườn Hoa Lý Thái Tổ)',
    beastType: 'wolf',
    level: 1,
    hp: 85,
    maxHp: 85,
    attack: 10,
    defense: 4,
    lat: 21.0295,
    lon: 105.8546,
    radiusMeters: 40,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'leather', min: 1, max: 2 },
      { itemId: 'wild_berry', min: 1, max: 2 },
      { itemId: 'ancient_coin', min: 2, max: 4 },
    ],
  },
  {
    id: 'den_rabbit_cotan',
    nameVi: 'Bãi Thỏ Rừng Cổ (Vườn Hoa Cổ Tân - Hoàn Kiếm)',
    beastType: 'wolf',
    level: 1,
    hp: 60,
    maxHp: 60,
    attack: 6,
    defense: 3,
    lat: 21.0245,
    lon: 105.8583,
    radiusMeters: 35,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'raw_meat', min: 1, max: 2 },
      { itemId: 'dry_branch', min: 2, max: 3 },
      { itemId: 'ancient_coin', min: 2, max: 3 },
    ],
  },
  {
    id: 'den_hedgehog_pasteur',
    nameVi: 'Tổ Nhím Gai Rừng Sâu (Vườn Hoa Pasteur)',
    beastType: 'wolf',
    level: 1,
    hp: 75,
    maxHp: 75,
    attack: 9,
    defense: 7,
    lat: 21.0165,
    lon: 105.8585,
    radiusMeters: 35,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'sharp_stone', min: 1, max: 2 },
      { itemId: 'wild_berry', min: 1, max: 2 },
      { itemId: 'ancient_coin', min: 2, max: 4 },
    ],
  },
  {
    id: 'den_snake_hangdau',
    nameVi: 'Ổ Rắn Lục Tiền Sử (Vườn Hoa Hàng Đậu - Ba Đình)',
    beastType: 'serpent',
    level: 1,
    hp: 75,
    maxHp: 75,
    attack: 14,
    defense: 3,
    lat: 21.0398,
    lon: 105.8452,
    radiusMeters: 35,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'seed_herb', min: 1, max: 1 },
      { itemId: 'raw_meat', min: 1, max: 2 },
      { itemId: 'ancient_coin', min: 2, max: 4 },
    ],
  },
  {
    id: 'den_boar_vanxuan',
    nameVi: 'Hang Lợn Rừng (Vườn Hoa Vạn Xuân - Quán Thánh)',
    beastType: 'bear',
    level: 1,
    hp: 110,
    maxHp: 110,
    attack: 14,
    defense: 6,
    lat: 21.0402,
    lon: 105.8435,
    radiusMeters: 40,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'raw_meat', min: 1, max: 2 },
      { itemId: 'leather', min: 1, max: 2 },
      { itemId: 'ancient_coin', min: 2, max: 5 },
    ],
  },
  {
    id: 'den_fox_thanhcong',
    nameVi: 'Tổ Cáo Đỏ Hồ Nước (Công Viên Indira Gandhi - Thành Công)',
    beastType: 'wolf',
    level: 1,
    hp: 95,
    maxHp: 95,
    attack: 12,
    defense: 5,
    lat: 21.0185,
    lon: 105.8155,
    radiusMeters: 45,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'leather', min: 1, max: 2 },
      { itemId: 'pearl', min: 1, max: 1 },
      { itemId: 'ancient_coin', min: 2, max: 5 },
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
      { itemId: 'raw_meat', min: 1, max: 2 },
      { itemId: 'leather', min: 1, max: 1 },
      { itemId: 'ancient_coin', min: 2, max: 4 },
    ],
  },
  {
    id: 'den_wolf_thanhxuan',
    nameVi: 'Bầy Sói Xám Nhỏ (Công Viên Thanh Xuân - Hồ Nhân Chính)',
    beastType: 'wolf',
    level: 1,
    hp: 120,
    maxHp: 120,
    attack: 15,
    defense: 6,
    lat: 21.0025,
    lon: 105.7975,
    radiusMeters: 50,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'leather', min: 1, max: 2 },
      { itemId: 'raw_meat', min: 1, max: 2 },
      { itemId: 'ancient_coin', min: 3, max: 5 },
    ],
  },
  {
    id: 'den_rabbit_phungkhoang',
    nameVi: 'Bãi Thỏ Cổ Sinh (Vườn Hoa Phùng Khoang)',
    beastType: 'wolf',
    level: 1,
    hp: 65,
    maxHp: 65,
    attack: 7,
    defense: 3,
    lat: 20.9895,
    lon: 105.7925,
    radiusMeters: 35,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'raw_meat', min: 1, max: 2 },
      { itemId: 'wild_berry', min: 1, max: 2 },
      { itemId: 'ancient_coin', min: 2, max: 3 },
    ],
  },
  {
    id: 'den_boar_metri',
    nameVi: 'Hang Lợn Rừng Mễ Trì (Công Viên Mễ Trì Hạ)',
    beastType: 'bear',
    level: 1,
    hp: 110,
    maxHp: 110,
    attack: 15,
    defense: 7,
    lat: 21.0145,
    lon: 105.7825,
    radiusMeters: 45,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'raw_meat', min: 1, max: 2 },
      { itemId: 'leather', min: 1, max: 2 },
      { itemId: 'ancient_coin', min: 2, max: 5 },
    ],
  },
  {
    id: 'den_fox_smartcity',
    nameVi: 'Tổ Cáo Hoàng Kim (Công Viên Vườn Nhật Smart City)',
    beastType: 'wolf',
    level: 2,
    hp: 150,
    maxHp: 150,
    attack: 18,
    defense: 8,
    lat: 21.0065,
    lon: 105.7465,
    radiusMeters: 50,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'leather', min: 2, max: 3 },
      { itemId: 'gold_ore', min: 1, max: 1 },
      { itemId: 'ancient_coin', min: 4, max: 8 },
    ],
  },

  // --- 4. CÔNG VIÊN NHỎ & VƯỜN HOA: CẦU GIẤY, TÂY HỒ, BẮC TỪ LIÊM ---
  {
    id: 'den_snake_nghiado',
    nameVi: 'Ổ Mãng Xà Rừng Cổ (Công Viên Nghĩa Đô)',
    beastType: 'serpent',
    level: 1,
    hp: 95,
    maxHp: 95,
    attack: 16,
    defense: 5,
    lat: 21.0405,
    lon: 105.7975,
    radiusMeters: 45,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'seed_herb', min: 1, max: 2 },
      { itemId: 'raw_meat', min: 1, max: 2 },
      { itemId: 'ancient_coin', min: 2, max: 4 },
    ],
  },
  {
    id: 'den_hedgehog_nghiatan',
    nameVi: 'Tổ Nhím Gai Rừng Rậm (Vườn Hoa Nghĩa Tân)',
    beastType: 'wolf',
    level: 1,
    hp: 80,
    maxHp: 80,
    attack: 10,
    defense: 8,
    lat: 21.0425,
    lon: 105.7925,
    radiusMeters: 35,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'sharp_stone', min: 1, max: 2 },
      { itemId: 'wild_berry', min: 1, max: 2 },
      { itemId: 'ancient_coin', min: 2, max: 3 },
    ],
  },
  {
    id: 'den_fox_trinhcongson',
    nameVi: 'Tổ Cáo Hồ Tây (Vườn Hoa Trịnh Công Sơn - Tây Hồ)',
    beastType: 'wolf',
    level: 1,
    hp: 90,
    maxHp: 90,
    attack: 11,
    defense: 4,
    lat: 21.0695,
    lon: 105.8195,
    radiusMeters: 40,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'leather', min: 1, max: 2 },
      { itemId: 'pearl', min: 1, max: 1 },
      { itemId: 'ancient_coin', min: 2, max: 5 },
    ],
  },
  {
    id: 'den_deer_hoabinh',
    nameVi: 'Bầy Hươu Sao Hoang Dã (Công Viên Hòa Bình)',
    beastType: 'wolf',
    level: 2,
    hp: 160,
    maxHp: 160,
    attack: 18,
    defense: 8,
    lat: 21.0655,
    lon: 105.7875,
    radiusMeters: 50,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'raw_meat', min: 2, max: 3 },
      { itemId: 'leather', min: 1, max: 2 },
      { itemId: 'copper_ore', min: 1, max: 2 },
      { itemId: 'ancient_coin', min: 4, max: 8 },
    ],
  },
  {
    id: 'den_wolf_anbinh',
    nameVi: 'Hang Sói Xám Đầm Nước (Công Viên Hồ An Bình)',
    beastType: 'wolf',
    level: 1,
    hp: 115,
    maxHp: 115,
    attack: 15,
    defense: 6,
    lat: 21.0545,
    lon: 105.7765,
    radiusMeters: 45,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'leather', min: 1, max: 2 },
      { itemId: 'raw_meat', min: 1, max: 2 },
      { itemId: 'ancient_coin', min: 2, max: 5 },
    ],
  },

  // --- 5. CÔNG VIÊN NHỎ & VƯỜN HOA: HÀ ĐÔNG, HOÀNG MAI, LONG BIÊN ---
  {
    id: 'den_boar_vanquan',
    nameVi: 'Hang Lợn Rừng Đầm Văn Quán (Công Viên Hồ Văn Quán - Hà Đông)',
    beastType: 'bear',
    level: 1,
    hp: 120,
    maxHp: 120,
    attack: 16,
    defense: 7,
    lat: 20.9785,
    lon: 105.7895,
    radiusMeters: 45,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'raw_meat', min: 1, max: 2 },
      { itemId: 'leather', min: 1, max: 2 },
      { itemId: 'ancient_coin', min: 3, max: 5 },
    ],
  },
  {
    id: 'den_fox_duongnoi',
    nameVi: 'Tổ Cáo Thiên Văn (Công Viên Thiên Văn Học - Dương Nội)',
    beastType: 'wolf',
    level: 1,
    hp: 95,
    maxHp: 95,
    attack: 13,
    defense: 5,
    lat: 20.9815,
    lon: 105.7465,
    radiusMeters: 45,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'leather', min: 1, max: 2 },
      { itemId: 'wild_berry', min: 1, max: 2 },
      { itemId: 'ancient_coin', min: 2, max: 4 },
    ],
  },
  {
    id: 'den_snake_denlu',
    nameVi: 'Ổ Mãng Xà Đầm Lừ (Công Viên Hồ Đền Lừ - Hoàng Mai)',
    beastType: 'serpent',
    level: 1,
    hp: 100,
    maxHp: 100,
    attack: 16,
    defense: 5,
    lat: 20.9885,
    lon: 105.8565,
    radiusMeters: 45,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'seed_herb', min: 1, max: 2 },
      { itemId: 'raw_meat', min: 1, max: 2 },
      { itemId: 'ancient_coin', min: 2, max: 5 },
    ],
  },
  {
    id: 'den_deer_linhdam',
    nameVi: 'Bầy Hươu Sao Bán Đảo (Công Viên Linh Đàm)',
    beastType: 'wolf',
    level: 1,
    hp: 125,
    maxHp: 125,
    attack: 15,
    defense: 6,
    lat: 20.9655,
    lon: 105.8285,
    radiusMeters: 50,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'raw_meat', min: 1, max: 2 },
      { itemId: 'leather', min: 1, max: 2 },
      { itemId: 'ancient_coin', min: 3, max: 5 },
    ],
  },
  {
    id: 'den_fox_ngoclam',
    nameVi: 'Tổ Cáo Đỏ Bến Sông (Vườn Hoa Ngọc Lâm - Long Biên)',
    beastType: 'wolf',
    level: 1,
    hp: 95,
    maxHp: 95,
    attack: 12,
    defense: 5,
    lat: 21.0485,
    lon: 105.8695,
    radiusMeters: 40,
    requiredClues: 0,
    isRaided: false,
    lootTable: [
      { itemId: 'leather', min: 1, max: 2 },
      { itemId: 'wild_berry', min: 1, max: 2 },
      { itemId: 'ancient_coin', min: 2, max: 4 },
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

// ============================================================================
// HỆ THỐNG QUẦN THỂ DÃ THÚ THẾ GIỚI MỞ (DYNAMIC WILDLIFE & HUNTING ENGINE)
// ============================================================================

export type BeastSpecies =
  | 'wolf'
  | 'lion'
  | 'boar'
  | 'bear'
  | 'sabertooth'
  | 'deer'
  | 'mammoth'
  | 'horse'
  // Thủy Quái & Đầm Lầy
  | 'croc'
  | 'titanoboa'
  | 'plesiosaur'
  // Khủng Long Ăn Thịt Săn Mồi
  | 'trex'
  | 'raptor'
  | 'spinosaurus'
  | 'dilophosaurus'
  // Khủng Long Ăn Cỏ & Thiết Giáp
  | 'triceratops'
  | 'ankylosaurus'
  | 'brachiosaurus'
  // Dực Long Bầu Trời
  | 'pterosaur';

export interface DynamicBeastPack {
  id: string;
  species: BeastSpecies;
  nameVi: string;
  iconEmoji: string;
  isPredator: boolean;
  originWorldX: number;
  originWorldY: number;
  currentWorldX: number;
  currentWorldY: number;
  maxHp: number;
  currentHp: number;
  isAggro: boolean;
  isChasing: boolean;
  isFleeing: boolean;
  aggroRadiusMeters: number;
  leashRadiusMeters: number;
  attackRangeMeters: number;
  damage: number;
  attackCooldownMs: number;
  lastAttackTime: number;
  speedMps: number;
  isDefeated: boolean;
  respawnAt: number;
  lootTable: Array<{ itemId: ItemId; min: number; max: number }>;
}

export function createDynamicBeastPack(
  id: string,
  species: BeastSpecies,
  originWorldX: number,
  originWorldY: number,
): DynamicBeastPack {
  switch (species) {
    case 'wolf':
      return {
        id,
        species,
        nameVi: 'Bầy Sói Hoang Tiền Sử',
        iconEmoji: '🐺',
        isPredator: true,
        originWorldX,
        originWorldY,
        currentWorldX: originWorldX,
        currentWorldY: originWorldY,
        maxHp: 160,
        currentHp: 160,
        isAggro: false,
        isChasing: false,
        isFleeing: false,
        aggroRadiusMeters: 25.0,
        leashRadiusMeters: 45.0,
        attackRangeMeters: 6.0,
        damage: 16,
        attackCooldownMs: 1100,
        lastAttackTime: 0,
        speedMps: 4.4, // ~15.8 km/h
        isDefeated: false,
        respawnAt: 0,
        lootTable: [
          { itemId: 'raw_meat', min: 1, max: 2 },
          { itemId: 'leather', min: 1, max: 1 },
          { itemId: 'sharp_stone', min: 0, max: 1 },
        ],
      };
    case 'lion':
      return {
        id,
        species,
        nameVi: 'Sư Tử Hang Động Tiền Sử',
        iconEmoji: '🦁',
        isPredator: true,
        originWorldX,
        originWorldY,
        currentWorldX: originWorldX,
        currentWorldY: originWorldY,
        maxHp: 280,
        currentHp: 280,
        isAggro: false,
        isChasing: false,
        isFleeing: false,
        aggroRadiusMeters: 28.0,
        leashRadiusMeters: 50.0,
        attackRangeMeters: 6.5,
        damage: 28,
        attackCooldownMs: 1300,
        lastAttackTime: 0,
        speedMps: 4.6, // ~16.5 km/h
        isDefeated: false,
        respawnAt: 0,
        lootTable: [
          { itemId: 'raw_meat', min: 2, max: 3 },
          { itemId: 'leather', min: 1, max: 2 },
          { itemId: 'sharp_stone', min: 1, max: 1 },
        ],
      };
    case 'boar':
      return {
        id,
        species,
        nameVi: 'Lợn Lòi Rừng Khổng Lồ',
        iconEmoji: '🐗',
        isPredator: true,
        originWorldX,
        originWorldY,
        currentWorldX: originWorldX,
        currentWorldY: originWorldY,
        maxHp: 200,
        currentHp: 200,
        isAggro: false,
        isChasing: false,
        isFleeing: false,
        aggroRadiusMeters: 22.0,
        leashRadiusMeters: 40.0,
        attackRangeMeters: 5.8,
        damage: 20,
        attackCooldownMs: 1300,
        lastAttackTime: 0,
        speedMps: 3.9, // ~14 km/h
        isDefeated: false,
        respawnAt: 0,
        lootTable: [
          { itemId: 'raw_meat', min: 2, max: 3 },
          { itemId: 'leather', min: 1, max: 2 },
        ],
      };
    case 'bear':
      return {
        id,
        species,
        nameVi: 'Gấu Hang Động Cổ Đại',
        iconEmoji: '🐻',
        isPredator: true,
        originWorldX,
        originWorldY,
        currentWorldX: originWorldX,
        currentWorldY: originWorldY,
        maxHp: 420,
        currentHp: 420,
        isAggro: false,
        isChasing: false,
        isFleeing: false,
        aggroRadiusMeters: 26.0,
        leashRadiusMeters: 48.0,
        attackRangeMeters: 6.8,
        damage: 35,
        attackCooldownMs: 1500,
        lastAttackTime: 0,
        speedMps: 3.4, // ~12.2 km/h
        isDefeated: false,
        respawnAt: 0,
        lootTable: [
          { itemId: 'raw_meat', min: 3, max: 4 },
          { itemId: 'leather', min: 2, max: 3 },
          { itemId: 'copper_ore', min: 1, max: 2 },
        ],
      };
    case 'sabertooth':
      return {
        id,
        species,
        nameVi: 'Báo Răng Kiếm Phục Kích',
        iconEmoji: '🐯',
        isPredator: true,
        originWorldX,
        originWorldY,
        currentWorldX: originWorldX,
        currentWorldY: originWorldY,
        maxHp: 240,
        currentHp: 240,
        isAggro: false,
        isChasing: false,
        isFleeing: false,
        aggroRadiusMeters: 26.0,
        leashRadiusMeters: 48.0,
        attackRangeMeters: 6.0,
        damage: 26,
        attackCooldownMs: 1000,
        lastAttackTime: 0,
        speedMps: 4.8, // ~17.2 km/h
        isDefeated: false,
        respawnAt: 0,
        lootTable: [
          { itemId: 'raw_meat', min: 2, max: 3 },
          { itemId: 'leather', min: 1, max: 2 },
        ],
      };
    case 'deer':
      return {
        id,
        species,
        nameVi: 'Bãi Hươu Sao Đế Chế',
        iconEmoji: '🦌',
        isPredator: false,
        originWorldX,
        originWorldY,
        currentWorldX: originWorldX,
        currentWorldY: originWorldY,
        maxHp: 80,
        currentHp: 80,
        isAggro: false,
        isChasing: false,
        isFleeing: false,
        aggroRadiusMeters: 18.0,
        leashRadiusMeters: 38.0,
        attackRangeMeters: 4.0,
        damage: 0,
        attackCooldownMs: 9999,
        lastAttackTime: 0,
        speedMps: 4.6, // Chạy nhanh khi hoảng sợ
        isDefeated: false,
        respawnAt: 0,
        lootTable: [
          { itemId: 'raw_meat', min: 1, max: 2 },
          { itemId: 'leather', min: 1, max: 1 },
        ],
      };
    case 'mammoth':
      return {
        id,
        species,
        nameVi: 'Đàn Voi Ma Mút Tiền Sử',
        iconEmoji: '🐘',
        isPredator: false,
        originWorldX,
        originWorldY,
        currentWorldX: originWorldX,
        currentWorldY: originWorldY,
        maxHp: 600,
        currentHp: 600,
        isAggro: false,
        isChasing: false,
        isFleeing: false,
        aggroRadiusMeters: 18.0,
        leashRadiusMeters: 40.0,
        attackRangeMeters: 6.5,
        damage: 30,
        attackCooldownMs: 2200,
        lastAttackTime: 0,
        speedMps: 2.8,
        isDefeated: false,
        respawnAt: 0,
        lootTable: [
          { itemId: 'raw_meat', min: 4, max: 6 },
          { itemId: 'leather', min: 3, max: 4 },
        ],
      };
    case 'croc':
      return {
        id,
        species,
        nameVi: 'Cá Sấu Đế Vương Cổ Đại',
        iconEmoji: '🐊',
        isPredator: true,
        originWorldX,
        originWorldY,
        currentWorldX: originWorldX,
        currentWorldY: originWorldY,
        maxHp: 550,
        currentHp: 550,
        isAggro: false,
        isChasing: false,
        isFleeing: false,
        aggroRadiusMeters: 24.0,
        leashRadiusMeters: 45.0,
        attackRangeMeters: 6.5,
        damage: 36,
        attackCooldownMs: 1200,
        lastAttackTime: 0,
        speedMps: 4.2, // ~15.1 km/h
        isDefeated: false,
        respawnAt: 0,
        lootTable: [
          { itemId: 'raw_meat', min: 3, max: 5 },
          { itemId: 'leather', min: 2, max: 3 },
        ],
      };
    case 'titanoboa':
      return {
        id,
        species,
        nameVi: 'Cự Mãng Xà Đầm Lầy',
        iconEmoji: '🐍',
        isPredator: true,
        originWorldX,
        originWorldY,
        currentWorldX: originWorldX,
        currentWorldY: originWorldY,
        maxHp: 480,
        currentHp: 480,
        isAggro: false,
        isChasing: false,
        isFleeing: false,
        aggroRadiusMeters: 26.0,
        leashRadiusMeters: 46.0,
        attackRangeMeters: 7.0,
        damage: 38,
        attackCooldownMs: 1400,
        lastAttackTime: 0,
        speedMps: 4.0,
        isDefeated: false,
        respawnAt: 0,
        lootTable: [
          { itemId: 'raw_meat', min: 3, max: 5 },
          { itemId: 'leather', min: 2, max: 3 },
        ],
      };
    case 'plesiosaur':
      return {
        id,
        species,
        nameVi: 'Thủy Long Cổ Dài Hồ Tây',
        iconEmoji: '🐉',
        isPredator: false,
        originWorldX,
        originWorldY,
        currentWorldX: originWorldX,
        currentWorldY: originWorldY,
        maxHp: 650,
        currentHp: 650,
        isAggro: false,
        isChasing: false,
        isFleeing: false,
        aggroRadiusMeters: 20.0,
        leashRadiusMeters: 45.0,
        attackRangeMeters: 8.0,
        damage: 32,
        attackCooldownMs: 1500,
        lastAttackTime: 0,
        speedMps: 3.5,
        isDefeated: false,
        respawnAt: 0,
        lootTable: [
          { itemId: 'raw_meat', min: 4, max: 6 },
          { itemId: 'clean_water', min: 2, max: 3 },
        ],
      };
    case 'trex':
      return {
        id,
        species,
        nameVi: 'Bạo Chúa Hoàng Cổ T-Rex',
        iconEmoji: '🦖',
        isPredator: true,
        originWorldX,
        originWorldY,
        currentWorldX: originWorldX,
        currentWorldY: originWorldY,
        maxHp: 1200,
        currentHp: 1200,
        isAggro: false,
        isChasing: false,
        isFleeing: false,
        aggroRadiusMeters: 32.0,
        leashRadiusMeters: 60.0,
        attackRangeMeters: 8.5,
        damage: 55,
        attackCooldownMs: 1600,
        lastAttackTime: 0,
        speedMps: 5.0, // ~18 km/h
        isDefeated: false,
        respawnAt: 0,
        lootTable: [
          { itemId: 'raw_meat', min: 5, max: 8 },
          { itemId: 'leather', min: 4, max: 6 },
          { itemId: 'gold_ore', min: 1, max: 2 },
        ],
      };
    case 'raptor':
      return {
        id,
        species,
        nameVi: 'Bầy Nhạn Long Tốc Độ',
        iconEmoji: '🦖',
        isPredator: true,
        originWorldX,
        originWorldY,
        currentWorldX: originWorldX,
        currentWorldY: originWorldY,
        maxHp: 180,
        currentHp: 180,
        isAggro: false,
        isChasing: false,
        isFleeing: false,
        aggroRadiusMeters: 28.0,
        leashRadiusMeters: 52.0,
        attackRangeMeters: 5.5,
        damage: 24,
        attackCooldownMs: 900,
        lastAttackTime: 0,
        speedMps: 5.8, // ~21 km/h
        isDefeated: false,
        respawnAt: 0,
        lootTable: [
          { itemId: 'raw_meat', min: 1, max: 2 },
          { itemId: 'leather', min: 1, max: 1 },
        ],
      };
    case 'spinosaurus':
      return {
        id,
        species,
        nameVi: 'Khủng Long Gai Cánh Buồm',
        iconEmoji: '🐊',
        isPredator: true,
        originWorldX,
        originWorldY,
        currentWorldX: originWorldX,
        currentWorldY: originWorldY,
        maxHp: 950,
        currentHp: 950,
        isAggro: false,
        isChasing: false,
        isFleeing: false,
        aggroRadiusMeters: 30.0,
        leashRadiusMeters: 55.0,
        attackRangeMeters: 8.0,
        damage: 45,
        attackCooldownMs: 1300,
        lastAttackTime: 0,
        speedMps: 4.6,
        isDefeated: false,
        respawnAt: 0,
        lootTable: [
          { itemId: 'raw_meat', min: 4, max: 7 },
          { itemId: 'leather', min: 3, max: 5 },
        ],
      };
    case 'dilophosaurus':
      return {
        id,
        species,
        nameVi: 'Song Mào Phun Độc',
        iconEmoji: '🦎',
        isPredator: true,
        originWorldX,
        originWorldY,
        currentWorldX: originWorldX,
        currentWorldY: originWorldY,
        maxHp: 220,
        currentHp: 220,
        isAggro: false,
        isChasing: false,
        isFleeing: false,
        aggroRadiusMeters: 26.0,
        leashRadiusMeters: 48.0,
        attackRangeMeters: 7.5,
        damage: 26,
        attackCooldownMs: 1100,
        lastAttackTime: 0,
        speedMps: 4.8,
        isDefeated: false,
        respawnAt: 0,
        lootTable: [
          { itemId: 'raw_meat', min: 2, max: 3 },
          { itemId: 'leather', min: 1, max: 2 },
        ],
      };
    case 'triceratops':
      return {
        id,
        species,
        nameVi: 'Khủng Long Ba Sừng',
        iconEmoji: '🦏',
        isPredator: false,
        originWorldX,
        originWorldY,
        currentWorldX: originWorldX,
        currentWorldY: originWorldY,
        maxHp: 700,
        currentHp: 700,
        isAggro: false,
        isChasing: false,
        isFleeing: false,
        aggroRadiusMeters: 20.0,
        leashRadiusMeters: 45.0,
        attackRangeMeters: 7.0,
        damage: 36,
        attackCooldownMs: 1800,
        lastAttackTime: 0,
        speedMps: 3.8,
        isDefeated: false,
        respawnAt: 0,
        lootTable: [
          { itemId: 'raw_meat', min: 4, max: 6 },
          { itemId: 'leather', min: 3, max: 4 },
          { itemId: 'iron_ore', min: 1, max: 2 },
        ],
      };
    case 'ankylosaurus':
      return {
        id,
        species,
        nameVi: 'Khủng Long Thiết Giáp',
        iconEmoji: '🐢',
        isPredator: false,
        originWorldX,
        originWorldY,
        currentWorldX: originWorldX,
        currentWorldY: originWorldY,
        maxHp: 800,
        currentHp: 800,
        isAggro: false,
        isChasing: false,
        isFleeing: false,
        aggroRadiusMeters: 18.0,
        leashRadiusMeters: 40.0,
        attackRangeMeters: 6.5,
        damage: 30,
        attackCooldownMs: 2000,
        lastAttackTime: 0,
        speedMps: 2.8,
        isDefeated: false,
        respawnAt: 0,
        lootTable: [
          { itemId: 'raw_meat', min: 3, max: 5 },
          { itemId: 'leather', min: 3, max: 4 },
          { itemId: 'stone_block', min: 2, max: 3 },
        ],
      };
    case 'brachiosaurus':
      return {
        id,
        species,
        nameVi: 'Khủng Long Cổ Dài Vĩ Đại',
        iconEmoji: '🦕',
        isPredator: false,
        originWorldX,
        originWorldY,
        currentWorldX: originWorldX,
        currentWorldY: originWorldY,
        maxHp: 1400,
        currentHp: 1400,
        isAggro: false,
        isChasing: false,
        isFleeing: false,
        aggroRadiusMeters: 16.0,
        leashRadiusMeters: 40.0,
        attackRangeMeters: 8.5,
        damage: 40,
        attackCooldownMs: 2200,
        lastAttackTime: 0,
        speedMps: 2.5,
        isDefeated: false,
        respawnAt: 0,
        lootTable: [
          { itemId: 'raw_meat', min: 6, max: 10 },
          { itemId: 'leather', min: 5, max: 8 },
        ],
      };
    case 'pterosaur':
      return {
        id,
        species,
        nameVi: 'Thằn LẰn Bay Dực Long',
        iconEmoji: '🦅',
        isPredator: false,
        originWorldX,
        originWorldY,
        currentWorldX: originWorldX,
        currentWorldY: originWorldY,
        maxHp: 150,
        currentHp: 150,
        isAggro: false,
        isChasing: false,
        isFleeing: false,
        aggroRadiusMeters: 22.0,
        leashRadiusMeters: 55.0,
        attackRangeMeters: 6.0,
        damage: 18,
        attackCooldownMs: 1000,
        lastAttackTime: 0,
        speedMps: 6.5, // ~23.4 km/h
        isDefeated: false,
        respawnAt: 0,
        lootTable: [
          { itemId: 'raw_meat', min: 1, max: 2 },
          { itemId: 'feather', min: 2, max: 3 },
        ],
      };
    case 'horse':
    default:
      return {
        id,
        species,
        nameVi: 'Bãi Ngựa Hoang Tiền Sử',
        iconEmoji: '🐎',
        isPredator: false,
        originWorldX,
        originWorldY,
        currentWorldX: originWorldX,
        currentWorldY: originWorldY,
        maxHp: 120,
        currentHp: 120,
        isAggro: false,
        isChasing: false,
        isFleeing: false,
        aggroRadiusMeters: 16.0,
        leashRadiusMeters: 35.0,
        attackRangeMeters: 4.5,
        damage: 0,
        attackCooldownMs: 9999,
        lastAttackTime: 0,
        speedMps: 4.2,
        isDefeated: false,
        respawnAt: 0,
        lootTable: [
          { itemId: 'raw_meat', min: 1, max: 2 },
          { itemId: 'leather', min: 1, max: 1 },
        ],
      };
  }
}

/**
 * Cập nhật AI di chuyển & truy đuổi của tất cả các bầy dã thú trong thế giới thực
 */
export function updateDynamicBeastPacks(
  packs: Map<string, DynamicBeastPack>,
  playerWorldX: number,
  playerWorldY: number,
  dtSeconds: number,
  nowMs: number,
  onPlayerAttacked?: (beast: DynamicBeastPack, damage: number) => void,
): void {
  for (const beast of packs.values()) {
    // Kiểm tra hồi sinh
    if (beast.isDefeated) {
      if (nowMs >= beast.respawnAt) {
        beast.isDefeated = false;
        beast.currentHp = beast.maxHp;
        beast.currentWorldX = beast.originWorldX;
        beast.currentWorldY = beast.originWorldY;
        beast.isAggro = false;
        beast.isChasing = false;
      }
      continue;
    }

    const distToPlayer = Math.hypot(beast.currentWorldX - playerWorldX, beast.currentWorldY - playerWorldY);
    const distFromOrigin = Math.hypot(beast.currentWorldX - beast.originWorldX, beast.currentWorldY - beast.originWorldY);

    if (beast.isPredator) {
      // 1. Dã thú ăn thịt (Sói, Sư tử, Gấu, Lợn lòi, Báo)
      if (distToPlayer <= beast.aggroRadiusMeters && distFromOrigin <= beast.leashRadiusMeters) {
        // Trong tầm kích động và chưa vượt quá giới hạn lãnh địa: Truy đuổi!
        beast.isAggro = true;
        beast.isChasing = true;

        // Cơ chế bầy đàn: Đánh động các dã thú ăn thịt lân cận trong bán kính 30m
        for (const other of packs.values()) {
          if (other.id !== beast.id && other.isPredator && !other.isDefeated) {
            const dOther = Math.hypot(other.currentWorldX - beast.currentWorldX, other.currentWorldY - beast.currentWorldY);
            if (dOther <= 30.0) {
              other.isAggro = true;
              other.isChasing = true;
            }
          }
        }

        // Tiến về phía người chơi
        const dx = playerWorldX - beast.currentWorldX;
        const dy = playerWorldY - beast.currentWorldY;
        const len = Math.hypot(dx, dy) || 1;

        if (distToPlayer > beast.attackRangeMeters * 0.75) {
          const moveStep = Math.min(distToPlayer, beast.speedMps * dtSeconds);
          beast.currentWorldX += (dx / len) * moveStep;
          beast.currentWorldY += (dy / len) * moveStep;
        }

        // Cắn xé người chơi khi trong cự ly cận chiến
        if (distToPlayer <= beast.attackRangeMeters && nowMs - beast.lastAttackTime >= beast.attackCooldownMs) {
          beast.lastAttackTime = nowMs;
          if (onPlayerAttacked) {
            onPlayerAttacked(beast, beast.damage);
          }
        }
      } else {
        // Ngoài tầm phát hiện hoặc người chơi chạy thoát xa khỏi vùng lãnh địa (> 45m): Từ bỏ và quay về tổ!
        beast.isAggro = false;
        beast.isChasing = false;

        if (distFromOrigin > 0.5) {
          const dx = beast.originWorldX - beast.currentWorldX;
          const dy = beast.originWorldY - beast.currentWorldY;
          const len = Math.hypot(dx, dy) || 1;
          const returnStep = Math.min(distFromOrigin, (beast.speedMps * 0.65) * dtSeconds);
          beast.currentWorldX += (dx / len) * returnStep;
          beast.currentWorldY += (dy / len) * returnStep;
        }
      }
    } else {
      // 2. Thú ăn cỏ (Hươu, Ngựa)
      if (distToPlayer <= beast.aggroRadiusMeters) {
        beast.isFleeing = true;
        if (distFromOrigin < beast.leashRadiusMeters) {
          const dx = beast.currentWorldX - playerWorldX;
          const dy = beast.currentWorldY - playerWorldY;
          const len = Math.hypot(dx, dy) || 1;
          const fleeStep = beast.speedMps * dtSeconds;
          beast.currentWorldX += (dx / len) * fleeStep;
          beast.currentWorldY += (dy / len) * fleeStep;
        }
      } else {
        beast.isFleeing = false;
        if (distFromOrigin > 1.0) {
          const dx = beast.originWorldX - beast.currentWorldX;
          const dy = beast.originWorldY - beast.currentWorldY;
          const len = Math.hypot(dx, dy) || 1;
          const walkStep = (beast.speedMps * 0.4) * dtSeconds;
          beast.currentWorldX += (dx / len) * walkStep;
          beast.currentWorldY += (dy / len) * walkStep;
        }
      }
    }
  }
}

/**
 * Người chơi tấn công / săn bắt một bầy dã thú
 */
export function huntDynamicBeastPack(
  beast: DynamicBeastPack,
  player: PlayerState,
  nowMs: number,
): {
  ok: boolean;
  messageVi: string;
  damageDealt: number;
  beastRemainingHp: number;
  isDefeated: boolean;
  lootGained?: ItemStack[];
  nextPlayer: PlayerState;
} {
  if (beast.isDefeated) {
    return {
      ok: false,
      messageVi: `${beast.nameVi} đã bị hạ gục trước đó và đang hồi sinh.`,
      damageDealt: 0,
      beastRemainingHp: 0,
      isDefeated: true,
      nextPlayer: player,
    };
  }

  // 1. Tính toán sát thương người chơi dựa vào vũ khí trang bị (Cân bằng thực tế)
  let playerDmg = 8; // Tay không
  if (countOf(player.carried, 'divine_dragon_bow') > 0) playerDmg = 65;
  else if (countOf(player.carried, 'iron_spear') > 0) playerDmg = 48; // Giáo sắt chuyên dụng săn thú lớn
  else if (countOf(player.carried, 'iron_axe') > 0) playerDmg = 28; // Rìu sắt đốn củi
  else if (countOf(player.carried, 'stone_axe') > 0) playerDmg = 20; // Rìu đá sơ khai
  else if (countOf(player.carried, 'sharp_stone') > 0) playerDmg = 14; // Đá nhọn gọt đẽo

  // Bonus thêm từ Linh thú đồng hành
  const activePet = player.pets?.find((p: any) => p.isActive);
  if (activePet) {
    playerDmg += Math.round(activePet.level * 2.5);
  }

  // Ngẫu nhiên nhẹ ±15% sát thương
  const actualDmg = Math.round(playerDmg * (0.85 + Math.random() * 0.3));
  beast.currentHp = Math.max(0, beast.currentHp - actualDmg);
  beast.isAggro = true;

  const nextPlayer: PlayerState = {
    ...player,
    carried: { ...player.carried },
    survival: {
      ...player.survival,
      // Đánh thú tiêu hao thể lực & đói
      stamina: Math.max(0, (player.survival.stamina ?? 100) - 3),
      hunger: Math.max(0, player.survival.hunger - 1),
    },
  };

  if (beast.currentHp <= 0) {
    // Đã hạ gục bầy thú!
    beast.isDefeated = true;
    beast.respawnAt = nowMs + 5 * 60 * 1000; // 5 phút respawn

    const lootGained: ItemStack[] = [];
    for (const entry of beast.lootTable) {
      const qty = Math.floor(entry.min + Math.random() * (entry.max - entry.min + 1));
      if (qty > 0) {
        nextPlayer.carried[entry.itemId] = (nextPlayer.carried[entry.itemId] || 0) + qty;
        lootGained.push({ itemId: entry.itemId, qty });
      }
    }

    const lootSummary = lootGained
      .map(item => `${item.qty} ${item.itemId === 'raw_meat' ? 'Thịt tươi 🥩' : item.itemId === 'leather' ? 'Da thú 🦣' : item.itemId === 'ancient_coin' ? 'Đồng vàng cổ 🪙' : 'Xương thú 🦴'}`)
      .join(', ');

    return {
      ok: true,
      messageVi: `⚔️ SĂN BẮT THÀNH CÔNG! Đã hạ gục ${beast.nameVi}! Thu hoạch: ${lootSummary}.`,
      damageDealt: actualDmg,
      beastRemainingHp: 0,
      isDefeated: true,
      lootGained,
      nextPlayer,
    };
  }

  return {
    ok: true,
    messageVi: `🗡️ Tấn công ${beast.nameVi}! Gây ${actualDmg} sát thương (${beast.currentHp}/${beast.maxHp} HP).`,
    damageDealt: actualDmg,
    beastRemainingHp: beast.currentHp,
    isDefeated: false,
    nextPlayer,
  };
}

/**
 * Người chơi bắn cung hoặc ném đá từ xa vào dã thú (Ranged Combat)
 */
export function huntDynamicBeastRanged(
  beast: DynamicBeastPack,
  player: PlayerState,
  nowMs: number,
  preferredWeapon?: 'bow' | 'stone',
): {
  ok: boolean;
  messageVi: string;
  damageDealt: number;
  ammoConsumed?: ItemId;
  weaponUsed: 'bow' | 'stone';
  beastRemainingHp: number;
  isDefeated: boolean;
  lootGained?: ItemStack[];
  nextPlayer: PlayerState;
} {
  if (beast.isDefeated) {
    return {
      ok: false,
      messageVi: `${beast.nameVi} đã bị hạ gục trước đó và đang hồi sinh.`,
      damageDealt: 0,
      weaponUsed: 'stone',
      beastRemainingHp: 0,
      isDefeated: true,
      nextPlayer: player,
    };
  }

  const hasBow = countOf(player.carried, 'bow') > 0 || countOf(player.carried, 'divine_dragon_bow') > 0;
  const arrowCount = countOf(player.carried, 'arrow');
  const stoneCount = countOf(player.carried, 'sharp_stone');

  let weaponUsed: 'bow' | 'stone' = 'stone';
  let ammoConsumed: ItemId | undefined;
  let baseDmg = 14;

  if ((preferredWeapon === 'bow' || !preferredWeapon) && hasBow && arrowCount > 0) {
    weaponUsed = 'bow';
    ammoConsumed = 'arrow';
    const isDivineBow = countOf(player.carried, 'divine_dragon_bow') > 0;
    baseDmg = isDivineBow ? 65 : 34;
  } else if (stoneCount > 0) {
    weaponUsed = 'stone';
    ammoConsumed = 'sharp_stone';
    baseDmg = 14;
  } else if (hasBow && arrowCount <= 0) {
    return {
      ok: false,
      messageVi: '🏹 Bạn có Cung nhưng đã hết Mũi Tên trong túi đồ!',
      damageDealt: 0,
      weaponUsed: 'bow',
      beastRemainingHp: beast.currentHp,
      isDefeated: false,
      nextPlayer: player,
    };
  } else {
    return {
      ok: false,
      messageVi: '🎒 Cần có Cung + Mũi Tên hoặc Đá Nhọn trong túi để tấn công từ xa!',
      damageDealt: 0,
      weaponUsed: 'stone',
      beastRemainingHp: beast.currentHp,
      isDefeated: false,
      nextPlayer: player,
    };
  }

  // Bonus sát thương từ Linh thú đồng hành
  const activePet = player.pets?.find((p: any) => p.isActive);
  if (activePet) {
    baseDmg += Math.round(activePet.level * 3);
  }

  // Ngẫu nhiên nhẹ ±15%
  const actualDmg = Math.round(baseDmg * (0.88 + Math.random() * 0.24));
  beast.currentHp = Math.max(0, beast.currentHp - actualDmg);
  beast.isAggro = true; // Bị trúng đạn dã thú sẽ kích động đuổi theo người bắn

  const nextCarried = { ...player.carried };
  if (ammoConsumed && nextCarried[ammoConsumed] !== undefined) {
    nextCarried[ammoConsumed] = Math.max(0, nextCarried[ammoConsumed] - 1);
    if (nextCarried[ammoConsumed] === 0) {
      delete nextCarried[ammoConsumed];
    }
  }

  const nextPlayer: PlayerState = {
    ...player,
    carried: nextCarried,
    survival: {
      ...player.survival,
      stamina: Math.max(0, (player.survival.stamina ?? 100) - 2),
    },
  };

  if (beast.currentHp <= 0) {
    beast.isDefeated = true;
    beast.respawnAt = nowMs + 5 * 60 * 1000;

    const lootGained: ItemStack[] = [];
    for (const entry of beast.lootTable) {
      const qty = Math.floor(entry.min + Math.random() * (entry.max - entry.min + 1));
      if (qty > 0) {
        nextPlayer.carried[entry.itemId] = (nextPlayer.carried[entry.itemId] || 0) + qty;
        lootGained.push({ itemId: entry.itemId, qty });
      }
    }

    const lootSummary = lootGained
      .map(item => `${item.qty} ${item.itemId === 'raw_meat' ? 'Thịt tươi 🥩' : item.itemId === 'leather' ? 'Da thú 🦣' : item.itemId === 'ancient_coin' ? 'Đồng vàng cổ 🪙' : 'Xương thú 🦴'}`)
      .join(', ');

    const weaponName = weaponUsed === 'bow' ? '🏹 Bắn cung' : '🪨 Ném đá nhọn';
    return {
      ok: true,
      messageVi: `🎯 ${weaponName} bắn trúng tim ${beast.nameVi} (-${actualDmg} HP)! Thu hoạch: ${lootSummary}.`,
      damageDealt: actualDmg,
      ammoConsumed,
      weaponUsed,
      beastRemainingHp: 0,
      isDefeated: true,
      lootGained,
      nextPlayer,
    };
  }

  const weaponVerb = weaponUsed === 'bow' ? '🏹 Bắn cung trúng' : '🪨 Ném đá trúng';
  return {
    ok: true,
    messageVi: `🎯 ${weaponVerb} ${beast.nameVi}! Gây ${actualDmg} sát thương (${beast.currentHp}/${beast.maxHp} HP).`,
    damageDealt: actualDmg,
    ammoConsumed,
    weaponUsed,
    beastRemainingHp: beast.currentHp,
    isDefeated: false,
    nextPlayer,
  };
}
