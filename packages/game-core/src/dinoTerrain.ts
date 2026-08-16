/**
 * KỶ NGUYÊN HOANG CỔ — DINO TERRAIN & ENVIRONMENT SYSTEM
 * Core Game Engine Module: Quản Lý Mặt Đất, Địa Hình Thủ Tục & Tầm Nhìn Top-Down Bối Cảnh Khủng Long.
 *
 * Bao gồm 3 Module Logic Chính:
 * 1. TERRAIN CORE: Phân loại bề mặt, điều chỉnh tốc độ, hệ thống dấu chân Object Pooling, hiệu ứng bùn/cát.
 * 2. BIOME MAP GENERATOR: Sinh bản đồ Sa Mạc Đỏ (Tam Điệp) & Rừng Rậm Lục Bảo (Giura) kèm Chokepoints, Ốc Đảo, Cổ Thụ.
 * 3. TOP-DOWN VISION: Cơ chế làm mờ tán cây cổ thụ (Canopy Fade) và Bụi Dương Xỉ Ẩn Nấp (Stealth Brush MOBA-style).
 */

// ============================================================================
// MODULE 1: LOGIC MẶT ĐẤT & TƯƠNG TÁC VẬT LÝ (TERRAIN CORE)
// ============================================================================

export const TerrainType = {
  /** Thảm dương xỉ xanh tiền sử (100% tốc độ) */
  FERN_CARPET: 'fern_carpet',
  /** Cát mịn sa mạc (giảm 15% tốc độ) */
  FINE_SAND: 'fine_sand',
  /** Cát đỏ Kỷ Tam Điệp (giảm 15% tốc độ) */
  RED_SAND: 'red_sand',
  /** Đất nứt nẻ khô hạn (giảm 10% tốc độ) */
  CRACKED_EARTH: 'cracked_earth',
  /** Đầm lầy / Vũng bùn Giura (giảm 40% tốc độ) */
  SWAMP_MUD: 'swamp_mud',
  /** Đá dăm / Sỏi xám gò cao (giảm 5% tốc độ) */
  GRAVEL_ROCK: 'gravel_rock',
  /** Đất ẩm màu mỡ ốc đảo (100% tốc độ) */
  OASIS_HUMUS: 'oasis_humus',
  /** Nước sâu nguy hiểm (giảm 65% tốc độ) */
  DEEP_WATER: 'deep_water',
} as const;

export type TerrainType = typeof TerrainType[keyof typeof TerrainType];

export type ParticleType = 'mud_splash' | 'sand_dust' | 'dust_puff' | 'leaf_rustle' | 'pebble_kick' | 'dew_splash';

export interface TerrainSurfaceDef {
  type: TerrainType;
  nameVi: string;
  /** Hệ số tốc độ di chuyển (1.0 = 100%, 0.85 = giảm 15%, 0.60 = giảm 40%) */
  speedModifier: number;
  /** Độ sâu dấu chân cơ bản (0.1 = rất nông, 2.5 = lún sâu) */
  footprintDepth: number;
  /** Thời gian tồn tại của dấu chân trên bề mặt này trước khi biến mất (giây) */
  footprintDurationSec: number;
  /** Loại hạt phát ra khi dẫm mạnh */
  particleType: ParticleType;
  /** Màu sắc đặc trưng cho minimap / visual renderer */
  colorHex: string;
  /** Có phải bề mặt bùn/cát kích hoạt hiệu ứng văng mạnh không */
  hasHeavyDeformation: boolean;
}

