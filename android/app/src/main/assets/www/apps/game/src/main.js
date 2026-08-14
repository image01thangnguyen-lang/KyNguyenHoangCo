/**
 * Điểm khởi động của prototype.
 *
 * Kiến trúc: mọi luật chơi nằm trong `packages/game-core` (thuần khiết, có test). File này
 * chỉ làm ba việc — đọc tín hiệu nền tảng (bước chân, GPS, đồng hồ), gọi lõi, rồi vẽ kết quả.
 * Không có một dòng luật chơi nào ở đây, và không có lệnh gọi mạng nào ở bất cứ đâu.
 */

import {
  CAMP_TIERS,
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
} from '../../../packages/game-core/src/index.js';
             
               
           
         
         
              
           
            
                                                  

import { MapView, featureAtPoint } from './mapView.js';
                                              
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
  toast,
} from './panels.js';
                                            
import { openBloodMoon, openNightDefense } from './fights.js';
import { openMinigame } from './minigames.js';

// Toạ độ dự phòng khi chưa có tín hiệu GPS — Hồ Gươm, để gói POI mẫu có tác dụng.
const FALLBACK_POSITION         = { lat: 21.0287, lon: 105.8524 };
const PACK = sampleHanoiPack();

               
                 
                              
                        
                     
                       
                              
                         
                    
                         
                  
                                             
 

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

/**
 * Sinh DUY NHẤT 1 cụm vật phẩm quanh người chơi.
 * Chỉ gặp 1 loại vật phẩm 1 lần để bản đồ thoáng đãng, không rối mắt.
 */
function spawnSingleWorldDropNear(center        , zone        )       {
  // Nếu trên bản đồ đã có 1 điểm vật phẩm chưa nhặt -> không sinh thêm
  if (worldDrops.length > 0) return;

  const pool = POOL_BY_ZONE[zone] ?? POOL_BY_ZONE.wilderness;
  const item = pool[Math.floor(Math.random() * pool.length)];

  // Sinh toạ độ ngẫu nhiên xung quanh người chơi ở bán kính 8m - 24m
  const dist = 8 + Math.random() * 16;
  const angle = Math.random() * Math.PI * 2;
  const dLat = (dist * Math.cos(angle)) * metersToLatDegrees(1);
  const dLon = (dist * Math.sin(angle)) * metersToLonDegrees(1, center.lat);

  // Số lượng vật phẩm từ 2 đến 4 món trong cụm
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
}

function collectWorldDrop(drop           )       {
  if (!app.profile) return;

  const { render: at } = currentPosition();
  const dist = distanceMeters(at, { lat: drop.lat, lon: drop.lon });

  if (dist > 30) {
    toast(`Vật phẩm ở hơi xa (~${Math.round(dist)}m). Hãy đi lại gần hơn để nhặt!`, 'warn');
    return;
  }

  // Thêm đồ vào carried inventory
  const currentQty = app.profile.player.carried[drop.itemId] ?? 0;
  app.profile.player.carried[drop.itemId] = currentQty + drop.qty;

  // Xoá drop khỏi danh sách (để trống cho lượt sinh tiếp theo khi đi bộ)
  worldDrops = [];

  buzz(18);
  toast(`✨ Đã nhặt: +${drop.qty} ${drop.nameVi}!`, 'good');

  afterAction();
}

function getHomeCampCenter()                {
  if (!app.profile?.player.camp.homeCell) return null;
  const cell = cellById(app.profile.player.camp.homeCell);
  if (!cell) return null;
  return { lat: cell.centerLat, lon: cell.centerLon };
}

/** Vị trí dùng để tính toán: GPS thật nếu có, không thì đứng yên ổn định tại điểm mặc định (Hồ Gươm). */
function currentPosition()                                                               {
  const state = geo?.current();
  if (state?.position && geo?.hasFreshFix()) {
    return { position: state.position, render: state.position, hasFix: true };
  }
  // Khi không có GPS hoặc chơi thử: đứng yên tại vị trí cơ sở hoặc dịch chuyển êm dịu theo số bước
  const steps = app.profile?.player?.lifetime?.steps ?? 0;
  const simulated = steps > 0 ? simulatedWalk(FALLBACK_POSITION, steps) : FALLBACK_POSITION;
  return { position: simulated, render: simulated, hasFix: false };
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
  registerServiceWorker();
}

