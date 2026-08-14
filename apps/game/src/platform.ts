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
  private state: GeoState = { position: null, accuracyMeters: null, deniedVi: null };
  private lastFixMs = 0;
  private readonly onUpdate: (state: GeoState) => void;

  // Gán tường minh thay vì dùng parameter property: parameter property là cú pháp TypeScript
  // KHÔNG bóc được bằng type stripping, mà cả dự án chạy .ts trực tiếp không qua bước biên dịch.
  constructor(onUpdate: (state: GeoState) => void) {
    this.onUpdate = onUpdate;
  }

  start(): void {
    if (!('geolocation' in navigator)) {
      this.state = { ...this.state, deniedVi: 'Thiết bị không hỗ trợ định vị. Game vẫn chơi được ở vùng hoang dã.' };
      this.onUpdate(this.state);
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
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
        this.state = {
          ...this.state,
          deniedVi:
            error.code === error.PERMISSION_DENIED
              ? 'Chưa cấp quyền vị trí. Game vẫn chơi được: mọi nơi đều có vùng hoang dã hệ số 1,2×.'
              : 'Chưa bắt được tín hiệu vệ tinh. Ra chỗ thoáng hoặc cứ chơi tiếp ở vùng hoang dã.',
        };
        this.onUpdate(this.state);
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
  }

  stop(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
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
    navigator.vibrate?.(pattern);
  } catch {
    /* trình duyệt không hỗ trợ rung */
  }
}