export const TERRAIN_SURFACE_REGISTRY: Record<TerrainType, TerrainSurfaceDef> = {
  [TerrainType.FERN_CARPET]: {
    type: TerrainType.FERN_CARPET,
    nameVi: 'Thảm Dương Xỉ Cổ Đại',
    speedModifier: 1.0, // 100%
    footprintDepth: 0.3,
    footprintDurationSec: 6.0,
    particleType: 'leaf_rustle',
    colorHex: '#2d6a4f',
    hasHeavyDeformation: false,
  },
  [TerrainType.FINE_SAND]: {
    type: TerrainType.FINE_SAND,
    nameVi: 'Cát Mịn',
    speedModifier: 0.85, // Giảm 15%
    footprintDepth: 1.2,
    footprintDurationSec: 10.0,
    particleType: 'sand_dust',
    colorHex: '#e2a868',
    hasHeavyDeformation: true,
  },
  [TerrainType.RED_SAND]: {
    type: TerrainType.RED_SAND,
    nameVi: 'Cát Đỏ Tam Điệp',
    speedModifier: 0.85, // Giảm 15%
    footprintDepth: 1.4,
    footprintDurationSec: 12.0,
    particleType: 'sand_dust',
    colorHex: '#b45309',
    hasHeavyDeformation: true,
  },
  [TerrainType.CRACKED_EARTH]: {
    type: TerrainType.CRACKED_EARTH,
    nameVi: 'Đất Nứt Nẻ Khô Hạn',
    speedModifier: 0.90, // Giảm 10%
    footprintDepth: 0.4,
    footprintDurationSec: 8.0,
    particleType: 'dust_puff',
    colorHex: '#8c5a36',
    hasHeavyDeformation: false,
  },
  [TerrainType.SWAMP_MUD]: {
    type: TerrainType.SWAMP_MUD,
    nameVi: 'Đầm Lầy Bùn Đen',
    speedModifier: 0.60, // Giảm 40%
    footprintDepth: 2.5,
    footprintDurationSec: 18.0,
    particleType: 'mud_splash',
    colorHex: '#2b1d12',
    hasHeavyDeformation: true,
  },
  [TerrainType.GRAVEL_ROCK]: {
    type: TerrainType.GRAVEL_ROCK,
    nameVi: 'Đá Dăm & Sỏi Xám',
    speedModifier: 0.95, // Giảm 5%
    footprintDepth: 0.1,
    footprintDurationSec: 4.0,
    particleType: 'pebble_kick',
    colorHex: '#64748b',
    hasHeavyDeformation: false,
  },
  [TerrainType.OASIS_HUMUS]: {
    type: TerrainType.OASIS_HUMUS,
    nameVi: 'Đất Ẩm Màu Mỡ Ốc Đảo',
    speedModifier: 1.0,
    footprintDepth: 0.8,
    footprintDurationSec: 9.0,
    particleType: 'dew_splash',
    colorHex: '#1e293b',
    hasHeavyDeformation: false,
  },
  [TerrainType.DEEP_WATER]: {
    type: TerrainType.DEEP_WATER,
    nameVi: 'Hồ Nước Sâu',
    speedModifier: 0.35, // Giảm 65%
    footprintDepth: 3.0,
    footprintDurationSec: 1.0,
    particleType: 'dew_splash',
    colorHex: '#0369a1',
    hasHeavyDeformation: false,
  },
};

export function getTerrainSurfaceDef(type: TerrainType): TerrainSurfaceDef {
  return TERRAIN_SURFACE_REGISTRY[type] ?? TERRAIN_SURFACE_REGISTRY[TerrainType.FERN_CARPET];
}

/** Phân hạng cân nặng sinh vật để scale kích thước và độ lún dấu chân */
export const EntityWeightCategory = {
  /** Dưới 50kg: Người tiền sử, Compsognathus, chim tiền sử */
  SMALL: 'small',
  /** 50kg - 500kg: Velociraptor, thợ săn trang bị nặng, Deinonychus */
  MEDIUM: 'medium',
  /** 500kg - 4,000kg: Triceratops, Stegosaurus, Allosaurus */
  LARGE: 'large',
  /** Trên 4,000kg: T-Rex, Brachiosaurus, Sauropod khổng lồ */
  COLOSSAL: 'colossal',
} as const;

export type EntityWeightCategory = typeof EntityWeightCategory[keyof typeof EntityWeightCategory];

export interface WeightCategoryDef {
  category: EntityWeightCategory;
  nameVi: string;
  minKg: number;
  maxKg: number;
  /** Hệ số kích thước dấu chân (1.0 = chuẩn người) */
  sizeScale: number;
  /** Hệ số độ sâu lún đất */
  depthScale: number;
  /** Khoảng cách sải chân tối thiểu để sinh dấu chân tiếp theo (mét) */
  strideMeters: number;
  /** Có gây rung đất khi dẫm xuống không */
  causesGroundShake: boolean;
}

export const WEIGHT_CATEGORY_DEFS: Record<EntityWeightCategory, WeightCategoryDef> = {
  [EntityWeightCategory.SMALL]: {
    category: EntityWeightCategory.SMALL,
    nameVi: 'Nhẹ (< 50kg)',
    minKg: 0,
    maxKg: 50,
    sizeScale: 0.5,
    depthScale: 0.5,
    strideMeters: 0.8,
    causesGroundShake: false,
  },
  [EntityWeightCategory.MEDIUM]: {
    category: EntityWeightCategory.MEDIUM,
    nameVi: 'Trung bình (50 - 500kg)',
    minKg: 50,
    maxKg: 500,
    sizeScale: 1.0,
    depthScale: 1.0,
    strideMeters: 1.4,
    causesGroundShake: false,
  },
  [EntityWeightCategory.LARGE]: {
    category: EntityWeightCategory.LARGE,
    nameVi: 'Nặng (500 - 4,000kg)',
    minKg: 500,
    maxKg: 4000,
    sizeScale: 2.2,
    depthScale: 1.8,
    strideMeters: 2.6,
    causesGroundShake: false,
  },
  [EntityWeightCategory.COLOSSAL]: {
    category: EntityWeightCategory.COLOSSAL,
    nameVi: 'Khổng lồ (> 4,000kg)',
    minKg: 4000,
    maxKg: 80000,
    sizeScale: 3.8,
    depthScale: 2.8,
    strideMeters: 4.2,
    causesGroundShake: true,
  },
};

export function getWeightCategory(weightKg: number): EntityWeightCategory {
  if (weightKg <= 50) return EntityWeightCategory.SMALL;
  if (weightKg <= 500) return EntityWeightCategory.MEDIUM;
  if (weightKg <= 4000) return EntityWeightCategory.LARGE;
  return EntityWeightCategory.COLOSSAL;
}

