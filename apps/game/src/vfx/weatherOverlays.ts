/**
 * weatherOverlays.ts
 * Hệ thống Lớp phủ Thời tiết (Weather Overlays)
 * Hỗ trợ 3 lớp phủ hiệu ứng chuyên biệt:
 * 1. Mưa (Rain): Hạt mưa rơi nghiêng + Vũng nước phản chiếu + Gợn sóng đồng tâm.
 * 2. Tuyết (Snow): Bông tuyết rơi chậm, lắc lư nhẹ theo gió.
 * 3. Sương mù (Mist): Lớp mờ ảo bồng bềnh làm dịu mát khung cảnh hoang cổ.
 */

export type WeatherType = 'clear' | 'rain' | 'snow' | 'mist';

export class WeatherOverlaySystem {
  public weatherType: WeatherType = 'clear';
  public intensity: number = 1.0; // 0.0 -> 1.0
  private tick: number = 0;

  public setWeather(type: WeatherType, intensity: number = 1.0): void {
    this.weatherType = type;
    this.intensity = Math.max(0, Math.min(1, intensity));
  }

  public update(dt: number, tick: number): void {
    this.tick = tick;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number): void {
    if (this.weatherType === 'clear' || this.intensity <= 0) return;

    ctx.save();

    if (this.weatherType === 'rain') {
      this.renderRainOverlay(ctx, width, height, dpr);
    } else if (this.weatherType === 'snow') {
      this.renderSnowOverlay(ctx, width, height, dpr);
    } else if (this.weatherType === 'mist') {
      this.renderMistOverlay(ctx, width, height, dpr);
    }

    ctx.restore();
  }

  /** 1. LỚP PHỦ MƯA (Rain Overlay) */
  private renderRainOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number): void {
    const t = this.tick;

    // A. Vũng nước đọng mặt đất phản chiếu sắc lam bầu trời
    const puddleCount = 6;
    for (let i = 0; i < puddleCount; i++) {
      const pSeed = i * 317.8 + 52.4;
      const px = (pSeed * 113.7) % w;
      const py = (pSeed * 79.1) % h;
      const pRadX = (18 + (i % 4) * 8) * dpr;
      const pRadY = pRadX * 0.42;

      // Viền đất ướt
      ctx.fillStyle = `rgba(25, 45, 20, ${0.18 * this.intensity})`;
      ctx.beginPath();
      ctx.ellipse(px, py, pRadX + 3 * dpr, pRadY + 2 * dpr, 0.05 * i, 0, Math.PI * 2);
      ctx.fill();

      // Mặt nước phản chiếu
      const puddleGrad = ctx.createLinearGradient(px - pRadX, py - pRadY, px + pRadX, py + pRadY);
      puddleGrad.addColorStop(0, `rgba(186, 230, 253, ${0.28 * this.intensity})`);
      puddleGrad.addColorStop(0.5, `rgba(125, 211, 252, ${0.38 * this.intensity})`);
      puddleGrad.addColorStop(1, `rgba(56, 189, 248, ${0.22 * this.intensity})`);
      ctx.fillStyle = puddleGrad;
      ctx.beginPath();
      ctx.ellipse(px, py, pRadX, pRadY, 0.05 * i, 0, Math.PI * 2);
      ctx.fill();

      // Gợn sóng đồng tâm lan tỏa
      for (let r = 0; r < 2; r++) {
        const ripplePhase = (t * 0.035 + i * 0.28 + r * 0.5) % 1;
        const rRadius = ripplePhase * pRadX * 0.85;
        const rAlpha = (1 - ripplePhase) * 0.45 * this.intensity;

        ctx.strokeStyle = `rgba(224, 242, 254, ${rAlpha})`;
        ctx.lineWidth = 0.9 * dpr;
        ctx.beginPath();
        ctx.ellipse(px, py, rRadius, rRadius * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // B. Giọt mưa rơi nghiêng nhẹ
    const dropCount = Math.round(32 * this.intensity);
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.35)';
    ctx.lineWidth = 0.85 * dpr;
    ctx.beginPath();
    for (let i = 0; i < dropCount; i++) {
      const seed = i * 137.508 + 19.1;
      const rx = ((seed * 73.1 + t * 1.5) % w + w) % w;
      const ry = ((seed * 41.3 + t * 8.5) % h + h) % h;
      const len = (8 + (i % 3) * 3) * dpr;

      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 1.5 * dpr, ry + len);
    }
    ctx.stroke();

    // C. Màn sương mưa mỏng
    ctx.fillStyle = `rgba(186, 230, 253, ${0.04 * this.intensity})`;
    ctx.fillRect(0, 0, w, h);
  }

  /** 2. LỚP PHỦ TUYẾT (Snow Overlay — Bông tuyết rơi chậm, lắc lư nhẹ) */
  private renderSnowOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number): void {
    const t = this.tick;
    const flakeCount = Math.round(45 * this.intensity);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    for (let i = 0; i < flakeCount; i++) {
      const seed = i * 179.3 + 23.5;
      const sway = Math.sin(t * 0.03 + i) * 14 * dpr;
      const rx = ((seed * 83.7 + sway) % w + w) % w;
      const ry = ((seed * 51.2 + t * 1.8) % h + h) % h;
      const size = (1.5 + (i % 3) * 1.2) * dpr;

      ctx.beginPath();
      ctx.arc(rx, ry, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Lớp phủ lạnh giá nhạt
    ctx.fillStyle = `rgba(241, 245, 249, ${0.05 * this.intensity})`;
    ctx.fillRect(0, 0, w, h);
  }

  /** 3. LỚP PHỦ SƯƠNG MÙ (Mist Overlay — Dải mây mờ ảo bồng bềnh) */
  private renderMistOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number): void {
    const t = this.tick;
    const bandCount = 4;

    for (let i = 0; i < bandCount; i++) {
      const mistOffset = ((t * 0.4 + i * (w / bandCount)) % (w * 1.5)) - w * 0.25;
      const mistY = (h / bandCount) * i + Math.sin(t * 0.02 + i) * 20 * dpr;
      const mistW = w * 0.6;
      const mistH = 80 * dpr;

      const mistGrad = ctx.createRadialGradient(mistOffset + mistW / 2, mistY, 10, mistOffset + mistW / 2, mistY, mistW / 2);
      mistGrad.addColorStop(0, `rgba(241, 245, 249, ${0.12 * this.intensity})`);
      mistGrad.addColorStop(0.6, `rgba(226, 232, 240, ${0.06 * this.intensity})`);
      mistGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = mistGrad;
      ctx.beginPath();
      ctx.ellipse(mistOffset + mistW / 2, mistY, mistW / 2, mistH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
