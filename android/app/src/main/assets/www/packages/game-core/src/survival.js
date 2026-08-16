/**
 * Ba chỉ số sinh tồn: Đói, Khát, Thể lực (§5.1).
 *
 * Điều chỉnh quan trọng nhất so với kịch bản v0: đói giảm CHỦ YẾU theo thời gian
 * (-5%/giờ), đi bộ chỉ cộng rất nhẹ (-1 điểm mỗi 1.000 bước). Nhờ vậy người đi bộ nhiều
 * luôn lãi ròng — xem test bất biến "đi bộ luôn có lãi" trong survival.test.ts.
 */

import { SURVIVAL, getItem } from './balance.js';
import { rollChance } from './rng.js';
import { HOUR_MS } from './time.js';
                                                                                       

const SUB_TICK_MINUTES = 10;
const SUB_TICK_MS = SUB_TICK_MINUTES * 60_000;

export function createSurvivalState(nowMs        )                {
  return {
    satiety: SURVIVAL.satiety.startValue,
    hydration: SURVIVAL.hydration.startValue,
    hp: SURVIVAL.hp.startValue,
    sickUntilMs: null,
    asleep: false,
    lastTickMs: nowMs,
  };
}

                              
                                                                                   
                 
                                        
                   
                                                                                            
                                  
                                    
                                                            
                           
                                        
                        
                                           
                       
                                                                      
                   
 

const clamp = (value        , min        , max        )         =>
  value < min ? min : value > max ? max : value;

/**
 * Mô phỏng tiến từ `state.lastTickMs` tới `nowMs` theo từng nhịp 10 phút.
 *
 * Chia nhịp nhỏ thay vì nhân trực tiếp cả khoảng vì thứ tự các hiệu ứng có ý nghĩa:
 * chỉ số phải cạn TRƯỚC rồi HP mới bắt đầu tụt, nếu không người chơi offline 8 tiếng
 * sẽ bị trừ HP cho cả 8 tiếng dù chỉ thực sự cạn nước ở tiếng thứ 7.
 */
