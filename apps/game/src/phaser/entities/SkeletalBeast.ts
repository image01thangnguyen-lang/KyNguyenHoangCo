/**
 * SkeletalBeast.ts
 * Lớp Dã Thú Tiền Sử & Khủng Long Chuẩn Classic Diablo II Isometric RPG
 *
 * Tính năng:
 * - Hệ thống Bóng Đổ Định Hướng Nghiêng (Directional Hard Shadow) ngả về góc trên bên trái (-45°).
 * - Di chuyển 8 hướng Isometric & 4 chân so le tự nhiên (Trotting gait).
 * - Đuôi uốn lượn theo sóng Sin trễ pha, răng kiếm trắng ngà & mắt phát sáng.
 */

import { Phaser, type BeastConfig } from '../phaserTypes.ts';
import { PhaserGameBridge } from '../gameBridge.ts';

export class SkeletalBeast extends Phaser.GameObjects.Container {
  public beastConfig: BeastConfig;
  public aiState: 'PATROL' | 'CHASE' | 'ATTACK' | 'DEAD' = 'PATROL';

  // Khớp Xương
  public shadowSprite!: any;
  public backLegRearUpper!: any;
  public backLegRearLower!: any;
  public frontLegRearUpper!: any;
  public frontLegRearLower!: any;
  public tailSprite!: any;
  public bodySprite!: any;
  public headSprite!: any;
  public backLegFrontUpper!: any;
  public backLegFrontLower!: any;
  public frontLegFrontUpper!: any;
  public frontLegFrontLower!: any;
  public hpBarGraphics!: any;

  public spawnX: number;
  public spawnY: number;
  public roamRadius: number = 160;
  public aggroRadius: number = 220;
  public attackRange: number = 55;

  public hp: number;
  public maxHp: number;
  public attackPower: number = 15;
  public moveSpeed: number = 115;
  public lastAttackTime: number = 0;
  public attackCooldownMs: number = 1200;

  public walkPhase: number = 0;
  public breathPhase: number = 0;
  private patrolTimer: number = 0;
  private patrolTargetX: number;
  private patrolTargetY: number;

