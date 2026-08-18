/**
 * SkeletalPlayer.ts
 * Lớp Nhân Vật Dũng Sĩ Hoang Cổ Chuẩn Classic Diablo II Isometric RPG
 *
 * Tính năng:
 * - Hệ thống Bóng Đổ Định Hướng Nghiêng (Directional Hard Shadow) ngả về góc trên bên trái (-45°).
 * - Di chuyển & Diễn hoạt 8 Hướng Isometric chuẩn (IsoUtils).
 * - Khớp Xương Phân Lớp: Đùi xoay ±25°, gối gập 15°, thân nhấp nhô, ngực thở 1.5s.
 * - Chiến đấu: Đại giáo đá thạch anh / Thần cung / Kỹ năng.
 */

import { Phaser, type PlayerStats } from '../phaserTypes.ts';
import { PhaserGameBridge } from '../gameBridge.ts';
import { IsoUtils, type IsoDirection8 } from '../isometric/isoUtils.ts';

export class SkeletalPlayer extends Phaser.GameObjects.Container {
  // Thành phần Khớp Xương (Skeletal Parts)
  public shadowSprite!: any;
  public backLegUpper!: any;
  public backLegLower!: any;
  public backArmUpper!: any;
  public backArmLower!: any;
  public torsoSprite!: any;
  public headSprite!: any;
  public frontLegUpper!: any;
  public frontLegLower!: any;
  public frontArmUpper!: any;
  public frontArmLower!: any;
  public weaponSprite!: any;

  // Hướng nhìn Isometric 8 hướng
  public currentDirection: IsoDirection8 = 'S';

  // Thông số di chuyển & tốc độ
  public moveSpeed: number = 220;
  public inputVector: { x: number; y: number } = { x: 0, y: 0 };
  public headingAngle: number = 0;

  // Máy trạng thái diễn hoạt
  public isAttacking: boolean = false;
  public isDead: boolean = false;
  public walkPhase: number = 0;
  public breathPhase: number = 0;
  public equippedWeapon: 'spear' | 'bow' | 'axe' | 'sword' | 'bare_hands' = 'spear';
  public ammoCount: number = 15;
  public lastAttackTime: number = 0;
  public attackCooldownMs: number = 380;

  // Chỉ số sinh tồn
  public hp: number = 100;
  public maxHp: number = 100;
  public satiety: number = 100;
  public hydration: number = 100;
  public strengthLevel: number = 1;

  constructor(scene: any, x: number, y: number) {
    super(scene, x, y);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    if (this.body) {
      const radius = 18;
      this.body.setCircle(radius, -radius, -radius);
      this.body.setCollideWorldBounds(true);
    }

    this.buildSkeletalHierarchy(scene);
    this.setDepth(this.y);
  }

