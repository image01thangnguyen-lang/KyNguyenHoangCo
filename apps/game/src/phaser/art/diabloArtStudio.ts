/**
 * diabloArtStudio.ts
 * Studio Sinh Đồ Họa Chuẩn Phong Cách Classic Diablo II (Dark Fantasy / Isometric RPG)
 *
 * Tiêu chuẩn mỹ thuật:
 * - Bảng màu u tối trầm: Cỏ rêu phong (#2d3e23) pha bùn đất nứt nẻ (#3d2e1e).
 * - Bờ tường đá cổ rêu phong phong cách Rogue Encampment.
 * - Đống lửa trại đỏ than hồng & cột đuốc rực sáng trong đêm.
 * - Bóng đổ định hướng nghiêng (Directional Hard Shadows) ngả về góc trên bên trái (-45°).
 */

export class DiabloArtStudio {
  private static instance: DiabloArtStudio | null = null;
  private texturesRegistered: boolean = false;

  public static getInstance(): DiabloArtStudio {
    if (!DiabloArtStudio.instance) {
      DiabloArtStudio.instance = new DiabloArtStudio();
    }
    return DiabloArtStudio.instance;
  }

  private constructor() {}

  public registerAllTextures(scene: any): void {
    if (this.texturesRegistered) return;
    this.texturesRegistered = true;

    this.createGrittyGroundTile(scene);
    this.createStoneWallTexture(scene);
    this.createCampfireTexture(scene);
    this.createWoodFenceTexture(scene);
    this.createMossyBoulderTexture(scene);
    this.createTorchPostTexture(scene);
    this.createDirectionalShadowTextures(scene);
  }

  /** Nền đất cỏ rêu trầm (#2d3e23) pha đất bùn nứt nẻ sẫm màu (#3d2e1e) */
  private createGrittyGroundTile(scene: any): void {
    if (scene.textures.exists('diablo_gritty_ground')) return;

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // 1. Lớp Nền cỏ rêu trầm tối màu
    ctx.fillStyle = '#22301c';
    ctx.fillRect(0, 0, size, size);

    const baseGrad = ctx.createRadialGradient(size / 2, size / 2, 40, size / 2, size / 2, size / 1.3);
    baseGrad.addColorStop(0, '#2d3e23');
    baseGrad.addColorStop(0.7, '#24341e');
    baseGrad.addColorStop(1, '#1b2716');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, size, size);

    // 2. Các mảng đất bùn nứt nẻ (#3d2e1e)
    const mudColors = ['#3d2e1e', '#322518', '#261b11'];
    for (let m = 0; m < 12; m++) {
      const mx = ((Math.sin(m * 911) * 0.5 + 0.5) * size);
      const my = ((Math.cos(m * 733) * 0.5 + 0.5) * size);
      const mr = 28 + (m % 4) * 16;

      ctx.fillStyle = mudColors[m % mudColors.length];
      ctx.beginPath();
      ctx.ellipse(mx, my, mr, mr * 0.55, 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Vết nứt đất bùn
      ctx.strokeStyle = '#18110a';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(mx - mr * 0.5, my);
      ctx.lineTo(mx - 4, my + 6);
      ctx.lineTo(mx + mr * 0.4, my - 3);
      ctx.stroke();
    }

    // 3. Khóm cỏ rêu gai nhọn sẫm màu
    const bladeColors = ['#3f5631', '#2f4325', '#1e2c17', '#4b673b'];
    for (let i = 0; i < 140; i++) {
      const gx = ((Math.sin(i * 1871) * 0.5 + 0.5) * size);
      const gy = ((Math.cos(i * 2437) * 0.5 + 0.5) * size);
      const col = bladeColors[i % bladeColors.length];

      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx - 3, gy - 8);
      ctx.lineTo(gx + 1, gy - 2);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(gx + 2, gy);
      ctx.lineTo(gx + 5, gy - 9);
      ctx.lineTo(gx + 3, gy - 2);
      ctx.closePath();
      ctx.fill();
    }

