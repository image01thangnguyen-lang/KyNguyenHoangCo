/**
 * Điểm truy cập duy nhất vào bảng cân bằng.
 *
 * Toàn bộ số liệu nằm trong `data/*.json` để designer sửa được mà không cần chạm code,
 * và để xuất nguyên vẹn sang Unity / spreadsheet (§12 mục 2).
 * KHÔNG hardcode số cân bằng ở bất kỳ nơi nào khác trong repo.
 */

import survivalJson from '../data/survival.json' with { type: 'json' };
import itemsJson from '../data/items.json' with { type: 'json' };
import gatheringJson from '../data/gathering.json' with { type: 'json' };
import recipesJson from '../data/recipes.json' with { type: 'json' };
import campJson from '../data/camp.json' with { type: 'json' };
import monstersJson from '../data/monsters.json' with { type: 'json' };
import poiJson from '../data/poi-mapping.json' with { type: 'json' };
import deviceJson from '../data/device-checks.json' with { type: 'json' };
import weatherJson from '../data/weather.json' with { type: 'json' };
import storyJson from '../data/story.json' with { type: 'json' };

             
              
                      
            
          
         
             
            
            
         
                    

export const SURVIVAL = survivalJson;
export const GATHERING = gatheringJson;
export const POI = poiJson;
export const DEVICE_CHECKS = deviceJson;
export const WEATHER = weatherJson;
export const STORY = storyJson;
export const COMBAT = monstersJson.combat;
export const NIGHT_DEFENSE = monstersJson.nightDefense;
export const BLOOD_MOON = monstersJson.bloodMoon;

export const ITEMS                     = itemsJson.items             ;
export const RECIPES                       = recipesJson.recipes               ;
export const CAMP_TIERS                         = campJson.tiers                 ;
export const DEFENSE_STRUCTURES                                 =
  campJson.defenseStructures                         ;
export const MONSTERS                        = monstersJson.monsters                ;
export const ZONES = GATHERING.zones                                                                ;
export const DROP_TABLES = GATHERING.dropTables                               ;

const itemsById = new Map                 (ITEMS.map((i) => [i.id, i]));
const recipesById = new Map                   (RECIPES.map((r) => [r.id, r]));
const monstersById = new Map                    (MONSTERS.map((m) => [m.id, m]));
const defenseById = new Map                             (DEFENSE_STRUCTURES.map((d) => [d.id, d]));

export function getItem(id        )          {
  const item = itemsById.get(id);
  if (!item) throw new Error(`Vật phẩm không tồn tại trong items.json: ${id}`);
  return item;
}

export function findItem(id        )                      {
  return itemsById.get(id);
}

export function getRecipe(id        )            {
  const recipe = recipesById.get(id);
  if (!recipe) throw new Error(`Công thức không tồn tại trong recipes.json: ${id}`);
  return recipe;
}

export function findRecipe(id        )                        {
  return recipesById.get(id);
}

export function getMonster(id        )             {
  const monster = monstersById.get(id);
  if (!monster) throw new Error(`Quái không tồn tại trong monsters.json: ${id}`);
  return monster;
}

export function getDefenseStructure(id        )                      {
  const structure = defenseById.get(id);
  if (!structure) throw new Error(`Công trình phòng thủ không tồn tại trong camp.json: ${id}`);
  return structure;
}

export function getCampTier(level        )              {
  const tier = CAMP_TIERS.find((t) => t.level === level);
  if (!tier) throw new Error(`Cấp doanh trại không hợp lệ: ${level}`);
  return tier;
}

/** Các station mở ra tính luỹ tiến theo cấp trại: cấp 3 vẫn dùng được lò nung của cấp 2. */
export function stationsUnlockedAt(level        )              {
  return (campJson.stations                                             )
    .filter((s) => s.requiresTier <= level)
    .map((s) => s.id);
}

export function recipesAvailable(level        , stations             )              {
  return RECIPES.filter(
    (r) => r.tier <= level && (r.station === null || stations.includes(r.station)),
  );
}

/**
 * Kiểm tra tính toàn vẹn của bảng cân bằng. Chạy trong test và lúc game khởi động.
 *
 * Với bản offline việc này còn quan trọng hơn bản online: không có server để hotfix,
 * một itemId viết sai lọt ra bản phát hành là một bản vá phải đi qua cửa hàng ứng dụng.
 */
