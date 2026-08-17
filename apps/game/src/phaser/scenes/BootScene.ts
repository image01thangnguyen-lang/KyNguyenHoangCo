/**
 * BootScene.ts
 * Scene Khởi Tạo Hệ Thống Phaser 3 (Game Boot & Texture Generation)
 *
 * Chức năng:
 * - Khởi tạo cấu hình ban đầu cho Engine Phaser 3.
 * - Khởi tạo các textures nền giấy da cổ kính (Parchment), mũi tên, ngọc rơi, trạm di tích.
 * - Nạp Procedural Atlas tạo các dải hoạt ảnh 6 khung hình trong suốt HD.
 * - Chuyển tiếp mượt mà sang `PreloadScene`.
 */

import { Phaser } from '../phaserTypes.ts';
import { ProceduralCatalogAtlas } from '../../animation/proceduralCatalogAtlas.ts';
import { ENTITY_CATALOG } from '../../animation/entityCatalog.ts';
import { SkeletalArtStudio } from '../art/skeletalArtStudio.ts';
import { DiabloArtStudio } from '../art/diabloArtStudio.ts';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  public preload(): void {
    // Không cần nạp nặng ở BootScene, chuẩn bị tài nguyên cơ bản
  }

  public create(): void {
    // 1. Đăng ký Toàn bộ Part Textures Vector HD & Khớp Xương
    SkeletalArtStudio.getInstance().registerAllPartTextures(this);

    // 2. Đăng ký Toàn bộ Textures Chuẩn Diablo II Isometric RPG
    DiabloArtStudio.getInstance().registerAllTextures(this);

    // 3. Tạo Texture Mũi Tên Săn Bắn (Arrow Projectile)
    this.createArrowTexture();

    // 3. Tạo Texture Nền Giấy Da Cổ Kính (Parchment Ground Tile)
    this.createParchmentGroundTexture();

    // 4. Tạo Texture Viên Ngọc Rơi Mặc Định (World Drop Gem)
    this.createDropGemTexture();

    // 5. Tạo Texture Trạm Di Tích Cổ (POIs)
    this.createPoiMarkerTexture();

    // 6. Nạp toàn bộ dải Sprite 6 Khung Hình từ Procedural Atlas vào Texture Manager
    this.registerProceduralTextures();

    // Chuyển sang PreloadScene để tải assets từ file và tạo Animation Keys
    this.scene.start('PreloadScene');
  }

  /** Tạo texture mũi tên đá thạch anh */
  private createArrowTexture(): void {
    if (this.textures.exists('arrow_projectile')) return;

    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 12;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Thân tên gỗ
      ctx.fillStyle = '#b45309';
      ctx.fillRect(4, 5, 20, 2);
      // Đầu tên đá nhọn
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(24, 2);
      ctx.lineTo(31, 6);
      ctx.lineTo(24, 10);
      ctx.closePath();
      ctx.fill();
      // Lông đuôi chim
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(0, 3, 4, 6);
    }
    this.textures.addCanvas('arrow_projectile', canvas);
  }

  /** Tạo texture nền đất giấy da cổ kính (Antique Parchment Tile) */
  private createParchmentGroundTexture(): void {
    if (this.textures.exists('parchment_ground_tile')) return;

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Màu giấy da cổ
      ctx.fillStyle = '#1c1612';
      ctx.fillRect(0, 0, size, size);

      // Vân đất tự nhiên
      const grad = ctx.createRadialGradient(size / 2, size / 2, 40, size / 2, size / 2, size / 1.4);
      grad.addColorStop(0, '#241c16');
      grad.addColorStop(1, '#18120e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      // Điểm xuyết các đốm đá cổ và vết rạn nhẹ
      ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
      for (let i = 0; i < 80; i++) {
        const rx = (Math.sin(i * 997) * 0.5 + 0.5) * size;
        const ry = (Math.cos(i * 613) * 0.5 + 0.5) * size;
        const rr = 1.5 + (i % 3);
        ctx.beginPath();
        ctx.arc(rx, ry, rr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    this.textures.addCanvas('parchment_ground_tile', canvas);
  }

  /** Tạo texture ngọc rơi 3D */
  private createDropGemTexture(): void {
    if (this.textures.exists('drop_gem_default')) return;

    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Vẽ viên ngọc lục bảo tiền sử 3D
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.moveTo(16, 2);
      ctx.lineTo(28, 12);
      ctx.lineTo(16, 30);
      ctx.lineTo(4, 12);
      ctx.closePath();
      ctx.fill();

      // Mặt cắt bóng sáng
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#7dd3fc';
      ctx.beginPath();
      ctx.moveTo(16, 2);
      ctx.lineTo(22, 12);
      ctx.lineTo(16, 22);
      ctx.lineTo(10, 12);
      ctx.closePath();
      ctx.fill();
    }
    this.textures.addCanvas('drop_gem_default', canvas);
  }

  /** Tạo texture Trạm Di Tích PokéStop dạng trụ huy hiệu cổ */
  private createPoiMarkerTexture(): void {
    if (this.textures.exists('poi_pokestop_marker')) return;

    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Vòng tròn huy hiệu năng lượng
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.arc(24, 24, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(24, 24, 12, 0, Math.PI * 2);
      ctx.fill();

      // Trụ năng lượng hướng xuống đất
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.moveTo(20, 36);
      ctx.lineTo(28, 36);
      ctx.lineTo(25, 60);
      ctx.lineTo(23, 60);
      ctx.closePath();
      ctx.fill();
    }
    this.textures.addCanvas('poi_pokestop_marker', canvas);
  }

  /** Nạp các dải Sprite 6 khung hình từ Procedural Atlas vào Phaser */
  private registerProceduralTextures(): void {
    const atlas = ProceduralCatalogAtlas.getInstance();
    
    for (const [id, entry] of Object.entries(ENTITY_CATALOG)) {
      const stripCanvas = atlas.getStrip(id);
      if (stripCanvas) {
        const frameW = stripCanvas.width / 6;
        const frameH = stripCanvas.height;
        const sheetKey = `strip_${id}`;

        if (!this.textures.exists(sheetKey)) {
          // Thêm canvas vào Texture Manager
          this.textures.addCanvas(sheetKey, stripCanvas);

          // Cắt thành Spritesheet 6 khung hình
          const texture = this.textures.get(sheetKey);
          for (let f = 0; f < 6; f++) {
            texture.add(f, 0, f * frameW, 0, frameW, frameH);
          }
        }
      }
    }
  }
}
