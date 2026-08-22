// ====================================================
// MODULE: Pet.ts — LINH THÚ HỔ RĂNG KIẾM ĐỒNG HÀNH
// ====================================================

export const petState = {
  active: true,
  name: 'Bạch Hổ Tiền Sử',
  pos: new THREE.Vector3(1.5, 0, 1.5),
  mesh: null,
  mixer: null,
  atkBonus: 0.25
};

export function updatePet(dt, playerPos) {
  if (!petState.active || !petState.mesh) return;

  const target = playerPos.clone().add(new THREE.Vector3(1.4, 0, 1.4));
  const dist = petState.pos.distanceTo(target);
  if (dist > 1.2) {
    const dir = target.clone().sub(petState.pos).normalize();
    petState.pos.addScaledVector(dir, 5.8 * dt);
    petState.mesh.rotation.y = Math.atan2(dir.x, dir.z);
  }
  petState.mesh.position.copy(petState.pos);
}
