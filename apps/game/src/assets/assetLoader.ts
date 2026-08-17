/**
 * AssetLoader.ts
 * Hệ thống Quản lý Sprite & Asset Caching cho Kỷ Nguyên Hoang Cổ
 * Tự động tạo và cache toàn bộ Sprite HD theo bảng thiết kế (Design Sheet)
 */

export interface SpriteAnchor {
  anchorX: number; // 0.0 -> 1.0 (mặc định 0.5 ở giữa)
  anchorY: number; // 0.0 -> 1.0 (mặc định 1.0 ở chân)
  width: number;
  height: number;
}

export class AssetLoader {
  private static instance: AssetLoader | null = null;
  private spriteCache: Map<string, HTMLImageElement | HTMLCanvasElement> = new Map();
  private anchorCache: Map<string, SpriteAnchor> = new Map();
  private catalogImage?: HTMLImageElement | HTMLCanvasElement;

  private constructor() {
    this.initBuiltinSprites();
    this.loadDesignSheetAtlas();
    this.loadCharacterCatalogSheet();
  }

  public static getInstance(): AssetLoader {
    if (!AssetLoader.instance) {
      AssetLoader.instance = new AssetLoader();
    }
    return AssetLoader.instance;
  }

  /** Lấy hình ảnh Catalog Sprite Sheet chung */
  public getCatalogImage(): HTMLImageElement | HTMLCanvasElement | undefined {
    return this.catalogImage || this.spriteCache.get('character_catalog_sheet');
  }

