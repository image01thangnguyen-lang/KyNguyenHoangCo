/**
 * proceduralCatalogAtlas.ts
 * Bộ Sinh Hoạt Họa Thủ Công HD Cao Cấp (Procedural 6-Frame Animated Sprite Atlas)
 *
 * Vẽ trực tiếp 6 khung hình độc bản (0: IDLE, 1: WALK 1, 2: WALK 2, 3: WALK 3, 4: ATTACK 1, 5: ATTACK 2)
 * Phong cách đồ họa Chiến Binh Hoang Cổ 2.5D:
 * - Cơ bắp cuồn cuộn, vai nở ngực rộng, cơ bụng 6 múi có đổ bóng khối 3D.
 * - Khuôn mặt anh hùng có hồn: mắt sáng catchlight, chân mày rậm, sơn chiến tranh war-paint đỏ.
 * - Tóc bờm hoang dã bay bổng, băng trán lông vũ đại bàng.
 * - Giáp vai da thú, khố da hổ viền lông, đại giáo đá thạch anh sắc bén không che thân mình.
 * - 100% Khử răng cưa, viền trong suốt tuyệt đối (Transparent Alpha).
 */

import { EntityCatalogId } from './entityCatalog.ts';

export class ProceduralCatalogAtlas {
  private static instance: ProceduralCatalogAtlas | null = null;
  private canvasCache: Map<string, HTMLCanvasElement> = new Map();

  public static getInstance(): ProceduralCatalogAtlas {
    if (!ProceduralCatalogAtlas.instance) {
      ProceduralCatalogAtlas.instance = new ProceduralCatalogAtlas();
    }
    return ProceduralCatalogAtlas.instance;
  }

  private constructor() {
    this.generateAllStrips();
  }

  public getStrip(id: string): HTMLCanvasElement | undefined {
    return this.canvasCache.get(id);
  }

  /** Tạo dải 6 khung hình (6 columns x 1 row) cho 1 thực thể */
  private createStripCanvas(
    id: string,
    frameW: number,
    frameH: number,
    drawFrameFn: (ctx: CanvasRenderingContext2D, frame: number, fw: number, fh: number) => void,
  ): HTMLCanvasElement {
    const totalW = frameW * 6;
    const totalH = frameH;

    let canvas: HTMLCanvasElement;
    if (typeof document !== 'undefined') {
      canvas = document.createElement('canvas');
    } else {
      canvas = { width: totalW, height: totalH } as any;
      this.canvasCache.set(id, canvas);
      return canvas;
    }

    canvas.width = totalW;
    canvas.height = totalH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    for (let f = 0; f < 6; f++) {
      ctx.save();
      ctx.translate(f * frameW, 0);
      drawFrameFn(ctx, f, frameW, frameH);
      ctx.restore();
    }

    this.canvasCache.set(id, canvas);
    return canvas;
  }

  /**
   * Khởi tạo toàn bộ 20+ dải Sprite 6 khung hình HD sống động
   */
  private generateAllStrips(): void {
    this.generateMaleHero();
    this.generateFemaleHero();
    this.generateSabertoothPet();
    this.generateExpeditionBird();
    this.generateTRex();
    this.generateSpinosaurus();
    this.generateDilophosaurus();
    this.generateTriceratops();
    this.generateAnkylosaurus();
    this.generateTitanoboa();
    this.generateSarcosuchus();
    this.generateMammoth();
    this.generateWolfPack();
    this.generateBrachiosaurus();
    this.generatePlesiosaur();
    this.generateVelociraptor();
    this.generatePterosaur();
    this.generateGiantBoar();
    this.generateDeerHerd();
    this.generateWildHorse();
  }

