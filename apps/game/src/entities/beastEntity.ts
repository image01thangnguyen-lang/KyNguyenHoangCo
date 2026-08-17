/**
 * beastEntity.ts
 * Lớp đại diện cho Dã Thú & Khủng Long Tiền Sử (Dynamic Beast Packs)
 *
 * Tích hợp:
 * - Module SpriteSheetAnimator 6 khung hình theo catalog
 * - Máy trạng thái (State Machine): IDLE (0), WALK/RUN (1..3), ATTACK (4..5), DEAD (5)
 * - Đồng bộ hướng di chuyển (Flip Direction theo velocityX)
 * - Thuộc tính Aggro (Nộ khí), thanh máu HP Bar + Khiên nộ khí nổi trên đầu
 * - Thuật toán di chuyển bầy đàn Flocking dynamics
 */

import { Entity } from './entity.ts';
import { AssetLoader } from '../assets/assetLoader.ts';
import { SpriteSheetAnimator, type EntityState } from '../animation/spriteSheetAnimator.ts';
import { type EntityCatalogId, mapBeastSpeciesToCatalog, getCatalogEntry } from '../animation/entityCatalog.ts';

export type BeastSpecies =
  | 'trex'
  | 'spinosaurus'
  | 'dilophosaurus'
  | 'triceratops'
  | 'ankylosaurus'
  | 'brachiosaurus'
  | 'plesiosaur'
  | 'velociraptor'
  | 'pterosaur'
  | 'titanoboa'
  | 'sarcosuchus'
  | 'cavelion'
  | 'mammoth'
  | 'wolf'
  | 'sabertooth'
  | 'bear'
  | 'boar'
  | 'deer'
  | 'horse';

export class BeastEntity extends Entity {
  public species: BeastSpecies;
  public speciesNameVi: string;
  public hp: number;
  public maxHp: number;
  public isAggro: boolean = false;
  public alertLevel: number = 0; // 0.0 -> 1.0
  public isChasing: boolean = false;
  public isFleeing: boolean = false;
  public packLeaderId?: string;
  public velocityX: number = 0;
  public velocityY: number = 0;
  public speedMps: number = 4.5;
  public isPack: boolean = false;
  public packSize: number = 1;

  // Hoạt họa SpriteSheetAnimator
  public animator: SpriteSheetAnimator;
  public catalogId: EntityCatalogId;

  // Metric size
  public meterWidth: number = 8.0;
  public meterHeight: number = 5.0;

  private tick: number = 0;

  constructor(
    id: string,
    species: BeastSpecies,
    speciesNameVi: string,
    worldX: number,
    worldY: number,
    maxHp: number = 100,
    isPack: boolean = false,
    packSize: number = 1,
  ) {
    super(id, worldX, worldY);
    this.species = species;
    this.speciesNameVi = speciesNameVi;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.isPack = isPack;
    this.packSize = packSize;
    this.anchorX = 0.5;
    this.anchorY = 1.0;

    // Ánh xạ sang Catalog Entry
    this.catalogId = mapBeastSpeciesToCatalog(species);
    const entry = getCatalogEntry(this.catalogId);
    if (entry) {
      this.meterWidth = entry.meterWidth;
      this.meterHeight = entry.meterHeight;
    }

    const assets = AssetLoader.getInstance();
    const catalogImg = assets.getCatalogImage();
    this.animator = SpriteSheetAnimator.fromCatalog(this.catalogId, catalogImg);
  }

  /** Thuật toán bầy đàn Flocking: Tính toán lực phân tách, hướng đi chung và lực tụ đàn */
  public applyFlocking(neighbors: BeastEntity[], separationDist: number = 30): void {
    if (!this.isPack || neighbors.length === 0) return;

    let sepX = 0, sepY = 0, count = 0;
    let avgVx = 0, avgVy = 0;
    let centerPosX = 0, centerPosY = 0;

    for (const other of neighbors) {
      if (other.id === this.id || other.species !== this.species) continue;
      const dx = this.worldX - other.worldX;
      const dy = this.worldY - other.worldY;
      const dist = Math.hypot(dx, dy);

      if (dist > 0 && dist < separationDist) {
        // 1. Separation (Lực tách đàn tránh dẫm lên nhau)
        sepX += (dx / dist) / dist;
        sepY += (dy / dist) / dist;
        // 2. Alignment (Đồng bộ vận tốc theo đàn)
        avgVx += other.velocityX;
        avgVy += other.velocityY;
        // 3. Cohesion (Hướng về tâm đàn)
        centerPosX += other.worldX;
        centerPosY += other.worldY;
        count++;
      }
    }

    if (count > 0) {
      sepX /= count;
      sepY /= count;
      avgVx /= count;
      avgVy /= count;
      centerPosX /= count;
      centerPosY /= count;
      const cohX = (centerPosX - this.worldX) * 0.02;
      const cohY = (centerPosY - this.worldY) * 0.02;

      this.velocityX += sepX * 1.5 + avgVx * 0.1 + cohX;
      this.velocityY += sepY * 1.5 + avgVy * 0.1 + cohY;
    }
  }