export function tickSurvival(
  state               ,
  nowMs        ,
  options              = {},
)                     {
  if (options.frozen) {
    // Đồng hồ máy bị lùi: dừng đồng hồ game lại, không suy giảm, không hồi phục (§4.3).
    return {
      survival: { ...state, lastTickMs: nowMs },
      hpLost: 0,
      knockedOut: false,
      hoursSimulated: 0,
      cappedByOfflineLimit: false,
    };
  }

  const elapsedMs = Math.max(0, nowMs - state.lastTickMs);
  const maxMs = SURVIVAL.offlineCatchUp.maxHoursSimulated * HOUR_MS;
  const cappedByOfflineLimit = elapsedMs > maxMs;
  const simulatedMs = Math.min(elapsedMs, maxMs);

  const subTicks = Math.floor(simulatedMs / SUB_TICK_MS);
  const stepsPerSubTick = subTicks > 0 ? (options.steps ?? 0) / subTicks : 0;

  let { satiety, hydration, hp, sickUntilMs, hypothermiaUntilMs, heatstrokeUntilMs, fatiguedUntilMs, lastSleepMs } = state;
  const asleep = state.asleep;
  const hpBefore = hp;
  let knockedOut = false;

  // Nếu ngủ tại doanh trại: chữa lành cảm lạnh, say nắng và giải tỏa kiệt sức
  if (asleep && options.atCamp) {
    hypothermiaUntilMs = null;
    heatstrokeUntilMs = null;
    fatiguedUntilMs = null;
    lastSleepMs = nowMs;
  } else {
    // Kiểm tra nếu không ngủ quá 36 giờ (game time) thì dính kiệt sức
    const timeSinceSleepMs = nowMs - (lastSleepMs ?? state.lastTickMs);
    if (timeSinceSleepMs > 36 * HOUR_MS) {
      fatiguedUntilMs = nowMs + 4 * HOUR_MS;
    }
  }

  for (let i = 0; i < subTicks; i++) {
    const tickEndMs = state.lastTickMs + (i + 1) * SUB_TICK_MS;
    const sick = sickUntilMs !== null && tickEndMs < sickUntilMs;
    const sickMul = sick ? SURVIVAL.sickness.decayMultiplierWhileSick : 1;
    const hoursFraction = SUB_TICK_MINUTES / 60;

    const satietyRate = asleep
      ? SURVIVAL.satiety.decayPerHourAsleep
      : SURVIVAL.satiety.decayPerHourAwake;
    const hydrationRate = asleep
      ? SURVIVAL.hydration.decayPerHourAsleep
      : SURVIVAL.hydration.decayPerHourAwake;

    let satietyWeather = options.satietyDecayMultiplier ?? 1;
    let hydrationWeather = options.hydrationDecayMultiplier ?? 1;

    // Cảm lạnh do dầm mưa: đói nhanh hơn 30%
    if (hypothermiaUntilMs && tickEndMs < hypothermiaUntilMs) {
      satietyWeather *= 1.3;
    }

    // Say nắng trưa hè: khát nhanh hơn 100%
    if (heatstrokeUntilMs && tickEndMs < heatstrokeUntilMs) {
      hydrationWeather *= 2.0;
    }

    // Quá tải trọng lượng: đi bộ tốn gấp đôi độ Đói (-2 điểm/1000 bước)
    const stepDecayMultiplier = options.isOverburdened ? 2.0 : 1.0;

    satiety -= satietyRate * hoursFraction * sickMul * satietyWeather;
    satiety -= (stepsPerSubTick / 1000) * SURVIVAL.satiety.decayPer1000Steps * stepDecayMultiplier;
    hydration -= hydrationRate * hoursFraction * sickMul * hydrationWeather;
    hydration -= (stepsPerSubTick / 1000) * SURVIVAL.hydration.decayPer1000Steps;

    satiety = clamp(satiety, 0, SURVIVAL.satiety.max);
    hydration = clamp(hydration, 0, SURVIVAL.hydration.max);

    // Khát tụt HP nhanh hơn đói (§5.1).
    if (hydration <= 0) hp -= SURVIVAL.hydration.emptyHpLossPer10Min;
    if (satiety <= 0) hp -= SURVIVAL.satiety.emptyHpLossPer10Min;

    if (hydration > 0 && satiety > 0) {
      if (asleep && options.atCamp) {
        hp += SURVIVAL.hp.regenPerHourAsleepAtCamp * hoursFraction;
      } else if (satiety >= SURVIVAL.hp.wellFedThreshold) {
        hp += SURVIVAL.hp.regenPerHourIdleWellFed * hoursFraction;
      }
    }

    hp = clamp(hp, 0, SURVIVAL.hp.max);
    if (hp <= 0) {
      knockedOut = true;
      break;
    }
  }

  if (sickUntilMs !== null && nowMs >= sickUntilMs) sickUntilMs = null;
  if (hypothermiaUntilMs && nowMs >= hypothermiaUntilMs) hypothermiaUntilMs = null;
  if (heatstrokeUntilMs && nowMs >= heatstrokeUntilMs) heatstrokeUntilMs = null;
  if (fatiguedUntilMs && nowMs >= fatiguedUntilMs) fatiguedUntilMs = null;

  if (cappedByOfflineLimit) {
    satiety = Math.max(satiety, SURVIVAL.offlineCatchUp.floorSatiety);
    hydration = Math.max(hydration, SURVIVAL.offlineCatchUp.floorHydration);
    hp = Math.max(hp, SURVIVAL.offlineCatchUp.floorHp);
    knockedOut = false;
  }

  const survival                = {
    satiety: round1(satiety),
    hydration: round1(hydration),
    hp: round1(hp),
    sickUntilMs,
    asleep,
    lastTickMs: nowMs,
    hypothermiaUntilMs,
    heatstrokeUntilMs,
    fatiguedUntilMs,
    lastSleepMs: lastSleepMs ?? state.lastTickMs,
  };

  return {
    survival,
    hpLost: round1(Math.max(0, hpBefore - survival.hp)),
    knockedOut,
    hoursSimulated: round1(simulatedMs / HOUR_MS),
    cappedByOfflineLimit,
  };
}

                                
              
                    
                          
                   
                     
 

