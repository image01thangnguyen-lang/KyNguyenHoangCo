/**
 * Thời gian trong game gắn với giờ thật của người chơi (§5, §5.4, §5.5).
 *
 * Mặc định múi giờ Việt Nam (UTC+7, không có DST) nên có thể tính bằng độ lệch cố định —
 * đơn giản và không cần thư viện timezone. Khi mở rộng ra Đông Nam Á, thay `offsetMinutes`
 * theo từng người chơi là đủ (các nước ASEAN đều không dùng DST).
 */

import { BLOOD_MOON, NIGHT_DEFENSE, GATHERING } from './balance.js';

export const VN_UTC_OFFSET_MINUTES = 7 * 60;

                            
                                                       
              
               
                 
                                    
                    
 

export function toLocalTime(ms        , offsetMinutes = VN_UTC_OFFSET_MINUTES)            {
  const shifted = new Date(ms + offsetMinutes * 60_000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const date = String(shifted.getUTCDate()).padStart(2, '0');
  return {
    day: `${year}-${month}-${date}`,
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    dayOfWeek: shifted.getUTCDay(),
  };
}

export function dayKey(ms        , offsetMinutes = VN_UTC_OFFSET_MINUTES)         {
  return toLocalTime(ms, offsetMinutes).day;
}

                                                

/**
 * Ban ngày < 18h, chiều tối 18–20h, đêm từ 20h (khung phòng thủ trại) tới rạng sáng.
 * Chỉ dùng cho không khí và cho việc mở khung phòng thủ — KHÔNG dùng để tăng thưởng ban đêm.
 */
export function phaseOf(ms        , offsetMinutes = VN_UTC_OFFSET_MINUTES)        {
  const { hour } = toLocalTime(ms, offsetMinutes);
  if (hour >= NIGHT_DEFENSE.windowStartHour || hour < 5) return 'night';
  if (hour >= 18) return 'evening';
  return 'day';
}

export function isNightDefenseWindow(ms        , offsetMinutes = VN_UTC_OFFSET_MINUTES)          {
  const { hour } = toLocalTime(ms, offsetMinutes);
  return hour >= NIGHT_DEFENSE.windowStartHour && hour < NIGHT_DEFENSE.windowEndHour;
}

export function isBloodMoonWindow(ms        , offsetMinutes = VN_UTC_OFFSET_MINUTES)          {
  const { hour, dayOfWeek } = toLocalTime(ms, offsetMinutes);
  return (
    dayOfWeek === BLOOD_MOON.dayOfWeek && hour >= BLOOD_MOON.startHour && hour < BLOOD_MOON.endHour
  );
}

/** Khung Trăng Máu gần nhất (đang diễn ra hoặc sắp tới) — dùng để đếm ngược trên HUD. */
export function bloodMoonWindow(
  ms        ,
  offsetMinutes = VN_UTC_OFFSET_MINUTES,
)                                     {
  const local = toLocalTime(ms, offsetMinutes);
  const midnightLocalMs = ms - ((local.hour * 60 + local.minute) * 60_000 + (ms % 60_000));
  let daysAhead = (BLOOD_MOON.dayOfWeek - local.dayOfWeek + 7) % 7;

  if (daysAhead === 0 && local.hour >= BLOOD_MOON.endHour) daysAhead = 7;

  const startMs = midnightLocalMs + daysAhead * 86_400_000 + BLOOD_MOON.startHour * 3_600_000;
  const endMs = midnightLocalMs + daysAhead * 86_400_000 + BLOOD_MOON.endHour * 3_600_000;
  return { startMs, endMs };
}

/**
 * Khung đánh bù sáng Chủ Nhật (§5.5 bản 2.0) — luôn là buổi sáng NGAY SAU khung Trăng Máu
 * của tuần đó, nên tính từ `bloodMoonWindow` để hai mốc không bao giờ lệch nhau.
 */
export function makeupWindow(
  bloodMoonEndMs        ,
)                                     {
  const makeup = BLOOD_MOON.makeupFight;
  const bloodMoonDayMidnight =
    bloodMoonEndMs - BLOOD_MOON.endHour * 3_600_000;
  const nextDayMidnight = bloodMoonDayMidnight + 86_400_000;
  return {
    startMs: nextDayMidnight + makeup.startHour * 3_600_000,
    endMs: nextDayMidnight + makeup.endHour * 3_600_000,
  };
}

export function isMakeupWindow(ms        , offsetMinutes = VN_UTC_OFFSET_MINUTES)          {
  const { hour, dayOfWeek } = toLocalTime(ms, offsetMinutes);
  const makeup = BLOOD_MOON.makeupFight;
  return dayOfWeek === makeup.dayOfWeek && hour >= makeup.startHour && hour < makeup.endHour;
}

/**
 * §5.4 + §6.1: ban đêm luôn hiện cảnh báo an toàn.
 *
 * Khoá POI ngoài trời sau 21h là TUỲ CHỌN của phụ huynh, không mặc định: bản offline
 * không có tài khoản nên game không thể biết ai là trẻ em, và §6.2 bản 2.0 đã bỏ nghĩa vụ
 * giới hạn giờ chơi bắt buộc. Ép buộc mà không biết tuổi thì chỉ làm phiền người lớn.
 */
export function outdoorPolicy(
  ms        ,
  parentalLockEnabled         ,
  offsetMinutes = VN_UTC_OFFSET_MINUTES,
)                                                                        {
  const { hour } = toLocalTime(ms, offsetMinutes);
  const showSafetyWarning =
    GATHERING.nightWalking.showSafetyWarning && hour >= GATHERING.nightWalking.afterHour;

  if (parentalLockEnabled && hour >= GATHERING.nightWalking.parentalPoiLockAfterHour) {
    return {
      showSafetyWarning,
      poiLocked: true,
      reasonVi: `Khoá của phụ huynh: sau ${GATHERING.nightWalking.parentalPoiLockAfterHour}h không tương tác POI ngoài trời. Về trại chế tạo và phòng thủ vẫn chơi bình thường.`,
    };
  }

  return { showSafetyWarning, poiLocked: false };
}

export const HOUR_MS = 3_600_000;
export const MINUTE_MS = 60_000;