// ----------------------------------------------------------------------------
// ZERO-ALLOCATION OBJECT POOLING SYSTEM
// ----------------------------------------------------------------------------

export interface IPoolable {
  active: boolean;
  reset(): void;
}

/** Generic Object Pool tối ưu hóa bộ nhớ, loại bỏ hoàn toàn Garbage Collection trong game loop */
export class ObjectPool<T extends IPoolable> {
  private readonly pool: T[] = [];
  private readonly factory: () => T;
  private _activeCount = 0;

  constructor(factory: () => T, initialCapacity: number) {
    this.factory = factory;
    for (let i = 0; i < initialCapacity; i++) {
      const item = this.factory();
      item.active = false;
      this.pool.push(item);
    }
  }

  /** Lấy một object từ pool hoặc tạo mới nếu pool cạn */
  acquire(): T {
    for (let i = 0; i < this.pool.length; i++) {
      const item = this.pool[i];
      if (!item.active) {
        item.active = true;
        this._activeCount++;
        return item;
      }
    }
    // Mở rộng pool nếu hết chỗ
    const newItem = this.factory();
    newItem.active = true;
    this.pool.push(newItem);
    this._activeCount++;
    return newItem;
  }

  /** Trả object về pool và reset trạng thái */
  release(item: T): void {
    if (item.active) {
      item.active = false;
      item.reset();
      this._activeCount = Math.max(0, this._activeCount - 1);
    }
  }

  /** Trả toàn bộ active objects về pool */
  releaseAll(): void {
    for (const item of this.pool) {
      if (item.active) {
        item.active = false;
        item.reset();
      }
    }
    this._activeCount = 0;
  }

  get activeCount(): number {
    return this._activeCount;
  }

  get totalCapacity(): number {
    return this.pool.length;
  }

  forEachActive(callback: (item: T) => void): void {
    for (let i = 0; i < this.pool.length; i++) {
      const item = this.pool[i];
      if (item.active) {
        callback(item);
      }
    }
  }
}

// ----------------------------------------------------------------------------
// DẤU CHÂN (FOOTPRINT) & HỆ THỐNG HẠT (PARTICLES)
// ----------------------------------------------------------------------------

export class Footprint implements IPoolable {
  active = false;
  x = 0;
  y = 0;
  headingRad = 0;
  size = 1.0;
  depth = 1.0;
  terrainType: TerrainType = TerrainType.FERN_CARPET;
  alpha = 1.0;
  elapsedSec = 0;
  maxDurationSec = 8.0;
  isLeftFoot = false;
  entityWeightCategory: EntityWeightCategory = EntityWeightCategory.MEDIUM;

  reset(): void {
    this.x = 0;
    this.y = 0;
    this.headingRad = 0;
    this.size = 1.0;
    this.depth = 1.0;
    this.terrainType = TerrainType.FERN_CARPET;
    this.alpha = 1.0;
    this.elapsedSec = 0;
    this.maxDurationSec = 8.0;
    this.isLeftFoot = false;
    this.entityWeightCategory = EntityWeightCategory.MEDIUM;
  }
}

export class TerrainParticle implements IPoolable {
  active = false;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  size = 1.0;
  colorHex = '#ffffff';
  alpha = 1.0;
  elapsedSec = 0;
  maxLifeSec = 0.6;
  type: ParticleType = 'mud_splash';

  reset(): void {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.size = 1.0;
    this.colorHex = '#ffffff';
    this.alpha = 1.0;
    this.elapsedSec = 0;
    this.maxLifeSec = 0.6;
    this.type = 'mud_splash';
  }
}

export interface EntityStepState {
  entityId: string;
  lastStepX: number;
  lastStepY: number;
  isLeftFoot: boolean;
  weightKg: number;
}

export class FootprintManager {
  readonly footprintPool: ObjectPool<Footprint>;
  readonly particlePool: ObjectPool<TerrainParticle>;
  private readonly entityStates = new Map<string, EntityStepState>();

  constructor(initialFootprints = 300, initialParticles = 500) {
    this.footprintPool = new ObjectPool(() => new Footprint(), initialFootprints);
    this.particlePool = new ObjectPool(() => new TerrainParticle(), initialParticles);
  }

