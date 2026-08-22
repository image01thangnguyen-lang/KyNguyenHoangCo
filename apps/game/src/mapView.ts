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
import { AssetLoader } from './assets/assetLoader.ts';
import { Entity } from './entities/entity.ts';
import { PlayerEntity } from './entities/playerEntity.ts';
import { BeastEntity } from './entities/beastEntity.ts';
import { StructureEntity } from './entities/structureEntity.ts';
import { WorldDropEntity } from './entities/worldDropEntity.ts';
import { GameCamera } from './camera/gameCamera.ts';
import { CombatVFXSystem } from './vfx/combatVFX.ts';
import { WeatherOverlaySystem } from './vfx/weatherOverlays.ts';
import { SpriteSheetAnimator, type EntityState } from './animation/spriteSheetAnimator.ts';
import { type EntityCatalogId, mapBeastSpeciesToCatalog, getCatalogEntry } from './animation/entityCatalog.ts';
import { YSortManager } from './animation/ySortManager.ts';

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
  /** Delta time (giây) giữa các frame để đồng bộ chuyển động và Camera Lerp mượt mà */
  dt?: number;
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

/** Bảng màu bản đồ phong cách Illustrated 2.5D (Vibrant Lush Green Meadows & Warm Casual World) */
const PALETTE = {
  day: {
    parchment: '#62b535', // Thảm cỏ xanh mướt mắt Vibrant Green (Illustrated Hay Day/FarmVille style)
    parchmentTexture: '#529e28', // Mảng cỏ xanh tự nhiên êm dịu
    blockFill: '#58a82d', // Khối đất cỏ phân lô xanh tươi
    blockStroke: '#417d1f',
    roadMain: '#b48a56', // Đường đất nện màu nâu mật ong sáng
    roadMainCasing: '#634321', // Viền rãnh đất nâu ấm
    roadSec: '#a17845', // Lối mòn đất
    roadSecCasing: '#563617',
    roadTrail: '#8c6537',
    roadTrailCasing: '#4a2c10',
    parkFill: '#2f6e22', // Rừng rậm nguyên sinh xanh ngọc bích
    parkStroke: '#1b4a12',
    parkInner: '#255e1b',
    waterFill: '#1e78a6', // Mặt nước sông hồ xanh biếc ngọc bích
    waterStroke: '#104d6e',
    waterShimmer: 'rgba(224, 242, 254, 0.75)',
    sandShore: '#d8b475', // Bờ cát vàng nắng viền mép nước
    textInk: '#ffffff', // Chữ trắng nổi bật trên nền cỏ xanh
    textGold: '#fde047', // Chữ vàng kim
    textSec: '#fef08a',
    gridLine: 'rgba(255, 255, 255, 0.10)',
    sealRed: '#ef4444', // Dấu triện son đỏ
  },
  evening: {
    parchment: '#487a28', // Cỏ hoàng hôn màu lục ấm
    parchmentTexture: '#3c671f',
    blockFill: '#417023',
    blockStroke: '#2d4d16',
    roadMain: '#8c683b',
    roadMainCasing: '#4e3317',
    roadSec: '#7c572e',
    roadSecCasing: '#3f250c',
    roadTrail: '#6b4722',
    roadTrailCasing: '#331d08',
    parkFill: '#24561c',
    parkStroke: '#14380e',
    parkInner: '#1c4815',
    waterFill: '#18587c',
    waterStroke: '#0d3852',
    waterShimmer: 'rgba(253, 224, 71, 0.55)',
    sandShore: '#bda066',
    textInk: '#fef3c7',
    textGold: '#fde047',
    textSec: '#fcd34d',
    gridLine: 'rgba(251, 191, 36, 0.12)',
    sealRed: '#ef4444',
  },
  night: {
    parchment: '#183424', // Cỏ đêm xanh lục sẫm huyền ảo
    parchmentTexture: '#12261a',
    blockFill: '#1b3d2b',
    blockStroke: '#0d2217',
    roadMain: '#4f6145',
    roadMainCasing: '#293721',
    roadSec: '#415237',
    roadSecCasing: '#202d1a',
    roadTrail: '#33432b',
    roadTrailCasing: '#172212',
    parkFill: '#11301d',
    parkStroke: '#081d10',
    parkInner: '#0d2516',
    waterFill: '#12415c',
    waterStroke: '#09293c',
    waterShimmer: 'rgba(186, 230, 253, 0.65)',
    sandShore: '#736147',
    textInk: '#f8fafc',
    textGold: '#7dd3fc',
    textSec: '#cbd5e1',
    gridLine: 'rgba(125, 211, 252, 0.14)',
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

// Static roads never change during a session. Index their precomputed bounds once
// so each frame inspects only roads near the camera instead of all 7,913 records.
// A road is inserted into every intersecting cell, preserving exactly the previous
// visibility result even for long roads crossing a cell boundary.
const ROAD_GRID_CELL_DEGREES = 0.01;
const ROAD_SPATIAL_INDEX = new Map<string, OsmRoad[]>();
const roadGridKey = (latCell: number, lonCell: number): string => `${latCell}:${lonCell}`;
for (const road of OSM_ROADS) {
  const minLatCell = Math.floor(road.minLat / ROAD_GRID_CELL_DEGREES);
  const maxLatCell = Math.floor(road.maxLat / ROAD_GRID_CELL_DEGREES);
  const minLonCell = Math.floor(road.minLon / ROAD_GRID_CELL_DEGREES);
  const maxLonCell = Math.floor(road.maxLon / ROAD_GRID_CELL_DEGREES);
  for (let latCell = minLatCell; latCell <= maxLatCell; latCell++) {
    for (let lonCell = minLonCell; lonCell <= maxLonCell; lonCell++) {
      const key = roadGridKey(latCell, lonCell);
      const bucket = ROAD_SPATIAL_INDEX.get(key);
      if (bucket) bucket.push(road);
      else ROAD_SPATIAL_INDEX.set(key, [road]);
    }
  }
}

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
  private lastProject: ((at: LatLon) => [number, number]) | null = null;
  private lastUnproject: ((cx: number, cy: number) => LatLon) | null = null;

  // HỆ THỐNG ASSET LOADER, CAMERA & HIỆU ỨNG THỊ GIÁC 2.5D
  readonly assetLoader = AssetLoader.getInstance();
  readonly gameCamera = new GameCamera();
  readonly combatVFX = new CombatVFXSystem();
  readonly weatherOverlay = new WeatherOverlaySystem();
  readonly playerEntity = new PlayerEntity('player');
  readonly ySortManager = new YSortManager();
  private beastAnimatorsMap = new Map<string, SpriteSheetAnimator>();

  // HỆ THỐNG CAMERA WORLD SPACE & LERP SMOOTHING
  private cameraLat: number | null = null;
  private cameraLon: number | null = null;
  private cameraLerpSpeed = 4.5;
  private lastRenderTime = 0;

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

  public isRainingNow = false;
  public rainIntensityNow = 0;

  /** Sinh hạt bụi đất/cát văng nhẹ dưới chân khi di chuyển hoặc dẫm chân */
  public spawnFootDust(x: number, y: number, count = 3, color = 'rgba(197, 160, 110, 0.45)'): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.4 + Math.random() * 1.2) * this.dpr;
      this.stepDustParticles.push({
        x: x + (Math.random() - 0.5) * 6 * this.dpr,
        y: y + (Math.random() - 0.5) * 3 * this.dpr,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.5 - 0.3 * this.dpr,
        r: (1.8 + Math.random() * 2.2) * this.dpr,
        alpha: 0.5 + Math.random() * 0.3,
      });
    }
  }

  private ensureAoePatterns(): void {
    if (this.patternGrassDay && this.patternDirt && this.patternSteppe) return;
    if (typeof document === 'undefined') return;

    // 1. MẪU CỎ ILLUSTRATED 2.5D BAN NGÀY (Lush Vibrant Green Meadow - 128x128px)
    const size = 128;
    const cGrass = document.createElement('canvas');
    cGrass.width = size;
    cGrass.height = size;
    const ctxG = cGrass.getContext('2d');
    if (ctxG) {
      // 1.1 Nền cỏ xanh mướt mắt Vibrant Green (Hay Day / FarmVille style)
      ctxG.fillStyle = '#62b535';
      ctxG.fillRect(0, 0, size, size);

      // 1.2 Mảng màu loang êm dịu tạo độ sâu đồi cỏ (Soft Organic Tonal Gradient)
      const patchGradients = [
        { x: 36, y: 36, r: 42, c: 'rgba(125, 206, 68, 0.32)' }, // Vùng sáng nắng
        { x: 98, y: 88, r: 46, c: 'rgba(142, 224, 78, 0.28)' },
        { x: 88, y: 28, r: 36, c: 'rgba(82, 160, 42, 0.25)' },  // Vùng dịu mát
        { x: 28, y: 98, r: 38, c: 'rgba(74, 150, 38, 0.25)' },
      ];
      for (const p of patchGradients) {
        const rad = ctxG.createRadialGradient(p.x, p.y, 4, p.x, p.y, p.r);
        rad.addColorStop(0, p.c);
        rad.addColorStop(1, 'rgba(98, 181, 53, 0)');
        ctxG.fillStyle = rad;
        ctxG.beginPath();
        ctxG.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctxG.fill();
      }

      // 1.3 KHÓM CỎ & HOA NHỎ ĐIỂM XUYẾT HỮU CƠ (Chỉ vẽ 12 cụm thưa thớt, không đốm đen)
      const tuftCount = 12;
      for (let i = 0; i < tuftCount; i++) {
        const gx = Math.floor((i * 43 + 17) % size);
        const gy = Math.floor((i * 61 + 29) % size);
        const rand = ((i * 73 + 19) % 100) / 100;

        // Bóng chân cỏ xanh sẫm mềm
        ctxG.fillStyle = 'rgba(40, 90, 20, 0.22)';
        ctxG.beginPath();
        ctxG.ellipse(gx, gy + 1, 3.0, 1.2, 0, 0, Math.PI * 2);
        ctxG.fill();

        // 2-3 ngọn cỏ xinh xắn vươn lên
        const bH = 3.5 + rand * 3.0;
        ctxG.strokeStyle = '#85dc3c';
        ctxG.lineWidth = 1.2;
        ctxG.lineCap = 'round';
        ctxG.beginPath();
        ctxG.moveTo(gx - 1, gy);
        ctxG.quadraticCurveTo(gx - 2.5, gy - bH * 0.6, gx - 2, gy - bH * 0.85);
        ctxG.moveTo(gx, gy);
        ctxG.quadraticCurveTo(gx + 0.5, gy - bH * 0.7, gx + 0.2, gy - bH);
        ctxG.moveTo(gx + 1, gy);
        ctxG.quadraticCurveTo(gx + 2.5, gy - bH * 0.5, gx + 2.2, gy - bH * 0.8);
        ctxG.stroke();

        // Chóp ngọn cỏ đón nắng vàng chanh
        ctxG.fillStyle = '#bbf7d0';
        ctxG.fillRect(gx, Math.round(gy - bH), 1.2, 1.2);

        // Hoa cúc trắng / hoa vàng nhỏ xinh (chỉ 25% khóm)
        if (rand > 0.72) {
          ctxG.fillStyle = rand > 0.85 ? '#ffffff' : '#fef08a';
          ctxG.beginPath();
          ctxG.arc(gx + 2.2, gy - bH * 0.85, 1.2, 0, Math.PI * 2);
          ctxG.fill();
        }
      }

      this.patternGrassDay = this.ctx.createPattern(cGrass, 'repeat');
    }

    // 2. MẪU CỎ ILLUSTRATED 2.5D BAN ĐÊM (Moonlit Lush Meadow - 128x128px)
    const cGrassN = document.createElement('canvas');
    cGrassN.width = size;
    cGrassN.height = size;
    const ctxGN = cGrassN.getContext('2d');
    if (ctxGN) {
      ctxGN.fillStyle = '#183424';
      ctxGN.fillRect(0, 0, size, size);

      // Sắc thái đêm trăng êm dịu
      const patchGradN = [
        { x: 36, y: 36, r: 42, c: 'rgba(32, 74, 50, 0.35)' },
        { x: 98, y: 88, r: 46, c: 'rgba(38, 86, 58, 0.30)' },
      ];
      for (const p of patchGradN) {
        const rad = ctxGN.createRadialGradient(p.x, p.y, 4, p.x, p.y, p.r);
        rad.addColorStop(0, p.c);
        rad.addColorStop(1, 'rgba(24, 52, 36, 0)');
        ctxGN.fillStyle = rad;
        ctxGN.beginPath();
        ctxGN.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctxGN.fill();
      }

      // Khóm ngọn cỏ đêm ánh trăng (thưa thớt)
      for (let i = 0; i < 10; i++) {
        const gx = Math.floor((i * 47 + 19) % size);
        const gy = Math.floor((i * 67 + 31) % size);

        ctxGN.fillStyle = 'rgba(8, 20, 14, 0.35)';
        ctxGN.beginPath();
        ctxGN.ellipse(gx, gy + 1, 2.5, 1.0, 0, 0, Math.PI * 2);
        ctxGN.fill();

        ctxGN.strokeStyle = '#2d6143';
        ctxGN.lineWidth = 1.0;
        ctxGN.lineCap = 'round';
        ctxGN.beginPath();
        ctxGN.moveTo(gx, gy);
        ctxGN.lineTo(gx - 0.5, gy - 4.5);
        ctxGN.stroke();

        ctxGN.fillStyle = '#5eead4';
        ctxGN.fillRect(gx - 0.5, gy - 5, 1.0, 1.0);
      }

      this.patternGrassNight = this.ctx.createPattern(cGrassN, 'repeat');
    }

    // 3. MẪU ĐẤT NÂU ẤM ILLUSTRATED (Warm Honey Clay Soil)
    const cDirt = document.createElement('canvas');
    cDirt.width = size;
    cDirt.height = size;
    const ctxD = cDirt.getContext('2d');
    if (ctxD) {
      ctxD.fillStyle = '#9e7545';
      ctxD.fillRect(0, 0, size, size);
      const radD = ctxD.createRadialGradient(48, 48, 6, 48, 48, 54);
      radD.addColorStop(0, 'rgba(182, 140, 88, 0.45)');
      radD.addColorStop(1, 'rgba(138, 98, 54, 0)');
      ctxD.fillStyle = radD;
      ctxD.fillRect(0, 0, size, size);

      this.patternDirt = this.ctx.createPattern(cDirt, 'repeat');
    }

    // 4. MẪU THẢO NGUYÊN VÀNG NẮNG
    const cSteppe = document.createElement('canvas');
    cSteppe.width = size;
    cSteppe.height = size;
    const ctxS = cSteppe.getContext('2d');
    if (ctxS) {
      ctxS.fillStyle = '#7a8e32';
      ctxS.fillRect(0, 0, size, size);
      this.patternSteppe = this.ctx.createPattern(cSteppe, 'repeat');
    }

    // 5. MẪU NỀN RỪNG MÙN NGUYÊN SINH
    const cForest = document.createElement('canvas');
    cForest.width = size;
    cForest.height = size;
    const ctxF = cForest.getContext('2d');
    if (ctxF) {
      ctxF.fillStyle = '#22481b';
      ctxF.fillRect(0, 0, size, size);
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
    if (this.lastInput) {
      this.cameraLat = this.lastInput.center.lat;
      this.cameraLon = this.lastInput.center.lon;
    }
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

    // 1. TÍNH TOÁN DELTA TIME & CAMERA SMOOTHING (LERP)
    const now = performance.now();
    const dt = input.dt ?? (this.lastRenderTime > 0 ? Math.min(0.1, Math.max(0.001, (now - this.lastRenderTime) / 1000)) : 0.016);
    this.lastRenderTime = now;

    const targetCenterLat = Number.isFinite(input.center?.lat) ? input.center.lat : 21.0285;
    const targetCenterLon = Number.isFinite(input.center?.lon) ? input.center.lon : 105.8542;

    if (
      this.cameraLat === null ||
      this.cameraLon === null ||
      !Number.isFinite(this.cameraLat) ||
      !Number.isFinite(this.cameraLon)
    ) {
      this.cameraLat = targetCenterLat;
      this.cameraLon = targetCenterLon;
    } else {
      const distFromTarget = distanceMeters(
        { lat: this.cameraLat, lon: this.cameraLon },
        { lat: targetCenterLat, lon: targetCenterLon },
      );
      if (!Number.isFinite(distFromTarget) || distFromTarget > 120) {
        // Dịch chuyển quá xa (hồi sinh / teleport) -> Snap tức thời
        this.cameraLat = targetCenterLat;
        this.cameraLon = targetCenterLon;
      } else {
        // Exponential Decay Camera Lerp: Bám đuổi mượt mà không phụ thuộc FPS
        const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(0.1, dt) : 0.016;
        const lerpSpeed = Number.isFinite(this.cameraLerpSpeed) ? this.cameraLerpSpeed : 10.0;
        const factor = Math.max(0, Math.min(1, 1 - Math.exp(-lerpSpeed * safeDt)));
        if (Number.isFinite(factor) && factor > 0) {
          this.cameraLat += (targetCenterLat - this.cameraLat) * factor;
          this.cameraLon += (targetCenterLon - this.cameraLon) * factor;
        } else {
          this.cameraLat = targetCenterLat;
          this.cameraLon = targetCenterLon;
        }
      }
    }

    const camLat = this.cameraLat;
    const camLon = this.cameraLon;

    // Góc nghiêng nhẹ 2.5D tạo chiều sâu bản đồ đô thị
    const TILT_Y = 0.72;
    const baseSpan = input.spanMeters ?? 28;
    const spanMeters = baseSpan / this.zoomFactor;
    const pxPerMeter = Math.min(w, h) / spanMeters;
    const palette = PALETTE[input.phase];

    // PHÉP CHIẾU THẾ GIỚI -> MÀN HÌNH THEO CAMERA
    const project = (at: LatLon): [number, number] => {
      const latDegM = metersToLatDegrees(1) || 1e-5;
      const lonDegM = metersToLonDegrees(1, Number.isFinite(camLat) ? camLat : 21.0) || 1e-5;
      const safePxPerM = Number.isFinite(pxPerMeter) && pxPerMeter > 0 ? pxPerMeter : 10;
      const safePanX = Number.isFinite(this.panX) ? this.panX : 0;
      const safePanY = Number.isFinite(this.panY) ? this.panY : 0;

      const targetLat = Number.isFinite(at?.lat) ? at.lat : camLat;
      const targetLon = Number.isFinite(at?.lon) ? at.lon : camLon;

      const dx = (targetLon - camLon) / lonDegM;
      const dy = (targetLat - camLat) / latDegM;
      const sx = w / 2 + dx * safePxPerM + safePanX;
      const sy = h / 2 - dy * safePxPerM * TILT_Y + safePanY;
      return [Number.isFinite(sx) ? sx : w / 2, Number.isFinite(sy) ? sy : h / 2];
    };
    this.lastProject = project;
    this.nearestAttackingBeast = null;
    this.isRainingNow = Boolean(input.weather?.raining);
    this.rainIntensityNow = input.weather?.rainIntensity ?? 1;

    const unproject = (cx: number, cy: number): LatLon => {
      const dx = (cx - w / 2 - this.panX) / (pxPerMeter || 1);
      const dy = -(cy - h / 2 - this.panY) / ((pxPerMeter * TILT_Y) || 1);
      return {
        lat: camLat + dy * metersToLatDegrees(1),
        lon: camLon + dx * metersToLonDegrees(1, camLat),
      };
    };
    this.lastUnproject = unproject;

    ctx.save();

    // =========================================================================
    // GIAI ĐOẠN 1: TẦNG NỀN MẶT ĐẤT (GROUND LAYER - FLAT, VẼ TRƯỚC)
    // =========================================================================

    // 1. Tầng nền địa hình thảm cỏ xanh mướt đồng nhất chuẩn Đế Chế (AoE 1 Seamless Grassland Surface)
    this.drawTerrainGroundBase(w, h, palette, input, project, pxPerMeter, TILT_Y, camLat, camLon);

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

    // 4b. Hệ Thống Dấu Chân & Hiệu Ứng Hạt Bùn/Cát (Footprint System & Particle Splash)
    this.drawDinoFootprintsAndParticles(w, h, input, project, pxPerMeter, TILT_Y);

    // 4c. Lãnh địa dã thú sương đỏ (Red Mist Beast Territories)
    this.drawBeastTerritories(project, pxPerMeter, palette);

    // Reset danh sách hitboxes tương tác cho frame hiện tại
    this.renderedFarmPlots = [];
    this.renderedStations = [];
    this.renderedCampBounds = null;

    // =========================================================================
    // GIAI ĐOẠN 2: TẦNG Y-SORTING (2.5D DEPTH SORTING - VẬT THỂ CÓ CHIỀU CAO)
    // =========================================================================
    interface YSortEntity {
      sortY: number;
      render: (ctx: CanvasRenderingContext2D) => void;
    }
    const ySortedEntities: YSortEntity[] = [];

    // 2a. Tảng đá & khối đá tự nhiên
    this.collectNaturalBoulders(w, h, input, project, pxPerMeter, TILT_Y, camLat, camLon, ySortedEntities);

    // 2b. Cảnh quan kỷ khủng long điểm xuyết (Dương xỉ cổ & Hóa thạch xương khủng long)
    this.collectPrehistoricAccents(w, h, input, project, pxPerMeter, TILT_Y, ySortedEntities);

    // 2c. Tầng Quần Xã Dã Thú, Khủng Long & Cảnh Quan Cây Cối
    this.collectWildlifeAndEnvironment(w, h, palette, input, project, pxPerMeter, TILT_Y, camLat, camLon, ySortedEntities);

    // 2d. Căn Cứ / Doanh Trại Người Chơi (2.5D Isometric Stronghold)
    if (input.camp && input.homeCellCenter) {
      this.drawPlayerStronghold(project(input.homeCellCenter), pxPerMeter, input, palette, ySortedEntities);
    }

    // 2e. Các địa danh, di tích, mỏ tài nguyên (Solid Features)
    for (const feature of this.cachedSolidFeatures) {
      const [fx, fy] = project(feature);
      if (fx >= -80 && fx <= w + 80 && fy >= -80 && fy <= h + 80) {
        ySortedEntities.push({
          sortY: fy,
          render: () => this.drawFloatingFeatureBadge(feature, project, pxPerMeter, input, palette),
        });
      }
    }

    // 2f. Bẫy thú nổi 3D
    if (input.traps && input.traps.length > 0) {
      for (const trap of input.traps) {
        const [tx, ty] = project({ lat: trap.lat, lon: trap.lon });
        if (tx >= -40 && tx <= w + 40 && ty >= -40 && ty <= h + 40) {
          ySortedEntities.push({
            sortY: ty,
            render: () => this.drawSingleTrap(trap, tx, ty, input),
          });
        }
      }
    }

    // 2g. Vật phẩm rơi (World Drops) nổi 3D
    if (input.drops && input.drops.length > 0) {
      for (const drop of input.drops) {
        const [dx, dy] = project({ lat: drop.lat, lon: drop.lon });
        if (dx >= -50 && dx <= w + 50 && dy >= -50 && dy <= h + 50) {
          ySortedEntities.push({
            sortY: dy,
            render: () => this.drawSingleDrop(drop, dx, dy, input),
          });
        }
      }
    }

    // 2h. Nhân vật Dũng Sĩ Hoàng Cổ đứng giữa không gian thế giới
    const [playerScreenX, playerScreenY] = project(input.center);
    ySortedEntities.push({
      sortY: playerScreenY,
      render: (c) => {
        if (this.playerStealthState.isStealthed) {
          c.save();
          c.globalAlpha = 0.55;
          this.drawPlayer(playerScreenX, playerScreenY, pxPerMeter, input, palette);
          c.restore();
        } else {
          this.drawPlayer(playerScreenX, playerScreenY, pxPerMeter, input, palette);
        }
      },
    });

    // Sắp xếp thứ tự chiều sâu (Y-Sorting: Tọa độ Y nhỏ hơn vẽ trước, Y lớn hơn vẽ sau)
    ySortedEntities.sort((a, b) => a.sortY - b.sortY);

    // Duyệt vẽ tuần tự toàn bộ thực thể 2.5D đã được phân tầng
    for (const entity of ySortedEntities) {
      entity.render(ctx);
    }

    // =========================================================================
    // GIAI ĐOẠN 3: TẦNG TRÊN KHÔNG & SCREEN OVERLAY (VẼ TRÊN CÙNG)
    // =========================================================================

    // 3a. HUD Ẩn nấp của người chơi
    if (this.playerStealthState.isStealthed) {
      this.drawDinoStealthHud(w, h, playerScreenX, playerScreenY);
    }

    // 3b. Vạch chỉ báo ngắm bắn khi người chơi đang giữ và kéo nút tấn công
    if (input.isAiming) {
      this.drawAimingIndicator(ctx, playerScreenX, playerScreenY, input, pxPerMeter);
    }

    // 3c. Linh Điểu Tiền Sử bay lượn trên cao & Vệt Gió Thần Tốc khi di chuyển nhanh
    if (input.speedKmh && input.speedKmh >= 12) {
      this.drawSpiritBirdAndWindTrails(w, h, playerScreenX, playerScreenY, input.speedKmh, palette);
    }

    // 3d. Hiệu ứng Số Máu Bị Trừ & Viền Máu Đỏ Màn Hình khi bị thú dữ tấn công
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
      const vigR0 = Math.max(1, Math.min(w, h) * 0.3);
      const vigR1 = Math.max(vigR0 + 1, Math.max(w, h) * 0.75);
      const vig = ctx.createRadialGradient(w / 2, h / 2, vigR0, w / 2, h / 2, vigR1);
      vig.addColorStop(0, 'rgba(239, 68, 68, 0)');
      vig.addColorStop(0.7, `rgba(220, 38, 38, ${this.hitFlashAlpha * 0.4})`);
      vig.addColorStop(1, `rgba(185, 28, 28, ${this.hitFlashAlpha})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
      this.hitFlashAlpha = Math.max(0, this.hitFlashAlpha - 0.035);
      ctx.restore();
    }

    // 3e. Vẽ đường đạn tầm xa (mũi tên, viên đá bay parabol), vệt chém cận chiến & tia lửa
    this.drawActiveProjectiles(ctx, w, h);
    this.drawMeleeSlashes(ctx);
    this.drawImpactSparks(ctx);

    // 3f. Hiệu ứng Số Sát Thương Gây Ra Cho Dã Thú (Floating Damage Text)
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

    // 3g. Hiệu ứng chiến đấu Combat VFX (Vệt chém, tia va chạm, đạn đạo)
    this.combatVFX.update(dt || 0.016);
    this.combatVFX.render(ctx, this.dpr);

    // 3h. Hiệu ứng thời tiết (Mưa, Tuyết, Sương mù)
    const weatherType = input.weather?.raining
      ? 'rain'
      : (input.weather as any)?.snowing
      ? 'snow'
      : (input.weather as any)?.foggy
      ? 'mist'
      : 'clear';
    this.weatherOverlay.setWeather(weatherType, input.weather?.rainIntensity ?? 1.0);
    this.weatherOverlay.update(dt || 0.016, this.tick);
    this.weatherOverlay.render(ctx, w, h, this.dpr);

    // 3i. Hoa La Bàn Cổ Kính (Compass Rose)
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
    const coneRadius = Math.max(2, (isAiming ? 34 : 24) * this.dpr);
    const coneAngle = isAiming ? 0.35 : 0.52;
    const grad = ctx.createRadialGradient(0, 0, Math.max(0.1, 4 * this.dpr), 0, 0, coneRadius);
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
    camLat: number,
    camLon: number,
  ): void {
    const { ctx } = this;
    this.ensureAoePatterns();

    const isNight = input.isNight ?? (input.phase === 'night' || input.phase === 'bloodmoon');

    const WORLD_ORIGIN_LAT = 21.0;
    const WORLD_ORIGIN_LON = 105.8;

    const camWorldX = (camLon - WORLD_ORIGIN_LON) / (metersToLonDegrees(1, camLat) || 1e-5);
    const camWorldY = (camLat - WORLD_ORIGIN_LAT) / (metersToLatDegrees(1) || 1e-5);

    // 1. NỀN GIẤY DA CỔ KÍNH HOÀNG CỔ (Antique Parchment Texture Ground)
    const baseParchmentGrad = ctx.createLinearGradient(0, 0, w, h);
    if (isNight) {
      baseParchmentGrad.addColorStop(0, '#151c14');
      baseParchmentGrad.addColorStop(0.5, '#1e281c');
      baseParchmentGrad.addColorStop(1, '#0f1710');
    } else {
      baseParchmentGrad.addColorStop(0, '#f5ebe0');
      baseParchmentGrad.addColorStop(0.5, '#ebdccb');
      baseParchmentGrad.addColorStop(1, '#dfcbb5');
    }
    ctx.fillStyle = baseParchmentGrad;
    ctx.fillRect(0, 0, w, h);

    // 1.1 Vẽ chất liệu giấy da từ AssetLoader
    const parchmentSprite = this.assetLoader.get('terrain_parchment');
    if (parchmentSprite) {
      ctx.save();
      ctx.globalAlpha = isNight ? 0.35 : 0.65;
      const patternSize = 512;
      const safeShiftX = (((w / 2 + this.panX - camWorldX * pxPerMeter) % patternSize) + patternSize) % patternSize;
      const safeShiftY = (((h / 2 + this.panY + camWorldY * pxPerMeter * TILT_Y) % patternSize) + patternSize) % patternSize;
      for (let px = safeShiftX - patternSize; px < w + patternSize; px += patternSize) {
        for (let py = safeShiftY - patternSize; py < h + patternSize; py += patternSize) {
          ctx.drawImage(parchmentSprite, px, py, patternSize, patternSize);
        }
      }
      ctx.restore();
    }

    // 1.2 ĐƯỜNG ĐỒNG MỨC ĐỊA HÌNH CỔ KÍNH (Topographic Contour Isolines)
    ctx.save();
    ctx.strokeStyle = isNight ? 'rgba(80, 110, 75, 0.18)' : 'rgba(160, 118, 70, 0.22)';
    ctx.lineWidth = 1.2 * this.dpr;
    ctx.setLineDash([8 * this.dpr, 12 * this.dpr]);
    const contourStep = 64 * pxPerMeter;
    const shiftX = (((w / 2 + this.panX - camWorldX * pxPerMeter) % contourStep) + contourStep) % contourStep;
    const shiftY = (((h / 2 + this.panY + camWorldY * pxPerMeter * TILT_Y) % contourStep) + contourStep) % contourStep;
    for (let y = shiftY - contourStep; y < h + contourStep; y += contourStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.33, y + Math.sin(y * 0.05) * 24 * this.dpr, w * 0.66, y - Math.cos(y * 0.05) * 24 * this.dpr, w, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    // 2. MẢNG CỎ ĐỒNG XANH HỮU CƠ MINH HỌA (Illustrated Lush Meadow Patches)
    const stepBare = 36;
    const spanMetersX = (w / 2 + Math.abs(this.panX) + 40 * this.dpr) / pxPerMeter + stepBare;
    const spanMetersY = (h / 2 + Math.abs(this.panY) + 40 * this.dpr) / (pxPerMeter * TILT_Y) + stepBare;

    const startWx = Math.floor((camWorldX - spanMetersX) / stepBare) * stepBare;
    const endWx = Math.ceil((camWorldX + spanMetersX) / stepBare) * stepBare;
    const startWy = Math.floor((camWorldY - spanMetersY) / stepBare) * stepBare;
    const endWy = Math.ceil((camWorldY + spanMetersY) / stepBare) * stepBare;

    for (let wy = startWy; wy <= endWy; wy += stepBare) {
      for (let wx = startWx; wx <= endWx; wx += stepBare) {
        const hash = Math.sin(wx * 37.19 + wy * 83.47) * 43758.5453;
        const rand = hash - Math.floor(hash);

        const jitterX = (Math.sin(wx * 5.7 + wy * 2.3) * 0.35) * stepBare;
        const jitterY = (Math.cos(wx * 4.1 + wy * 6.9) * 0.35) * stepBare;

        const sx = w / 2 + (wx + jitterX - camWorldX) * pxPerMeter + this.panX;
        const sy = h / 2 - (wy + jitterY - camWorldY) * pxPerMeter * TILT_Y + this.panY;

        if (sx < -60 || sx > w + 60 || sy < -60 || sy > h + 60) continue;

        ctx.save();
        if (rand > 0.45) {
          // Thảm cỏ ngọc thảo hữu cơ mộc mạc
          const mrx = Math.max(16.0 * this.dpr, (8.0 + rand * 12.0) * pxPerMeter);
          const mry = mrx * TILT_Y * 0.65;

          const grassGrad = ctx.createRadialGradient(sx, sy, 4 * this.dpr, sx, sy, mrx);
          if (isNight) {
            grassGrad.addColorStop(0, 'rgba(40, 70, 45, 0.45)');
            grassGrad.addColorStop(0.7, 'rgba(25, 45, 30, 0.25)');
            grassGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          } else {
            grassGrad.addColorStop(0, 'rgba(125, 175, 75, 0.55)');
            grassGrad.addColorStop(0.65, 'rgba(150, 195, 95, 0.35)');
            grassGrad.addColorStop(1, 'rgba(235, 220, 200, 0)');
          }
          ctx.fillStyle = grassGrad;
          ctx.beginPath();
          ctx.ellipse(sx, sy, mrx, mry, rand * 0.5, 0, Math.PI * 2);
          ctx.fill();

          // Hoa dại điểm xuyết
          if (rand > 0.75) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(sx + 4 * this.dpr, sy - 2 * this.dpr, 1.8 * this.dpr, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(sx + 4 * this.dpr, sy - 2 * this.dpr, 0.9 * this.dpr, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    }
  }

  /** Thu thập các khối đá & tảng đá rêu phong tự nhiên vào danh sách Y-Sorting */
  private collectNaturalBoulders(
    w: number,
    h: number,
    input: RenderInput,
    project: (at: LatLon) => [number, number],
    pxPerMeter: number,
    TILT_Y: number,
    camLat: number,
    camLon: number,
    outEntities: Array<{ sortY: number; render: (ctx: CanvasRenderingContext2D) => void }>,
  ): void {
    const isNight = input.isNight ?? (input.phase === 'night' || input.phase === 'bloodmoon');
    const WORLD_ORIGIN_LAT = 21.0;
    const WORLD_ORIGIN_LON = 105.8;

    const camWorldX = (camLon - WORLD_ORIGIN_LON) / metersToLonDegrees(1, camLat);
    const camWorldY = (camLat - WORLD_ORIGIN_LAT) / metersToLatDegrees(1);

    const stepRock = 36; // Lưới 36m cho các khối đá
    const spanRocksX = (w / 2 + Math.abs(this.panX) + 40 * this.dpr) / pxPerMeter + stepRock;
    const spanRocksY = (h / 2 + Math.abs(this.panY) + 40 * this.dpr) / (pxPerMeter * TILT_Y) + stepRock;

    const startRockX = Math.floor((camWorldX - spanRocksX) / stepRock) * stepRock;
    const endRockX = Math.ceil((camWorldX + spanRocksX) / stepRock) * stepRock;
    const startRockY = Math.floor((camWorldY - spanRocksY) / stepRock) * stepRock;
    const endRockY = Math.ceil((camWorldY + spanRocksY) / stepRock) * stepRock;

    for (let wy = startRockY; wy <= endRockY; wy += stepRock) {
      for (let wx = startRockX; wx <= endRockX; wx += stepRock) {
        const hash = Math.sin(wx * 43.17 + wy * 97.53) * 31415.9265;
        const rand = hash - Math.floor(hash);

        // Xuất hiện ở ~35% vị trí (thưa thớt, tự nhiên, điểm xuyết cảnh quan)
        if (rand > 0.35) continue;

        const jitterX = (Math.sin(wx * 3.7 + wy * 8.1) * 0.38) * stepRock;
        const jitterY = (Math.cos(wx * 7.3 + wy * 4.9) * 0.38) * stepRock;

        const sx = w / 2 + (wx + jitterX - camWorldX) * pxPerMeter + this.panX;
        const sy = h / 2 - (wy + jitterY - camWorldY) * pxPerMeter * TILT_Y + this.panY;

        if (sx < -40 || sx > w + 40 || sy < -40 || sy > h + 40) continue;

        const rockScale = (1.4 + rand * 1.5) * this.dpr; // Kích thước khối đá
        const rockType = Math.floor(rand * 3); // 3 kiểu khối đá phong phú

        outEntities.push({
          sortY: sy,
          render: (ctx) => {
            this.drawSingleBoulder(ctx, sx, sy, rockScale, rockType, isNight);
          },
        });
      }
    }
  }

  private drawSingleBoulder(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    rockScale: number,
    rockType: number,
    isNight: boolean,
  ): void {
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
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(2 * rockScale, 2 * rockScale, 8 * rockScale, 3.8 * rockScale, 0.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isNight ? '#243044' : '#576579';
      ctx.beginPath();
      ctx.ellipse(-4 * rockScale, 0, 4 * rockScale, 3 * rockScale, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = isNight ? '#3b495e' : '#8291a4';
      ctx.beginPath();
      ctx.ellipse(-4.8 * rockScale, -1.2 * rockScale, 2.2 * rockScale, 1.5 * rockScale, -0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isNight ? '#1e293b' : '#475569';
      ctx.beginPath();
      ctx.ellipse(2 * rockScale, -1 * rockScale, 5.8 * rockScale, 4.5 * rockScale, 0.15, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isNight ? '#334155' : '#718298';
      ctx.beginPath();
      ctx.ellipse(1 * rockScale, -2.5 * rockScale, 4.2 * rockScale, 2.8 * rockScale, 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = isNight ? '#475569' : '#a1b2c6';
      ctx.beginPath();
      ctx.arc(0.5 * rockScale, -3.8 * rockScale, 1.8 * rockScale, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isNight ? '#166534' : '#4d9b26';
      ctx.fillRect(1 * rockScale, -4.5 * rockScale, 2.0 * rockScale, 1.0 * rockScale);

    } else {
      // KIỂU 3: Mỏm Đá Sa Thạch Nâu Đất Góc Cạnh (Angular Sandstone Monolith)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
      ctx.beginPath();
      ctx.ellipse(3 * rockScale, 3 * rockScale, 8.5 * rockScale, 4.0 * rockScale, 0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isNight ? '#261c14' : '#573d23';
      ctx.beginPath();
      ctx.moveTo(0, -9 * rockScale);
      ctx.lineTo(7 * rockScale, -4 * rockScale);
      ctx.lineTo(8 * rockScale, 2 * rockScale);
      ctx.lineTo(2 * rockScale, 5 * rockScale);
      ctx.lineTo(0, -2 * rockScale);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = isNight ? '#3d2e20' : '#88623a';
      ctx.beginPath();
      ctx.moveTo(0, -9 * rockScale);
      ctx.lineTo(-6 * rockScale, -3 * rockScale);
      ctx.lineTo(-5 * rockScale, 3 * rockScale);
      ctx.lineTo(2 * rockScale, 5 * rockScale);
      ctx.lineTo(0, -2 * rockScale);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = isNight ? '#554231' : '#b28452';
      ctx.beginPath();
      ctx.moveTo(0, -9 * rockScale);
      ctx.lineTo(3 * rockScale, -6 * rockScale);
      ctx.lineTo(-2 * rockScale, -5 * rockScale);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = isNight ? '#1a130d' : '#442d17';
      ctx.lineWidth = 0.9 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(-5 * rockScale, -1 * rockScale);
      ctx.lineTo(1 * rockScale, 1.5 * rockScale);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ================================================================
  // 4e. TẦNG QUẦN XÃ DÃ THÚ & SINH CẢNH THIÊN NHIÊN (Y-SORTING RENDER TRÊN MẶT ĐẤT VÀ MẶT ĐƯỜNG)
  // ================================================================

  private collectWildlifeAndEnvironment(
    w: number,
    h: number,
    palette: typeof PALETTE.day,
    input: RenderInput,
    project: (at: LatLon) => [number, number],
    pxPerMeter: number,
    TILT_Y: number,
    camLat: number,
    camLon: number,
    outEntities: Array<{ sortY: number; render: (ctx: CanvasRenderingContext2D) => void }>,
  ): void {
    const WORLD_ORIGIN_LAT = 21.0;
    const WORLD_ORIGIN_LON = 105.8;

    const camWorldX = (camLon - WORLD_ORIGIN_LON) / metersToLonDegrees(1, camLat);
    const camWorldY = (camLat - WORLD_ORIGIN_LAT) / metersToLatDegrees(1);

    const stepWildlife = 125; // Khoảng cách ô sinh thái 125m: mật độ vừa vặn, sống động, khám phá là gặp khủng long
    const spanMetersX = (w / 2 + Math.abs(this.panX) + 60 * this.dpr) / pxPerMeter + stepWildlife * 2;
    const spanMetersY = (h / 2 + Math.abs(this.panY) + 60 * this.dpr) / (pxPerMeter * TILT_Y) + stepWildlife * 2;

    const startWldX = Math.floor((camWorldX - spanMetersX) / stepWildlife) * stepWildlife;
    const endWldX = Math.ceil((camWorldX + spanMetersX) / stepWildlife) * stepWildlife;
    const startWldY = Math.floor((camWorldY - spanMetersY) / stepWildlife) * stepWildlife;
    const endWldY = Math.ceil((camWorldY + spanMetersY) / stepWildlife) * stepWildlife;

    const [playerScreenX, playerScreenY] = project(input.center);

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

        const sx = w / 2 + (drawWorldX - camWorldX) * pxPerMeter + this.panX;
        const sy = h / 2 - (drawWorldY - camWorldY) * pxPerMeter * TILT_Y + this.panY;

        if (sx < -90 * this.dpr || sx > w + 90 * this.dpr || sy < -90 * this.dpr || sy > h + 90 * this.dpr) {
          continue;
        }

        const distToPlayerMeters = Math.hypot((sx - playerScreenX) / pxPerMeter, (sy - playerScreenY) / (pxPerMeter * TILT_Y));

        if (beastObj) {
          this.renderedBeasts.push({ beast: beastObj, x: sx, y: sy, radius: 28 * this.dpr });
        }

        // VẼ TƯƠNG ỨNG TỪNG LOÀI KHỦNG LONG & DÃ THÚ 2.5D
        if (species) {
          const sType = species;
          const bObj = beastObj;
          outEntities.push({
            sortY: sy,
            render: () => {
              switch (sType) {
                case 'trex':
                  this.drawTRex(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, bObj);
                  break;
                case 'croc':
                  this.drawSarcosuchus(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, bObj);
                  break;
                case 'titanoboa':
                  this.drawTitanoboa(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, bObj);
                  break;
                case 'plesiosaur':
                  this.drawPlesiosaur(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, bObj);
                  break;
                case 'raptor':
                  this.drawVelociraptorPack(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, bObj);
                  break;
                case 'spinosaurus':
                  this.drawSpinosaurus(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, bObj);
                  break;
                case 'dilophosaurus':
                  this.drawDilophosaurus(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, bObj);
                  break;
                case 'triceratops':
                  this.drawTriceratops(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, bObj);
                  break;
                case 'ankylosaurus':
                  this.drawAnkylosaurus(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, bObj);
                  break;
                case 'brachiosaurus':
                  this.drawBrachiosaurus(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, bObj);
                  break;
                case 'pterosaur':
                  this.drawPterosaur(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, bObj);
                  break;
                case 'lion':
                  this.drawCaveLionPride(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, bObj);
                  break;
                case 'mammoth':
                  this.drawElephantHerd(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, bObj);
                  break;
                case 'wolf':
                  this.drawDireWolfPack(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, bObj);
                  break;
                case 'deer':
                  this.drawDeerHerd(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, bObj);
                  break;
                case 'sabertooth':
                  this.drawSabertoothPredator(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, bObj);
                  break;
                case 'bear':
                  this.drawCaveBear(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, bObj);
                  break;
                case 'boar':
                  this.drawGiantBoar(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, bObj);
                  break;
                case 'horse':
                  this.drawWildHorseHerd(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, bObj);
                  break;
              }
            },
          });
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

    // 3. THANH MÁU NỔI & PHÙ HIỆU KHIÊN NỘ KHÍ TRÊN ĐẦU DÃ THÚ (Floating HP Bar & Aggro Shield)
    const curHp = beast ? beast.currentHp : 50;
    const maxHp = beast ? beast.maxHp : 50;
    const hpRatio = Math.max(0, Math.min(1, curHp / maxHp));

    const headY = sy - 32 * s * this.dpr;
    const barW = Math.max(48 * this.dpr, 20 * s * this.dpr);
    const barH = 5.0 * this.dpr;
    const barX = sx - barW / 2;

    // Nền thanh máu sơn mài bóng
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(barX - 1.5 * this.dpr, headY - 1.5 * this.dpr, barW + 3 * this.dpr, barH + 3 * this.dpr, 3 * this.dpr);
    ctx.fill();

    // Ruột thanh máu gradient
    const hpGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    if (isAttacking) {
      hpGrad.addColorStop(0, '#dc2626');
      hpGrad.addColorStop(1, '#ea580c');
    } else {
      hpGrad.addColorStop(0, '#16a34a');
      hpGrad.addColorStop(0.7, '#eab308');
      hpGrad.addColorStop(1, '#f59e0b');
    }
    ctx.fillStyle = hpGrad;
    ctx.beginPath();
    ctx.roundRect(barX, headY, barW * hpRatio, barH, 2 * this.dpr);
    ctx.fill();

    // VIỀN KHIÊN NỘ KHÍ (Aggro Shield Badge)
    const shieldX = barX + barW + 8 * this.dpr;
    const shieldY = headY + barH / 2;

    ctx.fillStyle = isAttacking ? '#dc2626' : '#d97706';
    ctx.beginPath();
    ctx.moveTo(shieldX, shieldY - 6 * this.dpr);
    ctx.lineTo(shieldX + 5.5 * this.dpr, shieldY - 3 * this.dpr);
    ctx.lineTo(shieldX + 4.5 * this.dpr, shieldY + 5 * this.dpr);
    ctx.lineTo(shieldX, shieldY + 8 * this.dpr);
    ctx.lineTo(shieldX - 4.5 * this.dpr, shieldY + 5 * this.dpr);
    ctx.lineTo(shieldX - 5.5 * this.dpr, shieldY - 3 * this.dpr);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.2 * this.dpr;
    ctx.stroke();

    // Dấu chấm than nộ khí
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(shieldX - 0.8 * this.dpr, shieldY - 4 * this.dpr, 1.6 * this.dpr, 4.5 * this.dpr);
    ctx.fillRect(shieldX - 0.8 * this.dpr, shieldY + 2 * this.dpr, 1.6 * this.dpr, 1.6 * this.dpr);

    // Tên và cự ly thú dữ
    ctx.font = `bold ${8.5 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
    ctx.fillStyle = isAttacking ? '#fca5a5' : '#fde68a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${nameVi} · ${Math.round(distToPlayerMeters)}m`, sx, headY - 3 * this.dpr);

    ctx.restore();
  }

  // ================================================================
  // 18 QUÁI VẬT & KHỦNG LONG TIỀN SỬ (HD Illustrated 2.5D Sprite Engine)
  // Tỉ lệ kích thước theo mét thực tế, phóng to thu nhỏ chuẩn theo zoom (pxPerMeter)
  // và chuyển động đa tầng sống động (Nhịp thở, lúc lắc cổ/đuôi, bước chạy, bụi đất)
  // ================================================================

  private renderBeastEntity(
    sx: number,
    sy: number,
    pxPerMeter: number,
    TILT_Y: number,
    distToPlayerMeters: number,
    beastKey: string,
    nameVi: string,
    iconEmoji: string,
    meterW: number,
    meterH: number,
    beast?: DynamicBeastPack | null,
    extraOptions?: { isFlying?: boolean; isAquatic?: boolean; isSlithering?: boolean },
  ): void {
    const { ctx } = this;

    // 1. TỈ LỆ KÍCH THƯỚC THẬT: 1 mét trong game phải giống nhau với
    // người chơi và dã thú. entityCatalog là nguồn số đo duy nhất; các
    // tham số meterW/meterH chỉ là fallback cho loài chưa có catalog.
    // Nhờ vậy sprite không thể vô tình dùng lại kích thước minh họa cũ.
    const catalogId = mapBeastSpeciesToCatalog(beast?.species ?? beastKey.replace('beast_', ''));
    const catalogEntry = getCatalogEntry(catalogId);
    const actualMeterW = catalogEntry?.meterWidth ?? meterW;
    const actualMeterH = catalogEntry?.meterHeight ?? meterH;

    // Dùng cùng hệ số mét → pixel với PlayerEntity (2.5 px/m), thay vì
    // hệ số riêng khiến khủng long bị nhỏ hơn người dù số đo tính bằng mét.
    const visualScale = Math.max(0.42 * this.dpr, pxPerMeter * 2.5);
    const drawW = Math.max(28 * this.dpr, actualMeterW * visualScale);
    const drawH = Math.max(18 * this.dpr, actualMeterH * visualScale);

    // 2. Cảnh báo Nộ Khí & Thanh Máu trên đầu
    this.drawBeastAggroWarning(sx, sy, Math.max(0.6, drawH / (42 * this.dpr)), distToPlayerMeters, nameVi, iconEmoji, beast);

    const isChasing = !!beast?.isChasing;
    const isFleeing = !!beast?.isFleeing;
    const isMoving = isChasing || isFleeing || (Math.hypot(beast?.velocityX ?? 0, beast?.velocityY ?? 0) > 0.05);

    // 3. HOẠT HỌA ĐA TẦNG & SPRITESHEET ANIMATOR (6 Khung hình theo Catalog)
    const seed = (beast?.id ?? nameVi).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const dt = 0.016; // Tốc độ cập nhật frame chuẩn

    // A. Hướng quay mặt (Directional Flip)
    const vx = beast?.velocityX ?? 0;
    const flipX = vx !== 0 ? vx < 0 : (distToPlayerMeters <= 32 ? (sx < (this.canvas?.width ?? 0) / 2) : false);

    // B. Lấy hoặc khởi tạo Animator cho dã thú
    const animKey = beast?.id ?? beastKey;
    let animator = this.beastAnimatorsMap.get(animKey);
    if (!animator) {
      const catalogId = mapBeastSpeciesToCatalog(beast?.species ?? beastKey.replace('beast_', ''));
      const catalogImg = this.assetLoader.getCatalogImage();
      animator = SpriteSheetAnimator.fromCatalog(catalogId, catalogImg);
      this.beastAnimatorsMap.set(animKey, animator);
    } else if (!animator.image) {
      const catalogImg = this.assetLoader.getCatalogImage();
      if (catalogImg) animator.image = catalogImg;
    }

    // C. Cập nhật State Machine
    const targetState: EntityState = isChasing ? 'RUN' : (isMoving ? 'WALK' : 'IDLE');
    animator.setState(targetState);
    animator.facingLeft = flipX;
    animator.update(dt, isChasing ? 1.5 : 1.0);

    // D. Chuyển động môi trường chuyên biệt
    let extraOffsetY = 0;
    let extraRotation = 0;

    if (extraOptions?.isFlying) {
      const flap = Math.sin(this.tick * 0.22) * 5.0 * this.dpr;
      extraOffsetY = -22 * this.dpr + flap;
      extraRotation += Math.sin(this.tick * 0.1) * 0.08;
    } else if (extraOptions?.isAquatic) {
      extraOffsetY = Math.sin(this.tick * 0.12) * 3.0 * this.dpr;
    } else if (extraOptions?.isSlithering) {
      extraRotation += Math.sin(this.tick * 0.18) * 0.06;
    }

    ctx.save();
    const renderY = sy + extraOffsetY;

    // Bóng đổ thực thể dưới chân
    if (!extraOptions?.isFlying) {
      ctx.fillStyle = 'rgba(20, 10, 5, 0.38)';
      ctx.beginPath();
      ctx.ellipse(sx, renderY, drawW * 0.36, drawH * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(10, 15, 10, 0.20)';
      ctx.beginPath();
      ctx.ellipse(sx, renderY + 22 * this.dpr - extraOffsetY, drawW * 0.28, drawH * 0.10, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Vẽ qua SpriteSheetAnimator (nếu có ảnh) hoặc Fallback drawSprite
    if (animator.image) {
      animator.render(ctx, sx, renderY, drawW, drawH, {
        idleBreathing: true,
        flipX,
        rotation: extraRotation,
      });
    } else {
      ctx.translate(sx, renderY);
      if (extraRotation !== 0) ctx.rotate(extraRotation);
      this.assetLoader.drawSprite(ctx, beastKey, 0, 0, drawW, drawH, 1.0, flipX);
    }

    ctx.restore();
  }

  private drawTRex(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, distToPlayerMeters: number = 99, beast?: DynamicBeastPack | null): void {
    this.renderBeastEntity(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, 'beast_trex', 'Bạo Chúa T-Rex', '🦖', 12.5, 6.0, beast);
  }

  private drawAnkylosaurus(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, distToPlayerMeters: number = 99, beast?: DynamicBeastPack | null): void {
    this.renderBeastEntity(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, 'beast_ankylosaurus', 'Khủng Long Thiết Giáp', '🛡️', 8.0, 4.8, beast);
  }

  private drawTitanoboa(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, distToPlayerMeters: number = 99, beast?: DynamicBeastPack | null): void {
    this.renderBeastEntity(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, 'beast_titanoboa', 'Cự Mãng Xà Titanoboa', '🐍', 10.0, 7.0, beast, { isSlithering: true });
  }

  private drawSpinosaurus(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, distToPlayerMeters: number = 99, beast?: DynamicBeastPack | null): void {
    this.renderBeastEntity(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, 'beast_spinosaurus', 'Khủng Long Gai Thuyền', '🐊', 13.5, 6.5, beast);
  }

  private drawDilophosaurus(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, distToPlayerMeters: number = 99, beast?: DynamicBeastPack | null): void {
    this.renderBeastEntity(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, 'beast_dilophosaurus', 'Khủng Long Song Mào', '🦎', 6.5, 4.0, beast);
  }

  private drawTriceratops(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, distToPlayerMeters: number = 99, beast?: DynamicBeastPack | null): void {
    this.renderBeastEntity(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, 'beast_triceratops', 'Tam Giác Long', '🦏', 9.0, 5.0, beast);
  }

  private drawBrachiosaurus(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, distToPlayerMeters: number = 99, beast?: DynamicBeastPack | null): void {
    this.renderBeastEntity(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, 'beast_brachiosaurus', 'Khủng Long Cổ Dài', '🦕', 20.0, 11.0, beast);
  }

  private drawVelociraptorPack(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, distToPlayerMeters: number = 99, beast?: DynamicBeastPack | null): void {
    this.renderBeastEntity(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, 'beast_velociraptor', 'Bầy Raptor Săn Mồi', '🦖', 4.2, 3.0, beast);
  }

  private drawPlesiosaur(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, distToPlayerMeters: number = 99, beast?: DynamicBeastPack | null): void {
    this.renderBeastEntity(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, 'beast_plesiosaur', 'Thủy Long Hồ Tây', '🐉', 10.0, 5.0, beast, { isAquatic: true });
  }

  private drawPterosaur(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, distToPlayerMeters: number = 99, beast?: DynamicBeastPack | null): void {
    this.renderBeastEntity(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, 'beast_pterosaur', 'Dực Long Bay', '🦅', 5.5, 4.0, beast, { isFlying: true });
  }

  private drawSarcosuchus(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, distToPlayerMeters: number = 99, beast?: DynamicBeastPack | null): void {
    this.renderBeastEntity(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, 'beast_sarcosuchus', 'Cá Sấu Khổng Lồ', '🐊', 12.0, 4.5, beast, { isAquatic: true });
  }

  private drawElephantHerd(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, distToPlayerMeters: number = 99, beast?: DynamicBeastPack | null): void {
    this.renderBeastEntity(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, 'beast_mammoth', 'Đàn Voi Ma Mút', '🦣', 8.0, 6.2, beast);
  }

  private drawSabertoothPredator(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, distToPlayerMeters: number = 99, beast?: DynamicBeastPack | null): void {
    this.renderBeastEntity(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, 'beast_sabertooth', 'Cọp Răng Kiếm', '🐯', 4.2, 3.2, beast);
  }

  private drawDireWolfPack(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, distToPlayerMeters: number = 99, beast?: DynamicBeastPack | null): void {
    this.renderBeastEntity(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, 'beast_wolf', 'Bầy Sói Hoang', '🐺', 3.8, 2.8, beast);
  }

  private drawCaveLionPride(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, distToPlayerMeters: number = 99, beast?: DynamicBeastPack | null): void {
    this.renderBeastEntity(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, 'beast_cavelion', 'Sư Tử Hang', '🦁', 4.5, 3.5, beast);
  }

  private drawCaveBear(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, distToPlayerMeters: number = 99, beast?: DynamicBeastPack | null): void {
    this.renderBeastEntity(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, 'beast_bear', 'Gấu Hang Khổng Lồ', '🐻', 4.5, 3.5, beast);
  }

  private drawGiantBoar(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, distToPlayerMeters: number = 99, beast?: DynamicBeastPack | null): void {
    this.renderBeastEntity(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, 'beast_boar', 'Heo Rừng Cổ Đại', '🐗', 3.8, 3.0, beast);
  }

  private drawDeerHerd(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, distToPlayerMeters: number = 99, beast?: DynamicBeastPack | null): void {
    this.renderBeastEntity(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, 'beast_deer', 'Đàn Hươu Sao', '🦌', 3.8, 3.0, beast);
  }

  private drawWildHorseHerd(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, distToPlayerMeters: number = 99, beast?: DynamicBeastPack | null): void {
    this.renderBeastEntity(sx, sy, pxPerMeter, TILT_Y, distToPlayerMeters, 'beast_horse', 'Đàn Ngựa Hoang', '🐎', 4.0, 3.2, beast);
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

  /** KHÓM CỎ & BỤI DƯƠNG XỈ 2.5D (Illustrated 2.5D Grass Tufts & Ferns) */
  private drawGrassTuftsAndFern(sx: number, sy: number, pxPerMeter: number, TILT_Y: number, rand: number): void {
    const { ctx } = this;
    const grassH = Math.max(3.5 * this.dpr, 3.2 * pxPerMeter * TILT_Y);
    if (grassH < 2.0) return;

    ctx.save();
    ctx.translate(sx, sy);

    // Bóng râm mềm chân cỏ
    ctx.fillStyle = 'rgba(25, 60, 15, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 1 * this.dpr, grassH * 0.7, grassH * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Lá dương xỉ & cụm ngọn cỏ xanh mướt
    ctx.strokeStyle = '#7acc2f';
    ctx.lineWidth = Math.max(1.2 * this.dpr, 0.35 * pxPerMeter);
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-grassH * 0.4, -grassH * 0.5, -grassH * 0.65, -grassH * 0.85);
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(0, -grassH * 0.65, grassH * 0.05, -grassH);
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(grassH * 0.4, -grassH * 0.5, grassH * 0.65, -grassH * 0.85);
    ctx.stroke();

    // Điểm sáng vàng chanh trên ngọn
    ctx.fillStyle = '#bbf7d0';
    ctx.beginPath();
    ctx.arc(grassH * 0.05, -grassH, 1.2 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    // Cỏ ba lá hoặc nụ hoa nhỏ xinh
    if (rand > 0.6) {
      ctx.fillStyle = rand > 0.8 ? '#fef08a' : '#ffffff';
      ctx.beginPath();
      ctx.arc(grassH * 0.35, -grassH * 0.4, 1.5 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    }

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

    // Query the static spatial index before the precise viewport test. This keeps
    // the road artwork unchanged while removing a full 7,913-road scan per frame.
    const visibleRoads: { road: OsmRoad; pts: [number, number][] }[] = [];
    const candidateRoads = new Set<OsmRoad>();
    const minLatCell = Math.floor(vMinLat / ROAD_GRID_CELL_DEGREES);
    const maxLatCell = Math.floor(vMaxLat / ROAD_GRID_CELL_DEGREES);
    const minLonCell = Math.floor(vMinLon / ROAD_GRID_CELL_DEGREES);
    const maxLonCell = Math.floor(vMaxLon / ROAD_GRID_CELL_DEGREES);
    for (let latCell = minLatCell; latCell <= maxLatCell; latCell++) {
      for (let lonCell = minLonCell; lonCell <= maxLonCell; lonCell++) {
        const bucket = ROAD_SPATIAL_INDEX.get(roadGridKey(latCell, lonCell));
        if (bucket) for (const road of bucket) candidateRoads.add(road);
      }
    }

    for (const road of candidateRoads) {
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
    if (!pxPerMeter || !Number.isFinite(pxPerMeter) || pxPerMeter <= 0) return;

    for (const terr of HANOI_BEAST_TERRITORIES) {
      if (!terr || !Number.isFinite(terr.lat) || !Number.isFinite(terr.lon)) continue;
      const [rawX, rawY] = project({ lat: terr.lat, lon: terr.lon });
      if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) continue;
      const x = Math.round(rawX);
      const y = Math.round(rawY);
      const radiusPx = terr.radiusMeters * pxPerMeter;
      if (!Number.isFinite(radiusPx) || radiusPx <= 2) continue;

      if (x < -radiusPx || x > w + radiusPx || y < -radiusPx || y > h + radiusPx) continue;

      ctx.save();

      // 1. Quầng Sương Mù Đỏ Thần Bí (Pulsating Red Mist)
      const pulse = Math.sin(this.tick / 15) * 0.15;
      const mistR0 = Math.max(0.1, radiusPx * 0.2);
      const mistR1 = Math.max(mistR0 + 0.1, radiusPx);
      const mistGrad = ctx.createRadialGradient(x, y, mistR0, x, y, mistR1);
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
    // 1. MẶT ĐẤT DOANH TRẠI TỰ NHIÊN (Organic Clearing Ground)
    // -------------------------------------------------------------
    const groundRadX = totalW / 2 + 12 * this.dpr;
    const groundRadY = (totalH / 2 + 8 * this.dpr);

    // Vệt đất nện phù sa màu mật ong ấm áp
    const groundGrad = ctx.createRadialGradient(cx, cy, 4 * this.dpr, cx, cy, groundRadX);
    if (input.isNight) {
      groundGrad.addColorStop(0, 'rgba(45, 55, 38, 0.75)');
      groundGrad.addColorStop(0.7, 'rgba(32, 42, 28, 0.65)');
      groundGrad.addColorStop(1, 'rgba(20, 30, 18, 0)');
    } else {
      groundGrad.addColorStop(0, 'rgba(196, 155, 102, 0.85)');
      groundGrad.addColorStop(0.65, 'rgba(170, 130, 80, 0.65)');
      groundGrad.addColorStop(1, 'rgba(220, 190, 140, 0)');
    }
    ctx.fillStyle = groundGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, groundRadX, groundRadY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Những viên đá lát cuội nhỏ xinh quanh sân trại (Cobblestones)
    const stones = [
      [-0.3, -0.2], [0.25, -0.3], [-0.4, 0.25], [0.35, 0.3], [0, 0.4],
      [-0.2, 0.35], [0.4, -0.15], [-0.35, -0.4], [0.15, 0.2]
    ];
    for (const [ox, oy] of stones) {
      const stoneX = cx + ox * totalW * 0.7;
      const stoneY = cy + oy * totalH * 0.7;
      ctx.fillStyle = input.isNight ? 'rgba(60, 70, 60, 0.6)' : 'rgba(215, 195, 170, 0.8)';
      ctx.beginPath();
      ctx.ellipse(stoneX, stoneY, 3.2 * this.dpr, 2.0 * this.dpr, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // -------------------------------------------------------------
    // 2. MÀNG KHIÊN TRẬN ĐỒ BẢO VỆ DOANH TRẠI (Pulsing Ground Ward Ring)
    // -------------------------------------------------------------
    const wardPulse = 0.65 + 0.35 * Math.sin(this.tick / 15);
    ctx.strokeStyle = input.isNight
      ? `rgba(56, 189, 248, ${0.55 * wardPulse})`
      : `rgba(245, 158, 11, ${0.65 * wardPulse})`;
    ctx.lineWidth = 1.8 * this.dpr;
    ctx.setLineDash([8 * this.dpr, 6 * this.dpr]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, groundRadX * 0.95, groundRadY * 0.95, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Đăng ký hitbox căn cứ
    this.renderedCampBounds = {
      x: cx,
      y: cy,
      radius: Math.round(groundRadX * 0.9),
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
    const by = cy - 24 * this.dpr;

    // -------------------------------------------------------------
    // A. CỘT CỜ HIỆU KỲ THỦ LĨNH TUNG BAY TRONG GIÓ
    // -------------------------------------------------------------
    const flagPoleX = cx - 26 * this.dpr;
    const flagPoleY = cy - 10 * this.dpr;
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
      // =============================================================
      // CẤP 1: CHÒI TRANH THỢ SĂN (Illustrated 2.5D Layered Thatch Hut)
      // =============================================================
      // 1. Bóng đổ tiếp xúc mặt đất (Contact Ground Shadow)
      ctx.fillStyle = 'rgba(20, 10, 3, 0.52)';
      ctx.beginPath();
      ctx.ellipse(cx, by + 12 * this.dpr, 24 * this.dpr, 10 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Thân tường nhà gỗ vách mộc (Timber Log Walls with Grain Texture)
      const wallW = 32 * this.dpr;
      const wallH = 16 * this.dpr;
      const wallX = cx - wallW / 2;
      const wallY = by - 3 * this.dpr;

      // Nền gỗ vách
      const woodGrad = ctx.createLinearGradient(wallX, wallY, wallX, wallY + wallH);
      woodGrad.addColorStop(0, '#543015');
      woodGrad.addColorStop(0.5, '#783e1c');
      woodGrad.addColorStop(1, '#3e200c');
      ctx.fillStyle = woodGrad;
      ctx.beginPath();
      ctx.roundRect(wallX, wallY, wallW, wallH, 3 * this.dpr);
      ctx.fill();

      // Vân thớ gỗ ghép ngang (Horizontal Timber Logs)
      const logCount = 4;
      for (let i = 0; i < logCount; i++) {
        const ly = wallY + (i / logCount) * wallH;
        // Rãnh mộng gỗ
        ctx.strokeStyle = '#2d1405';
        ctx.lineWidth = 1.2 * this.dpr;
        ctx.beginPath();
        ctx.moveTo(wallX + 1 * this.dpr, ly);
        ctx.lineTo(wallX + wallW - 1 * this.dpr, ly);
        ctx.stroke();

        // Điểm sáng thớ gỗ đón sáng
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
        ctx.lineWidth = 0.8 * this.dpr;
        ctx.beginPath();
        ctx.moveTo(wallX + 3 * this.dpr, ly + 2 * this.dpr);
        ctx.lineTo(wallX + wallW - 3 * this.dpr, ly + 2 * this.dpr);
        ctx.stroke();

        // Đinh tán gỗ / Mấu gỗ
        ctx.fillStyle = '#1c0b02';
        ctx.beginPath();
        ctx.arc(wallX + 3.5 * this.dpr, ly + 2 * this.dpr, 0.9 * this.dpr, 0, Math.PI * 2);
        ctx.arc(wallX + wallW - 3.5 * this.dpr, ly + 2 * this.dpr, 0.9 * this.dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cột chống gỗ ở 2 góc nhà
      ctx.fillStyle = '#452109';
      ctx.fillRect(wallX - 2 * this.dpr, wallY - 2 * this.dpr, 3.5 * this.dpr, wallH + 4 * this.dpr);
      ctx.fillRect(wallX + wallW - 1.5 * this.dpr, wallY - 2 * this.dpr, 3.5 * this.dpr, wallH + 4 * this.dpr);

      // Cửa lều vòm gỗ mở hé có ánh lửa ấm áp
      const doorW = 10 * this.dpr;
      const doorH = 12 * this.dpr;
      const doorX = cx - doorW / 2;
      const doorY = wallY + wallH - doorH;

      // Khung cửa gỗ
      ctx.strokeStyle = '#2d1405';
      ctx.lineWidth = 2.0 * this.dpr;
      ctx.beginPath();
      ctx.roundRect(doorX, doorY, doorW, doorH, [4 * this.dpr, 4 * this.dpr, 0, 0]);
      ctx.stroke();

      // Ánh sáng lửa ấm bên trong nhà
      const doorGrad = ctx.createRadialGradient(cx, doorY + doorH - 2 * this.dpr, 1 * this.dpr, cx, doorY + doorH - 2 * this.dpr, 8 * this.dpr);
      doorGrad.addColorStop(0, '#fef08a');
      doorGrad.addColorStop(0.4, '#ea580c');
      doorGrad.addColorStop(0.85, '#7f1d1d');
      doorGrad.addColorStop(1, '#2b0c05');
      ctx.fillStyle = doorGrad;
      ctx.beginPath();
      ctx.roundRect(doorX + 1 * this.dpr, doorY + 1 * this.dpr, doorW - 2 * this.dpr, doorH - 1 * this.dpr, [3 * this.dpr, 3 * this.dpr, 0, 0]);
      ctx.fill();

      // 3. ĐỔ BÓNG CỦA MÁI NHÀ XUỐNG TƯỜNG (Roof Overhang Cast Shadow)
      ctx.fillStyle = 'rgba(15, 8, 3, 0.65)';
      ctx.beginPath();
      ctx.moveTo(wallX - 3 * this.dpr, wallY);
      ctx.lineTo(wallX + wallW + 3 * this.dpr, wallY);
      ctx.lineTo(wallX + wallW + 1 * this.dpr, wallY + 5.5 * this.dpr);
      ctx.quadraticCurveTo(cx, wallY + 7.5 * this.dpr, wallX - 1 * this.dpr, wallY + 5.5 * this.dpr);
      ctx.closePath();
      ctx.fill();

      // 4. MÁI LÁ XẾP TẦNG TIỀN SỬ (Layered Thatch Roof — 3 Overlapping Straw Tiers)
      // Helper vẽ một tầng mái lá có viền sợi rủ tự nhiên
      const drawThatchTier = (topX: number, topY: number, botW: number, tierH: number, colorBase: string, colorMid: string, colorSun: string) => {
        const halfW = botW / 2;
        const botY = topY + tierH;

        // Mảng khối mái lá
        const tGrad = ctx.createLinearGradient(topX, topY, topX, botY);
        tGrad.addColorStop(0, colorBase);
        tGrad.addColorStop(0.5, colorMid);
        tGrad.addColorStop(1, colorSun);
        ctx.fillStyle = tGrad;

        ctx.beginPath();
        ctx.moveTo(topX - halfW * 0.45, topY);
        ctx.lineTo(topX + halfW * 0.45, topY);
        ctx.lineTo(topX + halfW, botY);
        // Viền lá rủ uốn lượn (Scalloped fringe)
        for (let x = halfW; x >= -halfW; x -= 3 * this.dpr) {
          const scallop = Math.sin((x + topY) * 0.4) * 1.5 * this.dpr;
          ctx.lineTo(topX + x, botY + scallop);
        }
        ctx.closePath();
        ctx.fill();

        // Từng sợi cỏ tranh rủ (Straw Texture Lines)
        ctx.strokeStyle = colorBase;
        ctx.lineWidth = 1.0 * this.dpr;
        for (let x = -halfW + 2 * this.dpr; x <= halfW - 2 * this.dpr; x += 3.5 * this.dpr) {
          ctx.beginPath();
          ctx.moveTo(topX + x * 0.5, topY + 1 * this.dpr);
          ctx.lineTo(topX + x, botY + 1.2 * this.dpr);
          ctx.stroke();
        }

        // Chóp viền rủ đón nắng vàng
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 0.8 * this.dpr;
        for (let x = -halfW + 3 * this.dpr; x <= halfW - 3 * this.dpr; x += 4 * this.dpr) {
          ctx.beginPath();
          ctx.moveTo(topX + x, botY - 1 * this.dpr);
          ctx.lineTo(topX + x + 0.8 * this.dpr, botY + 1.5 * this.dpr);
          ctx.stroke();
        }
      };

      // Tầng 1: Mái lá dưới cùng (Broad Lower Eaves)
      drawThatchTier(cx, by - 12 * this.dpr, 38 * this.dpr, 13 * this.dpr, '#78350f', '#a16207', '#d97706');

      // Bóng đổ giữa tầng 1 và tầng 2
      ctx.fillStyle = 'rgba(25, 12, 3, 0.55)';
      ctx.beginPath();
      ctx.ellipse(cx, by - 10 * this.dpr, 14 * this.dpr, 3 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tầng 2: Mái lá giữa (Middle Tier)
      drawThatchTier(cx, by - 21 * this.dpr, 28 * this.dpr, 12 * this.dpr, '#854d0e', '#ca8a04', '#eab308');

      // Bóng đổ giữa tầng 2 và chóp mái
      ctx.fillStyle = 'rgba(25, 12, 3, 0.55)';
      ctx.beginPath();
      ctx.ellipse(cx, by - 19 * this.dpr, 10 * this.dpr, 2.5 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tầng 3: Chóp đỉnh lợp rơm bện dây thừng (Thatched Crown Cap)
      drawThatchTier(cx, by - 27 * this.dpr, 18 * this.dpr, 9 * this.dpr, '#92400e', '#d97706', '#facc15');

      // Dây bện nóc lều & Cọc nhọn nóc lều
      ctx.fillStyle = '#543720';
      ctx.fillRect(cx - 1.2 * this.dpr, by - 31 * this.dpr, 2.4 * this.dpr, 6 * this.dpr);

      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1.4 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(cx - 4 * this.dpr, by - 26 * this.dpr); ctx.lineTo(cx + 4 * this.dpr, by - 24 * this.dpr);
      ctx.moveTo(cx + 4 * this.dpr, by - 26 * this.dpr); ctx.lineTo(cx - 4 * this.dpr, by - 24 * this.dpr);
      ctx.stroke();

      // Hiệu ứng bóng nước (Glossy) trên mái lá khi trời mưa
      if (this.isRainingNow) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1.2 * this.dpr;
        ctx.beginPath();
        ctx.moveTo(cx - 14 * this.dpr, by - 1 * this.dpr);
        ctx.lineTo(cx, by - 4 * this.dpr);
        ctx.lineTo(cx + 14 * this.dpr, by - 1 * this.dpr);
        ctx.stroke();
      }
    } else if (campLevel === 2) {
      // =============================================================
      // CẤP 2: NHÀ SÀN GỖ ĐÔNG SƠN (Illustrated 2.5D Tribal Longhouse)
      // =============================================================
      // 1. Bóng đổ sàn nhà & cột chống
      ctx.fillStyle = 'rgba(20, 10, 3, 0.55)';
      ctx.beginPath();
      ctx.ellipse(cx, by + 15 * this.dpr, 28 * this.dpr, 11 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. 4 Trụ gỗ lim nâng sàn vững chắc có chân tảng đá
      const pillars = [-15, -5, 5, 15];
      for (const px of pillars) {
        // Chân đá
        ctx.fillStyle = '#78716c';
        ctx.beginPath();
        ctx.arc(cx + px * this.dpr, by + 12 * this.dpr, 2.5 * this.dpr, 0, Math.PI * 2);
        ctx.fill();

        // Cột gỗ
        const pGrad = ctx.createLinearGradient(cx + px * this.dpr - 2 * this.dpr, 0, cx + px * this.dpr + 2 * this.dpr, 0);
        pGrad.addColorStop(0, '#3e200c');
        pGrad.addColorStop(0.5, '#633516');
        pGrad.addColorStop(1, '#2d1405');
        ctx.fillStyle = pGrad;
        ctx.fillRect(cx + (px - 1.8) * this.dpr, by + 2 * this.dpr, 3.6 * this.dpr, 10 * this.dpr);
      }

      // Sàn gỗ nâng cao (Raised Timber Deck)
      ctx.fillStyle = '#6d3c1a';
      ctx.fillRect(cx - 19 * this.dpr, by + 1 * this.dpr, 38 * this.dpr, 3.5 * this.dpr);
      ctx.strokeStyle = '#2d1405';
      ctx.lineWidth = 1.0 * this.dpr;
      ctx.strokeRect(cx - 19 * this.dpr, by + 1 * this.dpr, 38 * this.dpr, 3.5 * this.dpr);

      // 3. Thân nhà vách gỗ Đông Sơn có thớ gỗ ngang
      const wallW = 34 * this.dpr;
      const wallH = 14 * this.dpr;
      const wallX = cx - wallW / 2;
      const wallY = by - 12 * this.dpr;

      const houseWoodGrad = ctx.createLinearGradient(wallX, wallY, wallX, wallY + wallH);
      houseWoodGrad.addColorStop(0, '#5a3014');
      houseWoodGrad.addColorStop(0.5, '#7c431d');
      houseWoodGrad.addColorStop(1, '#431f0a');
      ctx.fillStyle = houseWoodGrad;
      ctx.fillRect(wallX, wallY, wallW, wallH);

      // Thớ gỗ vách & Đinh ghép mộng
      for (let i = 1; i <= 3; i++) {
        const py = wallY + (i / 4) * wallH;
        ctx.strokeStyle = '#2d1405';
        ctx.lineWidth = 1.0 * this.dpr;
        ctx.beginPath();
        ctx.moveTo(wallX, py); ctx.lineTo(wallX + wallW, py);
        ctx.stroke();
      }

      // Cửa sổ nan tre đan
      ctx.fillStyle = '#2b1103';
      ctx.fillRect(cx - 13 * this.dpr, wallY + 3 * this.dpr, 6 * this.dpr, 6 * this.dpr);
      ctx.fillRect(cx + 7 * this.dpr, wallY + 3 * this.dpr, 6 * this.dpr, 6 * this.dpr);
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 0.8 * this.dpr;
      ctx.strokeRect(cx - 13 * this.dpr, wallY + 3 * this.dpr, 6 * this.dpr, 6 * this.dpr);
      ctx.strokeRect(cx + 7 * this.dpr, wallY + 3 * this.dpr, 6 * this.dpr, 6 * this.dpr);

      // 4. ĐỔ BÓNG MÁI NHÀ XUỐNG VÁCH GỖ
      ctx.fillStyle = 'rgba(15, 8, 3, 0.65)';
      ctx.fillRect(wallX, wallY, wallW, 4.5 * this.dpr);

      // 5. MÁI CONG HÌNH THUYỀN ĐÔNG SƠN XẾP TẦNG (Layered Curved Boat Roof)
      // Tầng 1: Mái dưới cong rộng
      const rGrad1 = ctx.createLinearGradient(0, by - 26 * this.dpr, 0, by - 10 * this.dpr);
      rGrad1.addColorStop(0, '#78350f');
      rGrad1.addColorStop(0.5, '#b45309');
      rGrad1.addColorStop(1, '#ea580c');
      ctx.fillStyle = rGrad1;

      ctx.beginPath();
      ctx.moveTo(cx - 24 * this.dpr, by - 10 * this.dpr);
      ctx.quadraticCurveTo(cx - 14 * this.dpr, by - 24 * this.dpr, cx, by - 26 * this.dpr);
      ctx.quadraticCurveTo(cx + 14 * this.dpr, by - 24 * this.dpr, cx + 24 * this.dpr, by - 10 * this.dpr);
      ctx.lineTo(cx + 18 * this.dpr, by - 12 * this.dpr);
      ctx.quadraticCurveTo(cx, by - 22 * this.dpr, cx - 18 * this.dpr, by - 12 * this.dpr);
      ctx.closePath();
      ctx.fill();

      // Tầng 2: Mái vòm phụ nóc nhọn đan lá
      const rGrad2 = ctx.createLinearGradient(0, by - 32 * this.dpr, 0, by - 20 * this.dpr);
      rGrad2.addColorStop(0, '#92400e');
      rGrad2.addColorStop(0.5, '#d97706');
      rGrad2.addColorStop(1, '#fde047');
      ctx.fillStyle = rGrad2;

      ctx.beginPath();
      ctx.moveTo(cx - 16 * this.dpr, by - 20 * this.dpr);
      ctx.quadraticCurveTo(cx - 8 * this.dpr, by - 30 * this.dpr, cx, by - 32 * this.dpr);
      ctx.quadraticCurveTo(cx + 8 * this.dpr, by - 30 * this.dpr, cx + 16 * this.dpr, by - 20 * this.dpr);
      ctx.closePath();
      ctx.fill();

      // Viền mái lá & Đuôi thuyền sừng chim Lạc vểnh cao 2 đầu
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.0 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(cx - 25 * this.dpr, by - 12 * this.dpr);
      ctx.quadraticCurveTo(cx - 14 * this.dpr, by - 26 * this.dpr, cx, by - 28 * this.dpr);
      ctx.quadraticCurveTo(cx + 14 * this.dpr, by - 26 * this.dpr, cx + 25 * this.dpr, by - 12 * this.dpr);
      ctx.stroke();

      // Đèn dầu ấm áp treo trước hiên nhà
      const lanternY = wallY + 4 * this.dpr;
      const lanternGrad = ctx.createRadialGradient(cx, lanternY, 1 * this.dpr, cx, lanternY, 7 * this.dpr);
      lanternGrad.addColorStop(0, '#fef08a');
      lanternGrad.addColorStop(0.5, '#f59e0b');
      lanternGrad.addColorStop(1, 'rgba(234, 88, 12, 0)');
      ctx.fillStyle = lanternGrad;
      ctx.beginPath();
      ctx.arc(cx, lanternY, 7 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(cx, lanternY, 2.2 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    } else if (campLevel === 3) {
      // =============================================================
      // CẤP 3: PHÁO ĐÀI ĐÁ CỔ (Illustrated 2.5D Ancient Stone Bastion)
      // =============================================================
      // Bóng đổ
      ctx.fillStyle = 'rgba(20, 10, 3, 0.58)';
      ctx.beginPath();
      ctx.ellipse(cx, by + 16 * this.dpr, 30 * this.dpr, 12 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Thân thành lũy khối đá 2.5D có vân đá vát cạnh
      const stoneW = 38 * this.dpr;
      const stoneH = 22 * this.dpr;
      const stoneX = cx - stoneW / 2;
      const stoneY = by - 10 * this.dpr;

      ctx.fillStyle = '#44403c';
      ctx.fillRect(stoneX, stoneY, stoneW, stoneH);

      // Các khối đá ghép so le (Stone Masonry Texture)
      const rows = 4;
      for (let r = 0; r < rows; r++) {
        const ry = stoneY + (r / rows) * stoneH;
        ctx.strokeStyle = '#1c1917';
        ctx.lineWidth = 1.2 * this.dpr;
        ctx.beginPath();
        ctx.moveTo(stoneX, ry); ctx.lineTo(stoneX + stoneW, ry);
        ctx.stroke();

        const offset = (r % 2) * 5 * this.dpr;
        for (let x = stoneX + offset; x < stoneX + stoneW; x += 10 * this.dpr) {
          ctx.beginPath();
          ctx.moveTo(x, ry); ctx.lineTo(x, ry + stoneH / rows);
          ctx.stroke();
          // Cạnh vát đón sáng
          ctx.strokeStyle = '#78716c';
          ctx.strokeRect(x + 1 * this.dpr, ry + 1 * this.dpr, 8 * this.dpr, stoneH / rows - 2 * this.dpr);
          ctx.strokeStyle = '#1c1917';
        }
      }

      // Đổ bóng lỗ châu mai
      ctx.fillStyle = 'rgba(15, 8, 3, 0.65)';
      ctx.fillRect(stoneX, stoneY, stoneW, 4 * this.dpr);

      // Tháp canh trung tâm pháo đài với mái che lợp lá
      const towerW = 20 * this.dpr;
      const towerH = 16 * this.dpr;
      ctx.fillStyle = '#292524';
      ctx.fillRect(cx - towerW / 2, stoneY - towerH, towerW, towerH);

      // Mái lá xếp tầng tháp canh pháo đài (Thatched Guard Roof)
      const roofW = 26 * this.dpr;
      const roofH = 10 * this.dpr;
      const rGrad = ctx.createLinearGradient(cx, stoneY - towerH - roofH, cx, stoneY - towerH);
      rGrad.addColorStop(0, '#78350f');
      rGrad.addColorStop(0.5, '#d97706');
      rGrad.addColorStop(1, '#fde047');
      ctx.fillStyle = rGrad;
      ctx.beginPath();
      ctx.moveTo(cx - roofW / 2, stoneY - towerH + 2 * this.dpr);
      ctx.lineTo(cx, stoneY - towerH - roofH);
      ctx.lineTo(cx + roofW / 2, stoneY - towerH + 2 * this.dpr);
      ctx.closePath();
      ctx.fill();

      // Đuốc lửa vĩnh cửu
      const torchY = stoneY - towerH - 8 * this.dpr;
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(cx, torchY, 4.0 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(cx, torchY, 2.0 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    } else if (campLevel === 4) {
      // =============================================================
      // CẤP 4: THÀNH CỔ ĐÔNG SƠN (Illustrated 2.5D Bronze Citadel)
      // =============================================================
      ctx.fillStyle = 'rgba(20, 10, 3, 0.62)';
      ctx.beginPath();
      ctx.ellipse(cx, by + 18 * this.dpr, 32 * this.dpr, 13 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tường thành đá đồng đồ sộ
      const cW = 46 * this.dpr;
      const cH = 26 * this.dpr;
      ctx.fillStyle = '#292524';
      ctx.fillRect(cx - cW / 2, by - 14 * this.dpr, cW, cH);

      // Cổng vòm cuốn lớn
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.arc(cx, by + 12 * this.dpr, 8 * this.dpr, Math.PI, 0);
      ctx.fill();

      // Đổ bóng mái thành
      ctx.fillStyle = 'rgba(15, 8, 3, 0.65)';
      ctx.fillRect(cx - cW / 2, by - 14 * this.dpr, cW, 5 * this.dpr);

      // Mái vòm 2 tầng chạm khắc Mặt Trời Đông Sơn
      ctx.fillStyle = '#92400e';
      ctx.fillRect(cx - 26 * this.dpr, by - 24 * this.dpr, 52 * this.dpr, 11 * this.dpr);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.2 * this.dpr;
      ctx.strokeRect(cx - 26 * this.dpr, by - 24 * this.dpr, 52 * this.dpr, 11 * this.dpr);

      // Mặt Trời Đông Sơn rực rỡ
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(cx, by - 28 * this.dpr, 5.5 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // =============================================================
      // CẤP 5: CUNG ĐIỆN THẦN LONG (Illustrated 2.5D Jade Dragon Palace)
      // =============================================================
      ctx.fillStyle = 'rgba(20, 10, 3, 0.68)';
      ctx.beginPath();
      ctx.ellipse(cx, by + 20 * this.dpr, 36 * this.dpr, 14 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Điện thờ ngọc bích
      const pW = 50 * this.dpr;
      const pH = 28 * this.dpr;
      ctx.fillStyle = '#065f46';
      ctx.fillRect(cx - pW / 2, by - 16 * this.dpr, pW, pH);

      // Đổ bóng mái
      ctx.fillStyle = 'rgba(5, 20, 15, 0.65)';
      ctx.fillRect(cx - pW / 2, by - 16 * this.dpr, pW, 6 * this.dpr);

      // Mái điện Rồng uốn lượn đa tầng
      ctx.fillStyle = '#0d9488';
      ctx.beginPath();
      ctx.moveTo(cx - 30 * this.dpr, by - 14 * this.dpr);
      ctx.lineTo(cx, by - 32 * this.dpr);
      ctx.lineTo(cx + 30 * this.dpr, by - 14 * this.dpr);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.8 * this.dpr;
      ctx.stroke();

      // Ngọc Rồng tỏa sáng huyền ảo
      const glow = 0.8 + 0.2 * Math.sin(this.tick / 6);
      ctx.fillStyle = `rgba(56, 189, 248, ${glow})`;
      ctx.beginPath();
      ctx.arc(cx, by - 34 * this.dpr, 6.5 * this.dpr, 0, Math.PI * 2);
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
    const plaqueY = Math.round(cy - 82 * this.dpr);

    const hasReadyCrops = farmPlots.some((p) => p.readyToHarvest);

    // Tính toán kích thước bảng hiệu
    const titleText = `🏛️ ${tierNameVi.toUpperCase()} [CẤP ${campLevel}]`;
    const defenseText = isUpgrading && upgradeCompleteAtMs
      ? `⏳ Đang nâng cấp: ${Math.max(0, Math.ceil((upgradeCompleteAtMs - Date.now()) / 60000))}′`
      : `🛡️ Phòng Thủ: ${defensePower} Giáp`;

    ctx.font = `bold ${9.5 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
    const titleW = ctx.measureText(titleText).width;
    ctx.font = `bold ${8.5 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
    const defW = ctx.measureText(defenseText).width;

    const pillW = Math.round(Math.max(titleW, defW) + 20 * this.dpr);
    const pillH = Math.round(26 * this.dpr);
    const pillX = Math.round(cx - pillW / 2);

    // Bóng đổ thẻ
    ctx.fillStyle = 'rgba(20, 10, 3, 0.45)';
    ctx.beginPath();
    ctx.roundRect(pillX, plaqueY + 2 * this.dpr, pillW, pillH, 5 * this.dpr);
    ctx.fill();

    // Nền thẻ sơn mài đen viền vàng kim
    ctx.fillStyle = 'rgba(28, 14, 4, 0.88)';
    ctx.beginPath();
    ctx.roundRect(pillX, plaqueY, pillW, pillH, 5 * this.dpr);
    ctx.fill();

    ctx.strokeStyle = hasReadyCrops ? '#ef4444' : '#f59e0b';
    ctx.lineWidth = 1.4 * this.dpr;
    ctx.stroke();

    // Dòng 1: Tên Căn Cứ & Cấp Độ
    ctx.fillStyle = '#fef08a';
    ctx.font = `bold ${9.0 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(titleText, cx, plaqueY + 8 * this.dpr);

    // Dòng 2: Chỉ số Sức Phòng Thủ / Nâng cấp
    ctx.fillStyle = isUpgrading ? '#fde047' : '#7dd3fc';
    ctx.font = `bold ${8.0 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
    ctx.fillText(defenseText, cx, plaqueY + 18 * this.dpr);
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

  private drawSingleTrap(trap: PlacedTrap, x: number, y: number, input: RenderInput): void {
    const { ctx } = this;
    const now = Date.now();
    const isSprung = now >= trap.sprungAt;
    const isStolen = trap.spoiledAt ? now >= trap.spoiledAt : false;
    const distMeters = distanceMeters(input.center, { lat: trap.lat, lon: trap.lon });
    const inRange = distMeters <= 35;
    const spriteKey = trap.type === 'fish_trap' ? 'struct_fish_trap' : trap.type === 'beast_trap' ? 'trap_beast' : 'trap_rabbit';

    ctx.save();
    // 1. Bóng đổ
    ctx.fillStyle = 'rgba(28, 16, 6, 0.4)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2 * this.dpr, 10 * this.dpr, 4 * this.dpr, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Thân bẫy thú
    if (this.assetLoader.has(spriteKey)) {
      this.assetLoader.drawSprite(ctx, spriteKey, x, y, 28 * this.dpr, 28 * this.dpr, 1.0);
    } else {
      ctx.fillStyle = isSprung ? '#9a3412' : '#78350f';
      ctx.strokeStyle = inRange ? '#f59e0b' : '#c2934f';
      ctx.lineWidth = 1.6 * this.dpr;
      ctx.beginPath();
      ctx.arc(x, y - 6 * this.dpr, 12 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.font = `${12 * this.dpr}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const trapIcon = trap.type === 'fish_trap' ? '🐟' : isSprung ? '🥩' : '🪤';
      ctx.fillText(trapIcon, x, y - 6 * this.dpr);
    }

    // 3. Thẻ trạng thái
    ctx.font = `bold ${9 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
    const statusText = isStolen ? 'Bị cắn trộm' : isSprung ? 'Đã sập bẫy' : 'Đang chờ mồi';
    const labelW = Math.round(ctx.measureText(statusText).width + 12 * this.dpr);
    const pillX = Math.round(x - labelW / 2);
    const pillY = Math.round(y + 8 * this.dpr);

    ctx.fillStyle = '#140a03';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, labelW, 16 * this.dpr, 3 * this.dpr);
    ctx.fill();

    ctx.fillStyle = isSprung ? '#fde047' : '#e2b373';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(statusText, x, Math.round(pillY + 8 * this.dpr));

    ctx.restore();
  }

  private drawSingleDrop(drop: WorldDrop, x: number, y: number, input: RenderInput): void {
    const { ctx } = this;
    const distMeters = distanceMeters(input.center, { lat: drop.lat, lon: drop.lon });
    const inRange = distMeters < 5.0;
    const seed = hashSeed(drop.id);
    const bob = Math.sin(this.tick / 8 + seed) * 4 * this.dpr;
    const dy = y - 14 * this.dpr + bob;

    ctx.save();
    // 1. Bóng đổ 3D dưới lòng cổ đạo co giãn theo độ cao
    const shadowScale = Math.max(0.6, 1.0 - (bob / (12 * this.dpr)));
    ctx.fillStyle = 'rgba(28, 16, 6, 0.4)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2 * this.dpr, 10 * this.dpr * shadowScale, 4 * this.dpr * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Sprite vật phẩm nổi 3D
    let spriteKey = 'drop_stick';
    if (drop.itemId.includes('stone') || drop.itemId.includes('flint')) spriteKey = 'drop_flint';
    else if (drop.itemId.includes('herb') || drop.itemId.includes('medicine')) spriteKey = 'drop_herb';
    else if (drop.itemId.includes('berry') || drop.itemId.includes('fruit')) spriteKey = 'drop_berry';
    else if (drop.itemId.includes('meat')) spriteKey = 'drop_meat';
    else if (drop.itemId.includes('fish')) spriteKey = 'drop_fish';

    if (this.assetLoader.has(spriteKey)) {
      this.assetLoader.drawSprite(ctx, spriteKey, x, dy, 26 * this.dpr, 26 * this.dpr, 1.0);
    } else {
      const rx = Math.round(x);
      const rdy = Math.round(dy);
      const orbGrad = ctx.createRadialGradient(rx - 3 * this.dpr, rdy - 3 * this.dpr, 2 * this.dpr, rx, rdy, 14 * this.dpr);
      orbGrad.addColorStop(0, inRange ? '#fef08a' : '#fde68a');
      orbGrad.addColorStop(0.6, inRange ? '#f59e0b' : '#b45309');
      orbGrad.addColorStop(1, inRange ? '#9a3412' : '#451a03');
      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(rx, rdy, 12 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      const icon = itemEmoji(drop.itemId);
      ctx.font = `${13 * this.dpr}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, rx, rdy);
    }

    // 3. Thẻ số lượng
    ctx.font = `bold ${9.5 * this.dpr}px 'Be Vietnam Pro', system-ui, -apple-system, sans-serif`;
    const dropLabel = `${drop.nameVi} ×${drop.qty}`;
    const dropW = Math.round(ctx.measureText(dropLabel).width + 16 * this.dpr);
    const dropH = Math.round(18 * this.dpr);
    const pillX = Math.round(x - dropW / 2);
    const pillY = Math.round(dy + 14 * this.dpr);

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
    ctx.fillText(dropLabel, x, Math.round(pillY + dropH / 2));

    ctx.restore();
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
    const isMoving = !!input.isMoving || (input.speedKmh ?? 0) > 0.3;

    // Cập nhật góc nhìn theo hướng di chuyển
    if (isMoving && input.moveHeading !== undefined) {
      let diff = input.moveHeading - this.playerFacingAngle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.playerFacingAngle += diff * 0.25;
    }

    // Đồng bộ thuộc tính và vẽ nhân vật qua PlayerEntity
    this.playerEntity.gender = input.gender === 'female' ? 'female' : 'male';
    this.playerEntity.weapon = input.phase === 'night' ? 'torch' : 'spear';
    this.playerEntity.isMoving = isMoving;
    this.playerEntity.isSprinting = !!input.isSprinting;
    this.playerEntity.facingAngle = this.playerFacingAngle;
    this.playerEntity.worldX = x;
    this.playerEntity.worldY = y;
    this.playerEntity.hasSaberTiger = true;
    this.playerEntity.hasExpeditionBird = true;

    this.playerEntity.update(input.dt || 0.016, this.tick);
    this.playerEntity.render(ctx, x, y, pxPerMeter, this.dpr, {
      isNight: input.isNight,
      weatherRaining: input.weather?.raining,
    });
  }

  // ================================================================
  // 10. LA BÀN BÁT QUÁI BẢN ĐỒ CỔ & TRIỆN SON
  // ================================================================

  private drawCompassRose(w: number, h: number, palette: typeof PALETTE.day): void {
    const { ctx } = this;
    const cx = w - 36 * this.dpr;
    const cy = 40 * this.dpr;
    const size = 48 * this.dpr;

    ctx.save();
    // Vẽ Hoa La Bàn Cổ Kính từ AssetLoader
    this.assetLoader.drawSprite(ctx, 'compass_rose', cx, cy, size, size, 1.0);

    ctx.font = `bold ${8.5 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
    ctx.fillStyle = '#b91c1c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Bắc', cx, cy - size / 2 - 2 * this.dpr);

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

    // ── TẦNG 1: VŨNG NƯỚC ĐỌNG MẶT ĐẤT PHẢN CHIẾU BẦU TRỜI (Reflective Rain Puddles) ──
    const puddleCount = 6;
    for (let i = 0; i < puddleCount; i++) {
      const pSeed = i * 317.8 + 52.4;
      const px = (pSeed * 113.7) % w;
      const py = (pSeed * 79.1) % h;
      const pRadX = (18 + (i % 4) * 8) * dpr;
      const pRadY = pRadX * 0.42;

      // Viền đất ướt thẫm màu quanh vũng nước (Wet Mud Rim)
      ctx.fillStyle = `rgba(25, 45, 20, ${0.18 * intensity})`;
      ctx.beginPath();
      ctx.ellipse(px, py, pRadX + 3 * dpr, pRadY + 2 * dpr, 0.05 * i, 0, Math.PI * 2);
      ctx.fill();

      // Mặt nước phản chiếu sắc lam bầu trời (Sky-blue Water Reflection)
      const puddleGrad = ctx.createLinearGradient(px - pRadX, py - pRadY, px + pRadX, py + pRadY);
      puddleGrad.addColorStop(0, `rgba(186, 230, 253, ${0.28 * intensity})`);
      puddleGrad.addColorStop(0.5, `rgba(125, 211, 252, ${0.38 * intensity})`);
      puddleGrad.addColorStop(1, `rgba(56, 189, 248, ${0.22 * intensity})`);
      ctx.fillStyle = puddleGrad;
      ctx.beginPath();
      ctx.ellipse(px, py, pRadX, pRadY, 0.05 * i, 0, Math.PI * 2);
      ctx.fill();

      // Ánh sáng lấp lánh trên mặt nước (Glossy Sheen)
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 * intensity})`;
      ctx.lineWidth = 1.0 * dpr;
      ctx.beginPath();
      ctx.ellipse(px - pRadX * 0.3, py - pRadY * 0.25, pRadX * 0.4, pRadY * 0.25, -0.1, 0, Math.PI);
      ctx.stroke();

      // Gợn sóng đồng tâm lan tỏa trong vũng nước (Concentric Ripples in Puddles)
      for (let r = 0; r < 2; r++) {
        const ripplePhase = (t * 0.035 + i * 0.28 + r * 0.5) % 1;
        const rRadius = ripplePhase * pRadX * 0.85;
        const rAlpha = (1 - ripplePhase) * 0.45 * intensity;

        ctx.strokeStyle = `rgba(224, 242, 254, ${rAlpha})`;
        ctx.lineWidth = 0.9 * dpr;
        ctx.beginPath();
        ctx.ellipse(px, py, rRadius, rRadius * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // ── TẦNG 2: Mưa rơi thực tế (giọt thẳng đứng nhẹ, mảnh, mượt mà) ──
    const dropCount = Math.round(28 * intensity);
    for (let i = 0; i < dropCount; i++) {
      const seed = i * 137.508 + 19.1;
      const rx = ((seed * 73.1 + t * 0.8) % w + w) % w;
      const ry = ((seed * 41.3 + t * 7.5) % h + h) % h;
      const len = (7 + (i % 3) * 3) * dpr;

      ctx.strokeStyle = 'rgba(224, 242, 254, 0.32)';
      ctx.lineWidth = 0.85 * dpr;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 0.4 * dpr, ry + len);
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
  private collectPrehistoricAccents(
    w: number,
    h: number,
    input: RenderInput,
    project: (at: LatLon) => [number, number],
    pxPerMeter: number,
    TILT_Y: number,
    outEntities: Array<{ sortY: number; render: (ctx: CanvasRenderingContext2D) => void }>,
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
        const safeRadius = Math.max(2, radius || 20);
        const brushGrad = ctx.createRadialGradient(0, 0, Math.max(0.1, safeRadius * 0.1), 0, 0, safeRadius);
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
        const pitR0 = Math.max(0.1, boneSpanW * 0.2);
        const pitR1 = Math.max(pitR0 + 0.1, boneSpanW * 0.6);
        const pitGrad = ctx.createRadialGradient(0, 0, pitR0, 0, 0, pitR1);
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
  spanMeters = 28,
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
