/**
 * Facade của toàn bộ game — nơi các hệ thống gặp nhau.
 *
 * Ở bản 1.0 online, vai trò này thuộc về API server: client gửi sự kiện, server tính toán và
 * là nguồn sự thật duy nhất. Bản 2.0 offline không có server, nên chính module này giữ vai
 * trò đó, chỉ khác là nó chạy ngay trên máy người chơi.
 *
 * Ràng buộc tự đặt, và cố ý giữ nghiêm:
 *  - Mọi hàm đều THUẦN KHIẾT: nhận `ProfileSave`, trả `ProfileSave` mới cùng kết quả.
 *  - Không đọc `Date.now()`, không đụng storage, không gọi mạng. Thời gian luôn được truyền vào.
 *    Nhờ vậy toàn bộ vòng lặp một tuần chơi test được trong vài mili giây, và ngày mai nếu
 *    dựng lại client bằng Unity thì chỉ cần viết lại tầng UI.
 */

import { DEVICE_CHECKS, ZONES, findItem, getItem } from './balance.js';
import { readClock } from './clock.js';
import {
  collectCraft,
  finishCampUpgrade,
  recipeBoard,
  startCampUpgrade,
  startCraft,
  upgradeProgress,
} from './crafting.js';
import {
  actionsFor,
  findAction,
  merchantOffers,
  performGatherAction,
  syncSteps,
} from './gathering.js';
import {
  addItems,
  countOf,
  dropFraction,
  moveFromSafe,
  moveToSafe,
  removeItems,
  slotsUsed,
  upgradeSafeVault,
} from './inventory.js';
import { forecastTonight, resolveNightDefense } from './nightDefense.js';
import { createRng, hashSeed } from './rng.js';
import { checkSpeed, createSpeedState, dueReminders } from './safety.js';
import { filterSteps } from './stepFilter.js';
import {
  applyKnockout,
  consumeItem,
  survivalWarnings,
  tickSurvival,
  isOverburdened,
  maxWeightCapacity,
  checkFoodSpoilage,
} from './survival.js';
import { dayKey, isNightDefenseWindow, outdoorPolicy, phaseOf, toLocalTime } from './time.js';
import {
  advanceAfterBloodMoon,
  demoGate,
  markBeatPlayed,
  pendingBeats,
  questBoard,
  settleQuests,
} from './story.js';
import { modifiersOf, rainHarvest, weatherFor } from './weather.js';
import { locationAt, scanArea } from './world.js';
import {
  attackBoss,
  bloodMoonStatus,
  settleBloodMoon,
  startBloodMoon,
  tickAllies,
} from './bloodMoon.js';

                                                                   
                                             
                                                                      
                                                                       
                                                 
                                                              
                                              
                                                          

export const GAME_VERSION = '0.2.0-prototype';

/** Mọi thứ tầng UI cần để vẽ một khung hình. */
                           
                
                    
                                     
                                                                              
                        
                                                 
                            
                               
                                          
                                              
                      
                                                
                                              
                                    
                     
                           
                      
                     
 

                               
                       
                                                                      
                   
                                                     
                   
                                                                         
                             
                                                                                        
                          
                        
                                                                                    
                                                                                    
                         
 

                                
                       
                 
                                                                                                
                     
                    
                  
                     
                      
                           
 

/**
 * Mở app: đây là nhịp tim của game.
 *
 * Thứ tự các bước có ý nghĩa và không được đảo: đồng hồ → lọc bước → thời tiết → mô phỏng
 * sinh tồn cho quãng vắng mặt → quy đổi bước thành tài nguyên → thu hoạch nguội (mưa, bẫy,
 * lò, nâng cấp) → cốt truyện. Nếu quy đổi tài nguyên chạy trước mô phỏng sinh tồn thì người
 * chơi sẽ nhặt đồ bằng "cơ thể của ngày hôm qua", và mọi phép cân bằng lệch đi một nhịp.
 */
