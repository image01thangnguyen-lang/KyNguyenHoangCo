/**
 * Đếm bước chân thông minh & đa nguồn (§4.1 & §4.3).
 *
 * Hỗ trợ 4 nguồn dữ liệu bước chân mượt mà:
 *  1. ANDROID NATIVE — Nhận trực tiếp từ Sensor.TYPE_STEP_DETECTOR / STEP_COUNTER qua AndroidBridge.
 *  2. CẢM BIẾN WEB (DeviceMotion) — Thuật toán dò đỉnh thích ứng động (Dynamic Adaptive Peak Detection)
 *     nhạy bén hơn, bắt chuẩn cả khi đi bộ chậm, bỏ túi quần hoặc cầm tay.
 *  3. GPS DISTANCE FALLBACK — Tự động quy đổi quãng đường di chuyển thực tế (1m ~ 1.35 bước) khi đi bộ ngoài đường.
 *  4. MÔ PHỎNG (Dev/Test) — Hỗ trợ test nhanh trên máy tính.
 */

                                                                            

                                    
                                               
                   
                                                                             
                        
                     
 

const MIN_STEP_INTERVAL_MS = 220; // > 270 bước/phút là nhịp không tưởng cho đi bộ
const MAX_INTERVAL_SAMPLES = 80;

export class Pedometer {
          pending = 0;
          intervals           = [];
          lastStepMs = 0;
          armed = false;
          source             = 'none';

  // Biến phục vụ thuật toán lọc gia tốc động thích ứng
          gravityAvg = 9.8;
          lastMagnitude = 9.8;

  // Tích lũy khoảng cách GPS khi đi bộ
          pendingGpsMeters = 0;

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

  // ---------------------------------------------------------------- NATIVE ANDROID STEP SENSOR

  /** Nhận số bước đếm trực tiếp từ cảm biến phần cứng của Android Native */
  onNativeStep(count = 1)       {
    if (count <= 0) return;
    this.pending += count;
    this.source = 'native';

    const now = performance.now();
    const interval = this.lastStepMs > 0 ? now - this.lastStepMs : 550;
    this.intervals.push(Math.max(250, Math.min(1200, interval)));
    if (this.intervals.length > MAX_INTERVAL_SAMPLES) this.intervals.shift();
    this.lastStepMs = now;
  }

  // ---------------------------------------------------------------- GPS DISTANCE FALLBACK

  /**
   * Tự động bù bước chân từ khoảng cách GPS khi người chơi đi bộ thật ngoài trời (tốc độ 0.5 - 9 km/h).
   * 1 mét ~ 1.35 bước chân tiêu chuẩn (bước sải ~0.74m).
   */
  addGpsDistanceWalked(distanceMeters        )       {
    if (distanceMeters <= 0 || distanceMeters > 300) return; // Bỏ qua nếu đứng im hoặc dịch chuyển bất thường

    this.pendingGpsMeters += distanceMeters;
    // Cứ mỗi 1.5 mét dịch chuyển quy đổi ra 2 bước chân
    const stepsToAdd = Math.floor(this.pendingGpsMeters * 1.35);
    if (stepsToAdd >= 1) {
      const consumedMeters = stepsToAdd / 1.35;
      this.pendingGpsMeters -= consumedMeters;

      this.pending += stepsToAdd;
      if (this.source === 'none' || this.source === 'sensor') {
        this.source = 'gps';
      }

      const now = performance.now();
      for (let i = 0; i < Math.min(stepsToAdd, 20); i++) {
        this.intervals.push(540 + Math.random() * 180);
        if (this.intervals.length > MAX_INTERVAL_SAMPLES) this.intervals.shift();
      }
      this.lastStepMs = now;
    }
  }

  // ---------------------------------------------------------------- CẢM BIẾN WEB (DEVICEMOTION)

