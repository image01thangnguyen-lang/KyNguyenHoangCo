/**
 * Renderer bản đồ "Hoàng Cổ Đồ" (Antique Street Map Renderer)
 * Kết hợp giữa hệ thống đường phố GPS hiện đại chuẩn xác với phong cách bản đồ giấy da cổ kính (Antique Parchment).
 *
 * - Địa hình & đường phố: Vẽ bản đồ đường sá thực tế, phân lô phố phường, sông hồ ngọc bích.
 * - Các Địa Điểm (POI): Nổi 3D bồng bềnh dạng Trụ Huy Hiệu PokéStop với bóng đổ và thẻ cự ly.
 * - Vật phẩm rơi (World Drops): Viên ngọc nổi 3D lơ lửng trên ngã đường với icon to rõ.
 * - Nhân vật: Tạo hình Dũng Sĩ Hoàng Cổ chi tiết, oai vệ và thanh thoát.
 */

import { hashSeed } from '../../../packages/game-core/src/rng.ts';
import {
  distanceMeters,
  metersToLatDegrees,
  metersToLonDegrees,
} from '../../../packages/game-core/src/world.ts';
import {
  HANOI_BEAST_TERRITORIES,
  getCampTier,
  getCropDef,
  campDefensePower,
  TerrainType,
  EntityWeightCategory,
  FootprintManager,
  createDynamicBeastPack,
} from '../../../packages/game-core/src/index.ts';
import type {
  LatLon,
  MapFeature,
  PlacedTrap,
  CampState,
  FarmPlot,
  BiomeId,
  DynamicBeastPack,
  BeastSpecies,
} from '../../../packages/game-core/src/index.ts';
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
  /** Cân nặng người chơi (kg) để tính toán độ lún đất và vết chân */
  playerWeightKg?: number;
  phase: Phase;
  weather: WeatherToday;
  /** Giới tính của nhân vật để vẽ đúng trang phục hoàng cổ. */
  gender?: 'male' | 'female';
  /** Bán kính hiển thị theo mét — mép ngắn của canvas phủ khoảng chừng này. */
  spanMeters?: number;
  /** Người chơi có toạ độ thật hay đang dùng vị trí mặc định. */
  hasFix: boolean;
  homeCellCenter?: LatLon | null;
  /** Dữ liệu Doanh Trại của người chơi */
  camp?: CampState | null;
  /** Sức mạnh phòng thủ của doanh trại */
  campDefense?: number;
  /** POI đang chạm được (trong bán kính tương tác). */
  activePoiId?: string | null;
  /** Các vật phẩm đang rơi trên mặt đất quanh người chơi để nhặt trực tiếp. */
  drops?: WorldDrop[];
  /** Danh sách các bẫy thú đang đặt trên thế giới. */
  traps?: PlacedTrap[];
  /** Danh sách các bầy dã thú động đang di chuyển/truy đuổi trên thế giới */
  dynamicBeasts?: Map<string, DynamicBeastPack>;
  /** Linh thú tiền sử đang đồng hành chạy theo người chơi. */
  activePetId?: string | null;
  /** Cấp độ Thể Lực của nhân vật (1..10) để hiển thị hào quang và hiệu ứng sức mạnh. */
  strengthLevel?: number;
  /** Vận tốc di chuyển hiện tại (km/h) để kích hoạt chế độ viễn chinh / Linh Điểu */
  speedKmh?: number;
  /** Có đang thực sự bước chân di chuyển không (từ Joystick hoặc WASD) */
  isMoving?: boolean;
  /** Hướng di chuyển (radians hoặc độ) */
  moveHeading?: number;
  /** Có đang cầm Đuốc Lửa trên tay trong đêm không */
  hasTorch?: boolean;
  /** Đang ở chế độ Phi Nước Đại (Sprint) - giữ cần gạt > 1 giây */
  isSprinting?: boolean;
  /** Góc ngắm bắn / tấn công (radians) */
  aimHeading?: number | null;
  /** Đang giữ rê nút ngắm bắn / thi triển kỹ năng */
  isAiming?: boolean;
  /** Loại vũ khí đang ngắm */
  aimWeaponType?: 'bow' | 'spear' | 'axe' | 'stone' | 'fist';
  /** Tên kỹ năng đang ngắm */
  aimSkillName?: string;
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

/** Bảng màu bản đồ phong cách Đế Chế (Age of Empires I - Lush Green Grasslands & Ancient World) */
const PALETTE = {
  day: {
    parchment: '#487625', // Thảm cỏ xanh mướt trù phú đặc trưng của Đế Chế (AOE Grass)
    parchmentTexture: '#3c641d', // Mảng cỏ đốm xanh sẫm tự nhiên
    blockFill: '#416c21', // Khối đất cỏ phân lô
    blockStroke: '#2d4d16',
    roadMain: '#967342', // Đường đất nện Đế Chế màu nâu vàng đất
    roadMainCasing: '#4a3316', // Viền rãnh đất nâu sẫm
    roadSec: '#876435', // Lối mòn đất
    roadSecCasing: '#3f280e',
    roadTrail: '#78562c',
    roadTrailCasing: '#36210a',
    parkFill: '#23521b', // Rừng rậm nguyên sinh xanh thẫm
    parkStroke: '#14360e',
    parkInner: '#1b4515',
    waterFill: '#1a5678', // Mặt nước sông hồ xanh biếc AOE
    waterStroke: '#0e3850',
    waterShimmer: 'rgba(186, 230, 253, 0.65)',
    sandShore: '#c49e62', // Bờ cát vàng viền mép nước
    textInk: '#ffffff', // Chữ trắng nổi bật trên nền cỏ xanh
    textGold: '#fde047', // Chữ vàng kim
    textSec: '#fef08a',
    gridLine: 'rgba(255, 255, 255, 0.08)',
    sealRed: '#dc2626', // Dấu triện son đỏ
  },
  evening: {
    parchment: '#36541b', // Cỏ hoàng hôn màu lục sẫm
    parchmentTexture: '#284013',
    blockFill: '#2e4716',
    blockStroke: '#1d2e0d',
    roadMain: '#78562c',
    roadMainCasing: '#3b260f',
    roadSec: '#684822',
    roadSecCasing: '#2f1c08',
    roadTrail: '#5a3c19',
    roadTrailCasing: '#251405',
    parkFill: '#1b3d15',
    parkStroke: '#0e260b',
    parkInner: '#14300f',
    waterFill: '#14405a',
    waterStroke: '#092538',
    waterShimmer: 'rgba(253, 224, 71, 0.45)',
    sandShore: '#a88147',
    textInk: '#fef3c7',
    textGold: '#fde047',
    textSec: '#fcd34d',
    gridLine: 'rgba(251, 191, 36, 0.10)',
    sealRed: '#dc2626',
  },
  night: {
    parchment: '#14291c', // Cỏ đêm xanh đen huyền bí
    parchmentTexture: '#0d1e14',
    blockFill: '#163020',
    blockStroke: '#0a170f',
    roadMain: '#44543b',
    roadMainCasing: '#222e1b',
    roadSec: '#36452e',
    roadSecCasing: '#1a2414',
    roadTrail: '#2a3823',
    roadTrailCasing: '#131d0e',
    parkFill: '#0d2617',
    parkStroke: '#06170d',
    parkInner: '#0a1e12',
    waterFill: '#0e3347',
    waterStroke: '#071f2d',
    waterShimmer: 'rgba(125, 211, 252, 0.55)',
    sandShore: '#61523b',
    textInk: '#f8fafc',
    textGold: '#7dd3fc',
    textSec: '#cbd5e1',
    gridLine: 'rgba(125, 211, 252, 0.12)',
    sealRed: '#f43f5e',
  },
} as const;

