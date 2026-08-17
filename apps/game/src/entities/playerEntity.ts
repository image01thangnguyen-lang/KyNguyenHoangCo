/**
 * playerEntity.ts
 * Lớp đại diện cho Nhân Vật Người Chơi (Dũng Sĩ Hoang Cổ)
 *
 * Tích hợp:
 * - Module SpriteSheetAnimator 6 khung hình theo catalog (Nam / Nữ)
 * - Máy trạng thái (State Machine): IDLE, WALK, RUN, ATTACK, DEAD, REST
 * - Lật hướng di chuyển (Direction Flip) theo góc nhìn facingAngle
 * - Hiển thị vũ khí chiến đấu (Giáo, Búa đá, Đuốc ban đêm)
 * - Hiệu ứng Hào quang thể lực (Stamina Aura), Vệt lướt (Dash Trail), Thú cưng đồng hành
 */

import { Entity } from './entity.ts';
import { AssetLoader } from '../assets/assetLoader.ts';
import { SpriteSheetAnimator, type EntityState } from '../animation/spriteSheetAnimator.ts';
import { EntityCatalogId } from '../animation/entityCatalog.ts';

export type PlayerGender = 'male' | 'female';
export type PlayerWeapon = 'spear' | 'hammer' | 'torch' | 'fist';

export interface DashGhost {
  x: number;
  y: number;
  alpha: number;
  facingAngle: number;
  gender: PlayerGender;
}

export class PlayerEntity extends Entity {
  public gender: PlayerGender = 'male';
  public weapon: PlayerWeapon = 'spear';
  public isMoving: boolean = false;
  public isSprinting: boolean = false;
  public isDashing: boolean = false;
  public isAttacking: boolean = false;
  public isDead: boolean = false;
  public isResting: boolean = false;
  public facingAngle: number = 0; // Hướng quay mặt (radian)
  public stamina: number = 100;
  public maxStamina: number = 100;
  public hp: number = 100;
  public maxHp: number = 100;

  // Thú cưng đồng hành
  public hasSaberTiger: boolean = true;
  public hasExpeditionBird: boolean = true;

  // Hoạt họa SpriteSheetAnimator
  public animatorMale: SpriteSheetAnimator;
  public animatorFemale: SpriteSheetAnimator;
  public animatorSabertooth: SpriteSheetAnimator;
  public animatorBird: SpriteSheetAnimator;

  // Vệt lướt (Dash Trail)
  public dashTrails: DashGhost[] = [];
  private tick: number = 0;

  constructor(id: string = 'player', worldX: number = 0, worldY: number = 0) {
    super(id, worldX, worldY);
    this.width = 36;
    this.height = 54;
    this.anchorX = 0.5;
    this.anchorY = 1.0;

    // Khởi tạo các Animator cho Nam, Nữ và Thú cưng từ Catalog
    const assets = AssetLoader.getInstance();
    const catalogImg = assets.getCatalogImage();

    this.animatorMale = SpriteSheetAnimator.fromCatalog(EntityCatalogId.HERO_MALE, catalogImg);
    this.animatorFemale = SpriteSheetAnimator.fromCatalog(EntityCatalogId.HERO_FEMALE, catalogImg);
    this.animatorSabertooth = SpriteSheetAnimator.fromCatalog(EntityCatalogId.SABERTOOTH_PET, catalogImg);
    this.animatorBird = SpriteSheetAnimator.fromCatalog(EntityCatalogId.EXPEDITION_BIRD, catalogImg);
  }

  /** Lấy Animator hiện tại theo giới tính */
  public get currentAnimator(): SpriteSheetAnimator {
    const anim = this.gender === 'female' ? this.animatorFemale : this.animatorMale;
    if (!anim.image) {
      const assets = AssetLoader.getInstance();
      const img = assets.getCatalogImage();
      if (img) anim.image = img;
    }
    return anim;
  }

  /** Kích hoạt hành động tấn công */
  public attack(onComplete?: () => void): void {
    this.isAttacking = true;
    this.currentAnimator.playAttack(() => {
      this.isAttacking = false;
      if (onComplete) onComplete();
    });
  }

