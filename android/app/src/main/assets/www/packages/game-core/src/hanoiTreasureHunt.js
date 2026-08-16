/**
 * HỆ THỐNG CỔ ĐỒ TẦM BẢO & RÈN LUYỆN TRÍ NHỚ ĐƯỜNG PHỐ HÀ NỘI
 *
 * Cơ chế thử thách khám phá không gian thực:
 * Thay vì nhặt đồ dễ dàng ngay trước mặt, game phát ra các "Mật Thư Cổ Đại / Tin Đồn Kho Báu"
 * chỉ định một Địa Danh Hà Nội có thật (cách 500m - 1.000m).
 * Người chơi phải tự vận dụng trí nhớ đường sá và định hướng của bản thân để đến đó nhận kho báu.
 */

import { distanceMeters } from './world.js';
                                              
                                                        

                                                                                                       

                               
             
                      
                       
                    
                    
                                                 
                                
                         
                                 
                        
                              
                                  
                     
                              
                      
                      
                      
                                  
                      
 

/** Danh hiệu Thổ Địa Hà Thành theo số lượng kho báu đã tìm thấy */
export function getHanoiExplorerTitle(claimedCount        )                                                        {
  if (claimedCount >= 50) return { titleVi: 'Bậc Thầy Địa Lý Thăng Long', rank: 5, badgeEmoji: '👑' };
  if (claimedCount >= 25) return { titleVi: 'Thổ Địa Hà Thành', rank: 4, badgeEmoji: '🏛️' };
  if (claimedCount >= 10) return { titleVi: 'Kỳ Nhân Phố Phường', rank: 3, badgeEmoji: '📜' };
  if (claimedCount >= 3)  return { titleVi: 'Du Khách Thông Thạo', rank: 2, badgeEmoji: '🧭' };
  return { titleVi: 'Tân Thủ Dạo Phố', rank: 1, badgeEmoji: '🚶' };
}

/**
 * Sinh Manh Mối Kho Báu Hà Nội mới dựa trên vị trí hiện tại và danh sách POI
 * Phạm vi lý tưởng: 500m <= khoảng cách <= 1.000m
 */
