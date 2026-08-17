/**
 * PreloadScene.ts
 * Scene Tải Tài Nguyên & Khởi Tạo Hoạt Ảnh 6 Khung Hình (Asset Loader & Animation Generator)
 *
 * Chức năng:
 * - Nạp Catalog Spritesheet từ file ảnh `assets/character_catalog_sheet.jpg` và `assets/design_sheet.jpg`.
 * - Tự động tính toán kích thước khung hình và tạo các dải Spritesheet 6 khung hình.
 * - Khởi tạo đầy đủ Animation Keys cho từng thực thể theo chuẩn:
 *   + `[name]_idle`: Khung 0
 *   + `[name]_walk`: Khung 1 -> 3 (loop: -1, frameRate: 8-10)
 *   + `[name]_attack`: Khung 4 -> 5 (loop: 0)
 *   + `[name]_dead`: Khung 5
 * - Chuyển sang `MainGameScene`.
 */

import { Phaser } from '../phaserTypes.ts';
import { ENTITY_CATALOG } from '../../animation/entityCatalog.ts';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  public preload(): void {
    // 1. Vẽ thanh tiến trình tải tải nguyên mượt mà
    this.createLoadingUI();

    // 2. Nạp ảnh Catalog Sheet gốc
    this.load.image('character_catalog_sheet', './assets/character_catalog_sheet.jpg');
    this.load.image('design_sheet', './assets/design_sheet.jpg');
  }

  public create(): void {
    // 1. Cắt Spritesheet từ ảnh Catalog Sheet hoặc sử dụng Procedural Atlas
    this.processCatalogSpritesheets();

    // 2. Tạo toàn bộ Animation Keys cho các dã thú & anh hùng
    this.createEntityAnimations();

    // 3. Khởi động MainGameScene
    this.scene.start('MainGameScene');
  }

  /** Hiển thị thanh tiến trình nạp game phong cách hoang cổ */
  private createLoadingUI(): void {
    const { width, height } = this.scale;
    const progressBox = this.add.graphics();
    const progressBar = this.add.graphics();

    progressBox.fillStyle(0x18120c, 0.85);
    progressBox.fillRoundedRect(width / 2 - 160, height / 2 - 15, 320, 30, 8);
    progressBox.lineStyle(2, 0xd97706, 0.75);
    progressBox.strokeRoundedRect(width / 2 - 160, height / 2 - 15, 320, 30, 8);

    const loadingText = this.add.text(width / 2, height / 2 - 35, 'Đang mở Bản Đồ Hoàng Cổ...', {
      fontFamily: 'Be Vietnam Pro, sans-serif',
      fontSize: '14px',
      color: '#fef08a',
    });
    loadingText.setOrigin(0.5, 0.5);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0xf59e0b, 1);
      progressBar.fillRoundedRect(width / 2 - 156, height / 2 - 11, 312 * value, 22, 6);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });
  }

  /** Xử lý cắt dải Spritesheet từ Catalog Sheet cho từng loại quái/anh hùng */
  private processCatalogSpritesheets(): void {
    const catalogImg = this.textures.get('character_catalog_sheet')?.getSourceImage() as HTMLImageElement;

    for (const [id, entry] of Object.entries(ENTITY_CATALOG)) {
      const sheetKey = `strip_${id}`;

      // Nếu đã có từ Procedural Texture ở BootScene thì ưu tiên
      if (this.textures.exists(sheetKey)) {
        continue;
      }

      // Nếu có tọa độ vùng cắt trên ảnh catalogBounds
      if (catalogImg && entry.catalogBounds) {
        const b = entry.catalogBounds;
        const frameW = b.stripWidth / 6;
        const frameH = b.stripHeight;

        // Tạo canvas phụ để trích xuất dải 6 khung hình độc lập
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = b.stripWidth;
        tempCanvas.height = b.stripHeight;
        const ctx = tempCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(catalogImg, b.startX, b.startY, b.stripWidth, b.stripHeight, 0, 0, b.stripWidth, b.stripHeight);
          this.textures.addCanvas(sheetKey, tempCanvas);

          const texture = this.textures.get(sheetKey);
          for (let f = 0; f < 6; f++) {
            texture.add(f, 0, f * frameW, 0, frameW, frameH);
          }
        }
      }
    }
  }

  /** Khởi tạo sẵn toàn bộ Animation Keys (Idle, Walk, Attack, Dead) cho 20+ thực thể */
  private createEntityAnimations(): void {
    for (const [id, entry] of Object.entries(ENTITY_CATALOG)) {
      const sheetKey = `strip_${id}`;
      if (!this.textures.exists(sheetKey)) continue;

      const fps = entry.defaultFps || 8;

      // 1. Hoạt ảnh ĐỨNG YÊN (IDLE - Khung 0)
      if (!this.anims.exists(`${id}_idle`)) {
        this.anims.create({
          key: `${id}_idle`,
          frames: this.anims.generateFrameNumbers(sheetKey, { start: 0, end: 0 }),
          frameRate: 1,
          repeat: -1,
        });
      }

      // 2. Hoạt ảnh BƯỚC ĐI (WALK - Khung 1 -> 3 Lặp lại)
      if (!this.anims.exists(`${id}_walk`)) {
        this.anims.create({
          key: `${id}_walk`,
          frames: [
            { key: sheetKey, frame: 1 },
            { key: sheetKey, frame: 2 },
            { key: sheetKey, frame: 3 },
            { key: sheetKey, frame: 2 },
          ],
          frameRate: fps,
          repeat: -1,
        });
      }

      // 3. Hoạt ảnh TẤN CÔNG (ATTACK - Khung 4 -> 5 Chạy 1 lần)
      if (!this.anims.exists(`${id}_attack`)) {
        this.anims.create({
          key: `${id}_attack`,
          frames: this.anims.generateFrameNumbers(sheetKey, { start: 4, end: 5 }),
          frameRate: fps + 2,
          repeat: 0,
        });
      }

      // 4. Hoạt ảnh GỤC NGÃ (DEAD - Khung 5 Cố định)
      if (!this.anims.exists(`${id}_dead`)) {
        this.anims.create({
          key: `${id}_dead`,
          frames: this.anims.generateFrameNumbers(sheetKey, { start: 5, end: 5 }),
          frameRate: 1,
          repeat: 0,
        });
      }
    }
  }
}