  public update(dt: number, tick: number): void {
    this.tick = tick;
    const anim = this.currentAnimator;

    // 1. CẬP NHẬT MÁY TRẠNG THÁI (State Machine)
    let targetState: EntityState = 'IDLE';
    let speedMult = 1.0;

    if (this.hp <= 0 || this.isDead) {
      targetState = 'DEAD';
    } else if (this.isResting) {
      targetState = 'REST';
    } else if (this.isAttacking || anim.state === 'ATTACK') {
      targetState = 'ATTACK';
    } else if (this.isMoving) {
      if (this.isSprinting || this.isDashing) {
        targetState = 'RUN';
        speedMult = 1.5;
      } else {
        targetState = 'WALK';
        speedMult = 1.0;
      }
    } else {
      targetState = 'IDLE';
    }

    if (anim.state !== targetState && anim.state !== 'ATTACK') {
      anim.setState(targetState);
    }

    // 2. HƯỚNG QUAY MẶT (Directional Flip)
    const isFacingLeft = Math.cos(this.facingAngle) < -0.05;
    anim.facingLeft = isFacingLeft;

    // 3. CẬP NHẬT HOẠT HỌA THEO DELTA TIME
    anim.update(dt, speedMult);

    // Cập nhật thú cưng
    if (this.hasSaberTiger) {
      this.animatorSabertooth.setState(this.isMoving ? (this.isSprinting ? 'RUN' : 'WALK') : 'IDLE');
      this.animatorSabertooth.facingLeft = isFacingLeft;
      this.animatorSabertooth.update(dt, speedMult);
    }

    if (this.hasExpeditionBird) {
      this.animatorBird.setState(this.isMoving ? 'RUN' : 'WALK');
      this.animatorBird.facingLeft = isFacingLeft;
      this.animatorBird.update(dt, 1.2);
    }

    // 4. VỆT LƯỚT BÓNG MA (DASH TRAILS)
    if (this.isMoving && (this.isSprinting || this.isDashing)) {
      if (tick % 3 === 0) {
        this.dashTrails.push({
          x: this.worldX,
          y: this.worldY,
          alpha: 0.6,
          facingAngle: this.facingAngle,
          gender: this.gender,
        });
      }
    }

    // Làm mờ dần các vệt lướt
    for (let i = this.dashTrails.length - 1; i >= 0; i--) {
      this.dashTrails[i].alpha -= 0.06;
      if (this.dashTrails[i].alpha <= 0) {
        this.dashTrails.splice(i, 1);
      }
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    pxPerMeter: number,
    dpr: number,
    options?: { isNight?: boolean; weatherRaining?: boolean },
  ): void {
    const assets = AssetLoader.getInstance();
    const isFemale = this.gender === 'female';
    // ĐỒNG BỘ TỈ LỆ THẾ GIỚI THẬT (Unified Physical Meter-to-Pixel Scale)
    const unitMeterPx = Math.max(16 * dpr, pxPerMeter * 2.5);
    const meterH = isFemale ? 1.7 : 1.8;
    const meterW = isFemale ? 1.0 : 1.1;
    const drawW = meterW * unitMeterPx;
    const drawH = meterH * unitMeterPx;
    const anim = this.currentAnimator;

    ctx.save();

    // 1. VỆT LƯỚT BÓNG MA (DASH TRAILS / GHOSTS)
    if (this.dashTrails.length > 0) {
      for (const ghost of this.dashTrails) {
        ctx.save();
        ctx.globalAlpha = ghost.alpha * 0.45;
        ctx.fillStyle = isFemale ? 'rgba(56, 189, 248, 0.6)' : 'rgba(245, 158, 11, 0.6)';
        ctx.beginPath();
        ctx.ellipse(ghost.x, ghost.y - drawH * 0.45, drawW * 0.4, drawH * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 2. BÓNG ĐỔ DƯỚI CHÂN (Ground Contact Shadow)
    ctx.fillStyle = 'rgba(20, 10, 5, 0.48)';
    ctx.beginPath();
    ctx.ellipse(screenX, screenY, drawW * 0.45, drawH * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. HÀO QUANG THỂ LỰC (Stamina Aura)
    if (this.stamina > 30) {
      const auraPulse = Math.sin(this.tick * 0.1) * 0.15 + 0.85;
      const auraGrad = ctx.createRadialGradient(screenX, screenY - drawH * 0.5, 3 * dpr, screenX, screenY - drawH * 0.5, drawH * 0.6 * auraPulse);
      auraGrad.addColorStop(0, isFemale ? 'rgba(56, 189, 248, 0.22)' : 'rgba(245, 158, 11, 0.22)');
      auraGrad.addColorStop(0.6, isFemale ? 'rgba(14, 165, 233, 0.10)' : 'rgba(217, 119, 6, 0.10)');
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(screenX, screenY - drawH * 0.5, drawH * 0.6 * auraPulse, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. DIỄN HOẠT DŨNG SĨ BẰNG SPRITESHEET ANIMATOR (6 Khung Hình Sống Động)
    anim.render(ctx, screenX, screenY, drawW, drawH, {
      idleBreathing: true,
      flipX: anim.facingLeft,
    });

    ctx.restore();

    // 5. THÚ CƯNG ĐỒNG HÀNH (Companions)
    this.renderCompanions(ctx, screenX, screenY, unitMeterPx, dpr);
  }

  /** Vẽ thú cưng đồng hành theo sát dũng sĩ */
  private renderCompanions(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    unitMeterPx: number,
    dpr: number,
  ): void {
    // A. CỌP RĂNG KIẾM ĐỒNG HÀNH (Smilodon: 2.2m x 1.3m)
    if (this.hasSaberTiger) {
      const tigerW = 2.2 * unitMeterPx;
      const tigerH = 1.3 * unitMeterPx;
      const tigerX = px - tigerW * 0.85;
      const tigerY = py + Math.sin(this.tick * 0.1) * 1.5 * dpr;

      // Bóng đổ thú cưng
      ctx.fillStyle = 'rgba(20, 10, 5, 0.4)';
      ctx.beginPath();
      ctx.ellipse(tigerX, tigerY, tigerW * 0.35, tigerH * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();

      // Render qua Animator
      this.animatorSabertooth.render(ctx, tigerX, tigerY, tigerW, tigerH, {
        idleBreathing: true,
        flipX: this.animatorSabertooth.facingLeft,
      });
    }

    // B. LINH ĐIỂU VIỄN CHINH (Expedition Bird: 1.8m x 1.2m)
    if (this.hasExpeditionBird) {
      const birdW = 1.8 * unitMeterPx;
      const birdH = 1.2 * unitMeterPx;
      const birdFlightAngle = this.tick * 0.05;
      const birdRadius = 2.5 * unitMeterPx;
      const birdX = px + Math.cos(birdFlightAngle) * birdRadius;
      const birdY = py - 2.8 * unitMeterPx + Math.sin(birdFlightAngle * 2) * 0.3 * unitMeterPx;

      // Render qua Animator
      this.animatorBird.render(ctx, birdX, birdY, birdW, birdH, {
        flipX: Math.cos(birdFlightAngle) < 0,
      });
    }
  }
}