  /** Nạp hình ảnh từ đường dẫn bên ngoài (nếu có) */
  public async load(key: string, url: string, anchorX: number = 0.5, anchorY: number = 1.0): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.spriteCache.set(key, img);
        this.anchorCache.set(key, {
          anchorX,
          anchorY,
          width: img.width,
          height: img.height,
        });
        resolve(img);
      };
      img.onerror = (err) => reject(err);
      img.src = url;
    });
  }

  /** Lấy sprite từ bộ nhớ đệm */
  public get(key: string): HTMLImageElement | HTMLCanvasElement | undefined {
    return this.spriteCache.get(key);
  }

  public getAnchor(key: string): SpriteAnchor {
    return this.anchorCache.get(key) || { anchorX: 0.5, anchorY: 1.0, width: 64, height: 64 };
  }

  public has(key: string): boolean {
    return this.spriteCache.has(key);
  }

  /**
   * Vẽ một sprite lên canvas tại tọa độ chân (foot position)
   * Tự động căn chỉnh theo Anchor Point (0.5, 1.0)
   */
  public drawSprite(
    ctx: CanvasRenderingContext2D,
    key: string,
    x: number,
    y: number,
    targetWidth?: number,
    targetHeight?: number,
    scale: number = 1.0,
    flipX: boolean = false,
    rotation: number = 0,
    alpha: number = 1.0,
  ): void {
    const sprite = this.spriteCache.get(key);
    if (!sprite) return;

    const anchor = this.getAnchor(key);
    const sw = targetWidth ?? anchor.width;
    const sh = targetHeight ?? anchor.height;
    const drawW = sw * scale;
    const drawH = sh * scale;
    const offsetX = -drawW * anchor.anchorX;
    const offsetY = -drawH * anchor.anchorY;

    ctx.save();
    ctx.translate(x, y);
    if (rotation !== 0) ctx.rotate(rotation);
    if (flipX) ctx.scale(-1, 1);
    if (alpha < 1.0) ctx.globalAlpha *= alpha;

    ctx.drawImage(sprite, offsetX, offsetY, drawW, drawH);
    ctx.restore();
  }

  /**
   * Khởi tạo toàn bộ Sprite HD chất lượng cao từ bản thiết kế (Design Sheet)
   * Tạo các Canvas đệm siêu nét để vẽ cực nhanh qua ctx.drawImage()
   */
  private initBuiltinSprites(): void {
    this.createParchmentTexture();
    this.createCompassRoseSprite();
    this.createWorldDropSprites();
    this.createWeaponSprites();
    this.createAnimalTrapSprites();
    this.createBeastSprites();
  }

  /** Nền Giấy Da Cổ Kính (Parchment Texture) */
  private createParchmentTexture(): void {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Nền giấy da ấm áp
    const bgGrad = ctx.createRadialGradient(size / 2, size / 2, 50, size / 2, size / 2, size * 0.7);
    bgGrad.addColorStop(0, '#ebd8b7');
    bgGrad.addColorStop(0.65, '#dfc59e');
    bgGrad.addColorStop(1, '#caa778');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, size, size);

    // Vân giấy loang hữu cơ
    for (let i = 0; i < 400; i++) {
      const rx = (Math.sin(i * 99.7) * 0.5 + 0.5) * size;
      const ry = (Math.cos(i * 33.1) * 0.5 + 0.5) * size;
      const rRad = 8 + (i % 25);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(180, 140, 90, 0.04)' : 'rgba(255, 245, 225, 0.05)';
      ctx.beginPath();
      ctx.arc(rx, ry, rRad, 0, Math.PI * 2);
      ctx.fill();
    }

    // Viền sờn da
    ctx.strokeStyle = 'rgba(100, 65, 30, 0.12)';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, size - 8, size - 8);

    this.spriteCache.set('terrain_parchment', canvas);
    this.anchorCache.set('terrain_parchment', { anchorX: 0, anchorY: 0, width: size, height: size });
  }

  /** Hoa La Bàn Cổ Kính (Compass Rose) */
  private createCompassRoseSprite(): void {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cx = size / 2;
    const cy = size / 2;
    const r = 52;

    // Vòng tròn ngoài & trong
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 6, 0, Math.PI * 2);
    ctx.arc(cx, cy, r - 12, 0, Math.PI * 2);
    ctx.stroke();

    // 8 Mũi tên la bàn (Bắc - Nam - Đông - Tây và 4 hướng phụ)
    const points = 8;
    for (let i = 0; i < points; i++) {
      const angle = (i * Math.PI * 2) / points - Math.PI / 2;
      const isMajor = i % 2 === 0;
      const tipLen = isMajor ? r - 2 : r - 16;
      const baseLen = 9;

      const tx = cx + Math.cos(angle) * tipLen;
      const ty = cy + Math.sin(angle) * tipLen;
      const bx1 = cx + Math.cos(angle + Math.PI / 2) * baseLen;
      const by1 = cy + Math.sin(angle + Math.PI / 2) * baseLen;
      const bx2 = cx + Math.cos(angle - Math.PI / 2) * baseLen;
      const by2 = cy + Math.sin(angle - Math.PI / 2) * baseLen;

      // Nửa đón sáng
      ctx.fillStyle = i === 0 ? '#dc2626' : isMajor ? '#f59e0b' : '#d97706';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(bx1, by1);
      ctx.lineTo(tx, ty);
      ctx.closePath();
      ctx.fill();

      // Nửa khuất sáng
      ctx.fillStyle = i === 0 ? '#991b1b' : isMajor ? '#78350f' : '#451a03';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(bx2, by2);
      ctx.lineTo(tx, ty);
      ctx.closePath();
      ctx.fill();
    }

    // Tâm la bàn
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    this.spriteCache.set('compass_rose', canvas);
    this.anchorCache.set('compass_rose', { anchorX: 0.5, anchorY: 0.5, width: size, height: size });
  }

  /** Vật phẩm rơi (World Drops: Cành cây, Đá, Thảo dược, Quả dại, Thịt, Cá) */
  private createWorldDropSprites(): void {
    const makeDrop = (key: string, drawFn: (ctx: CanvasRenderingContext2D, cx: number, cy: number) => void) => {
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawFn(ctx, size / 2, size / 2 + 6);
        this.spriteCache.set(key, canvas);
        this.anchorCache.set(key, { anchorX: 0.5, anchorY: 1.0, width: size, height: size });
      }
    };

    // 1. Cành cây (Stick)
    makeDrop('drop_stick', (ctx, cx, cy) => {
      ctx.save();
      ctx.translate(cx, cy - 8);
      ctx.rotate(-0.35);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-16, -3, 32, 6);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(-16, -2, 32, 2);
      // Nhánh nhỏ
      ctx.beginPath();
      ctx.moveTo(2, -3); ctx.lineTo(10, -12); ctx.lineTo(13, -11); ctx.lineTo(6, -3);
      ctx.fill();
      ctx.restore();
    });

    // 2. Đá nhọn (Flint)
    makeDrop('drop_flint', (ctx, cx, cy) => {
      ctx.save();
      ctx.translate(cx, cy - 8);
      const grad = ctx.createLinearGradient(-10, -14, 10, 8);
      grad.addColorStop(0, '#94a3b8');
      grad.addColorStop(0.5, '#475569');
      grad.addColorStop(1, '#1e293b');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(12, 0);
      ctx.lineTo(8, 8);
      ctx.lineTo(-10, 6);
      ctx.lineTo(-12, -4);
      ctx.closePath();
      ctx.fill();
      // Cạnh vát sắc
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -14); ctx.lineTo(2, 4); ctx.lineTo(8, 8);
      ctx.stroke();
      ctx.restore();
    });

    // 3. Thảo dược (Herb)
    makeDrop('drop_herb', (ctx, cx, cy) => {
      ctx.save();
      ctx.translate(cx, cy - 8);
      ctx.fillStyle = '#16a34a';
      for (const angle of [-0.6, -0.2, 0.2, 0.6]) {
        ctx.beginPath();
        ctx.ellipse(Math.sin(angle) * 8, -Math.cos(angle) * 10, 4, 10, angle, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(0, -5, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 4. Quả dại (Berry)
    makeDrop('drop_berry', (ctx, cx, cy) => {
      ctx.save();
      ctx.translate(cx, cy - 8);
      const berries = [
        { x: -5, y: -2, c: '#a855f7' },
        { x: 4, y: -4, c: '#9333ea' },
        { x: 0, y: -9, c: '#c084fc' },
        { x: 0, y: 3, c: '#7e22ce' },
      ];
      for (const b of berries) {
        ctx.fillStyle = b.c;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(b.x + 2, b.y - 2, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // 5. Thịt (Meat)
    makeDrop('drop_meat', (ctx, cx, cy) => {
      ctx.save();
      ctx.translate(cx, cy - 8);
      const mGrad = ctx.createRadialGradient(-2, -4, 2, 0, 0, 14);
      mGrad.addColorStop(0, '#f87171');
      mGrad.addColorStop(0.7, '#dc2626');
      mGrad.addColorStop(1, '#7f1d1d');
      ctx.fillStyle = mGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 9, -0.2, 0, Math.PI * 2);
      ctx.fill();
      // Khúc xương trắng
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-16, -3, 6, 6);
      ctx.beginPath();
      ctx.arc(-16, -4, 3, 0, Math.PI * 2);
      ctx.arc(-16, 2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 6. Cá sông (Fish)
    makeDrop('drop_fish', (ctx, cx, cy) => {
      ctx.save();
      ctx.translate(cx, cy - 8);
      const fGrad = ctx.createLinearGradient(-12, 0, 12, 0);
      fGrad.addColorStop(0, '#38bdf8');
      fGrad.addColorStop(0.6, '#0284c7');
      fGrad.addColorStop(1, '#0369a1');
      ctx.fillStyle = fGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      // Đuôi
      ctx.beginPath();
      ctx.moveTo(-10, 0); ctx.lineTo(-18, -6); ctx.lineTo(-18, 6);
      ctx.closePath();
      ctx.fill();
      // Mắt
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(7, -2, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(7.5, -2, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  /** Vũ khí (Weapons: Spear, Hammer, Night Torch) */
  private createWeaponSprites(): void {
    const makeWep = (key: string, drawFn: (ctx: CanvasRenderingContext2D) => void) => {
      const size = 96;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawFn(ctx);
        this.spriteCache.set(key, canvas);
        this.anchorCache.set(key, { anchorX: 0.5, anchorY: 0.5, width: size, height: size });
      }
    };

    // Giáo dài (Spear)
    makeWep('weapon_spear', (ctx) => {
      const cx = 48, cy = 48;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-Math.PI / 4);
      // Cán gỗ
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-3, -36, 6, 72);
      // Mũi giáo đá/đồng
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.moveTo(0, -46); ctx.lineTo(7, -32); ctx.lineTo(-7, -32);
      ctx.closePath();
      ctx.fill();
      // Mũi nhọn sáng
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(0, -46); ctx.lineTo(2, -34); ctx.lineTo(-2, -34);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // Búa đá (Hammer)
    makeWep('weapon_hammer', (ctx) => {
      const cx = 48, cy = 48;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-Math.PI / 4);
      // Cán gỗ
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-3, -24, 6, 54);
      // Đầu búa đá khối
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.roundRect(-16, -34, 32, 16, 4);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.strokeRect(-16, -34, 32, 16);
      ctx.restore();
    });

    // Đuốc lửa ban đêm (Night Torch)
    makeWep('weapon_torch', (ctx) => {
      const cx = 48, cy = 48;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-Math.PI / 6);
      // Cán đuốc
      ctx.fillStyle = '#543015';
      ctx.fillRect(-3, -12, 6, 44);
      // Đầu bọc vải bốc cháy
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(-6, -20, 12, 10);
      // Ngọn lửa rực rỡ
      const flameGrad = ctx.createRadialGradient(0, -28, 2, 0, -28, 16);
      flameGrad.addColorStop(0, '#ffffff');
      flameGrad.addColorStop(0.3, '#fde047');
      flameGrad.addColorStop(0.7, '#ea580c');
      flameGrad.addColorStop(1, 'rgba(220, 38, 38, 0)');
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.arc(0, -28, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  /** Bẫy thú (Animal Traps) */
  private createAnimalTrapSprites(): void {
    const makeTrap = (key: string, drawFn: (ctx: CanvasRenderingContext2D) => void) => {
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawFn(ctx);
        this.spriteCache.set(key, canvas);
        this.anchorCache.set(key, { anchorX: 0.5, anchorY: 1.0, width: size, height: size });
      }
    };

    // Bẫy thỏ / Bẫy lồng (Rabbit Cage Trap)
    makeTrap('trap_rabbit', (ctx) => {
      const cx = 32, cy = 44;
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(cx, cy, 14, Math.PI, 0);
      ctx.lineTo(cx + 14, cy);
      ctx.lineTo(cx - 14, cy);
      ctx.stroke();
      // Nan lồng
      for (let x = -10; x <= 10; x += 5) {
        ctx.beginPath();
        ctx.moveTo(cx + x, cy);
        ctx.lineTo(cx + x, cy - Math.sqrt(Math.max(0, 196 - x * x)));
        ctx.stroke();
      }
    });

    // Bẫy kẹp quái thú (Beast Bear Trap)
    makeTrap('trap_beast', (ctx) => {
      const cx = 32, cy = 46;
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 16, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Răng cưa kẹp sắt
      ctx.fillStyle = '#94a3b8';
      for (let i = -12; i <= 12; i += 4) {
        ctx.beginPath();
        ctx.moveTo(cx + i, cy);
        ctx.lineTo(cx + i + 2, cy - 6);
        ctx.lineTo(cx + i + 4, cy);
        ctx.fill();
      }
    });
  }

  /**
   * Tạo 18 Sprite Dã Thú & Khủng Long Tiền Sử HD theo đúng Design Sheet (media_1786933113566.jpg)
   * Tối ưu hóa bộ nhớ đệm, mỗi loài có tạo hình 2.5D độc bản, da có chiều sâu LinearGradient,
   * vảy texture, gai nhọn khối 3D, mắt có catchlight và bóng đổ tiếp xúc mặt đất.
   */
  private createBeastSprites(): void {
    const makeBeast = (key: string, width: number, height: number, drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawFn(ctx, width, height);
        this.spriteCache.set(key, canvas);
        this.anchorCache.set(key, { anchorX: 0.5, anchorY: 0.88, width, height });
      }
    };

    // 1. BẠO CHÚA T-REX (Gargantuan T-Rex — Illustrated 2.5D)
    makeBeast('beast_trex', 160, 140, (ctx, w, h) => {
      const cx = 80, cy = 110;
      // Bóng đổ
      ctx.fillStyle = 'rgba(20, 10, 5, 0.45)';
      ctx.beginPath();
      ctx.ellipse(cx - 5, cy + 8, 48, 16, 0, 0, Math.PI * 2);
      ctx.fill();

      // Đuôi dài cân bằng
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy - 32);
      ctx.quadraticCurveTo(cx - 55, cy - 40, cx - 72, cy - 25);
      ctx.stroke();

      // Chân sau vạm vỡ & Móng vuốt
      const drawLeg = (lx: number, ly: number, isFar: boolean) => {
        ctx.fillStyle = isFar ? '#2d1405' : '#542609';
        // Đùi
        ctx.beginPath();
        ctx.ellipse(lx, ly - 22, 13, 18, 0.2, 0, Math.PI * 2);
        ctx.fill();
        // Cẳng chân & Bàn chân 3 móng
        ctx.fillRect(lx - 4, ly - 10, 8, 16);
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.moveTo(lx - 8, ly + 6); ctx.lineTo(lx - 2, ly + 11); ctx.lineTo(lx - 2, ly + 6);
        ctx.moveTo(lx - 2, ly + 6); ctx.lineTo(lx + 4, ly + 12); ctx.lineTo(lx + 4, ly + 6);
        ctx.moveTo(lx + 4, ly + 6); ctx.lineTo(lx + 9, ly + 10); ctx.lineTo(lx + 7, ly + 6);
        ctx.fill();
      };
      drawLeg(cx - 12, cy, true);
      drawLeg(cx + 8, cy + 2, false);

      // Thân mình T-Rex với Gradient vằn lưng hổ
      const bodyGrad = ctx.createLinearGradient(cx - 20, cy - 55, cx + 25, cy - 10);
      bodyGrad.addColorStop(0, '#381704');
      bodyGrad.addColorStop(0.5, '#78350f');
      bodyGrad.addColorStop(1, '#d97706');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.ellipse(cx + 5, cy - 34, 26, 19, -0.25, 0, Math.PI * 2);
      ctx.fill();

      // Vằn lưng sẫm màu
      ctx.fillStyle = 'rgba(30, 10, 2, 0.55)';
      for (let i = -12; i <= 15; i += 7) {
        ctx.beginPath();
        ctx.moveTo(cx + i, cy - 48);
        ctx.lineTo(cx + i + 4, cy - 35);
        ctx.lineTo(cx + i - 2, cy - 35);
        ctx.closePath();
        ctx.fill();
      }

      // Tay trước nhỏ 2 móng
      ctx.fillStyle = '#542609';
      ctx.beginPath();
      ctx.roundRect(cx + 24, cy - 28, 10, 4.5, 2);
      ctx.fill();

      // Cổ & Đầu bạo chúa gầm thét
      ctx.fillStyle = '#542609';
      ctx.beginPath();
      ctx.moveTo(cx + 18, cy - 42);
      ctx.lineTo(cx + 34, cy - 58);
      ctx.lineTo(cx + 42, cy - 40);
      ctx.lineTo(cx + 25, cy - 26);
      ctx.closePath();
      ctx.fill();

      // Hàm trên
      const headGrad = ctx.createLinearGradient(cx + 30, cy - 65, cx + 65, cy - 45);
      headGrad.addColorStop(0, '#78350f');
      headGrad.addColorStop(1, '#b45309');
      ctx.fillStyle = headGrad;
      ctx.beginPath();
      ctx.roundRect(cx + 28, cy - 64, 38, 16, [6, 12, 2, 4]);
      ctx.fill();

      // Hàm dưới hé mở
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.roundRect(cx + 34, cy - 46, 28, 8, [2, 6, 4, 2]);
      ctx.fill();

      // Răng nanh sắc nhọn màu trắng ngà
      ctx.fillStyle = '#ffffff';
      for (let rx = 36; rx <= 60; rx += 5) {
        ctx.beginPath();
        ctx.moveTo(cx + rx, cy - 48);
        ctx.lineTo(cx + rx + 2.5, cy - 43);
        ctx.lineTo(cx + rx + 5, cy - 48);
        ctx.fill();
      }

      // Mắt hổ phách có Catchlight
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(cx + 40, cy - 57, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(cx + 40, cy - 57, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.fillRect(cx + 39.5, cy - 59, 1.2, 4);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx + 41, cy - 58, 0.9, 0, Math.PI * 2);
      ctx.fill();
    });

    // 2. KHỦNG LONG THIẾT GIÁP (Ankylosaurus — Illustrated 2.5D)
    makeBeast('beast_ankylosaurus', 160, 120, (ctx, w, h) => {
      const cx = 80, cy = 92;
      // Bóng đổ
      ctx.fillStyle = 'rgba(20, 15, 10, 0.45)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 6, 52, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      // 4 Chân ngắn bọc vảy
      ctx.fillStyle = '#382f2d';
      for (const lx of [-28, -10, 14, 32]) {
        ctx.beginPath();
        ctx.roundRect(cx + lx - 6, cy - 8, 12, 18, 3);
        ctx.fill();
        ctx.fillStyle = '#cbd5e1';
        for (let c = -3; c <= 3; c += 3) {
          ctx.beginPath();
          ctx.moveTo(cx + lx + c - 1.5, cy + 8);
          ctx.lineTo(cx + lx + c, cy + 12);
          ctx.lineTo(cx + lx + c + 1.5, cy + 8);
          ctx.fill();
        }
        ctx.fillStyle = '#382f2d';
      }

      // Đuôi & Quả chùy đá gai
      ctx.strokeStyle = '#57534e';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 30, cy - 14);
      ctx.quadraticCurveTo(cx - 50, cy - 10, cx - 65, cy - 12);
      ctx.stroke();

      // Quả chùy 3D ở chóp đuôi
      const clubGrad = ctx.createRadialGradient(cx - 67, cy - 14, 2, cx - 65, cy - 12, 14);
      clubGrad.addColorStop(0, '#f8fafc');
      clubGrad.addColorStop(0.4, '#78716c');
      clubGrad.addColorStop(1, '#1c1917');
      ctx.fillStyle = clubGrad;
      ctx.beginPath();
      ctx.arc(cx - 65, cy - 12, 12, 0, Math.PI * 2);
      ctx.fill();

      // Gai quanh chùy
      ctx.fillStyle = '#e2e8f0';
      for (const ang of [-0.6, 0.6, 2.5, 3.7]) {
        const sx = cx - 65 + Math.cos(ang) * 11;
        const sy = cy - 12 + Math.sin(ang) * 11;
        const tx = cx - 65 + Math.cos(ang) * 19;
        const ty = cy - 12 + Math.sin(ang) * 19;
        ctx.beginPath();
        ctx.moveTo(sx - 3, sy); ctx.lineTo(tx, ty); ctx.lineTo(sx + 3, sy);
        ctx.fill();
      }

      // Mai giáp vòm đá sừng
      const shellGrad = ctx.createRadialGradient(cx + 8, cy - 26, 4, cx, cy - 16, 38);
      shellGrad.addColorStop(0, '#78716c');
      shellGrad.addColorStop(0.6, '#44403c');
      shellGrad.addColorStop(1, '#1c1917');
      ctx.fillStyle = shellGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 18, 36, 24, 0, 0, Math.PI * 2);
      ctx.fill();

      // Các hàng gai khối 3D trên mai
      for (let gx = -24; gx <= 24; gx += 12) {
        for (let gy = -28; gy <= -6; gy += 10) {
          // Gai mặt râm
          ctx.fillStyle = '#1c1917';
          ctx.beginPath();
          ctx.moveTo(cx + gx - 5, cy + gy);
          ctx.lineTo(cx + gx, cy + gy - 9);
          ctx.lineTo(cx + gx + 5, cy + gy);
          ctx.fill();
          // Gai mặt sáng đón nắng
          ctx.fillStyle = '#e2e8f0';
          ctx.beginPath();
          ctx.moveTo(cx + gx, cy + gy - 9);
          ctx.lineTo(cx + gx + 5, cy + gy);
          ctx.lineTo(cx + gx, cy + gy + 3);
          ctx.fill();
        }
      }

      // Đầu bọc giáp giác đấu
      const headX = cx + 38;
      const headY = cy - 16;
      ctx.fillStyle = '#44403c';
      ctx.beginPath();
      ctx.ellipse(headX, headY, 15, 11, 0.1, 0, Math.PI * 2);
      ctx.fill();

      // Sừng gáy & má
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.moveTo(headX - 6, headY - 8); ctx.lineTo(headX - 14, headY - 18); ctx.lineTo(headX + 2, headY - 9);
      ctx.moveTo(headX - 4, headY + 6); ctx.lineTo(headX - 10, headY + 14); ctx.lineTo(headX + 4, headY + 6);
      ctx.fill();

      // Mắt
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(headX + 5, headY - 3, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(headX + 5, headY - 3, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(headX + 5.8, headY - 3.8, 0.9, 0, Math.PI * 2);
      ctx.fill();
    });

    // 3. CỰ MÃNG XÀ (Titanoboa — Illustrated 2.5D Giant Serpent)
    makeBeast('beast_titanoboa', 160, 140, (ctx, w, h) => {
      const cx = 80, cy = 110;
      // Bóng đổ
      ctx.fillStyle = 'rgba(10, 25, 12, 0.45)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 6, 52, 16, 0, 0, Math.PI * 2);
      ctx.fill();

      // Thân trăn uốn lượn liên hoàn
      const spine = [
        { x: cx - 45, y: cy - 5, r: 11 },
        { x: cx - 25, y: cy + 6, r: 14 },
        { x: cx + 5, y: cy + 4, r: 16 },
        { x: cx + 32, y: cy - 2, r: 15 },
        { x: cx + 45, y: cy - 22, r: 13 },
        { x: cx + 22, y: cy - 38, r: 12 },
        { x: cx - 5, y: cy - 42, r: 11 },
        { x: cx - 25, y: cy - 62, r: 10 },
      ];

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 0; i < spine.length - 1; i++) {
        const p0 = spine[i];
        const p1 = spine[i + 1];
        // Viền vảy lưng tối
        ctx.strokeStyle = '#022c22';
        ctx.lineWidth = p0.r * 2.2;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
        ctx.stroke();

        // Thân ngọc bích gradient
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = p0.r * 1.8;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
        ctx.stroke();

        // Vảy kim cương vàng hổ phách
        ctx.fillStyle = '#fef08a';
        const mx = (p0.x + p1.x) / 2;
        const my = (p0.y + p1.y) / 2 - 2;
        ctx.beginPath();
        ctx.moveTo(mx, my - 5); ctx.lineTo(mx + 5, my); ctx.lineTo(mx, my + 5); ctx.lineTo(mx - 5, my);
        ctx.closePath();
        ctx.fill();
      }

      // Đầu trăn hổ mang ngẩng cao
      const headX = cx - 25;
      const headY = cy - 74;

      const headGrad = ctx.createLinearGradient(headX, headY - 14, headX, headY + 12);
      headGrad.addColorStop(0, '#064e3b');
      headGrad.addColorStop(0.7, '#047857');
      headGrad.addColorStop(1, '#022c22');
      ctx.fillStyle = headGrad;
      ctx.beginPath();
      ctx.moveTo(headX, headY - 16);
      ctx.lineTo(headX - 14, headY - 2);
      ctx.lineTo(headX - 10, headY + 14);
      ctx.lineTo(headX + 10, headY + 14);
      ctx.lineTo(headX + 14, headY - 2);
      ctx.closePath();
      ctx.fill();

      // Mắt hổ phách con ngươi thẳng đứng
      for (const side of [-1, 1]) {
        const eyeX = headX + side * 8;
        const eyeY = headY - 4;
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#020617';
        ctx.fillRect(eyeX - 0.9, eyeY - 3, 1.8, 6);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(eyeX + 1.2, eyeY - 1.2, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }

      // Lưỡi chẻ đỏ
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(headX, headY - 16);
      ctx.lineTo(headX, cy - 100);
      ctx.lineTo(headX - 4, cy - 106);
      ctx.moveTo(headX, cy - 100);
      ctx.lineTo(headX + 4, cy - 106);
      ctx.stroke();
    });

    // 4. KHỦNG LONG GAI THUYỀN (Spinosaurus — Illustrated 2.5D)
    makeBeast('beast_spinosaurus', 170, 150, (ctx, w, h) => {
      const cx = 85, cy = 120;
      // Cánh buồm lưng khổng lồ với sọc đỏ hổ phách
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.arc(cx - 5, cy - 42, 38, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3.5;
      for (let a = Math.PI * 0.15; a <= Math.PI * 0.85; a += 0.18) {
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy - 42);
        ctx.lineTo(cx - 5 + Math.cos(Math.PI + a) * 37, cy - 42 + Math.sin(Math.PI + a) * 37);
        ctx.stroke();
      }

      // Thân mình thủy quái đầm lầy
      const spGrad = ctx.createLinearGradient(cx - 30, cy - 60, cx + 30, cy - 10);
      spGrad.addColorStop(0, '#134e4a');
      spGrad.addColorStop(0.6, '#0f766e');
      spGrad.addColorStop(1, '#99f6e4');
      ctx.fillStyle = spGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 35, 34, 18, -0.15, 0, Math.PI * 2);
      ctx.fill();

      // Chân
      ctx.fillStyle = '#115e59';
      ctx.fillRect(cx - 16, cy - 20, 10, 22);
      ctx.fillRect(cx + 12, cy - 20, 10, 22);

      // Đầu cá sấu mõm dài
      ctx.fillStyle = '#0f766e';
      ctx.beginPath();
      ctx.roundRect(cx + 25, cy - 50, 42, 14, [4, 12, 2, 4]);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      for (let i = 28; i <= 62; i += 6) {
        ctx.fillRect(cx + i, cy - 37, 2, 4);
      }
      // Mắt
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(cx + 34, cy - 46, 2.8, 0, Math.PI * 2);
      ctx.fill();
    });

    // 5. TAM GIÁC LONG (Triceratops — Illustrated 2.5D)
    makeBeast('beast_triceratops', 160, 120, (ctx, w, h) => {
      const cx = 80, cy = 92;
      // Thân hình tê giác cổ đại
      const triGrad = ctx.createRadialGradient(cx, cy - 20, 5, cx, cy - 16, 35);
      triGrad.addColorStop(0, '#78716c');
      triGrad.addColorStop(0.7, '#44403c');
      triGrad.addColorStop(1, '#1c1917');
      ctx.fillStyle = triGrad;
      ctx.beginPath();
      ctx.ellipse(cx - 10, cy - 18, 32, 22, -0.1, 0, Math.PI * 2);
      ctx.fill();

      // 4 Chân voi
      ctx.fillStyle = '#292524';
      ctx.fillRect(cx - 32, cy - 12, 12, 22);
      ctx.fillRect(cx - 14, cy - 10, 12, 20);
      ctx.fillRect(cx + 6, cy - 10, 12, 20);
      ctx.fillRect(cx + 22, cy - 12, 12, 22);

      // Yếm sừng xòe rộng (Frill)
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.ellipse(cx + 24, cy - 30, 16, 24, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Đầu & Mõm khoằm
      ctx.fillStyle = '#57534e';
      ctx.beginPath();
      ctx.roundRect(cx + 26, cy - 24, 26, 18, [4, 12, 8, 4]);
      ctx.fill();

      // 2 Sừng mày dài vút cong bằng ngà
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 4.0;
      ctx.beginPath();
      ctx.moveTo(cx + 34, cy - 28); ctx.lineTo(cx + 62, cy - 44);
      ctx.moveTo(cx + 38, cy - 22); ctx.lineTo(cx + 66, cy - 38);
      // Sừng mũi
      ctx.moveTo(cx + 48, cy - 18); ctx.lineTo(cx + 60, cy - 24);
      ctx.stroke();

      // Mắt
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(cx + 36, cy - 22, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 6. KHỦNG LONG CỔ DÀI (Brachiosaurus — Illustrated 2.5D)
    makeBeast('beast_brachiosaurus', 180, 180, (ctx, w, h) => {
      const cx = 90, cy = 150;
      // Thân khổng lồ
      ctx.fillStyle = '#57534e';
      ctx.beginPath();
      ctx.ellipse(cx - 15, cy - 32, 42, 28, -0.15, 0, Math.PI * 2);
      ctx.fill();

      // 4 Chân cột đình
      ctx.fillStyle = '#292524';
      ctx.fillRect(cx - 42, cy - 22, 15, 32);
      ctx.fillRect(cx - 20, cy - 18, 14, 28);
      ctx.fillRect(cx + 6, cy - 22, 16, 32);
      ctx.fillRect(cx + 26, cy - 18, 14, 28);

      // Cổ dài vươn cao ngút ngàn
      ctx.strokeStyle = '#57534e';
      ctx.lineWidth = 16;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + 15, cy - 45);
      ctx.bezierCurveTo(cx + 35, cy - 95, cx + 30, cy - 130, cx + 45, cy - 155);
      ctx.stroke();

      // Đầu nhỏ trên đỉnh cổ
      ctx.fillStyle = '#78716c';
      ctx.beginPath();
      ctx.ellipse(cx + 48, cy - 158, 10, 6, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(cx + 52, cy - 159, 1.8, 0, Math.PI * 2);
      ctx.fill();
    });

    // 7. KHỦNG LONG SONG MÀO (Dilophosaurus — Illustrated 2.5D)
    makeBeast('beast_dilophosaurus', 140, 120, (ctx, w, h) => {
      const cx = 70, cy = 95;
      // Thân săn mồi nhanh nhẹn
      const dGrad = ctx.createLinearGradient(cx - 20, cy - 35, cx + 20, cy - 10);
      dGrad.addColorStop(0, '#15803d');
      dGrad.addColorStop(0.7, '#84cc16');
      dGrad.addColorStop(1, '#fef08a');
      ctx.fillStyle = dGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 26, 22, 12, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // 2 Chân chạy
      ctx.fillStyle = '#166534';
      ctx.fillRect(cx - 10, cy - 16, 6, 20);
      ctx.fillRect(cx + 4, cy - 16, 6, 20);

      // Đầu & Mào đôi đỏ rực
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.roundRect(cx + 18, cy - 42, 22, 10, 3);
      ctx.fill();

      // 2 Mào bán nguyệt
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(cx + 26, cy - 46, 7, Math.PI, 0);
      ctx.arc(cx + 34, cy - 46, 6, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Mắt
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(cx + 28, cy - 38, 2.2, 0, Math.PI * 2);
      ctx.fill();
    });

    // 8. KHỦNG LONG SĂN MỒI NHANH (Velociraptor — Illustrated 2.5D)
    makeBeast('beast_velociraptor', 130, 110, (ctx, w, h) => {
      const cx = 65, cy = 88;
      // Thân lông vũ cam hổ
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 24, 20, 11, -0.25, 0, Math.PI * 2);
      ctx.fill();
      // Đuôi thẳng cân bằng
      ctx.strokeStyle = '#c2410c';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy - 24); ctx.lineTo(cx - 48, cy - 30);
      ctx.stroke();
      // Chân với móng vuốt liềm cong vút
      ctx.fillStyle = '#9a3412';
      ctx.fillRect(cx - 4, cy - 14, 6, 18);
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx + 2, cy + 2); ctx.quadraticCurveTo(cx + 10, cy - 2, cx + 8, cy + 6);
      ctx.stroke();
      // Đầu
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.roundRect(cx + 14, cy - 38, 20, 9, 3);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(cx + 22, cy - 34, 2.0, 0, Math.PI * 2);
      ctx.fill();
    });

    // 9. VOI MA MÚT (Mammoth — Illustrated 2.5D)
    makeBeast('beast_mammoth', 160, 140, (ctx, w, h) => {
      const cx = 80, cy = 110;
      // Lông dày shaggy
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.ellipse(cx - 8, cy - 32, 36, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      // Chân
      ctx.fillStyle = '#290e02';
      ctx.fillRect(cx - 36, cy - 16, 14, 26);
      ctx.fillRect(cx - 16, cy - 12, 14, 22);
      ctx.fillRect(cx + 4, cy - 16, 14, 26);
      ctx.fillRect(cx + 22, cy - 12, 14, 22);
      // Vòi voi uốn cong
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + 28, cy - 35);
      ctx.quadraticCurveTo(cx + 48, cy - 20, cx + 42, cy + 4);
      ctx.stroke();
      // Cặp ngà voi xoắn ốc khổng lồ bằng ngà
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(cx + 26, cy - 28);
      ctx.bezierCurveTo(cx + 56, cy - 30, cx + 62, cy - 5, cx + 46, cy - 45);
      ctx.stroke();
      // Mắt
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(cx + 24, cy - 42, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 10. CỌP RĂNG KIẾM (Saber-toothed Tiger — Illustrated 2.5D)
    makeBeast('beast_sabertooth', 140, 110, (ctx, w, h) => {
      const cx = 70, cy = 85;
      // Thân cơ bắp vằn hổ
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.ellipse(cx - 6, cy - 22, 28, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      // Vằn đen
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 2.0;
      for (let i = -20; i <= 10; i += 6) {
        ctx.beginPath();
        ctx.moveTo(cx + i, cy - 34); ctx.lineTo(cx + i + 2, cy - 20);
        ctx.stroke();
      }
      // Chân
      ctx.fillStyle = '#b45309';
      ctx.fillRect(cx - 26, cy - 12, 8, 18);
      ctx.fillRect(cx - 10, cy - 8, 8, 14);
      ctx.fillRect(cx + 6, cy - 12, 8, 18);
      ctx.fillRect(cx + 20, cy - 8, 8, 14);
      // Đầu
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.arc(cx + 26, cy - 26, 12, 0, Math.PI * 2);
      ctx.fill();
      // Cặp nanh kiếm cong dài trắng ngà
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(cx + 28, cy - 22); ctx.lineTo(cx + 31, cy - 8); ctx.lineTo(cx + 33, cy - 22);
      ctx.moveTo(cx + 33, cy - 22); ctx.lineTo(cx + 36, cy - 8); ctx.lineTo(cx + 38, cy - 22);
      ctx.fill();
      // Mắt
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(cx + 29, cy - 28, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 11. SÓI HOANG (Dire Wolf — Illustrated 2.5D)
    makeBeast('beast_wolf', 120, 95, (ctx, w, h) => {
      const cx = 60, cy = 72;
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.ellipse(cx - 4, cy - 18, 22, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#334155';
      ctx.fillRect(cx - 18, cy - 8, 6, 14);
      ctx.fillRect(cx - 6, cy - 6, 6, 12);
      ctx.fillRect(cx + 6, cy - 8, 6, 14);
      ctx.fillRect(cx + 16, cy - 6, 6, 12);
      // Đầu sói & Tai nhọn
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(cx + 20, cy - 22, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + 16, cy - 28); ctx.lineTo(cx + 18, cy - 36); ctx.lineTo(cx + 23, cy - 28);
      ctx.fill();
      // Mắt hổ phách
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(cx + 23, cy - 23, 2.0, 0, Math.PI * 2);
      ctx.fill();
    });

    // 12. GẤU HANG (Cave Bear — Illustrated 2.5D)
    makeBeast('beast_bear', 140, 110, (ctx, w, h) => {
      const cx = 70, cy = 88;
      ctx.fillStyle = '#29180c';
      ctx.beginPath();
      ctx.ellipse(cx - 6, cy - 24, 30, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1c0f06';
      ctx.fillRect(cx - 28, cy - 10, 11, 18);
      ctx.fillRect(cx - 10, cy - 8, 10, 16);
      ctx.fillRect(cx + 8, cy - 10, 11, 18);
      ctx.fillRect(cx + 22, cy - 8, 10, 16);
      // Đầu
      ctx.fillStyle = '#29180c';
      ctx.beginPath();
      ctx.arc(cx + 26, cy - 26, 13, 0, Math.PI * 2);
      ctx.fill();
      // Mắt
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(cx + 29, cy - 28, 2.2, 0, Math.PI * 2);
      ctx.fill();
    });

    // 13. HEO RỪNG KHỔNG LỒ (Giant Boar — Illustrated 2.5D)
    makeBeast('beast_boar', 130, 95, (ctx, w, h) => {
      const cx = 65, cy = 75;
      ctx.fillStyle = '#3e2723';
      ctx.beginPath();
      ctx.ellipse(cx - 6, cy - 18, 24, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#271612';
      ctx.fillRect(cx - 20, cy - 6, 7, 12);
      ctx.fillRect(cx + 12, cy - 6, 7, 12);
      // Đầu & Mõm
      ctx.fillStyle = '#3e2723';
      ctx.beginPath();
      ctx.roundRect(cx + 12, cy - 24, 18, 14, 3);
      ctx.fill();
      // Nanh heo cong lên
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx + 22, cy - 12); ctx.quadraticCurveTo(cx + 26, cy - 20, cx + 22, cy - 24);
      ctx.stroke();
    });

    // 14. CÁ SẤU KHỔNG LỒ (Sarcosuchus — Illustrated 2.5D)
    makeBeast('beast_sarcosuchus', 170, 90, (ctx, w, h) => {
      const cx = 85, cy = 68;
      // Thân dài bọc vảy gai
      ctx.fillStyle = '#14532d';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 12, 45, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      // Mõm dài đầy răng
      ctx.fillStyle = '#166534';
      ctx.beginPath();
      ctx.roundRect(cx + 35, cy - 16, 38, 8, [2, 6, 2, 2]);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      for (let x = 38; x <= 68; x += 5) {
        ctx.fillRect(cx + x, cy - 18, 2, 3);
      }
      // Mắt
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(cx + 38, cy - 18, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 15. THỦY LONG PLESION (Plesiosaur — Illustrated 2.5D)
    makeBeast('beast_plesiosaur', 160, 130, (ctx, w, h) => {
      const cx = 80, cy = 100;
      // Vòng gợn nước
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 4, 46, 14, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Thân ngọc bích biển
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.ellipse(cx - 8, cy - 14, 30, 16, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cổ dài vươn lên
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + 12, cy - 18);
      ctx.quadraticCurveTo(cx + 38, cy - 45, cx + 32, cy - 72);
      ctx.stroke();

      // Đầu nhỏ
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.ellipse(cx + 34, cy - 74, 8, 5, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(cx + 36, cy - 75, 1.8, 0, Math.PI * 2);
      ctx.fill();
    });

    // 16. DỰC LONG BAY (Pterosaur — Illustrated 2.5D)
    makeBeast('beast_pterosaur', 140, 100, (ctx, w, h) => {
      const cx = 70, cy = 60;
      // Đôi cánh da dơi sải rộng
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(cx - 35, cy - 35, cx - 60, cy - 20);
      ctx.lineTo(cx - 30, cy + 5);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + 30, cy + 5);
      ctx.lineTo(cx + 60, cy - 20);
      ctx.quadraticCurveTo(cx + 35, cy - 35, cx, cy);
      ctx.fill();
      // Mỏ dài & Mào sau gáy
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy - 10); ctx.lineTo(cx + 25, cy - 6); ctx.lineTo(cx - 6, cy - 2);
      ctx.fill();
    });

    // 17. SƯ TỬ HANG (Cave Lion — Illustrated 2.5D)
    makeBeast('beast_cavelion', 140, 105, (ctx, w, h) => {
      const cx = 70, cy = 82;
      ctx.fillStyle = '#ca8a04';
      ctx.beginPath();
      ctx.ellipse(cx - 6, cy - 20, 26, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a16207';
      ctx.fillRect(cx - 24, cy - 10, 8, 16);
      ctx.fillRect(cx + 14, cy - 10, 8, 16);
      ctx.beginPath();
      ctx.arc(cx + 22, cy - 24, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(cx + 25, cy - 26, 2.2, 0, Math.PI * 2);
      ctx.fill();
    });

    // 18. ĐÀN HƯƠU & NGỰA HOANG (Deer / Horse — Illustrated 2.5D)
    makeBeast('beast_deer', 120, 110, (ctx, w, h) => {
      const cx = 60, cy = 88;
      ctx.fillStyle = '#a16207';
      ctx.beginPath();
      ctx.ellipse(cx - 6, cy - 24, 18, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#78350f';
      ctx.fillRect(cx - 16, cy - 14, 5, 20);
      ctx.fillRect(cx + 8, cy - 14, 5, 20);
      // Gạc hươu nhiều nhánh
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(cx + 12, cy - 35); ctx.lineTo(cx + 16, cy - 54);
      ctx.moveTo(cx + 14, cy - 45); ctx.lineTo(cx + 8, cy - 50);
      ctx.moveTo(cx + 15, cy - 48); ctx.lineTo(cx + 22, cy - 52);
      ctx.stroke();
    });

    makeBeast('beast_horse', 130, 110, (ctx, w, h) => {
      const cx = 65, cy = 88;
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.ellipse(cx - 6, cy - 24, 22, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#78350f';
      ctx.fillRect(cx - 18, cy - 12, 6, 20);
      ctx.fillRect(cx + 10, cy - 12, 6, 20);
      // Bờm đen
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(cx + 6, cy - 44, 5, 18);
    });
  }

  /**
   * Tự động nạp và bóc tách các Sprite trực tiếp từ hình ảnh Design Sheet của người dùng (media_1786933113566.jpg)
   * Tách nền giấy da thành Transparent Alpha với viền chống răng cưa (Anti-aliased Feathering)
   */
  public loadDesignSheetAtlas(url: string = '/apps/game/assets/design_sheet.jpg'): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof Image === 'undefined') {
        resolve(false);
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const sheetCanvas = document.createElement('canvas');
        sheetCanvas.width = img.naturalWidth;
        sheetCanvas.height = img.naturalHeight;
        const sheetCtx = sheetCanvas.getContext('2d');
        if (!sheetCtx) {
          resolve(false);
          return;
        }
        sheetCtx.drawImage(img, 0, 0);

        const atlas: Record<string, { x: number; y: number; w: number; h: number; ax: number; ay: number }> = {
          // 1. NHÂN VẬT & VŨ KHÍ & LINH THÚ (Top Band)
          player_male: { x: 26, y: 62, w: 106, h: 102, ax: 0.5, ay: 0.95 },
          player_female: { x: 245, y: 62, w: 78, h: 102, ax: 0.5, ay: 0.95 },
          weapon_spear: { x: 440, y: 74, w: 155, h: 16, ax: 0.5, ay: 0.5 },
          weapon_hammer: { x: 608, y: 56, w: 55, h: 42, ax: 0.5, ay: 0.5 },
          weapon_torch: { x: 700, y: 54, w: 48, h: 45, ax: 0.5, ay: 0.85 },
          pet_sabertooth: { x: 788, y: 58, w: 68, h: 40, ax: 0.5, ay: 0.9 },
          pet_bird: { x: 885, y: 42, w: 72, h: 48, ax: 0.5, ay: 0.5 },

          // 2. KHỦNG LONG (Hàng 1)
          beast_trex: { x: 26, y: 198, w: 90, h: 43, ax: 0.5, ay: 0.90 },
          beast_spinosaurus: { x: 126, y: 198, w: 90, h: 43, ax: 0.5, ay: 0.90 },
          beast_dilophosaurus: { x: 226, y: 198, w: 80, h: 43, ax: 0.5, ay: 0.90 },
          beast_triceratops: { x: 314, y: 198, w: 82, h: 43, ax: 0.5, ay: 0.90 },
          beast_ankylosaurus: { x: 404, y: 198, w: 76, h: 43, ax: 0.5, ay: 0.90 },

          // 2. KHỦNG LONG (Hàng 2)
          beast_brachiosaurus: { x: 26, y: 265, w: 96, h: 40, ax: 0.5, ay: 0.90 },
          beast_plesiosaur: { x: 130, y: 265, w: 92, h: 40, ax: 0.5, ay: 0.75 },
          beast_velociraptor: { x: 316, y: 265, w: 80, h: 40, ax: 0.5, ay: 0.90 },
          beast_pterosaur: { x: 406, y: 270, w: 50, h: 32, ax: 0.5, ay: 0.5 },

          // 3. DÃ THÚ TIỀN SỬ (Cột phải)
          beast_titanoboa: { x: 498, y: 145, w: 70, h: 50, ax: 0.5, ay: 0.90 },
          beast_sarcosuchus: { x: 588, y: 148, w: 128, h: 46, ax: 0.5, ay: 0.90 },
          beast_cavelion: { x: 732, y: 152, w: 60, h: 45, ax: 0.5, ay: 0.90 },
          beast_mammoth: { x: 808, y: 145, w: 66, h: 50, ax: 0.5, ay: 0.90 },
          beast_wolf: { x: 888, y: 145, w: 66, h: 50, ax: 0.5, ay: 0.90 },

          beast_sabertooth_pack: { x: 498, y: 222, w: 74, h: 44, ax: 0.5, ay: 0.90 },
          beast_sabertooth: { x: 582, y: 222, w: 66, h: 44, ax: 0.5, ay: 0.90 },
          beast_bear: { x: 658, y: 222, w: 60, h: 44, ax: 0.5, ay: 0.90 },
          beast_boar: { x: 730, y: 222, w: 60, h: 44, ax: 0.5, ay: 0.90 },
          beast_deer: { x: 802, y: 222, w: 70, h: 44, ax: 0.5, ay: 0.90 },
          beast_horse: { x: 882, y: 222, w: 70, h: 44, ax: 0.5, ay: 0.90 },

          // 4. CÔNG TRÌNH (Structures)
          struct_campfire: { x: 38, y: 350, w: 58, h: 58, ax: 0.5, ay: 0.85 },
          struct_fence: { x: 100, y: 358, w: 68, h: 48, ax: 0.5, ay: 0.85 },
          struct_watchtower: { x: 175, y: 348, w: 45, h: 58, ax: 0.5, ay: 0.85 },
          struct_farm_plots: { x: 225, y: 358, w: 72, h: 48, ax: 0.5, ay: 0.85 },
          struct_fish_trap: { x: 302, y: 362, w: 55, h: 44, ax: 0.5, ay: 0.85 },

          // 5. VẬT PHẨM RƠI (World Drops)
          drop_stick: { x: 368, y: 365, w: 40, h: 40, ax: 0.5, ay: 0.85 },
          drop_flint: { x: 412, y: 365, w: 40, h: 40, ax: 0.5, ay: 0.85 },
          drop_herb: { x: 455, y: 365, w: 38, h: 40, ax: 0.5, ay: 0.85 },
          drop_berry: { x: 498, y: 365, w: 35, h: 40, ax: 0.5, ay: 0.85 },
          drop_meat: { x: 535, y: 365, w: 38, h: 40, ax: 0.5, ay: 0.85 },
          drop_fish: { x: 575, y: 365, w: 40, h: 40, ax: 0.5, ay: 0.85 },

          // 6. TÀI NGUYÊN TỰ NHIÊN
          res_megastones: { x: 622, y: 355, w: 60, h: 48, ax: 0.5, ay: 0.85 },
          res_dino_fossil: { x: 688, y: 355, w: 60, h: 48, ax: 0.5, ay: 0.85 },
          res_forest_grove: { x: 752, y: 348, w: 65, h: 55, ax: 0.5, ay: 0.85 },
          res_berry_bush: { x: 822, y: 355, w: 45, h: 48, ax: 0.5, ay: 0.85 },
          res_grass_tufts: { x: 872, y: 355, w: 50, h: 48, ax: 0.5, ay: 0.85 },
          res_river_pebble: { x: 926, y: 362, w: 45, h: 38, ax: 0.5, ay: 0.85 },

          // 7. HUD & VFX
          vfx_aiming_indicator: { x: 608, y: 460, w: 48, h: 48, ax: 0.5, ay: 0.5 },
          vfx_aggro_shield: { x: 668, y: 462, w: 65, h: 35, ax: 0.5, ay: 0.5 },
          hud_compass_rose: { x: 898, y: 435, w: 62, h: 62, ax: 0.5, ay: 0.5 },
        };

        for (const [key, reg] of Object.entries(atlas)) {
          const spriteCanvas = document.createElement('canvas');
          spriteCanvas.width = reg.w;
          spriteCanvas.height = reg.h;
          const sctx = spriteCanvas.getContext('2d');
          if (!sctx) continue;

          sctx.drawImage(sheetCanvas, reg.x, reg.y, reg.w, reg.h, 0, 0, reg.w, reg.h);
          const imgData = sctx.getImageData(0, 0, reg.w, reg.h);
          const data = imgData.data;

          // Transparentize parchment background around entity
          const cornerR = (data[0] + data[(reg.w - 1) * 4] + data[(reg.h - 1) * reg.w * 4] + data[(reg.h * reg.w - 1) * 4]) / 4;
          const cornerG = (data[1] + data[(reg.w - 1) * 4 + 1] + data[(reg.h - 1) * reg.w * 4 + 1] + data[(reg.h * reg.w - 1) * 4 + 1]) / 4;
          const cornerB = (data[2] + data[(reg.w - 1) * 4 + 2] + data[(reg.h - 1) * reg.w * 4 + 2] + data[(reg.h * reg.w - 1) * 4 + 2]) / 4;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const dist = Math.hypot(r - cornerR, g - cornerG, b - cornerB);
            if (dist < 42 || (r > 205 && g > 185 && b > 160 && Math.abs(r - g) < 35 && Math.abs(g - b) < 35)) {
              data[i + 3] = 0;
            } else if (dist < 56) {
              data[i + 3] = Math.round(((dist - 42) / 14) * 255);
            }
          }
          sctx.putImageData(imgData, 0, 0);

          this.spriteCache.set(key, spriteCanvas);
          this.anchorCache.set(key, { anchorX: reg.ax, anchorY: reg.ay, width: reg.w, height: reg.h });
        }

        resolve(true);
      };
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  /**
   * Tự động nạp bảng Sprite Sheet Catalog nhân vật & sinh vật (character_catalog_sheet.jpg)
   * Tạo Canvas đệm trong suốt chất lượng cao
   */
  public loadCharacterCatalogSheet(url: string = '/apps/game/assets/character_catalog_sheet.jpg'): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof Image === 'undefined') {
        resolve(false);
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const sheetCanvas = document.createElement('canvas');
        sheetCanvas.width = img.naturalWidth;
        sheetCanvas.height = img.naturalHeight;
        const sctx = sheetCanvas.getContext('2d');
        if (sctx) {
          sctx.drawImage(img, 0, 0);

          // BÓC TÁCH NỀN GIẤY DA / NỀN TRẮNG THÀNH TRANSPARENT ALPHA
          const imgData = sctx.getImageData(0, 0, sheetCanvas.width, sheetCanvas.height);
          const data = imgData.data;
          const len = data.length;

          for (let i = 0; i < len; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            const minVal = Math.min(r, g, b);
            const maxVal = Math.max(r, g, b);
            const diff = maxVal - minVal;
            const lum = (r * 0.299 + g * 0.587 + b * 0.114);

            // Nhận diện nền giấy da / trắng / xám nhạt:
            // 1. Vùng trắng sáng hoặc xám nhạt
            const isWhite = minVal > 215;
            // 2. Vùng giấy da ấm sáng
            const isBrightParchment = lum > 190 && diff < 52 && r >= g && g >= b * 0.72;
            // 3. Vùng nền da trung tính
            const isMediumParchment = lum > 170 && diff < 36 && r >= g && g >= b * 0.78;

            if (isWhite || isBrightParchment || isMediumParchment) {
              if (lum > 208 || isWhite || (isBrightParchment && lum > 195)) {
                data[i + 3] = 0; // Trong suốt 100%
              } else {
                // Khử răng cưa viền nhân vật mượt mà
                const factor = Math.max(0, Math.min(1, (208 - lum) / 38));
                data[i + 3] = Math.round(factor * 255);
              }
            }
          }

          sctx.putImageData(imgData, 0, 0);

          this.catalogImage = sheetCanvas;
          this.spriteCache.set('character_catalog_sheet', sheetCanvas);
          this.anchorCache.set('character_catalog_sheet', {
            anchorX: 0.5,
            anchorY: 1.0,
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
        } else {
          this.catalogImage = img;
          this.spriteCache.set('character_catalog_sheet', img);
        }
        resolve(true);
      };
      img.onerror = () => {
        // Fallback sang design_sheet.jpg nếu có
        if (url !== '/apps/game/assets/design_sheet.jpg') {
          this.loadCharacterCatalogSheet('/apps/game/assets/design_sheet.jpg').then(resolve);
        } else {
          resolve(false);
        }
      };
      img.src = url;
    });
  }
}