export function openApp(input              )                {
  const { deviceMs, position, pack = null, offsetMinutes } = input;
  let profile = input.profile;
  const eventsVi           = [];

  // 1. Đồng hồ (§4.3)
  const clock = readClock(profile.clock, deviceMs);
  const nowMs = clock.nowMs;
  profile = { ...profile, clock: clock.state };
  if (clock.rolledBack && clock.messageVi) eventsVi.push(clock.messageVi);

  const today = dayKey(nowMs, offsetMinutes);
  const local = toLocalTime(nowMs, offsetMinutes);

  // 2. Lọc bước, cộng cả phần hoãn từ lần trước
  const rawSteps = Math.max(0, input.newSteps) + profile.pendingSteps;
  const elapsedMs = Math.max(1, nowMs - profile.lastPlayedMs);
  const filtered = filterSteps({
    rawNewSteps: rawSteps,
    elapsedMs,
    stepIntervalsMs: input.stepIntervalsMs,
  });
  profile = { ...profile, pendingSteps: filtered.deferred };
  if (filtered.noteVi) eventsVi.push(filtered.noteVi);

  // 3. Thời tiết (thuần trên máy; thời tiết thật chỉ là lớp phủ tuỳ chọn)
  const at = position ?? homePosition(profile);
  const weather = weatherFor(at, nowMs, offsetMinutes);
  const finalWeather =
    profile.settings.realWeatherSync && input.realWeather
      ? { ...weather, ...applyRealOverlay(weather, input.realWeather) }
      : weather;
  const mods = modifiersOf(finalWeather);

  // 4. Sinh tồn cho quãng vắng mặt
  const maxW = maxWeightCapacity(profile.player.pets);
  const isOver = isOverburdened(profile.player.carried, maxW);

  const tick = tickSurvival(profile.player.survival, nowMs, {
    steps: filtered.accepted,
    atCamp: profile.player.survival.asleep,
    satietyDecayMultiplier: mods.satietyDecayMultiplier,
    hydrationDecayMultiplier: mods.hydrationDecayMultiplier,
    isOverburdened: isOver,
    frozen: clock.survivalFrozen,
  });
  let player = { ...profile.player, survival: tick.survival };

  // Kiểm tra thịt/cá tươi sống bị ôi thiu khi mở app sau nhiều giờ
  const spoilage = checkFoodSpoilage(player.carried, tick.hoursSimulated);
  if (spoilage.spoiledCount > 0) {
    player = { ...player, carried: spoilage.carried };
    if (spoilage.messageVi) eventsVi.push(spoilage.messageVi);
  }

  if (tick.hoursSimulated >= 1) {
    eventsVi.push(`Bạn vắng mặt ${formatHours(tick.hoursSimulated)}.`);
  }
  if (tick.cappedByOfflineLimit) {
    eventsVi.push('Bạn vắng hơn một ngày — chỉ số được giữ ở mức sàn thay vì để bạn chết khi mở app.');
  }

  let knockedOut = false;
  if (tick.knockedOut) {
    knockedOut = true;
    const drop = dropFraction(player.carried, 0.3);
    player = { ...player, survival: applyKnockout(tick.survival), carried: drop.kept };
    eventsVi.push(
      `Bạn ngất giữa đường và tỉnh dậy ở trại. Mất ${describeInventory(drop.lost) || 'không đáng kể'}. Kho trong trại còn nguyên.`,
    );
  }

  // 5. Quy đổi bước thành tài nguyên
  const location = position ? locationAt(position, visiblePack(pack, profile)) : null;
  const zone         = location?.zone ?? 'wilderness';
  const sync = syncSteps({
    playerId: player.id,
    ledger: player.steps,
    newSteps: filtered.accepted,
    nowMs,
    zone,
    raining: finalWeather.raining,
    offsetMinutes,
  });

  let gained = sync.result.gained;
  player = { ...player, steps: sync.ledger };

  if (sync.result.pickups > 0) {
    eventsVi.push(
      `${filtered.accepted.toLocaleString('vi-VN')} bước → ${sync.result.pickups} lượt nhặt: ${describeInventory(gained)}.`,
    );
  }
  if (sync.result.cappedSteps > 0) {
    eventsVi.push(
      `Bạn đã chạm trần thưởng ${DEVICE_CHECKS.stepReward.dailyCap.toLocaleString('vi-VN')} bước hôm nay. Bước vẫn được đếm đủ, chỉ không sinh thêm tài nguyên.`,
    );
  }

  // 6. Thu hoạch nguội: mưa, bẫy, lò, nâng cấp trại
  const hoursAway = Math.max(0, (nowMs - profile.lastPlayedMs) / 3_600_000);
  const rain = rainHarvest(finalWeather, hoursAway, player.camp.stations.includes('campfire'));
  if (rain.qty > 0) {
    gained = addItems(gained, [{ itemId: 'raw_water', qty: rain.qty }]);
    if (rain.messageVi) eventsVi.push(rain.messageVi);
  }

  const trapHarvest = collectReadyTraps(profile, nowMs);
  if (trapHarvest.qty > 0) {
    gained = addItems(gained, trapHarvest.gained);
    profile = { ...profile, traps: trapHarvest.traps };
    eventsVi.push(`Bẫy đã dính: ${describeInventory(trapHarvest.gained)}.`);
  }

  player = { ...player, carried: addItems(player.carried, gained) };

  const jobs = collectFinishedJobs(profile, player.carried, player.camp, nowMs);
  player = { ...player, carried: jobs.inventory, camp: jobs.camp };
  profile = { ...profile, craftJobs: jobs.remaining };
  eventsVi.push(...jobs.messagesVi);

  const upgraded = finishCampUpgrade(player.camp, nowMs);
  if (upgraded.upgraded) {
    player = { ...player, camp: upgraded.camp };
    if (upgraded.messageVi) eventsVi.push(upgraded.messageVi);
  }

  // 7. Số liệu tích luỹ + ngày mới
  const dayRolled = profile.lastActiveDay !== today;
  player = {
    ...player,
    lifetime: {
      ...player.lifetime,
      steps: player.lifetime.steps + filtered.accepted,
      collected: mergeCounts(player.lifetime.collected, gained),
      visitedZones: location ? unique([...player.lifetime.visitedZones, location.zone]) : player.lifetime.visitedZones,
      daysPlayed: player.lifetime.daysPlayed + (dayRolled ? 1 : 0),
    },
  };

  profile = {
    ...profile,
    player,
    lastActiveDay: today,
    lastPlayedMs: nowMs,
    poiUsage: profile.poiUsage.day === today ? profile.poiUsage : { day: today, uses: {}, lastUsedAtMs: {} },
  };

  // 8. Cốt truyện — xương sống của bản offline (§5.6)
  const beats = pendingBeats(profile.story, profile.player.lifetime.steps);
  const settled = settleQuests(profile.story, snapshotOf(profile));
  if (settled.newlyCompleted.length > 0) {
    profile = {
      ...profile,
      story: settled.state,
      player: { ...profile.player, carried: addItems(profile.player.carried, settled.rewards) },
    };
    for (const quest of settled.newlyCompleted) {
      eventsVi.push(`Xong nhiệm vụ: ${quest.titleVi}.`);
    }
    if (settled.messageVi) eventsVi.push(settled.messageVi);
  }

  return {
    profile,
    view: buildView(profile, nowMs, at, position, pack, finalWeather, offsetMinutes),
    eventsVi,
    gained,
    pickups: sync.result.pickups,
    beats,
    knockedOut,
    clockRolledBack: clock.rolledBack,
  };
}

