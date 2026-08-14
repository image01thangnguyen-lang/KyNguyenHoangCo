/**
 * Chế tạo và nâng cấp doanh trại (§5.3).
 *
 * Craft là hành động server-authoritative có độ trễ: server trừ nguyên liệu ngay,
 * ghi mốc `readyAtMs`, và chỉ trả sản phẩm khi người chơi "thu" sau khi hết thời gian.
 * Trừ nguyên liệu trước giúp chống double-spend khi client gửi lặp yêu cầu.
 */

import {
  CAMP_TIERS,
  RECIPES,
  getCampTier,
  getDefenseStructure,
  getItem,
  getRecipe,
  recipesAvailable,
  stationsUnlockedAt,
} from './balance.js';
import { addItems, countOf, hasAll, missingFrom, removeItems } from './inventory.js';
             
            
               
                     
            
            
            
            
                    

export function createCampState(nowMs        , homeCell                = null)            {
  return {
    level: 1,
    stations: [],
    defenseStructures: {},
    upgradeCompleteAtMs: null,
    homeCell,
  };
}

                               
                   
                  
                       
                
                                                                                             
                  
                          
 

/** Kiểm tra + trừ nguyên liệu. KHÔNG cộng sản phẩm — sản phẩm trả ở `collectCraft`. */
export function startCraft(ctx              )                                          {
  const recipe = getRecipe(ctx.recipeId);

  if (recipe.tier > ctx.camp.level) {
    return {
      ok: false,
      reasonVi: `${recipe.nameVi} cần doanh trại cấp ${recipe.tier} (${getCampTier(recipe.tier).nameVi}).`,
      inventory: ctx.inventory,
    };
  }

  if (recipe.station) {
    if (!ctx.camp.stations.includes(recipe.station)) {
      return {
        ok: false,
        reasonVi: `Cần xây ${stationName(recipe.station)} trước.`,
        inventory: ctx.inventory,
      };
    }
    if (!ctx.atCamp) {
      return {
        ok: false,
        reasonVi: `${stationName(recipe.station)} nằm ở trại — hãy về trại để chế tạo.`,
        inventory: ctx.inventory,
      };
    }
  }

  if (recipe.outputKind === 'station' && ctx.camp.stations.includes(recipe.outputId             )) {
    return { ok: false, reasonVi: `${recipe.nameVi} đã được xây rồi.`, inventory: ctx.inventory };
  }

  if (recipe.outputKind === 'defense') {
    const structureId = recipe.outputId                      ;
    const def = getDefenseStructure(structureId);
    const current = ctx.camp.defenseStructures[structureId] ?? 0;
    if (current >= def.maxCount) {
      return {
        ok: false,
        reasonVi: `Tối đa ${def.maxCount} ${def.nameVi}.`,
        inventory: ctx.inventory,
      };
    }
    const totalStructures = totalDefenseCount(ctx.camp);
    const limit = getCampTier(ctx.camp.level).maxDefenseStructures;
    if (totalStructures >= limit) {
      return {
        ok: false,
        reasonVi: `Trại cấp ${ctx.camp.level} chỉ chứa ${limit} công trình phòng thủ. Nâng cấp trại để xây thêm.`,
        inventory: ctx.inventory,
      };
    }
  }

  if (ctx.knownRecipes && !ctx.knownRecipes.includes(recipe.id) && requiresBlueprint(recipe)) {
    return {
      ok: false,
      reasonVi: `Bạn chưa có bản vẽ của ${recipe.nameVi}. Đổi bản vẽ ở tàn tích thương nhân cổ.`,
      inventory: ctx.inventory,
    };
  }

  if (!hasAll(ctx.inventory, recipe.inputs)) {
    const missing = missingFrom(ctx.inventory, recipe.inputs)
      .map((s) => `${s.qty} ${getItem(s.itemId).nameVi}`)
      .join(', ');
    return { ok: false, reasonVi: `Còn thiếu: ${missing}.`, inventory: ctx.inventory };
  }

  return {
    ok: true,
    consumed: recipe.inputs,
    produced: { kind: recipe.outputKind, id: recipe.outputId, qty: recipe.outputQty },
    readyAtMs: ctx.nowMs + recipe.seconds * 1000,
    inventory: removeItems(ctx.inventory, recipe.inputs),
  };
}

                                
              
                    
                       
                  
                     
 

/** Thu sản phẩm sau khi hết thời gian chế tạo. */
export function collectCraft(
  recipeId        ,
  readyAtMs        ,
  nowMs        ,
  inventory           ,
  camp           ,
)                {
  if (nowMs < readyAtMs) {
    const secondsLeft = Math.ceil((readyAtMs - nowMs) / 1000);
    return { ok: false, reasonVi: `Còn ${secondsLeft} giây nữa mới xong.`, inventory, camp };
  }

  const recipe = getRecipe(recipeId);

  if (recipe.outputKind === 'item') {
    return {
      ok: true,
      inventory: addItems(inventory, [{ itemId: recipe.outputId, qty: recipe.outputQty }]),
      camp,
      messageVi: `Đã chế tạo ${recipe.outputQty} ${recipe.nameVi}.`,
    };
  }

  if (recipe.outputKind === 'station') {
    const stationId = recipe.outputId             ;
    if (camp.stations.includes(stationId)) {
      return { ok: false, reasonVi: `${recipe.nameVi} đã có ở trại.`, inventory, camp };
    }
    return {
      ok: true,
      inventory,
      camp: { ...camp, stations: [...camp.stations, stationId] },
      messageVi: `${recipe.nameVi} đã sẵn sàng ở trại.`,
    };
  }

  const structureId = recipe.outputId                      ;
  return {
    ok: true,
    inventory,
    camp: {
      ...camp,
      defenseStructures: {
        ...camp.defenseStructures,
        [structureId]: (camp.defenseStructures[structureId] ?? 0) + recipe.outputQty,
      },
    },
    messageVi: `${recipe.nameVi} đã dựng xong quanh trại.`,
  };
}