function renderProfileScreen()       {
  el('screen-game').hidden = true;
  el('screen-profiles').hidden = false;

  const list = el('slot-list');
  list.replaceChildren();

  for (const summary of slotSummaries(app.save)) {
    const button = document.createElement('button');
    button.className = `slot${summary.empty ? ' slot--empty' : ''}`;

    if (summary.empty) {
      button.textContent = `+ Hồ sơ mới (khe ${summary.slot + 1})`;
      button.onclick = () => createNewProfile(summary.slot);
    } else {
      button.innerHTML = `
        <div class="slot__avatar">${avatarSvg(summary.gender ?? 'male')}</div>
        <div class="slot__body">
          <div class="slot__name">${summary.displayName}</div>
          <div class="slot__meta">Trại cấp ${summary.campLevel} · Chương ${summary.chapterIndex} · ${summary.lifetimeSteps?.toLocaleString('vi-VN')} bước</div>
        </div>`;
      button.onclick = () => enterProfile(summary.slot);
    }

    list.append(button);
  }
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
    mapView.onPanChange = (isPanned) => {
      const btn = el('btn-recenter');
      if (btn) btn.hidden = !isPanned;
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
        toast(result.messageVi, 'good');
        sync();
      } else {
        toast(result.messageVi, 'bad');
      }
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

  const { render: at } = currentPosition();
  spawnSingleWorldDropNear(at, app.view?.location?.zone ?? 'wilderness');

  sync();
  startLoops();
}

// ---------------------------------------------------------------- vòng đồng bộ

let syncTimer                                        = null;
let rafHandle = 0;

function startLoops()       {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(() => sync(), 5000);

  const frame = () => {
    app.simTick++;
    drawMap();
    rafHandle = requestAnimationFrame(frame);
  };
  cancelAnimationFrame(rafHandle);
  rafHandle = requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) sync();
  });
}

/**
 * Nhịp tim của app: rút số bước đã tích, đưa hết cho lõi, nhận về trạng thái mới.
 * Toàn bộ "chuyện đã xảy ra khi bạn vắng mặt" đều sinh ra ở một chỗ duy nhất này.
 */
function sync()       {
  if (!app.profile) return;

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

  if (steps.newSteps > 0) {
    const { render: at } = currentPosition();
    spawnSingleWorldDropNear(at, app.view.location?.zone ?? 'wilderness');
  }

  for (const message of result.eventsVi) {
    if (message.includes('Đồng hồ máy')) continue; // Đã gom vào icon Chuông 🔔
    toast(message);
  }
  if (result.knockedOut) buzz([140, 70, 140]);
  if (result.pickups > 0 && app.profile.settings.haptics) buzz(14);

  if (result.beats.length > 0 && app.profile.settings.narrationAudio) {
    app.narrationQueue.push(...result.beats);
    showNextBeat();
  } else {
    for (const beat of result.beats) app.profile = playBeat(app.profile, beat.id);
  }

  if (app.view.demo.gated) el('overlay-demo').hidden = false;

  persist();
  render();
}

function persist()       {
  if (app.profile) app.save = putProfile(app.save, app.save.activeSlot, app.profile);
  app.storageOk = writeSave(app.save, now());
}

function render()       {
  const { profile, view } = app;
  if (!profile || !view) return;

  renderHud(view, profile);
  renderZonePanel(view, profile);
  renderZoneActions(view, profile, handlers);
  renderBagPanel(profile, handlers);
  renderCraft(view, profile, handlers, app.onlyCraftable);
  renderCamp(view, profile, handlers);

  const current = chapter(profile.story.chapterIndex);
  const played = (current?.beats ?? []).filter((b) => profile.story.playedBeatIds.includes(b.id));
  renderLog(view, profile, current?.titleVi ?? '—', current?.summaryVi ?? '', played);

  renderSettings(profile, handlers, app.storageOk);
  el('pedo-source').textContent = describeSource(pedometer.currentSource);
}