/**
 * Ăn/uống một vật phẩm. Nước thô có 40% nhiễm bệnh (§5.1) — dùng "tỉ lệ nhiễm bệnh"
 * thay cho "trừ máu cứng" của kịch bản v0 để cảm giác tự nhiên hơn và vẫn dạy được
 * người chơi rằng phải đun nước.
 */
export function consumeItem(
  survival               ,
  itemId        ,
  nowMs        ,
  rng              ,
)                {
  const item = getItem(itemId);
  const isConsumable =
    item.kind === 'food' || item.kind === 'drink' || item.kind === 'consumable';

  if (!isConsumable) {
    return { ok: false, reasonVi: `${item.nameVi} không dùng để ăn hoặc uống.`, survival, gotSick: false };
  }

  let { satiety, hydration, hp, sickUntilMs, hypothermiaUntilMs, heatstrokeUntilMs, fatiguedUntilMs, lastSleepMs } = survival;
  satiety = clamp(satiety + (item.satiety ?? 0), 0, SURVIVAL.satiety.max);
  hydration = clamp(hydration + (item.hydration ?? 0), 0, SURVIVAL.hydration.max);
  hp = clamp(hp + (item.hp ?? 0), 0, SURVIVAL.hp.max);

  if (item.curesSickness) sickUntilMs = null;
  if ((item       ).curesHypothermia) hypothermiaUntilMs = null;
  if ((item       ).curesFatigue) {
    fatiguedUntilMs = null;
    lastSleepMs = nowMs;
  }

  let gotSick = false;
  let messageVi                    ;

  if (item.infectionRisk && rollChance(rng, SURVIVAL.sickness.rawWaterInfectionChance)) {
    gotSick = true;
    hp = clamp(hp - SURVIVAL.sickness.hpLoss, 0, SURVIVAL.hp.max);
    sickUntilMs = nowMs + SURVIVAL.sickness.durationMinutes * 60_000;
    messageVi = 'Nước chưa đun có mùi lạ. Bạn bắt đầu đau bụng — lần sau hãy đun sôi trước khi uống.';
  }

  return {
    ok: true,
    survival: {
      ...survival,
      satiety: round1(satiety),
      hydration: round1(hydration),
      hp: round1(hp),
      sickUntilMs,
      hypothermiaUntilMs,
      heatstrokeUntilMs,
      fatiguedUntilMs,
      lastSleepMs,
    },
    gotSick,
    messageVi,
  };
}

/** Ngất: tỉnh lại ở trại, rơi 30% đồ đang mang, kho trong trại còn nguyên (§5.1). */
export function applyKnockout(survival               )                {
  return {
    ...survival,
    hp: SURVIVAL.knockout.respawnHp,
    satiety: Math.max(survival.satiety, SURVIVAL.knockout.respawnSatiety),
    hydration: Math.max(survival.hydration, SURVIVAL.knockout.respawnHydration),
    asleep: false,
  };
}

/**
 * Dự phóng mức tiêu hao một ngày — dùng cho test bất biến "đi bộ luôn có lãi"
 * và cho bảng cân bằng của designer.
 */
export function projectDailyDrain(
  steps        ,
  hoursAwake = 16,
)                                         {
  return {
    satiety:
      SURVIVAL.satiety.decayPerHourAwake * hoursAwake +
      SURVIVAL.satiety.decayPerHourAsleep * (24 - hoursAwake) +
      (steps / 1000) * SURVIVAL.satiety.decayPer1000Steps,
    hydration:
      SURVIVAL.hydration.decayPerHourAwake * hoursAwake +
      SURVIVAL.hydration.decayPerHourAsleep * (24 - hoursAwake) +
      (steps / 1000) * SURVIVAL.hydration.decayPer1000Steps,
  };
}

