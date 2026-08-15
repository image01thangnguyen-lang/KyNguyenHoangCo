/**
 * Vẽ các bảng giao diện. Thuần đọc trạng thái và ghi DOM — mọi thay đổi trạng thái đều đi
 * qua callback trả về `main.ts`, để không có chỗ nào trong tầng UI tự sửa save.
 */

import {
  CAMP_TIERS,
  DEFENSE_STRUCTURES,
  actionsFor,
  dailyLimitFor,
  describeInventory,
  findItem,
  getCampTier,
  getItem,
  getCropDef,
  getPetDef,
  createInitialFarmPlots,
  getActiveLunarEvent,
  CHAPTERS,
  NPC_SHOP_CATALOG,
  ITEM_SELL_PRICES,
  countOf,
  getArtisanRank,
  ARTISAN_RANKS,
  SAFE_VAULT_TIERS,
  getSafeCapacity,
  slotsUsed,
  FISH_TRAP_TIERS,
  getFishTrapTier,
  getWeekendQuestBoard,
  isWeekend,
  calculateCarriedWeight,
  maxWeightCapacity,
  isOverburdened,
} from '../../../packages/game-core/src/index.ts';
import { actionIconSvg, itemIconSvg, zoneIconSvg, coinIconSvg } from './itemIcons.ts';
import { audio } from './audio.ts';
import type {
  GameView,
  GatherActionDef,
  ProfileSave,
  RecipeView,
  ZoneId,
} from '../../../packages/game-core/src/index.ts';

export function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Thiếu phần tử #${id} trong index.html`);
  return node as T;
}

export interface Handlers {
  onCraft(recipeId: string): void;
  onCollectCrafts(): void;
  onUpgradeCamp(): void;
  onConsume(itemId: string): void;
  onStoreSafe(itemId: string, qty: number): void;
  onWithdrawSafe?(itemId: string, qty: number): void;
  onUpgradeSafeVault?(): void;
  onQuickStorePrecious?(): void;
  onGather(actionId: string, poiId: string, zone: ZoneId): void;
  onTrade(index: number, poiId: string): void;
  onSleep(): void;
  onNightDefense(): void;
  onBloodMoon(): void;
  onPlaceTrap(trapItemId: 'rabbit_trap' | 'deer_trap' | 'beast_trap' | 'fish_trap'): void;
  onUpgradeFishTrap?(): void;
  onStartIncubate(eggItemId: string): void;
  onFeedPet(petId: string, foodItemId: string): void;
  onPlantCrop(plotIndex: number, cropId: string): void;
  onWaterPlot(plotIndex: number): void;
  onFertilizePlot?(plotIndex: number): void;
  onHarvestPlot(plotIndex: number): void;
  onUpgradeArtisan?(): void;
  onOpenAR?(): void;
  onOpenCoop?(): void;
  onClaimWeekendQuest?(questId: string): void;
  onToggleSetting(key: 'parentalNightLock' | 'realWeatherSync' | 'narrationAudio' | 'haptics'): void;
  onExport(): void;
  onImport(): void;
  onDeleteProfile(): void;
  onSwitchProfile(): void;
}

// ---------------------------------------------------------------- HUD

export function renderHud(view: GameView, profile: ProfileSave): void {
  const { survival } = profile.player;

  el('hud-time').textContent = `${String(view.localTime.hour).padStart(2, '0')}:${String(view.localTime.minute).padStart(2, '0')}`;
  el('hud-phase').textContent =
    view.phase === 'night' ? 'Đêm' : view.phase === 'evening' ? 'Chiều tối' : 'Ban ngày';
  el('hud-weather').textContent = `${weatherIcon(view)} ${view.weather.conditionNameVi}`;
  el('hud-steps').textContent = `${profile.player.steps.totalSteps.toLocaleString('vi-VN')} bước`;

  setBar('satiety', survival.satiety);
  setBar('hydration', survival.hydration);
  setBar('hp', survival.hp);

  const warningsList: string[] = [...view.survivalWarningsVi];
  if (profile.clock.skewCount > 0) {
    warningsList.push('Đồng hồ máy đang chạy sau mốc thời gian đã lưu. Các sự kiện theo lịch tạm khoá đến khi giờ máy đúng lại.');
  }

  const warnings = el('hud-warnings');
  warnings.replaceChildren(
    ...warningsList.map((text) => {
      const span = document.createElement('span');
      span.textContent = text;
      return span;
    }),
  );

  renderBloodMoonStrip(view);

  const hasWarnings = warningsList.length > 0;
  const hasBloodMoon = !el('hud-bloodmoon').hidden;
  const badge = document.getElementById('notif-badge');
  if (badge) {
    badge.hidden = !hasWarnings && !hasBloodMoon;
  }
  const emptyNotif = document.getElementById('notif-empty');
  if (emptyNotif) {
    emptyNotif.hidden = hasWarnings || hasBloodMoon;
  }

  // Thanh hướng dẫn Tân Thủ 3 Ngày Đầu
  const tutBanner = document.getElementById('tutorial-hud-banner');
  if (tutBanner) {
    if (profile.story.tutorialDay > 0) {
      tutBanner.hidden = false;
      const tutDay = profile.story.tutorialDay;
      const tutBadge = el('tut-badge');
      const tutText = el('tut-text');
      tutBadge.textContent = `NGÀY ${tutDay}/3`;
      if (tutDay === 1) {
        tutText.innerHTML = `🔥 <strong>Nhiệm vụ:</strong> Đi dạo nhặt 8 cành khô &amp; 4 đá nhọn để dựng <strong>Lửa Trại</strong> trước 20:00!`;
      } else if (tutDay === 2) {
        tutText.innerHTML = `💧 <strong>Nhiệm vụ:</strong> Đun sôi nước uống và chế tạo <strong>Rìu Đá</strong> để đốn củi công viên!`;
      } else {
        tutText.innerHTML = `🛡️ <strong>Nhiệm vụ:</strong> Đặt <strong>Bẫy Thỏ</strong> và chuẩn bị thủ trại, quái thú sẽ tấn công lúc 20:00!`;
      }
    } else {
      tutBanner.hidden = true;
    }
  }
}

function setBar(name: 'satiety' | 'hydration' | 'hp', value: number): void {
  const fill = el(`bar-${name}`);
  fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
  el(`val-${name}`).textContent = String(Math.round(value));
  fill.closest('.bar')?.classList.toggle('is-critical', value <= 20);
}

function weatherIcon(view: GameView): string {
  if (view.weather.raining) return '🌧️';
  if (view.weather.hot) return '🔆';
  if (view.weather.cold) return '❄️';
  return view.phase === 'night' ? '🌙' : '☀️';
}

function renderBloodMoonStrip(view: GameView): void {
  const strip = el('hud-bloodmoon');
  const show = view.bloodMoon.active || view.bloodMoon.makeupAvailable;

  strip.hidden = !show && view.bloodMoon.msUntil > 36 * 3_600_000;
  if (strip.hidden) return;

  strip.replaceChildren();
  const label = document.createElement('span');
  label.textContent = `🌕 ${view.bloodMoon.labelVi}`;
  strip.append(label);

  if (show) {
    const button = document.createElement('button');
    button.className = 'btn btn--tiny';
    button.textContent = 'Vào trận';
    button.dataset.action = 'bloodmoon';
    strip.append(button);
  }
}

// ---------------------------------------------------------------- bản đồ: vùng + hành động

export function renderZonePanel(view: GameView, profile: ProfileSave): void {
  const box = el('map-zone');
  const location = view.location;
  const zone: ZoneId = location?.zone ?? 'wilderness';

  if (!location) {
    box.innerHTML = `
      <span class="map-zone__icon">${zoneIconSvg(zone)}</span>
      <span class="map-zone__name">Vùng hoang dã</span>
      <span class="map-zone__mult">1.2×</span>`;
  } else {
    const poi = location.insidePoi ? ` · ${location.insidePoi.nameVi}` : '';
    box.innerHTML = `
      <span class="map-zone__icon">${zoneIconSvg(zone)}</span>
      <span class="map-zone__name">${location.zoneNameVi}${poi}</span>
      <span class="map-zone__mult">${location.pickupMultiplier}×</span>`;
  }

  const banner = el('safety-banner');
  if (view.poiLocked) {
    banner.hidden = false;
    banner.textContent = view.poiLockReasonVi ?? '';
  } else {
    banner.hidden = true;
  }
}

export function renderZoneActions(view: GameView, profile: ProfileSave, handlers: Handlers): void {
  const bar = el('zone-actions');
  bar.replaceChildren();

  const zone: ZoneId = view.location?.zone ?? 'wilderness';
  const poiId = view.location?.insidePoi?.id ?? view.location?.cell.id ?? 'wild';

  for (const action of actionsFor(zone)) {
    if (action.id === 'merchant_trade') continue;
    bar.append(actionButton(action, () => handlers.onGather(action.id, poiId, zone), profile));
  }

  const insidePoi = view.location?.insidePoi;
  const isMerchantZone = zone === 'merchant' || insidePoi?.zone === 'merchant';

  if (isMerchantZone) {
    const poiName = insidePoi ? insidePoi.nameVi : 'Thương Nhân Hoang Cổ';
    const button = document.createElement('button');
    button.className = 'btn btn--action';
    button.style.borderColor = '#f59e0b';
    button.innerHTML = `
      <span class="action-btn__icon">${actionIconSvg('merchant_trade')}</span>
      <div class="action-btn__body">🏺 Tiệm ${poiName.slice(0, 16)}<small>Mua & bán với NPC</small></div>`;
    button.onclick = () => handlers.onTrade(-1, poiId);
    bar.append(button);
  }

  if (view.phase === 'night' || view.phase === 'evening') {
    const defend = document.createElement('button');
    defend.className = 'btn btn--action';
    defend.innerHTML = `
      <span class="action-btn__icon">${actionIconSvg('night_defend')}</span>
      <div class="action-btn__body">Thủ trại<small>${view.tonight.verdictVi.slice(0, 24)}…</small></div>`;
    defend.onclick = handlers.onNightDefense;
    bar.append(defend);
  }

  const sleep = document.createElement('button');
  sleep.className = 'btn btn--action';
  sleep.innerHTML = `
    <span class="action-btn__icon">${actionIconSvg('sleep')}</span>
    <div class="action-btn__body">${profile.player.survival.asleep ? 'Thức dậy' : 'Ngủ tại trại'}<small>${profile.player.survival.asleep ? '—' : 'hồi thể lực'}</small></div>`;
  sleep.onclick = handlers.onSleep;
  bar.append(sleep);

  const badge = document.getElementById('action-count-badge');
  if (badge) {
    const count = bar.children.length;
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }
}

