/**
 * Thời tiết tính hoàn toàn trên máy (§2, §4.1 bản 2.0).
 *
 * Xác định theo (ngày, vùng miền, ô lưới): mở app mười lần trong một ngày vẫn thấy đúng
 * một kiểu thời tiết, và dự báo được cả tuần mà không cần lưu gì thêm.
 *
 * Nguyên tắc thiết kế (§11): thời tiết xấu phải MỞ RA lối chơi khác chứ không chỉ trừng phạt.
 * Mưa cho nước miễn phí tại trại; nắng gắt đẩy người chơi vào chuỗi chế tạo trong nhà;
 * rét làm đêm nguy hiểm hơn nhưng cũng đáng giá hơn.
 */

import { WEATHER } from './balance.ts';
import { createRng, hashSeed } from './rng.ts';
import { dayKey, toLocalTime } from './time.ts';
import type { LatLon } from './world.ts';
import { cellAt } from './world.ts';

export type RegionId = 'north' | 'central' | 'south';
export type ConditionId = 'clear' | 'cloudy' | 'drizzle' | 'rain' | 'downpour' | 'heat' | 'cold';

export interface WeatherToday {
  day: string;
  region: RegionId;
  regionNameVi: string;
  condition: ConditionId;
  conditionNameVi: string;
  raining: boolean;
  rainIntensity: number;
  hot: boolean;
  cold: boolean;
  /** Số giờ mưa trong ngày — dùng để tính lượng nước hứng được tại trại. */
  rainHours: number;
  messageVi: string;
}

export function regionOf(lat: number): RegionId {
  const r = WEATHER.regions;
  if (lat >= r.north.minLat) return 'north';
  if (lat >= r.central.minLat) return 'central';
  return 'south';
}

/**
 * Thời tiết của một ngày tại một vị trí.
 *
 * Seed gắn với ô lưới 5 km chứ không phải toạ độ chính xác — hai người trong cùng một quận
 * thấy cùng thời tiết (hợp lý), nhưng Hà Nội và Hải Phòng thì khác nhau.
 */
export function weatherFor(at: LatLon, nowMs: number, offsetMinutes?: number): WeatherToday {
  const day = dayKey(nowMs, offsetMinutes);
  const month = Number(day.slice(5, 7));
  const region = regionOf(at.lat);
  const areaCell = cellAt(at.lat, at.lon, 5000);

  const rng = createRng(hashSeed('weather', day, areaCell.id));
  const monthIndex = month - 1;

  const rainChance = WEATHER.monthlyRainChance[region][monthIndex] ?? 0.2;
  const heatChance = WEATHER.monthlyHeatChance[region][monthIndex] ?? 0.1;
  const coldChance = WEATHER.monthlyColdChance[region][monthIndex] ?? 0;

  const roll = rng();
  let condition: ConditionId;

  if (roll < rainChance) {
    // Trong ngày mưa, chia tiếp thành mưa phùn / mưa / mưa lớn.
    const intensity = rng();
    condition = intensity < 0.35 ? 'drizzle' : intensity < 0.85 ? 'rain' : 'downpour';
  } else if (roll < rainChance + coldChance) {
    condition = 'cold';
  } else if (roll < rainChance + coldChance + heatChance) {
    condition = 'heat';
  } else {
    condition = rng() < 0.45 ? 'cloudy' : 'clear';
  }

  const def = WEATHER.conditions.find((c) => c.id === condition)!;
  const raining = def.rain === true;
  const rainIntensity = raining ? ((def as { rainIntensity?: number }).rainIntensity ?? 1) : 0;

  return {
    day,
    region,
    regionNameVi: WEATHER.regions[region].nameVi,
    condition,
    conditionNameVi: def.nameVi,
    raining,
    rainIntensity,
    hot: condition === 'heat',
    cold: condition === 'cold',
    rainHours: raining ? Math.round((2 + rng() * 6) * rainIntensity) : 0,
    messageVi: raining
      ? WEATHER.effects.rain.messageVi
      : condition === 'heat'
        ? WEATHER.effects.heat.messageVi
        : condition === 'cold'
          ? WEATHER.effects.cold.messageVi
          : 'Trời quang. Ngày tốt để đi xa.',
  };
}