  /** Xử lý khi một thực thể di chuyển. Tự động tính toán sải chân và sinh dấu chân + hạt */
  onEntityMove(
    entityId: string,
    currentX: number,
    currentY: number,
    headingRad: number,
    weightKg: number,
    currentTerrain: TerrainType,
  ): { spawnedFootprint: boolean; spawnedParticlesCount: number } {
    let state = this.entityStates.get(entityId);
    if (!state) {
      state = {
        entityId,
        lastStepX: currentX,
        lastStepY: currentY,
        isLeftFoot: true,
        weightKg,
      };
      this.entityStates.set(entityId, state);
      return { spawnedFootprint: false, spawnedParticlesCount: 0 };
    }

    state.weightKg = weightKg;
    const dx = currentX - state.lastStepX;
    const dy = currentY - state.lastStepY;
    const distTraveled = Math.hypot(dx, dy);

    const weightCat = getWeightCategory(weightKg);
    const weightDef = WEIGHT_CATEGORY_DEFS[weightCat];
    const surfaceDef = getTerrainSurfaceDef(currentTerrain);

    if (distTraveled >= weightDef.strideMeters) {
      // 1. Tạo dấu chân từ Object Pool
      const fp = this.footprintPool.acquire();
      state.isLeftFoot = !state.isLeftFoot;

      // Độ lệch chân trái/phải vuông góc với hướng di chuyển
      const perpAngle = headingRad + (state.isLeftFoot ? Math.PI / 2 : -Math.PI / 2);
      const footSpread = 0.25 * weightDef.sizeScale;
      const stepX = currentX + Math.cos(perpAngle) * footSpread;
      const stepY = currentY + Math.sin(perpAngle) * footSpread;

      fp.x = stepX;
      fp.y = stepY;
      fp.headingRad = headingRad;
      fp.size = weightDef.sizeScale;
      fp.depth = surfaceDef.footprintDepth * weightDef.depthScale;
      fp.terrainType = currentTerrain;
      fp.alpha = 1.0;
      fp.elapsedSec = 0;
      fp.maxDurationSec = surfaceDef.footprintDurationSec;
      fp.isLeftFoot = state.isLeftFoot;
      fp.entityWeightCategory = weightCat;

      state.lastStepX = currentX;
      state.lastStepY = currentY;

      // 2. Kích hoạt hiệu ứng hạt (Particle Burst) nếu bề mặt có biến dạng lớn (Đầm lầy / Cát đỏ / Cát mịn)
      let particlesCount = 0;
      if (surfaceDef.hasHeavyDeformation) {
        particlesCount = this.spawnStepParticles(stepX, stepY, headingRad, surfaceDef, weightDef);
      }

      return { spawnedFootprint: true, spawnedParticlesCount: particlesCount };
    }

    return { spawnedFootprint: false, spawnedParticlesCount: 0 };
  }

  /** Sinh các hạt văng bùn/bụi cát theo hướng bước chân */
  private spawnStepParticles(
    x: number,
    y: number,
    headingRad: number,
    surfaceDef: TerrainSurfaceDef,
    weightDef: WeightCategoryDef,
  ): number {
    const count = Math.round((surfaceDef.type === TerrainType.SWAMP_MUD ? 6 : 4) * weightDef.sizeScale);
    const spreadAngle = Math.PI * 0.7;

    for (let i = 0; i < count; i++) {
      const p = this.particlePool.acquire();
      const angle = headingRad + Math.PI + (Math.random() - 0.5) * spreadAngle;
      const speed = (1.5 + Math.random() * 2.5) * weightDef.depthScale;

      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.size = (1.2 + Math.random() * 1.8) * weightDef.sizeScale;
      p.colorHex = surfaceDef.colorHex;
      p.alpha = 0.9;
      p.elapsedSec = 0;
      p.maxLifeSec = 0.4 + Math.random() * 0.35;
      p.type = surfaceDef.particleType;
    }

    return count;
  }

  /** Cập nhật mờ dần và thu hồi các dấu chân & hạt đã hết hạn */
  tick(dtSec: number): void {
    // 1. Cập nhật Dấu chân
    this.footprintPool.forEachActive((fp) => {
      fp.elapsedSec += dtSec;
      if (fp.elapsedSec >= fp.maxDurationSec) {
        this.footprintPool.release(fp);
      } else {
        // Mờ dần theo hàm tuyến tính mượt (Linear fade out)
        fp.alpha = Math.max(0, 1.0 - fp.elapsedSec / fp.maxDurationSec);
      }
    });

    // 2. Cập nhật Hạt Particle
    this.particlePool.forEachActive((p) => {
      p.elapsedSec += dtSec;
      if (p.elapsedSec >= p.maxLifeSec) {
        this.particlePool.release(p);
      } else {
        p.x += p.vx * dtSec;
        p.y += p.vy * dtSec;
        // Giảm vận tốc do ma sát
        p.vx *= 0.92;
        p.vy *= 0.92;
        p.alpha = Math.max(0, 1.0 - p.elapsedSec / p.maxLifeSec);
      }
    });
  }

  /** Xoá dữ liệu một thực thể khi bị destroy */
  removeEntity(entityId: string): void {
    this.entityStates.delete(entityId);
  }
}

// ============================================================================
// MODULE 2: THUẬT TOÁN SINH ĐỊA HÌNH CHO 2 BẢN ĐỒ (BIOME MAP GENERATOR)
// ============================================================================

export type BiomeId = 'triassic_red_desert' | 'jurassic_emerald_jungle';