function actionButton(action: GatherActionDef, onClick: () => void, profile: ProfileSave): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'btn btn--action';
  const dailyLimit = dailyLimitFor(action, profile.player.steps.totalSteps);

  const needs = action.requiresTool
    ? `cần ${getItem(action.requiresTool).nameVi}`
    : action.cooldownMinutes
      ? `hồi chiêu ${action.cooldownMinutes}′`
      : dailyLimit
        ? `${dailyLimit} lượt/ngày`
        : 'sẵn sàng';

  button.innerHTML = `
    <span class="action-btn__icon">${actionIconSvg(action.id)}</span>
    <div class="action-btn__body">${action.nameVi}<small>${needs}</small></div>`;
  button.disabled =
    action.requiresTool !== undefined && (profile.player.carried[action.requiresTool] ?? 0) < 1;
  button.onclick = onClick;
  return button;
}

// ---------------------------------------------------------------- chế tạo

export function openCraftInspector(
  entry: RecipeView,
  profile: ProfileSave,
  handlers: Handlers,
): void {
  const overlay = el('overlay-craft-inspect');
  const iconEl = el('craft-inspect-icon');
  const nameEl = el('craft-inspect-name');
  const stationEl = el('craft-inspect-station');
  const descEl = el('craft-inspect-desc');
  const needsEl = el('craft-inspect-needs');
  const timeEl = el('craft-inspect-time');
  const tierEl = el('craft-inspect-tier');
  const btnSubmit = el<HTMLButtonElement>('btn-craft-submit');
  const btnClose = el('btn-craft-inspect-close');

  const outputId = entry.recipe.outputId || entry.recipe.id;
  const itemDef = findItem(outputId);
  const rank = getArtisanRank(profile.player.lifetime.craftCount ?? 0, profile.player.artisanLevel ?? 1);
  const isQueueFull = profile.craftJobs.length >= rank.maxConcurrentSlots;
  const durationSec = Math.max(1, Math.round(entry.recipe.seconds * rank.speedMultiplier));

  iconEl.innerHTML = itemIconSvg(outputId, 'inspect-svg');
  nameEl.textContent = entry.recipe.nameVi;
  
  if (entry.recipe.station) {
    const stationNames: Record<string, string> = {
      campfire: '🔥 Lửa trại',
      drying_rack: '🪵 Giá phơi',
      kiln: '🧱 Lò nung',
      forge: '⚒️ Lò rèn',
      bronze_furnace: '🏺 Lò luyện đồng Đông Sơn',
      altar_of_dragons: '🐉 Đền thờ Thần Long',
    };
    stationEl.textContent = `Yêu cầu trạm: ${stationNames[entry.recipe.station] ?? entry.recipe.station}`;
  } else {
    stationEl.textContent = '✨ Chế tạo tự do (không cần trạm)';
  }

  descEl.textContent = (itemDef as any)?.descVi || 'Công thức chế tạo sinh tồn thời kỳ hoang cổ.';
  timeEl.textContent = `⏱️ ${formatDuration(durationSec)}${rank.speedMultiplier < 1 ? ` (⚡ -${Math.round((1 - rank.speedMultiplier) * 100)}% TG)` : ''}`;
  tierEl.textContent = `Cấp ${entry.recipe.tier} (${getCampTier(entry.recipe.tier)?.nameVi ?? `Cấp ${entry.recipe.tier}`})`;

  // Danh sách nguyên liệu
  needsEl.replaceChildren();
  for (const input of entry.recipe.inputs) {
    const inputDef = findItem(input.itemId);
    const have = profile.player.carried[input.itemId] ?? 0;
    const isMissing = have < input.qty;

    const row = document.createElement('div');
    row.style.cssText = `display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border-radius:6px;background:${isMissing ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)'};border:1px solid ${isMissing ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'};font-size:0.82rem;`;
    row.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="width:20px;height:20px;display:flex;align-items:center;justify-content:center;">${itemIconSvg(input.itemId, 'mini-svg')}</span>
        <strong style="color:${isMissing ? '#fca5a5' : '#86efac'};">${inputDef?.nameVi ?? input.itemId}</strong>
      </div>
      <span style="font-weight:700;color:${isMissing ? '#f87171' : '#4ade80'};">${have}/${input.qty}</span>
    `;
    needsEl.append(row);
  }

  if (entry.locked) {
    btnSubmit.disabled = true;
    btnSubmit.style.opacity = '0.5';
    btnSubmit.style.cursor = 'not-allowed';
    btnSubmit.textContent = `🔒 ${entry.lockReasonVi}`;
  } else if (isQueueFull) {
    btnSubmit.disabled = true;
    btnSubmit.style.opacity = '0.5';
    btnSubmit.style.cursor = 'not-allowed';
    btnSubmit.textContent = `⚠️ Hàng đợi đã đầy (${profile.craftJobs.length}/${rank.maxConcurrentSlots} ô)`;
  } else if (!entry.craftable) {
    btnSubmit.disabled = true;
    btnSubmit.style.opacity = '0.5';
    btnSubmit.style.cursor = 'not-allowed';
    btnSubmit.textContent = '❌ Chưa đủ nguyên liệu';
  } else {
    btnSubmit.disabled = false;
    btnSubmit.style.opacity = '1';
    btnSubmit.style.cursor = 'pointer';
    btnSubmit.textContent = '🔨 Bắt đầu chế tạo ngay';
    btnSubmit.onclick = () => {
      handlers.onCraft(entry.recipe.id);
      overlay.hidden = true;
    };
  }

  btnClose.onclick = () => {
    overlay.hidden = true;
  };

  overlay.hidden = false;
}

export function renderCraft(
  view: GameView,
  profile: ProfileSave,
  handlers: Handlers,
  onlyCraftable: boolean = false,
): void {
  const jobs = el('craft-jobs');
  jobs.replaceChildren();

  // 1. Thẻ Cấp Bậc Thợ Thủ Công Hoang Cổ (Artisan Mastery Card)
  const rank = getArtisanRank(profile.player.lifetime.craftCount ?? 0, profile.player.artisanLevel ?? 1);
  const rankCard = document.createElement('div');
  rankCard.className = 'artisan-rank-card';
  rankCard.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:1.6rem;filter:drop-shadow(0 2px 6px rgba(245,158,11,0.5));">${rank.icon}</span>
        <div>
          <div style="font-size:0.95rem;font-weight:800;color:#fef08a;">Cấp ${rank.level}: ${rank.titleVi}</div>
          <div style="font-size:0.75rem;color:var(--ink-dim);">${rank.descVi}</div>
        </div>
      </div>
      <span class="chip chip--warn" style="font-size:0.72rem;padding:3px 8px;font-weight:700;">${profile.craftJobs.length}/${rank.maxConcurrentSlots} ô đang làm</span>
    </div>
    ${rank.nextCrafts ? `
    <div style="margin-top:8px;">
      <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--ink-dim);margin-bottom:3px;">
        <span>Tiến độ lên <strong>${ARTISAN_RANKS[rank.level]?.titleVi}</strong></span>
        <span>${rank.currentCrafts}/${rank.nextCrafts} lần (${rank.progressPercent}%)</span>
      </div>
      <div style="height:6px;background:rgba(0,0,0,0.5);border-radius:3px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
        <div style="height:100%;width:${rank.progressPercent}%;background:linear-gradient(90deg, #f59e0b, #10b981);border-radius:3px;transition:width 0.3s ease;"></div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08);">
      <span style="font-size:0.75rem;color:var(--ink-muted);">Dùng <strong>${rank.upgradeCostGold} ${coinIconSvg(14)}</strong> để tấn phong ngay</span>
      <button class="btn btn--tiny btn--primary btn-artisan-upgrade" style="padding:4px 10px;font-size:0.75rem;display:inline-flex;align-items:center;gap:4px;">${coinIconSvg(14)} Tấn phong (${rank.upgradeCostGold} ${coinIconSvg(12)})</button>
    </div>
    ` : `
    <div style="font-size:0.72rem;color:#4ade80;margin-top:6px;font-weight:700;">👑 Đã đạt cấp bậc tối thượng — Đại sư hoang cổ!</div>
    `}
  `;

  rankCard.querySelector('.btn-artisan-upgrade')?.addEventListener('click', () => {
    handlers.onArtisanUpgradeGold?.();
  });

  jobs.append(rankCard);

  for (const job of profile.craftJobs) {
    const ready = (view.nowMs ?? 0) >= job.readyAtMs;
    const row = document.createElement('div');
    row.className = `row${ready ? ' is-ready' : ''}`;
    const seconds = Math.max(0, Math.ceil((job.readyAtMs - (view.nowMs ?? 0)) / 1000));
    row.innerHTML = `
      <div class="row__body">
        <div class="row__title">${nameOfRecipe(view, job.recipeId)}</div>
        <div class="row__sub">${ready ? '✨ Xong — bấm để thu sản phẩm' : `⏱️ Đang chế tác (còn ${formatDuration(seconds)})`}</div>
      </div>
    `;

    if (ready) {
      const button = document.createElement('button');
      button.className = 'btn btn--tiny btn--primary';
      button.textContent = 'Thu nhận';
      button.onclick = handlers.onCollectCrafts;
      row.append(button);
    }
    jobs.append(row);
  }

  const list = el('craft-list');
  list.replaceChildren();

  const visible = onlyCraftable ? view.recipes.filter((r) => r.craftable) : view.recipes;
  const byTier = new Map<number, RecipeView[]>();
  for (const entry of visible) {
    const bucket = byTier.get(entry.recipe.tier) ?? [];
    bucket.push(entry);
    byTier.set(entry.recipe.tier, bucket);
  }

  // Duyệt qua TẤT CẢ các cấp độ (Cấp 1 đến Cấp 5)
  const allTiers = Array.from(
    new Set([
      ...CAMP_TIERS.map((t) => t.level),
      ...Array.from(byTier.keys()),
    ])
  ).sort((a, b) => a - b);

  for (const tier of allTiers) {
    const entries = byTier.get(tier);
    if (!entries?.length) continue;

    const campTierDef = CAMP_TIERS.find((t) => t.level === tier);
    const tierName = campTierDef ? campTierDef.nameVi : `Cấp ${tier}`;
    const eraName = campTierDef?.eraVi ? ` • ${campTierDef.eraVi}` : '';

    const heading = document.createElement('h3');
    heading.className = 'section-title';
    heading.textContent = `Cấp ${tier} — ${tierName}${eraName}`;
    list.append(heading);

    const grid = document.createElement('div');
    grid.className = 'craft-slot-grid';

    for (const entry of entries) {
      const outputId = entry.recipe.outputId || entry.recipe.id;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `craft-slot-card${entry.locked ? ' is-locked' : entry.craftable ? ' is-craftable' : ' is-missing'}`;
      
      const badgeText = entry.locked
        ? '🔒 Khoá'
        : entry.craftable
        ? '✨ Làm được'
        : 'Thiếu đồ';

      card.innerHTML = `
        <div class="craft-slot-icon">${itemIconSvg(outputId, 'card-svg')}</div>
        <div class="craft-slot-title">${entry.recipe.nameVi}</div>
        <span class="craft-slot-badge ${entry.locked ? 'badge-locked' : entry.craftable ? 'badge-craftable' : 'badge-missing'}">${badgeText}</span>
      `;

      card.onclick = () => openCraftInspector(entry, profile, handlers);
      grid.append(card);
    }

    list.append(grid);
  }

  if (!list.children.length) {
    const empty = document.createElement('p');
    empty.className = 'fineprint';
    empty.style.textAlign = 'center';
    empty.style.padding = '24px 0';
    empty.textContent = 'Chưa đủ nguyên liệu cho công thức nào. Hãy đi bộ khám phá xung quanh để nhặt thêm tài nguyên!';
    list.append(empty);
  }
}