// ------------------------------------------------------------------ khung nhìn

export function buildView(
  profile             ,
  nowMs        ,
  at        ,
  position               ,
  pack                ,
  weather              ,
  offsetMinutes         ,
)           {
  const visible = visiblePack(pack, profile);
  const policy = outdoorPolicy(nowMs, profile.settings.parentalNightLock, offsetMinutes);
  const dayNumber = Math.max(
    1,
    Math.floor((nowMs - profile.player.createdAtMs) / 86_400_000) + 1,
  );

  return {
    nowMs,
    dayNumber,
    phase: phaseOf(nowMs, offsetMinutes),
    localTime: toLocalTime(nowMs, offsetMinutes),
    weather,
    location: position ? locationAt(position, visible) : null,
    mapFeatures: scanArea(at, 700, visible),
    survivalWarningsVi: survivalWarnings(profile.player.survival, profile.player.carried, profile.player.pets, nowMs),
    recipes: recipeBoard(profile.player.camp, profile.player.carried, profile.player.knownRecipes),
    upgrade: upgradeProgress(profile.player.camp, profile.player.carried),
    quests: questBoard(profile.story, snapshotOf(profile)),
    bloodMoon: bloodMoonStatus(nowMs, foughtThisWeek(profile, nowMs, offsetMinutes), offsetMinutes),
    tonight: forecastTonight(profile.player.camp),
    demo: demoGate(profile.story, dayNumber),
    poiLocked: policy.poiLocked,
    poiLockReasonVi: policy.reasonVi,
    storageUsed: slotsUsed(profile.player.carried),
    storageMax: 40 * profile.player.camp.level,
  };
}

// ------------------------------------------------------------------ hành động của người chơi

                                   
                       
              
                    
 