/** Công thức cấp 3 dùng lò rèn cần bản vẽ — tạo lý do để ghé thương nhân cổ. */
function requiresBlueprint(recipe           )          {
  return recipe.tier === 3 && recipe.station === 'forge';
}

function stationName(id           )         {
  return (
    RECIPES.find((r) => r.outputKind === 'station' && r.outputId === id)?.nameVi ?? String(id)
  );
}

export function totalDefenseCount(camp           )         {
  return Object.values(camp.defenseStructures).reduce((sum, n) => sum + (n ?? 0), 0);
}

// ------------------------------------------------------------------ nâng cấp doanh trại

                                 
              
                    
                       
                  
                        
 

export function startCampUpgrade(
  camp           ,
  inventory           ,
  nowMs        ,
)                 {
  if (camp.upgradeCompleteAtMs !== null) {
    return { ok: false, reasonVi: 'Trại đang trong quá trình nâng cấp.', inventory, camp };
  }

  const tier = getCampTier(camp.level);
  if (!tier.upgradeToNext) {
    return { ok: false, reasonVi: `${tier.nameVi} đã là cấp cao nhất hiện có.`, inventory, camp };
  }

  if (!hasAll(inventory, tier.upgradeToNext.inputs)) {
    const missing = missingFrom(inventory, tier.upgradeToNext.inputs)
      .map((s) => `${s.qty} ${getItem(s.itemId).nameVi}`)
      .join(', ');
    return { ok: false, reasonVi: `Còn thiếu: ${missing}.`, inventory, camp };
  }

  const completeAtMs = nowMs + tier.upgradeToNext.seconds * 1000;
  return {
    ok: true,
    inventory: removeItems(inventory, tier.upgradeToNext.inputs),
    camp: { ...camp, upgradeCompleteAtMs: completeAtMs },
    completeAtMs,
  };
}

export function finishCampUpgrade(camp           , nowMs        )                                                             {
  if (camp.upgradeCompleteAtMs === null || nowMs < camp.upgradeCompleteAtMs) {
    return { camp, upgraded: false };
  }

  const nextLevel = (camp.level + 1)             ;
  const nextTier = getCampTier(nextLevel);
  const stations = Array.from(new Set([...camp.stations]));

  return {
    camp: { ...camp, level: nextLevel, stations, upgradeCompleteAtMs: null },
    upgraded: true,
    messageVi: `Doanh trại đã thành ${nextTier.nameVi}. Mở khoá: ${nextTier.unlocksStations.map(stationName).join(', ') || 'công thức cấp ' + nextLevel}.`,
  };
}

/** Danh sách công thức hiển thị trên UI, kèm trạng thái đủ/thiếu nguyên liệu. */
                             
                    
                     
                       
                  
                        
 

export function recipeBoard(camp           , inventory           , knownRecipes           = [])               {
  const unlockedStations = stationsUnlockedAt(camp.level);

  return RECIPES.map((recipe) => {
    const missing = missingFrom(inventory, recipe.inputs);
    let locked = false;
    let lockReasonVi                    ;

    if (recipe.tier > camp.level) {
      locked = true;
      lockReasonVi = `Cần doanh trại cấp ${recipe.tier}`;
    } else if (recipe.station && !camp.stations.includes(recipe.station)) {
      locked = true;
      lockReasonVi = unlockedStations.includes(recipe.station)
        ? `Cần xây ${stationName(recipe.station)}`
        : `Cần doanh trại cấp cao hơn để xây ${stationName(recipe.station)}`;
    } else if (requiresBlueprint(recipe) && !knownRecipes.includes(recipe.id)) {
      locked = true;
      lockReasonVi = 'Cần bản vẽ từ thương nhân cổ';
    }

    return { recipe, craftable: !locked && missing.length === 0, missing, locked, lockReasonVi };
  });
}

/** Tiến độ tới lần nâng cấp kế tiếp — hiển thị trên màn hình trại. */
export function upgradeProgress(
  camp           ,
  inventory           ,
)                                                                    {
  const tier = getCampTier(camp.level);
  if (!tier.upgradeToNext) return null;

  const needs = tier.upgradeToNext.inputs.map((input) => ({
    ...input,
    have: Math.min(countOf(inventory, input.itemId), input.qty),
  }));

  const totalNeeded = needs.reduce((sum, n) => sum + n.qty, 0);
  const totalHave = needs.reduce((sum, n) => sum + n.have, 0);
  return { ratio: totalNeeded > 0 ? totalHave / totalNeeded : 1, needs };
}

export { recipesAvailable, CAMP_TIERS };