function nameOfRecipe(view: GameView, recipeId: string): string {
  return view.recipes.find((r) => r.recipe.id === recipeId)?.recipe.nameVi ?? recipeId;
}

// ---------------------------------------------------------------- doanh trại

export function renderCamp(view: GameView, profile: ProfileSave, handlers: Handlers): void {
  const camp = profile.player.camp;
  const tier = getCampTier(camp.level);

  // Kiểm tra sự kiện Lịch Âm Hoang Cổ
  const lunarEvent = getActiveLunarEvent(view.nowMs);
  let lunarHtml = '';
  if (lunarEvent) {
    lunarHtml = `
      <div class="lunar-banner">
        <div class="lunar-banner__title">🎉 ${lunarEvent.nameVi} (Ngày ${lunarEvent.lunarDate.day}/${lunarEvent.lunarDate.month} Âm Lịch)</div>
        <div class="lunar-banner__desc">${lunarEvent.descVi}</div>
      </div>
    `;
  }

  el('camp-summary').innerHTML = `
    ${lunarHtml}
    <h2>${tier.nameVi}</h2>
    <p>${tier.eraVi} · Sức phòng thủ nền ${tier.baseDefense} · Kho ${view.storageUsed}/${tier.storageSlots} ô</p>
    <p>${view.tonight.verdictVi}</p>
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
      <button id="btn-camp-ar" class="btn btn--tiny btn--primary" style="flex:1;min-width:140px;">📸 Chụp Ảnh AR</button>
      <button id="btn-camp-coop" class="btn btn--tiny" style="flex:1;min-width:140px;background:#78350f;color:#fef08a;border-color:#f59e0b;">⚔️ Đấu Boss Co-op</button>
    </div>
  `;

  const btnAr = document.getElementById('btn-camp-ar');
  if (btnAr && handlers.onOpenAR) btnAr.onclick = handlers.onOpenAR;

  const btnCoop = document.getElementById('btn-camp-coop');
  if (btnCoop && handlers.onOpenCoop) btnCoop.onclick = handlers.onOpenCoop;

  // Bảng thống kê sinh tồn & kỷ lục cá nhân
  const statsBox = el('camp-stats');
  const days = profile.player.lifetime.daysPlayed;
  const steps = profile.player.lifetime.steps;
  const defWins = profile.player.lifetime.nightDefenseWins;
  const bmWins = profile.player.lifetime.bloodMoonWins;

  statsBox.innerHTML = `
    <div class="stats-panel" style="background:rgba(0,0,0,0.35);border:1px solid rgba(217,119,6,0.25);border-radius:8px;padding:10px 12px;margin-bottom:12px;">
      <div style="font-weight:700;color:var(--gold);font-size:0.92rem;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
        <span>🏆 BẢNG KỶ LỤC &amp; THÀNH TÍCH SINH TỒN</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.85rem;">
        <div style="background:rgba(255,255,255,0.04);padding:6px 8px;border-radius:6px;">
          <span style="color:var(--ink-muted);font-size:0.75rem;display:block;">SỐ NGÀY SINH TỒN</span>
          <strong style="color:#fde047;font-size:1.05rem;">${days} ngày</strong>
        </div>
        <div style="background:rgba(255,255,255,0.04);padding:6px 8px;border-radius:6px;">
          <span style="color:var(--ink-muted);font-size:0.75rem;display:block;">TỔNG BƯỚC CHÂN</span>
          <strong style="color:#38bdf8;font-size:1.05rem;">${steps.toLocaleString('vi-VN')}</strong>
        </div>
        <div style="background:rgba(255,255,255,0.04);padding:6px 8px;border-radius:6px;">
          <span style="color:var(--ink-muted);font-size:0.75rem;display:block;">THẮNG THỦ ĐÊM</span>
          <strong style="color:#4ade80;font-size:1.05rem;">${defWins} đêm</strong>
        </div>
        <div style="background:rgba(255,255,255,0.04);padding:6px 8px;border-radius:6px;">
          <span style="color:var(--ink-muted);font-size:0.75rem;display:block;">DIỆT BOSS TRĂNG MÁU</span>
          <strong style="color:#f87171;font-size:1.05rem;">${bmWins} boss</strong>
        </div>
      </div>
    </div>
  `;

  renderPets(profile, handlers);
  renderFarming(view, profile, handlers);
  renderUpgrade(view, profile, handlers);
  renderDefense(profile);
  renderSafeVaultSection(profile, handlers);
  renderInventory('inv-safe', profile.player.safeStorage, handlers, false);
  renderInventory('inv-carried', profile.player.carried, handlers, true);
}

export function renderSafeVaultSection(profile: ProfileSave, handlers: Handlers): void {
  const box = el('camp-safe-vault');
  if (!box) return;

  const currentLevel = Math.max(1, profile.player.safeVaultLevel ?? 1);
  const currentTier = SAFE_VAULT_TIERS.find((t) => t.level === currentLevel) ?? SAFE_VAULT_TIERS[0];
  const maxCapacity = getSafeCapacity(profile.player.camp.level, currentLevel);
  const usedSlots = slotsUsed(profile.player.safeStorage ?? {});
  const currentGold = countOf(profile.player.carried, 'ancient_coin');

  const isMaxLevel = currentLevel >= SAFE_VAULT_TIERS.length;
  const nextTier = !isMaxLevel ? SAFE_VAULT_TIERS[currentLevel] : null;

  const ratio = Math.min(1, usedSlots / maxCapacity);
  const percent = Math.round(ratio * 100);

  box.innerHTML = `
    <div class="safe-vault-card" style="background:linear-gradient(135deg, rgba(35,26,18,0.95), rgba(18,14,10,0.95));border:1.5px solid rgba(251,191,36,0.35);border-radius:12px;padding:12px 14px;margin-bottom:14px;box-shadow:0 6px 20px rgba(0,0,0,0.5);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:1.6rem;">🏛️</span>
          <div>
            <div style="font-weight:800;color:#fef08a;font-size:1.02rem;">KÉT AN TOÀN — ${currentTier.nameVi}</div>
            <div style="font-size:0.78rem;color:var(--gold-faint);">Cấp ${currentLevel} · Vật phẩm trong két không bao giờ mất</div>
          </div>
        </div>
        <span class="chip chip--warn" style="font-weight:700;">${usedSlots} / ${maxCapacity} ô</span>
      </div>

      <div class="bar__track" style="height:7px;margin:8px 0;background:rgba(0,0,0,0.5);">
        <div class="bar__fill" style="width:${percent}%;background:${percent > 85 ? '#ef4444' : 'linear-gradient(90deg, #f59e0b, #fbbf24)'};"></div>
      </div>

      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
        ${
          !isMaxLevel && nextTier
            ? `
          <button id="btn-upgrade-safe-vault" class="btn btn--primary" style="flex:1;font-size:0.85rem;padding:8px 12px;min-width:200px;">
            ⬆️ Nâng lên ${nextTier.nameVi} (${nextTier.slots} ô) — ${nextTier.upgradeCostGold} 🪙
          </button>
        `
            : `
          <div class="chip" style="flex:1;text-align:center;color:#4ade80;background:rgba(74,222,128,0.1);border-color:rgba(74,222,128,0.3);padding:8px 10px;">
            ✨ Đạt cấp tối thượng (Thần Kho Bất Diệt)
          </div>
        `
        }
        <button id="btn-quick-safe-transfer" class="btn btn--ghost" style="font-size:0.82rem;padding:8px 12px;" title="Tự động cất nguyên liệu quý, đồng vàng và bản vẽ vào két">
          ⚡ Cất nhanh đồ quý
        </button>
      </div>
    </div>
  `;

  const btnUp = box.querySelector<HTMLButtonElement>('#btn-upgrade-safe-vault');
  if (btnUp && nextTier) {
    btnUp.disabled = currentGold < nextTier.upgradeCostGold;
    btnUp.onclick = () => handlers.onUpgradeSafeVault?.();
  }

  const btnQuick = box.querySelector<HTMLButtonElement>('#btn-quick-safe-transfer');
  if (btnQuick) {
    btnQuick.onclick = () => handlers.onQuickStorePrecious?.();
  }
}

