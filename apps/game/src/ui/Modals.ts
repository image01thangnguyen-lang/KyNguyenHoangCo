// ====================================================
// MODULE: Modals.ts — GIAO DIỆN MODAL QUẢN TRỊ, TÚI ĐỒ, LÒ RÈN & CÀI ĐẶT
// ====================================================

import { GameState, WEAPON_TIERS, ROLE_INFO, ERA_CONFIG, saveGameState } from '../core/State.ts';
import { currentGraphicsProfile, applyGraphicsProfile } from '../core/Engine.ts';
import { audioMuted, toggleAudioMute } from '../core/Audio.ts';

export function openModal(html) {
  const overlay = document.getElementById('game-modal-overlay');
  const content = document.getElementById('game-modal-content');
  if (content && overlay) {
    content.innerHTML = html;
    overlay.classList.add('active');
    const closeBtn = document.getElementById('modal-close-btn');
    if (closeBtn) closeBtn.onclick = closeModal;
  }
}

export function closeModal() {
  const overlay = document.getElementById('game-modal-overlay');
  if (overlay) overlay.classList.remove('active');
}

export function openSettingsModal() {
  const playMins = Math.round((GameState.playTimeSeconds || 0) / 60);
  const mult = GameState.harvestMultiplier || 1.0;
  const multPercent = Math.round(mult * 100);

  const html = [
    '<div class="modal-header">',
    '  <span class="modal-title">⚙️ CÀI ĐẶT & QUẢN TRỊ BỘ TỘC</span>',
    '  <button class="modal-close" id="modal-close-btn">✕</button>',
    '</div>',
    '<div style="display:flex; flex-direction:column; gap:10px; font-size:11.5px; color:#fef08a;">',
    '  <div style="background:rgba(0,0,0,0.5); padding:10px; border-radius:8px; border:1px solid var(--line);">',
    '    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">',
    '      <div style="font-weight:900; color:#38bdf8;">🎮 ĐỒ HỌA RETINA & FPS (IOS / MOBILE)</div>',
    '      <div style="font-size:10px; color:#fde047; font-weight:800;">' + currentGraphicsProfile.toUpperCase() + '</div>',
    '    </div>',
    '    <div style="font-size:9.5px; color:#cbd5e1; margin-bottom:8px;">',
    '      Tăng độ nét màn hình Retina hoặc tối ưu FPS mượt mà cho thiết bị di động:',
    '    </div>',
    '    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:6px;">',
    '      <button class="trade-btn" style="padding:7px 0; font-size:10px; font-weight:900; background:' + (currentGraphicsProfile === 'ultra' ? '#0284c7' : 'rgba(255,255,255,0.08)') + ';" onclick="window.setGraphicsProfile(\'ultra\')">💎 Siêu Nét</button>',
    '      <button class="trade-btn" style="padding:7px 0; font-size:10px; font-weight:900; background:' + (currentGraphicsProfile === 'balanced' ? '#059669' : 'rgba(255,255,255,0.08)') + ';" onclick="window.setGraphicsProfile(\'balanced\')">⚡ Cân Bằng</button>',
    '      <button class="trade-btn" style="padding:7px 0; font-size:10px; font-weight:900; background:' + (currentGraphicsProfile === 'performance' ? '#d97706' : 'rgba(255,255,255,0.08)') + ';" onclick="window.setGraphicsProfile(\'performance\')">🔋 Mượt / Pin</button>',
    '    </div>',
    '  </div>',
    '  <div style="background:rgba(0,0,0,0.5); padding:10px; border-radius:8px; border:1px solid var(--line); display:flex; justify-content:space-between; align-items:center;">',
    '    <div>',
    '      <div style="font-weight:900; color:#fff;">🔊 ÂM THANH GAME (WEB AUDIO)</div>',
    '      <div style="font-size:10px; color:#9ca3af;">Bật/Tắt hiệu ứng va chạm & tiếng gầm dã thú</div>',
    '    </div>',
    '    <button class="trade-btn" style="padding:6px 14px; font-size:11px;" onclick="window.toggleAudio()">',
    '      ' + (audioMuted ? '🔇 Đang Tắt' : '🔊 Đang Bật'),
    '    </button>',
    '  </div>',
    '  <div style="background:rgba(0,0,0,0.5); padding:10px; border-radius:8px; border:1px solid var(--line);">',
    '    <div style="font-weight:900; color:#fff; margin-bottom:4px;">⏱️ THỐNG KÊ SESSION</div>',
    '    <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:10.5px; color:#cbd5e1;">',
    '      <div>🕒 Thời gian: <b style="color:#38bdf8;">' + playMins + ' phút</b></div>',
    '      <div>🌾 Tỉ lệ rơi: <b style="color:' + (mult < 0.5 ? '#f87171' : '#34d399') + ';">' + multPercent + '%</b></div>',
    '    </div>',
    '  </div>',
    '</div>'
  ].join('\n');
  openModal(html);
}

window.setGraphicsProfile = function (profile) {
  applyGraphicsProfile(profile);
  openSettingsModal();
};

window.toggleAudio = function () {
  toggleAudioMute();
  openSettingsModal();
};
