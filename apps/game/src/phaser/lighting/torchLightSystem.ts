/**
 * torchLightSystem.ts
 * Hệ Thống Màn Sương Bóng Tối (Fog of War) & Ánh Sáng Đuốc Đêm (Dynamic Torchlight)
 *
 * Chức năng:
 * 1. Màn sương bóng tối (Dark Fog of War) bao phủ toàn bộ thế giới (`rgba(8, 6, 4, 0.84)`).
 * 2. Vòng sáng ấm áp (Radial Warm Light) quanh nhân vật và các đống lửa trại / ngọn đuốc.
 * 3. Hiệu ứng bập bùng ngọn đuốc (Torch Flicker): Dao động bán kính ±7px và cường độ sáng 12Hz tạo cảm giác ngọn lửa sống động.
 */

import { Phaser } from '../phaserTypes.ts';

export interface LightSource {
  x: number;
  y: number;
  radius: number;
  intensity?: number;
  color?: string;
}

export class TorchLightSystem {
  private scene: any;
  private darknessCanvas!: HTMLCanvasElement;
  private darknessContext!: CanvasRenderingContext2D;
  private darknessTextureKey: string = 'dynamic_darkness_fog';
  private darknessImage!: any;

  // Danh sách các nguồn sáng tĩnh (Lửa trại, Cột đuốc)
  public staticLights: LightSource[] = [];

  // Thông số ngọn đuốc nhân vật
  public playerLightRadius: number = 220;
  private flickerTimer: number = 0;
  private currentFlickerOffset: number = 0;

  constructor(scene: any) {
    this.scene = scene;
    this.initDarknessOverlay();
  }

  /** Khởi tạo canvas lớp phủ bóng tối */
  private initDarknessOverlay(): void {
    const w = this.scene.scale.width || 800;
    const h = this.scene.scale.height || 600;

    this.darknessCanvas = document.createElement('canvas');
    this.darknessCanvas.width = w;
    this.darknessCanvas.height = h;
    this.darknessContext = this.darknessCanvas.getContext('2d')!;

    // Thêm CanvasTexture vào Phaser
    if (this.scene.textures.exists(this.darknessTextureKey)) {
      this.scene.textures.remove(this.darknessTextureKey);
    }
    this.scene.textures.addCanvas(this.darknessTextureKey, this.darknessCanvas);

    // Sprite hiển thị lớp phủ bóng tối bám theo Camera
    this.darknessImage = this.scene.add.image(0, 0, this.darknessTextureKey);
    this.darknessImage.setOrigin(0, 0);
    this.darknessImage.setScrollFactor(0); // Cố định trên khung nhìn Camera
    this.darknessImage.setDepth(99990); // Nằm trên thế giới nhưng dưới UI HUD

    // Lắng nghe sự kiện resize
    this.scene.scale.on('resize', (gameSize: any) => {
      this.resize(gameSize.width, gameSize.height);
    });
  }

  /** Thay đổi kích thước khi xoay màn hình / resize */
  public resize(w: number, h: number): void {
    this.darknessCanvas.width = Math.max(100, w);
    this.darknessCanvas.height = Math.max(100, h);
    if (this.darknessImage) {
      this.darknessImage.setTexture(this.darknessTextureKey);
    }
  }

  /** Thêm 1 nguồn sáng tĩnh (Lửa trại, Đuốc cắm đất) */
  public addLight(light: LightSource): void {
    this.staticLights.push(light);
  }

  /** Cập nhật và vẽ lại ánh sáng mỗi frame */
  public update(playerX: number, playerY: number, delta: number): void {
    if (!this.darknessContext) return;

    const ctx = this.darknessContext;
    const w = this.darknessCanvas.width;
    const h = this.darknessCanvas.height;
    const cam = this.scene.cameras.main;

    // 1. Tính toán hiệu ứng bập bùng ngọn đuốc (Torch Flicker)
    this.flickerTimer += delta * 0.014;
    const flickerNoise = (Math.sin(this.flickerTimer * 7.5) * 0.6 + Math.sin(this.flickerTimer * 19.3) * 0.4) * 7.0;
    this.currentFlickerOffset = flickerNoise;

    // 2. Xóa và phủ kín màn sương bóng tối u uất
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(7, 5, 4, 0.84)';
    ctx.fillRect(0, 0, w, h);

    // 3. Sử dụng chế độ hòa trộn 'destination-out' để đục các quầng sáng
    ctx.globalCompositeOperation = 'destination-out';

    // A. Quầng sáng ấm áp của ngọn đuốc trên tay Dũng Sĩ
    const playerScreenX = playerX - cam.scrollX;
    const playerScreenY = playerY - cam.scrollY - 20;
    const rPlayer = Math.max(60, this.playerLightRadius + this.currentFlickerOffset);

    this.drawRadialLightCutout(ctx, playerScreenX, playerScreenY, rPlayer, 0.95);

    // B. Các quầng sáng từ Lửa Trại & Cột Đuốc trên bản đồ
    for (const light of this.staticLights) {
      const sx = light.x - cam.scrollX;
      const sy = light.y - cam.scrollY;

      // Chỉ vẽ nếu nằm trong tầm nhìn màn hình
      if (sx > -light.radius && sx < w + light.radius && sy > -light.radius && sy < h + light.radius) {
        const rLight = light.radius + (Math.sin(this.flickerTimer * 6.0 + light.x) * 4.0);
        this.drawRadialLightCutout(ctx, sx, sy, rLight, light.intensity ?? 0.92);
      }
    }

    // 4. Phủ lại quầng hào quang màu vàng cam ấm áp (Luster Glow)
    ctx.globalCompositeOperation = 'source-over';
    this.drawWarmAura(ctx, playerScreenX, playerScreenY, rPlayer);
    for (const light of this.staticLights) {
      const sx = light.x - cam.scrollX;
      const sy = light.y - cam.scrollY;
      if (sx > -light.radius && sx < w + light.radius && sy > -light.radius && sy < h + light.radius) {
        this.drawWarmAura(ctx, sx, sy, light.radius);
      }
    }

    // 5. Cập nhật texture lên GPU
    const phaserTex = this.scene.textures.get(this.darknessTextureKey);
    if (phaserTex) {
      phaserTex.getSourceImage();
      phaserTex.update();
    }
  }

  /** Đục lỗ bóng tối với Gradient mềm mại */
  private drawRadialLightCutout(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, maxAlpha = 0.95): void {
    const grad = ctx.createRadialGradient(x, y, radius * 0.12, x, y, radius);
    grad.addColorStop(0, `rgba(0, 0, 0, ${maxAlpha})`);
    grad.addColorStop(0.45, `rgba(0, 0, 0, ${maxAlpha * 0.85})`);
    grad.addColorStop(0.75, `rgba(0, 0, 0, ${maxAlpha * 0.4})`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Vẽ quầng hào quang vàng cam ấm áp ở tâm ngọn lửa */
  private drawWarmAura(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
    const auraGrad = ctx.createRadialGradient(x, y, 4, x, y, radius * 0.7);
    auraGrad.addColorStop(0, 'rgba(251, 191, 36, 0.22)');
    auraGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.1)');
    auraGrad.addColorStop(1, 'rgba(217, 119, 6, 0)');

    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}
