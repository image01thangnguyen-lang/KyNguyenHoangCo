// ====================================================
// MODULE: Player.ts — DŨNG SĨ TIỀN SỬ (CONTROLLER, COMBAT & DODGE)
// ====================================================

import { GameState, WEAPON_TIERS } from '../core/State.ts';
import { scene, _camForward, _camRight, _moveVec, _upVec } from '../core/Engine.ts';
import { getTerrainHeight } from '../world/Terrain.ts';
import { isLakeZone } from '../world/Water.ts';
import { playSfx } from '../core/Audio.ts';

export function initPlayerGroup() {
  const p = GameState.player;
  p.group = new THREE.Group();
  p.group.position.set(0, 0, 0);
  p.dodgeDir = new THREE.Vector3();
  scene.add(p.group);
  return p.group;
}

export function playHeroAction(actionName, force = false, fadeDuration = 0.18) {
  const p = GameState.player;
  const char = p.characters[p.gender];
  if (!char || !char.mixer || !char.actions) return;

  if (p.currentAnimName === actionName && !force) return;

  const prevAction = char.currentAction;
  const nextAction = char.actions[actionName];
  if (!nextAction) return;

  if (prevAction && prevAction !== nextAction) {
    prevAction.fadeOut(fadeDuration);
  }

  nextAction.reset().fadeIn(fadeDuration).play();
  char.currentAction = nextAction;
  p.currentAnimName = actionName;
  char.currentAnimName = actionName;
}

export function triggerAttack(callbacks = {}) {
  const p = GameState.player;
  if (p.isDead || p.isAttacking || p.isDodging || p.isPickingUp) return;

  if (p.stamina < 12) {
    if (callbacks.onNoStamina) callbacks.onNoStamina();
    return;
  }

  p.stamina = Math.max(0, p.stamina - 12);
  p.isAttacking = true;
  p.attackTimer = 0.45;
  playHeroAction('attack', true, 0.08);
  playSfx('swing');

  if (callbacks.onAttackExecuted) callbacks.onAttackExecuted();
}

export function triggerDodge(callbacks = {}) {
  const p = GameState.player;
  if (p.isDead || p.isDodging) return;

  if (p.stamina < 20) {
    if (callbacks.onNoStamina) callbacks.onNoStamina();
    return;
  }

  p.stamina = Math.max(0, p.stamina - 20);
  p.isDodging = true;
  p.dodgeTimer = 0.38;

  // Lấy hướng né từ joystick hoặc góc đối diện
  if (p.moving && (Math.abs(p.dodgeDir.x) > 0.01 || Math.abs(p.dodgeDir.z) > 0.01)) {
    // Giữ nguyên dodgeDir hiện tại
  } else {
    p.dodgeDir.set(Math.sin(p.facingAngle), 0, Math.cos(p.facingAngle));
  }

  playHeroAction('dodge', true, 0.05);
  playSfx('dodge');
  if (callbacks.onDodgeExecuted) callbacks.onDodgeExecuted();
}
