/**
 * Điểm khởi động của prototype.
 *
 * Kiến trúc: mọi luật chơi nằm trong `packages/game-core` (thuần khiết, có test). File này
 * chỉ làm ba việc — đọc tín hiệu nền tảng (bước chân, GPS, đồng hồ), gọi lõi, rồi vẽ kết quả.
 * Không có một dòng luật chơi nào ở đây, và không có lệnh gọi mạng nào ở bất cứ đâu.
 */

import {
  CAMP_TIERS,
  CHAPTERS,
  GAME_VERSION,
  ZONES,
  activeProfile,
  addItems,
  assertBalanceValid,
  beginBloodMoon,
  bloodMoonStatus,
  buildView,
  campDefensePower,
  cellAt,
  cellById,
  chapter,
  collectCrafts,
  collectTrap,
  consume,
  craft,
  createProfile,
  createSpeedState,
  dailyLimitFor,
  describeInventory,
  distanceMeters,
  exportBackup,
  findAction,
  finishBloodMoon,
  gather,
  getCampTier,
  hidePoi,
  importBackup,
  markBeatPlayed,
  merchantOffers,
  metersToLatDegrees,
  metersToLonDegrees,
  openApp,
  playBeat,
  placeTrap,
  poisNear,
  profileDayNumber,
  putProfile,
  runNightDefense,
  sampleHanoiPack,
  generateHanoiTreasureClue,
  claimHanoiTreasure,
  getHanoiExplorerTitle,
  type TreasureClue,
  setActiveSlot,
  sleepAtCamp,
  slotSummaries,
  storeInSafe,
  withdrawFromSafe,
  upgradeSafeVaultRank,
  getItem,
  strikeBoss,
  suggestBackupFileName,
  tickBloodMoonAllies,
  tickTraps,
  toLocalTime,
  trade,
  unlockGame,
  updateSettings,
  upgradeCamp,
  expandCampTerritory,
  wakeUp,
  weatherFor,
  startIncubation,
  tickEggIncubation,
  feedPet,
  plantInPlot,
  waterPlot,
  fertilizePlot,
  harvestPlot,
  tickFarmPlots,
  createCoopRoom,
  joinCoopRoom,
  startCoopBattle,
  processCoopRound,
  resolveCoopRewards,
  upgradeArtisanRankWithGold,
  upgradeFishTrapWithGold,
  buyItemFromNpc,
  sellItemToNpc,
  claimWeekendQuest,
  upgradeStrength,
  getArtisanRank,
  getSafeCapacity,
  MAX_STRENGTH_LEVEL,
  getStrengthUpgradeInfo,
  upgradeSpeed,
  getSpeedUpgradeInfo,
  calcMovementSpeedKmh,
  MAX_SPEED_LEVEL,
  maxWeightCapacity,
  processTransitMovement,
  canCollectOutpost,
  collectOutpostSupply,
  checkBeastTerritory,
  checkNightAmbientThreat,
  raidBeastDen,
  relocateCamp,
  RELOCATE_CAMP_COST_MATERIALS,
  RELOCATE_CAMP_COST_GOLD,
  updateDynamicBeastPacks,
  huntDynamicBeastPack,
  huntDynamicBeastRanged,
} from '../../../packages/game-core/src/index.ts';
import type {
  DifficultyId,
  GameView,
  Gender,
  LatLon,
  ProfileSave,
  SaveFile,
  StoryBeat,
  CoopRoom,
  DynamicBeastPack,
} from '../../../packages/game-core/src/index.ts';

import { MapView, featureAtPoint } from './mapView.ts';
import type { WorldDrop } from './mapView.ts';
import { startARCamera, stopARCamera, setARModel, captureARPhoto } from './arCamera.ts';
import { Pedometer, describeSource } from './pedometer.ts';
import { avatarSvg } from './itemIcons.ts';
import {
  GeoWatcher,
  downloadText,
  readSave,
  readTextFile,
  simulatedWalk,
  wipeSave,
  writeSave,
  buzz,
} from './platform.ts';
import {
  el,
  renderBagPanel,
  renderCamp,
  renderCraft,
  renderHud,
  renderLog,
  renderSettings,
  renderZoneActions,
  renderZonePanel,
  renderMerchantShop,
  toast,
} from './panels.ts';
import type { Handlers } from './panels.ts';
import { openBloodMoon, openNightDefense } from './fights.ts';
import { openMinigame } from './minigames.ts';
import { audio } from './audio.ts';
import { speech } from './speech.ts';

// Toạ độ dự phòng khi chưa có tín hiệu GPS — Hồ Gươm, để gói POI mẫu có tác dụng.
const FALLBACK_POSITION: LatLon = { lat: 21.0287, lon: 105.8524 };
const PACK = sampleHanoiPack();

/** Danh mục toàn bộ các di tích, thắng cảnh, hồ nước và địa danh thực tế đã được tiền sử hoá. */
const ALL_PACK_FEATURES: MapFeature[] = PACK.pois.map((poi) => ({
  kind: 'poi',
  id: poi.id,
  zone: poi.zone,
  nameVi: poi.nameVi,
  lat: poi.lat,
  lon: poi.lon,
  radiusMeters: poi.radiusMeters,
}));

let cachedCombinedFeatures: MapFeature[] = ALL_PACK_FEATURES;

interface App {
  save: SaveFile;
  profile: ProfileSave | null;
  view: GameView | null;
  storageOk: boolean;
  timeOffsetMs: number;
  narrationQueue: StoryBeat[];
  narrationOpen: boolean;
  activeTab: string;
  onlyCraftable: boolean;
  simTick: number;
  speed: ReturnType<typeof createSpeedState>;
}

const app: App = {
  save: { formatVersion: 1, profiles: [], activeSlot: 0, savedAtMs: 0, checksum: '' },
  profile: null,
  view: null,
  storageOk: true,
  timeOffsetMs: 0,
  narrationQueue: [],
  narrationOpen: false,
  activeTab: 'map',
  onlyCraftable: false,
  simTick: 0,
  speed: createSpeedState(),
};

const pedometer = new Pedometer();
let mapView: MapView | null = null;
let geo: GeoWatcher | null = null;

const now = (): number => Date.now() + app.timeOffsetMs;

let worldDrops: WorldDrop[] = [];
const dynamicBeasts = new Map<string, DynamicBeastPack>();
let lastBeastAiTime = 0;

// ================================================================
// HỆ THỐNG TRANG BỊ VŨ KHÍ, TẤN CÔNG ĐỊNH HƯỚNG & KỸ NĂNG CHIẾN ĐẤU
// ================================================================

export interface WeaponDef {
  id: string;
  nameVi: string;
  icon: string;
  skillName: string;
  skillIcon: string;
  isRanged: boolean;
  baseDmg: number;
  skillDmg: number;
}

export const ALL_WEAPONS: WeaponDef[] = [
  { id: 'divine_dragon_bow', nameVi: 'Thần Nỏ Long Vương', icon: '🏹', skillName: 'Mưa Tên Rồng', skillIcon: '🐉', isRanged: true, baseDmg: 65, skillDmg: 85 },
  { id: 'bow', nameVi: 'Cung Tên Săn Bắn', icon: '🏹', skillName: 'Xuyên Phá', skillIcon: '🎯', isRanged: true, baseDmg: 34, skillDmg: 52 },
  { id: 'iron_spear', nameVi: 'Giáo Sắt Săn Quái', icon: '🗡️', skillName: 'Lướt Đâm', skillIcon: '⚡', isRanged: false, baseDmg: 48, skillDmg: 72 },
  { id: 'iron_axe', nameVi: 'Rìu Sắt Đốn Củi', icon: '🪓', skillName: 'Xoay Bão', skillIcon: '🌪️', isRanged: false, baseDmg: 28, skillDmg: 44 },
  { id: 'stone_axe', nameVi: 'Rìu Đá Tiền Sử', icon: '🪓', skillName: 'Xoay Rìu', skillIcon: '🌪️', isRanged: false, baseDmg: 20, skillDmg: 32 },
  { id: 'sharp_stone', nameVi: 'Đá Nhọn Ném Xa', icon: '🪨', skillName: 'Mưa Đá', skillIcon: '🌪️', isRanged: true, baseDmg: 14, skillDmg: 22 },
  { id: 'fist', nameVi: 'Quyền Cước Tiền Sử', icon: '✊', skillName: 'Đạp Lùi', skillIcon: '💨', isRanged: false, baseDmg: 8, skillDmg: 16 },
];

let selectedWeaponIndex = 0;

export function getAvailableWeaponsList(): WeaponDef[] {
  if (!app.profile) return [ALL_WEAPONS[ALL_WEAPONS.length - 1]];
  const carried = app.profile.player.carried;
  const list = ALL_WEAPONS.filter((w) => {
    if (w.id === 'fist') return true;
    return (carried[w.id] ?? 0) > 0;
  });
  return list.length > 0 ? list : [ALL_WEAPONS[ALL_WEAPONS.length - 1]];
}

export function getCurrentEquippedWeapon(): WeaponDef {
  const available = getAvailableWeaponsList();
  if (selectedWeaponIndex >= available.length) {
    selectedWeaponIndex = 0;
  }
  return available[selectedWeaponIndex];
}

export function cycleNextWeapon(): void {
  const available = getAvailableWeaponsList();
  if (available.length <= 1) {
    toast(`🎒 Hiện tại bạn chỉ có ${available[0].nameVi}! Hãy chế tạo thêm vũ khí trong Lò Rèn/Menu Chế Tạo.`, 'warn');
    return;
  }
  selectedWeaponIndex = (selectedWeaponIndex + 1) % available.length;
  const curr = available[selectedWeaponIndex];
  audio.play('click');
  if (app.profile?.settings.haptics) buzz(25);
  toast(`🗡️ Đã trang bị: ${curr.icon} ${curr.nameVi}!`, 'good');
  updateCombatPadUI();
}

export function updateCombatPadUI(): void {
  if (!app.profile) return;
  const curr = getCurrentEquippedWeapon();
  const carried = app.profile.player.carried;

  const attackIcon = document.getElementById('combat-attack-icon');
  const weaponIcon = document.getElementById('combat-weapon-icon');
  const weaponAmmo = document.getElementById('combat-weapon-ammo');
  const skillIcon = document.getElementById('combat-skill-icon');
  const skillName = document.getElementById('combat-skill-name');

  if (attackIcon) attackIcon.textContent = curr.icon;
  if (weaponIcon) weaponIcon.textContent = curr.icon;
  if (skillIcon) skillIcon.textContent = curr.skillIcon;
  if (skillName) skillName.textContent = curr.skillName;

  if (weaponAmmo) {
    if (curr.id === 'bow') {
      const arrows = carried['arrow'] ?? 0;
      weaponAmmo.textContent = `x${arrows}`;
      weaponAmmo.style.color = arrows > 0 ? '#fef08a' : '#ef4444';
    } else if (curr.id === 'sharp_stone') {
      const stones = carried['sharp_stone'] ?? 0;
      weaponAmmo.textContent = `x${stones}`;
      weaponAmmo.style.color = stones > 0 ? '#fef08a' : '#ef4444';
    } else if (curr.id === 'divine_dragon_bow') {
      weaponAmmo.textContent = '∞ TÊN';
      weaponAmmo.style.color = '#38bdf8';
    } else {
      weaponAmmo.textContent = 'ĐỔI';
      weaponAmmo.style.color = '#fef08a';
    }
  }
}

/** Bắn / Phóng vũ khí bay thẳng theo góc quay mặt của người chơi */
export function fireDirectionalProjectile(
  type: 'arrow' | 'stone',
  playerWorldX: number,
  playerWorldY: number,
  playerScreenX: number,
  playerScreenY: number,
  angleRad: number,
  maxDistMeters: number,
  baseDamage: number,
): void {
  if (!app.profile) return;
  const nowMs = Date.now();
  const canvas = mapView?.canvas;
  const w = canvas?.width ?? 400;
  const h = canvas?.height ?? 800;
  const pxPerMeter = ((Math.min(w, h) / 75) * (mapView?.zoomFactor ?? 1));
  const TILT_Y = 0.72;

  // Vector hướng bay: angleRad (0 = Bắc/lên (+Y), PI/2 = Đông/phải (+X))
  const dirX = Math.sin(angleRad);
  const dirY = Math.cos(angleRad);

  // Tìm dã thú va chạm trên đường bay
  let closestBeast: DynamicBeastPack | null = null;
  let closestDist = maxDistMeters;

  for (const beast of dynamicBeasts.values()) {
    if (beast.isDefeated) continue;
    const toBx = beast.currentWorldX - playerWorldX;
    const toBy = beast.currentWorldY - playerWorldY;

    // Chiếu toạ độ lên tia
    const projLen = toBx * dirX + toBy * dirY;
    if (projLen > 0 && projLen <= maxDistMeters) {
      const perpDist = Math.hypot(toBx - projLen * dirX, toBy - projLen * dirY);
      if (perpDist <= 2.2) { // Hitbox quái 2.2m
        if (projLen < closestDist) {
          closestDist = projLen;
          closestBeast = beast;
        }
      }
    }
  }

  const endDist = closestBeast ? closestDist : maxDistMeters;
  const endWorldX = playerWorldX + dirX * endDist;
  const endWorldY = playerWorldY + dirY * endDist;

  const targetScreenX = playerScreenX + (endWorldX - playerWorldX) * pxPerMeter;
  const targetScreenY = playerScreenY - (endWorldY - playerWorldY) * (pxPerMeter * TILT_Y);

  mapView?.spawnProjectile(
    type,
    playerScreenX,
    playerScreenY - 12 * (mapView?.dpr ?? 1),
    targetScreenX,
    targetScreenY,
    baseDamage,
    () => {
      if (closestBeast && !closestBeast.isDefeated) {
        audio.play('strike');
        if (app.profile?.settings.haptics) buzz([0, 50, 40, 80]);

        const dmg = Math.round(baseDamage * (0.85 + Math.random() * 0.3));
        closestBeast.currentHp = Math.max(0, closestBeast.currentHp - dmg);
        closestBeast.isAggro = true;
        closestBeast.isChasing = true;

        mapView?.triggerBeastHit(`💥 -${dmg} HP`, targetScreenX, targetScreenY - 24 * (mapView?.dpr ?? 1));
        mapView?.spawnImpactSparks(targetScreenX, targetScreenY, type === 'arrow');

        if (closestBeast.currentHp <= 0) {
          closestBeast.isDefeated = true;
          closestBeast.respawnAt = nowMs + 5 * 60 * 1000;
          for (const loot of closestBeast.lootTable) {
            const qty = Math.floor(loot.min + Math.random() * (loot.max - loot.min + 1));
            app.profile!.player.carried[loot.itemId] = (app.profile!.player.carried[loot.itemId] || 0) + qty;
          }
          audio.play('quest_complete');
          toast(`⚔️ Đã hạ gục ${closestBeast.nameVi}!`, 'good');
        } else {
          toast(`🗡️ Bắn trúng ${closestBeast.nameVi}! (-${dmg} HP)`, 'good');
        }
        persist();
        sync();
        render();
      }
    },
  );
}

/** Thực thi Tấn Công Thường hoặc Kỹ Năng Vũ Khí theo hướng quay mặt của người chơi */
export function executeCombatAttack(isSkill = false): void {
  if (!app.profile) return;
  const player = app.profile.player;
  const nowMs = Date.now();
  const weapon = getCurrentEquippedWeapon();
  const angle = currentMovementHeading; // radians

  const { render: playerAt } = currentPosition();
  const WORLD_ORIGIN_LAT = 21.0;
  const WORLD_ORIGIN_LON = 105.8;
  const playerWorldX = (playerAt.lon - WORLD_ORIGIN_LON) / metersToLonDegrees(1, playerAt.lat);
  const playerWorldY = (playerAt.lat - WORLD_ORIGIN_LAT) / metersToLatDegrees(1);

  const canvas = mapView?.canvas;
  const w = canvas?.width ?? 400;
  const h = canvas?.height ?? 800;
  const playerScreenX = w / 2 + (mapView?.panX ?? 0);
  const playerScreenY = h / 2 + (mapView?.panY ?? 0);
  const screenAngle = Math.atan2(-Math.cos(angle) * 0.72, Math.sin(angle));

  // 1. VŨ KHÍ TẦM XA: CUNG TÊN / THẦN NỎ
  if (weapon.id === 'bow' || weapon.id === 'divine_dragon_bow') {
    const isDivine = weapon.id === 'divine_dragon_bow';
    const arrowCount = player.carried['arrow'] ?? 0;
    if (arrowCount <= 0 && !isDivine) {
      toast('🏹 Đã hết Mũi Tên trong túi đồ! Hãy chế tạo thêm tại Menu Chế Tạo.', 'bad');
      audio.play('strike');
      return;
    }

    if (isSkill) {
      // Kỹ năng: Bắn 3 mũi tên hình cánh quạt
      const cost = isDivine ? 0 : Math.min(2, arrowCount);
      if (cost > 0) {
        player.carried['arrow'] = (player.carried['arrow'] ?? 0) - cost;
        if (player.carried['arrow'] === 0) delete player.carried['arrow'];
      }
      audio.play('arrow_shot');
      if (app.profile.settings.haptics) buzz([0, 40, 30, 80]);

      const angles = [angle - 0.22, angle, angle + 0.22];
      for (const a of angles) {
        fireDirectionalProjectile('arrow', playerWorldX, playerWorldY, playerScreenX, playerScreenY, a, 26, isDivine ? 65 : 42);
      }
      toast(`🎯 DÙNG CHIÊU: Mưa Tên Xuyên Phá!`, 'good');
    } else {
      if (!isDivine) {
        player.carried['arrow'] = (player.carried['arrow'] ?? 0) - 1;
        if (player.carried['arrow'] === 0) delete player.carried['arrow'];
      }
      audio.play('arrow_shot');
      if (app.profile.settings.haptics) buzz([0, 30, 20, 50]);

      fireDirectionalProjectile('arrow', playerWorldX, playerWorldY, playerScreenX, playerScreenY, angle, 24, weapon.baseDmg);
    }
    persist();
    sync();
    render();
    return;
  }

  // 2. VŨ KHÍ TẦM XA: ĐÁ NHỌN
  if (weapon.id === 'sharp_stone') {
    const stoneCount = player.carried['sharp_stone'] ?? 0;
    if (stoneCount <= 0) {
      toast('🪨 Đã hết Đá Nhọn trong túi đồ!', 'bad');
      return;
    }

    if (isSkill) {
      const cost = Math.min(2, stoneCount);
      player.carried['sharp_stone'] = (player.carried['sharp_stone'] ?? 0) - cost;
      if (player.carried['sharp_stone'] === 0) delete player.carried['sharp_stone'];
      audio.play('throw_stone');

      const angles = [angle - 0.28, angle, angle + 0.28];
      for (const a of angles) {
        fireDirectionalProjectile('stone', playerWorldX, playerWorldY, playerScreenX, playerScreenY, a, 16, 18);
      }
      toast(`🌪️ DÙNG CHIÊU: Mưa Đá Tán Xạ!`, 'good');
    } else {
      player.carried['sharp_stone'] = (player.carried['sharp_stone'] ?? 0) - 1;
      if (player.carried['sharp_stone'] === 0) delete player.carried['sharp_stone'];
      audio.play('throw_stone');

      fireDirectionalProjectile('stone', playerWorldX, playerWorldY, playerScreenX, playerScreenY, angle, 15, weapon.baseDmg);
    }
    persist();
    sync();
    render();
    return;
  }

  // 3. VŨ KHÍ CẬN CHIẾN: GIÁO SẮT / RÌU SẮT / RÌU ĐÁ / TAY KHÔNG
  let baseDmg = weapon.baseDmg;
  let attackRange = 3.5;
  let animType: 'slash' | 'thrust' | 'whirlwind' | 'kick' = 'slash';

  if (weapon.id === 'iron_spear') {
    baseDmg = isSkill ? weapon.skillDmg : weapon.baseDmg;
    attackRange = isSkill ? 7.2 : 5.6;
    animType = 'thrust';
  } else if (weapon.id === 'iron_axe' || weapon.id === 'stone_axe') {
    baseDmg = isSkill ? weapon.skillDmg : weapon.baseDmg;
    attackRange = isSkill ? 5.2 : 4.2;
    animType = isSkill ? 'whirlwind' : 'slash';
  } else {
    baseDmg = isSkill ? weapon.skillDmg : weapon.baseDmg;
    attackRange = isSkill ? 4.2 : 3.0;
    animType = isSkill ? 'kick' : 'slash';
  }

  // Tiêu hao thể lực nhẹ
  player.survival.stamina = Math.max(0, (player.survival.stamina ?? 100) - (isSkill ? 6 : 3));

  // Kích hoạt hoạt ảnh chém/đâm trên Canvas
  mapView?.triggerMeleeAttackVisual(playerScreenX, playerScreenY, screenAngle, animType);
  audio.play('strike');
  if (app.profile.settings.haptics) buzz([0, 50, 40, 90]);

  // Quét kiểm tra tất cả quái vật trúng đòn theo hình nón hướng nhìn
  let hitCount = 0;
  for (const beast of dynamicBeasts.values()) {
    if (beast.isDefeated) continue;
    const dx = beast.currentWorldX - playerWorldX;
    const dy = beast.currentWorldY - playerWorldY;
    const dist = Math.hypot(dx, dy);

    if (dist <= attackRange) {
      const targetAngle = Math.atan2(dx, dy);
      let angleDiff = Math.abs(targetAngle - angle);
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      angleDiff = Math.abs(angleDiff);

      if (animType === 'whirlwind' || angleDiff <= (Math.PI / 3)) {
        hitCount++;
        const dmg = Math.round(baseDmg * (0.88 + Math.random() * 0.24));
        beast.currentHp = Math.max(0, beast.currentHp - dmg);
        beast.isAggro = true;
        beast.isChasing = true;

        // Đẩy lùi nhẹ quái
        const pushDist = isSkill ? 2.8 : 1.2;
        beast.currentWorldX += Math.sin(targetAngle) * pushDist;
        beast.currentWorldY += Math.cos(targetAngle) * pushDist;

        const pxPerM = ((Math.min(w, h) / 75) * (mapView?.zoomFactor ?? 1));
        const bsX = playerScreenX + (beast.currentWorldX - playerWorldX) * pxPerM;
        const bsY = playerScreenY - (beast.currentWorldY - playerWorldY) * (pxPerM * 0.72);

        mapView?.triggerBeastHit(`💥 -${dmg} HP`, bsX, bsY - 24);
        mapView?.spawnImpactSparks(bsX, bsY, false);

        if (beast.currentHp <= 0) {
          beast.isDefeated = true;
          beast.respawnAt = nowMs + 5 * 60 * 1000;
          for (const loot of beast.lootTable) {
            const qty = Math.floor(loot.min + Math.random() * (loot.max - loot.min + 1));
            player.carried[loot.itemId] = (player.carried[loot.itemId] || 0) + qty;
          }
          audio.play('quest_complete');
          toast(`⚔️ Đã hạ gục ${beast.nameVi}!`, 'good');
        }
      }
    }
  }

  if (hitCount === 0) {
    toast(`⚔️ ${isSkill ? `DÙNG CHIÊU: ${weapon.skillName}` : `Tấn công bằng ${weapon.nameVi}`}!`, 'good');
  }

  persist();
  sync();
  render();
}

export function handleHuntBeast(beast: DynamicBeastPack, clickScreenX?: number, clickScreenY?: number): void {
  if (!app.profile) return;
  const nowMs = Date.now();
  const { render: playerAt } = currentPosition();
  const WORLD_ORIGIN_LAT = 21.0;
  const WORLD_ORIGIN_LON = 105.8;
  const playerWorldX = (playerAt.lon - WORLD_ORIGIN_LON) / metersToLonDegrees(1, playerAt.lat);
  const playerWorldY = (playerAt.lat - WORLD_ORIGIN_LAT) / metersToLatDegrees(1);
  const dist = Math.hypot(beast.currentWorldX - playerWorldX, beast.currentWorldY - playerWorldY);

  if (dist > 35.0) {
    toast(`🏹 ${beast.nameVi} đang ở quá xa (cách ${Math.round(dist)}m)! Hãy tiến lại gần (≤32m) để nhắm bắn.`, 'warn');
    return;
  }

  // Tự động xoay nhân vật về hướng con quái
  currentMovementHeading = Math.atan2(beast.currentWorldX - playerWorldX, beast.currentWorldY - playerWorldY);
  executeCombatAttack(false);
}

/** Danh mục tài nguyên rơi hợp lệ theo vùng — 100% chuẩn khớp với data/items.json */
const POOL_BY_ZONE: Record<string, { id: string; name: string }[]> = {
  forest: [
    { id: 'dry_branch', name: 'Cành khô' },
    { id: 'sharp_stone', name: 'Đá nhọn' },
    { id: 'wild_berry', name: 'Quả dại' },
    { id: 'red_mushroom', name: 'Nấm đỏ' },
  ],
  water: [
    { id: 'raw_water', name: 'Nước thô' },
    { id: 'fiber', name: 'Sợi thực vật' },
    { id: 'sharp_stone', name: 'Đá nhọn' },
    { id: 'raw_fish', name: 'Cá tươi' },
  ],
  merchant: [
    { id: 'dry_branch', name: 'Cành khô' },
    { id: 'sharp_stone', name: 'Đá nhọn' },
    { id: 'clay', name: 'Đất sét' },
    { id: 'fiber', name: 'Sợi thực vật' },
  ],
  wilderness: [
    { id: 'dry_branch', name: 'Cành khô' },
    { id: 'sharp_stone', name: 'Đá nhọn' },
    { id: 'clay', name: 'Đất sét' },
    { id: 'wild_berry', name: 'Quả dại' },
  ],
  trail: [
    { id: 'dry_branch', name: 'Cành khô' },
    { id: 'sharp_stone', name: 'Đá nhọn' },
    { id: 'wild_berry', name: 'Quả dại' },
    { id: 'fiber', name: 'Sợi thực vật' },
  ],
};

