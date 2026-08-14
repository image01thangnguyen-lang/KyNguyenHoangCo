/**
 * Đêm Trăng Máu — thứ Bảy 19:00–22:00 theo ĐỒNG HỒ MÁY (§5.5 bản 2.0 offline).
 *
 * Bản online dùng co-op bất đồng bộ qua server với Tộc 6 người. Bản offline không có server,
 * nên tính năng "đinh" này được giữ lại theo cách khác:
 *
 *  - Trận boss chơi đơn, HP tính theo cấp doanh trại, có 3 mức độ khó tự chọn.
 *  - Công trình phòng thủ đã xây (tháp canh, ballista) đóng vai ĐỒNG ĐỘI, tự động góp sát
 *    thương suốt trận — người chơi vẫn có cảm giác chỉ huy một trận công thành thay vì
 *    solo trống trải.
 *  - Bỏ lỡ khung giờ thì sáng Chủ Nhật boss "vây trại", đánh bù được với thưởng giảm 30%.
 *    Đời thật bận rộn; một game gia đình không nên phạt người bận.
 *
 * Co-op cục bộ 2–6 máy qua Wi-Fi/Bluetooth là bản 1.1 — vẫn không cần Internet.
 */

import { BLOOD_MOON, COMBAT, getDefenseStructure, getItem } from './balance.js';
import { addItems, emptyInventory } from './inventory.js';
import { rollRewards } from './nightDefense.js';
import { createRng, hashSeed } from './rng.js';
import { bloodMoonWindow, isBloodMoonWindow, isMakeupWindow, makeupWindow } from './time.js';
                                                                    

                                                   

                          
             
                 
                 
                 
                 
 

export const BOSSES = BLOOD_MOON.bosses             ;
export const DIFFICULTIES = BLOOD_MOON.difficulties;

export function difficulty(id              ) {
  const found = DIFFICULTIES.find((d) => d.id === id);
  if (!found) throw new Error(`Độ khó không hợp lệ: ${id}`);
  return found;
}

/** Boss xoay vòng theo tuần. Seed gắn hồ sơ nên hai anh em dùng chung máy vẫn gặp boss khác nhau. */
export function bossForWeek(profileId        , startMs        )          {
  const weekIndex = Math.floor(startMs / (7 * 86_400_000));
  const rng = createRng(hashSeed(profileId, 'bloodmoon', weekIndex));
  return BOSSES[Math.floor(rng() * BOSSES.length)] ;
}

                                 
                    
                 
                             
                  
                      
                  
                
                                                           
                    
                                       
                       
                                                
                     
                                                                                      
                         
                   
 

export function bossHpFor(campLevel        , difficultyId              )         {
  const d = difficulty(difficultyId);
  const base = BLOOD_MOON.hpBase * (1 + BLOOD_MOON.hpPerCampLevel * (campLevel - 1));
  return Math.round(base * d.hpMultiplier);
}

/** Tổng sát thương mỗi giây các công trình góp vào (§5.5 — "đồng đội công trình"). */
export function allyDps(camp           )         {
  let dps = 0;
  for (const [id, count] of Object.entries(camp.defenseStructures)) {
    if (!count) continue;
    dps += (getDefenseStructure(id).bloodMoonDps ?? 0) * count;
  }
  return dps * BLOOD_MOON.allyStructures.dpsRatio;
}

                               
                    
                  
                
                              
                         
                                                                                       
                         
 

                              
              
                    
                               
                   
 

export function startBloodMoon(options              )              {
  const {
    profileId,
    camp,
    nowMs,
    difficultyId = BLOOD_MOON.defaultDifficulty                ,
    offsetMinutes,
    ignoreWindow = false,
  } = options;

  const inMain = isBloodMoonWindow(nowMs, offsetMinutes);
  const inMakeup = isMakeupWindow(nowMs, offsetMinutes);

  if (!ignoreWindow && !inMain && !inMakeup) {
    const upcoming = bloodMoonWindow(nowMs, offsetMinutes);
    const hoursAway = Math.max(0, Math.round((upcoming.startMs - nowMs) / 3_600_000));
    return {
      ok: false,
      fight: null,
      reasonVi: `Trăng Máu dâng vào thứ Bảy ${BLOOD_MOON.startHour}:00–${BLOOD_MOON.endHour}:00. Còn khoảng ${hoursAway} giờ nữa.`,
    };
  }

  const isMakeup = !inMain && inMakeup;
  const fightWindow = isMakeup ? makeupWindowForNow(nowMs, offsetMinutes) : bloodMoonWindow(nowMs, offsetMinutes);

  const boss = bossForWeek(profileId, fightWindow.startMs);
  const totalHp = bossHpFor(camp.level, difficultyId);

  return {
    ok: true,
    fight: {
      profileId,
      bossId: boss.id,
      difficultyId,
      totalHp,
      remainingHp: totalHp,
      startMs: fightWindow.startMs,
      endMs: fightWindow.endMs,
      isMakeup,
      playerDamage: 0,
      allyDamage: 0,
      lastAllyTickMs: nowMs,
      settled: false,
    },
    introVi: isMakeup
      ? BLOOD_MOON.makeupFight.messageVi
      : `Trăng đỏ như máu. ${boss.nameVi} đang tới. Điểm yếu: ${getItem(boss.weakTo).nameVi}.`,
  };
}

