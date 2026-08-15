/**
 * Hệ thống Nông Nghiệp & Trồng Trọt Tiền Sử Quanh Trại (Phụ lục B).
 *
 * Người chơi gieo hạt giống nhặt được từ rừng hoặc đổi từ thương nhân.
 * Cây phát triển theo thời gian thực; ngày mưa tự động tưới nước; người chơi có thể
 * tưới nước chủ động từ bình nước múc được. Khi chín, thu hoạch quả mọng, thảo dược, hạt giống.
 */

import FARMING_DATA from '../data/farming.json' with { type: 'json' };

export interface CropDef {
  id: string;
  seedItemId: string;
  nameVi: string;
  growthHours: number;
  waterNeeded: number;
  harvestRewards: Array<{ itemId: string; qty: number }>;
  descVi: string;
}

export interface FarmPlot {
  index: number;
  cropId: string | null;
  plantedAtMs: number | null;
  waterLevel: number; // 0..3
  lastWateredMs: number | null;
  readyToHarvest: boolean;
  /** true nếu cây đã chín nhưng bị để quá 48 tiếng và bị héo rũ */
  wilted?: boolean;
  /** true nếu luống đất đã được bón phân hữu cơ (thịt ôi/phân bón) giúp tăng tốc lớn 35% */
  fertilized?: boolean;
}

export const CROPS = FARMING_DATA.crops as CropDef[];

export function getCropDef(cropId: string): CropDef {
  const found = CROPS.find((c) => c.id === cropId);
  if (!found) throw new Error(`Không tìm thấy loại cây: ${cropId}`);
  return found;
}

/** Số lượng luống đất trồng theo cấp độ doanh trại. */
export function farmPlotsForCampLevel(campLevel: number): number {
  switch (campLevel) {
    case 1:
      return 2;
    case 2:
      return 4;
    case 3:
    default:
      return 6;
  }
}

/** Khởi tạo danh sách luống đất ban đầu cho doanh trại. */
export function createInitialFarmPlots(campLevel: number): FarmPlot[] {
  const count = farmPlotsForCampLevel(campLevel);
  const plots: FarmPlot[] = [];
  for (let i = 0; i < count; i++) {
    plots.push({
      index: i,
      cropId: null,
      plantedAtMs: null,
      waterLevel: 1,
      lastWateredMs: null,
      readyToHarvest: false,
      wilted: false,
      fertilized: false,
    });
  }
  return plots;
}

/** Cập nhật tiến độ phát triển của tất cả luống đất trồng. */
export function tickFarmPlots(
  plots: FarmPlot[],
  campLevel: number,
  nowMs: number,
  isRaining: boolean,
): FarmPlot[] {
  const targetCount = farmPlotsForCampLevel(campLevel);
  const updated: FarmPlot[] = [];

  for (let i = 0; i < targetCount; i++) {
    const existing = plots[i];
    if (!existing) {
      updated.push({
        index: i,
        cropId: null,
        plantedAtMs: null,
        waterLevel: isRaining ? 3 : 1,
        lastWateredMs: isRaining ? nowMs : null,
        readyToHarvest: false,
        wilted: false,
        fertilized: false,
      });
      continue;
    }

    if (!existing.cropId || !existing.plantedAtMs) {
      updated.push({
        ...existing,
        waterLevel: isRaining ? 3 : existing.waterLevel,
      });
      continue;
    }

    const crop = getCropDef(existing.cropId);
    let water = existing.waterLevel;
    if (isRaining) {
      water = Math.max(water, crop.waterNeeded);
    }

    let growthDurationMs = crop.growthHours * 3600_000;
    if (existing.fertilized) {
      growthDurationMs = Math.round(growthDurationMs * 0.65); // Bón phân hữu cơ lớn nhanh hơn 35%
    }

    const elapsed = nowMs - existing.plantedAtMs;
    const hasEnoughWater = water >= crop.waterNeeded;
    const isReady = elapsed >= growthDurationMs && hasEnoughWater;

    // Phạt cây héo nếu đã chín quá 48 tiếng mà không thu hoạch
    let isWilted = existing.wilted ?? false;
    if (isReady && !isWilted) {
      const overTimeMs = elapsed - growthDurationMs;
      if (overTimeMs > 48 * 3600_000) {
        isWilted = true;
      }
    }

    updated.push({
      ...existing,
      waterLevel: water,
      readyToHarvest: isReady,
      wilted: isWilted,
    });
  }

  return updated;
}

