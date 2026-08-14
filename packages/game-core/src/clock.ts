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

import { DEVICE_CHECKS } from './balance.ts';

export interface ClockState {
  /** Mốc epoch lớn nhất từng ghi nhận, tính bằng ms. */
  maxSeenMs: number;
  /** Số lần phát hiện lùi đồng hồ — chỉ để hiển thị, không dùng để phạt. */
  rollbackCount: number;
}

export interface ClockReading {
  /** Thời gian dùng cho mọi tính toán game. Khi bị lùi, đây là `maxSeenMs` (đồng hồ đứng yên). */
  nowMs: number;
  /** Thời gian thô của máy — chỉ dùng để hiển thị đồng hồ trên HUD. */
  deviceMs: number;
  rolledBack: boolean;
  scheduledEventsLocked: boolean;
  survivalFrozen: boolean;
  messageVi?: string;
  state: ClockState;
}

export function createClockState(nowMs: number): ClockState {
  return { maxSeenMs: nowMs, rollbackCount: 0 };
}

export function readClock(state: ClockState, deviceMs: number): ClockReading {
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
export interface GameClock {
  now(): number;
  read(): ClockReading;
  state(): ClockState;
  /** Chỉ dùng trong test và trong chế độ mô phỏng của designer. */
  advance(ms: number): void;
}

export function createGameClock(
  initialState?: ClockState,
  source: () => number = () => Date.now(),
): GameClock {
  let state = initialState ?? createClockState(source());
  let testOffsetMs = 0;

  const read = (): ClockReading => {
    const reading = readClock(state, source() + testOffsetMs);
    state = reading.state;
    return reading;
  };

  return {
    now: () => read().nowMs,
    read,
    state: () => state,
    advance: (ms: number) => {
      testOffsetMs += ms;
    },
  };
}
