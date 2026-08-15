/**
 * Cầu nối giữa lõi game (thuần khiết) và những thứ bẩn của nền tảng: localStorage, GPS, file.
 *
 * Lõi game cố ý không biết gì về những API này. Toàn bộ chỗ "bẩn" gom hết vào file này, nên
 * khi dựng lại client bằng Unity thì chỉ cần viết lại đúng bốn thứ ở đây, không phải mò trong
 * logic game.
 */

import { createSaveFile, loadSave, serializeSave } from '../../../packages/game-core/src/save.js';
import { distanceMeters } from '../../../packages/game-core/src/world.js';
                                                                        
                                                                       

const SAVE_KEY = 'khc.save.v1';

// ---------------------------------------------------------------- lưu trữ

export function readSave(nowMs        )                                         {
  let raw                = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    // Chế độ riêng tư của Safari chặn localStorage. Vẫn cho chơi, chỉ là không lưu được.
    return { save: createSaveFile(nowMs), warningVi: 'Trình duyệt chặn lưu trữ — tiến trình sẽ mất khi đóng tab.' };
  }

  if (!raw) return { save: createSaveFile(nowMs) };

  const loaded = loadSave(raw);
  if (!loaded.ok || !loaded.save) {
    return { save: createSaveFile(nowMs), warningVi: loaded.messageVi ?? 'Save cũ không đọc được, đã tạo save mới.' };
  }

  return { save: loaded.save, warningVi: loaded.checksumMismatch ? loaded.messageVi : undefined };
}

export function writeSave(save          , nowMs        )          {
  try {
    localStorage.setItem(SAVE_KEY, serializeSave(save, nowMs));
    return true;
  } catch {
    return false;
  }
}

export function wipeSave()       {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* không có gì để dọn */
  }
}

// ---------------------------------------------------------------- vị trí

                           
                          
                                
                          
 

/**
 * Chỉ đọc vị trí khi app đang mở (§4.1) — không có GPS chạy nền, không xin quyền vị trí nền.
 * Đây là quyết định kiến trúc quan trọng: pin nền xấp xỉ 0 và qua duyệt cửa hàng dễ hơn hẳn.
 */
                              
                         
                   
 

export class GeoWatcher {
          watchId                = null;
          nativePollTimer                                        = null;
          state           = { position: null, accuracyMeters: null, deniedVi: null };
          lastFixMs = 0;
          lastFixPos                = null;
          started = false;
                   onUpdate                                                   ;

  constructor(onUpdate                                                   ) {
    this.onUpdate = onUpdate;
  }

          handleNewPosition(newPos        , accuracy        , timestampMs        )       {
    let movement                         ;

    if (this.lastFixPos && this.lastFixMs > 0) {
      const elapsedSec = (timestampMs - this.lastFixMs) / 1000;
      if (elapsedSec >= 1.0 && elapsedSec <= 60.0) {
        const dist = distanceMeters(this.lastFixPos, newPos);
        const speedKmh = (dist / elapsedSec) * 3.6;
        movement = { distanceMeters: dist, speedKmh };
      }
    }

    this.lastFixMs = timestampMs;
    this.lastFixPos = newPos;
    this.state = {
      position: newPos,
      accuracyMeters: accuracy,
      deniedVi: null,
    };
    this.onUpdate(this.state, movement);
  }

          pollNativeBridge()          {
    const bridge = (globalThis                                                                              )
      .AndroidBridge;
    if (bridge?.getNativeLocation) {
      try {
        const raw = bridge.getNativeLocation();
        if (raw) {
          const parsed = JSON.parse(raw)                                                                ;
          if (parsed && typeof parsed.lat === 'number' && typeof parsed.lon === 'number') {
            this.handleNewPosition({ lat: parsed.lat, lon: parsed.lon }, parsed.accuracy || 10, parsed.time || Date.now());
            return true;
          }
        }
      } catch {
        /* bỏ qua nếu parse lỗi */
      }
    }
    return false;
  }