let lastVibratedDropId: string | null = null;
let currentDeviceHeading: number | null = null;
let lastCompassUpdateMs = 0;
let compassListenerHandler: ((e: DeviceOrientationEvent) => void) | null = null;
let compassActive = false;

function initCompassListener(): void {
  if (compassListenerHandler) return; // đã init

  const onOrientation = (event: DeviceOrientationEvent) => {
    if (!compassActive) return; // tắt khi không ở tab map
    if (!lastActiveDrop || lastDropDist > 75 || lastDropDist <= 35) return;

    const t = performance.now();
    if (t - lastCompassUpdateMs < 350) return;
    lastCompassUpdateMs = t;

    let heading: number | null = null;
    if ((event as any).webkitCompassHeading !== undefined) {
      heading = (event as any).webkitCompassHeading;
    } else if (event.alpha !== null && event.alpha !== undefined) {
      heading = (360 - event.alpha) % 360;
    }

    if (heading !== null && Number.isFinite(heading)) {
      currentDeviceHeading = heading;
      updateDropRadarPointerOnly();
    }
  };

  compassListenerHandler = onOrientation;

  if ('ondeviceorientationabsolute' in window) {
    window.addEventListener('deviceorientationabsolute', onOrientation, { passive: true });
  } else if ('ondeviceorientation' in window) {
    window.addEventListener('deviceorientation', onOrientation, { passive: true });
  }
}

/** Bật compass: chỉ gọi khi ở tab bản đồ. */
function resumeCompass(): void {
  initCompassListener();
  compassActive = true;
}

/** Tắt compass: gọi khi rời tab bản đồ hoặc màn hình tắt — event vẫn đăng ký nhưng handler bỏ qua hoàn toàn. */
function pauseCompass(): void {
  compassActive = false;
}

// ---------------------------------------------------------------- DU HÀNH VIỄN CHINH & TIỀN ĐỒN TRẠM DỪNG

let currentMovementSpeedKmh = 0;
let lastNearOutpost: MapFeature | null = null;
let lastRadioNarrativeMs = 0;

function checkNearOutpostSupply(): void {
  if (!app.profile) return;
  const { render: playerAt } = currentPosition();
  const outposts = cachedCombinedFeatures.filter(
    (f) =>
      f.id.includes('bus') ||
      f.nameVi.includes('Xe Buýt') ||
      f.nameVi.includes('Tiền Đồn') ||
      f.nameVi.includes('Trạm Dừng') ||
      f.id.includes('outpost'),
  );

  let nearest: MapFeature | null = null;
  let minDist = 45; // trong tầm 45m

  for (const op of outposts) {
    const d = distanceMeters(playerAt, { lat: op.lat, lon: op.lon });
    if (d <= minDist) {
      minDist = d;
      nearest = op;
    }
  }

  const outpostBanner = document.getElementById('outpost-supply-banner');
  const transitBanner = document.getElementById('transit-hud-banner');

  // Cập nhật Transit HUD Banner khi di chuyển nhanh (>=12 km/h)
  if (transitBanner) {
    if (currentMovementSpeedKmh >= 12.0) {
      transitBanner.hidden = false;
      const speedEl = document.getElementById('transit-hud-speed');
      if (speedEl) speedEl.textContent = `${Math.round(currentMovementSpeedKmh)} km/h`;
    } else {
      transitBanner.hidden = true;
    }
  }

  // Cập nhật Outpost Supply Banner khi dừng chân gần trạm xe buýt
  if (outpostBanner) {
    if (nearest && currentMovementSpeedKmh <= 12.0 && canCollectOutpost(app.profile.player.transit, nearest.id)) {
      lastNearOutpost = nearest;
      outpostBanner.hidden = false;
      const nameEl = document.getElementById('outpost-supply-name');
      if (nameEl) nameEl.textContent = nearest.nameVi;
    } else {
      outpostBanner.hidden = true;
      lastNearOutpost = null;
    }
  }
}

function claimNearOutpostSupply(): void {
  if (!app.profile || !lastNearOutpost) return;
  const result = collectOutpostSupply(
    app.profile.player.transit,
    app.profile.player.carried,
    lastNearOutpost.id,
    lastNearOutpost.nameVi,
  );

  if (result.ok) {
    app.profile.player.transit = result.nextTransit;
    app.profile.player.carried = result.nextCarried;
    persist();
    audio.play('quest_complete');
    buzz([30, 40, 30]);
    toast(result.messageVi, 'good');
    const outpostBanner = document.getElementById('outpost-supply-banner');
    if (outpostBanner) outpostBanner.hidden = true;
    sync();
  } else {
    toast(result.messageVi, 'bad');
  }
}

// ---------------------------------------------------------------- MẬT THƯ TẦM BẢO & RÈN LUYỆN TRÍ NHỚ ĐƯỜNG PHỐ HÀ NỘI

let lastTreasureVibratedId: string | null = null;

function updateHanoiTreasureHud(playerPos: LatLon): void {
  if (!app.profile) return;
  const banner = document.getElementById('hanoi-treasure-hud-banner');
  if (!banner) return;

  const nowMs = Date.now();
  let clue: TreasureClue | null = app.profile.activeTreasureClue ?? null;

  // Nếu chưa có manh mối hoặc manh mối đã hết hạn (> 48h), tạo mới
  if (!clue || (clue.expiresAtMs && clue.expiresAtMs <= nowMs)) {
    const pack = sampleHanoiPack();
    clue = generateHanoiTreasureClue(playerPos, pack.pois, nowMs, clue?.targetPoiId);
    if (clue) {
      app.profile.activeTreasureClue = clue;
      persist();
    }
  }

  if (!clue) {
    banner.hidden = true;
    return;
  }

  banner.hidden = false;
  const dist = distanceMeters(playerPos, { lat: clue.targetLat, lon: clue.targetLon });
  const roundedDist = Math.round(dist);

  const titleEl = document.getElementById('treasure-card-title');
  const distEl = document.getElementById('treasure-card-distance');
  const hintEl = document.getElementById('treasure-card-hint');
  const claimBtn = document.getElementById('btn-claim-treasure-hud');

  if (titleEl) titleEl.textContent = clue.targetNameVi;
  if (distEl) distEl.textContent = `~${roundedDist}m`;

  if (dist <= 35) {
    if (hintEl) hintEl.textContent = '✨ ĐÃ ĐẾN NƠI! Khai quật báu vật ngay!';
    if (claimBtn) claimBtn.hidden = false;

    if (lastTreasureVibratedId !== clue.id) {
      lastTreasureVibratedId = clue.id;
      if (app.profile.settings.haptics) buzz([0, 150, 80, 250]);
      audio.play('quest_complete');
      toast(`🎉 Bạn đã tìm đến ${clue.targetNameVi}! Bấm KHAI QUẬT để nhận thưởng!`, 'good');
    }
  } else {
    if (hintEl) hintEl.textContent = 'Tự dùng trí nhớ tìm đường đến địa danh để nhận thưởng!';
    if (claimBtn) claimBtn.hidden = true;
  }
}

function openHanoiTreasureModal(): void {
  if (!app.profile) return;
  const modal = document.getElementById('overlay-hanoi-treasure');
  if (!modal) return;

  const { render: playerAt } = currentPosition();
  const nowMs = Date.now();
  let clue: TreasureClue | null = app.profile.activeTreasureClue ?? null;

  if (!clue) {
    const pack = sampleHanoiPack();
    clue = generateHanoiTreasureClue(playerAt, pack.pois, nowMs);
    if (clue) {
      app.profile.activeTreasureClue = clue;
      persist();
    }
  }

  if (!clue) return;

  const dist = Math.round(distanceMeters(playerAt, { lat: clue.targetLat, lon: clue.targetLon }));
  const titleInfo = getHanoiExplorerTitle(app.profile.treasuresClaimedCount ?? 0);

  const tierTitleEl = document.getElementById('treasure-modal-tier-title');
  const badgeEl = document.getElementById('treasure-modal-explorer-badge');
  const nameEl = document.getElementById('treasure-modal-target-name');
  const distEl = document.getElementById('treasure-modal-target-distance');
  const storyEl = document.getElementById('treasure-modal-story-desc');
  const rewardsEl = document.getElementById('treasure-modal-rewards-list');
  const memoryPtsEl = document.getElementById('treasure-modal-memory-pts');
  const claimBtn = document.getElementById('btn-treasure-modal-claim');

  if (tierTitleEl) tierTitleEl.textContent = clue.rewardTitleVi;
  if (badgeEl) badgeEl.textContent = `${titleInfo.badgeEmoji} ${titleInfo.titleVi} (${app.profile.treasuresClaimedCount ?? 0} Kho Báu)`;
  if (nameEl) nameEl.textContent = clue.targetNameVi;
  if (distEl) distEl.textContent = `Khoảng cách hiện tại: ~${dist}m (Ước tính lúc phát: ~${clue.initialDistanceMeters}m)`;
  if (storyEl) storyEl.textContent = clue.rewardDescriptionVi;
  if (memoryPtsEl) memoryPtsEl.textContent = `+${clue.memoryScore} Điểm Thổ Địa (Tổng: ${app.profile.treasureMemoryScore ?? 0}đ)`;

  if (rewardsEl) {
    rewardsEl.innerHTML = '';
    for (const [itemId, qty] of Object.entries(clue.rewards)) {
      const def = getItem(itemId as any);
      const pill = document.createElement('div');
      pill.className = 'treasure-reward-pill';
      pill.innerHTML = `<strong>${def?.icon ?? '📦'} ${def?.nameVi ?? itemId}</strong>: <span>+${qty}</span>`;
      rewardsEl.appendChild(pill);
    }
  }

  if (claimBtn) {
    if (dist <= 35) {
      claimBtn.hidden = false;
      claimBtn.textContent = `🏆 Khai Quật Kho Báu Ngay!`;
    } else {
      claimBtn.hidden = true;
    }
  }

  modal.hidden = false;
}

function handleClaimHanoiTreasure(): void {
  if (!app.profile || !app.profile.activeTreasureClue) return;
  const { render: playerAt } = currentPosition();
  const res = claimHanoiTreasure(app.profile, app.profile.activeTreasureClue, playerAt, Date.now());

  if (res.ok) {
    persist();
    audio.play('quest_complete');
    if (app.profile.settings.haptics) buzz([40, 60, 40, 80]);
    toast(res.messageVi, 'good');

    const modal = document.getElementById('overlay-hanoi-treasure');
    if (modal) modal.hidden = true;

    // Tự động sinh manh mối mới cho điểm tiếp theo
    const pack = sampleHanoiPack();
    const newClue = generateHanoiTreasureClue(playerAt, pack.pois, Date.now());
    if (newClue) {
      app.profile.activeTreasureClue = newClue;
      persist();
    }

    updateHanoiTreasureHud(playerAt);
    sync();
  } else {
    toast(res.messageVi, 'bad');
  }
}

function handleRefreshHanoiTreasure(): void {
  if (!app.profile) return;
  const { render: playerAt } = currentPosition();
  const pack = sampleHanoiPack();
  const currentId = app.profile.activeTreasureClue?.targetPoiId;
  const newClue = generateHanoiTreasureClue(playerAt, pack.pois, Date.now(), currentId);
  if (newClue) {
    app.profile.activeTreasureClue = newClue;
    persist();
    audio.play('button_click');
    toast(`📜 Đã nhận Mật Thư mới: ${newClue.targetNameVi} (~${newClue.initialDistanceMeters}m)`, 'good');
    openHanoiTreasureModal();
    updateHanoiTreasureHud(playerAt);
  } else {
    toast('Không tìm thấy địa danh phù hợp lân cận.', 'bad');
  }
}

function checkRadioNarrative(speedKmh: number, at?: LatLon): void {
  if (!app.profile || !app.profile.settings.narrationAudio) return;
  const nowMs = Date.now();
  if (nowMs - lastRadioNarrativeMs < 60_000) return; // Giãn cách tối thiểu 1 phút giữa các mẩu radio

  let textToSay: string | null = null;

  if (speedKmh >= 25.0) {
    textToSay = 'Lạc Lạc đây! Tốc độ du hành của bạn thật ấn tượng. Linh Điểu đang sải cánh gom lấy những luồng linh khí dọc đường!';
  } else if (lastNearOutpost) {
    textToSay = `Chúng ta vừa tới gần ${lastNearOutpost.nameVi}. Nếu xe dừng bánh, hãy nhận rương tiếp tế của trạm nhé!`;
  }

  if (textToSay) {
    lastRadioNarrativeMs = nowMs;
    audio.play('beat_notify');
    speech.speak(textToSay);
    toast(`📻 Lạc Lạc Radio: "${textToSay}"`);
  }
}



export interface NavigationTurn {
  bearing: number;
  relativeAngle: number;
  instructionVi: string;
  arrow: string;
  turnAdviceVi: string;
}