  /** Lắp ráp Khớp Xương với Bóng Đổ Định Hướng Nghiêng (-45°) */
  private buildSkeletalHierarchy(scene: any): void {
    // 1. Bóng Đổ Định Hướng Nghiêng (Directional Hard Shadow ngả về góc trên bên trái)
    const shadowKey = scene.textures.exists('directional_shadow_character')
      ? 'directional_shadow_character'
      : 'soft_shadow_ellipse';

    this.shadowSprite = scene.add.sprite(-10, 6, shadowKey);
    this.shadowSprite.setOrigin(0.5, 1.0);
    this.shadowSprite.setScale(1.0, 0.52);
    this.shadowSprite.setRotation(-0.45); // Nghiêng ngả góc trên bên trái
    this.shadowSprite.setAlpha(0.65);
    this.shadowSprite.setTint(0x000000);
    this.add(this.shadowSprite);

    // 2. Chân Sau
    this.backLegUpper = scene.add.sprite(-6, -34, 'part_hero_leg_upper');
    this.backLegUpper.setOrigin(0.5, 0.15);
    this.backLegLower = scene.add.sprite(0, 24, 'part_hero_leg_lower');
    this.backLegLower.setOrigin(0.5, 0.15);
    this.add(this.backLegUpper);
    this.add(this.backLegLower);

    // 3. Tay Sau
    this.backArmUpper = scene.add.sprite(-14, -54, 'part_hero_arm_upper');
    this.backArmUpper.setOrigin(0.5, 0.2);
    this.backArmLower = scene.add.sprite(0, 18, 'part_hero_arm_lower');
    this.backArmLower.setOrigin(0.5, 0.2);
    this.add(this.backArmUpper);
    this.add(this.backArmLower);

    // 4. Thân Mình
    this.torsoSprite = scene.add.sprite(0, -42, 'part_hero_torso');
    this.torsoSprite.setOrigin(0.5, 0.7);
    this.add(this.torsoSprite);

    // 5. Đầu
    this.headSprite = scene.add.sprite(2, -64, 'part_hero_head');
    this.headSprite.setOrigin(0.5, 0.85);
    this.add(this.headSprite);

    // 6. Chân Trước
    this.frontLegUpper = scene.add.sprite(6, -34, 'part_hero_leg_upper');
    this.frontLegUpper.setOrigin(0.5, 0.15);
    this.frontLegLower = scene.add.sprite(0, 24, 'part_hero_leg_lower');
    this.frontLegLower.setOrigin(0.5, 0.15);
    this.add(this.frontLegUpper);
    this.add(this.frontLegLower);

    // 7. Tay Trước
    this.frontArmUpper = scene.add.sprite(14, -54, 'part_hero_arm_upper');
    this.frontArmUpper.setOrigin(0.5, 0.2);
    this.frontArmLower = scene.add.sprite(0, 18, 'part_hero_arm_lower');
    this.frontArmLower.setOrigin(0.5, 0.2);
    this.add(this.frontArmUpper);
    this.add(this.frontArmLower);

    // 8. Vũ Khí (Đại Giáo Đá Thạch Anh)
    this.weaponSprite = scene.add.sprite(18, -48, 'part_hero_spear');
    this.weaponSprite.setOrigin(0.5, 0.75);
    this.add(this.weaponSprite);
  }

  public setMoveVector(vx: number, vy: number): void {
    this.inputVector.x = vx;
    this.inputVector.y = vy;
  }

  public setWeapon(weapon: 'spear' | 'bow' | 'axe' | 'sword' | 'bare_hands', ammo: number = 0): void {
    this.equippedWeapon = weapon;
    this.ammoCount = ammo;
    if (weapon === 'bow') {
      this.weaponSprite.setTexture('part_hero_bow');
      this.weaponSprite.setOrigin(0.5, 0.5);
    } else {
      this.weaponSprite.setTexture('part_hero_spear');
      this.weaponSprite.setOrigin(0.5, 0.75);
    }
  }

  public updateStats(stats: Partial<PlayerStats>): void {
    if (stats.hp !== undefined) this.hp = stats.hp;
    if (stats.maxHp !== undefined) this.maxHp = stats.maxHp;
    if (stats.satiety !== undefined) this.satiety = stats.satiety;
    if (stats.hydration !== undefined) this.hydration = stats.hydration;
    if (stats.level !== undefined) this.strengthLevel = stats.level;
  }

