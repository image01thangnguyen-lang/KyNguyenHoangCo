import lunarEventsData from '../data/lunar-events.json' with { type: 'json' };

                            
              
                
               
                  
 

                                   
             
                 
                 
                     
                   
                   
                 
                         
                            
                               
                           
                            
                         
 

/**
 * Thuật toán tính Lịch Âm Việt Nam thiên văn chuẩn xác (Múi giờ GMT+7).
 * Hoạt động 100% offline, 0 dependency.
 */

// Đổi ngày dương sang Julian Day Number
function jdFromDate(d        , m        , y        )         {
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  let jd = d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
  if (jd < 2299161) {
    jd = d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - 32083;
  }
  return jd;
}

// Đổi Julian Day Number sang ngày dương [d, m, y]
function jdToDate(jd        )                           {
  let a = jd + 32044;
  let b = Math.floor((4 * a + 3) / 146097);
  let c = a - Math.floor((146097 * b) / 4);
  let d = Math.floor((4 * c + 3) / 1461);
  let e = c - Math.floor((1461 * d) / 4);
  let m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return [day, month, year];
}

// Tính ngày Sóc (New Moon) theo k (chỉ số tháng thiên văn)
function getNewMoonDay(k        , timeZone = 7)         {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = Math.PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * M * dr);
  C1 -= 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(2 * Mpr * dr);
  C1 -= 0.0004 * Math.sin(3 * Mpr * dr);
  C1 += 0.0104 * Math.sin(2 * F * dr) - 0.0051 * Math.sin((M + Mpr) * dr);
  C1 -= 0.0074 * Math.sin((M - Mpr) * dr) + 0.0004 * Math.sin((2 * F + M) * dr);
  C1 -= 0.0004 * Math.sin((2 * F - M) * dr) - 0.0006 * Math.sin((2 * F + Mpr) * dr);
  C1 += 0.001 * Math.sin((2 * F - Mpr) * dr) + 0.0005 * Math.sin((2 * Mpr + M) * dr);
  let JdNew = Jd1 + C1;
  return Math.floor(JdNew + 0.5 + timeZone / 24);
}

// Tính kinh độ Mặt Trời (Sun Longitude) tại ngày Sóc
function getSunLongitude(dayNumber        , timeZone = 7)         {
  const T = (dayNumber - 2451545.0 + 0.5 - timeZone / 24) / 36525;
  const dr = Math.PI / 180;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T * T - 0.00000048 * T * T * T;
  const C = (1.9146 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M * dr)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * M * dr)
    + 0.00029 * Math.sin(3 * M * dr);
  let L = L0 + C;
  L = L * dr;
  L = L - Math.PI * 2 * Math.floor(L / (Math.PI * 2));
  return Math.floor((L / (Math.PI * 2)) * 12);
}

// Tìm ngày bắt đầu tháng 11 âm lịch của năm trước
function getLunarMonth11(yy        , timeZone = 7)         {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = Math.floor(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  const sunLong = getSunLongitude(nm, timeZone);
  if (sunLong >= 9) {
    nm = getNewMoonDay(k - 1, timeZone);
  }
  return nm;
}

/**
 * Chuyển ngày Dương Lịch sang Âm Lịch Việt Nam chuẩn xác.
 */
export function convertSolarToLunar(solarDay        , solarMonth        , solarYear        , timeZone = 7)            {
  const currentJd = jdFromDate(solarDay, solarMonth, solarYear);
  const k = Math.floor((currentJd - 2415021.076998695) / 29.530588853);
  let nm = getNewMoonDay(k + 1, timeZone);
  if (currentJd < nm) {
    nm = getNewMoonDay(k, timeZone);
  }

  let a11 = getLunarMonth11(solarYear, timeZone);
  let b11 = a11;
  let lunarYear = solarYear;
  if (currentJd >= a11) {
    b11 = getLunarMonth11(solarYear + 1, timeZone);
  } else {
    b11 = a11;
    a11 = getLunarMonth11(solarYear - 1, timeZone);
    lunarYear = solarYear - 1;
  }

  const offsetMonths = Math.floor((nm - a11) / 29);
  let lunarMonth = offsetMonths + 11;
  let isLeap = false;

  const totalMonths = Math.floor((b11 - a11) / 29);
  if (totalMonths > 12) {
    // Có tháng nhuận
    let leapMonthIndex = -1;
    let lastSunLong = -1;
    for (let i = 0; i <= totalMonths; i++) {
      const nmTest = getNewMoonDay(Math.floor((a11 - 2415021) / 29.530588853) + i, timeZone);
      const sl = getSunLongitude(nmTest, timeZone);
      if (sl === lastSunLong && leapMonthIndex < 0) {
        leapMonthIndex = i;
      }
      lastSunLong = sl;
    }
    if (leapMonthIndex >= 0) {
      if (offsetMonths === leapMonthIndex) {
        isLeap = true;
        lunarMonth = offsetMonths + 10;
      } else if (offsetMonths > leapMonthIndex) {
        lunarMonth = offsetMonths + 10;
      }
    }
  }

  if (lunarMonth > 12) {
    lunarMonth -= 12;
  }
  if (lunarMonth >= 11 && currentJd >= a11) {
    lunarYear = solarYear;
  } else if (lunarMonth < 11 && currentJd < a11) {
    lunarYear = solarYear;
  }

  const lunarDay = currentJd - nm + 1;
  return {
    day: lunarDay,
    month: lunarMonth,
    year: lunarYear,
    isLeap,
  };
}

/**
 * Lấy sự kiện Lịch Âm Hoang Cổ đang diễn ra theo thời gian hiện tại.
 */
export function getActiveLunarEvent(nowMs        )                                                       {
  const date = new Date(nowMs);
  const lunar = convertSolarToLunar(date.getDate(), date.getMonth() + 1, date.getFullYear());

  const events = lunarEventsData.events                      ;
  for (const ev of events) {
    if (lunar.month === ev.startMonth && lunar.day >= ev.startDay && lunar.day <= ev.endDay) {
      return {
        ...ev,
        lunarDate: lunar,
      };
    }
  }

  return null;
}