  // =========================================================================
  // 1. DŨNG SĨ HOANG CỔ (NAM) - Male Hero (Vai u thịt bắp, cơ bắp 3D, mắt sáng)
  // =========================================================================
  private generateMaleHero(): void {
    this.createStripCanvas(EntityCatalogId.HERO_MALE, 130, 130, (ctx, f, fw, fh) => {
      const cx = 65, cy = 114;

      const walkBob = f >= 1 && f <= 3 ? Math.sin(f * 2.1) * 3.5 : (f === 4 ? 4 : (f === 5 ? 2 : 0));
      const legStride = f === 1 ? 16 : (f === 2 ? -3 : (f === 3 ? -16 : (f === 4 ? -10 : (f === 5 ? 20 : 0))));
      const spearAngle = f === 0 ? 0.35 : (f === 1 ? 0.20 : (f === 3 ? 0.50 : (f === 4 ? -0.45 : (f === 5 ? 0.85 : 0.35))));
      const thrustX = f === 5 ? 26 : (f === 4 ? -12 : 0);
      const thrustY = f === 5 ? -6 : (f === 4 ? 4 : 0);

      ctx.save();
      ctx.translate(0, -walkBob);

      // --- 1. TÓC BỜM DÀI PHÍA SAU LƯNG (Back Hair Mane) ---
      ctx.fillStyle = '#09090b';
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy - 86);
      ctx.quadraticCurveTo(cx - 32 - (f === 5 ? 14 : 0), cy - 65, cx - 24 - (f === 5 ? 10 : 0), cy - 40);
      ctx.quadraticCurveTo(cx - 14, cy - 50, cx - 4, cy - 66);
      ctx.fill();

      // Lọn tóc sau bên phải
      ctx.beginPath();
      ctx.moveTo(cx + 8, cy - 86);
      ctx.quadraticCurveTo(cx + 24 + (f === 5 ? 10 : 0), cy - 65, cx + 18, cy - 42);
      ctx.quadraticCurveTo(cx + 10, cy - 50, cx + 2, cy - 66);
      ctx.fill();

      // --- 2. ĐÔI CHÂN CƠ BẮP VẠM VỠ & ỦNG DA GẤU (Muscular Legs & Fur Boots) ---
      // A. Chân sau (Trái)
      const legBackX = cx - 18 - legStride * 0.7;
      const legBackGrad = ctx.createLinearGradient(legBackX, cy - 36, legBackX + 16, cy);
      legBackGrad.addColorStop(0, '#9a3412');
      legBackGrad.addColorStop(1, '#431407');
      ctx.fillStyle = legBackGrad;
      // Đùi cơ bắp
      ctx.beginPath();
      ctx.ellipse(legBackX + 6, cy - 26, 8, 14, -0.15, 0, Math.PI * 2);
      ctx.fill();
      // Bắp chuối & Ống chân
      ctx.beginPath();
      ctx.roundRect(legBackX + 1, cy - 20, 11, 20, [3, 3, 4, 4]);
      ctx.fill();
      // Quấn dây xà cạp da thú
      ctx.strokeStyle = '#292524';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(legBackX + 1, cy - 16); ctx.lineTo(legBackX + 12, cy - 11);
      ctx.moveTo(legBackX + 1, cy - 9); ctx.lineTo(legBackX + 12, cy - 4);
      ctx.stroke();
      // Ủng da bám đất
      ctx.fillStyle = '#291811';
      ctx.beginPath();
      ctx.roundRect(legBackX - 1, cy - 4, 15, 5, 2);
      ctx.fill();

      // B. Chân trước (Phải - Trọng tâm)
      const legFrontX = cx + 6 + legStride;
      const legFrontGrad = ctx.createLinearGradient(legFrontX, cy - 36, legFrontX + 18, cy);
      legFrontGrad.addColorStop(0, '#ea580c');
      legFrontGrad.addColorStop(0.6, '#c2410c');
      legFrontGrad.addColorStop(1, '#7c2d12');
      ctx.fillStyle = legFrontGrad;
      // Đùi trước săn chắc
      ctx.beginPath();
      ctx.ellipse(legFrontX + 7, cy - 26, 9.5, 15, 0.15, 0, Math.PI * 2);
      ctx.fill();
      // Bắp chuối săn chắc
      ctx.beginPath();
      ctx.roundRect(legFrontX + 2, cy - 20, 13, 20, [4, 4, 4, 4]);
      ctx.fill();
      // Quấn dây xà cạp trước
      ctx.strokeStyle = '#292524';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(legFrontX + 2, cy - 16); ctx.lineTo(legFrontX + 15, cy - 11);
      ctx.moveTo(legFrontX + 2, cy - 9); ctx.lineTo(legFrontX + 15, cy - 4);
      ctx.stroke();
      // Ủng da trước bám đất
      ctx.fillStyle = '#291811';
      ctx.beginPath();
      ctx.roundRect(legFrontX + 1, cy - 4, 17, 5, 2);
      ctx.fill();

      // --- 3. KHỐ DA HỔ BỘ LẠC & THẮT LƯNG VUỐT THÚ (Tribal Tiger Fur Kilt) ---
      // Khố da hổ
      const kiltGrad = ctx.createLinearGradient(cx - 24, cy - 46, cx + 24, cy - 18);
      kiltGrad.addColorStop(0, '#f59e0b');
      kiltGrad.addColorStop(0.5, '#d97706');
      kiltGrad.addColorStop(1, '#92400e');
      ctx.fillStyle = kiltGrad;
      ctx.beginPath();
      ctx.moveTo(cx - 22, cy - 42);
      ctx.lineTo(cx + 22, cy - 42);
      ctx.lineTo(cx + 16 + legStride * 0.25, cy - 16);
      ctx.lineTo(cx - 16 + legStride * 0.25, cy - 16);
      ctx.closePath();
      ctx.fill();

      // Viền lông thú trắng kem dày dặn
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.roundRect(cx - 18 + legStride * 0.25, cy - 18, 36, 5.5, 3);
      ctx.fill();

      // Vằn hổ đen hình móng vuốt
      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy - 40); ctx.lineTo(cx - 7, cy - 28); ctx.lineTo(cx - 14, cy - 28);
      ctx.moveTo(cx + 6, cy - 40); ctx.lineTo(cx + 12, cy - 27); ctx.lineTo(cx + 5, cy - 27);
      ctx.moveTo(cx - 3, cy - 40); ctx.lineTo(cx + 2, cy - 30); ctx.lineTo(cx - 4, cy - 30);
      ctx.fill();

      // Thắt lưng da bò rừng to bản & Khóa ngọc/nanh thú
      ctx.fillStyle = '#292524';
      ctx.beginPath();
      ctx.roundRect(cx - 23, cy - 47, 46, 7, 2);
      ctx.fill();
      // Khóa nanh hổ hóa thạch
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy - 44); ctx.lineTo(cx + 5, cy - 44); ctx.lineTo(cx, cy - 34);
      ctx.closePath();
      ctx.fill();

