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
  assertBalanceValid,
  beginBloodMoon,
  bloodMoonStatus,
  buildView,
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
  profileDayNumber,
  putProfile,
  runNightDefense,
  sampleHanoiPack,
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
} from '../../../packages/game-core/src/index.js';
             
               
           
         
         
              
           
            
           
                                                  

import { MapView, featureAtPoint } from './mapView.js';
                                              
import { startARCamera, stopARCamera, setARModel, captureARPhoto } from './arCamera.js';
import { Pedometer, describeSource } from './pedometer.js';
import { avatarSvg } from './itemIcons.js';
import {
  GeoWatcher,
  downloadText,
  readSave,
  readTextFile,
  simulatedWalk,
  wipeSave,
  writeSave,
  buzz,
} from './platform.js';
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
} from './panels.js';
                                            
import { openBloodMoon, openNightDefense } from './fights.js';
import { openMinigame } from './minigames.js';
import { audio } from './audio.js';
import { speech } from './speech.js';

// Toạ độ dự phòng khi chưa có tín hiệu GPS — Hồ Gươm, để gói POI mẫu có tác dụng.
const FALLBACK_POSITION         = { lat: 21.0287, lon: 105.8524 };
const PACK = sampleHanoiPack();

/** Danh mục toàn bộ các di tích, thắng cảnh, hồ nước và địa danh thực tế đã được tiền sử hoá. */
const ALL_PACK_FEATURES               = PACK.pois.map((poi) => ({
  kind: 'poi',
  id: poi.id,
  zone: poi.zone,
  nameVi: poi.nameVi,
  lat: poi.lat,
  lon: poi.lon,
  radiusMeters: poi.radiusMeters,
}));

let cachedCombinedFeatures               = ALL_PACK_FEATURES;

               
                 
                              
                        
                     
                       
                              
                         
                    
                         
                  
                                             
 