export function craft(profile             , recipeId        , nowMs        , atCamp         )                   {
  const craftCount = profile.player.lifetime.craftCount ?? 0;
  const attempt = startCraft({
    recipeId,
    camp: profile.player.camp,
    inventory: profile.player.carried,
    nowMs,
    atCamp,
    knownRecipes: profile.player.knownRecipes,
    currentCraftJobsCount: profile.craftJobs.length,
    totalCraftCount: craftCount,
    artisanLevel: profile.player.artisanLevel ?? 1,
  });

  if (!attempt.ok) return { profile, ok: false, messageVi: attempt.reasonVi ?? 'Không chế tạo được.' };

  return {
    profile: {
      ...profile,
      player: { ...profile.player, carried: attempt.inventory },
      craftJobs: [...profile.craftJobs, { recipeId, readyAtMs: attempt.readyAtMs  }],
    },
    ok: true,
    messageVi: `Bắt đầu chế tạo. Xong sau ${formatSeconds((attempt.readyAtMs  - nowMs) / 1000)}.`,
  };
}

export function collectCrafts(profile             , nowMs        )                                              {
  const jobs = collectFinishedJobs(profile, profile.player.carried, profile.player.camp, nowMs);
  if (jobs.messagesVi.length === 0) {
    return { profile, ok: false, messageVi: 'Chưa có gì xong.', messagesVi: [] };
  }

  const newCraftCount = (profile.player.lifetime.craftCount ?? 0) + jobs.craftedIds.length;
  const newCraftedRecipeIds = Array.from(new Set([...profile.player.lifetime.craftedRecipeIds, ...jobs.craftedIds]));

  return {
    profile: {
      ...profile,
      player: {
        ...profile.player,
        carried: jobs.inventory,
        camp: jobs.camp,
        lifetime: {
          ...profile.player.lifetime,
          craftCount: newCraftCount,
          craftedRecipeIds: newCraftedRecipeIds,
        },
      },
      craftJobs: jobs.remaining,
    },
    ok: true,
    messageVi: jobs.messagesVi.join(' '),
    messagesVi: jobs.messagesVi,
  };
}

export function upgradeCamp(profile             , nowMs        )                   {
  const attempt = startCampUpgrade(profile.player.camp, profile.player.carried, nowMs);
  if (!attempt.ok) return { profile, ok: false, messageVi: attempt.reasonVi ?? 'Chưa nâng cấp được.' };

  return {
    profile: { ...profile, player: { ...profile.player, camp: attempt.camp, carried: attempt.inventory } },
    ok: true,
    messageVi: `Bắt đầu nâng cấp doanh trại. Xong sau ${formatSeconds((attempt.completeAtMs  - nowMs) / 1000)}.`,
  };
}

export function consume(profile             , itemId        , nowMs        )                   {
  if (countOf(profile.player.carried, itemId) < 1) {
    return { profile, ok: false, messageVi: `Bạn không có ${getItem(itemId).nameVi}.` };
  }

  const rng = createRng(hashSeed(profile.player.id, itemId, nowMs));
  const result = consumeItem(profile.player.survival, itemId, nowMs, rng);
  if (!result.ok) return { profile, ok: false, messageVi: result.reasonVi ?? 'Không dùng được.' };

  return {
    profile: {
      ...profile,
      player: {
        ...profile.player,
        survival: result.survival,
        carried: removeItems(profile.player.carried, [{ itemId, qty: 1 }]),
      },
    },
    ok: true,
    messageVi: result.messageVi ?? `Đã dùng ${getItem(itemId).nameVi}.`,
  };
}

                              
                       
                   
                
               
                
                          
                         
                     
                         
 

/**
 * Hành động chủ động tại POI (chặt gỗ, múc nước, câu cá, đặt bẫy, đổi hàng).
 *
 * Hai lớp chặn bắt buộc chạy TRƯỚC mọi thứ khác, không có ngoại lệ (§6.1):
 * khoá tốc độ trên 12 km/h, và khoá POI ban đêm nếu phụ huynh bật.
 */