function renderUpgrade(view: GameView, profile: ProfileSave, handlers: Handlers): void {
  const box = el('camp-upgrade');
  const progress = view.upgrade;

  if (!progress) {
    box.innerHTML = '<strong>Pháo Đài Đá Cổ</strong><p class="fineprint">Đã là cấp cao nhất hiện có.</p>';
    return;
  }

  if (profile.player.camp.upgradeCompleteAtMs !== null) {
    const seconds = Math.max(0, Math.ceil((profile.player.camp.upgradeCompleteAtMs - view.nowMs) / 1000));
    box.innerHTML = `<strong>Đang nâng cấp…</strong><p class="fineprint">Xong sau ${formatDuration(seconds)}.</p>`;
    return;
  }

  const nextLevel = profile.player.camp.level + 1;
  const next = CAMP_TIERS.find((t) => t.level === nextLevel);
  box.replaceChildren();

  const header = document.createElement('div');
  header.className = 'upgrade__header';
  header.innerHTML = `
    <div class="upgrade__icon">${itemIconSvg('camp_tier_' + nextLevel, 'tier-svg')}</div>
    <div class="upgrade__meta">
      <strong>Nâng cấp lên ${next?.nameVi ?? 'cấp sau'}</strong>
      <span>${next?.eraVi ?? ''} · Kho ${next?.storageSlots ?? ''} ô</span>
    </div>`;
  box.append(header);

  const bar = document.createElement('div');
  bar.className = 'progress';
  bar.innerHTML = `<div style="width:${Math.round(progress.ratio * 100)}%"></div>`;
  box.append(bar);

  const needs = document.createElement('div');
  needs.className = 'upgrade__needs';
  for (const need of progress.needs) {
    const isMet = need.have >= need.qty;
    const item = findItem(need.itemId);
    const chip = document.createElement('div');
    chip.className = `need-chip ${isMet ? 'is-met' : 'is-missing'}`;
    chip.innerHTML = `
      <span class="need-chip__icon">${itemIconSvg(need.itemId, 'mini-svg')}</span>
      <span>${item?.nameVi ?? need.itemId}:</span>
      <strong class="need-chip__qty">${need.have}/${need.qty}</strong>`;
    needs.append(chip);
  }
  box.append(needs);

  const button = document.createElement('button');
  button.className = 'btn btn--primary';
  button.textContent = 'Nâng cấp';
  button.disabled = progress.ratio < 1;
  button.onclick = handlers.onUpgradeCamp;
  box.append(button);
}

function renderDefense(profile: ProfileSave): void {
  const box = el('camp-defense');
  const built = Object.entries(profile.player.camp.defenseStructures).filter(([, n]) => n);

  const grid = built.length
    ? `<div class="defense-grid">` +
      built
        .map(([id, count]) => {
          const def = DEFENSE_STRUCTURES.find((d) => d.id === id);
          return `
            <div class="defense-card">
              <div class="defense-card__icon">${itemIconSvg(id, 'mini-svg')}</div>
              <div class="defense-card__body">
                <strong class="defense-card__name">${def?.nameVi ?? id}</strong>
                <div class="defense-card__meta">
                  <span>×${count}</span>
                  <span>🛡️ +${(def?.defense ?? 0) * count}</span>
                </div>
              </div>
            </div>`;
        })
        .join('') +
      `</div>`
    : '<p class="fineprint">Chưa có công trình phòng thủ nào.</p>';

  const stationNames: Record<string, string> = {
    campfire: 'Lửa trại',
    drying_rack: 'Giá phơi thịt',
    kiln: 'Lò nung',
    forge: 'Lò rèn',
  };

  const stations = profile.player.camp.stations.length
    ? `<div class="stations-list">` +
      profile.player.camp.stations
        .map(
          (st) =>
            `<div class="station-chip">${itemIconSvg(st, 'mini-svg')}<span>${stationNames[st] ?? st}</span></div>`,
        )
        .join('') +
      `</div>`
    : '<p class="fineprint">Chưa dựng trạm nào.</p>';

  box.innerHTML = `
    <strong>Công trình phòng thủ</strong>
    ${grid}
    <div style="margin-top: 10px;"><strong>Trạm chế tạo đã mở</strong></div>
    ${stations}`;
}