export const ObstacleType = {
  NONE: 'none',
  /** Vách đá canyon dựng đứng */
  CANYON_WALL: 'canyon_wall',
  /** Bộ xương khủng long cổ đại khổng lồ */
  GIANT_FOSSIL_SKELETON: 'giant_fossil_skeleton',
  /** Rễ cây cổ thụ khổng lồ nổi trên mặt đất */
  BUTTRESS_ROOT: 'buttress_root',
  /** Thân cây đại thụ đổ ngang bắc qua đầm */
  FALLEN_LOG: 'fallen_log',
  /** Cây lá kim / Cây Tuế cổ thụ có tán che */
  GIANT_CONIFER_TREE: 'giant_conifer_tree',
  /** Cây Bạch Quả ốc đảo */
  GINKGO_TREE: 'ginkgo_tree',
  /** Cụm Dương Xỉ Thân Gỗ (Khu vực ẩn nấp 3m) */
  TREE_FERN_THICKET: 'tree_fern_thicket',
} as const;

export type ObstacleType = typeof ObstacleType[keyof typeof ObstacleType];

export interface BiomeCell {
  gridX: number;
  gridY: number;
  worldX: number;
  worldY: number;
  elevation: number; // 0.0 .. 1.0
  moisture: number;  // 0.0 .. 1.0
  terrainType: TerrainType;
  obstacleType: ObstacleType;
  isWalkable: boolean;
  isOasisPoi: boolean;
  isStealthBrush: boolean;
  canopyRadius: number; // > 0 nếu là cây cổ thụ có tán che
}

/** Bộ sinh số ngẫu nhiên xác định (Deterministic PRNG & Simplex-style Noise) */
export class ProceduralNoise {
  private readonly seed: number;

  constructor(seed = 1337) {
    this.seed = seed;
  }

  private hash(x: number, y: number): number {
    let n = Math.sin(x * 12.9898 + y * 78.233 + this.seed * 0.1337) * 43758.5453123;
    return n - Math.floor(n);
  }

  /** 2D Value / Smooth Noise */
  noise2D(x: number, y: number): number {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = x - i;
    const fy = y - j;

    // Hermite smoothstep
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);

    const n00 = this.hash(i, j);
    const n10 = this.hash(i + 1, j);
    const n01 = this.hash(i, j + 1);
    const n11 = this.hash(i + 1, j + 1);

    const nx0 = n00 + sx * (n10 - n00);
    const nx1 = n01 + sx * (n11 - n01);

    return nx0 + sy * (nx1 - nx0);
  }

  /** Fractal Brownian Motion (Multi-octave noise) */
  fbm(x: number, y: number, octaves = 4, persistence = 0.5, lacunarity = 2.0): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }

  /** Ridge noise tạo các vách núi và rãnh hẻm hẹp (Chokepoints) */
  ridgeNoise(x: number, y: number, octaves = 3): number {
    let n = this.fbm(x, y, octaves);
    return 1.0 - Math.abs(n * 2.0 - 1.0);
  }
}

export class DinoBiomeMap {
  readonly biome: BiomeId;
  readonly width: number;
  readonly height: number;
  readonly cellSizeMeters: number;
  readonly cells: BiomeCell[][];
  readonly oasisPoiPosition: { x: number; y: number } | null = null;
  readonly canopyTrees: Array<{ x: number; y: number; radius: number; heightMeters: number }> = [];
  readonly stealthZones: Array<{ id: string; x: number; y: number; radius: number }> = [];

  constructor(biome: BiomeId, width = 64, height = 64, cellSizeMeters = 2.0, seed = 42) {
    this.biome = biome;
    this.width = width;
    this.height = height;
    this.cellSizeMeters = cellSizeMeters;
    this.cells = [];

    const noise = new ProceduralNoise(seed);

    // Khởi tạo lưới tế bào
    for (let y = 0; y < height; y++) {
      const row: BiomeCell[] = [];
      for (let x = 0; x < width; x++) {
        row.push({
          gridX: x,
          gridY: y,
          worldX: x * cellSizeMeters,
          worldY: y * cellSizeMeters,
          elevation: 0,
          moisture: 0,
          terrainType: TerrainType.FERN_CARPET,
          obstacleType: ObstacleType.NONE,
          isWalkable: true,
          isOasisPoi: false,
          isStealthBrush: false,
          canopyRadius: 0,
        });
      }
      this.cells.push(row);
    }

    if (biome === 'triassic_red_desert') {
      this.oasisPoiPosition = this.generateTriassicRedDesert(noise);
    } else {
      this.generateJurassicEmeraldJungle(noise);
    }
  }

  /** Lấy tế bào tại tọa độ thế giới (world meters) */
  getCellAtWorldPos(worldX: number, worldY: number): BiomeCell | null {
    const gx = Math.floor(worldX / this.cellSizeMeters);
    const gy = Math.floor(worldY / this.cellSizeMeters);
    if (gx < 0 || gx >= this.width || gy < 0 || gy >= this.height) return null;
    return this.cells[gy][gx];
  }

  /** Kiểm tra vận tốc và va chạm tại vị trí thế giới */
  getTerrainSpeedModifier(worldX: number, worldY: number): number {
    const cell = this.getCellAtWorldPos(worldX, worldY);
    if (!cell || !cell.isWalkable) return 0.0;
    return getTerrainSurfaceDef(cell.terrainType).speedModifier;
  }

