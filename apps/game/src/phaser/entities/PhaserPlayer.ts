/**
 * PhaserPlayer.ts
 * Lớp Nhân Vật Chính "Dũng Sĩ Hoang Cổ" (Phaser 3 2.5D Player Entity)
 *
 * Chức năng:
 * - Kế thừa Phaser.Physics.Arcade.Sprite với hệ thống vật lý 2.5D top-down.
 * - Nhận input từ Joystick ảo / Phím WASD / Cảm ứng.
 * - Tự động lật mặt `setFlipX(true/false)` dựa theo vector di chuyển hoặc góc ngắm.
 * - Neo tại chân: `setOrigin(0.5, 0.9)` để tương thích Y-Sorting hoàn hảo.
 * - Quản lý máy trạng thái hoạt ảnh (IDLE, WALK, ATTACK, DEAD).
 * - Xử lý vũ khí: Cận chiến (Đại giáo, Rìu đá) và Tầm xa (Cung tên).
 */

import { Phaser, type PlayerStats } from '../phaserTypes.ts';
import { PhaserGameBridge } from '../gameBridge.ts';

export class PhaserPlayer extends Phaser.Physics.Arcade.Sprite {
  public gender: 'male' | 'female' = 'male';
  public characterKeyPrefix: string = 'hero_male';

  // Thông số di chuyển & tốc độ
  public moveSpeed: number = 220; // pixels per second
  public inputVector: { x: number; y: number } = { x: 0, y: 0 };
  public headingAngle: number = 0; // Hướng nhìn (radians)

  // Trạng thái chiến đấu
  public isAttacking: boolean = false;
  public isDead: boolean = false;
  public equippedWeapon: 'spear' | 'bow' | 'axe' | 'sword' | 'bare_hands' = 'spear';
  public ammoCount: number = 15;
  public attackCooldownMs: number = 400;
  public lastAttackTime: number = 0;

  // Chỉ số sinh tồn
  public hp: number = 100;
  public maxHp: number = 100;
  public satiety: number = 100;
  public hydration: number = 100;
  public strengthLevel: number = 1;

  // Hiệu ứng hào quang sức mạnh quanh chân (Aura Ring)
  private auraRing?: any;

  constructor(scene: any, x: number, y: number, gender: 'male' | 'female' = 'male') {
    const keyPrefix = gender === 'female' ? 'hero_female' : 'hero_male';
    super(scene, x, y, `${keyPrefix}_idle`);

    this.gender = gender;
    this.characterKeyPrefix = keyPrefix;

    // Thêm vào Scene và bật hệ thống Vật lý Arcade
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Thiết lập Điểm Neo (Origin) tại chân: X = giữa (0.5), Y = đáy chân (0.9)
    this.setOrigin(0.5, 0.9);

    // Thiết lập vùng va chạm (Hitbox) hình tròn vừa vặn bàn chân
    if (this.body) {
      const radius = 18;
      this.body.setCircle(radius, (this.width - radius * 2) / 2, this.height - radius * 2 - 8);
      this.body.setCollideWorldBounds(true);
    }

    // Bật hoạt ảnh đứng yên mặc định
    this.play(`${this.characterKeyPrefix}_idle`, true);

    // Tạo bóng đổ 2.5D dưới chân nhân vật
    this.createFootShadow(scene);
  }

  /** Tạo bóng đổ elip mềm mại dưới chân */
  private createFootShadow(scene: any): void {
    const shadow = scene.add.ellipse(0, 0, 36, 16, 0x000000, 0.35);
    shadow.setDepth(this.y - 1);
    this.scene.events.on('update', () => {
      if (this.active) {
        shadow.setPosition(this.x, this.y - 4);
        shadow.setDepth(this.y - 1);
      } else {
        shadow.destroy();
      }
    });
  }

  /** Cập nhật vector di chuyển từ Joystick ảo hoặc WASD */
  public setMoveVector(vx: number, vy: number): void {
    this.inputVector.x = vx;
    this.inputVector.y = vy;
  }

