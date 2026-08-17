/**
 * skeletalArtStudio.ts
 * Studio Sinh Đồ Họa Vector Chi Tiết Cao Cấp Cho Từng Bộ Phận Khớp Xương (Skeletal Art Studio)
 *
 * Tiêu chuẩn mỹ thuật:
 * - 100% Vẽ Vector chi tiết (Path, Bézier quadraticCurveTo, Gradient, Shadow Blur, High Catchlights).
 * - KHÔNG vẽ hình que hay khối thô sơ.
 * - Phục vụ cấu trúc phân lớp: Đầu, Thân, Bắp tay, Cẳng tay, Đùi, Cẳng chân, Vũ khí, Đuôi, Nanh kiếm, Giáp da thú.
 */

import { Phaser } from '../phaserTypes.ts';

export class SkeletalArtStudio {
  private static instance: SkeletalArtStudio | null = null;
  private texturesRegistered: boolean = false;

  public static getInstance(): SkeletalArtStudio {
    if (!SkeletalArtStudio.instance) {
      SkeletalArtStudio.instance = new SkeletalArtStudio();
    }
    return SkeletalArtStudio.instance;
  }

  private constructor() {}

  /** Khởi tạo và đăng ký toàn bộ Part Textures vào Phaser Texture Manager */
  public registerAllPartTextures(scene: any): void {
    if (this.texturesRegistered) return;
    this.texturesRegistered = true;

    // 1. Dũng Sĩ Hoang Cổ (Hero Parts)
    this.createHeroHeadTexture(scene);
    this.createHeroTorsoTexture(scene);
    this.createHeroArmUpperTexture(scene);
    this.createHeroArmLowerTexture(scene);
    this.createHeroLegUpperTexture(scene);
    this.createHeroLegLowerTexture(scene);
    this.createHeroSpearTexture(scene);
    this.createHeroBowTexture(scene);

    // 2. Hổ Răng Kiếm (Sabertooth Tiger Parts)
    this.createTigerHeadTexture(scene);
    this.createTigerBodyTexture(scene);
    this.createTigerLegUpperTexture(scene);
    this.createTigerLegLowerTexture(scene);
    this.createTigerTailTexture(scene);

    // 3. Khủng Long Bạo Chúa T-Rex (T-Rex Parts)
    this.createTRexHeadTexture(scene);
    this.createTRexBodyTexture(scene);
    this.createTRexLegUpperTexture(scene);
    this.createTRexLegLowerTexture(scene);
    this.createTRexTailTexture(scene);

    // 4. Môi Trường & Bóng Đổ Mềm
    this.createSoftShadowTexture(scene);
    this.createLushGrassGroundTexture(scene);
  }

  // =========================================================================
  // 1. DŨNG SĨ HOANG CỔ (ANCIENT HERO PARTS)
  // =========================================================================

