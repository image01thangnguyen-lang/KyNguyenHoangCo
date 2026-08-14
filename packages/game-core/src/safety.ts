/**
 * An toàn người chơi (§6.1) — phần KHÔNG THƯƠNG LƯỢNG của thiết kế.
 *
 * Bản offline bỏ được rất nhiều nghĩa vụ pháp lý so với bản online, nhưng không bỏ một dòng
 * nào ở đây. Đây là bài học trực tiếp từ các vụ tai nạn liên quan Pokémon GO: game không bao
 * giờ được thưởng cho hành vi nguy hiểm, và phải chủ động khoá tương tác khi người chơi đang
 * di chuyển nhanh.
 */

import { DEVICE_CHECKS } from './balance.ts';
import { distanceMeters } from './world.ts';
import type { LatLon } from './world.ts';

export interface SpeedSample {
  at: LatLon;
  atMs: number;
}

export interface SpeedState {
  last: SpeedSample | null;
  /** Số lần liên tiếp đo được tốc độ vượt ngưỡng — cần đủ số lần mới khoá, tránh nhiễu GPS. */
  consecutiveFast: number;
  locked: boolean;
}

export function createSpeedState(): SpeedState {
  return { last: null, consecutiveFast: 0, locked: false };
}

export interface SpeedCheck {
  state: SpeedState;
  kmh: number;
  locked: boolean;
  messageVi?: string;
}

/**
 * Khoá mọi tương tác POI khi tốc độ vượt 12 km/h.
 *
 * Cần `sustainedSamplesToLock` mẫu liên tiếp mới khoá, vì một lần nhảy toạ độ do GPS trôi
 * không có nghĩa là người chơi đang ngồi trên xe. Ngược lại, chỉ cần MỘT mẫu chậm là mở khoá
 * ngay — thà mở nhầm sớm còn hơn giữ khoá một người đang đi bộ thật.
 */
export function checkSpeed(state: SpeedState, sample: SpeedSample): SpeedCheck {
  const cfg = DEVICE_CHECKS.safety;

  if (!state.last) {
    return { state: { ...state, last: sample }, kmh: 0, locked: state.locked };
  }

  const seconds = (sample.atMs - state.last.atMs) / 1000;
  if (seconds <= 0.5) {
    return { state, kmh: 0, locked: state.locked };
  }

  const meters = distanceMeters(state.last.at, sample.at);
  const kmh = (meters / seconds) * 3.6;

  if (kmh > cfg.maxKmh) {
    const consecutiveFast = state.consecutiveFast + 1;
    const locked = consecutiveFast >= cfg.sustainedSamplesToLock;
    return {
      state: { last: sample, consecutiveFast, locked },
      kmh,
      locked,
      messageVi: locked ? cfg.messageVi : undefined,
    };
  }

  return {
    state: { last: sample, consecutiveFast: 0, locked: false },
    kmh,
    locked: false,
  };
}

// ------------------------------------------------------------------ nhắc nhở

export interface SessionState {
  sessionStartMs: number;
  minutesToday: number;
  lastBreakReminderMs: number;
  awarenessShownForDay: string | null;
}

export function createSessionState(nowMs: number): SessionState {
  return {
    sessionStartMs: nowMs,
    minutesToday: 0,
    lastBreakReminderMs: nowMs,
    awarenessShownForDay: null,
  };
}

export interface Reminder {
  id: 'awareness' | 'break' | 'wellbeing' | 'night_walk';
  textVi: string;
}

/**
 * Các nhắc nhở cần hiện lúc này.
 *
 * §6.2 bản 2.0: bản offline KHÔNG có nghĩa vụ cưỡng chế giờ chơi (không tài khoản, không
 * server). Ta vẫn nhắc — vừa tử tế, vừa đẹp hình ảnh với phụ huynh — nhưng chỉ nhắc, không
 * chặn. `enforceHardLimit` trong dữ liệu để sẵn là false và code tôn trọng điều đó.
 */
export function dueReminders(
  session: SessionState,
  nowMs: number,
  today: string,
  hour: number,
): { reminders: Reminder[]; session: SessionState } {
  const cfg = DEVICE_CHECKS;
  const reminders: Reminder[] = [];
  let next = { ...session };

  if (session.awarenessShownForDay !== today) {
    reminders.push({ id: 'awareness', textVi: cfg.safety.dailyAwarenessReminderVi });
    next = { ...next, awarenessShownForDay: today };
  }

  const sinceBreakMin = (nowMs - session.lastBreakReminderMs) / 60_000;
  if (sinceBreakMin >= cfg.wellbeing.breakReminderEveryMinutes) {
    reminders.push({
      id: 'break',
      textVi: 'Bạn đã chơi liên tục 30 phút. Ngẩng lên nhìn xa một chút nhé.',
    });
    next = { ...next, lastBreakReminderMs: nowMs };
  }

  const sessionMinutes = (nowMs - session.sessionStartMs) / 60_000;
  if (session.minutesToday + sessionMinutes >= cfg.wellbeing.softDailyMinutes) {
    reminders.push({ id: 'wellbeing', textVi: cfg.wellbeing.healthWarningVi });
  }

  if (hour >= 20 || hour < 5) {
    reminders.push({ id: 'night_walk', textVi: cfg.safety.nightWalkWarningVi });
  }

  return { reminders, session: next };
}

export const AGE_RATING = DEVICE_CHECKS.wellbeing.ageRating;