      // --- 4. THÂN MÌNH VẠM VỠ 3D: CƠ NGỰC ĐÔI & 6 MÚI BỤNG (Heroic Torso Musculature) ---
      const bodyGrad = ctx.createLinearGradient(cx - 24, cy - 76, cx + 24, cy - 44);
      bodyGrad.addColorStop(0, '#f97316');
      bodyGrad.addColorStop(0.3, '#ea580c');
      bodyGrad.addColorStop(0.7, '#c2410c');
      bodyGrad.addColorStop(1, '#7c2d12');
      ctx.fillStyle = bodyGrad;

      // Khối cơ thân chữ V rộng
      ctx.beginPath();
      ctx.moveTo(cx - 24, cy - 72);
      ctx.lineTo(cx + 24, cy - 72);
      ctx.lineTo(cx + 16, cy - 45);
      ctx.lineTo(cx - 16, cy - 45);
      ctx.closePath();
      ctx.fill();

      // Cơ vai vạm vỡ bên phải (Deltoid Right)
      ctx.beginPath();
      ctx.ellipse(cx + 24, cy - 68, 8.5, 8.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Giáp vai da thú lông hổ bên vai trái (Left Shoulder Pauldron)
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.arc(cx - 24, cy - 68, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(cx - 32, cy - 62, 16, 4);

      // Đổ bóng 3D: Cơ ngực đôi & Múi bụng & Cơ liên sườn
      ctx.strokeStyle = 'rgba(67, 20, 7, 0.65)';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      // Ngực trái & phải
      ctx.arc(cx - 8, cy - 63, 8.5, 0.1, Math.PI * 0.95);
      ctx.arc(cx + 8, cy - 63, 8.5, 0.1, Math.PI * 0.95);
      // Rãnh giữa ngực & Rãnh bụng 6 múi
      ctx.moveTo(cx, cy - 63); ctx.lineTo(cx, cy - 46);
      ctx.moveTo(cx - 7, cy - 56); ctx.lineTo(cx + 7, cy - 56);
      ctx.moveTo(cx - 6.5, cy - 50); ctx.lineTo(cx + 6.5, cy - 50);
      ctx.stroke();

      // Vùng sáng cơ bắp (Highlights)
      ctx.fillStyle = 'rgba(254, 215, 170, 0.25)';
      ctx.beginPath();
      ctx.ellipse(cx - 8, cy - 66, 6, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 8, cy - 66, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dây đeo chéo ngực đính chuỗi nanh vuốt
      ctx.strokeStyle = '#292524';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(cx - 24, cy - 72); ctx.lineTo(cx + 14, cy - 45);
      ctx.stroke();

      // --- 5. TAY TRÁI THỦ THẾ & TAY PHẢI VUNG GIÁO ---
      // Tay trái thủ thế (bắp tay săn chắc)
      ctx.fillStyle = '#c2410c';
      ctx.beginPath();
      ctx.ellipse(cx - 24, cy - 58, 6, 10, -0.4, 0, Math.PI * 2);
      ctx.fill();
      // Nắm đấm bọc giáp tay
      ctx.fillStyle = '#7c2d12';
      ctx.beginPath();
      ctx.arc(cx - 22, cy - 46, 5.5, 0, Math.PI * 2);
      ctx.fill();

      // --- 6. KHUÔN MẶT ANH HÙNG HOANG CỔ, MẮT SÁNG & BĂNG TRÁN LÔNG VŨ ---
      // Cổ cơ bắp
      ctx.fillStyle = '#c2410c';
      ctx.fillRect(cx - 7, cy - 82, 14, 12);

      // Khuôn mặt dũng cảm, cằm vuông nam tính
      const faceGrad = ctx.createLinearGradient(cx - 12, cy - 96, cx + 12, cy - 74);
      faceGrad.addColorStop(0, '#f97316');
      faceGrad.addColorStop(1, '#c2410c');
      ctx.fillStyle = faceGrad;
      ctx.beginPath();
      ctx.roundRect(cx - 12, cy - 94, 24, 20, [8, 8, 10, 10]);
      ctx.fill();

      // Râu quai nón nam tính
      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.arc(cx, cy - 83, 11, 0.25, Math.PI * 0.75);
      ctx.fill();

      // Vạch sơn chiến tranh (War Paint) đỏ son ngang 2 gò má
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(cx - 11, cy - 84, 7, 2.5);
      ctx.fillRect(cx + 4, cy - 84, 7, 2.5);

      // Mắt sắc bén có thần (Determined Eyes with Catchlight)
      // Chân mày rậm xếch lên
      ctx.fillStyle = '#09090b';
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy - 89); ctx.lineTo(cx - 2, cy - 87); ctx.lineTo(cx - 10, cy - 87);
      ctx.moveTo(cx + 2, cy - 87); ctx.lineTo(cx + 10, cy - 89); ctx.lineTo(cx + 10, cy - 87);
      ctx.fill();

      // Mắt trái
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(cx - 5.5, cy - 85, 3.5, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(cx - 5, cy - 85, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx - 6, cy - 86, 0.8, 0, Math.PI * 2);
      ctx.fill();

      // Mắt phải
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(cx + 5.5, cy - 85, 3.5, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(cx + 5, cy - 85, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx + 4, cy - 86, 0.8, 0, Math.PI * 2);
      ctx.fill();

      // Băng trán thổ cẩm đỏ & Huy hiệu mặt trời vàng
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.roundRect(cx - 13, cy - 95, 26, 6, 2);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(cx, cy - 92, 3.2, 0, Math.PI * 2);
      ctx.fill();

      // 2 Lông vũ đại bàng uốn lượn bay bổng
      const featherWiggle = Math.sin(f * 1.5 + (f === 5 ? 3 : 0)) * 6;
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy - 95);
      ctx.quadraticCurveTo(cx - 18 + featherWiggle, cy - 112, cx - 12 + featherWiggle, cy - 122);
      ctx.lineTo(cx, cy - 95);
      ctx.fill();
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(cx - 10 + featherWiggle * 0.6, cy - 112, 4.5, 8);

      // Tóc mái dũng sĩ & Lọn tóc trước trán
      ctx.fillStyle = '#09090b';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 94, 14, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy - 92); ctx.lineTo(cx - 4, cy - 84); ctx.lineTo(cx - 2, cy - 92);
      ctx.moveTo(cx + 2, cy - 92); ctx.lineTo(cx + 5, cy - 84); ctx.lineTo(cx + 9, cy - 92);
      ctx.fill();

      // --- 7. TAY PHẢI & ĐẠI GIÁO HOANG CỔ CẦM NGHIÊNG SANG BÊN (Spear on Side) ---
      ctx.save();
      ctx.translate(cx + 18 + thrustX, cy - 58 + thrustY);
      ctx.rotate(spearAngle);

      // Cán giáo gỗ lim đen chắc nịch
      ctx.strokeStyle = '#431407';
      ctx.lineWidth = 4.8;
      ctx.beginPath();
      ctx.moveTo(0, -78);
      ctx.lineTo(0, 48);
      ctx.stroke();

      // Quấn dây gân đỏ quanh cán giáo
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2.0;
      for (let sy = -50; sy <= 20; sy += 12) {
        ctx.beginPath();
        ctx.moveTo(-2, sy); ctx.lineTo(2, sy + 6);
        ctx.stroke();
      }

      // Dải lụa đỏ tế lễ uốn lượn bay xé gió
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(0, -68);
      ctx.quadraticCurveTo(-22 - (f === 5 ? 18 : 0), -60, -28 - (f === 5 ? 24 : 0), -46);
      ctx.lineTo(0, -60);
      ctx.fill();

      // Mũi giáo đá thạch anh vát cạnh 3D sắc bén
      const spearHeadGrad = ctx.createLinearGradient(-8, -102, 8, -74);
      spearHeadGrad.addColorStop(0, '#ffffff');
      spearHeadGrad.addColorStop(0.4, '#e2e8f0');
      spearHeadGrad.addColorStop(0.8, '#94a3b8');
      spearHeadGrad.addColorStop(1, '#475569');
      ctx.fillStyle = spearHeadGrad;
      ctx.beginPath();
      ctx.moveTo(0, -104);
      ctx.lineTo(10, -76);
      ctx.lineTo(-10, -76);
      ctx.closePath();
      ctx.fill();

      // Sống dao mũi giáo sáng loáng
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -104); ctx.lineTo(0, -76);
      ctx.stroke();

      // Vệt khí động sóng xung kích khi đâm giáo (Frame 5)
      if (f === 5) {
        ctx.strokeStyle = 'rgba(254, 240, 138, 0.95)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, -106);
        ctx.lineTo(0, -136);
        ctx.stroke();
      }

      // Bàn tay bắp tay nắm chặt cán giáo
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      ctx.restore();
    });
  }

  // =========================================================================
  // 2. DŨNG SĨ HOANG CỔ (NỮ) - Female Ancient Huntress (Linh hoạt, song đao)
  // =========================================================================
  private generateFemaleHero(): void {
    this.createStripCanvas(EntityCatalogId.HERO_FEMALE, 120, 120, (ctx, f, fw, fh) => {
      const cx = 60, cy = 106;
      const walkBob = f >= 1 && f <= 3 ? Math.sin(f * 2.1) * 3.2 : 0;
      const legStride = f === 1 ? 12 : (f === 2 ? -2 : (f === 3 ? -12 : (f === 4 ? -8 : (f === 5 ? 16 : 0))));
      const bladeSwing = f === 4 ? -0.6 : (f === 5 ? 0.7 : 0);

      ctx.save();
      ctx.translate(0, -walkBob);

      // Chân thon bọc xà cạp da sơn dương
      ctx.fillStyle = '#9a3412';
      ctx.roundRect(cx - 10 - legStride * 0.6, cy - 26, 8, 26, 3);
      ctx.fill();
      ctx.fillStyle = '#ea580c';
      ctx.roundRect(cx + 3 + legStride, cy - 26, 9, 26, 3);
      ctx.fill();

      // Váy da nai viền lông
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy - 34); ctx.lineTo(cx + 14, cy - 34);
      ctx.lineTo(cx + 10 + legStride * 0.2, cy - 14); ctx.lineTo(cx - 10 + legStride * 0.2, cy - 14);
      ctx.closePath();
      ctx.fill();

      // Thân mình thon gọn & Áo yếm lam ngọc
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 48, 10, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(cx - 10, cy - 58, 20, 14);

      // Đầu & Mái tóc dài tết bím đuôi ngựa bay
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(cx, cy - 72, 10, 0, Math.PI * 2);
      ctx.fill();

      // Mắt sáng & Băng trán lông vũ
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx + 2, cy - 74, 4.5, 3);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(cx + 4, cy - 74, 2.5, 3);

      // Tóc đen đuôi ngựa dài bay vút
      ctx.fillStyle = '#09090b';
      ctx.beginPath();
      ctx.ellipse(cx - 2, cy - 75, 12, 8, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 74);
      ctx.quadraticCurveTo(cx - 24 - legStride, cy - 66, cx - 28 - legStride, cy - 48);
      ctx.lineTo(cx - 16 - legStride, cy - 46);
      ctx.fill();

      // Song đao đá nhọn
      ctx.save();
      ctx.translate(cx + 12, cy - 54);
      ctx.rotate(bladeSwing);
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(18, -24); ctx.lineTo(8, -26);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.restore();
    });
  }

  // =========================================================================
  // 3. THÚ CƯNG CỌP RĂNG KIẾM (Smilodon Companion)
  // =========================================================================
  private generateSabertoothPet(): void {
    this.createStripCanvas(EntityCatalogId.SABERTOOTH_PET, 110, 80, (ctx, f, fw, fh) => {
      const cx = 55, cy = 66;
      const legStride = f === 1 ? 8 : (f === 2 ? 0 : (f === 3 ? -8 : (f === 4 ? 4 : 0)));
      const tailWag = Math.sin(f * 1.8) * 6;

      ctx.fillStyle = '#92400e';
      ctx.fillRect(cx - 24 + legStride, cy - 16, 7, 18);
      ctx.fillRect(cx - 10 - legStride, cy - 16, 7, 18);
      ctx.fillRect(cx + 10 + legStride, cy - 16, 7, 18);
      ctx.fillRect(cx + 24 - legStride, cy - 16, 7, 18);

      const bodyGrad = ctx.createLinearGradient(cx - 28, cy - 34, cx + 28, cy - 10);
      bodyGrad.addColorStop(0, '#f59e0b');
      bodyGrad.addColorStop(0.7, '#d97706');
      bodyGrad.addColorStop(1, '#92400e');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 22, 28, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#451a03';
      for (let x = -20; x <= 20; x += 8) {
        ctx.beginPath();
        ctx.moveTo(cx + x, cy - 34); ctx.lineTo(cx + x + 4, cy - 22); ctx.lineTo(cx + x - 2, cy - 22);
        ctx.fill();
      }

      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(cx - 26, cy - 24);
      ctx.quadraticCurveTo(cx - 38, cy - 32 + tailWag, cx - 44, cy - 20 + tailWag);
      ctx.stroke();

      const hx = cx + 26, hy = cy - 26;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(hx, hy, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(hx + 4, hy + 4); ctx.lineTo(hx + 7, hy + 18); ctx.lineTo(hx + 9, hy + 4);
      ctx.fill();

      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(hx + 4, hy - 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // =========================================================================
  // 4. LINH ĐIỂU VIỄN CHINH (Expedition Bird)
  // =========================================================================
  private generateExpeditionBird(): void {
    this.createStripCanvas(EntityCatalogId.EXPEDITION_BIRD, 90, 75, (ctx, f, fw, fh) => {
      const cx = 45, cy = 44;
      const flap = Math.sin(f * 1.5) * 16;

      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - 28, cy - 18 + flap);
      ctx.lineTo(cx - 14, cy + 6);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + 28, cy - 18 - flap);
      ctx.lineTo(cx + 14, cy + 6);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(cx + 10, cy - 2); ctx.lineTo(cx + 18, cy); ctx.lineTo(cx + 10, cy + 2);
      ctx.fill();
    });
  }

  // =========================================================================
  // 5. BẠO CHÚA T-REX (Gargantuan T-Rex)
  // =========================================================================
  private generateTRex(): void {
    this.createStripCanvas(EntityCatalogId.TREX, 140, 100, (ctx, f, fw, fh) => {
      const cx = 65, cy = 82;
      const stride = f === 1 ? 10 : (f === 2 ? 0 : (f === 3 ? -10 : (f === 4 ? 6 : 0)));
      const jawOpen = f === 4 ? 8 : (f === 5 ? 3 : 0);

      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 11;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy - 32);
      ctx.quadraticCurveTo(cx - 45, cy - 40, cx - 60, cy - 24);
      ctx.stroke();

      ctx.fillStyle = '#381704';
      ctx.fillRect(cx - 12 + stride, cy - 22, 9, 24);
      ctx.fillRect(cx + 8 - stride, cy - 22, 9, 24);

      const bodyGrad = ctx.createLinearGradient(cx - 20, cy - 50, cx + 20, cy - 16);
      bodyGrad.addColorStop(0, '#291102');
      bodyGrad.addColorStop(0.5, '#78350f');
      bodyGrad.addColorStop(1, '#c2410c');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 36, 26, 18, -0.2, 0, Math.PI * 2);
      ctx.fill();

      const hx = cx + 24;
      const hy = cy - 54;
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.roundRect(hx, hy, 34, 16, [5, 10, 3, 3]);
      ctx.fill();

      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.roundRect(hx + 5, hy + 13 + jawOpen, 26, 8, [2, 5, 4, 2]);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      for (let x = hx + 8; x <= hx + 30; x += 5) {
        ctx.fillRect(x, hy + 12, 2.5, 4);
      }

      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(hx + 8, hy + 6, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // =========================================================================
  // 6. KHỦNG LONG GAI THUYỀN (Spinosaurus)
  // =========================================================================
  private generateSpinosaurus(): void {
    this.createStripCanvas(EntityCatalogId.SPINOSAURUS, 145, 100, (ctx, f, fw, fh) => {
      const cx = 68, cy = 84;
      const stride = f === 1 ? 9 : (f === 3 ? -9 : 0);

      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.moveTo(cx - 32, cy - 32);
      ctx.quadraticCurveTo(cx, cy - 72, cx + 24, cy - 32);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.6;
      for (let i = -24; i <= 18; i += 7) {
        ctx.beginPath();
        ctx.moveTo(cx + i, cy - 32); ctx.lineTo(cx + i * 0.7, cy - 62 + Math.abs(i) * 0.8);
        ctx.stroke();
      }

      ctx.fillStyle = '#14532d';
      ctx.fillRect(cx - 14 + stride, cy - 20, 8, 22);
      ctx.fillRect(cx + 10 - stride, cy - 20, 8, 22);
      ctx.beginPath();
      ctx.ellipse(cx, cy - 28, 28, 15, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#166534';
      ctx.beginPath();
      ctx.roundRect(cx + 20, cy - 44, 38, 11, [3, 8, 3, 3]);
      ctx.fill();
    });
  }

  // =========================================================================
  // 7. KHỦNG LONG SONG MÀO (Dilophosaurus)
  // =========================================================================
  private generateDilophosaurus(): void {
    this.createStripCanvas(EntityCatalogId.DILOPHOSAURUS, 115, 85, (ctx, f, fw, fh) => {
      const cx = 55, cy = 68;
      const stride = f === 1 ? 8 : (f === 3 ? -8 : 0);

      ctx.fillStyle = '#4d7c0f';
      ctx.fillRect(cx - 8 + stride, cy - 18, 6, 20);
      ctx.fillRect(cx + 6 - stride, cy - 18, 6, 20);

      ctx.fillStyle = '#65a30d';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 26, 18, 11, -0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#4d7c0f';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy - 26); ctx.lineTo(cx - 48, cy - 36);
      ctx.stroke();

      const hx = cx + 18, hy = cy - 42;
      ctx.fillStyle = '#65a30d';
      ctx.beginPath();
      ctx.roundRect(hx, hy, 22, 10, [3, 6, 2, 2]);
      ctx.fill();

      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(hx + 6, hy - 6, 8, Math.PI, 0);
      ctx.fill();
    });
  }

  // =========================================================================
  // 8. TAM GIÁC LONG (Triceratops)
  // =========================================================================
  private generateTriceratops(): void {
    this.createStripCanvas(EntityCatalogId.TRICERATOPS, 130, 90, (ctx, f, fw, fh) => {
      const cx = 65, cy = 72;
      const stride = f === 1 ? 6 : (f === 3 ? -6 : 0);

      ctx.fillStyle = '#44403c';
      ctx.fillRect(cx - 26 + stride, cy - 16, 8, 18);
      ctx.fillRect(cx - 8 - stride, cy - 16, 8, 18);
      ctx.fillRect(cx + 10 + stride, cy - 16, 8, 18);
      ctx.fillRect(cx + 26 - stride, cy - 16, 8, 18);

      ctx.fillStyle = '#57534e';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 24, 30, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      const hx = cx + 26, hy = cy - 30;
      ctx.fillStyle = '#78716c';
      ctx.beginPath();
      ctx.arc(hx, hy - 8, 16, -Math.PI * 0.4, Math.PI * 0.6);
      ctx.fill();

      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(hx + 6, hy - 14); ctx.lineTo(hx + 24, hy - 26);
      ctx.moveTo(hx + 8, hy - 8); ctx.lineTo(hx + 25, hy - 18);
      ctx.moveTo(hx + 16, hy + 2); ctx.lineTo(hx + 25, hy - 3);
      ctx.stroke();
    });
  }

  // =========================================================================
  // 9. KHỦNG LONG THIẾT GIÁP (Ankylosaurus)
  // =========================================================================
  private generateAnkylosaurus(): void {
    this.createStripCanvas(EntityCatalogId.ANKYLOSAURUS, 130, 85, (ctx, f, fw, fh) => {
      const cx = 65, cy = 68;
      const stride = f === 1 ? 6 : (f === 3 ? -6 : 0);
      const tailSwing = f === 4 ? -10 : (f === 5 ? 12 : 0);

      ctx.fillStyle = '#292524';
      ctx.fillRect(cx - 26 + stride, cy - 14, 8, 16);
      ctx.fillRect(cx - 8 - stride, cy - 14, 8, 16);
      ctx.fillRect(cx + 10 + stride, cy - 14, 8, 16);
      ctx.fillRect(cx + 26 - stride, cy - 14, 8, 16);

      ctx.strokeStyle = '#57534e';
      ctx.lineWidth = 6.5;
      ctx.beginPath();
      ctx.moveTo(cx - 24, cy - 18);
      ctx.quadraticCurveTo(cx - 42, cy - 16 + tailSwing, cx - 56, cy - 18 + tailSwing);
      ctx.stroke();

      ctx.fillStyle = '#d6d3d1';
      ctx.beginPath();
      ctx.arc(cx - 56, cy - 18 + tailSwing, 8, 0, Math.PI * 2);
      ctx.fill();

      const shellGrad = ctx.createRadialGradient(cx + 6, cy - 26, 3, cx, cy - 22, 34);
      shellGrad.addColorStop(0, '#78716c');
      shellGrad.addColorStop(0.7, '#44403c');
      shellGrad.addColorStop(1, '#1c1917');
      ctx.fillStyle = shellGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 22, 32, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#e2e8f0';
      for (let gx = -22; gx <= 22; gx += 11) {
        for (let gy = -32; gy <= -12; gy += 10) {
          ctx.beginPath();
          ctx.moveTo(cx + gx - 4, cy + gy);
          ctx.lineTo(cx + gx, cy + gy - 7);
          ctx.lineTo(cx + gx + 4, cy + gy);
          ctx.fill();
        }
      }

      ctx.fillStyle = '#44403c';
      ctx.beginPath();
      ctx.ellipse(cx + 34, cy - 20, 12, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // =========================================================================
  // 10. CỰ MÃNG XÀ (Titanoboa)
  // =========================================================================
  private generateTitanoboa(): void {
    this.createStripCanvas(EntityCatalogId.TITANOBOA, 130, 85, (ctx, f, fw, fh) => {
      const cx = 65, cy = 66;
      const slither = Math.sin(f * 1.6) * 8;

      ctx.strokeStyle = '#047857';
      ctx.lineWidth = 16;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 48, cy + slither * 0.5);
      ctx.quadraticCurveTo(cx - 24, cy - 22 - slither, cx, cy + slither);
      ctx.quadraticCurveTo(cx + 24, cy - 24 - slither, cx + 44, cy - 14 + slither * 0.5);
      ctx.stroke();

      const hx = cx + 46, hy = cy - 14 + slither * 0.5;
      ctx.fillStyle = '#065f46';
      ctx.beginPath();
      ctx.ellipse(hx, hy, 11, 8, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(hx + 4, hy - 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // =========================================================================
  // 11. CÁ SẤU KHỔNG LỒ (Sarcosuchus)
  // =========================================================================
  private generateSarcosuchus(): void {
    this.createStripCanvas(EntityCatalogId.SARCOSUCHUS, 140, 80, (ctx, f, fw, fh) => {
      const cx = 70, cy = 60;
      const crawl = f === 1 ? 6 : (f === 3 ? -6 : 0);

      ctx.fillStyle = '#14532d';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 12, 42, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillRect(cx - 28 + crawl, cy - 8, 8, 12);
      ctx.fillRect(cx - 10 - crawl, cy - 8, 8, 12);
      ctx.fillRect(cx + 10 + crawl, cy - 8, 8, 12);
      ctx.fillRect(cx + 28 - crawl, cy - 8, 8, 12);

      ctx.fillStyle = '#166534';
      ctx.beginPath();
      ctx.roundRect(cx + 30, cy - 18, 34, 8, [3, 7, 3, 3]);
      ctx.fill();
    });
  }

  // =========================================================================
  // 12. VOI MA MÚT (Mammoth)
  // =========================================================================
  private generateMammoth(): void {
    this.createStripCanvas(EntityCatalogId.MAMMOTH, 140, 105, (ctx, f, fw, fh) => {
      const cx = 70, cy = 84;
      const stride = f === 1 ? 7 : (f === 3 ? -7 : 0);

      ctx.fillStyle = '#271612';
      ctx.fillRect(cx - 28 + stride, cy - 20, 10, 22);
      ctx.fillRect(cx - 8 - stride, cy - 20, 10, 22);
      ctx.fillRect(cx + 10 + stride, cy - 20, 10, 22);
      ctx.fillRect(cx + 28 - stride, cy - 20, 10, 22);

      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 34, 34, 22, 0, 0, Math.PI * 2);
      ctx.fill();

      const hx = cx + 30, hy = cy - 42;
      ctx.fillStyle = '#381704';
      ctx.beginPath();
      ctx.arc(hx, hy, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(hx + 8, hy + 3);
      ctx.quadraticCurveTo(hx + 32, hy + 3, hx + 26, hy - 20);
      ctx.stroke();
    });
  }

  // =========================================================================
  // 13. BẦY SÓI HOANG (Wolf Pack)
  // =========================================================================
  private generateWolfPack(): void {
    this.createStripCanvas(EntityCatalogId.WOLF_PACK, 100, 75, (ctx, f, fw, fh) => {
      const cx = 50, cy = 58;
      const stride = f === 1 ? 7 : (f === 3 ? -7 : 0);

      ctx.fillStyle = '#475569';
      ctx.fillRect(cx - 18 + stride, cy - 14, 5, 16);
      ctx.fillRect(cx - 6 - stride, cy - 14, 5, 16);
      ctx.fillRect(cx + 8 + stride, cy - 14, 5, 16);
      ctx.fillRect(cx + 18 - stride, cy - 14, 5, 16);

      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 18, 20, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(cx + 18, cy - 24, 9, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // =========================================================================
  // 14. KHỦNG LONG CỔ DÀI (Brachiosaurus)
  // =========================================================================
  private generateBrachiosaurus(): void {
    this.createStripCanvas(EntityCatalogId.BRACHIOSAURUS, 150, 130, (ctx, f, fw, fh) => {
      const cx = 65, cy = 106;
      const stride = f === 1 ? 8 : (f === 3 ? -8 : 0);

      ctx.fillStyle = '#334155';
      ctx.fillRect(cx - 30 + stride, cy - 24, 11, 26);
      ctx.fillRect(cx - 10 - stride, cy - 24, 11, 26);
      ctx.fillRect(cx + 10 + stride, cy - 24, 11, 26);
      ctx.fillRect(cx + 30 - stride, cy - 24, 11, 26);

      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 36, 36, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + 26, cy - 42);
      ctx.quadraticCurveTo(cx + 50, cy - 84, cx + 44, cy - 102);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.ellipse(cx + 46, cy - 104, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // =========================================================================
  // 15. THỦY LONG (Plesiosaur)
  // =========================================================================
  private generatePlesiosaur(): void {
    this.createStripCanvas(EntityCatalogId.PLESIOSAUR, 130, 100, (ctx, f, fw, fh) => {
      const cx = 65, cy = 76;
      const swimBob = Math.sin(f * 1.4) * 4;

      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 16 + swimBob, 26, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(cx + 16, cy - 20 + swimBob);
      ctx.quadraticCurveTo(cx + 36, cy - 48 + swimBob, cx + 32, cy - 68 + swimBob);
      ctx.stroke();
    });
  }

  // =========================================================================
  // 16. BẦY RAPTOR SĂN MỒI (Velociraptor)
  // =========================================================================
  private generateVelociraptor(): void {
    this.createStripCanvas(EntityCatalogId.VELOCIRAPTOR, 110, 85, (ctx, f, fw, fh) => {
      const cx = 55, cy = 68;
      const stride = f === 1 ? 9 : (f === 3 ? -9 : 0);

      ctx.fillStyle = '#92400e';
      ctx.fillRect(cx - 8 + stride, cy - 18, 6, 20);
      ctx.fillRect(cx + 6 - stride, cy - 18, 6, 20);

      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 24, 18, 10, -0.2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // =========================================================================
  // 17. DỰC LONG BAY (Pterosaur)
  // =========================================================================
  private generatePterosaur(): void {
    this.createStripCanvas(EntityCatalogId.PTEROSAUR, 115, 85, (ctx, f, fw, fh) => {
      const cx = 58, cy = 50;
      const flap = Math.sin(f * 1.6) * 16;

      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(cx - 30, cy - 30 + flap, cx - 48, cy - 15 + flap);
      ctx.lineTo(cx - 22, cy + 8);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + 22, cy + 8);
      ctx.lineTo(cx + 48, cy - 15 - flap);
      ctx.quadraticCurveTo(cx + 30, cy - 30 - flap, cx, cy);
      ctx.fill();
    });
  }

  // =========================================================================
  // 18. HEO RỪNG CỔ ĐẠI (Giant Boar)
  // =========================================================================
  private generateGiantBoar(): void {
    this.createStripCanvas(EntityCatalogId.GIANT_BOAR, 110, 80, (ctx, f, fw, fh) => {
      const cx = 55, cy = 64;
      const stride = f === 1 ? 6 : (f === 3 ? -6 : 0);

      ctx.fillStyle = '#271612';
      ctx.fillRect(cx - 18 + stride, cy - 15, 6, 17);
      ctx.fillRect(cx - 6 - stride, cy - 15, 6, 17);
      ctx.fillRect(cx + 8 + stride, cy - 15, 6, 17);
      ctx.fillRect(cx + 18 - stride, cy - 15, 6, 17);

      ctx.fillStyle = '#3e2723';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 20, 24, 15, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // =========================================================================
  // 19. ĐÀN HƯƠU SAO (Deer Herd)
  // =========================================================================
  private generateDeerHerd(): void {
    this.createStripCanvas(EntityCatalogId.DEER_HERD, 110, 95, (ctx, f, fw, fh) => {
      const cx = 55, cy = 76;
      const stride = f === 1 ? 8 : (f === 3 ? -8 : 0);

      ctx.fillStyle = '#78350f';
      ctx.fillRect(cx - 16 + stride, cy - 20, 4.5, 22);
      ctx.fillRect(cx - 6 - stride, cy - 20, 4.5, 22);
      ctx.fillRect(cx + 8 + stride, cy - 20, 4.5, 22);
      ctx.fillRect(cx + 16 - stride, cy - 20, 4.5, 22);

      ctx.fillStyle = '#a16207';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 28, 20, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // =========================================================================
  // 20. ĐÀN NGỰA HOANG (Wild Horse)
  // =========================================================================
  private generateWildHorse(): void {
    this.createStripCanvas(EntityCatalogId.WILD_HORSE, 115, 95, (ctx, f, fw, fh) => {
      const cx = 58, cy = 76;
      const stride = f === 1 ? 9 : (f === 3 ? -9 : 0);

      ctx.fillStyle = '#78350f';
      ctx.fillRect(cx - 18 + stride, cy - 20, 5.5, 22);
      ctx.fillRect(cx - 6 - stride, cy - 20, 5.5, 22);
      ctx.fillRect(cx + 8 + stride, cy - 20, 5.5, 22);
      ctx.fillRect(cx + 18 - stride, cy - 20, 5.5, 22);

      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 28, 24, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}
