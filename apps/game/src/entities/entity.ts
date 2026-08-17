/**
 * entity.ts
 * Lớp cơ sở trừu tượng cho toàn bộ đối tượng (Entities) trong thế giới 2.5D
 */

export abstract class Entity {
  public id: string;
  public worldX: number;
  public worldY: number;
  public anchorX: number = 0.5; // Điểm neo ngang (0.5 = giữa)
  public anchorY: number = 1.0; // Điểm neo dọc (1.0 = chân đối tượng)
  public width: number = 64;
  public height: number = 64;
  public scale: number = 1.0;
  public zIndexOffset: number = 0; // Hiệu chỉnh thứ tự Y-Sort
  public visible: boolean = true;

  constructor(id: string, worldX: number = 0, worldY: number = 0) {
    this.id = id;
    this.worldX = worldX;
    this.worldY = worldY;
  }

  /**
   * Trả về tọa độ Y tại chân đối tượng để phục vụ việc sắp xếp lớp (Depth / Y-Sorting)
   */
  public getSortY(): number {
    return this.worldY + this.zIndexOffset;
  }

  /**
   * Cập nhật trạng thái logic theo thời gian
   */
  public abstract update(dt: number, tick: number): void;

  /**
   * Vẽ đối tượng lên canvas
   */
  public abstract render(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    pxPerMeter: number,
    dpr: number,
    options?: any,
  ): void;
}