export function generateHanoiTreasureClue(
  currentPos        ,
  pois       ,
  nowMs        ,
  lastPoiId         ,
)                      {
  if (!pois || pois.length === 0) return null;

  // 1. Tính khoảng cách tới tất cả các POI
  const candidates = pois
    .filter((p) => p.id !== lastPoiId && Boolean(p.nameVi))
    .map((poi) => {
      const dist = distanceMeters(currentPos, { lat: poi.lat, lon: poi.lon });
      return { poi, dist };
    });

  // 2. Lọc các POI nằm trong dải 500m - 1000m
  let matched = candidates.filter((c) => c.dist >= 500 && c.dist <= 1000);

  // Fallback 1: Nếu không có điểm nào trong dải 500-1000m, mở rộng 400m - 1500m
  if (matched.length === 0) {
    matched = candidates.filter((c) => c.dist >= 400 && c.dist <= 1500);
  }

  // Fallback 2: Nếu vẫn trống (ở vùng xa), lấy điểm gần nhất cách tối thiểu 250m
  if (matched.length === 0) {
    matched = candidates.filter((c) => c.dist >= 250);
  }

  if (matched.length === 0) {
    // Nếu vẫn không có, lấy bất kỳ điểm nào xa nhất hiện có
    candidates.sort((a, b) => b.dist - a.dist);
    if (candidates.length > 0) matched = [candidates[0]];
    else return null;
  }

  // 3. Chọn ngẫu nhiên 1 điểm trong danh sách ứng viên
  const chosenIndex = Math.floor(Math.random() * matched.length);
  const chosen = matched[chosenIndex];
  const poi = chosen.poi;
  const initialDist = Math.round(chosen.dist);

  // 4. Quyết định loại kho báu và phần thưởng
  const rand = Math.random();
  let rewardTier                     = 'common_cache';
  let rewardTitleVi = 'Rương Quân Nhu Lương Thực';
  let rewardDescriptionVi = 'Gói tiếp tế lương thực & nước uống dồi dào duy trì thể lực sống sót.';
  let rewards            = {
    cooked_meat: 4,
    boiled_water: 3,
    ancient_coin: 15,
    stick: 6,
    stone: 4,
  };
  let memoryScore = 100;

  if (rand > 0.85) {
    rewardTier = 'royal_treasure';
    rewardTitleVi = 'Cổ Vật Hoàng Cung Thăng Long';
    rewardDescriptionVi = 'Báu vật hoàng gia thượng hạng: Cung tên cổ đại, bạc vàng và dược liệu.';
    rewards = {
      ancient_coin: 60,
      divine_dragon_bow: 1,
      arrow: 20,
      iron_ore: 5,
      cooked_meat: 6,
      boiled_water: 5,
    };
    memoryScore = 300;
  } else if (rand > 0.60) {
    rewardTier = 'ancient_relic';
    rewardTitleVi = 'Di Sản Tiền Sử Hà Thành';
    rewardDescriptionVi = 'Kho báu thợ rèn: Kim loại quý, đồng vàng và cung săn thú hoang.';
    rewards = {
      ancient_coin: 35,
      bow: 1,
      arrow: 12,
      raw_iron: 4,
      trap_rabbit: 2,
      cooked_meat: 5,
    };
    memoryScore = 200;
  } else if (rand > 0.30) {
    rewardTier = 'rare_military';
    rewardTitleVi = 'Hòm Tiếp Tế Chiến Binh';
    rewardDescriptionVi = 'Vật tư quân nhu chiến trận: Mũi tên đồng, đá nhọn và đồng cổ.';
    rewards = {
      ancient_coin: 25,
      arrow: 10,
      sharp_stone: 6,
      cooked_meat: 4,
      boiled_water: 4,
    };
    memoryScore = 150;
  }

  const clueId = `clue_${nowMs}_${Math.floor(Math.random() * 10000)}`;

  return {
    id: clueId,
    targetPoiId: poi.id,
    targetNameVi: poi.nameVi,
    targetLat: poi.lat,
    targetLon: poi.lon,
    initialDistanceMeters: initialDist,
    rewardTier,
    rewardTitleVi,
    rewardDescriptionVi,
    rewards,
    memoryScore,
    createdAtMs: nowMs,
    expiresAtMs: nowMs + 48 * 3600 * 1000, // 48 giờ
  };
}

                              
              
                    
                             
                            
                      
                            
 

/**
 * Khai quật kho báu khi người chơi đến trong phạm vi tương tác (<= 35m)
 */
export function claimHanoiTreasure(
  profile             ,
  clue              ,
  currentPos        ,
  nowMs        ,
)              {
  if (!clue) {
    return { ok: false, messageVi: 'Không có manh mối kho báu nào đang kích hoạt.' };
  }

  const dist = distanceMeters(currentPos, { lat: clue.targetLat, lon: clue.targetLon });

  // Bán kính tiếp cận hợp lệ: <= 35m (hoặc dung sai GPS 45m)
  if (dist > 45) {
    const remain = Math.round(dist);
    return {
      ok: false,
      messageVi: `Bạn vẫn còn cách ${clue.targetNameVi} khoảng ${remain}m. Hãy dùng trí nhớ đi tiếp đến gần hơn!`,
    };
  }

  // Cộng phần thưởng vào túi đồ của người chơi
  for (const [itemId, qty] of Object.entries(clue.rewards)) {
    profile.player.carried[itemId] = (profile.player.carried[itemId] ?? 0) + qty;
  }

  // Cập nhật thống kê
  profile.treasuresClaimedCount = (profile.treasuresClaimedCount ?? 0) + 1;
  profile.treasureMemoryScore = (profile.treasureMemoryScore ?? 0) + clue.memoryScore;
  profile.activeTreasureClue = null;
  profile.lastClaimedTreasureAtMs = nowMs;

  const titleInfo = getHanoiExplorerTitle(profile.treasuresClaimedCount);

  return {
    ok: true,
    messageVi: `🎉 XUẤT SẮC! Bạn đã định hướng trí nhớ chuẩn xác tới ${clue.targetNameVi} và khai quật thành công ${clue.rewardTitleVi}!`,
    claimedClue: clue,
    gainedRewards: clue.rewards,
    totalScore: profile.treasureMemoryScore,
    newExplorerTitle: `${titleInfo.badgeEmoji} ${titleInfo.titleVi}`,
  };
}