    // 4. Sỏi đá dăm xám rải rác
    ctx.fillStyle = '#475569';
    for (let s = 0; s < 45; s++) {
      const sx = ((Math.sin(s * 4391) * 0.5 + 0.5) * size);
      const sy = ((Math.cos(s * 5107) * 0.5 + 0.5) * size);
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5 + (s % 2.5), 0, Math.PI * 2);
      ctx.fill();
    }

    scene.textures.addCanvas('diablo_gritty_ground', canvas);
  }

  /** Bờ tường đá cổ rêu phong (Diablo Rogue Encampment Stone Wall) */
  private createStoneWallTexture(scene: any): void {
    if (scene.textures.exists('diablo_stone_wall')) return;

    const w = 96;
    const h = 64;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Bóng đổ nghiêng của tường đá về góc trên trái
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.moveTo(10, 48);
    ctx.lineTo(0, 24);
    ctx.lineTo(76, 20);
    ctx.lineTo(86, 44);
    ctx.closePath();
    ctx.fill();

    // Khối tường đá cổ gồ ghề
    const wallGrad = ctx.createLinearGradient(12, 16, 84, 52);
    wallGrad.addColorStop(0, '#64748b');
    wallGrad.addColorStop(0.5, '#475569');
    wallGrad.addColorStop(1, '#334155');
    ctx.fillStyle = wallGrad;
    ctx.beginPath();
    ctx.moveTo(14, 20);
    ctx.lineTo(82, 20);
    ctx.lineTo(82, 54);
    ctx.lineTo(14, 54);
    ctx.closePath();
    ctx.fill();

    // Các viên đá cổ xếp lớp
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.2;
    // Hàng 1
    ctx.strokeRect(16, 22, 22, 14);
    ctx.strokeRect(38, 22, 20, 14);
    ctx.strokeRect(58, 22, 22, 14);
    // Hàng 2
    ctx.strokeRect(16, 36, 32, 16);
    ctx.strokeRect(48, 36, 32, 16);

    // Mảng rêu phong xanh bám trên mép đá
    ctx.fillStyle = '#4d7c0f';
    ctx.beginPath();
    ctx.ellipse(32, 22, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#65a30d';
    ctx.beginPath();
    ctx.ellipse(65, 36, 8, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    scene.textures.addCanvas('diablo_stone_wall', canvas);
  }

  /** Đống Lửa Trại Than Hồng & Củi Cháy (Diablo Campfire) */
  private createCampfireTexture(scene: any): void {
    if (scene.textures.exists('diablo_campfire')) return;

    const w = 72;
    const h = 64;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // 1. Vòng đá xếp quanh hố lửa
    const stoneGrad = ctx.createRadialGradient(36, 44, 4, 36, 44, 26);
    stoneGrad.addColorStop(0, '#1c1917');
    stoneGrad.addColorStop(0.7, '#44403c');
    stoneGrad.addColorStop(1, '#292524');
    ctx.fillStyle = stoneGrad;
    ctx.beginPath();
    ctx.ellipse(36, 46, 26, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Than hồng rực đỏ bên trong
    const emberGrad = ctx.createRadialGradient(36, 44, 2, 36, 44, 16);
    emberGrad.addColorStop(0, '#fef08a');
    emberGrad.addColorStop(0.3, '#f97316');
    emberGrad.addColorStop(0.7, '#dc2626');
    emberGrad.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = emberGrad;
    ctx.beginPath();
    ctx.ellipse(36, 44, 18, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Thanh củi gỗ gụ xếp chéo
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(22, 50);
    ctx.lineTo(50, 38);
    ctx.moveTo(22, 38);
    ctx.lineTo(50, 50);
    ctx.stroke();

    // 3. Ngọn lửa vàng cam bốc lên
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 12;

    const flameGrad = ctx.createLinearGradient(36, 44, 36, 12);
    flameGrad.addColorStop(0, '#f97316');
    flameGrad.addColorStop(0.6, '#facc15');
    flameGrad.addColorStop(1, '#ffffff');
    ctx.fillStyle = flameGrad;

    ctx.beginPath();
    ctx.moveTo(26, 44);
    ctx.quadraticCurveTo(24, 26, 36, 14); // Đỉnh lửa
    ctx.quadraticCurveTo(46, 26, 46, 44);
    ctx.quadraticCurveTo(36, 48, 26, 44);
    ctx.closePath();
    ctx.fill();

    // Lưỡi lửa phụ
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(32, 40);
    ctx.quadraticCurveTo(30, 24, 36, 18);
    ctx.quadraticCurveTo(42, 24, 40, 40);
    ctx.closePath();
    ctx.fill();

    scene.textures.addCanvas('diablo_campfire', canvas);
  }

  /** Hàng rào cọc gỗ xù xì (Rugged Wood Fence) */
  private createWoodFenceTexture(scene: any): void {
    if (scene.textures.exists('diablo_wood_fence')) return;

    const w = 72;
    const h = 54;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Cọc gỗ đứng 1
    ctx.fillStyle = '#5c2e0b';
    ctx.beginPath();
    ctx.moveTo(18, 12);
    ctx.lineTo(24, 8); // Đỉnh nhọn
    ctx.lineTo(30, 12);
    ctx.lineTo(28, 48);
    ctx.lineTo(20, 48);
    ctx.closePath();
    ctx.fill();

    // Cọc gỗ đứng 2
    ctx.beginPath();
    ctx.moveTo(48, 14);
    ctx.lineTo(54, 10);
    ctx.lineTo(60, 14);
    ctx.lineTo(58, 48);
    ctx.lineTo(50, 48);
    ctx.closePath();
    ctx.fill();

    // Thanh gỗ ngang
    ctx.fillStyle = '#78350f';
    ctx.fillRect(10, 20, 54, 7);
    ctx.fillRect(12, 34, 52, 6);

    scene.textures.addCanvas('diablo_wood_fence', canvas);
  }

  /** Tảng đá rêu phong gồ ghề (Mossy Boulder) */
  private createMossyBoulderTexture(scene: any): void {
    if (scene.textures.exists('diablo_mossy_boulder')) return;

    const w = 54;
    const h = 42;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    const rockGrad = ctx.createRadialGradient(24, 20, 4, 27, 24, 22);
    rockGrad.addColorStop(0, '#64748b');
    rockGrad.addColorStop(0.7, '#475569');
    rockGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = rockGrad;

    ctx.beginPath();
    ctx.moveTo(14, 28);
    ctx.lineTo(20, 10);
    ctx.lineTo(38, 8);
    ctx.lineTo(48, 22);
    ctx.lineTo(42, 36);
    ctx.lineTo(16, 36);
    ctx.closePath();
    ctx.fill();

    // Mảng rêu
    ctx.fillStyle = '#4d7c0f';
    ctx.beginPath();
    ctx.ellipse(28, 12, 10, 4, -0.2, 0, Math.PI * 2);
    ctx.fill();

    scene.textures.addCanvas('diablo_mossy_boulder', canvas);
  }

  /** Cột đuốc gỗ cắm đất rực sáng (Torch Post) */
  private createTorchPostTexture(scene: any): void {
    if (scene.textures.exists('diablo_torch_post')) return;

    const w = 36;
    const h = 80;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Cột gỗ
    ctx.fillStyle = '#451a03';
    ctx.fillRect(16, 26, 5, 50);

    // Bát sắt giữ lửa
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(12, 26);
    ctx.lineTo(25, 26);
    ctx.lineTo(22, 34);
    ctx.lineTo(15, 34);
    ctx.closePath();
    ctx.fill();

    // Ngọn lửa đuốc
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 10;
    const flameGrad = ctx.createLinearGradient(18, 26, 18, 6);
    flameGrad.addColorStop(0, '#ea580c');
    flameGrad.addColorStop(0.6, '#fbbf24');
    flameGrad.addColorStop(1, '#ffffff');
    ctx.fillStyle = flameGrad;

    ctx.beginPath();
    ctx.moveTo(13, 26);
    ctx.quadraticCurveTo(10, 16, 18, 6);
    ctx.quadraticCurveTo(26, 16, 23, 26);
    ctx.closePath();
    ctx.fill();

    scene.textures.addCanvas('diablo_torch_post', canvas);
  }

  /**
   * Tạo Texture Bóng Đổ Định Hướng Nghiêng (Directional Hard Shadows)
   * Ngả về góc trên bên trái (-45°) theo chuẩn Diablo II
   */
  private createDirectionalShadowTextures(scene: any): void {
    // 1. Bóng cho Dũng Sĩ (Character)
    if (!scene.textures.exists('directional_shadow_character')) {
      const w = 72;
      const h = 48;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      // Bóng nghiêng hình người ngả về góc trên trái
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, 28, 14, -0.45, 0, Math.PI * 2);
      ctx.fill();

      scene.textures.addCanvas('directional_shadow_character', canvas);
    }

    // 2. Bóng cho Dã Thú Khổng Lồ (Beast / Dinosaur)
    if (!scene.textures.exists('directional_shadow_beast')) {
      const w = 110;
      const h = 64;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, 46, 20, -0.45, 0, Math.PI * 2);
      ctx.fill();

      scene.textures.addCanvas('directional_shadow_beast', canvas);
    }
  }
}