export function gather(input             )                                           {
  const { profile, actionId, poiId, zone, nowMs, offsetMinutes } = input;

  if (input.speed?.locked) {
    return { profile, ok: false, messageVi: DEVICE_CHECKS.safety.messageVi, gained: {} };
  }

  const policy = outdoorPolicy(nowMs, profile.settings.parentalNightLock, offsetMinutes);
  if (policy.poiLocked) {
    return { profile, ok: false, messageVi: policy.reasonVi ?? 'POI đang khoá.', gained: {} };
  }

  const usageKey = `${poiId}:${actionId}`;
  const today = dayKey(nowMs, offsetMinutes);
  const usage =
    profile.poiUsage.day === today ? profile.poiUsage : { day: today, uses: {}, lastUsedAtMs: {} };

  const result = performGatherAction({
    playerId: profile.player.id,
    actionId,
    zone,
    poiId,
    nowMs,
    usesToday: usage.uses[usageKey] ?? 0,
    stepsToday: profile.player.steps.totalSteps,
    lastUsedAtMs: usage.lastUsedAtMs[usageKey] ?? null,
    carried: profile.player.carried,
    distanceMeters: input.distanceMeters,
    minigameScore: input.minigameScore,
  });

  if (!result.ok) return { profile, ok: false, messageVi: result.reasonVi ?? 'Không làm được.', gained: {} };

  let carried = profile.player.carried;
  if (result.consumed.length > 0) carried = removeItems(carried, result.consumed);
  carried = addItems(carried, result.gained);

  let survival = profile.player.survival;
  if (result.hpCost || result.satietyCost) {
    survival = {
      ...survival,
      hp: Math.max(0, survival.hp - result.hpCost),
      satiety: Math.max(0, survival.satiety - result.satietyCost),
    };
  }

  const traps = result.deployReadyAtMs
    ? [
        ...profile.traps,
        {
          id: `${poiId}-${nowMs}`,
          cellId: poiId,
          readyAtMs: result.deployReadyAtMs,
          expiresAtMs: result.deployExpiresAtMs ,
        },
      ]
    : profile.traps;

  const action = findAction(actionId);
  const gainedText = describeInventory(result.gained);

  return {
    profile: {
      ...profile,
      player: {
        ...profile.player,
        carried,
        survival,
        lifetime: {
          ...profile.player.lifetime,
          collected: mergeCounts(profile.player.lifetime.collected, result.gained),
          performedActionIds: unique([...profile.player.lifetime.performedActionIds, actionId]),
        },
      },
      traps,
      poiUsage: {
        day: today,
        uses: { ...usage.uses, [usageKey]: (usage.uses[usageKey] ?? 0) + 1 },
        lastUsedAtMs: { ...usage.lastUsedAtMs, [usageKey]: nowMs },
      },
    },
    ok: true,
    gained: result.gained,
    messageVi: gainedText
      ? `${action?.nameVi ?? actionId}: nhận ${gainedText}.`
      : `${action?.nameVi ?? actionId}: xong. Quay lại sau nhé.`,
  };
}

export function trade(profile             , offerIndex        , poiId        , nowMs        )                   {
  const offers = merchantOffers(profile.player.carried);
  const offer = offers[offerIndex];
  if (!offer) return { profile, ok: false, messageVi: 'Không có lượt đổi đó.' };
  if (!offer.affordable) return { profile, ok: false, messageVi: `Chưa đủ hàng để đổi: ${offer.labelVi}.` };

  const today = dayKey(nowMs);
  const usageKey = `${poiId}:merchant_trade`;
  const usage = profile.poiUsage.day === today ? profile.poiUsage : { day: today, uses: {}, lastUsedAtMs: {} };
  if ((usage.uses[usageKey] ?? 0) >= 1) {
    return { profile, ok: false, messageVi: 'Mỗi tàn tích chỉ đổi được một lượt mỗi ngày.' };
  }

  let carried = removeItems(profile.player.carried, offer.give);
  carried = addItems(carried, offer.get);

  // Đổi được bản vẽ thì mở luôn công thức lò rèn tương ứng (§5.3).
  const knownRecipes = offer.get.some((s) => s.itemId === 'blueprint')
    ? unique([...profile.player.knownRecipes, ...forgeRecipeIds()])
    : profile.player.knownRecipes;

  return {
    profile: {
      ...profile,
      player: { ...profile.player, carried, knownRecipes },
      poiUsage: {
        day: today,
        uses: { ...usage.uses, [usageKey]: 1 },
        lastUsedAtMs: { ...usage.lastUsedAtMs, [usageKey]: nowMs },
      },
    },
    ok: true,
    messageVi: `Đã đổi: ${offer.labelVi}.`,
  };
}