/** Dự báo vài ngày tới — hoàn toàn miễn phí vì thời tiết là hàm xác định của ngày. */
export function forecast(at: LatLon, nowMs: number, days = 3, offsetMinutes?: number): WeatherToday[] {
  const out: WeatherToday[] = [];
  for (let i = 0; i < days; i++) {
    out.push(weatherFor(at, nowMs + i * 86_400_000, offsetMinutes));
  }
  return out;
}

export interface WeatherModifiers {
  satietyDecayMultiplier: number;
  hydrationDecayMultiplier: number;
  forestPickupBonus: number;
  craftSpeedBonus: number;
  nightThreatBonus: number;
}

export function modifiersOf(weather: WeatherToday): WeatherModifiers {
  const e = WEATHER.effects;
  return {
    satietyDecayMultiplier: weather.cold ? e.cold.satietyDecayMultiplier : 1,
    hydrationDecayMultiplier: weather.raining
      ? e.rain.hydrationDecayMultiplier
      : weather.hot
        ? e.heat.hydrationDecayMultiplier
        : 1,
    forestPickupBonus: weather.raining ? e.rain.forestPickupBonus : 0,
    craftSpeedBonus: weather.hot ? e.heat.indoorCraftSpeedBonus : 0,
    nightThreatBonus: weather.cold ? e.cold.nightThreatBonus : 0,
  };
}

/**
 * Nước mưa hứng được tại trại kể từ lần mở app trước (§ sự kiện mưa).
 * Ngày mưa thành ngày lợi thế: khỏi phải lặn lội ra hồ.
 */
export function rainHarvest(
  weather: WeatherToday,
  hoursSinceLastVisit: number,
  hasCampfire: boolean,
): { qty: number; messageVi?: string } {
  if (!weather.raining) return { qty: 0 };

  const effectiveHours = Math.min(hoursSinceLastVisit, weather.rainHours);
  if (effectiveHours <= 0) return { qty: 0 };

  const qty = Math.min(
    WEATHER.effects.rain.maxAccumulated,
    Math.floor(effectiveHours * WEATHER.effects.rain.rawWaterPerHourAtCamp * weather.rainIntensity),
  );
  if (qty <= 0) return { qty: 0 };

  return {
    qty,
    messageVi: hasCampfire
      ? `Bạn hứng được ${qty} bình nước mưa. Đun sôi rồi hãy uống.`
      : `Bạn hứng được ${qty} bình nước mưa. Cần lửa trại để đun sôi.`,
  };
}

/**
 * Đồng bộ thời tiết thật — TUỲ CHỌN, mặc định tắt (§2).
 *
 * Hàm này cố ý KHÔNG gọi mạng: nó chỉ nhận kết quả mà tầng ứng dụng đã lấy được (nếu người
 * chơi bật tuỳ chọn và tình cờ có mạng) rồi trộn vào thời tiết trong game. Nhờ vậy game-core
 * giữ đúng cam kết "không có lệnh gọi mạng nào lúc chạy", và thất bại mạng không bao giờ
 * làm kẹt vòng lặp chơi.
 */
export function applyRealWeather(
  simulated: WeatherToday,
  real: { condition: ConditionId; rainHours?: number } | null,
): WeatherToday {
  if (!real) return simulated;
  const def = WEATHER.conditions.find((c) => c.id === real.condition);
  if (!def) return simulated;

  const raining = def.rain === true;
  return {
    ...simulated,
    condition: real.condition,
    conditionNameVi: def.nameVi,
    raining,
    rainIntensity: raining ? ((def as { rainIntensity?: number }).rainIntensity ?? 1) : 0,
    hot: real.condition === 'heat',
    cold: real.condition === 'cold',
    rainHours: real.rainHours ?? (raining ? 4 : 0),
  };
}

/** Buổi trong ngày, dùng cho lớp không khí của renderer bản đồ. */
export function skyTint(nowMs: number, weather: WeatherToday, offsetMinutes?: number): string {
  const { hour } = toLocalTime(nowMs, offsetMinutes);
  if (hour >= 20 || hour < 5) return weather.raining ? '#0a0f14' : '#0d1117';
  if (hour >= 18) return weather.raining ? '#2a2620' : '#3d2b1f';
  if (weather.raining) return '#4a5259';
  if (weather.hot) return '#c9a227';
  return '#8fae6b';
}