/** Tính tổng trọng lượng (kg) của các vật phẩm trong túi đồ (không tính tiền vàng). */
export function calculateCarriedWeight(carried           )         {
  let total = 0;
  for (const [itemId, qty] of Object.entries(carried)) {
    if (qty <= 0 || itemId === 'ancient_coin') continue;
    const def = getItem(itemId);
    total += (def.weight ?? 1) * qty;
  }
  return round1(total);
}

/**
 * Chi phí nâng cấp Thể Lực / Sức Khỏe bằng Đồng Vàng Cổ (Cấp 1..10).
 * Mỗi cấp tăng +5kg tải trọng ba lô.
 */
export const STRENGTH_UPGRADE_COSTS                         = {
  1: 25,
  2: 60,
  3: 120,
  4: 220,
  5: 380,
  6: 600,
  7: 950,
  8: 1450,
  9: 2200,
};

export const MAX_STRENGTH_LEVEL = 10;

export function getStrengthUpgradeInfo(currentLevel = 1)                                                         {
  const isMax = currentLevel >= MAX_STRENGTH_LEVEL;
  const cost = STRENGTH_UPGRADE_COSTS[currentLevel] ?? 2200;
  const nextCapacity = 45 + currentLevel * 5;
  return { cost, nextCapacity, isMax };
}

/** Tải trọng tối đa của ba lô (chuẩn 45kg, +5kg mỗi cấp Thể Lực, +30kg nếu có Ba Lô Da Voi, +25kg nếu có linh thú thồ hàng). */
export function maxWeightCapacity(pets        , carried            , strengthLevel = 1)         {
  const bonusStrength = Math.max(0, strengthLevel - 1) * 5;
  let capacity = 45 + bonusStrength;
  if (carried && (carried['giant_backpack'] ?? 0) > 0) {
    capacity += 30;
  }
  const activePet = pets?.find((p) => p.isActive);
  if (activePet && (activePet.petId === 'mammoth' || activePet.petId === 'horse' || activePet.petId === 'rhino')) {
    capacity += 25;
  }
  return capacity;
}

/**
 * Nâng cấp Sức Khỏe / Thể Lực bằng Đồng Vàng Cổ (ancient_coin).
 */
export function upgradeStrength(player             )                                                               {
  const currentLvl = player.strengthLevel ?? 1;
  if (currentLvl >= MAX_STRENGTH_LEVEL) {
    return { player, success: false, messageVi: 'Thể lực của bạn đã đạt đến cảnh giới tối đa (Cấp 10 - Thể Lực Kim Cương)!' };
  }

  const { cost } = getStrengthUpgradeInfo(currentLvl);
  const carriedCoin = player.carried['ancient_coin'] ?? 0;
  const safeCoin = player.safeStorage['ancient_coin'] ?? 0;
  const totalCoin = carriedCoin + safeCoin;

  if (totalCoin < cost) {
    return {
      player,
      success: false,
      messageVi: `Không đủ Đồng Vàng Cổ! Cần ${cost} Đồng Vàng để nâng lên Cấp ${currentLvl + 1} (Bạn đang có: ${totalCoin} Vàng).`,
    };
  }

  // Khấu trừ Đồng Vàng Cổ (ưu tiên trừ trong túi trước, thiếu thì trừ trong két)
  const updatedCarried = { ...player.carried };
  const updatedSafe = { ...player.safeStorage };

  if (carriedCoin >= cost) {
    updatedCarried['ancient_coin'] = carriedCoin - cost;
    if (updatedCarried['ancient_coin'] === 0) delete updatedCarried['ancient_coin'];
  } else {
    const remaining = cost - carriedCoin;
    delete updatedCarried['ancient_coin'];
    updatedSafe['ancient_coin'] = safeCoin - remaining;
    if (updatedSafe['ancient_coin'] === 0) delete updatedSafe['ancient_coin'];
  }

  const newLvl = currentLvl + 1;
  const updatedPlayer              = {
    ...player,
    carried: updatedCarried,
    safeStorage: updatedSafe,
    strengthLevel: newLvl,
  };

  const newCap = maxWeightCapacity(updatedPlayer.pets, updatedPlayer.carried, newLvl);
  return {
    player: updatedPlayer,
    success: true,
    messageVi: `💪 Chúc mừng! Đã nâng Thể Lực lên Cấp ${newLvl}! Sức chứa ba lô tăng lên ${newCap}kg (+5kg).`,
  };
}

