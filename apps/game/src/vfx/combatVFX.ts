/**
 * combatVFX.ts
 * Hệ thống Hiệu ứng Chiến đấu & Thị giác (Combat VFX)
 * Vẽ Vệt chém cận chiến (Melee Slashes), Tia sáng va chạm (Impact Sparks),
 * Hướng tên / giáo bay (Active Projectiles), và Tia ngắm bắn / Nón kỹ năng (Aiming Indicator).
 */

export interface MeleeSlash {
  id: string;
  x: number;
  y: number;
  angle: number; // Hướng chém
  radius: number;
  life: number; // 1.0 -> 0.0
  color: string;
}

export interface ImpactSpark {
  id: string;
  x: number;
  y: number;
  life: number;
  particles: { vx: number; vy: number; len: number; color: string }[];
}

export interface ActiveProjectile {
  id: string;
  startX: number;
  startY: number;
  curX: number;
  curY: number;
  targetX: number;
  targetY: number;
  speed: number;
  kind: 'spear' | 'arrow';
}

export class CombatVFXSystem {
  private slashes: MeleeSlash[] = [];
  private sparks: ImpactSpark[] = [];
  private projectiles: ActiveProjectile[] = [];

  /** Kích hoạt vệt chém cận chiến */
  public addSlash(x: number, y: number, angle: number, radius: number = 36, color: string = '#ea580c'): void {
    this.slashes.push({
      id: Math.random().toString(),
      x,
      y,
      angle,
      radius,
      life: 1.0,
      color,
    });
  }

  /** Kích hoạt chùm tia sáng va chạm tóe lửa */
  public addImpactSparks(x: number, y: number, count: number = 10): void {
    const particles = [];
    const colors = ['#ffffff', '#fef08a', '#f59e0b', '#dc2626'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 2.0 + Math.random() * 4.0;
      particles.push({
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        len: 4 + Math.random() * 8,
        color: colors[i % colors.length],
      });
    }
    this.sparks.push({
      id: Math.random().toString(),
      x,
      y,
      life: 1.0,
      particles,
    });
  }

  /** Phóng ngọn giáo hoặc mũi tên */
  public addProjectile(startX: number, startY: number, targetX: number, targetY: number, kind: 'spear' | 'arrow' = 'spear'): void {
    this.projectiles.push({
      id: Math.random().toString(),
      startX,
      startY,
      curX: startX,
      curY: startY,
      targetX,
      targetY,
      speed: 12,
      kind,
    });
  }

  public update(dt: number): void {
    // Cập nhật vệt chém
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      this.slashes[i].life -= 0.08;
      if (this.slashes[i].life <= 0) {
        this.slashes.splice(i, 1);
      }
    }

    // Cập nhật tia sáng va chạm
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= 0.09;
      for (const p of s.particles) {
        p.vx *= 0.92;
        p.vy *= 0.92;
      }
      if (s.life <= 0) {
        this.sparks.splice(i, 1);
      }
    }

    // Cập nhật đạn đạo
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const dx = p.targetX - p.curX;
      const dy = p.targetY - p.curY;
      const dist = Math.hypot(dx, dy);

      if (dist <= p.speed) {
        // Trúng đích -> Tạo tia va chạm
        this.addImpactSparks(p.targetX, p.targetY, 12);
        this.projectiles.splice(i, 1);
      } else {
        p.curX += (dx / dist) * p.speed;
        p.curY += (dy / dist) * p.speed;
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number): void {
    ctx.save();

    // 1. VẼ CÁC VỆT CHÉM CẬN CHIẾN (Melee Slashes — Trăng Khuyết Rực Rỡ)
    for (const slash of this.slashes) {
      ctx.save();
      ctx.translate(slash.x, slash.y);
      ctx.rotate(slash.angle);

      const r = slash.radius * dpr;
      const arcLen = Math.PI * 0.75;
      const alpha = Math.max(0, slash.life);

      // Vệt chém phát sáng
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
      ctx.lineWidth = 4.0 * dpr * slash.life;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, r, -arcLen / 2, arcLen / 2);
      ctx.stroke();

      // Viền hào quang lửa đỏ/vàng
      ctx.strokeStyle = `rgba(234, 88, 12, ${alpha * 0.75})`;
      ctx.lineWidth = 8.0 * dpr * slash.life;
      ctx.beginPath();
      ctx.arc(0, 0, r, -arcLen / 2, arcLen / 2);
      ctx.stroke();

      ctx.restore();
    }

    // 2. VẼ TIA SÁNG VA CHẠM (Impact Sparks)
    for (const spark of this.sparks) {
      ctx.save();
      ctx.translate(spark.x, spark.y);
      const alpha = Math.max(0, spark.life);

      for (const p of spark.particles) {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 1.8 * dpr;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(p.vx * p.len * (1.2 - spark.life), p.vy * p.len * (1.2 - spark.life));
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. VẼ ĐẠN ĐẠO ĐANG BAY (Active Projectiles)
    for (const proj of this.projectiles) {
      ctx.save();
      ctx.translate(proj.curX, proj.curY);
      const angle = Math.atan2(proj.targetY - proj.startY, proj.targetX - proj.startX);
      ctx.rotate(angle);

      // Thân ngọn giáo / mũi tên
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-16 * dpr, -1.5 * dpr, 32 * dpr, 3 * dpr);
      // Mũi giáo phát sáng
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(16 * dpr, -3 * dpr); ctx.lineTo(24 * dpr, 0); ctx.lineTo(16 * dpr, 3 * dpr);
      ctx.closePath();
      ctx.fill();

      // Vệt khói lướt theo sau
      ctx.strokeStyle = 'rgba(254, 240, 138, 0.45)';
      ctx.lineWidth = 2.0 * dpr;
      ctx.beginPath();
      ctx.moveTo(-16 * dpr, 0); ctx.lineTo(-32 * dpr, 0);
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  }

  /** Vẽ Nón ngắm bắn / Hướng chỉ kỹ năng (Aiming Indicator) */
  public renderAimingCone(
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
    aimAngle: number,
    rangePx: number,
    coneAngle: number = Math.PI / 4,
  ): void {
    ctx.save();
    ctx.translate(originX, originY);
    ctx.rotate(aimAngle);

    const aimGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, rangePx);
    aimGrad.addColorStop(0, 'rgba(239, 68, 68, 0.45)');
    aimGrad.addColorStop(0.7, 'rgba(234, 88, 12, 0.2)');
    aimGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = aimGrad;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, rangePx, -coneAngle / 2, coneAngle / 2);
    ctx.closePath();
    ctx.fill();

    // Tia định hướng ở giữa
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.0;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(rangePx, 0);
    ctx.stroke();

    ctx.restore();
  }
}