  /** Đổi loại vũ khí trang bị */
  public setWeapon(weapon: 'spear' | 'bow' | 'axe' | 'sword' | 'bare_hands', ammo: number = 0): void {
    this.equippedWeapon = weapon;
    this.ammoCount = ammo;
  }

  /** Cập nhật chỉ số từ hệ sinh thái */
  public updateStats(stats: Partial<PlayerStats>): void {
    if (stats.hp !== undefined) this.hp = stats.hp;
    if (stats.maxHp !== undefined) this.maxHp = stats.maxHp;
    if (stats.satiety !== undefined) this.satiety = stats.satiety;
    if (stats.hydration !== undefined) this.hydration = stats.hydration;
    if (stats.level !== undefined) this.strengthLevel = stats.level;
  }

  /** Vòng lặp cập nhật mỗi khung hình (Update loop) */
  public updatePlayer(time: number, delta: number): void {
    if (this.isDead) return;

    // Tính toán độ lớn vector di chuyển
    const magnitude = Math.hypot(this.inputVector.x, this.inputVector.y);

    if (!this.isAttacking) {
      if (magnitude > 0.08) {
        // Chuẩn hóa và áp dụng vận tốc vào Arcade Body
        const normX = this.inputVector.x / magnitude;
        const normY = this.inputVector.y / magnitude;
        const currentSpeed = this.moveSpeed * Math.min(magnitude, 1.0);

        this.setVelocity(normX * currentSpeed, normY * currentSpeed);

        // Cập nhật hướng góc quay mặt
        this.headingAngle = Math.atan2(normX, normY);

        // Tự động lật mặt trái/phải theo hướng di chuyển
        if (normX < -0.05) {
          this.setFlipX(true);
        } else if (normX > 0.05) {
          this.setFlipX(false);
        }

        // Chạy hoạt ảnh bước đi WALK (Frames 1 -> 3)
        this.play(`${this.characterKeyPrefix}_walk`, true);

        // Phát sự kiện di chuyển ra Bridge để đồng bộ GPS / Footsteps
        PhaserGameBridge.getInstance().emitPlayerMoved(this.x, this.y, this.headingAngle);
      } else {
        // Đứng yên
        this.setVelocity(0, 0);
        this.play(`${this.characterKeyPrefix}_idle`, true);
      }
    }
  }

  /** Thực hiện đòn tấn công (Cận chiến hoặc Bắn cung) */
  public performAttack(isSkill: boolean = false, targetAngle?: number): void {
    const now = Date.now();
    if (now - this.lastAttackTime < this.attackCooldownMs || this.isDead) {
      return;
    }
    this.lastAttackTime = now;
    this.isAttacking = true;

    // Hướng tấn công
    const angle = targetAngle !== undefined ? targetAngle : this.headingAngle;
    if (Math.sin(angle) < -0.1) {
      this.setFlipX(true);
    } else if (Math.sin(angle) > 0.1) {
      this.setFlipX(false);
    }

    // Tạm dừng di chuyển khi vung vũ khí
    this.setVelocity(0, 0);

    // Chạy hoạt ảnh TẤN CÔNG (Frames 4 -> 5)
    this.play(`${this.characterKeyPrefix}_attack`, true);

    // Xử lý cơ chế tấn công dựa theo vũ khí
    if (this.equippedWeapon === 'bow') {
      this.shootArrowProjectile(angle, isSkill);
    } else {
      this.executeMeleeSlash(angle, isSkill);
    }

    // Sau khi diễn hoạt xong thì trở về trạng thái bình thường
    this.scene.time.delayedCall(350, () => {
      this.isAttacking = false;
      this.play(`${this.characterKeyPrefix}_idle`, true);
    });
  }

