/**
 * structureEntity.ts
 * Lớp đại diện cho Công Trình & Địa Danh (Doanh trại người chơi, Chòi canh, Hàng rào, Nông trại, Bẫy cá)
 * Có thuộc tính Armor (Giáp/Độ bền) và phạm vi bảo vệ (Protection Aura).
 */

import { Entity } from './entity.ts';

export type StructureType =
  | 'campfire'
  | 'thatch_hut'
  | 'longhouse'
  | 'stone_fort'
  | 'fence'
  | 'watchtower'
  | 'farm_plots'
  | 'fish_trap'
  | 'trap';

export class StructureEntity extends Entity {
  public structureType: StructureType;
  public level: number = 1;
  public armor: number = 18;
  public durability: number = 100;
  public maxDurability: number = 100;
  public protectionRadiusMeters: number = 25;
  public isUnderAttack: boolean = false;

  private tick: number = 0;

  constructor(
    id: string,
    structureType: StructureType,
    worldX: number,
    worldY: number,
    level: number = 1,
    armor: number = 18,
    protectionRadiusMeters: number = 25,
  ) {
    super(id, worldX, worldY);
    this.structureType = structureType;
    this.level = level;
    this.armor = armor;
    this.protectionRadiusMeters = protectionRadiusMeters;
    this.anchorX = 0.5;
    this.anchorY = 1.0;
  }