export function storeInSafe(profile             , moves             )                   {
  const result = moveToSafe(
    profile.player.carried,
    profile.player.safeStorage,
    moves,
    profile.player.camp.level,
    profile.player.safeVaultLevel ?? 1,
  );
  if (!result.ok) return { profile, ok: false, messageVi: result.reasonVi ?? 'Không cất được.' };

  return {
    profile: {
      ...profile,
      player: { ...profile.player, carried: result.carried, safeStorage: result.safe },
    },
    ok: true,
    messageVi: 'Đã cất vào két an toàn. Đêm nay có thua cũng không mất.',
  };
}

export function withdrawFromSafe(profile             , moves             )                   {
  const result = moveFromSafe(profile.player.carried, profile.player.safeStorage, moves);
  if (!result.ok) return { profile, ok: false, messageVi: result.reasonVi ?? 'Không lấy ra được.' };

  return {
    profile: {
      ...profile,
      player: { ...profile.player, carried: result.carried, safeStorage: result.safe },
    },
    ok: true,
    messageVi: 'Đã lấy vật phẩm ra balo / túi đồ đang mang.',
  };
}

export function upgradeSafeVaultRank(profile             )                   {
  const result = upgradeSafeVault(profile.player);
  if (!result.ok) return { profile, ok: false, messageVi: result.messageVi };

  return {
    profile: {
      ...profile,
      player: result.player,
    },
    ok: true,
    messageVi: result.messageVi,
  };
}

export function sleepAtCamp(profile             , nowMs        )                   {
  return {
    profile: {
      ...profile,
      player: {
        ...profile.player,
        survival: {
          ...profile.player.survival,
          asleep: true,
          lastTickMs: nowMs,
          hypothermiaUntilMs: null,
          heatstrokeUntilMs: null,
          fatiguedUntilMs: null,
          lastSleepMs: nowMs,
        },
      },
    },
    ok: true,
    messageVi: '🔥 Bạn cuộn mình bên Lửa Trại ấm áp. Giấc ngủ hồi phục thể lực, xoá tan kiệt sức và cảm lạnh!',
  };
}

export function wakeUp(profile             , nowMs        )                   {
  return {
    profile: {
      ...profile,
      player: {
        ...profile.player,
        survival: { ...profile.player.survival, asleep: false, lastTickMs: nowMs },
      },
    },
    ok: true,
    messageVi: 'Bạn tỉnh dậy.',
  };
}

// ------------------------------------------------------------------ đêm và Trăng Máu

export function runNightDefense(
  profile             ,
  nowMs        ,
  playerPerformance        ,
  online = true,
  ignoreWindow = false,
)                                                                        {
  const rng = createRng(hashSeed(profile.player.id, 'night', dayKey(nowMs)));
  const result = resolveNightDefense({
    camp: profile.player.camp,
    carried: profile.player.carried,
    nowMs,
    online,
    playerPerformance,
    rng,
    ignoreWindow,
  });

  const lifetime = {
    ...profile.player.lifetime,
    nightDefenseWins: profile.player.lifetime.nightDefenseWins + (result.survived ? 1 : 0),
    nightDefenseLosses: profile.player.lifetime.nightDefenseLosses + (result.survived ? 0 : 1),
    collected: mergeCounts(profile.player.lifetime.collected, result.rewards),
  };

  return {
    profile: {
      ...profile,
      player: { ...profile.player, carried: result.carried, camp: result.camp, lifetime },
    },
    ok: true,
    result,
    messageVi: result.logVi.join(' '),
  };
}

export function beginBloodMoon(
  profile             ,
  nowMs        ,
  difficultyId               ,
  offsetMinutes         ,
  ignoreWindow = false,
)                                                      {
  if (profile.activeFight && !profile.activeFight.settled) {
    return { profile, ok: true, fight: profile.activeFight, messageVi: 'Trận đang diễn ra.' };
  }

  const started = startBloodMoon({
    profileId: profile.player.id,
    camp: profile.player.camp,
    nowMs,
    difficultyId,
    offsetMinutes,
    ignoreWindow,
  });

  if (!started.ok || !started.fight) {
    return { profile, ok: false, fight: null, messageVi: started.reasonVi ?? 'Chưa tới giờ.' };
  }

  if (profile.lastBloodMoonWeekStartMs === started.fight.startMs) {
    return { profile, ok: false, fight: null, messageVi: 'Tuần này bạn đã đánh rồi. Hẹn thứ Bảy tới.' };
  }

  return {
    profile: { ...profile, activeFight: started.fight },
    ok: true,
    fight: started.fight,
    messageVi: started.introVi ?? '',
  };
}