  /** Tạo nhát chém vòng cung cận chiến (Melee Slash VFX) */
  private executeMeleeSlash(angle: number, isSkill: boolean): void {
    const reach = isSkill ? 75 : 55;
    const baseDamage = isSkill ? 45 : 25;
    const slashX = this.x + Math.sin(angle) * (reach * 0.6);
    const slashY = this.y - 20 - Math.cos(angle) * (reach * 0.6);

    // Tạo hiệu ứng chém hồ quang sáng rực
    const slashArc = this.scene.add.graphics();
    slashArc.setDepth(this.y + 10);
    slashArc.lineStyle(isSkill ? 6 : 4, isSkill ? 0xf59e0b : 0x38bdf8, 0.95);
    
    // Vẽ vệt chém
    slashArc.beginPath();
    slashArc.arc(slashX, slashY, 32, angle - Math.PI / 3, angle + Math.PI / 3, false);
    slashArc.strokePath();

    this.scene.tweens.add({
      targets: slashArc,
      alpha: 0,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 200,
      ease: 'Power2',
      onComplete: () => slashArc.destroy(),
    });

    // Kiểm tra va chạm với toàn bộ Dã thú trong tầm chém
    const nearbyBeasts = this.scene.getBeastsInRange(this.x, this.y, reach);
    for (const beast of nearbyBeasts) {
      beast.takeDamage(baseDamage, this);
      this.createImpactSparks(beast.x, beast.y - 24);
    }
  }

  /** Bắn mũi tên bay tầm xa (Ranged Projectile) */
  private shootArrowProjectile(angle: number, isSkill: boolean): void {
    const arrowSpeed = 550;
    const startX = this.x;
    const startY = this.y - 24;

    // Tạo sprite mũi tên
    const arrow = this.scene.physics.add.sprite(startX, startY, 'arrow_projectile');
    arrow.setOrigin(0.5, 0.5);
    arrow.setDepth(this.y + 5);
    arrow.setRotation(angle - Math.PI / 2);

    const vx = Math.sin(angle) * arrowSpeed;
    const vy = -Math.cos(angle) * arrowSpeed;
    arrow.setVelocity(vx, vy);

    const damage = isSkill ? 60 : 35;

    // Hủy mũi tên sau 1.2s nếu không trúng
    this.scene.time.delayedCall(1200, () => {
      if (arrow.active) arrow.destroy();
    });

    // Bắt va chạm giữa mũi tên và dã thú
    this.scene.physics.add.overlap(arrow, this.scene.beastGroup, (_arrowObj: any, beastObj: any) => {
      if (arrow.active && beastObj.active) {
        beastObj.takeDamage(damage, this);
        this.createImpactSparks(beastObj.x, beastObj.y - 20);
        arrow.destroy();
      }
    });
  }

  /** Hiệu ứng tia lửa tóe ra khi đánh trúng */
  public createImpactSparks(x: number, y: number): void {
    const spark = this.scene.add.star(x, y, 5, 4, 12, 0xffe066);
    spark.setDepth(y + 20);
    this.scene.tweens.add({
      targets: spark,
      scaleX: 2.0,
      scaleY: 2.0,
      alpha: 0,
      angle: 90,
      duration: 250,
      onComplete: () => spark.destroy(),
    });
  }

  /** Nhận sát thương từ dã thú */
  public takeDamage(amount: number, attackerName: string = 'Dã thú'): void {
    if (this.isDead) return;
    this.hp = Math.max(0, this.hp - amount);

    // Chớp đỏ cảnh báo
    this.setTint(0xff4444);
    this.scene.time.delayedCall(150, () => this.clearTint());

    // Rung màn hình nhẹ (Camera Shake)
    this.scene.cameras.main.shake(120, 0.006);

    // Báo ra HTML Bridge
    PhaserGameBridge.getInstance().emitPlayerDamaged(amount, attackerName);

    if (this.hp <= 0) {
      this.die();
    }
  }

  /** Khi hết máu: Chuyển sang khung hình gục ngã DEAD */
  private die(): void {
    this.isDead = true;
    this.setVelocity(0, 0);
    this.play(`${this.characterKeyPrefix}_dead`, true);
  }
}
