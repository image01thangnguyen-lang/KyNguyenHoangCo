/**
 * Renderer bản đồ "tiền sử hoá" — vẽ thẳng lên canvas, không SDK bản đồ, không tile online
 * (§4.1 bản 2.0).
 *
 * Bản đồ này KHÔNG cố vẽ lại thế giới thật cho chính xác. Nó vẽ thế giới thật NHÌN QUA MẮT
 * người tiền sử: đường sá thành lối mòn đất, ô lưới thành thảm cỏ, POI thành rặng cây và
 * vũng nước. Đó vừa là phong cách, vừa là lý do gói dữ liệu offline chỉ cần vài MB.
 *
 * Mọi hình dạng sinh từ hàm băm toạ độ nên cùng một chỗ luôn trông giống nhau qua các phiên,
 * và hai người chơi đứng cạnh nhau thấy đúng một cảnh.
 */

import { createRng, hashSeed } from '../../../packages/game-core/src/rng.ts';
import {
  distanceMeters,
  metersToLatDegrees,
  metersToLonDegrees,
} from '../../../packages/game-core/src/world.ts';
import type { LatLon, MapFeature, PlacedTrap } from '../../../packages/game-core/src/index.ts';
import type { WeatherToday } from '../../../packages/game-core/src/weather.ts';
import type { Phase } from '../../../packages/game-core/src/time.ts';

export interface WorldDrop {
  id: string;
  itemId: string;
  nameVi: string;
  qty: number;
  lat: number;
  lon: number;
  spawnedAtMs: number;
}

export interface RenderInput {
  center: LatLon;
  features: MapFeature[];
  phase: Phase;
  weather: WeatherToday;
  /** Giới tính của nhân vật để vẽ đúng trang phục/hình tượng thổ dân. */
  gender?: 'male' | 'female';
  /** Bán kính hiển thị theo mét — mép ngắn của canvas phủ khoảng chừng này. */
  spanMeters?: number;
  /** Người chơi có toạ độ thật hay đang dùng vị trí mặc định. */
  hasFix: boolean;
  homeCellCenter?: LatLon | null;
  /** POI đang chạm được (trong bán kính tương tác). */
  activePoiId?: string | null;
  /** Các vật phẩm đang rơi trên mặt đất quanh người chơi để nhặt trực tiếp. */
  drops?: WorldDrop[];
  /** Danh sách các bẫy thú đang đặt trên thế giới. */
  traps?: PlacedTrap[];
}

export function itemEmoji(id: string): string {
  switch (id) {
    case 'dry_branch':
    case 'log':
    case 'wood':
      return '🪵';
    case 'sharp_stone':
    case 'stone_block':
    case 'flint':
    case 'stone':
      return '🪨';
    case 'coal':
      return '⬛';
    case 'gold_ore':
      return '✨';
    case 'iron_ore':
    case 'iron_ingot':
      return '⛓️';
    case 'wild_berries':
    case 'berries':
    case 'wild_berry':
    case 'fruit':
      return '🍓';
    case 'medicinal_herb':
    case 'herbs':
    case 'mushroom':
    case 'red_mushroom':
      return '🍄';
    case 'raw_water':
    case 'clean_water':
    case 'boiled_water':
    case 'water':
      return '💧';
    case 'raw_meat':
    case 'cooked_meat':
    case 'grilled_meat':
    case 'meat':
    case 'dried_meat':
      return '🍖';
    case 'raw_fish':
    case 'grilled_fish':
    case 'fish':
      return '🐟';
    case 'fiber':
    case 'vine':
    case 'rope':
      return '🌾';
    case 'clay':
    case 'fired_brick':
    case 'clay_pot':
      return '🏺';
    case 'feather':
      return '🪶';
    case 'leather':
    case 'fur':
      return '🥋';
    case 'ancient_coin':
      return '🪙';
    case 'rabbit_trap':
      return '🪤';
    case 'deer_trap':
      return '🦌';
    case 'beast_trap':
      return '🐺';
    case 'spike_trap':
      return '📌';
    case 'stone_axe':
    case 'iron_axe':
      return '🪓';
    case 'stone_spear':
    case 'iron_spear':
      return '🗡️';
    case 'torch':
      return '🔥';
    default:
      return '📦';
  }
}

const PALETTE = {
  day: { ground: '#5c8e1d', grass: '#6ba828', dirt: '#a16207', trail: '#854d0e' },
  evening: { ground: '#3d5218', grass: '#4b611e', dirt: '#713f12', trail: '#543820' },
  night: { ground: '#0d140e', grass: '#141d16', dirt: '#27170a', trail: '#1c130c' },
} as const;

export class MapView {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private tick = 0;

  // Trạng thái kéo bản đồ tự do (Pan / Drag)
  private panX = 0;
  private panY = 0;
  private isDragging = false;
  private lastPointer: { x: number; y: number } | null = null;
  private pointerDownPos: { x: number; y: number } | null = null;
  private pointerDownTime = 0;
  private lastInput: RenderInput | null = null;
  private lastProject: ((at: LatLon) => [number, number]) | null = null;

  /** Callback khi trạng thái kéo bản đồ thay đổi (đang xem tự do hay ở vị trí nhân vật). */
  onPanChange?: (isPanned: boolean) => void;
  /** Callback khi chạm vào một món đồ rơi trên bản đồ để nhặt. */
  onDropClick?: (drop: WorldDrop) => void;
  /** Callback khi chạm vào bẫy thú trên bản đồ để thu hoạch. */
  onTrapClick?: (trap: PlacedTrap) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Trình duyệt không hỗ trợ canvas 2D.');
    this.ctx = ctx;

    // Bắt sự kiện kéo / vuốt bản đồ tự do
    canvas.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
      this.pointerDownTime = performance.now();
      canvas.setPointerCapture?.(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this.isDragging || !this.lastPointer) return;

      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      this.lastPointer = { x: e.clientX, y: e.clientY };

      const wasPanned = this.isPanned();
      this.panX += dx * this.dpr;
      this.panY += dy * this.dpr;

