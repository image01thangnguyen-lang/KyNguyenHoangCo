/**
 * Hệ thống Nông Nghiệp & Trồng Trọt Tiền Sử Quanh Trại (Phụ lục B).
 *
 * Người chơi gieo hạt giống nhặt được từ rừng hoặc đổi từ thương nhân.
 * Cây phát triển theo thời gian thực; ngày mưa tự động tưới nước; người chơi có thể
 * tưới nước chủ động từ bình nước múc được. Khi chín, thu hoạch quả mọng, thảo dược, hạt giống.
 */

import FARMING_DATA from '../data/farming.json' with { type: 'json' };

                          
             
                     
                 
                      
                      
                                                         
                 
 

                           
                
                        
                             
                             
                               
                          
 

export const CROPS = FARMING_DATA.crops             ;

export function getCropDef(cropId        )          {
  const found = CROPS.find((c) => c.id === cropId);
  if (!found) throw new Error(`Không tìm thấy loại cây: ${cropId}`);
  return found;
}

/** Số lượng luống đất trồng theo cấp độ doanh trại. */
export function farmPlotsForCampLevel(campLevel        )         {
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
export function createInitialFarmPlots(campLevel        )             {
  const count = farmPlotsForCampLevel(campLevel);
  const plots             = [];
  for (let i = 0; i < count; i++) {
    plots.push({
      index: i,
      cropId: null,
      plantedAtMs: null,
      waterLevel: 1,
      lastWateredMs: null,
      readyToHarvest: false,
    });
  }
  return plots;
}

/** Cập nhật tiến độ phát triển của tất cả luống đất trồng. */
export function tickFarmPlots(
  plots            ,
  campLevel        ,
  nowMs        ,
  isRaining         ,
)             {
  const targetCount = farmPlotsForCampLevel(campLevel);
  const updated             = [];

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

    const growthDurationMs = crop.growthHours * 3600_000;
    const elapsed = nowMs - existing.plantedAtMs;
    const hasEnoughWater = water >= crop.waterNeeded;
    const isReady = elapsed >= growthDurationMs && hasEnoughWater;

    updated.push({
      ...existing,
      waterLevel: water,
      readyToHarvest: isReady,
    });
  }

  return updated;
}

/** Gieo hạt vào một luống đất trống. */
export function plantInPlot(
  plots            ,
  plotIndex        ,
  cropId        ,
  nowMs        ,
)                                                        {
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
        }
      : p,
  );

  return {
    plots: updated,
    ok: true,
    messageVi: `🌱 Đã gieo ${crop.nameVi} vào luống số ${plotIndex + 1}!`,
  };
}

/** Tưới nước cho một luống cây. */
export function waterPlot(
  plots            ,
  plotIndex        ,
  nowMs        ,
)                                                        {
  const plot = plots.find((p) => p.index === plotIndex);
  if (!plot) return { plots, ok: false, messageVi: 'Luống đất không tồn tại.' };

  const updated = plots.map((p) =>
    p.index === plotIndex
      ? {
          ...p,
          waterLevel: Math.min(3, p.waterLevel + 1),
          lastWateredMs: nowMs,
        }
      : p,
  );

  return {
    plots: updated,
    ok: true,
    messageVi: `💧 Đã tưới nước cho luống số ${plotIndex + 1}! Đất đã đủ ẩm.`,
  };
}

/** Thu hoạch nông sản từ luống đã chín. */
export function harvestPlot(
  plots            ,
  plotIndex        ,
)   
                    
              
                                  
                    
  {
  const plot = plots.find((p) => p.index === plotIndex);
  if (!plot || !plot.cropId) {
    return { plots, ok: false, rewards: {}, messageVi: 'Không có cây nào để thu hoạch.' };
  }
  if (!plot.readyToHarvest) {
    return { plots, ok: false, rewards: {}, messageVi: 'Cây chưa chín. Hãy kiên nhẫn đợi thêm hoặc tưới thêm nước!' };
  }

  const crop = getCropDef(plot.cropId);
  const rewards                         = {};
  for (const r of crop.harvestRewards) {
    rewards[r.itemId] = (rewards[r.itemId] ?? 0) + r.qty;
  }

  const updated = plots.map((p) =>
    p.index === plotIndex
      ? {
          ...p,
          cropId: null,
          plantedAtMs: null,
          readyToHarvest: false,
          waterLevel: 1,
        }
      : p,
  );

  return {
    plots: updated,
    ok: true,
    rewards,
    messageVi: `🌾 Thu hoạch thành công ${crop.nameVi}! Nông trại tươi tốt đầy ắp lương thực.`,
  };
}