function getNavigationDirection(from: LatLon, to: LatLon, deviceHeading: number | null): NavigationTurn {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLon = ((to.lon - from.lon) * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  bearing = (bearing + 360) % 360;

  if (deviceHeading !== null) {
    // Góc lệch tương đối so với hướng người chơi đang cầm điện thoại
    let rel = (bearing - deviceHeading + 360) % 360;
    if (rel > 180) rel -= 360;

    let instructionVi = 'Đi Thẳng';
    let arrow = '⬆️';
    let turnAdviceVi = 'Đi thẳng về phía trước';

    if (Math.abs(rel) <= 22.5) {
      instructionVi = 'Đi Thẳng';
      arrow = '⬆️';
      turnAdviceVi = 'Phía trước mặt bạn';
    } else if (rel > 22.5 && rel <= 67.5) {
      instructionVi = 'Chếch Phải';
      arrow = '↗️';
      turnAdviceVi = 'Chếch nhẹ sang phải';
    } else if (rel > 67.5 && rel <= 112.5) {
      instructionVi = 'Quẹo Phải';
      arrow = '➡️';
      turnAdviceVi = 'Quẹo phải 90°';
    } else if (rel > 112.5 && rel <= 157.5) {
      instructionVi = 'Phía Sau Phải';
      arrow = '↘️';
      turnAdviceVi = 'Quay về sau bên phải';
    } else if (Math.abs(rel) > 157.5) {
      instructionVi = 'Quay Lại';
      arrow = '⬇️';
      turnAdviceVi = 'Quay lại phía sau';
    } else if (rel < -22.5 && rel >= -67.5) {
      instructionVi = 'Chếch Trái';
      arrow = '↖️';
      turnAdviceVi = 'Chếch nhẹ sang trái';
    } else if (rel < -67.5 && rel >= -112.5) {
      instructionVi = 'Quẹo Trái';
      arrow = '⬅️';
      turnAdviceVi = 'Quẹo trái 90°';
    } else if (rel < -112.5 && rel >= -157.5) {
      instructionVi = 'Phía Sau Trái';
      arrow = '↙️';
      turnAdviceVi = 'Quay về sau bên trái';
    }

    return {
      bearing,
      relativeAngle: rel,
      instructionVi,
      arrow,
      turnAdviceVi,
    };
  }

  // Fallback: Nếu máy không có cảm biến la bàn, phân loại theo 8 hướng địa lý
  const dirs = [
    { name: 'Bắc', arrow: '⬆️' },
    { name: 'Đông Bắc', arrow: '↗️' },
    { name: 'Đông', arrow: '➡️' },
    { name: 'Đông Nam', arrow: '↘️' },
    { name: 'Nam', arrow: '⬇️' },
    { name: 'Tây Nam', arrow: '↙️' },
    { name: 'Tây', arrow: '⬅️' },
    { name: 'Tây Bắc', arrow: '↖️' },
  ];
  const idx = Math.round(bearing / 45) % 8;
  return {
    bearing,
    relativeAngle: bearing,
    instructionVi: `Hướng ${dirs[idx].name}`,
    arrow: dirs[idx].arrow,
    turnAdviceVi: `Tiến về hướng ${dirs[idx].name}`,
  };
}

let lastActiveDrop: WorldDrop | null = null;
let lastDropDist = 0;
let lastPlayerPos: LatLon | null = null;
let currentRadarMode: 'none' | 'ready' | 'navigating' = 'none';
let currentRadarDropId: string | null = null;

function updateDropRadarPointerOnly(): void {
  if (!lastActiveDrop || lastDropDist > 65 || lastDropDist < 5.0 || !lastPlayerPos) return;
  const pointer = document.getElementById('drop-radar-pointer-svg');
  const textEl = document.getElementById('drop-radar-turn-text');
  if (!pointer || !textEl) return;

  const nav = getNavigationDirection(lastPlayerPos, { lat: lastActiveDrop.lat, lon: lastActiveDrop.lon }, currentDeviceHeading);
  pointer.style.transform = `rotate(${Math.round(nav.relativeAngle)}deg) translateZ(0)`;
  textEl.textContent = `${nav.arrow} ${nav.instructionVi}`;
}

function updateDropRadar(drop: WorldDrop | null, dist?: number, playerPos?: LatLon): void {
  const banner = document.getElementById('drop-radar-banner');
  if (!banner) return;

  lastActiveDrop = drop;
  lastDropDist = dist ?? 999;
  lastPlayerPos = playerPos ?? null;

  if (!drop || dist === undefined || !playerPos) {
    banner.hidden = true;
    currentRadarMode = 'none';
    currentRadarDropId = null;
    return;
  }

  banner.hidden = false;
  const roundedDist = Math.round(dist);
  const targetMode = dist < 5.0 ? 'ready' : 'navigating';

  if (targetMode === 'ready') {
    // Đã vào bán kính nhặt (< 5m)
    // QUAN TRỌNG: Chỉ render HTML một lần duy nhất khi chuyển trạng thái, KHÔNG render 18 lần/giây để tránh xoá nút khi người dùng đang ấn ngón tay vào
    if (currentRadarMode !== 'ready' || currentRadarDropId !== drop.id) {
      currentRadarMode = 'ready';
      currentRadarDropId = drop.id;
      banner.className = 'drop-radar-banner drop-radar-banner--ready';
      banner.innerHTML = `
        <div class="drop-radar__icon" style="font-size:1.6rem;">✨</div>
        <div class="drop-radar__info">
          <div id="drop-radar-ready-title" style="font-weight:800;font-size:0.95rem;color:#86efac;">
            🖐️ ĐÃ ĐẾN GẦN! (Cách ${dist.toFixed(1)}m)
          </div>
          <div class="drop-radar__sub" style="color:#d1fae5;font-size:0.8rem;margin-top:2px;">
            Đã trong tầm với (< 5m)! Chạm vào đây để nhặt
          </div>
        </div>
        <button id="btn-radar-collect" class="btn btn--tiny btn--primary" style="background:#16a34a;border-color:#4ade80;font-weight:800;padding:8px 16px;font-size:0.92rem;white-space:nowrap;box-shadow:0 0 12px rgba(74,222,128,0.5);touch-action:manipulation;cursor:pointer;">🖐️ Nhặt (${drop.qty})</button>
      `;

      // Gắn sự kiện nhặt siêu nhạy cho cả nút bấm lẫn toàn bộ thanh banner (chạm đâu cũng nhặt được)
      const handleCollect = (e: Event) => {
        e.stopPropagation();
        if (lastActiveDrop) {
          collectWorldDrop(lastActiveDrop);
        }
      };

      const btn = document.getElementById('btn-radar-collect');
      if (btn) {
        btn.onclick = handleCollect;
        btn.ontouchend = handleCollect;
      }
      banner.onclick = handleCollect;
      banner.ontouchend = handleCollect;
    } else {
      // Chỉ cập nhật khoảng cách số mà không phá huỷ DOM
      const title = document.getElementById('drop-radar-ready-title');
      if (title) title.textContent = `🖐️ ĐÃ ĐẾN GẦN! (Cách ${dist.toFixed(1)}m)`;
    }
  } else {
    // Đang ở khoảng cách tìm kiếm (>= 5m): hiển thị la bàn cảm biến chỉ hướng
    if (currentRadarMode !== 'navigating' || currentRadarDropId !== drop.id) {
      currentRadarMode = 'navigating';
      currentRadarDropId = drop.id;
      banner.className = 'drop-radar-banner';
      banner.onclick = null;
      banner.ontouchend = null;
      const nav = getNavigationDirection(playerPos, { lat: drop.lat, lon: drop.lon }, currentDeviceHeading);
      
      banner.innerHTML = `
        <div class="drop-radar__compass-box">
          <svg id="drop-radar-pointer-svg" class="drop-radar__pointer" viewBox="0 0 32 32" width="28" height="28" style="transform: rotate(${Math.round(nav.relativeAngle)}deg) translateZ(0);">
            <polygon points="16,3 26,26 16,20 6,26" fill="#f59e0b" stroke="#fef08a" stroke-width="1.8" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="drop-radar__info">
          <div style="font-weight:800; font-size:0.95rem; color:#fef08a; display:flex; align-items:center; gap:6px;">
            <span id="drop-radar-turn-text">${nav.arrow} ${nav.instructionVi}</span>
            <span id="drop-radar-dist-text" style="font-size:0.82rem; color:var(--bone); font-weight:normal;">• Cách <strong>${roundedDist}m</strong></span>
          </div>
          <div class="drop-radar__sub" style="color:#e5e7eb; font-size:0.8rem; margin-top:2px;">
            📦 <strong>${drop.nameVi} (+${drop.qty})</strong> — ${nav.turnAdviceVi}
          </div>
        </div>
      `;
    } else {
      const nav = getNavigationDirection(playerPos, { lat: drop.lat, lon: drop.lon }, currentDeviceHeading);
      const pointer = document.getElementById('drop-radar-pointer-svg');
      const textEl = document.getElementById('drop-radar-turn-text');
      const distEl = document.getElementById('drop-radar-dist-text');
      if (pointer) pointer.style.transform = `rotate(${Math.round(nav.relativeAngle)}deg) translateZ(0)`;
      if (textEl) textEl.textContent = `${nav.arrow} ${nav.instructionVi}`;
      if (distEl) distEl.innerHTML = `• Cách <strong>${roundedDist}m</strong>`;
    }
  }
}

let currentBeastRadarId: string | null = null;

function updateBeastHuntRadar(beast: DynamicBeastPack, dist: number): void {
  const banner = document.getElementById('drop-radar-banner');
  if (!banner || !app.profile) return;

  banner.hidden = false;
  const isMeleeRange = dist <= 8.5;
  const hasBow = (app.profile.player.carried['bow'] ?? 0) > 0 || (app.profile.player.carried['divine_dragon_bow'] ?? 0) > 0;
  const arrowCount = app.profile.player.carried['arrow'] ?? 0;
  const stoneCount = app.profile.player.carried['sharp_stone'] ?? 0;
  const hasRangedAmmo = (hasBow && arrowCount > 0) || stoneCount > 0;

  if (isMeleeRange) {
    if (currentRadarMode !== 'ready' || currentBeastRadarId !== beast.id) {
      currentRadarMode = 'ready';
      currentBeastRadarId = beast.id;
      banner.className = 'drop-radar-banner drop-radar-banner--ready';
      banner.style.borderColor = '#ef4444';
      banner.style.boxShadow = '0 0 16px rgba(239, 68, 68, 0.4)';
      banner.innerHTML = `
        <div class="drop-radar__icon" style="font-size:1.6rem;">${beast.iconEmoji}</div>
        <div class="drop-radar__info">
          <div id="drop-radar-ready-title" style="font-weight:800;font-size:0.95rem;color:#fca5a5;">
            🗡️ ${beast.nameVi.toUpperCase()} (${beast.currentHp}/${beast.maxHp} HP)
          </div>
          <div class="drop-radar__sub" style="color:#fee2e2;font-size:0.8rem;margin-top:2px;">
            Đã vào tầm cận chiến (Cách ${dist.toFixed(1)}m)! Chạm để tấn công nhận thịt 🥩
          </div>
        </div>
        <button id="btn-radar-hunt" class="btn btn--tiny btn--primary" style="background:#dc2626;border-color:#f87171;font-weight:800;padding:8px 16px;font-size:0.92rem;white-space:nowrap;box-shadow:0 0 12px rgba(239,68,68,0.6);touch-action:manipulation;cursor:pointer;">🗡️ Tấn công</button>
      `;

      const handleAttack = (e: Event) => {
        e.stopPropagation();
        handleHuntBeast(beast);
      };

      const btn = document.getElementById('btn-radar-hunt');
      if (btn) {
        btn.onclick = handleAttack;
        btn.ontouchend = handleAttack;
      }
      banner.onclick = handleAttack;
      banner.ontouchend = handleAttack;
    } else {
      const title = document.getElementById('drop-radar-ready-title');
      if (title) title.textContent = `🗡️ ${beast.nameVi.toUpperCase()} (${beast.currentHp}/${beast.maxHp} HP)`;
    }
  } else if (dist <= 30.0 && hasRangedAmmo) {
    const isBow = hasBow && arrowCount > 0;
    const weaponBtnLabel = isBow ? `🏹 Bắn Cung (${arrowCount})` : `🪨 Ném Đá (${stoneCount})`;
    const weaponColor = isBow ? '#ea580c' : '#475569';
    const weaponBorder = isBow ? '#fb923c' : '#94a3b8';

    if (currentRadarMode !== 'ready' || currentBeastRadarId !== beast.id) {
      currentRadarMode = 'ready';
      currentBeastRadarId = beast.id;
      banner.className = 'drop-radar-banner drop-radar-banner--ready';
      banner.style.borderColor = weaponBorder;
      banner.style.boxShadow = `0 0 16px rgba(${isBow ? '234, 88, 12' : '71, 85, 105'}, 0.45)`;
      banner.innerHTML = `
        <div class="drop-radar__icon" style="font-size:1.6rem;">${isBow ? '🏹' : '🪨'}</div>
        <div class="drop-radar__info">
          <div id="drop-radar-ready-title" style="font-weight:800;font-size:0.95rem;color:#fef08a;">
            🎯 ${beast.nameVi.toUpperCase()} (${beast.currentHp}/${beast.maxHp} HP)
          </div>
          <div class="drop-radar__sub" style="color:#e2e8f0;font-size:0.8rem;margin-top:2px;">
            Trong tầm bắn tỉa (Cách ${dist.toFixed(1)}m)! Chạm để ${isBow ? 'bắn tên 🏹' : 'ném đá 🪨'}
          </div>
        </div>
        <button id="btn-radar-hunt" class="btn btn--tiny btn--primary" style="background:${weaponColor};border-color:${weaponBorder};font-weight:800;padding:8px 14px;font-size:0.9rem;white-space:nowrap;box-shadow:0 0 12px rgba(251,146,60,0.5);touch-action:manipulation;cursor:pointer;">${weaponBtnLabel}</button>
      `;

      const handleAttack = (e: Event) => {
        e.stopPropagation();
        handleHuntBeast(beast);
      };

      const btn = document.getElementById('btn-radar-hunt');
      if (btn) {
        btn.onclick = handleAttack;
        btn.ontouchend = handleAttack;
      }
      banner.onclick = handleAttack;
      banner.ontouchend = handleAttack;
    } else {
      const title = document.getElementById('drop-radar-ready-title');
      if (title) title.textContent = `🎯 ${beast.nameVi.toUpperCase()} (${beast.currentHp}/${beast.maxHp} HP)`;
    }
  } else {
    if (currentRadarMode !== 'navigating' || currentBeastRadarId !== beast.id) {
      currentRadarMode = 'navigating';
      currentBeastRadarId = beast.id;
      banner.className = 'drop-radar-banner';
      banner.style.borderColor = '#f59e0b';
      banner.style.boxShadow = 'none';
      banner.onclick = null;
      banner.ontouchend = null;
      banner.innerHTML = `
        <div class="drop-radar__compass-box" style="font-size:1.4rem;">
          ${beast.iconEmoji}
        </div>
        <div class="drop-radar__info">
          <div style="font-weight:800; font-size:0.95rem; color:#fef08a;">
            ⚠️ Phát Hiện ${beast.nameVi} • Cách <strong>${Math.round(dist)}m</strong>
          </div>
          <div class="drop-radar__sub" style="color:#e5e7eb; font-size:0.8rem; margin-top:2px;">
            ${hasRangedAmmo ? 'Đang vào tầm nhắm bắn' : (beast.isPredator ? 'Dã thú hung dữ! Hãy chế tạo Cung Tên hoặc nhặt Đá Nhọn' : 'Động vật ăn cỏ nhút nhát, hãy áp sát nhanh')}
          </div>
        </div>
      `;
    }
  }
}

function checkDropProximityAndAlert(): void {
  const { render: at, position: pos } = currentPosition();
  const playerPos = pos ?? at;

  if (worldDrops.length === 0) {
    lastVibratedDropId = null;

    // Kiểm tra xem có dã thú nào ở gần (<= 30m) không để hiện thanh săn bắt
    const WORLD_ORIGIN_LAT = 21.0;
    const WORLD_ORIGIN_LON = 105.8;
    const playerWorldX = (playerPos.lon - WORLD_ORIGIN_LON) / metersToLonDegrees(1, playerPos.lat);
    const playerWorldY = (playerPos.lat - WORLD_ORIGIN_LAT) / metersToLatDegrees(1);

    let nearestBeast: DynamicBeastPack | null = null;
    let minBeastDist = 30.0;

    for (const beast of dynamicBeasts.values()) {
      if (beast.isDefeated) continue;
      const d = Math.hypot(beast.currentWorldX - playerWorldX, beast.currentWorldY - playerWorldY);
      if (d < minBeastDist) {
        minBeastDist = d;
        nearestBeast = beast;
      }
    }

    if (nearestBeast) {
      updateBeastHuntRadar(nearestBeast, minBeastDist);
      return;
    }

    currentBeastRadarId = null;
    updateDropRadar(null);
    return;
  }

  const drop = worldDrops[0];
  const dist = distanceMeters(playerPos, { lat: drop.lat, lon: drop.lon });

  // 1. Nếu vật phẩm nằm trong bán kính phát hiện (<= 60m): kích hoạt rung cảnh báo
  if (dist <= 60) {
    if (lastVibratedDropId !== drop.id) {
      lastVibratedDropId = drop.id;
      buzz([0, 180, 120, 240]); // Nhịp rung đôi rõ rệt trong túi quần
    }
  }

  // 2. Cập nhật thanh La Bàn Radar trên giao diện
  updateDropRadar(drop, dist, playerPos);
}

/**
 * Bảng tài nguyên rơi động theo Cấp Doanh Trại, Hệ sinh thái & Linh thú đi cùng
 */
function getDynamicDropPool(zone: string, campLevel: number, activePetId?: string): { id: string; name: string }[] {
  const pool: { id: string; name: string }[] = [];

  // 1. Tầng 1: Đồ Đá Cũ (Mọi cấp)
  if (zone === 'forest') {
    pool.push(
      { id: 'dry_branch', name: 'Cành khô' },
      { id: 'sharp_stone', name: 'Đá nhọn' },
      { id: 'wild_berry', name: 'Quả dại' },
      { id: 'red_mushroom', name: 'Nấm đỏ' },
      { id: 'fiber', name: 'Sợi thực vật' },
    );
  } else if (zone === 'water') {
    pool.push(
      { id: 'raw_water', name: 'Nước thô' },
      { id: 'fiber', name: 'Sợi thực vật' },
      { id: 'clay', name: 'Đất sét' },
      { id: 'raw_fish', name: 'Cá tươi' },
    );
  } else if (zone === 'merchant' || zone === 'ruins') {
    pool.push(
      { id: 'sharp_stone', name: 'Đá nhọn' },
      { id: 'clay', name: 'Đất sét' },
      { id: 'fiber', name: 'Sợi thực vật' },
      { id: 'ancient_pottery', name: 'Mảnh gốm Đông Sơn' },
    );
  } else {
    // Wilderness & Trail
    pool.push(
      { id: 'dry_branch', name: 'Cành khô' },
      { id: 'sharp_stone', name: 'Đá nhọn' },
      { id: 'clay', name: 'Đất sét' },
      { id: 'wild_berry', name: 'Quả dại' },
      { id: 'fiber', name: 'Sợi thực vật' },
    );
  }

  // 2. Tầng 2: Nhà sàn gỗ (Cấp 2+)
  if (campLevel >= 2) {
    pool.push(
      { id: 'log', name: 'Khúc gỗ lớn' },
      { id: 'rope', name: 'Dây thừng' },
      { id: 'seed_corn', name: 'Hạt giống ngô rừng' },
      { id: 'copper_ore', name: 'Quặng đồng cổ' },
      { id: 'coal', name: 'Than đá' },
    );
  }

  // 3. Tầng 3: Pháo đài đá cổ (Cấp 3+)
  if (campLevel >= 3) {
    pool.push(
      { id: 'stone_block', name: 'Khối đá xẻ' },
      { id: 'iron_ore', name: 'Quặng sắt' },
      { id: 'leather', name: 'Da thú dày' },
    );
  }
  if (campLevel >= 4) {
    pool.push({ id: 'gold_ore', name: 'Quặng vàng quý' }, { id: 'log', name: 'Khúc gỗ lớn' });
  }

  return pool;
}

/**
 * Sinh DUY NHẤT 1 cụm vật phẩm quanh người chơi trong tầm phát hiện ~18m - 46m.
 * Tích hợp sự kiện Rương báu 8.000 bước chân mỗi ngày!
 */
function spawnSingleWorldDropNear(_center: LatLon, _zone: string): void {
  // Đã bỏ kịch bản nhặt đồ rơi gần chân theo yêu cầu (quá dễ).
  // Chuyển sang cơ chế Mật Thư Cổ Đồ Hà Nội (500m - 1km) và Khai thác POI thực tế.
  worldDrops = [];
}

function collectWorldDrop(drop: WorldDrop): void {
  if (!app.profile) return;

  const { render: at, position: pos } = currentPosition();
  const playerPos = pos ?? at;
  const dist = distanceMeters(playerPos, { lat: drop.lat, lon: drop.lon });

  // Bán kính nhặt < 5m
  if (dist >= 5.0) {
    toast(`Vật phẩm ở cách ~${dist.toFixed(1)}m. Hãy đi lại gần hơn (< 5m) để nhặt!`, 'warn');
    return;
  }

  // Xử lý nhặt Rương báu 8.000 bước chân hoành tráng
  if (drop.itemId === 'ancient_chest') {
    const todayKey = toLocalTime(now()).day;
    (app.profile.player as any).last8kChestDay = todayKey;

    // Phần thưởng Rương báu 8.000 bước
    const coins = 20;
    const potionCount = 2;
    const ironCount = 3;
    const goldOreCount = 2;
    const hasSpecial = Math.random() < 0.5;
    const specialItem = hasSpecial ? 'egg_forest' : 'blueprint';
    const specialName = hasSpecial ? '1 trứng rừng cổ đại' : '1 bản vẽ chế tạo';

    app.profile.player.carried['ancient_coin'] = (app.profile.player.carried['ancient_coin'] ?? 0) + coins;
    app.profile.player.carried['greater_potion'] = (app.profile.player.carried['greater_potion'] ?? 0) + potionCount;
    app.profile.player.carried['iron_ore'] = (app.profile.player.carried['iron_ore'] ?? 0) + ironCount;
    app.profile.player.carried['gold_ore'] = (app.profile.player.carried['gold_ore'] ?? 0) + goldOreCount;
    app.profile.player.carried[specialItem] = (app.profile.player.carried[specialItem] ?? 0) + 1;

    worldDrops = [];
    lastVibratedDropId = null;
    updateDropRadar(null);

    buzz([0, 100, 80, 200, 100, 300]);
    audio.play('quest_complete');
    toast(`🎉 MỞ RƯƠNG 8.000 BƯỚC: +${coins} 🪙, +2 Bình Máu Lớn, +${specialName}, +3 Quặng Sắt & +2 Quặng Vàng!`, 'good');
    afterAction();
    return;
  }

  // Thêm đồ thông thường vào carried inventory
  const currentQty = app.profile.player.carried[drop.itemId] ?? 0;
  app.profile.player.carried[drop.itemId] = currentQty + drop.qty;

  // Xoá drop khỏi danh sách và reset radar
  worldDrops = [];
  lastVibratedDropId = null;
  updateDropRadar(null);

  buzz(25);
  audio.play('pickup');
  toast(`✨ Đã nhặt: +${drop.qty} ${drop.nameVi}!`, 'good');

  afterAction();
}

function getHomeCampCenter(): LatLon | null {
  if (!app.profile?.player.camp.homeCell) return null;
  if (typeof app.profile.player.camp.exactLat === 'number' && typeof app.profile.player.camp.exactLon === 'number') {
    return { lat: app.profile.player.camp.exactLat, lon: app.profile.player.camp.exactLon };
  }
  const cell = cellById(app.profile.player.camp.homeCell);
  if (!cell) return null;
  return { lat: cell.centerLat, lon: cell.centerLon };
}

let virtualPlayerPos: LatLon = { lat: 21.0068, lon: 105.8431 };
let smoothRenderPos: LatLon | null = null;
let devMockPosition: LatLon | null = null;
let mapPickMode: 'set_home' | 'relocate_camp' | null = null;
let relocateTargetPos: LatLon | null = null;

let joystickVector = { x: 0, y: 0 };
let currentMovementHeading = 0; // radians: 0 = North, PI/2 = East, PI = South, -PI/2 = West
const activeKeys: Record<string, boolean> = {};
let lastMoveTickMs = performance.now();

// ===== HỆ THỐNG PHI NƯỚC ĐẠI (AUTO-SPRINT) =====
// Giữ cần gạt Joystick hoặc phím WASD liên tục > 1 giây → tự động Phi Nước Đại (Sprint)
let isCurrentlySprinting = false; // Đã bỏ chế độ chạy nhanh theo yêu cầu cân bằng với quái vật

function openRelocateCampModal(targetPos?: LatLon): void {
  if (!app.profile) return;
  relocateTargetPos = targetPos || currentPosition().render;
  const targetCell = cellAt(relocateTargetPos.lat, relocateTargetPos.lon);
  const currentCell = app.profile.player.camp.homeCell;
  const isSame = currentCell === targetCell.id;

  const descEl = el('relocate-loc-desc');
  if (descEl) {
    descEl.innerHTML = `Toạ độ [${relocateTargetPos.lat.toFixed(4)}, ${relocateTargetPos.lon.toFixed(4)}] · Vùng ${targetCell.biome} ${isSame ? '<span style="color:#ef4444;font-weight:700;">(Trùng vị trí hiện tại)</span>' : '<span style="color:#4ade80;font-weight:700;">✅ Vị trí hợp lệ</span>'}`;
  }
  el('overlay-relocate-camp').hidden = false;
}

export function isNativeApk(): boolean {
  return (
    typeof (globalThis as any).AndroidBridge !== 'undefined' ||
    typeof (globalThis as any).webkit?.messageHandlers !== 'undefined' ||
    navigator.userAgent.includes('KyNguyenHoangCo') ||
    (globalThis as any).__IS_APK__ === true ||
    window.location.protocol === 'file:' ||
    (typeof (navigator as any).standalone !== 'undefined' && (navigator as any).standalone === true)
  );
}

/** Vị trí dùng để tính toán & vẽ: Di chuyển trực quan bằng Virtual Joystick / Phím bấm, độc lập hoàn toàn với GPS thật. */
function currentPosition(): { position: LatLon | null; render: LatLon; hasFix: boolean } {
  const targetPos = devMockPosition ?? virtualPlayerPos;
  return {
    position: targetPos,
    render: targetPos,
    hasFix: true,
  };
}

/** Khởi tạo bộ điều khiển Cần Gạt Ảo (Virtual Joystick) & Bàn phím WASD / Mũi tên */
function setupVirtualJoystick(): void {
  const container = document.getElementById('virtual-joystick-container');
  const stick = document.getElementById('joystick-stick');
  const base = document.getElementById('joystick-base');
  if (!container || !stick || !base) return;

  const maxRadius = 34; // bán kính gạt tối đa (px)
  let pointerId: number | null = null;
  let baseCenterX = 0;
  let baseCenterY = 0;

  const updateStickPos = (clientX: number, clientY: number) => {
    let dx = clientX - baseCenterX;
    let dy = clientY - baseCenterY;
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    stick.style.transform = `translate(${dx}px, ${dy}px)`;

    const normalizedDist = Math.min(1, dist / maxRadius);
    if (dist < 4) {
      joystickVector = { x: 0, y: 0 };
    } else {
      joystickVector = {
        x: (dx / dist) * normalizedDist,
        y: (-dy / dist) * normalizedDist, // +y là hướng Bắc (lên trên)
      };
    }
  };

  const handlePointerDown = (e: PointerEvent) => {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    stick.classList.add('is-dragging');
    const rect = base.getBoundingClientRect();
    baseCenterX = rect.left + rect.width / 2;
    baseCenterY = rect.top + rect.height / 2;
    base.setPointerCapture(pointerId);
    updateStickPos(e.clientX, e.clientY);
    bumpInteraction();
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (pointerId === e.pointerId) {
      updateStickPos(e.clientX, e.clientY);
      bumpInteraction();
    }
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (pointerId === e.pointerId) {
      pointerId = null;
      stick.classList.remove('is-dragging');
      stick.style.transform = 'translate(0px, 0px)';
      joystickVector = { x: 0, y: 0 };
      try {
        base.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  base.addEventListener('pointerdown', handlePointerDown);
  base.addEventListener('pointermove', handlePointerMove);
  base.addEventListener('pointerup', handlePointerUp);
  base.addEventListener('pointercancel', handlePointerUp);

  // Bàn phím WASD / Mũi tên cho PC
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    activeKeys[e.code] = true;
    activeKeys[e.key] = true;
    bumpInteraction();
  });

  window.addEventListener('keyup', (e) => {
    activeKeys[e.code] = false;
    activeKeys[e.key] = false;
  });

  window.addEventListener('blur', () => {
    for (const k in activeKeys) activeKeys[k] = false;
    joystickVector = { x: 0, y: 0 };
  });
}

let isAimingInPad = false;

/** Khởi tạo cụm nút Chiến Đấu (Combat Pad) bên phải: Chạm để đánh, Kéo rê để ngắm 360 độ (Drag-to-Aim) */
function setupCombatPad(): void {
  const btnAttack = document.getElementById('btn-combat-attack');
  const btnSkill = document.getElementById('btn-combat-skill');
  const btnSwitch = document.getElementById('btn-combat-weapon-switch');

  const wireAimButton = (button: HTMLElement | null, isSkill: boolean) => {
    if (!button) return;
    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;

    button.addEventListener('pointerdown', (e) => {
      if (pointerId !== null) return;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      isAimingInPad = true;
      try {
        button.setPointerCapture(pointerId);
      } catch {}
      bumpInteraction();
    });

    button.addEventListener('pointermove', (e) => {
      if (pointerId === e.pointerId) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const dist = Math.hypot(dx, dy);
        if (dist > 8) {
          // Góc ngắm theo vector kéo ngón tay: +dx là sang phải (+X), -dy là lên trên (+Y)
          currentMovementHeading = Math.atan2(dx, -dy);
          bumpInteraction();
        }
      }
    });

    const handleRelease = (e: PointerEvent) => {
      if (pointerId === e.pointerId) {
        pointerId = null;
        isAimingInPad = false;
        try {
          button.releasePointerCapture(e.pointerId);
        } catch {}
        bumpInteraction();
        executeCombatAttack(isSkill);
      }
    };

    button.addEventListener('pointerup', handleRelease);
    button.addEventListener('pointercancel', handleRelease);
  };

  wireAimButton(btnAttack, false);
  wireAimButton(btnSkill, true);

  if (btnSwitch) {
    btnSwitch.onclick = (e) => {
      e.stopPropagation();
      bumpInteraction();
      cycleNextWeapon();
    };
  }

  // Phím tắt chiến đấu trên máy tính
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (app.activeTab !== 'map' || isAnyMajorOverlayOpen()) return;

    if (e.code === 'Space' || e.code === 'KeyJ') {
      e.preventDefault();
      bumpInteraction();
      executeCombatAttack(false);
    } else if (e.code === 'KeyK') {
      e.preventDefault();
      bumpInteraction();
      executeCombatAttack(true);
    } else if (e.code === 'KeyQ') {
      e.preventDefault();
      bumpInteraction();
      cycleNextWeapon();
    }
  });

  updateCombatPadUI();
}

// ---------------------------------------------------------------- khởi động

function boot(): void {
  try {
    assertBalanceValid();
  } catch (error) {
    document.body.innerHTML = `<pre style="padding:20px;color:#e3a1a1;white-space:pre-wrap">${(error as Error).message}</pre>`;
    return;
  }

  const loaded = readSave(now());
  app.save = loaded.save;
  app.storageOk = writeSave(loaded.save, now());
  if (loaded.warningVi) toast(loaded.warningVi, 'bad');

  renderProfileScreen();
  wireStaticControls();
  checkGpsRequirement();
  registerServiceWorker();
}

function renderProfileScreen(): void {
  const screenGame = document.getElementById('screen-game');
  const screenProfiles = document.getElementById('screen-profiles');
  if (screenGame) screenGame.hidden = true;
  if (screenProfiles) screenProfiles.hidden = false;

  const list = document.getElementById('slot-list');
  if (!list) return;
  list.replaceChildren();

  let summaries: ReturnType<typeof slotSummaries> = [];
  try {
    summaries = slotSummaries(app.save);
  } catch (err) {
    console.error('Lỗi khi đọc danh sách hồ sơ:', err);
    try {
      app.save = createSaveFile(now());
      persist();
      summaries = slotSummaries(app.save);
    } catch {
      summaries = [
        { slot: 0, empty: true },
        { slot: 1, empty: true },
      ];
    }
  }

  if (!summaries || summaries.length === 0) {
    summaries = [
      { slot: 0, empty: true },
      { slot: 1, empty: true },
    ];
  }

  for (const summary of summaries) {
    if (summary.empty) {
      const button = document.createElement('button');
      button.className = 'slot slot--empty';
      button.textContent = `+ Hồ sơ mới (khe ${summary.slot + 1})`;
      button.onclick = () => createNewProfile(summary.slot);
      list.append(button);
    } else {
      const card = document.createElement('div');
      card.className = 'slot';
      card.setAttribute('role', 'button');
      card.tabIndex = 0;
      card.innerHTML = `
        <div class="slot__avatar">${avatarSvg(summary.gender ?? 'male')}</div>
        <div class="slot__main">
          <div class="slot__name">${summary.displayName ?? `Hồ sơ ${summary.slot + 1}`}</div>
          <div class="slot__meta">Trại cấp ${summary.campLevel ?? 1} · Chương ${summary.chapterIndex ?? 1} · ${(summary.lifetimeSteps ?? 0).toLocaleString('vi-VN')} bước</div>
        </div>
        <button class="slot__del" title="Xoá hồ sơ này" aria-label="Xoá hồ sơ">🗑️</button>`;

      card.onclick = (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.slot__del')) return;
        enterProfile(summary.slot);
      };

      card.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          enterProfile(summary.slot);
        }
      };

      const delBtn = card.querySelector<HTMLButtonElement>('.slot__del');
      if (delBtn) {
        delBtn.onclick = (e) => {
          e.stopPropagation();
          promptDeleteProfile(summary.slot, summary.displayName);
        };
      }

      list.append(card);
    }
  }
}

function promptDeleteProfile(slot: number, name?: string): void {
  const overlay = el('overlay-delete-profile');
  const msg = el('delete-profile-msg');
  if (msg) {
    msg.innerHTML = `Bạn có chắc chắn muốn xoá hồ sơ <strong>${name ?? `Khe ${slot + 1}`}</strong>?<br><span style="color:#ef4444;font-size:0.85em;margin-top:4px;display:inline-block;">Toàn bộ tiến trình sẽ mất vĩnh viễn nếu chưa xuất file sao lưu.</span>`;
  }

  el('btn-delete-confirm').onclick = () => {
    overlay.hidden = true;
    app.save = putProfile(app.save, slot, null);
    if (app.save.activeSlot === slot) {
      app.profile = null;
    }
    persist();
    renderProfileScreen();
    toast('Đã xoá hồ sơ thành công.', 'good');
  };

  el('btn-delete-cancel').onclick = () => {
    overlay.hidden = true;
  };

  overlay.hidden = false;
}

let selectedGender: Gender = 'male';

function createNewProfile(slot: number): void {
  const overlay = el('overlay-create-profile');
  const input = el<HTMLInputElement>('create-name');
  input.value = slot === 0 ? 'Người Sống Sót' : 'Bạn Đồng Hành';
  selectedGender = 'male';

  // Nạp hình ảnh avatar xem trước
  el('avatar-preview-male').innerHTML = avatarSvg('male');
  el('avatar-preview-female').innerHTML = avatarSvg('female');

  const cards = overlay.querySelectorAll<HTMLButtonElement>('.gender-card');
  cards.forEach((card) => {
    card.classList.toggle('is-active', card.dataset.gender === selectedGender);
    card.onclick = () => {
      selectedGender = (card.dataset.gender as Gender) ?? 'male';
      cards.forEach((c) => c.classList.toggle('is-active', c === card));
    };
  });

  el('btn-create-submit').onclick = () => {
    const name = input.value.trim().slice(0, 20) || (slot === 0 ? 'Người Sống Sót' : 'Bạn Đồng Hành');
    overlay.hidden = true;
    app.save = putProfile(app.save, slot, createProfile(name, now(), selectedGender));
    persist();
    enterProfile(slot);
    showPrologue(() => {
      sync();
    });
  };

  el('btn-create-cancel').onclick = () => {
    overlay.hidden = true;
  };

  overlay.hidden = false;
  input.focus();
}