export function strikeBoss(
  profile             ,
  nowMs        ,
  performance        ,
  durationSeconds = 30,
)                                                                         {
  if (!profile.activeFight) {
    return { profile, ok: false, fight: null, defeated: false, messageVi: 'Chưa vào trận.' };
  }

  const outcome = attackBoss({
    fight: profile.activeFight,
    camp: profile.player.camp,
    carried: profile.player.carried,
    nowMs,
    performance,
    durationSeconds,
  });

  return {
    profile: { ...profile, activeFight: outcome.fight },
    ok: outcome.ok,
    fight: outcome.fight,
    defeated: outcome.bossDefeated,
    messageVi: outcome.ok ? outcome.logVi : (outcome.reasonVi ?? ''),
  };
}

export function finishBloodMoon(
  profile             ,
  nowMs        ,
)                                                                               {
  if (!profile.activeFight) {
    return { profile, ok: false, settlement: null, messageVi: 'Không có trận nào để chốt.' };
  }

  const settlement = settleBloodMoon(profile.activeFight, profile.player.camp, nowMs);
  const story = advanceAfterBloodMoon(profile.story, profile.player.lifetime.steps);

  const messages = [settlement.summaryVi];
  if (story.unlockedChapter) {
    messages.push(`Mở khoá ${story.unlockedChapter.titleVi}: ${story.unlockedChapter.summaryVi}`);
  }

  return {
    profile: {
      ...profile,
      player: {
        ...profile.player,
        carried: addItems(profile.player.carried, settlement.rewards),
        lifetime: {
          ...profile.player.lifetime,
          bloodMoonWins: profile.player.lifetime.bloodMoonWins + (settlement.victory ? 1 : 0),
          collected: mergeCounts(profile.player.lifetime.collected, settlement.rewards),
        },
      },
      story: story.state,
      activeFight: settlement.fight,
      lastBloodMoonWeekStartMs: settlement.fight.startMs,
    },
    ok: true,
    settlement,
    messageVi: messages.join(' '),
  };
}

export function tickBloodMoonAllies(profile             , nowMs        )              {
  if (!profile.activeFight || profile.activeFight.settled) return profile;
  return { ...profile, activeFight: tickAllies(profile.activeFight, profile.player.camp, nowMs) };
}

// ------------------------------------------------------------------ cốt truyện, an toàn, cài đặt

export function playBeat(profile             , beatId        )              {
  return { ...profile, story: markBeatPlayed(profile.story, beatId) };
}

export function unlockGame(profile             )                   {
  return {
    profile: { ...profile, story: { ...profile.story, unlocked: true } },
    ok: true,
    messageVi: 'Đã mở khoá trọn đời. Toàn bộ tiến trình 3 ngày demo được giữ nguyên.',
  };
}

/** Nút báo cáo POI (§6.1): ẩn ngay trên máy người chơi, không cần chờ server. */
export function hidePoi(profile             , poiId        )                   {
  if (profile.settings.hiddenPoiIds.includes(poiId)) {
    return { profile, ok: false, messageVi: 'Điểm này đã bị ẩn.' };
  }
  return {
    profile: {
      ...profile,
      settings: { ...profile.settings, hiddenPoiIds: [...profile.settings.hiddenPoiIds, poiId] },
    },
    ok: true,
    messageVi: 'Đã ẩn điểm này khỏi bản đồ của bạn. Nó sẽ được xem xét gỡ ở bản cập nhật dữ liệu tới.',
  };
}

export function updateSettings(profile             , patch                                  )              {
  return { ...profile, settings: { ...profile.settings, ...patch } };
}

export function checkMovementSpeed(
  state            ,
  at        ,
  nowMs        ,
)                                {
  return checkSpeed(state, { at, atMs: nowMs });
}

export function sessionReminders(
  session              ,
  nowMs        ,
  offsetMinutes         ,
)                                                   {
  const local = toLocalTime(nowMs, offsetMinutes);
  return dueReminders(session, nowMs, local.day, local.hour);
}

export { createSpeedState };

// ------------------------------------------------------------------ hàm phụ trợ

function visiblePack(pack                            , profile             )                 {
  if (!pack) return null;
  if (profile.settings.hiddenPoiIds.length === 0) return pack;
  const hidden = new Set(profile.settings.hiddenPoiIds);
  return { ...pack, pois: pack.pois.filter((p) => !hidden.has(p.id)), index: undefined };
}