// ---------------------------------------------------------------- NÂNG CẤP TỐC ĐỘ THÂN PHÁP (SPEED SYSTEM)

/**
 * Chi phí nâng cấp Tốc Độ Thân Pháp bằng Đồng Vàng Cổ (ancient_coin) hoặc Da Thú / Thảo Dược.
 * Mỗi cấp tăng +0.6 km/h. Thể lực tăng thêm +0.15 km/h mỗi cấp.
 */
export const SPEED_UPGRADE_COSTS                                                                                                         = {
  1: { coin: 20, resourceItem: 'wood', resourceQty: 5, resourceNameVi: 'Gỗ khô' },
  2: { coin: 50, resourceItem: 'fiber', resourceQty: 8, resourceNameVi: 'Sợi dây rừng' },
  3: { coin: 95, resourceItem: 'leather', resourceQty: 3, resourceNameVi: 'Da thuộc' },
  4: { coin: 160, resourceItem: 'medicinal_herb', resourceQty: 4, resourceNameVi: 'Cây ngải cứu' },
  5: { coin: 260, resourceItem: 'cured_leather', resourceQty: 4, resourceNameVi: 'Da đanh' },
  6: { coin: 400, resourceItem: 'giant_feather', resourceQty: 2, resourceNameVi: 'Lông vũ linh điểu' },
  7: { coin: 620, resourceItem: 'mineral_salt', resourceQty: 3, resourceNameVi: 'Muối mỏ' },
  8: { coin: 920, resourceItem: 'ancient_iron', resourceQty: 2, resourceNameVi: 'Quặng sắt thô' },
  9: { coin: 1400, resourceItem: 'spirit_herb', resourceQty: 1, resourceNameVi: 'Linh chi nghìn năm' },
};

export const MAX_SPEED_LEVEL = 10;

export function getSpeedUpgradeInfo(currentLevel = 1)   
                   
                        
                       
                          
                       
                 
  {
  const isMax = currentLevel >= MAX_SPEED_LEVEL;
  const cfg = SPEED_UPGRADE_COSTS[currentLevel] ?? { coin: 200 };
  const nextSpeedKmh = Math.round((5.0 + currentLevel * 0.6) * 10) / 10;
  return {
    costCoin: cfg.coin,
    resourceItem: cfg.resourceItem,
    resourceQty: cfg.resourceQty,
    resourceNameVi: cfg.resourceNameVi,
    nextSpeedKmh,
    isMax,
  };
}

/**
 * Tính vận tốc di chuyển thực tế (km/h) của nhân vật.
 * - Tốc độ cơ bản: 18.0 km/h (~5.0 m/s, chạy nhanh linh hoạt trên bản đồ)
 * - Tăng theo Cấp Thân Pháp: +3.0 km/h mỗi cấp (tối đa 45.0 km/h ở Cấp 10)
 * - Tăng theo Cấp Thể Lực / Sức Khỏe: +0.8 km/h mỗi cấp Thể Lực
 * - Bonus từ Linh Thú xuất chiến (Báo răng kiếm / Khủng long con): +5.0 km/h
 * - Phạt khi quá tải trọng lượng ba lô: Giảm 30% tốc độ
 */
