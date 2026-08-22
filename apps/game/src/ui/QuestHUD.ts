// ====================================================
// MODULE: QuestHUD.ts — BANNER NHIỆM VỤ & CỘT SÁNG ĐỊNH VỊ 3D BEACON
// ====================================================

import { scene } from '../core/Engine.ts';
import { GameState } from '../core/State.ts';

export let questBeaconGroup = null;

export function createQuestBeacon(pos = new THREE.Vector3(9.0, 0, -3.0)) {
  questBeaconGroup = new THREE.Group();
  questBeaconGroup.position.copy(pos);

  // Vòng sáng chân cột
  const ringGeo = new THREE.RingGeometry(1.2, 1.8, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  questBeaconGroup.add(ringMesh);

  // Cột sáng thẳng đứng 24m
  const beamGeo = new THREE.CylinderGeometry(0.4, 0.4, 24, 16, 1, true);
  beamGeo.translate(0, 12, 0);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
  const beamMesh = new THREE.Mesh(beamGeo, beamMat);
  questBeaconGroup.add(beamMesh);

  scene.add(questBeaconGroup);
  return questBeaconGroup;
}

export function updateQuestHUD(title, progressText, isCompleted = false) {
  const banner = document.getElementById('hud-quest-banner');
  if (!banner) return;
  const elTitle = document.getElementById('hud-quest-title');
  const elProg = document.getElementById('hud-quest-progress');
  if (elTitle) elTitle.textContent = title;
  if (elProg) elProg.textContent = progressText;
}
