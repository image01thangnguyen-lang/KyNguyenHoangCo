/**
 * Minigame cho các hành động chủ động tại POI (§5.2).
 *
 * Hai loại, đều lấy thời lượng từ `data/gathering.json` chứ không hardcode:
 *
 *  - `tap_rhythm` (chặt gỗ, 45 giây): nhịp bổ rìu chạy đều, bấm đúng lúc lưỡi rìu chạm gỗ.
 *    Bổ trượt không bị phạt nặng — chỉ mất một nhịp. Sức hút nằm ở việc vào guồng, không ở
 *    việc trừng phạt.
 *  - `timing_bar` (câu cá, 20 giây): con trỏ chạy qua lại, bấm khi vào vùng cá cắn câu.
 *
 * Nguyên tắc chung: người chơi bình thường luôn ăn được điểm khá. Đây là game gia đình chơi
 * 2–5 phút mỗi lần, không phải bài kiểm tra phản xạ. Điểm chỉ quyết định sản lượng nằm ở đâu
 * giữa min và max, không quyết định thành/bại.
 */

import { audio } from './audio.js';

const overlay = () => document.getElementById('overlay-action')               ;
const card = () => document.getElementById('action-card')               ;

/** Thanh nhịp một lượt. Trả về điểm 0..1. Dùng chung cho câu cá và cho các trận đánh. */
export function timingRound(host             , speed = 1)                  {
  return new Promise((resolve) => {
    const zoneStart = 0.3 + Math.random() * 0.28;
    const zoneWidth = 0.26;

    const bar = document.createElement('div');
    bar.className = 'timing';
    bar.innerHTML = `<div class="timing__zone" style="left:${zoneStart * 100}%;width:${zoneWidth * 100}%"></div><div class="timing__cursor" style="left:0%"></div>`;
    host.replaceChildren(bar);

    const cursor = bar.querySelector             ('.timing__cursor') ;
    const start = performance.now();
    const period = 1700 / speed;
    let raf = 0;
    let settled = false;

    const positionAt = (t        )         => {
      const phase = ((t - start) % period) / period;
      return phase < 0.5 ? phase * 2 : 2 - phase * 2;
    };

    const step = (now        ) => {
      cursor.style.left = `${positionAt(now) * 100}%`;
      if (!settled) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    const finish = (score        ) => {
      if (settled) return;
      settled = true;
      cancelAnimationFrame(raf);
      bar.onclick = null;
      if (score > 0.4) {
        audio.play('splash');
      }
      resolve(score);
    };

    bar.onclick = () => {
      const distance = Math.abs(positionAt(performance.now()) - (zoneStart + zoneWidth / 2));
      finish(Math.max(0, 1 - distance / (zoneWidth / 2 + 0.22)));
    };

    // Không bấm trong 4 giây thì tính điểm thấp và đi tiếp — không bắt ai phải nhanh tay.
    setTimeout(() => finish(0.18), 4000);
  });
}

/**
 * Nhịp bổ rìu. Mỗi nhịp là một vòng quét; bấm càng gần tâm càng ăn điểm.
 * Trả về điểm trung bình của các nhịp đã bổ trúng, tính trên tổng số nhịp.
 */
function tapRhythm(host             , durationSeconds        , onTick                        )                  {
  return new Promise((resolve) => {
    const beatMs = 1100;
    const totalBeats = Math.max(4, Math.round((durationSeconds * 1000) / beatMs));
    const hitWindowMs = 260;

    const stage = document.createElement('div');
    stage.className = 'chop';
    stage.innerHTML = `<div class="chop__log"></div><div class="chop__axe">🪓</div>`;
    host.replaceChildren(stage);

    const axe = stage.querySelector             ('.chop__axe') ;
    const start = performance.now();
    let scored = 0;
    let hits = 0;
    let lastBeatScored = -1;
    let raf = 0;

    const frame = (now        ) => {
      const elapsed = now - start;
      const beat = Math.floor(elapsed / beatMs);

      if (beat >= totalBeats) {
        cancelAnimationFrame(raf);
        stage.onclick = null;
        resolve(hits === 0 ? 0.15 : scored / totalBeats);
        return;
      }

      // Lưỡi rìu vung lên rồi bổ xuống; chạm gỗ đúng đầu mỗi nhịp.
      const phase = (elapsed % beatMs) / beatMs;
      const swing = phase < 0.65 ? -1 + phase / 0.65 : (1 - phase) / 0.35;
      axe.style.transform = `translateY(${swing * -38}px) rotate(${swing * -46}deg)`;

      onTick(`Nhịp ${beat + 1}/${totalBeats} · bổ trúng ${hits}`);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    stage.onclick = () => {
      const elapsed = performance.now() - start;
      const beat = Math.round(elapsed / beatMs);
      if (beat === lastBeatScored || beat >= totalBeats) return;

      const offset = Math.abs(elapsed - beat * beatMs);
      if (offset > hitWindowMs) {
        stage.classList.add('is-miss');
        setTimeout(() => stage.classList.remove('is-miss'), 140);
        return;
      }

      lastBeatScored = beat;
      hits++;
      scored += 1 - offset / hitWindowMs;
      stage.classList.add('is-hit');
      setTimeout(() => stage.classList.remove('is-hit'), 140);
      audio.play('chop');
      navigator.vibrate?.(12);
    };
  });
}

                               
               
                          
 

/**
 * Mở lớp phủ minigame và chạy tới khi xong.
 * Trả về điểm 0..1, hoặc `null` nếu người chơi bỏ giữa chừng (khi đó hành động không diễn ra).
 */
export function openMinigame(titleVi        , spec              )                         {
  return new Promise((resolve) => {
    overlay().hidden = false;
    const host = card();
    host.replaceChildren();

    const heading = document.createElement('h2');
    heading.textContent = titleVi;

    const hint = document.createElement('p');
    hint.className = 'fineprint';
    hint.textContent =
      spec.kind === 'tap_rhythm'
        ? 'Bấm đúng lúc lưỡi rìu chạm gỗ. Bổ trượt chỉ mất một nhịp, không sao cả.'
        : 'Bấm khi con trỏ vào vùng sáng — cá đang cắn câu ở đó.';

    const status = document.createElement('p');
    status.className = 'fineprint';

    const stage = document.createElement('div');

    const cancel = document.createElement('button');
    cancel.className = 'btn';
    cancel.textContent = 'Thôi, để sau';

    host.append(heading, hint, stage, status, cancel);

    let done = false;
    const finish = (score               ) => {
      if (done) return;
      done = true;
      overlay().hidden = true;
      host.replaceChildren();
      resolve(score);
    };

    cancel.onclick = () => finish(null);

    const run = async () => {
      if (spec.kind === 'tap_rhythm') {
        const score = await tapRhythm(stage, spec.durationSeconds, (text) => {
          status.textContent = text;
        });
        finish(score);
        return;
      }

      // timing_bar: ba lần thả câu, lấy điểm trung bình.
      let total = 0;
      for (let round = 0; round < 3; round++) {
        if (done) return;
        status.textContent = `Thả câu lần ${round + 1}/3`;
        total += await timingRound(stage, 1 + round * 0.2);
      }
      finish(total / 3);
    };

    void run();
  });
}