/**
 * Khung đánh bù của CHÍNH sáng nay.
 *
 * `bloodMoonWindow` lúc sáng Chủ Nhật đã trỏ tới thứ Bảy TUẦN SAU (khung tuần này vừa kết
 * thúc), nên phải lùi lại 7 ngày mới ra đúng đêm vừa bị bỏ lỡ.
 */
function makeupWindowForNow(nowMs        , offsetMinutes         )                                     {
  const next = bloodMoonWindow(nowMs, offsetMinutes);
  return makeupWindow(next.endMs - 7 * 86_400_000);
}

/** Cộng dồn sát thương của "đồng đội công trình" theo thời gian thực đã trôi qua. */
export function tickAllies(fight                , camp           , nowMs        )                 {
  if (fight.settled || fight.remainingHp <= 0) return fight;

  const until = Math.min(nowMs, fight.endMs);
  const seconds = Math.max(0, until - fight.lastAllyTickMs) / 1000;
  if (seconds <= 0) return fight;

  const damage = Math.min(Math.round(allyDps(camp) * seconds), fight.remainingHp);
  return {
    ...fight,
    allyDamage: fight.allyDamage + damage,
    remainingHp: fight.remainingHp - damage,
    lastAllyTickMs: until,
  };
}

                              
                        
                  
                     
                
                                                         
                       
                                          
                           
 

                                
              
                    
                        
                      
                        
                        
                
 

/**
 * Trần cứng mỗi giây đánh. Không nhằm chống hacker (game offline, sửa save là quyền của họ),
 * mà để một điểm minigame bất thường do lỗi UI không thể một phát hạ boss và phá mất
 * khoảnh khắc đinh của cả tuần.
 */
const MAX_DAMAGE_PER_ATTACK_SECOND = 260;

export function attackBoss(input             )                {
  const { camp, carried, nowMs } = input;
  let fight = input.fight;

  if (fight.settled) {
    return {
      ok: false,
      reasonVi: 'Trận này đã kết thúc.',
      fight,
      damageDealt: 0,
      usedWeakness: false,
      bossDefeated: fight.remainingHp <= 0,
      logVi: '',
    };
  }

  if (nowMs >= fight.endMs) {
    return {
      ok: false,
      reasonVi: 'Hết khung giờ. Trăng đã lặn.',
      fight,
      damageDealt: 0,
      usedWeakness: false,
      bossDefeated: false,
      logVi: '',
    };
  }

  fight = tickAllies(fight, camp, nowMs);
  if (fight.remainingHp <= 0) {
    return {
      ok: true,
      fight,
      damageDealt: 0,
      usedWeakness: false,
      bossDefeated: true,
      logVi: 'Đồng đội công trình đã kết liễu nó trước khi bạn kịp ra tay.',
    };
  }

  const boss = BOSSES.find((b) => b.id === fight.bossId) ;
  const performance = clamp01(input.performance ?? 0.5);
  const durationSeconds = Math.max(1, Math.min(input.durationSeconds ?? 60, 180));

  let weaponAttack = COMBAT.playerBaseAttack;
  let usedWeakness = false;
  for (const [itemId, qty] of Object.entries(carried)) {
    if (qty <= 0) continue;
    const item = getItem(itemId);
    if (item.attack && item.attack > weaponAttack) weaponAttack = item.attack;
    if (itemId === boss.weakTo) usedWeakness = true;
  }

  const weaknessMultiplier = usedWeakness ? COMBAT.weakToDamageMultiplier : 1;
  const campBonus = 1 + COMBAT.campLevelAttackBonus * camp.level;
  const raw =
    weaponAttack * campBonus * weaknessMultiplier * (0.4 + 1.2 * performance) * durationSeconds;

  const damageDealt = Math.min(
    Math.round(raw),
    MAX_DAMAGE_PER_ATTACK_SECOND * durationSeconds,
    fight.remainingHp,
  );

  const next                 = {
    ...fight,
    playerDamage: fight.playerDamage + damageDealt,
    remainingHp: fight.remainingHp - damageDealt,
  };

  return {
    ok: true,
    fight: next,
    damageDealt,
    usedWeakness,
    bossDefeated: next.remainingHp <= 0,
    logVi: usedWeakness
      ? `Bạn nhắm đúng điểm yếu của ${boss.nameVi} — ${damageDealt.toLocaleString('vi-VN')} sát thương.`
      : `Bạn giáng ${damageDealt.toLocaleString('vi-VN')} sát thương lên ${boss.nameVi}.`,
  };
}

                             
                        
                   
                     
                      
                      
                     
                           
                    
 

