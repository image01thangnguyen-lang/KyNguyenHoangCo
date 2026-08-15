/**
 * Kiểu dữ liệu dùng chung cho toàn bộ vòng lặp cốt lõi.
 * Không import gì từ Node hay DOM — module này phải chạy được cả trên server và trong browser.
 */

export type ZoneId = 'trail' | 'wilderness' | 'forest' | 'water' | 'merchant';
export type StationId = 'campfire' | 'drying_rack' | 'kiln' | 'forge';
export type DefenseStructureId =
  | 'thorn_fence'
  | 'spike_trap'
  | 'wooden_wall'
  | 'stone_wall'
  | 'watch_tower'
  | 'ballista';

export type ItemId = string;
export type Inventory = Record<ItemId, number>;

// ---------------------------------------------------------------- định nghĩa dữ liệu

export type ItemKind =
  | 'material'
  | 'food'
  | 'drink'
  | 'consumable'
  | 'tool'
  | 'deployable'
  | 'weapon'
  | 'ammo'
  | 'armor';

export interface ItemDef {
  id: ItemId;
  nameVi: string;
  kind: ItemKind;
  stack: number;
  weight: number;
  safe?: boolean;
  satiety?: number;
  hydration?: number;
  hp?: number;
  raw?: boolean;
  shelfStable?: boolean;
  infectionRisk?: boolean;
  curesSickness?: boolean;
  durability?: number;
  attack?: number;
  defense?: number;
  chopBonus?: number;
  waterCapacity?: number;
  needsAmmo?: string;
}

export interface DropEntry {
  itemId: ItemId;
  weight: number;
  min: number;
  max: number;
}

export interface ItemStack {
  itemId: ItemId;
  qty: number;
}

export interface RecipeDef {
  id: string;
  nameVi: string;
  tier: 1 | 2 | 3;
  station: StationId | null;
  seconds: number;
  inputs: ItemStack[];
  outputKind: 'item' | 'station' | 'defense';
  outputId: string;
  outputQty: number;
  tutorial?: boolean;
}

export interface CampTierDef {
  level: 1 | 2 | 3;
  nameVi: string;
  eraVi: string;
  baseDefense: number;
  storageSlots: number;
  safeStorageSlots: number;
  maxDefenseStructures: number;
  unlocksStations: StationId[];
  upgradeToNext: { inputs: ItemStack[]; seconds: number; estimatedPlayDays: string } | null;
}

export interface DefenseStructureDef {
  id: DefenseStructureId;
  nameVi: string;
  defense: number;
  maxCount: number;
  hp?: number;
  consumedOnBreach?: boolean;
  bloodMoonDps?: number;
}

export interface MonsterDef {
  id: string;
  nameVi: string;
  hp: number;
  attack: number;
  threat: number;
}

export interface RewardEntry {
  itemId: ItemId;
  qty: number;
  chance: number;
}

// ---------------------------------------------------------------- trạng thái người chơi

export interface SurvivalState {
  /** Thanh "Đói" — 0..100, càng cao càng no. Xem chú thích trong survival.json. */
  satiety: number;
  /** Thanh "Khát" — 0..100, càng cao càng đủ nước. */
  hydration: number;
  hp: number;
  /** Mốc thời gian hết bệnh (ms epoch), null nếu không bệnh. */
  sickUntilMs: number | null;
  asleep: boolean;
  /** Mốc thời gian đã mô phỏng tới (ms epoch). */
  lastTickMs: number;
}

export interface StepLedger {
  /** Ngày theo múi giờ người chơi, dạng YYYY-MM-DD. */
  day: string;
  /** Tổng bước ghi nhận trong ngày (luôn hiển thị đủ, kể cả khi vượt trần thưởng). */
  totalSteps: number;
  /** Số bước đã được quy đổi thành lượt nhặt trong ngày (chặn ở trần 15.000). */
  rewardedSteps: number;
  /** Bước lẻ (đã nhân hệ số vùng) chưa đủ 100 để thành 1 lượt nhặt — chuyển sang lần sync sau. */
  carrySteps: number;
  /** Tổng số lượt nhặt trong ngày — dùng làm chỉ số seed để RNG server tái lập được. */
  pickupCount: number;
}