function renderPets(profile: ProfileSave, handlers: Handlers): void {
  const box = el('camp-pets');
  box.replaceChildren();

  const title = document.createElement('h3');
  title.className = 'section-title';
  title.style.cssText = 'display:flex;align-items:center;gap:6px;margin:12px 0 6px 0;color:var(--gold);';
  title.innerHTML = `<span>🐾 Linh Thú Đồng Hành</span>`;
  box.append(title);

  // 1. Hiển thị trứng đang ấp
  const inc = profile.player.incubatingEgg;
  if (inc && !inc.hatched) {
    const eggCard = document.createElement('div');
    eggCard.style.cssText = 'background:rgba(217,119,6,0.12);border:1px solid rgba(217,119,6,0.35);border-radius:8px;padding:10px;margin-bottom:8px;';
    const percent = Math.min(100, Math.round((inc.currentSteps / inc.requiredSteps) * 100));
    eggCard.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <strong style="color:var(--gold);font-size:0.9rem;">🥚 Đang ấp Trứng Thú Cổ</strong>
        <span style="font-size:0.8rem;color:var(--ink-muted);">${inc.currentSteps.toLocaleString('vi-VN')}/${inc.requiredSteps.toLocaleString('vi-VN')} bước (${percent}%)</span>
      </div>
      <div class="bar__track" style="height:6px;margin:6px 0;"><div class="bar__fill" style="width:${percent}%;background:var(--gold);"></div></div>
      <p class="fineprint" style="margin:0;">Đi bộ ngoài đời thực để truyền hơi ấm giúp trứng sớm nở thành Linh Thú!</p>
    `;
    box.append(eggCard);
  } else {
    // Nếu có trứng trong túi mà chưa ấp
    const eggItem = Object.keys(profile.player.carried).find((k) => k.startsWith('egg_') && (profile.player.carried[k] ?? 0) > 0);
    if (eggItem) {
      const startCard = document.createElement('div');
      startCard.style.cssText = 'background:rgba(255,255,255,0.04);border:1px dashed rgba(217,119,6,0.4);border-radius:8px;padding:8px 10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;';
      startCard.innerHTML = `
        <div>
          <strong style="font-size:0.88rem;color:var(--gold);">🥚 Có ${getItem(eggItem).nameVi}</strong>
          <p class="fineprint" style="margin:0;">Đặt vào túi ấp để nở bằng bước chân.</p>
        </div>
      `;
      const btn = document.createElement('button');
      btn.className = 'btn btn--tiny';
      btn.textContent = 'Ấp trứng ngay';
      btn.onclick = () => handlers.onStartIncubate(eggItem);
      startCard.append(btn);
      box.append(startCard);
    }
  }

  // 2. Danh sách thú cưng
  const pets = profile.player.pets ?? [];
  if (pets.length > 0) {
    for (const pet of pets) {
      const def = getPetDef(pet.petId);
      const card = document.createElement('div');
      card.style.cssText = 'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px 10px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;';
      card.innerHTML = `
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:6px;">
            <strong style="color:var(--bone);font-size:0.92rem;">${pet.nameVi}</strong>
            <span style="background:rgba(74,222,128,0.2);color:#4ade80;font-size:0.75rem;padding:1px 6px;border-radius:4px;">Cấp ${pet.level}</span>
          </div>
          <div style="color:var(--gold-faint);font-size:0.8rem;margin:2px 0;">✨ ${def.buffVi}</div>
          <div style="font-size:0.75rem;color:var(--ink-muted);">Độ thân thiết: ${pet.friendship}/100</div>
        </div>
      `;

      const feedBtn = document.createElement('button');
      feedBtn.className = 'btn btn--tiny';
      feedBtn.textContent = '🍖 Cho ăn';
      feedBtn.onclick = () => handlers.onFeedPet(pet.petId, def.favoriteFood);
      card.append(feedBtn);
      box.append(card);
    }
  } else if (!inc) {
    const hint = document.createElement('p');
    hint.className = 'fineprint';
    hint.textContent = 'Khám phá các bí cảnh di tích lớn (Hoàng Thành, Ba Vì, Cổ Loa...) để tìm Trứng Thú Cổ!';
    box.append(hint);
  }
}

function renderFarming(view: GameView, profile: ProfileSave, handlers: Handlers): void {
  const box = el('camp-farming');
  box.replaceChildren();

  const title = document.createElement('h3');
  title.className = 'section-title';
  title.style.cssText = 'display:flex;align-items:center;gap:6px;margin:12px 0 6px 0;color:var(--gold);';
  title.innerHTML = `<span>🌾 Nông Trại Quanh Trại</span>`;
  box.append(title);

  const plots = profile.player.camp.farmPlots ?? createInitialFarmPlots(profile.player.camp.level);
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;';

  plots.forEach((plot) => {
    const plotCard = document.createElement('div');
    plotCard.style.cssText = 'background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px;text-align:center;';

    if (plot.cropId) {
      const crop = getCropDef(plot.cropId);
      const isReady = plot.readyToHarvest;
      const isWilted = plot.wilted ?? false;
      const isFertilized = plot.fertilized ?? false;
      const hasSpoiledMeat = (profile.player.carried['spoiled_meat'] ?? 0) > 0;

      plotCard.innerHTML = `
        <strong style="color:${isWilted ? '#f87171' : 'var(--bone)'};font-size:0.88rem;display:block;">
          ${crop.nameVi} ${isWilted ? '🥀 (Héo)' : ''}
        </strong>
        <div style="font-size:0.78rem;color:var(--ink-muted);margin:3px 0;">
          Độ ẩm: ${'💧'.repeat(plot.waterLevel || 1)} ${isFertilized ? '· <span style="color:#86efac;font-weight:700;">🌱 Đã bón phân</span>' : ''}
        </div>
      `;

      if (isReady) {
        const harvestBtn = document.createElement('button');
        harvestBtn.className = 'btn btn--tiny';
        harvestBtn.style.cssText = isWilted
          ? 'background:#b45309;color:#fff;width:100%;margin-top:4px;'
          : 'background:#15803d;color:#fff;width:100%;margin-top:4px;';
        harvestBtn.textContent = isWilted ? '🌾 Thu hoạch (-50%)' : '🌾 Thu hoạch';
        harvestBtn.onclick = () => handlers.onHarvestPlot(plot.index);
        plotCard.append(harvestBtn);
      } else {
        const actionRow = document.createElement('div');
        actionRow.style.cssText = 'display:flex;gap:4px;margin-top:4px;';

        const waterBtn = document.createElement('button');
        waterBtn.className = 'btn btn--tiny';
        waterBtn.style.cssText = 'flex:1;';
        waterBtn.textContent = isWilted ? '💧 Cứu cây' : '💧 Tưới nước';
        waterBtn.onclick = () => handlers.onWaterPlot(plot.index);
        actionRow.append(waterBtn);

        if (!isFertilized && hasSpoiledMeat) {
          const fertBtn = document.createElement('button');
          fertBtn.className = 'btn btn--tiny btn--primary';
          fertBtn.style.cssText = 'flex:1;background:#78350f;border-color:#b45309;font-size:0.72rem;padding:2px 4px;';
          fertBtn.title = 'Bón phân hữu cơ (thịt ôi) giúp cây lớn nhanh hơn 35%';
          fertBtn.textContent = '🌱 Bón phân';
          fertBtn.onclick = () => handlers.onFertilizePlot?.(plot.index);
          actionRow.append(fertBtn);
        }

        plotCard.append(actionRow);
      }
    } else {
      plotCard.innerHTML = `
        <span style="color:var(--ink-faint);font-size:0.82rem;display:block;margin-bottom:4px;">Luống trống #${plot.index + 1}</span>
      `;
      const plantBtn = document.createElement('button');
      plantBtn.className = 'btn btn--tiny';
      plantBtn.textContent = '🌱 Gieo hạt';
      plantBtn.onclick = () => handlers.onPlantCrop(plot.index, 'wild_berry_crop');
      plotCard.append(plantBtn);
    }

    grid.append(plotCard);
  });

  box.append(grid);
}

export function openItemInspector(
  itemId: string,
  qty: number,
  isCarried: boolean,
  handlers: Handlers,
): void {
  const overlay = el('overlay-item-inspect');
  const iconEl = el('inspect-item-icon');
  const nameEl = el('inspect-item-name');
  const kindEl = el('inspect-item-kind');
  const descEl = el('inspect-item-desc');
  const statsEl = el('inspect-item-stats');
  const qtyEl = el('inspect-item-qty');
  const actionsEl = el('inspect-actions');

  const item = getItem(itemId as any);
  if (!item) return;

  iconEl.innerHTML = itemIconSvg(itemId as any, 'inspect-svg');
  nameEl.textContent = item.nameVi;
  kindEl.textContent =
    item.kind === 'food'
      ? '🍖 Thực Phẩm'
      : item.kind === 'drink'
      ? '💧 Nước Uống'
      : item.kind === 'consumable'
      ? '💊 Dược Phẩm'
      : item.kind === 'tool'
      ? '🪓 Công Cụ'
      : item.kind === 'weapon'
      ? '⚔️ Vũ Khí'
      : item.kind === 'armor'
      ? '🛡️ Giáp / Khiên'
      : item.kind === 'deployable'
      ? '🪤 Bẫy Đặt'
      : '📦 Nguyên Liệu';

  descEl.textContent = (item as any).descVi || 'Vật phẩm sinh tồn trong Kỷ Nguyên Hoang Cổ.';
  qtyEl.textContent = `${qty.toLocaleString('vi-VN')} món`;

  // Thống kê & Công dụng đặc biệt
  const statsList: string[] = [];
  if ((item as any).capacityBonus) statsList.push(`🎒 Tải trọng ba lô: +${(item as any).capacityBonus} kg`);
  if ((item as any).curesHypothermia) statsList.push(`🍵 Giải sạch Cảm Lạnh do dầm mưa & giữ ấm 6h`);
  if ((item as any).curesFatigue) statsList.push(`☕ Đập tan Kiệt Sức do thức đêm ngay tức khắc`);
  if ((item as any).allowOutdoorSleep) statsList.push(`⛺ Ngủ hồi phục thể lực & giải kiệt sức mọi nơi`);
  if ((item as any).masksBloodScent) statsList.push(`🌿 Triệt tiêu Mùi Máu tươi (không hút quái đêm)`);
  if (itemId === 'rain_fur_cloak') statsList.push(`🌧️ Miễn nhiễm 100% Cảm Lạnh khi đi mưa to`);
  if (itemId === 'sun_hat') statsList.push(`☀️ Miễn nhiễm 100% Say Nắng trưa hè (11h-14h)`);
  if (itemId === 'bamboo_scare_chime') statsList.push(`🔔 Bảo vệ bẫy thú 100% không bị ăn vụng`);
  if (itemId === 'mineral_salt') statsList.push(`🧂 Ướp thịt & cá tươi lâu 7 ngày không ôi thiu`);
  if (itemId === 'beast_repellent_powder') statsList.push(`🔥 Giảm 30% sức tấn công của bầy quái đêm`);

  if (item.satiety) statsList.push(`🍖 Hồi độ no: +${item.satiety}`);
  if (item.hydration) statsList.push(`💧 Hồi độ khát: +${item.hydration}`);
  if (item.hp) statsList.push(`❤️ Hồi thể lực: +${item.hp} HP`);
  if (item.attack) statsList.push(`⚔️ Sát thương: ${item.attack} ATK`);
  if (item.defense) statsList.push(`🛡️ Phòng thủ: +${item.defense} DEF`);
  if (item.durability) statsList.push(`🔨 Độ bền: ${item.durability} lần`);
  if (item.chopBonus) statsList.push(`🪵 Tốc độ chặt gỗ: x${item.chopBonus}`);
  if (item.curesSickness) statsList.push(`✨ Chữa khỏi hoàn toàn bệnh tật`);
  if (item.raw) statsList.push(`⚠️ Đồ sống: Ăn có nguy cơ đau bụng!`);
  if (item.infectionRisk) statsList.push(`⚠️ 40% nguy cơ nhiễm khuẩn!`);
  if (item.safe) statsList.push(`🔒 Bảo hộ: Không rơi khi ngất/thua đêm!`);

  statsEl.innerHTML = statsList.length
    ? statsList.map((s) => `<div class="inspect-stat-badge" style="display:inline-block;margin:3px 4px 3px 0;background:rgba(234,179,8,0.15);border:1px solid rgba(251,191,36,0.3);border-radius:6px;padding:3px 8px;font-size:0.8rem;color:#fef08a;">${s}</div>`).join('')
    : '';

  // Hành động
  actionsEl.replaceChildren();

  const edible = item.kind === 'food' || item.kind === 'drink' || item.kind === 'consumable';
  if (isCarried && edible) {
    const useBtn = document.createElement('button');
    useBtn.className = 'btn btn--primary';
    useBtn.textContent = item.kind === 'drink' ? '💧 Uống Ngay' : '🍖 Ăn / Dùng';
    useBtn.onclick = () => {
      handlers.onConsume(itemId);
      overlay.hidden = true;
    };
    actionsEl.append(useBtn);
  }

  const isTrap =
    itemId === 'rabbit_trap' ||
    itemId === 'deer_trap' ||
    itemId === 'beast_trap' ||
    itemId === 'fish_trap';
  if (isCarried && isTrap) {
    const trapBtn = document.createElement('button');
    trapBtn.className = 'btn btn--primary';
    trapBtn.textContent = itemId === 'fish_trap' ? '🐟 Thả Rọ Bắt Cá Tại Toạ Độ Này' : '🪤 Đặt Bẫy Tại Tọa Độ GPS Này';
    trapBtn.onclick = () => {
      handlers.onPlaceTrap(itemId as any);
      overlay.hidden = true;
    };
    actionsEl.append(trapBtn);

    if (itemId === 'fish_trap') {
      const currentFishLvl = Math.max(1, (window as any).__khc?.app?.profile?.player?.fishTrapLevel ?? 1);
      const fTier = getFishTrapTier(currentFishLvl);
      const isMax = currentFishLvl >= FISH_TRAP_TIERS.length;
      const nextFTier = !isMax ? FISH_TRAP_TIERS[currentFishLvl] : null;

      const trapUpgradeBox = document.createElement('div');
      trapUpgradeBox.style.marginTop = '10px';
      trapUpgradeBox.style.padding = '8px 10px';
      trapUpgradeBox.style.background = 'rgba(14,165,233,0.12)';
      trapUpgradeBox.style.border = '1px solid rgba(56,189,248,0.3)';
      trapUpgradeBox.style.borderRadius = '8px';
      trapUpgradeBox.style.fontSize = '0.84rem';

      trapUpgradeBox.innerHTML = `
        <div style="font-weight:700;color:#38bdf8;margin-bottom:4px;display:flex;align-items:center;justify-content:space-between;">
          <span>🐟 ${fTier.nameVi}</span>
          <span class="chip" style="font-size:0.75rem;">Cấp ${currentFishLvl}</span>
        </div>
        <div style="color:var(--ink-muted);font-size:0.78rem;margin-bottom:8px;">${fTier.descVi} · Chờ ${(fTier.waitMs / 60000).toFixed(1)} phút</div>
        ${
          !isMax && nextFTier
            ? `
          <button id="btn-upgrade-fish-trap" class="btn btn--tiny btn--primary" style="width:100%;">
            ⬆️ Nâng lên ${nextFTier.nameVi} (${nextFTier.upgradeCostGold} 🪙)
          </button>
        `
            : `<div class="chip" style="color:#4ade80;text-align:center;width:100%;">✨ Đạt cấp tối thượng</div>`
        }
      `;

      const btnUpFish = trapUpgradeBox.querySelector<HTMLButtonElement>('#btn-upgrade-fish-trap');
      if (btnUpFish && nextFTier) {
        btnUpFish.onclick = () => {
          handlers.onUpgradeFishTrap?.();
          overlay.hidden = true;
        };
      }
      actionsEl.append(trapUpgradeBox);
    }
  }

  if (isCarried) {
    const storeBtn = document.createElement('button');
    storeBtn.className = 'btn btn--ghost';
    storeBtn.textContent = '🔒 Cất Vào Két An Toàn';
    storeBtn.onclick = () => {
      handlers.onStoreSafe(itemId, qty);
      overlay.hidden = true;
    };
    actionsEl.append(storeBtn);
  } else {
    const withdrawBtn = document.createElement('button');
    withdrawBtn.className = 'btn btn--primary';
    withdrawBtn.textContent = '🎒 Lấy Ra Balo / Túi Đang Mang';
    withdrawBtn.onclick = () => {
      handlers.onWithdrawSafe?.(itemId, qty);
      overlay.hidden = true;
    };
    actionsEl.append(withdrawBtn);
  }

  el('btn-inspect-close').onclick = () => {
    overlay.hidden = true;
  };

  overlay.hidden = false;
}

function renderInventory(
  containerId: string,
  inventory: Record<string, number>,
  handlers: Handlers,
  carried: boolean,
): void {
  const box = el(containerId);
  box.className = 'inventory-grid';
  box.replaceChildren();

  const entries = Object.entries(inventory).filter(([, qty]) => qty > 0);
  entries.sort((a, b) => b[1] - a[1]);

  for (const [itemId, qty] of entries) {
    const item = findItem(itemId);
    if (!item) continue;

    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = `slot-card slot-card--${item.kind}${item.safe ? ' slot-card--safe' : ''}`;
    slot.title = `${item.nameVi} (×${qty})`;
    slot.innerHTML = `
      <div class="slot-card__icon">${itemIconSvg(itemId, 'slot-svg')}</div>
      <span class="slot-card__badge">×${qty}</span>
    `;
    slot.onclick = () => openItemInspector(itemId, qty, carried, handlers);
    box.append(slot);
  }

  const minSlots = Math.max(12, Math.ceil(entries.length / 4) * 4);
  for (let i = entries.length; i < minSlots; i++) {
    const emptySlot = document.createElement('div');
    emptySlot.className = 'slot-card slot-card--empty';
    box.append(emptySlot);
  }
}

let bagTabState: 'carried' | 'safe' = 'carried';

export function renderBagPanel(profile: ProfileSave, handlers: Handlers): void {
  const tabCarried = document.getElementById('btn-bag-tab-carried');
  const tabSafe = document.getElementById('btn-bag-tab-safe');
  const btnQuick = document.getElementById('btn-bag-quick-safe');

  if (tabCarried && tabSafe) {
    tabCarried.classList.toggle('is-active', bagTabState === 'carried');
    tabSafe.classList.toggle('is-active', bagTabState === 'safe');

    tabCarried.onclick = () => {
      bagTabState = 'carried';
      renderBagPanel(profile, handlers);
    };

    tabSafe.onclick = () => {
      bagTabState = 'safe';
      renderBagPanel(profile, handlers);
    };
  }

  if (btnQuick) {
    btnQuick.onclick = () => handlers.onQuickStorePrecious?.();
  }

  const box = el('inv-bag');
  box.className = 'inventory-grid';
  box.replaceChildren();

  const isSafeTab = bagTabState === 'safe';
  const inventory = isSafeTab ? (profile.player.safeStorage ?? {}) : (profile.player.carried ?? {});
  const entries = Object.entries(inventory).filter(([, qty]) => qty > 0);
  entries.sort((a, b) => b[1] - a[1]);

  const totalTypes = entries.length;
  const totalCount = entries.reduce((sum, [, qty]) => sum + qty, 0);

  const countBadge = document.getElementById('bag-item-count');
  if (countBadge) {
    if (isSafeTab) {
      const maxCap = getSafeCapacity(profile.player.camp.level, profile.player.safeVaultLevel ?? 1);
      const used = slotsUsed(inventory);
      countBadge.innerHTML = `🔒 Két An Toàn: <strong>${used} / ${maxCap} ô</strong> (${totalTypes} loại)`;
    } else {
      const totalW = calculateCarriedWeight(profile.player.carried ?? {});
      const maxW = maxWeightCapacity(profile.player.pets);
      const isOver = totalW > maxW;
      countBadge.innerHTML = `🎒 Đang mang: <strong>${totalTypes} loại</strong> (${totalCount} món) · <span style="color:${isOver ? '#f87171' : '#fef08a'};font-weight:700;">⚖️ ${totalW.toFixed(1)} / ${maxW} kg</span>${isOver ? ' <span class="chip" style="color:#f87171;background:rgba(239,68,68,0.2);border-color:#ef4444;font-size:0.7rem;padding:1px 5px;margin-left:4px;">⚠️ QUÁ TẢI (Đói x2)</span>' : ''}`;
    }
  }

  if (entries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'fineprint';
    empty.style.gridColumn = '1 / -1';
    empty.style.textAlign = 'center';
    empty.style.padding = '24px 0';
    empty.textContent = isSafeTab
      ? 'Két an toàn đang trống. Hãy cất đồng vàng, bản vẽ và nguyên liệu quý vào đây!'
      : 'Túi đồ đang trống. Hãy đi bộ khám phá xung quanh để thu thập tài nguyên!';
    box.append(empty);
    return;
  }

  for (const [itemId, qty] of entries) {
    const item = findItem(itemId);
    if (!item) continue;

    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = `slot-card slot-card--${item.kind}${item.safe ? ' slot-card--safe' : ''}`;
    slot.title = `${item.nameVi} (×${qty})`;
    slot.innerHTML = `
      <div class="slot-card__icon">${itemIconSvg(itemId, 'slot-svg')}</div>
      <span class="slot-card__badge">×${qty}</span>
    `;
    slot.onclick = () => openItemInspector(itemId, qty, !isSafeTab, handlers);
    box.append(slot);
  }

  const minSlots = Math.max(16, Math.ceil(entries.length / 4) * 4);
  for (let i = entries.length; i < minSlots; i++) {
    const emptySlot = document.createElement('div');
    emptySlot.className = 'slot-card slot-card--empty';
    box.append(emptySlot);
  }
}

// ---------------------------------------------------------------- nhật ký

// ---------------------------------------------------------------- nhật ký

export function renderLog(
  view: GameView,
  profile: ProfileSave,
  chapterTitle: string,
  chapterSummary: string,
  playedBeats: { id: string; textVi: string }[],
  handlers?: Handlers,
  nowMs?: number,
): void {
  const board = el('quest-board');
  board.replaceChildren();

  // 1. Khối Nhiệm Vụ Dã Ngoại Cuối Tuần Hà Nội (Tự động kích hoạt Thứ 7 & Chủ Nhật)
  const currentTime = nowMs ?? Date.now();
  const weekendBoard = getWeekendQuestBoard(profile.player, currentTime, view.location?.insidePoi ?? null);

  const weekendCard = document.createElement('div');
  weekendCard.className = 'weekend-quests-card';
  weekendCard.style.cssText = 'background:linear-gradient(135deg, rgba(30,24,18,0.95), rgba(45,34,22,0.95));border:1.5px solid rgba(245,158,11,0.5);border-radius:12px;padding:12px 14px;margin-bottom:14px;box-shadow:0 4px 16px rgba(0,0,0,0.5);';

  if (weekendBoard.isWeekendActive) {
    weekendCard.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(245,158,11,0.25);padding-bottom:8px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:1.5rem;">🎉</span>
          <div>
            <div style="font-weight:800;font-size:0.98rem;color:#fef08a;display:flex;align-items:center;gap:6px;">
              DÃ NGOẠI CUỐI TUẦN HÀ NỘI
              <span class="chip chip--warn" style="font-size:0.68rem;padding:1px 6px;">Đang Diễn Ra</span>
            </div>
            <small style="color:var(--ink-dim);font-size:0.75rem;">Khám phá 8 địa điểm &amp; hoạt động nhận Đồng Vàng Cổ, Trứng Linh Thú!</small>
          </div>
        </div>
      </div>
      <div class="weekend-quest-list" style="display:flex;flex-direction:column;gap:8px;">
        ${weekendBoard.quests.map((q) => `
          <div class="weekend-quest-item" style="background:rgba(0,0,0,0.4);border:1px solid ${q.claimed ? 'rgba(255,255,255,0.08)' : q.done ? '#4ade80' : 'rgba(245,158,11,0.22)'};border-radius:8px;padding:8px 10px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
              <div style="display:flex;align-items:flex-start;gap:8px;flex:1;">
                <span style="font-size:1.3rem;line-height:1.2;">${q.quest.icon}</span>
                <div>
                  <div style="font-weight:700;font-size:0.88rem;color:${q.claimed ? 'var(--ink-dim)' : '#fef08a'};">${q.quest.titleVi}</div>
                  <div style="font-size:0.78rem;color:var(--ink-muted);margin-top:1px;">${q.quest.descVi}</div>
                  <div style="font-size:0.72rem;color:${q.claimed ? 'var(--ink-faint)' : q.done ? '#86efac' : '#fb923c'};margin-top:3px;font-weight:600;">
                    ${q.progressText}
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;margin-top:4px;font-size:0.75rem;color:var(--gold-faint);">
                    <span>🎁 Thưởng:</span>
                    ${q.quest.rewards.map((r) => `<span>${itemIconSvg(r.itemId, 'mini-svg')} ${r.qty}</span>`).join(' ')}
                  </div>
                </div>
              </div>
              <div style="flex-shrink:0;">
                ${q.claimed
                  ? `<span class="chip" style="font-size:0.7rem;background:rgba(255,255,255,0.06);color:var(--ink-dim);padding:2px 6px;">Đã Nhận</span>`
                  : q.done
                    ? `<button type="button" class="btn btn--tiny btn--primary btn-claim-weekend" data-quest-id="${q.quest.id}" style="background:#16a34a;border-color:#4ade80;font-weight:800;white-space:nowrap;padding:5px 10px;font-size:0.78rem;">🎁 Nhận Thưởng</button>`
                    : `<span class="chip chip--warn" style="font-size:0.7rem;padding:2px 6px;">Chưa Đến</span>`
                }
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    for (const claimBtn of weekendCard.querySelectorAll<HTMLButtonElement>('.btn-claim-weekend')) {
      claimBtn.onclick = (e) => {
        e.stopPropagation();
        const qId = claimBtn.dataset.questId;
        if (qId && handlers?.onClaimWeekendQuest) {
          handlers.onClaimWeekendQuest(qId);
        }
      };
    }
  } else {
    weekendCard.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:1.4rem;">🗓️</span>
        <div>
          <div style="font-weight:700;font-size:0.92rem;color:var(--gold);">DÃ NGOẠI CUỐI TUẦN HÀ NỘI</div>
          <small style="color:var(--ink-dim);">Sự kiện sẽ tự động mở vào <strong>Thứ Bảy &amp; Chủ Nhật</strong> tới với 8 nhiệm vụ dã ngoại &amp; thưởng Đồng Vàng Cổ!</small>
        </div>
      </div>
    `;
  }
  board.append(weekendCard);

  // 2. Mục tiêu Cốt truyện / Tutorial hiện tại
  const isTutorial = profile.story.tutorialDay > 0;
  const header = document.createElement('div');
  header.className = 'quest-section-header';
  header.style.marginBottom = '8px';
  header.innerHTML = `<span style="font-weight:700;color:var(--gold);font-size:0.95rem;">${isTutorial ? `Mục tiêu Ngày ${profile.story.tutorialDay} / 3 (Hướng dẫn)` : `Nhiệm vụ ${chapterTitle}`}</span>`;
  board.append(header);

  if (view.quests.length === 0) {
    const done = document.createElement('p');
    done.className = 'fineprint';
    done.textContent = profile.story.endlessUnlocked
      ? 'Bạn đã hoàn tất toàn bộ 8 Chương Sử Thi và cứu vãn Đứt Gãy Không Gian! Trại của bạn đang ở Chế Độ Vô Tận.'
      : 'Tất cả mục tiêu trong chương hiện tại đã hoàn tất! Sẵn sàng cho Đêm Trăng Máu thứ Bảy.';
    board.append(done);
  }

  for (const quest of view.quests) {
    const row = document.createElement('div');
    row.className = `row${quest.done ? ' is-done' : ''}`;
    const progress = quest.need > 1 ? ` (${Math.min(quest.have, quest.need)}/${quest.need})` : '';
    
    // Phần thưởng
    const rewardsHtml = quest.reward && quest.reward.length > 0
      ? `<div style="display:flex;gap:6px;margin-top:6px;font-size:0.8rem;color:var(--gold-faint);">
          <span>🎁 Thưởng:</span>
          ${quest.reward.map((r) => `<span>${itemIconSvg(r.itemId, 'mini-svg')} ${r.qty}</span>`).join(' ')}
        </div>`
      : '';

    // Mẹo Quy Luật từ Lạc Lạc
    const ruleTipHtml = (quest as any).ruleTipVi
      ? `<div style="background:rgba(224,122,60,0.12);border-left:2.5px solid var(--ember);padding:6px 10px;border-radius:4px;margin-top:6px;font-size:0.82rem;color:#fef08a;line-height:1.4;">
          💡 <strong>Quy luật:</strong> ${(quest as any).ruleTipVi.replace(/^Quy luật:\s*/, '')}
        </div>`
      : '';

    // Nút điều hướng nhanh
    let shortcutBtnHtml = '';
    const shortcut = (quest as any).shortcutTab;
    if (!quest.done && shortcut) {
      const tabNameVi = shortcut === 'craft' ? 'Bàn Chế Tạo' : shortcut === 'camp' ? 'Doanh Trại' : shortcut === 'bag' ? 'Túi Đồ' : 'Bản Đồ';
      shortcutBtnHtml = `
        <button type="button" class="btn btn--tiny btn-quest-shortcut" data-target-tab="${shortcut}" style="background:#78350f;color:#fef08a;border-color:#f59e0b;font-size:0.75rem;padding:3px 8px;margin-top:6px;">
          Đi tới ${tabNameVi} ➜
        </button>
      `;
    }

    const statusBadge = quest.done
      ? `<span style="background:rgba(74,222,128,0.18);color:#4ade80;padding:2px 8px;border-radius:999px;font-size:0.75rem;font-weight:700;border:1px solid rgba(74,222,128,0.4);">✓ ĐÃ XONG</span>`
      : `<span style="background:rgba(251,191,36,0.15);color:#fbbf24;padding:2px 8px;border-radius:999px;font-size:0.75rem;font-weight:700;border:1px solid rgba(251,191,36,0.3);">ĐANG TIẾN HÀNH</span>`;

    row.innerHTML = `
      <div class="row__body" style="width:100%;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
          <div class="row__title" style="font-size:0.95rem;">${quest.titleVi}${progress}</div>
          ${statusBadge}
        </div>
        <div class="row__sub" style="font-size:0.85rem;color:var(--ink-muted);line-height:1.35;">${quest.descVi}</div>
        ${ruleTipHtml}
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-top:2px;">
          ${rewardsHtml}
          ${shortcutBtnHtml}
        </div>
      </div>`;

    const sBtn = row.querySelector<HTMLButtonElement>('.btn-quest-shortcut');
    if (sBtn) {
      sBtn.onclick = () => {
        const target = sBtn.dataset.targetTab;
        if (target) {
          const tabBtn = document.querySelector<HTMLButtonElement>(`.tabbar__btn[data-tab="${target}"]`);
          if (tabBtn) tabBtn.click();
        }
      };
    }

    board.append(row);
  }

  // Thêm mục Cẩm Nang Quy Luật Sinh Tồn
  const handbookSection = document.createElement('div');
  handbookSection.style.cssText = 'background:rgba(0,0,0,0.35);border:1px solid rgba(217,119,6,0.3);border-radius:8px;padding:12px;margin-top:14px;';
  handbookSection.innerHTML = `
    <div style="font-weight:700;color:var(--gold);font-size:0.92rem;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
      <span>📖 CẨM NANG &amp; QUY LUẬT SINH TỒN HOANG CỔ</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;font-size:0.82rem;color:var(--bone);line-height:1.45;">
      <div>👣 <strong>Bước chân tự động nhặt:</strong> Cứ ~100 bước đi bộ nhặt 1 cành khô/đá nhọn/quả dại. Trần 15.000 bước/ngày.</div>
      <div>🔥 <strong>Lửa trại &amp; Thủ đêm:</strong> Dựng lửa trại trước 20:00. 20:00 dã thú tấn công, điểm thủ trại càng cao càng an toàn.</div>
      <div>💧 <strong>Đun nước uống:</strong> Nước thô có 40% gây đau bụng. Luôn đun sôi trên Lửa Trại trước khi uống!</div>
      <div>🏕️ <strong>Két an toàn:</strong> Cất đồ quý vào Két An Toàn tại trại — không bao giờ bị mất kể cả khi thua đêm.</div>
      <div>🪓 <strong>Rìu &amp; Công viên:</strong> Mang Rìu Đá tới gần Công viên / Rừng trên bản đồ để đốn gỗ lớn xây trại.</div>
      <div>🌕 <strong>Trăng Máu thứ Bảy:</strong> Đêm thứ Bảy xuất hiện Boss Trăng Máu — hạ boss để mở chương sử thi tiếp theo.</div>
    </div>
  `;
  board.append(handbookSection);

  const currentChap = CHAPTERS.find((c) => c.index === profile.story.chapterIndex);
  const epigraphHtml = currentChap?.epigraphVi
    ? `<div style="background:rgba(217,119,6,0.12);border-left:3px solid var(--ember);padding:8px 12px;margin:8px 0 10px;border-radius:4px;font-style:italic;color:#fef08a;font-size:0.85rem;line-height:1.45;">
        "${currentChap.epigraphVi}"
      </div>`
    : '';

  const stepsInChapter = Math.max(0, profile.player.lifetime.steps - profile.story.chapterStartSteps);
  el('chapter-info').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:1.4rem;">${currentChap?.caveArtIcon || '📜'}</span>
        <h3 style="margin:0;color:var(--amber);font-size:1.1rem;">${chapterTitle}</h3>
      </div>
      <span style="font-size:0.82rem;color:var(--gold-faint);background:rgba(217,119,6,0.15);padding:2px 8px;border-radius:6px;">🚶 ${stepsInChapter.toLocaleString('vi-VN')} bước</span>
    </div>
    ${epigraphHtml}
    <p style="margin:0;font-size:0.88rem;color:var(--ink-muted);line-height:1.4;">${chapterSummary}</p>`;

  const history = el('beat-history');
  history.replaceChildren();
  for (const beat of playedBeats) {
    const div = document.createElement('div');
    div.className = 'beat';
    const mood = (beat as any).mood || 'calm';
    const moodIcon = mood === 'worried' ? '😨' : mood === 'determined' ? '🔥' : mood === 'proud' ? '👑' : mood === 'surprised' ? '⚡' : '👧';
    div.innerHTML = `
      <div style="display:flex;gap:8px;align-items:baseline;">
        <span style="font-size:1.05rem;">${moodIcon}</span>
        <div style="flex:1;">${beat.textVi}</div>
      </div>
    `;
    history.append(div);
  }

  if (!playedBeats.length) {
    const hint = document.createElement('p');
    hint.className = 'fineprint';
    hint.textContent = 'Đi bộ để Lạc Lạc kể tiếp. Mỗi cột mốc số bước mở một đoạn.';
    history.append(hint);
  }
}

// ---------------------------------------------------------------- cài đặt

export function renderSettings(profile: ProfileSave, handlers: Handlers, storageOk: boolean): void {
  const box = el('settings-body');
  box.replaceChildren();

  box.append(
    toggleRow(
      'Hiệu ứng âm thanh (SFX)',
      'Tiếng nhặt đồ, đốn gỗ, câu cá, chế tạo, sập bẫy và chiến đấu.',
      audio.isSoundEnabled(),
      () => {
        audio.setSoundEnabled(!audio.isSoundEnabled());
        renderSettings(profile, handlers, storageOk);
      },
    ),
    toggleRow(
      'Nhạc nền hoang cổ (BGM)',
      'Giai điệu ngũ cung & âm thanh thiên nhiên theo ngày/đêm.',
      audio.isMusicEnabled(),
      () => {
        audio.setMusicEnabled(!audio.isMusicEnabled());
        renderSettings(profile, handlers, storageOk);
      },
    ),
    toggleRow(
      'Khoá ban đêm của phụ huynh',
      'Sau 21h không tương tác POI ngoài trời. Chơi ở trại vẫn bình thường.',
      profile.settings.parentalNightLock,
      () => handlers.onToggleSetting('parentalNightLock'),
    ),
    toggleRow(
      'Đồng bộ thời tiết thật',
      'Mặc định TẮT. Bật thì game thử đọc thời tiết một lần khi mở app nếu tình cờ có mạng; thất bại thì im lặng dùng thời tiết trong game.',
      profile.settings.realWeatherSync,
      () => handlers.onToggleSetting('realWeatherSync'),
    ),
    toggleRow('Giọng dẫn của Lạc Lạc', 'Hiện thoại khi đạt cột mốc số bước.', profile.settings.narrationAudio, () =>
      handlers.onToggleSetting('narrationAudio'),
    ),
    toggleRow('Rung phản hồi', 'Rung nhẹ khi nhặt được đồ và khi quái tấn công.', profile.settings.haptics, () =>
      handlers.onToggleSetting('haptics'),
    ),
  );

  box.append(
    actionRow('Xuất file sao lưu', 'Đổi máy vẫn giữ được tiến trình. Không có server nên đây là mạng an toàn duy nhất.', 'Xuất', handlers.onExport),
    actionRow('Nhập file sao lưu', 'Ghi đè toàn bộ hồ sơ hiện có trên máy này.', 'Nhập', handlers.onImport),
    actionRow('Đổi hồ sơ', 'Quay lại màn hình chọn hồ sơ.', 'Đổi', handlers.onSwitchProfile),
    actionRow('Xoá hồ sơ này', 'Không khôi phục được nếu chưa xuất sao lưu.', 'Xoá', handlers.onDeleteProfile),
  );

  const privacy = document.createElement('div');
  privacy.className = 'setting';
  privacy.innerHTML = `
    <div class="setting__body">
      <div class="setting__title">Quyền riêng tư</div>
      <div class="setting__desc">
        Game này không thu thập bất cứ dữ liệu gì. Vị trí và số bước được xử lý rồi lưu ngay trên máy;
        không có lệnh gọi mạng nào khi chơi. ${storageOk ? '' : '<br><strong>Cảnh báo: trình duyệt đang chặn lưu trữ, tiến trình sẽ mất khi đóng tab.</strong>'}
      </div>
    </div>`;
  box.append(privacy);
}

function toggleRow(title: string, desc: string, on: boolean, onToggle: () => void): HTMLElement {
  const row = document.createElement('div');
  row.className = 'setting';
  row.innerHTML = `<div class="setting__body"><div class="setting__title">${title}</div><div class="setting__desc">${desc}</div></div>`;

  const button = document.createElement('button');
  button.className = 'btn btn--tiny';
  button.textContent = on ? 'Đang bật' : 'Đang tắt';
  button.style.color = on ? 'var(--moss)' : 'var(--ink-faint)';
  button.onclick = onToggle;
  row.append(button);

  return row;
}

function actionRow(title: string, desc: string, label: string, onClick: () => void): HTMLElement {
  const row = document.createElement('div');
  row.className = 'setting';
  row.innerHTML = `<div class="setting__body"><div class="setting__title">${title}</div><div class="setting__desc">${desc}</div></div>`;

  const button = document.createElement('button');
  button.className = 'btn btn--tiny';
  button.textContent = label;
  button.onclick = onClick;
  row.append(button);

  return row;
}

// ---------------------------------------------------------------- tiện ích

export function toast(message: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
  if (!message) return;

  const stack = el('toast-stack');
  const node = document.createElement('div');
  node.className = `toast toast--${kind}`;
  node.textContent = message;
  stack.append(node);

  setTimeout(() => node.remove(), 4200);
  while (stack.children.length > 4) stack.firstElementChild?.remove();
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}″`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}′`;
  const hours = seconds / 3600;
  return hours < 24 ? `${hours.toFixed(1)} giờ` : `${Math.round(hours / 24)} ngày`;
}