/** Bón phân hữu cơ (từ thịt ôi/phân bón) cho luống cây giúp lớn nhanh hơn 35%. */
export function fertilizePlot(
  plots: FarmPlot[],
  plotIndex: number,
): { plots: FarmPlot[]; ok: boolean; messageVi: string } {
  const plot = plots.find((p) => p.index === plotIndex);
  if (!plot) return { plots, ok: false, messageVi: 'Luống đất không tồn tại.' };
  if (!plot.cropId) return { plots, ok: false, messageVi: 'Chưa có cây trồng trên luống này để bón phân.' };
  if (plot.fertilized) return { plots, ok: false, messageVi: 'Luống này đã được bón phân hữu cơ rồi.' };

  const updated = plots.map((p) =>
    p.index === plotIndex ? { ...p, fertilized: true } : p,
  );

  return {
    plots: updated,
    ok: true,
    messageVi: `🌱 Đã bón phân hữu cơ cho luống số ${plotIndex + 1}! Tốc độ sinh trưởng tăng +35%.`,
  };
}

/** Gieo hạt vào một luống đất trống. */
export function plantInPlot(
  plots: FarmPlot[],
  plotIndex: number,
  cropId: string,
  nowMs: number,
): { plots: FarmPlot[]; ok: boolean; messageVi: string } {
  const plot = plots.find((p) => p.index === plotIndex);
  if (!plot) return { plots, ok: false, messageVi: 'Luống đất không tồn tại.' };
  if (plot.cropId) return { plots, ok: false, messageVi: 'Luống này đã có cây trồng.' };

  const crop = getCropDef(cropId);
  const updated = plots.map((p) =>
    p.index === plotIndex
      ? {
          ...p,
          cropId,
          plantedAtMs: nowMs,
          waterLevel: 1,
          lastWateredMs: nowMs,
          readyToHarvest: false,
          wilted: false,
          fertilized: false,
        }
      : p,
  );

  return {
    plots: updated,
    ok: true,
    messageVi: `🌱 Đã gieo ${crop.nameVi} vào luống số ${plotIndex + 1}!`,
  };
}

/** Tưới nước cho một luống cây (đồng thời hồi sinh cây bị héo). */
export function waterPlot(
  plots: FarmPlot[],
  plotIndex: number,
  nowMs: number,
): { plots: FarmPlot[]; ok: boolean; messageVi: string } {
  const plot = plots.find((p) => p.index === plotIndex);
  if (!plot) return { plots, ok: false, messageVi: 'Luống đất không tồn tại.' };

  const wasWilted = plot.wilted ?? false;
  const updated = plots.map((p) =>
    p.index === plotIndex
      ? {
          ...p,
          waterLevel: Math.min(3, p.waterLevel + 1),
          lastWateredMs: nowMs,
          wilted: false, // Tưới nước hồi sinh lại cây héo
        }
      : p,
  );

  const messageVi = wasWilted
    ? `💧 Đã tưới nước và hồi sinh cây trồng bị héo trên luống ${plotIndex + 1}!`
    : `💧 Đã tưới nước cho luống số ${plotIndex + 1}! Đất đã đủ ẩm.`;

  return {
    plots: updated,
    ok: true,
    messageVi,
  };
}

/** Thu hoạch nông sản từ luống đã chín (giảm 50% nếu cây bị héo). */
export function harvestPlot(
  plots: FarmPlot[],
  plotIndex: number,
): {
  plots: FarmPlot[];
  ok: boolean;
  rewards: Record<string, number>;
  messageVi: string;
} {
  const plot = plots.find((p) => p.index === plotIndex);
  if (!plot || !plot.cropId) {
    return { plots, ok: false, rewards: {}, messageVi: 'Không có cây nào để thu hoạch.' };
  }
  if (!plot.readyToHarvest) {
    return { plots, ok: false, rewards: {}, messageVi: 'Cây chưa chín. Hãy kiên nhẫn đợi thêm hoặc tưới thêm nước!' };
  }

  const crop = getCropDef(plot.cropId);
  const isWilted = plot.wilted ?? false;
  const rewards: Record<string, number> = {};

  for (const r of crop.harvestRewards) {
    const qty = isWilted ? Math.max(1, Math.floor(r.qty * 0.5)) : r.qty;
    rewards[r.itemId] = (rewards[r.itemId] ?? 0) + qty;
  }

  const updated = plots.map((p) =>
    p.index === plotIndex
      ? {
          ...p,
          cropId: null,
          plantedAtMs: null,
          readyToHarvest: false,
          wilted: false,
          fertilized: false,
          waterLevel: 1,
        }
      : p,
  );

  const messageVi = isWilted
    ? `🌾 Đã thu hoạch ${crop.nameVi} (sản lượng giảm 50% do cây bị héo quá hạn)!`
    : `🌾 Thu hoạch thành công ${crop.nameVi}! Nông trại tươi tốt đầy ắp lương thực.`;

  return {
    plots: updated,
    ok: true,
    rewards,
    messageVi,
  };
}