export function validateBalance()           {
  const errors           = [];

  for (const recipe of RECIPES) {
    for (const input of recipe.inputs) {
      if (!itemsById.has(input.itemId)) {
        errors.push(`recipes.json: công thức "${recipe.id}" dùng vật phẩm lạ "${input.itemId}"`);
      }
    }
    if (recipe.outputKind === 'item' && !itemsById.has(recipe.outputId)) {
      errors.push(`recipes.json: công thức "${recipe.id}" tạo ra vật phẩm lạ "${recipe.outputId}"`);
    }
    if (recipe.outputKind === 'defense' && !defenseById.has(recipe.outputId)) {
      errors.push(`recipes.json: công thức "${recipe.id}" tạo công trình lạ "${recipe.outputId}"`);
    }
    if (recipe.station && !stationsUnlockedAt(3).includes(recipe.station)) {
      errors.push(`recipes.json: công thức "${recipe.id}" cần station lạ "${recipe.station}"`);
    }
  }

  for (const [zone, table] of Object.entries(DROP_TABLES)) {
    const total = table.reduce((sum, entry) => sum + entry.weight, 0);
    if (total <= 0) errors.push(`gathering.json: bảng rơi của vùng "${zone}" có tổng trọng số 0`);
    for (const entry of table) {
      if (!itemsById.has(entry.itemId)) {
        errors.push(`gathering.json: vùng "${zone}" rơi vật phẩm lạ "${entry.itemId}"`);
      }
      if (entry.min > entry.max) {
        errors.push(`gathering.json: vùng "${zone}" vật phẩm "${entry.itemId}" có min > max`);
      }
    }
  }

  for (const zone of Object.keys(ZONES)            ) {
    if (!DROP_TABLES[zone]) errors.push(`gathering.json: vùng "${zone}" thiếu bảng rơi`);
  }

                                       
               
                              
                                                                         
    
  for (const action of GATHERING.actions                                  ) {
    if (action.dailyLimitPerPoi !== undefined && (!Number.isInteger(action.dailyLimitPerPoi) || action.dailyLimitPerPoi < 1)) {
      errors.push(`gathering.json: hành động "${action.id}" có hạn mức POI không hợp lệ`);
    }

    if (!action.dailyLimitBySteps) continue;
    if (action.dailyLimitPerPoi === undefined) {
      errors.push(`gathering.json: hành động "${action.id}" có mốc bước nhưng thiếu hạn mức POI cơ sở`);
      continue;
    }

    let previousSteps = 0;
    let previousLimit = action.dailyLimitPerPoi;
    for (const tier of action.dailyLimitBySteps) {
      if (!Number.isInteger(tier.minSteps) || tier.minSteps <= previousSteps) {
        errors.push(`gathering.json: hành động "${action.id}" có mốc bước không tăng dần`);
      }
      if (!Number.isInteger(tier.dailyLimitPerPoi) || tier.dailyLimitPerPoi <= previousLimit) {
        errors.push(`gathering.json: hành động "${action.id}" có hạn mức theo bước không tăng dần`);
      }
      previousSteps = tier.minSteps;
      previousLimit = tier.dailyLimitPerPoi;
    }
  }

  for (const tier of CAMP_TIERS) {
    for (const input of tier.upgradeToNext?.inputs ?? []) {
      if (!itemsById.has(input.itemId)) {
        errors.push(`camp.json: cấp ${tier.level} nâng cấp bằng vật phẩm lạ "${input.itemId}"`);
      }
    }
  }

  for (const wave of NIGHT_DEFENSE.waves) {
    for (const entry of wave.monsters) {
      if (!monstersById.has(entry.id)) {
        errors.push(`monsters.json: đợt ${wave.wave} có quái lạ "${entry.id}"`);
      }
    }
  }

  const allRewards = [
    ...NIGHT_DEFENSE.victoryReward,
    ...BLOOD_MOON.rewards.victory,
    ...BLOOD_MOON.rewards.participationOnly,
  ];
  for (const reward of allRewards) {
    if (!itemsById.has(reward.itemId)) {
      errors.push(`monsters.json: phần thưởng trả vật phẩm lạ "${reward.itemId}"`);
    }
  }

  for (const boss of BLOOD_MOON.bosses) {
    if (boss.weakTo && !itemsById.has(boss.weakTo)) {
      errors.push(`monsters.json: boss "${boss.id}" khắc chế bằng vật phẩm lạ "${boss.weakTo}"`);
    }
  }

  if (!BLOOD_MOON.difficulties.some((d) => d.id === BLOOD_MOON.defaultDifficulty)) {
    errors.push('monsters.json: defaultDifficulty không nằm trong danh sách difficulties');
  }

  // Cốt truyện là xương sống của bản offline — mọi tham chiếu trong tutorial phải tồn tại.
  for (const day of STORY.tutorial.days) {
    for (const quest of day.quests) {
      const objective = quest.objective                                                        ;
      if (objective.itemId && !itemsById.has(objective.itemId)) {
        errors.push(`story.json: nhiệm vụ "${quest.id}" nhắc vật phẩm lạ "${objective.itemId}"`);
      }
      if (objective.recipeId && !recipesById.has(objective.recipeId)) {
        errors.push(`story.json: nhiệm vụ "${quest.id}" nhắc công thức lạ "${objective.recipeId}"`);
      }
      for (const reward of quest.reward ?? []) {
        if (!itemsById.has(reward.itemId)) {
          errors.push(`story.json: nhiệm vụ "${quest.id}" thưởng vật phẩm lạ "${reward.itemId}"`);
        }
      }
    }
  }

  const chapterIndexes = STORY.chapters.map((c) => c.index);
  for (let i = 1; i <= 8; i++) {
    if (!chapterIndexes.includes(i)) errors.push(`story.json: thiếu chương ${i}`);
  }

  const weights = POI.wildernessGrid.proceduralZoneWeights                           ;
  for (const zone of ['trail', 'forest', 'water', 'merchant']) {
    if (typeof weights[zone] !== 'number') {
      errors.push(`poi-mapping.json: thiếu trọng số vùng thủ tục "${zone}"`);
    }
  }

  return errors;
}

/** Ném lỗi nếu bảng cân bằng hỏng — gọi một lần lúc game khởi động. */
export function assertBalanceValid()       {
  const errors = validateBalance();
  if (errors.length > 0) {
    throw new Error(`Bảng cân bằng có ${errors.length} lỗi:\n- ${errors.join('\n- ')}`);
  }
}