export function openTradeConfirm(
  item: { nameVi: string; tagVi?: string; descVi: string; itemId: string; unitPrice: number; maxQty: number; isBuy: boolean },
  onSubmit: (qty: number) => void,
): void {
  const overlay = el('overlay-merchant-trade-confirm');
  const titleEl = el('trade-confirm-title');
  const iconEl = el('trade-item-icon');
  const nameEl = el('trade-item-name');
  const descEl = el('trade-item-desc');
  const unitPriceEl = el('trade-unit-price');
  const qtyValEl = el('trade-qty-value');
  const totalGoldEl = el('trade-total-gold');
  const btnSubmit = el('btn-trade-submit');
  const btnMinus = el('btn-trade-minus');
  const btnPlus = el('btn-trade-plus');
  const btnMax = el('btn-trade-max');
  const btnClose = el('btn-trade-confirm-close');

  let currentQty = 1;
  const max = Math.max(1, item.maxQty);

  titleEl.textContent = item.isBuy ? '🛒 Mua hàng hoá' : '💰 Bán vật phẩm';
  iconEl.innerHTML = itemIconSvg(item.itemId as any, 'inspect-svg');
  nameEl.textContent = item.nameVi;
  descEl.innerHTML = `
    ${item.tagVi ? `<div style="display:inline-block;margin-bottom:8px;padding:3px 8px;background:rgba(251,191,36,0.18);border:1px solid rgba(251,191,36,0.35);border-radius:6px;font-size:0.8rem;font-weight:800;color:#fef08a;">${item.tagVi}</div><br/>` : ''}
    ${item.descVi}
  `;
  unitPriceEl.innerHTML = `${item.unitPrice} ${coinIconSvg(15)}`;

  function updateTradeCalc() {
    qtyValEl.textContent = String(currentQty);
    const total = currentQty * item.unitPrice;
    totalGoldEl.innerHTML = item.isBuy ? `${total} ${coinIconSvg(16)}` : `+${total} ${coinIconSvg(16)}`;
    btnSubmit.innerHTML = item.isBuy
      ? `Xác nhận mua (-${total} ${coinIconSvg(14)})`
      : `Xác nhận bán (+${total} ${coinIconSvg(14)})`;
  }

  btnMinus.onclick = () => {
    if (currentQty > 1) {
      currentQty--;
      updateTradeCalc();
    }
  };

  btnPlus.onclick = () => {
    if (currentQty < max) {
      currentQty++;
      updateTradeCalc();
    }
  };

  btnMax.onclick = () => {
    currentQty = max;
    updateTradeCalc();
  };

  btnSubmit.onclick = () => {
    onSubmit(currentQty);
    overlay.hidden = true;
  };

  btnClose.onclick = () => {
    overlay.hidden = true;
  };

  updateTradeCalc();
  overlay.hidden = false;
}

