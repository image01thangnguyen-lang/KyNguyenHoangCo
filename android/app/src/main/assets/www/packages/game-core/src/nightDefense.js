/**
 * Phòng thủ doanh trại ban đêm (§5.4) — CHƠI HOÀN TOÀN TẠI NHÀ.
 *
 * Đây là cơ chế thay thế cho "ra ngoài sau 20h bị quái đuổi, phải chạy 200 m ngoài đời"
 * trong kịch bản v0. Không hàm nào trong module này thưởng cho việc ra đường ban đêm.
 * Chất kinh dị đến từ âm thanh, ánh sáng và nhịp rung ở tầng client, không từ rủi ro thật.
 */

import { COMBAT, NIGHT_DEFENSE, getCampTier, getDefenseStructure, getItem, getMonster } from './balance.js';
import { addItems, dropFraction, emptyInventory } from './inventory.js';
import { rollChance } from './rng.js';
import { isNightDefenseWindow } from './time.js';
             
            
                     
            
                     
              
                    

/** Sức phòng thủ tĩnh của trại = nền theo cấp + tổng công trình đã xây. */
export function campDefensePower(camp           )         {
  let power = getCampTier(camp.level).baseDefense;
  for (const [id, count] of Object.entries(camp.defenseStructures)) {
    if (!count) continue;
    power += getDefenseStructure(id).defense * count;
  }
  return power;
}

/** Sát thương người chơi góp thêm khi trực tiếp thủ trại (vũ khí + khiên đang mang). */
export function playerCombatPower(carried           , campLevel        )         {
  let best = COMBAT.playerBaseAttack;
  let defense = 0;

  for (const [itemId, qty] of Object.entries(carried)) {
    if (qty <= 0) continue;
    const item = getItem(itemId);
    if (item.attack) best = Math.max(best, item.attack);
    if (item.defense) defense += item.defense;
  }

  return (best + defense) * (1 + COMBAT.campLevelAttackBonus * campLevel);
}

/** Đợt quái mạnh dần theo cấp trại để đêm nào cũng còn là thử thách. */
function waveThreat(waveIndex        , campLevel        )         {
  const wave = NIGHT_DEFENSE.waves[waveIndex];
  if (!wave) return 0;
  const raw = wave.monsters.reduce(
    (sum, entry) => sum + getMonster(entry.id).threat * entry.count,
    0,
  );
  return raw * (1 + 0.6 * (campLevel - 1));
}

export function waveRosterVi(waveIndex        )         {
  const wave = NIGHT_DEFENSE.waves[waveIndex];
  if (!wave) return '';
  return wave.monsters.map((e) => `${e.count} ${getMonster(e.id).nameVi}`).join(', ');
}

                                 
                  
                                                           
                     
                
                                                                                           
                  
                                                                    
                             
                    
                                                                                       
                         
 

                                                            
                     
                  
 