  // --------------------------------------------------------------------------
  // MAP 1: SA MẠC ĐỎ (KỶ TAM ĐIỆP)
  // --------------------------------------------------------------------------
  private generateTriassicRedDesert(noise: ProceduralNoise): { x: number; y: number } {
    let minElevation = 1.0;
    let minElevCell: { x: number; y: number } = { x: Math.floor(this.width / 2), y: Math.floor(this.height / 2) };

    // 1. Phân bố độ cao và loại đất
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        const nx = x * 0.06;
        const ny = y * 0.06;

        // Cao độ sa mạc
        const elev = noise.fbm(nx, ny, 4, 0.45, 2.1);
        cell.elevation = elev;

        if (elev < minElevation) {
          minElevation = elev;
          minElevCell = { x, y };
        }

        // Tỉ lệ hòa trộn: Cát đỏ (khoảng 70% sau khi sinh Canyon và Ốc đảo)
        if (elev > 0.88) {
          cell.terrainType = TerrainType.GRAVEL_ROCK; // Gò cao đá dăm
        } else if (elev < 0.12) {
          cell.terrainType = TerrainType.CRACKED_EARTH; // Vùng trũng đất sét nứt nẻ
        } else {
          cell.terrainType = TerrainType.RED_SAND; // Nền Cát đỏ Tam điệp
        }
      }
    }

    // 2. Vách đá Canyon bị gió bào mòn tạo chokepoints
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        const ridge = noise.ridgeNoise(x * 0.08, y * 0.08, 3);

        // Đường vân vách đá hẹp sắc cạnh
        if (ridge > 0.91 && cell.elevation > 0.45) {
          cell.obstacleType = ObstacleType.CANYON_WALL;
          cell.isWalkable = false;
          cell.terrainType = TerrainType.GRAVEL_ROCK;
        }
      }
    }

    // 3. Rải rác bộ xương hóa thạch khủng long cổ đại
    const fossilCount = 6;
    for (let i = 0; i < fossilCount; i++) {
      const fx = Math.floor(noise.noise2D(i * 17.1, i * 31.4) * (this.width - 10)) + 5;
      const fy = Math.floor(noise.noise2D(i * 43.7, i * 19.8) * (this.height - 10)) + 5;
      const cell = this.cells[fy][fx];
      if (cell.isWalkable && cell.terrainType === TerrainType.RED_SAND) {
        cell.obstacleType = ObstacleType.GIANT_FOSSIL_SKELETON;
        cell.isWalkable = false;
      }
    }

    // 4. Sinh Ốc Đảo (Oasis POI) tại vùng thấp nhất bản đồ
    const ox = minElevCell.x;
    const oy = minElevCell.y;
    const oasisRadius = 7;

    for (let dy = -oasisRadius; dy <= oasisRadius; dy++) {
      for (let dx = -oasisRadius; dx <= oasisRadius; dx++) {
        const gx = ox + dx;
        const gy = oy + dy;
        if (gx < 0 || gx >= this.width || gy < 0 || gy >= this.height) continue;

        const dist = Math.hypot(dx, dy);
        const cell = this.cells[gy][gx];

        if (dist <= 2.2) {
          // Lòng hồ nước xanh thẫm
          cell.terrainType = TerrainType.DEEP_WATER;
          cell.isWalkable = false;
          cell.isOasisPoi = true;
        } else if (dist <= 4.5) {
          // Đất ẩm màu mỡ ven hồ
          cell.terrainType = TerrainType.OASIS_HUMUS;
          cell.isWalkable = true;
          cell.isOasisPoi = true;

          // Cây Bạch Quả (Ginkgo) mọc vòng tròn
          if (dist >= 3.2 && (dx + dy) % 3 === 0) {
            cell.obstacleType = ObstacleType.GINKGO_TREE;
            cell.isWalkable = false;
            cell.canopyRadius = 3.5;
            this.canopyTrees.push({
              x: cell.worldX,
              y: cell.worldY,
              radius: 3.5 * this.cellSizeMeters,
              heightMeters: 25,
            });
          }
        } else if (dist <= oasisRadius) {
          // Vành đai Thảm dương xỉ xanh rì
          cell.terrainType = TerrainType.FERN_CARPET;
          cell.isWalkable = true;
          cell.isOasisPoi = true;
        }
      }
    }

    return { x: ox * this.cellSizeMeters, y: oy * this.cellSizeMeters };
  }

  // --------------------------------------------------------------------------
  // MAP 2: RỪNG RẬM LỤC BẢO (KỶ GIURA)
  // --------------------------------------------------------------------------
  private generateJurassicEmeraldJungle(noise: ProceduralNoise): void {
    // 1. Phủ kín bằng Thảm Dương Xỉ xanh và Đầm Lầy bùn đen ở vùng trũng
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        const elev = noise.fbm(x * 0.05, y * 0.05, 4, 0.5, 2.0);
        const moisture = noise.fbm((x + 100) * 0.04, (y + 100) * 0.04, 3);
        cell.elevation = elev;
        cell.moisture = moisture;

        // Vùng thấp ẩm ướt biến thành Đầm lầy bùn đen lấp lánh
        if (elev < 0.42 && moisture > 0.35) {
          cell.terrainType = TerrainType.SWAMP_MUD;
        } else {
          // 100% Thực vật tiền sử — Thảm dương xỉ xanh mướt (Tuyệt đối không dùng cỏ hiện đại)
          cell.terrainType = TerrainType.FERN_CARPET;
        }
      }
    }

    // 2. Đặt các Cây Lá Kim & Cây Tuế Cổ Thụ Khổng Lồ (Phân bố tự nhiên quanh bìa rừng, chừa khoảng trống quang đãng quanh doanh trại)
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    for (let y = 5; y < this.height - 5; y += 14) {
      for (let x = 5; x < this.width - 5; x += 14) {
        const jx = x + Math.floor(noise.noise2D(x * 2.1, y * 2.1) * 4);
        const jy = y + Math.floor(noise.noise2D(x * 3.7, y * 3.7) * 4);

        if (jx >= 0 && jx < this.width && jy >= 0 && jy < this.height) {
          const distFromCenter = Math.hypot(jx - centerX, jy - centerY);
          // Giữ khoảng trống quang đãng (Sanctuary Clearing) bán kính ~10 ô quanh doanh trại
          if (distFromCenter < 9) continue;

          const cell = this.cells[jy][jx];
          if (cell.terrainType !== TerrainType.SWAMP_MUD) {
            cell.obstacleType = ObstacleType.GIANT_CONIFER_TREE;
            cell.isWalkable = false;
            cell.canopyRadius = 3.2;
            this.canopyTrees.push({
              x: cell.worldX,
              y: cell.worldY,
              radius: 3.2 * this.cellSizeMeters,
              heightMeters: 40,
            });

            // 3. Rễ cây cổ thụ khổng lồ (Buttress Roots) cuộn nổi xung quanh gốc cây
            const rootOffsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            for (const [rdx, rdy] of rootOffsets) {
              const rx = jx + rdx;
              const ry = jy + rdy;
              if (rx >= 0 && rx < this.width && ry >= 0 && ry < this.height) {
                const rootCell = this.cells[ry][rx];
                if (rootCell.obstacleType === ObstacleType.NONE) {
                  rootCell.obstacleType = ObstacleType.BUTTRESS_ROOT;
                  rootCell.isWalkable = false; // Buộc người chơi đi vòng
                }
              }
            }
          }
        }
      }
    }

    // 4. Thân cây cổ thụ đổ ngang (Fallen Logs) làm cầu hoặc chướng ngại vật qua đầm lầy
    for (let y = 3; y < this.height - 3; y += 6) {
      for (let x = 3; x < this.width - 3; x += 6) {
        const cell = this.cells[y][x];
        if (cell.terrainType === TerrainType.SWAMP_MUD && cell.obstacleType === ObstacleType.NONE) {
          // Thân cây đổ ngang 3 ô
          for (let len = 0; len < 3; len++) {
            const lx = x + len;
            if (lx < this.width) {
              const logCell = this.cells[y][lx];
              logCell.obstacleType = ObstacleType.FALLEN_LOG;
              logCell.terrainType = TerrainType.FERN_CARPET;
              logCell.isWalkable = true;
            }
          }
        }
      }
    }

    // 5. Tạo các Bụi Dương Xỉ Thân Gỗ Ẩn Nấp (Stealth Brush Zones cao 3m)
    const stealthZoneCount = 8;
    for (let i = 0; i < stealthZoneCount; i++) {
      const bx = Math.floor(noise.noise2D(i * 53.1, i * 71.3) * (this.width - 8)) + 4;
      const by = Math.floor(noise.noise2D(i * 19.4, i * 87.2) * (this.height - 8)) + 4;
      const radius = 3;

      const zoneId = `stealth_zone_${i + 1}`;
      this.stealthZones.push({
        id: zoneId,
        x: bx * this.cellSizeMeters,
        y: by * this.cellSizeMeters,
        radius: radius * this.cellSizeMeters,
      });

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const gx = bx + dx;
          const gy = by + dy;
          if (gx >= 0 && gx < this.width && gy >= 0 && gy < this.height) {
            if (Math.hypot(dx, dy) <= radius) {
              const bCell = this.cells[gy][gx];
              if (bCell.obstacleType === ObstacleType.NONE) {
                bCell.obstacleType = ObstacleType.TREE_FERN_THICKET;
                bCell.isStealthBrush = true;
                bCell.isWalkable = true;
              }
            }
          }
        }
      }
    }
  }
}