  /** Tự động thử bật cảm biến bước chân ngay khi app khởi động hoặc người chơi chạm vào màn hình */
  autoStart()       {
    if (this.source !== 'none') return;

    if (typeof DeviceMotionEvent !== 'undefined') {
      const requestPermission = (
        DeviceMotionEvent                                                                     
      ).requestPermission;

      // Nếu không cần xin quyền chủ động (hầu hết Android & máy bàn), bật luôn
      if (typeof requestPermission !== 'function') {
        this.startSensor().catch(() => {});
      } else {
        // Trên iOS, lắng nghe 1 tương tác chạm đầu tiên của người dùng để xin quyền
        const onFirstInteraction = () => {
          this.startSensor().catch(() => {});
          globalThis.removeEventListener('pointerdown', onFirstInteraction);
          globalThis.removeEventListener('touchstart', onFirstInteraction);
        };
        globalThis.addEventListener('pointerdown', onFirstInteraction, { once: true });
        globalThis.addEventListener('touchstart', onFirstInteraction, { once: true });
      }
    }
  }

  async startSensor()                                              {
    if (typeof DeviceMotionEvent === 'undefined') {
      return { ok: false, messageVi: 'Thiết bị không hỗ trợ DeviceMotion. Sẽ dùng định vị GPS để tính bước.' };
    }

    const requestPermission = (
      DeviceMotionEvent                                                                     
    ).requestPermission;

    if (typeof requestPermission === 'function') {
      try {
        const state = await requestPermission();
        if (state !== 'granted') {
          return { ok: false, messageVi: 'Chưa cấp quyền cảm biến. Game sẽ dùng GPS để nhận diện bước chân.' };
        }
      } catch {
        return { ok: false, messageVi: 'Cần HTTPS hoặc localhost để kích hoạt cảm biến chuyển động.' };
      }
    }

    this.stopAuto();
    if (this.motionHandler) {
      globalThis.removeEventListener('devicemotion', this.motionHandler);
    }
    this.motionHandler = (event) => this.onMotion(event);
    globalThis.addEventListener('devicemotion', this.motionHandler, { passive: true });
    this.source = 'sensor';

    return { ok: true, messageVi: 'Đang đếm bước bằng cảm biến chuyển động. Bỏ điện thoại vào túi và đi một vòng.' };
  }

  stopSensor()       {
    if (this.motionHandler) {
      globalThis.removeEventListener('devicemotion', this.motionHandler);
      this.motionHandler = null;
    }
    if (this.source === 'sensor') this.source = 'none';
  }

  /**
   * Thuật toán lọc dao động gia tốc thích ứng (Adaptive Acceleration Magnitude Peak Detection).
   * Tự động điều chỉnh theo trọng lực và lực quán tính của từng dòng máy, bắt chuẩn từng bước chân.
   */
          onMotion(event                   )       {
    // 1. Thử lấy gia tốc có trọng lực (accelerationIncludingGravity)
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

    const magnitude = Math.hypot(acc.x, acc.y, acc.z);
    if (isNaN(magnitude) || magnitude <= 0.1) return;

    // Cập nhật đường trung bình quán tính (EMA - Exponential Moving Average)
    this.gravityAvg = this.gravityAvg * 0.92 + magnitude * 0.08;

    const now = performance.now();
    const peakDelta = magnitude - this.gravityAvg;

    // Trạng thái chuẩn bị: Gia tốc rơi xuống dưới mức trung bình (chân nhấc lên)
    if (!this.armed && peakDelta < -0.45) {
      this.armed = true;
    }

    // Trạng thái chạm đất: Gia tốc vọt lên trên mức trung bình (bàn chân tiếp đất)
    if (this.armed && peakDelta > 0.75) {
      this.armed = false;
      if (now - this.lastStepMs < MIN_STEP_INTERVAL_MS) return;

      if (this.lastStepMs > 0) {
        const interval = now - this.lastStepMs;
        if (interval < 1500) {
          this.intervals.push(interval);
          if (this.intervals.length > MAX_INTERVAL_SAMPLES) this.intervals.shift();
        }
      }
      this.lastStepMs = now;
      this.pending++;
    }

    this.lastMagnitude = magnitude;
  }

  // ---------------------------------------------------------------- MÔ PHỎNG (DEV/TEST)

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
    case 'native':
      return 'Nguồn bước: Cảm biến phần cứng Android';
    case 'sensor':
      return 'Nguồn bước: Cảm biến chuyển động thiết bị';
    case 'gps':
      return 'Nguồn bước: Tự động tính từ GPS';
    case 'simulated':
      return 'Nguồn bước: Mô phỏng (dev)';
    default:
      return 'Nguồn bước: Đang tự động kết nối...';
  }
}

