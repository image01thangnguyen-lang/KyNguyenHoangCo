/**
 * entityCatalog.ts
 * Bảng Danh mục Thực thể & Ánh xạ Sprite Sheet (In-Game Character & Creature Catalog)
 *
 * Quản lý Enum/Dictionary, rowIndex, và kích thước mét thực tế dựa trên khảo cổ & cổ sinh vật học (Paleontology & Archeology)
 * cho hơn 20 chủng loại nhân vật và dã thú tiền sử.
 */

export const EntityCatalogId = {
  // --- CỘT TRÁI (LEFT COLUMN / TIỀN SỬ 1) ---
  HERO_MALE: 'hero_male',             // Hàng 1: Dũng Sĩ Hoang Cổ (Nam)
  HERO_FEMALE: 'hero_female',         // Hàng 2: Dũng Sĩ Hoang Cổ (Nữ)
  SABERTOOTH_PET: 'sabertooth_pet',   // Hàng 3a: Thú cưng Cọp Răng Kiếm (Smilodon)
  EXPEDITION_BIRD: 'expedition_bird', // Hàng 3b: Linh Điểu Viễn Chinh
  TREX: 'trex',                       // Hàng 4a: Bạo Chúa Gargantuan T-Rex
  SPINOSAURUS: 'spinosaurus',         // Hàng 4b: Khủng Long Gai Thuyền Spinosaurus
  DILOPHOSAURUS: 'dilophosaurus',     // Hàng 4c: Khủng Long Song Mào Dilophosaurus
  TRICERATOPS: 'triceratops',         // Hàng 4d: Tam Giác Long Triceratops
  ANKYLOSAURUS: 'ankylosaurus',       // Hàng 4e: Khủng Long Thiết Giáp Ankylosaurus
  TITANOBOA_L: 'titanoboa_l',         // Hàng 4f: Cự Mãng Xà Titanoboa (Trái)
  SARCOSUCHUS_L: 'sarcosuchus_l',     // Hàng 4g: Cá Sấu Khổng Lồ Sarcosuchus (Trái)

  // --- CỘT PHẢI (RIGHT COLUMN / TIỀN SỬ 2) ---
  TITANOBOA: 'titanoboa',             // Hàng 4f (Phải): Cự Mãng Xà Titanoboa
  SARCOSUCHUS: 'sarcosuchus',         // Hàng 4g (Phải): Cá Sấu Khổng Lồ Sarcosuchus
  MAMMOTH: 'mammoth',                 // Hàng 4i: Voi Ma Mút Mammoth
  WOLF_PACK: 'wolf_pack',             // Hàng 4j: Bầy Sói Wolf Pack
  BRACHIOSAURUS: 'brachiosaurus',     // Hàng 4k: Khủng Long Cổ Dài Brachiosaurus
  PLESIOSAUR: 'plesiosaur',           // Hàng 4m: Thủy Long Plesiosaur
  VELOCIRAPTOR: 'velociraptor',       // Hàng 4n: Bầy Raptor Săn Mồi Velociraptor
  PTEROSAUR: 'pterosaur',             // Hàng 4o: Dực Long Bay Pterosaur
  GIANT_BOAR: 'giant_boar',           // Hàng 4q: Heo Rừng Khổng Lồ Giant Boar
  DEER_HERD: 'deer_herd',             // Hàng 4r: Đàn Hươu Sao Deer Herd
  WILD_HORSE: 'wild_horse',           // Hàng 4s: Đàn Ngựa Hoang Wild Horse Herd
} as const;

export type EntityCatalogId = typeof EntityCatalogId[keyof typeof EntityCatalogId];

export interface CatalogStripBounds {
  /** Tọa độ X bắt đầu của dải 6 khung hình trên Catalog Image */
  startX: number;
  /** Tọa độ Y bắt đầu của dải trên Catalog Image */
  startY: number;
  /** Tổng chiều rộng của toàn bộ 6 khung hình */
  stripWidth: number;
  /** Chiều cao của khung hình */
  stripHeight: number;
}

export interface EntityCatalogEntry {
  id: EntityCatalogId;
  nameVi: string;
  nameEn: string;
  rowIndex: number;
  /** Số khung hình trong dải (mặc định 6) */
  numFrames: number;
  /**
   * Kích thước vật lý quy ước theo mét thực tế (rộng, cao) trong thế giới 2.5D
   * Đồng bộ tỉ lệ giải phẫu học và cổ sinh vật học thật
   */
  meterWidth: number;
  meterHeight: number;
  /** Tốc độ lặp khung hình mặc định (frames per second) */
  defaultFps: number;
  /** Tùy chọn đặc biệt cho môi trường */
  isFlying?: boolean;
  isAquatic?: boolean;
  isSlithering?: boolean;
  isPack?: boolean;
  /** Tọa độ cắt ảnh từ file Catalog gốc (1024x558 px) */
  catalogBounds?: CatalogStripBounds;
}

