/**
 * Chế độ Chụp Ảnh Thực Tế Tăng Cường AR với Linh Thú & Quái Vật Tiền Sử (Phụ lục B).
 * Hoạt động 100% offline trên trình duyệt và Android WebView camera.
 */

export interface ARState {
  stream: MediaStream | null;
  videoEl: HTMLVideoElement | null;
  canvasEl: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  activeModel: 'saber_cub' | 'baby_mammoth' | 'ancient_hawk' | 'boss_shadow';
  modelScale: number;
  modelX: number;
  modelY: number;
  locationNameVi: string;
  isStreaming: boolean;
}

let arState: ARState = {
  stream: null,
  videoEl: null,
  canvasEl: null,
  ctx: null,
  activeModel: 'saber_cub',
  modelScale: 1.0,
  modelX: 0.5,
  modelY: 0.65,
  locationNameVi: 'Vùng Đất Hoang Cổ Hà Nội',
  isStreaming: false,
};

let animFrameId = 0;
let tick = 0;

/**
 * Khởi động Camera AR
 */
export async function startARCamera(
  videoElement: HTMLVideoElement,
  canvasElement: HTMLCanvasElement,
  locationNameVi = 'Hà Nội Tiền Sử',
): Promise<{ ok: boolean; messageVi: string }> {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { ok: false, messageVi: 'Thiết bị không hỗ trợ Camera Web/AR.' };
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    videoElement.srcObject = stream;
    await videoElement.play();

    arState.stream = stream;
    arState.videoEl = videoElement;
    arState.canvasEl = canvasElement;
    arState.ctx = canvasElement.getContext('2d');
    arState.locationNameVi = locationNameVi;
    arState.isStreaming = true;

    // Bắt đầu vòng lặp vẽ AR overlay
    loopAR();

    return { ok: true, messageVi: 'Đã mở Camera AR tiền sử thành công!' };
  } catch (err: any) {
    return { ok: false, messageVi: `Không thể mở Camera: ${err?.message || 'Quyền camera bị từ chối'}` };
  }
}

/**
 * Dừng Camera AR và giải phóng tài nguyên
 */
export function stopARCamera(): void {
  arState.isStreaming = false;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = 0;
  }

  if (arState.stream) {
    arState.stream.getTracks().forEach((track) => track.stop());
    arState.stream = null;
  }
  if (arState.videoEl) {
    arState.videoEl.srcObject = null;
  }
}

/**
 * Đổi mô hình thú cưng / quái thú hiển thị trên AR
 */
export function setARModel(model: 'saber_cub' | 'baby_mammoth' | 'ancient_hawk' | 'boss_shadow'): void {
  arState.activeModel = model;
}

/**
 * Vòng lặp vẽ mô hình thú cưng lên khung hình Camera
 */
function loopAR(): void {
  if (!arState.isStreaming || !arState.canvasEl || !arState.ctx || !arState.videoEl) return;

  const { canvasEl, ctx, videoEl } = arState;
  const w = canvasEl.width;
  const h = canvasEl.height;

  tick++;
  ctx.clearRect(0, 0, w, h);

  const cx = arState.modelX * w;
  const cy = arState.modelY * h;
  const scale = arState.modelScale * Math.min(w, h) * 0.28;

  // 1. Bóng đổ trên mặt đất thực tế
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + scale * 0.35, scale * 0.6, scale * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. Vẽ mô hình động
  ctx.save();
  ctx.translate(cx, cy);

  if (arState.activeModel === 'saber_cub') {
    drawARSaberCub(ctx, scale, tick);
  } else if (arState.activeModel === 'baby_mammoth') {
    drawARMammoth(ctx, scale, tick);
  } else if (arState.activeModel === 'ancient_hawk') {
    drawARHawk(ctx, scale, tick);
  } else {
    drawARBossShadow(ctx, scale, tick);
  }

  ctx.restore();

  // 3. Khung nhắm & Watermark
  drawARWatermark(ctx, w, h, arState.locationNameVi);

  animFrameId = requestAnimationFrame(loopAR);
}

