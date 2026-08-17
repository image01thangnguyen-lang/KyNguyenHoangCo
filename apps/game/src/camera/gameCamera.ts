/**
 * gameCamera.ts
 * Hệ thống Camera & Tọa độ Thực tế (GPS Mapping)
 * Chuyển đổi giữa Tọa độ GPS (lat, lon) thực tế sang Tọa độ Isometric 2.5D trong game.
 * Sử dụng thuật toán nội suy Lerp để camera bám sát nhân vật chính mượt mà.
 */

export interface LatLon {
  lat: number;
  lon: number;
}

export function metersToLatDegrees(meters: number): number {
  return meters / 111320;
}

export function metersToLonDegrees(meters: number, lat: number): number {
  const rad = (lat * Math.PI) / 180;
  const cos = Math.cos(rad);
  return meters / (111320 * (cos > 0.01 ? cos : 1.0));
}

export class GameCamera {
  public camLat: number = 21.0285;
  public camLon: number = 105.8542;
  public targetLat: number = 21.0285;
  public targetLon: number = 105.8542;
  public panX: number = 0;
  public panY: number = 0;
  public zoomFactor: number = 1.0;
  public TILT_Y: number = 0.72; // Góc nghiêng Isometric 2.5D

  // Tốc độ bám mượt mà (Lerp factor)
  public lerpSpeed: number = 0.12;

  constructor(initialLat: number = 21.0285, initialLon: number = 105.8542) {
    this.camLat = initialLat;
    this.camLon = initialLon;
    this.targetLat = initialLat;
    this.targetLon = initialLon;
  }

  /** Đặt vị trí mục tiêu cho camera bám theo */
  public followTarget(lat: number, lon: number): void {
    this.targetLat = lat;
    this.targetLon = lon;
  }

  /** Dịch chuyển tức thời camera (không qua lerp) */
  public snapToTarget(lat: number, lon: number): void {
    this.camLat = lat;
    this.camLon = lon;
    this.targetLat = lat;
    this.targetLon = lon;
  }

  /** Cập nhật Lerp từng khung hình */
  public update(dt: number): void {
    if (!Number.isFinite(this.targetLat) || !Number.isFinite(this.targetLon)) return;

    // Nội suy mượt mà (Lerp)
    this.camLat += (this.targetLat - this.camLat) * this.lerpSpeed;
    this.camLon += (this.targetLon - this.camLon) * this.lerpSpeed;
  }

  /**
   * Chuyển đổi Tọa độ GPS -> Tọa độ màn hình Canvas (Isometric 2.5D)
   */
  public project(at: LatLon, viewWidth: number, viewHeight: number, spanMeters: number): [number, number] {
    const effectiveSpan = spanMeters / this.zoomFactor;
    const pxPerMeter = Math.min(viewWidth, viewHeight) / effectiveSpan;

    const latDegM = metersToLatDegrees(1) || 1e-5;
    const lonDegM = metersToLonDegrees(1, this.camLat) || 1e-5;

    const dx = (at.lon - this.camLon) / lonDegM;
    const dy = (at.lat - this.camLat) / latDegM;

    const sx = viewWidth / 2 + dx * pxPerMeter + this.panX;
    const sy = viewHeight / 2 - dy * pxPerMeter * this.TILT_Y + this.panY;

    return [sx, sy];
  }

  /**
   * Chuyển đổi Tọa độ màn hình Canvas -> Tọa độ GPS thực tế
   */
  public unproject(screenX: number, screenY: number, viewWidth: number, viewHeight: number, spanMeters: number): LatLon {
    const effectiveSpan = spanMeters / this.zoomFactor;
    const pxPerMeter = Math.min(viewWidth, viewHeight) / effectiveSpan;

    const dx = (screenX - viewWidth / 2 - this.panX) / (pxPerMeter || 1);
    const dy = -(screenY - viewHeight / 2 - this.panY) / ((pxPerMeter * this.TILT_Y) || 1);

    return {
      lat: this.camLat + dy * metersToLatDegrees(1),
      lon: this.camLon + dx * metersToLonDegrees(1, this.camLat),
    };
  }
}