export function calcMovementSpeedKmh(player             )         {
  const speedLvl = player.speedLevel ?? 1;
  const strengthLvl = player.strengthLevel ?? 1;

  let speed = 18.0 + Math.max(0, speedLvl - 1) * 3.0 + Math.max(0, strengthLvl - 1) * 0.8;

  const activePet = player.pets?.find((p) => p.isActive);
  if (activePet && (activePet.petId === 'sabertooth' || activePet.petId === 'velociraptor' || activePet.petId === 'horse')) {
    speed += 5.0;
  }

  const maxWeight = maxWeightCapacity(player.pets, player.carried, strengthLvl);
  if (isOverburdened(player.carried, maxWeight)) {
    speed *= 0.70;
  }

  return Math.round(speed * 10) / 10;
}

/**
 * Nâng cấp Tốc Độ Thân Pháp (Speed Level) bằng Đồng Vàng Cổ hoặc Tài Nguyên.
 */
export function upgradeSpeed(player             )                                                               {
  const currentLvl = player.speedLevel ?? 1;
  if (currentLvl >= MAX_SPEED_LEVEL) {
    return { player, success: false, messageVi: 'Thân pháp của bạn đã đạt đến cảnh giới tối đa (Cấp 10 - Thần Hành Bách Biến)!' };
  }

  const info = getSpeedUpgradeInfo(currentLvl);
  const carriedCoin = player.carried['ancient_coin'] ?? 0;
  const safeCoin = player.safeStorage['ancient_coin'] ?? 0;
  const totalCoin = carriedCoin + safeCoin;

  if (totalCoin < info.costCoin) {
    return {
      player,
      success: false,
      messageVi: `Không đủ Đồng Vàng Cổ! Cần ${info.costCoin} Đồng Vàng để nâng Thân Pháp lên Cấp ${currentLvl + 1} (Bạn đang có: ${totalCoin} Vàng).`,
    };
  }

  // Khấu trừ Đồng Vàng Cổ
  const updatedCarried = { ...player.carried };
  const updatedSafe = { ...player.safeStorage };

  if (carriedCoin >= info.costCoin) {
    updatedCarried['ancient_coin'] = carriedCoin - info.costCoin;
    if (updatedCarried['ancient_coin'] === 0) delete updatedCarried['ancient_coin'];
  } else {
    const remaining = info.costCoin - carriedCoin;
    delete updatedCarried['ancient_coin'];
    updatedSafe['ancient_coin'] = safeCoin - remaining;
    if (updatedSafe['ancient_coin'] === 0) delete updatedSafe['ancient_coin'];
  }

  const newLvl = currentLvl + 1;
  const updatedPlayer              = {
    ...player,
    carried: updatedCarried,
    safeStorage: updatedSafe,
    speedLevel: newLvl,
  };

  const newSpeed = calcMovementSpeedKmh(updatedPlayer);
  return {
    player: updatedPlayer,
    success: true,
    messageVi: `⚡ Chúc mừng! Đã nâng Thân Pháp lên Cấp ${newLvl}! Tốc độ di chuyển tăng lên ${newSpeed} km/h.`,
  };
}

/** Kiểm tra túi đồ có bị quá tải trọng lượng không. */
export function isOverburdened(carried           , maxWeight = 45)          {
  return calculateCarriedWeight(carried) > maxWeight;
}

/**
 * Kiểm tra thức ăn tươi sống (thịt tươi, cá tươi) bị ôi thiu theo thời gian.
 * Mặc định: quá 36h bị ôi thiu.
 * Nếu có Muối Mỏ (mineral_salt): kéo dài thời gian tươi ngon lên 7 ngày (168h)!
 */
