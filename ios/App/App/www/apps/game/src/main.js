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
  upgradeStrength,
  getArtisanRank,
  getSafeCapacity,
  MAX_STRENGTH_LEVEL,
  getStrengthUpgradeInfo,
  maxWeightCapacity,
  processTransitMovement,
  canCollectOutpost,
  collectOutpostSupply,
  checkBeastTerritory,
  checkNightAmbientThreat,
  raidBeastDen,
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
let lastCompassUpdateMs = 0;
let compassListenerHandler                                               = null;
let compassActive = false;

function initCompassListener()       {
  if (compassListenerHandler) return; // đã init

  const onOrientation = (event                        ) => {
    if (!compassActive) return; // tắt khi không ở tab map
    if (!lastActiveDrop || lastDropDist > 75 || lastDropDist <= 35) return;

    const t = performance.now();
    if (t - lastCompassUpdateMs < 350) return;
    lastCompassUpdateMs = t;

    let heading                = null;
    if ((event       ).webkitCompassHeading !== undefined) {
      heading = (event       ).webkitCompassHeading;
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
function resumeCompass()       {
  initCompassListener();
  compassActive = true;
}

/** Tắt compass: gọi khi rời tab bản đồ hoặc màn hình tắt — event vẫn đăng ký nhưng handler bỏ qua hoàn toàn. */
function pauseCompass()       {
  compassActive = false;
}

// ---------------------------------------------------------------- DU HÀNH VIỄN CHINH & TIỀN ĐỒN TRẠM DỪNG

let currentMovementSpeedKmh = 0;
let lastNearOutpost                    = null;
let lastRadioNarrativeMs = 0;

function checkNearOutpostSupply()       {
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

  let nearest                    = null;
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

function claimNearOutpostSupply()       {
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

function checkRadioNarrative(speedKmh        , at         )       {
  if (!app.profile || !app.profile.settings.narrationAudio) return;
  const nowMs = Date.now();
  if (nowMs - lastRadioNarrativeMs < 60_000) return; // Giãn cách tối thiểu 1 phút giữa các mẩu radio

  let textToSay                = null;

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
let currentRadarMode                                  = 'none';
let currentRadarDropId                = null;

function updateDropRadarPointerOnly()       {
  if (!lastActiveDrop || lastDropDist > 65 || lastDropDist <= 35 || !lastPlayerPos) return;
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
    currentRadarMode = 'none';
    currentRadarDropId = null;
    return;
  }

  banner.hidden = false;
  const roundedDist = Math.round(dist);
  const targetMode = dist <= 35 ? 'ready' : 'navigating';

  if (targetMode === 'ready') {
    // Đã vào bán kính nhặt (<= 35m)
    // QUAN TRỌNG: Chỉ render HTML một lần duy nhất khi chuyển trạng thái, KHÔNG render 18 lần/giây để tránh xoá nút khi người dùng đang ấn ngón tay vào
    if (currentRadarMode !== 'ready' || currentRadarDropId !== drop.id) {
      currentRadarMode = 'ready';
      currentRadarDropId = drop.id;
      banner.className = 'drop-radar-banner drop-radar-banner--ready';
      banner.innerHTML = `
        <div class="drop-radar__icon" style="font-size:1.6rem;">✨</div>
        <div class="drop-radar__info">
          <div id="drop-radar-ready-title" style="font-weight:800;font-size:0.95rem;color:#86efac;">
            🖐️ ĐÃ ĐẾN GẦN! (Cách ${roundedDist}m)
          </div>
          <div class="drop-radar__sub" style="color:#d1fae5;font-size:0.8rem;margin-top:2px;">
            Đã trong tầm với! Chạm vào đây để nhặt
          </div>
        </div>
        <button id="btn-radar-collect" class="btn btn--tiny btn--primary" style="background:#16a34a;border-color:#4ade80;font-weight:800;padding:8px 16px;font-size:0.92rem;white-space:nowrap;box-shadow:0 0 12px rgba(74,222,128,0.5);touch-action:manipulation;cursor:pointer;">🖐️ Nhặt (${drop.qty})</button>
      `;

      // Gắn sự kiện nhặt siêu nhạy cho cả nút bấm lẫn toàn bộ thanh banner (chạm đâu cũng nhặt được)
      const handleCollect = (e       ) => {
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
      if (title) title.textContent = `🖐️ ĐÃ ĐẾN GẦN! (Cách ${roundedDist}m)`;
    }
  } else {
    // Đang ở khoảng cách phát hiện (~36m - 75m): hiển thị la bàn cảm biến chỉ hướng
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
function spawnSingleWorldDropNear(center        , zone        )       {
  try {
    if (!center || worldDrops.length > 0) return;

    const campLevel = app.profile?.player?.camp?.level ?? 1;
    const activePet = app.profile?.player?.pets?.find((p) => p.isActive);
    const todayKey = typeof toLocalTime === 'function' ? toLocalTime(now()).day : new Date().toISOString().slice(0, 10);
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
    const isStarter = (app.profile?.player?.lifetime?.steps ?? 0) === 0;
    const qty = isStarter ? 1 : (1 + Math.floor(Math.random() * 2)); // Tân thủ: 1 món; Đi bộ: 1-2 món

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
  } catch (err) {
    console.warn('spawnSingleWorldDropNear error:', err);
  }
}

function collectWorldDrop(drop           )       {
  if (!app.profile) return;

  const { render: at, position: pos } = currentPosition();
  const playerPos = pos ?? at;
  const dist = distanceMeters(playerPos, { lat: drop.lat, lon: drop.lon });

  // Bán kính nhặt 35m (đủ rộng cho vỉa hè và bù trừ sai số GPS ngoài trời)
  if (dist > 35) {
    toast(`Vật phẩm ở cách ~${Math.round(dist)}m. Hãy đi lại gần hơn (dưới 35m) để nhặt!`, 'warn');
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
    typeof (globalThis       ).webkit?.messageHandlers !== 'undefined' ||
    navigator.userAgent.includes('KyNguyenHoangCo') ||
    (globalThis       ).__IS_APK__ === true ||
    window.location.protocol === 'file:' ||
    (typeof (navigator       ).standalone !== 'undefined' && (navigator       ).standalone === true)
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
    hasFix = false;
  }

  if (!smoothRenderPos) {
    smoothRenderPos = { ...targetPos };
  } else {
    // Nội suy êm dịu giúp nhân vật lướt bước đi tự nhiên ngay trên giao diện bản đồ
    smoothRenderPos.lat += (targetPos.lat - smoothRenderPos.lat) * 0.15;
    smoothRenderPos.lon += (targetPos.lon - smoothRenderPos.lon) * 0.15;
  }

  return {
    position: targetPos,
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
      audio.play('click');
      openPoiExploreSheet(feat);
    };
    globalThis.addEventListener('resize', () => mapView?.resize());
  }
  mapView.resize();

  // Tự động kích hoạt cảm biến đếm bước chân
  pedometer.autoStart();

  // Cầu nối nhận bước chân trực tiếp từ Android Native Hardware Sensor
  (globalThis       ).__onNativeStep = (count = 1) => {
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
      sync();
    });
    geo.start();
  }

  // Nút Nhận Tiếp Tế tại Tiền Đồn Trạm Dừng Xe Buýt
  const btnClaimSupply = document.getElementById('btn-claim-outpost-supply');
  if (btnClaimSupply) {
    btnClaimSupply.onclick = () => claimNearOutpostSupply();
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
      let itemId         = 'sharp_stone';
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
  spawnSingleWorldDropNear(at, app.view?.location?.zone ?? 'wilderness');

  sync();
  startLoops();
}

const POI_FORAGE_COOLDOWN_MS = 30 * 60 * 1000; // 30 phút
const POI_REST_COOLDOWN_MS = 45 * 60 * 1000; // 45 phút

function getPoiCooldownRemaining(poiId        , actionType                                )                                                             {
  if (!app.profile) return { ready: true, remainingMs: 0, messageVi: '' };
  const nowMs = now();
  const todayKey = typeof toLocalTime === 'function' ? toLocalTime(nowMs).day : new Date().toISOString().slice(0, 10);
  const usage = (app.profile       ).poiActionsUsage ?? {};

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

function recordPoiAction(poiId        , actionType                                )       {
  if (!app.profile) return;
  const nowMs = now();
  const todayKey = typeof toLocalTime === 'function' ? toLocalTime(nowMs).day : new Date().toISOString().slice(0, 10);
  if (!(app.profile       ).poiActionsUsage) {
    (app.profile       ).poiActionsUsage = {};
  }
  const usage = (app.profile       ).poiActionsUsage;
  if (actionType === 'monument') {
    usage[`${poiId}_monument_day`] = todayKey;
  } else {
    usage[`${poiId}_${actionType}_at`] = nowMs;
  }
}

let currentExplorePoi                    = null;

function openPoiExploreSheet(feat            )       {
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
  const btnForage = el                   ('btn-poi-act-forage');
  const btnRest = el                   ('btn-poi-act-rest');
  const btnMonument = el                   ('btn-poi-act-monument');

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

let lastUserInteractionTime = 0;
export function bumpInteraction()       {
  lastUserInteractionTime = performance.now();
}

function startLoops()       {
  let syncIntervalMs = 5_000; // 5s khi app nổi bật

  const scheduleSyncTimer = () => {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = setInterval(() => sync(), syncIntervalMs);
  };

  scheduleSyncTimer();

  let lastFrameTime = 0;

  const frame = (timestamp        ) => {
    rafHandle = requestAnimationFrame(frame);
    if (document.hidden) return;

    // Tự động tạm dừng render hoàn toàn (0 FPS) khi ở tab khác, chế độ bỏ túi hoặc mở popup lớn
    if (app.activeTab !== 'map' || isPocketModeActive || isAnyMajorOverlayOpen()) {
      return;
    }

    // Nhịp render thông minh: 10 FPS khi đứng yên (máy cực mát, 0% nóng), 18 FPS khi vuốt chạm bản đồ
    const isInteracting = timestamp - lastUserInteractionTime < 1500;
    const targetFps = isInteracting ? 18 : 10;
    const frameInterval = 1000 / targetFps;

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
      // Màn hình tắt / khóa máy:
      // 1. Tạm dừng GPS & Compass
      geo?.pause();
      pauseCompass();
      // 2. Giãn nhịp sync lên 30s để CPU ngủ sâu, tiết kiệm pin
      syncIntervalMs = 30_000;
      scheduleSyncTimer();
    } else {
      // Mở sáng màn hình:
      // 1. Khôi phục nhịp sync 5s và đồng bộ bước chân ngay
      syncIntervalMs = 5_000;
      scheduleSyncTimer();
      sync();
      // 2. Chỉ bật lại GPS & Compass nếu đang ở tab bản đồ
      if (app.activeTab === 'map') {
        geo?.resume();
        resumeCompass();
      }
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

  // Xoá drop cũ nếu quá xa vị trí hiện tại (>150m) — sửa bug drop spawn ở FALLBACK_POSITION rồi GPS bắt vị trí thật
  if (worldDrops.length > 0) {
    const { render: playerAt } = currentPosition();
    const dropDist = distanceMeters(playerAt, { lat: worldDrops[0].lat, lon: worldDrops[0].lon });
    if (dropDist > 150) {
      worldDrops = [];
    }
  }

  // Chỉ sinh đồ rơi khi người chơi thực sự đi bộ (newSteps > 0), hoặc đúng 1 lần đầu làm quen cho tân thủ 0 bước
  const isFirstEverSpawn = worldDrops.length === 0 && (app.profile?.player?.lifetime?.steps ?? 0) === 0;
  if (steps.newSteps > 0 || isFirstEverSpawn) {
    const { render: at } = currentPosition();
    spawnSingleWorldDropNear(at, app.view.location?.zone ?? 'wilderness');
  }

  // Cập nhật kiểm tra khoảng cách đồ rơi theo chu kỳ sync (5 giây/lần), không chạy 18 lần/giây trong render loop
  checkDropProximityAndAlert();

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
    
    // Lọc trùng tuyệt đối: Chỉ thêm những câu thoại chưa có trong hàng đợi và chưa từng phát
    const newBeats              = [];
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
  const localTime = toLocalTime(now());
  const isNight = localTime.hour >= 18 || localTime.hour < 6;
  const hasTorch = (app.profile.player.carried['torch'] ?? 0) > 0;

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
    strengthLevel: app.profile.player.strengthLevel ?? 1,
    speedKmh: currentMovementSpeedKmh,
    hasTorch,
    isNight,
  });
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
let currentActiveBeatText                = null;

function showNextBeat()       {
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

function switchTab(targetTab        )       {
  if (app.activeTab !== targetTab) {
    audio.play('click');
  }
  app.activeTab = targetTab;
  const isMap = targetTab === 'map';
  const backdrop = el('drawer-backdrop');
  backdrop.hidden = isMap;

  // Pause GPS & Compass khi rời tab bản đồ, resume khi quay lại — tiết kiệm pin tối đa
  if (isMap) {
    geo?.resume();
    resumeCompass();
  } else {
    geo?.pause();
    pauseCompass();
  }

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

// ---------------------------------------------------------------- điều khiển tĩnh

function wireStaticControls()       {
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

  // Cụm điều khiển Bản đồ: Về ban đầu (🎯)
  const btnPocket = document.getElementById('btn-pocket-mode');
  if (btnPocket) {
    btnPocket.onclick = () => togglePocketMode(true);
  }

  el('overlay-pocket-mode').onclick = () => {
    togglePocketMode(false);
  };

  el('btn-recenter').onclick = () => {
    mapView?.recenterAndResetZoom();
  };

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
    if (pop && !pop.hidden && !pop.contains(e.target        ) && btn && !btn.contains(e.target        )) {
      pop.hidden = true;
    }
  });

  function getHeroTitle(strengthLevel = 1, gender         = 'male')         {
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
    const isFemale = app.profile.gender === 'female';
    const nameEl = el('hero-profile-name');
    const titleEl = el('hero-profile-title');
    const bigAvatar = el('hero-profile-big-avatar');
    const strLevelEl = el('hero-profile-str-level');
    const capEl = el('hero-profile-capacity');
    const btnUpgrade = el                   ('btn-hero-upgrade-strength');
    const artisanEl = el('hero-profile-artisan');
    const vaultEl = el('hero-profile-vault');
    const petEl = el('hero-profile-pet');
    const stepsEl = el('hero-profile-steps');

    nameEl.textContent = player.displayName || (isFemale ? 'Nữ Thợ Săn' : 'Dũng Sĩ Tiền Sử');
    titleEl.textContent = getHeroTitle(strLvl, app.profile.gender);
    bigAvatar.textContent = isFemale ? '🏹' : '🪓';

    const tier = strLvl >= 9 ? 5 : strLvl >= 7 ? 4 : strLvl >= 5 ? 3 : strLvl >= 3 ? 2 : 1;
    bigAvatar.className = `hero-avatar-frame hero-avatar-frame--tier-${tier}`;

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

    const artisanRank = getArtisanRank(player.artisanLevel ?? 1);
    artisanEl.textContent = `${artisanRank.titleVi} (Cấp ${player.artisanLevel ?? 1}/4)`;

    const vaultLvl = player.safeVaultLevel ?? 1;
    const vaultCap = getSafeCapacity(player.camp.level, vaultLvl);
    vaultEl.textContent = `Cấp ${vaultLvl}/6 (${vaultCap} ô)`;

    const activePet = player.pets?.find((p     ) => p.isActive);
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