// ============================================================================
// MODULE 3: QUẢN LÝ TẦM NHÌN GÓC NHÌN TRÊN CAO (TOP-DOWN VISION)
// ============================================================================

export interface TreeCanopyNode {
  id: string;
  worldX: number;
  worldY: number;
  radiusMeters: number;
  heightMeters: number;
  currentAlpha: number; // 0.2 .. 1.0
  targetAlpha: number;
  fadeSpeed: number;    // Tốc độ chuyển đổi alpha (per sec)
}

export interface EntityStealthState {
  entityId: string;
  isStealthed: boolean;
  currentStealthZoneId: string | null;
  stealthOpacity: number; // 0.5 khi ẩn nấp để người chơi tự nhìn thấy mình
}

export class TopDownVisionManager {
  readonly canopies: Map<string, TreeCanopyNode> = new Map();
  readonly stealthZones: Array<{ id: string; x: number; y: number; radius: number }> = [];

  constructor(map: DinoBiomeMap) {
    // 1. Đăng ký các tán cây từ bản đồ
    for (let i = 0; i < map.canopyTrees.length; i++) {
      const tree = map.canopyTrees[i];
      const id = `canopy_tree_${i + 1}`;
      this.canopies.set(id, {
        id,
        worldX: tree.x,
        worldY: tree.y,
        radiusMeters: tree.radius,
        heightMeters: tree.heightMeters,
        currentAlpha: 1.0,
        targetAlpha: 1.0,
        fadeSpeed: 4.5, // Chuyển đổi mượt trong ~0.22s
      });
    }

    // 2. Đăng ký các vùng bụi cây ẩn nấp
    this.stealthZones = [...map.stealthZones];
  }

