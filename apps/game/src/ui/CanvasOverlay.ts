// ====================================================
// MODULE: CanvasOverlay.ts — SINGLE 2D HUD CANVAS OVERLAY (ZERO DOM REFELOW)
// ====================================================

export class CanvasOverlay {
  constructor(canvasId = 'hud-canvas') {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.id = canvasId;
      this.canvas.style.position = 'fixed';
      this.canvas.style.inset = '0';
      this.canvas.style.width = '100vw';
      this.canvas.style.height = '100vh';
      this.canvas.style.pointerEvents = 'none';
      this.canvas.style.zIndex = '12';
      document.body.appendChild(this.canvas);
    }
    this.ctx = this.canvas.getContext('2d');
    this.poolSize = 64;
    this.popups = [];
    this.hpBars = [];
    this._projVec = new THREE.Vector3();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * (window.devicePixelRatio > 1 ? 1.5 : 1);
    this.canvas.height = this.height * (window.devicePixelRatio > 1 ? 1.5 : 1);
    this.scale = window.devicePixelRatio > 1 ? 1.5 : 1;
  }

  spawnText(text, worldPos, type = 'normal') {
    const expiresAt = performance.now() + 850;
    this.popups.push({
      text,
      worldPos: worldPos.clone(),
      type,
      spawnTime: performance.now(),
      expiresAt
    });
    if (this.popups.length > this.poolSize) {
      this.popups.shift();
    }
  }

  render(camera, now = performance.now()) {
    if (!this.ctx || !camera) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.scale, this.scale);
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Vẽ các Damage Popups & Floating Text
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      if (now >= p.expiresAt) {
        this.popups.splice(i, 1);
        continue;
      }

      this._projVec.copy(p.worldPos).project(camera);
      if (this._projVec.z > 1.0) continue; // Sau lưng camera

      const sx = (this._projVec.x * 0.5 + 0.5) * this.width;
      const progress = (now - p.spawnTime) / (p.expiresAt - p.spawnTime);
      const sy = (-(this._projVec.y * 0.5) + 0.5) * this.height - (progress * 38);
      const alpha = Math.max(0, 1 - progress);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (p.type === 'dmg-crit' || p.type === 'dmg-popup--crit') {
        ctx.font = '900 15px sans-serif';
        ctx.fillStyle = '#fef08a';
        ctx.strokeStyle = '#b45309';
      } else if (p.type === 'dmg-player' || p.type === 'dmg-popup--player') {
        ctx.font = '900 13.5px sans-serif';
        ctx.fillStyle = '#f87171';
        ctx.strokeStyle = '#7f1d1d';
      } else if (p.type === 'wood' || p.type === 'dmg-popup--wood') {
        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = '#86efac';
        ctx.strokeStyle = '#14532d';
      } else if (p.type === 'food' || p.type === 'dmg-popup--food') {
        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = '#fde047';
        ctx.strokeStyle = '#78350f';
      } else {
        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#0f172a';
      }

      ctx.lineWidth = 3;
      ctx.strokeText(p.text, sx, sy);
      ctx.fillText(p.text, sx, sy);
      ctx.restore();
    }

    ctx.restore();
  }
}