function enterProfile(slot: number): void {
  app.save = setActiveSlot(app.save, slot);
  app.profile = activeProfile(app.save);
  if (!app.profile) return;

  // 1. KHÔI PHỤC VỊ TRÍ TRƯỚC ĐÓ CỦA NHÂN VẬT (PERSISTENT CHARACTER POSITION)
  const lastSavedPos = app.profile.player.lastPosition;
  const homePos = getHomeCampCenter();
  if (lastSavedPos && Number.isFinite(lastSavedPos.lat) && Number.isFinite(lastSavedPos.lon)) {
    virtualPlayerPos = { ...lastSavedPos };
  } else if (homePos) {
    virtualPlayerPos = { ...homePos };
  } else {
    virtualPlayerPos = { lat: 21.0068, lon: 105.8431 };
  }
  smoothRenderPos = { ...virtualPlayerPos };

  // 2. MÔ PHỎNG HÀNH TRÌNH TỰ ĐỘNG NGOẠI TUYẾN NẾU ĐANG CÓ LỘ TRÌNH (OFFLINE AUTO-TRAVEL)
  simulateOfflineAutoTravel();

  el('screen-profiles').hidden = true;
  el('screen-game').hidden = false;

  if (!mapView) {
    mapView = new MapView(el<HTMLCanvasElement>('map-canvas'));
    mapView.onViewportChange = (state) => {
      const btn = el('btn-recenter');
      if (btn) btn.hidden = !state.isPannedOrZoomed;
    };
    mapView.onDropClick = (drop) => {
      collectWorldDrop(drop);
    };
    mapView.onTrapClick = (trap) => {
      if (!app.profile) return;
      const { render: playerAt } = currentPosition();
      const result = collectTrap(app.profile.player, trap.id, playerAt, now());
      if (result.ok) {
        app.profile.player = result.player;
        persist();
        audio.play('trap_snap');
        toast(result.messageVi, 'good');
        sync();
      } else {
        toast(result.messageVi, 'bad');
      }
    };
    mapView.onCampClick = () => {
      audio.play('click');
      switchTab('camp');
    };
    mapView.onStationClick = (_stationId) => {
      audio.play('click');
      switchTab('craft');
    };
    mapView.onFarmPlotClick = (plotIndex, plot) => {
      if (!app.profile) return;
      if (plot.readyToHarvest) {
        // Thu hoạch ngay lập tức từ góc nhìn bản đồ!
        handlers.onHarvestPlot(plotIndex);
      } else {
        // Mở khu Nông Trại trong tab Doanh Trại
        audio.play('click');
        switchTab('camp');
        const farmBox = document.getElementById('camp-farming');
        farmBox?.scrollIntoView({ behavior: 'smooth' });
      }
    };
    mapView.onFeatureClick = (feat) => {
      audio.play('click');
      openPoiExploreSheet(feat);
    };
    mapView.onBeastClick = (beast, screenX, screenY) => {
      handleHuntBeast(beast, screenX, screenY);
    };
    mapView.onMapClick = (latLon) => {
      if (mapPickMode === 'set_home') {
        mapPickMode = null;
        const banner = document.getElementById('map-pick-guide-banner');
        if (banner) banner.hidden = true;
        promptConfirmCampLocation(latLon);
      } else if (mapPickMode === 'relocate_camp') {
        mapPickMode = null;
        const banner = document.getElementById('map-pick-guide-banner');
        if (banner) banner.hidden = true;
        openRelocateCampModal(latLon);
      }
    };
    globalThis.addEventListener('resize', () => mapView?.resize());
  }
  mapView.resize();

  // Tự động kích hoạt cảm biến đếm bước chân
  pedometer.autoStart();

  // Cầu nối nhận bước chân trực tiếp từ Android Native Hardware Sensor
  (globalThis as any).__onNativeStep = (count = 1) => {
    pedometer.onNativeStep(count);
    sync();
  };

  if (!geo) {
    geo = new GeoWatcher((_state, movement) => {
      if (movement) {
        currentMovementSpeedKmh = movement.speedKmh;
        if (movement.speedKmh >= 0.5 && movement.speedKmh <= 9.5 && movement.distanceMeters >= 2.0 && movement.distanceMeters <= 250) {
          pedometer.addGpsDistanceWalked(movement.distanceMeters);
        } else if (movement.speedKmh >= 12.0 && app.profile) {
          const at = _state.position || currentPosition().position;
          const transitRes = processTransitMovement(
            app.profile.player.transit,
            app.profile.player.carried,
            movement.distanceMeters,
            movement.speedKmh,
            at?.lat,
            at?.lon,
          );
          app.profile.player.transit = transitRes.nextTransit;
          app.profile.player.carried = transitRes.nextCarried;
          persist();

          for (const ev of transitRes.eventsVi) {
            toast(ev, 'good');
          }
          if (transitRes.dropsGained.length > 0) {
            audio.play('pickup');
            if (app.profile.settings.haptics) buzz(20);
          }
          checkRadioNarrative(movement.speedKmh, at);
        }
      }
      checkNearOutpostSupply();
      updateHanoiTreasureHud(at);
      sync();
    });
    geo.start();
  }

  // Nút Nhận Tiếp Tế tại Tiền Đồn Trạm Dừng Xe Buýt
  const btnClaimSupply = document.getElementById('btn-claim-outpost-supply');
  if (btnClaimSupply) {
    btnClaimSupply.onclick = () => claimNearOutpostSupply();
  }

  // Mật Thư Cổ Đồ & Rèn Luyện Trí Nhớ Đường Phố Hà Nội
  const btnOpenTreasureModal = document.getElementById('btn-open-treasure-modal');
  if (btnOpenTreasureModal) {
    btnOpenTreasureModal.onclick = () => openHanoiTreasureModal();
  }

  const btnClaimTreasureHud = document.getElementById('btn-claim-treasure-hud');
  if (btnClaimTreasureHud) {
    btnClaimTreasureHud.onclick = () => handleClaimHanoiTreasure();
  }

  const btnTreasureModalClose = document.getElementById('btn-treasure-modal-close');
  if (btnTreasureModalClose) {
    btnTreasureModalClose.onclick = () => {
      const modal = document.getElementById('overlay-hanoi-treasure');
      if (modal) modal.hidden = true;
    };
  }

  const btnTreasureModalClaim = document.getElementById('btn-treasure-modal-claim');
  if (btnTreasureModalClaim) {
    btnTreasureModalClaim.onclick = () => handleClaimHanoiTreasure();
  }

  const btnTreasureModalRefresh = document.getElementById('btn-treasure-modal-refresh');
  if (btnTreasureModalRefresh) {
    btnTreasureModalRefresh.onclick = () => handleRefreshHanoiTreasure();
  }

  // Nút Cấp quyền GPS
  el('btn-request-gps').onclick = () => {
    geo?.start();
    el('overlay-gps-required').hidden = true;
  };

  // ==================== THIẾT LẬP CĂN CỨ / DOANH TRẠI ====================
  let pendingCampPos: LatLon | null = null;

  function promptConfirmCampLocation(pos: LatLon): void {
    pendingCampPos = pos;
    const cell = cellAt(pos.lat, pos.lon);
    const coordsEl = document.getElementById('confirm-camp-coords');
    const biomeEl = document.getElementById('confirm-camp-biome');
    if (coordsEl) coordsEl.textContent = `[${pos.lat.toFixed(4)}, ${pos.lon.toFixed(4)}]`;
    if (biomeEl) biomeEl.textContent = cell.biome;
    el('overlay-confirm-camp-location').hidden = false;
  }

  function setupInitialCampAt(pos: LatLon): void {
    if (!app.profile) return;
    const cell = cellAt(pos.lat, pos.lon).id;
    app.profile.player.camp.homeCell = cell;
    app.profile.player.camp.exactLat = pos.lat;
    app.profile.player.camp.exactLon = pos.lon;
    persist();
    el('overlay-set-home').hidden = true;
    el('overlay-confirm-camp-location').hidden = true;
    toast(`🏕️ Đã thiết lập Doanh Trại tại [${pos.lat.toFixed(4)}, ${pos.lon.toFixed(4)}]! Đây là Nhà an toàn của bạn.`, 'good');
    audio.play('quest_complete');
    afterAction();
  }

  const btnConfirmGps = document.getElementById('btn-confirm-home-gps');
  if (btnConfirmGps) {
    btnConfirmGps.onclick = () => {
      const { render: at } = currentPosition();
      el('overlay-set-home').hidden = true;
      promptConfirmCampLocation(at);
    };
  }

  // Chấm chọn tự do trên bản đồ
  const btnOpenMapPick = document.getElementById('btn-open-map-pick');
  if (btnOpenMapPick) {
    btnOpenMapPick.onclick = () => {
      mapPickMode = 'set_home';
      el('overlay-set-home').hidden = true;
      const banner = document.getElementById('map-pick-guide-banner');
      if (banner) {
        banner.hidden = false;
        const titleEl = document.getElementById('map-pick-guide-title');
        const descEl = document.getElementById('map-pick-guide-desc');
        if (titleEl) titleEl.textContent = 'Chế độ chọn vị trí Doanh Trại';
        if (descEl) descEl.innerHTML = 'Hãy kéo/phóng to bản đồ và <strong>chạm vào vị trí</strong> bạn muốn đặt Doanh Trại.';
      }
      toast('🗺️ Hãy chạm vào bất kỳ vị trí nào trên bản đồ để chọn nơi đặt Doanh Trại!', 'good');
    };
  }

  const btnCancelMapPick = document.getElementById('btn-cancel-map-pick');
  if (btnCancelMapPick) {
    btnCancelMapPick.onclick = () => {
      const prevMode = mapPickMode;
      mapPickMode = null;
      const banner = document.getElementById('map-pick-guide-banner');
      if (banner) banner.hidden = true;
      if (prevMode === 'set_home' && !app.profile?.player.camp.homeCell) {
        el('overlay-set-home').hidden = false;
      }
    };
  }

  const btnConfirmCampFinal = document.getElementById('btn-confirm-camp-final');
  if (btnConfirmCampFinal) {
    btnConfirmCampFinal.onclick = () => {
      if (pendingCampPos) {
        setupInitialCampAt(pendingCampPos);
      }
    };
  }

  const btnRepickCampLoc = document.getElementById('btn-repick-camp-location');
  if (btnRepickCampLoc) {
    btnRepickCampLoc.onclick = () => {
      el('overlay-confirm-camp-location').hidden = true;
      mapPickMode = 'set_home';
      const banner = document.getElementById('map-pick-guide-banner');
      if (banner) {
        banner.hidden = false;
        const titleEl = document.getElementById('map-pick-guide-title');
        const descEl = document.getElementById('map-pick-guide-desc');
        if (titleEl) titleEl.textContent = 'Chế độ chọn vị trí Doanh Trại';
        if (descEl) descEl.innerHTML = 'Hãy kéo/phóng to bản đồ và <strong>chạm vào vị trí</strong> bạn muốn đặt Doanh Trại.';
      }
      toast('🗺️ Hãy chạm vào vị trí mới trên bản đồ để chọn lại.', 'good');
    };
  }

  // Nếu người chơi chưa có vị trí Căn Cứ (Nhà) -> mở màn hình thiết lập Nhà
  if (!app.profile.player.camp.homeCell) {
    el('overlay-set-home').hidden = false;
  }

  // ==================== DI DỜI DOANH TRẠI (CAMP RELOCATION) ====================
  const btnRelocateMat = document.getElementById('btn-relocate-by-materials');
  if (btnRelocateMat) {
    btnRelocateMat.onclick = () => {
      if (!app.profile || !relocateTargetPos) return;
      const targetCell = cellAt(relocateTargetPos.lat, relocateTargetPos.lon).id;
      const result = relocateCamp(app.profile.player, targetCell, 'materials', relocateTargetPos.lat, relocateTargetPos.lon);
      if (result.ok) {
        app.profile.player = result.player;
        persist();
        el('overlay-relocate-camp').hidden = true;
        audio.play('quest_complete');
        toast(result.messageVi, 'good');
        afterAction();
      } else {
        audio.play('denied');
        toast(result.messageVi, 'warn');
      }
    };
  }

  const btnRelocateGold = document.getElementById('btn-relocate-by-gold');
  if (btnRelocateGold) {
    btnRelocateGold.onclick = () => {
      if (!app.profile || !relocateTargetPos) return;
      const targetCell = cellAt(relocateTargetPos.lat, relocateTargetPos.lon).id;
      const result = relocateCamp(app.profile.player, targetCell, 'gold', relocateTargetPos.lat, relocateTargetPos.lon);
      if (result.ok) {
        app.profile.player = result.player;
        persist();
        el('overlay-relocate-camp').hidden = true;
        audio.play('quest_complete');
        toast(result.messageVi, 'good');
        afterAction();
      } else {
        audio.play('denied');
        toast(result.messageVi, 'warn');
      }
    };
  }

  const btnRelocatePickMap = document.getElementById('btn-relocate-pick-map');
  if (btnRelocatePickMap) {
    btnRelocatePickMap.onclick = () => {
      mapPickMode = 'relocate_camp';
      el('overlay-relocate-camp').hidden = true;
      const banner = document.getElementById('map-pick-guide-banner');
      if (banner) {
        banner.hidden = false;
        const titleEl = document.getElementById('map-pick-guide-title');
        const descEl = document.getElementById('map-pick-guide-desc');
        if (titleEl) titleEl.textContent = 'Di dời Doanh Trại';
        if (descEl) descEl.innerHTML = 'Hãy chạm vào <strong>toạ độ mới</strong> trên bản đồ để dựng trại.';
      }
      toast('🗺️ Chế độ di dời: Hãy chạm vào toạ độ mới trên bản đồ để dựng trại!', 'good');
    };
  }

  const btnRelocateClose = document.getElementById('btn-relocate-close');
  if (btnRelocateClose) {
    btnRelocateClose.onclick = () => {
      el('overlay-relocate-camp').hidden = true;
    };
  }

  // Nút đóng Tiệm Thương Nhân NPC
  el('btn-merchant-close').onclick = () => {
    el('overlay-merchant-shop').hidden = true;
  };

  // Nút đóng Thẻ Khám Phá Địa Danh 2.0
  const btnClosePoi = document.getElementById('btn-poi-explore-close');
  if (btnClosePoi) {
    btnClosePoi.onclick = () => {
      el('overlay-poi-explore').hidden = true;
    };
  }

  // Nút Hành Động 1: Thu thập tài nguyên / Mở tiệm
  const btnForage = document.getElementById('btn-poi-act-forage');
  if (btnForage) {
    btnForage.onclick = () => {
      if (!app.profile || !currentExplorePoi) return;
      const { render: playerAt } = currentPosition();
      const dist = Math.round(distanceMeters(playerAt, { lat: currentExplorePoi.lat, lon: currentExplorePoi.lon }));
      const radius = Math.max(currentExplorePoi.radiusMeters || 0, 60);

      if (dist > radius) {
        toast(`📍 Bạn đang ở cách ${dist}m. Hãy đi bộ lại gần (≤${radius}m) để tương tác!`, 'warn');
        return;
      }

      const poiId = currentExplorePoi.id || currentExplorePoi.nameVi;
      const cd = getPoiCooldownRemaining(poiId, 'forage');
      if (!cd.ready) {
        toast(`⏳ Tài nguyên tại ${currentExplorePoi.nameVi} đang phục hồi (${cd.messageVi}). Hãy quay lại sau!`, 'warn');
        return;
      }

      // 1. Nếu là Hang Ổ Dã Thú -> Tiến hành Đột Kích Săn Thú
      if (
        currentExplorePoi.id.startsWith('den_') ||
        currentExplorePoi.nameVi.includes('Hang') ||
        currentExplorePoi.nameVi.includes('Động') ||
        currentExplorePoi.nameVi.includes('Tổ Cáo') ||
        currentExplorePoi.nameVi.includes('Bãi Thỏ') ||
        currentExplorePoi.nameVi.includes('Tổ Nhím') ||
        currentExplorePoi.nameVi.includes('Ổ Rắn') ||
        currentExplorePoi.nameVi.includes('Bãi Hươu') ||
        currentExplorePoi.nameVi.includes('Bầy Sói') ||
        currentExplorePoi.nameVi.includes('Đầm Hắc Mãng Xà')
      ) {
        const raidRes = raidBeastDen(app.profile.player, currentExplorePoi.id, now());
        if (raidRes.ok) {
          app.profile.player = raidRes.nextPlayer;
          persist();
          audio.play('quest_complete');
          if (app.profile.settings.haptics) buzz([0, 150, 100, 250]);
          const lootDesc = raidRes.lootGained.map((l) => `${l.qty}× ${getItem(l.itemId).nameVi}`).join(', ');
          toast(`⚔️ ${raidRes.messageVi}\n🎁 Chiến lợi phẩm: ${lootDesc} (Mất: ${raidRes.hpLost} HP)`, 'good');
          el('overlay-poi-explore').hidden = true;
          render();
        } else {
          toast(raidRes.messageVi, 'warn');
        }
        return;
      }

      const isPharmacy =
        currentExplorePoi.id.includes('pharm') ||
        currentExplorePoi.nameVi.includes('Long Châu') ||
        currentExplorePoi.nameVi.includes('Pharmacity') ||
        currentExplorePoi.nameVi.includes('Thảo Dược') ||
        currentExplorePoi.nameVi.includes('Thần Dược') ||
        currentExplorePoi.nameVi.includes('Y Viện');

      if (isPharmacy) {
        app.profile.player.carried = addItems(app.profile.player.carried, [
          { itemId: 'health_potion', qty: 1 },
          { itemId: 'antidote', qty: 1 },
        ]);
        recordPoiAction(poiId, 'forage');
        el('overlay-poi-explore').hidden = true;
        toast(`💊 Nhận Gói Dược Cứu Sinh (1 Bình Hồi Máu + 1 Thuốc Giải Độc) từ ${currentExplorePoi.nameVi}! (Hồi chiêu 30')`, 'good');
        audio.play('pickup');
        if (app.profile.settings.haptics) buzz(20);
        persist();
        render();
        return;
      }

      // Nhặt tài nguyên đặc trưng vùng địa danh
      let itemId: string = 'sharp_stone';
      let itemName = 'Đá nhọn cổ';
      if (currentExplorePoi.zone === 'forest') { itemId = 'medicinal_herb'; itemName = 'Thảo dược rừng'; }
      else if (currentExplorePoi.zone === 'water') { itemId = 'raw_water'; itemName = 'Nước suối ngọt'; }

      app.profile.player.carried = addItems(app.profile.player.carried, [{ itemId, qty: 2 }]);
      recordPoiAction(poiId, 'forage');
      el('overlay-poi-explore').hidden = true;
      toast(`🌿 Đã khám phá ${currentExplorePoi.nameVi} và thu hoạch được 2× ${itemName}! (Hồi chiêu 30')`, 'good');
      audio.play('pickup');
      if (app.profile.settings.haptics) buzz(20);
      persist();
      render();
    };
  }

  // Nút Mua & Bán Với Thương Nhân NPC
  const btnShop = document.getElementById('btn-poi-act-shop');
  if (btnShop) {
    btnShop.onclick = () => {
      if (!app.profile || !currentExplorePoi) return;
      const { render: playerAt } = currentPosition();
      const dist = Math.round(distanceMeters(playerAt, { lat: currentExplorePoi.lat, lon: currentExplorePoi.lon }));
      const radius = Math.max(currentExplorePoi.radiusMeters || 0, 60);

      if (dist > radius) {
        toast(`📍 Bạn đang ở cách ${dist}m. Hãy đi bộ lại gần (≤${radius}m) để giao thương!`, 'warn');
        return;
      }

      el('overlay-poi-explore').hidden = true;
      openMerchantStore(currentExplorePoi.nameVi);
    };
  }

  // Nút Hành Động 2: Nghỉ chân hồi phục HP & Khát
  const btnRest = document.getElementById('btn-poi-act-rest');
  if (btnRest) {
    btnRest.onclick = () => {
      if (!app.profile || !currentExplorePoi) return;
      const { render: playerAt } = currentPosition();
      const dist = Math.round(distanceMeters(playerAt, { lat: currentExplorePoi.lat, lon: currentExplorePoi.lon }));
      const radius = Math.max(currentExplorePoi.radiusMeters || 0, 60);

      if (dist > radius) {
        toast(`📍 Bạn đang ở cách ${dist}m. Hãy đi bộ lại gần (≤${radius}m) để nghỉ chân!`, 'warn');
        return;
      }

      const poiId = currentExplorePoi.id || currentExplorePoi.nameVi;
      const cd = getPoiCooldownRemaining(poiId, 'rest');
      if (!cd.ready) {
        toast(`⏳ Bạn vừa nghỉ chân tại đây (${cd.messageVi}). Hãy tiếp tục hành trình nhé!`, 'warn');
        return;
      }

      const isPharmacy =
        currentExplorePoi.id.includes('pharm') ||
        currentExplorePoi.nameVi.includes('Long Châu') ||
        currentExplorePoi.nameVi.includes('Pharmacity') ||
        currentExplorePoi.nameVi.includes('Thảo Dược') ||
        currentExplorePoi.nameVi.includes('Thần Dược') ||
        currentExplorePoi.nameVi.includes('Y Viện');

      const hpHealed = isPharmacy ? 50 : 25;
      const thirstHealed = isPharmacy ? 30 : 20;

      app.profile.player.survival.hp = Math.min(100, (app.profile.player.survival.hp ?? 100) + hpHealed);
      app.profile.player.survival.hydration = Math.min(100, (app.profile.player.survival.hydration ?? 100) + thirstHealed);

      if (isPharmacy && app.profile.player.survival.isSick) {
        app.profile.player.survival.isSick = false;
      }

      recordPoiAction(poiId, 'rest');
      el('overlay-poi-explore').hidden = true;
      toast(
        isPharmacy
          ? `💊 Đã được danh y tại ${currentExplorePoi.nameVi} cấp cứu & giải trừ bệnh tật! Hồi phục +${hpHealed} HP, +${thirstHealed} Khát. (Hồi chiêu 45')`
          : `🍵 Đã nghỉ chân tại ${currentExplorePoi.nameVi}! Hồi phục +${hpHealed} HP và +${thirstHealed} Khát. (Hồi chiêu 45')`,
        'good',
      );
      audio.play('water');
      persist();
      render();
    };
  }

  // Nút Hành Động 3: Khắc bia đá lưu niệm
  const btnMonument = document.getElementById('btn-poi-act-monument');
  if (btnMonument) {
    btnMonument.onclick = () => {
      if (!app.profile || !currentExplorePoi) return;
      const { render: playerAt } = currentPosition();
      const dist = Math.round(distanceMeters(playerAt, { lat: currentExplorePoi.lat, lon: currentExplorePoi.lon }));
      const radius = Math.max(currentExplorePoi.radiusMeters || 0, 60);

      if (dist > radius) {
        toast(`📍 Bạn đang ở cách ${dist}m. Hãy đi bộ lại gần (≤${radius}m) để khắc bia đá!`, 'warn');
        return;
      }

      const poiId = currentExplorePoi.id || currentExplorePoi.nameVi;
      const cd = getPoiCooldownRemaining(poiId, 'monument');
      if (!cd.ready) {
        toast(`⏳ Bia đá tại ${currentExplorePoi.nameVi} đã được khắc hôm nay rồi (+5 Vàng/ngày)!`, 'warn');
        return;
      }

      app.profile.player.carried = addItems(app.profile.player.carried, [{ itemId: 'ancient_coin', qty: 5 }]);
      recordPoiAction(poiId, 'monument');
      el('overlay-poi-explore').hidden = true;
      toast(`📜 Đã khắc tên lưu niệm vào Bia Đá ${currentExplorePoi.nameVi}! Bạn nhận được 5× Đồng Vàng Cổ.`, 'good');
      audio.play('quest_complete');
      persist();
      render();
    };
  }

  const { render: at } = currentPosition();
  updateHanoiTreasureHud(at);

  sync();
  startLoops();
}

const POI_FORAGE_COOLDOWN_MS = 30 * 60 * 1000; // 30 phút
const POI_REST_COOLDOWN_MS = 45 * 60 * 1000; // 45 phút

function getPoiCooldownRemaining(poiId: string, actionType: 'forage' | 'rest' | 'monument'): { ready: boolean; remainingMs: number; messageVi: string } {
  if (!app.profile) return { ready: true, remainingMs: 0, messageVi: '' };
  const nowMs = now();
  const todayKey = typeof toLocalTime === 'function' ? toLocalTime(nowMs).day : new Date().toISOString().slice(0, 10);
  const usage = (app.profile as any).poiActionsUsage ?? {};

  if (actionType === 'monument') {
    const lastDay = usage[`${poiId}_monument_day`];
    if (lastDay === todayKey) {
      return { ready: false, remainingMs: 86400000, messageVi: 'Đã nhận hôm nay' };
    }
    return { ready: true, remainingMs: 0, messageVi: '' };
  }

  const lastAt = usage[`${poiId}_${actionType}_at`] ?? 0;
  const cooldown = actionType === 'forage' ? POI_FORAGE_COOLDOWN_MS : POI_REST_COOLDOWN_MS;
  const diff = nowMs - lastAt;
  if (diff < cooldown) {
    const remMin = Math.ceil((cooldown - diff) / 60000);
    return { ready: false, remainingMs: cooldown - diff, messageVi: `${remMin}′` };
  }
  return { ready: true, remainingMs: 0, messageVi: '' };
}

function recordPoiAction(poiId: string, actionType: 'forage' | 'rest' | 'monument'): void {
  if (!app.profile) return;
  const nowMs = now();
  const todayKey = typeof toLocalTime === 'function' ? toLocalTime(nowMs).day : new Date().toISOString().slice(0, 10);
  if (!(app.profile as any).poiActionsUsage) {
    (app.profile as any).poiActionsUsage = {};
  }
  const usage = (app.profile as any).poiActionsUsage;
  if (actionType === 'monument') {
    usage[`${poiId}_monument_day`] = todayKey;
  } else {
    usage[`${poiId}_${actionType}_at`] = nowMs;
  }
}

let currentExplorePoi: MapFeature | null = null;

