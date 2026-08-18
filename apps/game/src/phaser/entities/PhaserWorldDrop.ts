/**
 * PhaserWorldDrop.ts
 * Lớp Vật Phẩm Rơi Trên Thế Giới (Phaser 3 World Drop Entity)
 *
 * Chức năng:
 * - Hiển thị viên ngọc / vật phẩm 3D lơ lửng trên mặt đất.
 * - Hiệu ứng Tween nhấp nhô bồng bềnh mượt mà (`y: '-=6'`, yoyo: true, repeat: -1).
 * - Nhãn tên vật phẩm và số lượng rõ ràng.
 * - Cho phép chạm / click để nhặt ngay vào túi đồ với hiệu ứng pháo hoa tia sáng lấp lánh.
 */

import { Phaser, type WorldDropConfig } from '../phaserTypes.ts';
import { PhaserGameBridge } from '../gameBridge.ts';

export class PhaserWorldDrop extends Phaser.GameObjects.Container {
  public dropConfig: WorldDropConfig;
  private gemSprite: any;
  private shadowSprite: any;
  private labelText: any;
  private isCollected: boolean = false;

  constructor(scene: any, config: WorldDropConfig) {
    super(scene, config.x, config.y);
    this.dropConfig = config;

    // Bóng đổ trên mặt đất (cố định)
    this.shadowSprite = scene.add.ellipse(0, 8, 28, 12, 0x000000, 0.35);
    this.add(this.shadowSprite);

    // Hình ảnh vật phẩm chính (sử dụng sprite hoặc icon vẽ)
    const iconKey = config.icon || 'drop_gem_default';
    if (scene.textures.exists(iconKey)) {
      this.gemSprite = scene.add.sprite(0, 0, iconKey);
    } else {
      // Fallback nếu chưa có sprite cụ thể: vẽ viên ngọc sáng pha lê
      this.gemSprite = scene.add.star(0, 0, 5, 8, 16, 0x38bdf8);
    }
    this.add(this.gemSprite);

    // Nhãn tên tiếng Việt và số lượng
    const textStr = `${config.nameVi} ${config.qty > 1 ? `x${config.qty}` : ''}`;
    this.labelText = scene.add.text(0, -22, textStr, {
      fontFamily: 'Be Vietnam Pro, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#fef08a',
      stroke: '#18120c',
      strokeThickness: 3,
      backgroundColor: 'rgba(20, 16, 13, 0.75)',
      padding: { x: 4, y: 2 },
    });
    this.labelText.setOrigin(0.5, 0.5);
    this.add(this.labelText);

    // Thêm container vào Scene
    scene.add.existing(this);
    this.setDepth(this.y);

    // Thiết lập vùng tương tác nhặt vật phẩm
    this.setSize(48, 48);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => this.collect());

    // Hiệu ứng nhấp nhô lơ lửng bồng bềnh (Bobbing Tween)
    scene.tweens.add({
      targets: [this.gemSprite, this.labelText],
      y: '-=6',
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Hiệu ứng bóng co giãn theo độ cao
    scene.tweens.add({
      targets: this.shadowSprite,
      scaleX: 0.8,
      scaleY: 0.8,
      alpha: 0.2,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Nhặt vật phẩm */
  public collect(): void {
    if (this.isCollected) return;
    this.isCollected = true;

    // Hiệu ứng tia sáng lấp lánh
    this.createSparkleEffect();

    // Báo sự kiện ra HTML Bridge để cộng vật phẩm vào túi đồ
    PhaserGameBridge.getInstance().emitDropCollected(this.dropConfig);

    // Tween bay lên thu nhỏ và biến mất
    this.scene.tweens.add({
      targets: this,
      y: this.y - 30,
      scaleX: 0.2,
      scaleY: 0.2,
      alpha: 0,
      duration: 350,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.destroy();
      },
    });
  }

  /** Hiệu ứng ngôi sao lấp lánh khi nhặt */
  private createSparkleEffect(): void {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const spark = this.scene.add.star(this.x, this.y, 4, 3, 8, 0xfde047);
      spark.setDepth(this.y + 100);

      this.scene.tweens.add({
        targets: spark,
        x: this.x + Math.cos(angle) * 35,
        y: this.y + Math.sin(angle) * 35,
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: 400,
        ease: 'Power2',
        onComplete: () => spark.destroy(),
      });
    }
  }
}
