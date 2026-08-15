/**
 * Cầu nối giữa lõi game (thuần khiết) và những thứ bẩn của nền tảng: localStorage, GPS, file.
 *
 * Lõi game cố ý không biết gì về những API này. Toàn bộ chỗ "bẩn" gom hết vào file này, nên
 * khi dựng lại client bằng Unity thì chỉ cần viết lại đúng bốn thứ ở đây, không phải mò trong
 * logic game.
 */

import { createSaveFile, loadSave, serializeSave } from '../../../packages/game-core/src/save.ts';
import { distanceMeters } from '../../../packages/game-core/src/world.ts';
import type { SaveFile } from '../../../packages/game-core/src/save.ts';
import type { LatLon } from '../../../packages/game-core/src/world.ts';

const SAVE_KEY = 'khc.save.v1';

// ---------------------------------------------------------------- lưu trữ

export function readSave(nowMs: number): { save: SaveFile; warningVi?: string } {
  let raw: string | null = null;
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

export function writeSave(save: SaveFile, nowMs: number): boolean {
  try {
    localStorage.setItem(SAVE_KEY, serializeSave(save, nowMs));
    return true;
  } catch {
    return false;
  }
}

export function wipeSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* không có gì để dọn */
  }
}

// ---------------------------------------------------------------- vị trí

export interface GeoState {
  position: LatLon | null;
  accuracyMeters: number | null;
  deniedVi: string | null;
}

/**
 * Chỉ đọc vị trí khi app đang mở (§4.1) — không có GPS chạy nền, không xin quyền vị trí nền.
 * Đây là quyết định kiến trúc quan trọng: pin nền xấp xỉ 0 và qua duyệt cửa hàng dễ hơn hẳn.
 */
export class GeoWatcher {
  private watchId: number | null = null;
  private nativePollTimer: ReturnType<typeof setInterval> | null = null;
  private state: GeoState = { position: null, accuracyMeters: null, deniedVi: null };
  private lastFixMs = 0;
  private started = false;
  private readonly onUpdate: (state: GeoState) => void;

  // Gán tường minh thay vì dùng parameter property: parameter property là cú pháp TypeScript
  // KHÔNG bóc được bằng type stripping, mà cả dự án chạy .ts trực tiếp không qua bước biên dịch.
  constructor(onUpdate: (state: GeoState) => void) {
    this.onUpdate = onUpdate;
  }

  private pollNativeBridge(): boolean {
    const bridge = (globalThis as unknown as { AndroidBridge?: { getNativeLocation?: () => string | null } })
      .AndroidBridge;
    if (bridge?.getNativeLocation) {
      try {
        const raw = bridge.getNativeLocation();
        if (raw) {
          const parsed = JSON.parse(raw) as { lat: number; lon: number; accuracy: number; time: number };
          if (parsed && typeof parsed.lat === 'number' && typeof parsed.lon === 'number') {
            this.lastFixMs = Date.now();
            this.state = {
              position: { lat: parsed.lat, lon: parsed.lon },
              accuracyMeters: parsed.accuracy || 10,
              deniedVi: null,
            };
            this.onUpdate(this.state);
            return true;
          }
        }
      } catch {
        /* bỏ qua nếu parse lỗi */
      }
    }
    return false;
  }

  start(): void {
    this.started = true;

    // 0. Đăng ký hàm nhận toạ độ push từ Android Native (0ms latency, 0 pin — Android chủ động gọi khi có fix)
    (globalThis as unknown as { __onNativeLocation?: (data: { lat: number; lon: number; accuracy: number; time: number }) => void }).__onNativeLocation = (data) => {
      if (data && typeof data.lat === 'number' && typeof data.lon === 'number') {
        this.lastFixMs = Date.now();
        this.state = {
          position: { lat: data.lat, lon: data.lon },
          accuracyMeters: data.accuracy || 8,
          deniedVi: null,
        };
        this.onUpdate(this.state);
      }
    };

    // 1. Android Native Bridge — poll 15 giây/lần (fallback khi push event không có).
    //    Giảm 30× so với 500ms cũ. Người đi bộ 15s ~ 18m: đủ để xác định POI và spawn drop.
    this.pollNativeBridge();
    if (!this.nativePollTimer) {
      this.nativePollTimer = setInterval(() => this.pollNativeBridge(), 15_000);
    }

    // 2. Web Geolocation — getCurrentPosition mỗi 15 giây
    //    maximumAge: 12000 → OS trả cache GPS cũ ≤12s, chip GPS không cần thức dậy hỏi vệ tinh.
    //    Với người đi bộ 1,2m/s, 12s sai lệch ~14m — chấp nhận được cho game, pin tiết kiệm đáng kể.
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
          this.lastFixMs = Date.now();
          this.state = {
            position: { lat: pos.coords.latitude, lon: pos.coords.longitude },
            accuracyMeters: pos.coords.accuracy,
            deniedVi: null,
          };
          this.onUpdate(this.state);
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
        { enableHighAccuracy: true, maximumAge: 12_000, timeout: 10_000 },
      );
    };

    fetchLocation(); // Fix ngay lập tức lần đầu

    // Chu kỳ 15 giây — khớp với Native Bridge, người đi bộ 15s ~ 18m, đủ xác định POI.
    if (!this.watchId) {
      this.watchId = setInterval(fetchLocation, 15_000) as unknown as number;
    }
  }

  /** Tạm dừng cả 2 tầng GPS khi không ở tab bản đồ hoặc màn hình tắt. Toạ độ cache vẫn còn dùng được. */
  pause(): void {
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
  resume(): void {
    if (this.started) this.start();
  }


  stop(): void {
    this.started = false;
    this.pause();
  }


  current(): GeoState {
    return this.state;
  }

  /** Bản sửa nhỏ nhưng quan trọng: toạ độ quá cũ thì coi như không có fix. */
  hasFreshFix(): boolean {
    return this.state.position !== null && Date.now() - this.lastFixMs < 120_000;
  }
}

/** Toạ độ giả lập khi đi bộ không có GPS: đi dạo quanh Hồ Gươm theo số bước chân (~2.000 bước/vòng). */
export function simulatedWalk(base: LatLon, steps: number, radiusMeters = 180): LatLon {
  const angle = ((steps % 2000) / 2000) * (Math.PI * 2);
  return {
    lat: base.lat + (radiusMeters / 111_320) * Math.sin(angle),
    lon: base.lon + (radiusMeters / (111_320 * Math.cos((base.lat * Math.PI) / 180))) * Math.cos(angle),
  };
}

export { distanceMeters };

// ---------------------------------------------------------------- file sao lưu

export function downloadText(fileName: string, text: string): void {
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

export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Không đọc được file.'));
    reader.readAsText(file);
  });
}

// ---------------------------------------------------------------- rung

export function buzz(pattern: number | number[]): void {
  try {
    if (typeof (globalThis as any).AndroidBridge?.vibrate === 'function') {
      const arr = Array.isArray(pattern) ? pattern : [0, pattern];
      (globalThis as any).AndroidBridge.vibrate(JSON.stringify(arr));
    } else {
      navigator.vibrate?.(pattern);
    }
  } catch {
    /* thiết bị không hỗ trợ rung */
  }
}