export interface CampState {
  level: 1 | 2 | 3;
  stations: StationId[];
  defenseStructures: Partial<Record<DefenseStructureId, number>>;
  /** Mốc hoàn tất nâng cấp đang chạy (ms epoch), null nếu không nâng cấp. */
  upgradeCompleteAtMs: number | null;
  /** Vị trí trại — chỉ lưu ô lưới, không lưu toạ độ chính xác (§6.3). */
  homeCell: string | null;
  /** Danh sách các luống đất trồng trọt quanh doanh trại */
  farmPlots?: any[];
}

/** Số liệu tích luỹ cả đời hồ sơ — dùng để chấm nhiệm vụ và kích hoạt beat cốt truyện. */
export interface LifetimeStats {
  steps: number;
  collected: Record<ItemId, number>;
  craftedRecipeIds: string[];
  /** Tổng số lần chế tạo thành công tích luỹ cả đời */
  craftCount?: number;
  visitedZones: ZoneId[];
  performedActionIds: string[];
  nightDefenseWins: number;
  nightDefenseLosses: number;
  bloodMoonWins: number;
  daysPlayed: number;
}

export interface PlacedTrap {
  id: string;
  trapItemId: 'rabbit_trap' | 'deer_trap' | 'beast_trap';
  nameVi: string;
  tier: 'small' | 'medium' | 'large';
  lat: number;
  lon: number;
  placedAtMs: number;
  readyAtMs: number;
  caughtItem: { itemId: ItemId; nameVi: string; qty: number } | null;
  collected: boolean;
}

export type Gender = 'male' | 'female';

/** Hồ sơ chơi — một máy chứa tối đa 2 hồ sơ (§3: anh em dùng chung điện thoại). */
export interface PlayerState {
  id: string;
  displayName: string;
  gender?: Gender;
  survival: SurvivalState;
  /** Đồ đang mang — mất 30% khi ngất (§5.1). */
  carried: Inventory;
  /** Két an toàn trong trại — không bao giờ mất. */
  safeStorage: Inventory;
  camp: CampState;
  steps: StepLedger;
  lifetime: LifetimeStats;
  knownRecipes: string[];
  /** Danh sách các bẫy thú đang đặt trên thế giới tại toạ độ thực */
  traps?: PlacedTrap[];
  /** Quả trứng đang ấp trong ba lô */
  incubatingEgg?: any | null;
  /** Danh sách linh thú / thú cưng tiền sử đồng hành */
  pets?: any[];
  /** Cấp bậc thợ thủ công chế tác (1..4) */
  artisanLevel?: number;
  createdAtMs: number;
}

// ---------------------------------------------------------------- kết quả các hành động

export interface PickupResult {
  pickups: number;
  gained: Inventory;
  /** Bước bị bỏ qua vì vượt trần 15.000/ngày — vẫn được đếm vào totalSteps. */
  cappedSteps: number;
  zone: ZoneId;
}

export interface SurvivalTickResult {
  survival: SurvivalState;
  hpLost: number;
  knockedOut: boolean;
  hoursSimulated: number;
  cappedByOfflineLimit: boolean;
}

export interface CraftAttempt {
  ok: boolean;
  reasonVi?: string;
  consumed?: ItemStack[];
  produced?: { kind: RecipeDef['outputKind']; id: string; qty: number };
  readyAtMs?: number;
}

export interface NightDefenseResult {
  survived: boolean;
  wavesCleared: number;
  totalWaves: number;
  playerPower: number;
  monsterThreat: number;
  structureDamage: Partial<Record<DefenseStructureId, number>>;
  lostItems: Inventory;
  rewards: Inventory;
  logVi: string[];
}

/**
 * Trạng thái trận Trăng Máu nằm trong `bloodMoon.ts` (kiểu `BloodMoonFight`) chứ không ở đây:
 * bản offline không còn Tộc chung một thanh HP trên server, nên nó là trạng thái cục bộ của
 * một hồ sơ, không phải kiểu dữ liệu chia sẻ giữa nhiều người chơi.
 */