/**
 * Bảng thông số chi tiết chuẩn xác theo kích thước thật (Meters)
 * Người cổ đại: cao 1.8m, rộng 0.9m
 * So với Ankylosaurus (7.5m x 2.8m) -> Khủng long dài gấp 8 lần và cao gấp 1.5 lần người!
 * So với T-Rex (12.5m x 5.8m) -> Khủng long bạo chúa cao gấp 3.2 lần và dài gấp 14 lần người!
 */
export const ENTITY_CATALOG: Record<EntityCatalogId, EntityCatalogEntry> = {
  // === CỘT TRÁI (Left Column) ===
  [EntityCatalogId.HERO_MALE]: {
    id: EntityCatalogId.HERO_MALE,
    nameVi: 'Dũng Sĩ Hoang Cổ (Nam)',
    nameEn: 'Ancient Male Hero',
    rowIndex: 0,
    numFrames: 6,
    meterWidth: 0.9,
    meterHeight: 1.8,
    defaultFps: 8,
    catalogBounds: { startX: 160, startY: 94, stripWidth: 326, stripHeight: 39 },
  },
  [EntityCatalogId.HERO_FEMALE]: {
    id: EntityCatalogId.HERO_FEMALE,
    nameVi: 'Dũng Sĩ Hoang Cổ (Nữ)',
    nameEn: 'Ancient Female Hero',
    rowIndex: 1,
    numFrames: 6,
    meterWidth: 0.85,
    meterHeight: 1.7,
    defaultFps: 8,
    catalogBounds: { startX: 160, startY: 133, stripWidth: 326, stripHeight: 39 },
  },
  [EntityCatalogId.SABERTOOTH_PET]: {
    id: EntityCatalogId.SABERTOOTH_PET,
    nameVi: 'Thú Cưng Cọp Răng Kiếm',
    nameEn: 'Saber-toothed Tiger Companion',
    rowIndex: 2,
    numFrames: 6,
    meterWidth: 2.2,
    meterHeight: 1.3,
    defaultFps: 9,
    catalogBounds: { startX: 160, startY: 172, stripWidth: 326, stripHeight: 39 },
  },
  [EntityCatalogId.EXPEDITION_BIRD]: {
    id: EntityCatalogId.EXPEDITION_BIRD,
    nameVi: 'Linh Điểu Viễn Chinh',
    nameEn: 'Expedition Bird',
    rowIndex: 3,
    numFrames: 6,
    meterWidth: 1.8,
    meterHeight: 1.2,
    defaultFps: 10,
    isFlying: true,
    catalogBounds: { startX: 160, startY: 211, stripWidth: 326, stripHeight: 39 },
  },
  [EntityCatalogId.TREX]: {
    id: EntityCatalogId.TREX,
    nameVi: 'Bạo Chúa T-Rex',
    nameEn: 'Gargantuan T-Rex',
    rowIndex: 4,
    numFrames: 6,
    meterWidth: 12.5,
    meterHeight: 5.8,
    defaultFps: 7,
    catalogBounds: { startX: 160, startY: 250, stripWidth: 326, stripHeight: 39 },
  },
  [EntityCatalogId.SPINOSAURUS]: {
    id: EntityCatalogId.SPINOSAURUS,
    nameVi: 'Khủng Long Gai Thuyền',
    nameEn: 'Spinosaurus',
    rowIndex: 5,
    numFrames: 6,
    meterWidth: 14.5,
    meterHeight: 6.2,
    defaultFps: 7,
    catalogBounds: { startX: 160, startY: 289, stripWidth: 326, stripHeight: 39 },
  },
  [EntityCatalogId.DILOPHOSAURUS]: {
    id: EntityCatalogId.DILOPHOSAURUS,
    nameVi: 'Khủng Long Song Mào',
    nameEn: 'Dilophosaurus',
    rowIndex: 6,
    numFrames: 6,
    meterWidth: 6.0,
    meterHeight: 2.8,
    defaultFps: 8,
    catalogBounds: { startX: 160, startY: 328, stripWidth: 326, stripHeight: 39 },
  },
  [EntityCatalogId.TRICERATOPS]: {
    id: EntityCatalogId.TRICERATOPS,
    nameVi: 'Tam Giác Long',
    nameEn: 'Triceratops',
    rowIndex: 7,
    numFrames: 6,
    meterWidth: 8.5,
    meterHeight: 3.5,
    defaultFps: 7,
    catalogBounds: { startX: 160, startY: 367, stripWidth: 326, stripHeight: 39 },
  },
  [EntityCatalogId.ANKYLOSAURUS]: {
    id: EntityCatalogId.ANKYLOSAURUS,
    nameVi: 'Khủng Long Thiết Giáp',
    nameEn: 'Ankylosaurus',
    rowIndex: 8,
    numFrames: 6,
    meterWidth: 7.5,
    meterHeight: 2.8,
    defaultFps: 7,
    catalogBounds: { startX: 160, startY: 406, stripWidth: 326, stripHeight: 39 },
  },
  [EntityCatalogId.TITANOBOA_L]: {
    id: EntityCatalogId.TITANOBOA_L,
    nameVi: 'Cự Mãng Xà Titanoboa',
    nameEn: 'Titanoboa',
    rowIndex: 9,
    numFrames: 6,
    meterWidth: 12.0,
    meterHeight: 3.2,
    defaultFps: 7,
    isSlithering: true,
    catalogBounds: { startX: 160, startY: 445, stripWidth: 326, stripHeight: 39 },
  },
  [EntityCatalogId.SARCOSUCHUS_L]: {
    id: EntityCatalogId.SARCOSUCHUS_L,
    nameVi: 'Cá Sấu Khổng Lồ Sarcosuchus',
    nameEn: 'Sarcosuchus',
    rowIndex: 10,
    numFrames: 6,
    meterWidth: 9.5,
    meterHeight: 2.2,
    defaultFps: 7,
    isAquatic: true,
    catalogBounds: { startX: 160, startY: 484, stripWidth: 326, stripHeight: 39 },
  },

  // === CỘT PHẢI (Right Column) ===
  [EntityCatalogId.TITANOBOA]: {
    id: EntityCatalogId.TITANOBOA,
    nameVi: 'Cự Mãng Xà Titanoboa',
    nameEn: 'Titanoboa',
    rowIndex: 11,
    numFrames: 6,
    meterWidth: 12.0,
    meterHeight: 3.2,
    defaultFps: 7,
    isSlithering: true,
    catalogBounds: { startX: 630, startY: 94, stripWidth: 330, stripHeight: 39 },
  },
  [EntityCatalogId.SARCOSUCHUS]: {
    id: EntityCatalogId.SARCOSUCHUS,
    nameVi: 'Cá Sấu Khổng Lồ Sarcosuchus',
    nameEn: 'Sarcosuchus',
    rowIndex: 12,
    numFrames: 6,
    meterWidth: 9.5,
    meterHeight: 2.2,
    defaultFps: 7,
    isAquatic: true,
    catalogBounds: { startX: 630, startY: 133, stripWidth: 330, stripHeight: 39 },
  },
  [EntityCatalogId.MAMMOTH]: {
    id: EntityCatalogId.MAMMOTH,
    nameVi: 'Voi Ma Mút',
    nameEn: 'Mammoth',
    rowIndex: 13,
    numFrames: 6,
    meterWidth: 6.0,
    meterHeight: 3.8,
    defaultFps: 7,
    catalogBounds: { startX: 630, startY: 172, stripWidth: 330, stripHeight: 39 },
  },
  [EntityCatalogId.WOLF_PACK]: {
    id: EntityCatalogId.WOLF_PACK,
    nameVi: 'Bầy Sói Hoang',
    nameEn: 'Wolf Pack',
    rowIndex: 14,
    numFrames: 6,
    meterWidth: 2.2,
    meterHeight: 1.2,
    defaultFps: 9,
    isPack: true,
    catalogBounds: { startX: 630, startY: 211, stripWidth: 330, stripHeight: 39 },
  },
  [EntityCatalogId.BRACHIOSAURUS]: {
    id: EntityCatalogId.BRACHIOSAURUS,
    nameVi: 'Khủng Long Cổ Dài',
    nameEn: 'Brachiosaurus',
    rowIndex: 15,
    numFrames: 6,
    meterWidth: 22.0,
    meterHeight: 13.0,
    defaultFps: 6,
    catalogBounds: { startX: 630, startY: 250, stripWidth: 330, stripHeight: 39 },
  },
  [EntityCatalogId.PLESIOSAUR]: {
    id: EntityCatalogId.PLESIOSAUR,
    nameVi: 'Thủy Long Plesiosaur',
    nameEn: 'Plesiosaur',
    rowIndex: 16,
    numFrames: 6,
    meterWidth: 10.0,
    meterHeight: 4.5,
    defaultFps: 7,
    isAquatic: true,
    catalogBounds: { startX: 630, startY: 289, stripWidth: 330, stripHeight: 39 },
  },
  [EntityCatalogId.VELOCIRAPTOR]: {
    id: EntityCatalogId.VELOCIRAPTOR,
    nameVi: 'Bầy Raptor Săn Mồi',
    nameEn: 'Velociraptor',
    rowIndex: 17,
    numFrames: 6,
    meterWidth: 3.5,
    meterHeight: 1.8,
    defaultFps: 9,
    catalogBounds: { startX: 630, startY: 328, stripWidth: 330, stripHeight: 39 },
  },
  [EntityCatalogId.PTEROSAUR]: {
    id: EntityCatalogId.PTEROSAUR,
    nameVi: 'Dực Long Bay',
    nameEn: 'Pterosaur',
    rowIndex: 18,
    numFrames: 6,
    meterWidth: 6.5,
    meterHeight: 3.0,
    defaultFps: 9,
    isFlying: true,
    catalogBounds: { startX: 630, startY: 367, stripWidth: 330, stripHeight: 39 },
  },
  [EntityCatalogId.GIANT_BOAR]: {
    id: EntityCatalogId.GIANT_BOAR,
    nameVi: 'Heo Rừng Cổ Đại',
    nameEn: 'Giant Boar',
    rowIndex: 19,
    numFrames: 6,
    meterWidth: 3.0,
    meterHeight: 1.8,
    defaultFps: 8,
    catalogBounds: { startX: 630, startY: 406, stripWidth: 330, stripHeight: 39 },
  },
  [EntityCatalogId.DEER_HERD]: {
    id: EntityCatalogId.DEER_HERD,
    nameVi: 'Đàn Hươu Sao',
    nameEn: 'Deer Herd',
    rowIndex: 20,
    numFrames: 6,
    meterWidth: 2.6,
    meterHeight: 2.4,
    defaultFps: 8,
    isPack: true,
    catalogBounds: { startX: 630, startY: 445, stripWidth: 330, stripHeight: 39 },
  },
  [EntityCatalogId.WILD_HORSE]: {
    id: EntityCatalogId.WILD_HORSE,
    nameVi: 'Đàn Ngựa Hoang',
    nameEn: 'Wild Horse Herd',
    rowIndex: 21,
    numFrames: 6,
    meterWidth: 2.5,
    meterHeight: 2.0,
    defaultFps: 9,
    isPack: true,
    catalogBounds: { startX: 630, startY: 484, stripWidth: 330, stripHeight: 39 },
  },
};