function openPoiExploreSheet(feat: MapFeature): void {
  if (!app.profile) return;
  currentExplorePoi = feat;
  const { render: playerAt } = currentPosition();
  const dist = Math.round(distanceMeters(playerAt, { lat: feat.lat, lon: feat.lon }));
  const radius = Math.max(feat.radiusMeters || 0, 60);
  const inRange = dist <= radius;

  const nameEl = el('poi-explore-name');
  const tagEl = el('poi-explore-tag');
  const iconEl = el('poi-explore-icon');
  const distEl = el('poi-explore-dist');
  const loreEl = el('poi-explore-lore');
  const btnForage = el<HTMLButtonElement>('btn-poi-act-forage');
  const btnRest = el<HTMLButtonElement>('btn-poi-act-rest');
  const btnMonument = el<HTMLButtonElement>('btn-poi-act-monument');

  nameEl.textContent = feat.nameVi;
  
  let icon = '🏛️';
  let tag = 'DI TÍCH TIỀN SỬ';
  let lore = 'Một địa danh cổ đại giàu linh khí thời hồng hoang, nơi thiên nhiên hoang sơ hòa quyện với những dấu tích sinh tồn nghìn năm trước.';

  const n = feat.nameVi;

  const isDen =
    feat.id.startsWith('den_') ||
    n.includes('Hang') ||
    n.includes('Động') ||
    n.includes('Tổ Cáo') ||
    n.includes('Bãi Thỏ') ||
    n.includes('Tổ Nhím') ||
    n.includes('Ổ Rắn') ||
    n.includes('Bãi Hươu') ||
    n.includes('Bầy Sói') ||
    n.includes('Đầm Hắc Mãng Xà');

  if (isDen) {
    icon = '🪨';
    if (feat.id.startsWith('den_fox') || n.includes('Tổ Cáo')) icon = '🦊';
    else if (feat.id.startsWith('den_rabbit') || n.includes('Bãi Thỏ')) icon = '🐇';
    else if (feat.id.startsWith('den_hedgehog') || n.includes('Tổ Nhím')) icon = '🦔';
    else if (feat.id.startsWith('den_snake') || n.includes('Ổ Rắn')) icon = '🐍';
    else if (feat.id.startsWith('den_boar') || n.includes('Lợn Rừng')) icon = '🐗';
    else if (feat.id.startsWith('den_deer') || n.includes('Hươu')) icon = '🦌';
    else if (feat.id.startsWith('den_wolf') || n.includes('Sói')) icon = '🐺';
    else if (feat.id.startsWith('den_tiger') || n.includes('Hổ')) icon = '🐅';
    else if (feat.id.startsWith('den_bear') || n.includes('Gấu')) icon = '🐻';

    tag = 'TỔ DÃ THÚ TIỀN SỬ';
    lore = 'Nơi trú ngụ của loài sinh vật hoang dã tiền sử tại các vạt cỏ và công viên rợp bóng cây. Hãy sẵn sàng trang bị để săn bắt hoặc thu phục!';
  } else if (n.includes('Vườn Hoa') || n.includes('Công Viên')) {
    icon = '🌳';
    tag = 'CÔNG VIÊN CÂY XANH';
    lore = 'Vùng sinh thái xanh ngát giữa lòng thành phố, nơi không khí trong lành, cây cỏ tươi tốt và ẩn chứa nhiều dấu tích cổ sinh.';
  } else if (n.includes('Chùa') || n.includes('Đền') || n.includes('Một Cột') || n.includes('Trấn Quốc')) {
    icon = '🪷';
    tag = 'THÁNH ĐỊA TÂM LINH';
    lore = 'Vùng đất phong thủy tụ khí bên hồ nước, nơi các bậc hiền nhân tiền sử lập đàn cầu quốc thái dân an và thuần dưỡng linh thú.';
  } else if (n.includes('Hoàng Thành') || n.includes('Cổ Loa') || n.includes('Cột Cờ')) {
    icon = '🏯';
    tag = 'VƯƠNG THÀNH TIỀN SỬ';
    lore = 'Thành trì đất nung cổ đại với nhiều vòng hào sâu, nơi lưu giữ bí thuật luyện đồng và chế tác nỏ thần của các bậc tiền nhân.';
  } else if (n.includes('Văn Miếu') || n.includes('Thương Mại') || n.includes('Đại Học') || n.includes('Học Viện') || n.includes('Trường')) {
    icon = '📜';
    tag = 'BÍ CẢNH TRI THỨC';
    lore = 'Thánh địa khắc ghi tri thức tiền sử, nơi truyền dạy bí quyết hái lượm thảo dược, rèn đúc công cụ và bản đồ sinh tồn.';
  } else if (n.includes('Y Viện') || n.includes('Bệnh Viện') || n.includes('Thảo Dược') || n.includes('198') || n.includes('Bạch Mai')) {
    icon = '🌿';
    tag = 'Y QUÁN THẢO DƯỢC';
    lore = 'Nơi tụ hội của những thầy thuốc bộ tộc tài ba, xung quanh mọc đầy những khóm thảo dược hồi sinh lực và giải độc dã thú.';
  } else if (n.includes('Highlands') || n.includes('Phúc Long') || n.includes('Coffee') || n.includes('Trà') || n.includes('WinMart') || n.includes('Circle K') || n.includes('Tiệm') || n.includes('Quán')) {
    icon = '🍵';
    tag = 'TIỆM TRAO ĐỔI LỮ HÀNH';
    lore = 'Điểm dừng chân sầm uất của các đoàn thương nhân du mục qua sông, nơi bạn có thể trao đổi bảo vật và nạp thêm lương thực.';
  } else if (n.includes('Xe Buýt') || n.includes('Vịnh Xén') || n.includes('Bến Xe') || n.includes('Lữ Điểm')) {
    icon = '🚌';
    tag = 'CỘT MỐC LỮ KHÁCH';
    lore = 'Cột mốc đá chỉ đường khắc hoa văn Trống Đồng, nơi các nhóm lữ hành tiền sử tập hợp trước mỗi chuyến hành trình thám hiểm.';
  } else if (feat.zone === 'water' || n.includes('Hồ') || n.includes('Sông')) {
    icon = '🌊';
    tag = 'VÙNG NƯỚC THIÊNG';
    lore = 'Dòng nước mát lành nuôi dưỡng vạn vật từ thuở sơ khai, nơi tôm cá trù phú và rêu tươi có thể thu hái quanh năm.';
  }

  iconEl.textContent = icon;
  tagEl.textContent = tag;
  loreEl.textContent = lore;

  const poiId = feat.id || feat.nameVi;
  const forageCd = getPoiCooldownRemaining(poiId, 'forage');
  const restCd = getPoiCooldownRemaining(poiId, 'rest');
  const monumentCd = getPoiCooldownRemaining(poiId, 'monument');

  if (inRange) {
    distEl.innerHTML = `🟢 <strong>Đang ở trong phạm vi (${dist}m)</strong> — Có thể tương tác!`;
    distEl.style.color = '#4ade80';

    if (isDen) {
      const isRaided = (app.profile.player.beastState?.raidedDenIds ?? []).includes(feat.id);
      btnForage.disabled = isRaided;
      btnForage.textContent = isRaided ? '✅ Đã Dẹp Tan Hang Ổ' : '⚔️ Đột Kích Hang Ổ (Săn Thú)';
      btnRest.style.display = 'none';
    } else {
      btnRest.style.display = 'inline-flex';
      btnForage.disabled = !forageCd.ready;
      btnForage.textContent = forageCd.ready ? '🌿 Khám Phá & Nhặt Đồ' : `⏳ Đang hồi (${forageCd.messageVi})`;
    }

    btnRest.disabled = !restCd.ready;
    btnRest.textContent = restCd.ready ? '🍵 Nghỉ Chân (+25 HP)' : `⏳ Vừa nghỉ (${restCd.messageVi})`;

    btnMonument.disabled = !monumentCd.ready;
    btnMonument.textContent = monumentCd.ready ? '📜 Khắc Bia (+5 Vàng)' : `✅ Đã Khắc Tên Hôm Nay`;
  } else {
    distEl.innerHTML = `📍 Cách bạn <strong>${dist}m</strong> — Hãy đi lại gần (≤${radius}m) để kích hoạt!`;
    distEl.style.color = '#f59e0b';
    btnForage.disabled = true;
    btnForage.textContent = isDen ? `🚶 Lại gần để Đột Kích (${dist}m)` : `🚶 Hãy lại gần (${dist}m)`;
    btnRest.disabled = true;
    btnRest.textContent = `🍵 Nghỉ Chân`;
    btnMonument.disabled = true;
    btnMonument.textContent = `📜 Khắc Bia`;
    btnRest.style.display = isDen ? 'none' : 'inline-flex';
  }

  el('overlay-poi-explore').hidden = false;
}

function openMerchantStore(poiName?: string): void {
  if (!app.profile) return;
  const currentPoi = poiName || app.view?.location?.insidePoi?.poi.nameVi || 'Tiệm Trao Đổi Tiền Sử';

  renderMerchantShop(
    app.profile,
    currentPoi,
    (shopItemId, qty = 1) => {
      if (!app.profile) return;
      let lastMsg = '';
      let successCount = 0;
      for (let i = 0; i < qty; i++) {
        const res = buyItemFromNpc(app.profile.player, shopItemId);
        if (res.success) {
          app.profile.player = res.player;
          successCount++;
          lastMsg = res.messageVi;
        } else {
          lastMsg = res.messageVi;
          break;
        }
      }
      if (successCount > 0) {
        audio.play('pickup');
        toast(successCount > 1 ? `Đã mua thành công ${successCount} lượt!` : lastMsg, 'good');
        if (app.profile.settings.haptics) buzz(20);
        persist();
        render();
        openMerchantStore(currentPoi);
      } else {
        toast(lastMsg, 'bad');
      }
    },
    (itemId, qty) => {
      if (!app.profile) return;
      const res = sellItemToNpc(app.profile.player, itemId as any, qty);
      if (res.success) {
        app.profile.player = res.player;
        audio.play('pickup');
        toast(res.messageVi, 'good');
        if (app.profile.settings.haptics) buzz(20);
        persist();
        render();
        openMerchantStore(currentPoi);
      } else {
        toast(res.messageVi, 'bad');
      }
    },
  );
}

// ---------------------------------------------------------------- vòng đồng bộ

let syncTimer: ReturnType<typeof setInterval> | null = null;
let rafHandle = 0;

let isPocketModeActive = false;

function isAnyMajorOverlayOpen(): boolean {
  const overlays = [
    'overlay-merchant-shop',
    'overlay-craft-inspect',
    'overlay-trade-confirm',
    'overlay-night',
    'overlay-bloodmoon',
    'overlay-minigame',
    'overlay-ar-camera',
    'overlay-chapter-intro',
    'overlay-survival-guide',
  ];
  for (const id of overlays) {
    const elNode = document.getElementById(id);
    if (elNode && !elNode.hidden) return true;
  }
  return false;
}

function togglePocketMode(activate?: boolean): void {
  const target = activate !== undefined ? activate : !isPocketModeActive;
  isPocketModeActive = target;
  const overlay = el('overlay-pocket-mode');
  overlay.hidden = !isPocketModeActive;

  if (isPocketModeActive) {
    audio.play('click');
    if (app.profile?.settings.haptics) buzz([0, 30, 40, 30]);
    updatePocketModeDisplay();
  } else {
    audio.play('click');
    if (app.profile?.settings.haptics) buzz(40);
    mapView?.resize();
    render();
  }
}

function updatePocketModeDisplay(): void {
  if (!isPocketModeActive) return;
  const local = toLocalTime(now());
  const hh = String(local.hour).padStart(2, '0');
  const mm = String(local.minute).padStart(2, '0');
  el('pocket-mode-time').textContent = `${hh}:${mm}`;
  const totalSteps = app.profile?.player?.steps?.totalSteps ?? 0;
  el('pocket-mode-steps').textContent = `${totalSteps.toLocaleString('vi-VN')} bước`;
}

let lastUserInteractionTime = 0;
export function bumpInteraction(): void {
  lastUserInteractionTime = performance.now();
}

function startLoops(): void {
  let syncIntervalMs = 5_000; // 5s khi app nổi bật

  const scheduleSyncTimer = () => {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = setInterval(() => sync(), syncIntervalMs);
  };

  scheduleSyncTimer();

  let lastFrameTime = 0;

  const frame = (timestamp: number) => {
    rafHandle = requestAnimationFrame(frame);
    if (document.hidden) return;

    // Tự động tạm dừng render hoàn toàn (0 FPS) khi ở tab khác, chế độ bỏ túi hoặc mở popup lớn
    if (app.activeTab !== 'map' || isPocketModeActive || isAnyMajorOverlayOpen()) {
      lastMoveTickMs = timestamp;
      return;
    }

    // 1. TÍNH TOÁN DI CHUYỂN TỪ VIRTUAL JOYSTICK & BÀN PHÍM WASD
    const moveDt = Math.min(0.1, (timestamp - lastMoveTickMs) / 1000);
    lastMoveTickMs = timestamp;

    let inputX = joystickVector.x;
    let inputY = joystickVector.y;

    let keyX = 0;
    let keyY = 0;
    const isUp = activeKeys['KeyW'] || activeKeys['w'] || activeKeys['W'] || activeKeys['ArrowUp'];
    const isDown = activeKeys['KeyS'] || activeKeys['s'] || activeKeys['S'] || activeKeys['ArrowDown'];
    const isLeft = activeKeys['KeyA'] || activeKeys['a'] || activeKeys['A'] || activeKeys['ArrowLeft'];
    const isRight = activeKeys['KeyD'] || activeKeys['d'] || activeKeys['D'] || activeKeys['ArrowRight'];
    const isShift = activeKeys['ShiftLeft'] || activeKeys['ShiftRight'] || activeKeys['Shift'];

    if (isUp) keyY += 1;
    if (isDown) keyY -= 1;
    if (isLeft) keyX -= 1;
    if (isRight) keyX += 1;

    if (keyX !== 0 || keyY !== 0) {
      const klen = Math.hypot(keyX, keyY);
      inputX = keyX / klen;
      inputY = keyY / klen;
    }

    const moveMag = Math.hypot(inputX, inputY);
    const isMoving = moveMag > 0.05;

    isCurrentlySprinting = isShift || (isMoving && moveMag > 0.9);

    if (isMoving && app.profile && moveDt > 0) {
      bumpInteraction();
      currentMovementHeading = Math.atan2(inputX, inputY);
      currentDeviceHeading = (currentMovementHeading * 180) / Math.PI;

      // Tốc độ di chuyển chuẩn mực mượt mà, phản hồi ngay tức thì
      const baseSpdKmh = calcMovementSpeedKmh(app.profile.player);
      const sprintFactor = isCurrentlySprinting ? 2.2 : 1.5;
      const spdKmh = baseSpdKmh * sprintFactor;
      currentMovementSpeedKmh = spdKmh;
      const spdMs = spdKmh * (1000 / 3600);
      const distMeters = spdMs * Math.min(1, moveMag) * moveDt;

      // Dịch chuyển toạ độ địa lý (1 độ vĩ tuyến ~ 111.139m)
      const deltaLat = (distMeters * inputY) / 111139;
      const deltaLon = (distMeters * inputX) / (111139 * Math.cos((virtualPlayerPos.lat * Math.PI) / 180));

      const nextLat = virtualPlayerPos.lat + deltaLat;
      const nextLon = virtualPlayerPos.lon + deltaLon;

      // KIỂM TRA VA CHẠM MẶT NƯỚC & THIẾT BỊ THỦY HÀNH (BÈ TRE / THUYỀN)
      const isWater = checkIsWaterLocation(nextLat, nextLon);
      const hasWaterCraft = (app.profile.player.carried['bamboo_raft'] ?? 0) > 0 || (app.profile.player.carried['wooden_boat'] ?? 0) > 0;

      if (isWater && !hasWaterCraft) {
        currentMovementSpeedKmh = 0;
        const nowMs = Date.now();
        if (nowMs - lastWaterWarningMs > 4000) {
          lastWaterWarningMs = nowMs;
          toast('🌊 Phía trước là mặt nước sâu! Cần chế tạo Bè Tre hoặc Thuyền Độc Mộc trong Chế Tạo để vượt sông hồ.', 'warn');
          audio.play('hit_wood');
        }
      } else {
        virtualPlayerPos.lat = nextLat;
        virtualPlayerPos.lon = nextLon;
        app.profile.player.lastPosition = { ...virtualPlayerPos };

        // Tích luỹ quãng đường để quy đổi thành bước chân thật
        pedometer.addGpsDistanceWalked(distMeters);
        checkNearOutpostSupply();
        updateHanoiTreasureHud(virtualPlayerPos);
      }
    } else if (app.profile?.player.autoTravel && moveDt > 0) {
      // TỰ ĐỘNG DI CHUYỂN DỌC THEO LỘ TRÌNH (ONLINE AUTO-TRAVEL LOOP)
      const travel = app.profile.player.autoTravel;
      const distToTarget = distanceMeters(virtualPlayerPos, travel.target);

      if (distToTarget <= 15) {
        const destName = travel.target.nameVi || 'Điểm đến';
        app.profile.player.autoTravel = null;
        persist();
        audio.play('quest_complete');
        toast(`🎉 Đã hoàn tất chuyến hành trình đến ${destName} an toàn!`, 'good');
        updateAutoTravelHud();
      } else {
        const dLat = travel.target.lat - virtualPlayerPos.lat;
        const dLon = travel.target.lon - virtualPlayerPos.lon;
        const heading = Math.atan2(dLon * Math.cos((virtualPlayerPos.lat * Math.PI) / 180), dLat);
        currentMovementHeading = heading;
        currentDeviceHeading = (heading * 180) / Math.PI;

        const autoSpeedKmh = travel.speedKmh || 8.0;
        currentMovementSpeedKmh = autoSpeedKmh;
        const spdMs = autoSpeedKmh * (1000 / 3600);
        const distStep = spdMs * moveDt;

        const deltaLat = (distStep * Math.cos(heading)) / 111139;
        const deltaLon = (distStep * Math.sin(heading)) / (111139 * Math.cos((virtualPlayerPos.lat * Math.PI) / 180));

        virtualPlayerPos.lat += deltaLat;
        virtualPlayerPos.lon += deltaLon;
        app.profile.player.lastPosition = { ...virtualPlayerPos };

        pedometer.addGpsDistanceWalked(distStep);
        updateAutoTravelHud();
      }
    } else {
      currentMovementSpeedKmh = 0;
    }

    // 2. CẬP NHẬT AI DÃ THÚ TRUY ĐUỔI TRONG PHẠM VI LÃNH ĐỊA
    if (app.profile && dynamicBeasts.size > 0) {
      const { render: playerAt } = currentPosition();
      const WORLD_ORIGIN_LAT = 21.0;
      const WORLD_ORIGIN_LON = 105.8;
      const playerWorldX = (playerAt.lon - WORLD_ORIGIN_LON) / metersToLonDegrees(1, playerAt.lat);
      const playerWorldY = (playerAt.lat - WORLD_ORIGIN_LAT) / metersToLatDegrees(1);
      const beastDt = Math.min(0.2, (timestamp - (lastBeastAiTime || timestamp)) / 1000);
      lastBeastAiTime = timestamp;

      if (beastDt > 0) {
        updateDynamicBeastPacks(dynamicBeasts, playerWorldX, playerWorldY, beastDt, Date.now(), (beast, dmg) => {
          if (!app.profile) return;
          const curHp = app.profile.player.survival.hp ?? 100;
          const nextHp = Math.max(0, curHp - dmg);
          app.profile.player.survival.hp = nextHp;
          mapView?.triggerPlayerHit(dmg);
          audio.play('strike');
          if (app.profile.settings.haptics) buzz([0, 100, 60, 160]);

          if (nextHp <= 0) {
            toast(`💀 Bạn bị ${beast.nameVi} đánh ngất và được cứu về Doanh Trại!`, 'bad');
            const campCenter = getHomeCampCenter() || { lat: 21.0068, lon: 105.8431 };
            virtualPlayerPos = { ...campCenter };
            app.profile.player.survival.hp = 35;
            persist();
            sync();
            render();
          } else {
            toast(`💥 Bị ${beast.nameVi} cào xé! (-${dmg} HP) — Hãy chạy nhanh ra xa!`, 'bad');
            persist();
            render();
          }
        });
      }
    }

    // Tốc độ làm tươi mượt mà theo tần số quét màn hình (60Hz / 120Hz / 144Hz) với Delta Time chuẩn xác
    const renderDt = lastFrameTime > 0 ? Math.min(0.1, (timestamp - lastFrameTime) / 1000) : 0.016;
    lastFrameTime = timestamp;

    app.simTick++;
    drawMap(renderDt);
  };
  cancelAnimationFrame(rafHandle);
  rafHandle = requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Màn hình tắt / khóa máy:
      syncIntervalMs = 30_000;
      scheduleSyncTimer();
    } else {
      // Mở sáng màn hình:
      syncIntervalMs = 5_000;
      scheduleSyncTimer();
      sync();
    }
  });
}

/**
 * Nhịp tim của app: rút số bước đã tích, đưa hết cho lõi, nhận về trạng thái mới.
 * Toàn bộ "chuyện đã xảy ra khi bạn vắng mặt" đều sinh ra ở một chỗ duy nhất này.
 */
function sync(): void {
  if (!app.profile) return;

  checkGpsRequirement();

  const steps = pedometer.drain();
  const { position } = currentPosition();

  const result = openApp({
    profile: app.profile,
    deviceMs: now(),
    newSteps: steps.newSteps,
    stepIntervalsMs: steps.intervalsMs,
    position,
    pack: PACK,
  });

  app.profile = result.profile;
  app.view = result.view;

  // Cập nhật danh sách điểm di tích/tài nguyên kết hợp chỉ khi dữ liệu vùng thay đổi
  const featureMap = new Map<string, MapFeature>();
  for (const f of ALL_PACK_FEATURES) featureMap.set(f.id, f);
  for (const f of app.view.mapFeatures) featureMap.set(f.id, f);
  cachedCombinedFeatures = Array.from(featureMap.values());

  // Xoá drop cũ nếu quá xa vị trí hiện tại (>150m) — sửa bug drop spawn ở FALLBACK_POSITION rồi GPS bắt vị trí thật
  if (worldDrops.length > 0) {
    const { render: playerAt } = currentPosition();
    const dropDist = distanceMeters(playerAt, { lat: worldDrops[0].lat, lon: worldDrops[0].lon });
    if (dropDist > 150) {
      worldDrops = [];
    }
  }

  worldDrops = [];
  updateHanoiTreasureHud(position);

  for (const message of result.eventsVi) {
    if (message.includes('Đồng hồ máy') || message.includes('lượt nhặt')) continue; // Đã loại bỏ hoàn toàn thông báo nhặt đồ thụ động theo yêu cầu
    toast(message);
    if (message.includes('Xong nhiệm vụ')) {
      audio.play('quest_complete');
    }
  }
  if (result.knockedOut) buzz([140, 70, 140]);

  if (result.beats.length > 0 && app.profile.settings.narrationAudio) {
    audio.play('beat_notify');
    
    // Lọc trùng tuyệt đối: Chỉ thêm những câu thoại chưa có trong hàng đợi và chưa từng phát
    const newBeats: StoryBeat[] = [];
    for (const b of result.beats) {
      if (!app.narrationQueue.some((q) => q.id === b.id) && !app.profile.story.playedBeatIds.includes(b.id)) {
        newBeats.push(b);
      }
      // Đánh dấu ngay vào profile và lưu để các lần sync() định kỳ 5s sau không bao giờ trả về câu thoại này lần nữa
      app.profile = playBeat(app.profile, b.id);
    }
    persist();

    if (newBeats.length > 0) {
      app.narrationQueue.push(...newBeats);
      
      const hasChapterOpeningBeat = newBeats.some((b) => b.triggerSteps === 0);
      const curChap = CHAPTERS.find((c) => c.index === app.profile?.story.chapterIndex);
      if (hasChapterOpeningBeat && curChap) {
        showChapterIntro(curChap, () => showNextBeat());
      } else {
        showNextBeat();
      }
    }
  } else {
    for (const beat of result.beats) app.profile = playBeat(app.profile, beat.id);
    persist();
  }

  if (app.view.demo.gated) el('overlay-demo').hidden = false;

  // Cập nhật tiến độ ấp trứng linh thú
  if (app.profile.player.incubatingEgg && !app.profile.player.incubatingEgg.hatched) {
    const incRes = tickEggIncubation(app.profile.player.incubatingEgg, app.profile.player.lifetime.steps);
    app.profile.player.incubatingEgg = incRes.incubating;
    if (incRes.newlyHatchedPet) {
      if (!app.profile.player.pets) app.profile.player.pets = [];
      app.profile.player.pets.push(incRes.newlyHatchedPet);
      audio.play('quest_complete');
      toast(`🎉 Chúc mừng! Quả trứng cổ đại đã nở thành ${incRes.newlyHatchedPet.nameVi}!`, 'good');
    }
  }

  // Cập nhật tiến độ trồng trọt nông trại
  const isRaining = app.view.weather.kind === 'rain';
  app.profile.player.camp.farmPlots = tickFarmPlots(
    app.profile.player.camp.farmPlots ?? [],
    app.profile.player.camp.level,
    now(),
    isRaining,
  );

  persist();
  // Kiểm tra Lãnh Địa Quái Thú Sương Đỏ
  const { render: currentAt } = currentPosition();
  const activeTerritory = checkBeastTerritory(currentAt.lat, currentAt.lon);
  const hudTerritoryBanner = document.getElementById('territory-threat-banner');
  if (hudTerritoryBanner) {
    if (activeTerritory) {
      hudTerritoryBanner.hidden = false;
      hudTerritoryBanner.innerHTML = `⚠️ <strong>${activeTerritory.nameVi}</strong> • Nguy cơ Đe Dọa Cấp ${activeTerritory.threatLevel} (X${activeTerritory.resourceMultiplier} Tài Nguyên)`;
    } else {
      hudTerritoryBanner.hidden = true;
    }
  }

  // Kiểm tra Áp lực Màn Đêm
  const localTime = toLocalTime(now());
  const nightThreat = checkNightAmbientThreat(
    currentAt.lat,
    currentAt.lon,
    localTime.hour,
    app.profile.player.carried,
    cachedCombinedFeatures,
  );
  if (nightThreat.isThreatActive && now() - lastNightThreatWarnMs > 45_000) {
    lastNightThreatWarnMs = now();
    app.profile.player.survival.hp = Math.max(5, (app.profile.player.survival.hp ?? 100) - nightThreat.hpDrained);
    toast(nightThreat.messageVi || '🌑 Màn đêm lạnh lẽo bủa vây! Dã thú rình rập trong bóng tối.', 'warn');
    buzz([0, 80, 50, 80]);
  }

  render();
  updatePocketModeDisplay();
}

let lastNightThreatWarnMs = 0;

function persist(): void {
  if (app.profile) {
    app.profile.player.lastPosition = { ...virtualPlayerPos };
    app.save = putProfile(app.save, app.save.activeSlot, app.profile);
  }
  app.storageOk = writeSave(app.save, now());
}

function render(forceAll = false): void {
  const { profile, view } = app;
  if (!profile || !view) return;

  // Luôn cập nhật HUD & Panel địa bàn tức thời
  renderHud(view, profile);
  renderZonePanel(view, profile);
  renderZoneActions(view, profile, handlers);

  // Chỉ cập nhật các Drawer ngầm khi tab tương ứng đang mở hoặc forceAll = true (giảm 75% DOM reflows)
  const active = app.activeTab;
  if (forceAll || active === 'bag') {
    renderBagPanel(profile, handlers);
  }
  if (forceAll || active === 'craft') {
    renderCraft(view, profile, handlers, app.onlyCraftable);
  }
  if (forceAll || active === 'camp') {
    renderCamp(view, profile, handlers);
  }
  if (forceAll || active === 'log') {
    const current = chapter(profile.story.chapterIndex);
    const played = (current?.beats ?? []).filter((b) => profile.story.playedBeatIds.includes(b.id));
    renderLog(view, profile, current?.titleVi ?? '—', current?.summaryVi ?? '', played, handlers, now());
  }
  if (forceAll || active === 'settings') {
    renderSettings(profile, handlers, app.storageOk);
  }

  const pedoEl = document.getElementById('pedo-source');
  if (pedoEl) pedoEl.textContent = describeSource(pedometer.currentSource);

  // Cập nhật biểu tượng và số lượng đạn trên Cụm Nút Chiến Đấu bên phải
  updateCombatPadUI();

  // Đảm bảo Joystick & Cụm Nút Chiến Đấu tự động ẩn/hiện chính xác theo tab hiện hành
  updateControlsVisibility();
}