  public update(dt: number, tick: number): void {
    this.tick = tick;
    this.worldX += this.velocityX * dt;
    this.worldY += this.velocityY * dt;
    this.velocityX *= 0.92;
    this.velocityY *= 0.92;

    // Đảm bảo có ảnh
    if (!this.animator.image) {
      const assets = AssetLoader.getInstance();
      const img = assets.getCatalogImage();
      if (img) this.animator.image = img;
    }

    // 1. MÁY TRẠNG THÁI (State Machine)
    const isMoving = Math.hypot(this.velocityX, this.velocityY) > 0.08 || this.isChasing || this.isFleeing;
    let targetState: EntityState = 'IDLE';
    let speedMult = 1.0;

    if (this.hp <= 0) {
      targetState = 'DEAD';
    } else if (this.animator.state === 'ATTACK') {
      targetState = 'ATTACK';
    } else if (this.isChasing) {
      targetState = 'RUN';
      speedMult = 1.6;
    } else if (isMoving) {
      targetState = 'WALK';
      speedMult = 1.0;
    } else {
      targetState = 'IDLE';
    }

    if (this.animator.state !== targetState && this.animator.state !== 'ATTACK') {
      this.animator.setState(targetState);
    }

    // 2. ĐỒNG BỘ HƯỚNG DI CHUYỂN (Flip Direction)
    this.animator.setFacingFromVelocity(this.velocityX);

    // 3. CẬP NHẬT HOẠT HỌA THEO DELTA TIME
    this.animator.update(dt, speedMult);
  }

  public render(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    pxPerMeter: number,
    dpr: number,
    options?: any,
  ): void {
    // ĐỒNG BỘ TỈ LỆ THẾ GIỚI THẬT (Unified Physical Meter-to-Pixel Scale)
    const unitMeterPx = Math.max(14 * dpr, pxPerMeter * 2.4);
    const drawW = this.meterWidth * unitMeterPx;
    const drawH = this.meterHeight * unitMeterPx;

    ctx.save();

    // 1. BÓNG ĐỔ DƯỚI CHÂN (Ground Contact Shadow)
    const shadowW = drawW * 0.42;
    const shadowH = drawH * 0.16;
    ctx.fillStyle = 'rgba(20, 10, 5, 0.45)';
    ctx.beginPath();
    ctx.ellipse(screenX, screenY, shadowW, shadowH, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. DIỄN HOẠT DÃ THÚ BẰNG SPRITESHEET ANIMATOR (6 Khung Hình)
    this.animator.render(ctx, screenX, screenY, drawW, drawH, {
      idleBreathing: true,
      flipX: this.animator.facingLeft,
    });

    // 3. VẼ THANH MÁU HP BAR & KHIÊN NỘ KHÍ TRÊN ĐẦU
    this.renderHeadHPBar(ctx, screenX, screenY - drawH * 0.95, dpr);

    ctx.restore();
  }

  /** Vẽ thanh HP Bar và Khiên Nộ Khí trên đầu */
  public renderHeadHPBar(ctx: CanvasRenderingContext2D, headX: number, headY: number, dpr: number): void {
    const barW = 44 * dpr;
    const barH = 5.5 * dpr;
    const hpRatio = Math.max(0, Math.min(1, this.hp / this.maxHp));

    // Nền thanh HP
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(headX - barW / 2, headY, barW, barH, 2 * dpr);
    ctx.fill();

    // Ruột thanh HP (Đỏ cam nộ khí hoặc Xanh vàng)
    const hpGrad = ctx.createLinearGradient(headX - barW / 2, 0, headX + barW / 2, 0);
    if (this.isAggro) {
      hpGrad.addColorStop(0, '#dc2626');
      hpGrad.addColorStop(1, '#ea580c');
    } else {
      hpGrad.addColorStop(0, '#16a34a');
      hpGrad.addColorStop(1, '#eab308');
    }
    ctx.fillStyle = hpGrad;
    ctx.beginPath();
    ctx.roundRect(headX - barW / 2 + 0.8 * dpr, headY + 0.8 * dpr, (barW - 1.6 * dpr) * hpRatio, barH - 1.6 * dpr, 1.5 * dpr);
    ctx.fill();

    // VIỀN & KHIÊN NỘ KHÍ (Aggro Shield Badge)
    if (this.isAggro) {
      const shieldX = headX + barW / 2 + 4 * dpr;
      const shieldY = headY + barH / 2;

      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(shieldX, shieldY - 5 * dpr);
      ctx.lineTo(shieldX + 4.5 * dpr, shieldY - 2.5 * dpr);
      ctx.lineTo(shieldX + 3.5 * dpr, shieldY + 4 * dpr);
      ctx.lineTo(shieldX, shieldY + 6.5 * dpr);
      ctx.lineTo(shieldX - 3.5 * dpr, shieldY + 4 * dpr);
      ctx.lineTo(shieldX - 4.5 * dpr, shieldY - 2.5 * dpr);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.0 * dpr;
      ctx.stroke();

      // Dấu chấm than cảnh báo
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(shieldX - 0.6 * dpr, shieldY - 3 * dpr, 1.2 * dpr, 3.5 * dpr);
      ctx.fillRect(shieldX - 0.6 * dpr, shieldY + 1.8 * dpr, 1.2 * dpr, 1.2 * dpr);
    }
  }
}