  start()       {
    this.started = true;

    // 0. Đăng ký hàm nhận toạ độ push từ Android Native (0ms latency, 0 pin — Android chủ động gọi khi có fix)
    (globalThis                                                                                                                    ).__onNativeLocation = (data) => {
      if (data && typeof data.lat === 'number' && typeof data.lon === 'number') {
        this.handleNewPosition({ lat: data.lat, lon: data.lon }, data.accuracy || 8, data.time || Date.now());
      }
    };

    // 1. Android Native Bridge — poll 15 giây/lần (fallback khi push event không có).
    this.pollNativeBridge();
    if (!this.nativePollTimer) {
      this.nativePollTimer = setInterval(() => this.pollNativeBridge(), 15_000);
    }

    // 2. Web Geolocation — getCurrentPosition mỗi 10-15 giây
    if (!('geolocation' in navigator)) {
      if (!this.state.position) {
        this.state = { ...this.state, deniedVi: 'Thiết bị không hỗ trợ định vị. Game vẫn chơi được ở vùng hoang dã.' };
        this.onUpdate(this.state);
      }
      return;
    }

    const fetchLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.handleNewPosition(
            { lat: pos.coords.latitude, lon: pos.coords.longitude },
            pos.coords.accuracy,
            pos.timestamp || Date.now(),
          );
        },
        (error) => {
          if (!this.state.position) {
            this.state = {
              ...this.state,
              deniedVi:
                error.code === error.PERMISSION_DENIED
                  ? 'Chưa cấp quyền vị trí. Game vẫn chơi được: mọi nơi đều có vùng hoang dã hệ số 1,2×.'
                  : 'Chưa bắt được tín hiệu vệ tinh. Ra chỗ thoáng hoặc bật Định vị (GPS) trong Cài đặt máy.',
            };
            this.onUpdate(this.state);
          }
        },
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 10_000 },
      );
    };

    fetchLocation(); // Fix ngay lập tức lần đầu

    if (!this.watchId) {
      this.watchId = setInterval(fetchLocation, 12_000)                     ;
    }
  }

  /** Tạm dừng cả 2 tầng GPS khi không ở tab bản đồ hoặc màn hình tắt. Toạ độ cache vẫn còn dùng được. */
  pause()       {
    if (this.watchId !== null) {
      clearInterval(this.watchId);
      this.watchId = null;
    }
    if (this.nativePollTimer !== null) {
      clearInterval(this.nativePollTimer);
      this.nativePollTimer = null;
    }
  }

  /** Tiếp tục GPS sau pause() — chỉ khởi động lại nếu đã start() trước đó. */
  resume()       {
    if (this.started) this.start();
  }


  stop()       {
    this.started = false;
    this.pause();
  }


  current()           {
    return this.state;
  }

  /** Bản sửa nhỏ nhưng quan trọng: toạ độ quá cũ thì coi như không có fix. */
  hasFreshFix()          {
    return this.state.position !== null && Date.now() - this.lastFixMs < 120_000;
  }
}

/** Toạ độ giả lập khi đi bộ không có GPS: đi dạo quanh Hồ Gươm theo số bước chân (~2.000 bước/vòng). */
export function simulatedWalk(base        , steps        , radiusMeters = 180)         {
  const angle = ((steps % 2000) / 2000) * (Math.PI * 2);
  return {
    lat: base.lat + (radiusMeters / 111_320) * Math.sin(angle),
    lon: base.lon + (radiusMeters / (111_320 * Math.cos((base.lat * Math.PI) / 180))) * Math.cos(angle),
  };
}

export { distanceMeters };

// ---------------------------------------------------------------- file sao lưu

export function downloadText(fileName        , text        )       {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readTextFile(file      )                  {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Không đọc được file.'));
    reader.readAsText(file);
  });
}

// ---------------------------------------------------------------- rung

export function buzz(pattern                   )       {
  try {
    if (typeof (globalThis       ).AndroidBridge?.vibrate === 'function') {
      const arr = Array.isArray(pattern) ? pattern : [0, pattern];
      (globalThis       ).AndroidBridge.vibrate(JSON.stringify(arr));
    } else {
      navigator.vibrate?.(pattern);
    }
  } catch {
    /* thiết bị không hỗ trợ rung */
  }
}