  /** Đầu Dũng Sĩ: Tóc hoang dã tỉa lọn, băng trán da hổ, lông vũ đại bàng đỏ-vàng, mắt catchlight, warpaint */
  private createHeroHeadTexture(scene: any): void {
    if (scene.textures.exists('part_hero_head')) return;

    const w = 64;
    const h = 64;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // A. Lông vũ đại bàng sau đầu (Góc trên bên trái)
    ctx.save();
    ctx.translate(22, 18);
    ctx.rotate(-0.4);
    // Lông 1: Đỏ - Vàng
    const featherGrad1 = ctx.createLinearGradient(0, 0, 0, -22);
    featherGrad1.addColorStop(0, '#b91c1c');
    featherGrad1.addColorStop(0.6, '#f59e0b');
    featherGrad1.addColorStop(1, '#fef08a');
    ctx.fillStyle = featherGrad1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-6, -12, 0, -22);
    ctx.quadraticCurveTo(6, -12, 0, 0);
    ctx.fill();
    // Sống lông trắng
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -20);
    ctx.stroke();

    // Lông 2 nhỏ hơn
    ctx.rotate(0.35);
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-4, -8, 0, -16);
    ctx.quadraticCurveTo(4, -8, 0, 0);
    ctx.fill();
    ctx.restore();

    // B. Tóc bờm hoang dã phía sau (Dark brown / Black mane)
    ctx.fillStyle = '#1c130d';
    ctx.beginPath();
    ctx.moveTo(24, 18);
    ctx.quadraticCurveTo(12, 28, 14, 46);
    ctx.quadraticCurveTo(20, 48, 26, 44);
    ctx.quadraticCurveTo(18, 36, 30, 30);
    ctx.closePath();
    ctx.fill();

    // C. Khuôn mặt & Cằm (Da ngăm đồng cỏ khỏe khoắn)
    const skinGrad = ctx.createRadialGradient(34, 30, 4, 34, 30, 18);
    skinGrad.addColorStop(0, '#e59b64');
    skinGrad.addColorStop(1, '#b46030');
    ctx.fillStyle = skinGrad;
    ctx.beginPath();
    ctx.moveTo(24, 22);
    ctx.lineTo(44, 22);
    ctx.quadraticCurveTo(46, 36, 40, 44); // Má & Cằm
    ctx.lineTo(32, 47); // Đỉnh cằm sắc nét
    ctx.quadraticCurveTo(24, 42, 24, 22);
    ctx.closePath();
    ctx.fill();

    // D. Tai & Bông tai răng nanh
    ctx.fillStyle = '#b46030';
    ctx.beginPath();
    ctx.ellipse(23, 33, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Bông tai răng nanh trắng ngà
    ctx.fillStyle = '#fffbeb';
    ctx.beginPath();
    ctx.moveTo(23, 36);
    ctx.lineTo(25, 42);
    ctx.lineTo(22, 38);
    ctx.closePath();
    ctx.fill();

    // E. Sơn chiến tranh đỏ (War Paint) trên 2 gò má
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(28, 34);
    ctx.lineTo(34, 36);
    ctx.lineTo(30, 38);
    ctx.closePath();
    ctx.fill();

    // F. Mắt anh hùng: Lòng trắng, con ngươi đen, điểm sáng Catchlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(36, 31, 4, 3, -0.1, 0, Math.PI * 2);
    ctx.fill();
    // Con ngươi
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(37, 31, 2, 0, Math.PI * 2);
    ctx.fill();
    // Đốm sáng Catchlight trắng tinh
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(38, 30, 0.9, 0, Math.PI * 2);
    ctx.fill();
    // Chân mày rậm dũng mãnh
    ctx.strokeStyle = '#1e1610';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(31, 27);
    ctx.lineTo(41, 28);
    ctx.stroke();

    // G. Mũi & Miệng cười kiên định
    ctx.strokeStyle = '#853a16';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(39, 31);
    ctx.lineTo(41, 36);
    ctx.lineTo(37, 37);
    ctx.stroke();
    // Miệng
    ctx.strokeStyle = '#63250a';
    ctx.beginPath();
    ctx.moveTo(33, 41);
    ctx.quadraticCurveTo(36, 43, 39, 41);
    ctx.stroke();

    // H. Băng trán da hổ (Headband)
    const bandGrad = ctx.createLinearGradient(20, 20, 48, 20);
    bandGrad.addColorStop(0, '#d97706');
    bandGrad.addColorStop(0.5, '#f59e0b');
    bandGrad.addColorStop(1, '#b45309');
    ctx.fillStyle = bandGrad;
    ctx.fillRect(23, 20, 22, 6);
    // Vằn đen trên băng trán
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.moveTo(27, 20);
    ctx.lineTo(29, 26);
    ctx.lineTo(28, 26);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(35, 20);
    ctx.lineTo(37, 26);
    ctx.lineTo(36, 26);
    ctx.closePath();
    ctx.fill();

    // I. Tóc mái hoang dã phía trước trán
    ctx.fillStyle = '#1e1610';
    ctx.beginPath();
    ctx.moveTo(23, 20);
    ctx.quadraticCurveTo(30, 10, 46, 17);
    ctx.quadraticCurveTo(40, 24, 34, 21);
    ctx.quadraticCurveTo(28, 25, 23, 20);
    ctx.closePath();
    ctx.fill();

    scene.textures.addCanvas('part_hero_head', canvas);
  }

  /** Thân Dũng Sĩ: Ngực nở 6 múi 3D, giáp da thú viền lông tơ nhọn, đai kim loại ngọc bích */
  private createHeroTorsoTexture(scene: any): void {
    if (scene.textures.exists('part_hero_torso')) return;

    const w = 56;
    const h = 64;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // A. Khối thân cơ bắp (Vai rộng, eo thon)
    const bodyGrad = ctx.createLinearGradient(12, 10, 44, 10);
    bodyGrad.addColorStop(0, '#a15024');
    bodyGrad.addColorStop(0.5, '#df8f57');
    bodyGrad.addColorStop(1, '#94441b');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(14, 10);
    ctx.lineTo(42, 10); // Vai rộng
    ctx.lineTo(38, 48); // Hông
    ctx.lineTo(18, 48);
    ctx.closePath();
    ctx.fill();

    // B. Cơ ngực & cơ bụng 6 múi 3D
    ctx.strokeStyle = '#6e3012';
    ctx.lineWidth = 1.6;
    // Rãnh giữa ngực
    ctx.beginPath();
    ctx.moveTo(28, 12);
    ctx.lineTo(28, 44);
    ctx.stroke();
    // 2 Khối cơ ngực
    ctx.beginPath();
    ctx.arc(22, 22, 7, 0, Math.PI * 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(34, 22, 7, Math.PI * 0.1, Math.PI);
    ctx.stroke();
    // 4 Múi bụng dưới
    ctx.beginPath();
    ctx.moveTo(22, 33);
    ctx.lineTo(34, 33);
    ctx.moveTo(23, 40);
    ctx.lineTo(33, 40);
    ctx.stroke();

    // C. Áo giáp da hổ vắt chéo vai trái sang sườn phải
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.moveTo(14, 10);
    ctx.lineTo(26, 10);
    ctx.lineTo(40, 46);
    ctx.lineTo(28, 46);
    ctx.closePath();
    ctx.fill();

    // Viền lông tơ thú nhọn quanh mép áo giáp
    ctx.fillStyle = '#fef3c7';
    for (let i = 0; i < 7; i++) {
      const px = 16 + i * 3.5;
      const py = 12 + i * 5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - 4, py + 3);
      ctx.lineTo(px, py + 5);
      ctx.closePath();
      ctx.fill();
    }

    // D. Đai thắt lưng kim loại đồng cổ & Ngọc Bích trung tâm
    const beltGrad = ctx.createLinearGradient(16, 44, 40, 44);
    beltGrad.addColorStop(0, '#78350f');
    beltGrad.addColorStop(0.5, '#d97706');
    beltGrad.addColorStop(1, '#451a03');
    ctx.fillStyle = beltGrad;
    ctx.fillRect(16, 44, 24, 7);

    // Mặt khóa ngọc bích phát sáng
    ctx.fillStyle = '#10b981';
    ctx.shadowColor = '#34d399';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(28, 47, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ecfdf5';
    ctx.beginPath();
    ctx.arc(27, 46, 1.2, 0, Math.PI * 2);
    ctx.fill();

    scene.textures.addCanvas('part_hero_torso', canvas);
  }

  /** Bắp tay Dũng Sĩ */
  private createHeroArmUpperTexture(scene: any): void {
    if (scene.textures.exists('part_hero_arm_upper')) return;

    const w = 24;
    const h = 32;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Bắp tay cơ bắp đổ bóng 3D
    const armGrad = ctx.createLinearGradient(4, 4, 20, 4);
    armGrad.addColorStop(0, '#8c3d15');
    armGrad.addColorStop(0.5, '#df8f57');
    armGrad.addColorStop(1, '#7a310d');
    ctx.fillStyle = armGrad;
    ctx.beginPath();
    ctx.ellipse(12, 16, 7, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // Vòng tay da bọc kim loại
    ctx.fillStyle = '#b45309';
    ctx.fillRect(6, 22, 12, 4);

    scene.textures.addCanvas('part_hero_arm_upper', canvas);
  }

  /** Cẳng tay & Bàn tay Dũng Sĩ */
  private createHeroArmLowerTexture(scene: any): void {
    if (scene.textures.exists('part_hero_arm_lower')) return;

    const w = 24;
    const h = 34;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Cẳng tay
    const grad = ctx.createLinearGradient(4, 4, 20, 4);
    grad.addColorStop(0, '#8c3d15');
    grad.addColorStop(0.5, '#df8f57');
    grad.addColorStop(1, '#7a310d');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(7, 4);
    ctx.lineTo(17, 4);
    ctx.lineTo(16, 22);
    ctx.lineTo(8, 22);
    ctx.closePath();
    ctx.fill();

    // Nắm đấm bàn tay dũng mãnh
    ctx.fillStyle = '#c5743c';
    ctx.beginPath();
    ctx.arc(12, 26, 6, 0, Math.PI * 2);
    ctx.fill();

    scene.textures.addCanvas('part_hero_arm_lower', canvas);
  }

  /** Đùi Dũng Sĩ: Cơ đùi & Khố da hổ */
  private createHeroLegUpperTexture(scene: any): void {
    if (scene.textures.exists('part_hero_leg_upper')) return;

    const w = 28;
    const h = 36;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Cơ đùi
    const legGrad = ctx.createLinearGradient(4, 4, 24, 4);
    legGrad.addColorStop(0, '#8c3d15');
    legGrad.addColorStop(0.5, '#d9834c');
    legGrad.addColorStop(1, '#692608');
    ctx.fillStyle = legGrad;
    ctx.beginPath();
    ctx.ellipse(14, 18, 9, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Khố da thú quấn quanh đùi
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.moveTo(5, 4);
    ctx.lineTo(23, 4);
    ctx.lineTo(21, 16);
    ctx.lineTo(7, 16);
    ctx.closePath();
    ctx.fill();

    scene.textures.addCanvas('part_hero_leg_upper', canvas);
  }

  /** Cẳng chân & Giày Da Gấu Dũng Sĩ */
  private createHeroLegLowerTexture(scene: any): void {
    if (scene.textures.exists('part_hero_leg_lower')) return;

    const w = 28;
    const h = 40;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Cẳng chân quấn xà cạp da thú
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.moveTo(8, 4);
    ctx.lineTo(18, 4);
    ctx.lineTo(20, 26);
    ctx.lineTo(7, 26);
    ctx.closePath();
    ctx.fill();

    // Dây thừng da quấn chéo
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(8, 8);
    ctx.lineTo(19, 15);
    ctx.moveTo(18, 17);
    ctx.lineTo(7, 23);
    ctx.stroke();

    // Giày da gấu / móng vuốt dưới chân
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.moveTo(6, 26);
    ctx.lineTo(21, 26);
    ctx.quadraticCurveTo(24, 34, 20, 36);
    ctx.lineTo(4, 36);
    ctx.quadraticCurveTo(3, 30, 6, 26);
    ctx.closePath();
    ctx.fill();

    scene.textures.addCanvas('part_hero_leg_lower', canvas);
  }

  /** Đại Giáo Hoang Cổ: Mũi đá thạch anh sắc lẹm lấp lánh, cán gỗ có sớ vân, lông vũ trang trí */
  private createHeroSpearTexture(scene: any): void {
    if (scene.textures.exists('part_hero_spear')) return;

    const w = 32;
    const h = 120;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // A. Cán giáo gỗ gụ có sớ vân
    const woodGrad = ctx.createLinearGradient(14, 0, 18, 0);
    woodGrad.addColorStop(0, '#5c2b09');
    woodGrad.addColorStop(0.5, '#92400e');
    woodGrad.addColorStop(1, '#451a03');
    ctx.fillStyle = woodGrad;
    ctx.fillRect(14, 24, 4, 92);

    // B. Dây thừng thắt và lông vũ đại bàng đung đưa
    ctx.fillStyle = '#d97706';
    ctx.fillRect(12, 24, 8, 6);
    // 2 chiếc lông vũ nhỏ
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(12, 28);
    ctx.quadraticCurveTo(4, 34, 6, 42);
    ctx.quadraticCurveTo(12, 36, 12, 28);
    ctx.fill();

    // C. Mũi giáo đá thạch anh Obsidian mài vát sắc lẹm
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 6;
    const crystalGrad = ctx.createLinearGradient(8, 0, 24, 0);
    crystalGrad.addColorStop(0, '#0284c7');
    crystalGrad.addColorStop(0.5, '#bae6fd');
    crystalGrad.addColorStop(1, '#0369a1');
    ctx.fillStyle = crystalGrad;
    ctx.beginPath();
    ctx.moveTo(16, 2); // Đỉnh nhọn
    ctx.lineTo(24, 18);
    ctx.lineTo(18, 25);
    ctx.lineTo(14, 25);
    ctx.lineTo(8, 18);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Vát cạnh phản chiếu ánh sáng lóa
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(16, 3);
    ctx.lineTo(18, 18);
    ctx.lineTo(16, 24);
    ctx.lineTo(14, 18);
    ctx.closePath();
    ctx.fill();

    scene.textures.addCanvas('part_hero_spear', canvas);
  }

  /** Thần Cung Sừng Sơn Dương */
  private createHeroBowTexture(scene: any): void {
    if (scene.textures.exists('part_hero_bow')) return;

    const w = 40;
    const h = 80;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Cánh cung sừng uốn cong Bézier
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(10, 8);
    ctx.quadraticCurveTo(34, 40, 10, 72);
    ctx.stroke();

    // Dây cung phát sáng
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(10, 8);
    ctx.lineTo(10, 72);
    ctx.stroke();

    scene.textures.addCanvas('part_hero_bow', canvas);
  }

  // =========================================================================
  // 2. HỔ RĂNG KIẾM (SABERTOOTH TIGER PARTS)
  // =========================================================================

  /** Đầu Hổ: Nanh kiếm cong trắng ngà, mắt hổ vàng catchlight, râu bạc */
  private createTigerHeadTexture(scene: any): void {
    if (scene.textures.exists('part_tiger_head')) return;

    const w = 64;
    const h = 56;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // A. Tai hổ vểnh
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.moveTo(18, 14);
    ctx.lineTo(14, 2);
    ctx.lineTo(26, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.moveTo(17, 12);
    ctx.lineTo(15, 5);
    ctx.lineTo(23, 8);
    ctx.closePath();
    ctx.fill();

    // B. Khối đầu hổ dũng mãnh (Cam rực vằn đen)
    const headGrad = ctx.createRadialGradient(34, 24, 6, 34, 24, 22);
    headGrad.addColorStop(0, '#f97316');
    headGrad.addColorStop(1, '#c2410c');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.moveTo(18, 12);
    ctx.quadraticCurveTo(34, 8, 48, 18);
    ctx.quadraticCurveTo(56, 28, 46, 40); // Mõm hổ
    ctx.quadraticCurveTo(32, 44, 20, 36);
    ctx.closePath();
    ctx.fill();

    // C. Cằm và mõm trắng ngà
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.moveTo(42, 28);
    ctx.quadraticCurveTo(54, 30, 48, 40);
    ctx.quadraticCurveTo(36, 42, 34, 34);
    ctx.closePath();
    ctx.fill();

    // D. Răng Nanh Kiếm Cong Trắng Ngà Sắc Lẹm
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.moveTo(44, 32);
    ctx.quadraticCurveTo(50, 42, 44, 52); // Đầu nanh nhọn hoắt
    ctx.quadraticCurveTo(40, 40, 41, 32);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // E. Mắt hổ vàng rực phát sáng (Golden predator eye)
    ctx.fillStyle = '#facc15';
    ctx.shadowColor = '#eab308';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.ellipse(36, 20, 4, 3, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Con ngươi hổ dựng dọc
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(36, 20, 1.2, 2.5, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Catchlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(37, 19, 0.8, 0, Math.PI * 2);
    ctx.fill();

    // F. Vằn hổ đen dũng mãnh
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.moveTo(28, 12);
    ctx.lineTo(31, 18);
    ctx.lineTo(29, 18);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(38, 11);
    ctx.lineTo(41, 16);
    ctx.lineTo(39, 16);
    ctx.closePath();
    ctx.fill();

    scene.textures.addCanvas('part_tiger_head', canvas);
  }

  /** Thân Hổ: Bézier đường cong cơ bắp, lưng cam vằn đen, bụng trắng mềm mại */
  private createTigerBodyTexture(scene: any): void {
    if (scene.textures.exists('part_tiger_body')) return;

    const w = 96;
    const h = 56;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Khối thân uốn lượn Bézier
    const bodyGrad = ctx.createLinearGradient(0, 10, 0, 48);
    bodyGrad.addColorStop(0, '#c2410c'); // Lưng sẫm
    bodyGrad.addColorStop(0.55, '#f97316');
    bodyGrad.addColorStop(1, '#fef3c7'); // Bụng trắng ngà
    ctx.fillStyle = bodyGrad;

    ctx.beginPath();
    ctx.moveTo(14, 18); // Hông sau
    ctx.quadraticCurveTo(48, 10, 84, 16); // Sống lưng cong
    ctx.quadraticCurveTo(92, 34, 76, 44); // Ngực trước nở
    ctx.quadraticCurveTo(46, 42, 18, 38); // Bụng mềm
    ctx.quadraticCurveTo(10, 28, 14, 18);
    ctx.closePath();
    ctx.fill();

    // Vằn hổ đen dũng mãnh phủ trên lưng
    ctx.fillStyle = '#1c1917';
    for (let i = 0; i < 5; i++) {
      const vx = 28 + i * 11;
      ctx.beginPath();
      ctx.moveTo(vx, 12);
      ctx.lineTo(vx + 3, 26);
      ctx.lineTo(vx - 2, 28);
      ctx.closePath();
      ctx.fill();
    }

    scene.textures.addCanvas('part_tiger_body', canvas);
  }

  /** Đùi Hổ */
  private createTigerLegUpperTexture(scene: any): void {
    if (scene.textures.exists('part_tiger_leg_upper')) return;

    const w = 32;
    const h = 42;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(4, 4, 28, 4);
    grad.addColorStop(0, '#9a3412');
    grad.addColorStop(0.6, '#ea580c');
    grad.addColorStop(1, '#fef3c7');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(16, 20, 11, 17, 0, 0, Math.PI * 2);
    ctx.fill();

    scene.textures.addCanvas('part_tiger_leg_upper', canvas);
  }

  /** Cẳng chân Hổ & Móng vuốt sắc */
  private createTigerLegLowerTexture(scene: any): void {
    if (scene.textures.exists('part_tiger_leg_lower')) return;

    const w = 28;
    const h = 40;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Cẳng chân
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.moveTo(8, 4);
    ctx.lineTo(20, 4);
    ctx.lineTo(19, 28);
    ctx.lineTo(7, 28);
    ctx.closePath();
    ctx.fill();

    // Bàn chân móng vuốt
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.arc(14, 30, 8, 0, Math.PI);
    ctx.fill();

    // 3 Móng vuốt sắc nhọn màu đen
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.moveTo(8, 34);
    ctx.lineTo(6, 38);
    ctx.lineTo(10, 36);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, 35);
    ctx.lineTo(14, 39);
    ctx.lineTo(16, 36);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(20, 34);
    ctx.lineTo(22, 38);
    ctx.lineTo(18, 36);
    ctx.closePath();
    ctx.fill();

    scene.textures.addCanvas('part_tiger_leg_lower', canvas);
  }

  /** Đuôi Hổ thon dài uốn cong chùm lông chóp */
  private createTigerTailTexture(scene: any): void {
    if (scene.textures.exists('part_tiger_tail')) return;

    const w = 52;
    const h = 32;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(4, 26);
    ctx.quadraticCurveTo(24, 28, 42, 10);
    ctx.stroke();

    // Chóp đuôi lông đen
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.arc(42, 10, 4.5, 0, Math.PI * 2);
    ctx.fill();

    scene.textures.addCanvas('part_tiger_tail', canvas);
  }

  // =========================================================================
  // 3. KHỦNG LONG BẠO CHÚA T-REX (GARGANTUAN T-REX PARTS)
  // =========================================================================

  /** Đầu T-Rex khổng lồ, hàm răng sắc lởm chởm, mắt đỏ rực */
  private createTRexHeadTexture(scene: any): void {
    if (scene.textures.exists('part_trex_head')) return;

    const w = 84;
    const h = 64;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Khối sọ bạo chúa gồ ghề
    const headGrad = ctx.createLinearGradient(0, 10, 0, 50);
    headGrad.addColorStop(0, '#15803d');
    headGrad.addColorStop(0.6, '#166534');
    headGrad.addColorStop(1, '#86efac');
    ctx.fillStyle = headGrad;

    ctx.beginPath();
    ctx.moveTo(14, 18);
    ctx.quadraticCurveTo(46, 8, 76, 20); // Đỉnh mõm
    ctx.lineTo(76, 38); // Hàm trên
    ctx.lineTo(44, 38); // Khớp hàm mở
    ctx.lineTo(68, 52); // Hàm dưới
    ctx.lineTo(40, 52);
    ctx.lineTo(16, 38);
    ctx.closePath();
    ctx.fill();

    // Răng nanh sắc nhọn lởm chởm
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i++) {
      const rx = 46 + i * 5;
      ctx.beginPath();
      ctx.moveTo(rx, 38);
      ctx.lineTo(rx + 2, 44);
      ctx.lineTo(rx + 4, 38);
      ctx.closePath();
      ctx.fill();
    }

    // Mắt đỏ rực săn mồi
    ctx.fillStyle = '#dc2626';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(36, 22, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(36, 22, 1.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    scene.textures.addCanvas('part_trex_head', canvas);
  }

  /** Thân T-Rex khổng lồ */
  private createTRexBodyTexture(scene: any): void {
    if (scene.textures.exists('part_trex_body')) return;

    const w = 110;
    const h = 76;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    const bodyGrad = ctx.createLinearGradient(0, 10, 0, 65);
    bodyGrad.addColorStop(0, '#15803d');
    bodyGrad.addColorStop(0.6, '#166534');
    bodyGrad.addColorStop(1, '#86efac');
    ctx.fillStyle = bodyGrad;

    ctx.beginPath();
    ctx.moveTo(18, 24);
    ctx.quadraticCurveTo(60, 12, 98, 22);
    ctx.quadraticCurveTo(106, 48, 88, 64);
    ctx.quadraticCurveTo(50, 68, 16, 50);
    ctx.closePath();
    ctx.fill();

    // Gai lưng rồng tiền sử
    ctx.fillStyle = '#14532d';
    for (let i = 0; i < 6; i++) {
      const gx = 24 + i * 12;
      ctx.beginPath();
      ctx.moveTo(gx, 18);
      ctx.lineTo(gx + 3, 10);
      ctx.lineTo(gx + 6, 18);
      ctx.closePath();
      ctx.fill();
    }

    scene.textures.addCanvas('part_trex_body', canvas);
  }

  /** Chân Trụ T-Rex Khổng Lồ */
  private createTRexLegUpperTexture(scene: any): void {
    if (scene.textures.exists('part_trex_leg_upper')) return;

    const w = 44;
    const h = 54;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.ellipse(22, 26, 16, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    scene.textures.addCanvas('part_trex_leg_upper', canvas);
  }

  private createTRexLegLowerTexture(scene: any): void {
    if (scene.textures.exists('part_trex_leg_lower')) return;

    const w = 40;
    const h = 54;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#166534';
    ctx.beginPath();
    ctx.moveTo(12, 4);
    ctx.lineTo(28, 4);
    ctx.lineTo(26, 38);
    ctx.lineTo(10, 38);
    ctx.closePath();
    ctx.fill();

    // 3 Móng vuốt khổng lồ
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(6, 42);
    ctx.lineTo(4, 50);
    ctx.lineTo(12, 44);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(16, 44);
    ctx.lineTo(18, 52);
    ctx.lineTo(22, 44);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(26, 42);
    ctx.lineTo(32, 50);
    ctx.lineTo(28, 44);
    ctx.closePath();
    ctx.fill();

    scene.textures.addCanvas('part_trex_leg_lower', canvas);
  }

  /** Đuôi T-Rex */
  private createTRexTailTexture(scene: any): void {
    if (scene.textures.exists('part_trex_tail')) return;

    const w = 70;
    const h = 40;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.moveTo(4, 28);
    ctx.quadraticCurveTo(34, 30, 66, 8);
    ctx.lineTo(60, 4);
    ctx.quadraticCurveTo(30, 20, 4, 16);
    ctx.closePath();
    ctx.fill();

    scene.textures.addCanvas('part_trex_tail', canvas);
  }

  // =========================================================================
  // 4. MÔI TRƯỜNG & BÓNG ĐỔ MỀM
  // =========================================================================

  /** Bóng đổ mềm (Soft Ellipse Shadow) mờ dần ra viền */
  private createSoftShadowTexture(scene: any): void {
    if (scene.textures.exists('soft_shadow_ellipse')) return;

    const w = 64;
    const h = 32;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
    grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.2)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2);
    ctx.fill();

    scene.textures.addCanvas('soft_shadow_ellipse', canvas);
  }

  /** Nền đất giấy da cổ kết hợp khóm cỏ xanh tươi nhiều sắc độ & hoa dại */
  private createLushGrassGroundTexture(scene: any): void {
    if (scene.textures.exists('lush_grass_ground_tile')) return;

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Nền đất giấy da cổ
    ctx.fillStyle = '#1c1612';
    ctx.fillRect(0, 0, size, size);

    const grad = ctx.createRadialGradient(size / 2, size / 2, 50, size / 2, size / 2, size / 1.3);
    grad.addColorStop(0, '#241b14');
    grad.addColorStop(1, '#16100c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Vẽ các khóm cỏ xanh tươi nhiều sắc độ (Emerald, Forest, Lime)
    const grassColors = ['#15803d', '#16a34a', '#22c55e', '#4ade80', '#65a30d'];
    for (let i = 0; i < 110; i++) {
      const gx = ((Math.sin(i * 7919) * 0.5 + 0.5) * size);
      const gy = ((Math.cos(i * 6271) * 0.5 + 0.5) * size);
      const col = grassColors[i % grassColors.length];

      ctx.fillStyle = col;
      // Khóm cỏ gồm 3-4 cọng vươn lên
      for (let b = -1; b <= 1; b++) {
        ctx.beginPath();
        ctx.moveTo(gx + b * 2, gy);
        ctx.quadraticCurveTo(gx + b * 4, gy - 7, gx + b * 5, gy - 11);
        ctx.quadraticCurveTo(gx + b * 2, gy - 6, gx + b * 2 + 1, gy);
        ctx.fill();
      }
    }

    // Hoa dại nhỏ trắng và vàng rải rác
    for (let i = 0; i < 30; i++) {
      const fx = ((Math.sin(i * 3571) * 0.5 + 0.5) * size);
      const fy = ((Math.cos(i * 4831) * 0.5 + 0.5) * size);
      ctx.fillStyle = i % 2 === 0 ? '#fef08a' : '#ffffff';
      ctx.beginPath();
      ctx.arc(fx, fy, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    scene.textures.addCanvas('lush_grass_ground_tile', canvas);
  }
}