export function resolveNightDefense(ctx                )                 {
  if (!ctx.ignoreWindow && !isNightDefenseWindow(ctx.nowMs)) {
    return {
      survived: true,
      wavesCleared: 0,
      totalWaves: 0,
      playerPower: 0,
      monsterThreat: 0,
      structureDamage: {},
      lostItems: {},
      rewards: {},
      logVi: [
        `Đêm chưa xuống. Đợt tấn công diễn ra trong khung ${NIGHT_DEFENSE.windowStartHour}:00–${NIGHT_DEFENSE.windowEndHour}:00.`,
      ],
      carried: ctx.carried,
      camp: ctx.camp,
    };
  }

  const performance = clamp01(ctx.playerPerformance ?? 0.5);
  const structural = campDefensePower(ctx.camp);
  const efficiency = ctx.online ? 1 : NIGHT_DEFENSE.offlineDefenseEfficiency;
  const active = ctx.online ? playerCombatPower(ctx.carried, ctx.camp.level) * (0.5 + performance) : 0;

  let pool = structural * efficiency + active;
  const playerPower = pool;

  const logVi           = [];
  const structureDamage                                              = {};
  let wavesCleared = 0;
  let totalThreat = 0;
  let survived = true;

  logVi.push(
    ctx.online
      ? `Bạn thắp đuốc, đứng sau tường. Sức phòng thủ ${Math.round(pool)}.`
      : `Trại tự phòng thủ trong đêm (hiệu suất ${Math.round(efficiency * 100)}%). Sức phòng thủ ${Math.round(pool)}.`,
  );

  for (let i = 0; i < NIGHT_DEFENSE.waves.length; i++) {
    const threat = waveThreat(i, ctx.camp.level);
    totalThreat += threat;
    logVi.push(`Đợt ${i + 1}: ${waveRosterVi(i)} lao ra từ bóng tối (đe doạ ${Math.round(threat)}).`);

    if (pool < threat) {
      survived = false;
      logVi.push('Tường vỡ. Chúng tràn vào trại.');
      break;
    }

    wavesCleared++;
    // Thủ được vẫn hao mòn — người chơi phải sửa/xây thêm trước Trăng Máu thứ Bảy.
    const wear = threat * 0.35;
    pool -= wear;
    accumulateWear(ctx.camp, structureDamage, wear);
    logVi.push(`Đợt ${i + 1} bị đẩy lui. Công trình hư hại ${Math.round(wear)}.`);
  }

  let carried = ctx.carried;
  let lostItems            = {};
  let rewards            = emptyInventory();

  if (survived) {
    rewards = rollRewards(NIGHT_DEFENSE.victoryReward                 , ctx.rng);
    carried = addItems(carried, rewards);
    logVi.push('Trời hửng sáng. Trại còn nguyên.');
  } else {
    const drop = dropFraction(carried, NIGHT_DEFENSE.breachLossRatio);
    carried = drop.kept;
    lostItems = drop.lost;
    logVi.push(
      Object.keys(lostItems).length > 0
        ? `Mất ${describe(lostItems)}. Két an toàn trong trại không bị đụng tới.`
        : 'May mắn: bạn chẳng mang gì đáng để mất.',
    );
  }

  const camp = survived ? ctx.camp : consumeBreakableTraps(ctx.camp);

  return {
    survived,
    wavesCleared,
    totalWaves: NIGHT_DEFENSE.waves.length,
    playerPower: Math.round(playerPower),
    monsterThreat: Math.round(totalThreat),
    structureDamage,
    lostItems,
    rewards,
    logVi,
    carried,
    camp,
  };
}

/** Chia phần hao mòn cho các công trình có HP theo tỉ lệ sức phòng thủ chúng đóng góp. */
function accumulateWear(
  camp           ,
  into                                             ,
  wear        ,
)       {
  const entries = Object.entries(camp.defenseStructures).filter(([id, count]) => {
    if (!count) return false;
    return getDefenseStructure(id).hp !== undefined;
  })                                  ;

  const totalDefense = entries.reduce(
    (sum, [id, count]) => sum + getDefenseStructure(id).defense * count,
    0,
  );
  if (totalDefense <= 0) return;

  for (const [id, count] of entries) {
    const share = (getDefenseStructure(id).defense * count) / totalDefense;
    into[id] = Math.round((into[id] ?? 0) + wear * share);
  }
}

/** Bẫy chông dùng một lần: bị tiêu hao khi trại bị chọc thủng. */
function consumeBreakableTraps(camp           )            {
  const next = { ...camp.defenseStructures };
  let changed = false;

  for (const [id, count] of Object.entries(next)                                  ) {
    if (!count) continue;
    if (!getDefenseStructure(id).consumedOnBreach) continue;
    const remaining = Math.max(0, count - Math.ceil(count / 2));
    if (remaining !== count) changed = true;
    if (remaining === 0) delete next[id];
    else next[id] = remaining;
  }

  return changed ? { ...camp, defenseStructures: next } : camp;
}

export function rollRewards(entries               , rng              )            {
  let out = emptyInventory();
  for (const entry of entries) {
    if (rollChance(rng, entry.chance)) {
      out = addItems(out, [{ itemId: entry.itemId, qty: entry.qty }]);
    }
  }
  return out;
}

function describe(inv           )         {
  return Object.entries(inv)
    .map(([itemId, qty]) => `${qty} ${getItem(itemId).nameVi}`)
    .join(', ');
}

/** Dự báo cho HUD buổi chiều: "trại của bạn liệu có trụ được đêm nay?" */
export function forecastTonight(camp           )   
                
                        
                    
  {
  const power = campDefensePower(camp) * NIGHT_DEFENSE.offlineDefenseEfficiency;
  const requiredPower = Math.max(
    ...NIGHT_DEFENSE.waves.map((_, i) => waveThreat(i, camp.level)),
  );

  const ratio = requiredPower > 0 ? power / requiredPower : 2;
  const verdictVi =
    ratio >= 1.4
      ? 'Trại rất vững. Đêm nay ngủ được.'
      : ratio >= 1
        ? 'Trại đủ trụ, nhưng sát nút. Nên xây thêm một tường.'
        : 'Trại sẽ bị chọc thủng. Hãy gửi đồ quý vào két an toàn và xây thêm phòng thủ.';

  return { power: Math.round(power), requiredPower: Math.round(requiredPower), verdictVi };
}

function clamp01(value        )         {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