let lastBeastDamageTime = 0;

function checkBeastAttackDamage(beast: { nameVi: string; distMeters: number }): void {
  if (!app.profile) return;
  const nowMs = performance.now();
  if (beast.distMeters <= 8.5 && nowMs - lastBeastDamageTime >= 1200) {
    lastBeastDamageTime = nowMs;
    const dmg = 5;
    const curHp = app.profile.player.survival.hp ?? 100;
    const nextHp = Math.max(0, curHp - dmg);
    app.profile.player.survival.hp = nextHp;

    // Kích hoạt hiệu ứng hình ảnh số máu trừ & viền đỏ trên MapView
    mapView?.triggerPlayerHit(dmg);

    // Âm thanh & Rung
    audio.play('strike');
    if (app.profile.settings.haptics) buzz([0, 100, 60, 160]);

    if (nextHp <= 0) {
      // Hết máu: Bị đánh ngất và hồi sinh tại Căn Cứ Doanh Trại
      toast(`💀 Bạn bị ${beast.nameVi} đánh ngất và được dân làng cứu về Doanh Trại!`, 'bad');
      const campCenter = getHomeCampCenter() || { lat: 21.0068, lon: 105.8431 };
      virtualPlayerPos = { ...campCenter };
      app.profile.player.survival.hp = 35; // Hồi 35 HP
      persist();
      sync();
      render();
    } else {
      toast(`💥 Bị ${beast.nameVi} cào xé! (-${dmg} HP) — Hãy chạy nhanh ra xa!`, 'bad');
      persist();
      render();
    }
  }
}

function drawMap(dt?: number): void {
  if (!mapView || !app.view || !app.profile) return;

  const { render: at, hasFix } = currentPosition();
  const weather = weatherFor(at, now());
  const localTime = toLocalTime(now());
  const isNight = localTime.hour >= 18 || localTime.hour < 6;
  const hasTorch = (app.profile.player.carried['torch'] ?? 0) > 0;

  mapView.render({
    center: at,
    features: cachedCombinedFeatures,
    playerWeightKg: 72,
    phase: app.view.phase,
    weather,
    gender: app.profile.player.gender ?? 'male',
    hasFix,
    homeCellCenter: getHomeCampCenter(),
    camp: app.profile.player.camp,
    campDefense: campDefensePower(app.profile.player.camp),
    activePoiId: app.view.location?.insidePoi?.id ?? null,
    drops: worldDrops,
    traps: app.profile.player.traps,
    dynamicBeasts,
    activePetId: app.profile.player.pets?.find((p: any) => p.isActive)?.petId ?? null,
    strengthLevel: app.profile.player.strengthLevel ?? 1,
    speedKmh: currentMovementSpeedKmh,
    isMoving: currentMovementSpeedKmh > 0.2 || Math.hypot(joystickVector.x, joystickVector.y) > 0.05,
    moveHeading: currentMovementHeading,
    hasTorch,
    isNight,
    isSprinting: isCurrentlySprinting,
    aimHeading: currentMovementHeading,
    isAiming: isAimingInPad,
    aimWeaponType: getCurrentEquippedWeapon().isRanged ? (getCurrentEquippedWeapon().id === 'sharp_stone' ? 'stone' : 'bow') : (getCurrentEquippedWeapon().id === 'iron_spear' ? 'spear' : 'axe'),
    dt,
  });
}

function toRoman(num: number): string {
  const map: [number, string][] = [
    [12, 'XII'],
    [11, 'XI'],
    [10, 'X'],
    [9, 'IX'],
    [8, 'VIII'],
    [7, 'VII'],
    [6, 'VI'],
    [5, 'V'],
    [4, 'IV'],
    [3, 'III'],
    [2, 'II'],
    [1, 'I'],
  ];
  return map.find(([val]) => val === num)?.[1] ?? String(num);
}

function showChapterIntro(chapterObj: any, onStart: () => void): void {
  const overlay = el('overlay-chapter-intro');
  el('chapter-intro-icon').textContent = chapterObj.caveArtIcon || '📜';
  el('chapter-intro-num').textContent = `CHƯƠNG ${toRoman(chapterObj.index)}`;
  el('chapter-intro-title').textContent = chapterObj.titleVi.replace(/^Chương \d+\s*—\s*/, '');
  el('chapter-intro-epigraph').textContent = `"${chapterObj.epigraphVi || 'Hành trình sinh tồn vĩ đại nơi đất mẹ tiền sử.'}"`;
  el('chapter-intro-summary').textContent = chapterObj.summaryVi;

  overlay.hidden = false;
  audio.play('quest_complete');

  el('btn-chapter-intro-start').onclick = () => {
    overlay.hidden = true;
    onStart();
  };
}

function showPrologue(onProceed: () => void): void {
  const overlay = el('overlay-prologue');
  overlay.hidden = false;
  audio.play('roar');

  el('btn-prologue-proceed').onclick = () => {
    overlay.hidden = true;
    if (app.profile) {
      app.profile.player.carried['torch'] = (app.profile.player.carried['torch'] ?? 0) + 1;
      app.profile.player.carried['wild_berry'] = (app.profile.player.carried['wild_berry'] ?? 0) + 2;
      app.profile.player.carried['boiled_water'] = (app.profile.player.carried['boiled_water'] ?? 0) + 1;
      persist();
      toast('🎁 Nhận Túi Đồ Sinh Tồn Tân Thủ (1 Đuốc, 2 Quả Dại, 1 Nước Sôi)!', 'good');
    }
    onProceed();
  };
}

// ---------------------------------------------------------------- lời dẫn của Lạc Lạc phong cách Visual Novel

let typeWriterInterval: any = null;
let currentActiveBeatText: string | null = null;

function showNextBeat(): void {
  if (app.narrationOpen || !app.profile) return;

  const beat = app.narrationQueue.shift();
  if (!beat) return;

  app.narrationOpen = true;
  currentActiveBeatText = beat.textVi;

  // Cập nhật biểu cảm và trạng thái của Lạc Lạc
  const avatarEmoji = el('narration-avatar-emoji');
  const avatarBox = el('narration-avatar');
  const moodBadge = el('narration-mood');
  const waveBox = el('narration-wave');

  const mood = (beat as any).mood || 'calm';
  if (mood === 'worried') {
    avatarEmoji.textContent = '😨';
    avatarBox.style.borderColor = '#ef4444';
    moodBadge.textContent = '⚠️ Lo lắng';
    moodBadge.className = 'chip chip--tiny chip--bad';
  } else if (mood === 'determined') {
    avatarEmoji.textContent = '😤';
    avatarBox.style.borderColor = '#f59e0b';
    moodBadge.textContent = '🔥 Quyết tâm';
    moodBadge.className = 'chip chip--tiny chip--warn';
  } else if (mood === 'surprised') {
    avatarEmoji.textContent = '😲';
    avatarBox.style.borderColor = '#c084fc';
    moodBadge.textContent = '⚡ Bất ngờ';
    moodBadge.className = 'chip chip--tiny';
  } else if (mood === 'proud') {
    avatarEmoji.textContent = '👑';
    avatarBox.style.borderColor = '#4ade80';
    moodBadge.textContent = '🏆 Tự hào';
    moodBadge.className = 'chip chip--tiny chip--good';
  } else {
    avatarEmoji.textContent = '👧';
    avatarBox.style.borderColor = '#38bdf8';
    moodBadge.textContent = '📶 Tỉnh táo';
    moodBadge.className = 'chip chip--tiny';
  }

  const textEl = el('narration-text');
  textEl.textContent = '';
  el('overlay-narration').hidden = false;

  if (typeWriterInterval) clearInterval(typeWriterInterval);

  let charIndex = 0;
  const fullText = beat.textVi;
  if (waveBox) waveBox.style.opacity = '1';

  typeWriterInterval = setInterval(() => {
    if (charIndex < fullText.length) {
      textEl.textContent += fullText[charIndex];
      charIndex++;
    } else {
      clearInterval(typeWriterInterval);
      typeWriterInterval = null;
    }
  }, 16);

  const btnReplay = el('btn-replay-voice');
  if (btnReplay) {
    btnReplay.onclick = () => {
      speech.speak(beat.textVi);
      if (waveBox) waveBox.style.opacity = '1';
    };
  }

  speech.speak(beat.textVi);

  app.profile = playBeat(app.profile, beat.id);
  persist();
}

// ---------------------------------------------------------------- hành động