function drawARSaberCub(ctx: CanvasRenderingContext2D, s: number, t: number): void {
  const breath = Math.sin(t / 12) * s * 0.03;
  // Thân hổ
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.1 + breath, s * 0.45, s * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  // Vằn hổ
  ctx.fillStyle = '#78350f';
  for (let i = -2; i <= 2; i++) {
    ctx.fillRect(i * s * 0.12 - s * 0.02, -s * 0.3 + breath, s * 0.04, s * 0.25);
  }

  // Đầu hổ
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(s * 0.28, -s * 0.3 + breath * 1.5, s * 0.22, 0, Math.PI * 2);
  ctx.fill();

  // Tai
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.arc(s * 0.22, -s * 0.5 + breath * 1.5, s * 0.08, 0, Math.PI * 2);
  ctx.arc(s * 0.38, -s * 0.5 + breath * 1.5, s * 0.08, 0, Math.PI * 2);
  ctx.fill();

  // Mắt to tròn dễ thương
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(s * 0.35, -s * 0.32 + breath * 1.5, s * 0.04, 0, Math.PI * 2);
  ctx.fill();

  // Răng kiếm trắng muốt
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(s * 0.38, -s * 0.2 + breath * 1.5);
  ctx.lineTo(s * 0.36, -s * 0.02 + breath * 1.5);
  ctx.lineTo(s * 0.42, -s * 0.2 + breath * 1.5);
  ctx.fill();
}

function drawARMammoth(ctx: CanvasRenderingContext2D, s: number, t: number): void {
  const sway = Math.sin(t / 15) * s * 0.04;
  // Thân voi
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.15 + sway, s * 0.5, s * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();

  // Đầu
  ctx.beginPath();
  ctx.arc(s * 0.32, -s * 0.35 + sway, s * 0.26, 0, Math.PI * 2);
  ctx.fill();

  // Tai to
  ctx.fillStyle = '#5c2d10';
  ctx.beginPath();
  ctx.ellipse(s * 0.2, -s * 0.35 + sway, s * 0.12, s * 0.18, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Vòi voi uốn lượn
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = s * 0.08;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(s * 0.45, -s * 0.3 + sway);
  ctx.quadraticCurveTo(s * 0.65, -s * 0.1 + sway, s * 0.55 + Math.sin(t / 10) * s * 0.1, s * 0.05 + sway);
  ctx.stroke();

  // Ngà voi cong vút
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = s * 0.04;
  ctx.beginPath();
  ctx.moveTo(s * 0.4, -s * 0.25 + sway);
  ctx.quadraticCurveTo(s * 0.58, -s * 0.28 + sway, s * 0.52, -s * 0.4 + sway);
  ctx.stroke();
}

function drawARHawk(ctx: CanvasRenderingContext2D, s: number, t: number): void {
  const wing = Math.sin(t / 4) * s * 0.3;
  // Linh điểu bay lượn
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.35 + Math.sin(t / 8) * s * 0.1, s * 0.25, s * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cánh chim
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(-s * 0.1, -s * 0.35);
  ctx.lineTo(-s * 0.6, -s * 0.35 + wing);
  ctx.lineTo(0, -s * 0.2);
  ctx.lineTo(s * 0.6, -s * 0.35 + wing);
  ctx.lineTo(s * 0.1, -s * 0.35);
  ctx.closePath();
  ctx.fill();
}

function drawARBossShadow(ctx: CanvasRenderingContext2D, s: number, t: number): void {
  const pulse = 1 + Math.sin(t / 8) * 0.06;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.beginPath();
  ctx.arc(0, -s * 0.4, s * 0.45 * pulse, 0, Math.PI * 2);
  ctx.fill();

  // Mắt đỏ phát sáng
  ctx.fillStyle = '#ef4444';
  ctx.shadowColor = '#dc2626';
  ctx.shadowBlur = s * 0.15;
  ctx.beginPath();
  ctx.arc(-s * 0.15, -s * 0.42, s * 0.05, 0, Math.PI * 2);
  ctx.arc(s * 0.15, -s * 0.42, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawARWatermark(ctx: CanvasRenderingContext2D, w: number, h: number, locationName: string): void {
  ctx.save();
  ctx.fillStyle = 'rgba(10, 8, 6, 0.75)';
  ctx.fillRect(16, h - 56, Math.min(w - 32, 340), 40);
  ctx.strokeStyle = 'rgba(224, 122, 60, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(16, h - 56, Math.min(w - 32, 340), 40);

  ctx.fillStyle = '#f1daa7';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`📸 ${locationName}`, 26, h - 38);

  ctx.fillStyle = '#a8a29e';
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText('KỶ NGUYÊN HOANG CỔ · AR PHOTO', 26, h - 22);
  ctx.restore();
}

/**
 * Chụp ảnh AR ghép video camera + canvas thành file ảnh PNG tải về
 */
export function captureARPhoto(): string | null {
  if (!arState.videoEl || !arState.canvasEl) return null;

  const w = arState.canvasEl.width;
  const h = arState.canvasEl.height;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return null;

  // Vẽ hình từ camera
  outCtx.drawImage(arState.videoEl, 0, 0, w, h);
  // Vẽ lớp thú cưng AR
  outCtx.drawImage(arState.canvasEl, 0, 0, w, h);

  return outCanvas.toDataURL('image/png');
}
