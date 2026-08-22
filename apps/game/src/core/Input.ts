export const input = { x: 0, z: 0, keys: {} };

export function initInput(callbacks = {}) {
  const { onAttack, onInteract, onDodge, onDialogueAdvance, onDialogueSkip } = callbacks;

  window.addEventListener('keydown', (e) => {
    input.keys[e.key.toLowerCase()] = true;
    if (window.isDialogueActive) {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (onDialogueAdvance) onDialogueAdvance();
        return;
      }
      if (e.code === 'Escape') {
        e.preventDefault();
        if (onDialogueSkip) onDialogueSkip();
        return;
      }
      return;
    }
    if (e.key === ' ' || e.key.toLowerCase() === 'j') {
      if (onAttack) onAttack();
    }
    if (e.key.toLowerCase() === 'e' || e.key.toLowerCase() === 'f') {
      if (onInteract) onInteract();
    }
    if (e.key.toLowerCase() === 'l' || e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'q') {
      if (onDodge) onDodge();
    }
  });

  window.addEventListener('keyup', (e) => {
    input.keys[e.key.toLowerCase()] = false;
  });

  // Joystick Ảo
  const joyBase = document.getElementById('joystick-base');
  const joyStick = document.getElementById('joystick-stick');
  let joyActive = false, joyTouchId = null, joyCenter = { x: 0, y: 0 };
  const maxR = 36;

  function onJoyStart(cx, cy, id) {
    joyActive = true;
    joyTouchId = id;
    if (!joyBase) return;
    const rect = joyBase.getBoundingClientRect();
    joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    onJoyMove(cx, cy);
  }

  function onJoyMove(cx, cy) {
    if (!joyActive || !joyStick) return;
    const dx = cx - joyCenter.x, dy = cy - joyCenter.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const cl = Math.min(dist, maxR);
    const sx = Math.cos(angle) * cl, sy = Math.sin(angle) * cl;
    joyStick.style.transform = 'translate(' + sx + 'px, ' + sy + 'px)';
    input.x = sx / maxR;
    input.z = sy / maxR;
  }

  function onJoyEnd() {
    joyActive = false;
    joyTouchId = null;
    if (joyStick) joyStick.style.transform = 'translate(0px, 0px)';
    input.x = 0;
    input.z = 0;
  }

  if (joyBase) {
    joyBase.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; onJoyStart(t.clientX, t.clientY, t.identifier); e.preventDefault(); }, { passive: false });
    window.addEventListener('touchmove', (e) => {
      if (!joyActive) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joyTouchId) {
          onJoyMove(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
          break;
        }
      }
    }, { passive: false });
    window.addEventListener('touchend', (e) => {
      if (!joyActive) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joyTouchId) {
          onJoyEnd();
          break;
        }
      }
    });
    window.addEventListener('touchcancel', onJoyEnd);
  }

  const btnAtk = document.getElementById('btn-attack');
  const btnDodge = document.getElementById('btn-dodge');
  const btnInteract = document.getElementById('btn-interact');
  if (btnAtk) btnAtk.addEventListener('click', () => onAttack && onAttack());
  if (btnDodge) btnDodge.addEventListener('click', () => onDodge && onDodge());
  if (btnInteract) btnInteract.addEventListener('click', () => onInteract && onInteract());
}