const app      = {
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
let mapView                 = null;
let geo                    = null;

const now = ()         => Date.now() + app.timeOffsetMs;

let worldDrops              = [];

/** Danh mục tài nguyên rơi hợp lệ theo vùng — 100% chuẩn khớp với data/items.json */
const POOL_BY_ZONE                                                 = {
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

let lastVibratedDropId                = null;
let currentDeviceHeading                = null;
let compassListenerInitialized = false;

function initCompassListener()       {
  if (compassListenerInitialized) return;
  compassListenerInitialized = true;

  const onOrientation = (event                        ) => {
    let heading                = null;
    if ((event       ).webkitCompassHeading !== undefined) {
      // iOS Safari (0 là hướng Bắc thật)
      heading = (event       ).webkitCompassHeading;
    } else if (event.alpha !== null && event.alpha !== undefined) {
      // Android WebView / Chrome
      heading = (360 - event.alpha) % 360;
    }

    if (heading !== null && Number.isFinite(heading)) {
      if (currentDeviceHeading === null) {
        currentDeviceHeading = heading;
      } else {
        // Bộ lọc làm mượt chuyển động xoay (Low-Pass Filter) không giật lag
        const diff = ((heading - currentDeviceHeading + 540) % 360) - 180;
        currentDeviceHeading = (currentDeviceHeading + diff * 0.3 + 360) % 360;
      }
      // Cập nhật góc kim chỉ ngay lập tức với chi phí cực thấp (chỉ đổi CSS transform)
      updateDropRadarPointerOnly();
    }
  };

  if ('ondeviceorientationabsolute' in window) {
    window.addEventListener('deviceorientationabsolute', onOrientation, { passive: true });
  } else if ('ondeviceorientation' in window) {
    window.addEventListener('deviceorientation', onOrientation, { passive: true });
  }
}

                                 
                  
                        
                        
                
                       
 

function getNavigationDirection(from        , to        , deviceHeading               )                 {
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

let lastActiveDrop                   = null;
let lastDropDist = 0;
let lastPlayerPos                = null;

function updateDropRadarPointerOnly()       {
  if (!lastActiveDrop || lastDropDist > 65 || lastDropDist <= 25 || !lastPlayerPos) return;
  const pointer = document.getElementById('drop-radar-pointer-svg');
  const textEl = document.getElementById('drop-radar-turn-text');
  if (!pointer || !textEl) return;

  const nav = getNavigationDirection(lastPlayerPos, { lat: lastActiveDrop.lat, lon: lastActiveDrop.lon }, currentDeviceHeading);
  pointer.style.transform = `rotate(${Math.round(nav.relativeAngle)}deg) translateZ(0)`;
  textEl.textContent = `${nav.arrow} ${nav.instructionVi}`;
}

function updateDropRadar(drop                  , dist         , playerPos         )       {
  const banner = document.getElementById('drop-radar-banner');
  if (!banner) return;

  lastActiveDrop = drop;
  lastDropDist = dist ?? 999;
  lastPlayerPos = playerPos ?? null;

  if (!drop || dist === undefined || !playerPos) {
    banner.hidden = true;
    return;
  }

  banner.hidden = false;
  const roundedDist = Math.round(dist);

  if (dist <= 25) {
    // Đã vào bán kính nhặt (<= 25m)
    banner.className = 'drop-radar-banner drop-radar-banner--ready';
    banner.innerHTML = `
      <div class="drop-radar__icon" style="font-size:1.6rem;">✨</div>
      <div class="drop-radar__info">
        <div style="font-weight:800;font-size:0.95rem;color:#86efac;">
          🖐️ ĐÃ ĐẾN GẦN! (Cách ${roundedDist}m)
        </div>
        <div class="drop-radar__sub" style="color:#d1fae5;font-size:0.8rem;margin-top:2px;">
          Đã trong tầm với! Bấm nhặt ngay
        </div>
      </div>
      <button id="btn-radar-collect" class="btn btn--tiny btn--primary" style="background:#16a34a;border-color:#4ade80;font-weight:800;padding:7px 14px;font-size:0.88rem;white-space:nowrap;box-shadow:0 0 12px rgba(74,222,128,0.5);">🖐️ Nhặt (${drop.qty})</button>
    `;
    const btn = document.getElementById('btn-radar-collect');
    if (btn) {
      btn.onclick = (e) => {
        e.stopPropagation();
        collectWorldDrop(drop);
      };
    }
  } else {
    // Đang ở khoảng cách phát hiện (~26m - 65m): hiển thị la bàn cảm biến chỉ quẹo trái/quẹo phải
    banner.className = 'drop-radar-banner';
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
          <span style="font-size:0.82rem; color:var(--bone); font-weight:normal;">• Cách <strong>${roundedDist}m</strong></span>
        </div>
        <div class="drop-radar__sub" style="color:#e5e7eb; font-size:0.8rem; margin-top:2px;">
          📦 <strong>${drop.nameVi} (+${drop.qty})</strong> — ${nav.turnAdviceVi}
        </div>
      </div>
    `;
  }
}

function checkDropProximityAndAlert()       {
  if (worldDrops.length === 0) {
    lastVibratedDropId = null;
    updateDropRadar(null);
    return;
  }

  const drop = worldDrops[0];
  const { render: at, position: pos } = currentPosition();
  const playerPos = pos ?? at;
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
function getDynamicDropPool(zone        , campLevel        , activePetId         )                                 {
  const pool                                 = [];

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
      { id: 'seed_herb', name: 'Hạt giống dược thảo' },
      { id: 'arrow', name: 'Bó mũi tên' },
    );
    if (zone === 'water') {
      pool.push({ id: 'pearl', name: 'Ngọc trai sông' });
    }
  }

  // 4. Tầng 4+: Thành cổ thần thoại (Cấp 4+)
  if (campLevel >= 4) {
    pool.push(
      { id: 'gold_ore', name: 'Quặng vàng quý' },
      { id: 'ancient_coin', name: 'Đồng vàng cổ' },
      { id: 'iron_ingot', name: 'Thanh sắt' },
    );
  }

  // 5. Bonus từ Linh Thú xuất chiến đi cùng:
  if (activePetId === 'otter') {
    pool.push({ id: 'pearl', name: 'Ngọc trai sông' }, { id: 'raw_fish', name: 'Cá tươi béo ngậy' });
  } else if (activePetId === 'hound') {
    pool.push({ id: 'leather', name: 'Da thú dày' }, { id: 'raw_meat', name: 'Thịt tươi' });
  } else if (activePetId === 'fox') {
    pool.push({ id: 'seed_herb', name: 'Hạt giống dược thảo' }, { id: 'red_mushroom', name: 'Nấm đỏ' });
  } else if (activePetId === 'mammoth') {
    pool.push({ id: 'gold_ore', name: 'Quặng vàng quý' }, { id: 'log', name: 'Khúc gỗ lớn' });
  }

  return pool;
}

/**
 * Sinh DUY NHẤT 1 cụm vật phẩm quanh người chơi trong tầm phát hiện ~18m - 46m.
 * Tích hợp sự kiện Rương báu 8.000 bước chân mỗi ngày!
 */
function spawnSingleWorldDropNear(center        , zone        )       {
  if (!center || worldDrops.length > 0) return;

  const campLevel = app.profile?.player?.camp?.level ?? 1;
  const activePet = app.profile?.player?.pets?.find((p) => p.isActive);
  const todayKey = toLocalTime(now()).day;
  const totalStepsToday = app.profile?.player?.steps?.totalSteps ?? 0;
  const last8kChestDay = (app.profile?.player       )?.last8kChestDay;

  // Sinh toạ độ ngẫu nhiên xung quanh người chơi ở bán kính 18m - 46m
  const dist = 18 + Math.random() * 28;
  const angle = Math.random() * Math.PI * 2;
  const dLat = (dist * Math.cos(angle)) * metersToLatDegrees(1);
  const dLon = (dist * Math.sin(angle)) * metersToLonDegrees(1, center.lat);

  // Kiểm tra mốc 8.000 bước chân: Thả Rương báu tiền sử nếu chưa nhận hôm nay
  if (totalStepsToday >= 8000 && last8kChestDay !== todayKey) {
    worldDrops = [{
      id: `milestone_8k_${todayKey}`,
      itemId: 'ancient_chest',
      nameVi: '🎁 Rương báu 8.000 bước (tiền sử)',
      qty: 1,
      lat: center.lat + dLat,
      lon: center.lon + dLon,
      spawnedAtMs: now(),
    }];
    checkDropProximityAndAlert();
    return;
  }

  const pool = getDynamicDropPool(zone, campLevel, activePet?.petId);
  const item = pool[Math.floor(Math.random() * pool.length)] ?? { id: 'dry_branch', name: 'Cành khô' };
  const qty = 2 + Math.floor(Math.random() * 3);

  worldDrops = [{
    id: `drop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    itemId: item.id,
    nameVi: item.name,
    qty,
    lat: center.lat + dLat,
    lon: center.lon + dLon,
    spawnedAtMs: now(),
  }];

  checkDropProximityAndAlert();
}

function collectWorldDrop(drop           )       {
  if (!app.profile) return;

  const { render: at, position: pos } = currentPosition();
  const playerPos = pos ?? at;
  const dist = distanceMeters(playerPos, { lat: drop.lat, lon: drop.lon });

  if (dist > 25) {
    toast(`Vật phẩm ở cách ~${Math.round(dist)}m. Hãy đi lại gần hơn (dưới 25m) để nhặt!`, 'warn');
    return;
  }

  // Xử lý nhặt Rương báu 8.000 bước chân hoành tráng
  if (drop.itemId === 'ancient_chest') {
    const todayKey = toLocalTime(now()).day;
    (app.profile.player       ).last8kChestDay = todayKey;

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

function getHomeCampCenter()                {
  if (!app.profile?.player.camp.homeCell) return null;
  const cell = cellById(app.profile.player.camp.homeCell);
  if (!cell) return null;
  return { lat: cell.centerLat, lon: cell.centerLon };
}

let smoothRenderPos                = null;
let devMockPosition                = null;

export function isNativeApk()          {
  return (
    typeof (globalThis       ).AndroidBridge !== 'undefined' ||
    navigator.userAgent.includes('KyNguyenHoangCo') ||
    (globalThis       ).__IS_APK__ === true
  );
}

/** Vị trí dùng để tính toán & vẽ: GPS thật với nội suy êm dịu 60 FPS khi người chơi bước đi. */
function currentPosition()                                                               {
  const state = geo?.current();
  let targetPos        ;
  let hasFix = false;

  if (devMockPosition) {
    targetPos = devMockPosition;
    hasFix = true;
  } else if (state?.position && geo?.hasFreshFix()) {
    targetPos = state.position;
    hasFix = true;
  } else {
    const steps = app.profile?.player?.lifetime?.steps ?? 0;
    targetPos = steps > 0 ? simulatedWalk(FALLBACK_POSITION, steps) : FALLBACK_POSITION;
    hasFix = !isNativeApk();
  }

  if (!smoothRenderPos) {
    smoothRenderPos = { ...targetPos };
  } else {
    // Nội suy êm dịu giúp nhân vật lướt bước đi tự nhiên ngay trên giao diện bản đồ
    smoothRenderPos.lat += (targetPos.lat - smoothRenderPos.lat) * 0.15;
    smoothRenderPos.lon += (targetPos.lon - smoothRenderPos.lon) * 0.15;
  }

  return {
    position: isNativeApk() ? (hasFix ? targetPos : null) : targetPos,
    render: smoothRenderPos,
    hasFix,
  };
}

// ---------------------------------------------------------------- khởi động

function boot()       {
  try {
    assertBalanceValid();
  } catch (error) {
    document.body.innerHTML = `<pre style="padding:20px;color:#e3a1a1;white-space:pre-wrap">${(error         ).message}</pre>`;
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

function renderProfileScreen()       {
  el('screen-game').hidden = true;
  el('screen-profiles').hidden = false;

  const list = el('slot-list');
  list.replaceChildren();

  for (const summary of slotSummaries(app.save)) {
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
          <div class="slot__name">${summary.displayName}</div>
          <div class="slot__meta">Trại cấp ${summary.campLevel} · Chương ${summary.chapterIndex} · ${summary.lifetimeSteps?.toLocaleString('vi-VN')} bước</div>
        </div>
        <button class="slot__del" title="Xoá hồ sơ này" aria-label="Xoá hồ sơ">🗑️</button>`;

      card.onclick = (e) => {
        const target = e.target               ;
        if (target.closest('.slot__del')) return;
        enterProfile(summary.slot);
      };

      card.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          enterProfile(summary.slot);
        }
      };

      const delBtn = card.querySelector                   ('.slot__del');
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

function promptDeleteProfile(slot        , name         )       {
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

let selectedGender         = 'male';

function createNewProfile(slot        )       {
  const overlay = el('overlay-create-profile');
  const input = el                  ('create-name');
  input.value = slot === 0 ? 'Người Sống Sót' : 'Bạn Đồng Hành';
  selectedGender = 'male';

  // Nạp hình ảnh avatar xem trước
  el('avatar-preview-male').innerHTML = avatarSvg('male');
  el('avatar-preview-female').innerHTML = avatarSvg('female');

  const cards = overlay.querySelectorAll                   ('.gender-card');
  cards.forEach((card) => {
    card.classList.toggle('is-active', card.dataset.gender === selectedGender);
    card.onclick = () => {
      selectedGender = (card.dataset.gender          ) ?? 'male';
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

function enterProfile(slot        )       {
  app.save = setActiveSlot(app.save, slot);
  app.profile = activeProfile(app.save);
  if (!app.profile) return;

  el('screen-profiles').hidden = true;
  el('screen-game').hidden = false;

  if (!mapView) {
    mapView = new MapView(el                   ('map-canvas'));
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
    mapView.onFeatureClick = (feat) => {
      if (!app.profile) return;
      const { render: playerAt } = currentPosition();
      const dist = Math.round(distanceMeters(playerAt, { lat: feat.lat, lon: feat.lon }));
      const radius = Math.max(feat.radiusMeters || 0, 60);

      // Nếu đang trong phạm vi 60m: Mở ngay Tiệm Thương Nhân NPC
      if (dist <= radius) {
        audio.play('click');
        openMerchantStore(feat.nameVi);
        return;
      }

      toast(`📍 ${feat.nameVi} cách bạn ${dist}m. Hãy đi bộ tới gần (≤${radius}m) để gặp NPC mua bán & trao đổi!`);
    };
    globalThis.addEventListener('resize', () => mapView?.resize());
  }
  mapView.resize();

  if (!geo) {
    geo = new GeoWatcher(() => sync());
    geo.start();
  }

  // Nút Cấp quyền GPS
  el('btn-request-gps').onclick = () => {
    geo?.start();
    el('overlay-gps-required').hidden = true;
  };

  // Nút Thiết lập Căn Cứ / Nhà ban đầu
  el('btn-confirm-home').onclick = () => {
    if (!app.profile) return;
    const { render: at } = currentPosition();
    const cell = cellAt(at.lat, at.lon).id;
    app.profile.player.camp.homeCell = cell;
    persist();
    el('overlay-set-home').hidden = true;
    toast('🏕️ Đã thiết lập Căn Cứ thành công! Đây là Nhà an toàn của bạn.', 'good');
    afterAction();
  };

  // Nếu người chơi chưa có vị trí Căn Cứ (Nhà) -> mở màn hình thiết lập Nhà
  if (!app.profile.player.camp.homeCell) {
    el('overlay-set-home').hidden = false;
  }

  // Nút đóng Tiệm Thương Nhân NPC
  el('btn-merchant-close').onclick = () => {
    el('overlay-merchant-shop').hidden = true;
  };

  const { render: at } = currentPosition();
  spawnSingleWorldDropNear(at, app.view?.location?.zone ?? 'wilderness');

  sync();
  startLoops();
}

function openMerchantStore(poiName         )       {
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
      const res = sellItemToNpc(app.profile.player, itemId       , qty);
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

let syncTimer                                        = null;
let rafHandle = 0;

let isPocketModeActive = false;

function isAnyMajorOverlayOpen()          {
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

function togglePocketMode(activate          )       {
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

function updatePocketModeDisplay()       {
  if (!isPocketModeActive) return;
  const local = toLocalTime(now());
  const hh = String(local.hour).padStart(2, '0');
  const mm = String(local.minute).padStart(2, '0');
  el('pocket-mode-time').textContent = `${hh}:${mm}`;
  const totalSteps = app.profile?.player?.steps?.totalSteps ?? 0;
  el('pocket-mode-steps').textContent = `${totalSteps.toLocaleString('vi-VN')} bước`;
}

function startLoops()       {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(() => sync(), 5000);

  let lastFrameTime = 0;

  const frame = (timestamp        ) => {
    rafHandle = requestAnimationFrame(frame);
    if (document.hidden) return;

    // Tự động tạm dừng render hoàn toàn (0 FPS) khi ở tab khác, chế độ bỏ túi hoặc mở popup lớn
    if (app.activeTab !== 'map' || isPocketModeActive || isAnyMajorOverlayOpen()) {
      return;
    }

    // Khóa cố định 18 FPS tiết kiệm pin (đủ mượt cho bản đồ 2.5D, giảm 70% tải GPU so với 60 FPS)
    const frameInterval = 1000 / 18;

    const elapsed = timestamp - lastFrameTime;
    if (elapsed < frameInterval) return;
    lastFrameTime = timestamp - (elapsed % frameInterval);

    app.simTick++;
    drawMap();
  };
  cancelAnimationFrame(rafHandle);
  rafHandle = requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Khi TẮT MÀN HÌNH / KHÓA MÁY: Tắt hoàn toàn GPS phần cứng để máy mát lạnh và không tốn pin!
      geo?.stop();
    } else {
      // Khi MỞ SÁNG MÀN HÌNH: Kích hoạt lại GPS để cập nhật toạ độ và đồng bộ bước chân
      geo?.start();
      sync();
    }
  });
}

/**
 * Nhịp tim của app: rút số bước đã tích, đưa hết cho lõi, nhận về trạng thái mới.
 * Toàn bộ "chuyện đã xảy ra khi bạn vắng mặt" đều sinh ra ở một chỗ duy nhất này.
 */
function sync()       {
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
  const featureMap = new Map                    ();
  for (const f of ALL_PACK_FEATURES) featureMap.set(f.id, f);
  for (const f of app.view.mapFeatures) featureMap.set(f.id, f);
  cachedCombinedFeatures = Array.from(featureMap.values());

  if (steps.newSteps > 0) {
    const { render: at } = currentPosition();
    spawnSingleWorldDropNear(at, app.view.location?.zone ?? 'wilderness');
  }

  for (const message of result.eventsVi) {
    if (message.includes('Đồng hồ máy')) continue; // Đã gom vào icon Chuông 🔔
    toast(message);
    if (message.includes('Xong nhiệm vụ')) {
      audio.play('quest_complete');
    }
  }
  if (result.knockedOut) buzz([140, 70, 140]);
  if (result.pickups > 0) {
    audio.play('pickup');
    if (app.profile.settings.haptics) buzz(14);
  }

  if (result.beats.length > 0 && app.profile.settings.narrationAudio) {
    audio.play('beat_notify');
    app.narrationQueue.push(...result.beats);
    
    const hasChapterOpeningBeat = result.beats.some((b) => b.triggerSteps === 0);
    const curChap = CHAPTERS.find((c) => c.index === app.profile?.story.chapterIndex);
    if (hasChapterOpeningBeat && curChap) {
      showChapterIntro(curChap, () => showNextBeat());
    } else {
      showNextBeat();
    }
  } else {
    for (const beat of result.beats) app.profile = playBeat(app.profile, beat.id);
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
  render();
  updatePocketModeDisplay();
}

function persist()       {
  if (app.profile) app.save = putProfile(app.save, app.save.activeSlot, app.profile);
  app.storageOk = writeSave(app.save, now());
}

function render(forceAll = false)       {
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
}

function drawMap()       {
  if (!mapView || !app.view || !app.profile) return;

  const { render: at, hasFix } = currentPosition();
  const weather = weatherFor(at, now());

  mapView.render({
    center: at,
    features: cachedCombinedFeatures,
    phase: app.view.phase,
    weather,
    gender: app.profile.player.gender ?? 'male',
    hasFix,
    homeCellCenter: getHomeCampCenter(),
    activePoiId: app.view.location?.insidePoi?.id ?? null,
    drops: worldDrops,
    traps: app.profile.player.traps,
    activePetId: app.profile.player.pets?.find((p     ) => p.isActive)?.petId ?? null,
  });

  checkDropProximityAndAlert();
}

function toRoman(num        )         {
  const map                     = [
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

function showChapterIntro(chapterObj     , onStart            )       {
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

function showPrologue(onProceed            )       {
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

let typeWriterInterval      = null;

function showNextBeat()       {
  if (app.narrationOpen || !app.profile) return;

  const beat = app.narrationQueue.shift();
  if (!beat) return;

  app.narrationOpen = true;

  // Cập nhật biểu cảm và trạng thái của Lạc Lạc
  const avatarEmoji = el('narration-avatar-emoji');
  const avatarBox = el('narration-avatar');
  const moodBadge = el('narration-mood');
  const waveBox = el('narration-wave');

  const mood = (beat       ).mood || 'calm';
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

const handlers           = {
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
    const preciousMoves                                    = [];

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

    const run = (minigameScore         ) => {
      const result = gather({
        profile: app.profile ,
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
        const result = runNightDefense(app.profile , now(), performance, performance > 0);
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
      begin(difficulty              ) {
        const result = beginBloodMoon(app.profile , now(), difficulty);
        app.profile = result.profile;
        persist();
        return { ok: result.ok, messageVi: result.messageVi, fight: result.fight };
      },
      strike(performance) {
        const result = strikeBoss(app.profile , now(), performance, 25);
        app.profile = result.profile;
        persist();
        audio.play('strike');
        return { fight: result.fight, messageVi: result.messageVi, defeated: result.defeated };
      },
      tick() {
        app.profile = tickBloodMoonAllies(app.profile , now());
        return app.profile.activeFight;
      },
      settle() {
        const result = finishBloodMoon(app.profile , now());
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
      for (const btn of document.querySelectorAll                   ('.tabbar__btn')) {
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
    const video = el                  ('ar-video');
    const canvas = el                   ('ar-canvas');
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

    for (const btn of document.querySelectorAll                   ('.ar-model-btn')) {
      btn.onclick = () => {
        for (const b of document.querySelectorAll                   ('.ar-model-btn')) b.classList.remove('is-active');
        btn.classList.add('is-active');
        setARModel(btn.dataset.model       );
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

  onToggleSetting(key) {
    if (!app.profile) return;
    app.profile = updateSettings(app.profile, { [key]: !app.profile.settings[key] });
    afterAction();
  },

  onExport() {
    persist();
    downloadText(suggestBackupFileName(now()), exportBackup(app.save, now(), GAME_VERSION));
    toast('Đã xuất file sao lưu. Cất vào chỗ nào an toàn nhé.', 'good');
  },

  onImport() {
    el                  ('file-import').click();
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

function openCoopModal()       {
  if (!app.profile) return;
  const overlay = el('overlay-coop-battle');
  overlay.hidden = false;

  let currentRoom           = createCoopRoom('HANOI_LOCAL', 'peer_main', app.profile, 'normal', now());
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

  for (const btn of document.querySelectorAll                   ('.btn-coop-action')) {
    btn.onclick = () => {
      if (currentRoom.status !== 'fighting') return;
      const act = btn.dataset.action       ;
      audio.play(act === 'attack' ? 'strike' : act === 'heal_team' ? 'eat' : 'craft');
      currentRoom = processCoopRound(currentRoom, [{ peerId: 'peer_main', action: act }]);
      updateCoopUI();

      if (currentRoom.status === 'victory') {
        audio.play('quest_complete');
        const rewards = resolveCoopRewards(currentRoom);
        for (const rew of rewards) {
          if (rew.peerId === 'peer_main') {
            for (const item of rew.items) {
              app.profile .player.carried[item.itemId] = (app.profile .player.carried[item.itemId] ?? 0) + item.qty;
            }
            toast(`🎉 Thắng Boss Co-op! Nhận rương báu: ${describeInventory(rew.items.reduce((acc     , i) => { acc[i.itemId] = i.qty; return acc; }, {}))}`, 'good');
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

function afterAction()       {
  persist();
  if (!app.profile) return;

  const { position, render: at } = currentPosition();
  app.view = buildView(app.profile, now(), at, position, PACK, weatherFor(at, now()));
  render();
}

// ---------------------------------------------------------------- điều khiển tĩnh

function wireStaticControls()       {
  function switchTab(targetTab        )       {
    if (app.activeTab !== targetTab) {
      audio.play('click');
    }
    app.activeTab = targetTab;
    const isMap = targetTab === 'map';
    const backdrop = el('drawer-backdrop');
    backdrop.hidden = isMap;

    for (const sibling of document.querySelectorAll('.tabbar__btn')) {
      sibling.classList.toggle('is-active', (sibling               ).dataset.tab === targetTab);
    }

    for (const tab of document.querySelectorAll             ('.tab')) {
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

  // Kích hoạt cảm biến la bàn định hướng thời gian thực
  initCompassListener();

  // Tự động phát âm thanh click tương tác giòn giã cho mọi nút bấm và thành phần UI
  document.addEventListener(
    'click',
    (e) => {
      const target = e.target               ;
      const clickable = target.closest(
        'button, .btn, .chip, .tabbar__btn, .drawer-close, .map-ctrl-btn, .slot, .gender-card, .merchant-tab-btn, .ar-model-btn, .slot__del, .btn-coop-action, .home-prompt-box',
      );
      if (clickable) {
        audio.play('click');
      }
    },
    { capture: true },
  );

  for (const button of document.querySelectorAll                   ('.tabbar__btn')) {
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
  for (const closeBtn of document.querySelectorAll                   ('.drawer-close')) {
    closeBtn.onclick = () => switchTab('map');
  }

  // Bấm vào vùng backdrop ngoài Drawer để đóng về Bản đồ
  el('drawer-backdrop').onclick = () => switchTab('map');

  // Cụm điều khiển Bản đồ: Phóng to (+), Thu nhỏ (−), Về ban đầu (🎯)
  el('btn-zoom-in').onclick = () => {
    mapView?.zoomIn();
  };

  el('btn-zoom-out').onclick = () => {
    mapView?.zoomOut();
  };

  el('btn-pocket-mode').onclick = () => {
    togglePocketMode(true);
  };

  el('overlay-pocket-mode').onclick = () => {
    togglePocketMode(false);
  };

  el('btn-recenter').onclick = () => {
    mapView?.recenterAndResetZoom();
  };

  el('btn-back-profiles').onclick = handlers.onSwitchProfile;

  // Chuông thông báo
  el('btn-notifications').onclick = () => {
    const pop = el('popover-notifications');
    pop.hidden = !pop.hidden;
  };

  el('btn-close-notifs').onclick = () => {
    el('popover-notifications').hidden = true;
  };

  // Mở Cẩm Nang Sinh Tồn từ HUD bars hoặc từ nút trong Nhật Ký
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

  const hudBars = document.getElementById('hud-survival-bars');
  if (hudBars) hudBars.onclick = openSurvivalGuide;

  const btnOpenGuide = document.getElementById('btn-open-survival-guide');
  if (btnOpenGuide) btnOpenGuide.onclick = openSurvivalGuide;

  const btnCloseGuide = document.getElementById('btn-survival-guide-close');
  if (btnCloseGuide) btnCloseGuide.onclick = closeSurvivalGuide;

  const btnOkGuide = document.getElementById('btn-survival-guide-ok');
  if (btnOkGuide) btnOkGuide.onclick = closeSurvivalGuide;

  el('narration-next').onclick = () => {
    speech.stop();
    el('overlay-narration').hidden = true;
    app.narrationOpen = false;
    if (app.narrationQueue.length > 0) showNextBeat();
    else render();
  };

  el('hud-bloodmoon').onclick = (event) => {
    if ((event.target               ).dataset.action === 'bloodmoon') handlers.onBloodMoon();
  };

  el('btn-unlock').onclick = () => {
    if (!app.profile) return;
    app.profile = unlockGame(app.profile).profile;
    el('overlay-demo').hidden = true;
    toast('Đã mở khoá trọn đời. Tiến trình 3 ngày demo giữ nguyên.', 'good');
    afterAction();
  };

  el                  ('filter-craftable').onchange = (event) => {
    app.onlyCraftable = (event.target                    ).checked;
    render();
  };

  el('btn-import').onclick = () => el                  ('file-import').click();
  el                  ('file-import').onchange = async (event) => {
    const file = (event.target                    ).files?.[0];
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

function wireGpsOverlay()       {
  const btnGrant = document.getElementById('btn-gps-grant-permission');
  if (btnGrant) {
    btnGrant.onclick = () => {
      (globalThis       ).AndroidBridge?.requestLocationPermission?.();
      (globalThis       ).AndroidBridge?.openLocationSettings?.();
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

function checkGpsRequirement()       {
  const overlay = document.getElementById('overlay-gps-required');
  if (!isNativeApk()) {
    if (overlay) overlay.hidden = true;
    return;
  }

  // Tắt và xoá hoàn toàn bảng Dev Widget trên Android APK
  const pedoPanel = document.getElementById('pedometer-panel');
  if (pedoPanel) {
    pedoPanel.style.display = 'none';
    pedoPanel.remove();
  }

  if (!overlay) return;

  const state = geo?.current();
  const hasFix = state?.position !== null && geo?.hasFreshFix();
  const hasPerm = (globalThis       ).AndroidBridge?.hasLocationPermission?.() ?? true;

  if (!hasPerm || !hasFix) {
    overlay.hidden = false;
    const statusText = document.getElementById('gps-status-text');
    if (statusText) {
      if (!hasPerm) {
        statusText.innerHTML = '🚫 <strong>Chưa cấp quyền Vị trí (GPS)</strong>. Kỷ Nguyên Hoang Cổ là game sinh tồn GPS thế giới thực — bạn bắt buộc phải cấp quyền vị trí để chơi.';
      } else {
        statusText.innerHTML = '🛰️ <strong>Đang kết nối tín hiệu vệ tinh GPS...</strong> Vui lòng ra nơi thoáng đãng hoặc bật Định vị (GPS) chính xác cao trong máy.';
      }
    }
  } else {
    overlay.hidden = true;
  }
}

function wirePedometerPanel()       {
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
  const teleportToPoi = (filter                        ) => {
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
function jumpToTargetHour(targetHour        )       {
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
function jumpTime(deltaMs        )       {
  if (!app.profile) return;
  const currentMs = Math.max(now(), app.profile.clock.maxSeenMs);
  const targetMs = currentMs + Math.max(0, deltaMs);
  app.timeOffsetMs = targetMs - Date.now();
  app.profile.clock.maxSeenMs = targetMs;
  const local = toLocalTime(targetMs);
  toast(`Đã tua tới ${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')} (${local.day}).`);
  sync();
}

function registerServiceWorker()       {
  if (!('serviceWorker' in navigator)) return;
  // Đăng ký service worker chính là thứ làm game chạy được khi ngắt hoàn toàn Internet.
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
    /* chạy qua file:// hoặc trình duyệt chặn — game vẫn chơi được, chỉ là không cache offline */
  });
}

/**
 * Cửa sổ gỡ lỗi duy nhất của một game không có server: mở DevTools và gõ `__khc`.
 * Cũng là cách bộ smoke test tự động điều khiển app mà không cần thư viện ngoài.
 */
Object.assign(globalThis                           , {
  __khc: {
    app,
    handlers,
    sync,
    now,
    pedometer,
    enterProfile,
    jumpTime,
    audio,
    addSteps(count        ) {
      if (!app.profile) return;
      app.stepAccumulator += count;
      sync();
      render();
    },
    jumpToChapter(targetChapterIndex        ) {
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
    giveItem(itemId        , qty = 1) {
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
    createProfileInSlot(slot        , name        , gender         = 'male') {
      app.save = putProfile(app.save, slot, createProfile(name, now(), gender));
      persist();
      renderProfileScreen();
    },
    deleteProfile(slot        ) {
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
    box.textContent = `Không khởi động được:\n${(error         ).message}\n\n${(error         ).stack ?? ''}`;
  }
  throw error;
}
