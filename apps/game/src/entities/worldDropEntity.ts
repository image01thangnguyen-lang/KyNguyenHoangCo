/**
 * worldDropEntity.ts
 * Lớp đại diện cho Vật Phẩm & Tài Nguyên Môi Trường (World Drops & Resources)
 * Cành cây, Đá nhọn, Thảo dược, Quả dại, Thịt, Cá có hiệu ứng nổi 3D (nhấp nhô nhẹ theo hàm sin).
 */

import { Entity } from './entity.ts';
import { AssetLoader } from '../assets/assetLoader.ts';

export type DropType =
  | 'stick'
  | 'flint'
  | 'herb'
  | 'berry'
  | 'meat'
  | 'fish'
  | 'fossil'
  | 'megastone';

export class WorldDropEntity extends Entity {
  public dropType: DropType;
  public itemNameVi: string;
  public quantity: number = 1;
  public floatHeight: number = 0;
  private seed: number;
  private tick: number = 0;

  constructor(
    id: string,
    dropType: DropType,
    itemNameVi: string,
    worldX: number,
    worldY: number,
    quantity: number = 1,
  ) {
    super(id, worldX, worldY);
    this.dropType = dropType;
    this.itemNameVi = itemNameVi;
    this.quantity = quantity;
    this.anchorX = 0.5;
    this.anchorY = 1.0;
    this.seed = Math.random() * 100;
  }

  public update(dt: number, tick: number): void {
    this.tick = tick;
    // Hiệu ứng nổi 3D (Bobbing Sin Animation)
    this.floatHeight = Math.sin(this.tick * 0.08 + this.seed) * 3.5;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    pxPerMeter: number,
    dpr: number,
    options?: any,
  ): void {
    const assets = AssetLoader.getInstance();
    const u = dpr * Math.max(0.4, (pxPerMeter / 2.0) * 0.45);
    const spriteKey = `drop_${this.dropType}`;

    ctx.save();

    // 1. BÓNG ĐỔ DƯỚI ĐẤT CO GIÃN THEO ĐỘ CAO NỔI
    const shadowScale = 1.0 - (this.floatHeight / 14);
    ctx.fillStyle = 'rgba(20, 15, 10, 0.4)';
    ctx.beginPath();
    ctx.ellipse(screenX, screenY, 9 * u * shadowScale, 4.5 * u * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. VẬT PHẨM NỔI BỒNG BỀNH 3D
    const drawY = screenY - 6 * u - this.floatHeight * u;

    if (assets.has(spriteKey)) {
      assets.drawSprite(ctx, spriteKey, screenX, drawY, 32 * u, 32 * u, 1.0);
    } else {
      // Fallback
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(screenX, drawY - 6 * u, 6 * u, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. HIỆU ỨNG TIA SÁNG LẤP LÁNH (Sparkle)
    if (this.tick % 40 < 10) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(screenX + 4 * u, drawY - 14 * u, 1.5 * u, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
