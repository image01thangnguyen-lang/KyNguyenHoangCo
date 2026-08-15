/**
 * Chống lùi đồng hồ (§4.3 bản 2.0).
 *
 * Không có server nghĩa là đồng hồ máy là nguồn thời gian DUY NHẤT. Người chơi chỉnh giờ
 * lùi lại có thể lặp lại hồi chiêu, triệu Trăng Máu nhiều lần, hoặc né suy giảm chỉ số.
 *
 * Cách xử lý cố tình nhẹ tay, đúng tinh thần "game đơn, gian lận chỉ tự lừa mình":
 *  - Lưu mốc thời gian LỚN NHẤT từng thấy.
 *  - Nếu giờ máy nhỏ hơn mốc đó (quá dung sai), tạm KHOÁ các sự kiện theo lịch, đồng thời
 *    ĐÓNG BĂNG suy giảm sinh tồn — không trừng phạt, chỉ dừng đồng hồ game lại.
 *  - Khi giờ máy vượt lại mốc, mọi thứ tự động trở lại bình thường, không cần thao tác gì.
 *
 * Chú ý: đổi múi giờ khi đi du lịch KHÔNG bị coi là lùi đồng hồ, vì mốc lưu là epoch UTC.
 */

import { DEVICE_CHECKS } from './balance.js';

                             
                                                        
                    
                                                                            
                        
 

                               
                                                                                                  
                
                                                                       
                   
                      
                                 
                          
                     
                    
 

export function createClockState(nowMs        )             {
  return { maxSeenMs: nowMs, rollbackCount: 0 };
}

export function readClock(state            , deviceMs        )               {
  const guard = DEVICE_CHECKS.clockGuard;
  const behindBy = state.maxSeenMs - deviceMs;

  if (behindBy > guard.toleranceMs) {
    return {
      // Giữ nguyên mốc cũ: thời gian game đứng yên cho tới khi giờ máy đuổi kịp.
      nowMs: state.maxSeenMs,
      deviceMs,
      rolledBack: true,
      scheduledEventsLocked: guard.lockScheduledEventsOnRollback,
      survivalFrozen: guard.freezeSurvivalDecayOnRollback,
      messageVi: guard.messageVi,
      state: { maxSeenMs: state.maxSeenMs, rollbackCount: state.rollbackCount + 1 },
    };
  }

  return {
    nowMs: deviceMs,
    deviceMs,
    rolledBack: false,
    scheduledEventsLocked: false,
    survivalFrozen: false,
    state: { maxSeenMs: Math.max(state.maxSeenMs, deviceMs), rollbackCount: state.rollbackCount },
  };
}

/**
 * Nguồn thời gian dùng xuyên suốt game. Gói lại thành một object nhỏ để không có chỗ nào
 * trong code gọi thẳng `Date.now()` — nhờ vậy test tua thời gian được, và mọi phép tính
 * đều đi qua đúng một lớp bảo vệ.
 */
                            
                
                       
                      
                                                                   
                            
 

export function createGameClock(
  initialState             ,
  source               = () => Date.now(),
)            {
  let state = initialState ?? createClockState(source());
  let testOffsetMs = 0;

  const read = ()               => {
    const reading = readClock(state, source() + testOffsetMs);
    state = reading.state;
    return reading;
  };

  return {
    now: () => read().nowMs,
    read,
    state: () => state,
    advance: (ms        ) => {
      testOffsetMs += ms;
    },
  };
}
