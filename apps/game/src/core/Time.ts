import { GameState } from './State.ts';

export function calculateWeather(lat = 21.0285, lon = 105.8542, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const dayStr = year + '-' + String(month).padStart(2, '0') + '-' + String(date).padStart(2, '0');
  let hash = 0;
  for (let i = 0; i < dayStr.length; i++) {
    hash = ((hash << 5) - hash) + dayStr.charCodeAt(i);
    hash |= 0;
  }
  const seed = (Math.abs(hash) % 1000) / 1000;
  const isNorth = lat >= 16.0;
  const isRainySeason = isNorth ? (month >= 5 && month <= 9) : (month >= 5 && month <= 11);
  let condition = 'clear';
  let nameVi = 'Trời Trong Xanh';
  let desc = 'Thời tiết ấm áp lý tưởng cho việc khai hoang và thu lượm tài nguyên.';
  let icon = '☀️';
  let isRaining = false;
  let rainIntensity = 0;
  let temp = 27;

  if (isRainySeason) {
    if (seed < 0.45) {
      condition = 'rain';
      nameVi = 'Mưa Rào Tiền Sử';
      desc = 'Cây cối sinh trưởng mạnh, nước ngọt tràn trề, tăng tỷ lệ xuất hiện nấm quý.';
      icon = '🌧️';
      isRaining = true;
      rainIntensity = 0.8;
      temp = 24;
    } else if (seed < 0.70) {
      condition = 'heat';
      nameVi = 'Nắng Gắt';
      desc = 'Mặt trời thiêu đốt, tốc độ khát nước tăng 40%, hãy uống nước thường xuyên.';
      icon = '🌡️';
      temp = 36;
    }
  } else {
    if (isNorth && (month === 12 || month <= 2) && seed < 0.40) {
      condition = 'cold';
      nameVi = 'Gió Rét';
      desc = 'Không khí lạnh buốt, tốc độ đói tăng 30%, cần lửa trại để sưởi ấm.';
      icon = '❄️';
      temp = 14;
    }
  }
  return {
    condition,
    nameVi,
    desc,
    icon,
    isRaining,
    rainIntensity,
    temperature: temp,
    regionName: isNorth ? 'Đại Lục Phía Bắc (Nhiệt Đới Gió Mùa)' : 'Thảo Nguyên Phía Nam (Xích Đạo)'
  };
}

export function updateWorldWeatherAndClock() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const vnDate = new Date(utc + (3600000 * 7));

  const hours = vnDate.getHours();
  const minutes = vnDate.getMinutes();
  const seconds = vnDate.getSeconds();
  const dayOfWeek = vnDate.getDay();

  const isNight = (hours >= 20 || hours < 5);
  const isSaturday = (dayOfWeek === 6);
  const isBloodMoonTime = isSaturday && (hours >= 20 && hours < 22);
  const isBloodMoon = isBloodMoonTime || GameState.bloodMoonActive;

  let phase = 'morning';
  let phaseNameVi = 'Bình Minh';
  if (hours >= 5 && hours < 11) { phase = 'morning'; phaseNameVi = 'Bình Minh'; }
  else if (hours >= 11 && hours < 14) { phase = 'noon'; phaseNameVi = 'Chính Ngọ'; }
  else if (hours >= 14 && hours < 18) { phase = 'afternoon'; phaseNameVi = 'Hoàng Hôn'; }
  else if (hours >= 18 && hours < 20) { phase = 'evening'; phaseNameVi = 'Chập Tối'; }
  else { phase = 'night'; phaseNameVi = 'Đêm Tối'; }

  const timeStr = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
  const dateStr = vnDate.getFullYear() + '-' + String(vnDate.getMonth() + 1).padStart(2, '0') + '-' + String(vnDate.getDate()).padStart(2, '0');

  GameState.time = {
    hours,
    minutes,
    seconds,
    timeStr,
    dateStr,
    isNight,
    isBloodMoon,
    phase,
    phaseNameVi
  };

  GameState.weather = calculateWeather(21.0285, 105.8542, vnDate);
}
