/**
 * ySortManager.ts
 * Hệ Thống Quản Lý Chiều Sâu & Sắp Xếp Trục Y (2.5D Depth & Y-Sorting Engine)
 *
 * Đảm bảo:
 * 1. Mọi thực thể (Người chơi, Dã thú, Quái vật, Cây cối, Bẫy thú, Vật phẩm rơi)
 *    được neo tại chân (Anchor Point 0.5, 1.0) và sắp xếp theo trục Y.
 * 2. Thực thể ở xa/phía trên (Y nhỏ hơn) được vẽ trước.
 * 3. Thực thể ở gần/phía dưới (Y lớn hơn) được vẽ đè lên trên.
 * 4. Tách tầng bóng đổ (Shadow pass) và thực thể (Entity pass) để không bị đè bóng lên thân.
 */

import { Entity } from '../entities/entity.ts';

export interface RenderableEntityItem {
  entity: Entity;
  screenX: number;
  screenY: number;
  sortY: number;
  customRenderFn?: (ctx: CanvasRenderingContext2D, screenX: number, screenY: number) => void;
  shadowRenderFn?: (ctx: CanvasRenderingContext2D, screenX: number, screenY: number) => void;
  overlayRenderFn?: (ctx: CanvasRenderingContext2D, screenX: number, screenY: number) => void;
}

export class YSortManager {
  private renderQueue: RenderableEntityItem[] = [];

  /**
   * Xóa hàng đợi chuẩn bị cho frame mới
   */
  public clear(): void {
    this.renderQueue.length = 0;
  }

  /**
   * Thêm một thực thể vào hàng đợi sắp xếp Y-Sort
   */
  public addEntity(
    entity: Entity,
    screenX: number,
    screenY: number,
    options?: {
      customRenderFn?: (ctx: CanvasRenderingContext2D, screenX: number, screenY: number) => void;
      shadowRenderFn?: (ctx: CanvasRenderingContext2D, screenX: number, screenY: number) => void;
      overlayRenderFn?: (ctx: CanvasRenderingContext2D, screenX: number, screenY: number) => void;
    },
  ): void {
    if (!entity.visible) return;

    this.renderQueue.push({
      entity,
      screenX,
      screenY,
      sortY: entity.getSortY(),
      customRenderFn: options?.customRenderFn,
      shadowRenderFn: options?.shadowRenderFn,
      overlayRenderFn: options?.overlayRenderFn,
    });
  }

  /**
   * Thêm một đối tượng vẽ tự do có tọa độ Y-Sort
   */
  public addCustomItem(
    sortY: number,
    screenX: number,
    screenY: number,
    renderFn: (ctx: CanvasRenderingContext2D, screenX: number, screenY: number) => void,
    shadowFn?: (ctx: CanvasRenderingContext2D, screenX: number, screenY: number) => void,
    overlayFn?: (ctx: CanvasRenderingContext2D, screenX: number, screenY: number) => void,
  ): void {
    const dummyEntity: any = {
      id: 'custom_' + Math.random(),
      worldX: screenX,
      worldY: sortY,
      getSortY: () => sortY,
      visible: true,
      render: renderFn,
    };

    this.renderQueue.push({
      entity: dummyEntity,
      screenX,
      screenY,
      sortY,
      customRenderFn: renderFn,
      shadowRenderFn: shadowFn,
      overlayRenderFn: overlayFn,
    });
  }

  /**
   * Thực thi quá trình sắp xếp và render toàn bộ thực thể theo thứ tự Y-Sort
   * @param ctx CanvasRenderingContext2D
   * @param pxPerMeter Tỉ lệ pixel trên mét
   * @param dpr Device pixel ratio
   * @param extraOptions Tùy chọn render
   */
  public renderAll(
    ctx: CanvasRenderingContext2D,
    pxPerMeter: number,
    dpr: number,
    extraOptions?: any,
  ): void {
    if (this.renderQueue.length === 0) return;

    // 1. Sắp xếp mảng theo sortY tăng dần (từ trên xuống dưới / từ xa tới gần)
    this.renderQueue.sort((a, b) => a.sortY - b.sortY);

    // 2. PASS 1: VẼ BÓNG ĐỔ MẶT ĐẤT (Ground Contact Shadows)
    for (let i = 0; i < this.renderQueue.length; i++) {
      const item = this.renderQueue[i];
      if (item.shadowRenderFn) {
        item.shadowRenderFn(ctx, item.screenX, item.screenY);
      }
    }

    // 3. PASS 2: VẼ THÂN THỰC THỂ THEO THỨ TỰ CHIỀU SÂU (Entity Body Y-Sorted)
    for (let i = 0; i < this.renderQueue.length; i++) {
      const item = this.renderQueue[i];
      if (item.customRenderFn) {
        item.customRenderFn(ctx, item.screenX, item.screenY);
      } else {
        item.entity.render(ctx, item.screenX, item.screenY, pxPerMeter, dpr, extraOptions);
      }
    }

    // 4. PASS 3: VẼ THANH MÁU & BADGE TRÊN ĐẦU (Overlays / HP Bars / Badges)
    for (let i = 0; i < this.renderQueue.length; i++) {
      const item = this.renderQueue[i];
      if (item.overlayRenderFn) {
        item.overlayRenderFn(ctx, item.screenX, item.screenY);
      }
    }
  }

  /**
   * Lấy danh sách hàng đợi hiện tại (phục vụ kiểm thử)
   */
  public getQueue(): readonly RenderableEntityItem[] {
    return this.renderQueue;
  }
}
