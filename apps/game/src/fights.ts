/**
 * Hai lớp phủ chiến đấu: Phòng thủ đêm và Đêm Trăng Máu.
 *
 * Cả hai đều CHƠI TẠI NHÀ (§5.4, §5.5). Không có cơ chế nào ở đây yêu cầu người chơi ra
 * ngoài đường, và không có phần thưởng nào cao hơn khi chơi ban đêm ngoài trời.
 *
 * Minigame là một thanh nhịp: con trỏ chạy qua lại, người chơi bấm khi nó nằm trong vùng
 * xanh. Cố ý đơn giản — cả nhà chơi được, kể cả trẻ con và bố mẹ không quen game.
 */

import { BLOOD_MOON, getItem } from '../../../packages/game-core/src/index.ts';
import type { BloodMoonFight, DifficultyId, GameView, ProfileSave } from '../../../packages/game-core/src/index.ts';
import { el } from './panels.ts';
import { timingRound } from './minigames.ts';
import { buzz } from './platform.ts';

const overlay = () => el('overlay-action');
const card = () => el('action-card');

function close(): void {
  overlay().hidden = true;
  card().replaceChildren();
}

function show(): void {
  overlay().hidden = false;
}

// ---------------------------------------------------------------- phòng thủ đêm

export interface NightDefenseHandlers {
  resolve(performance: number): { logVi: string[]; survived: boolean; rewardsVi: string };
  onClosed(): void;
}

export function openNightDefense(view: GameView, handlers: NightDefenseHandlers): void {
  show();
  const host = card();
  host.replaceChildren();

  host.innerHTML = `
    <h2>Đêm xuống</h2>
    <p>${view.tonight.verdictVi}</p>
    <p class="fineprint">Sức phòng thủ trại: ${view.tonight.power} · Đợt mạnh nhất đêm nay: ${view.tonight.requiredPower}</p>
    <p class="fineprint">Bấm đúng nhịp để phản công. Bạn có thể tắt màn hình và để trại tự thủ — sẽ yếu hơn khoảng 25%.</p>
  `;

  const stage = document.createElement('div');
  host.append(stage);

  const start = document.createElement('button');
  start.className = 'btn btn--primary';
  start.textContent = 'Đứng gác đêm nay';

  const skip = document.createElement('button');
  skip.className = 'btn';
  skip.textContent = 'Để trại tự thủ';

  host.append(start, skip);

  skip.onclick = () => {
    const outcome = handlers.resolve(0);
    renderOutcome(host, outcome);
  };

  start.onclick = async () => {
    start.disabled = true;
    skip.disabled = true;

    let total = 0;
    for (let round = 0; round < 3; round++) {
      const heading = document.createElement('p');
      heading.className = 'fineprint';
      heading.textContent = `Đợt ${round + 1}/3 — bấm khi con trỏ vào vùng sáng.`;
      stage.replaceChildren(heading);

      const scoreHost = document.createElement('div');
      stage.append(scoreHost);
      total += await timingRound(scoreHost, 1 + round * 0.25);
    }

    const outcome = handlers.resolve(total / 3);
    buzz(outcome.survived ? [20, 60, 20] : [120, 60, 120]);
    renderOutcome(host, outcome);
  };
}

function renderOutcome(
  host: HTMLElement,
  outcome: { logVi: string[]; survived: boolean; rewardsVi: string },
): void {
  host.replaceChildren();

  const title = document.createElement('h2');
  title.textContent = outcome.survived ? 'Trại còn nguyên' : 'Trại bị chọc thủng';
  host.append(title);

  const log = document.createElement('div');
  log.className = 'fight__log';
  for (const line of outcome.logVi) {
    const div = document.createElement('div');
    div.textContent = line;
    log.append(div);
  }
  host.append(log);

  if (outcome.rewardsVi) {
    const rewards = document.createElement('p');
    rewards.textContent = `Nhận được: ${outcome.rewardsVi}`;
    host.append(rewards);
  }

  const done = document.createElement('button');
  done.className = 'btn btn--primary';
  done.textContent = 'Đóng';
  done.onclick = close;
  host.append(done);
}

// ---------------------------------------------------------------- Trăng Máu

export interface BloodMoonHandlers {
  begin(difficulty: DifficultyId): { ok: boolean; messageVi: string; fight: BloodMoonFight | null };
  strike(performance: number): { fight: BloodMoonFight | null; messageVi: string; defeated: boolean };
  tick(): BloodMoonFight | null;
  settle(): { summaryVi: string; victory: boolean; rewardsVi: string };
  onClosed(): void;
}

