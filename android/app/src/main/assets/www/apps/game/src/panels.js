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
} from '../../../packages/game-core/src/index.js';
import { actionIconSvg, itemIconSvg, zoneIconSvg } from './itemIcons.js';
import { audio } from './audio.js';
             
           
                  
              
             
         
                                                  

export function el                       (id        )    {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Thiếu phần tử #${id} trong index.html`);
  return node     ;
}

                           
                                  
                          
                        
                                  
                                                 
                                                                
                                              
                  
                         
                      
                                                                            
                                           
                                                     
                                                       
                                       
                                         
                    
                      
                                                                                                     
                   
                   
                          
                          
 

// ---------------------------------------------------------------- HUD

export function renderHud(view          , profile             )       {
  const { survival } = profile.player;

  el('hud-time').textContent = `${String(view.localTime.hour).padStart(2, '0')}:${String(view.localTime.minute).padStart(2, '0')}`;
  el('hud-phase').textContent =
    view.phase === 'night' ? 'Đêm' : view.phase === 'evening' ? 'Chiều tối' : 'Ban ngày';
  el('hud-weather').textContent = `${weatherIcon(view)} ${view.weather.conditionNameVi}`;
  el('hud-steps').textContent = `${profile.player.steps.totalSteps.toLocaleString('vi-VN')} bước`;

  setBar('satiety', survival.satiety);
  setBar('hydration', survival.hydration);
  setBar('hp', survival.hp);

  const warningsList           = [...view.survivalWarningsVi];
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

function setBar(name                                , value        )       {
  const fill = el(`bar-${name}`);
  fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
  el(`val-${name}`).textContent = String(Math.round(value));
  fill.closest('.bar')?.classList.toggle('is-critical', value <= 20);
}

function weatherIcon(view          )         {
  if (view.weather.raining) return '🌧️';
  if (view.weather.hot) return '🔆';
  if (view.weather.cold) return '❄️';
  return view.phase === 'night' ? '🌙' : '☀️';
}

function renderBloodMoonStrip(view          )       {
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

export function renderZonePanel(view          , profile             )       {
  const box = el('map-zone');
  const location = view.location;
  const zone         = location?.zone ?? 'wilderness';

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

export function renderZoneActions(view          , profile             , handlers          )       {
  const bar = el('zone-actions');
  bar.replaceChildren();

  const zone         = view.location?.zone ?? 'wilderness';
  const poiId = view.location?.insidePoi?.id ?? view.location?.cell.id ?? 'wild';

  for (const action of actionsFor(zone)) {
    if (action.id === 'merchant_trade') continue;
    bar.append(actionButton(action, () => handlers.onGather(action.id, poiId, zone), profile));
  }

  if (zone === 'merchant') {
    const button = document.createElement('button');
    button.className = 'btn btn--action';
    button.innerHTML = `
      <span class="action-btn__icon">${actionIconSvg('merchant_trade')}</span>
      <div class="action-btn__body">Đổi hàng<small>1 lượt mỗi ngày</small></div>`;
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

function actionButton(action                 , onClick            , profile             )                    {
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

export function renderCraft(view          , profile             , handlers          , onlyCraftable         )       {
  const jobs = el('craft-jobs');
  jobs.replaceChildren();

  for (const job of profile.craftJobs) {
    const ready = view.nowMs >= job.readyAtMs;
    const row = document.createElement('div');
    row.className = `row${ready ? ' is-ready' : ''}`;
    const seconds = Math.max(0, Math.ceil((job.readyAtMs - view.nowMs) / 1000));
    row.innerHTML = `<div class="row__body"><div class="row__title">${nameOfRecipe(view, job.recipeId)}</div><div class="row__sub">${ready ? 'Xong — bấm để thu' : `còn ${formatDuration(seconds)}`}</div></div>`;

    if (ready) {
      const button = document.createElement('button');
      button.className = 'btn btn--tiny';
      button.textContent = 'Thu';
      button.onclick = handlers.onCollectCrafts;
      row.append(button);
    }
    jobs.append(row);
  }

  const list = el('craft-list');
  list.replaceChildren();

  const visible = onlyCraftable ? view.recipes.filter((r) => r.craftable) : view.recipes;
  const byTier = new Map                      ();
  for (const entry of visible) {
    const bucket = byTier.get(entry.recipe.tier) ?? [];
    bucket.push(entry);
    byTier.set(entry.recipe.tier, bucket);
  }

  for (const tier of [1, 2, 3]) {
    const entries = byTier.get(tier);
    if (!entries?.length) continue;

    const heading = document.createElement('h3');
    heading.className = 'section-title';
    heading.textContent = `Cấp ${tier} — ${getCampTier(tier).nameVi}`;
    list.append(heading);

    for (const entry of entries) list.append(recipeRow(entry, profile, handlers));
  }

  if (!list.children.length) {
    const empty = document.createElement('p');
    empty.className = 'fineprint';
    empty.textContent = 'Chưa đủ nguyên liệu cho công thức nào. Đi bộ thêm một vòng đi.';
    list.append(empty);
  }
}

function recipeRow(entry            , profile             , handlers          )              {
  const row = document.createElement('div');
  row.className = `row row--recipe${entry.locked ? ' is-locked' : ''}`;

  const outputId = entry.recipe.outputId || entry.recipe.id;
  const badgesHtml           = [];

  if (entry.locked) {
    badgesHtml.push(`<span class="need-badge is-missing">${entry.lockReasonVi}</span>`);
  } else {
    for (const input of entry.recipe.inputs) {
      const item = findItem(input.itemId);
      const have = profile.player.carried[input.itemId] ?? 0;
      const isMissing = have < input.qty;
      badgesHtml.push(
        `<span class="need-badge ${isMissing ? 'is-missing' : 'is-met'}">${itemIconSvg(input.itemId, 'mini-svg')} ${input.qty} ${item?.nameVi ?? input.itemId}${isMissing ? ` (${have}/${input.qty})` : ''}</span>`,
      );
    }

    if (entry.recipe.station) {
      const stationNames                         = {
        campfire: 'Lửa trại',
        drying_rack: 'Giá phơi',
        kiln: 'Lò nung',
        forge: 'Lò rèn',
      };
      const sName = stationNames[entry.recipe.station] ?? entry.recipe.station;
      badgesHtml.push(
        `<span class="station-badge">${itemIconSvg(entry.recipe.station, 'mini-svg')} Cần ${sName}</span>`,
      );
    }

    badgesHtml.push(`<span class="time-badge">⏱️ ${formatDuration(entry.recipe.seconds)}</span>`);
  }

  row.innerHTML = `
    <div class="recipe__icon">${itemIconSvg(outputId)}</div>
    <div class="row__body">
      <div class="row__title">${entry.recipe.nameVi}</div>
      <div class="recipe__badges">${badgesHtml.join('')}</div>
    </div>`;

  const button = document.createElement('button');
  button.className = 'btn btn--tiny';
  button.textContent = 'Làm';
  button.disabled = !entry.craftable;
  button.onclick = () => handlers.onCraft(entry.recipe.id);
  row.append(button);

  return row;
}

function nameOfRecipe(view          , recipeId        )         {
  return view.recipes.find((r) => r.recipe.id === recipeId)?.recipe.nameVi ?? recipeId;
}

// ---------------------------------------------------------------- doanh trại

export function renderCamp(view          , profile             , handlers          )       {
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
  renderInventory('inv-carried', profile.player.carried, handlers, true);
  renderInventory('inv-safe', profile.player.safeStorage, handlers, false);
}

function renderUpgrade(view          , profile             , handlers          )       {
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

function renderDefense(profile             )       {
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

  const stationNames                         = {
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

function renderPets(profile             , handlers          )       {
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

function renderFarming(view          , profile             , handlers          )       {
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
      plotCard.innerHTML = `
        <strong style="color:var(--bone);font-size:0.88rem;display:block;">${crop.nameVi}</strong>
        <div style="font-size:0.78rem;color:var(--ink-muted);margin:4px 0;">Độ ẩm: ${'💧'.repeat(plot.waterLevel || 1)}</div>
      `;

      if (isReady) {
        const harvestBtn = document.createElement('button');
        harvestBtn.className = 'btn btn--tiny';
        harvestBtn.style.cssText = 'background:#15803d;color:#fff;width:100%;margin-top:4px;';
        harvestBtn.textContent = '🌾 Thu hoạch';
        harvestBtn.onclick = () => handlers.onHarvestPlot(plot.index);
        plotCard.append(harvestBtn);
      } else {
        const waterBtn = document.createElement('button');
        waterBtn.className = 'btn btn--tiny';
        waterBtn.style.cssText = 'width:100%;margin-top:4px;';
        waterBtn.textContent = '💧 Tưới nước';
        waterBtn.onclick = () => handlers.onWaterPlot(plot.index);
        plotCard.append(waterBtn);
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

function renderInventory(
  containerId        ,
  inventory                        ,
  handlers          ,
  carried         ,
)       {
  const box = el(containerId);
  box.replaceChildren();

  const entries = Object.entries(inventory).filter(([, qty]) => qty > 0);
  entries.sort((a, b) => b[1] - a[1]);

  for (const [itemId, qty] of entries) {
    const item = findItem(itemId);
    if (!item) continue;

    const card = document.createElement('div');
    card.className = `item item--${item.kind}`;
    card.innerHTML = `
      <div class="item__top">
        <div class="item__icon">${itemIconSvg(itemId)}</div>
        <div class="item__meta"><strong>${item.nameVi}</strong><span>×${qty}</span></div>
      </div>`;

    if (carried) {
      const edible = item.kind === 'food' || item.kind === 'drink' || item.kind === 'consumable';
      if (edible) {
        const use = document.createElement('button');
        use.textContent = item.kind === 'drink' ? 'Uống' : 'Dùng';
        use.onclick = () => handlers.onConsume(itemId);
        card.append(use);
      }
      const store = document.createElement('button');
      store.textContent = 'Cất vào két';
      store.onclick = () => handlers.onStoreSafe(itemId, qty);
      card.append(store);
    }

    box.append(card);
  }
}

export function renderBagPanel(profile             , handlers          )       {
  const box = el('inv-bag');
  box.replaceChildren();

  const inventory = profile.player.carried ?? {};
  const entries = Object.entries(inventory).filter(([, qty]) => qty > 0);
  entries.sort((a, b) => b[1] - a[1]);

  const totalTypes = entries.length;
  const totalCount = entries.reduce((sum, [, qty]) => sum + qty, 0);

  const countBadge = document.getElementById('bag-item-count');
  if (countBadge) {
    countBadge.textContent = `${totalTypes} loại (${totalCount} món)`;
  }

  if (entries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'fineprint';
    empty.textContent = 'Túi đồ đang trống. Hãy đi bộ để nhặt tài nguyên hoặc thực hiện các hành động thu lượm / chế tạo!';
    box.append(empty);
    return;
  }

  for (const [itemId, qty] of entries) {
    const item = findItem(itemId);
    if (!item) continue;

    const card = document.createElement('div');
    card.className = `item item--${item.kind}`;
    card.innerHTML = `
      <div class="item__top">
        <div class="item__icon">${itemIconSvg(itemId)}</div>
        <div class="item__meta">
          <strong>${item.nameVi}</strong>
          <span>×${qty}</span>
        </div>
      </div>
      <div class="item__desc">${item.descVi ?? ''}</div>`;

    const edible = item.kind === 'food' || item.kind === 'drink' || item.kind === 'consumable';
    if (edible) {
      const use = document.createElement('button');
      use.className = 'btn btn--tiny btn--primary';
      use.textContent = item.kind === 'drink' ? 'Uống' : 'Ăn / Dùng';
      use.onclick = () => handlers.onConsume(itemId);
      card.append(use);
    }

    const isTrap = itemId === 'rabbit_trap' || itemId === 'deer_trap' || itemId === 'beast_trap';
    if (isTrap) {
      const trapBtn = document.createElement('button');
      trapBtn.className = 'btn btn--tiny btn--primary';
      trapBtn.textContent = '🪤 Đặt Bẫy Tại Đây';
      trapBtn.onclick = () => handlers.onPlaceTrap(itemId                                              );
      card.append(trapBtn);
    }

    box.append(card);
  }
}

// ---------------------------------------------------------------- nhật ký

// ---------------------------------------------------------------- nhật ký

export function renderLog(
  view          ,
  profile             ,
  chapterTitle        ,
  chapterSummary        ,
  playedBeats                                  ,
)       {
  const board = el('quest-board');
  board.replaceChildren();

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
    const ruleTipHtml = (quest       ).ruleTipVi
      ? `<div style="background:rgba(224,122,60,0.12);border-left:2.5px solid var(--ember);padding:6px 10px;border-radius:4px;margin-top:6px;font-size:0.82rem;color:#fef08a;line-height:1.4;">
          💡 <strong>Quy luật:</strong> ${(quest       ).ruleTipVi.replace(/^Quy luật:\s*/, '')}
        </div>`
      : '';

    // Nút điều hướng nhanh
    let shortcutBtnHtml = '';
    const shortcut = (quest       ).shortcutTab;
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

    const sBtn = row.querySelector                   ('.btn-quest-shortcut');
    if (sBtn) {
      sBtn.onclick = () => {
        const target = sBtn.dataset.targetTab;
        if (target) {
          const tabBtn = document.querySelector                   (`.tabbar__btn[data-tab="${target}"]`);
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
    const mood = (beat       ).mood || 'calm';
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

export function renderSettings(profile             , handlers          , storageOk         )       {
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

function toggleRow(title        , desc        , on         , onToggle            )              {
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

function actionRow(title        , desc        , label        , onClick            )              {
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

export function toast(message        , kind                          = 'info')       {
  if (!message) return;

  const stack = el('toast-stack');
  const node = document.createElement('div');
  node.className = `toast toast--${kind}`;
  node.textContent = message;
  stack.append(node);

  setTimeout(() => node.remove(), 4200);
  while (stack.children.length > 4) stack.firstElementChild?.remove();
}

export function formatDuration(seconds        )         {
  if (seconds < 60) return `${Math.ceil(seconds)}″`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}′`;
  const hours = seconds / 3600;
  return hours < 24 ? `${hours.toFixed(1)} giờ` : `${Math.round(hours / 24)} ngày`;
}

export { describeInventory };
