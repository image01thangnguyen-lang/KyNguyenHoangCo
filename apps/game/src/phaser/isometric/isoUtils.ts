/**
 * isoUtils.ts
 * Hệ Trục Tọa Độ & Phép Chiếu Isometric 2:1 Chuẩn Classic Diablo II
 *
 * Tỉ lệ Isometric 2:1 tiêu chuẩn:
 * - 1 ô lưới World (Grid) có tỉ lệ chiều ngang : chiều dọc = 2 : 1 (ví dụ 64px x 32px).
 * - Phép chiếu thuận:
 *   screenX = (worldX - worldY) * (tileWidth / 2);
 *   screenY = (worldX + worldY) * (tileHeight / 4);
 * - Phép chiếu nghịch (Từ màn hình về tọa độ thế giới).
 * - Ánh xạ 8 hướng di chuyển Isometric chuẩn (N, NE, E, SE, S, SW, W, NW).
 */

export const ISO_TILE_WIDTH = 64;
export const ISO_TILE_HEIGHT = 32;

export type IsoDirection8 = 'S' | 'SE' | 'E' | 'NE' | 'N' | 'NW' | 'W' | 'SW';

export class IsoUtils {
  /** Chuyển đổi tọa độ Thế Giới (World Grid X, Y) sang Tọa Độ Màn Hình Isometric 2:1 */
  public static worldToIso(worldX: number, worldY: number, tileW = ISO_TILE_WIDTH, tileH = ISO_TILE_HEIGHT): { x: number; y: number } {
    return {
      x: (worldX - worldY) * (tileW / 2),
      y: (worldX + worldY) * (tileH / 4),
    };
  }

  /** Chuyển đổi tọa độ Màn Hình Isometric 2:1 về Tọa Độ Thế Giới */
  public static isoToWorld(screenX: number, screenY: number, tileW = ISO_TILE_WIDTH, tileH = ISO_TILE_HEIGHT): { x: number; y: number } {
    const halfW = tileW / 2;
    const quarterH = tileH / 4;
    return {
      x: (screenX / halfW + screenY / quarterH) / 2,
      y: (screenY / quarterH - screenX / halfW) / 2,
    };
  }

  /**
   * Xác định 1 trong 8 hướng Isometric chuẩn từ vector di chuyển (vx, vy)
   * Góc nhìn Isometric nghiêng:
   * - +X sang phải-dưới (East/South-East)
   * - +Y sang trái-dưới (South/South-West)
   */
  public static get8Direction(vx: number, vy: number): { dir: IsoDirection8; index: number; flipX: boolean } {
    if (Math.hypot(vx, vy) < 0.05) {
      return { dir: 'S', index: 0, flipX: false };
    }

    // Góc radian từ -PI đến +PI (+vx sang phải, +vy xuống dưới)
    let angleDeg = (Math.atan2(vy, vx) * 180) / Math.PI; // -180 .. 180
    if (angleDeg < 0) angleDeg += 360; // 0 .. 360

    // Chia 8 cung, mỗi cung 45 độ
    // 0° (Phải - E), 45° (Đông Nam - SE), 90° (Nam - S), 135° (Tây Nam - SW)
    // 180° (Tây - W), 225° (Tây Bắc - NW), 270° (Bắc - N), 315° (Đông Bắc - NE)
    if (angleDeg >= 337.5 || angleDeg < 22.5) {
      return { dir: 'E', index: 2, flipX: false };
    } else if (angleDeg >= 22.5 && angleDeg < 67.5) {
      return { dir: 'SE', index: 1, flipX: false };
    } else if (angleDeg >= 67.5 && angleDeg < 112.5) {
      return { dir: 'S', index: 0, flipX: false };
    } else if (angleDeg >= 112.5 && angleDeg < 157.5) {
      return { dir: 'SW', index: 7, flipX: true };
    } else if (angleDeg >= 157.5 && angleDeg < 202.5) {
      return { dir: 'W', index: 6, flipX: true };
    } else if (angleDeg >= 202.5 && angleDeg < 247.5) {
      return { dir: 'NW', index: 5, flipX: true };
    } else if (angleDeg >= 247.5 && angleDeg < 292.5) {
      return { dir: 'N', index: 4, flipX: false };
    } else {
      return { dir: 'NE', index: 3, flipX: false };
    }
  }
}