function drawMap()       {
  if (!mapView || !app.view || !app.profile) return;

  const { render: at, hasFix } = currentPosition();
  const weather = weatherFor(at, now());

  if (app.profile) {
    app.profile.player.traps = tickTraps(app.profile.player.traps ?? [], now());
  }

  mapView.render({
    center: at,
    features: app.view.mapFeatures,
    phase: app.view.phase,
    weather,
    gender: app.profile.player.gender ?? 'male',
    hasFix,
    homeCellCenter: getHomeCampCenter(),
    activePoiId: app.view.location?.insidePoi?.id ?? null,
    drops: worldDrops,
    traps: app.profile.player.traps,
  });
}

// ---------------------------------------------------------------- lời dẫn của Lạc Lạc

function showNextBeat()       {
  if (app.narrationOpen || !app.profile) return;

  const beat = app.narrationQueue.shift();
  if (!beat) return;

  app.narrationOpen = true;
  el('narration-text').textContent = beat.textVi;
  el('overlay-narration').hidden = false;

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
    afterAction();
  },

  onCollectCrafts() {
    if (!app.profile) return;
    const result = collectCrafts(app.profile, now());
    app.profile = result.profile;
    for (const message of result.messagesVi) toast(message, 'good');
    afterAction();
  },

  onUpgradeCamp() {
    if (!app.profile) return;
    const result = upgradeCamp(app.profile, now());
    app.profile = result.profile;
    toast(result.messageVi, result.ok ? 'good' : 'bad');
    afterAction();
  },

  onConsume(itemId) {
    if (!app.profile) return;
    const result = consume(app.profile, itemId, now());
    app.profile = result.profile;
    toast(result.messageVi, result.ok ? 'good' : 'bad');
    afterAction();
  },

  onStoreSafe(itemId, qty) {
    if (!app.profile) return;
    const result = storeInSafe(app.profile, [{ itemId, qty }]);
    app.profile = result.profile;
    toast(result.messageVi, result.ok ? 'good' : 'bad');
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
      if (result.ok && app.profile.settings.haptics) buzz(20);
      afterAction();
    };

    const action = findAction(actionId);
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

    const offers = merchantOffers(app.profile.player.carried);
    const affordable = offers.find((offer) => offer.affordable);
    if (!affordable) {
      toast(`Chưa đủ hàng để đổi. Ví dụ: ${offers[0]?.labelVi ?? '—'}`, 'bad');
      return;
    }

    const result = trade(app.profile, affordable.index, poiId, now());
    app.profile = result.profile;
    toast(result.messageVi, result.ok ? 'good' : 'bad');
    afterAction();
  },

  onSleep() {
    if (!app.profile) return;
    const result = app.profile.player.survival.asleep
      ? wakeUp(app.profile, now())
      : sleepAtCamp(app.profile, now());
    app.profile = result.profile;
    toast(result.messageVi);
    afterAction();
  },

  onNightDefense() {
    if (!app.profile || !app.view) return;

    openNightDefense(app.view, {
      resolve(performance) {
        const result = runNightDefense(app.profile , now(), performance, performance > 0);
        app.profile = result.profile;
        persist();
        render();
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
    if (!confirm('Xoá hồ sơ này? Không khôi phục được nếu bạn chưa xuất file sao lưu.')) return;

    app.save = putProfile(app.save, app.save.activeSlot, null);
    app.profile = null;
    persist();
    renderProfileScreen();
  },

  onSwitchProfile() {
    persist();
    app.profile = null;
    renderProfileScreen();
  },
};

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

    if (isMap) mapView?.resize();
  }

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

  // Nút Quay Về Giữa Bản Đồ
  el('btn-recenter').onclick = () => {
    mapView?.recenter();
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

  el('narration-next').onclick = () => {
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

  // Bấm vào cảnh vật trên bản đồ để xem thông tin
  el                   ('map-canvas').onclick = (event) => {
    if (!app.view || !app.profile) return;

    const canvas = el                   ('map-canvas');
    const rect = canvas.getBoundingClientRect();
    const feature = featureAtPoint(
      app.view.mapFeatures,
      currentPosition().render,
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      canvas,
    );
    if (!feature) return;

    toast(`${feature.nameVi} — ${feature.kind === 'poi' ? 'điểm tài nguyên thật' : 'cảnh vật hoang dã'}`);
  };

  wirePedometerPanel();
}

function wirePedometerPanel()       {
  const panel = el('pedometer-panel');
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
    createProfileInSlot(slot        , name        , gender         = 'male') {
      app.save = putProfile(app.save, slot, createProfile(name, now(), gender));
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