const handlers: Handlers = {
  onCraft(recipeId) {
    if (!app.profile) return;
    const result = craft(app.profile, recipeId, now(), true);
    app.profile = result.profile;
    toast(result.messageVi, result.ok ? 'good' : 'bad');
    if (result.ok) audio.play('craft');
    afterAction();
  },

  onCollectCrafts() {
    if (!app.profile) return;
    const result = collectCrafts(app.profile, now());
    app.profile = result.profile;
    for (const message of result.messagesVi) toast(message, 'good');
    if (result.messagesVi.length > 0) audio.play('pickup');
    afterAction();
  },

  onUpgradeCamp() {
    if (!app.profile) return;
    const result = upgradeCamp(app.profile, now());
    app.profile = result.profile;
    toast(result.messageVi, result.ok ? 'good' : 'bad');
    if (result.ok) audio.play('quest_complete');
    afterAction();
  },

  onExpandCampTerritory() {
    if (!app.profile) return;
    const result = expandCampTerritory(app.profile.player.camp, app.profile.player, now());
    if (result.success) {
      app.profile.player = result.player;
      persist();
      audio.play('quest_complete');
      toast(result.messageVi, 'good');
      sync();
      render();
    } else {
      toast(result.messageVi, 'bad');
    }
  },

  onUpgradeArtisan() {
    if (!app.profile) return;
    const result = upgradeArtisanRankWithGold(app.profile.player);
    if (result.ok) {
      app.profile = {
        ...app.profile,
        player: result.player,
      };
      toast(result.messageVi, 'good');
      audio.play('quest_complete');
    } else {
      toast(result.messageVi, 'bad');
    }
    afterAction();
  },

  onConsume(itemId) {
    if (!app.profile) return;
    const result = consume(app.profile, itemId, now());
    app.profile = result.profile;
    toast(result.messageVi, result.ok ? 'good' : 'bad');
    if (result.ok) {
      if (itemId === 'boiled_water' || itemId === 'raw_water') {
        audio.play('drink');
      } else if (itemId === 'healing_salve' || itemId === 'medicinal_herb') {
        audio.play('heal');
      } else {
        audio.play('eat');
      }
    }
    afterAction();
  },

  onStoreSafe(itemId, qty) {
    if (!app.profile) return;
    const result = storeInSafe(app.profile, [{ itemId, qty }]);
    app.profile = result.profile;
    toast(result.messageVi, result.ok ? 'good' : 'bad');
    if (result.ok) audio.play('click');
    afterAction();
  },

  onWithdrawSafe(itemId, qty) {
    if (!app.profile) return;
    const result = withdrawFromSafe(app.profile, [{ itemId, qty }]);
    app.profile = result.profile;
    toast(result.messageVi, result.ok ? 'good' : 'bad');
    if (result.ok) audio.play('pickup');
    afterAction();
  },

  onUpgradeSafeVault() {
    if (!app.profile) return;
    const result = upgradeSafeVaultRank(app.profile);
    app.profile = result.profile;
    toast(result.messageVi, result.ok ? 'good' : 'bad');
    if (result.ok) audio.play('quest_complete');
    afterAction();
  },

  onQuickStorePrecious() {
    if (!app.profile) return;
    const carried = app.profile.player.carried ?? {};
    const preciousMoves: { itemId: string; qty: number }[] = [];

    for (const [itemId, qty] of Object.entries(carried)) {
      if (qty <= 0) continue;
      const def = getItem(itemId);
      const isPrecious =
        def.safe ||
        itemId === 'ancient_coin' ||
        itemId === 'blueprint' ||
        itemId === 'upgrade_core' ||
        itemId.startsWith('egg_') ||
        itemId === 'gold_ore' ||
        itemId === 'iron_ingot';

      if (isPrecious) {
        preciousMoves.push({ itemId, qty });
      }
    }

    if (preciousMoves.length === 0) {
      toast('Không có đồ quý hoặc đồng vàng nào trong túi để cất.', 'bad');
      return;
    }

    const result = storeInSafe(app.profile, preciousMoves);
    app.profile = result.profile;
    if (result.ok) {
      toast(`⚡ Đã cất an toàn ${preciousMoves.length} loại vật phẩm quý vào két!`, 'good');
      audio.play('pickup');
    } else {
      toast(result.messageVi, 'bad');
    }
    afterAction();
  },

  onGather(actionId, poiId, zone) {
    if (!app.profile) return;

    const run = (minigameScore?: number) => {
      const result = gather({
        profile: app.profile!,
        actionId,
        poiId,
        zone,
        nowMs: now(),
        distanceMeters: app.view?.location?.insidePoi?.distanceMeters ?? 0,
        minigameScore,
        speed: app.speed,
      });

      app.profile = result.profile;
      toast(result.messageVi, result.ok ? 'good' : 'bad');
      if (result.ok) {
        audio.play('pickup');
        if (app.profile.settings.haptics) buzz(20);
      }
      afterAction();
    };

    const action = findAction(actionId);

    if (actionId === 'merchant_trade') {
      const poiName = app.view?.location?.insidePoi?.poi.nameVi || 'Tiệm Trao Đổi Tiền Sử';
      openMerchantStore(poiName);
      return;
    }

    if (!action?.minigame) {
      run();
      return;
    }

    // Chạy thử điều kiện TRƯỚC khi mở minigame: bắt người chơi bổ 45 giây rồi mới báo
    // "chưa có rìu" hay "hết lượt hôm nay" là kiểu thiết kế tệ nhất.
    const dryRun = gather({
      profile: app.profile,
      actionId,
      poiId,
      zone,
      nowMs: now(),
      distanceMeters: app.view?.location?.insidePoi?.distanceMeters ?? 0,
      minigameScore: 0,
      speed: app.speed,
    });

    if (!dryRun.ok) {
      toast(dryRun.messageVi, 'bad');
      return;
    }

    void openMinigame(action.nameVi, action.minigame).then((score) => {
      if (score === null) return;
      run(score);
    });
  },

  onTrade(_index, poiId) {
    if (!app.profile) return;
    const insidePoi = app.view?.location?.insidePoi;
    const poiName = insidePoi?.nameVi || 'Tiệm Thương Nhân';
    audio.play('click');
    openMerchantStore(poiName);
  },

  onSleep() {
    if (!app.profile) return;
    const isAsleep = app.profile.player.survival.asleep;
    if (isAsleep) {
      const result = wakeUp(app.profile, now());
      app.profile = result.profile;
      toast(result.messageVi);
    } else {
      const hasBedroll = (app.profile.player.carried['traveler_bedroll'] ?? 0) > 0;
      const result = sleepAtCamp(app.profile, now());
      app.profile = result.profile;
      if (hasBedroll) {
        toast('⛺ Bạn trải Túi Ngủ Dã Ngoại nghỉ ngơi. Giấc ngủ hồi phục thể lực và xoá tan kiệt sức!', 'good');
      } else {
        toast(result.messageVi, 'good');
      }
    }
    afterAction();
  },

  onNightDefense() {
    if (!app.profile || !app.view) return;

    audio.play('roar');
    openNightDefense(app.view, {
      resolve(performance) {
        const result = runNightDefense(app.profile!, now(), performance, performance > 0);
        app.profile = result.profile;
        persist();
        render();
        if (result.result.survived) audio.play('quest_complete');
        return {
          logVi: result.result.logVi,
          survived: result.result.survived,
          rewardsVi: describeInventory(result.result.rewards),
        };
      },
      onClosed: () => afterAction(),
    });
  },

  onBloodMoon() {
    if (!app.profile) return;

    audio.play('roar');
    openBloodMoon(app.profile, {
      begin(difficulty: DifficultyId) {
        const result = beginBloodMoon(app.profile!, now(), difficulty);
        app.profile = result.profile;
        persist();
        return { ok: result.ok, messageVi: result.messageVi, fight: result.fight };
      },
      strike(performance) {
        const result = strikeBoss(app.profile!, now(), performance, 25);
        app.profile = result.profile;
        persist();
        audio.play('strike');
        return { fight: result.fight, messageVi: result.messageVi, defeated: result.defeated };
      },
      tick() {
        app.profile = tickBloodMoonAllies(app.profile!, now());
        return app.profile.activeFight;
      },
      settle() {
        const result = finishBloodMoon(app.profile!, now());
        app.profile = result.profile;
        persist();
        render();
        if (result.settlement?.victory) audio.play('quest_complete');
        return {
          summaryVi: result.messageVi,
          victory: result.settlement?.victory ?? false,
          rewardsVi: describeInventory(result.settlement?.rewards ?? {}),
        };
      },
      onClosed: () => afterAction(),
    });
  },

  onPlaceTrap(trapItemId) {
    if (!app.profile) return;
    const { render: playerAt } = currentPosition();
    const result = placeTrap(app.profile.player, trapItemId, playerAt, now());
    if (result.ok) {
      app.profile.player = result.player;
      persist();
      audio.play('trap_snap');
      toast(result.messageVi, 'good');
      sync();
      // Chuyển sang tab bản đồ để xem ngay vị trí bẫy vừa đặt
      for (const btn of document.querySelectorAll<HTMLButtonElement>('.tabbar__btn')) {
        if (btn.dataset.tab === 'map') btn.click();
      }
    } else {
      toast(result.messageVi, 'bad');
    }
  },

  onUpgradeFishTrap() {
    if (!app.profile) return;
    const result = upgradeFishTrapWithGold(app.profile.player);
    if (result.ok) {
      app.profile.player = result.player;
      toast(result.messageVi, 'good');
      audio.play('quest_complete');
    } else {
      toast(result.messageVi, 'bad');
    }
    afterAction();
  },

  onStartIncubate(eggItemId) {
    if (!app.profile) return;
    const currentQty = app.profile.player.carried[eggItemId] ?? 0;
    if (currentQty <= 0) {
      toast('Không có trứng trong túi đồ.', 'bad');
      return;
    }
    app.profile.player.carried[eggItemId] = currentQty - 1;
    app.profile.player.incubatingEgg = startIncubation(eggItemId, app.profile.player.lifetime.steps);
    persist();
    audio.play('pickup');
    toast(`🥚 Đã đặt quả trứng vào túi ấp! Hãy đi bộ để trứng nở.`, 'good');
    afterAction();
  },

  onFeedPet(petId, foodItemId) {
    if (!app.profile || !app.profile.player.pets) return;
    const pet = app.profile.player.pets.find((p) => p.petId === petId);
    if (!pet) return;

    const currentQty = app.profile.player.carried[foodItemId] ?? 0;
    if (currentQty <= 0) {
      const food = getItem(foodItemId);
      toast(`Bạn cần có ${food.nameVi} trong túi để cho thú cưng ăn.`, 'bad');
      return;
    }

    app.profile.player.carried[foodItemId] = currentQty - 1;
    const fed = feedPet(pet, foodItemId);
    app.profile.player.pets = app.profile.player.pets.map((p) => (p.petId === petId ? fed.pet : p));
    persist();
    audio.play('eat');
    toast(fed.messageVi, 'good');
    afterAction();
  },

  onPlantCrop(plotIndex, cropId) {
    if (!app.profile) return;

    // Kiểm tra: phải đứng tại doanh trại mới được gieo hạt
    const campCenter = getHomeCampCenter();
    const pos = currentPosition().position;
    if (campCenter && pos) {
      const dist = distanceMeters(pos, campCenter);
      if (dist > 200) {
        toast(`🏕️ Cần về Doanh Trại mới có thể gieo hạt! (Còn cách ${Math.round(dist)}m)`, 'bad');
        return;
      }
    } else if (!campCenter) {
      toast('Chưa có doanh trại. Hãy đặt trại trước!', 'bad');
      return;
    }

    const seedQty = app.profile.player.carried['seed'] ?? 0;
    if (seedQty <= 0) {
      toast('Cần có Hạt giống trong túi đồ để gieo trồng.', 'bad');
      return;
    }
    app.profile.player.carried['seed'] = seedQty - 1;
    const plots = app.profile.player.camp.farmPlots ?? createInitialFarmPlots(app.profile.player.camp.level);
    const result = plantInPlot(plots, plotIndex, cropId, now());
    if (result.ok) {
      app.profile.player.camp.farmPlots = result.plots;
      persist();
      audio.play('craft');
      toast(result.messageVi, 'good');
      afterAction();
    } else {
      toast(result.messageVi, 'bad');
    }
  },

  onWaterPlot(plotIndex) {
    if (!app.profile) return;
    const plots = app.profile.player.camp.farmPlots ?? createInitialFarmPlots(app.profile.player.camp.level);
    const result = waterPlot(plots, plotIndex, now());
    if (result.ok) {
      app.profile.player.camp.farmPlots = result.plots;
      persist();
      audio.play('drink');
      toast(result.messageVi, 'good');
      afterAction();
    } else {
      toast(result.messageVi, 'bad');
    }
  },

  onFertilizePlot(plotIndex) {
    if (!app.profile) return;
    const spoiledMeat = app.profile.player.carried['spoiled_meat'] ?? 0;
    if (spoiledMeat <= 0) {
      toast('Cần có 1 Thịt ôi / Phân hữu cơ trong túi để bón phân!', 'bad');
      return;
    }
    app.profile.player.carried['spoiled_meat'] = spoiledMeat - 1;
    const plots = app.profile.player.camp.farmPlots ?? createInitialFarmPlots(app.profile.player.camp.level);
    const result = fertilizePlot(plots, plotIndex);
    if (result.ok) {
      app.profile.player.camp.farmPlots = result.plots;
      persist();
      audio.play('craft');
      toast(result.messageVi, 'good');
      afterAction();
    } else {
      toast(result.messageVi, 'bad');
    }
  },

  onHarvestPlot(plotIndex) {
    if (!app.profile) return;
    const plots = app.profile.player.camp.farmPlots ?? createInitialFarmPlots(app.profile.player.camp.level);
    const result = harvestPlot(plots, plotIndex);
    if (result.ok) {
      app.profile.player.camp.farmPlots = result.plots;
      for (const [id, count] of Object.entries(result.rewards)) {
        app.profile.player.carried[id] = (app.profile.player.carried[id] ?? 0) + count;
      }
      persist();
      audio.play('pickup');
      toast(result.messageVi, 'good');
      afterAction();
    } else {
      toast(result.messageVi, 'bad');
    }
  },

  onOpenAR() {
    const video = el<HTMLVideoElement>('ar-video');
    const canvas = el<HTMLCanvasElement>('ar-canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    el('overlay-ar-camera').hidden = false;
    const locName = app.view?.location?.insidePoi?.nameVi || 'Cổ Đạo Hà Nội';
    void startARCamera(video, canvas, locName).then((res) => {
      if (!res.ok) toast(res.messageVi, 'bad');
      else toast('📸 Di chuyển camera để tương tác cùng linh thú tiền sử!', 'good');
    });

    el('btn-ar-close').onclick = () => {
      stopARCamera();
      el('overlay-ar-camera').hidden = true;
    };

    el('btn-ar-capture').onclick = () => {
      const dataUrl = captureARPhoto();
      if (dataUrl) {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `ky-nguyen-hoang-co-ar-${Date.now()}.png`;
        a.click();
        audio.play('pickup');
        toast('📸 Đã lưu bức ảnh AR kỷ niệm về máy!', 'good');
      }
    };

    for (const btn of document.querySelectorAll<HTMLButtonElement>('.ar-model-btn')) {
      btn.onclick = () => {
        for (const b of document.querySelectorAll<HTMLButtonElement>('.ar-model-btn')) b.classList.remove('is-active');
        btn.classList.add('is-active');
        setARModel(btn.dataset.model as any);
      };
    }
  },

  onOpenCoop() {
    if (!app.profile) return;
    openCoopModal();
  },

  onClaimWeekendQuest(questId) {
    if (!app.profile) return;
    const currentPoi = app.view?.location?.insidePoi ?? null;
    const result = claimWeekendQuest(app.profile.player, questId, now(), currentPoi);
    if (result.ok) {
      app.profile.player = result.player;
      persist();
      audio.play('quest_complete');
      buzz([0, 150, 100, 250]);
      toast(result.messageVi, 'good');
      render();
    } else {
      toast(result.messageVi, 'bad');
    }
  },

  onUpgradeStrength() {
    if (!app.profile) return;
    const res = upgradeStrength(app.profile.player);
    if (res.success) {
      app.profile.player = res.player;
      persist();
      audio.play('quest_complete');
      buzz([0, 100, 50, 200]);
      toast(res.messageVi, 'good');
      render();
    } else {
      audio.play('denied');
      toast(res.messageVi, 'bad');
    }
  },

  onUpgradeSpeed() {
    if (!app.profile) return;
    const res = upgradeSpeed(app.profile.player);
    if (res.success) {
      app.profile.player = res.player;
      persist();
      audio.play('quest_complete');
      buzz([0, 100, 50, 200]);
      toast(res.messageVi, 'good');
      render();
    } else {
      audio.play('denied');
      toast(res.messageVi, 'bad');
    }
  },

  onOpenRelocateCamp() {
    openRelocateCampModal();
  },

  onToggleSetting(key) {
    if (!app.profile) return;
    app.profile = updateSettings(app.profile, { [key]: !app.profile.settings[key] });
    afterAction();
  },

  onTogglePocketMode() {
    switchTab('map');
    togglePocketMode(true);
  },

  onExport() {
    persist();
    downloadText(suggestBackupFileName(now()), exportBackup(app.save, now(), GAME_VERSION));
    toast('Đã xuất file sao lưu. Cất vào chỗ nào an toàn nhé.', 'good');
  },

  onImport() {
    el<HTMLInputElement>('file-import').click();
  },

  onDeleteProfile() {
    if (!app.profile) return;
    promptDeleteProfile(app.save.activeSlot, app.profile.player.displayName);
  },

  onSwitchProfile() {
    persist();
    app.profile = null;
    renderProfileScreen();
  },
};

function openCoopModal(): void {
  if (!app.profile) return;
  const overlay = el('overlay-coop-battle');
  overlay.hidden = false;

  let currentRoom: CoopRoom = createCoopRoom('HANOI_LOCAL', 'peer_main', app.profile, 'normal', now());
  currentRoom = startCoopBattle(currentRoom);

  const updateCoopUI = () => {
    if (!currentRoom.boss) return;
    el('coop-boss-name').textContent = currentRoom.boss.nameVi;
    const hpRatio = Math.max(0, currentRoom.boss.hp / currentRoom.boss.maxHp);
    el('coop-boss-hp-fill').style.width = `${Math.round(hpRatio * 100)}%`;
    el('coop-boss-hp-txt').textContent = `${currentRoom.boss.hp} / ${currentRoom.boss.maxHp} HP`;
    el('coop-team-def').textContent = `${currentRoom.sharedDefense} DEF`;

    const statusBadge = el('coop-status-badge');
    statusBadge.textContent = currentRoom.status === 'victory' ? '🎉 CHIẾN THẮNG VANG DỘI!' : currentRoom.status === 'defeat' ? '💀 TOÀN ĐỘI BỊ ĐÁNH BẠI' : `Hiệp ${currentRoom.round} — Đang giao tranh`;
    statusBadge.className = `chip ${currentRoom.status === 'victory' ? 'chip--good' : currentRoom.status === 'defeat' ? 'chip--bad' : 'chip--warn'}`;

    const membersGrid = el('coop-members-list');
    membersGrid.replaceChildren();
    for (const m of currentRoom.members) {
      const card = document.createElement('div');
      card.className = `coop-member-card ${m.hp <= 0 ? 'is-down' : ''}`;
      card.innerHTML = `
        <strong>${m.nameVi}</strong>
        <div>HP: ${m.hp}/${m.maxHp} · Sát thương: ${m.damageContribution}</div>
      `;
      membersGrid.append(card);
    }

    const logBox = el('coop-battle-logs');
    logBox.innerHTML = currentRoom.battleLogVi.map((l) => `<div>${l}</div>`).join('');
    logBox.scrollTop = logBox.scrollHeight;
  };

  updateCoopUI();

  for (const btn of document.querySelectorAll<HTMLButtonElement>('.btn-coop-action')) {
    btn.onclick = () => {
      if (currentRoom.status !== 'fighting') return;
      const act = btn.dataset.action as any;
      audio.play(act === 'attack' ? 'strike' : act === 'heal_team' ? 'eat' : 'craft');
      currentRoom = processCoopRound(currentRoom, [{ peerId: 'peer_main', action: act }]);
      updateCoopUI();

      if (currentRoom.status === 'victory') {
        audio.play('quest_complete');
        const rewards = resolveCoopRewards(currentRoom);
        for (const rew of rewards) {
          if (rew.peerId === 'peer_main') {
            for (const item of rew.items) {
              app.profile!.player.carried[item.itemId] = (app.profile!.player.carried[item.itemId] ?? 0) + item.qty;
            }
            toast(`🎉 Thắng Boss Co-op! Nhận rương báu: ${describeInventory(rew.items.reduce((acc: any, i) => { acc[i.itemId] = i.qty; return acc; }, {}))}`, 'good');
          }
        }
        afterAction();
      } else if (currentRoom.status === 'defeat') {
        audio.play('roar');
      }
    };
  }

  el('btn-coop-close').onclick = () => {
    overlay.hidden = true;
    afterAction();
  };
}

function afterAction(): void {
  persist();
  if (!app.profile) return;

  const { position, render: at } = currentPosition();
  app.view = buildView(app.profile, now(), at, position, PACK, weatherFor(at, now()));
  render();
}

/** Tự động ẩn Cần Gạt Ảo & Cụm Nút Chiến Đấu khi mở Túi Đồ, Chế Tạo, Doanh Trại hoặc bất kỳ Popup/Drawer nào */
export function updateControlsVisibility(): void {
  const joystick = document.getElementById('virtual-joystick-container');
  const combatPad = document.getElementById('combat-pad-container');
  const actionBtn = document.getElementById('btn-open-actions');
  const dockContainer = document.getElementById('dock-container');

  const isMapTab = app.activeTab === 'map';
  const hasProfile = Boolean(app.profile);

  // Kiểm tra xem có overlay/modal/dialog/drawer nào đang mở không
  const isBackdropVisible = !el('drawer-backdrop').hidden;
  const isCoopVisible = !el('overlay-coop-battle').hidden;
  const isDemoVisible = !el('overlay-demo').hidden;
  const isPocketVisible = !el('overlay-pocket-mode').hidden;
  const isProfileScreenVisible = !el('screen-profiles').hidden;

  const isAnyOverlayOrDrawerOpen =
    !hasProfile ||
    isProfileScreenVisible ||
    !isMapTab ||
    isBackdropVisible ||
    isCoopVisible ||
    isDemoVisible ||
    isPocketVisible;

  const shouldShowControls = hasProfile && isMapTab && !isAnyOverlayOrDrawerOpen;

  if (joystick) {
    joystick.classList.toggle('is-hidden', !shouldShowControls);
  }
  if (combatPad) {
    combatPad.classList.toggle('is-hidden', !shouldShowControls);
  }
  if (actionBtn) {
    actionBtn.style.display = shouldShowControls ? 'flex' : 'none';
  }
  if (dockContainer) {
    // Menu thu gọn chính giữa
    dockContainer.style.display = isAnyOverlayOrDrawerOpen && !isMapTab ? 'none' : 'flex';
  }
}

function switchTab(targetTab: string): void {
  if (app.activeTab !== targetTab) {
    audio.play('click');
  }
  app.activeTab = targetTab;
  const isMap = targetTab === 'map';
  const backdrop = el('drawer-backdrop');
  backdrop.hidden = isMap;

  // Tự động thu gọn Menu về nút tròn khi mở Drawer
  const dockContainer = document.getElementById('dock-container');
  if (dockContainer) {
    dockContainer.classList.add('is-collapsed');
  }

  // Cập nhật trạng thái hiển thị của Joystick và Cụm Nút Chiến Đấu
  updateControlsVisibility();

  // Pause GPS & Compass khi rời tab bản đồ, resume khi quay lại — tiết kiệm pin tối đa
  if (isMap) {
    geo?.resume();
    resumeCompass();
  } else {
    geo?.pause();
    pauseCompass();
  }

  for (const sibling of document.querySelectorAll('.tabbar__btn')) {
    sibling.classList.toggle('is-active', (sibling as HTMLElement).dataset.tab === targetTab);
  }

  for (const tab of document.querySelectorAll<HTMLElement>('.tab')) {
    if (tab.id === 'tab-map') {
      tab.hidden = false; // Luôn hiển thị bản đồ toàn màn hình làm nền
    } else if (tab.id === 'drawer-actions') {
      tab.hidden = targetTab !== 'actions';
    } else {
      tab.hidden = tab.id !== `tab-${targetTab}`;
    }
  }

  if (isMap) {
    mapView?.resize();
  } else {
    render();
  }
}

// ---------------------------------------------------------------- điều khiển tĩnh


// =========================================================================
// HỆ THỐNG BẢN ĐỒ TOÀN CẢNH HÀ NỘI & TỰ HÀNH TRÌNH (HANOI MINIMAP & AUTO-TRAVEL)
// =========================================================================

export interface HanoiLandmark {
  id: string;
  nameVi: string;
  district: string;
  lat: number;
  lon: number;
  icon: string;
  descVi?: string;
}

export const HANOI_LANDMARKS: HanoiLandmark[] = [
  { id: 'hoguom', nameVi: 'Hồ Hoàn Kiếm & Tháp Rùa', district: 'Hoàn Kiếm', lat: 21.0285, lon: 105.8542, icon: '🐢', descVi: 'Trái tim Thăng Long cổ kính, nơi Rùa Thần ngự trị' },
  { id: 'hotay', nameVi: 'Hồ Tây & Chùa Trấn Quốc', district: 'Tây Hồ', lat: 21.0583, lon: 105.8239, icon: '🌊', descVi: 'Mặt hồ mênh mông lộng gió, di tích danh thắng cổ' },
  { id: 'hoangthanh', nameVi: 'Hoàng Thành Thăng Long', district: 'Ba Đình', lat: 21.0368, lon: 105.8402, icon: '🏯', descVi: 'Kinh đô ngàn năm văn hiến, trung tâm quyền lực cổ đại' },
  { id: 'langbac', nameVi: 'Quảng Trường Ba Đình', district: 'Ba Đình', lat: 21.0368, lon: 105.8347, icon: '⭐', descVi: 'Quảng trường lịch sử linh thiêng' },
  { id: 'vanmieu', nameVi: 'Văn Miếu - Quốc Tử Giám', district: 'Đống Đa', lat: 21.0294, lon: 105.8360, icon: '📜', descVi: 'Trường đại học đầu tiên, nơi lưu danh bảng vàng' },
  { id: 'congviencaugiay', nameVi: 'Công Viên Cầu Giấy', district: 'Cầu Giấy', lat: 21.0256, lon: 105.7901, icon: '🌳', descVi: 'Khu vực thảm cỏ tự nhiên xanh mát phía Tây' },
  { id: 'caulongbien', nameVi: 'Cầu Long Biên Lịch Sử', district: 'Long Biên', lat: 21.0425, lon: 105.8582, icon: '🌉', descVi: 'Cây cầu bắc qua dòng sông Hồng cuộn sóng' },
  { id: 'mydinh', nameVi: 'Sân Vận Động Quốc Gia Mỹ Đình', district: 'Nam Từ Liêm', lat: 21.0205, lon: 105.7639, icon: '🏟️', descVi: 'Vùng đất phía Tây sầm uất và rộng lớn' },
  { id: 'vanphuc', nameVi: 'Làng Lụa Vạn Phúc - Hà Đông', district: 'Hà Đông', lat: 20.9780, lon: 105.7728, icon: '🧵', descVi: 'Làng nghề dệt lụa truyền thống cổ xưa' },
  { id: 'coloa', nameVi: 'Thành Cổ Loa & Đền An Dương Vương', district: 'Đông Anh', lat: 21.1128, lon: 105.8719, icon: '🏹', descVi: 'Toà thành ốc cổ xưa huyền thoại của nước Âu Lạc' },
  { id: 'nuisoc', nameVi: 'Đền Gióng - Núi Sóc', district: 'Sóc Sơn', lat: 21.3142, lon: 105.8175, icon: '🐎', descVi: 'Nơi Thánh Gióng cưỡi ngựa sắt bay về trời' },
  { id: 'nuibavi', nameVi: 'Vườn Quốc Gia Ba Vì - Đỉnh Vua', district: 'Ba Vì', lat: 21.0772, lon: 105.3628, icon: '⛰️', descVi: 'Đỉnh núi linh thiêng của Sơn Tinh Thần Núi' },
  { id: 'chuahuong', nameVi: 'Quần Thể Danh Thắng Chùa Hương', district: 'Mỹ Đức', lat: 20.6186, lon: 105.7533, icon: '🛕', descVi: 'Vùng đất Phật thanh tịnh non nước hữu tình' },
  { id: 'thanhsontay', nameVi: 'Thành Cổ Sơn Tây & Làng Đường Lâm', district: 'Sơn Tây', lat: 21.1394, lon: 105.5039, icon: '🏛️', descVi: 'Vùng đất hai vua, thành đá ong kiên cố' },
];

let selectedHanoiDest: HanoiLandmark | { lat: number; lon: number; nameVi: string; icon: string; district: string } | null = null;
let lastWaterWarningMs = 0;

/** Kiểm tra xem toạ độ có nằm trong vùng nước sâu hay không (Hồ Tây, Hồ Gươm, Sông Hồng...) */
export function checkIsWaterLocation(lat: number, lon: number): boolean {
  // 1. Kiểm tra các hồ nước lớn xác định tại Hà Nội
  const waterLocations = [
    { lat: 21.0583, lon: 105.8239, radius: 950 }, // Hồ Tây
    { lat: 21.0478, lon: 105.8378, radius: 320 }, // Hồ Trúc Bạch
    { lat: 21.0285, lon: 105.8542, radius: 230 }, // Hồ Gươm
    { lat: 20.9702, lon: 105.8423, radius: 380 }, // Hồ Linh Đàm
    { lat: 21.0175, lon: 105.8450, radius: 280 }, // Hồ Bảy Mẫu (Công viên Thống Nhất)
    { lat: 21.0450, lon: 105.8650, radius: 450 }, // Sông Hồng 1
    { lat: 21.0750, lon: 105.8350, radius: 500 }, // Sông Hồng 2
    { lat: 21.0100, lon: 105.8900, radius: 480 }, // Sông Hồng 3
  ];

  for (const w of waterLocations) {
    if (distanceMeters({ lat, lon }, { lat: w.lat, lon: w.lon }) <= w.radius) {
      return true;
    }
  }

  // 2. Kiểm tra POI gần đó có zone: 'water'
  if (PACK) {
    const nearby = poisNear(PACK, { lat, lon }, 120);
    if (nearby.some((p) => p.zone === 'water' && p.distanceMeters <= (p.radiusMeters || 100))) {
      return true;
    }
  }

  return false;
}

/** Mô phỏng hành trình tự động khi người chơi tắt game và vào lại */
export function simulateOfflineAutoTravel(): void {
  if (!app.profile || !app.profile.player.autoTravel) return;
  const travel = app.profile.player.autoTravel;
  const nowMs = Date.now();
  const lastMs = app.profile.player.survival.lastTickMs || travel.startTimeMs;
  const elapsedSec = Math.max(0, (nowMs - lastMs) / 1000);
  if (elapsedSec < 2) return;

  const spdMs = ((travel.speedKmh || 8.0) * 1000) / 3600;
  const distTraveledMeters = spdMs * elapsedSec;
  const totalDist = travel.totalDistMeters || distanceMeters(travel.startPos, travel.target);

  const progress = Math.min(1.0, distTraveledMeters / Math.max(1, totalDist));
  const newLat = travel.startPos.lat + (travel.target.lat - travel.startPos.lat) * progress;
  const newLon = travel.startPos.lon + (travel.target.lon - travel.startPos.lon) * progress;

  virtualPlayerPos = { lat: newLat, lon: newLon };
  app.profile.player.lastPosition = { ...virtualPlayerPos };

  // Quy đổi quãng đường thành bước chân
  const stepsGained = Math.round(distTraveledMeters / 0.75);
  if (stepsGained > 0) {
    app.profile.player.steps.totalSteps += stepsGained;
    app.profile.player.lifetime.steps += stepsGained;
    pedometer.addGpsDistanceWalked(distTraveledMeters);
  }

  if (progress >= 1.0) {
    const destName = travel.target.nameVi || 'Điểm đến';
    app.profile.player.autoTravel = null;
    toast(`🎉 Trong lúc vắng mặt, bạn đã đến đích an toàn tại ${destName}! (+${stepsGained.toLocaleString()} bước chân)`, 'good');
  } else {
    const kmStr = (distTraveledMeters / 1000).toFixed(1);
    toast(`🚶 Trong lúc vắng mặt, nhân vật đã tự đi được ${kmStr} km (+${stepsGained.toLocaleString()} bước)! Đang tiếp tục hành trình.`, 'good');
  }
  persist();
  updateAutoTravelHud();
}

/** Cập nhật Banner Hiển Thị Tiến Độ Tự Hành Trình Trên HUD */
export function updateAutoTravelHud(): void {
  const banner = document.getElementById('auto-travel-hud-banner');
  if (!banner) return;

  if (!app.profile || !app.profile.player.autoTravel) {
    banner.hidden = true;
    return;
  }

  const travel = app.profile.player.autoTravel;
  banner.hidden = false;

  const targetNameEl = document.getElementById('auto-travel-target-name');
  if (targetNameEl) targetNameEl.textContent = travel.target.nameVi || 'Điểm Chỉ Định';

  const distRemaining = distanceMeters(virtualPlayerPos, travel.target);
  const totalDist = Math.max(1, travel.totalDistMeters || distanceMeters(travel.startPos, travel.target));
  const progressRatio = Math.max(0, Math.min(1, 1 - distRemaining / totalDist));

  const fillEl = document.getElementById('auto-travel-progress-fill');
  if (fillEl) fillEl.style.width = `${Math.round(progressRatio * 100)}%`;

  const statusTextEl = document.getElementById('auto-travel-status-text');
  if (statusTextEl) {
    const kmRem = (distRemaining / 1000).toFixed(1);
    const speedKmh = travel.speedKmh || 8.0;
    const minsRem = Math.round((distRemaining / (speedKmh * 1000 / 60)));
    statusTextEl.textContent = `Còn ${kmRem} km (${minsRem} phút) · ${Math.round(progressRatio * 100)}%`;
  }
}

/** Mở Modal Bản Đồ Toàn Cảnh Hà Nội */
export function openHanoiMinimapModal(): void {
  const overlay = el('overlay-hanoi-minimap');
  overlay.hidden = false;
  updateControlsVisibility();

  // Khởi tạo danh sách địa danh bên sidebar
  renderHanoiLandmarkList();

  // Vẽ bản đồ vector Hà Nội trên Canvas
  drawHanoiVectorMap();
}

function renderHanoiLandmarkList(): void {
  const listEl = document.getElementById('hanoi-landmarks-list');
  if (!listEl) return;
  listEl.replaceChildren();

  for (const lm of HANOI_LANDMARKS) {
    const dist = distanceMeters(virtualPlayerPos, { lat: lm.lat, lon: lm.lon });
    const distStr = dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`;

    const item = document.createElement('div');
    item.className = `hanoi-landmark-item ${selectedHanoiDest?.id === lm.id ? 'is-selected' : ''}`;
    item.innerHTML = `
      <span class="landmark-item-icon">${lm.icon}</span>
      <div class="landmark-item-name">${lm.nameVi} <small style="color:#94a3b8;font-size:10px;">(${lm.district})</small></div>
      <span class="landmark-item-dist">${distStr}</span>
    `;

    item.onclick = () => {
      selectHanoiDestination(lm);
    };

    listEl.append(item);
  }
}

function selectHanoiDestination(dest: HanoiLandmark | { lat: number; lon: number; nameVi: string; icon: string; district: string; id?: string }): void {
  selectedHanoiDest = dest;
  audio.play('click');

  const nameEl = document.getElementById('hanoi-dest-name');
  const iconEl = document.getElementById('hanoi-dest-icon');
  const distEl = document.getElementById('hanoi-dest-dist');
  const etaEl = document.getElementById('hanoi-dest-eta');
  const stepsEl = document.getElementById('hanoi-dest-steps');
  const btnStart = document.getElementById('btn-start-auto-travel') as HTMLButtonElement | null;

  const distM = distanceMeters(virtualPlayerPos, { lat: dest.lat, lon: dest.lon });
  const distKm = distM / 1000;
  const speedKmh = app.profile ? calcMovementSpeedKmh(app.profile.player) * 1.5 : 8.0;
  const hours = distKm / speedKmh;
  const mins = Math.round(hours * 60);
  const steps = Math.round(distM / 0.75);

  if (nameEl) nameEl.textContent = `${dest.nameVi} (${dest.district})`;
  if (iconEl) iconEl.textContent = dest.icon || '📍';
  if (distEl) distEl.textContent = distKm >= 1 ? `${distKm.toFixed(2)} km` : `${Math.round(distM)} m`;
  if (etaEl) etaEl.textContent = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} phút`;
  if (stepsEl) stepsEl.textContent = `~${steps.toLocaleString()} bước`;

  if (btnStart) {
    btnStart.disabled = false;
    btnStart.onclick = () => {
      startAutoTravelToSelected();
    };
  }

  // Cập nhật lại UI bản đồ & danh sách
  renderHanoiLandmarkList();
  drawHanoiVectorMap();
}

function startAutoTravelToSelected(): void {
  if (!app.profile || !selectedHanoiDest) return;
  const dest = selectedHanoiDest;
  const distM = distanceMeters(virtualPlayerPos, { lat: dest.lat, lon: dest.lon });
  const speedKmh = calcMovementSpeedKmh(app.profile.player) * 1.5;

  app.profile.player.autoTravel = {
    target: { lat: dest.lat, lon: dest.lon, nameVi: dest.nameVi },
    startPos: { ...virtualPlayerPos },
    startTimeMs: Date.now(),
    speedKmh,
    totalDistMeters: distM,
  };

  persist();
  audio.play('quest_accept');
  toast(`🚀 Đã kích hoạt Tự Hành Trình đến ${dest.nameVi}! Nhân vật sẽ tự di chuyển liên tục kể cả khi bạn tắt game.`, 'good');

  el('overlay-hanoi-minimap').hidden = true;
  updateControlsVisibility();
  updateAutoTravelHud();
}

/** Vẽ bản đồ toàn cảnh Hà Nội trên Canvas */
function drawHanoiVectorMap(): void {
  const canvas = document.getElementById('hanoi-minimap-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  // Bounding box tỉnh Hà Nội: Lat 20.55 .. 21.38, Lon 105.30 .. 106.05
  const MIN_LAT = 20.55;
  const MAX_LAT = 21.38;
  const MIN_LON = 105.30;
  const MAX_LON = 106.05;

  const mapX = (lon: number) => ((lon - MIN_LON) / (MAX_LON - MIN_LON)) * (w - 40) + 20;
  const mapY = (lat: number) => (1 - (lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * (h - 40) + 20;

  // Nền bản đồ xanh rừng hoang dã
  ctx.fillStyle = '#0b1910';
  ctx.fillRect(0, 0, w, h);

  // Lưới toạ độ mờ
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  // Vẽ Dòng Sông Hồng uốn lượn qua Hà Nội
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const riverPoints: [number, number][] = [
    [21.35, 105.35],
    [21.28, 105.48],
    [21.18, 105.65],
    [21.12, 105.78],
    [21.05, 105.85],
    [20.95, 105.92],
    [20.85, 105.98],
    [20.70, 106.02],
  ];
  riverPoints.forEach(([lat, lon], i) => {
    const px = mapX(lon);
    const py = mapY(lat);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  // Hồ Tây
  ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
  ctx.beginPath();
  ctx.ellipse(mapX(105.8239), mapY(21.0583), 14, 11, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Núi Ba Vì (Vùng cao phía Tây)
  ctx.fillStyle = 'rgba(34, 197, 94, 0.25)';
  ctx.beginPath();
  ctx.arc(mapX(105.3628), mapY(21.0772), 28, 0, Math.PI * 2);
  ctx.fill();

  // Vẽ lộ trình kết nối nếu đang chọn điểm đến
  if (selectedHanoiDest) {
    const px = mapX(virtualPlayerPos.lon);
    const py = mapY(virtualPlayerPos.lat);
    const tx = mapX(selectedHanoiDest.lon);
    const ty = mapY(selectedHanoiDest.lat);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Vẽ các địa danh nổi tiếng
  for (const lm of HANOI_LANDMARKS) {
    const lx = mapX(lm.lon);
    const ly = mapY(lm.lat);
    const isSel = selectedHanoiDest?.id === lm.id;

    ctx.fillStyle = isSel ? '#fef08a' : 'rgba(254, 240, 138, 0.75)';
    ctx.beginPath();
    ctx.arc(lx, ly, isSel ? 7 : 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = isSel ? 'bold 11px system-ui' : '10px system-ui';
    ctx.fillStyle = isSel ? '#fef08a' : '#cbd5e1';
    ctx.textAlign = 'center';
    ctx.fillText(lm.nameVi.split('&')[0].trim(), lx, ly - 8);
  }

  // Điểm Doanh Trại
  const campPos = getHomeCampCenter();
  if (campPos) {
    const cx = mapX(campPos.lon);
    const cy = mapY(campPos.lat);
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 11px system-ui';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('⛺ Trại', cx, cy + 14);
  }

  // Điểm Người Chơi
  const px = mapX(virtualPlayerPos.lon);
  const py = mapY(virtualPlayerPos.lat);
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(px, py, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = 'bold 11px system-ui';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('📍 Bạn', px, py + 14);
}


function wireStaticControls(): void {
  // Đăng ký compass lần đầu và bật active ngay (app khởi động ở tab map)
  resumeCompass();

  // Bắt sự kiện tương tác để điều chỉnh nhịp FPS thích ứng (10 FPS idle / 18 FPS tương tác)
  window.addEventListener('pointerdown', bumpInteraction, { passive: true });
  window.addEventListener('pointermove', bumpInteraction, { passive: true });
  window.addEventListener('touchstart', bumpInteraction, { passive: true });

  // Tự động phát âm thanh click tương tác giòn giã cho mọi nút bấm và thành phần UI
  document.addEventListener(
    'click',
    (e) => {
      const target = e.target as HTMLElement;
      const clickable = target.closest(
        'button, .btn, .chip, .tabbar__btn, .drawer-close, .map-ctrl-btn, .slot, .gender-card, .merchant-tab-btn, .ar-model-btn, .slot__del, .btn-coop-action, .home-prompt-box',
      );
      if (clickable) {
        audio.play('click');
      }
    },
    { capture: true },
  );

  for (const button of document.querySelectorAll<HTMLButtonElement>('.tabbar__btn')) {
    button.onclick = () => {
      const target = button.dataset.tab ?? 'map';
      switchTab(target);
    };
  }

  // Nút mở Drawer Hành Động tròn ở góc dưới bên phải
  el('btn-open-actions').onclick = () => {
    switchTab('actions');
  };

  // Nút đóng trên từng Drawer
  for (const closeBtn of document.querySelectorAll<HTMLButtonElement>('.drawer-close')) {
    closeBtn.onclick = () => switchTab('map');
  }

  // Bấm vào vùng backdrop ngoài Drawer để đóng về Bản đồ
  el('drawer-backdrop').onclick = () => switchTab('map');

  // Nút mở Bản Đồ Toàn Cảnh Hà Nội
  const btnOpenHanoiMap = document.getElementById('btn-open-hanoi-map');
  if (btnOpenHanoiMap) {
    btnOpenHanoiMap.onclick = (e) => {
      e.stopPropagation();
      openHanoiMinimapModal();
      audio.play('click');
    };
  }

  const btnHanoiMapClose = document.getElementById('btn-hanoi-map-close');
  if (btnHanoiMapClose) {
    btnHanoiMapClose.onclick = () => {
      el('overlay-hanoi-minimap').hidden = true;
      updateControlsVisibility();
      audio.play('click');
    };
  }

  // Nút huỷ Tự Hành Trình trên HUD
  const btnCancelAutoTravel = document.getElementById('btn-cancel-auto-travel');
  if (btnCancelAutoTravel) {
    btnCancelAutoTravel.onclick = () => {
      if (app.profile) {
        app.profile.player.autoTravel = null;
        persist();
        updateAutoTravelHud();
        toast('🛑 Đã dừng Tự Hành Trình.', 'good');
      }
    };
  }

  // Bắt sự kiện click trên Canvas Bản đồ Hà Nội để chọn điểm bất kỳ
  const hanoiCanvas = document.getElementById('hanoi-minimap-canvas') as HTMLCanvasElement | null;
  if (hanoiCanvas) {
    hanoiCanvas.onclick = (e) => {
      const rect = hanoiCanvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const w = hanoiCanvas.width;
      const h = hanoiCanvas.height;

      const MIN_LAT = 20.55;
      const MAX_LAT = 21.38;
      const MIN_LON = 105.30;
      const MAX_LON = 106.05;

      const clickedLon = MIN_LON + ((clickX - 20) / (w - 40)) * (MAX_LON - MIN_LON);
      const clickedLat = MAX_LAT - ((clickY - 20) / (h - 40)) * (MAX_LAT - MIN_LAT);

      selectHanoiDestination({
        id: `custom_${Date.now()}`,
        nameVi: 'Điểm Chấm Chọn',
        district: 'Hà Nội',
        lat: clickedLat,
        lon: clickedLon,
        icon: '📍',
      });
    };
  }

  // Cụm điều khiển Bản đồ: Về ban đầu (🎯)
  const btnPocket = document.getElementById('btn-pocket-mode');
  if (btnPocket) {
    btnPocket.onclick = () => togglePocketMode(true);
  }

  el('overlay-pocket-mode').onclick = () => {
    togglePocketMode(false);
  };

  el('btn-recenter').onclick = (e) => {
    e.stopPropagation();
    mapView?.recenterAndResetZoom();
    audio.play('click');
  };

  // Cụm Menu Thu Gọn Bên Phải Màn Hình (Right Floating Menu)
  const btnToggleDock = document.getElementById('btn-toggle-dock');
  const btnCloseDock = document.getElementById('btn-close-dock');
  const dockContainer = document.getElementById('dock-container');

  const setDockCollapsed = (collapsed: boolean) => {
    if (!dockContainer) return;
    dockContainer.classList.toggle('is-collapsed', collapsed);
  };

  if (btnToggleDock) {
    btnToggleDock.onclick = (e) => {
      e.stopPropagation();
      setDockCollapsed(false);
      audio.play('click');
    };
  }

  if (btnCloseDock) {
    btnCloseDock.onclick = (e) => {
      e.stopPropagation();
      setDockCollapsed(true);
      audio.play('click');
    };
  }

  // Tự động thu gọn Menu về nút tròn bên phải khi bấm ra ngoài
  document.addEventListener('click', (e) => {
    if (dockContainer && !dockContainer.contains(e.target as Node)) {
      setDockCollapsed(true);
    }
  });

  // Khởi tạo Cần Gạt Ảo, Cụm Nút Chiến Đấu & Bàn phím
  setupVirtualJoystick();
  setupCombatPad();

  el('btn-back-profiles').onclick = handlers.onSwitchProfile;

  // Chuông thông báo
  el('btn-notifications').onclick = (e) => {
    e.stopPropagation();
    const pop = el('popover-notifications');
    pop.hidden = !pop.hidden;
    audio.play('click');
  };

  el('btn-close-notifs').onclick = (e) => {
    e.stopPropagation();
    el('popover-notifications').hidden = true;
    audio.play('click');
  };

  // Đóng popover thông báo khi chạm bên ngoài
  document.addEventListener('click', (e) => {
    const pop = document.getElementById('popover-notifications');
    const btn = document.getElementById('btn-notifications');
    if (pop && !pop.hidden && !pop.contains(e.target as Node) && btn && !btn.contains(e.target as Node)) {
      pop.hidden = true;
    }
  });

  function getHeroTitle(strengthLevel = 1, gender: Gender = 'male'): string {
    const isF = gender === 'female';
    if (strengthLevel >= 10) return isF ? '👑 Hậu Duệ Tiên Dung Thần Thoại' : '👑 Hậu Duệ Lạc Long Thần Thoại';
    if (strengthLevel >= 9) return isF ? '🔥 Nữ Bá Chủ Hồng Hoang' : '🔥 Bá Chủ Thời Tiền Sử';
    if (strengthLevel >= 8) return isF ? '⚡ Nữ Chiến Thần Đại Ngàn' : '⚡ Chiến Thần Hồng Hoang';
    if (strengthLevel >= 7) return isF ? '🗡️ Nữ Tướng Lạc Việt' : '🗡️ Lạc Tướng Quật Cường';
    if (strengthLevel >= 5) return isF ? '🛡️ Nữ Hộ Vệ Đông Sơn' : '🛡️ Dũng Sĩ Hùng Vương';
    if (strengthLevel >= 3) return isF ? '🏹 Nữ Thợ Săn Thảo Nguyên' : '🪓 Thợ Săn Dày Dạn';
    return isF ? '🌿 Thiếu Nữ Bộ Tộc Sơ Khai' : '🌿 Dũng Sĩ Bộ Tộc Sơ Khai';
  }

  // Mở Hồ Sơ Nhân Vật & Thể Lực Tiền Sử
  const openHeroProfile = () => {
    if (!app.profile) return;
    const overlay = el('overlay-hero-profile');
    if (!overlay) return;

    const player = app.profile.player;
    const strLvl = player.strengthLevel ?? 1;
    const spdLvl = player.speedLevel ?? 1;
    const isFemale = app.profile.gender === 'female';
    const nameEl = el('hero-profile-name');
    const titleEl = el('hero-profile-title');
    const bigAvatar = el('hero-profile-big-avatar');
    const strLevelEl = el('hero-profile-str-level');
    const capEl = el('hero-profile-capacity');
    const btnUpgrade = el<HTMLButtonElement>('btn-hero-upgrade-strength');
    const artisanEl = el('hero-profile-artisan');
    const vaultEl = el('hero-profile-vault');
    const petEl = el('hero-profile-pet');
    const stepsEl = el('hero-profile-steps');

    nameEl.textContent = player.displayName || (isFemale ? 'Nữ Thợ Săn' : 'Dũng Sĩ Tiền Sử');
    titleEl.textContent = getHeroTitle(strLvl, app.profile.gender);
    bigAvatar.textContent = isFemale ? '🏹' : '🪓';

    const tier = strLvl >= 9 ? 5 : strLvl >= 7 ? 4 : strLvl >= 5 ? 3 : strLvl >= 3 ? 2 : 1;
    bigAvatar.className = `hero-avatar-frame hero-avatar-frame--tier-${tier}`;

    // 1. Thể Lực
    const maxW = maxWeightCapacity(player.pets, player.carried, strLvl);
    strLevelEl.textContent = `💪 Thể Lực Cấp ${strLvl} / ${MAX_STRENGTH_LEVEL}`;
    capEl.innerHTML = `Sức chứa ba lô: <strong>${maxW}kg</strong> (Cơ bản ${45 + (strLvl - 1) * 5}kg)`;

    const info = getStrengthUpgradeInfo(strLvl);
    if (info.isMax) {
      btnUpgrade.textContent = 'Đạt Max Cấp 10';
      btnUpgrade.disabled = true;
    } else {
      btnUpgrade.innerHTML = `Nâng Cấp ${strLvl + 1} (💰 ${info.cost} Vàng)`;
      btnUpgrade.disabled = false;
      btnUpgrade.onclick = () => {
        handlers.onUpgradeStrength?.();
        openHeroProfile();
      };
    }

    // 2. Thân Pháp & Tốc Độ Di Chuyển
    const spdLevelEl = document.getElementById('hero-profile-speed-level');
    const spdValEl = document.getElementById('hero-profile-speed-val');
    const spdStatEl = document.getElementById('hero-profile-speed-stat');
    const btnUpgradeSpeed = document.getElementById('btn-hero-upgrade-speed') as HTMLButtonElement | null;
    const currentSpeedKmh = calcMovementSpeedKmh(player);

    if (spdLevelEl) spdLevelEl.textContent = `⚡ Thân Pháp Cấp ${spdLvl} / ${MAX_SPEED_LEVEL}`;
    if (spdValEl) spdValEl.innerHTML = `Vận tốc di chuyển: <strong>${currentSpeedKmh} km/h</strong>`;
    if (spdStatEl) spdStatEl.textContent = `${currentSpeedKmh} km/h`;

    if (btnUpgradeSpeed) {
      const spdInfo = getSpeedUpgradeInfo(spdLvl);
      if (spdInfo.isMax) {
        btnUpgradeSpeed.textContent = 'Đạt Max Cấp 10';
        btnUpgradeSpeed.disabled = true;
      } else {
        btnUpgradeSpeed.innerHTML = `Nâng Cấp ${spdLvl + 1} (💰 ${spdInfo.costCoin} Vàng)`;
        btnUpgradeSpeed.disabled = false;
        btnUpgradeSpeed.onclick = () => {
          handlers.onUpgradeSpeed?.();
          openHeroProfile();
        };
      }
    }

    const artisanRank = getArtisanRank(player.artisanLevel ?? 1);
    artisanEl.textContent = `${artisanRank.titleVi} (Cấp ${player.artisanLevel ?? 1}/4)`;

    const vaultLvl = player.safeVaultLevel ?? 1;
    const vaultCap = getSafeCapacity(player.camp.level, vaultLvl);
    vaultEl.textContent = `Cấp ${vaultLvl}/6 (${vaultCap} ô)`;

    const activePet = player.pets?.find((p: any) => p.isActive);
    petEl.textContent = activePet ? `🐾 ${activePet.nameVi || activePet.petId} (Cấp ${activePet.level})` : 'Chưa xuất chiến';

    stepsEl.textContent = `${player.lifetime.steps.toLocaleString('vi-VN')} bước (${player.lifetime.daysPlayed} ngày)`;

    overlay.hidden = false;
    audio.play('click');
  };

  const hudBars = document.getElementById('hud-survival-bars');
  if (hudBars) hudBars.onclick = openHeroProfile;

  const btnCloseHeroProfile = document.getElementById('btn-hero-profile-close');
  if (btnCloseHeroProfile) {
    btnCloseHeroProfile.onclick = () => {
      el('overlay-hero-profile').hidden = true;
      audio.play('click');
    };
  }

  // Mở Cẩm Nang Sinh Tồn từ nút trong Nhật Ký
  const openSurvivalGuide = () => {
    const overlay = el('overlay-survival-guide');
    if (overlay) overlay.hidden = false;
    audio.play('click');
  };

  const closeSurvivalGuide = () => {
    const overlay = el('overlay-survival-guide');
    if (overlay) overlay.hidden = true;
    audio.play('click');
  };

  const btnOpenGuide = document.getElementById('btn-open-survival-guide');
  if (btnOpenGuide) btnOpenGuide.onclick = openSurvivalGuide;

  const btnCloseGuide = document.getElementById('btn-survival-guide-close');
  if (btnCloseGuide) btnCloseGuide.onclick = closeSurvivalGuide;

  const btnOkGuide = document.getElementById('btn-survival-guide-ok');
  if (btnOkGuide) btnOkGuide.onclick = closeSurvivalGuide;

  el('narration-next').onclick = () => {
    // Nếu chữ đang chạy hiệu ứng gõ máy: Bấm 1 cái hiển thị trọn vẹn toàn bộ câu ngay lập tức
    if (typeWriterInterval && currentActiveBeatText) {
      clearInterval(typeWriterInterval);
      typeWriterInterval = null;
      el('narration-text').textContent = currentActiveBeatText;
      return;
    }
    speech.stop();
    el('overlay-narration').hidden = true;
    app.narrationOpen = false;
    currentActiveBeatText = null;
    if (app.narrationQueue.length > 0) showNextBeat();
    else render();
  };

  el('hud-bloodmoon').onclick = (event) => {
    if ((event.target as HTMLElement).dataset.action === 'bloodmoon') handlers.onBloodMoon();
  };

  el('btn-unlock').onclick = () => {
    if (!app.profile) return;
    app.profile = unlockGame(app.profile).profile;
    el('overlay-demo').hidden = true;
    toast('Đã mở khoá trọn đời. Tiến trình 3 ngày demo giữ nguyên.', 'good');
    afterAction();
  };

  el<HTMLInputElement>('filter-craftable').onchange = (event) => {
    app.onlyCraftable = (event.target as HTMLInputElement).checked;
    render();
  };

  el('btn-import').onclick = () => el<HTMLInputElement>('file-import').click();
  el<HTMLInputElement>('file-import').onchange = async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const result = importBackup(await readTextFile(file));
    toast(result.messageVi, result.ok ? 'good' : 'bad');
    if (result.ok && result.save) {
      app.save = result.save;
      writeSave(app.save, now());
      app.profile = null;
      renderProfileScreen();
    }
  };

  wireGpsOverlay();
  wirePedometerPanel();
}

function wireGpsOverlay(): void {
  const btnGrant = document.getElementById('btn-gps-grant-permission');
  if (btnGrant) {
    btnGrant.onclick = () => {
      (globalThis as any).AndroidBridge?.requestLocationPermission?.();
      (globalThis as any).AndroidBridge?.openLocationSettings?.();
      geo?.start();
      setTimeout(() => {
        checkGpsRequirement();
        sync();
      }, 1000);
    };
  }

  const btnRetry = document.getElementById('btn-gps-retry');
  if (btnRetry) {
    btnRetry.onclick = () => {
      geo?.start();
      checkGpsRequirement();
      sync();
      toast('🔄 Đang dò lại sóng vệ tinh GPS...');
    };
  }
}

function checkGpsRequirement(): void {
  const overlay = document.getElementById('overlay-gps-required');
  if (overlay) overlay.hidden = true; // Luôn mở khóa game mượt mà, không chặn người chơi

  // Tắt và xoá hoàn toàn bảng Dev Widget trên Native Mobile App
  if (isNativeApk()) {
    const pedoPanel = document.getElementById('pedometer-panel');
    if (pedoPanel) {
      pedoPanel.style.display = 'none';
      pedoPanel.remove();
    }
  }
}

function wirePedometerPanel(): void {
  const panel = el('pedometer-panel');
  if (!panel) return;

  if (isNativeApk()) {
    panel.style.display = 'none';
    panel.remove();
    return;
  }

  const body = el('pedo-body');

  el('pedo-toggle').onclick = () => {
    body.hidden = !body.hidden;
    panel.classList.toggle('is-open', !body.hidden);
    el('pedo-toggle').textContent = body.hidden ? 'Mở' : 'Thu gọn';
  };

  el('btn-walk-100').onclick = () => {
    pedometer.addSteps(100);
    sync();
  };

  el('btn-walk-1000').onclick = () => {
    pedometer.addSteps(1000);
    sync();
  };

  el('btn-auto').onclick = () => {
    const on = pedometer.toggleAuto();
    el('btn-auto').classList.toggle('is-on', on);
    toast(on ? 'Đang tự đi bộ ~110 bước/phút.' : 'Đã dừng tự đi bộ.');
  };

  el('btn-sensor').onclick = async () => {
    const result = await pedometer.startSensor();
    el('btn-sensor').classList.toggle('is-on', result.ok);
    el('btn-auto').classList.remove('is-on');
    toast(result.messageVi, result.ok ? 'good' : 'bad');
    render();
  };

  el('btn-hour').onclick = () => {
    if (!app.profile) return;
    const currentMs = Math.max(now(), app.profile.clock.maxSeenMs);
    const targetMs = currentMs + 3_600_000;
    app.timeOffsetMs = targetMs - Date.now();
    app.profile.clock.maxSeenMs = targetMs;
    const local = toLocalTime(targetMs);
    toast(`⏰ Đã tua +1 giờ tới ${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`);
    sync();
  };

  el('btn-morning').onclick = () => jumpToTargetHour(7);

  el('btn-tonight').onclick = () => jumpToTargetHour(20);

  el('btn-saturday').onclick = () => {
    if (!app.profile) return;
    const currentMs = Math.max(now(), app.profile.clock.maxSeenMs);
    const status = bloodMoonStatus(currentMs, false);
    const targetMs = currentMs + Math.max(60_000, status.msUntil + 60_000);
    app.timeOffsetMs = targetMs - Date.now();
    app.profile.clock.maxSeenMs = targetMs;
    toast(`🔴 Đã chuyển tới Trăng Máu! (${toLocalTime(targetMs).day})`, 'warn');
    sync();
  };

  // --- Dịch chuyển đến NPC gần nhất (Dev Demo) ---
  const teleportToPoi = (filter?: (poi: any) => boolean) => {
    const allPois = PACK?.pois ?? [];
    const { render: current } = currentPosition();
    
    let candidates = allPois;
    if (filter) {
      candidates = allPois.filter(filter);
    }
    if (candidates.length === 0) candidates = allPois;

    candidates.sort((a, b) => {
      const da = distanceMeters(current, { lat: a.lat, lon: a.lon });
      const db = distanceMeters(current, { lat: b.lat, lon: b.lon });
      return da - db;
    });

    const target = candidates[0];
    if (!target) {
      toast('Không tìm thấy NPC phù hợp gần đây.', 'bad');
      return;
    }

    devMockPosition = {
      lat: target.lat + 0.00008,
      lon: target.lon + 0.00008,
    };
    smoothRenderPos = { ...devMockPosition };
    toast(`📍 [Dev] Đã dịch chuyển đến sát "${target.nameVi}" (${target.categoryVi})!`, 'good');
    sync();
    render();
  };

  const teleportToCamp = () => {
    const campCenter = getHomeCampCenter();
    if (!campCenter) {
      toast('Chưa có doanh trại nào được thiết lập. Hãy đặt trại trước!', 'bad');
      return;
    }
    devMockPosition = {
      lat: campCenter.lat,
      lon: campCenter.lon,
    };
    smoothRenderPos = { ...devMockPosition };
    toast('🏕️ [Dev] Đã dịch chuyển về Doanh Trại thành công!', 'good');
    sync();
    render();
  };

  const btnCamp = document.getElementById('btn-tp-camp');
  if (btnCamp) btnCamp.onclick = () => teleportToCamp();

  const btnNear = document.getElementById('btn-tp-nearest-npc');
  if (btnNear) btnNear.onclick = () => teleportToPoi();

  const btnCafe = document.getElementById('btn-tp-cafe');
  if (btnCafe) btnCafe.onclick = () => teleportToPoi((p) => p.category === 'cafe' || p.categoryVi?.includes('Cà phê') || p.nameVi?.includes('Cà phê'));

  const btnTea = document.getElementById('btn-tp-teahouse');
  if (btnTea) btnTea.onclick = () => teleportToPoi((p) => p.category === 'teahouse' || p.categoryVi?.includes('Trà') || p.nameVi?.includes('Trà'));

  const btnMarket = document.getElementById('btn-tp-market');
  if (btnMarket) btnMarket.onclick = () => teleportToPoi((p) => p.category === 'market' || p.categoryVi?.includes('Chợ') || p.categoryVi?.includes('Đồ cổ') || p.nameVi?.includes('Cổ'));

  const btnRest = document.getElementById('btn-tp-restaurant');
  if (btnRest) btnRest.onclick = () => teleportToPoi((p) => p.category === 'restaurant' || p.categoryVi?.includes('Ăn') || p.nameVi?.includes('Quán'));

  const btnTayHo = document.getElementById('btn-tp-tayho');
  if (btnTayHo) btnTayHo.onclick = () => teleportToPoi((p) => p.nameVi?.includes('Tây Hồ') || p.nameVi?.includes('Trấn Quốc') || p.nameVi?.includes('Trúc Bạch'));

  const btnHoGuom = document.getElementById('btn-tp-hoguom');
  if (btnHoGuom) btnHoGuom.onclick = () => teleportToPoi((p) => p.nameVi?.includes('Hồ Gươm') || p.nameVi?.includes('Tháp Rùa') || p.nameVi?.includes('Ngọc Sơn') || p.nameVi?.includes('Hàng Bông'));

  const btnBatTrang = document.getElementById('btn-tp-battrang');
  if (btnBatTrang) btnBatTrang.onclick = () => teleportToPoi((p) => p.nameVi?.includes('Bát Tràng') || p.nameVi?.includes('Vạn Phúc') || p.nameVi?.includes('Đa Sỹ') || p.nameVi?.includes('Gốm'));

  const btnBaVi = document.getElementById('btn-tp-bavi');
  if (btnBaVi) btnBaVi.onclick = () => teleportToPoi((p) => p.nameVi?.includes('Ba Vì') || p.nameVi?.includes('Suối Hai') || p.nameVi?.includes('Sóc Sơn'));
}

/** Nhảy chính xác tới đúng giờ đích (ví dụ 7h00 sáng hoặc 20h00 tối). */
function jumpToTargetHour(targetHour: number): void {
  if (!app.profile) return;
  const currentMs = Math.max(now(), app.profile.clock.maxSeenMs);
  const local = toLocalTime(currentMs);

  // Tính số ms đã trôi qua từ đầu ngày địa phương hiện tại
  const msSinceMidnight = (local.hour * 3600 + local.minute * 60) * 1000 + (currentMs % 60_000);
  const targetMsFromMidnight = targetHour * 3600_000;

  let deltaMs = targetMsFromMidnight - msSinceMidnight;
  if (deltaMs <= 0) {
    deltaMs += 86_400_000; // Nhảy sang ngày hôm sau
  }

  const targetAbsoluteMs = currentMs + deltaMs;
  app.timeOffsetMs = targetAbsoluteMs - Date.now();
  app.profile.clock.maxSeenMs = targetAbsoluteMs;

  const targetLocal = toLocalTime(targetAbsoluteMs);
  const isMorning = targetHour < 12;
  toast(
    `${isMorning ? '☀️' : '🌙'} Đã chuyển tới ${String(targetLocal.hour).padStart(2, '0')}:00 (${targetLocal.day})`,
    'good',
  );
  sync();
}

/** Chỉ tua TỚI trước — tua lùi sẽ kích hoạt bộ chống lùi đồng hồ và làm đứng thời gian game. */
function jumpTime(deltaMs: number): void {
  if (!app.profile) return;
  const currentMs = Math.max(now(), app.profile.clock.maxSeenMs);
  const targetMs = currentMs + Math.max(0, deltaMs);
  app.timeOffsetMs = targetMs - Date.now();
  app.profile.clock.maxSeenMs = targetMs;
  const local = toLocalTime(targetMs);
  toast(`Đã tua tới ${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')} (${local.day}).`);
  sync();
}

async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  // Trong môi trường dev local: gỡ service worker và xoá CacheStorage để code mới luôn được tải trực tiếp từ đĩa
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const r of registrations) {
        await r.unregister();
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const k of keys) {
          await caches.delete(k);
        }
      }
    } catch {
      // bỏ qua nếu browser chặn
    }
    return;
  }
  // Đăng ký service worker chính là thứ làm game chạy được khi ngắt hoàn toàn Internet (Production)
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
    /* chạy qua file:// hoặc trình duyệt chặn — game vẫn chơi được, chỉ là không cache offline */
  });
}

/**
 * Cửa sổ gỡ lỗi duy nhất của một game không có server: mở DevTools và gõ `__khc`.
 * Cũng là cách bộ smoke test tự động điều khiển app mà không cần thư viện ngoài.
 */
Object.assign(globalThis as Record<string, unknown>, {
  __khc: {
    app,
    handlers,
    sync,
    now,
    pedometer,
    enterProfile,
    jumpTime,
    audio,
    addSteps(count: number) {
      if (!app.profile) return;
      app.stepAccumulator += count;
      sync();
      render();
    },
    jumpToChapter(targetChapterIndex: number) {
      if (!app.profile) return;
      app.profile.story.chapterIndex = Math.max(1, Math.min(8, targetChapterIndex));
      app.profile.story.tutorialDay = 0;
      app.profile.story.chapterStartSteps = app.profile.player.lifetime.steps;
      if (targetChapterIndex >= 8) {
        app.profile.story.endlessUnlocked = true;
      }
      persist();
      sync();
      render();
      toast(`📖 Đã chuyển tới Chương ${app.profile.story.chapterIndex}!`, 'good');
    },
    giveItem(itemId: string, qty = 1) {
      if (!app.profile) return;
      app.profile.player.carried[itemId] = (app.profile.player.carried[itemId] ?? 0) + qty;
      persist();
      sync();
      render();
      toast(`🎁 Đã thêm ${qty}x ${itemId} vào túi!`, 'good');
    },
    giveEgg(eggId = 'egg_forest') {
      if (!app.profile) return;
      app.profile.player.carried[eggId] = (app.profile.player.carried[eggId] ?? 0) + 1;
      persist();
      sync();
      render();
      toast(`🥚 Đã nhận được ${eggId}!`, 'good');
    },
    createProfileInSlot(slot: number, name: string, gender: Gender = 'male') {
      app.save = putProfile(app.save, slot, createProfile(name, now(), gender));
      persist();
      renderProfileScreen();
    },
    deleteProfile(slot: number) {
      app.save = putProfile(app.save, slot, null);
      if (app.save.activeSlot === slot) app.profile = null;
      persist();
      renderProfileScreen();
    },
  },
});

/**
 * Không có server nghĩa là không có log nào gửi về được. Nếu khởi động hỏng, cách duy nhất
 * để người chơi (và người sửa lỗi) biết chuyện gì xảy ra là hiện thẳng nó ra màn hình.
 */
try {
  boot();
} catch (error) {
  const box = document.getElementById('fatal');
  if (box) {
    box.hidden = false;
    box.textContent = `Không khởi động được:\n${(error as Error).message}\n\n${(error as Error).stack ?? ''}`;
  }
  throw error;
}