/**
 * Hàm tra cứu Catalog Entry theo ID hoặc theo species chuỗi thường
 */
export function getCatalogEntry(id: EntityCatalogId | string): EntityCatalogEntry | undefined {
  if (id in ENTITY_CATALOG) {
    return ENTITY_CATALOG[id as EntityCatalogId];
  }

  // Ánh xạ linh hoạt từ beast species name
  const normalized = id.toLowerCase().replace(/[\s_-]+/g, '');
  for (const entry of Object.values(ENTITY_CATALOG)) {
    const entryNorm = entry.id.toLowerCase().replace(/[\s_-]+/g, '');
    if (entryNorm === normalized || entryNorm.includes(normalized) || normalized.includes(entryNorm)) {
      return entry;
    }
  }

  return undefined;
}

/**
 * Ánh xạ từ BeastSpecies sang EntityCatalogId
 */
export function mapBeastSpeciesToCatalog(species: string): EntityCatalogId {
  switch (species.toLowerCase()) {
    case 'trex':
      return EntityCatalogId.TREX;
    case 'spinosaurus':
      return EntityCatalogId.SPINOSAURUS;
    case 'dilophosaurus':
      return EntityCatalogId.DILOPHOSAURUS;
    case 'triceratops':
      return EntityCatalogId.TRICERATOPS;
    case 'ankylosaurus':
      return EntityCatalogId.ANKYLOSAURUS;
    case 'titanoboa':
      return EntityCatalogId.TITANOBOA;
    case 'sarcosuchus':
    case 'croc':
      return EntityCatalogId.SARCOSUCHUS;
    case 'mammoth':
      return EntityCatalogId.MAMMOTH;
    case 'wolf':
      return EntityCatalogId.WOLF_PACK;
    case 'brachiosaurus':
      return EntityCatalogId.BRACHIOSAURUS;
    case 'plesiosaur':
      return EntityCatalogId.PLESIOSAUR;
    case 'velociraptor':
    case 'raptor':
      return EntityCatalogId.VELOCIRAPTOR;
    case 'pterosaur':
      return EntityCatalogId.PTEROSAUR;
    case 'boar':
    case 'giant_boar':
      return EntityCatalogId.GIANT_BOAR;
    case 'deer':
      return EntityCatalogId.DEER_HERD;
    case 'horse':
      return EntityCatalogId.WILD_HORSE;
    case 'sabertooth':
    case 'cavelion':
    case 'lion':
      return EntityCatalogId.SABERTOOTH_PET;
    default:
      return EntityCatalogId.TREX;
  }
}
