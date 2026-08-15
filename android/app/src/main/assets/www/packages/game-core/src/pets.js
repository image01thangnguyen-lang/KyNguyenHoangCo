/**
 * Hệ thống Thú Cưng Tiền Sử & Ấp Trứng Bằng Bước Chân (Phụ lục B).
 *
 * Người chơi nhặt được trứng cổ đại tại các bí cảnh/rừng sâu.
 * Mỗi bước chân đi bộ thực tế làm ấm quả trứng. Khi đủ số bước, trứng nở ra Linh Thú tiền sử!
 * Linh thú đồng hành, tăng sức chứa túi đồ, hỗ trợ chiến đấu và gia tăng sản lượng nhặt đồ.
 */

import PETS_DATA from '../data/pets.json' with { type: 'json' };
import { getItem } from './balance.js';

                         
             
                 
                        
                        
                 
 

                         
             
                 
                    
                       
                 
                      
                      
                     
                            
                 
 

                                
                
                     
                        
                       
                   
 

                            
                
                 
                
                               
                    
 

export const EGGS = PETS_DATA.eggs            ;
export const PETS = PETS_DATA.pets            ;

export function getPetDef(petId        )         {
  const found = PETS.find((p) => p.id === petId);
  if (!found) throw new Error(`Không tìm thấy thú cưng: ${petId}`);
  return found;
}

export function getEggDef(eggId        )         {
  const found = EGGS.find((e) => e.id === eggId);
  if (!found) throw new Error(`Không tìm thấy trứng: ${eggId}`);
  return found;
}

/** Bắt đầu ấp một quả trứng bằng số bước chân hiện tại. */
export function startIncubation(eggId        , currentLifetimeSteps        )                {
  const def = getEggDef(eggId);
  return {
    eggId,
    startSteps: currentLifetimeSteps,
    requiredSteps: def.requiredSteps,
    currentSteps: 0,
    hatched: false,
  };
}

/** Cập nhật tiến độ ấp trứng theo số bước chân mới nhất. */
export function tickEggIncubation(
  incubating               ,
  currentLifetimeSteps        ,
)                                                                   {
  if (incubating.hatched) {
    return { incubating, newlyHatchedPet: null };
  }

  const stepsWalked = Math.max(0, currentLifetimeSteps - incubating.startSteps);
  const isReady = stepsWalked >= incubating.requiredSteps;

  const updated                = {
    ...incubating,
    currentSteps: stepsWalked,
    hatched: isReady,
  };

  if (isReady) {
    const def = getEggDef(incubating.eggId);
    const petId = def.hatchesInto[Math.floor(Math.random() * def.hatchesInto.length)] ;
    const petDef = getPetDef(petId);

    const newPet            = {
      petId,
      nameVi: petDef.nameVi,
      level: 1,
      friendship: 50,
      isActive: true,
    };

    return { incubating: updated, newlyHatchedPet: newPet };
  }

  return { incubating: updated, newlyHatchedPet: null };
}

/** Cho thú cưng ăn để tăng độ thân thiết và cấp độ. */
export function feedPet(
  pet           ,
  foodItemId        ,
)                                                     {
  const def = getPetDef(pet.petId);
  const isFav = def.favoriteFood === foodItemId;
  const food = getItem(foodItemId);

  const gain = isFav ? 25 : 10;
  const newFriendship = Math.min(100, pet.friendship + gain);
  const newLevel = newFriendship >= 100 && pet.level < 5 ? pet.level + 1 : pet.level;

  return {
    pet: {
      ...pet,
      friendship: newFriendship === 100 && newLevel > pet.level ? 20 : newFriendship,
      level: newLevel,
    },
    ok: true,
    messageVi: isFav
      ? `❤️ ${def.nameVi} cực kỳ thích món ${food.nameVi}! (Độ thân thiết +${gain})`
      : `🍖 ${def.nameVi} đã ăn ${food.nameVi}. (Độ thân thiết +${gain})`,
  };
}

/** Tính tổng bonus từ Thú Cưng đang xuất chiến. */
export function activePetBonus(pets              = [])   
                      
                      
                     
                           
  {
  let attack = 0;
  let gather = 0;
  let carry = 0;
  let campDef = 0;

  for (const p of pets) {
    if (!p.isActive) continue;
    const def = getPetDef(p.petId);
    const lvlMultiplier = 1 + (p.level - 1) * 0.2;
    attack += def.attackBonus * lvlMultiplier;
    gather += def.gatherBonus * lvlMultiplier;
    carry += Math.round(def.carryBonus * lvlMultiplier);
    campDef += Math.round((def.campDefenseBonus ?? 0) * lvlMultiplier);
  }

  return {
    attackBonus: attack,
    gatherBonus: gather,
    carryBonus: carry,
    campDefenseBonus: campDef,
  };
}

/** Lấy chỉ số hỗ trợ chiến đấu nhanh từ Thú Cưng. */
export function getPetCombatBonus(petId               )                                                  {
  if (!petId) return { atkMultiplier: 1.0, defenseBonus: 0 };
  try {
    const def = getPetDef(petId);
    return {
      atkMultiplier: 1.0 + (def.attackBonus || 0),
      defenseBonus: def.campDefenseBonus || 0,
    };
  } catch {
    return { atkMultiplier: 1.0, defenseBonus: 0 };
  }
}