/**
 * Chốt sổ trận đánh. Thắng thì thưởng đầy đủ; không thắng vẫn có thưởng tham gia — đây là
 * "giờ vàng gia đình" chứ không phải nội dung hardcore.
 */
export function settleBloodMoon(fight                , camp           , nowMs        )             {
  const ticked = tickAllies(fight, camp, nowMs);
  const boss = BOSSES.find((b) => b.id === ticked.bossId) ;
  const victory = ticked.remainingHp <= 0;
  const totalDamage = ticked.playerDamage + ticked.allyDamage;

  const rewardMultiplier =
    difficulty(ticked.difficultyId).rewardMultiplier *
    (ticked.isMakeup ? BLOOD_MOON.makeupFight.rewardMultiplier : 1);

  const rng = createRng(hashSeed(ticked.profileId, ticked.bossId, ticked.startMs));
  const table = (
    victory ? BLOOD_MOON.rewards.victory : BLOOD_MOON.rewards.participationOnly
  )                 ;

  let rewards = rollRewards(table, rng);
  if (rewardMultiplier !== 1) rewards = scaleInventory(rewards, rewardMultiplier);

  const playerShare = totalDamage > 0 ? ticked.playerDamage / totalDamage : 0;

  return {
    fight: { ...ticked, settled: true },
    victory,
    bossNameVi: boss.nameVi,
    totalDamage,
    playerShare,
    rewards,
    rewardMultiplier,
    summaryVi: victory
      ? `Bạn hạ được ${boss.nameVi}. Tự tay bạn gây ${Math.round(playerShare * 100)}% sát thương, phần còn lại là công trình do chính bạn dựng.`
      : `${boss.nameVi} rút vào bóng tối khi trăng lặn. Nó còn ${ticked.remainingHp.toLocaleString('vi-VN')} máu. Tuần sau nó sẽ nhớ mặt bạn.`,
  };
}

function scaleInventory(inv           , multiplier        )            {
  let out = emptyInventory();
  for (const [itemId, qty] of Object.entries(inv)) {
    out = addItems(out, [{ itemId, qty: Math.max(1, Math.round(qty * multiplier)) }]);
  }
  return out;
}

                                  
                  
                           
                  
                
                  
                  
 

/** Trạng thái cho HUD: đếm ngược tới thứ Bảy, hoặc báo còn cửa đánh bù sáng Chủ Nhật. */
export function bloodMoonStatus(
  nowMs        ,
  alreadyFoughtThisWeek         ,
  offsetMinutes         ,
)                  {
  const window = bloodMoonWindow(nowMs, offsetMinutes);
  const active = isBloodMoonWindow(nowMs, offsetMinutes);
  const makeupAvailable = !alreadyFoughtThisWeek && isMakeupWindow(nowMs, offsetMinutes);

  const msUntil = Math.max(0, window.startMs - nowMs);
  const hours = Math.floor(msUntil / 3_600_000);

  return {
    active,
    makeupAvailable,
    startMs: window.startMs,
    endMs: window.endMs,
    msUntil,
    labelVi: active
      ? 'TRĂNG MÁU ĐANG DÂNG'
      : makeupAvailable
        ? BLOOD_MOON.makeupFight.titleVi
        : hours >= 24
          ? `Trăng Máu sau ${Math.floor(hours / 24)} ngày ${hours % 24} giờ`
          : `Trăng Máu sau ${hours} giờ`,
  };
}

function clamp01(value        )         {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