/** Vị trí mặc định khi người chơi không cấp quyền vị trí — game vẫn phải chơi được. */
function homePosition(profile             )         {
  const rng = createRng(hashSeed(profile.player.id, 'home'));
  return { lat: 21.0278 + (rng() - 0.5) * 0.01, lon: 105.8342 + (rng() - 0.5) * 0.01 };
}

function applyRealOverlay(
  simulated              ,
  real                                                              ,
)                        {
  return { condition: real.condition, rainHours: real.rainHours ?? simulated.rainHours };
}

function collectFinishedJobs(
  profile             ,
  inventory           ,
  camp                               ,
  nowMs        ,
) {
  let inv = inventory;
  let currentCamp = camp;
  const remaining                           = [];
  const messagesVi           = [];
  const craftedIds           = [];

  for (const job of profile.craftJobs) {
    if (nowMs < job.readyAtMs) {
      remaining.push(job);
      continue;
    }
    const craftCount = profile.player.lifetime.craftCount ?? 0;
    const artisanLevel = profile.player.artisanLevel ?? 1;
    const result = collectCraft(job.recipeId, job.readyAtMs, nowMs, inv, currentCamp, craftCount, artisanLevel);
    if (result.ok) {
      inv = result.inventory;
      currentCamp = result.camp;
      craftedIds.push(job.recipeId);
      if (result.messageVi) messagesVi.push(result.messageVi);
    }
  }

  return { inventory: inv, camp: currentCamp, remaining, messagesVi, craftedIds };
}

function collectReadyTraps(profile             , nowMs        ) {
  let gained            = {};
  const traps                       = [];
  let qty = 0;

  for (const trap of profile.traps) {
    if (nowMs > trap.expiresAtMs) continue;
    if (nowMs < trap.readyAtMs) {
      traps.push(trap);
      continue;
    }
    const rng = createRng(hashSeed(trap.id, 'trap'));
    if (rng() < 0.65) {
      gained = addItems(gained, [{ itemId: 'raw_meat', qty: rng() < 0.4 ? 2 : 1 }]);
      qty++;
    }
    if (rng() < 0.8) gained = addItems(gained, [{ itemId: 'rabbit_trap', qty: 1 }]);
  }

  return { gained, traps, qty };
}

function snapshotOf(profile             )                {
  return {
    lifetimeCollected: profile.player.lifetime.collected,
    craftedRecipeIds: profile.player.lifetime.craftedRecipeIds,
    visitedZones: profile.player.lifetime.visitedZones,
    performedActionIds: profile.player.lifetime.performedActionIds,
    nightDefenseWins: profile.player.lifetime.nightDefenseWins,
    lifetimeSteps: profile.player.lifetime.steps,
    chapterSteps: Math.max(0, profile.player.lifetime.steps - profile.story.chapterStartSteps),
    campLevel: profile.player.camp.level,
    bloodMoonsCompleted: profile.story.bloodMoonsCompleted,
  };
}

function foughtThisWeek(profile             , nowMs        , offsetMinutes         )          {
  if (profile.lastBloodMoonWeekStartMs === null) return false;
  return nowMs - profile.lastBloodMoonWeekStartMs < 7 * 86_400_000;
}

function forgeRecipeIds()           {
  return ['iron_axe', 'iron_spear', 'iron_sword', 'iron_shield', 'ballista', 'iron_ingot'];
}

function mergeCounts(base                        , add           )                         {
  const out = { ...base };
  for (const [itemId, qty] of Object.entries(add)) {
    if (qty > 0) out[itemId] = (out[itemId] ?? 0) + qty;
  }
  return out;
}

function unique   (values     )      {
  return Array.from(new Set(values));
}

export function describeInventory(inv           )         {
  return Object.entries(inv)
    .filter(([, qty]) => qty > 0)
    .map(([itemId, qty]) => `${qty} ${findItem(itemId)?.nameVi ?? itemId}`)
    .join(', ');
}

function formatHours(hours        )         {
  if (hours < 1) return `${Math.round(hours * 60)} phút`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`;
}

function formatSeconds(seconds        )         {
  if (seconds < 60) return `${Math.ceil(seconds)} giây`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} phút`;
  return `${(seconds / 3600).toFixed(1)} giờ`;
}

export { actionsFor, merchantOffers, isNightDefenseWindow, ZONES };