      const nowPanned = this.isPanned();
      if (wasPanned !== nowPanned) {
        this.onPanChange?.(nowPanned);
      }
    });

    const endDrag = (e: PointerEvent) => {
      if (!this.isDragging) return;
      this.isDragging = false;

      const duration = performance.now() - this.pointerDownTime;
      const dist = this.pointerDownPos
        ? Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y)
        : 999;

      // Nếu kéo nhích rất ít (< 8px) và thời gian ngắn (< 350ms) thì coi là cú chạm/click!
      if (dist < 8 && duration < 350 && this.lastProject) {
        const rect = canvas.getBoundingClientRect();
        const clickX = (e.clientX - rect.left) * this.dpr;
        const clickY = (e.clientY - rect.top) * this.dpr;

        // 1. Kiểm tra click vào bẫy thú trước
        if (this.lastInput?.traps) {
          let nearestTrap: PlacedTrap | null = null;
          let minTrapDist = 36 * this.dpr;

          for (const trap of this.lastInput.traps) {
            const [tx, ty] = this.lastProject({ lat: trap.lat, lon: trap.lon });
            const d = Math.hypot(clickX - tx, clickY - ty);
            if (d < minTrapDist) {
              minTrapDist = d;
              nearestTrap = trap;
            }
          }

          if (nearestTrap) {
            this.onTrapClick?.(nearestTrap);
            this.lastPointer = null;
            this.pointerDownPos = null;
            return;
          }
        }

        // 2. Tìm món đồ gần điểm chạm nhất trong bán kính 30px
        if (this.lastInput?.drops) {
          let nearestDrop: WorldDrop | null = null;
          let minDropDist = 32 * this.dpr;

          for (const drop of this.lastInput.drops) {
            const [dx, dy] = this.lastProject({ lat: drop.lat, lon: drop.lon });
            const d = Math.hypot(clickX - dx, clickY - dy);
            if (d < minDropDist) {
              minDropDist = d;
              nearestDrop = drop;
            }
          }

          if (nearestDrop) {
            this.onDropClick?.(nearestDrop);
          }
        }
      }

      this.lastPointer = null;
      this.pointerDownPos = null;
    };

    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
  }

  /** Kiểm tra xem bản đồ có đang bị kéo lệch khỏi tâm nhân vật hay không. */
  isPanned(): boolean {
    return Math.hypot(this.panX, this.panY) > 25 * this.dpr;
  }

  /** Đưa bản đồ mượt mà quay trở lại vị trí trung tâm nhân vật. */
  recenter(): void {
    this.panX = 0;
    this.panY = 0;
    this.onPanChange?.(false);
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    // Giới hạn devicePixelRatio ở 2: máy Android tầm trung có dpr 3–4, vẽ đủ 4× là tụt fps
    // mà mắt thường không phân biệt được trên bản đồ cách điệu này.
    this.dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
  }

  render(input: RenderInput): void {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w < 2 || h < 2) return;

    this.tick++;
    this.lastInput = input;

    const spanMeters = input.spanMeters ?? 420;
    const pxPerMeter = Math.min(w, h) / spanMeters;
    const palette = PALETTE[input.phase];

    const project = (at: LatLon): [number, number] => {
      const dx = (at.lon - input.center.lon) / metersToLonDegrees(1, input.center.lat);
      const dy = (at.lat - input.center.lat) / metersToLatDegrees(1);
      return [w / 2 + dx * pxPerMeter + this.panX, h / 2 - dy * pxPerMeter + this.panY];
    };
    this.lastProject = project;

    ctx.save();
    this.drawGround(w, h, palette, input, project, pxPerMeter);
    this.drawTrailGrid(w, h, pxPerMeter, palette, input.center);

    // Vẽ các dòng sông lớn tự nhiên chảy qua Hà Nội (Sông Hồng, Sông Đuống, Sông Tô Lịch, Sông Đáy)
    this.drawNaturalRivers(project, pxPerMeter, input.phase);

    // Vẽ theo lớp: nước dưới cùng, rừng giữa, thương nhân trên — tránh cây che mất mép hồ.
    const order: MapFeature['zone'][] = ['water', 'wilderness', 'forest', 'merchant', 'trail'];
    for (const zone of order) {
      for (const feature of input.features) {
        if (feature.zone !== zone) continue;
        this.drawFeature(feature, project, pxPerMeter, input);
      }
    }

    if (input.homeCellCenter) this.drawCamp(project(input.homeCellCenter), pxPerMeter);

    // Vẽ các bẫy thú đang đặt ngoài thế giới
    if (input.traps && input.traps.length > 0) {
      this.drawTraps(project, input.traps, pxPerMeter, input);
    }

    // Vẽ các món đồ rơi trên bản đồ để người chơi nhặt trực tiếp
    if (input.drops && input.drops.length > 0) {
      this.drawDrops(project, input.drops, pxPerMeter, input);
    }

    // Vẽ nhân vật thổ dân tại vị trí đã cộng panX, panY
    this.drawPlayer(w / 2 + this.panX, h / 2 + this.panY, pxPerMeter, input);

    if (input.weather.raining) this.drawRain(w, h, input.weather.rainIntensity);
    this.drawAtmosphereAndLighting(w, h, input, project);
    ctx.restore();
  }

  // ---------------------------------------------------------------- các lớp vẽ

  /** Vẽ các bẫy thú đặt tại toạ độ thực tế trên bản đồ. */
  private drawTraps(
    project: (at: LatLon) => [number, number],
    traps: PlacedTrap[],
    pxPerMeter: number,
    input: RenderInput,
  ): void {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    for (const trap of traps) {
      if (trap.collected) continue;
      const [x, y] = project({ lat: trap.lat, lon: trap.lon });
      if (x < -60 || x > w + 60 || y < -60 || y > h + 60) continue;

      const distMeters = distanceMeters(input.center, { lat: trap.lat, lon: trap.lon });
      const inRange = distMeters <= 35; // Trong bán kính tương tác thu bẫy (<= 35m)
      const hasCatch = Boolean(trap.caughtItem);
      const pulse = 0.6 + 0.4 * Math.sin(this.tick / 6);

      ctx.save();

      // 1. Bóng đổ bẫy dưới đất
      ctx.fillStyle = 'rgba(10, 8, 6, 0.55)';
      ctx.beginPath();
      ctx.ellipse(x, y + 10 * this.dpr, 14 * this.dpr, 6 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Vầng hào quang khi đã bắt được thú hoặc trong tầm tương tác
      if (hasCatch) {
        const glow = ctx.createRadialGradient(x, y, 4 * this.dpr, x, y, 26 * this.dpr);
        glow.addColorStop(0, `rgba(245, 158, 11, ${0.55 * pulse})`);
        glow.addColorStop(0.6, `rgba(234, 88, 12, ${0.25 * pulse})`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 26 * this.dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Khung vẽ bẫy 3D theo cấp bẫy (Nhỏ / Vừa / Lớn)
      if (trap.tier === 'small') {
        // Bẫy Thỏ: Khung gỗ đan dây
        ctx.strokeStyle = '#854d0e';
        ctx.lineWidth = 2.5 * this.dpr;
        ctx.strokeRect(x - 10 * this.dpr, y - 8 * this.dpr, 20 * this.dpr, 16 * this.dpr);

        ctx.fillStyle = '#b45309';
        ctx.fillRect(x - 8 * this.dpr, y - 6 * this.dpr, 16 * this.dpr, 12 * this.dpr);
      } else if (trap.tier === 'medium') {
        // Bẫy Hươu: Khung gỗ dày có chông đá
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 3 * this.dpr;
        ctx.strokeRect(x - 13 * this.dpr, y - 10 * this.dpr, 26 * this.dpr, 20 * this.dpr);

        ctx.fillStyle = '#78350f';
        ctx.fillRect(x - 10 * this.dpr, y - 8 * this.dpr, 20 * this.dpr, 16 * this.dpr);

        // Chông nhọn 2 bên
        ctx.fillStyle = '#78716c';
        ctx.beginPath();
        ctx.moveTo(x - 7 * this.dpr, y - 8 * this.dpr);
        ctx.lineTo(x - 4 * this.dpr, y - 14 * this.dpr);
        ctx.lineTo(x - 1 * this.dpr, y - 8 * this.dpr);
        ctx.fill();
      } else {
        // Bẫy Cự Thú: Khung sắt răng cưa hung dữ
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3.5 * this.dpr;
        ctx.beginPath();
        ctx.arc(x, y, 14 * this.dpr, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(x, y, 12 * this.dpr, 0, Math.PI * 2);
        ctx.fill();

        // Răng cưa kim loại
        ctx.fillStyle = '#cbd5e1';
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          const rx = x + Math.cos(ang) * 11 * this.dpr;
          const ry = y + Math.sin(ang) * 11 * this.dpr;
          ctx.fillRect(rx - 1.5 * this.dpr, ry - 1.5 * this.dpr, 3 * this.dpr, 3 * this.dpr);
        }
      }

      // 4. Biểu tượng trạng thái bẫy
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (hasCatch && trap.caughtItem) {
        // Đã bắt được thú! Hiện icon chiến lợi phẩm
        const icon = itemEmoji(trap.caughtItem.itemId);
        ctx.font = `${16 * this.dpr}px system-ui, sans-serif`;
        ctx.fillText(icon, x, y - 2 * this.dpr);
      } else {
        // Đang rình mồi
        ctx.font = `${12 * this.dpr}px system-ui, sans-serif`;
        ctx.fillText('🪤', x, y - 2 * this.dpr);
      }

      // 5. Nhãn thông tin bẫy
      ctx.fillStyle = hasCatch ? '#fef08a' : '#d4c5a9';
      ctx.font = `bold ${9.5 * this.dpr}px system-ui, sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.95)';
      ctx.shadowBlur = 4 * this.dpr;

      if (hasCatch && trap.caughtItem) {
        ctx.fillText(`🎯 ${trap.caughtItem.nameVi} ×${trap.caughtItem.qty}`, x, y + 20 * this.dpr);
        if (inRange) {
          ctx.fillStyle = '#f59e0b';
          ctx.font = `bold ${8 * this.dpr}px system-ui, sans-serif`;
          ctx.fillText('▼ Chạm để thu bẫy', x, y - 18 * this.dpr);
        }
      } else {
        ctx.fillText(trap.nameVi, x, y + 18 * this.dpr);
      }
      ctx.shadowBlur = 0;

      ctx.restore();
    }
  }

  private drawDrops(
    project: (at: LatLon) => [number, number],
    drops: WorldDrop[],
    pxPerMeter: number,
    input: RenderInput,
  ): void {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    for (const drop of drops) {
      const [x, y] = project({ lat: drop.lat, lon: drop.lon });
      // Bỏ qua nếu nằm hoàn toàn ngoài khung nhìn canvas
      if (x < -50 || x > w + 50 || y < -50 || y > h + 50) continue;

      const distMeters = distanceMeters(input.center, { lat: drop.lat, lon: drop.lon });
      const inRange = distMeters <= 30; // Trong bán kính tương tác 30m
      const seed = hashSeed(drop.id);
      const bob = Math.sin(this.tick / 9 + seed) * 3.5 * this.dpr;
      const pulse = 0.6 + 0.4 * Math.sin(this.tick / 7 + seed);

      ctx.save();

      // 1. Bóng đổ 3D mềm dưới đất
      ctx.fillStyle = 'rgba(8, 6, 4, 0.45)';
      ctx.beginPath();
      ctx.ellipse(x, y + 10 * this.dpr, 11 * this.dpr, 4.5 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      const dy = y + bob;

      // 2. Vầng hào quang phát sáng mời gọi nhặt đồ
      if (inRange) {
        const glow = ctx.createRadialGradient(x, dy, 2 * this.dpr, x, dy, 20 * this.dpr);
        glow.addColorStop(0, `rgba(245, 158, 11, ${0.48 * pulse})`);
        glow.addColorStop(0.55, `rgba(234, 88, 12, ${0.18 * pulse})`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, dy, 20 * this.dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Khối tròn nổi chứa icon vật phẩm
      ctx.fillStyle = inRange ? 'rgba(38, 28, 18, 0.95)' : 'rgba(24, 20, 16, 0.85)';
      ctx.strokeStyle = inRange ? `rgba(245, 158, 11, ${pulse})` : 'rgba(241, 218, 167, 0.35)';
      ctx.lineWidth = inRange ? 2.2 * this.dpr : 1.2 * this.dpr;
      ctx.beginPath();
      ctx.arc(x, dy, 14 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
      // 4. Icon Emoji vật phẩm
      const icon = itemEmoji(drop.itemId);
      ctx.font = `${14 * this.dpr}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, x, dy);

      // 5. Nhãn tên & số lượng
      ctx.fillStyle = inRange ? '#fef3c7' : '#d4c5a9';
      ctx.font = `bold ${9.5 * this.dpr}px system-ui, sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.95)';
      ctx.shadowBlur = 4 * this.dpr;
      ctx.fillText(`${drop.nameVi} ×${drop.qty}`, x, dy + 20 * this.dpr);
      ctx.shadowBlur = 0;

      // Nếu trong tầm: có nhãn chỉ dẫn 'Chạm nhặt'
      if (inRange) {
        ctx.fillStyle = '#f59e0b';
        ctx.font = `bold ${8 * this.dpr}px system-ui, sans-serif`;
        ctx.fillText('▼ Chạm nhặt', x, dy - 18 * this.dpr);
      }

      ctx.restore();
    }
  }

  /**
   * Vẽ thảm cỏ, đồi cỏ, hoa dại nhiệt đới và sỏi đá neo theo toạ độ thế giới thực.
   * Khi người chơi dùng tay kéo/pan bản đồ, toàn bộ thảm cỏ và hoa dại di chuyển đồng bộ 100% cùng cảnh vật!
   */
  private drawGround(
    w: number,
    h: number,
    palette: typeof PALETTE.day,
    input: RenderInput,
    project: (at: LatLon) => [number, number],
    pxPerMeter: number,
  ): void {
    const { ctx } = this;

    // Nền thảm cỏ: Ban ngày xanh mướt tươi sáng, Chiều tà vàng rêu, Ban đêm xanh đen
    ctx.fillStyle = palette.ground;
    ctx.fillRect(0, 0, w, h);

    const spanMeters = input.spanMeters ?? 420;
    const tileSizeMeters = 35; // Lưới ô thảm cỏ 35m
    const latStep = metersToLatDegrees(tileSizeMeters);
    const lonStep = metersToLonDegrees(tileSizeMeters, input.center.lat);

    const radiusTiles = Math.ceil((spanMeters * 1.5) / tileSizeMeters);
    const baseLatIdx = Math.floor(input.center.lat / latStep);
    const baseLonIdx = Math.floor(input.center.lon / lonStep);

    // Duyệt qua các ô địa hình thế giới xung quanh
    for (let di = -radiusTiles; di <= radiusTiles; di++) {
      for (let dj = -radiusTiles; dj <= radiusTiles; dj++) {
        const latIdx = baseLatIdx + di;
        const lonIdx = baseLonIdx + dj;
        const cellLat = (latIdx + 0.5) * latStep;
        const cellLon = (lonIdx + 0.5) * lonStep;

        const [gx, gy] = project({ lat: cellLat, lon: cellLon });
        // Bỏ qua nếu ô nằm ngoài màn hình
        if (gx < -60 || gx > w + 60 || gy < -60 || gy > h + 60) continue;

        const seed = hashSeed('ground_cell_v2', latIdx, lonIdx);
        const rng = createRng(seed);

        // 1. Mảng đồi cỏ nổi 3D
        if (rng() > 0.35) {
          ctx.fillStyle = input.phase === 'night' ? '#080d09' : input.phase === 'evening' ? '#324414' : '#4d7c0f';
          const gr = (18 + rng() * 22) * this.dpr;
          ctx.beginPath();
          ctx.ellipse(gx, gy, gr, gr * 0.65, rng() * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }

        // 2. Đốm cỏ xanh non
        if (rng() > 0.4) {
          ctx.fillStyle = input.phase === 'night' ? '#141d16' : input.phase === 'evening' ? '#4b611e' : '#6ba828';
          const gr = (12 + rng() * 16) * this.dpr;
          const ox = (rng() - 0.5) * 15 * this.dpr;
          const oy = (rng() - 0.5) * 15 * this.dpr;
          ctx.beginPath();
          ctx.ellipse(gx + ox, gy + oy, gr, gr * 0.6, rng() * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }

        // 3. Khóm bụi cỏ & hoa dại nhiệt đới
        const plantCount = Math.floor(rng() * 4);
        for (let p = 0; p < plantCount; p++) {
          const px = gx + (rng() - 0.5) * 26 * this.dpr;
          const py = gy + (rng() - 0.5) * 26 * this.dpr;
          const size = (1.5 + rng() * 2.5) * this.dpr;

          ctx.fillStyle = input.phase === 'night' ? '#1b281d' : rng() > 0.5 ? '#84cc16' : '#a3e635';
          ctx.fillRect(px, py, size, size * 1.5);

          // Hoa dại nhiệt đới (đỏ, vàng)
          if (p === 0 && input.phase !== 'night' && rng() > 0.4) {
            ctx.fillStyle = rng() > 0.5 ? '#ef4444' : '#fbbf24';
            ctx.beginPath();
            ctx.arc(px, py - 1 * this.dpr, 1.4 * this.dpr, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // 4. Sỏi đá tự nhiên
        if (rng() > 0.75) {
          const sx = gx + (rng() - 0.5) * 20 * this.dpr;
          const sy = gy + (rng() - 0.5) * 20 * this.dpr;
          const sSize = (1.5 + rng() * 2.5) * this.dpr;
          ctx.fillStyle = input.phase === 'night' ? 'rgba(40, 45, 40, 0.45)' : 'rgba(120, 113, 108, 0.45)';
          ctx.beginPath();
          ctx.ellipse(sx, sy, sSize * 1.3, sSize * 0.8, rng() * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  /** Lưới ô 200 m vẽ thành lối mòn đất hữu cơ mịn màng, di chuyển đồng bộ khi kéo bản đồ. */
  private drawTrailGrid(
    w: number,
    h: number,
    pxPerMeter: number,
    palette: typeof PALETTE.day,
    center: LatLon,
  ): void {
    const { ctx } = this;
    const cellPx = 200 * pxPerMeter;
    if (cellPx < 24) return;

    const latStep = metersToLatDegrees(200);
    const lonStep = metersToLonDegrees(200, center.lat);
    const offsetX = (((center.lon / lonStep) % 1) + 1) % 1;
    const offsetY = (((center.lat / latStep) % 1) + 1) % 1;

    ctx.strokeStyle = '#5a462b';
    ctx.lineWidth = Math.max(1.5, 4 * this.dpr);
    ctx.lineCap = 'round';
    const minI = Math.floor((-w / 2 - this.panX) / cellPx) - 2;
    const maxI = Math.ceil((w / 2 - this.panX) / cellPx) + 2;
    const minJ = Math.floor((-h / 2 - this.panY) / cellPx) - 2;
    const maxJ = Math.ceil((h / 2 - this.panY) / cellPx) + 2;

    for (let i = minI; i <= maxI; i++) {
      const x = w / 2 + (i - offsetX) * cellPx + this.panX;
      this.wobbleLine(x, -50, x, h + 50, cellPx * 0.05, hashSeed('vx', i));
    }
    for (let j = minJ; j <= maxJ; j++) {
      const y = h / 2 + (j + offsetY) * cellPx + this.panY;
      this.wobbleLine(-50, y, w + 50, y, cellPx * 0.05, hashSeed('hz', j));
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Vẽ các dòng sông lớn tự nhiên chảy qua Hà Nội:
   * 1. Sông Hồng ("Hồng Hà Đại Long")
   * 2. Sông Đuống ("Thiên Đức Giang")
   * 3. Sông Tô Lịch ("Tô Lịch Cổ Thần Khê")
   * 4. Sông Đáy ("Đáy Giang Tiền Sử")
   */
  private drawNaturalRivers(
    project: (at: LatLon) => [number, number],
    pxPerMeter: number,
    phase: Phase,
  ): void {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Màu nước sông thời tiền sử
    const riverColor = phase === 'night' ? '#0e2b36' : phase === 'evening' ? '#155e75' : '#0891b2';
    const sandColor = phase === 'night' ? '#292524' : phase === 'evening' ? '#b45309' : '#eab308';

    const rivers: { name: string; widthMeters: number; points: LatLon[] }[] = [
      {
        // Sông Hồng uốn lượn qua Hà Nội từ Ba Vì -> Đan Phượng -> Tây Hồ -> Long Biên -> Bát Tràng -> Thường Tín
        name: 'Sông Hồng',
        widthMeters: 160,
        points: [
          { lat: 21.22, lon: 105.48 },
          { lat: 21.18, lon: 105.56 },
          { lat: 21.14, lon: 105.65 },
          { lat: 21.10, lon: 105.76 },
          { lat: 21.09, lon: 105.82 },
          { lat: 21.06, lon: 105.85 },
          { lat: 21.04, lon: 105.865 },
          { lat: 21.01, lon: 105.88 },
          { lat: 20.97, lon: 105.905 },
          { lat: 20.92, lon: 105.92 },
          { lat: 20.85, lon: 105.935 },
        ],
      },
      {
        // Sông Đuống tách từ Đông Anh chảy sang Gia Lâm
        name: 'Sông Đuống',
        widthMeters: 90,
        points: [
          { lat: 21.085, lon: 105.855 },
          { lat: 21.075, lon: 105.89 },
          { lat: 21.055, lon: 105.925 },
          { lat: 21.025, lon: 105.975 },
        ],
      },
      {
        // Sông Tô Lịch uốn quanh nội thành
        name: 'Sông Tô Lịch',
        widthMeters: 38,
        points: [
          { lat: 21.045, lon: 105.805 },
          { lat: 21.032, lon: 105.802 },
          { lat: 21.015, lon: 105.809 },
          { lat: 21.002, lon: 105.818 },
          { lat: 20.985, lon: 105.818 },
          { lat: 20.965, lon: 105.845 },
        ],
      },
      {
        // Sông Đáy chảy qua phía Tây (Đan Phượng, Hoài Đức, Quốc Oai, Chương Mỹ, Mỹ Đức)
        name: 'Sông Đáy',
        widthMeters: 75,
        points: [
          { lat: 21.12, lon: 105.68 },
          { lat: 21.05, lon: 105.69 },
          { lat: 20.98, lon: 105.68 },
          { lat: 20.91, lon: 105.70 },
          { lat: 20.78, lon: 105.76 },
          { lat: 20.65, lon: 105.81 },
        ],
      },
    ];

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const river of rivers) {
      const projected = river.points.map((p) => project(p));
      const riverWidthPx = Math.max(12 * this.dpr, river.widthMeters * pxPerMeter);

      // 1. Dải bãi bồi / bờ cát vàng ven sông
      ctx.strokeStyle = sandColor;
      ctx.lineWidth = riverWidthPx * 1.35;
      ctx.beginPath();
      ctx.moveTo(projected[0][0], projected[0][1]);
      for (let i = 1; i < projected.length; i++) {
        ctx.lineTo(projected[i][0], projected[i][1]);
      }
      ctx.stroke();

      // 2. Lòng sông nước xanh ngọc
      ctx.strokeStyle = riverColor;
      ctx.lineWidth = riverWidthPx;
      ctx.beginPath();
      ctx.moveTo(projected[0][0], projected[0][1]);
      for (let i = 1; i < projected.length; i++) {
        ctx.lineTo(projected[i][0], projected[i][1]);
      }
      ctx.stroke();

      // 3. Gợn sóng lấp lánh giữa dòng sông
      const waveAlpha = 0.25 + 0.2 * Math.sin(this.tick / 8);
      ctx.strokeStyle = `rgba(255, 255, 255, ${waveAlpha})`;
      ctx.lineWidth = 2 * this.dpr;
      ctx.setLineDash([12 * this.dpr, 16 * this.dpr]);
      ctx.beginPath();
      ctx.moveTo(projected[0][0], projected[0][1]);
      for (let i = 1; i < projected.length; i++) {
        ctx.lineTo(projected[i][0], projected[i][1]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  private wobbleLine(x1: number, y1: number, x2: number, y2: number, amp: number, seed: number): void {
    const { ctx } = this;
    const rng = createRng(seed);
    const steps = 10;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const jitter = (rng() - 0.5) * amp;
      const nx = x1 + (x2 - x1) * t + (y2 - y1 === 0 ? 0 : jitter);
      const ny = y1 + (y2 - y1) * t + (x2 - x1 === 0 ? 0 : jitter);
      ctx.lineTo(nx, ny);
    }
    ctx.stroke();
  }

  private drawFeature(
    feature: MapFeature,
    project: (at: LatLon) => [number, number],
    pxPerMeter: number,
    input: RenderInput,
  ): void {
    const { ctx } = this;
    const [x, y] = project(feature);
    const r = Math.max(16 * this.dpr, feature.radiusMeters * pxPerMeter);
    const seed = hashSeed(feature.id);
    const isActive = input.activePoiId === feature.id;

    ctx.save();

    const name = feature.nameVi;
    const fid = feature.id;

    // Phân loại cảnh quan đặc biệt
    if (name.includes('Sun Square') || name.includes('Thái Dương')) {
      // ☀️ THÁI DƯƠNG CỰ THẠCH CUNG (SUN SQUARE)
      this.blob(x, y, r * 1.15, seed, '#78350f', '#eab308');
      this.sunSquareMonolith(x, y, r, seed);
    } else if (name.includes('Cổ Mộ') || name.includes('Mai Dịch') || fid.includes('maidich')) {
      // 🪦 CỔ MỘ TIỀN NHÂN (NGHĨA TRANG MAI DỊCH)
      this.blob(x, y, r * 1.1, seed, '#292524', '#57534e');
      this.ancientTombs(x, y, r, seed);
    } else if (name.includes('Y Viện') || name.includes('Thảo Dược Viện') || name.includes('Bạch Mai') || name.includes('198')) {
      // 🌿 Y VIỆN THẢO DƯỢC
      this.blob(x, y, r * 1.1, seed, '#14532d', '#22c55e');
      this.healerLodge(x, y, r, seed);
    } else if (name.includes('Bí Cảnh Tri Thức') || name.includes('Thương Viện') || name.includes('Sư Viện') || name.includes('Học Viện') || name.includes('Văn Miếu')) {
      // 📜 ĐẠI BÍ CẢNH TRI THỨC / ĐẠI HỌC CỔ
      this.blob(x, y, r * 1.1, seed, '#1e3a8a', '#3b82f6');
      this.ancientAcademy(x, y, r, seed);
    } else if (name.includes('Đấu Trường') || name.includes('Mỹ Đình') || name.includes('Cung Điền Kinh')) {
      // 🏟️ ĐẤU TRƯỜNG QUÁI THÚ MỸ ĐÌNH
      this.blob(x, y, r * 1.15, seed, '#451a03', '#d97706');
      this.ancientColosseum(x, y, r, seed);
    } else if (name.includes('Trạm Lữ Khách') || name.includes('Bến Xe') || name.includes('Lữ Điểm')) {
      // 🏕️ TRẠM DỪNG CHÂN LỮ KHÁCH (BẾN XE)
      this.blob(x, y, r * 1.1, seed, '#431407', '#ea580c');
      this.travelersLodge(x, y, r, seed);
    } else if (name.includes('Vàng') || fid.includes('gold')) {
      // 🪙 MỎ VÀNG CỔ ĐẠI
      this.blob(x, y, r * 1.1, seed, '#78350f', '#ca8a04');
      this.goldMine(x, y, r, seed);
    } else if (name.includes('Than') || name.includes('Quặng') || name.includes('Trầm Tích') || fid.includes('iron')) {
      // ⛏️ MỎ THAN & QUẶNG SẮT
      this.blob(x, y, r * 1.05, seed, '#1e293b', '#475569');
      this.ironAndCoalMine(x, y, r, seed);
    } else if (name.includes('Hươu') || fid.includes('deer')) {
      // 🦌 BÃI HƯƠU SAO TIỀN SỬ
      this.blob(x, y, r * 1.15, seed, '#365314', '#4d7c0f');
      this.deerGrove(x, y, r, seed);
    } else if (name.includes('Cự Mộc') || fid.startsWith('cl_')) {
      // 🌳 TUYẾN HUYẾT MẠCH CỰ MỘC CÁT LINH
      this.blob(x, y, r * 1.1, seed, '#2e1065', '#7e22ce');
      this.catLinhRoots(x, y, r, seed);
    } else if (name.includes('Đất Sét') || fid.includes('clay')) {
      // 🏺 MỎ ĐẤT SÉT VEN SÔNG
      this.blob(x, y, r * 1.1, seed, '#451a03', '#9a3412');
      this.clayDeposit(x, y, r, seed);
    } else if (name.includes('Tháp') || name.includes('Keangnam') || name.includes('Lotte') || name.includes('Dolphin') || name.includes('Discovery') || name.includes('Royal') || name.includes('Times')) {
      // 🗼 THẠCH TRỤ CHỌC TRỜI
      this.blob(x, y, r * 0.95, seed, '#334155', '#64748b');
      this.ancientTower(x, y, r, seed);
    } else if (name.includes('Long Cốt') || name.includes('Cầu')) {
      // 🐉 CẦU CỔ LONG CỐT
      this.blob(x, y, r * 1.05, seed, '#451a03', '#b45309');
      this.ancientBridge(x, y, r, seed);
    } else {
      switch (feature.zone) {
        case 'water':
          if (feature.kind === 'procedural' || name.includes('Khe Nước') || name.includes('Mạch Nước') || name.includes('Hố Nước')) {
            // 💧 KHE NƯỚC NHỎ / MẠCH NƯỚC NGẦM THỦ TỤC (Chỉ vẽ rãnh suối nhỏ, không vẽ hồ to)
            this.smallStream(x, y, r, seed);
          } else if (feature.radiusMeters >= 180 || name.includes('Đại Hồ') || name.includes('Biển Hồ')) {
            // 🌊 ĐẠI HỒ KHỔNG LỒ THỰC TẾ (Hồ Tây, Suối Hai, Đồng Mô, Quan Sơn, Ocean Park...)
            this.blob(x, y, r * 1.12, seed, '#ca8a04', '#eab308');
            this.blob(x, y, r, seed, '#0891b2', '#06b6d4');
            this.greatLake(x, y, r, seed);
          } else {
            // 🏞️ HỒ NƯỚC VỪA & NHỎ THỰC TẾ (Hồ Gươm, Trúc Bạch, Nghĩa Đô, Thành Công, Giảng Võ...)
            this.blob(x, y, r * 1.06, seed, '#365314', '#4d7c0f'); // Bờ kè cỏ xanh rêu tự nhiên
            this.blob(x, y, r, seed, '#0891b2', '#06b6d4');
            this.pondOrLake(x, y, r, seed, fid);
          }
          break;
        case 'forest':
          // Vùng rừng rậm nhiệt đới có cây dừa & chuối rừng
          this.blob(x, y, r, seed, '#2d4016', '#3f6212');
          this.trees(x, y, r, seed);
          break;
        case 'merchant':
          // Tàn tích cự thạch phủ rêu
          this.blob(x, y, r * 0.9, seed, '#443423', '#624b33');
          this.ancientRuins(x, y, r, seed);
          break;
        default:
          this.blob(x, y, r * 0.8, seed, '#383022', '#524632');
          this.crags(x, y, r * 0.75, seed);
      }
    }

    if (isActive) {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.tick / 12);
      ctx.strokeStyle = '#e07a3c';
      ctx.lineWidth = 2.8 * this.dpr;
      ctx.beginPath();
      ctx.arc(x, y, r + 6 * this.dpr, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = feature.kind === 'poi' ? 0.95 : 0.6;
    ctx.fillStyle = '#fef08a';
    ctx.font = `bold ${11 * this.dpr}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = 5 * this.dpr;
    ctx.fillText(feature.nameVi, x, y + r + 16 * this.dpr);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  private blob(x: number, y: number, r: number, seed: number, fill: string, edge: string): void {
    const { ctx } = this;
    const rng = createRng(seed);
    const points = 14;

    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const radius = r * (0.82 + rng() * 0.32);
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius * 0.82;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.8 * this.dpr;
    ctx.stroke();
  }

  /** Khe nước nhỏ / Mạch nước ngầm thủ tục (Chỉ vẽ rãnh suối nhỏ róc rách, không vẽ hồ to). */
  private smallStream(x: number, y: number, r: number, seed: number): void {
    const { ctx } = this;
    const rng = createRng(seed ^ 0x9922);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Rãnh nước nhỏ uốn khúc
    const streamLen = Math.min(28 * this.dpr, r * 0.9);
    const sw = Math.max(3.5 * this.dpr, 5 * this.dpr);

    // 1. Viền đất ẩm ướt rêu phong
    ctx.strokeStyle = '#2d4016';
    ctx.lineWidth = sw + 4 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(x - streamLen, y - (rng() - 0.5) * 8 * this.dpr);
    ctx.quadraticCurveTo(x, y + (rng() - 0.5) * 12 * this.dpr, x + streamLen, y + (rng() - 0.5) * 8 * this.dpr);
    ctx.stroke();

    // 2. Mạch nước trong xanh
    ctx.strokeStyle = '#0891b2';
    ctx.lineWidth = sw;
    ctx.beginPath();
    ctx.moveTo(x - streamLen, y - (rng() - 0.5) * 8 * this.dpr);
    ctx.quadraticCurveTo(x, y + (rng() - 0.5) * 12 * this.dpr, x + streamLen, y + (rng() - 0.5) * 8 * this.dpr);
    ctx.stroke();

    // 3. Vài viên đá cuội nhỏ ven khe nước
    ctx.fillStyle = '#78716c';
    ctx.beginPath();
    ctx.arc(x - streamLen * 0.4, y + 4 * this.dpr, 2.2 * this.dpr, 0, Math.PI * 2);
    ctx.arc(x + streamLen * 0.5, y - 3 * this.dpr, 1.8 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    // 4. Bụi cỏ nước nhỏ
    ctx.fillStyle = '#84cc16';
    ctx.fillRect(x + 2 * this.dpr, y + 3 * this.dpr, 2 * this.dpr, 3.5 * this.dpr);

    ctx.restore();
  }

  /** Đại hồ khổng lồ (Hồ Tây, Suối Hai, Đồng Mô, Quan Sơn, Ocean Park...). */
  private greatLake(x: number, y: number, r: number, seed: number): void {
    const { ctx } = this;
    const rng = createRng(seed ^ 0x4a7e);

    ctx.save();

    // 1. Các dải bọt sóng trắng vỗ bờ nhấp nhô
    const wavePulse = Math.sin(this.tick / 14);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 2.2 * this.dpr;
    ctx.lineCap = 'round';

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + wavePulse * 0.1;
      const dist = r * (0.8 + wavePulse * 0.06);
      const wx = x + Math.cos(angle) * dist;
      const wy = y + Math.sin(angle) * dist * 0.82;
      ctx.beginPath();
      ctx.arc(wx, wy, 10 * this.dpr, 0, Math.PI);
      ctx.stroke();
    }

    // 2. Gợn sóng lăn tăn phản quang xanh lơ sâu
    ctx.strokeStyle = 'rgba(165, 243, 252, 0.65)';
    ctx.lineWidth = 1.6 * this.dpr;
    for (let i = 0; i < 8; i++) {
      const ox = (rng() - 0.5) * r * 0.85;
      const oy = (rng() - 0.5) * r * 0.65;
      const wlen = (10 + rng() * 16) * this.dpr;
      ctx.beginPath();
      ctx.moveTo(x + ox - wlen, y + oy);
      ctx.quadraticCurveTo(x + ox, y + oy - 2.5 * this.dpr, x + ox + wlen, y + oy);
      ctx.stroke();
    }

    // 3. Chiếc bè gỗ buồm neo ven bờ nước
    const raftX = x + r * 0.45;
    const raftY = y - r * 0.35;

    ctx.fillStyle = 'rgba(6, 78, 59, 0.5)';
    ctx.beginPath();
    ctx.ellipse(raftX, raftY + 4 * this.dpr, 14 * this.dpr, 6 * this.dpr, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1.2 * this.dpr;
    for (let k = 0; k < 4; k++) {
      ctx.fillRect(raftX - 10 * this.dpr, raftY - 6 * this.dpr + k * 3.5 * this.dpr, 20 * this.dpr, 3 * this.dpr);
    }

    // Cột buồm
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 2 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(raftX, raftY + 2 * this.dpr);
    ctx.lineTo(raftX - 2 * this.dpr, raftY - 12 * this.dpr);
    ctx.stroke();

    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.moveTo(raftX - 2 * this.dpr, raftY - 12 * this.dpr);
    ctx.lineTo(raftX + 8 * this.dpr, raftY - 5 * this.dpr);
    ctx.lineTo(raftX - 1 * this.dpr, raftY - 2 * this.dpr);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /** Hồ nước vừa & nhỏ thực tế (Hồ Gươm, Trúc Bạch, Nghĩa Đô, Thành Công, Giảng Võ, Triều Khúc...). */
  private pondOrLake(x: number, y: number, r: number, seed: number, fid: string): void {
    const { ctx } = this;
    const rng = createRng(seed ^ 0x3311);

    ctx.save();

    // 1. Gợn sóng lăn tăn nhẹ nhàng
    ctx.strokeStyle = 'rgba(207, 250, 254, 0.55)';
    ctx.lineWidth = 1.2 * this.dpr;
    for (let i = 0; i < 4; i++) {
      const ox = (rng() - 0.5) * r * 0.7;
      const oy = (rng() - 0.5) * r * 0.5;
      const wlen = (6 + rng() * 10) * this.dpr;
      ctx.beginPath();
      ctx.moveTo(x + ox - wlen, y + oy);
      ctx.quadraticCurveTo(x + ox, y + oy - 1.8 * this.dpr, x + ox + wlen, y + oy);
      ctx.stroke();
    }

    // 2. Hoa sen & lá sen xanh nổi trên mặt hồ
    for (let s = 0; s < 3; s++) {
      const lx = x + (rng() - 0.5) * r * 0.6;
      const ly = y + (rng() - 0.5) * r * 0.45;

      // Lá sen tròn
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.ellipse(lx, ly, 3.5 * this.dpr, 2.2 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Nụ hoa sen hồng
      if (s === 0) {
        ctx.fillStyle = '#f472b6';
        ctx.beginPath();
        ctx.arc(lx + 1 * this.dpr, ly - 1.5 * this.dpr, 1.5 * this.dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Nếu là Hồ Gươm (id: 'p1') -> Vẽ gò Tháp Rùa cự thạch mini ở trung tâm!
    if (fid === 'p1') {
      // Gò đất xanh giữa hồ
      ctx.fillStyle = '#166534';
      ctx.beginPath();
      ctx.ellipse(x, y, 7 * this.dpr, 4 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tháp Rùa đá cổ kính
      ctx.fillStyle = '#78716c';
      ctx.fillRect(x - 2.5 * this.dpr, y - 6 * this.dpr, 5 * this.dpr, 5 * this.dpr);
      ctx.fillStyle = '#dc2626'; // Mái ngói đỏ cổ
      ctx.fillRect(x - 3.5 * this.dpr, y - 7.5 * this.dpr, 7 * this.dpr, 1.8 * this.dpr);
    }

    ctx.restore();
  }

  /** Rừng nhiệt đới: Cây dừa cao vút uốn lượn, bóng dừa đổ dài và bụi chuối rừng lá to. */
  private trees(x: number, y: number, r: number, seed: number): void {
    const { ctx } = this;
    const rng = createRng(seed ^ 0x5eed);
    const count = Math.max(3, Math.min(8, Math.round(r / (14 * this.dpr))));

    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = Math.sqrt(rng()) * r * 0.72;
      const tx = x + Math.cos(angle) * dist;
      const ty = y + Math.sin(angle) * dist * 0.82;
      const size = (12 + rng() * 10) * this.dpr;

      ctx.save();

      // 1. Bóng cây dừa đổ dài theo góc nghiêng mặt trời (hướng tây bắc)
      ctx.fillStyle = 'rgba(15, 23, 10, 0.45)';
      ctx.beginPath();
      ctx.ellipse(tx - size * 0.6, ty + size * 0.4, size * 0.85, size * 0.32, -0.35, 0, Math.PI * 2);
      ctx.fill();

      // 2. Bụi chuối rừng lá to ở gốc cây
      ctx.fillStyle = '#365314';
      for (let b = 0; b < 4; b++) {
        const bAngle = (b / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(
          tx + Math.cos(bAngle) * size * 0.28,
          ty + Math.sin(bAngle) * size * 0.18 + size * 0.1,
          size * 0.35,
          size * 0.16,
          bAngle,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }

      // 3. Thân cây dừa cong vút màu nâu xám có ngấn thân
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 3.2 * this.dpr;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty + size * 0.1);
      ctx.quadraticCurveTo(tx + size * 0.25, ty - size * 0.6, tx + size * 0.12, ty - size * 1.3);
      ctx.stroke();

      const topX = tx + size * 0.12;
      const topY = ty - size * 1.3;

      // 4. Chùm quả dừa nách lá
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.arc(topX - 1.5 * this.dpr, topY + 1 * this.dpr, 1.8 * this.dpr, 0, Math.PI * 2);
      ctx.arc(topX + 1.8 * this.dpr, topY + 1.5 * this.dpr, 1.8 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // 5. Tán lá dừa xoè 6 nhánh 3D uốn cong rực rỡ
      for (let f = 0; f < 6; f++) {
        const fAngle = (f / 6) * Math.PI * 2 + (this.tick / 80) * 0.1;
        const fLen = size * 0.85;
        const endX = topX + Math.cos(fAngle) * fLen;
        const endY = topY + Math.sin(fAngle) * fLen * 0.75;
        const midX = topX + Math.cos(fAngle) * fLen * 0.5;
        const midY = topY + Math.sin(fAngle) * fLen * 0.4 - 3 * this.dpr;

        ctx.strokeStyle = f % 2 === 0 ? '#4d7c0f' : '#65a30d';
        ctx.lineWidth = 2.4 * this.dpr;
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.quadraticCurveTo(midX, midY, endX, endY);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  /** Tàn tích thương nhân: Cổng cự thạch phong trần phủ rêu xanh. */
  private ancientRuins(x: number, y: number, r: number, seed: number): void {
    const { ctx } = this;
    const unit = Math.max(4, r * 0.18);

    ctx.save();
    // Bóng đổ tàn tích
    ctx.fillStyle = 'rgba(20, 16, 12, 0.55)';
    ctx.beginPath();
    ctx.ellipse(x, y + unit * 0.5, unit * 2.2, unit * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();

    const colW = unit * 0.7;
    const colH = unit * 2.4;
    const span = unit * 1.4;

    // Cột đá trái & phải
    ctx.fillStyle = '#78716c';
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 1.4 * this.dpr;

    ctx.fillRect(x - span - colW / 2, y - colH + unit * 0.4, colW, colH);
    ctx.strokeRect(x - span - colW / 2, y - colH + unit * 0.4, colW, colH);

    ctx.fillRect(x + span - colW / 2, y - colH + unit * 0.4, colW, colH);
    ctx.strokeRect(x + span - colW / 2, y - colH + unit * 0.4, colW, colH);

    // Thanh đá ngang trên đỉnh
    ctx.fillStyle = '#a8a29e';
    ctx.fillRect(x - span * 1.5, y - colH - unit * 0.4 + unit * 0.4, span * 3, unit * 0.75);
    ctx.strokeRect(x - span * 1.5, y - colH - unit * 0.4 + unit * 0.4, span * 3, unit * 0.75);

    // Rêu xanh phủ chân cột
    ctx.fillStyle = '#15803d';
    ctx.fillRect(x - span - colW / 2, y + unit * 0.2, colW, 2.5 * this.dpr);
    ctx.fillRect(x + span - colW / 2, y + unit * 0.2, colW, 2.5 * this.dpr);

    // Ngọn đuốc tiền sử bập bùng
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(x, y - unit * 0.5, 3.5 * this.dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(x, y - unit * 0.5, 1.8 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** Mỏ vàng cổ đại: Mỏm đá hoa cương với các vỉa quặng vàng rực sáng óng ánh, lấp lánh 3D. */
  private goldMine(x: number, y: number, r: number, seed: number): void {
    const { ctx } = this;
    const rng = createRng(seed ^ 0x901d);
    ctx.save();

    // Bóng mỏ vàng
    ctx.fillStyle = 'rgba(20, 14, 6, 0.55)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.3, r * 0.9, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Khối đá hoa cương trung tâm
    ctx.fillStyle = '#451a03';
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 1.6 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7, y + r * 0.2);
    ctx.lineTo(x - r * 0.3, y - r * 0.6);
    ctx.lineTo(x + r * 0.4, y - r * 0.5);
    ctx.lineTo(x + r * 0.7, y + r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Vỉa quặng vàng óng ánh & tinh thể phát sáng
    const pulse = 0.7 + 0.3 * Math.sin(this.tick / 8 + seed);
    for (let i = 0; i < 5; i++) {
      const gx = x + (rng() - 0.5) * r * 0.9;
      const gy = y + (rng() - 0.5) * r * 0.6;
      const gSize = (3 + rng() * 4) * this.dpr;

      // Vầng sáng vàng
      const glow = ctx.createRadialGradient(gx, gy, 1, gx, gy, gSize * 2.5);
      glow.addColorStop(0, `rgba(250, 204, 21, ${0.8 * pulse})`);
      glow.addColorStop(1, 'rgba(234, 179, 8, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(gx, gy, gSize * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Khối vàng
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(gx, gy, gSize, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /** Mỏ than & quặng sắt: Vách đá trầm tích nhiều tầng với xỉ than và cuốc đá. */
  private ironAndCoalMine(x: number, y: number, r: number, seed: number): void {
    const { ctx } = this;
    const rng = createRng(seed ^ 0x1f04);
    ctx.save();

    // Bóng đổ
    ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.3, r * 0.85, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Các tầng vách đá trầm tích
    for (let l = 0; l < 3; l++) {
      const ly = y - r * 0.4 + l * r * 0.3;
      ctx.fillStyle = l % 2 === 0 ? '#1e293b' : '#334155';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.4 * this.dpr;
      ctx.fillRect(x - r * 0.6 + l * 4 * this.dpr, ly, r * 1.2 - l * 8 * this.dpr, r * 0.25);
      ctx.strokeRect(x - r * 0.6 + l * 4 * this.dpr, ly, r * 1.2 - l * 8 * this.dpr, r * 0.25);
    }

    // Các khối than đen và quặng sắt ánh kim
    for (let i = 0; i < 4; i++) {
      const ox = x + (rng() - 0.5) * r * 0.8;
      const oy = y + (rng() - 0.5) * r * 0.4;
      ctx.fillStyle = i % 2 === 0 ? '#020617' : '#94a3b8';
      ctx.fillRect(ox, oy, 4.5 * this.dpr, 4.5 * this.dpr);
    }

    ctx.restore();
  }

  /** Bãi hươu sao tiền sử: Đồng cỏ hoa với đàn hươu sao gặm cỏ. */
  private deerGrove(x: number, y: number, r: number, seed: number): void {
    const { ctx } = this;
    ctx.save();

    // Vẽ 2 chú hươu sao 3D
    const deers = [
      { dx: x - r * 0.25, dy: y - r * 0.1, scale: 1 },
      { dx: x + r * 0.3, dy: y + r * 0.15, scale: 0.85 },
    ];

    for (const d of deers) {
      const bob = Math.sin(this.tick / 15 + seed) * 1.5 * this.dpr;
      const hx = d.dx;
      const hy = d.dy + bob;
      const s = d.scale * this.dpr;

      // Bóng hươu
      ctx.fillStyle = 'rgba(20, 35, 10, 0.45)';
      ctx.beginPath();
      ctx.ellipse(hx, hy + 8 * s, 8 * s, 3.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // Thân hươu màu nâu vàng đốm trắng
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.ellipse(hx, hy, 7 * s, 4.5 * s, -0.15, 0, Math.PI * 2);
      ctx.fill();

      // Đốm trắng trên lưng
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.arc(hx - 2 * s, hy - 1.5 * s, 1 * s, 0, Math.PI * 2);
      ctx.arc(hx + 2 * s, hy - 1 * s, 1 * s, 0, Math.PI * 2);
      ctx.fill();

      // Cổ và đầu hươu
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.ellipse(hx + 6 * s, hy - 5 * s, 2.5 * s, 4 * s, 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Cặp sừng gạc hươu sao
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1.2 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(hx + 6 * s, hy - 7 * s);
      ctx.lineTo(hx + 7 * s, hy - 12 * s);
      ctx.lineTo(hx + 9 * s, hy - 10 * s);
      ctx.moveTo(hx + 6 * s, hy - 7 * s);
      ctx.lineTo(hx + 4 * s, hy - 11 * s);
      ctx.stroke();

      // Chân hươu
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.5 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(hx - 4 * s, hy + 3 * s);
      ctx.lineTo(hx - 4 * s, hy + 8 * s);
      ctx.moveTo(hx + 3 * s, hy + 3 * s);
      ctx.lineTo(hx + 3 * s, hy + 8 * s);
      ctx.stroke();
    }

    ctx.restore();
  }

  /** Tuyến Cát Linh: Rễ cây đại thụ khổng lồ uốn lượn như cầu rồng trên không. */
  private catLinhRoots(x: number, y: number, r: number, seed: number): void {
    const { ctx } = this;
    ctx.save();

    // Bóng đổ đại thụ
    ctx.fillStyle = 'rgba(30, 10, 50, 0.45)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.35, r * 0.9, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cầu rễ cây cổ thụ khổng lồ uốn lượn
    ctx.strokeStyle = '#581c87';
    ctx.lineWidth = 6 * this.dpr;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7, y + r * 0.2);
    ctx.quadraticCurveTo(x, y - r * 0.6, x + r * 0.7, y + r * 0.1);
    ctx.stroke();

    ctx.strokeStyle = '#7e22ce';
    ctx.lineWidth = 3.5 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7, y + r * 0.2);
    ctx.quadraticCurveTo(x, y - r * 0.6, x + r * 0.7, y + r * 0.1);
    ctx.stroke();

    // Trụ rễ cây cắm xuống đất
    ctx.fillStyle = '#3b0764';
    ctx.fillRect(x - 3 * this.dpr, y - r * 0.3, 6 * this.dpr, r * 0.6);

    // Quả cầu rễ phát quang màu ngọc bích trên đỉnh
    const pulse = 0.7 + 0.3 * Math.sin(this.tick / 7 + seed);
    const glow = ctx.createRadialGradient(x, y - r * 0.35, 2 * this.dpr, x, y - r * 0.35, 12 * this.dpr);
    glow.addColorStop(0, `rgba(168, 85, 247, ${0.9 * pulse})`);
    glow.addColorStop(1, 'rgba(126, 34, 206, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.35, 12 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** Thạch trụ chọc trời (Keangnam / Lotte). */
  private ancientTower(x: number, y: number, r: number, seed: number): void {
    const { ctx } = this;
    ctx.save();

    // Bóng trụ
    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.4, y + r * 0.35, r * 0.8, r * 0.3, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Tháp đá nhiều tầng cao vút
    const tw = r * 0.5;
    const th = r * 1.5;

    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2 * this.dpr;
    ctx.fillRect(x - tw / 2, y - th + r * 0.3, tw, th);
    ctx.strokeRect(x - tw / 2, y - th + r * 0.3, tw, th);

    // Tầng tháp thu nhỏ dần
    ctx.fillStyle = '#64748b';
    ctx.fillRect(x - tw * 0.35, y - th - th * 0.3 + r * 0.3, tw * 0.7, th * 0.3);
    ctx.strokeRect(x - tw * 0.35, y - th - th * 0.3 + r * 0.3, tw * 0.7, th * 0.3);

    // Điểm sáng ngọc trên đỉnh tháp
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(x, y - th - th * 0.3 + r * 0.25, 3 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** Cầu Cổ Long Cốt (Cầu Long Biên). */
  private ancientBridge(x: number, y: number, r: number, seed: number): void {
    const { ctx } = this;
    ctx.save();

    // Vòm cầu xương rồng cổ
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 4 * this.dpr;
    ctx.beginPath();
    ctx.arc(x, y + r * 0.2, r * 0.7, Math.PI, Math.PI * 2);
    ctx.stroke();

    // Các nhịp xương ziczac
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2 * this.dpr;
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const ang = Math.PI + (i / steps) * Math.PI;
      const bx = x + Math.cos(ang) * r * 0.7;
      const by = y + r * 0.2 + Math.sin(ang) * r * 0.7;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx, y + r * 0.2);
      ctx.stroke();
    }

    ctx.restore();
  }

  /** Thái Dương Cự Thạch Cung (Sun Square - Lê Đức Thọ). */
  private sunSquareMonolith(x: number, y: number, r: number, seed: number): void {
    const { ctx } = this;
    ctx.save();

    // Bóng đổ
    ctx.fillStyle = 'rgba(30, 20, 10, 0.55)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.35, r * 0.9, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // 4 Cột thạch trụ hoàng kim vuông vức
    const s = r * 0.28;
    ctx.fillStyle = '#ca8a04';
    ctx.strokeStyle = '#854d0e';
    ctx.lineWidth = 1.8 * this.dpr;

    const corners = [
      [-r * 0.35, -r * 0.35],
      [r * 0.35, -r * 0.35],
      [-r * 0.35, r * 0.25],
      [r * 0.35, r * 0.25],
    ];
    for (const [cx, cy] of corners) {
      ctx.fillRect(x + cx - s / 2, y + cy - s * 1.5, s, s * 1.8);
      ctx.strokeRect(x + cx - s / 2, y + cy - s * 1.5, s, s * 1.8);
    }

    // Đĩa Mặt Trời Thái Dương phát sáng ở trung tâm
    const pulse = 0.7 + 0.3 * Math.sin(this.tick / 6 + seed);
    const sunGlow = ctx.createRadialGradient(x, y - r * 0.2, 2 * this.dpr, x, y - r * 0.2, r * 0.5);
    sunGlow.addColorStop(0, `rgba(250, 204, 21, ${0.95 * pulse})`);
    sunGlow.addColorStop(0.6, `rgba(234, 88, 12, ${0.4 * pulse})`);
    sunGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.2, r * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(x, y - r * 0.2, 5 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** Cổ Mộ Tiền Nhân (Nghĩa Trang Mai Dịch). */
  private ancientTombs(x: number, y: number, r: number, seed: number): void {
    const { ctx } = this;
    const rng = createRng(seed ^ 0x7788);
    ctx.save();

    // Gò đất cỏ cổ kính u tịch
    ctx.fillStyle = '#3f3f46';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.1, r * 0.85, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Các bia đá tiền nhân rêu phong xếp tầng
    for (let i = 0; i < 5; i++) {
      const bx = x + (rng() - 0.5) * r * 1.1;
      const by = y + (rng() - 0.5) * r * 0.6;
      const bw = (5 + rng() * 4) * this.dpr;
      const bh = (10 + rng() * 8) * this.dpr;

      // Bóng bia đá
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(bx, by + 2 * this.dpr, bw * 1.2, 3 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Thân bia đá xám trầm
      ctx.fillStyle = '#71717a';
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 1.2 * this.dpr;
      ctx.beginPath();
      ctx.roundRect(bx - bw / 2, by - bh, bw, bh, [3 * this.dpr, 3 * this.dpr, 0, 0]);
      ctx.fill();
      ctx.stroke();

      // Hoa dạ yến thảo dại màu tím nở quanh chân mộ
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.arc(bx + 3 * this.dpr, by, 1.5 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /** Y Viện Thảo Dược (Bệnh viện 198, Bạch Mai, Việt Đức). */
  private healerLodge(x: number, y: number, r: number, seed: number): void {
    const { ctx } = this;
    ctx.save();

    // Lều thảo dược lớn hình nón
    ctx.fillStyle = 'rgba(10, 30, 15, 0.5)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.3, r * 0.8, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#166534';
    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = 2 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.8);
    ctx.lineTo(x - r * 0.5, y + r * 0.2);
    ctx.lineTo(x + r * 0.5, y + r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Biểu tượng thảo mộc chữ thập xanh ngọc
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(x - 2 * this.dpr, y - r * 0.4 - 5 * this.dpr, 4 * this.dpr, 10 * this.dpr);
    ctx.fillRect(x - 5 * this.dpr, y - r * 0.4 - 2 * this.dpr, 10 * this.dpr, 4 * this.dpr);

    ctx.restore();
  }

  /** Đại Bí Cảnh Tri Thức (ĐH Quốc Gia, Thương Mại, Sư Phạm, Bách Khoa). */
  private ancientAcademy(x: number, y: number, r: number, seed: number): void {
    const { ctx } = this;
    ctx.save();

    // Điện thờ tri thức cự thạch
    ctx.fillStyle = '#1e3a8a';
    ctx.strokeStyle = '#172554';
    ctx.lineWidth = 1.8 * this.dpr;

    // Bậc tam cấp đá
    ctx.fillRect(x - r * 0.6, y, r * 1.2, r * 0.25);
    ctx.strokeRect(x - r * 0.6, y, r * 1.2, r * 0.25);

    // Mái vòm tri thức
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, y - r * 0.3);
    ctx.lineTo(x, y - r * 0.9);
    ctx.lineTo(x + r * 0.5, y - r * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Điểm sáng tri thức xanh lam
    const pulse = 0.7 + 0.3 * Math.sin(this.tick / 10 + seed);
    ctx.fillStyle = `rgba(147, 197, 253, ${pulse})`;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.45, 3.5 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** Đấu Trường Quái Thú Tiền Sử (Sân Mỹ Đình, Cung Điền Kinh). */
  private ancientColosseum(x: number, y: number, r: number, seed: number): void {
    const { ctx } = this;
    ctx.save();

    // Vòng khán đài đá tròn bao quanh
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 4 * this.dpr;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.8, r * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.65, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ngọn đuốc đấu trường rực cháy ở 2 đầu
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.arc(x - r * 0.5, y, 4 * this.dpr, 0, Math.PI * 2);
    ctx.arc(x + r * 0.5, y, 4 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** Trạm Lữ Khách Tiền Sử (Bến Xe Mỹ Đình, Giáp Bát). */
  private travelersLodge(x: number, y: number, r: number, seed: number): void {
    const { ctx } = this;
    ctx.save();

    // Lều trại lữ khách nhiều gian
    ctx.fillStyle = '#c2410c';
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 1.6 * this.dpr;

    for (let k = -1; k <= 1; k++) {
      const lx = x + k * r * 0.35;
      const ly = y + (k === 0 ? -r * 0.1 : r * 0.1);
      ctx.beginPath();
      ctx.moveTo(lx, ly - r * 0.45);
      ctx.lineTo(lx - r * 0.25, ly + r * 0.15);
      ctx.lineTo(lx + r * 0.25, ly + r * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  /** Mỏ đất sét ven sông. */
  private clayDeposit(x: number, y: number, r: number, seed: number): void {
    const { ctx } = this;
    ctx.save();

    // Mảng phù sa mịn nâu đỏ
    ctx.fillStyle = '#9a3412';
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.7, r * 0.45, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Các khối đất sét nặn mộc
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.arc(x - 5 * this.dpr, y - 3 * this.dpr, 4 * this.dpr, 0, Math.PI * 2);
    ctx.arc(x + 6 * this.dpr, y + 2 * this.dpr, 5 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** Mỏm đá nham nhở đính khoáng sản lấp lánh. */
  private crags(x: number, y: number, r: number, seed: number): void {
    const { ctx } = this;
    const rng = createRng(seed ^ 0x3344);
    const count = Math.max(3, Math.min(6, Math.round(r / (10 * this.dpr))));

    ctx.save();
    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = rng() * r * 0.7;
      const cx = x + Math.cos(angle) * dist;
      const cy = y + Math.sin(angle) * dist * 0.8;
      const w = (6 + rng() * 6) * this.dpr;
      const h = (5 + rng() * 5) * this.dpr;

      ctx.fillStyle = '#57534e';
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 1.2 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(cx - w, cy + h * 0.4);
      ctx.lineTo(cx - w * 0.2, cy - h);
      ctx.lineTo(cx + w, cy + h * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Điểm sáng khoáng thạch
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(cx, cy - h * 0.2, 1.4 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * CĂN CỨ / DOANH TRẠI SINH TỒN CHI TIẾT ĐỈNH CAO:
   *  - Túp lều mái lá dừa / tranh tiền sử 3D với kết cấu khung gỗ và cửa da thú.
   *  - Bếp lửa trại quay thịt nướng bập bùng, có khói xám bốc lên cao.
   *  - Giá phơi cá khô và tấm da thú căng nắng.
   *  - Hòm kho an toàn bọc da cạnh lều.
   */
  private drawCamp(at: [number, number], pxPerMeter: number): void {
    const { ctx } = this;
    const [x, y] = at;
    const size = Math.max(24 * this.dpr, 34 * pxPerMeter);

    ctx.save();

    // 1. Quầng sáng ấm áp tỏa rộng của bếp lửa trại
    const pulse = 0.85 + 0.15 * Math.sin(this.tick / 8);
    const glow = ctx.createRadialGradient(x + size * 0.55, y + size * 0.25, 2 * this.dpr, x + size * 0.55, y + size * 0.25, size * 2.2 * pulse);
    glow.addColorStop(0, 'rgba(245, 158, 11, 0.42)');
    glow.addColorStop(0.5, 'rgba(234, 88, 12, 0.15)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x + size * 0.55, y + size * 0.25, size * 2.2 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // 2. Bóng đổ 3D của cả khu căn cứ (đổ theo hướng đông bắc/đông nam)
    ctx.fillStyle = 'rgba(12, 9, 6, 0.55)';
    ctx.beginPath();
    ctx.ellipse(x - size * 0.1, y + size * 0.4, size * 1.35, size * 0.52, 0.15, 0, Math.PI * 2);
    ctx.fill();

    // ==================== TÚP LỀU MÁI LÁ DỪA TIỀN SỬ (THATVHED HUT) ====================
    const hutX = x - size * 0.25;
    const hutY = y - size * 0.1;
    const hutW = size * 1.1;
    const hutH = size * 0.95;

    // Khung tường gỗ lều
    ctx.fillStyle = '#543820';
    ctx.fillRect(hutX - hutW * 0.42, hutY - hutH * 0.2, hutW * 0.84, hutH * 0.55);

    // Cửa lều vén bạt da thú
    ctx.fillStyle = '#1c130c';
    ctx.beginPath();
    ctx.moveTo(hutX - hutW * 0.15, hutY + hutH * 0.35);
    ctx.lineTo(hutX, hutY - hutH * 0.1);
    ctx.lineTo(hutX + hutW * 0.15, hutY + hutH * 0.35);
    ctx.closePath();
    ctx.fill();

    // Mái lợp lá dừa / tranh nhiều tầng (Thatched Roof)
    ctx.fillStyle = '#85532a';
    ctx.strokeStyle = '#d9975b';
    ctx.lineWidth = 1.8 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(hutX, hutY - hutH * 0.65);
    ctx.lineTo(hutX - hutW * 0.55, hutY + hutH * 0.2);
    ctx.lineTo(hutX + hutW * 0.55, hutY + hutH * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Tầng mái lá thứ hai xếp lớp
    ctx.fillStyle = '#a16834';
    ctx.beginPath();
    ctx.moveTo(hutX, hutY - hutH * 0.65);
    ctx.lineTo(hutX - hutW * 0.42, hutY - hutH * 0.05);
    ctx.lineTo(hutX + hutW * 0.42, hutY - hutH * 0.05);
    ctx.closePath();
    ctx.fill();

    // Cọc gỗ bắt chéo đỉnh nóc lều
    ctx.strokeStyle = '#45220c';
    ctx.lineWidth = 2.4 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(hutX - 4 * this.dpr, hutY - hutH * 0.82);
    ctx.lineTo(hutX + 3 * this.dpr, hutY - hutH * 0.55);
    ctx.moveTo(hutX + 4 * this.dpr, hutY - hutH * 0.82);
    ctx.lineTo(hutX - 3 * this.dpr, hutY - hutH * 0.55);
    ctx.stroke();

    // ==================== BẾP LỬA TRẠI QUAY THỊT (ROASTING SPIT) ====================
    const fireX = x + size * 0.62;
    const fireY = y + size * 0.22;

    // Vòng đá cuội xếp quanh bếp
    ctx.fillStyle = '#78716c';
    for (let r = 0; r < 8; r++) {
      const a = (r / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(fireX + Math.cos(a) * 7 * this.dpr, fireY + Math.sin(a) * 4.5 * this.dpr, 2.2 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hai cọc gỗ chạc ba cắm hai bên
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 2 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(fireX - 8 * this.dpr, fireY + 4 * this.dpr);
    ctx.lineTo(fireX - 8 * this.dpr, fireY - 10 * this.dpr);
    ctx.moveTo(fireX + 8 * this.dpr, fireY + 4 * this.dpr);
    ctx.lineTo(fireX + 8 * this.dpr, fireY - 10 * this.dpr);
    ctx.stroke();

    // Thanh ngang xiên thịt nướng
    ctx.beginPath();
    ctx.moveTo(fireX - 10 * this.dpr, fireY - 8 * this.dpr);
    ctx.lineTo(fireX + 10 * this.dpr, fireY - 8 * this.dpr);
    ctx.stroke();

    // Tảng thịt rừng nướng vàng ruộm trên xiên
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.ellipse(fireX, fireY - 8 * this.dpr, 5 * this.dpr, 2.8 * this.dpr, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ngọn lửa 3 tầng bập bùng
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(fireX, fireY - 2 * this.dpr, 4.5 * this.dpr * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(fireX, fireY - 3.5 * this.dpr, 3.2 * this.dpr * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(fireX, fireY - 4.5 * this.dpr, 1.8 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    // Cột khói xám bốc lên cao bồng bềnh
    for (let m = 0; m < 4; m++) {
      const smokeProg = ((this.tick * 0.7 + m * 16) % 64) / 64;
      const smkY = fireY - 10 * this.dpr - smokeProg * 32 * this.dpr;
      const smkX = fireX + Math.sin(this.tick / 9 + m) * 6 * this.dpr + smokeProg * 12 * this.dpr;
      const smkAlpha = (1 - smokeProg) * 0.38;
      const smkRadius = (3.5 + smokeProg * 8) * this.dpr;
      ctx.fillStyle = `rgba(226, 232, 240, ${smkAlpha})`;
      ctx.beginPath();
      ctx.arc(smkX, smkY, smkRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // ==================== GIÁ PHƠI CÁ & DA THÚ (DRYING RACK) ====================
    const rackX = x - size * 0.55;
    const rackY = y + size * 0.32;

    ctx.strokeStyle = '#543820';
    ctx.lineWidth = 1.8 * this.dpr;
    // Cọc trái & phải
    ctx.beginPath();
    ctx.moveTo(rackX - 7 * this.dpr, rackY + 5 * this.dpr);
    ctx.lineTo(rackX - 7 * this.dpr, rackY - 9 * this.dpr);
    ctx.moveTo(rackX + 7 * this.dpr, rackY + 5 * this.dpr);
    ctx.lineTo(rackX + 7 * this.dpr, rackY - 9 * this.dpr);
    // Xà ngang
    ctx.moveTo(rackX - 9 * this.dpr, rackY - 7 * this.dpr);
    ctx.lineTo(rackX + 9 * this.dpr, rackY - 7 * this.dpr);
    ctx.stroke();

    // Tấm da thú phơi căng
    ctx.fillStyle = '#a16207';
    ctx.fillRect(rackX - 5 * this.dpr, rackY - 6 * this.dpr, 10 * this.dpr, 8 * this.dpr);

    // ==================== HÒM KÉT KHO BỌC DA (STORAGE CHEST) ====================
    const chestX = hutX + hutW * 0.42;
    const chestY = hutY + hutH * 0.35;
    ctx.fillStyle = '#78350f';
    ctx.fillRect(chestX, chestY - 5 * this.dpr, 10 * this.dpr, 7 * this.dpr);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1 * this.dpr;
    ctx.strokeRect(chestX, chestY - 5 * this.dpr, 10 * this.dpr, 7 * this.dpr);

    // Nhãn Căn Cứ / Nhà nổi bật
    ctx.fillStyle = '#fef08a';
    ctx.font = `bold ${11.5 * this.dpr}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = 6 * this.dpr;
    ctx.fillText('🏕️ CĂN CỨ (NHÀ)', x, y + size * 1.25);
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  private drawPlayer(x: number, y: number, pxPerMeter: number, input: RenderInput): void {
    const { ctx } = this;
    const pulse = 0.5 + 0.5 * Math.sin(this.tick / 16);
    const bob = Math.sin(this.tick / 8) * 1.8 * this.dpr;
    const isFemale = input.gender === 'female';

    ctx.save();

    // 1. Vòng bán kính tương tác 30m
    ctx.strokeStyle = `rgba(254, 240, 138, ${0.2 + pulse * 0.18})`;
    ctx.lineWidth = 1.8 * this.dpr;
    ctx.setLineDash([6 * this.dpr, 6 * this.dpr]);
    ctx.beginPath();
    ctx.arc(x, y, 30 * pxPerMeter, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Vầng hào quang nhận thức mềm mịn quanh người chơi
    const glow = ctx.createRadialGradient(x, y, 4 * this.dpr, x, y, 32 * this.dpr);
    glow.addColorStop(0, isFemale ? 'rgba(45, 212, 191, 0.35)' : 'rgba(249, 115, 22, 0.35)');
    glow.addColorStop(0.55, isFemale ? 'rgba(13, 148, 136, 0.15)' : 'rgba(234, 88, 12, 0.15)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 32 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    // 3. Đom đóm / 6 hạt bụi ánh sáng linh hồn xoay 3D quanh nhân vật
    for (let s = 0; s < 6; s++) {
      const sAngle = (this.tick / 22) + (s * Math.PI / 3);
      const sRadius = (18 + Math.sin(this.tick / 10 + s) * 5) * this.dpr;
      const sx = x + Math.cos(sAngle) * sRadius;
      const sy = y + Math.sin(sAngle) * sRadius * 0.7;
      const sAlpha = 0.4 + 0.6 * Math.sin(this.tick / 7 + s * 1.5);
      ctx.fillStyle = isFemale ? `rgba(94, 234, 212, ${sAlpha})` : `rgba(254, 215, 170, ${sAlpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.8 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Bóng đổ 3D mềm mại tự nhiên dưới đất theo góc mặt trời
    ctx.fillStyle = 'rgba(8, 6, 4, 0.52)';
    ctx.beginPath();
    ctx.ellipse(x - 2 * this.dpr, y + 11 * this.dpr, 13 * this.dpr, 5.5 * this.dpr, -0.2, 0, Math.PI * 2);
    ctx.fill();

    const py = y + bob;

    if (isFemale) {
      // ==================== NỮ CHIẾN BINH TIỀN SỬ (THÁNH NỮ RỪNG XANH) ====================
      // Hai chân da bánh mật có dây da quấn cổ chân
      ctx.fillStyle = '#b47b52';
      ctx.fillRect(x - 5.5 * this.dpr, py + 4 * this.dpr, 3.2 * this.dpr, 7.5 * this.dpr);
      ctx.fillRect(x + 2.3 * this.dpr, py + 4 * this.dpr, 3.2 * this.dpr, 7.5 * this.dpr);
      // Dây da và ngọc quấn bắp chân
      ctx.fillStyle = '#0d9488';
      ctx.fillRect(x - 5.5 * this.dpr, py + 8.5 * this.dpr, 3.2 * this.dpr, 1.8 * this.dpr);
      ctx.fillRect(x + 2.3 * this.dpr, py + 8.5 * this.dpr, 3.2 * this.dpr, 1.8 * this.dpr);

      // Yếm & Váy da thú viền lông tuyết trắng phồng
      ctx.fillStyle = '#7c4a2d';
      ctx.beginPath();
      ctx.moveTo(x - 7 * this.dpr, py + 5 * this.dpr);
      ctx.lineTo(x + 7 * this.dpr, py + 5 * this.dpr);
      ctx.lineTo(x + 8.5 * this.dpr, py + 7.5 * this.dpr);
      ctx.lineTo(x + 6 * this.dpr, py - 5.5 * this.dpr);
      ctx.lineTo(x - 6 * this.dpr, py - 5.5 * this.dpr);
      ctx.lineTo(x - 8.5 * this.dpr, py + 7.5 * this.dpr);
      ctx.closePath();
      ctx.fill();

      // Viền lông trắng tuyết phồng mềm ở ngực
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.ellipse(x, py - 5.5 * this.dpr, 6.5 * this.dpr, 1.8 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Thắt lưng ngọc bích phát sáng ánh ngọc lam
      ctx.strokeStyle = '#2dd4bf';
      ctx.lineWidth = 2.2 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(x - 7 * this.dpr, py + 1.5 * this.dpr);
      ctx.lineTo(x + 7 * this.dpr, py + 1.5 * this.dpr);
      ctx.stroke();

      // Viên ngọc bích trung tâm thắt lưng phát sáng
      ctx.fillStyle = '#5eead4';
      ctx.beginPath();
      ctx.arc(x, py + 1.5 * this.dpr, 2.5 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Chuỗi hạt ngọc bích trước ngực
      ctx.fillStyle = '#2dd4bf';
      ctx.beginPath();
      ctx.arc(x - 2 * this.dpr, py - 2 * this.dpr, 1.2 * this.dpr, 0, Math.PI * 2);
      ctx.arc(x, py - 1 * this.dpr, 1.4 * this.dpr, 0, Math.PI * 2);
      ctx.arc(x + 2 * this.dpr, py - 2 * this.dpr, 1.2 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Bím tóc đen mun dài duyên dáng quàng 2 bên ngực
      ctx.fillStyle = '#140c06';
      ctx.beginPath();
      ctx.ellipse(x - 8 * this.dpr, py - 1 * this.dpr, 3 * this.dpr, 8.5 * this.dpr, 0.25, 0, Math.PI * 2);
      ctx.ellipse(x + 8 * this.dpr, py - 1 * this.dpr, 3 * this.dpr, 8.5 * this.dpr, -0.25, 0, Math.PI * 2);
      ctx.fill();

      // Vòng thắt ngọc bích ở đuôi bím tóc
      ctx.fillStyle = '#2dd4bf';
      ctx.beginPath();
      ctx.arc(x - 8.5 * this.dpr, py + 4.5 * this.dpr, 2 * this.dpr, 0, Math.PI * 2);
      ctx.arc(x + 8.5 * this.dpr, py + 4.5 * this.dpr, 2 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Quyền Trượng Linh Hồn tay phải
      const staffX = x + 11 * this.dpr;
      ctx.strokeStyle = '#854d0e';
      ctx.lineWidth = 2.2 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(staffX, py - 14 * this.dpr);
      ctx.lineTo(staffX, py + 10 * this.dpr);
      ctx.stroke();

      // Viên ngọc lục bảo toả sáng đỉnh trượng
      ctx.fillStyle = '#14b8a6';
      ctx.beginPath();
      ctx.arc(staffX, py - 14 * this.dpr, 4.2 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ccfbf1';
      ctx.beginPath();
      ctx.arc(staffX, py - 15 * this.dpr, 2 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Tia sao sáng lấp lánh (Sparkle Star) đỉnh trượng
      const starPulse = 0.6 + 0.4 * Math.sin(this.tick / 6);
      ctx.strokeStyle = `rgba(255, 255, 255, ${starPulse})`;
      ctx.lineWidth = 1.2 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(staffX - 6 * this.dpr, py - 14 * this.dpr);
      ctx.lineTo(staffX + 6 * this.dpr, py - 14 * this.dpr);
      ctx.moveTo(staffX, py - 20 * this.dpr);
      ctx.lineTo(staffX, py - 8 * this.dpr);
      ctx.stroke();

      // Đầu & Gương mặt
      ctx.fillStyle = '#c58e65';
      ctx.beginPath();
      ctx.arc(x, py - 9.5 * this.dpr, 6.2 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Tóc mái đen mun
      ctx.fillStyle = '#140c06';
      ctx.beginPath();
      ctx.arc(x, py - 11 * this.dpr, 6.5 * this.dpr, Math.PI * 0.9, Math.PI * 2.1);
      ctx.fill();

      // Dải băng cài lông công xanh ngọc
      ctx.strokeStyle = '#0f766e';
      ctx.lineWidth = 1.8 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(x - 6 * this.dpr, py - 9.5 * this.dpr);
      ctx.lineTo(x + 6 * this.dpr, py - 9.5 * this.dpr);
      ctx.stroke();

      // Lông chim công biếc cài trán
      ctx.fillStyle = '#0d9488';
      ctx.beginPath();
      ctx.moveTo(x + 4 * this.dpr, py - 11 * this.dpr);
      ctx.quadraticCurveTo(x + 12 * this.dpr, py - 20 * this.dpr, x + 9 * this.dpr, py - 9 * this.dpr);
      ctx.fill();

      // Vệt sơn má chiến binh ngọc lam
      ctx.fillStyle = '#2dd4bf';
      ctx.fillRect(x - 5 * this.dpr, py - 8 * this.dpr, 2.2 * this.dpr, 1.3 * this.dpr);
      ctx.fillRect(x + 2.8 * this.dpr, py - 8 * this.dpr, 2.2 * this.dpr, 1.3 * this.dpr);
    } else {
      // ==================== NAM THỢ SĂN TIỀN SỬ (CHÚA TỂ RỪNG HOANG) ====================
      // Hai chân cơ bắp lực lưỡng
      ctx.fillStyle = '#a1653d';
      ctx.fillRect(x - 6 * this.dpr, py + 4 * this.dpr, 4 * this.dpr, 8 * this.dpr);
      ctx.fillRect(x + 2 * this.dpr, py + 4 * this.dpr, 4 * this.dpr, 8 * this.dpr);
      // Dây da quấn cổ chân
      ctx.fillStyle = '#3a1e0b';
      ctx.fillRect(x - 6 * this.dpr, py + 9 * this.dpr, 4 * this.dpr, 1.8 * this.dpr);
      ctx.fillRect(x + 2 * this.dpr, py + 9 * this.dpr, 4 * this.dpr, 1.8 * this.dpr);

      // Thân người vạm vỡ cơ bắp cuồn cuộn
      ctx.fillStyle = '#b87a4b';
      ctx.beginPath();
      ctx.arc(x, py - 3 * this.dpr, 7 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Khối bóng cơ bắp ngực nổi 3D
      ctx.strokeStyle = '#94582e';
      ctx.lineWidth = 1.4 * this.dpr;
      ctx.beginPath();
      ctx.arc(x - 2.5 * this.dpr, py - 3 * this.dpr, 2.2 * this.dpr, 0, Math.PI * 0.8);
      ctx.arc(x + 2.5 * this.dpr, py - 3 * this.dpr, 2.2 * this.dpr, Math.PI * 0.2, Math.PI);
      ctx.stroke();

      // Khố da báo vằn đốm viền tua rua da thú
      ctx.fillStyle = '#8a4b20';
      ctx.beginPath();
      ctx.moveTo(x - 7.5 * this.dpr, py);
      ctx.lineTo(x + 7.5 * this.dpr, py);
      ctx.lineTo(x + 6 * this.dpr, py + 7.5 * this.dpr);
      ctx.lineTo(x - 6 * this.dpr, py + 7.5 * this.dpr);
      ctx.closePath();
      ctx.fill();

      // Họa tiết đốm da thú trên khố
      ctx.fillStyle = '#3a1e0b';
      ctx.fillRect(x - 3.5 * this.dpr, py + 2 * this.dpr, 2 * this.dpr, 2 * this.dpr);
      ctx.fillRect(x + 2 * this.dpr, py + 3.5 * this.dpr, 2.2 * this.dpr, 2 * this.dpr);

      // Dây da chéo ngực đính nanh thú
      ctx.strokeStyle = '#3e1f0a';
      ctx.lineWidth = 2.2 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(x - 6 * this.dpr, py - 8 * this.dpr);
      ctx.lineTo(x + 6 * this.dpr, py + 3 * this.dpr);
      ctx.stroke();

      // Chuỗi răng nanh gấu trắng ngà chạm khắc
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.moveTo(x, py - 2.5 * this.dpr);
      ctx.lineTo(x + 3 * this.dpr, py + 3.5 * this.dpr);
      ctx.lineTo(x - 1.2 * this.dpr, py + 1.8 * this.dpr);
      ctx.closePath();
      ctx.fill();

      // Ngọn Giáo Thợ Săn Thần Thoại tay phải
      const spearX = x + 12 * this.dpr;
      ctx.strokeStyle = '#5c381c';
      ctx.lineWidth = 2.4 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(spearX, py - 20 * this.dpr);
      ctx.lineTo(spearX, py + 11 * this.dpr);
      ctx.stroke();

      // Mũi giáo đá Obsidian vát nhọn sắc lẹm viền bạc
      ctx.fillStyle = '#e2e8f0';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.2 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(spearX, py - 26 * this.dpr);
      ctx.lineTo(spearX + 4 * this.dpr, py - 18 * this.dpr);
      ctx.lineTo(spearX - 4 * this.dpr, py - 18 * this.dpr);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 2 Dải lông vũ đỏ cam rực rỡ thắt cổ giáo bay theo gió
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.moveTo(spearX, py - 18 * this.dpr);
      ctx.lineTo(spearX + 6 * this.dpr, py - 14 * this.dpr);
      ctx.lineTo(spearX + 1.5 * this.dpr, py - 13 * this.dpr);
      ctx.fill();

      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(spearX, py - 18 * this.dpr);
      ctx.lineTo(spearX - 5 * this.dpr, py - 15 * this.dpr);
      ctx.lineTo(spearX - 1.5 * this.dpr, py - 14 * this.dpr);
      ctx.fill();

      // Đầu & Gương mặt
      ctx.fillStyle = '#b87a4b';
      ctx.beginPath();
      ctx.arc(x, py - 10 * this.dpr, 6.5 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Mái tóc đen rậm hoang dã bồng bềnh
      ctx.fillStyle = '#120b07';
      ctx.beginPath();
      ctx.arc(x, py - 11.5 * this.dpr, 7 * this.dpr, Math.PI * 0.85, Math.PI * 2.15);
      ctx.fill();

      // Dải băng da trùm trán
      ctx.strokeStyle = '#6c3b17';
      ctx.lineWidth = 2 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(x - 6.5 * this.dpr, py - 10 * this.dpr);
      ctx.lineTo(x + 6.5 * this.dpr, py - 10 * this.dpr);
      ctx.stroke();

      // Lông chim đại bàng đỏ rực cài trán
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(x - 4 * this.dpr, py - 11.5 * this.dpr);
      ctx.quadraticCurveTo(x - 14 * this.dpr, py - 21 * this.dpr, x - 7 * this.dpr, py - 8.5 * this.dpr);
      ctx.fill();

      // Vệt sơn chiến binh đỏ đất nung trên má
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(x - 5.5 * this.dpr, py - 8.5 * this.dpr, 2.4 * this.dpr, 1.5 * this.dpr);
      ctx.fillRect(x + 3 * this.dpr, py - 8.5 * this.dpr, 2.4 * this.dpr, 1.5 * this.dpr);
    }

    if (!input.hasFix) {
      // Nhãn vị trí ước lượng tinh tế
      ctx.fillStyle = '#d4c5a9';
      ctx.font = `600 ${10 * this.dpr}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 4 * this.dpr;
      ctx.fillText('📍 Vị trí ước lượng', x, y - 30 * pxPerMeter - 8 * this.dpr);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  private drawRain(w: number, h: number, intensity: number): void {
    const { ctx } = this;
    const drops = Math.round(90 * intensity);

    ctx.save();
    ctx.strokeStyle = 'rgba(180, 200, 215, 0.34)';
    ctx.lineWidth = 1 * this.dpr;
    for (let i = 0; i < drops; i++) {
      const rng = createRng(hashSeed('rain', i));
      const x = (rng() * w + this.tick * 1.6) % w;
      const y = (rng() * h + this.tick * 9) % h;
      const len = (8 + rng() * 10) * this.dpr;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - len * 0.28, y + len);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * HỆ THỐNG ÁNH SÁNG & KHÍ QUYỂN CHUẨN XÁC:
   *  - BAN NGÀY (Day): Ánh nắng chan hoà tươi sáng, không bị tối đen mép màn hình.
   *  - HOÀNG HÔN (Evening): Ánh cam ấm hổ phách của buổi chiều tà.
   *  - BAN ĐÊM (Night): Màn đêm đen huyền bí, đuốc người chơi & lửa trại căn cứ khoét sáng rực rỡ vùng xung quanh!
   */
  private drawAtmosphereAndLighting(
    w: number,
    h: number,
    input: RenderInput,
    project: (at: LatLon) => [number, number],
  ): void {
    const { ctx } = this;
    ctx.save();

    if (input.phase === 'day') {
      // Ban ngày: Ánh nắng mặt trời chan hoà nhẹ
      ctx.fillStyle = 'rgba(254, 240, 138, 0.05)';
      ctx.fillRect(0, 0, w, h);

      // Viền mờ rất nhẹ để tăng chiều sâu
      const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.55, w / 2, h / 2, Math.max(w, h) * 0.8);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.12)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);
    } else if (input.phase === 'evening') {
      // Hoàng hôn / Chiều tà: Phủ sắc cam hổ phách lãng mạn
      ctx.fillStyle = 'rgba(249, 115, 22, 0.16)';
      ctx.fillRect(0, 0, w, h);

      const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(45, 20, 8, 0.52)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);
    } else {
      // Ban đêm: Màn đêm phủ dày, ngọn đuốc nhân vật và lửa trại thắp sáng
      // Tạo canvas tạm hoặc vẽ lớp màn đêm khoét sáng
      const playerX = w / 2 + this.panX;
      const playerY = h / 2 + this.panY;
      const torchPulse = 0.9 + 0.1 * Math.sin(this.tick / 7);
      const torchRadius = 65 * this.dpr * torchPulse;

      // Lớp bóng đêm xanh đen toàn màn hình
      const nightGrad = ctx.createRadialGradient(playerX, playerY, 15 * this.dpr, playerX, playerY, torchRadius * 1.8);
      nightGrad.addColorStop(0, 'rgba(6, 10, 20, 0.15)');
      nightGrad.addColorStop(0.5, 'rgba(6, 10, 20, 0.65)');
      nightGrad.addColorStop(1, 'rgba(5, 8, 16, 0.92)');

      ctx.fillStyle = nightGrad;
      ctx.fillRect(0, 0, w, h);

      // Nếu có Căn Cứ / Lửa Trại -> chiếu sáng thêm vùng quanh Căn Cứ
      if (input.homeCellCenter) {
        const [campX, campY] = project(input.homeCellCenter);
        const campGlow = ctx.createRadialGradient(campX, campY, 10 * this.dpr, campX, campY, 90 * this.dpr * torchPulse);
        campGlow.addColorStop(0, 'rgba(245, 158, 11, 0.45)');
        campGlow.addColorStop(0.6, 'rgba(234, 88, 12, 0.18)');
        campGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = campGlow;
        ctx.beginPath();
        ctx.arc(campX, campY, 90 * this.dpr * torchPulse, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}

/** Chuyển toạ độ chạm trên canvas thành POI gần nhất — cho phép bấm vào cảnh vật. */
export function featureAtPoint(
  features: MapFeature[],
  center: LatLon,
  point: { x: number; y: number },
  canvas: HTMLCanvasElement,
  spanMeters = 420,
): MapFeature | null {
  const rect = canvas.getBoundingClientRect();
  const pxPerMeter = Math.min(rect.width, rect.height) / spanMeters;

  const dxMeters = (point.x - rect.width / 2) / pxPerMeter;
  const dyMeters = -(point.y - rect.height / 2) / pxPerMeter;

  const at: LatLon = {
    lat: center.lat + dyMeters * metersToLatDegrees(1),
    lon: center.lon + dxMeters * metersToLonDegrees(1, center.lat),
  };

  let best: MapFeature | null = null;
  let bestDistance = Infinity;

  for (const feature of features) {
    const d = distanceMeters(at, feature);
    if (d < Math.max(feature.radiusMeters, 25) && d < bestDistance) {
      best = feature;
      bestDistance = d;
    }
  }

  return best;
}