export function renderMerchantShop(
  profile: ProfileSave,
  poiName: string,
  onBuy: (shopItemId: string, qty?: number) => void,
  onSell: (itemId: string, qty: number) => void,
): void {
  const overlay = el('overlay-merchant-shop');
  const poiNameEl = el('merchant-poi-name');
  const goldEl = el('merchant-player-gold');
  const buyList = el('merchant-buy-list');
  const sellList = el('merchant-sell-list');

  const currentGold = countOf(profile.player.carried, 'ancient_coin');
  poiNameEl.textContent = poiName || 'Tiệm Trao Đổi Tiền Sử';
  goldEl.innerHTML = `${currentGold.toLocaleString('vi-VN')} ${coinIconSvg(18)}`;

  // 1. Render Danh Sách Mua dạng Ô Vuông Grid
  buyList.className = 'merchant-slot-grid';
  buyList.replaceChildren();
  for (const item of NPC_SHOP_CATALOG) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'merchant-slot-card';
    const canAfford = currentGold >= item.priceGold;
    if (!canAfford) card.classList.add('is-unaffordable');
    
    card.innerHTML = `
      <div class="merchant-slot-icon">${itemIconSvg(item.itemId, 'card-svg')}</div>
      <div class="merchant-slot-title">${item.qty > 1 ? `${item.qty}x ` : ''}${item.nameVi}</div>
      <span class="merchant-slot-price">${item.priceGold} ${coinIconSvg(13)}</span>
    `;

    card.onclick = () => {
      const maxAffordable = Math.floor(currentGold / item.priceGold);
      openTradeConfirm(
        {
          nameVi: `${item.qty > 1 ? `${item.qty}x ` : ''}${item.nameVi}`,
          tagVi: item.tagVi,
          descVi: item.descVi,
          itemId: item.itemId,
          unitPrice: item.priceGold,
          maxQty: Math.max(1, maxAffordable),
          isBuy: true,
        },
        (qty) => {
          onBuy(item.id, qty);
        }
      );
    };

    buyList.append(card);
  }

  // 2. Render Danh Sách Bán dạng Ô Vuông Grid
  sellList.className = 'merchant-slot-grid';
  sellList.replaceChildren();
  let hasSellable = false;

  for (const [itemId, qty] of Object.entries(profile.player.carried)) {
    if (itemId === 'ancient_coin' || qty <= 0) continue;
    const unitPrice = ITEM_SELL_PRICES[itemId];
    if (!unitPrice) continue;

    hasSellable = true;
    const itemDef = getItem(itemId as any);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'merchant-slot-card';

    card.innerHTML = `
      <div class="merchant-slot-icon">${itemIconSvg(itemId as any, 'card-svg')}</div>
      <div class="merchant-slot-title">${itemDef?.nameVi || itemId}</div>
      <div class="merchant-slot-have">Có: ${qty}</div>
      <span class="merchant-slot-price is-sell">+${unitPrice} ${coinIconSvg(13)}</span>
    `;

    card.onclick = () => {
      openTradeConfirm(
        {
          nameVi: itemDef?.nameVi || itemId,
          descVi: (itemDef as any)?.descVi || 'Nguyên liệu thu thập mang bán.',
          itemId: itemId,
          unitPrice: unitPrice,
          maxQty: qty,
          isBuy: false,
        },
        (chosenQty) => {
          onSell(itemId, chosenQty);
        }
      );
    };

    sellList.append(card);
  }

  if (!hasSellable) {
    const emptyNotice = document.createElement('p');
    emptyNotice.className = 'fineprint';
    emptyNotice.style.gridColumn = '1 / -1';
    emptyNotice.style.textAlign = 'center';
    emptyNotice.style.padding = '24px 0';
    emptyNotice.textContent = 'Bạn không có vật phẩm nào có thể bán trong túi đồ lúc này.';
    sellList.append(emptyNotice);
  }

  // Tab switching
  const tabBuyBtn = el('btn-tab-merchant-buy');
  const tabSellBtn = el('btn-tab-merchant-sell');
  const buyContent = el('merchant-buy-content');
  const sellContent = el('merchant-sell-content');

  tabBuyBtn.onclick = () => {
    tabBuyBtn.classList.add('is-active');
    tabSellBtn.classList.remove('is-active');
    buyContent.hidden = false;
    sellContent.hidden = true;
  };

  tabSellBtn.onclick = () => {
    tabSellBtn.classList.add('is-active');
    tabBuyBtn.classList.remove('is-active');
    buyContent.hidden = true;
    sellContent.hidden = false;
  };

  overlay.hidden = false;
}

export { describeInventory };