  constructor(scene: any, config: BeastConfig) {
    super(scene, config.x, config.y);
    this.beastConfig = config;
    this.spawnX = config.x;
    this.spawnY = config.y;
    this.patrolTargetX = config.x;
    this.patrolTargetY = config.y;

    this.hp = config.hp ?? 100;
    this.maxHp = config.maxHp ?? 100;
    this.attackPower = config.attackPower ?? 15;
    this.moveSpeed = config.speed ?? 115;
    if (config.roamRadius) this.roamRadius = config.roamRadius;
    if (config.aggroRadius) this.aggroRadius = config.aggroRadius;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    if (this.body) {
      const radius = 24;
      this.body.setCircle(radius, -radius, -radius);
    }

    this.buildSkeletalHierarchy(scene);

    this.setSize(80, 60);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      if (this.scene.player) {
        const angle = Phaser.Math.Angle.Between(this.scene.player.x, this.scene.player.y, this.x, this.y);
        this.scene.player.performAttack(false, angle + Math.PI / 2);
      }
    });

    this.setDepth(this.y);
  }

  private buildSkeletalHierarchy(scene: any): void {
    const isTrex = this.beastConfig.species === 'trex';
    const prefix = isTrex ? 'part_trex' : 'part_tiger';

    // 1. Bóng Đổ Định Hướng Nghiêng (Directional Hard Shadow ngả về góc trên bên trái -45°)
    const shadowKey = scene.textures.exists('directional_shadow_beast')
      ? 'directional_shadow_beast'
      : 'soft_shadow_ellipse';

    this.shadowSprite = scene.add.sprite(-14, 6, shadowKey);
    this.shadowSprite.setOrigin(0.5, 1.0);
    this.shadowSprite.setScale(1.1, 0.52);
    this.shadowSprite.setRotation(-0.45);
    this.shadowSprite.setAlpha(0.65);
    this.shadowSprite.setTint(0x000000);
    this.add(this.shadowSprite);

    // 2. Chân Sau - Bên Xa
    this.backLegRearUpper = scene.add.sprite(-24, -28, `${prefix}_leg_upper`);
    this.backLegRearUpper.setOrigin(0.5, 0.2);
    this.backLegRearUpper.setTint(0x9ca3af);
    this.backLegRearLower = scene.add.sprite(0, 22, `${prefix}_leg_lower`);
    this.backLegRearLower.setOrigin(0.5, 0.2);
    this.backLegRearLower.setTint(0x9ca3af);
    this.add(this.backLegRearUpper);
    this.add(this.backLegRearLower);

    // 3. Chân Trước - Bên Xa
    this.frontLegRearUpper = scene.add.sprite(22, -26, `${prefix}_leg_upper`);
    this.frontLegRearUpper.setOrigin(0.5, 0.2);
    this.frontLegRearUpper.setTint(0x9ca3af);
    this.frontLegRearLower = scene.add.sprite(0, 22, `${prefix}_leg_lower`);
    this.frontLegRearLower.setOrigin(0.5, 0.2);
    this.frontLegRearLower.setTint(0x9ca3af);
    this.add(this.frontLegRearUpper);
    this.add(this.frontLegRearLower);

    // 4. Đuôi uốn lượn
    this.tailSprite = scene.add.sprite(-38, -26, `${prefix}_tail`);
    this.tailSprite.setOrigin(0.1, 0.8);
    this.add(this.tailSprite);

    // 5. Thân mình cơ bắp Bézier
    this.bodySprite = scene.add.sprite(0, -28, `${prefix}_body`);
    this.bodySprite.setOrigin(0.5, 0.6);
    this.add(this.bodySprite);

    // 6. Đầu dã thú
    this.headSprite = scene.add.sprite(34, -36, `${prefix}_head`);
    this.headSprite.setOrigin(0.3, 0.7);
    this.add(this.headSprite);

    // 7. Chân Sau - Bên Gần
    this.backLegFrontUpper = scene.add.sprite(-18, -26, `${prefix}_leg_upper`);
    this.backLegFrontUpper.setOrigin(0.5, 0.2);
    this.backLegFrontLower = scene.add.sprite(0, 22, `${prefix}_leg_lower`);
    this.backLegFrontLower.setOrigin(0.5, 0.2);
    this.add(this.backLegFrontUpper);
    this.add(this.backLegFrontLower);

    // 8. Chân Trước - Bên Gần
    this.frontLegFrontUpper = scene.add.sprite(28, -24, `${prefix}_leg_upper`);
    this.frontLegFrontUpper.setOrigin(0.5, 0.2);
    this.frontLegFrontLower = scene.add.sprite(0, 22, `${prefix}_leg_lower`);
    this.frontLegFrontLower.setOrigin(0.5, 0.2);
    this.add(this.frontLegFrontUpper);
    this.add(this.frontLegFrontLower);

    // 9. Thanh Máu
    this.hpBarGraphics = scene.add.graphics();
    this.hpBarGraphics.setDepth(this.y + 1000);
  }

  public updateAI(player: any, delta: number): void {
    if (this.aiState === 'DEAD') {
      (this.body as any).setVelocity(0, 0);
      return;
    }

    this.drawHpBar();
    this.updateJointPositions();

    if (!player || player.isDead) {
      this.aiState = 'PATROL';
      this.updatePatrol(delta);
      return;
    }

    const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    if (distToPlayer <= this.attackRange) {
      this.aiState = 'ATTACK';
      this.updateAttack(player);
    } else if (distToPlayer <= this.aggroRadius) {
      this.aiState = 'CHASE';
      this.updateChase(player, delta);
    } else {
      this.aiState = 'PATROL';
      this.updatePatrol(delta);
    }
  }

  private updateJointPositions(): void {
    const brRad = Phaser.Math.DegToRad(this.backLegRearUpper.angle);
    this.backLegRearLower.x = this.backLegRearUpper.x + Math.sin(brRad) * 16;
    this.backLegRearLower.y = this.backLegRearUpper.y + Math.cos(brRad) * 16;

    const frRad = Phaser.Math.DegToRad(this.frontLegRearUpper.angle);
    this.frontLegRearLower.x = this.frontLegRearUpper.x + Math.sin(frRad) * 16;
    this.frontLegRearLower.y = this.frontLegRearUpper.y + Math.cos(frRad) * 16;

    const bfRad = Phaser.Math.DegToRad(this.backLegFrontUpper.angle);
    this.backLegFrontLower.x = this.backLegFrontUpper.x + Math.sin(bfRad) * 16;
    this.backLegFrontLower.y = this.backLegFrontUpper.y + Math.cos(bfRad) * 16;

    const ffRad = Phaser.Math.DegToRad(this.frontLegFrontUpper.angle);
    this.frontLegFrontLower.x = this.frontLegFrontUpper.x + Math.sin(ffRad) * 16;
    this.frontLegFrontLower.y = this.frontLegFrontUpper.y + Math.cos(ffRad) * 16;
  }

  private updatePatrol(delta: number): void {
    this.patrolTimer -= delta;
    if (this.patrolTimer <= 0) {
      const randAngle = Math.random() * Math.PI * 2;
      const randDist = Math.random() * this.roamRadius;
      this.patrolTargetX = this.spawnX + Math.cos(randAngle) * randDist;
      this.patrolTargetY = this.spawnY + Math.sin(randAngle) * randDist;
      this.patrolTimer = 3500 + Math.random() * 3000;
    }

    const distToTarget = Phaser.Math.Distance.Between(this.x, this.y, this.patrolTargetX, this.patrolTargetY);

    if (distToTarget > 14) {
      const speed = this.moveSpeed * 0.55;
      const angle = Phaser.Math.Angle.Between(this.x, this.y, this.patrolTargetX, this.patrolTargetY);

      (this.body as any).setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

      if (Math.cos(angle) < 0) this.setScale(-1, 1);
      else if (Math.cos(angle) > 0) this.setScale(1, 1);

      this.animateQuadrupedWalk(delta, speed);
    } else {
      (this.body as any).setVelocity(0, 0);
      this.animateQuadrupedIdle(delta);
    }
  }

  private updateChase(player: any, delta: number): void {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    const speed = this.moveSpeed;

    (this.body as any).setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

    if (Math.cos(angle) < 0) this.setScale(-1, 1);
    else if (Math.cos(angle) > 0) this.setScale(1, 1);

    this.animateQuadrupedWalk(delta, speed);
  }

  private animateQuadrupedWalk(delta: number, speed: number): void {
    this.walkPhase += delta * 0.011 * (speed / 100);

    const swingA = Math.sin(this.walkPhase) * 24;
    const swingB = -Math.sin(this.walkPhase) * 24;

    this.frontLegFrontUpper.angle = swingA;
    this.backLegRearUpper.angle = swingA;

    this.frontLegRearUpper.angle = swingB;
    this.backLegFrontUpper.angle = swingB;

    this.frontLegFrontLower.angle = swingA < 0 ? Math.abs(swingA) * 0.7 : 0;
    this.backLegRearLower.angle = swingA < 0 ? Math.abs(swingA) * 0.7 : 0;
    this.frontLegRearLower.angle = swingB < 0 ? Math.abs(swingB) * 0.7 : 0;
    this.backLegFrontLower.angle = swingB < 0 ? Math.abs(swingB) * 0.7 : 0;

    this.tailSprite.angle = Math.sin(this.walkPhase - 0.6) * 18;
    this.headSprite.y = -36 + Math.sin(this.walkPhase * 2) * 2.5;

    // Bóng đổ nghiêng dãn nở
    this.shadowSprite.scaleX = 1.1 + Math.sin(this.walkPhase * 2) * 0.12;
  }

  private animateQuadrupedIdle(delta: number): void {
    this.breathPhase += delta * 0.0035;

    const breath = Math.sin(this.breathPhase) * 0.025;
    this.bodySprite.scaleY = 1.0 + breath;
    this.bodySprite.scaleX = 1.0 - breath * 0.4;

    this.headSprite.y = -36 + Math.sin(this.breathPhase) * 0.8;
    this.headSprite.angle = Math.sin(this.breathPhase) * 1.5;

    this.tailSprite.angle = Math.sin(this.breathPhase) * 5;

    this.frontLegFrontUpper.angle = Phaser.Math.Linear(this.frontLegFrontUpper.angle, 0, 0.1);
    this.backLegFrontUpper.angle = Phaser.Math.Linear(this.backLegFrontUpper.angle, 0, 0.1);
    this.frontLegRearUpper.angle = Phaser.Math.Linear(this.frontLegRearUpper.angle, 0, 0.1);
    this.backLegRearUpper.angle = Phaser.Math.Linear(this.backLegRearUpper.angle, 0, 0.1);
  }

  private updateAttack(player: any): void {
    (this.body as any).setVelocity(0, 0);

    const now = Date.now();
    if (now - this.lastAttackTime >= this.attackCooldownMs) {
      this.lastAttackTime = now;

      this.scene.tweens.add({
        targets: this.headSprite,
        x: '+=14',
        angle: 15,
        duration: 140,
        yoyo: true,
      });

      this.scene.time.delayedCall(260, () => {
        if (this.active && this.aiState !== 'DEAD' && player && !player.isDead) {
          const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
          if (dist <= this.attackRange + 25) {
            player.takeDamage(this.attackPower, this.beastConfig.nameVi);
          }
        }
      });
    }
  }

  private drawHpBar(): void {
    if (!this.hpBarGraphics || !this.active || this.aiState === 'DEAD') return;

    this.hpBarGraphics.clear();

    const barW = 54;
    const barH = 6;
    const barX = this.x - barW / 2;
    const barY = this.y - 70;

    this.hpBarGraphics.setDepth(this.y + 10);

    this.hpBarGraphics.fillStyle(0x000000, 0.7);
    this.hpBarGraphics.fillRoundedRect(barX - 1, barY - 1, barW + 2, barH + 2, 3);

    const hpRatio = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    let barColor = 0x22c55e;
    if (hpRatio < 0.3) barColor = 0xef4444;
    else if (hpRatio < 0.6) barColor = 0xf59e0b;

    this.hpBarGraphics.fillStyle(barColor, 1.0);
    this.hpBarGraphics.fillRoundedRect(barX, barY, barW * hpRatio, barH, 2);
  }

  public takeDamage(damage: number, attacker: any): void {
    if (this.aiState === 'DEAD') return;
    this.hp = Math.max(0, this.hp - damage);

    this.showDamagePopup(damage);

    this.scene.tweens.add({
      targets: [this.bodySprite, this.headSprite],
      alpha: 0.35,
      duration: 80,
      yoyo: true,
      repeat: 1,
    });

    PhaserGameBridge.getInstance().emitBeastHit(this.beastConfig.id, damage, this.hp);

    if (this.aiState === 'PATROL') this.aiState = 'CHASE';

    if (this.hp <= 0) this.die();
  }

  private showDamagePopup(dmg: number): void {
    const text = this.scene.add.text(this.x, this.y - 75, `-${dmg}`, {
      fontFamily: 'Be Vietnam Pro, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#facc15',
      stroke: '#000000',
      strokeThickness: 3,
    });
    text.setOrigin(0.5, 0.5);
    text.setDepth(this.y + 50);

    this.scene.tweens.add({
      targets: text,
      y: text.y - 35,
      alpha: 0,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 650,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }

  private die(): void {
    this.aiState = 'DEAD';
    (this.body as any).setVelocity(0, 0);

    if (this.hpBarGraphics) {
      this.hpBarGraphics.clear();
      this.hpBarGraphics.destroy();
    }

    PhaserGameBridge.getInstance().emitBeastDefeated(this.beastConfig);

    if (this.scene.spawnDropFromBeast) {
      this.scene.spawnDropFromBeast(this.x, this.y, this.beastConfig);
    }

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      angle: -45,
      y: '+=15',
      duration: 800,
      delay: 400,
      onComplete: () => this.destroy(),
    });
  }
}