  /** Vòng lặp cập nhật Diễn Hoạt 8 Hướng Isometric mỗi khung hình */
  public updatePlayer(time: number, delta: number): void {
    if (this.isDead) return;

    this.updateJointPositions();

    const magnitude = Math.hypot(this.inputVector.x, this.inputVector.y);

    if (!this.isAttacking) {
      if (magnitude > 0.08) {
        const normX = this.inputVector.x / magnitude;
        const normY = this.inputVector.y / magnitude;
        const currentSpeed = this.moveSpeed * Math.min(magnitude, 1.0);

        (this.body as any).setVelocity(normX * currentSpeed, normY * currentSpeed);

        this.headingAngle = Math.atan2(normX, normY);

        // Ánh xạ 8 Hướng Isometric chuẩn
        const dir8Info = IsoUtils.get8Direction(normX, normY);
        this.currentDirection = dir8Info.dir;

        // Lật mặt trái/phải theo hướng Isometric
        if (dir8Info.flipX) {
          this.setScale(-1, 1);
        } else {
          this.setScale(1, 1);
        }

        // Bước đi theo hàm Sin
        this.walkPhase += delta * 0.011 * (currentSpeed / 180);

        const legSwing = Math.sin(this.walkPhase) * 25;
        this.frontLegUpper.angle = legSwing;
        this.backLegUpper.angle = -legSwing;

        this.frontLegLower.angle = legSwing < 0 ? Math.abs(legSwing) * 0.85 + 6 : 0;
        this.backLegLower.angle = -legSwing < 0 ? Math.abs(legSwing) * 0.85 + 6 : 0;

        const armSwing = Math.sin(this.walkPhase) * 22;
        this.frontArmUpper.angle = -armSwing;
        this.backArmUpper.angle = armSwing;
        this.frontArmLower.angle = 12;

        const bob = Math.abs(Math.sin(this.walkPhase * 2)) * 3.5;
        this.torsoSprite.y = -42 + bob;
        this.headSprite.y = -64 + bob;

        // Bóng đổ nghiêng dãn nở nhẹ theo nhịp bước
        this.shadowSprite.scaleX = 1.0 + Math.sin(this.walkPhase * 2) * 0.12;
        this.shadowSprite.scaleY = 0.52 - Math.sin(this.walkPhase * 2) * 0.06;

        this.weaponSprite.y = -48 + bob;
        this.weaponSprite.angle = -armSwing * 0.4 + 5;

        PhaserGameBridge.getInstance().emitPlayerMoved(this.x, this.y, this.headingAngle);
      } else {
        // Đứng im thở nhẹ
        (this.body as any).setVelocity(0, 0);

        this.breathPhase += delta * 0.0042;

        const breathScale = Math.sin(this.breathPhase) * 0.03;
        this.torsoSprite.scaleY = 1.0 + breathScale;
        this.torsoSprite.scaleX = 1.0 - breathScale * 0.5;

        this.headSprite.y = -64 + Math.sin(this.breathPhase) * 1.0;
        this.headSprite.angle = Math.sin(this.breathPhase) * 1.5;

        this.frontArmUpper.angle = Math.sin(this.breathPhase) * 3;
        this.backArmUpper.angle = -Math.sin(this.breathPhase) * 3;
        this.frontArmLower.angle = 5;

        this.frontLegUpper.angle = Phaser.Math.Linear(this.frontLegUpper.angle, 0, 0.15);
        this.backLegUpper.angle = Phaser.Math.Linear(this.backLegUpper.angle, 0, 0.15);
        this.frontLegLower.angle = Phaser.Math.Linear(this.frontLegLower.angle, 0, 0.15);
        this.backLegLower.angle = Phaser.Math.Linear(this.backLegLower.angle, 0, 0.15);

        this.torsoSprite.y = -42;
        this.weaponSprite.y = -48;
        this.weaponSprite.angle = 5;
        this.shadowSprite.scaleX = 1.0;
        this.shadowSprite.scaleY = 0.52;
      }
    }
  }

  private updateJointPositions(): void {
    const fAngleRad = Phaser.Math.DegToRad(this.frontLegUpper.angle);
    this.frontLegLower.x = this.frontLegUpper.x + Math.sin(fAngleRad) * 18;
    this.frontLegLower.y = this.frontLegUpper.y + Math.cos(fAngleRad) * 18;

    const bAngleRad = Phaser.Math.DegToRad(this.backLegUpper.angle);
    this.backLegLower.x = this.backLegUpper.x + Math.sin(bAngleRad) * 18;
    this.backLegLower.y = this.backLegUpper.y + Math.cos(bAngleRad) * 18;

    const faAngleRad = Phaser.Math.DegToRad(this.frontArmUpper.angle);
    this.frontArmLower.x = this.frontArmUpper.x + Math.sin(faAngleRad) * 16;
    this.frontArmLower.y = this.frontArmUpper.y + Math.cos(faAngleRad) * 16;

    const baAngleRad = Phaser.Math.DegToRad(this.backArmUpper.angle);
    this.backArmLower.x = this.backArmUpper.x + Math.sin(baAngleRad) * 16;
    this.backArmLower.y = this.backArmUpper.y + Math.cos(baAngleRad) * 16;
  }