/** Hệ thống Sông lớn thực tế tự nhiên tại Hà Nội & lân cận */
const NATURAL_RIVERS: { name: string; widthMeters: number; points: LatLon[] }[] = [
  {
    name: 'Sông Hồng',
    widthMeters: 160,
    points: [
      { lat: 21.22, lon: 105.48 },
      { lat: 21.18, lon: 105.56 },
      { lat: 21.14, lon: 105.65 },
      { lat: 21.1, lon: 105.76 },
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
    name: 'Sông Đáy',
    widthMeters: 75,
    points: [
      { lat: 21.12, lon: 105.68 },
      { lat: 21.05, lon: 105.69 },
      { lat: 20.98, lon: 105.68 },
      { lat: 20.91, lon: 105.7 },
      { lat: 20.78, lon: 105.76 },
      { lat: 20.65, lon: 105.81 },
    ],
  },
];

import osmRoadsRaw from '../../../packages/game-core/data/osm-roads-hanoi.json' with { type: 'json' };

interface OsmRoad {
  id: number;
  name: string;
  type: string;
  widthMeters: number;
  points: [number, number][];
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/** 7,913 tuyến đường thực tế từ OpenStreetMap đã được tiền xử lý và lập chỉ mục không gian */
const OSM_ROADS: OsmRoad[] = (osmRoadsRaw as any[]).map((r) => {
  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;
  for (const [lat, lon] of r.points) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    widthMeters: r.widthMeters,
    points: r.points,
    minLat,
    maxLat,
    minLon,
    maxLon,
  };
});

export interface ViewportState {
  isPannedOrZoomed: boolean;
  zoomFactor: number;
  spanMeters: number;
}

export class MapView {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private tick = 0;

  private zoomFactor = 1.0;
  private panX = 0;
  private panY = 0;
  private isDragging = false;
  private activePointers = new Map<number, { x: number; y: number }>();
  private pinchStartDist = 0;
  private pinchStartZoom = 1.0;
  private lastPointer: { x: number; y: number } | null = null;
  private pointerDownPos: { x: number; y: number } | null = null;
  private pointerDownTime = 0;
  private lastInput: RenderInput | null = null;
  private lastProject: ((at: LatLon) => [number, number]) | null = null;
  private lastUnproject: ((cx: number, cy: number) => LatLon) | null = null;

  onViewportChange?: (state: ViewportState) => void;
  onPanChange?: (isPanned: boolean) => void;
  onDropClick?: (drop: WorldDrop) => void;
  onTrapClick?: (trap: PlacedTrap) => void;
  onFeatureClick?: (feature: MapFeature) => void;
  onMapClick?: (latLon: LatLon) => void;
  onCampClick?: () => void;
  onFarmPlotClick?: (plotIndex: number, plot: FarmPlot) => void;
  onStationClick?: (stationId: string) => void;

  // HỆ THỐNG QUẢN LÝ MẶT ĐẤT & DẤU CHÂN TIỀN SỬ
  readonly footprintManager = new FootprintManager(300, 500);
  private lastPlayerPos: LatLon | null = null;
  private lastPlayerHeadingRad = 0;
  private playerStealthState = { isStealthed: false, opacity: 1.0 };
  private walkPhase = 0;
  private lastFootPlant = 0;
  private playerFacingAngle = 0;
  private stepDustParticles: Array<{ x: number; y: number; vx: number; vy: number; r: number; alpha: number }> = [];
  private sprintWindParticles: Array<{ x: number; y: number; vx: number; vy: number; r: number; alpha: number }> = [];

  private renderedFarmPlots: Array<{ plotIndex: number; plot: FarmPlot; x: number; y: number; radius: number }> = [];
  private renderedStations: Array<{ stationId: string; x: number; y: number; radius: number }> = [];
  private renderedCampBounds: { x: number; y: number; radius: number } | null = null;
  private renderedBeasts: Array<{ beast: DynamicBeastPack; x: number; y: number; radius: number }> = [];

  public onBeastClick?: (beast: DynamicBeastPack, screenX?: number, screenY?: number) => void;
  public nearestAttackingBeast: { nameVi: string; distMeters: number; beast?: DynamicBeastPack } | null = null;
  private hitFlashAlpha = 0;
  private hitDamageNumber: { dmg: number; alpha: number; y: number } | null = null;
  private beastDamageNumbers: Array<{ text: string; x: number; y: number; alpha: number; yOffset: number }> = [];

  // HỆ THỐNG VŨ KHÍ TẦM XA & ĐƯỜNG ĐẠN PARABOL CHÂN THỰC
  private activeProjectiles: Array<{
    id: string;
    type: 'arrow' | 'stone';
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    progress: number;
    speed: number;
    arcHeight: number;
    spinAngle: number;
    damage: number;
    trailPoints: Array<{ x: number; y: number; alpha: number }>;
    onHit?: () => void;
  }> = [];

  private impactSparks: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    alpha: number;
    life: number;
  }> = [];

  private activeMeleeSlashes: Array<{
    x: number;
    y: number;
    angle: number;
    type: 'slash' | 'thrust' | 'whirlwind' | 'kick';
    life: number;
    maxLife: number;
    radius: number;
    color: string;
  }> = [];

  public triggerMeleeAttackVisual(
    x: number,
    y: number,
    angle: number,
    type: 'slash' | 'thrust' | 'whirlwind' | 'kick' = 'slash',
  ): void {
    const isThrust = type === 'thrust';
    const isWhirlwind = type === 'whirlwind';
    this.activeMeleeSlashes.push({
      x,
      y,
      angle,
      type,
      life: 1.0,
      maxLife: 1.0,
      radius: (isWhirlwind ? 48 : isThrust ? 54 : 38) * this.dpr,
      color: isThrust ? '#38bdf8' : isWhirlwind ? '#fbbf24' : '#ef4444',
    });
  }

  public spawnProjectile(
    type: 'arrow' | 'stone',
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    damage: number,
    onHit?: () => void,
  ): void {
    const dist = Math.hypot(targetX - startX, targetY - startY);
    // Tốc độ bay tự nhiên: khoảng 0.32s - 0.55s tới đích
    const flightTimeSec = Math.max(0.28, Math.min(0.55, dist / (550 * this.dpr)));
    const speed = 1.0 / flightTimeSec;
    // Độ võng cung parabol: xa thì võng cao, gần thì võng vừa
    const arcHeight = Math.max(25 * this.dpr, Math.min(90 * this.dpr, dist * 0.22));

    this.activeProjectiles.push({
      id: `proj_${Date.now()}_${Math.random()}`,
      type,
      startX,
      startY,
      targetX,
      targetY,
      progress: 0,
      speed,
      arcHeight,
      spinAngle: Math.random() * Math.PI * 2,
      damage,
      trailPoints: [],
      onHit,
    });
  }

  public spawnImpactSparks(x: number, y: number, isArrow: boolean): void {
    const count = isArrow ? 12 : 8;
    const colors = isArrow
      ? ['#ef4444', '#dc2626', '#fca5a5', '#ffffff', '#f59e0b']
      : ['#94a3b8', '#64748b', '#cbd5e1', '#fef08a', '#f59e0b'];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (1.5 + Math.random() * 3.5) * this.dpr;
      this.impactSparks.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 1.2 * this.dpr,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: (1.5 + Math.random() * 2.5) * this.dpr,
        alpha: 1.0,
        life: 1.0,
      });
    }
  }

  public triggerPlayerHit(dmg: number): void {
    this.hitFlashAlpha = 0.65;
    this.hitDamageNumber = { dmg, alpha: 1.0, y: 0 };
  }

  public triggerBeastHit(text: string, x: number, y: number): void {
    this.beastDamageNumbers.push({ text, x, y, alpha: 1.0, yOffset: 0 });
  }

  private viewportDirty = false;
  private cachedInputFeatures: MapFeature[] | null = null;
  private cachedWaterFeatures: MapFeature[] = [];
  private cachedSolidFeatures: MapFeature[] = [];

  // MẪU TEXTURE THẾ HỆ MỚI CHUẨN ĐẾ CHẾ AOE 1 (LUSH PROCEDURAL RETRO PIXEL PATTERNS)
  private patternGrassDay: CanvasPattern | null = null;
  private patternGrassNight: CanvasPattern | null = null;
  private patternDirt: CanvasPattern | null = null;
  private patternSteppe: CanvasPattern | null = null;
  private patternForestFloor: CanvasPattern | null = null;

  private ensureAoePatterns(): void {
    if (this.patternGrassDay && this.patternDirt && this.patternSteppe) return;
    if (typeof document === 'undefined') return;

    // 1. MẪU CỎ AOE 1 BAN NGÀY (AoE 1 Lush Meadow with 2.5D Micro-Grass Tufts - 128x128px)
    const size = 128;
    const cGrass = document.createElement('canvas');
    cGrass.width = size;
    cGrass.height = size;
    const ctxG = cGrass.getContext('2d');
    if (ctxG) {
      // 1.1 Màu nền cỏ xanh lục bảo tươi mát đặc trưng Đế Chế
      ctxG.fillStyle = '#448f22';
      ctxG.fillRect(0, 0, size, size);

      // 1.2 Mảng loang sắc thái tự nhiên (Organic Color Patches - vùng cỏ mượt / vùng đón nắng)
      const patchGradients = [
        { x: 32, y: 32, r: 28, c: 'rgba(88, 174, 45, 0.35)' },
        { x: 96, y: 80, r: 36, c: 'rgba(94, 184, 49, 0.30)' },
        { x: 80, y: 24, r: 24, c: 'rgba(54, 118, 25, 0.40)' },
        { x: 24, y: 96, r: 30, c: 'rgba(50, 112, 23, 0.45)' },
      ];
      for (const p of patchGradients) {
        const rad = ctxG.createRadialGradient(p.x, p.y, 4, p.x, p.y, p.r);
        rad.addColorStop(0, p.c);
        rad.addColorStop(1, 'rgba(68, 143, 34, 0)');
        ctxG.fillStyle = rad;
        ctxG.beginPath();
        ctxG.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctxG.fill();
      }

      // 1.3 Hạt mịn bề mặt đất cỏ (Fine Turf Dither)
      const ditherColors = ['#3a7b1d', '#428a21', '#4b9826', '#55a72c', '#60b733'];
      for (let y = 0; y < size; y += 2) {
        for (let x = 0; x < size; x += 2) {
          const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
          const r = n - Math.floor(n);
          if (r > 0.3) {
            ctxG.fillStyle = ditherColors[Math.floor(r * ditherColors.length)];
            ctxG.fillRect(x, y, 1.5, 1.5);
          }
        }
      }

      // 1.4 KHÓM NGỌN CỎ GỢN SÓNG 2.5D (2.5D Isometric Grass Tufts - Có bóng đổ gốc & chóp ngọn đón nắng)
      const tuftCount = 55;
      for (let i = 0; i < tuftCount; i++) {
        const hash = Math.sin(i * 91.17 + 13.5) * 23456.78;
        const rand = hash - Math.floor(hash);

        const gx = Math.floor((i * 29 + 11) % size);
        const gy = Math.floor((i * 47 + 19) % size);

        // A. Bóng tối chân cụm cỏ (Root Shadow)
        ctxG.fillStyle = '#265313';
        ctxG.beginPath();
        ctxG.ellipse(gx, gy, 2.5, 1.2, 0, 0, Math.PI * 2);
        ctxG.fill();

        // B. Các ngọn cỏ vươn lên (Grass Blades fanning upwards)
        const bladeHeight = 3.5 + rand * 3.5; // Cao từ 3.5px đến 7px rõ nét

        // Thân ngọn cỏ chính giữa
        ctxG.strokeStyle = '#5db630';
        ctxG.lineWidth = 1.2;
        ctxG.beginPath();
        ctxG.moveTo(gx, gy);
        ctxG.lineTo(gx - 0.5, gy - bladeHeight);
        ctxG.stroke();

        // Ngọn cỏ nghiêng trái
        ctxG.strokeStyle = '#4ea227';
        ctxG.lineWidth = 1.0;
        ctxG.beginPath();
        ctxG.moveTo(gx - 1, gy);
        ctxG.lineTo(gx - 2.2, gy - bladeHeight * 0.82);
        ctxG.stroke();

        // Ngọn cỏ nghiêng phải
        ctxG.strokeStyle = '#55aa2a';
        ctxG.lineWidth = 1.0;
        ctxG.beginPath();
        ctxG.moveTo(gx + 1, gy);
        ctxG.lineTo(gx + 2.0, gy - bladeHeight * 0.78);
        ctxG.stroke();

        // C. Chóp ngọn cỏ đón ánh sáng mặt trời vàng óng (Sunlit Grass Tips Highlight)
        ctxG.fillStyle = '#8ce845';
        ctxG.fillRect(gx - 1, Math.round(gy - bladeHeight), 1.2, 1.2);
        ctxG.fillStyle = '#77d438';
        ctxG.fillRect(gx - 2.5, Math.round(gy - bladeHeight * 0.82), 1, 1);
        ctxG.fillRect(gx + 1.8, Math.round(gy - bladeHeight * 0.78), 1, 1);

        // Điểm xuyết hoa dại nhỏ xíu / mầm cỏ non (15% tỷ lệ)
        if (rand > 0.82) {
          ctxG.fillStyle = '#fef08a';
          ctxG.fillRect(gx + 0.5, gy - bladeHeight - 1, 1.5, 1.5);
        }
      }

      this.patternGrassDay = this.ctx.createPattern(cGrass, 'repeat');
    }

    // 2. MẪU CỎ AOE 1 BAN ĐÊM (AoE 1 Night Meadow with Moonlit Tufts - 128x128px)
    const cGrassN = document.createElement('canvas');
    cGrassN.width = size;
    cGrassN.height = size;
    const ctxGN = cGrassN.getContext('2d');
    if (ctxGN) {
      ctxGN.fillStyle = '#112217';
      ctxGN.fillRect(0, 0, size, size);

      // Sắc thái đêm
      const shadesGN = ['#0c1a11', '#0f2015', '#112217', '#15291c', '#1b3424'];
      for (let y = 0; y < size; y += 2) {
        for (let x = 0; x < size; x += 2) {
          const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
          const r = n - Math.floor(n);
          if (r > 0.3) {
            ctxGN.fillStyle = shadesGN[Math.floor(r * shadesGN.length)];
            ctxGN.fillRect(x, y, 1.5, 1.5);
          }
        }
      }

      // Khóm ngọn cỏ đêm ánh trăng
      for (let i = 0; i < 45; i++) {
        const gx = Math.floor((i * 29 + 11) % size);
        const gy = Math.floor((i * 47 + 19) % size);

        ctxGN.fillStyle = '#09130d';
        ctxGN.beginPath();
        ctxGN.ellipse(gx, gy, 2.5, 1.2, 0, 0, Math.PI * 2);
        ctxGN.fill();

        ctxGN.strokeStyle = '#1e3d29';
        ctxGN.lineWidth = 1.0;
        ctxGN.beginPath();
        ctxGN.moveTo(gx, gy);
        ctxGN.lineTo(gx - 0.5, gy - 4.5);
        ctxGN.stroke();

        ctxGN.fillStyle = '#346545';
        ctxGN.fillRect(gx - 1, gy - 5, 1.2, 1.2);
      }

      this.patternGrassNight = this.ctx.createPattern(cGrassN, 'repeat');
    }

    // 3. MẪU ĐẤT NÂU ĐẤT AOE 1 (Warm Earth Clay Soil)
    const cDirt = document.createElement('canvas');
    cDirt.width = size;
    cDirt.height = size;
    const ctxD = cDirt.getContext('2d');
    if (ctxD) {
      ctxD.fillStyle = '#7a5a36';
      ctxD.fillRect(0, 0, size, size);
      const shadesD = ['#644626', '#6f4e2c', '#7c5835', '#88623c', '#946c43'];
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const n = Math.sin(x * 34.567 + y * 91.234) * 23456.789;
          const r = n - Math.floor(n);
          if (r > 0.28) {
            ctxD.fillStyle = shadesD[Math.floor(r * shadesD.length)];
            ctxD.fillRect(x, y, 1, 1);
          }
        }
      }
      this.patternDirt = this.ctx.createPattern(cDirt, 'repeat');
    }

    // 4. MẪU THẢO NGUYÊN CỎ VÀNG ÚA AOE 1
    const cSteppe = document.createElement('canvas');
    cSteppe.width = size;
    cSteppe.height = size;
    const ctxS = cSteppe.getContext('2d');
    if (ctxS) {
      ctxS.fillStyle = '#65742a';
      ctxS.fillRect(0, 0, size, size);
      for (let i = 0; i < 300; i++) {
        const sx = (i * 41) % size;
        const sy = (i * 67) % size;
        ctxS.strokeStyle = '#8b9e3e';
        ctxS.lineWidth = 1.0;
        ctxS.beginPath();
        ctxS.moveTo(sx, sy);
        ctxS.lineTo(sx + 2, sy - 4);
        ctxS.stroke();
      }
      this.patternSteppe = this.ctx.createPattern(cSteppe, 'repeat');
    }

    // 5. MẪU NỀN RỪNG MÙN ĐEN AOE 1
    const cForest = document.createElement('canvas');
    cForest.width = size;
    cForest.height = size;
    const ctxF = cForest.getContext('2d');
    if (ctxF) {
      ctxF.fillStyle = '#283e16';
      ctxF.fillRect(0, 0, size, size);
      for (let i = 0; i < 60; i++) {
        const lx = (i * 29) % size;
        const ly = (i * 43) % size;
        ctxF.fillStyle = '#543b23';
        ctxF.fillRect(lx, ly, 2, 1);
      }
      this.patternForestFloor = this.ctx.createPattern(cForest, 'repeat');
    }
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Trình duyệt không hỗ trợ canvas 2D.');
    this.ctx = ctx;

    canvas.addEventListener('pointerdown', (e) => {
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture?.(e.pointerId);

      if (this.activePointers.size === 1) {
        this.isDragging = true;
        this.lastPointer = { x: e.clientX, y: e.clientY };
        this.pointerDownPos = { x: e.clientX, y: e.clientY };
        this.pointerDownTime = performance.now();
      } else if (this.activePointers.size === 2) {
        const [p1, p2] = Array.from(this.activePointers.values());
        this.pinchStartDist = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
        this.pinchStartZoom = this.zoomFactor;
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this.activePointers.has(e.pointerId)) return;
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.activePointers.size >= 2) {
        const [p1, p2] = Array.from(this.activePointers.values());
        const currentDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const ratio = currentDist / (this.pinchStartDist || 1);
        this.setZoom(this.pinchStartZoom * ratio);
      } else if (this.activePointers.size === 1 && this.isDragging && this.lastPointer) {
        const dx = e.clientX - this.lastPointer.x;
        const dy = e.clientY - this.lastPointer.y;
        this.lastPointer = { x: e.clientX, y: e.clientY };

        this.panX += dx * this.dpr;
        this.panY += dy * this.dpr;
        this.viewportDirty = true;
      }
    });

    const endDrag = (e: PointerEvent) => {
      const wasTracking = this.activePointers.has(e.pointerId);
      this.activePointers.delete(e.pointerId);

      if (this.activePointers.size === 1) {
        const [p] = Array.from(this.activePointers.values());
        this.lastPointer = { x: p.x, y: p.y };
      } else if (this.activePointers.size === 0 && wasTracking) {
        this.isDragging = false;

        const duration = performance.now() - this.pointerDownTime;
        const dist = this.pointerDownPos
          ? Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y)
          : 999;

        if (dist < 28 && duration < 500 && this.lastProject) {
          const rect = canvas.getBoundingClientRect();
          const scaleX = rect.width > 0 ? canvas.width / rect.width : this.dpr;
          const scaleY = rect.height > 0 ? canvas.height / rect.height : this.dpr;
          const clickX = (e.clientX - rect.left) * scaleX;
          const clickY = (e.clientY - rect.top) * scaleY;

          // 0a. Click vào Luống Cây Trồng trên Bản Đồ (Thu hoạch hoặc mở nông trại)
          if (this.renderedFarmPlots.length > 0) {
            for (const fp of this.renderedFarmPlots) {
              const d = Math.hypot(clickX - fp.x, clickY - fp.y);
              if (d < fp.radius) {
                this.onFarmPlotClick?.(fp.plotIndex, fp.plot);
                this.lastPointer = null;
                this.pointerDownPos = null;
                return;
              }
            }
          }

          // 0b. Click vào Trạm Chế Tạo (Lò rèn, Lửa trại, Lò nung...)
          if (this.renderedStations.length > 0) {
            for (const st of this.renderedStations) {
              const d = Math.hypot(clickX - st.x, clickY - st.y);
              if (d < st.radius) {
                this.onStationClick?.(st.stationId);
                this.lastPointer = null;
                this.pointerDownPos = null;
                return;
              }
            }
          }

          // 0c. Click vào Căn Cứ Phòng Thủ / Đại Bản Doanh
          if (this.renderedCampBounds) {
            const d = Math.hypot(clickX - this.renderedCampBounds.x, clickY - this.renderedCampBounds.y);
            if (d < this.renderedCampBounds.radius) {
              this.onCampClick?.();
              this.lastPointer = null;
              this.pointerDownPos = null;
              return;
            }
          }

          // 0d. Click vào Bầy Dã Thú để Tấn Công / Săn Bắt
          if (this.renderedBeasts.length > 0) {
            for (const b of this.renderedBeasts) {
              const d = Math.hypot(clickX - b.x, clickY - b.y);
              if (d < b.radius) {
                this.onBeastClick?.(b.beast, b.x, b.y);
                this.lastPointer = null;
                this.pointerDownPos = null;
                return;
              }
            }
          }

          // 1. Click vào bẫy thú
          if (this.lastInput?.traps) {
            let nearestTrap: PlacedTrap | null = null;
            let minTrapDist = 48 * this.dpr;

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

          // 2. Click vào món đồ rơi (World Drop)
          if (this.lastInput?.drops) {
            let nearestDrop: WorldDrop | null = null;
            let minDropDist = 48 * this.dpr;

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
              this.lastPointer = null;
              this.pointerDownPos = null;
              return;
            }
          }

          // 3. Click vào địa điểm POI
          if (this.lastInput?.features) {
            let nearestFeature: MapFeature | null = null;
            let minFeatureDist = 56 * this.dpr;

            for (const feat of this.lastInput.features) {
              const [fx, fy] = this.lastProject({ lat: feat.lat, lon: feat.lon });
              const d = Math.hypot(clickX - fx, clickY - fy);
              if (d < minFeatureDist) {
                minFeatureDist = d;
                nearestFeature = feat;
              }
            }

            if (nearestFeature) {
              this.onFeatureClick?.(nearestFeature);
              this.lastPointer = null;
              this.pointerDownPos = null;
              return;
            }
          }

          // 4. Click tự do vào toạ độ trên mặt đất (Dùng cho chọn vị trí Căn Cứ / Di Dời Trại)
          if (this.lastUnproject) {
            const picked = this.lastUnproject(clickX, clickY);
            this.onMapClick?.(picked);
          }
        }

        this.lastPointer = null;
        this.pointerDownPos = null;
      }
    };

    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 0.85;
        this.setZoom(this.zoomFactor * factor);
      },
      { passive: false },
    );

    this.resize();
  }

  setZoom(factor: number): void {
    const clamped = Math.max(0.4, Math.min(2.5, factor));
    if (Math.abs(clamped - this.zoomFactor) > 0.01) {
      this.zoomFactor = clamped;
      this.viewportDirty = true;
      this.notifyViewportChange();
    }
  }

  zoomIn(): void {
    this.setZoom(this.zoomFactor * 1.25);
  }

  zoomOut(): void {
    this.setZoom(this.zoomFactor * 0.8);
  }

  resetPan(): void {
    this.panX = 0;
    this.panY = 0;
    this.zoomFactor = 1.0;
    this.viewportDirty = true;
    this.notifyViewportChange();
  }

  recenterAndResetZoom(): void {
    this.resetPan();
  }

  isPanned(): boolean {
    return Math.abs(this.panX) > 5 || Math.abs(this.panY) > 5 || Math.abs(this.zoomFactor - 1.0) > 0.05;
  }

  private notifyViewportChange(): void {
    const baseSpan = this.lastInput?.spanMeters ?? 75;
    const currentSpan = baseSpan / this.zoomFactor;
    this.onViewportChange?.({
      isPannedOrZoomed: this.isPanned(),
      zoomFactor: this.zoomFactor,
      spanMeters: currentSpan,
    });
    this.onPanChange?.(this.isPanned());
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(globalThis.devicePixelRatio || 2, 3.0);
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
  }

  render(input: RenderInput): void {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w < 2 || h < 2) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (this.viewportDirty) {
      this.viewportDirty = false;
      this.notifyViewportChange();
    }

    this.tick++;
    this.lastInput = input;

    // Góc nghiêng nhẹ 2.5D tạo chiều sâu bản đồ đô thị
    const TILT_Y = 0.72;
    const baseSpan = input.spanMeters ?? 75;
    const spanMeters = baseSpan / this.zoomFactor;
    const pxPerMeter = Math.min(w, h) / spanMeters;
    const palette = PALETTE[input.phase];

    const project = (at: LatLon): [number, number] => {
      const dx = (at.lon - input.center.lon) / metersToLonDegrees(1, input.center.lat);
      const dy = (at.lat - input.center.lat) / metersToLatDegrees(1);
      return [w / 2 + dx * pxPerMeter + this.panX, h / 2 - dy * pxPerMeter * TILT_Y + this.panY];
    };
    this.lastProject = project;
    this.nearestAttackingBeast = null;

    const unproject = (cx: number, cy: number): LatLon => {
      const dx = (cx - w / 2 - this.panX) / (pxPerMeter || 1);
      const dy = -(cy - h / 2 - this.panY) / ((pxPerMeter * TILT_Y) || 1);
      return {
        lat: input.center.lat + dy * metersToLatDegrees(1),
        lon: input.center.lon + dx * metersToLonDegrees(1, input.center.lat),
      };
    };
    ctx.save();

    // 1. Tầng nền địa hình thảm cỏ xanh mướt đồng nhất chuẩn Đế Chế (AoE 1 Seamless Grassland Surface)
    this.drawTerrainGroundBase(w, h, palette, input, project, pxPerMeter, TILT_Y);

    // 2. Tầng sông lớn & mặt nước tự nhiên trong xanh (Hồng Hà, Tô Lịch...)
    this.drawNaturalRivers(project, pxPerMeter, palette);

    // 3. Tầng đường phố đại lộ & mạng lưới giao thông thực tế (Hoàn Kiếm, Ba Đình, Đống Đa, Hai Bà Trưng...)
    this.drawStreetNetwork(project, pxPerMeter, palette, input);

    // 4. Lớp mặt nước POI (Hồ Gươm, Hồ Tây, hồ Bảy Mẫu, hồ Trúc Bạch...)
    if (this.cachedInputFeatures !== input.features) {
      this.cachedInputFeatures = input.features;
      this.cachedWaterFeatures = input.features.filter((f) => f.zone === 'water');
      this.cachedSolidFeatures = input.features.filter((f) => f.zone !== 'water');
    }
    for (const feature of this.cachedWaterFeatures) {
      this.drawWaterFeature(feature, project, pxPerMeter, palette);
    }

    // 4b. Tầng Cảnh Quan Kỷ Khủng Long Điểm Xuyết (Hóa thạch xương khủng long & Bụi dương xỉ ẩn nấp 3m)
    this.drawPrehistoricAccents(w, h, input, project, pxPerMeter, TILT_Y);

    // 4c. Hệ Thống Dấu Chân & Hiệu Ứng Hạt Bùn/Cát (Footprint System & Particle Splash)
    this.drawDinoFootprintsAndParticles(w, h, input, project, pxPerMeter, TILT_Y);

    // Reset danh sách hitboxes tương tác cho frame hiện tại
    this.renderedFarmPlots = [];
    this.renderedStations = [];
    this.renderedCampBounds = null;

    // 4d. Lãnh địa dã thú sương đỏ (Red Mist Beast Territories)
    this.drawBeastTerritories(project, pxPerMeter, palette);

    // 4e. TẦNG QUẦN XÃ DÃ THÚ & SINH CẢNH THIÊN NHIÊN (VẼ TRÊN ĐƯỜNG VÀ MẶT ĐẤT — TUYỆT ĐỐI KHÔNG BỊ CHUI DƯỚI ĐƯỜNG)
    this.drawWildlifeAndEnvironment(w, h, palette, input, project, pxPerMeter, TILT_Y);

    // 5. Căn Cứ / Doanh Trại Người Chơi (2.5D Isometric Stronghold)
    if (input.camp && input.homeCellCenter) {
      this.drawPlayerStronghold(project(input.homeCellCenter), pxPerMeter, input, palette);
    }

    // 6. Các địa danh, di tích, mỏ tài nguyên (Solid Features)
    for (const feature of this.cachedSolidFeatures) {
      this.drawFloatingFeatureBadge(feature, project, pxPerMeter, input, palette);
    }

    // 7. Bẫy thú nổi 3D
    if (input.traps && input.traps.length > 0) {
      this.drawTraps(project, input.traps, pxPerMeter, input, palette);
    }

    // 8. Vật phẩm rơi (World Drops) nổi 3D bồng bềnh
    if (input.drops && input.drops.length > 0) {
      this.drawFloatingDrops(project, input.drops, pxPerMeter, input, palette);
    }

    // 9. Nhân vật Dũng Sĩ Hoàng Cổ đứng giữa cung đường (Hỗ trợ độ mờ Stealth 0.55 khi ẩn nấp)
    const playerScreenX = w / 2 + this.panX;
    const playerScreenY = h / 2 + this.panY;
    if (this.playerStealthState.isStealthed) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      this.drawPlayer(playerScreenX, playerScreenY, pxPerMeter, input, palette);
      ctx.restore();
      this.drawDinoStealthHud(w, h, playerScreenX, playerScreenY);
    } else {
      this.drawPlayer(playerScreenX, playerScreenY, pxPerMeter, input, palette);
    }

    // 9a. CHỈ HIỂN THỊ VẠCH NGẮM KHI NGƯỜI CHƠI ĐANG GIỮ VÀ KÉO NÚT TẤN CÔNG (HOLD & DRAG TO AIM)
    if (input.isAiming) {
      this.drawAimingIndicator(ctx, playerScreenX, playerScreenY, input, pxPerMeter);
    }

    // 9b. Linh Điểu Tiền Sử bay lượn & Vệt Gió Thần Tốc khi di chuyển nhanh (Xe buýt / Xe máy)
    if (input.speedKmh && input.speedKmh >= 12) {
      this.drawSpiritBirdAndWindTrails(w, h, playerScreenX, playerScreenY, input.speedKmh, palette);
    }

    // 9c. Hiệu ứng Số Máu Bị Trừ & Viền Máu Đỏ Màn Hình khi bị thú dữ tấn công
    if (this.hitDamageNumber) {
      this.hitDamageNumber.y += 0.8 * this.dpr;
      this.hitDamageNumber.alpha -= 0.022;
      if (this.hitDamageNumber.alpha <= 0) {
        this.hitDamageNumber = null;
      } else {
        ctx.save();
        ctx.fillStyle = `rgba(239, 68, 68, ${this.hitDamageNumber.alpha})`;
        ctx.strokeStyle = `rgba(0, 0, 0, ${this.hitDamageNumber.alpha * 0.85})`;
        ctx.lineWidth = 2.5 * this.dpr;
        ctx.font = `bold ${14 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const txt = `-${this.hitDamageNumber.dmg} HP 🩸`;
        const ty = playerScreenY - 36 * this.dpr - this.hitDamageNumber.y;
        ctx.strokeText(txt, playerScreenX, ty);
        ctx.fillText(txt, playerScreenX, ty);
        ctx.restore();
      }
    }

    if (this.hitFlashAlpha > 0) {
      ctx.save();
      const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
      vig.addColorStop(0, 'rgba(239, 68, 68, 0)');
      vig.addColorStop(0.7, `rgba(220, 38, 38, ${this.hitFlashAlpha * 0.4})`);
      vig.addColorStop(1, `rgba(185, 28, 28, ${this.hitFlashAlpha})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
      this.hitFlashAlpha = Math.max(0, this.hitFlashAlpha - 0.035);
      ctx.restore();
    }

    // 9d. VẼ ĐƯỜNG ĐẠN TẦM XA (MŨI TÊN BAY 3D, VIÊN ĐÁ NÉM BAY PARABOL), VỆT CHÉM CẬN CHIẾN & TIA LỬA
    this.drawActiveProjectiles(ctx, w, h);
    this.drawMeleeSlashes(ctx);
    this.drawImpactSparks(ctx);

    // 9e. Hiệu ứng Số Sát Thương Gây Ra Cho Dã Thú (Beast Combat Floating Numbers)
    if (this.beastDamageNumbers.length > 0) {
      ctx.save();
      ctx.font = `bold ${14 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      for (let i = this.beastDamageNumbers.length - 1; i >= 0; i--) {
        const b = this.beastDamageNumbers[i];
        b.yOffset += 1.0 * this.dpr;
        b.alpha -= 0.025;
        if (b.alpha <= 0) {
          this.beastDamageNumbers.splice(i, 1);
          continue;
        }
        ctx.fillStyle = `rgba(254, 240, 138, ${b.alpha})`;
        ctx.strokeStyle = `rgba(0, 0, 0, ${b.alpha * 0.9})`;
        ctx.lineWidth = 2.8 * this.dpr;
        ctx.strokeText(b.text, b.x, b.y - b.yOffset);
        ctx.fillText(b.text, b.x, b.y - b.yOffset);
      }
      ctx.restore();
    }

    // 10. Hiệu ứng thời tiết mưa & không khí cổ kính
    if (input.weather.raining) {
      this.drawRain(w, h, input.weather.rainIntensity);
    }
    this.drawCompassRose(w, h, palette);

    ctx.restore();
  }

  // ================================================================
  // VẼ VŨ KHÍ TẦM XA & ĐƯỜNG ĐẠN BAY 2.5D CHÂN THỰC
  // ================================================================

  private drawActiveProjectiles(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.activeProjectiles.length === 0) return;
    const dt = 0.016;

    for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
      const p = this.activeProjectiles[i];
      p.progress += p.speed * dt;
      p.spinAngle += 0.28;

      const curX = p.startX + (p.targetX - p.startX) * p.progress;
      const curY = p.startY + (p.targetY - p.startY) * p.progress;
      const arcZ = Math.sin(p.progress * Math.PI) * p.arcHeight;
      const drawX = curX;
      const drawY = curY - arcZ;

      // Lưu lại vết gió mờ xé không khí
      p.trailPoints.push({ x: drawX, y: drawY, alpha: 0.75 });
      if (p.trailPoints.length > 8) p.trailPoints.shift();

      // Vẽ vệt gió khói mờ
      if (p.trailPoints.length > 1) {
        ctx.save();
        for (let j = 0; j < p.trailPoints.length - 1; j++) {
          const pt1 = p.trailPoints[j];
          const pt2 = p.trailPoints[j + 1];
          const segAlpha = (j / p.trailPoints.length) * 0.55;
          ctx.strokeStyle = p.type === 'arrow' ? `rgba(254, 240, 138, ${segAlpha})` : `rgba(203, 213, 225, ${segAlpha})`;
          ctx.lineWidth = (p.type === 'arrow' ? 2.2 : 3.2) * this.dpr * (j / p.trailPoints.length);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Vẽ bóng đổ dưới đất
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.ellipse(curX, curY, (p.type === 'arrow' ? 8.5 : 6) * this.dpr, 2.5 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Kiểm tra chạm đích
      if (p.progress >= 1.0) {
        this.spawnImpactSparks(p.targetX, p.targetY, p.type === 'arrow');
        p.onHit?.();
        this.activeProjectiles.splice(i, 1);
        continue;
      }

      // Tính góc tiếp tuyến của quỹ đạo bay
      const pNext = Math.min(1.0, p.progress + 0.025);
      const nX = p.startX + (p.targetX - p.startX) * pNext;
      const nY = p.targetY + (p.targetY - p.startY) * pNext - Math.sin(pNext * Math.PI) * p.arcHeight;
      const angle = Math.atan2(nY - drawY, nX - drawX);

      if (p.type === 'arrow') {
        // Vẽ Mũi Tên Bay 2.5D Chân Thực
        ctx.save();
        ctx.translate(drawX, drawY);
        ctx.rotate(angle);

        // Thân tên bằng gỗ thanh mảnh
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2.4 * this.dpr;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-16 * this.dpr, 0);
        ctx.lineTo(8 * this.dpr, 0);
        ctx.stroke();

        // Ức tên quấn chỉ bảo vệ
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.0 * this.dpr;
        ctx.beginPath();
        ctx.moveTo(-4 * this.dpr, 0);
        ctx.lineTo(2 * this.dpr, 0);
        ctx.stroke();

        // Lông vũ cánh đuôi tên (Fletching đỏ trắng xòe 3 cánh)
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(-16 * this.dpr, 0);
        ctx.lineTo(-24 * this.dpr, -4.5 * this.dpr);
        ctx.lineTo(-20 * this.dpr, 0);
        ctx.lineTo(-24 * this.dpr, 4.5 * this.dpr);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(-14 * this.dpr, 0);
        ctx.lineTo(-21 * this.dpr, -3.2 * this.dpr);
        ctx.lineTo(-17 * this.dpr, 0);
        ctx.lineTo(-21 * this.dpr, 3.2 * this.dpr);
        ctx.closePath();
        ctx.fill();

        // Mũi tên bằng đá mài sắc nhọn
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(15 * this.dpr, 0);
        ctx.lineTo(6 * this.dpr, -4.5 * this.dpr);
        ctx.lineTo(8 * this.dpr, 0);
        ctx.lineTo(6 * this.dpr, 4.5 * this.dpr);
        ctx.closePath();
        ctx.fill();

        // Vát cạnh đá sáng chớp
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.0 * this.dpr;
        ctx.beginPath();
        ctx.moveTo(15 * this.dpr, 0);
        ctx.lineTo(6 * this.dpr, -4.5 * this.dpr);
        ctx.stroke();

        ctx.restore();
      } else {
        // Vẽ Viên Đá Nhọn Ném Xoay Tít
        ctx.save();
        ctx.translate(drawX, drawY);
        ctx.rotate(p.spinAngle);

        ctx.fillStyle = '#475569';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.6 * this.dpr;
        ctx.beginPath();
        ctx.moveTo(-5 * this.dpr, -4 * this.dpr);
        ctx.lineTo(3 * this.dpr, -6 * this.dpr);
        ctx.lineTo(7 * this.dpr, -1 * this.dpr);
        ctx.lineTo(5 * this.dpr, 5 * this.dpr);
        ctx.lineTo(-3 * this.dpr, 6 * this.dpr);
        ctx.lineTo(-7 * this.dpr, 1 * this.dpr);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Gân đá nổi
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.0 * this.dpr;
        ctx.beginPath();
        ctx.moveTo(-5 * this.dpr, -4 * this.dpr);
        ctx.lineTo(1 * this.dpr, 0);
        ctx.lineTo(5 * this.dpr, 5 * this.dpr);
        ctx.stroke();

        ctx.restore();
      }
    }
  }

  private drawImpactSparks(ctx: CanvasRenderingContext2D): void {
    if (this.impactSparks.length === 0) return;

    ctx.save();
    for (let i = this.impactSparks.length - 1; i >= 0; i--) {
      const s = this.impactSparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.14 * this.dpr; // Trọng lực rơi
      s.life -= 0.048;
      s.alpha = Math.max(0, s.life);

      if (s.life <= 0) {
        this.impactSparks.splice(i, 1);
        continue;
      }

      ctx.fillStyle = s.color;
      ctx.globalAlpha = s.alpha;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * (0.35 + s.life * 0.65), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawMeleeSlashes(ctx: CanvasRenderingContext2D): void {
    if (this.activeMeleeSlashes.length === 0) return;

    ctx.save();
    for (let i = this.activeMeleeSlashes.length - 1; i >= 0; i--) {
      const slash = this.activeMeleeSlashes[i];
      slash.life -= 0.085;
      if (slash.life <= 0) {
        this.activeMeleeSlashes.splice(i, 1);
        continue;
      }

      const p = 1.0 - slash.life;
      ctx.save();
      ctx.translate(slash.x, slash.y);

      if (slash.type === 'whirlwind') {
        // Chiêu Xoay Bão Táp 360 độ: Vòng lưỡi dao xoay tròn bừng sáng
        const spinAngle = p * Math.PI * 2.5;
        const curRadius = slash.radius * (0.6 + p * 0.45);
        ctx.strokeStyle = `rgba(251, 191, 36, ${slash.life * 0.85})`;
        ctx.lineWidth = 3.5 * this.dpr;
        ctx.beginPath();
        ctx.arc(0, 0, curRadius, 0, Math.PI * 2);
        ctx.stroke();

        // 3 vệt chém vàng xoay quanh
        for (let b = 0; b < 3; b++) {
          const ba = spinAngle + (b * Math.PI * 2) / 3;
          ctx.strokeStyle = `rgba(254, 240, 138, ${slash.life})`;
          ctx.lineWidth = 2.4 * this.dpr;
          ctx.beginPath();
          ctx.arc(0, 0, curRadius * 0.95, ba, ba + 0.8);
          ctx.stroke();
        }
      } else if (slash.type === 'thrust') {
        // Đâm Giáo Sắt: Tia chớp đâm xuyên thẳng theo hướng góc nhìn
        ctx.rotate(slash.angle);
        const thrustLen = slash.radius * (0.4 + p * 0.7);

        const grad = ctx.createLinearGradient(0, 0, thrustLen, 0);
        grad.addColorStop(0, `rgba(56, 189, 248, 0)`);
        grad.addColorStop(0.5, `rgba(56, 189, 248, ${slash.life * 0.9})`);
        grad.addColorStop(1, `rgba(255, 255, 255, ${slash.life})`);

        ctx.strokeStyle = grad;
        ctx.lineWidth = 3.8 * this.dpr;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(8 * this.dpr, 0);
        ctx.lineTo(thrustLen, 0);
        ctx.stroke();

        // Đầu mũi giáo lóe sáng
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(thrustLen, 0, 3.5 * this.dpr, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Chém Rìu / Tay Không: Vệt chém hình vòng cung 90 độ
        ctx.rotate(slash.angle);
        const arcRadius = slash.radius * (0.7 + p * 0.35);
        const arcStart = -Math.PI / 3 + p * 0.4;
        const arcEnd = Math.PI / 3 + p * 0.4;

        const grad = ctx.createLinearGradient(0, 0, arcRadius, 0);
        grad.addColorStop(0, `rgba(239, 68, 68, 0.1)`);
        grad.addColorStop(0.7, `rgba(239, 68, 68, ${slash.life * 0.75})`);
        grad.addColorStop(1, `rgba(255, 255, 255, ${slash.life})`);

        ctx.strokeStyle = grad;
        ctx.lineWidth = (slash.type === 'kick' ? 4.5 : 3.0) * this.dpr;
        ctx.beginPath();
        ctx.arc(0, 0, arcRadius, arcStart, arcEnd);
        ctx.stroke();
      }

      ctx.restore();
    }
    ctx.restore();
  }

  /** Vẽ Quạt Chỉ Báo Ngắm Hướng Tấn Công & Tia Laser Ngắm Bắn 360 Độ */
  private drawAimingIndicator(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    input: RenderInput,
    pxPerMeter: number,
  ): void {
    const heading = input.aimHeading !== undefined && input.aimHeading !== null ? input.aimHeading : (input.moveHeading ?? 0);
    const isAiming = input.isAiming ?? false;
    const wType = input.aimWeaponType || 'bow';
    const TILT_Y = 0.72;

    // Vector hướng trên màn hình Canvas:
    const screenAngle = Math.atan2(-Math.cos(heading) * TILT_Y, Math.sin(heading));

    ctx.save();
    ctx.translate(px, py);

    // 1. Quạt hình nón chỉ báo hướng mặt (Directional Aim Cone)
    const coneRadius = (isAiming ? 34 : 24) * this.dpr;
    const coneAngle = isAiming ? 0.35 : 0.52;
    const grad = ctx.createRadialGradient(0, 0, 4 * this.dpr, 0, 0, coneRadius);
    grad.addColorStop(0, isAiming ? 'rgba(239, 68, 68, 0.45)' : 'rgba(251, 191, 36, 0.35)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, coneRadius, screenAngle - coneAngle, screenAngle + coneAngle);
    ctx.closePath();
    ctx.fill();

    // 2. Mũi tên chỉ hướng vàng rực (Forward Arrow Pointer)
    const arrowDist = (isAiming ? 30 : 20) * this.dpr;
    const tipX = Math.cos(screenAngle) * arrowDist;
    const tipY = Math.sin(screenAngle) * arrowDist;

    ctx.strokeStyle = isAiming ? '#ef4444' : '#fef08a';
    ctx.lineWidth = (isAiming ? 2.5 : 1.8) * this.dpr;
    ctx.beginPath();
    ctx.moveTo(Math.cos(screenAngle) * 8 * this.dpr, Math.sin(screenAngle) * 8 * this.dpr);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    // Mũi nhọn tam giác
    const headLen = 6 * this.dpr;
    ctx.fillStyle = isAiming ? '#f87171' : '#fde047';
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(
      tipX - headLen * Math.cos(screenAngle - Math.PI / 6),
      tipY - headLen * Math.sin(screenAngle - Math.PI / 6),
    );
    ctx.lineTo(
      tipX - headLen * Math.cos(screenAngle + Math.PI / 6),
      tipY - headLen * Math.sin(screenAngle + Math.PI / 6),
    );
    ctx.closePath();
    ctx.fill();

    // 3. Đường bay ngắm tầm xa (Laser Trajectory / Target Crosshair khi đang ngắm hoặc cầm vũ khí tầm xa)
    if (isAiming || wType === 'bow' || wType === 'stone') {
      const maxMeters = wType === 'bow' ? 22 : 14;
      const targetDistPx = maxMeters * pxPerMeter;
      const endX = Math.cos(screenAngle) * targetDistPx;
      const endY = Math.sin(screenAngle) * targetDistPx;

      // Đường nét đứt phát sáng (Dotted Aim Trajectory)
      ctx.strokeStyle = isAiming ? 'rgba(239, 68, 68, 0.85)' : 'rgba(254, 240, 138, 0.45)';
      ctx.lineWidth = (isAiming ? 2.0 : 1.2) * this.dpr;
      ctx.setLineDash([5 * this.dpr, 5 * this.dpr]);
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Tâm ngắm ở điểm đích (Target Crosshair Ring)
      ctx.strokeStyle = isAiming ? '#ef4444' : '#fef08a';
      ctx.lineWidth = 1.8 * this.dpr;
      ctx.beginPath();
      ctx.arc(endX, endY, (isAiming ? 10 : 7) * this.dpr, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = isAiming ? 'rgba(239, 68, 68, 0.3)' : 'rgba(254, 240, 138, 0.2)';
      ctx.fill();
    }

    ctx.restore();
  }

  // ================================================================
  // 1. TẦNG NỀN ĐA ĐỊA HÌNH THẾ GIỚI (AOE 1 MULTI-BIOME GROUND BASE)
  // ================================================================

  private drawTerrainGroundBase(
    w: number,
    h: number,
    palette: typeof PALETTE.day,
    input: RenderInput,
    project: (at: LatLon) => [number, number],
    pxPerMeter: number,
    TILT_Y: number,
  ): void {
    const { ctx } = this;
    this.ensureAoePatterns();

    const isNight = input.isNight ?? (input.phase === 'night' || input.phase === 'bloodmoon');

    const WORLD_ORIGIN_LAT = 21.0;
    const WORLD_ORIGIN_LON = 105.8;

    const centerWorldX = (input.center.lon - WORLD_ORIGIN_LON) / metersToLonDegrees(1, input.center.lat);
    const centerWorldY = (input.center.lat - WORLD_ORIGIN_LAT) / metersToLatDegrees(1);

    // 1. NỀN CỎ AOE 1 CHI TIẾT TOÀN BỘ BẢN ĐỒ — KHOÁ TOẠ ĐỘ THẾ GIỚI (Cuộn mượt 1:1 theo bước chân)
    const baseGrass = isNight
      ? (this.patternGrassNight || palette.parchment)
      : (this.patternGrassDay || palette.parchment);

    const patternSize = 128;
    const patternShiftX = (w / 2 + this.panX - centerWorldX * pxPerMeter) % patternSize;
    const patternShiftY = (h / 2 + this.panY + centerWorldY * pxPerMeter * TILT_Y) % patternSize;

    if (baseGrass && typeof (baseGrass as any).setTransform === 'function') {
      const mat = new DOMMatrix();
      mat.translateSelf(patternShiftX, patternShiftY);
      (baseGrass as any).setTransform(mat);
    }

    ctx.fillStyle = baseGrass;
    ctx.fillRect(0, 0, w, h);

    // 2. ĐIỂM XUYẾT MỘT VÀI CHỖ KHÔNG CÓ CỎ NHỎ (AOE 1 BARE DIRT PATCHES - THƯA THỚT TỰ NHIÊN)
    const stepBare = 26; // Khoảng cách 26m
    const spanMetersX = (w / 2 + Math.abs(this.panX) + 30 * this.dpr) / pxPerMeter + stepBare;
    const spanMetersY = (h / 2 + Math.abs(this.panY) + 30 * this.dpr) / (pxPerMeter * TILT_Y) + stepBare;

    const startWx = Math.floor((centerWorldX - spanMetersX) / stepBare) * stepBare;
    const endWx = Math.ceil((centerWorldX + spanMetersX) / stepBare) * stepBare;
    const startWy = Math.floor((centerWorldY - spanMetersY) / stepBare) * stepBare;
    const endWy = Math.ceil((centerWorldY + spanMetersY) / stepBare) * stepBare;

    for (let wy = startWy; wy <= endWy; wy += stepBare) {
      for (let wx = startWx; wx <= endWx; wx += stepBare) {
        const hash = Math.sin(wx * 37.19 + wy * 83.47) * 43758.5453;
        const rand = hash - Math.floor(hash);

        // Chỉ xuất hiện ở 25% vị trí (rất thưa và tự nhiên như hình mẫu Đế Chế)
        if (rand > 0.25) continue;

        const jitterX = (Math.sin(wx * 5.7 + wy * 2.3) * 0.35) * stepBare;
        const jitterY = (Math.cos(wx * 4.1 + wy * 6.9) * 0.35) * stepBare;

        const sx = w / 2 + (wx + jitterX - centerWorldX) * pxPerMeter + this.panX;
        const sy = h / 2 - (wy + jitterY - centerWorldY) * pxPerMeter * TILT_Y + this.panY;

        if (sx < -30 || sx > w + 30 || sy < -30 || sy > h + 30) continue;

        // Vệt đất cát nhỏ (bán kính khoảng 1.8m - 3.2m)
        const rx = Math.max(3.5 * this.dpr, (1.8 + rand * 1.4) * pxPerMeter);
        const ry = rx * TILT_Y * 0.78;

        ctx.save();
        // Mảng đất cát tự nhiên
        ctx.fillStyle = isNight ? '#2a3523' : '#967442';
        ctx.beginPath();
        ctx.ellipse(sx, sy, rx, ry, 0.15, 0, Math.PI * 2);
        ctx.fill();

        // Lòng đất hơi đậm hơn
        ctx.fillStyle = isNight ? '#1e2819' : '#835f31';
        ctx.beginPath();
        ctx.ellipse(sx, sy, rx * 0.65, ry * 0.65, 0.15, 0, Math.PI * 2);
        ctx.fill();

        // 1-2 viên sỏi cát nhỏ
        ctx.fillStyle = isNight ? '#475a3c' : '#dfcca4';
        ctx.fillRect(sx - 1.5 * this.dpr, sy - 0.8 * this.dpr, 2.0 * this.dpr, 1.2 * this.dpr);
        ctx.fillStyle = isNight ? '#111b0e' : '#573c1c';
        ctx.fillRect(sx + 2.0 * this.dpr, sy + 0.5 * this.dpr, 1.6 * this.dpr, 1.0 * this.dpr);

        ctx.restore();
      }
    }

    // 3. KHỐI ĐÁ & TẢNG ĐÁ RÊU PHONG TỰ NHIÊN 2.5D (AOE 1 ISOMETRIC NATURAL BOULDERS & ROCK OUTCROPS)
    const stepRock = 36; // Lưới 36m cho các khối đá
    const spanRocksX = (w / 2 + Math.abs(this.panX) + 40 * this.dpr) / pxPerMeter + stepRock;
    const spanRocksY = (h / 2 + Math.abs(this.panY) + 40 * this.dpr) / (pxPerMeter * TILT_Y) + stepRock;

    const startRockX = Math.floor((centerWorldX - spanRocksX) / stepRock) * stepRock;
    const endRockX = Math.ceil((centerWorldX + spanRocksX) / stepRock) * stepRock;
    const startRockY = Math.floor((centerWorldY - spanRocksY) / stepRock) * stepRock;
    const endRockY = Math.ceil((centerWorldY + spanRocksY) / stepRock) * stepRock;

    for (let wy = startRockY; wy <= endRockY; wy += stepRock) {
      for (let wx = startRockX; wx <= endRockX; wx += stepRock) {
        const hash = Math.sin(wx * 43.17 + wy * 97.53) * 31415.9265;
        const rand = hash - Math.floor(hash);

        // Xuất hiện ở ~35% vị trí (thưa thớt, tự nhiên, điểm xuyết cảnh quan)
        if (rand > 0.35) continue;

        const jitterX = (Math.sin(wx * 3.7 + wy * 8.1) * 0.38) * stepRock;
        const jitterY = (Math.cos(wx * 7.3 + wy * 4.9) * 0.38) * stepRock;

        const sx = w / 2 + (wx + jitterX - centerWorldX) * pxPerMeter + this.panX;
        const sy = h / 2 - (wy + jitterY - centerWorldY) * pxPerMeter * TILT_Y + this.panY;

        if (sx < -40 || sx > w + 40 || sy < -40 || sy > h + 40) continue;

        const rockScale = (1.4 + rand * 1.5) * this.dpr; // Kích thước khối đá
        const rockType = Math.floor(rand * 3); // 3 kiểu khối đá phong phú

        ctx.save();
        ctx.translate(sx, sy);

        if (rockType === 0) {
          // KIỂU 1: Tảng Đá Sa Thạch Cổ Đại Có Rêu (Ancient Mossy Boulder)
          // 1. Bóng đổ 2.5D dưới chân tảng đá
          ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
          ctx.beginPath();
          ctx.ellipse(3 * rockScale, 2 * rockScale, 9 * rockScale, 4.5 * rockScale, 0.2, 0, Math.PI * 2);
          ctx.fill();

          // 2. Mặt đáy & cạnh khuất bóng (Mặt Đông Nam tối)
          ctx.fillStyle = isNight ? '#1e293b' : '#475569';
          ctx.beginPath();
          ctx.moveTo(-7 * rockScale, 1 * rockScale);
          ctx.lineTo(-2 * rockScale, 5 * rockScale);
          ctx.lineTo(8 * rockScale, 4 * rockScale);
          ctx.lineTo(10 * rockScale, -1 * rockScale);
          ctx.lineTo(5 * rockScale, -8 * rockScale);
          ctx.lineTo(-4 * rockScale, -9 * rockScale);
          ctx.closePath();
          ctx.fill();

          // 3. Mặt sườn chính giữa (Midtone Facet)
          ctx.fillStyle = isNight ? '#334155' : '#64748b';
          ctx.beginPath();
          ctx.moveTo(-7 * rockScale, 1 * rockScale);
          ctx.lineTo(-4 * rockScale, -9 * rockScale);
          ctx.lineTo(2 * rockScale, -6 * rockScale);
          ctx.lineTo(4 * rockScale, 3 * rockScale);
          ctx.lineTo(-2 * rockScale, 5 * rockScale);
          ctx.closePath();
          ctx.fill();

          // 4. Mặt đỉnh đón nắng hướng Tây Bắc (Top Sunlit Facet)
          ctx.fillStyle = isNight ? '#475569' : '#94a3b8';
          ctx.beginPath();
          ctx.moveTo(-4 * rockScale, -9 * rockScale);
          ctx.lineTo(5 * rockScale, -8 * rockScale);
          ctx.lineTo(2 * rockScale, -4 * rockScale);
          ctx.lineTo(-1 * rockScale, -5 * rockScale);
          ctx.closePath();
          ctx.fill();

          // 5. Đường gân đá nứt sắc nét (Chiseled Rock Ridge)
          ctx.strokeStyle = isNight ? '#0f172a' : '#334155';
          ctx.lineWidth = 1.0 * this.dpr;
          ctx.beginPath();
          ctx.moveTo(-4 * rockScale, -9 * rockScale);
          ctx.lineTo(2 * rockScale, -6 * rockScale);
          ctx.lineTo(4 * rockScale, 3 * rockScale);
          ctx.stroke();

          // 6. Rêu xanh cổ phong hoá bám trên lưng đá (Emerald Moss Crest)
          ctx.fillStyle = isNight ? '#166534' : '#65a30d';
          ctx.beginPath();
          ctx.ellipse(-1 * rockScale, -7.5 * rockScale, 3.2 * rockScale, 1.4 * rockScale, -0.25, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = isNight ? '#22c55e' : '#84cc16';
          ctx.fillRect(-2 * rockScale, -8.2 * rockScale, 1.8 * rockScale, 0.9 * rockScale);

          // 7. Bụi cỏ nhỏ dưới chân tảng đá
          ctx.fillStyle = isNight ? '#15803d' : '#4d9b26';
          ctx.fillRect(-8 * rockScale, 0, 1.5 * rockScale, 2.5 * rockScale);
          ctx.fillRect(7 * rockScale, 2 * rockScale, 1.5 * rockScale, 2.2 * rockScale);

        } else if (rockType === 1) {
          // KIỂU 2: Cụm 2 Khối Đá Cuội Tròn Nổi Khối (Dual Rounded Pebble Outcrop)
          // Bóng đổ
          ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
          ctx.beginPath();
          ctx.ellipse(2 * rockScale, 2 * rockScale, 8 * rockScale, 3.8 * rockScale, 0.1, 0, Math.PI * 2);
          ctx.fill();

          // Hòn đá phụ nhỏ bên trái
          ctx.fillStyle = isNight ? '#243044' : '#576579';
          ctx.beginPath();
          ctx.ellipse(-4 * rockScale, 0, 4 * rockScale, 3 * rockScale, -0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = isNight ? '#3b495e' : '#8291a4';
          ctx.beginPath();
          ctx.ellipse(-4.8 * rockScale, -1.2 * rockScale, 2.2 * rockScale, 1.5 * rockScale, -0.2, 0, Math.PI * 2);
          ctx.fill();

          // Hòn đá chính lớn ở giữa nhô cao
          ctx.fillStyle = isNight ? '#1e293b' : '#475569';
          ctx.beginPath();
          ctx.ellipse(2 * rockScale, -1 * rockScale, 5.8 * rockScale, 4.5 * rockScale, 0.15, 0, Math.PI * 2);
          ctx.fill();

          // Mặt trên đón sáng
          ctx.fillStyle = isNight ? '#334155' : '#718298';
          ctx.beginPath();
          ctx.ellipse(1 * rockScale, -2.5 * rockScale, 4.2 * rockScale, 2.8 * rockScale, 0.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = isNight ? '#475569' : '#a1b2c6';
          ctx.beginPath();
          ctx.arc(0.5 * rockScale, -3.8 * rockScale, 1.8 * rockScale, 0, Math.PI * 2);
          ctx.fill();

          // Đốm rêu nhỏ
          ctx.fillStyle = isNight ? '#166534' : '#4d9b26';
          ctx.fillRect(1 * rockScale, -4.5 * rockScale, 2.0 * rockScale, 1.0 * rockScale);

        } else {
          // KIỂU 3: Mỏm Đá Sa Thạch Nâu Đất Góc Cạnh (Angular Sandstone Monolith)
          // Bóng đổ
          ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
          ctx.beginPath();
          ctx.ellipse(3 * rockScale, 3 * rockScale, 8.5 * rockScale, 4.0 * rockScale, 0.25, 0, Math.PI * 2);
          ctx.fill();

          // Mặt tối bên phải
          ctx.fillStyle = isNight ? '#261c14' : '#573d23';
          ctx.beginPath();
          ctx.moveTo(0, -9 * rockScale);
          ctx.lineTo(7 * rockScale, -4 * rockScale);
          ctx.lineTo(8 * rockScale, 2 * rockScale);
          ctx.lineTo(2 * rockScale, 5 * rockScale);
          ctx.lineTo(0, -2 * rockScale);
          ctx.closePath();
          ctx.fill();

          // Mặt sáng bên trái
          ctx.fillStyle = isNight ? '#3d2e20' : '#88623a';
          ctx.beginPath();
          ctx.moveTo(0, -9 * rockScale);
          ctx.lineTo(-6 * rockScale, -3 * rockScale);
          ctx.lineTo(-5 * rockScale, 3 * rockScale);
          ctx.lineTo(2 * rockScale, 5 * rockScale);
          ctx.lineTo(0, -2 * rockScale);
          ctx.closePath();
          ctx.fill();

          // Đỉnh vát chóp sáng
          ctx.fillStyle = isNight ? '#554231' : '#b28452';
          ctx.beginPath();
          ctx.moveTo(0, -9 * rockScale);
          ctx.lineTo(3 * rockScale, -6 * rockScale);
          ctx.lineTo(-2 * rockScale, -5 * rockScale);
          ctx.closePath();
          ctx.fill();

          // Gân đá sa thạch phân lớp
          ctx.strokeStyle = isNight ? '#1a130d' : '#442d17';
          ctx.lineWidth = 0.9 * this.dpr;
          ctx.beginPath();
          ctx.moveTo(-5 * rockScale, -1 * rockScale);
          ctx.lineTo(1 * rockScale, 1.5 * rockScale);
          ctx.stroke();
        }

        ctx.restore();
      }
    }
  }

  // ================================================================
  // 4e. TẦNG QUẦN XÃ DÃ THÚ & SINH CẢNH THIÊN NHIÊN (RENDER TRÊN MẶT ĐẤT VÀ MẶT ĐƯỜNG)
  // ================================================================

  private drawWildlifeAndEnvironment(
    w: number,
    h: number,
    palette: typeof PALETTE.day,
    input: RenderInput,
    project: (at: LatLon) => [number, number],
    pxPerMeter: number,
    TILT_Y: number,
  ): void {
    const WORLD_ORIGIN_LAT = 21.0;
    const WORLD_ORIGIN_LON = 105.8;

    const centerWorldX = (input.center.lon - WORLD_ORIGIN_LON) / metersToLonDegrees(1, input.center.lat);
    const centerWorldY = (input.center.lat - WORLD_ORIGIN_LAT) / metersToLatDegrees(1);

    const stepWildlife = 125; // Khoảng cách ô sinh thái 125m: mật độ vừa vặn, sống động, khám phá là gặp khủng long
    const spanMetersX = (w / 2 + Math.abs(this.panX) + 60 * this.dpr) / pxPerMeter + stepWildlife * 2;
    const spanMetersY = (h / 2 + Math.abs(this.panY) + 60 * this.dpr) / (pxPerMeter * TILT_Y) + stepWildlife * 2;

    const startWldX = Math.floor((centerWorldX - spanMetersX) / stepWildlife) * stepWildlife;
    const endWldX = Math.ceil((centerWorldX + spanMetersX) / stepWildlife) * stepWildlife;
    const startWldY = Math.floor((centerWorldY - spanMetersY) / stepWildlife) * stepWildlife;
    const endWldY = Math.ceil((centerWorldY + spanMetersY) / stepWildlife) * stepWildlife;

    const playerScreenX = w / 2 + this.panX;
    const playerScreenY = h / 2 + this.panY;

    this.renderedBeasts = [];

    const getOrCreateBeast = (id: string, species: BeastSpecies, ox: number, oy: number): DynamicBeastPack | null => {
      if (input.dynamicBeasts) {
        if (!input.dynamicBeasts.has(id)) {
          input.dynamicBeasts.set(id, createDynamicBeastPack(id, species, ox, oy));
        }
        return input.dynamicBeasts.get(id) || null;
      }
      return null;
    };

    for (let wy = startWldY; wy <= endWldY; wy += stepWildlife) {
      for (let wx = startWldX; wx <= endWldX; wx += stepWildlife) {
        const hash = Math.sin(wx * 12.9898 + wy * 78.233) * 43758.5453;
        const rand = hash - Math.floor(hash);
        const biomeNoise = Math.sin(wx * 0.008 + wy * 0.006) * 0.52 + Math.cos(wx * 0.005 - wy * 0.009) * 0.48;

        let species: BeastSpecies | null = null;
        let isScenery = false;

        const speciesRoll = Math.abs((Math.sin(wx * 3.17 + wy * 7.91) * 10000) % 1);

        // Phân bổ Hệ Sinh Thái Tự Nhiên Hài Hòa: 50% Thú & Khủng Long, 50% Cảnh quan nguyên sinh
        if (biomeNoise < -0.22) {
          // VÙNG ĐẤT NÚI LỬA / SA MẠC ĐÁ: Bạo Chúa T-Rex, Thiết Giáp Ankylosaurus, Sư Tử Hang, Voi Ma Mút, Dực Long
          if (speciesRoll > 0.88) species = 'trex';
          else if (speciesRoll > 0.77) species = 'ankylosaurus';
          else if (speciesRoll > 0.67) species = 'lion';
          else if (speciesRoll > 0.57) species = 'mammoth';
          else if (speciesRoll > 0.48) species = 'pterosaur';
          else isScenery = true;
        } else if (biomeNoise >= -0.22 && biomeNoise < 0.08) {
          // VÙNG THẢO NGUYÊN BẠT NGÀN: Khủng Long Cổ Dài Brachiosaurus, Ba Sừng Triceratops, Nhạn Long, Sói, Hươu, Ngựa
          if (speciesRoll > 0.88) species = 'brachiosaurus';
          else if (speciesRoll > 0.77) species = 'triceratops';
          else if (speciesRoll > 0.67) species = 'raptor';
          else if (speciesRoll > 0.58) species = 'wolf';
          else if (speciesRoll > 0.51) species = 'deer';
          else if (speciesRoll > 0.45) species = 'horse';
          else isScenery = true;
        } else if (biomeNoise >= 0.08 && biomeNoise < 0.32) {
          // VÙNG ĐẦM LẦY & VEN SÔNG HỒ: Cánh Buồm Spinosaurus, Cá Sấu Đế Vương, Cự Mãng Xà, Thủy Long, Lợn Lòi
          if (speciesRoll > 0.88) species = 'spinosaurus';
          else if (speciesRoll > 0.77) species = 'croc';
          else if (speciesRoll > 0.67) species = 'titanoboa';
          else if (speciesRoll > 0.57) species = 'plesiosaur';
          else if (speciesRoll > 0.48) species = 'boar';
          else isScenery = true;
        } else {
          // VÙNG ĐẠI NGÀN NGUYÊN SINH: Spinosaurus, Song Mào Dilophosaurus, Nhạn Long, Báo Răng Kiếm, Gấu Hang
          if (speciesRoll > 0.88) species = 'spinosaurus';
          else if (speciesRoll > 0.77) species = 'dilophosaurus';
          else if (speciesRoll > 0.67) species = 'raptor';
          else if (speciesRoll > 0.57) species = 'sabertooth';
          else if (speciesRoll > 0.48) species = 'bear';
          else isScenery = true;
        }

        // Tọa độ vẽ
        let drawWorldX = wx;
        let drawWorldY = wy;
        let beastObj: DynamicBeastPack | null = null;

        if (species) {
          const lairId = `beast_${wx}_${wy}`;
          beastObj = getOrCreateBeast(lairId, species, wx, wy);
          if (beastObj) {
            if (beastObj.isDefeated) continue; // Thú đã bị hạ gục
            drawWorldX = beastObj.currentWorldX;
            drawWorldY = beastObj.currentWorldY;
          }
        }

        const sx = w / 2 + (drawWorldX - centerWorldX) * pxPerMeter + this.panX;
        const sy = h / 2 - (drawWorldY - centerWorldY) * pxPerMeter * TILT_Y + this.panY;

        if (sx < -90 * this.dpr || sx > w + 90 * this.dpr || sy < -90 * this.dpr || sy > h + 90 * this.dpr) {
          continue;
        }

        const distToPlayerMeters = Math.hypot((sx - playerScreenX) / pxPerMeter, (sy - playerScreenY) / (pxPerMeter * TILT_Y));

        if (beastObj) {
          this.renderedBeasts.push({ beast: beastObj, x: sx, y: sy, radius: 28 * this.dpr });
        }

        // VẼ TƯƠNG ỨNG TỪNG LOÀI KHỦNG LONG & DÃ THÚ 2.5D
        if (species) {
          switch (species) {
            case 'trex':
              this.drawTRex(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, beastObj);
              break;
            case 'croc':
              this.drawSarcosuchus(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, beastObj);
              break;
            case 'titanoboa':
              this.drawTitanoboa(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, beastObj);
              break;
            case 'plesiosaur':
              this.drawPlesiosaur(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, beastObj);
              break;
            case 'raptor':
              this.drawVelociraptorPack(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, beastObj);
              break;
            case 'spinosaurus':
              this.drawSpinosaurus(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, beastObj);
              break;
            case 'dilophosaurus':
              this.drawDilophosaurus(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, beastObj);
              break;
            case 'triceratops':
              this.drawTriceratops(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, beastObj);
              break;
            case 'ankylosaurus':
              this.drawAnkylosaurus(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, beastObj);
              break;
            case 'brachiosaurus':
              this.drawBrachiosaurus(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, beastObj);
              break;
            case 'pterosaur':
              this.drawPterosaur(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, beastObj);
              break;
            case 'lion':
              this.drawCaveLionPride(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, beastObj);
              break;
            case 'mammoth':
              this.drawElephantHerd(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, beastObj);
              break;
            case 'wolf':
              this.drawDireWolfPack(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, beastObj);
              break;
            case 'deer':
              this.drawDeerHerd(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, beastObj);
              break;
            case 'sabertooth':
              this.drawSabertoothPredator(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, beastObj);
              break;
            case 'bear':
              this.drawCaveBear(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, beastObj);
              break;
            case 'boar':
              this.drawGiantBoar(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, beastObj);
              break;
            case 'horse':
              this.drawWildHorseHerd(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, beastObj);
              break;
          }
        } else {
          // Vẽ cảnh vật sinh thái phụ trợ (Rừng cây, mỏ đá, bụi quả, hóa thạch xương)
          if (biomeNoise < -0.22) {
            if (rand > 0.45) this.drawAoeStoneQuarry(sx, sy, pxPerMeter, TILT_Y, rand);
            else this.drawDinoSkeletonFossil(sx, sy, pxPerMeter, TILT_Y, rand);
          } else if (biomeNoise >= -0.22 && biomeNoise < 0.08) {
            if (rand > 0.50) this.drawDenseForestGrove(sx, sy, pxPerMeter, TILT_Y, rand);
            else if (rand > 0.25) this.drawOakTree(sx, sy, pxPerMeter, TILT_Y, rand);
            else this.drawGrassTuftsAndFern(sx, sy, pxPerMeter, TILT_Y, rand);
          } else if (biomeNoise >= 0.08 && biomeNoise < 0.32) {
            if (rand > 0.40) this.drawDenseForestGrove(sx, sy, pxPerMeter, TILT_Y, rand);
            else this.drawGrassTuftsAndFern(sx, sy, pxPerMeter, TILT_Y, rand);
          } else {
            if (rand > 0.35) this.drawDenseForestGrove(sx, sy, pxPerMeter, TILT_Y, rand);
            else this.drawBerryBush(sx, sy, pxPerMeter, TILT_Y, rand);
          }
        }
      }
    }
  }

  // ================================================================
  // CÁC HÀM VẼ QUẦN THỂ ĐỘNG VẬT HOANG DÃ 2.5D CỰC KỲ CHI TIẾT & SỐNG ĐỘNG
  // ================================================================

    /** VÒNG HÀO QUANG CẢNH BÁO NGUY HIỂM & THANH MÁU BÁO ĐỘNG AGGRO THỜI TIỀN SỬ */
  private drawBeastAggroWarning(
    sx: number,
    sy: number,
    s: number,
    distToPlayerMeters: number,
    nameVi: string,
    iconEmoji: string,
    beast?: DynamicBeastPack | null,
  ): void {
    const { ctx } = this;
    const isAttacking = distToPlayerMeters <= 8.5;
    const isDamaged = beast && beast.currentHp < beast.maxHp;

    if (distToPlayerMeters > 25 && !isDamaged) return;

    if (isAttacking) {
      this.nearestAttackingBeast = { nameVi, distMeters: distToPlayerMeters, beast: beast || undefined };
    }

    const pulse = 0.5 + 0.5 * Math.sin(this.tick / (isAttacking ? 2.5 : 6));

    ctx.save();
    // 1. Vòng tròn nguy hiểm đỏ rực dưới chân bầy thú
    const ringGrad = ctx.createRadialGradient(sx, sy + 6 * s, 4 * s, sx, sy + 6 * s, (isAttacking ? 24 : 18) * s);
    if (isAttacking) {
      ringGrad.addColorStop(0, `rgba(239, 68, 68, ${0.45 * pulse})`);
      ringGrad.addColorStop(0.7, `rgba(220, 38, 38, ${0.30 * pulse})`);
      ringGrad.addColorStop(1, 'rgba(185, 28, 28, 0)');
    } else {
      ringGrad.addColorStop(0, `rgba(245, 158, 11, ${0.30 * pulse})`);
      ringGrad.addColorStop(0.7, `rgba(239, 68, 68, ${0.18 * pulse})`);
      ringGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    }

    ctx.fillStyle = ringGrad;
    ctx.strokeStyle = isAttacking ? `rgba(239, 68, 68, ${0.9 * pulse})` : `rgba(245, 158, 11, ${0.8 * pulse})`;
    ctx.lineWidth = (isAttacking ? 2.2 : 1.4) * this.dpr;

    ctx.beginPath();
    ctx.ellipse(sx, sy + 6 * s, (isAttacking ? 24 : 18) * s, (isAttacking ? 10 : 7.5) * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 2. Hiệu ứng vệt móng vuốt cào xé chớp nhoáng khi cận chiến (<= 8.5m)
    if (isAttacking) {
      const clawShift = Math.sin(this.tick / 1.8) * 6 * this.dpr;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.4 * this.dpr;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx - 12 * this.dpr + clawShift, sy - 16 * this.dpr);
      ctx.lineTo(sx + 10 * this.dpr + clawShift, sy + 4 * this.dpr);
      ctx.moveTo(sx - 7 * this.dpr + clawShift, sy - 19 * this.dpr);
      ctx.lineTo(sx + 15 * this.dpr + clawShift, sy + 1 * this.dpr);
      ctx.moveTo(sx - 2 * this.dpr + clawShift, sy - 21 * this.dpr);
      ctx.lineTo(sx + 20 * this.dpr + clawShift, sy - 2 * this.dpr);
      ctx.stroke();
    }

    // 3. Thẻ cảnh báo & THANH MÁU DÃ THÚ (AoE 1 HP Bar)
    const curHp = beast ? beast.currentHp : 50;
    const maxHp = beast ? beast.maxHp : 50;
    const hpRatio = Math.max(0, Math.min(1, curHp / maxHp));

    const tagText = isAttacking
      ? `⚔️ ${nameVi.toUpperCase()} (${curHp}/${maxHp} HP)`
      : `⚠️ ${nameVi} (${Math.round(distToPlayerMeters)}m)`;

    ctx.font = `bold ${9 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
    const tagW = Math.max(64 * this.dpr, ctx.measureText(tagText).width + 16 * this.dpr);
    const tagH = 18 * this.dpr;
    const tagY = sy - 22 * s;

    ctx.fillStyle = isAttacking ? 'rgba(185, 28, 28, 0.95)' : 'rgba(25, 18, 10, 0.88)';
    ctx.strokeStyle = isAttacking ? '#fef08a' : '#f59e0b';
    ctx.lineWidth = 1.4 * this.dpr;

    ctx.beginPath();
    ctx.roundRect(sx - tagW / 2, tagY - tagH / 2, tagW, tagH, 4 * this.dpr);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isAttacking ? '#ffffff' : '#fef08a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, sx, tagY - 2 * this.dpr);

    // Thanh máu HP Bar sắc nét bên dưới thẻ
    const barW = tagW - 8 * this.dpr;
    const barH = 3.5 * this.dpr;
    const barX = sx - barW / 2;
    const barY = tagY + 4.5 * this.dpr;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(barX, barY, barW, barH);

    ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#eab308' : '#ef4444';
    ctx.fillRect(barX, barY, barW * hpRatio, barH);

    ctx.restore();
  }

  private drawDireWolfPack(
    sx: number,
    sy: number,
    pxPerMeter: number,
    TILT_Y: number,
    distToPlayerMeters: number,
    beast?: DynamicBeastPack | null,
  ): void {
    const { ctx } = this;
    const u = Math.max(0.16 * this.dpr, 0.35 * pxPerMeter);
    if (u < 0.03) return;

    this.drawBeastAggroWarning(sx, sy, u * 2.2, distToPlayerMeters, 'Bầy Sói Hoang', '🐺', beast);

    ctx.save();
    ctx.translate(sx, sy);

    const isAggro = distToPlayerMeters <= 22;
    const aggroShake = isAggro ? Math.sin(this.tick * 0.45) * 1.2 * u : 0;

    // A. Môi trường nền AoE 1: Thảm đất xơ cào xước nhẹ & phiến đá nhỏ
    ctx.fillStyle = 'rgba(25, 35, 18, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 4 * u, 22 * u, 10 * u, -0.15, 0, Math.PI * 2);
    ctx.fill();

    // Mẩu đá phiến tự nhiên
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.ellipse(-12 * u, 5 * u, 3.5 * u, 1.8 * u, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // B. Đội hình 3 con sói (Alpha dẫn đầu, Beta rình rập, Scout đi sau)
    const wolves = [
      { ox: 3 * u, oy: -1 * u, scale: 1.05, isAlpha: true, pose: 'prowl' },
      { ox: -10 * u, oy: 4 * u, scale: 0.95, isAlpha: false, pose: 'stalk' },
      { ox: 11 * u, oy: 6 * u, scale: 0.88, isAlpha: false, pose: 'trot' },
    ];

    for (const w of wolves) {
      const dx = w.ox + (w.isAlpha ? aggroShake : 0);
      const dy = w.oy;
      const s = u * w.scale;

      // 1. Bóng đổ isometric góc nghiêng 45° chuẩn AoE
      ctx.fillStyle = 'rgba(15, 25, 10, 0.45)';
      ctx.beginPath();
      ctx.ellipse(dx + 2 * s, dy + 5.5 * s, 8.5 * s, 3.2 * s, 0.15, 0, Math.PI * 2);
      ctx.fill();

      // 2. Chân sau (khớp gập tự nhiên, thanh thoát)
      ctx.strokeStyle = '#2d3748';
      ctx.lineWidth = Math.max(1.1 * this.dpr, 0.9 * s);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      // Chân sau xa
      ctx.moveTo(dx - 4 * s, dy + 1 * s);
      ctx.lineTo(dx - 6 * s, dy + 3.5 * s);
      ctx.lineTo(dx - 5.5 * s, dy + 6.5 * s);
      // Chân sau gần
      ctx.moveTo(dx - 2 * s, dy + 1 * s);
      ctx.lineTo(dx - 3.5 * s, dy + 4 * s);
      ctx.lineTo(dx - 3 * s, dy + 7 * s);
      // Chân trước xa & gần
      ctx.moveTo(dx + 3.5 * s, dy + 1 * s); ctx.lineTo(dx + 3.5 * s, dy + 7 * s);
      ctx.moveTo(dx + 5.5 * s, dy + 1 * s); ctx.lineTo(dx + 6 * s, dy + 6.8 * s);
      ctx.stroke();

      // 3. Thân sói xám tro tự nhiên (Earthy Ash-Grey Wolf Pelt)
      const peltGrad = ctx.createLinearGradient(dx - 6 * s, dy - 3 * s, dx + 5 * s, dy + 3 * s);
      peltGrad.addColorStop(0, '#525b66');
      peltGrad.addColorStop(0.5, '#3b424a');
      peltGrad.addColorStop(1, '#242a30');
      ctx.fillStyle = peltGrad;
      ctx.beginPath();
      ctx.moveTo(dx - 6 * s, dy);
      ctx.quadraticCurveTo(dx - 3 * s, dy - 3.5 * s, dx + 2 * s, dy - 2.5 * s);
      ctx.quadraticCurveTo(dx + 6 * s, dy - 0.5 * s, dx + 5.5 * s, dy + 2.5 * s);
      ctx.quadraticCurveTo(dx + 1 * s, dy + 3.5 * s, dx - 3 * s, dy + 2.8 * s);
      ctx.quadraticCurveTo(dx - 5.5 * s, dy + 2 * s, dx - 6 * s, dy);
      ctx.closePath();
      ctx.fill();

      // 4. Bờm cổ & ức lông xám sáng (Ruff & Chest)
      ctx.fillStyle = '#737f8d';
      ctx.beginPath();
      ctx.moveTo(dx + 1 * s, dy - 2 * s);
      ctx.lineTo(dx + 4.5 * s, dy - 1.2 * s);
      ctx.lineTo(dx + 4 * s, dy + 2 * s);
      ctx.lineTo(dx + 0.5 * s, dy + 1.5 * s);
      ctx.closePath();
      ctx.fill();

      // 5. Đuôi sói rủ thấp uốn lượn nhẹ
      const tailWag = Math.sin(this.tick * 0.12 + dx) * 0.8 * s;
      ctx.strokeStyle = '#3b424a';
      ctx.lineWidth = 1.8 * s;
      ctx.beginPath();
      ctx.moveTo(dx - 5.5 * s, dy);
      ctx.quadraticCurveTo(dx - 9 * s, dy + 1.5 * s, dx - 8 * s + tailWag, dy + 6 * s);
      ctx.stroke();

      // 6. Cổ và Đầu sói sắc nét góc nghiêng 2.5D
      ctx.fillStyle = '#424a52';
      ctx.beginPath();
      ctx.moveTo(dx + 2.5 * s, dy - 2 * s);
      ctx.lineTo(dx + 5.5 * s, dy - 5.5 * s);
      ctx.lineTo(dx + 8.5 * s, dy - 4 * s);
      ctx.lineTo(dx + 5.5 * s, dy + 1 * s);
      ctx.closePath();
      ctx.fill();

      // Mõm thon dài & Mũi đen nhỏ
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(dx + 6.5 * s, dy - 4.5 * s);
      ctx.lineTo(dx + 9.8 * s, dy - 3.8 * s);
      ctx.lineTo(dx + 7.5 * s, dy - 2.5 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(dx + 9.8 * s, dy - 3.8 * s, 0.6 * s, 0, Math.PI * 2);
      ctx.fill();

      // Tai sói nhọn vểnh
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(dx + 4.8 * s, dy - 5 * s);
      ctx.lineTo(dx + 5.8 * s, dy - 8 * s);
      ctx.lineTo(dx + 6.8 * s, dy - 5.2 * s);
      ctx.closePath();
      ctx.fill();

      // Mắt thú tự nhiên (Hổ phách thanh mảnh, đốm đỏ nhỏ khi Aggro)
      ctx.fillStyle = isAggro ? '#dc2626' : '#d97706';
      ctx.beginPath();
      ctx.arc(dx + 7.2 * s, dy - 4.2 * s, 0.65 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /** 2. BÃI SƯ TỬ HANG ĐỘNG TIỀN SỬ (AoE 1 Cave Lion Pride - Vàng sa thạch, cơ bắp thanh thoát) */
  private drawCaveLionPride(
    sx: number,
    sy: number,
    pxPerMeter: number,
    TILT_Y: number,
    distToPlayerMeters: number,
    beast?: DynamicBeastPack | null,
  ): void {
    const { ctx } = this;
    const u = Math.max(0.20 * this.dpr, 0.44 * pxPerMeter);
    if (u < 0.03) return;

    this.drawBeastAggroWarning(sx, sy, u * 2.2, distToPlayerMeters, 'Sư Tử Hang Động', '🦁', beast);

    ctx.save();
    ctx.translate(sx, sy);

    const isAggro = distToPlayerMeters <= 22;
    const roarShake = isAggro ? Math.sin(this.tick * 0.35) * 1.2 * u : 0;

    // A. Môi trường nền: Thềm đá sa thạch & vệt cỏ khô
    ctx.fillStyle = 'rgba(45, 35, 15, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 5 * u, 24 * u, 10 * u, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // B. Đôi sư tử (Sư tử đực rình mồi & sư tử cái nằm nghỉ)
    const lions = [
      { ox: 2 * u, oy: -1 * u, scale: 1.1, isMale: true, isLying: false },
      { ox: -9 * u, oy: 4 * u, scale: 0.95, isMale: false, isLying: !isAggro },
    ];

    for (const lion of lions) {
      const dx = lion.ox + (lion.isMale ? roarShake : 0);
      const dy = lion.oy;
      const s = u * lion.scale;

      // 1. Bóng đổ
      ctx.fillStyle = 'rgba(25, 20, 10, 0.45)';
      ctx.beginPath();
      ctx.ellipse(dx + 2 * s, dy + 6 * s, 10 * s, 3.8 * s, 0.15, 0, Math.PI * 2);
      ctx.fill();

      if (lion.isLying) {
        // Sư tử cái nằm nghỉ trên thảm cỏ
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.ellipse(dx, dy + 2 * s, 8 * s, 4 * s, -0.1, 0, Math.PI * 2);
        ctx.fill();
        // Đầu sư tử ngước nhìn
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.arc(dx + 6 * s, dy - 0.5 * s, 3.2 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.arc(dx + 8.5 * s, dy - 0.2 * s, 0.6 * s, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 2. Chân mèo lớn gân guốc
        ctx.fillStyle = '#92400e';
        ctx.fillRect(dx - 5.5 * s, dy + 1 * s, 2.2 * s, 6.5 * s);
        ctx.fillRect(dx - 2.5 * s, dy + 1.5 * s, 2.2 * s, 7 * s);
        ctx.fillRect(dx + 3 * s, dy + 1.5 * s, 2.2 * s, 7 * s);
        ctx.fillRect(dx + 6 * s, dy + 1 * s, 2.2 * s, 6.5 * s);

        // 3. Thân sư tử vàng hổ phách sa thạch
        const lionGrad = ctx.createLinearGradient(dx - 7 * s, dy - 4 * s, dx + 6 * s, dy + 4 * s);
        lionGrad.addColorStop(0, '#d97706');
        lionGrad.addColorStop(0.6, '#b45309');
        lionGrad.addColorStop(1, '#78350f');
        ctx.fillStyle = lionGrad;
        ctx.beginPath();
        ctx.moveTo(dx - 7 * s, dy);
        ctx.quadraticCurveTo(dx - 3 * s, dy - 4.5 * s, dx + 3 * s, dy - 3.5 * s);
        ctx.quadraticCurveTo(dx + 7 * s, dy - 1 * s, dx + 6.5 * s, dy + 3 * s);
        ctx.quadraticCurveTo(dx + 2 * s, dy + 4.5 * s, dx - 4 * s, dy + 3.8 * s);
        ctx.quadraticCurveTo(dx - 6.5 * s, dy + 2.5 * s, dx - 7 * s, dy);
        ctx.closePath();
        ctx.fill();

        // 4. Bờm cổ ngắn tiền sử (Cave Lion Mane)
        if (lion.isMale) {
          ctx.fillStyle = '#78350f';
          ctx.beginPath();
          ctx.arc(dx + 3.5 * s, dy - 1.5 * s, 4.5 * s, 0, Math.PI * 2);
          ctx.fill();
        }

        // 5. Đuôi dài chùm lông đen
        const tailWave = Math.sin(this.tick * 0.1 + dx) * 1.5 * s;
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.moveTo(dx - 6.5 * s, dy);
        ctx.quadraticCurveTo(dx - 10 * s, dy + 1.5 * s, dx - 9 * s, dy + 6.5 * s + tailWave);
        ctx.stroke();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(dx - 9 * s, dy + 6.5 * s + tailWave, 1.2 * s, 0, Math.PI * 2);
        ctx.fill();

        // 6. Đầu sư tử uy nghi
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.arc(dx + 7 * s, dy - 3 * s, 3.6 * s, 0, Math.PI * 2);
        ctx.fill();

        // Mõm trắng và mũi đen
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.ellipse(dx + 9.5 * s, dy - 2.2 * s, 2.2 * s, 1.8 * s, 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.arc(dx + 11 * s, dy - 2.5 * s, 0.65 * s, 0, Math.PI * 2);
        ctx.fill();

        // Mắt hổ phách
        ctx.fillStyle = isAggro ? '#dc2626' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(dx + 8.2 * s, dy - 3.8 * s, 0.7 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /** 3. BÃI LỢN LÒI RỪNG KHỔNG LỒ (AoE 1 Giant Boar / Entelodont - Đầm bùn, da sần sùi) */
  private drawGiantBoar(
    sx: number,
    sy: number,
    pxPerMeter: number,
    TILT_Y: number,
    distToPlayerMeters: number,
    beast?: DynamicBeastPack | null,
  ): void {
    const { ctx } = this;
    const u = Math.max(0.18 * this.dpr, 0.40 * pxPerMeter);
    if (u < 0.03) return;

    this.drawBeastAggroWarning(sx, sy, u * 2.2, distToPlayerMeters, 'Lợn Lòi Rừng Khổng Lồ', '🐗', beast);

    ctx.save();
    ctx.translate(sx, sy);

    const isAggro = distToPlayerMeters <= 22;
    const chargeBob = isAggro ? Math.sin(this.tick * 0.6) * 1.5 * u : 0;

    // A. Vũng bùn ẩm ướt
    ctx.fillStyle = 'rgba(40, 30, 18, 0.32)';
    ctx.beginPath();
    ctx.ellipse(0, 5 * u, 16 * u, 7 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    // B. Lợn lòi khổng lồ
    // 1. Bóng đổ
    ctx.fillStyle = 'rgba(20, 15, 10, 0.45)';
    ctx.beginPath();
    ctx.ellipse(chargeBob + 1 * u, 6 * u, 8.5 * u, 3.2 * u, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // 2. Chân móng guốc chẻ
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = Math.max(1.2 * this.dpr, 1.2 * u);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(chargeBob - 4.5 * u, 1 * u); ctx.lineTo(chargeBob - 5 * u, 6.5 * u);
    ctx.moveTo(chargeBob - 1.5 * u, 1.5 * u); ctx.lineTo(chargeBob - 1.5 * u, 7 * u);
    ctx.moveTo(chargeBob + 2.5 * u, 1.5 * u); ctx.lineTo(chargeBob + 2.5 * u, 7 * u);
    ctx.moveTo(chargeBob + 5.5 * u, 1 * u); ctx.lineTo(chargeBob + 6 * u, 6.5 * u);
    ctx.stroke();

    // 3. Thân lợn nâu đen sần sùi
    const boarGrad = ctx.createLinearGradient(chargeBob - 6 * u, -4 * u, chargeBob + 6 * u, 4 * u);
    boarGrad.addColorStop(0, '#54341e');
    boarGrad.addColorStop(0.7, '#382011');
    boarGrad.addColorStop(1, '#1c0f07');
    ctx.fillStyle = boarGrad;
    ctx.beginPath();
    ctx.ellipse(chargeBob, 0, 7.5 * u, 4.8 * u, -0.08, 0, Math.PI * 2);
    ctx.fill();

    // Gai lưng xù nhọn (Bristles)
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 1.2 * u;
    ctx.beginPath();
    for (let i = -5; i <= 3; i += 1.8) {
      ctx.moveTo(chargeBob + i * u, -4.5 * u);
      ctx.lineTo(chargeBob + (i - 1) * u, -7.5 * u);
    }
    ctx.stroke();

    // 4. Đầu & Mõm chúc xuống
    ctx.fillStyle = '#2b180d';
    ctx.beginPath();
    ctx.moveTo(chargeBob + 3 * u, -3 * u);
    ctx.lineTo(chargeBob + 9 * u, 0.5 * u);
    ctx.lineTo(chargeBob + 7.5 * u, 4.5 * u);
    ctx.lineTo(chargeBob + 2 * u, 3.5 * u);
    ctx.closePath();
    ctx.fill();

    // Mũi hếch & Cặp nanh cong trắng ngà
    ctx.fillStyle = '#0f0905';
    ctx.beginPath();
    ctx.arc(chargeBob + 9 * u, 1 * u, 1.2 * u, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.4 * u;
    ctx.beginPath();
    ctx.moveTo(chargeBob + 7.5 * u, 2.5 * u);
    ctx.quadraticCurveTo(chargeBob + 10.5 * u, 3.2 * u, chargeBob + 11 * u, -1 * u);
    ctx.stroke();

    // Mắt đỏ ngầu
    ctx.fillStyle = isAggro ? '#dc2626' : '#ea580c';
    ctx.beginPath();
    ctx.arc(chargeBob + 5 * u, -1.2 * u, 0.7 * u, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** 4. GẤU HANG ĐỘNG KHỔNG LỒ (AoE 1 Cave Bear - Thân đồ sộ, bướu vai uy lực) */
  private drawCaveBear(
    sx: number,
    sy: number,
    pxPerMeter: number,
    TILT_Y: number,
    distToPlayerMeters: number,
    beast?: DynamicBeastPack | null,
  ): void {
    const { ctx } = this;
    const u = Math.max(0.24 * this.dpr, 0.52 * pxPerMeter);
    if (u < 0.03) return;

    this.drawBeastAggroWarning(sx, sy, u * 2.2, distToPlayerMeters, 'Gấu Hang Động', '🐻', beast);

    ctx.save();
    ctx.translate(sx, sy);

    const isAggro = distToPlayerMeters <= 22;
    const roarShake = isAggro ? Math.sin(this.tick * 0.4) * 1.4 * u : 0;

    // A. Môi trường nền
    ctx.fillStyle = 'rgba(30, 25, 15, 0.30)';
    ctx.beginPath();
    ctx.ellipse(0, 6 * u, 18 * u, 8 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    // B. Thân gấu
    // 1. Bóng đổ
    ctx.fillStyle = 'rgba(15, 10, 5, 0.45)';
    ctx.beginPath();
    ctx.ellipse(2 * u, 7 * u, 11 * u, 4.2 * u, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // 2. 4 Chân gấu đồ sộ
    ctx.fillStyle = '#1c1008';
    ctx.fillRect(-6 * u, 1 * u, 3.2 * u, 7 * u);
    ctx.fillRect(-2 * u, 1.5 * u, 3.2 * u, 7.5 * u);
    ctx.fillRect(3 * u, 1.5 * u, 3.2 * u, 7.5 * u);
    ctx.fillRect(7 * u, 1 * u, 3.2 * u, 7 * u);

    // 3. Thân gấu nâu nhiều lớp lông
    const bearGrad = ctx.createRadialGradient(0, 0, 2 * u, 0, 0, 10 * u);
    bearGrad.addColorStop(0, '#54341e');
    bearGrad.addColorStop(0.7, '#382011');
    bearGrad.addColorStop(1, '#1c0f07');
    ctx.fillStyle = bearGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9.5 * u, 6.5 * u, -0.08, 0, Math.PI * 2);
    ctx.fill();

    // Bướu vai cao
    ctx.fillStyle = '#6b4327';
    ctx.beginPath();
    ctx.arc(2.5 * u, -3.8 * u, 4.5 * u, 0, Math.PI * 2);
    ctx.fill();

    // 4. Đầu & Mõm gấu
    ctx.fillStyle = '#26170d';
    ctx.beginPath();
    ctx.arc(7.5 * u + roarShake, -2.5 * u, 3.8 * u, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#452a17';
    ctx.beginPath();
    ctx.ellipse(10.5 * u + roarShake, -1.8 * u, 2.4 * u, 1.8 * u, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.arc(12.2 * u + roarShake, -2 * u, 0.8 * u, 0, Math.PI * 2);
    ctx.fill();

    // Tai tròn & Mắt đỏ
    ctx.fillStyle = '#1c1008';
    ctx.beginPath();
    ctx.arc(6.5 * u + roarShake, -5.8 * u, 1.4 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isAggro ? '#dc2626' : '#f59e0b';
    ctx.beginPath();
    ctx.arc(9 * u + roarShake, -3.5 * u, 0.7 * u, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** 5. BÁO RĂNG KIẾM PHỤC KÍCH (AoE 1 Sabertooth Predator - Nanh kiếm dài, phục kích rình mồi) */
  private drawSabertoothPredator(
    sx: number,
    sy: number,
    pxPerMeter: number,
    TILT_Y: number,
    distToPlayerMeters: number = 99,
    beast?: DynamicBeastPack | null,
  ): void {
    const { ctx } = this;
    const u = Math.max(0.20 * this.dpr, 0.44 * pxPerMeter);
    if (u < 0.03) return;

    this.drawBeastAggroWarning(sx, sy, u * 2.2, distToPlayerMeters, 'Báo Răng Kiếm', '🐯', beast);

    ctx.save();
    ctx.translate(sx, sy);

    const isAggro = distToPlayerMeters <= 22;
    const stalkSway = isAggro ? Math.sin(this.tick * 0.45) * 1.2 * u : 0;

    // A. Môi trường nền
    ctx.fillStyle = 'rgba(25, 20, 10, 0.30)';
    ctx.beginPath();
    ctx.ellipse(0, 5 * u, 14 * u, 6 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    // B. Thân báo
    // 1. Bóng đổ
    ctx.fillStyle = 'rgba(15, 10, 5, 0.45)';
    ctx.beginPath();
    ctx.ellipse(1 * u, 5.5 * u, 8.5 * u, 3 * u, 0.12, 0, Math.PI * 2);
    ctx.fill();

    // 2. Chân báo thon thả
    ctx.fillStyle = '#b45309';
    ctx.fillRect(-5 * u, 1 * u, 2 * u, 5.5 * u);
    ctx.fillRect(-1.8 * u, 1.2 * u, 2 * u, 6 * u);
    ctx.fillRect(2.5 * u, 1.2 * u, 2 * u, 6 * u);
    ctx.fillRect(5.5 * u, 1 * u, 2 * u, 5.5 * u);

    // 3. Thân báo hổ phách vằn đen
    const tigerGrad = ctx.createLinearGradient(0, -3 * u, 0, 3 * u);
    tigerGrad.addColorStop(0, '#f59e0b');
    tigerGrad.addColorStop(0.6, '#d97706');
    tigerGrad.addColorStop(1, '#78350f');
    ctx.fillStyle = tigerGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7.5 * u, 3.8 * u, isAggro ? -0.18 : -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Vằn hoa mai
    ctx.strokeStyle = '#1c0f07';
    ctx.lineWidth = 1.1 * u;
    ctx.beginPath();
    ctx.moveTo(-4 * u, -2.5 * u); ctx.lineTo(-2 * u, 1 * u);
    ctx.moveTo(-0.5 * u, -3 * u); ctx.lineTo(1 * u, 1.2 * u);
    ctx.moveTo(2.5 * u, -2.8 * u); ctx.lineTo(3.8 * u, 1 * u);
    ctx.stroke();

    // Đuôi ngắn ngoe nguẩy
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1.4 * u;
    ctx.beginPath();
    ctx.moveTo(-7 * u, -0.5 * u); ctx.lineTo(-9.5 * u, 2 * u);
    ctx.stroke();

    // 4. Đầu & Nanh kiếm dài trắng muốt (Sabertooth Daggers)
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.arc(6.5 * u + stalkSway, -2.5 * u, 3.4 * u, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.ellipse(9 * u + stalkSway, -1.8 * u, 1.8 * u, 1.5 * u, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Nanh kiếm cong sắc bén
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4 * u;
    ctx.beginPath();
    ctx.moveTo(8 * u + stalkSway, -1.2 * u);
    ctx.lineTo(8.8 * u + stalkSway, 4.5 * u);
    ctx.stroke();

    // Mắt báo
    ctx.fillStyle = isAggro ? '#dc2626' : '#fde047';
    ctx.beginPath();
    ctx.arc(7.5 * u + stalkSway, -3.5 * u, 0.7 * u, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** 6. BÃI HƯƠU SAO ĐẾ CHẾ (AoE 1 Gazelle / Deer Herd - 4 con thon thả gặm cỏ, đúng chuẩn AoE) */
  private drawDeerHerd(
    sx: number,
    sy: number,
    pxPerMeter: number,
    TILT_Y: number,
    distToPlayerMeters: number = 99,
    beast?: DynamicBeastPack | null,
  ): void {
    const { ctx } = this;
    const u = Math.max(0.16 * this.dpr, 0.35 * pxPerMeter);
    if (u < 0.03) return;

    this.drawBeastAggroWarning(sx, sy, u * 2.2, distToPlayerMeters, 'Bãi Hươu Sao', '🦌', beast);

    const isFleeing = distToPlayerMeters <= 14;

    ctx.save();
    ctx.translate(sx, sy);

    // Môi trường thảm cỏ hoa dại nhỏ AoE
    ctx.fillStyle = 'rgba(20, 40, 15, 0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 4 * u, 20 * u, 9 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    const deers = [
      { ox: 2 * u, oy: -2 * u, isGrazer: false, scale: 1.05, isStag: true },
      { ox: -10 * u, oy: 2 * u, isGrazer: !isFleeing, scale: 0.95, isStag: false },
      { ox: 10 * u, oy: 4 * u, isGrazer: !isFleeing, scale: 0.90, isStag: false },
      { ox: -2 * u, oy: 8 * u, isGrazer: false, scale: 0.72, isStag: false },
    ];

    for (const d of deers) {
      const dx = d.ox;
      const dy = d.oy;
      const s = u * d.scale;

      // 1. Bóng đổ nghiêng 45°
      ctx.fillStyle = 'rgba(15, 25, 10, 0.40)';
      ctx.beginPath();
      ctx.ellipse(dx + 1.5 * s, dy + 6 * s, 6.5 * s, 2.5 * s, 0.12, 0, Math.PI * 2);
      ctx.fill();

      // 2. 4 Chân guốc thon dài thanh nhã
      ctx.strokeStyle = '#5a3412';
      ctx.lineWidth = Math.max(0.9 * this.dpr, 0.8 * s);
      ctx.beginPath();
      ctx.moveTo(dx - 3.5 * s, dy); ctx.lineTo(dx - 4 * s, dy + 6.5 * s);
      ctx.moveTo(dx - 1.5 * s, dy); ctx.lineTo(dx - 1.8 * s, dy + 7 * s);
      ctx.moveTo(dx + 2.5 * s, dy); ctx.lineTo(dx + 2.5 * s, dy + 7 * s);
      ctx.moveTo(dx + 4.5 * s, dy); ctx.lineTo(dx + 5 * s, dy + 6.5 * s);
      ctx.stroke();

      // 3. Thân hươu hổ phách đốm trắng ngà
      const deerGrad = ctx.createLinearGradient(dx - 5 * s, dy - 2.5 * s, dx + 4 * s, dy + 2.5 * s);
      deerGrad.addColorStop(0, '#f59e0b');
      deerGrad.addColorStop(0.5, '#d97706');
      deerGrad.addColorStop(1, '#92400e');
      ctx.fillStyle = deerGrad;
      ctx.beginPath();
      ctx.ellipse(dx, dy, 5.8 * s, 3.2 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // Đốm trắng nhỏ trên lưng
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(dx - 2 * s, dy - 1.2 * s, 0.5 * s, 0, Math.PI * 2);
      ctx.arc(dx + 1.2 * s, dy - 1 * s, 0.5 * s, 0, Math.PI * 2);
      ctx.arc(dx - 0.2 * s, dy + 0.6 * s, 0.45 * s, 0, Math.PI * 2);
      ctx.fill();

      // 4. Đầu & Cổ hươu (Tư thế gặm cỏ hoặc ngẩng cao)
      if (d.isGrazer) {
        const grazeBob = Math.sin(this.tick * 0.08 + d.ox) * 1.0 * s;
        ctx.fillStyle = '#92400e';
        ctx.beginPath();
        ctx.ellipse(dx + 6 * s, dy + 4 * s + grazeBob, 2.5 * s, 1.5 * s, 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(dx + 7.5 * s, dy + 4.8 * s + grazeBob, 0.45 * s, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#92400e';
        ctx.beginPath();
        ctx.moveTo(dx + 2.5 * s, dy - 1.5 * s);
        ctx.lineTo(dx + 5.5 * s, dy - 6.5 * s);
        ctx.lineTo(dx + 7.5 * s, dy - 5.8 * s);
        ctx.lineTo(dx + 5.5 * s, dy);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(dx + 6.8 * s, dy - 7 * s, 2.4 * s, 1.5 * s, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Mắt đen láy
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(dx + 7.8 * s, dy - 7.5 * s, 0.6 * s, 0, Math.PI * 2);
        ctx.fill();

        // Cặp sừng gạc hươu đực (Branching Antlers)
        if (d.isStag) {
          ctx.strokeStyle = '#451a03';
          ctx.lineWidth = Math.max(0.9 * this.dpr, 0.7 * s);
          ctx.beginPath();
          ctx.moveTo(dx + 5.8 * s, dy - 8 * s);
          ctx.lineTo(dx + 5 * s, dy - 13 * s);
          ctx.lineTo(dx + 2.8 * s, dy - 15 * s);
          ctx.moveTo(dx + 5 * s, dy - 11 * s);
          ctx.lineTo(dx + 7 * s, dy - 13.5 * s);
          ctx.moveTo(dx + 4.2 * s, dy - 9.5 * s);
          ctx.lineTo(dx + 2.2 * s, dy - 11 * s);
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  /** 7. ĐÀN VOI MA MÚT TIỀN SỬ (AoE 1 Mammoth Herd - Chuẩn tỉ lệ Voi Chiến Đế Chế, to lớn nhưng cân đối) */
  private drawElephantHerd(
    sx: number,
    sy: number,
    pxPerMeter: number,
    TILT_Y: number,
    distToPlayerMeters: number = 99,
    beast?: DynamicBeastPack | null,
  ): void {
    const { ctx } = this;
    const u = Math.max(0.32 * this.dpr, 0.70 * pxPerMeter);
    if (u < 0.03) return;

    this.drawBeastAggroWarning(sx, sy, u * 2.4, distToPlayerMeters, 'Voi Ma Mút', '🐘', beast);

    ctx.save();
    ctx.translate(sx, sy);

    const elephants = [
      { ox: 0, oy: 0, scale: 1.05 }, // Voi mẹ
      { ox: -14 * u, oy: 6 * u, scale: 0.65 }, // Voi con
    ];

    for (const e of elephants) {
      const dx = e.ox;
      const dy = e.oy;
      const s = u * e.scale;

      // 1. Bóng đổ 3D
      ctx.fillStyle = 'rgba(25, 20, 12, 0.45)';
      ctx.beginPath();
      ctx.ellipse(dx + 2 * s, dy + 8.5 * s, 13 * s, 5.5 * s, 0.1, 0, Math.PI * 2);
      ctx.fill();

      // 2. 4 Chân voi cột đình phủ lông
      for (const lx of [-7, -3, 3, 7]) {
        const footX = dx + lx * s;
        const footY = dy + 2 * s;
        ctx.fillStyle = '#3f2b1d';
        ctx.fillRect(footX - 1.8 * s, footY, 3.6 * s, 7.5 * s);
        // Móng ngà nhỏ
        ctx.fillStyle = '#f1f5f9';
        ctx.beginPath();
        ctx.arc(footX, footY + 7.5 * s, 0.7 * s, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Thân voi ma mút lông len rậm
      const bodyGrad = ctx.createRadialGradient(dx, dy - 2 * s, 2 * s, dx, dy, 11 * s);
      bodyGrad.addColorStop(0, '#785135');
      bodyGrad.addColorStop(0.65, '#5c3d26');
      bodyGrad.addColorStop(1, '#2a1a11');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.ellipse(dx, dy, 10.5 * s, 7.8 * s, -0.08, 0, Math.PI * 2);
      ctx.fill();

      // Bướu vai nhô cao
      ctx.fillStyle = '#8c5c3e';
      ctx.beginPath();
      ctx.arc(dx - 2 * s, dy - 4.5 * s, 5.2 * s, 0, Math.PI * 2);
      ctx.fill();

      // 4. Đầu & Chỏm lông
      ctx.fillStyle = '#6e4730';
      ctx.beginPath();
      ctx.arc(dx + 8.5 * s, dy - 2.8 * s, 4.8 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8c5c3e';
      ctx.beginPath();
      ctx.arc(dx + 8 * s, dy - 6.5 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();

      // Tai nhỏ phủ lông
      ctx.fillStyle = '#452c1e';
      ctx.beginPath();
      ctx.ellipse(dx + 6.5 * s, dy - 2.5 * s, 2.2 * s, 3.8 * s, -0.4, 0, Math.PI * 2);
      ctx.fill();

      // Mắt đen
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(dx + 10 * s, dy - 4.2 * s, 0.8 * s, 0, Math.PI * 2);
      ctx.fill();

      // 5. Vòi voi uốn lượn
      const trunkSway = Math.sin(this.tick * 0.07 + dy) * 1.5 * s;
      ctx.strokeStyle = '#3f2b1d';
      ctx.lineWidth = 2.4 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(dx + 10.5 * s, dy - 1 * s);
      ctx.quadraticCurveTo(dx + 15 * s, dy + 2.5 * s, dx + 13 * s + trunkSway, dy + 8.5 * s);
      ctx.stroke();

      // 6. Cặp ngà voi xoắn ốc 3D cong vút
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.0 * s;
      ctx.beginPath();
      ctx.moveTo(dx + 9.5 * s, dy);
      ctx.quadraticCurveTo(dx + 15.5 * s, dy + 2 * s, dx + 17 * s, dy - 5 * s);
      ctx.stroke();
      // Highlight sáng
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.8 * s;
      ctx.beginPath();
      ctx.moveTo(dx + 10 * s, dy - 0.5 * s);
      ctx.quadraticCurveTo(dx + 15 * s, dy + 1.5 * s, dx + 16.5 * s, dy - 4.8 * s);
      ctx.stroke();
    }

    ctx.restore();
  }

  /** 8. BÃI NGỰA HOANG TIỀN SỬ (AoE 1 Wild Steppe Horses - 3 con thanh thoát, bờm bay trong gió) */
  private drawWildHorseHerd(
    sx: number,
    sy: number,
    pxPerMeter: number,
    TILT_Y: number,
    distToPlayerMeters: number = 99,
    beast?: DynamicBeastPack | null,
  ): void {
    const { ctx } = this;
    const u = Math.max(0.18 * this.dpr, 0.38 * pxPerMeter);
    if (u < 0.03) return;

    this.drawBeastAggroWarning(sx, sy, u * 2.2, distToPlayerMeters, 'Ngựa Hoang', '🐎', beast);

    ctx.save();
    ctx.translate(sx, sy);

    const horses = [
      { ox: 1 * u, oy: -1 * u, scale: 1.05, isGrazing: false, color: '#78350f', mane: '#1c1917' },
      { ox: -12 * u, oy: 4 * u, scale: 0.95, isGrazing: true, color: '#9a3412', mane: '#020617' },
      { ox: 11 * u, oy: 5 * u, scale: 0.90, isGrazing: false, color: '#451a03', mane: '#0f172a' },
    ];

    for (const h of horses) {
      const dx = h.ox;
      const dy = h.oy;
      const s = u * h.scale;

      // 1. Bóng đổ
      ctx.fillStyle = 'rgba(15, 25, 10, 0.40)';
      ctx.beginPath();
      ctx.ellipse(dx + 1.5 * s, dy + 7 * s, 8 * s, 3.2 * s, 0.12, 0, Math.PI * 2);
      ctx.fill();

      // 2. 4 Chân ngựa thon chắc
      ctx.strokeStyle = '#3d1d06';
      ctx.lineWidth = Math.max(1.1 * this.dpr, 1.0 * s);
      ctx.beginPath();
      ctx.moveTo(dx - 4 * s, dy + 1.5 * s); ctx.lineTo(dx - 4.5 * s, dy + 7.5 * s);
      ctx.moveTo(dx - 1.8 * s, dy + 1.5 * s); ctx.lineTo(dx - 1.8 * s, dy + 8 * s);
      ctx.moveTo(dx + 3.2 * s, dy + 1.5 * s); ctx.lineTo(dx + 3.2 * s, dy + 8 * s);
      ctx.moveTo(dx + 5.5 * s, dy + 1.5 * s); ctx.lineTo(dx + 6 * s, dy + 7.5 * s);
      ctx.stroke();

      // 3. Thân ngựa bóng mượt
      const horseGrad = ctx.createLinearGradient(dx - 6 * s, dy - 3.5 * s, dx + 6 * s, dy + 3.5 * s);
      horseGrad.addColorStop(0, h.color);
      horseGrad.addColorStop(0.5, '#b45309');
      horseGrad.addColorStop(1, '#451a03');
      ctx.fillStyle = horseGrad;
      ctx.beginPath();
      ctx.ellipse(dx, dy, 6.8 * s, 4.2 * s, -0.08, 0, Math.PI * 2);
      ctx.fill();

      // Đuôi ngựa đen
      const tailWave = Math.sin(this.tick * 0.1 + dx) * 1.5 * s;
      ctx.strokeStyle = h.mane;
      ctx.lineWidth = 1.8 * s;
      ctx.beginPath();
      ctx.moveTo(dx - 6.5 * s, dy - 0.5 * s);
      ctx.quadraticCurveTo(dx - 10 * s, dy + 1.5 * s, dx - 9 * s + tailWave, dy + 7.5 * s);
      ctx.stroke();

      // 4. Cổ & Đầu ngựa
      if (h.isGrazing) {
        ctx.fillStyle = h.color;
        ctx.beginPath();
        ctx.ellipse(dx + 6.5 * s, dy + 4.5 * s, 3.2 * s, 1.8 * s, 0.7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = h.color;
        ctx.beginPath();
        ctx.moveTo(dx + 3 * s, dy - 1.2 * s);
        ctx.lineTo(dx + 6.5 * s, dy - 7.5 * s);
        ctx.lineTo(dx + 9.5 * s, dy - 6.5 * s);
        ctx.lineTo(dx + 6 * s, dy + 1 * s);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(dx + 9 * s, dy - 7.8 * s, 2.8 * s, 1.8 * s, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Mắt đen
        ctx.fillStyle = '#020617';
        ctx.beginPath();
        ctx.arc(dx + 9.8 * s, dy - 8.2 * s, 0.6 * s, 0, Math.PI * 2);
        ctx.fill();

        // Bờm đen
        ctx.strokeStyle = h.mane;
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath();
        ctx.moveTo(dx + 3.5 * s, dy - 0.8 * s);
        ctx.lineTo(dx + 6.5 * s, dy - 8.5 * s);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // ================================================================
  // CÁC HÀM VẼ KHỦNG LONG & THỦY QUÁI TIỀN SỬ 2.5D CHUẨN KÍCH THƯỚC ĐỜI THẬT
  // ================================================================

  /** 9. CÁ SẤU ĐẾ VƯƠNG CỔ ĐẠI (Sarcosuchus - Dài 10m, Bọc giáp gai sa khoáng, tử thần đầm lầy) */
  private drawSarcosuchus(
    sx: number,
    sy: number,
    pxPerMeter: number,
    TILT_Y: number,
    distToPlayerMeters: number = 99,
    beast?: DynamicBeastPack | null,
  ): void {
    const { ctx } = this;
    const u = Math.max(0.34 * this.dpr, 0.75 * pxPerMeter);
    if (u < 0.03) return;

    this.drawBeastAggroWarning(sx, sy, u * 1.5, distToPlayerMeters, 'Cá Sấu Đế Vương', '🐊', beast);

    ctx.save();
    ctx.translate(sx, sy);

    const isAggro = distToPlayerMeters <= 24;
    const swimSway = Math.sin(this.tick * 0.14) * 2.2 * u;

    // 1. Vệt nước rẽ sóng gợn sóng đầm lầy
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.38)';
    ctx.lineWidth = 1.6 * this.dpr;
    ctx.beginPath();
    ctx.ellipse(0, 3 * u, 22 * u, 7.5 * u, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Bóng đổ thuôn dài dưới bụng
    ctx.fillStyle = 'rgba(10, 20, 15, 0.50)';
    ctx.beginPath();
    ctx.ellipse(0, 4.5 * u, 18 * u, 5.2 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. 4 Chân bò xòe rộng với móng vuốt bám bùn
    ctx.fillStyle = '#162414';
    // Chân trước trái & phải
    ctx.beginPath();
    ctx.ellipse(-7.5 * u, -2 * u, 3.8 * u, 1.8 * u, -0.4, 0, Math.PI * 2);
    ctx.ellipse(7.5 * u, -2 * u, 3.8 * u, 1.8 * u, 0.4, 0, Math.PI * 2);
    // Chân sau trái & phải
    ctx.ellipse(-8.5 * u, 3.5 * u, 4.2 * u, 2.0 * u, -0.6, 0, Math.PI * 2);
    ctx.ellipse(8.5 * u, 3.5 * u, 4.2 * u, 2.0 * u, 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Móng vuốt chân trắng ngà
    ctx.fillStyle = '#fef08a';
    for (const fx of [-9, 9]) {
      ctx.beginPath();
      ctx.arc(fx * u, -2 * u, 0.5 * u, 0, Math.PI * 2);
      ctx.arc(fx * u * 1.1, 4 * u, 0.5 * u, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Đuôi cá sấu khổng lồ uốn lượn có vây gai kép
    ctx.strokeStyle = '#23331c';
    ctx.lineWidth = 4.5 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 4.5 * u);
    ctx.quadraticCurveTo(-4.2 * u + swimSway, 10.5 * u, -2.0 * u - swimSway, 18 * u);
    ctx.stroke();

    // 5. Thân mình vảy giáp rêu sẫm đa tầng
    const crocGrad = ctx.createLinearGradient(-6 * u, 0, 6 * u, 0);
    crocGrad.addColorStop(0, '#142012');
    crocGrad.addColorStop(0.3, '#2a3d24');
    crocGrad.addColorStop(0.7, '#3e5834');
    crocGrad.addColorStop(1, '#142012');
    ctx.fillStyle = crocGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6.5 * u, 10 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hàng gai sống lưng kép 3D sắc nhọn
    ctx.fillStyle = '#0a1208';
    for (let gy = -6; gy <= 6; gy += 2.2) {
      ctx.beginPath();
      ctx.moveTo(-1.8 * u, gy * u); ctx.lineTo(-3.2 * u, gy * u - 1.2 * u); ctx.lineTo(-1.8 * u, gy * u + 1.2 * u);
      ctx.moveTo(1.8 * u, gy * u); ctx.lineTo(3.2 * u, gy * u - 1.2 * u); ctx.lineTo(1.8 * u, gy * u + 1.2 * u);
      ctx.fill();
    }

    // 6. Đầu & Mõm cá sấu khổng lồ (Dài 1.6m đặc trưng với bướu mũi tròn)
    ctx.fillStyle = '#22331c';
    ctx.beginPath();
    ctx.moveTo(-4.2 * u, -6 * u);
    ctx.lineTo(-1.2 * u, -16 * u);
    ctx.quadraticCurveTo(0, -18 * u, 1.2 * u, -16 * u); // Bướu mũi tròn
    ctx.lineTo(4.2 * u, -6 * u);
    ctx.closePath();
    ctx.fill();

    // Răng nanh lởm chởm so le trắng ngà
    ctx.fillStyle = '#ffffff';
    for (let ry = -14; ry <= -7; ry += 2.2) {
      ctx.fillRect(-2.2 * u, ry * u, 0.7 * u, 1.3 * u);
      ctx.fillRect(1.5 * u, ry * u, 0.7 * u, 1.3 * u);
    }

    // Cặp mắt lồi vàng hổ phách rực sáng
    ctx.fillStyle = isAggro ? '#ef4444' : '#f59e0b';
    ctx.beginPath();
    ctx.arc(-2.6 * u, -6.5 * u, 1.1 * u, 0, Math.PI * 2);
    ctx.arc(2.6 * u, -6.5 * u, 1.1 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.arc(-2.6 * u, -6.5 * u, 0.45 * u, 0, Math.PI * 2);
    ctx.arc(2.6 * u, -6.5 * u, 0.45 * u, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** 10. CỰ MÃNG XÀ ĐẦM LẦY (Titanoboa - Dài 13-14m, Trăn khổng lồ uốn lượn nhiều vòng) */
  private drawTitanoboa(
    sx: number,
    sy: number,
    pxPerMeter: number,
    TILT_Y: number,
    distToPlayerMeters: number = 99,
    beast?: DynamicBeastPack | null,
  ): void {
    const { ctx } = this;
    const u = Math.max(0.34 * this.dpr, 0.75 * pxPerMeter);
    if (u < 0.03) return;

    this.drawBeastAggroWarning(sx, sy, u * 1.5, distToPlayerMeters, 'Cự Mãng Xà', '🐍', beast);

    ctx.save();
    ctx.translate(sx, sy);

    const wave = Math.sin(this.tick * 0.12);

    // 1. Bóng đổ uốn lượn dưới đất
    ctx.fillStyle = 'rgba(12, 20, 10, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 4 * u, 18 * u, 5.8 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Thân trăn uốn khúc liên hoàn nhiều tầng
    const bodyPoints = [
      { x: -14 * u, y: 8 * u, r: 2.8 * u },
      { x: -8 * u + wave * 2 * u, y: 11 * u, r: 3.8 * u },
      { x: 0, y: 6 * u, r: 5.0 * u },
      { x: 8 * u - wave * 2 * u, y: 10 * u, r: 4.6 * u },
      { x: 14 * u, y: 4 * u, r: 4.4 * u },
      { x: 8 * u + wave * 2 * u, y: -2 * u, r: 4.2 * u },
      { x: -1.8 * u, y: -3.8 * u, r: 4.0 * u },
      { x: -8 * u - wave * 2 * u, y: -9.5 * u, r: 3.6 * u }, // Cổ ngẩng
    ];

    for (let i = 0; i < bodyPoints.length; i++) {
      const p = bodyPoints[i];
      const grad = ctx.createRadialGradient(p.x, p.y, p.r * 0.2, p.x, p.y, p.r);
      grad.addColorStop(0, '#10b981');
      grad.addColorStop(0.5, '#047857');
      grad.addColorStop(0.85, '#064e3b');
      grad.addColorStop(1, '#022c22');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();

      // Hoa văn đốm vảy vàng ánh kim (Diamond Scale Patterns)
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r * 0.45, p.r * 0.22, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Đầu Cự Mãng Xà ngẩng cao
    const headX = -8 * u - wave * 2 * u;
    const headY = -13.5 * u;
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.moveTo(headX, headY + 2.8 * u);
    ctx.lineTo(headX - 3.8 * u, headY - 2 * u);
    ctx.lineTo(headX, headY - 6.8 * u); // Chóp mũi
    ctx.lineTo(headX + 3.8 * u, headY - 2 * u);
    ctx.closePath();
    ctx.fill();

    // Mắt đỏ rực & Lưỡi chẻ đỏ
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(headX - 2.2 * u, headY - 2.8 * u, 0.95 * u, 0, Math.PI * 2);
    ctx.arc(headX + 2.2 * u, headY - 2.8 * u, 0.95 * u, 0, Math.PI * 2);
    ctx.fill();

    // Lưỡi chẻ thò thụt
    const tongueOut = (Math.sin(this.tick * 0.3) > 0.4);
    if (tongueOut) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.3 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(headX, headY - 6.8 * u);
      ctx.lineTo(headX, headY - 11 * u);
      ctx.lineTo(headX - 1.4 * u, headY - 12.5 * u);
      ctx.moveTo(headX, headY - 11 * u);
      ctx.lineTo(headX + 1.4 * u, headY - 12.5 * u);
      ctx.stroke();
    }

    ctx.restore();
  }

  /** 11. THỦY LONG CỔ DÀI (Plesiosaur - Dài 12m, Thủy quái Hồ Tây lướt 4 vây chèo) */
  private drawPlesiosaur(
    sx: number,
    sy: number,
    pxPerMeter: number,
    TILT_Y: number,
    distToPlayerMeters: number = 99,
    beast?: DynamicBeastPack | null,
  ): void {
    const { ctx } = this;
    const u = Math.max(0.38 * this.dpr, 0.82 * pxPerMeter);
    if (u < 0.03) return;

    this.drawBeastAggroWarning(sx, sy, u * 1.6, distToPlayerMeters, 'Thủy Long Hồ Tây', '🐉', beast);

    ctx.save();
    ctx.translate(sx, sy);

    const flipperWave = Math.sin(this.tick * 0.15) * 2.8 * u;

    // 1. Vòng gợn bọt nước xanh ngọc lấp lánh
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1.8 * this.dpr;
    ctx.beginPath();
    ctx.ellipse(0, 3.5 * u, 22 * u, 9.5 * u, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 2. 4 Vây chèo bơi nhịp nhàng
    ctx.fillStyle = '#0369a1';
    ctx.beginPath();
    ctx.ellipse(-11 * u, -1.8 * u + flipperWave, 6.5 * u, 2.8 * u, -0.6, 0, Math.PI * 2);
    ctx.ellipse(11 * u, -1.8 * u - flipperWave, 6.5 * u, 2.8 * u, 0.6, 0, Math.PI * 2);
    ctx.ellipse(-9.5 * u, 7.5 * u - flipperWave, 4.8 * u, 2.2 * u, -0.4, 0, Math.PI * 2);
    ctx.ellipse(9.5 * u, 7.5 * u + flipperWave, 4.8 * u, 2.2 * u, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // 3. Thân tròn thuôn màu xanh lam đại dương
    const bodyGrad = ctx.createRadialGradient(0, 2 * u, 2 * u, 0, 2 * u, 10 * u);
    bodyGrad.addColorStop(0, '#38bdf8');
    bodyGrad.addColorStop(0.6, '#0284c7');
    bodyGrad.addColorStop(1, '#0c4a6e');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 2.5 * u, 8.5 * u, 11 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    // Đuôi nhọn rẽ nước
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 3.6 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 11 * u);
    ctx.quadraticCurveTo(flipperWave * 0.8, 16 * u, -flipperWave * 0.8, 22 * u);
    ctx.stroke();

    // 4. Chiếc Cổ Dài Vươn Cao Uốn Lượn Sừng Sững
    const neckSway = Math.sin(this.tick * 0.08) * 2.2 * u;
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 3.2 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -5.5 * u);
    ctx.bezierCurveTo(neckSway, -13 * u, -neckSway, -20 * u, 2.0 * u, -26 * u);
    ctx.stroke();

    // Đầu thon nhỏ & Mắt sáng
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.ellipse(2.0 * u, -26 * u, 2.6 * u, 1.6 * u, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(3.2 * u, -26.5 * u, 0.65 * u, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** 12. BẠO CHÚA HOÀNG CỔ (T-Rex — Dài 12.5m, Cao 4.5m, Đại Chúa Tể Ăn Thịt Tối Thượng) */
  private drawTRex(
    sx: number,
    sy: number,
    pxPerMeter: number,
    TILT_Y: number,
    distToPlayerMeters: number = 99,
    beast?: DynamicBeastPack | null,
  ): void {
    const { ctx } = this;
    const u = Math.max(0.42 * this.dpr, 0.92 * pxPerMeter);
    if (u < 0.03) return;

    this.drawBeastAggroWarning(sx, sy, u * 1.8, distToPlayerMeters, 'Bạo Chúa T-Rex', '🦖', beast);

    ctx.save();
    ctx.translate(sx, sy);

    const isAggro = distToPlayerMeters <= 28;
    const stompShake = Math.sin(this.tick * 0.25) * 1.4 * u;

    // 1. Bóng đổ oai vệ khổng lồ
    ctx.fillStyle = 'rgba(20, 10, 8, 0.52)';
    ctx.beginPath();
    ctx.ellipse(2 * u, 9.5 * u, 16 * u, 6.5 * u, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // 2. Chân sau cơ bắp vạm vỡ gân guốc
    ctx.fillStyle = '#450a0a';
    ctx.beginPath();
    ctx.ellipse(-5 * u, 1 * u, 5.2 * u, 3.8 * u, -0.4, 0, Math.PI * 2);
    ctx.ellipse(5 * u, 1 * u, 5.2 * u, 3.8 * u, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Cẳng chân & Móng vuốt đen tuyền
    ctx.strokeStyle = '#2a0808';
    ctx.lineWidth = 2.8 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5 * u, 3.8 * u); ctx.lineTo(-6 * u, 10 * u + stompShake);
    ctx.moveTo(5 * u, 3.8 * u); ctx.lineTo(6 * u, 10 * u - stompShake);
    ctx.stroke();

    // 3 Móng vuốt chân sắc nhọn
    ctx.fillStyle = '#fef08a';
    for (const cx of [-6, 6]) {
      const fy = 10 * u + (cx < 0 ? stompShake : -stompShake);
      ctx.beginPath();
      ctx.moveTo(cx * u - 2 * u, fy); ctx.lineTo(cx * u - 2.8 * u, fy + 2.2 * u); ctx.lineTo(cx * u - 1 * u, fy + 2.2 * u);
      ctx.moveTo(cx * u, fy); ctx.lineTo(cx * u, fy + 2.8 * u); ctx.lineTo(cx * u + 1.4 * u, fy + 2.8 * u);
      ctx.moveTo(cx * u + 2 * u, fy); ctx.lineTo(cx * u + 2.8 * u, fy + 2.2 * u); ctx.lineTo(cx * u + 1 * u, fy + 2.2 * u);
      ctx.fill();
    }

    // 3. Đuôi dài cơ bắp cân bằng trọng tâm lắc lư
    const tailWave = Math.sin(this.tick * 0.1) * 3.0 * u;
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 5.0 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-4 * u, 1.8 * u);
    ctx.quadraticCurveTo(-13 * u, 4.5 * u, -20 * u + tailWave, 7.2 * u);
    ctx.stroke();

    // 4. Thân mình đồ sộ sọc vằn đỏ hung pha cam lửa & bụng sáng
    const bodyGrad = ctx.createRadialGradient(0, -1.8 * u, 2.8 * u, 0, 0, 12 * u);
    bodyGrad.addColorStop(0, '#ea580c');
    bodyGrad.addColorStop(0.5, '#dc2626');
    bodyGrad.addColorStop(0.85, '#991b1b');
    bodyGrad.addColorStop(1, '#450a0a');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8.8 * u, 6.8 * u, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Vằn lưng sẫm màu
    ctx.strokeStyle = '#2b0808';
    ctx.lineWidth = 1.4 * u;
    ctx.beginPath();
    ctx.moveTo(-4 * u, -4 * u); ctx.lineTo(-2 * u, 0);
    ctx.moveTo(0, -5 * u); ctx.lineTo(1.5 * u, -1 * u);
    ctx.moveTo(3 * u, -4.5 * u); ctx.lineTo(4.5 * u, 0);
    ctx.stroke();

    // 5. Hai chi trước nhỏ đặc trưng
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 1.4 * u;
    ctx.beginPath();
    ctx.moveTo(3.8 * u, -1.6 * u); ctx.lineTo(6.5 * u, 1.2 * u); ctx.lineTo(5.5 * u, 2.2 * u);
    ctx.stroke();

    // 6. Đầu Bạo Chúa Khổng Lồ & Hàm Răng Dao Găm
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.moveTo(2.8 * u, -3.8 * u);
    ctx.lineTo(11 * u, -8.2 * u); // Đỉnh đầu
    ctx.lineTo(14.8 * u, -5.5 * u); // Mõm trên
    ctx.lineTo(10.5 * u, -1.8 * u); // Hàm dưới
    ctx.lineTo(3.8 * u, 1.2 * u);
    ctx.closePath();
    ctx.fill();

    // Răng nanh sắc nhọn
    ctx.fillStyle = '#ffffff';
    for (let rx = 10.5; rx <= 14.2; rx += 1.6) {
      ctx.fillRect(rx * u, -6 * u, 0.75 * u, 1.8 * u);
    }

    // Mắt đỏ ngầu rực lửa với con ngươi dọc
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(10.8 * u, -7.5 * u, 1.1 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.arc(11.0 * u, -7.5 * u, 0.55 * u, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** 13. BẦY NHẠN LONG TỐC ĐỘ (Velociraptor Pack - Dài 2m, Nhanh như chớp, vuốt liềm) */
  private drawVelociraptorPack(
    sx: number,
    sy: number,
    pxPerMeter: number,
    TILT_Y: number,
    distToPlayerMeters: number = 99,
    beast?: DynamicBeastPack | null,
  ): void {
    const { ctx } = this;
    const u = Math.max(0.20 * this.dpr, 0.44 * pxPerMeter);
    if (u < 0.03) return;

    this.drawBeastAggroWarning(sx, sy, u * 1.8, distToPlayerMeters, 'Bầy Nhạn Long', '🦖', beast);

    ctx.save();
    ctx.translate(sx, sy);

    const raptors = [
      { ox: 2.8 * u, oy: -1.6 * u, scale: 1.05, color: '#15803d' },
      { ox: -7.0 * u, oy: 3.2 * u, scale: 0.92, color: '#166534' },
    ];

    for (const r of raptors) {
      const dx = r.ox;
      const dy = r.oy;
      const s = u * r.scale;
      const runCycle = Math.sin(this.tick * 0.35 + dx) * 1.8 * s;

      // Bóng đổ
      ctx.fillStyle = 'rgba(15, 25, 10, 0.42)';
      ctx.beginPath();
      ctx.ellipse(dx + 1 * s, dy + 6.5 * s, 7 * s, 2.6 * s, 0.1, 0, Math.PI * 2);
      ctx.fill();

      // Đuôi thẳng dài giữ thăng bằng
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2.2 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(dx - 2.8 * s, dy);
      ctx.lineTo(dx - 12 * s, dy - 1.6 * s + runCycle * 0.5);
      ctx.stroke();

      // Chân sau chạy nhanh & Móng vuốt lưỡi liềm co cao
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 1.6 * s;
      ctx.beginPath();
      ctx.moveTo(dx - 0.9 * s, dy + 0.9 * s); ctx.lineTo(dx - 1.8 * s, dy + 6.2 * s + runCycle);
      ctx.moveTo(dx + 1.8 * s, dy + 0.9 * s); ctx.lineTo(dx + 2.6 * s, dy + 6.2 * s - runCycle);
      ctx.stroke();

      // Thân thon thả
      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.ellipse(dx, dy, 4.8 * s, 2.8 * s, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // Cánh tay có lông vũ
      ctx.fillStyle = '#86efac';
      ctx.beginPath();
      ctx.moveTo(dx + 1.8 * s, dy); ctx.lineTo(dx + 4.4 * s, dy + 1.8 * s); ctx.lineTo(dx + 2.6 * s, dy + 2.6 * s);
      ctx.closePath();
      ctx.fill();

      // Đầu & Mõm nhọn
      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.moveTo(dx + 1.8 * s, dy - 1.3 * s);
      ctx.lineTo(dx + 7.2 * s, dy - 4.4 * s);
      ctx.lineTo(dx + 8.8 * s, dy - 2.6 * s);
      ctx.lineTo(dx + 3.5 * s, dy + 0.9 * s);
      ctx.closePath();
      ctx.fill();

      // Mắt vàng
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(dx + 6.6 * s, dy - 3.9 * s, 0.65 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /** 14. KHỦNG LONG CÁNH BUỒM (Spinosaurus - Dài 15m, Cánh buồm lửa rực rỡ dọc sống lưng) */
  private drawSpinosaurus(
    sx: number,
    sy: number,
    pxPerMeter: number,
    TILT_Y: number,
    distToPlayerMeters: number = 99,
    beast?: DynamicBeastPack | null,
  ): void {
    const { ctx } = this;
    const u = Math.max(0.42 * this.dpr, 0.92 * pxPerMeter);
    if (u < 0.03) return;

    this.drawBeastAggroWarning(sx, sy, u * 1.8, distToPlayerMeters, 'Khủng Long Cánh Buồm', '🐊', beast);

    ctx.save();
    ctx.translate(sx, sy);

    // 1. Bóng đổ
    ctx.fillStyle = 'rgba(25, 15, 10, 0.48)';
    ctx.beginPath();
    ctx.ellipse(1 * u, 7.5 * u, 15 * u, 5.5 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. 4 Chân cơ bắp
    ctx.fillStyle = '#7c2d12';
    for (const lx of [-5.5, -1.8, 3.8, 7.5]) {
      ctx.fillRect(lx * u, 2 * u, 2.4 * u, 6.8 * u);
    }

    // 3. Đuôi dài bơi lội
    ctx.strokeStyle = '#9a3412';
    ctx.lineWidth = 4.0 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-3.8 * u, 2 * u);
    ctx.quadraticCurveTo(-11 * u, 3.8 * u, -16.5 * u, 8.2 * u);
    ctx.stroke();

    // 4. Thân mình
    ctx.fillStyle = '#c2410c';
    ctx.beginPath();
    ctx.ellipse(0, 0.9 * u, 7.8 * u, 5.5 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    // 5. CÁNH BUỒM VÂY GAI CAO VÚT RỰC RỠ TRÊN LƯNG (Iconic Sail)
    const sailGrad = ctx.createLinearGradient(0, 0, 0, -15 * u);
    sailGrad.addColorStop(0, '#c2410c');
    sailGrad.addColorStop(0.5, '#ea580c');
    sailGrad.addColorStop(0.85, '#f59e0b');
    sailGrad.addColorStop(1, '#fef08a');
    ctx.fillStyle = sailGrad;
    ctx.beginPath();
    ctx.moveTo(-5.5 * u, -2.8 * u);
    ctx.quadraticCurveTo(0, -16.5 * u, 5.5 * u, -2.8 * u);
    ctx.closePath();
    ctx.fill();

    // Các nan gai xương của buồm
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 1.1 * u;
    for (let sx = -4; sx <= 4; sx += 2) {
      ctx.beginPath();
      ctx.moveTo(sx * u, -2.8 * u);
      ctx.lineTo(sx * u * 0.8, -13.8 * u + Math.abs(sx) * 1.8 * u);
      ctx.stroke();
    }

    // 6. Đầu mõm dài như cá sấu
    ctx.fillStyle = '#9a3412';
    ctx.beginPath();
    ctx.moveTo(3.8 * u, -2 * u);
    ctx.lineTo(12.5 * u, -4.6 * u);
    ctx.lineTo(12.5 * u, -2.8 * u);
    ctx.lineTo(4.6 * u, 2 * u);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(8.2 * u, -4.2 * u, 0.75 * u, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** 15. SONG MÀO PHUN ĐỘC (Dilophosaurus - Dài 7m, 2 Mào kép sặc sỡ & Xòe mang đe dọa) */
  private drawDilophosaurus(
    sx: number,
    sy: number,
    pxPerMeter: number,
    TILT_Y: number,
    distToPlayerMeters: number = 99,
    beast?: DynamicBeastPack | null,
  ): void {
    const { ctx } = this;
    const u = Math.max(0.26 * this.dpr, 0.58 * pxPerMeter);
    if (u < 0.03) return;

    this.drawBeastAggroWarning(sx, sy, u * 1.8, distToPlayerMeters, 'Song Mào Phun Độc', '🦎', beast);

    ctx.save();
    ctx.translate(sx, sy);

    const isAggro = distToPlayerMeters <= 22;

    // 1. Bóng đổ
    ctx.fillStyle = 'rgba(20, 25, 15, 0.42)';
    ctx.beginPath();
    ctx.ellipse(0, 5.5 * u, 8.2 * u, 3.2 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Chân sau
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 1.8 * u;
    ctx.beginPath();
    ctx.moveTo(-1.8 * u, 0.9 * u); ctx.lineTo(-2.6 * u, 6.0 * u);
    ctx.moveTo(1.8 * u, 0.9 * u); ctx.lineTo(2.6 * u, 6.0 * u);
    ctx.stroke();

    // 3. Đuôi & Thân
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.6 * u;
    ctx.beginPath();
    ctx.moveTo(-2.8 * u, 0); ctx.lineTo(-11 * u, 0.9 * u);
    ctx.stroke();

    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.ellipse(0, 0, 5.0 * u, 3.2 * u, -0.15, 0, Math.PI * 2);
    ctx.fill();

    // 4. Mang cổ xòe rực rỡ khi Aggro (Frill)
    if (isAggro) {
      const frillGrad = ctx.createRadialGradient(3.5 * u, -3.5 * u, 0.9 * u, 3.5 * u, -3.5 * u, 6.0 * u);
      frillGrad.addColorStop(0, '#fde047');
      frillGrad.addColorStop(0.6, '#ea580c');
      frillGrad.addColorStop(1, '#dc2626');
      ctx.fillStyle = frillGrad;
      ctx.beginPath();
      ctx.arc(3.5 * u, -3.5 * u, 6.0 * u, -Math.PI / 2, Math.PI / 2);
      ctx.fill();
    }

    // 5. Đầu & SONG MÀO BÁN NGUYỆT KÉP (Double Crests)
    ctx.fillStyle = '#1d4ed8';
    ctx.beginPath();
    ctx.moveTo(1.8 * u, -1.8 * u);
    ctx.lineTo(7.0 * u, -5.5 * u);
    ctx.lineTo(8.2 * u, -2.8 * u);
    ctx.lineTo(3.5 * u, 0.9 * u);
    ctx.closePath();
    ctx.fill();

    // 2 Mào đỏ tím rực rỡ trên đỉnh đầu
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.ellipse(4.8 * u, -7.6 * u, 2.8 * u, 1.2 * u, 0.4, 0, Math.PI * 2);
    ctx.ellipse(6.8 * u, -7.0 * u, 2.4 * u, 1.1 * u, 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(6.0 * u, -4.6 * u, 0.65 * u, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** 16. KHỦNG LONG BA SỪNG (Triceratops — Dài 9m, Yếm cổ khiên chắn & 3 Sừng nhọn) */
  private drawTriceratops(
    sx: number,
    sy: number,
    pxPerMeter: number,
    TILT_Y: number,
    distToPlayerMeters: number = 99,
    beast?: DynamicBeastPack | null,
  ): void {
    const { ctx } = this;
    const u = Math.max(0.34 * this.dpr, 0.75 * pxPerMeter);
    if (u < 0.03) return;

    this.drawBeastAggroWarning(sx, sy, u * 1.6, distToPlayerMeters, 'Khủng Long Ba Sừng', '🦏', beast);

    ctx.save();
    ctx.translate(sx, sy);

    // 1. Bóng đổ
    ctx.fillStyle = 'rgba(30, 20, 10, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 6.5 * u, 12 * u, 4.6 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. 4 Chân cột vững chãi
    ctx.fillStyle = '#573016';
    for (const lx of [-5.5, -2.0, 2.8, 6.2]) {
      ctx.fillRect(lx * u, 2 * u, 2.5 * u, 6.0 * u);
    }

    // 3. Thân mình đồ sộ bọc vảy nâu sẫm
    const bodyGrad = ctx.createRadialGradient(0, 0, 2 * u, 0, 0, 9.2 * u);
    bodyGrad.addColorStop(0, '#92400e');
    bodyGrad.addColorStop(0.7, '#78350f');
    bodyGrad.addColorStop(1, '#451a03');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(-0.9 * u, 0, 7.8 * u, 6.0 * u, -0.05, 0, Math.PI * 2);
    ctx.fill();

    // Đuôi ngắn nhọn
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.8 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-7 * u, 0); ctx.lineTo(-12.5 * u, 3.5 * u);
    ctx.stroke();

    // 4. TẤM YẾM CỔ KHIÊN XƯƠNG (Shield Frill)
    ctx.fillStyle = '#b45309';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.1 * u;
    ctx.beginPath();
    ctx.arc(4.6 * u, -2.8 * u, 6.0 * u, -Math.PI / 2, Math.PI / 2, true);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 5. Đầu & Mõm mỏ vẹt
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.ellipse(6.8 * u, -0.9 * u, 3.6 * u, 2.7 * u, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // 6. BA CHIẾC SỪNG TRẮNG NGÀ (3 Iconic Horns)
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.0 * u;
    ctx.lineCap = 'round';
    // 2 Sừng trán dài cong
    ctx.beginPath();
    ctx.moveTo(5.5 * u, -3.5 * u); ctx.lineTo(11 * u, -8.2 * u);
    ctx.moveTo(6.8 * u, -2.8 * u); ctx.lineTo(12.2 * u, -7.5 * u);
    // 1 Sừng mũi ngắn
    ctx.moveTo(9.5 * u, -1.3 * u); ctx.lineTo(12.2 * u, -2.8 * u);
    ctx.stroke();

    // Mắt
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.arc(6.2 * u, -2.2 * u, 0.7 * u, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** 17. KHỦNG LONG THIẾT GIÁP (Ankylosaurus — Dài 8m, Mai giáp gai & Chùy đuôi đập nát) */
  private drawAnkylosaurus(
    sx: number,
    sy: number,
    pxPerMeter: number,
    TILT_Y: number,
    distToPlayerMeters: number = 99,
    beast?: DynamicBeastPack | null,
  ): void {
    const { ctx } = this;
    const u = Math.max(0.32 * this.dpr, 0.70 * pxPerMeter);
    if (u < 0.03) return;

    this.drawBeastAggroWarning(sx, sy, u * 1.5, distToPlayerMeters, 'Khủng Long Thiết Giáp', '🐢', beast);

    ctx.save();
    ctx.translate(sx, sy);

    const clubSway = Math.sin(this.tick * 0.16) * 2.8 * u;

    // 1. Bóng đổ bè rộng
    ctx.fillStyle = 'rgba(25, 25, 20, 0.42)';
    ctx.beginPath();
    ctx.ellipse(0, 5.5 * u, 13 * u, 5.5 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. 4 Chân ngắn bè
    ctx.fillStyle = '#292524';
    for (const lx of [-5.5, -2.0, 2.8, 6.2]) {
      ctx.fillRect(lx * u, 2 * u, 2.8 * u, 4.6 * u);
    }

    // 3. ĐUÔI VÀ KHỐI CHÙY XƯƠNG NẶNG NỀ (Tail Club)
    ctx.strokeStyle = '#44403c';
    ctx.lineWidth = 2.8 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5.5 * u, 0); ctx.lineTo(-13 * u + clubSway, 1.8 * u);
    ctx.stroke();

    // Khối chùy tròn ở chóp đuôi
    ctx.fillStyle = '#78716c';
    ctx.beginPath();
    ctx.arc(-13.8 * u + clubSway, 1.8 * u, 2.8 * u, 0, Math.PI * 2);
    ctx.fill();

    // 4. MAI GIÁP PHỦ KÍN GAI ĐÁ XÁM ĐEN (Armored Shell)
    const armorGrad = ctx.createRadialGradient(0, 0, 2 * u, 0, 0, 9.2 * u);
    armorGrad.addColorStop(0, '#57534e');
    armorGrad.addColorStop(0.7, '#292524');
    armorGrad.addColorStop(1, '#0c0a09');
    ctx.fillStyle = armorGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7.8 * u, 6.2 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    // Các gai nhọn nhô lên trên lưng giáp
    ctx.fillStyle = '#d6d3d1';
    for (let gx = -4.5; gx <= 4.5; gx += 2.2) {
      for (let gy = -2.8; gy <= 2.8; gy += 2.8) {
        ctx.beginPath();
        ctx.moveTo(gx * u, gy * u);
        ctx.lineTo(gx * u - 0.9 * u, gy * u - 2.2 * u);
        ctx.lineTo(gx * u + 0.9 * u, gy * u - 2.2 * u);
        ctx.fill();
      }
    }

    // 5. Đầu bọc giáp giác đấu
    ctx.fillStyle = '#44403c';
    ctx.beginPath();
    ctx.ellipse(6.8 * u, 0, 3.2 * u, 2.3 * u, 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** 18. KHỦNG LONG CỔ DÀI VĨ ĐẠI (Brachiosaurus — Dài 28m, Cao 14m, Đại Thần Thú Chọc Trời) */
  private drawBrachiosaurus(
    sx: number,
    sy: number,
    pxPerMeter: number,
    TILT_Y: number,
    distToPlayerMeters: number = 99,
    beast?: DynamicBeastPack | null,
  ): void {
    const { ctx } = this;
    const u = Math.max(0.52 * this.dpr, 1.18 * pxPerMeter);
    if (u < 0.03) return;

    this.drawBeastAggroWarning(sx, sy, u * 1.8, distToPlayerMeters, 'Khủng Long Cổ Dài', '🦕', beast);

    ctx.save();
    ctx.translate(sx, sy);

    // 1. Bóng đổ khổng lồ
    ctx.fillStyle = 'rgba(20, 25, 15, 0.48)';
    ctx.beginPath();
    ctx.ellipse(2 * u, 11 * u, 18 * u, 7.2 * u, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // 2. 4 Chân Cột Đình khổng lồ
    ctx.fillStyle = '#1e293b';
    for (const lx of [-7.2, -2.8, 3.5, 8.2]) {
      ctx.fillRect(lx * u, 3.5 * u, 3.5 * u, 8.2 * u);
    }

    // 3. Đuôi dài rủ sau
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4.2 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-7.2 * u, 2 * u);
    ctx.quadraticCurveTo(-15.5 * u, 5.5 * u, -23 * u, 10.5 * u);
    ctx.stroke();

    // 4. Thân mình đồ sộ màu xanh xám rêu
    const bodyGrad = ctx.createRadialGradient(0, 0, 2.8 * u, 0, 0, 12 * u);
    bodyGrad.addColorStop(0, '#475569');
    bodyGrad.addColorStop(0.7, '#334155');
    bodyGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10 * u, 7.8 * u, -0.12, 0, Math.PI * 2);
    ctx.fill();

    // 5. CHIẾC CỔ DÀI VƯƠN CAO CHỌC TRỜI SỬ THI
    const neckSway = Math.sin(this.tick * 0.06) * 2.0 * u;
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4.0 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(5.5 * u, -2.8 * u);
    ctx.bezierCurveTo(11 * u, -14 * u, 9 * u + neckSway, -25 * u, 11 * u + neckSway, -33 * u);
    ctx.stroke();

    // Đầu nhỏ trên đỉnh cổ
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.ellipse(11.5 * u + neckSway, -33 * u, 2.8 * u, 1.8 * u, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.arc(13.0 * u + neckSway, -33.4 * u, 0.55 * u, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** 19. THẰN LẰN BAY DỰC LONG (Pterosaur / Pteranodon — Sải Cánh 8m Bầu Trời) */
  private drawPterosaur(
    sx: number,
    sy: number,
    pxPerMeter: number,
    TILT_Y: number,
    distToPlayerMeters: number = 99,
    beast?: DynamicBeastPack | null,
  ): void {
    const { ctx } = this;
    const u = Math.max(0.30 * this.dpr, 0.65 * pxPerMeter);
    if (u < 0.03) return;

    this.drawBeastAggroWarning(sx, sy, u * 1.5, distToPlayerMeters, 'Dực Long Bầu Trời', '🦅', beast);

    ctx.save();
    ctx.translate(sx, sy);

    const flap = Math.sin(this.tick * 0.2) * 4.5 * u;

    // 1. Bóng râm lướt dưới mặt đất cỏ
    ctx.fillStyle = 'rgba(10, 15, 10, 0.32)';
    ctx.beginPath();
    ctx.ellipse(0, 12 * u, 14 * u, 5.5 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. ĐÔI CÁNH DA DANG RỘNG VỖ BAY TRÊN KHÔNG
    const wingGrad = ctx.createLinearGradient(-16 * u, 0, 16 * u, 0);
    wingGrad.addColorStop(0, '#ea580c');
    wingGrad.addColorStop(0.5, '#f59e0b');
    wingGrad.addColorStop(1, '#ea580c');
    ctx.fillStyle = wingGrad;

    // Cánh trái & Cánh phải
    ctx.beginPath();
    ctx.moveTo(0, -1.8 * u);
    ctx.lineTo(-16 * u, -5.2 * u + flap);
    ctx.lineTo(-5.5 * u, 3.5 * u);
    ctx.lineTo(0, 1.8 * u);
    ctx.lineTo(5.5 * u, 3.5 * u);
    ctx.lineTo(16 * u, -5.2 * u + flap);
    ctx.closePath();
    ctx.fill();

    // 3. Thân mình thon & 2 chân bám
    ctx.fillStyle = '#7c2d12';
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.0 * u, 4.0 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    // 4. MÀO SỪNG DÀI VUỐT NHỌN & MỎ DÀI (Crest & Beak)
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(0, -2.6 * u);
    ctx.lineTo(-3.5 * u, -7.8 * u); // Mào nhọn phía sau
    ctx.lineTo(0, -4.4 * u);
    ctx.lineTo(5.5 * u, -7.0 * u); // Mỏ nhọn phía trước
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /** RỪNG NGUYÊN SINH BẠT NGÀN ĐẾ CHẾ (AoE 1 Dense Volumetric Forest Grove) */
  private drawDenseForestGrove(
    sx: number,
    sy: number,
    pxPerMeter: number,
    TILT_Y: number,
    rand: number,
  ): void {
    const { ctx } = this;
    const u = Math.max(0.6 * this.dpr, 0.4 * pxPerMeter);
    if (u < 0.25) return;

    ctx.save();
    ctx.translate(sx, sy);

    const groveW = (18 + (rand * 100) % 10) * u;
    const groveH = (12 + (rand * 150) % 8) * u * TILT_Y;

    // 1. LỚP BÓNG ĐỔ KHỔNG LỒ CỦA CẢ KHỐI RỪNG (AOE 1 Canopy Ground Shadow Blanket)
    ctx.fillStyle = 'rgba(10, 24, 8, 0.45)';
    ctx.beginPath();
    ctx.ellipse(groveW * 0.25, groveH * 0.35, groveW * 1.05, groveH * 0.65, 0.15, 0, Math.PI * 2);
    ctx.fill();

    // 2. MẶT ĐẤT MÙN RỪNG ĐEN (Dark Forest Humus Soil)
    if (this.patternForestFloor) {
      ctx.fillStyle = this.patternForestFloor;
      ctx.beginPath();
      ctx.ellipse(0, 0, groveW * 0.85, groveH * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. DANH SÁCH CÁC CÂY TRONG CỤM RỪNG (Xếp tầng Depth-sorting chuẩn 2.5D từ sau ra trước)
    const treeOffsets = [
      // Hàng 1 (Hậu cảnh xa)
      { ox: -12 * u, oy: -14 * u * TILT_Y, scale: 0.9, type: 'autumn' },
      { ox: -4 * u, oy: -16 * u * TILT_Y, scale: 1.05, type: 'emerald' },
      { ox: 5 * u, oy: -15 * u * TILT_Y, scale: 0.95, type: 'pine' },
      { ox: 13 * u, oy: -13 * u * TILT_Y, scale: 0.88, type: 'emerald' },

      // Hàng 2 (Trung cảnh giữa)
      { ox: -16 * u, oy: -8 * u * TILT_Y, scale: 1.0, type: 'emerald' },
      { ox: -8 * u, oy: -9 * u * TILT_Y, scale: 1.15, type: 'autumn' },
      { ox: 0 * u, oy: -10 * u * TILT_Y, scale: 1.25, type: 'emerald' },
      { ox: 8 * u, oy: -8 * u * TILT_Y, scale: 1.1, type: 'autumn' },
      { ox: 16 * u, oy: -7 * u * TILT_Y, scale: 0.95, type: 'pine' },

      // Hàng 3 (Tiền cảnh chính)
      { ox: -14 * u, oy: -1 * u * TILT_Y, scale: 1.1, type: 'autumn' },
      { ox: -6 * u, oy: 1 * u * TILT_Y, scale: 1.2, type: 'emerald' },
      { ox: 2 * u, oy: 2 * u * TILT_Y, scale: 1.3, type: 'autumn' },
      { ox: 10 * u, oy: 0 * u * TILT_Y, scale: 1.15, type: 'emerald' },

      // Hàng 4 (Mép rừng phía Nam đón nắng)
      { ox: -9 * u, oy: 8 * u * TILT_Y, scale: 1.0, type: 'emerald' },
      { ox: -1 * u, oy: 9 * u * TILT_Y, scale: 1.1, type: 'pine' },
      { ox: 7 * u, oy: 8 * u * TILT_Y, scale: 1.05, type: 'autumn' },
    ];

    for (const tree of treeOffsets) {
      const tx = tree.ox;
      const ty = tree.oy;
      const s = u * tree.scale * 1.1;

      // Gốc & thân cây
      const trunkW = 3.2 * s;
      const trunkH = 8.5 * s * TILT_Y;
      ctx.fillStyle = '#452611';
      ctx.beginPath();
      ctx.moveTo(tx - trunkW * 0.6, ty);
      ctx.lineTo(tx + trunkW * 0.6, ty);
      ctx.lineTo(tx + trunkW * 0.35, ty - trunkH);
      ctx.lineTo(tx - trunkW * 0.35, ty - trunkH);
      ctx.closePath();
      ctx.fill();

      // Rễ cây bám đất
      ctx.strokeStyle = '#321a0a';
      ctx.lineWidth = 1.2 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(tx - trunkW * 0.6, ty - 1 * s);
      ctx.lineTo(tx - trunkW * 1.2, ty + 1.5 * s);
      ctx.moveTo(tx + trunkW * 0.6, ty - 1 * s);
      ctx.lineTo(tx + trunkW * 1.2, ty + 1.5 * s);
      ctx.stroke();

      // Tán cây đa tầng
      if (tree.type === 'autumn') {
        // Sồi lá vàng mùa thu (AoE 1 Golden Autumn Oak)
        const crownY = ty - trunkH - 6 * s;
        const cRadius = 9 * s;

        ctx.fillStyle = '#5c380b';
        ctx.beginPath();
        ctx.arc(tx, crownY + 2 * s, cRadius * 0.95, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#b57a22';
        ctx.beginPath();
        ctx.arc(tx - 4.5 * s, crownY + 1 * s, cRadius * 0.72, 0, Math.PI * 2);
        ctx.arc(tx + 4.5 * s, crownY + 1 * s, cRadius * 0.72, 0, Math.PI * 2);
        ctx.arc(tx, crownY - 3 * s, cRadius * 0.85, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#d9982f';
        ctx.beginPath();
        ctx.arc(tx - 3 * s, crownY - 1 * s, cRadius * 0.65, 0, Math.PI * 2);
        ctx.arc(tx + 2.5 * s, crownY - 2 * s, cRadius * 0.68, 0, Math.PI * 2);
        ctx.arc(tx, crownY - 5 * s, cRadius * 0.65, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(tx - 1.5 * s, crownY - 6.5 * s, cRadius * 0.38, 0, Math.PI * 2);
        ctx.fill();
      } else if (tree.type === 'pine') {
        // Thông kim 3 tầng (AoE 1 Coniferous Pine)
        const pineH = 18 * s * TILT_Y;
        const pineW = 10 * s;
        const tiers = [
          { y: ty - trunkH, w: pineW * 0.95, h: pineH * 0.35, c1: '#143d20', c2: '#286e3e' },
          { y: ty - trunkH - pineH * 0.28, w: pineW * 0.78, h: pineH * 0.32, c1: '#1b4e2b', c2: '#3aa25c' },
          { y: ty - trunkH - pineH * 0.55, w: pineW * 0.52, h: pineH * 0.30, c1: '#246137', c2: '#4ade80' },
        ];
        for (const t of tiers) {
          ctx.fillStyle = t.c1;
          ctx.beginPath();
          ctx.moveTo(tx, t.y - t.h);
          ctx.lineTo(tx - t.w / 2, t.y);
          ctx.lineTo(tx + t.w / 2, t.y);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = t.c2;
          ctx.beginPath();
          ctx.moveTo(tx, t.y - t.h);
          ctx.lineTo(tx - t.w / 2, t.y);
          ctx.lineTo(tx, t.y - t.h * 0.2);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        // Sồi xanh mướt (AoE 1 Emerald Summer Oak)
        const crownY = ty - trunkH - 6 * s;
        const cRadius = 9.5 * s;

        ctx.fillStyle = '#143d0e';
        ctx.beginPath();
        ctx.arc(tx, crownY + 2 * s, cRadius * 0.95, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#28661d';
        ctx.beginPath();
        ctx.arc(tx - 4.5 * s, crownY + 1 * s, cRadius * 0.72, 0, Math.PI * 2);
        ctx.arc(tx + 4.5 * s, crownY + 1 * s, cRadius * 0.72, 0, Math.PI * 2);
        ctx.arc(tx, crownY - 3 * s, cRadius * 0.85, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#3f882f';
        ctx.beginPath();
        ctx.arc(tx - 3 * s, crownY - 1 * s, cRadius * 0.65, 0, Math.PI * 2);
        ctx.arc(tx + 2.5 * s, crownY - 2 * s, cRadius * 0.68, 0, Math.PI * 2);
        ctx.arc(tx, crownY - 5 * s, cRadius * 0.65, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#86efac';
        ctx.beginPath();
        ctx.arc(tx - 1.5 * s, crownY - 6.5 * s, cRadius * 0.38, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 4. Bụi cây dương xỉ & dâu dại ven rừng
    const skirtBushes = [
      { ox: -16 * u, oy: 6 * u * TILT_Y, r: 4 * u },
      { ox: -8 * u, oy: 12 * u * TILT_Y, r: 5 * u },
      { ox: 6 * u, oy: 13 * u * TILT_Y, r: 4.5 * u },
      { ox: 15 * u, oy: 7 * u * TILT_Y, r: 4 * u },
    ];
    for (const b of skirtBushes) {
      ctx.fillStyle = '#1e5e26';
      ctx.beginPath();
      ctx.arc(b.ox - 2 * u, b.oy, b.r * 0.8, 0, Math.PI * 2);
      ctx.arc(b.ox + 2 * u, b.oy, b.r * 0.8, 0, Math.PI * 2);
      ctx.arc(b.ox, b.oy - 2 * u * TILT_Y, b.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(b.ox, b.oy - 2 * u * TILT_Y, b.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /** MỎ ĐÁ HOA CƯƠNG 3D ĐẾ CHẾ (AoE 1 Stone Quarry Rocks) */
  private drawAoeStoneQuarry(
    sx: number,
    sy: number,
    pxPerMeter: number,
    TILT_Y: number,
    rand: number,
  ): void {
    const { ctx } = this;
    const u = Math.max(0.6 * this.dpr, 0.4 * pxPerMeter);
    if (u < 0.25) return;

    ctx.save();
    ctx.translate(sx, sy);

    const rocks = [
      { ox: 0, oy: 0, w: 14 * u, h: 9 * u * TILT_Y, scale: 1.1 },
      { ox: -12 * u, oy: 4 * u * TILT_Y, w: 9 * u, h: 6 * u * TILT_Y, scale: 0.9 },
      { ox: 11 * u, oy: 5 * u * TILT_Y, w: 10 * u, h: 7 * u * TILT_Y, scale: 0.95 },
      { ox: 2 * u, oy: 8 * u * TILT_Y, w: 7 * u, h: 4.5 * u * TILT_Y, scale: 0.8 },
    ];

    for (const r of rocks) {
      const rx = r.ox;
      const ry = r.oy;
      const rw = r.w;
      const rh = r.h;

      // Bóng đổ
      ctx.fillStyle = 'rgba(10, 20, 10, 0.45)';
      ctx.beginPath();
      ctx.ellipse(rx + rw * 0.2, ry + rh * 0.4, rw * 0.9, rh * 0.5, 0.15, 0, Math.PI * 2);
      ctx.fill();

      // Thân đá chiseled granite
      ctx.fillStyle = '#475569';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.4 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(rx - rw * 0.5, ry);
      ctx.lineTo(rx - rw * 0.35, ry - rh * 0.9);
      ctx.lineTo(rx + rw * 0.2, ry - rh * 0.95);
      ctx.lineTo(rx + rw * 0.55, ry - rh * 0.2);
      ctx.lineTo(rx + rw * 0.4, ry + rh * 0.4);
      ctx.lineTo(rx - rw * 0.3, ry + rh * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Vát sáng đỉnh đón nắng
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(rx - rw * 0.35, ry - rh * 0.9);
      ctx.lineTo(rx + rw * 0.2, ry - rh * 0.95);
      ctx.lineTo(rx + rw * 0.15, ry - rh * 0.35);
      ctx.lineTo(rx - rw * 0.2, ry - rh * 0.3);
      ctx.closePath();
      ctx.fill();

      // Rêu phong
      ctx.fillStyle = '#4d7c1b';
      ctx.beginPath();
      ctx.ellipse(rx - rw * 0.1, ry + rh * 0.1, rw * 0.22, rh * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();

      // Viền phản quang
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.0 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(rx - rw * 0.35, ry - rh * 0.9);
      ctx.lineTo(rx + rw * 0.2, ry - rh * 0.95);
      ctx.stroke();
    }

    ctx.restore();
  }

  /** RỪNG THÔNG KIM 3 TẦNG ĐẾ CHẾ (AOE Pine Tree) */
  private drawPineTree(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, rand: number): void {
    const { ctx } = this;
    const treeH = (5.5 + rand * 3.0) * pxPerMeter * TILT_Y;
    const treeW = (3.2 + rand * 1.8) * pxPerMeter;
    if (treeH < 3.0) return;

    ctx.save();
    ctx.translate(sx, sy);

    // Bóng râm nghiêng 3D
    ctx.fillStyle = 'rgba(15, 30, 10, 0.40)';
    ctx.beginPath();
    ctx.ellipse(treeW * 0.35, treeH * 0.08, treeW * 0.75, treeH * 0.22, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Thân cây gỗ nâu
    const trunkW = Math.max(1.8 * this.dpr, treeW * 0.22);
    ctx.fillStyle = '#452a12';
    ctx.fillRect(-trunkW / 2, -treeH * 0.25, trunkW, treeH * 0.32);

    // 3 Tầng tán lá thông tam giác xếp chồng
    const tiers = [
      { y: -treeH * 0.15, w: treeW * 0.95, h: treeH * 0.35, c1: '#1b4d24', c2: '#2b7337' },
      { y: -treeH * 0.45, w: treeW * 0.75, h: treeH * 0.32, c1: '#235e2e', c2: '#388a46' },
      { y: -treeH * 0.72, w: treeW * 0.52, h: treeH * 0.30, c1: '#2d7339', c2: '#4aa65a' },
    ];

    for (const t of tiers) {
      ctx.fillStyle = t.c1;
      ctx.beginPath();
      ctx.moveTo(0, t.y - t.h);
      ctx.lineTo(-t.w / 2, t.y);
      ctx.lineTo(t.w / 2, t.y);
      ctx.closePath();
      ctx.fill();

      // Mép sáng lá thông bên trái
      ctx.fillStyle = t.c2;
      ctx.beginPath();
      ctx.moveTo(0, t.y - t.h);
      ctx.lineTo(-t.w / 2, t.y);
      ctx.lineTo(0, t.y - t.h * 0.2);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  /** CÂY SỒI CỔ THỤ TÁN TRÒN (AOE Oak Tree) */
  private drawOakTree(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, rand: number): void {
    const { ctx } = this;
    const oakH = (5.0 + rand * 3.5) * pxPerMeter * TILT_Y;
    const oakW = (4.5 + rand * 2.5) * pxPerMeter;
    if (oakH < 3.0) return;

    ctx.save();
    ctx.translate(sx, sy);

    // Bóng đổ 3D
    ctx.fillStyle = 'rgba(15, 30, 10, 0.42)';
    ctx.beginPath();
    ctx.ellipse(oakW * 0.3, oakH * 0.1, oakW * 0.8, oakH * 0.25, 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Thân cây sồi
    const trunkW = Math.max(2.2 * this.dpr, oakW * 0.24);
    ctx.fillStyle = '#543315';
    ctx.beginPath();
    ctx.moveTo(-trunkW / 2, 0);
    ctx.lineTo(trunkW / 2, 0);
    ctx.lineTo(trunkW * 0.4, -oakH * 0.35);
    ctx.lineTo(-trunkW * 0.4, -oakH * 0.35);
    ctx.closePath();
    ctx.fill();

    // Tán lá tròn 3 vòm mây xanh vàng
    const rBase = oakW * 0.35;
    ctx.fillStyle = '#225927';
    ctx.beginPath();
    ctx.arc(-oakW * 0.25, -oakH * 0.55, rBase * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d6e33';
    ctx.beginPath();
    ctx.arc(oakW * 0.25, -oakH * 0.52, rBase * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#448c3b';
    ctx.beginPath();
    ctx.arc(0, -oakH * 0.75, rBase * 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6ab848';
    ctx.beginPath();
    ctx.arc(-oakW * 0.08, -oakH * 0.82, rBase * 0.55, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** BÃI QUẢ DÂU ĐỎ MỌNG (AOE Berry Forage Bushes) */
  private drawBerryBush(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, rand: number): void {
    const { ctx } = this;
    const bushR = (2.2 + rand * 1.5) * pxPerMeter;
    if (bushR < 2.0) return;

    ctx.save();
    ctx.translate(sx, sy);

    ctx.fillStyle = 'rgba(15, 30, 10, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, bushR * 0.3, bushR * 1.2, bushR * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e5e26';
    ctx.beginPath();
    ctx.arc(-bushR * 0.45, -bushR * 0.2, bushR * 0.65, 0, Math.PI * 2);
    ctx.arc(bushR * 0.45, -bushR * 0.2, bushR * 0.65, 0, Math.PI * 2);
    ctx.arc(0, -bushR * 0.6, bushR * 0.75, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#348a3e';
    ctx.beginPath();
    ctx.arc(0, -bushR * 0.65, bushR * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Hàng chục hạt quả mọng đỏ
    if (bushR >= 4.0) {
      ctx.fillStyle = '#dc2626';
      const berries = [
        [-bushR * 0.4, -bushR * 0.3], [bushR * 0.35, -bushR * 0.35],
        [-bushR * 0.15, -bushR * 0.6], [bushR * 0.2, -bushR * 0.65],
        [0, -bushR * 0.85], [-bushR * 0.3, -bushR * 0.5],
      ];
      const bRadius = Math.max(1.0 * this.dpr, 0.22 * pxPerMeter);
      for (const [bx, by] of berries) {
        ctx.beginPath();
        ctx.arc(bx, by, bRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /** MỎ ĐÁ TẢNG HOA CƯƠNG 3D (Stone Quarry Rocks) */
  private drawStoneQuarry(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, rand: number): void {
    const { ctx } = this;
    const rockW = (3.5 + rand * 2.0) * pxPerMeter;
    const rockH = (2.2 + rand * 1.2) * pxPerMeter * TILT_Y;
    if (rockW < 2.5) return;

    ctx.save();
    ctx.translate(sx, sy);

    ctx.fillStyle = 'rgba(15, 30, 10, 0.40)';
    ctx.beginPath();
    ctx.ellipse(0, rockH * 0.3, rockW * 0.7, rockH * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(-rockW * 0.5, 0);
    ctx.lineTo(-rockW * 0.3, -rockH * 0.9);
    ctx.lineTo(rockW * 0.2, -rockH * 0.95);
    ctx.lineTo(rockW * 0.55, -rockH * 0.2);
    ctx.lineTo(rockW * 0.4, rockH * 0.2);
    ctx.lineTo(-rockW * 0.3, rockH * 0.25);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(-rockW * 0.3, -rockH * 0.9);
    ctx.lineTo(rockW * 0.2, -rockH * 0.95);
    ctx.lineTo(rockW * 0.1, -rockH * 0.4);
    ctx.lineTo(-rockW * 0.2, -rockH * 0.35);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(rockW * 0.5, rockH * 0.1, rockW * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** BỘ XƯƠNG HÓA THẠCH KHỦNG LONG TIỀN SỬ (Dino Fossil Skeleton) */
  private drawDinoSkeletonFossil(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, rand: number): void {
    const { ctx } = this;
    const fossW = (3.2 + rand * 1.5) * pxPerMeter;
    if (fossW < 2.5) return;

    ctx.save();
    ctx.translate(sx, sy);

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = Math.max(1.0 * this.dpr, 0.26 * pxPerMeter);
    ctx.beginPath();
    // Sống lưng hóa thạch
    ctx.moveTo(-fossW * 0.5, 0);
    ctx.quadraticCurveTo(0, -fossW * 0.2, fossW * 0.5, 0);
    ctx.stroke();

    // Các cặp xương sườn
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * fossW * 0.18, -fossW * 0.1);
      ctx.lineTo(i * fossW * 0.18 - 1 * this.dpr, fossW * 0.25);
      ctx.stroke();
    }

    ctx.restore();
  }

  /** KHÓM CỎ & BỤI DƯƠNG XỈ ẨN NẤP (Grass Tufts & Ferns) */
  private drawGrassTuftsAndFern(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, rand: number): void {
    const { ctx } = this;
    const grassH = 2.4 * pxPerMeter * TILT_Y;
    if (grassH < 1.8) return;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.strokeStyle = '#6eb531';
    ctx.lineWidth = Math.max(0.8 * this.dpr, 0.25 * pxPerMeter);
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-grassH * 0.3, -grassH * 0.6, -grassH * 0.5, -grassH * 0.9);
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(0, -grassH * 0.7, grassH * 0.1, -grassH);
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(grassH * 0.3, -grassH * 0.5, grassH * 0.5, -grassH * 0.85);
    ctx.stroke();

    ctx.restore();
  }

  // ================================================================
  // 2. TẦNG SÔNG LỚN & MẶT NƯỚC TỰ NHIÊN
  // ================================================================

  private drawNaturalRivers(
    project: (at: LatLon) => [number, number],
    pxPerMeter: number,
    palette: typeof PALETTE.day,
  ): void {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    for (const river of NATURAL_RIVERS) {
      if (river.points.length < 2) continue;

      const screenPts = river.points.map(project);
      const isVisible = screenPts.some(([x, y]) => x >= -100 && x <= w + 100 && y >= -100 && y <= h + 100);
      if (!isVisible) continue;

      ctx.save();
      const riverWidth = Math.max(12 * this.dpr, river.widthMeters * pxPerMeter * 0.85);

      // 1. Dải bờ cát vàng ven sông phong cách Đế Chế (AOE Golden Sandy Shore)
      ctx.strokeStyle = palette.sandShore ?? '#c49e62';
      ctx.lineWidth = riverWidth + 7 * this.dpr;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(screenPts[0][0], screenPts[0][1]);
      for (let i = 1; i < screenPts.length; i++) {
        const xc = (screenPts[i - 1][0] + screenPts[i][0]) / 2;
        const yc = (screenPts[i - 1][1] + screenPts[i][1]) / 2;
        ctx.quadraticCurveTo(screenPts[i - 1][0], screenPts[i - 1][1], xc, yc);
      }
      ctx.lineTo(screenPts[screenPts.length - 1][0], screenPts[screenPts.length - 1][1]);
      ctx.stroke();

      // 2. Viền đất sẫm bờ sông
      ctx.strokeStyle = palette.waterStroke;
      ctx.lineWidth = riverWidth + 2.5 * this.dpr;
      ctx.stroke();

      // 3. Lòng sông màu xanh biếc AOE
      ctx.strokeStyle = palette.waterFill;
      ctx.lineWidth = riverWidth;
      ctx.stroke();

      // 4. Gợn sóng lăn tăn
      ctx.strokeStyle = palette.waterShimmer;
      ctx.lineWidth = 1.4 * this.dpr;
      ctx.setLineDash([8 * this.dpr, 14 * this.dpr]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Tên sông chữ thư pháp cổ
      const midIdx = Math.floor(screenPts.length / 2);
      const [mx, my] = screenPts[midIdx];
      if (mx >= 20 && mx <= w - 20 && my >= 20 && my <= h - 20) {
        ctx.font = `bold ${10 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`🌊 ${river.name}`, Math.round(mx), Math.round(my));
      }

      ctx.restore();
    }
  }

  // ================================================================
  // 3. TẦNG ĐƯỜNG PHỐ OPENSTREETMAP THỰC TẾ (MULTI-PASS SEAMLESS ROADS)
  // ================================================================

  private drawStreetNetwork(
    project: (at: LatLon) => [number, number],
    pxPerMeter: number,
    palette: typeof PALETTE.day,
    input: RenderInput,
  ): void {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Giới hạn toạ độ vùng nhìn (Viewport Bounding Box) để lọc siêu nhanh
    const margin = 60 * this.dpr;
    const halfSpanLat = ((h / (2 * 0.72) + margin) / pxPerMeter) * metersToLatDegrees(1);
    const halfSpanLon = ((w / 2 + margin) / pxPerMeter) * metersToLonDegrees(1, input.center.lat);
    const centerPanLat = input.center.lat + (this.panY / (pxPerMeter * 0.72)) * metersToLatDegrees(1);
    const centerPanLon = input.center.lon - (this.panX / pxPerMeter) * metersToLonDegrees(1, input.center.lat);

    const vMinLat = centerPanLat - halfSpanLat;
    const vMaxLat = centerPanLat + halfSpanLat;
    const vMinLon = centerPanLon - halfSpanLon;
    const vMaxLon = centerPanLon + halfSpanLon;

    // Lọc các tuyến đường nằm trong tầm mắt
    const visibleRoads: { road: OsmRoad; pts: [number, number][] }[] = [];

    for (const road of OSM_ROADS) {
      if (road.maxLat < vMinLat || road.minLat > vMaxLat || road.maxLon < vMinLon || road.minLon > vMaxLon) {
        continue;
      }
      const pts: [number, number][] = road.points.map(([lat, lon]) => project({ lat, lon }));
      visibleRoads.push({ road, pts });
    }

    // Nhóm theo phân cấp đường
    const residential = visibleRoads.filter(r => r.road.type === 'residential' || r.road.type === 'living_street' || r.road.type === 'unclassified');
    const secondary = visibleRoads.filter(r => r.road.type === 'secondary' || r.road.type === 'tertiary');
    const primary = visibleRoads.filter(r => r.road.type === 'primary' || r.road.type === 'trunk' || r.road.type === 'motorway');

    ctx.save();
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';

    // ----------------------------------------------------------------
    // PASS 1: VẼ TOÀN BỘ VIỀN MỰC (ALL CASINGS FIRST — KHỬ TRIỆT ĐỂ ĐỨT KHÚC / CỤC HÌNH THOI)
    // ----------------------------------------------------------------
    // 1.1 Viền mực các lối mòn / ngõ nhỏ
    ctx.strokeStyle = palette.roadTrailCasing;
    for (const { road, pts } of residential) {
      const roadWidth = Math.max(5 * this.dpr, road.widthMeters * pxPerMeter * 0.65);
      ctx.lineWidth = roadWidth + 2.2 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }

    // 1.2 Viền mực đường cấp 2 & 3
    ctx.strokeStyle = palette.roadSecCasing;
    for (const { road, pts } of secondary) {
      const roadWidth = Math.max(8 * this.dpr, road.widthMeters * pxPerMeter * 0.75);
      ctx.lineWidth = roadWidth + 2.8 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }

    // 1.3 Viền mực trục đại lộ chính
    ctx.strokeStyle = palette.roadMainCasing;
    for (const { road, pts } of primary) {
      const roadWidth = Math.max(12 * this.dpr, road.widthMeters * pxPerMeter * 0.85);
      ctx.lineWidth = roadWidth + 3.4 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }

    // ----------------------------------------------------------------
    // PASS 2: VẼ LÒNG ĐƯỜNG TRÊN TẤT CẢ VIỀN MỰC (SEAMLESS FLUSH FILLS)
    // ----------------------------------------------------------------
    // 2.1 Lòng đường lối mòn
    ctx.strokeStyle = palette.roadTrail;
    for (const { road, pts } of residential) {
      const roadWidth = Math.max(5 * this.dpr, road.widthMeters * pxPerMeter * 0.65);
      ctx.lineWidth = roadWidth + 0.6 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }

    // 2.2 Lòng cổ đạo vàng sáng
    ctx.strokeStyle = palette.roadSec;
    for (const { road, pts } of secondary) {
      const roadWidth = Math.max(8 * this.dpr, road.widthMeters * pxPerMeter * 0.75);
      ctx.lineWidth = roadWidth + 0.6 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }

    // 2.3 Lòng đại lộ lát đá hoàng kim sáng ngà
    ctx.strokeStyle = palette.roadMain;
    for (const { road, pts } of primary) {
      const roadWidth = Math.max(12 * this.dpr, road.widthMeters * pxPerMeter * 0.85);
      ctx.lineWidth = roadWidth + 0.6 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }

    // ----------------------------------------------------------------
    // PASS 3: VẠCH CHỈ TIM ĐẠI QUAN ĐẠO
    // ----------------------------------------------------------------
    ctx.strokeStyle = palette.roadMainCasing;
    ctx.lineWidth = 1 * this.dpr;
    ctx.setLineDash([7 * this.dpr, 9 * this.dpr]);
    for (const { road, pts } of primary) {
      if (road.widthMeters >= 24) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // ----------------------------------------------------------------
    // PASS 4: NHÃN TÊN ĐƯỜNG THƯ PHÁP DỌC TRỤC ĐƯỜNG CHÍNH
    // ----------------------------------------------------------------
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    for (const { road, pts } of [...secondary, ...primary]) {
      if (pts.length < 2 || !road.name || road.name === 'Cổ Đạo Hoang Dã' || road.name === 'Lối Nhai Phường Cổ') continue;

      // Tìm đoạn dài nhất trong polyline để đặt chữ thẳng thớm
      let maxLen = 0;
      let bestSegment = [pts[0], pts[1]];
      for (let i = 1; i < pts.length; i++) {
        const segLen = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        if (segLen > maxLen) {
          maxLen = segLen;
          bestSegment = [pts[i - 1], pts[i]];
        }
      }

      if (maxLen < 45 * this.dpr) continue;

      const [p1, p2] = bestSegment;
      const mx = (p1[0] + p2[0]) / 2;
      const my = (p1[1] + p2[1]) / 2;

      if (mx >= 35 && mx <= w - 35 && my >= 35 && my <= h - 35) {
        const angle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
        let normalizedAngle = angle;
        if (normalizedAngle > Math.PI / 2) normalizedAngle -= Math.PI;
        else if (normalizedAngle < -Math.PI / 2) normalizedAngle += Math.PI;

        ctx.save();
        ctx.translate(Math.round(mx), Math.round(my));
        ctx.rotate(normalizedAngle);

        ctx.font = `bold ${8.5 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
        ctx.fillStyle = palette.textInk;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(road.name, 0, -2 * this.dpr);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  // ================================================================
  // 4. LỚP MẶT NƯỚC POI (HỒ GƯƠM, HỒ TÂY, HỒ CÔNG VIÊN)
  // ================================================================

  private drawWaterFeature(
    feature: MapFeature,
    project: (at: LatLon) => [number, number],
    pxPerMeter: number,
    palette: typeof PALETTE.day,
  ): void {
    const { ctx } = this;
    const [rawX, rawY] = project({ lat: feature.lat, lon: feature.lon });
    const x = Math.round(rawX);
    const y = Math.round(rawY);
    const r = Math.min(Math.max(22 * this.dpr, (feature.radiusMeters || 35) * pxPerMeter * 0.65), 75 * this.dpr);

    ctx.save();
    // 1. Dải cát vàng viền bờ hồ phong cách Đế Chế
    ctx.fillStyle = palette.sandShore ?? '#c49e62';
    ctx.beginPath();
    ctx.ellipse(x, y, r + 5.5 * this.dpr, (r + 5.5 * this.dpr) * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Viền bờ hồ
    ctx.fillStyle = palette.waterStroke;
    ctx.beginPath();
    ctx.ellipse(x, y, r + 1.8 * this.dpr, (r + 1.8 * this.dpr) * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Lòng hồ xanh biếc AOE
    ctx.fillStyle = palette.waterFill;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();

    // 4. Gợn sóng lăn tăn
    ctx.strokeStyle = palette.waterShimmer;
    ctx.lineWidth = 1.2 * this.dpr;
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y - r * 0.1, r * 0.35, 0, Math.PI * 0.8);
    ctx.stroke();

    // Thẻ tên hồ / Thủy vực sắc nét
    const labelText = `🏞️ ${feature.nameVi}`;
    ctx.font = `bold ${10 * this.dpr}px 'Be Vietnam Pro', system-ui, -apple-system, sans-serif`;
    const labelW = Math.round(ctx.measureText(labelText).width + 18 * this.dpr);
    const labelH = Math.round(20 * this.dpr);
    const pillX = Math.round(x - labelW / 2);
    const pillY = Math.round(y - labelH / 2);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#101c1f';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.4 * this.dpr;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, labelW, labelH, 4 * this.dpr);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e0f2fe';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, x, Math.round(pillY + labelH / 2));

    ctx.restore();
  }

  // ================================================================
  // 4b. LÃNH ĐỊA DÃ THÚ SƯƠNG ĐỎ (RED MIST BEAST TERRITORIES)
  // ================================================================

  private drawBeastTerritories(
    project: (at: LatLon) => [number, number],
    pxPerMeter: number,
    palette: typeof PALETTE.day,
  ): void {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    for (const terr of HANOI_BEAST_TERRITORIES) {
      const [rawX, rawY] = project({ lat: terr.lat, lon: terr.lon });
      const x = Math.round(rawX);
      const y = Math.round(rawY);
      const radiusPx = terr.radiusMeters * pxPerMeter;

      if (x < -radiusPx || x > w + radiusPx || y < -radiusPx || y > h + radiusPx) continue;

      ctx.save();

      // 1. Quầng Sương Mù Đỏ Thần Bí (Pulsating Red Mist)
      const pulse = Math.sin(this.tick / 15) * 0.15;
      const mistGrad = ctx.createRadialGradient(x, y, radiusPx * 0.2, x, y, radiusPx);
      mistGrad.addColorStop(0, `rgba(225, 29, 72, ${0.35 + pulse})`);
      mistGrad.addColorStop(0.65, `rgba(190, 18, 60, ${0.20 + pulse * 0.5})`);
      mistGrad.addColorStop(1, 'rgba(136, 19, 55, 0)');

      ctx.fillStyle = mistGrad;
      ctx.beginPath();
      ctx.ellipse(x, y, radiusPx, radiusPx * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Viền gai hung hiểm bao quanh lãnh địa
      ctx.strokeStyle = `rgba(244, 63, 94, ${0.55 + pulse})`;
      ctx.lineWidth = 2 * this.dpr;
      ctx.setLineDash([8 * this.dpr, 6 * this.dpr]);
      ctx.beginPath();
      ctx.ellipse(x, y, radiusPx, radiusPx * 0.72, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. Biểu tượng & Thẻ tên Lãnh Địa Quái Thú
      const badgeY = y - radiusPx * 0.6;
      ctx.font = `bold ${10.5 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
      const labelText = `⚠️ ${terr.nameVi} (X${terr.resourceMultiplier} Tài Nguyên)`;
      const labelW = ctx.measureText(labelText).width + 16 * this.dpr;

      ctx.fillStyle = 'rgba(76, 5, 25, 0.92)';
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.4 * this.dpr;
      ctx.beginPath();
      ctx.roundRect(x - labelW / 2, badgeY - 10 * this.dpr, labelW, 20 * this.dpr, 4 * this.dpr);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fecdd3';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, x, badgeY);

      ctx.restore();
    }
  }

  // ================================================================
  // ================================================================
  // 5. CĂN CỨ PHÒNG THỦ & ĐẠI BẢN DOANH HOÀNG CỔ (PLAYER DEFENSIVE STRONGHOLD - SQUARE GRID TILES)
  // ================================================================

  private drawPlayerStronghold(
    pos: [number, number],
    pxPerMeter: number,
    input: RenderInput,
    palette: typeof PALETTE.day,
  ): void {
    const { ctx } = this;
    const [rawX, rawY] = pos;
    const cx = Math.round(rawX);
    const cy = Math.round(rawY);
    const w = this.canvas.width;
    const h = this.canvas.height;

    const camp = input.camp;
    const campLevel = (camp?.level ?? 1) as 1 | 2 | 3 | 4 | 5;
    const gridSize = Math.max(3, Math.min(7, camp?.gridSize ?? 3)); // Lưới vuông 3x3, 4x4, 5x5, 6x6, 7x7
    const tierDef = getCampTier(campLevel);
    const tierNameVi = tierDef?.nameVi ?? `Căn Cứ Cấp ${campLevel}`;
    const defensePower = input.campDefense ?? (camp ? campDefensePower(camp) : 18);
    const defenseStructures = camp?.defenseStructures ?? {};
    const stations = camp?.stations ?? [];
    const farmPlots = (camp?.farmPlots ?? []) as FarmPlot[];
    const isUpgrading = Boolean(camp?.upgradeCompleteAtMs);

    // Kích thước ô vuông nhỏ và toàn bộ khu trại
    const tileSize = Math.max(26 * this.dpr, 11 * pxPerMeter);
    const TILT_Y = 0.72;
    const totalW = gridSize * tileSize;
    const totalH = gridSize * tileSize * TILT_Y;

    if (cx < -totalW || cx > w + totalW || cy < -totalH || cy > h + totalH) {
      return;
    }

    ctx.save();

    // -------------------------------------------------------------
    // 1. MẶT ĐẤT DOANH TRẠI PHẲNG HOÀ NHẬP VỚI ĐỊA HÌNH (FLAT INTEGRATED GROUND)
    // -------------------------------------------------------------
    // 1.1 Nền đất nện tự nhiên của doanh trại (Trodden Earth Clearing)
    ctx.fillStyle = input.isNight ? 'rgba(45, 55, 38, 0.65)' : 'rgba(122, 90, 54, 0.65)';
    ctx.beginPath();
    ctx.roundRect(cx - totalW / 2 - 4 * this.dpr, cy - totalH / 2 - 2 * this.dpr, totalW + 8 * this.dpr, totalH + 4 * this.dpr, 4 * this.dpr);
    ctx.fill();

    // Viền cỏ tự nhiên rìa trại
    ctx.fillStyle = input.isNight ? '#163121' : '#4d7c1b';
    const fringeCount = 12;
    for (let i = 0; i < fringeCount; i++) {
      const fx = cx - totalW / 2 + (i / fringeCount) * totalW;
      const fy1 = cy - totalH / 2;
      const fy2 = cy + totalH / 2;
      ctx.fillRect(fx, fy1 - 1.5 * this.dpr, 2 * this.dpr, 3 * this.dpr);
      ctx.fillRect(fx, fy2 - 1.5 * this.dpr, 2 * this.dpr, 3 * this.dpr);
    }

    // -------------------------------------------------------------
    // 2. VẼ TỪNG Ô VUÔNG NHỎ TRONG LƯỚI LÃNH THỔ NẰM TRÊN MẶT ĐẤT (SQUARE GROUND TILES)
    // -------------------------------------------------------------
    const centerGx = Math.floor(gridSize / 2);
    const centerGy = Math.floor(gridSize / 2);

    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        const tx = Math.round(cx + (gx - (gridSize - 1) / 2) * tileSize);
        const ty = Math.round(cy + (gy - (gridSize - 1) / 2) * (tileSize * TILT_Y));
        const tw = tileSize - 2.5 * this.dpr;
        const th = (tileSize - 2.5 * this.dpr) * TILT_Y;

        // Ô đất phẳng / gạch đất nung nằm chìm trên mặt đất
        ctx.fillStyle = (gx + gy) % 2 === 0 ? 'rgba(120, 83, 49, 0.40)' : 'rgba(99, 67, 36, 0.35)';
        ctx.beginPath();
        ctx.roundRect(tx - tw / 2, ty - th / 2, tw, th, 2 * this.dpr);
        ctx.fill();

        // Viền rãnh xới đất nhẹ nhàng giữa các ô
        ctx.strokeStyle = 'rgba(45, 26, 12, 0.45)';
        ctx.lineWidth = 1.0 * this.dpr;
        ctx.stroke();

        // 4 Mốc cọc tre nhỏ đánh dấu góc ô sát mặt đất
        ctx.fillStyle = '#543720';
        const postR = 1.0 * this.dpr;
        ctx.fillRect(tx - tw / 2, ty - th / 2, postR * 2, postR * 2);
        ctx.fillRect(tx + tw / 2 - postR * 2, ty - th / 2, postR * 2, postR * 2);
        ctx.fillRect(tx - tw / 2, ty + th / 2 - postR * 2, postR * 2, postR * 2);
        ctx.fillRect(tx + tw / 2 - postR * 2, ty + th / 2 - postR * 2, postR * 2, postR * 2);
      }
    }

    // -------------------------------------------------------------
    // 3. MÀNG KHIÊN TRẬN ĐỒ BẢO VỆ PHẲNG DƯỚI ĐẤT (GROUND WARD AURA)
    // -------------------------------------------------------------
    const wardPulse = 0.65 + 0.35 * Math.sin(this.tick / 15);
    ctx.strokeStyle = input.isNight
      ? `rgba(56, 189, 248, ${0.45 * wardPulse})`
      : `rgba(245, 158, 11, ${0.55 * wardPulse})`;
    ctx.lineWidth = 1.6 * this.dpr;
    ctx.setLineDash([6 * this.dpr, 5 * this.dpr]);
    ctx.beginPath();
    ctx.roundRect(
      cx - (totalW / 2) * 1.03,
      cy - (totalH / 2) * 1.03,
      totalW * 1.03,
      totalH * 1.03,
      6 * this.dpr,
    );
    ctx.stroke();
    ctx.setLineDash([]);

    // Đăng ký hitbox căn cứ
    this.renderedCampBounds = {
      x: cx,
      y: cy,
      radius: Math.round((totalW / 2) * 0.9),
    };

    // -------------------------------------------------------------
    // 4. CÔNG TRÌNH PHÒNG THỦ & TƯỜNG THÀNH 4 CẠNH HÌNH VUÔNG
    // -------------------------------------------------------------
    this.drawStrongholdDefenses(cx, cy, totalW / 2, totalH / 2, defenseStructures, input);

    // -------------------------------------------------------------
    // 5. TRẠM CHẾ TẠO TRONG CÁC Ô VUÔNG
    // -------------------------------------------------------------
    this.drawStrongholdStations(cx, cy, tileSize, TILT_Y, gridSize, stations, input);

    // -------------------------------------------------------------
    // 6. KHU NÔNG TRẠI & CÁC LUỐNG CÂY TRỒNG TRONG CÁC Ô VUÔNG
    // -------------------------------------------------------------
    this.drawStrongholdFarming(cx, cy, tileSize, TILT_Y, gridSize, farmPlots, campLevel, input);

    // -------------------------------------------------------------
    // 7. TÒA KIẾN TRÚC TRUNG TÂM TẠI Ô CHÍNH GIỮA
    // -------------------------------------------------------------
    this.drawStrongholdCenterBuilding(cx, cy, campLevel, isUpgrading, input);

    // -------------------------------------------------------------
    // 8. BẢNG VINH DANH & CHỈ SỐ LÃNH THỔ / PHÒNG THỦ
    // -------------------------------------------------------------
    this.drawStrongholdPlaque(cx, cy, campLevel, `${tierNameVi} (${gridSize}×${gridSize})`, defensePower, isUpgrading, camp?.upgradeCompleteAtMs ?? null, farmPlots);

    ctx.restore();
  }

  /** Vẽ các công trình phòng thủ người chơi đã xây dựng quanh vành đai căn cứ hình vuông */
  private drawStrongholdDefenses(
    cx: number,
    cy: number,
    halfW: number,
    halfH: number,
    defenses: Partial<Record<string, number>>,
    input: RenderInput,
  ): void {
    const { ctx } = this;

    // 1. Tường Phòng Thủ (wooden_wall, stone_wall, stone_fortress_wall) bao quanh 4 cạnh hình vuông
    const hasWoodWall = (defenses['wooden_wall'] ?? 0) > 0;
    const hasStoneWall = (defenses['stone_wall'] ?? 0) > 0;
    const hasFortressWall = (defenses['stone_fortress_wall'] ?? 0) > 0;

    if (hasWoodWall || hasStoneWall || hasFortressWall) {
      const wallColor = hasFortressWall ? '#44403c' : hasStoneWall ? '#675a4d' : '#6d492e';
      const wallStroke = hasFortressWall ? '#fbbf24' : hasStoneWall ? '#b09f8f' : '#b88358';

      // 4 cạnh tường thành vuông vức: Bắc, Đông, Nam (có cổng), Tây
      const corners = [
        [-halfW, -halfH], // Tây Bắc
        [halfW, -halfH],  // Đông Bắc
        [halfW, halfH],   // Đông Nam
        [-halfW, halfH],  // Tây Nam
      ];

      ctx.save();
      ctx.strokeStyle = wallStroke;
      ctx.lineWidth = 5 * this.dpr;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Vẽ tường 3 cạnh trên và 2 nửa cạnh dưới (chừa cổng vào ở giữa)
      ctx.beginPath();
      ctx.moveTo(cx + corners[3][0], cy + corners[3][1]);
      ctx.lineTo(cx + corners[0][0], cy + corners[0][1]);
      ctx.lineTo(cx + corners[1][0], cy + corners[1][1]);
      ctx.lineTo(cx + corners[2][0], cy + corners[2][1]);
      ctx.lineTo(cx + halfW * 0.25, cy + halfH);
      ctx.moveTo(cx - halfW * 0.25, cy + halfH);
      ctx.lineTo(cx + corners[3][0], cy + corners[3][1]);
      ctx.stroke();

      ctx.strokeStyle = wallColor;
      ctx.lineWidth = 3.5 * this.dpr;
      ctx.stroke();

      // 4 Tháp canh góc tại 4 đỉnh hình vuông
      for (const [ox, oy] of corners) {
        ctx.fillStyle = wallColor;
        ctx.beginPath();
        ctx.arc(cx + ox, cy + oy, 5 * this.dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = wallStroke;
        ctx.lineWidth = 1.5 * this.dpr;
        ctx.stroke();
      }

      ctx.restore();
    }

    // 2. Hàng rào gai (thorn_fence)
    const thornCount = defenses['thorn_fence'] ?? 0;
    if (thornCount > 0) {
      const fx = cx - halfW * 0.85;
      const fy = cy + halfH * 0.9;
      ctx.strokeStyle = '#7a5538';
      ctx.lineWidth = 2.5 * this.dpr;
      for (let i = 0; i < Math.min(thornCount, 4); i++) {
        const px = fx + i * 9 * this.dpr;
        const py = fy - i * 2 * this.dpr;
        ctx.beginPath();
        ctx.moveTo(px - 3 * this.dpr, py + 4 * this.dpr);
        ctx.lineTo(px + 3 * this.dpr, py - 6 * this.dpr);
        ctx.moveTo(px + 3 * this.dpr, py + 4 * this.dpr);
        ctx.lineTo(px - 3 * this.dpr, py - 6 * this.dpr);
        ctx.stroke();
      }
    }

    // 3. Bẫy chông ngầm (spike_trap)
    const spikeCount = defenses['spike_trap'] ?? 0;
    if (spikeCount > 0) {
      const sx = cx;
      const sy = cy + halfH * 0.85;
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.ellipse(sx, sy, 12 * this.dpr, 5 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Mũi chông nhọn
      ctx.fillStyle = '#cbd5e1';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(sx + i * 4 * this.dpr, sy + 2 * this.dpr);
        ctx.lineTo(sx + i * 4 * this.dpr, sy - 5 * this.dpr);
        ctx.lineTo(sx + (i * 4 + 1.5) * this.dpr, sy + 2 * this.dpr);
        ctx.fill();
      }
    }

    // 4. Tháp canh (watch_tower)
    const towerCount = defenses['watch_tower'] ?? 0;
    if (towerCount > 0) {
      const tx = cx + halfW * 0.9;
      const ty = cy - halfH * 0.7;

      ctx.fillStyle = 'rgba(20, 10, 3, 0.45)';
      ctx.beginPath();
      ctx.ellipse(tx, ty + 8 * this.dpr, 10 * this.dpr, 5 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#7d5332';
      ctx.lineWidth = 3 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(tx - 6 * this.dpr, ty + 6 * this.dpr);
      ctx.lineTo(tx - 3 * this.dpr, ty - 18 * this.dpr);
      ctx.moveTo(tx + 6 * this.dpr, ty + 6 * this.dpr);
      ctx.lineTo(tx + 3 * this.dpr, ty - 18 * this.dpr);
      ctx.stroke();

      ctx.fillStyle = '#b45309';
      ctx.fillRect(tx - 7 * this.dpr, ty - 22 * this.dpr, 14 * this.dpr, 5 * this.dpr);
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(tx, ty - 23 * this.dpr, 2.5 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Vẽ các trạm chế tạo vào từng ô vuông cụ thể trên lưới lãnh thổ */
  private drawStrongholdStations(
    cx: number,
    cy: number,
    tileSize: number,
    TILT_Y: number,
    gridSize: number,
    stations: string[],
    input: RenderInput,
  ): void {
    const { ctx } = this;
    const centerGx = Math.floor(gridSize / 2);
    const centerGy = Math.floor(gridSize / 2);

    const getTilePos = (gx: number, gy: number): [number, number] => [
      Math.round(cx + (gx - (gridSize - 1) / 2) * tileSize),
      Math.round(cy + (gy - (gridSize - 1) / 2) * (tileSize * TILT_Y)),
    ];

    // 1. Đống lửa trại (campfire) — Đặt tại ô phía trên trung tâm
    if (stations.includes('campfire') || true) {
      const [fx, fy] = getTilePos(centerGx, Math.max(0, centerGy - 1));

      // Bóng râm bếp lửa
      ctx.fillStyle = 'rgba(20, 10, 3, 0.45)';
      ctx.beginPath();
      ctx.ellipse(fx, fy + 4 * this.dpr, 10 * this.dpr, 5 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Củi gỗ xếp chéo
      ctx.strokeStyle = '#543720';
      ctx.lineWidth = 2.5 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(fx - 7 * this.dpr, fy + 3 * this.dpr);
      ctx.lineTo(fx + 7 * this.dpr, fy - 1 * this.dpr);
      ctx.moveTo(fx - 5 * this.dpr, fy - 2 * this.dpr);
      ctx.lineTo(fx + 5 * this.dpr, fy + 4 * this.dpr);
      ctx.stroke();

      // Đá vây quanh bếp lửa
      ctx.fillStyle = '#78716c';
      for (let i = 0; i < 6; i++) {
        const theta = (i * Math.PI * 2) / 6;
        const rx = fx + Math.cos(theta) * 8 * this.dpr;
        const ry = fy + Math.sin(theta) * 4.5 * this.dpr;
        ctx.beginPath();
        ctx.arc(rx, ry, 2.2 * this.dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Ngọn lửa nhảy múa sống động
      const fHeight = (12 + Math.sin(this.tick / 3) * 3) * this.dpr;
      const f1 = Math.sin(this.tick / 4) * 2 * this.dpr;
      const f2 = Math.cos(this.tick / 3.5) * 2 * this.dpr;

      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(fx - 6 * this.dpr, fy + 2 * this.dpr);
      ctx.quadraticCurveTo(fx + f1, fy - fHeight, fx + 6 * this.dpr, fy + 2 * this.dpr);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(fx - 4 * this.dpr, fy + 2 * this.dpr);
      ctx.quadraticCurveTo(fx - f2, fy - fHeight * 0.75, fx + 4 * this.dpr, fy + 2 * this.dpr);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(fx - 2 * this.dpr, fy + 2 * this.dpr);
      ctx.quadraticCurveTo(fx + f1 * 0.5, fy - fHeight * 0.45, fx + 2 * this.dpr, fy + 2 * this.dpr);
      ctx.closePath();
      ctx.fill();

      this.renderedStations.push({
        stationId: 'campfire',
        x: fx,
        y: fy - 4 * this.dpr,
        radius: Math.round(16 * this.dpr),
      });
    }

    // 2. Giá phơi thịt (drying_rack)
    if (stations.includes('drying_rack')) {
      const [rxPos, ryPos] = getTilePos(Math.max(0, centerGx - 1), Math.max(0, centerGy - 1));

      ctx.strokeStyle = '#7d5332';
      ctx.lineWidth = 2 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(rxPos - 6 * this.dpr, ryPos + 6 * this.dpr);
      ctx.lineTo(rxPos, ryPos - 8 * this.dpr);
      ctx.lineTo(rxPos + 6 * this.dpr, ryPos + 6 * this.dpr);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(rxPos - 8 * this.dpr, ryPos - 2 * this.dpr);
      ctx.lineTo(rxPos + 8 * this.dpr, ryPos - 2 * this.dpr);
      ctx.stroke();

      ctx.fillStyle = '#dc2626';
      ctx.fillRect(rxPos - 4 * this.dpr, ryPos - 1 * this.dpr, 2.5 * this.dpr, 6 * this.dpr);
      ctx.fillRect(rxPos + 2 * this.dpr, ryPos - 1 * this.dpr, 2.5 * this.dpr, 5 * this.dpr);

      this.renderedStations.push({
        stationId: 'drying_rack',
        x: rxPos,
        y: ryPos,
        radius: Math.round(14 * this.dpr),
      });
    }

    // 3. Lò nung đất nung (kiln)
    if (stations.includes('kiln')) {
      const [kx, ky] = getTilePos(Math.min(gridSize - 1, centerGx + 1), Math.max(0, centerGy - 1));

      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.arc(kx, ky, 8 * this.dpr, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 1.5 * this.dpr;
      ctx.stroke();

      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(kx, ky, 3.5 * this.dpr, Math.PI, 0);
      ctx.closePath();
      ctx.fill();

      this.renderedStations.push({
        stationId: 'kiln',
        x: kx,
        y: ky - 4 * this.dpr,
        radius: Math.round(14 * this.dpr),
      });
    }

    // 4. Lò rèn kim loại (forge)
    if (stations.includes('forge')) {
      const [gx, gy] = getTilePos(Math.min(gridSize - 1, centerGx + 1), centerGy);

      ctx.fillStyle = '#44403c';
      ctx.fillRect(gx - 6 * this.dpr, gy - 2 * this.dpr, 12 * this.dpr, 7 * this.dpr);

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(gx - 4 * this.dpr, gy - 7 * this.dpr, 8 * this.dpr, 5 * this.dpr);

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(gx + 5 * this.dpr, gy - 4 * this.dpr, 2.5 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      this.renderedStations.push({
        stationId: 'forge',
        x: gx,
        y: gy - 3 * this.dpr,
        radius: Math.round(14 * this.dpr),
      });
    }

    // 5. Lò luyện đồng Đông Sơn (bronze_furnace)
    if (stations.includes('bronze_furnace')) {
      const [bx, by] = getTilePos(Math.min(gridSize - 1, centerGx + 1), Math.min(gridSize - 1, centerGy + 1));

      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.ellipse(bx, by, 7 * this.dpr, 5 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.8 * this.dpr;
      ctx.stroke();

      this.renderedStations.push({
        stationId: 'bronze_furnace',
        x: bx,
        y: by,
        radius: Math.round(14 * this.dpr),
      });
    }

    // 6. Đền thờ Thần Long (altar_of_dragons)
    if (stations.includes('altar_of_dragons')) {
      const [ax, ay] = getTilePos(Math.max(0, centerGx - 1), Math.min(gridSize - 1, centerGy + 1));

      ctx.fillStyle = '#854d0e';
      ctx.fillRect(ax - 7 * this.dpr, ay - 4 * this.dpr, 14 * this.dpr, 6 * this.dpr);

      // Linh thạch phát sáng xanh lam
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(ax, ay - 7 * this.dpr, 3.5 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      this.renderedStations.push({
        stationId: 'altar_of_dragons',
        x: ax,
        y: ay - 4 * this.dpr,
        radius: Math.round(14 * this.dpr),
      });
    }
  }

  /** Vẽ khu vườn nông nghiệp và các luống cây trồng chi tiết theo thời gian thực */
  private drawStrongholdFarming(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    farmPlots: FarmPlot[],
    campLevel: number,
    input: RenderInput,
  ): void {
    const { ctx } = this;
    const plotCount = farmPlots.length;
    if (plotCount === 0) return;

    // Vị trí khu vườn nông nghiệp ở góc phải sân
    const gardenStartX = cx + rx * 0.22;
    const gardenStartY = cy + ry * 0.08;

    const cols = plotCount <= 2 ? 2 : 3;
    const plotW = Math.round(26 * this.dpr);
    const plotH = Math.round(17 * this.dpr);
    const spacingX = Math.round(30 * this.dpr);
    const spacingY = Math.round(20 * this.dpr);

    const nowMs = Date.now();

    for (let i = 0; i < plotCount; i++) {
      const plot = farmPlots[i];
      const col = i % cols;
      const row = Math.floor(i / cols);

      const px = Math.round(gardenStartX + col * spacingX);
      const py = Math.round(gardenStartY + row * spacingY);

      // 1. Vẽ nền luống đất (Tilled Soil Bed)
      ctx.fillStyle = 'rgba(15, 8, 2, 0.4)';
      ctx.beginPath();
      ctx.roundRect(px - plotW / 2, py - plotH / 2 + 3 * this.dpr, plotW, plotH, 4 * this.dpr);
      ctx.fill();

      // Đất mùn nâu sẫm
      ctx.fillStyle = plot.fertilized ? '#22140a' : '#382312';
      ctx.beginPath();
      ctx.roundRect(px - plotW / 2, py - plotH / 2, plotW, plotH, 4 * this.dpr);
      ctx.fill();

      // Viền bờ luống đất
      ctx.strokeStyle = plot.fertilized ? '#4ade80' : '#5c3d20';
      ctx.lineWidth = (plot.fertilized ? 1.8 : 1.2) * this.dpr;
      ctx.stroke();

      // Rãnh cày xới đất
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.lineWidth = 1 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(px - plotW * 0.35, py);
      ctx.lineTo(px + plotW * 0.35, py);
      ctx.stroke();

      // Đăng ký hitbox cho luống
      this.renderedFarmPlots.push({
        plotIndex: plot.index ?? i,
        plot,
        x: px,
        y: py,
        radius: Math.round(18 * this.dpr),
      });

      // 2. Trạng thái cây trên luống
      if (!plot.cropId) {
        // Luống trống: Icon gieo hạt mờ nhẹ
        ctx.fillStyle = 'rgba(254, 240, 138, 0.35)';
        ctx.font = `${9 * this.dpr}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🌱+', px, py);
      } else {
        // Có cây trồng
        let cropDef: any = null;
        try {
          cropDef = getCropDef(plot.cropId);
        } catch {
          // Default fallback
        }

        const cropName = cropDef?.nameVi ?? 'Cây trồng';
        const growthDurationMs = (cropDef?.growthHours ?? 4) * 3600_000 * (plot.fertilized ? 0.65 : 1.0);
        const elapsed = plot.plantedAtMs ? nowMs - plot.plantedAtMs : 0;
        const progress = Math.min(1.0, elapsed / growthDurationMs);
        const isReady = plot.readyToHarvest || progress >= 1.0;
        const isWilted = plot.wilted ?? false;

        if (isWilted) {
          // A. CÂY HÉO RŨ
          ctx.fillStyle = '#78350f';
          ctx.font = `${11 * this.dpr}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🥀', px, py - 2 * this.dpr);

          // Nhãn cảnh báo tưới nước
          ctx.fillStyle = '#ef4444';
          ctx.font = `bold ${8 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
          ctx.fillText('Tưới!', px, py + 8 * this.dpr);
        } else if (isReady) {
          // B. CÂY ĐÃ CHÍN TRĨU QUẢ (READY TO HARVEST)
          let fruitEmoji = '🍓';
          if (plot.cropId.includes('herb') || plot.cropId.includes('thuoc')) fruitEmoji = '🌿';
          else if (plot.cropId.includes('mushroom') || plot.cropId.includes('nam')) fruitEmoji = '🍄';
          else if (plot.cropId.includes('fiber') || plot.cropId.includes('lua')) fruitEmoji = '🌾';

          // Bụi cây xum xuê
          ctx.font = `${13 * this.dpr}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(fruitEmoji, px, py - 2 * this.dpr);

          // Hiệu ứng ánh sáng lấp lánh chiến lợi phẩm
          const spark = Math.sin(this.tick / 7 + i) * 3 * this.dpr;
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(px + 8 * this.dpr, py - 8 * this.dpr + spark, 1.5 * this.dpr, 0, Math.PI * 2);
          ctx.fill();

          // THẺ NỔI "THU HOẠCH" NHẤP NHÁY MỜI GỌI
          const harvestPulse = 0.85 + 0.15 * Math.sin(this.tick / 5 + i);
          const badgeW = 44 * this.dpr;
          const badgeH = 14 * this.dpr;
          const badgeY = py - 16 * this.dpr;

          ctx.fillStyle = `rgba(220, 38, 38, ${harvestPulse})`;
          ctx.beginPath();
          ctx.roundRect(px - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 3 * this.dpr);
          ctx.fill();
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 1.2 * this.dpr;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${7.5 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
          ctx.fillText('THU HOẠCH', px, badgeY);
        } else {
          // C. CÂY ĐANG LỚN (GROWING)
          if (progress < 0.35) {
            // Mầm non mới nhú
            ctx.font = `${10 * this.dpr}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🌱', px, py - 1 * this.dpr);
          } else {
            // Bụi cây đang lớn
            ctx.font = `${11 * this.dpr}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🪴', px, py - 2 * this.dpr);
          }

          // Thanh tiến độ sinh trưởng mỏng dưới chân luống
          const barW = 18 * this.dpr;
          const barH = 2.5 * this.dpr;
          const barY = py + 6 * this.dpr;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(px - barW / 2, barY, barW, barH);

          ctx.fillStyle = '#4ade80';
          ctx.fillRect(px - barW / 2, barY, barW * progress, barH);
        }
      }
    }
  }

  /** Vẽ tòa kiến trúc trung tâm căn cứ theo cấp độ và cột cờ hiệu kỳ */
  private drawStrongholdCenterBuilding(
    cx: number,
    cy: number,
    campLevel: 1 | 2 | 3 | 4 | 5,
    isUpgrading: boolean,
    input: RenderInput,
  ): void {
    const { ctx } = this;
    const by = cy - 10 * this.dpr;

    // -------------------------------------------------------------
    // A. CỘT CỜ HIỆU KỲ THỦ LĨNH TUNG BAY TRONG GIÓ
    // -------------------------------------------------------------
    const flagPoleX = cx - 26 * this.dpr;
    const flagPoleY = cy + 4 * this.dpr;
    const flagH = 28 * this.dpr;

    // Bóng cột cờ
    ctx.fillStyle = 'rgba(20, 10, 3, 0.45)';
    ctx.beginPath();
    ctx.ellipse(flagPoleX, flagPoleY, 5 * this.dpr, 2.5 * this.dpr, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cột gỗ lim
    ctx.strokeStyle = '#6d492e';
    ctx.lineWidth = 2.5 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(flagPoleX, flagPoleY);
    ctx.lineTo(flagPoleX, flagPoleY - flagH);
    ctx.stroke();

    // Đầu ngọn cờ thếp vàng
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(flagPoleX, flagPoleY - flagH, 2.5 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    // Lá cờ lụa đỏ thêu chim Lạc uốn lượn mềm mại theo gió
    const flagTopY = flagPoleY - flagH + 2 * this.dpr;
    const flagLen = 22 * this.dpr;
    const flagHeight = 12 * this.dpr;

    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.moveTo(flagPoleX, flagTopY);
    for (let x = 0; x <= flagLen; x += 3 * this.dpr) {
      const wave = Math.sin(this.tick / 6 + x * 0.15) * 2.5 * this.dpr;
      ctx.lineTo(flagPoleX + x, flagTopY + wave);
    }
    for (let x = flagLen; x >= 0; x -= 3 * this.dpr) {
      const wave = Math.sin(this.tick / 6 + x * 0.15) * 2.5 * this.dpr;
      ctx.lineTo(flagPoleX + x, flagTopY + flagHeight + wave);
    }
    ctx.closePath();
    ctx.fill();

    // Họa tiết Chim Lạc vàng kim trên cờ
    ctx.fillStyle = '#fde047';
    ctx.font = `${8 * this.dpr}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🦅', flagPoleX + 10 * this.dpr, flagTopY + 6 * this.dpr);

    // -------------------------------------------------------------
    // B. TÒA KIẾN TRÚC TRUNG TÂM THEO CẤP ĐỘ
    // -------------------------------------------------------------
    if (campLevel === 1) {
      // CẤP 1: TÚP LỀU TRANH TIỀN SỬ
      // Bóng đổ
      ctx.fillStyle = 'rgba(20, 10, 3, 0.5)';
      ctx.beginPath();
      ctx.ellipse(cx, by + 12 * this.dpr, 20 * this.dpr, 9 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cột gỗ chéo khung lều
      ctx.strokeStyle = '#6d492e';
      ctx.lineWidth = 3 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(cx - 16 * this.dpr, by + 10 * this.dpr);
      ctx.lineTo(cx, by - 16 * this.dpr);
      ctx.lineTo(cx + 16 * this.dpr, by + 10 * this.dpr);
      ctx.stroke();

      // Mái lợp cỏ tranh vàng
      ctx.fillStyle = '#a16207';
      ctx.beginPath();
      ctx.moveTo(cx - 18 * this.dpr, by + 10 * this.dpr);
      ctx.lineTo(cx, by - 18 * this.dpr);
      ctx.lineTo(cx + 18 * this.dpr, by + 10 * this.dpr);
      ctx.closePath();
      ctx.fill();

      // Cửa lều hé mở thấy ánh lửa ấm áp
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.moveTo(cx - 5 * this.dpr, by + 10 * this.dpr);
      ctx.lineTo(cx, by + 1 * this.dpr);
      ctx.lineTo(cx + 5 * this.dpr, by + 10 * this.dpr);
      ctx.closePath();
      ctx.fill();
    } else if (campLevel === 2) {
      // CẤP 2: NHÀ SÀN GỖ ĐÔNG SƠN
      // Bóng đổ
      ctx.fillStyle = 'rgba(20, 10, 3, 0.5)';
      ctx.beginPath();
      ctx.ellipse(cx, by + 14 * this.dpr, 24 * this.dpr, 10 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // 4 Trụ gỗ lim nâng sàn
      ctx.fillStyle = '#543720';
      ctx.fillRect(cx - 14 * this.dpr, by + 4 * this.dpr, 3.5 * this.dpr, 10 * this.dpr);
      ctx.fillRect(cx - 4 * this.dpr, by + 4 * this.dpr, 3.5 * this.dpr, 10 * this.dpr);
      ctx.fillRect(cx + 6 * this.dpr, by + 4 * this.dpr, 3.5 * this.dpr, 10 * this.dpr);
      ctx.fillRect(cx + 14 * this.dpr, by + 4 * this.dpr, 3.5 * this.dpr, 10 * this.dpr);

      // Thân nhà sàn vách gỗ
      ctx.fillStyle = '#78350f';
      ctx.fillRect(cx - 16 * this.dpr, by - 8 * this.dpr, 32 * this.dpr, 13 * this.dpr);

      // Mái cong hình thuyền Đông Sơn
      ctx.fillStyle = '#9a3412';
      ctx.beginPath();
      ctx.moveTo(cx - 22 * this.dpr, by - 6 * this.dpr);
      ctx.quadraticCurveTo(cx - 12 * this.dpr, by - 22 * this.dpr, cx, by - 24 * this.dpr);
      ctx.quadraticCurveTo(cx + 12 * this.dpr, by - 22 * this.dpr, cx + 22 * this.dpr, by - 6 * this.dpr);
      ctx.lineTo(cx + 16 * this.dpr, by - 8 * this.dpr);
      ctx.lineTo(cx - 16 * this.dpr, by - 8 * this.dpr);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ea580c';
      ctx.lineWidth = 1.5 * this.dpr;
      ctx.stroke();

      // Đèn dầu treo hiên nhà
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(cx, by - 2 * this.dpr, 2.5 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    } else if (campLevel === 3) {
      // CẤP 3: PHÁO ĐÀI ĐÁ CỔ
      // Bóng đổ
      ctx.fillStyle = 'rgba(20, 10, 3, 0.55)';
      ctx.beginPath();
      ctx.ellipse(cx, by + 15 * this.dpr, 26 * this.dpr, 11 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tường thành đá khối xám
      ctx.fillStyle = '#44403c';
      ctx.fillRect(cx - 18 * this.dpr, by - 8 * this.dpr, 36 * this.dpr, 20 * this.dpr);
      ctx.strokeStyle = '#78716c';
      ctx.lineWidth = 2 * this.dpr;
      ctx.strokeRect(cx - 18 * this.dpr, by - 8 * this.dpr, 36 * this.dpr, 20 * this.dpr);

      // Tháp canh trung tâm pháo đài
      ctx.fillStyle = '#292524';
      ctx.fillRect(cx - 9 * this.dpr, by - 22 * this.dpr, 18 * this.dpr, 15 * this.dpr);

      // Răng cưa lỗ châu mai
      ctx.fillStyle = '#78716c';
      ctx.fillRect(cx - 10 * this.dpr, by - 25 * this.dpr, 5 * this.dpr, 4 * this.dpr);
      ctx.fillRect(cx + 5 * this.dpr, by - 25 * this.dpr, 5 * this.dpr, 4 * this.dpr);

      // Đuốc lửa vĩnh cửu trên tháp đá
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(cx, by - 26 * this.dpr, 3.5 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    } else if (campLevel === 4) {
      // CẤP 4: THÀNH CỔ ĐÔNG SƠN
      ctx.fillStyle = 'rgba(20, 10, 3, 0.6)';
      ctx.beginPath();
      ctx.ellipse(cx, by + 16 * this.dpr, 30 * this.dpr, 12 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cổng thành đá & đồng đúc đồ sộ
      ctx.fillStyle = '#292524';
      ctx.fillRect(cx - 22 * this.dpr, by - 12 * this.dpr, 44 * this.dpr, 24 * this.dpr);

      // Cổng vòm cuốn
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.arc(cx, by + 12 * this.dpr, 7 * this.dpr, Math.PI, 0);
      ctx.fill();

      // Mái vòm chạm khắc mặt trời Đông Sơn
      ctx.fillStyle = '#92400e';
      ctx.fillRect(cx - 24 * this.dpr, by - 22 * this.dpr, 48 * this.dpr, 10 * this.dpr);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2 * this.dpr;
      ctx.strokeRect(cx - 24 * this.dpr, by - 22 * this.dpr, 48 * this.dpr, 10 * this.dpr);

      // Mặt trời Đông Sơn trên nóc thành
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(cx, by - 26 * this.dpr, 5 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // CẤP 5: CUNG ĐIỆN THẦN LONG
      ctx.fillStyle = 'rgba(20, 10, 3, 0.65)';
      ctx.beginPath();
      ctx.ellipse(cx, by + 18 * this.dpr, 34 * this.dpr, 13 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Điện thờ ngọc bích & vàng kim
      ctx.fillStyle = '#065f46';
      ctx.fillRect(cx - 24 * this.dpr, by - 14 * this.dpr, 48 * this.dpr, 26 * this.dpr);

      // Mái điện rồng uốn lượn
      ctx.fillStyle = '#0d9488';
      ctx.beginPath();
      ctx.moveTo(cx - 28 * this.dpr, by - 12 * this.dpr);
      ctx.lineTo(cx, by - 30 * this.dpr);
      ctx.lineTo(cx + 28 * this.dpr, by - 12 * this.dpr);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.5 * this.dpr;
      ctx.stroke();

      // Ngọc Rồng tỏa sáng rực rỡ trên đỉnh
      const glow = 0.8 + 0.2 * Math.sin(this.tick / 6);
      ctx.fillStyle = `rgba(56, 189, 248, ${glow})`;
      ctx.beginPath();
      ctx.arc(cx, by - 32 * this.dpr, 6 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hiệu ứng giàn giáo nếu đang nâng cấp
    if (isUpgrading) {
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1.8 * this.dpr;
      ctx.strokeRect(cx - 20 * this.dpr, by - 20 * this.dpr, 40 * this.dpr, 30 * this.dpr);

      // Búa gõ nhịp
      ctx.font = `${13 * this.dpr}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔨', cx, by - 32 * this.dpr);
    }
  }

  /** Vẽ thẻ vinh danh căn cứ và chỉ số phòng thủ sắc nét phía trên tòa nhà */
  private drawStrongholdPlaque(
    cx: number,
    cy: number,
    campLevel: number,
    tierNameVi: string,
    defensePower: number,
    isUpgrading: boolean,
    upgradeCompleteAtMs: number | null,
    farmPlots: FarmPlot[],
  ): void {
    const { ctx } = this;
    const plaqueY = Math.round(cy - 48 * this.dpr);

    const hasReadyCrops = farmPlots.some((p) => p.readyToHarvest);

    // Tính toán kích thước bảng hiệu
    const titleText = `👑 ${tierNameVi.toUpperCase()} [CẤP ${campLevel}]`;
    const defenseText = isUpgrading && upgradeCompleteAtMs
      ? `⏳ Đang nâng cấp: ${Math.max(0, Math.ceil((upgradeCompleteAtMs - Date.now()) / 60000))}′`
      : `🛡️ Sức Phòng Thủ: ${defensePower} Giáp`;

    ctx.font = `bold ${10.5 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
    const titleW = ctx.measureText(titleText).width;
    ctx.font = `bold ${9 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
    const defW = ctx.measureText(defenseText).width;

    const pillW = Math.round(Math.max(titleW, defW) + 26 * this.dpr);
    const pillH = Math.round(30 * this.dpr);
    const pillX = Math.round(cx - pillW / 2);

    // Bóng đổ thẻ
    ctx.fillStyle = 'rgba(20, 10, 3, 0.6)';
    ctx.beginPath();
    ctx.roundRect(pillX, plaqueY + 2 * this.dpr, pillW, pillH, 5 * this.dpr);
    ctx.fill();

    // Nền thẻ sơn mài đen viền vàng kim
    ctx.fillStyle = '#1c0e04';
    ctx.beginPath();
    ctx.roundRect(pillX, plaqueY, pillW, pillH, 5 * this.dpr);
    ctx.fill();

    ctx.strokeStyle = hasReadyCrops ? '#ef4444' : '#f59e0b';
    ctx.lineWidth = 1.8 * this.dpr;
    ctx.stroke();

    // Dòng 1: Tên Căn Cứ & Cấp Độ
    ctx.fillStyle = '#fef08a';
    ctx.font = `bold ${10 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(titleText, cx, plaqueY + 9 * this.dpr);

    // Dòng 2: Chỉ số Sức Phòng Thủ / Nâng cấp
    ctx.fillStyle = isUpgrading ? '#fde047' : '#7dd3fc';
    ctx.font = `bold ${8.5 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
    ctx.fillText(defenseText, cx, plaqueY + 21 * this.dpr);
  }

  // ================================================================
  // 6. CÁC ĐỊA ĐIỂM NỔI 3D (CRISP ANCIENT LANDMARK PLAQUES — LÀM NÉT CHỮ)
  // ================================================================

  private drawFloatingFeatureBadge(
    feature: MapFeature,
    project: (at: LatLon) => [number, number],
    pxPerMeter: number,
    input: RenderInput,
    palette: typeof PALETTE.day,
  ): void {
    const { ctx } = this;
    const [rawX, rawY] = project({ lat: feature.lat, lon: feature.lon });
    const x = Math.round(rawX);
    const y = Math.round(rawY);
    const w = this.canvas.width;
    const h = this.canvas.height;

    if (x < -80 || x > w + 80 || y < -80 || y > h + 80) return;

    const distToPlayer = Math.round(distanceMeters(input.center, { lat: feature.lat, lon: feature.lon }));
    const inRange = distToPlayer <= Math.max(feature.radiusMeters || 0, 45);
    const isActive = input.activePoiId === feature.id;
    const icon = this.getFeatureIcon(feature);

    // Hiệu ứng bồng bềnh lơ lửng 3D
    const seed = hashSeed(feature.id);
    const bob = Math.sin(this.tick / 10 + seed) * 4 * this.dpr;
    const pulse = 0.6 + 0.4 * Math.sin(this.tick / 7 + seed);
    const badgeY = Math.round(y - 20 * this.dpr + bob);

    ctx.save();

    // 1. Bóng đổ chân trụ xuống mặt đường
    ctx.fillStyle = 'rgba(28, 16, 6, 0.42)';
    ctx.beginPath();
    ctx.ellipse(x, y + 3 * this.dpr, 16 * this.dpr, 6 * this.dpr, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Vòng phát sáng đài sen / trận đồ Bát Quái khi trong tầm
    if (inRange || isActive) {
      const glowGrad = ctx.createRadialGradient(x, y + 2 * this.dpr, 4 * this.dpr, x, y + 2 * this.dpr, 26 * this.dpr);
      glowGrad.addColorStop(0, `rgba(245, 158, 11, ${0.45 * pulse})`);
      glowGrad.addColorStop(0.7, `rgba(180, 83, 9, ${0.15 * pulse})`);
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.ellipse(x, y + 2 * this.dpr, 26 * this.dpr, 10 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(245, 158, 11, ${0.85 * pulse})`;
      ctx.lineWidth = 1.8 * this.dpr;
      ctx.beginPath();
      ctx.ellipse(x, y + 2 * this.dpr, 22 * this.dpr, 8.5 * this.dpr, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 3. Trụ đồng cổ đỡ huy hiệu nổi
    ctx.strokeStyle = inRange ? 'rgba(217, 119, 6, 0.95)' : 'rgba(84, 54, 27, 0.65)';
    ctx.lineWidth = 2 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(x, y + 2 * this.dpr);
    ctx.lineTo(x, badgeY + 14 * this.dpr);
    ctx.stroke();

    // 4. Huy Hiệu Nổi 3D — Thẻ Trúc / Phù Điêu Đồng Cổ
    const radius = Math.round(15 * this.dpr);
    const badgeGrad = ctx.createLinearGradient(x - radius, badgeY - radius, x + radius, badgeY + radius);
    if (inRange || isActive) {
      badgeGrad.addColorStop(0, '#fef08a');
      badgeGrad.addColorStop(0.4, '#d97706');
      badgeGrad.addColorStop(1, '#78350f');
    } else {
      badgeGrad.addColorStop(0, '#e2cb9f');
      badgeGrad.addColorStop(0.5, '#9a7548');
      badgeGrad.addColorStop(1, '#4a3219');
    }

    ctx.fillStyle = badgeGrad;
    ctx.beginPath();
    ctx.arc(x, badgeY, radius, 0, Math.PI * 2);
    ctx.fill();

    // Lòng gỗ gụ / trầm hương
    ctx.fillStyle = inRange ? '#2a1607' : '#1b1006';
    ctx.beginPath();
    ctx.arc(x, badgeY, radius - 2.2 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    // Icon biểu tượng chính giữa
    ctx.font = `${15 * this.dpr}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, x, badgeY);

    // 5. Thẻ Tên Địa Danh Sơn Mài — CHỈ HIỂN THỊ KHI ĐƯỢC ẤN VÀO (isActive)
    if (isActive) {
      const labelText = `${feature.nameVi}`;
      const distText = `${distToPlayer}m`;

      // Tính toán kích thước thẻ
      ctx.font = `bold ${11 * this.dpr}px 'Be Vietnam Pro', system-ui, -apple-system, sans-serif`;
      const labelWidth = ctx.measureText(labelText).width;
      ctx.font = `bold ${9.5 * this.dpr}px 'Be Vietnam Pro', system-ui, -apple-system, sans-serif`;
      const distWidth = ctx.measureText(distText).width;

      const pillW = Math.round(labelWidth + distWidth + 26 * this.dpr);
      const pillH = Math.round(24 * this.dpr);
      const pillX = Math.round(x - pillW / 2);
      const pillY = Math.round(badgeY - radius - pillH - 6 * this.dpr);

      // Cột tia sáng vàng kết nối thẻ tên và huy hiệu
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(x, badgeY - radius);
      ctx.lineTo(x, pillY + pillH);
      ctx.stroke();

      // Nền thẻ sơn mài đen tuyền viền vàng kim sắc sảo
      ctx.fillStyle = '#1c0e04';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.8 * this.dpr;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 5 * this.dpr);
      ctx.fill();
      ctx.stroke();

      // Nút đính ngọc hoàng kim 2 đầu thẻ
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(pillX + 5 * this.dpr, pillY + pillH / 2, 2.2 * this.dpr, 0, Math.PI * 2);
      ctx.arc(pillX + pillW - 5 * this.dpr, pillY + pillH / 2, 2.2 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // CHỮ TÊN ĐỊA DANH
      ctx.font = `bold ${11 * this.dpr}px 'Be Vietnam Pro', system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, pillX + 10 * this.dpr, Math.round(pillY + pillH / 2));

      // CHỮ KHOẢNG CÁCH MÉT
      ctx.font = `bold ${9.5 * this.dpr}px 'Be Vietnam Pro', system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#fde047';
      ctx.textAlign = 'right';
      ctx.fillText(distText, pillX + pillW - 10 * this.dpr, Math.round(pillY + pillH / 2));
    }

    ctx.restore();
  }

  // ================================================================
  // 7. BẪY THÚ NỔI 3D
  // ================================================================

  private drawTraps(
    project: (at: LatLon) => [number, number],
    traps: PlacedTrap[],
    pxPerMeter: number,
    input: RenderInput,
    palette: typeof PALETTE.day,
  ): void {
    const { ctx } = this;
    const now = Date.now();
    const w = this.canvas.width;
    const h = this.canvas.height;

    for (const trap of traps) {
      const [rawX, rawY] = project({ lat: trap.lat, lon: trap.lon });
      const x = Math.round(rawX);
      const y = Math.round(rawY);
      if (x < -40 || x > w + 40 || y < -40 || y > h + 40) continue;

      const isSprung = now >= trap.sprungAt;
      const isStolen = trap.spoiledAt ? now >= trap.spoiledAt : false;
      const distMeters = distanceMeters(input.center, { lat: trap.lat, lon: trap.lon });
      const inRange = distMeters <= 35;

      ctx.save();

      // 1. Bóng đổ
      ctx.fillStyle = 'rgba(28, 16, 6, 0.4)';
      ctx.beginPath();
      ctx.ellipse(x, y + 2 * this.dpr, 10 * this.dpr, 4 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Thân bẫy thú
      ctx.fillStyle = isSprung ? '#9a3412' : '#78350f';
      ctx.strokeStyle = inRange ? '#f59e0b' : '#c2934f';
      ctx.lineWidth = 1.6 * this.dpr;
      ctx.beginPath();
      ctx.arc(x, y - 6 * this.dpr, 12 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Icon bẫy
      ctx.font = `${12 * this.dpr}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const trapIcon = trap.type === 'fish_trap' ? '🐟' : isSprung ? '🥩' : '🪤';
      ctx.fillText(trapIcon, x, y - 6 * this.dpr);

      // Thẻ trạng thái
      ctx.font = `bold ${9 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
      const statusText = isStolen ? 'Bị cắn trộm' : isSprung ? 'Đã sập bẫy' : 'Đang chờ mồi';
      const labelW = Math.round(ctx.measureText(statusText).width + 12 * this.dpr);
      const pillX = Math.round(x - labelW / 2);
      const pillY = Math.round(y + 8 * this.dpr);

      ctx.fillStyle = '#140a03';
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, labelW, 16 * this.dpr, 3 * this.dpr);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isSprung ? '#fde047' : '#e2b373';
      ctx.fillText(statusText, x, Math.round(pillY + 8 * this.dpr));

      ctx.restore();
    }
  }

  // ================================================================
  // 8. VẬT PHẨM RƠI (WORLD DROPS) NỔI 3D
  // ================================================================

  private drawFloatingDrops(
    project: (at: LatLon) => [number, number],
    drops: WorldDrop[],
    pxPerMeter: number,
    input: RenderInput,
    palette: typeof PALETTE.day,
  ): void {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    for (const drop of drops) {
      const [x, y] = project({ lat: drop.lat, lon: drop.lon });
      if (x < -50 || x > w + 50 || y < -50 || y > h + 50) continue;

      const distMeters = distanceMeters(input.center, { lat: drop.lat, lon: drop.lon });
      const inRange = distMeters < 5.0;
      const seed = hashSeed(drop.id);
      const bob = Math.sin(this.tick / 8 + seed) * 4 * this.dpr;
      const dy = y - 14 * this.dpr + bob;

      ctx.save();

      // 1. Bóng đổ 3D dưới lòng cổ đạo
      ctx.fillStyle = 'rgba(28, 16, 6, 0.4)';
      ctx.beginPath();
      ctx.ellipse(x, y + 2 * this.dpr, 10 * this.dpr, 4 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Viên ngọc bích / Linh Phù nổi 3D
      const rx = Math.round(x);
      const rdy = Math.round(dy);
      const orbGrad = ctx.createRadialGradient(rx - 3 * this.dpr, rdy - 3 * this.dpr, 2 * this.dpr, rx, rdy, 14 * this.dpr);
      if (inRange) {
        orbGrad.addColorStop(0, '#fef08a');
        orbGrad.addColorStop(0.5, '#f59e0b');
        orbGrad.addColorStop(1, '#9a3412');
      } else {
        orbGrad.addColorStop(0, '#fde68a');
        orbGrad.addColorStop(0.6, '#b45309');
        orbGrad.addColorStop(1, '#451a03');
      }

      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(rx, rdy, 13 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Lòng ngọc trầm
      ctx.fillStyle = inRange ? '#2e1305' : '#1f0d04';
      ctx.beginPath();
      ctx.arc(rx, rdy, 11 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Icon Emoji vật phẩm
      const icon = itemEmoji(drop.itemId);
      ctx.font = `${13 * this.dpr}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, rx, rdy);

      // Thẻ trúc số lượng [Gỗ ×2] — CHỮ SIÊU SẮC NÉT
      ctx.font = `bold ${9.5 * this.dpr}px 'Be Vietnam Pro', system-ui, -apple-system, sans-serif`;
      const dropLabel = `${drop.nameVi} ×${drop.qty}`;
      const dropW = Math.round(ctx.measureText(dropLabel).width + 16 * this.dpr);
      const dropH = Math.round(18 * this.dpr);
      const pillX = Math.round(rx - dropW / 2);
      const pillY = Math.round(rdy + 16 * this.dpr);

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      ctx.fillStyle = inRange ? '#1c0e04' : '#140a03';
      ctx.strokeStyle = inRange ? '#f59e0b' : '#c2934f';
      ctx.lineWidth = 1.4 * this.dpr;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, dropW, dropH, 4 * this.dpr);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = inRange ? '#ffffff' : '#fef08a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dropLabel, rx, Math.round(pillY + dropH / 2));

      ctx.restore();
    }
  }

  // ================================================================
  // 9. NHÂN VẬT DŨNG SĨ HOÀNG CỔ OAI VỆ & SIÊU CHI TIẾT (ĐÔNG SƠN WARRIOR)
  // ================================================================

  private drawPlayer(
    x: number,
    y: number,
    pxPerMeter: number,
    input: RenderInput,
    palette: typeof PALETTE.day,
  ): void {
    const { ctx } = this;
    const isFemale = input.gender === 'female';

    // Hệ số co giãn tỉ lệ thế giới khi zoom (Chuẩn mực RTS/RPG: nhân vật tương đương người thường ~1.75m, khủng long và thần thú to lớn vượt bậc)
    const charScale = Math.max(0.14, Math.min(1.0, (pxPerMeter / 2.0) * 0.40));

    // 1. TÍNH TOÁN ĐỘNG LỰC HỌC BƯỚC CHÂN (Bipedal Walk Kinematics)
    const isMoving = !!input.isMoving || (input.speedKmh ?? 0) > 0.3;
    const isSprinting = !!input.isSprinting;
    if (isMoving) {
      // Tần số bước chân tự nhiên chuẩn sinh học:
      // Đi bộ thường: ~2.6 bước/giây (speedFactor 0.14 ở 60 FPS)
      // Phi nước đại: ~4.0 bước/giây (speedFactor 0.22 ở 60 FPS)
      const speedFactor = isSprinting ? 0.22 : 0.14;
      this.walkPhase += speedFactor;

      // Xoay hướng nhìn mượt mà về hướng di chuyển (360 Degree Smooth Direction Turning)
      if (input.moveHeading !== undefined) {
        let diff = input.moveHeading - this.playerFacingAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.playerFacingAngle += diff * 0.25;
      }
    } else {
      this.walkPhase *= 0.85;
      if (Math.abs(this.walkPhase) < 0.05) this.walkPhase = 0;
    }

    const stride = Math.sin(this.walkPhase);
    // Nhấp nhô cơ thể tự nhiên (Harmonic Body Bobbing)
    const walkBob = (isMoving
      ? Math.abs(Math.sin(this.walkPhase)) * (isSprinting ? 2.4 : 1.6)
      : Math.sin(this.tick / 8) * 1.2) * this.dpr * charScale;
    const py = y + walkBob;
    const rx = Math.round(x);
    const rpy = Math.round(py);

    // Biên độ bước chân dài rộng, uyển chuyển (sải bước vươn dài hơn khi phi nước đại)
    const legSwingMult = isSprinting ? 1.35 : 1.0;
    const leftLegY = isMoving ? Math.max(0, -stride) * 3.6 * legSwingMult * this.dpr : 0;
    const rightLegY = isMoving ? Math.max(0, stride) * 3.6 * legSwingMult * this.dpr : 0;
    const leftLegAngle = isMoving ? stride * 0.38 * legSwingMult : 0;
    const rightLegAngle = isMoving ? -stride * 0.38 * legSwingMult : 0;
    const armSwing = isMoving ? Math.sin(this.walkPhase) * 5.2 * legSwingMult * this.dpr : 0;
    const loinSway = isMoving ? Math.sin(this.walkPhase) * 2.2 * legSwingMult * this.dpr : 0;
    const hairSway = isMoving ? Math.sin(this.walkPhase) * 2.8 * legSwingMult * this.dpr : Math.sin(this.tick / 6) * 1.2 * this.dpr;

    // 2. SINH HẠT BỤI ĐẤT DẪM CHÂN (Step Dust Puffs)
    if (isMoving) {
      if (stride > 0.82 && this.lastFootPlant !== 1) {
        this.lastFootPlant = 1;
        for (let i = 0; i < 3; i++) {
          this.stepDustParticles.push({
            x: rx - 4 * this.dpr * charScale + (Math.random() - 0.5) * 6 * this.dpr * charScale,
            y: y + 15 * this.dpr * charScale + (Math.random() - 0.5) * 3 * this.dpr * charScale,
            vx: (Math.random() - 0.5) * 1.2 * this.dpr,
            vy: -Math.random() * 1.0 * this.dpr,
            r: (1.2 + Math.random() * 1.5) * this.dpr * charScale,
            alpha: 0.65,
          });
        }
      } else if (stride < -0.82 && this.lastFootPlant !== -1) {
        this.lastFootPlant = -1;
        for (let i = 0; i < 3; i++) {
          this.stepDustParticles.push({
            x: rx + 4 * this.dpr * charScale + (Math.random() - 0.5) * 6 * this.dpr * charScale,
            y: y + 15 * this.dpr * charScale + (Math.random() - 0.5) * 3 * this.dpr * charScale,
            vx: (Math.random() - 0.5) * 1.2 * this.dpr,
            vy: -Math.random() * 1.0 * this.dpr,
            r: (1.2 + Math.random() * 1.5) * this.dpr * charScale,
            alpha: 0.65,
          });
        }
      }
    }

    ctx.save();

    // 3. VẼ CÁC HẠT BỤI ĐẤT DẪM BƯỚC CHÂN TRÊN CANVAS TOÀN CỤC
    if (this.stepDustParticles.length > 0) {
      for (let i = this.stepDustParticles.length - 1; i >= 0; i--) {
        const p = this.stepDustParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.r += 0.08 * this.dpr;
        p.alpha -= 0.045;
        if (p.alpha <= 0) {
          this.stepDustParticles.splice(i, 1);
          continue;
        }
        ctx.fillStyle = `rgba(217, 119, 6, ${p.alpha * 0.55})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3.5 SINH HẠT KHÓI PHI NƯỚC ĐẠI (Sprint Smoke Puffs)
    if (isSprinting && isMoving) {
      if (this.tick % 3 === 0) {
        const windAngle = this.playerFacingAngle + Math.PI;
        const windCos = Math.cos(windAngle);
        const windSin = Math.sin(windAngle);
        for (let i = 0; i < 2; i++) {
          const offsetX = (Math.random() - 0.5) * 10 * this.dpr * charScale;
          const offsetY = (Math.random() - 0.5) * 8 * this.dpr * charScale;
          this.sprintWindParticles.push({
            x: rx + offsetX,
            y: y + 10 * this.dpr * charScale + offsetY,
            vx: windCos * (1.2 + Math.random() * 1.0) * this.dpr,
            vy: windSin * (1.2 + Math.random() * 1.0) * this.dpr - 0.4 * this.dpr,
            r: (2.5 + Math.random() * 2.5) * this.dpr * charScale,
            alpha: 0.32 + Math.random() * 0.15,
          });
        }
      }
      if (this.tick % 3 === 0) {
        for (let i = 0; i < 2; i++) {
          this.stepDustParticles.push({
            x: rx + (Math.random() - 0.5) * 10 * this.dpr * charScale,
            y: y + 14 * this.dpr * charScale + (Math.random() - 0.5) * 4 * this.dpr * charScale,
            vx: (Math.random() - 0.5) * 1.5 * this.dpr,
            vy: -Math.random() * 1.2 * this.dpr,
            r: (1.5 + Math.random() * 2.0) * this.dpr * charScale,
            alpha: 0.45,
          });
        }
      }
    }
    // Giới hạn tổng hạt
    if (this.sprintWindParticles.length > 30) this.sprintWindParticles.splice(0, this.sprintWindParticles.length - 30);
    if (this.stepDustParticles.length > 30) this.stepDustParticles.splice(0, this.stepDustParticles.length - 30);

    // Vẽ các hạt khói sprint
    if (this.sprintWindParticles.length > 0) {
      for (let i = this.sprintWindParticles.length - 1; i >= 0; i--) {
        const wp = this.sprintWindParticles[i];
        wp.x += wp.vx;
        wp.y += wp.vy;
        wp.r += 0.25 * this.dpr;
        wp.alpha -= 0.028;
        if (wp.alpha <= 0) {
          this.sprintWindParticles.splice(i, 1);
          continue;
        }
        const smokeColor = isFemale
          ? `rgba(167, 243, 208, ${wp.alpha})`
          : `rgba(251, 191, 36, ${wp.alpha * 0.7})`;
        ctx.fillStyle = smokeColor;
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, wp.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 4. ĐUỐC LỬA BAN ĐÊM (World Space)
    if (input.hasTorch && input.isNight) {
      const torchGrad = ctx.createRadialGradient(rx, Math.round(y), 8 * this.dpr * charScale, rx, Math.round(y), 32 * pxPerMeter);
      torchGrad.addColorStop(0, 'rgba(251, 146, 60, 0.45)');
      torchGrad.addColorStop(0.5, 'rgba(234, 88, 12, 0.22)');
      torchGrad.addColorStop(0.85, 'rgba(194, 65, 12, 0.08)');
      torchGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = torchGrad;
      ctx.beginPath();
      ctx.ellipse(rx, Math.round(y), 32 * pxPerMeter, 32 * pxPerMeter * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Vòng Radar tương tác 30m (World Space)
    ctx.strokeStyle = isFemale ? 'rgba(45, 212, 191, 0.65)' : 'rgba(217, 119, 6, 0.65)';
    ctx.lineWidth = 1.8 * this.dpr;
    ctx.setLineDash([6 * this.dpr, 6 * this.dpr]);
    ctx.beginPath();
    ctx.ellipse(rx, Math.round(y), 30 * pxPerMeter, 30 * pxPerMeter * 0.72, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 6. Sóng Radar định vị toả rộng êm ái
    const beaconTime = (this.tick % 40) / 40;
    const beaconR = (14 + beaconTime * 30) * this.dpr * charScale;
    ctx.strokeStyle = isFemale
      ? `rgba(45, 212, 191, ${0.75 * (1 - beaconTime)})`
      : `rgba(245, 158, 11, ${0.75 * (1 - beaconTime)})`;
    ctx.lineWidth = 2 * this.dpr;
    ctx.beginPath();
    ctx.ellipse(rx, Math.round(y), beaconR, beaconR * 0.72, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 7. Bóng đổ 3D dưới đất
    ctx.fillStyle = 'rgba(28, 16, 6, 0.48)';
    ctx.beginPath();
    ctx.ellipse(rx, Math.round(y + 12 * this.dpr * charScale), 16 * this.dpr * charScale, 7 * this.dpr * charScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // =========================================================================
    // 8. NÓN ÁNH SÁNG ĐỊNH HƯỚNG 360° TRÊN MẶT ĐẤT (Ground Directional Flashlight)
    // =========================================================================
    ctx.save();
    ctx.translate(rx, Math.round(y + 6 * this.dpr * charScale));
    ctx.rotate(this.playerFacingAngle);
    const coneGrad = ctx.createRadialGradient(0, 0, 4 * this.dpr * charScale, 0, -28 * this.dpr * charScale, 42 * this.dpr * charScale);
    coneGrad.addColorStop(0, isFemale ? 'rgba(45, 212, 191, 0.45)' : 'rgba(245, 158, 11, 0.45)');
    coneGrad.addColorStop(0.7, isFemale ? 'rgba(15, 118, 110, 0.15)' : 'rgba(180, 83, 9, 0.15)');
    coneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = coneGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 44 * this.dpr * charScale, -Math.PI * 0.75, -Math.PI * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // =========================================================================
    // 9. NHÂN VẬT ĐỨNG THẲNG TRÊN MẶT ĐẤT (UPRIGHT 2.5D CHARACTER AVATAR)
    // =========================================================================
    let normAngle = this.playerFacingAngle;
    while (normAngle > Math.PI) normAngle -= Math.PI * 2;
    while (normAngle < -Math.PI) normAngle += Math.PI * 2;

    // Phân tích hướng nhìn: Đi lên (Up/Bắc), Sang trái (Left/Tây), Sang phải (Right/Đông), Đi xuống (Down/Nam)
    const isFacingUp = normAngle >= -Math.PI * 0.35 && normAngle <= Math.PI * 0.35;
    const isFacingLeft = normAngle < -Math.PI * 0.35 && normAngle > -Math.PI * 0.75;

    ctx.save();
    ctx.translate(rx, rpy);
    // Co giãn nhân vật mượt mà theo độ zoom thế giới
    ctx.scale((isFacingLeft ? -1 : 1) * charScale, charScale);

    if (isFemale) {
      // ==================== NỮ THỔ DÂN TIỀN SỬ (THOÁT TỤC & KHỎE KHOẮN) ====================
      // 1. Tóc đen dài gợn sóng buông sau lưng
      ctx.fillStyle = '#18120e';
      ctx.beginPath();
      ctx.ellipse(-8 * this.dpr + hairSway, 1 * this.dpr, 3.5 * this.dpr, 11 * this.dpr, 0.15, 0, Math.PI * 2);
      ctx.ellipse(8 * this.dpr - hairSway, 1 * this.dpr, 3.5 * this.dpr, 11 * this.dpr, -0.15, 0, Math.PI * 2);
      ctx.fill();

      // 2. Chân trần thon thả bước đi nhịp nhàng (Animated Left & Right Leg)
      // Chân trái
      ctx.save();
      ctx.translate(-3.4 * this.dpr, 6 * this.dpr);
      ctx.rotate(leftLegAngle);
      ctx.fillStyle = '#b8794c';
      ctx.fillRect(-1.8 * this.dpr, -leftLegY, 3.6 * this.dpr, 11 * this.dpr);
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.2 * this.dpr;
      ctx.strokeRect(-1.8 * this.dpr, 8 * this.dpr - leftLegY, 3.6 * this.dpr, 2 * this.dpr);
      ctx.restore();

      // Chân phải
      ctx.save();
      ctx.translate(3.4 * this.dpr, 6 * this.dpr);
      ctx.rotate(rightLegAngle);
      ctx.fillStyle = '#b8794c';
      ctx.fillRect(-1.8 * this.dpr, -rightLegY, 3.6 * this.dpr, 11 * this.dpr);
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.2 * this.dpr;
      ctx.strokeRect(-1.8 * this.dpr, 8 * this.dpr - rightLegY, 3.6 * this.dpr, 2 * this.dpr);
      ctx.restore();

      // 3. Váy Khố Da Thú Ngắn Ngang Đùi (Loincloth Skirt đung đưa)
      ctx.fillStyle = '#5c2d12';
      ctx.beginPath();
      ctx.moveTo(-7.5 * this.dpr, 2 * this.dpr);
      ctx.lineTo(7.5 * this.dpr, 2 * this.dpr);
      ctx.lineTo(9 * this.dpr + loinSway, 9.5 * this.dpr);
      ctx.lineTo(4 * this.dpr + loinSway * 0.7, 11.5 * this.dpr);
      ctx.lineTo(loinSway * 0.5, 9 * this.dpr);
      ctx.lineTo(-4 * this.dpr + loinSway * 0.7, 11.5 * this.dpr);
      ctx.lineTo(-9 * this.dpr + loinSway, 9.5 * this.dpr);
      ctx.closePath();
      ctx.fill();

      // Dây thắt lưng vỏ cây & Chuỗi hạt gỗ
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1.6 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(-7.5 * this.dpr, 2.5 * this.dpr);
      ctx.lineTo(7.5 * this.dpr, 2.5 * this.dpr);
      ctx.stroke();

      // 4. Thân thể & Áo Yếm Da Thú
      ctx.fillStyle = '#c68b5e';
      ctx.beginPath();
      ctx.arc(0, -2.5 * this.dpr, 6.5 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      if (!isFacingUp) {
        // Áo yếm da thú mặt trước
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.moveTo(-6 * this.dpr, 1 * this.dpr);
        ctx.lineTo(6 * this.dpr, 1 * this.dpr);
        ctx.lineTo(3 * this.dpr, -5.5 * this.dpr);
        ctx.lineTo(-3 * this.dpr, -5.5 * this.dpr);
        ctx.closePath();
        ctx.fill();

        // Dây yếm mảnh buộc quanh cổ
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 1 * this.dpr;
        ctx.beginPath();
        ctx.moveTo(-3 * this.dpr, -5.5 * this.dpr);
        ctx.lineTo(0, -8 * this.dpr);
        ctx.lineTo(3 * this.dpr, -5.5 * this.dpr);
        ctx.stroke();

        // Chuỗi Vòng Cổ Hạt Ngọc Bích & Vỏ Sò
        ctx.strokeStyle = '#0d9488';
        ctx.lineWidth = 1.5 * this.dpr;
        ctx.beginPath();
        ctx.arc(0, -5 * this.dpr, 4 * this.dpr, 0.2, Math.PI - 0.2);
        ctx.stroke();
        ctx.fillStyle = '#5eead4';
        ctx.beginPath();
        ctx.arc(0, -1.5 * this.dpr, 1.8 * this.dpr, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Lưng trần mềm mại nhìn từ phía sau
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.moveTo(-5 * this.dpr, 0);
        ctx.lineTo(5 * this.dpr, 0);
        ctx.lineTo(0, -5 * this.dpr);
        ctx.closePath();
        ctx.fill();
      }

      // 5. Cây Lao Gỗ Săn Bắn (Hunting Spear vung theo sải tay)
      const fSpearX = 10 * this.dpr;
      const fSpearY = -armSwing * 0.7;
      ctx.strokeStyle = '#543118';
      ctx.lineWidth = 2 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(fSpearX, fSpearY - 18 * this.dpr);
      ctx.lineTo(fSpearX, fSpearY + 12 * this.dpr);
      ctx.stroke();
      // Mũi lao đá nhọn gắn dây
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(fSpearX, fSpearY - 23 * this.dpr);
      ctx.lineTo(fSpearX - 2.5 * this.dpr, fSpearY - 16 * this.dpr);
      ctx.lineTo(fSpearX + 2.5 * this.dpr, fSpearY - 16 * this.dpr);
      ctx.closePath();
      ctx.fill();

      // 6. Khuôn mặt thanh tú & Mái tóc
      ctx.fillStyle = '#c68b5e';
      ctx.beginPath();
      ctx.arc(0, -8.5 * this.dpr, 6.2 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      if (!isFacingUp) {
        // Mái tóc đen & Băng trán vải thô
        ctx.fillStyle = '#18120e';
        ctx.beginPath();
        ctx.arc(0, -10.5 * this.dpr, 6.4 * this.dpr, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 1.8 * this.dpr;
        ctx.beginPath();
        ctx.arc(0, -9 * this.dpr, 6 * this.dpr, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();

        // Đôi mắt linh hoạt & Vệt sơn xanh trên má
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(-2.2 * this.dpr, -8.5 * this.dpr, 1.1 * this.dpr, 0, Math.PI * 2);
        ctx.arc(2.2 * this.dpr, -8.5 * this.dpr, 1.1 * this.dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0d9488';
        ctx.fillRect(-4.8 * this.dpr, -7 * this.dpr, 1.8 * this.dpr, 1 * this.dpr);
        ctx.fillRect(3 * this.dpr, -7 * this.dpr, 1.8 * this.dpr, 1 * this.dpr);
      } else {
        // Mái tóc đen buông rủ kín gáy
        ctx.fillStyle = '#18120e';
        ctx.beginPath();
        ctx.arc(0, -9.5 * this.dpr, 6.6 * this.dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Lông chim rừng xanh ngọc cắm sau đầu
      const fFeatherSway = Math.sin(this.tick / 6) * 1.2 * this.dpr + hairSway;
      ctx.fillStyle = '#14b8a6';
      ctx.beginPath();
      ctx.moveTo(3 * this.dpr, -11 * this.dpr);
      ctx.quadraticCurveTo(10 * this.dpr + fFeatherSway, -22 * this.dpr, 8 * this.dpr + fFeatherSway, -23 * this.dpr);
      ctx.quadraticCurveTo(5 * this.dpr, -17 * this.dpr, 4 * this.dpr, -11 * this.dpr);
      ctx.fill();
    } else {
      // ==================== NAM THỔ DÂN TIỀN SỬ (THÂN TRẦN MẶC KHỐ ĐÍCH THỰC) ====================
      // 1. Chân trần cơ bắp bước đi trên đất mẹ (Animated Bipedal Stride)
      // Chân trái
      ctx.save();
      ctx.translate(-4.1 * this.dpr, 6 * this.dpr);
      ctx.rotate(leftLegAngle);
      ctx.fillStyle = '#a1653d';
      ctx.fillRect(-2.4 * this.dpr, -leftLegY, 4.8 * this.dpr, 12 * this.dpr);
      // Dây da thú thô quấn bắp chân
      ctx.strokeStyle = '#543118';
      ctx.lineWidth = 1.3 * this.dpr;
      ctx.strokeRect(-2.4 * this.dpr, 4 * this.dpr - leftLegY, 4.8 * this.dpr, 2.5 * this.dpr);
      ctx.restore();

      // Chân phải
      ctx.save();
      ctx.translate(4.1 * this.dpr, 6 * this.dpr);
      ctx.rotate(rightLegAngle);
      ctx.fillStyle = '#a1653d';
      ctx.fillRect(-2.4 * this.dpr, -rightLegY, 4.8 * this.dpr, 12 * this.dpr);
      // Dây da thú thô quấn bắp chân
      ctx.strokeStyle = '#543118';
      ctx.lineWidth = 1.3 * this.dpr;
      ctx.strokeRect(-2.4 * this.dpr, 4 * this.dpr - rightLegY, 4.8 * this.dpr, 2.5 * this.dpr);
      ctx.restore();

      // 2. KHỐ DA THÚ THỔ DÂN NGUYÊN BẢN (Authentic Primitive Loincloth đung đưa)
      ctx.fillStyle = '#451a03'; // Da thú nâu sẫm
      ctx.beginPath();
      ctx.moveTo(-8.5 * this.dpr, 1 * this.dpr);
      ctx.lineTo(8.5 * this.dpr, 1 * this.dpr);
      ctx.lineTo(6 * this.dpr + loinSway, 11 * this.dpr);
      ctx.lineTo(3 * this.dpr + loinSway * 0.7, 13 * this.dpr);
      ctx.lineTo(loinSway * 0.5, 10 * this.dpr);
      ctx.lineTo(-3 * this.dpr + loinSway * 0.7, 13 * this.dpr);
      ctx.lineTo(-6 * this.dpr + loinSway, 11 * this.dpr);
      ctx.closePath();
      ctx.fill();

      // Dải thắt lưng bện bằng dây leo & Gắn nanh thú
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-9 * this.dpr, 1 * this.dpr, 18 * this.dpr, 2.8 * this.dpr);
      if (!isFacingUp) {
        // Khóa đai răng nanh mặt trước
        ctx.fillStyle = '#fef3c7';
        ctx.beginPath();
        ctx.moveTo(-1.5 * this.dpr, 1.5 * this.dpr);
        ctx.lineTo(1.5 * this.dpr, 1.5 * this.dpr);
        ctx.lineTo(0, 5 * this.dpr);
        ctx.closePath();
        ctx.fill();
      }

      // 3. THÂN TRẦN VẠM VỠ
      ctx.fillStyle = '#b47545'; // Da bánh mật rám nắng khỏe khoắn
      ctx.beginPath();
      ctx.arc(0, -3 * this.dpr, 8.2 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      if (!isFacingUp) {
        // Cơ ngực & Cơ bụng 6 múi săn chắc
        ctx.strokeStyle = '#8c4e28';
        ctx.lineWidth = 1.4 * this.dpr;
        ctx.beginPath();
        ctx.moveTo(0, -6 * this.dpr);
        ctx.lineTo(0, 1 * this.dpr);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-3.5 * this.dpr, -3.5 * this.dpr, 3 * this.dpr, 0.2, Math.PI * 0.85);
        ctx.arc(3.5 * this.dpr, -3.5 * this.dpr, 3 * this.dpr, 0.15, Math.PI * 0.8);
        ctx.stroke();

        // 4. CHUỖI VÒNG CỔ NANH THÚ TIỀN SỬ
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 1.6 * this.dpr;
        ctx.beginPath();
        ctx.arc(0, -5.5 * this.dpr, 5.2 * this.dpr, 0.2, Math.PI - 0.2);
        ctx.stroke();

        // 3 chiếc nanh thú ngà trắng rủ trước ngực
        ctx.fillStyle = '#fef3c7';
        ctx.beginPath();
        ctx.moveTo(-1.2 * this.dpr, -0.5 * this.dpr);
        ctx.lineTo(1.2 * this.dpr, -0.5 * this.dpr);
        ctx.lineTo(0, 3.5 * this.dpr);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-4.5 * this.dpr, -2 * this.dpr);
        ctx.lineTo(-2.5 * this.dpr, -2.5 * this.dpr);
        ctx.lineTo(-4 * this.dpr, 1 * this.dpr);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(4.5 * this.dpr, -2 * this.dpr);
        ctx.lineTo(2.5 * this.dpr, -2.5 * this.dpr);
        ctx.lineTo(4 * this.dpr, 1 * this.dpr);
        ctx.closePath();
        ctx.fill();
      } else {
        // Khối cơ lưng xô vạm vỡ hình chữ V
        ctx.strokeStyle = '#8c4e28';
        ctx.lineWidth = 1.4 * this.dpr;
        ctx.beginPath();
        ctx.moveTo(0, -6 * this.dpr);
        ctx.lineTo(0, 1 * this.dpr);
        ctx.stroke();
      }

      // Vệt xăm hoang dã màu đất đỏ trên vai thổ dân
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 1.2 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(-8 * this.dpr, -5 * this.dpr);
      ctx.lineTo(-5 * this.dpr, -2 * this.dpr);
      ctx.moveTo(8 * this.dpr, -5 * this.dpr);
      ctx.lineTo(5 * this.dpr, -2 * this.dpr);
      ctx.stroke();

      // 5. Cánh tay & Vòng dây leo quấn bắp tay (Animated Arm Swing)
      ctx.fillStyle = '#a1653d';
      ctx.beginPath();
      ctx.arc(-9.5 * this.dpr, -2 * this.dpr + armSwing, 3.2 * this.dpr, 0, Math.PI * 2);
      ctx.arc(9.5 * this.dpr, -2 * this.dpr - armSwing, 3.2 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.3 * this.dpr;
      ctx.strokeRect(-11.5 * this.dpr, -3 * this.dpr + armSwing, 4 * this.dpr, 2 * this.dpr);
      ctx.strokeRect(7.5 * this.dpr, -3 * this.dpr - armSwing, 4 * this.dpr, 2 * this.dpr);

      // 6. TAY CẦM VŨ KHÍ: Ngọn Lao Gỗ Đá Nhọn Tiền Sử
      const spearX = 12 * this.dpr;
      const spearY = -armSwing * 0.8;
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 2.4 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(spearX, spearY - 22 * this.dpr);
      ctx.lineTo(spearX, spearY + 14 * this.dpr);
      ctx.stroke();

      // Mũi lao bằng phiến đá nhọn sắc bén (Flint Spearhead)
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(spearX, spearY - 29 * this.dpr);
      ctx.lineTo(spearX - 3.5 * this.dpr, spearY - 20 * this.dpr);
      ctx.lineTo(spearX + 3.5 * this.dpr, spearY - 20 * this.dpr);
      ctx.closePath();
      ctx.fill();
      // Dây leo buộc chéo mũi đá
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1.2 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(spearX - 3 * this.dpr, spearY - 20 * this.dpr);
      ctx.lineTo(spearX + 3 * this.dpr, spearY - 17 * this.dpr);
      ctx.moveTo(spearX + 3 * this.dpr, spearY - 20 * this.dpr);
      ctx.lineTo(spearX - 3 * this.dpr, spearY - 17 * this.dpr);
      ctx.stroke();

      // 7. KHUÔN MẶT & MÁI TÓC
      ctx.fillStyle = '#18120e';
      ctx.beginPath();
      ctx.ellipse(-8 * this.dpr + hairSway, -5 * this.dpr, 3.8 * this.dpr, 9 * this.dpr, 0.1, 0, Math.PI * 2);
      ctx.ellipse(8 * this.dpr - hairSway, -5 * this.dpr, 3.8 * this.dpr, 9 * this.dpr, -0.1, 0, Math.PI * 2);
      ctx.fill();

      // Khuôn mặt cương nghị da bánh mật
      ctx.fillStyle = '#b47545';
      ctx.beginPath();
      ctx.arc(0, -9.5 * this.dpr, 7 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      if (!isFacingUp) {
        // Mái tóc đen & Dải băng trán da thô
        ctx.fillStyle = '#18120e';
        ctx.beginPath();
        ctx.arc(0, -12 * this.dpr, 7.2 * this.dpr, Math.PI * 0.95, Math.PI * 2.05);
        ctx.fill();
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2.4 * this.dpr;
        ctx.beginPath();
        ctx.arc(0, -10.5 * this.dpr, 6.8 * this.dpr, Math.PI * 1.05, Math.PI * 1.95);
        ctx.stroke();

        // Đôi mắt hoang dã sắc sảo
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(-2.6 * this.dpr, -9.5 * this.dpr, 1.2 * this.dpr, 0, Math.PI * 2);
        ctx.arc(2.6 * this.dpr, -9.5 * this.dpr, 1.2 * this.dpr, 0, Math.PI * 2);
        ctx.fill();

        // Vệt sơn chiến binh màu đất đỏ ngang 2 gò má
        ctx.fillStyle = '#c2410c';
        ctx.fillRect(-5.5 * this.dpr, -7.5 * this.dpr, 2.5 * this.dpr, 1.2 * this.dpr);
        ctx.fillRect(3 * this.dpr, -7.5 * this.dpr, 2.5 * this.dpr, 1.2 * this.dpr);
      } else {
        // Mái tóc dài đen buông sau đầu kín gáy
        ctx.fillStyle = '#18120e';
        ctx.beginPath();
        ctx.arc(0, -10 * this.dpr, 7.2 * this.dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      // 8. LÔNG CHIM RỪNG CÀI ĐẦU ĐUNG ĐƯA THEO BƯỚC ĐI
      const featherSway = Math.sin(this.tick / 6) * 1.5 * this.dpr + hairSway;
      ctx.fillStyle = '#b91c1c'; // Lông đại bàng đỏ thẫm
      ctx.beginPath();
      ctx.moveTo(-2 * this.dpr, -12 * this.dpr);
      ctx.quadraticCurveTo(2 * this.dpr + featherSway, -24 * this.dpr, 1 * this.dpr + featherSway, -25 * this.dpr);
      ctx.quadraticCurveTo(4 * this.dpr + featherSway, -18 * this.dpr, 2 * this.dpr, -12 * this.dpr);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  // ================================================================
  // 10. LA BÀN BÁT QUÁI BẢN ĐỒ CỔ & TRIỆN SON
  // ================================================================

  private drawCompassRose(w: number, h: number, palette: typeof PALETTE.day): void {
    const { ctx } = this;
    const cx = w - 32 * this.dpr;
    const cy = 36 * this.dpr;
    const r = 16 * this.dpr;

    ctx.save();
    // Vòng hoa la bàn Bát Quái cổ
    ctx.strokeStyle = palette.roadMainCasing;
    ctx.lineWidth = 1.6 * this.dpr;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = palette.gridLine;
    ctx.lineWidth = 1 * this.dpr;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 3 * this.dpr, 0, Math.PI * 2);
    ctx.stroke();

    // Mũi tên chỉ Bắc son đỏ
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.moveTo(cx, cy - r + 2 * this.dpr);
    ctx.lineTo(cx - 4 * this.dpr, cy);
    ctx.lineTo(cx + 4 * this.dpr, cy);
    ctx.closePath();
    ctx.fill();

    // Mũi tên chỉ Nam mực đen
    ctx.fillStyle = '#523318';
    ctx.beginPath();
    ctx.moveTo(cx, cy + r - 2 * this.dpr);
    ctx.lineTo(cx - 4 * this.dpr, cy);
    ctx.lineTo(cx + 4 * this.dpr, cy);
    ctx.closePath();
    ctx.fill();

    ctx.font = `bold ${8 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
    ctx.fillStyle = '#b91c1c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Bắc', cx, cy - r - 1 * this.dpr);

    // Con dấu triện son ở góc đối diện (Góc trên bên trái)
    const sealX = 14 * this.dpr;
    const sealY = 14 * this.dpr;
    const sealS = 18 * this.dpr;
    ctx.strokeStyle = palette.sealRed;
    ctx.lineWidth = 1.2 * this.dpr;
    ctx.beginPath();
    ctx.rect(sealX, sealY, sealS, sealS);
    ctx.stroke();
    ctx.font = `bold ${7 * this.dpr}px 'Be Vietnam Pro', serif`;
    ctx.fillStyle = palette.sealRed;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Hoàng', sealX + sealS / 2, sealY + sealS * 0.32);
    ctx.fillText('Cổ', sealX + sealS / 2, sealY + sealS * 0.72);

    ctx.restore();
  }

  private drawSpiritBirdAndWindTrails(
    _w: number,
    _h: number,
    rx: number,
    rpy: number,
    speedKmh: number,
    _palette: typeof PALETTE.day,
  ): void {
    const { ctx } = this;
    ctx.save();

    // 1. Linh Điểu Hoàng Cổ (Spirit Falcon) bay lượn trên cao bên cạnh người chơi (Đã loại bỏ vệt gạch chéo toàn màn hình)
    const birdAngle = (this.tick / 15) % (Math.PI * 2);
    const birdDist = 32 * this.dpr;
    const birdX = rx + Math.cos(birdAngle) * birdDist + 18 * this.dpr;
    const birdY = rpy - 38 * this.dpr + Math.sin(birdAngle * 1.5) * 8 * this.dpr;
    const wingFlap = Math.sin(this.tick / 3.5) * 12 * this.dpr;

    // Vệt bụi sáng kim quang lượn theo đuôi chim (mềm mại, không gạch chéo)
    ctx.fillStyle = 'rgba(251, 191, 36, 0.25)';
    for (let i = 1; i <= 3; i++) {
      const trailX = birdX - (i * 8 * this.dpr);
      const trailY = birdY + (i * 4 * this.dpr) + Math.sin((this.tick - i * 3) / 4) * 4 * this.dpr;
      ctx.beginPath();
      ctx.arc(trailX, trailY, (4 - i) * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hào quang linh điểu phát sáng
    const aura = ctx.createRadialGradient(birdX, birdY, 2 * this.dpr, birdX, birdY, 22 * this.dpr);
    aura.addColorStop(0, 'rgba(254, 240, 138, 0.85)');
    aura.addColorStop(0.5, 'rgba(245, 158, 11, 0.4)');
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(birdX, birdY, 22 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    // Thân Linh Điểu
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.ellipse(birdX, birdY, 9 * this.dpr, 4.5 * this.dpr, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Cánh Linh Điểu sải rộng rực lửa
    ctx.fillStyle = '#f59e0b';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.2 * this.dpr;

    // Cánh trái
    ctx.beginPath();
    ctx.moveTo(birdX - 2 * this.dpr, birdY);
    ctx.quadraticCurveTo(birdX - 16 * this.dpr, birdY - wingFlap, birdX - 18 * this.dpr, birdY - wingFlap - 4 * this.dpr);
    ctx.lineTo(birdX - 5 * this.dpr, birdY + 3 * this.dpr);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cánh phải
    ctx.beginPath();
    ctx.moveTo(birdX + 2 * this.dpr, birdY);
    ctx.quadraticCurveTo(birdX + 16 * this.dpr, birdY - wingFlap, birdX + 18 * this.dpr, birdY - wingFlap - 4 * this.dpr);
    ctx.lineTo(birdX + 5 * this.dpr, birdY + 3 * this.dpr);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Đầu và mỏ vàng
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(birdX + 7 * this.dpr, birdY - 2 * this.dpr, 3.5 * this.dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(birdX + 9 * this.dpr, birdY - 2 * this.dpr);
    ctx.lineTo(birdX + 14 * this.dpr, birdY - 1 * this.dpr);
    ctx.lineTo(birdX + 9 * this.dpr, birdY);
    ctx.closePath();
    ctx.fill();

    // Đuôi phượng hoàng xòe 3 nhánh
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 1.6 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(birdX - 7 * this.dpr, birdY + 1 * this.dpr);
    ctx.lineTo(birdX - 18 * this.dpr, birdY + 6 * this.dpr);
    ctx.moveTo(birdX - 7 * this.dpr, birdY + 1 * this.dpr);
    ctx.lineTo(birdX - 17 * this.dpr, birdY + 11 * this.dpr);
    ctx.stroke();

    // Thẻ trạng thái du hành viễn chinh
    const speedTag = `🦅 LINH ĐIỂU VIỄN CHINH • ${Math.round(speedKmh)} KM/H`;
    ctx.font = `bold ${8.5 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
    const tagW = Math.round(ctx.measureText(speedTag).width + 16 * this.dpr);
    const tagH = Math.round(18 * this.dpr);
    const tagX = Math.round(birdX - tagW / 2);
    const tagY = Math.round(birdY - 24 * this.dpr);

    ctx.fillStyle = '#1c0e04';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.4 * this.dpr;
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, tagW, tagH, 4 * this.dpr);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(speedTag, birdX, Math.round(tagY + tagH / 2));

    ctx.restore();
  }

  private drawRain(w: number, h: number, intensity: number): void {
    const { ctx } = this;
    const dpr = this.dpr;
    const t = this.tick;
    ctx.save();

    // ── TẦNG 1: Mưa rơi thực tế (giọt thẳng đứng nhẹ, mảnh, mượt mà) ──
    const dropCount = Math.round(24 * intensity);
    for (let i = 0; i < dropCount; i++) {
      const seed = i * 137.508 + 19.1;
      const rx = ((seed * 73.1 + t * 0.8) % w + w) % w;
      const ry = ((seed * 41.3 + t * 7.0) % h + h) % h;
      const len = (6 + (i % 3) * 2.5) * dpr;

      ctx.strokeStyle = 'rgba(224, 242, 254, 0.28)';
      ctx.lineWidth = 0.75 * dpr;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 0.5 * dpr, ry + len); // Rơi gần như thẳng đứng, không gạch chéo
      ctx.stroke();
    }

    // ── TẦNG 2: Gợn sóng nước mưa nở tròn trên mặt đất (Rain Ripples) ──
    const rippleCount = Math.round(8 * intensity);
    for (let i = 0; i < rippleCount; i++) {
      const rSeed = i * 263.3 + 41.7;
      const ripplePhase = (t * 0.04 + i * 0.35) % 1;
      const rx = (rSeed * 89.3) % w;
      const ry = (rSeed * 53.7) % h;
      const radius = ripplePhase * 9 * dpr;
      const alpha = (1 - ripplePhase) * 0.25;

      ctx.strokeStyle = `rgba(186, 230, 253, ${alpha})`;
      ctx.lineWidth = 0.8 * dpr;
      ctx.beginPath();
      ctx.ellipse(rx, ry, radius, radius * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ── TẦNG 3: Màn sương mưa mỏng dịu mát không gian ──────────────────
    ctx.globalAlpha = 0.035 * intensity;
    ctx.fillStyle = 'rgba(186, 230, 253, 1)';
    ctx.fillRect(0, 0, w, h);

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private getFeatureIcon(feature: MapFeature): string {
    const name = feature.nameVi;
    const fid = feature.id;
    if (fid === 'bd_05' || name.includes('Một Cột') || name.includes('Liên Hoa')) return '🪷';
    if (fid === 'bd_01' || name.includes('Hoàng Thành') || name.includes('Vương Thành')) return '🏯';
    if (fid === 'bd_03' || name.includes('Văn Miếu') || name.includes('Quốc Tử Giám')) return '📜';
    if (fid === 'bd_02' || name.includes('Ba Đình') || name.includes('Lăng Bác')) return '🏛️';
    if (fid === 'hk_06' || name.includes('Nhà Thờ') || name.includes('Tháp Thánh')) return '⛪';
    if (fid.includes('highlands') || name.includes('Highlands') || name.includes('Cà phê')) return '☕';
    if (name.includes('Phúc Long') || name.includes('The Coffee House') || name.includes('Trà') || name.includes('Cộng')) return '🍵';
    if (name.includes('WinMart') || name.includes('Circle K') || name.includes('Tạp Hoá') || name.includes('Tiệm Trao Đổi')) return '🏪';
    if (fid.includes('bus') || name.includes('Xe Buýt') || name.includes('Bến Xe') || name.includes('Vịnh Xén Hè') || fid.includes('outpost') || name.includes('Tiền Đồn') || name.includes('Trạm Dừng')) return '🚏';
    if (fid.startsWith('den_fox') || name.includes('Tổ Cáo')) return '🦊';
    if (fid.startsWith('den_rabbit') || name.includes('Bãi Thỏ')) return '🐇';
    if (fid.startsWith('den_hedgehog') || name.includes('Tổ Nhím')) return '🦔';
    if (fid.startsWith('den_snake') || name.includes('Ổ Rắn') || name.includes('Mãng Xà')) return '🐍';
    if (fid.startsWith('den_boar') || name.includes('Lợn Rừng')) return '🐗';
    if (fid.startsWith('den_deer') || name.includes('Hươu')) return '🦌';
    if (fid.startsWith('den_wolf') || name.includes('Sói')) return '🐺';
    if (fid.startsWith('den_tiger') || name.includes('Hổ')) return '🐅';
    if (fid.startsWith('den_bear') || name.includes('Gấu')) return '🐻';
    if (fid.startsWith('den_') || name.includes('Hang') || name.includes('Động')) return '🪨';
    if (name.includes('Vườn Hoa') || name.includes('Công Viên')) return '🌳';
    if (fid.includes('pharm') || name.includes('Long Châu') || name.includes('Pharmacity') || name.includes('Nhà Thuốc') || name.includes('Thần Dược')) return '💊';
    if (name.includes('Y Viện') || name.includes('Thảo Dược') || name.includes('Bạch Mai') || name.includes('198')) return '🌿';
    if (name.includes('Học Viện') || name.includes('Tri Thức') || name.includes('Đại Học')) return '📜';
    if (name.includes('Đấu Trường') || name.includes('Mỹ Đình') || name.includes('Sân Vận Động')) return '🏟️';
    if (name.includes('Trạm Lữ Khách') || name.includes('Lữ Điểm')) return '🏕️';
    if (name.includes('Vàng') || fid.includes('gold')) return '🪙';
    if (name.includes('Than') || name.includes('Quặng') || name.includes('Sắt') || fid.includes('iron')) return '⛏️';
    if (name.includes('Hươu') || fid.includes('deer')) return '🦌';
    if (name.includes('Cự Mộc') || fid.startsWith('cl_')) return '🌳';
    if (name.includes('Đất Sét') || fid.includes('clay')) return '🏺';
    if (name.includes('Tháp') || name.includes('Keangnam') || name.includes('Lotte') || name.includes('Dolphin') || name.includes('Discovery')) return '🗼';
    if (name.includes('Long Cốt') || name.includes('Cầu')) return '🐉';
    if (feature.zone === 'forest') return '🌲';
    if (feature.zone === 'water') return '💧';
    if (feature.zone === 'merchant') return '🏛️';
    return '⛰️';
  }

  // ================================================================
  // HỆ THỐNG CẢNH QUAN & MẶT ĐẤT TIỀN SỬ (TÍNH NĂNG ĐỒNG NHẤT CAO CẤP)
  // ================================================================

  /**
   * TẦNG CẢNH QUAN KỶ KHỦNG LONG ĐIỂM XUYẾT (PREHISTORIC ACCENTS & STEALTH BRUSHES)
   * Tinh tế, vừa đủ để tạo bối cảnh khủng long sống động mà không che khuất đường xá và địa điểm.
   */
  private drawPrehistoricAccents(
    w: number,
    h: number,
    input: RenderInput,
    project: (at: LatLon) => [number, number],
    pxPerMeter: number,
    TILT_Y: number,
  ): void {
    const { ctx } = this;
    const playerScreenX = w / 2 + this.panX;
    const playerScreenY = h / 2 + this.panY;
    let isStealthed = false;

    // 1. Đặt các Rừng Dương Xỉ Thân Gỗ Ẩn Nấp (Ancient Tree Fern Groves, cao thực tế ~3.8m)
    for (const feature of this.cachedSolidFeatures) {
      if (feature.zone === 'forest') {
        const [fx, fy] = project(feature);
        if (fx < -100 || fx > w + 100 || fy < -100 || fy > h + 100) continue;

        const radius = Math.max(8 * this.dpr, feature.radiusMeters * pxPerMeter * 0.48);

        ctx.save();
        ctx.translate(fx, fy);

        // Vùng sương ngọc bích huyền ảo bồng bềnh
        const pulse = 0.85 + 0.15 * Math.sin(this.tick * 0.04 + hashSeed(feature.id));
        const brushGrad = ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius);
        brushGrad.addColorStop(0, `rgba(5, 150, 105, ${0.32 * pulse})`);
        brushGrad.addColorStop(0.55, `rgba(16, 185, 129, ${0.16 * pulse})`);
        brushGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
        ctx.fillStyle = brushGrad;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();

        // Đom đóm/bào tử rừng sâu lơ lửng
        for (let i = 0; i < 3; i++) {
          const fa = (this.tick * 0.02 + i * 2.1) % (Math.PI * 2);
          const fDist = radius * (0.3 + 0.4 * Math.sin(this.tick * 0.03 + i));
          ctx.fillStyle = 'rgba(167, 243, 208, 0.75)';
          ctx.beginPath();
          ctx.arc(Math.cos(fa) * fDist, Math.sin(fa) * fDist * TILT_Y, 1.2 * this.dpr, 0, Math.PI * 2);
          ctx.fill();
        }

        // 3 Cây Dương Xỉ Thân Gỗ Cổ Đại 3.8m với thân vỏ vảy cá và vương miện lá rủ
        if (radius >= 7) {
          const treeOffsets = [
            { dx: -0.3, dy: -0.15, scale: 0.95 },
            { dx: 0.28, dy: -0.2, scale: 1.05 },
            { dx: 0.02, dy: 0.22, scale: 0.9 },
          ];

          for (const tr of treeOffsets) {
            const bx = tr.dx * radius;
            const by = tr.dy * radius * TILT_Y;
            const trunkH = Math.max(4 * this.dpr, 3.8 * pxPerMeter * TILT_Y * tr.scale);
            const crownSpan = Math.max(3.5 * this.dpr, 3.2 * pxPerMeter * tr.scale);

            ctx.save();
            ctx.translate(bx, by);

            // Bóng đổ thân cây
            ctx.fillStyle = 'rgba(10, 5, 2, 0.35)';
            ctx.beginPath();
            ctx.ellipse(0, 1.5 * this.dpr, crownSpan * 0.6, trunkH * 0.22, 0, 0, Math.PI * 2);
            ctx.fill();

            // Thân cây dương xỉ gỗ (Vỏ nâu xơ dừa với hoa văn vân vảy)
            const trunkGrad = ctx.createLinearGradient(-crownSpan * 0.1, 0, crownSpan * 0.1, 0);
            trunkGrad.addColorStop(0, '#271206');
            trunkGrad.addColorStop(0.5, '#451e09');
            trunkGrad.addColorStop(1, '#1b0b03');
            ctx.fillStyle = trunkGrad;

            ctx.beginPath();
            ctx.moveTo(-crownSpan * 0.12, 0);
            ctx.lineTo(-crownSpan * 0.06, -trunkH);
            ctx.lineTo(crownSpan * 0.06, -trunkH);
            ctx.lineTo(crownSpan * 0.12, 0);
            ctx.closePath();
            ctx.fill();

            // Vương miện 6 cành lá dương xỉ rủ mềm mại từ đỉnh thân
            const crownFronds = 6;
            for (let c = 0; c < crownFronds; c++) {
              const ang = (c * Math.PI * 2) / crownFronds;
              const fTipX = Math.cos(ang) * crownSpan;
              const fTipY = -trunkH + Math.sin(ang) * crownSpan * 0.45 * TILT_Y + crownSpan * 0.3;
              const fCtrlX = Math.cos(ang) * crownSpan * 0.65;
              const fCtrlY = -trunkH - crownSpan * 0.28;

              // Cuống lá uốn cong
              ctx.strokeStyle = '#059669';
              ctx.lineWidth = Math.max(0.8 * this.dpr, 0.35 * pxPerMeter);
              ctx.beginPath();
              ctx.moveTo(0, -trunkH);
              ctx.quadraticCurveTo(fCtrlX, fCtrlY, fTipX, fTipY);
              ctx.stroke();

              // Lá non xanh tươi rực rỡ ở đầu cành
              ctx.fillStyle = '#6ee7b7';
              ctx.beginPath();
              ctx.arc(fTipX, fTipY, Math.max(0.7 * this.dpr, 0.25 * pxPerMeter), 0, Math.PI * 2);
              ctx.fill();
            }

            ctx.restore();
          }
        }

        ctx.restore();

        // Kiểm tra người chơi có đang đứng trong bụi ẩn nấp
        const distToPlayer = Math.hypot(fx - playerScreenX, (fy - playerScreenY) / TILT_Y);
        if (distToPlayer < radius * 0.9) {
          isStealthed = true;
        }
      }
    }

    // 2. Khu Khai Quật Hóa Thạch Khủng Long Cổ Đại (Ancient Dinosaur Excavation Site, rộng thực tế 18m)
    const fossilLat = input.center.lat + 0.0006;
    const fossilLon = input.center.lon + 0.0007;
    const [fox, foy] = project({ lat: fossilLat, lon: fossilLon });

    if (fox >= -100 && fox <= w + 100 && foy >= -100 && foy <= h + 100) {
      const boneSpanW = 18 * pxPerMeter;
      const boneSpanH = 9 * pxPerMeter * TILT_Y;

      if (boneSpanW >= 3) {
        ctx.save();
        ctx.translate(fox, foy);

        // Hố đất trầm tích khai quật viễn cổ
        const pitGrad = ctx.createRadialGradient(0, 0, boneSpanW * 0.2, 0, 0, boneSpanW * 0.6);
        pitGrad.addColorStop(0, 'rgba(69, 26, 3, 0.35)');
        pitGrad.addColorStop(0.7, 'rgba(120, 53, 15, 0.15)');
        pitGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = pitGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, boneSpanW * 0.6, boneSpanH * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // 4 Vòm xương sườn hóa thạch Thằn Lằn Sấm (Sauropod Ribs) ngà voi cổ kính
        const ribCount = 4;
        const ribSpacing = (boneSpanW * 0.55) / (ribCount - 1);
        const startRibX = -boneSpanW * 0.28;
        const boneThick = Math.max(1.1 * this.dpr, 0.42 * pxPerMeter);

        for (let r = 0; r < ribCount; r++) {
          const rx = startRibX + r * ribSpacing;
          const ribR = (boneSpanH * 0.7) * (1 - r * 0.08);

          // Bóng đổ vòm xương
          ctx.strokeStyle = 'rgba(20, 10, 3, 0.45)';
          ctx.lineWidth = boneThick + 1.2 * this.dpr;
          ctx.beginPath();
          ctx.arc(rx, 1.5 * this.dpr, ribR * 0.95, Math.PI * 0.9, Math.PI * 2.1);
          ctx.stroke();

          // Xương sườn ngà voi cổ đại
          const boneGrad = ctx.createLinearGradient(rx, -ribR, rx, 0);
          boneGrad.addColorStop(0, '#fef9c3');
          boneGrad.addColorStop(0.7, '#fef08a');
          boneGrad.addColorStop(1, '#ca8a04');
          ctx.strokeStyle = boneGrad;
          ctx.lineWidth = boneThick;
          ctx.beginPath();
          ctx.arc(rx, 0, ribR, Math.PI * 0.88, Math.PI * 2.12);
          ctx.stroke();
        }

        // Hộp sọ Bạo Long (T-Rex Skull) nửa chìm nửa nổi trong cát
        if (boneSpanW >= 12) {
          const skullX = boneSpanW * 0.35;
          const skullY = -boneSpanH * 0.15;
          const skullW = 5.5 * pxPerMeter;
          const skullH = 3.2 * pxPerMeter * TILT_Y;

          // Hộp sọ hóa thạch màu vàng ngà phong hóa
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.ellipse(skullX, skullY, skullW * 0.5, skullH * 0.5, 0.25, 0, Math.PI * 2);
          ctx.fill();

          // Hốc mắt (Orbit) & Hốc thái dương đen thẳm
          ctx.fillStyle = '#291807';
          ctx.beginPath();
          ctx.ellipse(skullX - skullW * 0.12, skullY - skullH * 0.1, skullW * 0.16, skullH * 0.2, 0.1, 0, Math.PI * 2);
          ctx.ellipse(skullX + skullW * 0.18, skullY - skullH * 0.05, skullW * 0.12, skullH * 0.15, -0.2, 0, Math.PI * 2);
          ctx.fill();

          // Hàm răng sắc nhọn hóa thạch
          ctx.fillStyle = '#ffffff';
          for (let t = -2; t <= 2; t++) {
            ctx.beginPath();
            ctx.moveTo(skullX + t * skullW * 0.09, skullY + skullH * 0.25);
            ctx.lineTo(skullX + t * skullW * 0.09 + skullW * 0.04, skullY + skullH * 0.45);
            ctx.lineTo(skullX + t * skullW * 0.09 + skullW * 0.08, skullY + skullH * 0.25);
            ctx.fill();
          }
        }

        ctx.restore();
      }
    }

    this.playerStealthState = {
      isStealthed,
      opacity: isStealthed ? 0.55 : 1.0,
    };
  }

  /**
   * MODULE 1: VẼ DẤU CHÂN THỜI GIAN THỰC & HẠT BÙN/CÁT VĂNG (FOOTPRINTS & PARTICLES)
   */
  private drawDinoFootprintsAndParticles(
    w: number,
    h: number,
    input: RenderInput,
    project: (at: LatLon) => [number, number],
    pxPerMeter: number,
    TILT_Y: number,
  ): void {
    const { ctx } = this;
    const dtSec = 0.016;

    // 1. Cập nhật bước chân của người chơi
    if (this.lastPlayerPos) {
      const dLat = input.center.lat - this.lastPlayerPos.lat;
      const dLon = input.center.lon - this.lastPlayerPos.lon;
      const dMeters = Math.hypot(dLon * 100000, dLat * 111000);

      if (dMeters > 0.4) {
        this.lastPlayerHeadingRad = Math.atan2(dLon, dLat);
        const playerWeightKg = input.playerWeightKg ?? 72;
        const [pScreenX, pScreenY] = [w / 2 + this.panX, h / 2 + this.panY];
        this.footprintManager.onEntityMove('player', pScreenX, pScreenY, this.lastPlayerHeadingRad, playerWeightKg, TerrainType.FERN_CARPET);
        this.lastPlayerPos = { ...input.center };
      }
    } else {
      this.lastPlayerPos = { ...input.center };
    }

    // 2. Tick cập nhật mờ dần cho footprints & particles
    this.footprintManager.tick(dtSec);

    // 3. Vẽ Dấu Chân còn hiệu lực (Theo tỷ lệ thế giới pxPerMeter)
    this.footprintManager.footprintPool.forEachActive((fp) => {
      ctx.save();
      ctx.translate(fp.x, fp.y);
      ctx.rotate(fp.headingRad);
      ctx.globalAlpha = Math.max(0, fp.alpha * 0.7);

      const fpSize = Math.max(1.5 * this.dpr, (0.45 + fp.size * 0.15) * pxPerMeter);
      ctx.fillStyle = 'rgba(30, 15, 8, 0.65)';

      if (fp.entityWeightCategory === EntityWeightCategory.COLOSSAL || fp.entityWeightCategory === EntityWeightCategory.LARGE) {
        // Dấu chân khủng long 3 ngón
        ctx.beginPath();
        ctx.ellipse(0, 0, fpSize * 0.7, fpSize * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let t = -1; t <= 1; t++) {
          ctx.beginPath();
          ctx.moveTo(t * fpSize * 0.35, -fpSize * 0.35);
          ctx.lineTo(t * fpSize * 0.5, -fpSize * 0.9);
          ctx.lineTo(t * fpSize * 0.15, -fpSize * 0.45);
          ctx.fill();
        }
      } else {
        // Dấu chân người tiền sử / thợ săn
        ctx.beginPath();
        ctx.ellipse(0, 0, fpSize * 0.4, fpSize * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, fpSize * 0.55, fpSize * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });

    // 4. Vẽ các Hạt Bùn / Bụi Cát Văng
    this.footprintManager.particlePool.forEachActive((p) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.colorHex;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.8 * this.dpr, 0.12 * pxPerMeter), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  /**
   * MODULE 3: VẼ TRẠNG THÁI HUD ẨN NẤP (STEALTH STATUS)
   */
  private drawDinoStealthHud(w: number, h: number, playerScreenX: number, playerScreenY: number): void {
    if (!this.playerStealthState.isStealthed) return;
    const { ctx } = this;

    ctx.save();
    ctx.translate(playerScreenX, playerScreenY);

    // Vòng hào quang ngụy trang rêu xanh
    const auraGrad = ctx.createRadialGradient(0, 0, 8 * this.dpr, 0, 0, 24 * this.dpr);
    auraGrad.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
    auraGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 24 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    // Badge nổi trên đầu nhân vật
    ctx.translate(0, -36 * this.dpr);
    ctx.fillStyle = 'rgba(6, 40, 25, 0.85)';
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.2 * this.dpr;
    const text = '🌿 ẨN NẤP';
    ctx.font = `bold ${9 * this.dpr}px system-ui, sans-serif`;
    const tw = ctx.measureText(text).width;
    const pad = 5 * this.dpr;

    ctx.beginPath();
    ctx.roundRect(-tw / 2 - pad, -7 * this.dpr, tw + pad * 2, 14 * this.dpr, 4 * this.dpr);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#6ee7b7';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0);

    ctx.restore();
  }
}

/** Chuyển toạ độ chạm trên canvas thành POI gần nhất — cho phép bấm vào cảnh vật. */
export function featureAtPoint(
  features: MapFeature[],
  center: LatLon,
  point: { x: number; y: number },
  canvas: HTMLCanvasElement,
  spanMeters = 75,
): MapFeature | null {
  const TILT_Y = 0.72;
  const rect = canvas.getBoundingClientRect();
  const pxPerMeter = Math.min(rect.width, rect.height) / spanMeters;

  const dxMeters = (point.x - rect.width / 2) / pxPerMeter;
  const dyMeters = -(point.y - rect.height / 2) / (pxPerMeter * TILT_Y);

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

