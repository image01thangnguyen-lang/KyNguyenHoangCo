/**
 * PhaserBeast.ts
 * Lớp Thực Thể Dã Thú Tiền Sử & Khủng Long AI (Phaser 3 Beast Entity)
 *
 * Chức năng:
 * - Kế thừa Phaser.Physics.Arcade.Sprite.
 * - Neo tại chân: `setOrigin(0.5, 0.9)` đồng bộ Y-Sorting.
 * - Máy trạng thái AI: PATROL (Đi tuần) -> CHASE (Truy đuổi) -> ATTACK (Tấn công) -> DEAD (Gục ngã).
 * - Thanh máu HP đồ họa động (Dynamic HP Bar Graphics) luôn bám trên đầu.
 * - Hoạt ảnh 6 khung hình: idle (0), walk (1..3), attack (4..5), dead (5).
 * - Hiển thị số sát thương nảy (Floating Damage Numbers) khi bị đánh trúng.
 */

import { Phaser, type BeastConfig } from '../phaserTypes.ts';
import { PhaserGameBridge } from '../gameBridge.ts';

export type BeastAIState = 'PATROL' | 'CHASE' | 'ATTACK' | 'DEAD';

export class PhaserBeast extends Phaser.Physics.Arcade.Sprite {
  public beastConfig: BeastConfig;
  public aiState: BeastAIState = 'PATROL';

  // Điểm sinh ra và vùng tuần tra
  public spawnX: number;
  public spawnY: number;
  public roamRadius: number = 160;
  public aggroRadius: number = 220;
  public attackRange: number = 50;

  // Thuộc tính chiến đấu
  public hp: number;
  public maxHp: number;
  public attackPower: number = 12;
  public moveSpeed: number = 110;
  public lastAttackTime: number = 0;
  public attackCooldownMs: number = 1200;

  // Thanh máu đồ họa
  private hpBarGraphics: any;

  // Đếm thời gian đổi hướng đi tuần ngẫu nhiên
  private patrolTimer: number = 0;
  private patrolTargetX: number;
  private patrolTargetY: number;