  public performAttack(isSkill: boolean = false, targetAngle?: number): void {
    const now = Date.now();
    if (now - this.lastAttackTime < this.attackCooldownMs || this.isDead) return;
    this.lastAttackTime = now;
    this.isAttacking = true;

    const angle = targetAngle !== undefined ? targetAngle : this.headingAngle;
    if (Math.sin(angle) < -0.1) this.setScale(-1, 1);
    else if (Math.sin(angle) > 0.1) this.setScale(1, 1);

    (this.body as any).setVelocity(0, 0);

    this.scene.tweens.add({
      targets: this.frontArmUpper,
      angle: -75,
      duration: 120,
      ease: 'Power2',
      yoyo: true,
      hold: 140,
    });

    this.scene.tweens.add({
      targets: this.weaponSprite,
      angle: 65,
      y: '-=8',
      duration: 120,
      ease: 'Power2',
      yoyo: true,
      hold: 140,
      onComplete: () => {
        this.isAttacking = false;
      },
    });

    if (this.equippedWeapon === 'bow') {
      this.shootArrow(angle, isSkill);
    } else {
      this.executeMeleeSlash(angle, isSkill);
    }
  }

  private executeMeleeSlash(angle: number, isSkill: boolean): void {
    const reach = isSkill ? 80 : 60;
    const baseDamage = isSkill ? 45 : 25;
    const slashX = this.x + Math.sin(angle) * (reach * 0.6);
    const slashY = this.y - 30 - Math.cos(angle) * (reach * 0.6);

    const slashArc = this.scene.add.graphics();
    slashArc.setDepth(this.y + 10);
    slashArc.lineStyle(isSkill ? 6 : 4, isSkill ? 0xf59e0b : 0x38bdf8, 0.95);
    slashArc.beginPath();
    slashArc.arc(slashX, slashY, 34, angle - Math.PI / 3, angle + Math.PI / 3, false);
    slashArc.strokePath();

    this.scene.tweens.add({
      targets: slashArc,
      alpha: 0,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 220,
      ease: 'Power2',
      onComplete: () => slashArc.destroy(),
    });

    const nearbyBeasts = this.scene.getBeastsInRange(this.x, this.y, reach);
    for (const beast of nearbyBeasts) {
      beast.takeDamage(baseDamage, this);
    }
  }

  private shootArrow(angle: number, isSkill: boolean): void {
    const arrowSpeed = 560;
    const arrow = this.scene.physics.add.sprite(this.x, this.y - 32, 'arrow_projectile');
    arrow.setOrigin(0.5, 0.5);
    arrow.setDepth(this.y + 5);
    arrow.setRotation(angle - Math.PI / 2);

    const vx = Math.sin(angle) * arrowSpeed;
    const vy = -Math.cos(angle) * arrowSpeed;
    arrow.setVelocity(vx, vy);

    const damage = isSkill ? 60 : 35;

    this.scene.time.delayedCall(1200, () => {
      if (arrow.active) arrow.destroy();
    });

    this.scene.physics.add.overlap(arrow, this.scene.beastGroup, (_arrowObj: any, beastObj: any) => {
      if (arrow.active && beastObj.active) {
        beastObj.takeDamage(damage, this);
        arrow.destroy();
      }
    });
  }

  public takeDamage(amount: number, attackerName: string = 'Dã thú'): void {
    if (this.isDead) return;
    this.hp = Math.max(0, this.hp - amount);

    this.scene.cameras.main.shake(120, 0.006);

    this.scene.tweens.add({
      targets: [this.torsoSprite, this.headSprite],
      alpha: 0.4,
      duration: 100,
      yoyo: true,
      repeat: 1,
    });

    PhaserGameBridge.getInstance().emitPlayerDamaged(amount, attackerName);

    if (this.hp <= 0) {
      this.die();
    }
  }

  private die(): void {
    this.isDead = true;
    (this.body as any).setVelocity(0, 0);
    this.scene.tweens.add({
      targets: this,
      angle: -90,
      y: '+=20',
      duration: 400,
      ease: 'Power2',
    });
  }
}