export function openBloodMoon(profile: ProfileSave, handlers: BloodMoonHandlers): void {
  show();
  const host = card();

  if (profile.activeFight && !profile.activeFight.settled) {
    renderFight(host, profile.activeFight, handlers, []);
    return;
  }

  host.replaceChildren();
  host.innerHTML = `
    <h2>Đêm Trăng Máu</h2>
    <p>Trăng đỏ như máu. Chọn độ khó — công trình phòng thủ bạn đã xây sẽ đánh cùng bạn.</p>
  `;

  let chosen: DifficultyId = BLOOD_MOON.defaultDifficulty as DifficultyId;

  const picker = document.createElement('div');
  picker.className = 'difficulty';
  for (const difficulty of BLOOD_MOON.difficulties) {
    const button = document.createElement('button');
    button.className = difficulty.id === chosen ? 'is-on' : '';
    button.innerHTML = `<strong>${difficulty.nameVi}</strong><br>${difficulty.descVi}`;
    button.onclick = () => {
      chosen = difficulty.id as DifficultyId;
      for (const sibling of picker.children) sibling.classList.remove('is-on');
      button.classList.add('is-on');
    };
    picker.append(button);
  }
  host.append(picker);

  const go = document.createElement('button');
  go.className = 'btn btn--primary';
  go.textContent = 'Vào trận';
  go.onclick = () => {
    const result = handlers.begin(chosen);
    if (!result.ok || !result.fight) {
      const error = document.createElement('p');
      error.className = 'missing';
      error.textContent = result.messageVi;
      host.append(error);
      return;
    }
    renderFight(host, result.fight, handlers, [result.messageVi]);
  };

  const cancel = document.createElement('button');
  cancel.className = 'btn';
  cancel.textContent = 'Để sau';
  cancel.onclick = () => {
    close();
    handlers.onClosed();
  };

  host.append(go, cancel);
}

function renderFight(
  host: HTMLElement,
  fight: BloodMoonFight,
  handlers: BloodMoonHandlers,
  initialLog: string[],
): void {
  const boss = BLOOD_MOON.bosses.find((b) => b.id === fight.bossId)!;
  const log = [...initialLog];
  let current = fight;
  let busy = false;

  host.replaceChildren();
  host.innerHTML = `
    <h2>${boss.nameVi}</h2>
    <p class="fineprint">Điểm yếu: ${getItem(boss.weakTo).nameVi}${fight.isMakeup ? ' · Trận đánh bù, thưởng giảm 30%' : ''}</p>
    <div class="fight__bar"><div></div></div>
    <div class="fight__stats"><span class="js-hp"></span><span class="js-share"></span></div>
    <div class="fight__log"></div>
  `;

  const fill = host.querySelector<HTMLElement>('.fight__bar > div')!;
  const hpText = host.querySelector<HTMLElement>('.js-hp')!;
  const shareText = host.querySelector<HTMLElement>('.js-share')!;
  const logBox = host.querySelector<HTMLElement>('.fight__log')!;

  const stage = document.createElement('div');
  host.append(stage);

  const attack = document.createElement('button');
  attack.className = 'btn btn--primary';
  attack.textContent = 'Tấn công';

  const finish = document.createElement('button');
  finish.className = 'btn';
  finish.textContent = 'Chốt trận';

  host.append(attack, finish);

  const paint = () => {
    const ratio = Math.max(0, current.remainingHp / current.totalHp);
    fill.style.width = `${ratio * 100}%`;
    hpText.textContent = `${current.remainingHp.toLocaleString('vi-VN')} / ${current.totalHp.toLocaleString('vi-VN')} máu`;

    const total = current.playerDamage + current.allyDamage;
    const share = total > 0 ? Math.round((current.playerDamage / total) * 100) : 0;
    shareText.textContent = `Bạn ${share}% · Công trình ${100 - share}%`;

    logBox.replaceChildren(
      ...log.slice(-14).map((line) => {
        const div = document.createElement('div');
        div.textContent = line;
        return div;
      }),
    );
    logBox.scrollTop = logBox.scrollHeight;
  };

  // Đồng đội công trình gõ đều đặn suốt trận, kể cả khi người chơi đang ngắm thanh nhịp.
  const allyTimer = setInterval(() => {
    if (busy) return;
    const ticked = handlers.tick();
    if (ticked) {
      current = ticked;
      paint();
    }
  }, 1500);

  const stop = () => clearInterval(allyTimer);

  attack.onclick = async () => {
    if (busy) return;
    busy = true;
    attack.disabled = true;

    const score = await timingRound(stage, 1.2);
    const result = handlers.strike(score);
    if (result.fight) current = result.fight;
    if (result.messageVi) log.push(result.messageVi);

    stage.replaceChildren();
    paint();
    busy = false;
    attack.disabled = false;

    if (result.defeated) {
      log.push('Nó gục xuống. Mặt đất rung một nhịp cuối.');
      stop();
      settleNow();
    }
  };

  const settleNow = () => {
    stop();
    const settlement = handlers.settle();
    host.replaceChildren();

    const title = document.createElement('h2');
    title.textContent = settlement.victory ? 'Hạ được rồi' : 'Trăng lặn';
    host.append(title);

    const summary = document.createElement('p');
    summary.textContent = settlement.summaryVi;
    host.append(summary);

    if (settlement.rewardsVi) {
      const rewards = document.createElement('p');
      rewards.textContent = `Phần thưởng: ${settlement.rewardsVi}`;
      host.append(rewards);
    }

    const done = document.createElement('button');
    done.className = 'btn btn--primary';
    done.textContent = 'Đóng';
    done.onclick = () => {
      close();
      handlers.onClosed();
    };
    host.append(done);
  };

  finish.onclick = settleNow;
  paint();
}

export { close as closeFightOverlay };