  constructor(scene: any, config: BeastConfig) {
    const spriteKey = config.spriteKey || config.species || 'trex';
    super(scene, config.x, config.y, `${spriteKey}_idle`);

    this.beastConfig = config;
    this.spawnX = config.x;
    this.spawnY = config.y;
    this.patrolTargetX = config.x;
    this.patrolTargetY = config.y;

    this.hp = config.hp ?? 100;
    this.maxHp = config.maxHp ?? 100;
    this.attackPower = config.attackPower ?? 15;
    this.moveSpeed = config.speed ?? 110;
    if (config.roamRadius) this.roamRadius = config.roamRadius;
    if (config.aggroRadius) this.aggroRadius = config.aggroRadius;

    // Thêm vào Scene và Vật lý Arcade
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Điểm neo Origin ở chân
    this.setOrigin(0.5, 0.9);

    // Hitbox phù hợp kích thước
    if (this.body) {
      const radius = Math.min(this.width, this.height) * 0.35;
      this.body.setCircle(radius, (this.width - radius * 2) / 2, this.height - radius * 2 - 6);
    }

    // Bật tương tác click chuột / tap chạm vào quái
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      // Người chơi click vào dã thú -> Tự động quay mặt và tấn công
      if (this.scene.player) {
        const angle = Phaser.Math.Angle.Between(this.scene.player.x, this.scene.player.y, this.x, this.y);
        this.scene.player.performAttack(false, angle + Math.PI / 2);
      }
    });

    // Tạo thanh máu đồ họa
    this.hpBarGraphics = scene.add.graphics();
    this.hpBarGraphics.setDepth(this.y + 1000);

    // Chạy hoạt ảnh đứng yên ban đầu
    this.playAnimSafe('idle');
  }

  /** Chạy hoạt ảnh an toàn (tránh lỗi nếu thiếu animation key) */
  private playAnimSafe(animName: 'idle' | 'walk' | 'attack' | 'dead'): void {
    const key = `${this.beastConfig.species}_${animName}`;
    if (this.scene.anims.exists(key)) {
      this.play(key, true);
    }
  }

  /** Cập nhật máy trạng thái AI mỗi frame */
  public updateAI(player: any, delta: number): void {
    if (this.aiState === 'DEAD') {
      this.setVelocity(0, 0);
      return;
    }

    // Cập nhật thanh máu theo tọa độ quái vật
    this.drawHpBar();

    if (!player || player.isDead) {
      this.aiState = 'PATROL';
      this.updatePatrol(delta);
      return;
    }

    // Đo khoảng cách đến người chơi
    const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    if (distToPlayer <= this.attackRange) {
      // Đã tiếp cận trong tầm đánh
      this.aiState = 'ATTACK';
      this.updateAttack(player);
    } else if (distToPlayer <= this.aggroRadius) {
      // Phát hiện người chơi trong bán kính cảnh báo -> Truy đuổi (CHASE)
      this.aiState = 'CHASE';
      this.updateChase(player);
    } else {
      // Ngoài tầm cảnh báo -> Đi tuần tra quanh vùng sinh sống (PATROL)
      this.aiState = 'PATROL';
      this.updatePatrol(delta);
    }
  }

  /** Trạng thái AI: Đi tuần tra ngẫu nhiên (Patrol/Roam) */
  private updatePatrol(delta: number): void {
    this.patrolTimer -= delta;

    if (this.patrolTimer <= 0) {
      // Chọn ngẫu nhiên mục tiêu mới trong bán kính roamRadius
      const randAngle = Math.random() * Math.PI * 2;
      const randDist = Math.random() * this.roamRadius;
      this.patrolTargetX = this.spawnX + Math.cos(randAngle) * randDist;
      this.patrolTargetY = this.spawnY + Math.sin(randAngle) * randDist;
      this.patrolTimer = 3000 + Math.random() * 3000; // Đổi mục tiêu mỗi 3-6s
    }

    const distToTarget = Phaser.Math.Distance.Between(this.x, this.y, this.patrolTargetX, this.patrolTargetY);

    if (distToTarget > 12) {
      const speed = this.moveSpeed * 0.55; // Đi dạo với 55% tốc độ
      const angle = Phaser.Math.Angle.Between(this.x, this.y, this.patrolTargetX, this.patrolTargetY);
      
      this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      this.setFlipX(Math.cos(angle) < 0);
      this.playAnimSafe('walk');
    } else {
      this.setVelocity(0, 0);
      this.playAnimSafe('idle');
    }
  }

  /** Trạng thái AI: Truy đuổi người chơi (Chase/Aggro) */
  private updateChase(player: any): void {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    const speed = this.moveSpeed;

    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.setFlipX(Math.cos(angle) < 0);
    this.playAnimSafe('walk');
  }

  /** Trạng thái AI: Tấn công người chơi (Attack) */
  private updateAttack(player: any): void {
    this.setVelocity(0, 0);

    const now = Date.now();
    if (now - this.lastAttackTime >= this.attackCooldownMs) {
      this.lastAttackTime = now;
      this.playAnimSafe('attack');

      // Gây sát thương lên người chơi sau độ trễ vung đòn
      this.scene.time.delayedCall(280, () => {
        if (this.active && this.aiState !== 'DEAD' && player && !player.isDead) {
          const currentDist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
          if (currentDist <= this.attackRange + 20) {
            player.takeDamage(this.attackPower, this.beastConfig.nameVi);
          }
        }
      });
    }
  }

  /** Vẽ thanh máu động trên đầu dã thú */
  private drawHpBar(): void {
    if (!this.hpBarGraphics || !this.active || this.aiState === 'DEAD') return;

    this.hpBarGraphics.clear();

    const barW = Math.max(48, this.width * 0.85);
    const barH = 6;
    const barX = this.x - barW / 2;
    const barY = this.y - this.height + 4;

    this.hpBarGraphics.setDepth(this.y + 10);

    // Nền đen bán trong suốt
    this.hpBarGraphics.fillStyle(0x000000, 0.65);
    this.hpBarGraphics.fillRoundedRect(barX - 1, barY - 1, barW + 2, barH + 2, 3);

    // Thanh máu theo tỉ lệ
    const hpRatio = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    
    // Màu sắc chuyển dần Xanh -> Vàng -> Đỏ
    let barColor = 0x22c55e; // Green
    if (hpRatio < 0.3) {
      barColor = 0xef4444; // Red
    } else if (hpRatio < 0.6) {
      barColor = 0xf59e0b; // Amber
    }

    this.hpBarGraphics.fillStyle(barColor, 1.0);
    this.hpBarGraphics.fillRoundedRect(barX, barY, barW * hpRatio, barH, 2);
  }

  /** Nhận sát thương khi bị người chơi đánh trúng */
  public takeDamage(damage: number, attacker: any): void {
    if (this.aiState === 'DEAD') return;

    this.hp = Math.max(0, this.hp - damage);

    // Hiển thị số sát thương nảy
    this.showDamagePopup(damage);

    // Chớp trắng/đỏ
    this.setTint(0xff6666);
    this.scene.time.delayedCall(120, () => this.clearTint());

    // Báo sự kiện ra HTML Bridge
    PhaserGameBridge.getInstance().emitBeastHit(this.beastConfig.id, damage, this.hp);

    // Nếu đang tuần tra thì lập tức chuyển sang Aggro đuổi theo người đánh
    if (this.aiState === 'PATROL') {
      this.aiState = 'CHASE';
    }

    if (this.hp <= 0) {
      this.die();
    }
  }

  /** Hiển thị text sát thương nảy bay lên (Floating Damage Text) */
  private showDamagePopup(dmg: number): void {
    const text = this.scene.add.text(this.x, this.y - this.height - 10, `-${dmg}`, {
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

  /** Khi hết máu: Chuyển hoạt ảnh DEAD, sinh đồ rơi và biến mất */
  private die(): void {
    this.aiState = 'DEAD';
    this.setVelocity(0, 0);
    this.playAnimSafe('dead');

    if (this.hpBarGraphics) {
      this.hpBarGraphics.clear();
      this.hpBarGraphics.destroy();
    }

    // Báo sự kiện tiêu diệt quái ra Bridge
    PhaserGameBridge.getInstance().emitBeastDefeated(this.beastConfig);

    // Sinh vật phẩm rơi ngẫu nhiên
    if (this.scene.spawnDropFromBeast) {
      this.scene.spawnDropFromBeast(this.x, this.y, this.beastConfig);
    }

    // Sau 1.5 giây thì làm mờ dần và giải phóng tài nguyên
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 1000,
      delay: 500,
      onComplete: () => {
        this.destroy();
      },
    });
  }
}