  /**
   * Cập nhật tầm nhìn Top-Down dựa trên vị trí Camera / Người chơi.
   * Khi nhân vật đi dưới tán cây khổng lồ (30-50m), alpha tán cây tự động fade về 0.2.
   */
  updateCanopyFade(playerWorldX: number, playerWorldY: number, dtSec: number): void {
    for (const canopy of this.canopies.values()) {
      const dist = Math.hypot(playerWorldX - canopy.worldX, playerWorldY - canopy.worldY);
      const isUnderneath = dist <= canopy.radiusMeters;

      // Nếu người chơi ở dưới tán cây: giảm alpha xuống 0.2; ra ngoài: hồi phục về 1.0
      canopy.targetAlpha = isUnderneath ? 0.2 : 1.0;

      // Smooth Lerp Transition
      if (Math.abs(canopy.currentAlpha - canopy.targetAlpha) > 0.001) {
        const step = canopy.fadeSpeed * dtSec;
        if (canopy.currentAlpha < canopy.targetAlpha) {
          canopy.currentAlpha = Math.min(canopy.targetAlpha, canopy.currentAlpha + step);
        } else {
          canopy.currentAlpha = Math.max(canopy.targetAlpha, canopy.currentAlpha - step);
        }
      }
    }
  }

  /**
   * Kiểm tra và cập nhật trạng thái ẩn nấp của thực thể trong Bụi Dương Xỉ Thân Gỗ (Stealth Brush).
   */
  checkEntityStealth(entityId: string, worldX: number, worldY: number): EntityStealthState {
    let insideZoneId: string | null = null;

    for (const zone of this.stealthZones) {
      const d = Math.hypot(worldX - zone.x, worldY - zone.y);
      if (d <= zone.radius) {
        insideZoneId = zone.id;
        break;
      }
    }

    const isStealthed = insideZoneId !== null;
    return {
      entityId,
      isStealthed,
      currentStealthZoneId: insideZoneId,
      stealthOpacity: isStealthed ? 0.5 : 1.0, // Visual hint cho người chơi
    };
  }

  /**
   * Kiểm tra kẻ địch có thể phát hiện người chơi không (Cơ chế bụi cỏ MOBA).
   * - Nếu người chơi ở ngoài bụi: Kẻ địch phát hiện bình thường nếu trong tầm nhìn (LOS).
   * - Nếu người chơi ở trong bụi: Kẻ địch KHÔNG THỂ phát hiện, trừ khi kẻ địch cùng bước vào chung cụm bụi đó trong cự ly cực gần (<= 2m).
   */
  canEnemyDetectTarget(
    enemyWorldX: number,
    enemyWorldY: number,
    enemyVisionRangeMeters: number,
    targetWorldX: number,
    targetWorldY: number,
    targetStealth: EntityStealthState,
  ): { canDetect: boolean; reasonVi: string } {
    const distToTarget = Math.hypot(enemyWorldX - targetWorldX, enemyWorldY - targetWorldY);

    if (distToTarget > enemyVisionRangeMeters) {
      return { canDetect: false, reasonVi: 'Ngoài tầm nhìn quan sát' };
    }

    // Nếu mục tiêu KHÔNG ẩn nấp trong bụi
    if (!targetStealth.isStealthed) {
      return { canDetect: true, reasonVi: 'Phát hiện mục tiêu trên bãi đất trống' };
    }

    // Mục tiêu ĐANG ẩn nấp trong bụi: Kẻ địch chỉ phát hiện nếu ở chung cụm bụi và cự ly <= 2.0m
    const enemyStealth = this.checkEntityStealth('enemy', enemyWorldX, enemyWorldY);
    const inSameBrush = enemyStealth.isStealthed && enemyStealth.currentStealthZoneId === targetStealth.currentStealthZoneId;

    if (inSameBrush && distToTarget <= 2.0) {
      return { canDetect: true, reasonVi: 'Phát hiện mục tiêu do tiếp cận cực gần trong cùng bụi dương xỉ' };
    }

    return { canDetect: false, reasonVi: 'Mục tiêu đang ẩn nấp hoàn hảo trong Bụi Dương Xỉ Thân Gỗ' };
  }
}