  public update(dt: number, tick: number): void {
    this.tick = tick;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    pxPerMeter: number,
    dpr: number,
    options?: any,
  ): void {
    const u = dpr * Math.max(0.4, (pxPerMeter / 2.0) * 0.5);

    ctx.save();
    ctx.translate(screenX, screenY);

    // 1. PHẠM VI BẢO VỆ (Protection Aura Circle)
    if (this.protectionRadiusMeters > 0) {
      const radiusPx = this.protectionRadiusMeters * pxPerMeter;
      const auraPulse = Math.sin(this.tick * 0.05) * 0.05 + 0.95;

      ctx.save();
      ctx.strokeStyle = 'rgba(234, 88, 12, 0.45)';
      ctx.lineWidth = 1.5 * dpr;
      ctx.setLineDash([6 * dpr, 6 * dpr]);
      ctx.beginPath();
      ctx.ellipse(0, 0, radiusPx * auraPulse, radiusPx * 0.72 * auraPulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 2. BÓNG ĐỔ CÔNG TRÌNH TIẾP XÚC MẶT ĐẤT
    ctx.fillStyle = 'rgba(20, 10, 5, 0.52)';
    ctx.beginPath();
    ctx.ellipse(0, 4 * u, 24 * u, 10 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. VẼ CÔNG TRÌNH THEO LOẠI
    if (this.structureType === 'campfire') {
      this.drawCampfire(ctx, u);
    } else if (this.structureType === 'fence') {
      this.drawFence(ctx, u);
    } else if (this.structureType === 'watchtower') {
      this.drawWatchtower(ctx, u);
    } else if (this.structureType === 'farm_plots') {
      this.drawFarmPlots(ctx, u);
    } else if (this.structureType === 'fish_trap') {
      this.drawFishTrap(ctx, u);
    } else {
      this.drawThatchHut(ctx, u);
    }

    ctx.restore();
  }

  private drawCampfire(ctx: CanvasRenderingContext2D, u: number): void {
    // Vòng đá quây lửa
    ctx.fillStyle = '#475569';
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 8 * u, Math.sin(a) * 5 * u, 2.5 * u, 0, Math.PI * 2);
      ctx.fill();
    }
    // Củi gỗ
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-6 * u, -4 * u, 12 * u, 3 * u);
    // Lửa bốc cao
    const flameGrad = ctx.createRadialGradient(0, -6 * u, 1 * u, 0, -6 * u, 10 * u);
    flameGrad.addColorStop(0, '#ffffff');
    flameGrad.addColorStop(0.3, '#fde047');
    flameGrad.addColorStop(0.7, '#ea580c');
    flameGrad.addColorStop(1, 'rgba(220, 38, 38, 0)');
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.arc(0, -6 * u, 10 * u, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawFence(ctx: CanvasRenderingContext2D, u: number): void {
    // Hàng rào gỗ phòng thủ (Defensive Wooden Fences)
    ctx.fillStyle = '#543015';
    for (let x = -14 * u; x <= 14 * u; x += 7 * u) {
      // Cọc nhọn đứng
      ctx.beginPath();
      ctx.moveTo(x - 2 * u, 0);
      ctx.lineTo(x, -16 * u);
      ctx.lineTo(x + 2 * u, 0);
      ctx.fill();
    }
    // Thanh ngang
    ctx.fillStyle = '#783e1c';
    ctx.fillRect(-16 * u, -10 * u, 32 * u, 2.5 * u);
    ctx.fillRect(-16 * u, -5 * u, 32 * u, 2.5 * u);
  }

  private drawWatchtower(ctx: CanvasRenderingContext2D, u: number): void {
    // Chòi canh (Watchtower)
    ctx.strokeStyle = '#543015';
    ctx.lineWidth = 2.5 * u;
    ctx.beginPath();
    ctx.moveTo(-10 * u, 0); ctx.lineTo(-6 * u, -28 * u);
    ctx.moveTo(10 * u, 0); ctx.lineTo(6 * u, -28 * u);
    ctx.stroke();

    // Sàn chòi canh
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-10 * u, -32 * u, 20 * u, 4 * u);
    // Mái che lá
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.moveTo(-12 * u, -32 * u); ctx.lineTo(0, -42 * u); ctx.lineTo(12 * u, -32 * u);
    ctx.closePath();
    ctx.fill();
  }

  private drawFarmPlots(ctx: CanvasRenderingContext2D, u: number): void {
    // Các luống đất nông trại (Farm Plots)
    ctx.fillStyle = '#3e200c';
    ctx.beginPath();
    ctx.ellipse(0, 0, 18 * u, 10 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    // Mầm cây xanh mướt
    ctx.fillStyle = '#22c55e';
    for (let x = -10 * u; x <= 10 * u; x += 5 * u) {
      ctx.beginPath();
      ctx.arc(x, -2 * u, 1.8 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawFishTrap(ctx: CanvasRenderingContext2D, u: number): void {
    // Bẫy cá sông (River Fish Trap)
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.8 * u;
    ctx.strokeRect(-12 * u, -6 * u, 24 * u, 12 * u);
    // Nan tre đan chéo
    for (let i = -10 * u; i <= 10 * u; i += 4 * u) {
      ctx.beginPath();
      ctx.moveTo(i, -6 * u); ctx.lineTo(i, 6 * u);
      ctx.stroke();
    }
  }

  private drawThatchHut(ctx: CanvasRenderingContext2D, u: number): void {
    // Thân nhà gỗ vách mộc
    const w = 28 * u;
    const h = 14 * u;
    ctx.fillStyle = '#543015';
    ctx.fillRect(-w / 2, -h, w, h);

    // Mái lá xếp tầng 2.5D
    const rGrad = ctx.createLinearGradient(0, -h - 14 * u, 0, -h);
    rGrad.addColorStop(0, '#78350f');
    rGrad.addColorStop(0.5, '#d97706');
    rGrad.addColorStop(1, '#fde047');
    ctx.fillStyle = rGrad;
    ctx.beginPath();
    ctx.moveTo(-w / 2 - 4 * u, -h + 2 * u);
    ctx.lineTo(0, -h - 14 * u);
    ctx.lineTo(w / 2 + 4 * u, -h + 2 * u);
    ctx.closePath();
    ctx.fill();

    // Cửa nhà ánh lửa
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(-4 * u, -8 * u, 8 * u, 8 * u);
  }
}
