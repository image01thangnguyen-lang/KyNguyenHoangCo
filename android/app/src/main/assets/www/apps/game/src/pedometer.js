/**
 * Đếm bước trên máy.
 *
 * Bản phát hành dùng TYPE_STEP_COUNTER (Android) / CMPedometer (iOS): cảm biến phần cứng
 * đếm nền, gần như không tốn pin, và trả về tổng số bước kể cả khi app đóng (§4.1).
 * Trong prototype web ta không với tới được các API đó, nên có hai nguồn:
 *
 *  1. CẢM BIẾN — dò đỉnh gia tốc từ DeviceMotion. Đủ tốt để cầm điện thoại đi thử ngoài đường,
 *     và quan trọng hơn: nó sinh ra dãy khoảng cách giữa các bước, chính là dữ liệu mà bộ lọc
 *     máy lắc trong game-core cần.
 *  2. MÔ PHỎNG — nút bấm và chế độ tự đi bộ, để test được cả vòng lặp ngay trên máy tính.
 *
 * Cả hai đều chỉ cộng dồn vào một bộ đếm; phần còn lại của game không quan tâm bước đến từ đâu.
 */

                                                         

                                    
                                               
                   
                                                                             
                        
                     
 

const PEAK_THRESHOLD = 11.6; // m/s², đỉnh gia tốc tổng hợp khi bàn chân chạm đất
const VALLEY_THRESHOLD = 9.4;
const MIN_STEP_INTERVAL_MS = 240; // > 250 bước/phút là không còn là đi bộ
const MAX_INTERVAL_SAMPLES = 80;

export class Pedometer {
          pending = 0;
          intervals           = [];
          lastStepMs = 0;
          armed = false;
          source             = 'none';

          autoTimer                                        = null;
          motionHandler                                              = null;

  get currentSource()             {
    return this.source;
  }

  get autoWalking()          {
    return this.autoTimer !== null;
  }

  /** Lấy và xoá số bước đã tích. Gọi mỗi lần đồng bộ với game-core. */
  drain()                    {
    const snapshot                    = {
      newSteps: Math.floor(this.pending),
      intervalsMs: [...this.intervals],
      source: this.source,
    };
    this.pending -= snapshot.newSteps;
    return snapshot;
  }

  peek()         {
    return Math.floor(this.pending);
  }

  // ---------------------------------------------------------------- cảm biến thật

  async startSensor()                                              {
    if (typeof DeviceMotionEvent === 'undefined') {
      return { ok: false, messageVi: 'Thiết bị này không có cảm biến chuyển động. Dùng nút mô phỏng nhé.' };
    }

    // iOS 13+ bắt buộc xin quyền từ một cử chỉ của người dùng.
    const requestPermission = (
      DeviceMotionEvent                                                                     
    ).requestPermission;

    if (typeof requestPermission === 'function') {
      try {
        const state = await requestPermission();
        if (state !== 'granted') {
          return { ok: false, messageVi: 'Bạn đã từ chối quyền cảm biến chuyển động.' };
        }
      } catch {
        return { ok: false, messageVi: 'Không xin được quyền cảm biến. Cần chạy qua HTTPS hoặc localhost.' };
      }
    }

    this.stopAuto();
    this.motionHandler = (event) => this.onMotion(event);
    globalThis.addEventListener('devicemotion', this.motionHandler);
    this.source = 'sensor';

    return { ok: true, messageVi: 'Đang đếm bước bằng cảm biến. Bỏ điện thoại vào túi và đi một vòng.' };
  }

  stopSensor()       {
    if (this.motionHandler) {
      globalThis.removeEventListener('devicemotion', this.motionHandler);
      this.motionHandler = null;
    }
    if (this.source === 'sensor') this.source = 'none';
  }

  /**
   * Dò đỉnh có trễ (hysteresis): chỉ tính một bước khi gia tốc vượt ngưỡng CAO sau khi đã
   * rơi xuống dưới ngưỡng THẤP. Một ngưỡng đơn sẽ đếm thành hàng chục bước mỗi lần rung.
   */
          onMotion(event                   )       {
    const acc = event.accelerationIncludingGravity;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

    const magnitude = Math.hypot(acc.x, acc.y, acc.z);
    const now = performance.now();

    if (!this.armed && magnitude < VALLEY_THRESHOLD) {
      this.armed = true;
      return;
    }

    if (this.armed && magnitude > PEAK_THRESHOLD) {
      this.armed = false;
      if (now - this.lastStepMs < MIN_STEP_INTERVAL_MS) return;

      if (this.lastStepMs > 0) {
        this.intervals.push(now - this.lastStepMs);
        if (this.intervals.length > MAX_INTERVAL_SAMPLES) this.intervals.shift();
      }
      this.lastStepMs = now;
      this.pending++;
    }
  }

  // ---------------------------------------------------------------- mô phỏng

  addSteps(count        )       {
    this.pending += count;
    if (this.source === 'none') this.source = 'simulated';

    // Sinh khoảng cách bước có nhiễu giống dáng đi người, để bộ lọc máy lắc không báo nhầm.
    const now = performance.now();
    for (let i = 0; i < Math.min(count, 40); i++) {
      this.intervals.push(520 + Math.random() * 220);
      if (this.intervals.length > MAX_INTERVAL_SAMPLES) this.intervals.shift();
    }
    this.lastStepMs = now;
  }

  /** Tự đi bộ ~110 bước/phút — nhịp đi bộ bình thường theo §4.3. */
  toggleAuto()          {
    if (this.autoTimer) {
      this.stopAuto();
      return false;
    }

    this.stopSensor();
    this.source = 'simulated';
    this.autoTimer = setInterval(() => this.addSteps(11), 6000);
    return true;
  }

          stopAuto()       {
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
  }

  dispose()       {
    this.stopAuto();
    this.stopSensor();
  }
}

export function describeSource(source            )         {
  switch (source) {
    case 'sensor':
      return 'Nguồn bước: cảm biến thiết bị';
    case 'simulated':
      return 'Nguồn bước: mô phỏng (dev)';
    default:
      return 'Nguồn bước: chưa bật';
  }
}
