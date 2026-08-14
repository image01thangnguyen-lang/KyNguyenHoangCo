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
} from '../../../packages/game-core/src/index.js';
import { actionIconSvg, itemIconSvg, zoneIconSvg } from './itemIcons.js';
             
           
                  
              
             
         
                                                  

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

  el('camp-summary').innerHTML = `
    <h2>${tier.nameVi}</h2>
    <p>${tier.eraVi} · Sức phòng thủ nền ${tier.baseDefense} · Kho ${view.storageUsed}/${tier.storageSlots} ô</p>
    <p>${view.tonight.verdictVi}</p>
  `;

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

export function renderLog(view          , profile             , chapterTitle        , chapterSummary        , playedBeats                                  )       {
  const board = el('quest-board');
  board.replaceChildren();

  if (view.quests.length === 0) {
    const done = document.createElement('p');
    done.className = 'fineprint';
    done.textContent = 'Ba ngày đầu đã qua. Từ giờ bạn tự quyết định mình sống thế nào.';
    board.append(done);
  }

  for (const quest of view.quests) {
    const row = document.createElement('div');
    row.className = `row${quest.done ? ' is-done' : ''}`;
    const progress = quest.need > 1 ? ` (${Math.min(quest.have, quest.need)}/${quest.need})` : '';
    row.innerHTML = `<div class="row__body"><div class="row__title">${quest.titleVi}${progress}</div><div class="row__sub">${quest.descVi}</div></div>`;
    board.append(row);
  }

  el('chapter-info').innerHTML = `<h3>${chapterTitle}</h3><p>${chapterSummary}</p>`;

  const history = el('beat-history');
  history.replaceChildren();
  for (const beat of playedBeats) {
    const div = document.createElement('div');
    div.className = 'beat';
    div.textContent = beat.textVi;
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