export function checkFoodSpoilage(
  carried           ,
  elapsedHours        ,
)                                                                   {
  const maxFreshHours = (carried['mineral_salt'] ?? 0) > 0 ? 168 : 36;
  if (elapsedHours < maxFreshHours) {
    return { carried, spoiledCount: 0 };
  }

  let spoiledCount = 0;
  const updated = { ...carried };

  const rawMeat = updated['raw_meat'] ?? 0;
  if (rawMeat > 0) {
    spoiledCount += rawMeat;
    delete updated['raw_meat'];
  }

  const rawFish = updated['raw_fish'] ?? 0;
  if (rawFish > 0) {
    spoiledCount += rawFish;
    delete updated['raw_fish'];
  }

  if (spoiledCount > 0) {
    updated['spoiled_meat'] = (updated['spoiled_meat'] ?? 0) + spoiledCount;
    return {
      carried: updated,
      spoiledCount,
      messageVi: `⚠️ ${spoiledCount} miếng thịt/cá tươi đã bị ôi thiu do để lâu! Có thể dùng làm phân bón luống đất.`,
    };
  }

  return { carried, spoiledCount: 0 };
}

/** Gợi ý cho HUD: chỉ số nào đang nguy hiểm nhất hoặc trạng thái bất lợi. */
export function survivalWarnings(
  survival               ,
  carried            ,
  pets        ,
  nowMs         ,
)           {
  const warnings           = [];
  const currentTime = nowMs ?? Date.now();

  if (survival.hydration <= 15) warnings.push('Khát cháy cổ — cần nước ngay.');
  else if (survival.hydration <= 35) warnings.push('Bạn đang khát.');
  if (survival.satiety <= 15) warnings.push('Đói rã rời — cần ăn ngay.');
  else if (survival.satiety <= 35) warnings.push('Bạn đang đói.');
  if (survival.hp <= 30) warnings.push('Thể lực rất thấp — hãy về trại nghỉ.');
  if (survival.sickUntilMs !== null && currentTime < survival.sickUntilMs) {
    warnings.push('Bạn đang bị bệnh: chỉ số tụt nhanh hơn 50%.');
  }
  if (survival.hypothermiaUntilMs && currentTime < survival.hypothermiaUntilMs) {
    if (!carried || (carried['rain_fur_cloak'] ?? 0) <= 0) {
      warnings.push('❄️ Đang bị cảm lạnh do dầm mưa: Đói nhanh hơn 30%. Về trại sưởi ấm!');
    }
  }
  if (survival.heatstrokeUntilMs && currentTime < survival.heatstrokeUntilMs) {
    if (!carried || (carried['sun_hat'] ?? 0) <= 0) {
      warnings.push('☀️ Đang bị say nắng trưa hè: Khát nhanh gấp đôi. Cần uống nước!');
    }
  }
  if (survival.fatiguedUntilMs && currentTime < survival.fatiguedUntilMs) {
    warnings.push('💤 Đang bị kiệt sức do thức đêm > 36h: Giảm 30% sức đánh. Hãy về trại ngủ!');
  }

  if (carried) {
    const totalW = calculateCarriedWeight(carried);
    const maxW = maxWeightCapacity(pets, carried);
    if (totalW > maxW) {
      warnings.push(`⚖️ Ba lô quá tải (${totalW}/${maxW}kg): Đi bộ tiêu hao Đói gấp đôi!`);
    }
    const hasHerbPouch = (carried['herb_scent_pouch'] ?? 0) > 0;
    const rawCount = (carried['raw_meat'] ?? 0) + (carried['raw_fish'] ?? 0);
    if (rawCount >= 10 && !hasHerbPouch) {
      warnings.push(`🩸 Mang ${rawCount} thịt tươi: Mùi máu sẽ thu hút bầy quái đêm lúc 20:00!`);
    }
  }

  return warnings;
}

export function foodValue(inv           )         {
  let total = 0;
  for (const [itemId, qty] of Object.entries(inv)) {
    total += (getItem(itemId).satiety ?? 0) * qty;
  }
  return total;
}

export function drinkValue(inv           )         {
  let total = 0;
  for (const [itemId, qty] of Object.entries(inv)) {
    total += (getItem(itemId).hydration ?? 0) * qty;
  }
  return total;
}

function round1(value        )         {
  return Math.round(value * 10) / 10;
}
