// ====================================================
// MODULE: Water.ts — VÙNG ĐẦM LẦY & HỒ NƯỚC TÂY NAM
// ====================================================

import { scene } from '../core/Engine.ts';

export const LAKE_CENTER = { x: -18, z: 18 };
export const lakeRadiusX = 14;
export const lakeRadiusZ = 10;

export function isLakeZone(x, z, margin = 0) {
  const dx = (x - LAKE_CENTER.x) / (lakeRadiusX + margin);
  const dz = (z - LAKE_CENTER.z) / (lakeRadiusZ + margin);
  return (dx * dx + dz * dz) <= 1.0;
}

export function createLakeMesh() {
  const lakeShape = new THREE.Shape();
  const segments = 48;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const rx = lakeRadiusX + Math.sin(theta * 3) * 0.8;
    const rz = lakeRadiusZ + Math.cos(theta * 2) * 0.6;
    const px = Math.cos(theta) * rx;
    const pz = Math.sin(theta) * rz;
    if (i === 0) lakeShape.moveTo(px, pz);
    else lakeShape.lineTo(px, pz);
  }

  const waterGeo = new THREE.ShapeGeometry(lakeShape);
  waterGeo.rotateX(-Math.PI / 2);

  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.82,
    roughness: 0.15,
    metalness: 0.25
  });

  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.set(LAKE_CENTER.x, 0.05, LAKE_CENTER.z);
  scene.add(waterMesh);

  // Bờ cát xung quanh hồ
  const sandMat = new THREE.MeshStandardMaterial({
    color: 0xd4a373,
    roughness: 0.95
  });
  const sandGeo = new THREE.RingGeometry(10, 16, 32);
  sandGeo.rotateX(-Math.PI / 2);
  const sandMesh = new THREE.Mesh(sandGeo, sandMat);
  sandMesh.position.set(LAKE_CENTER.x, 0.02, LAKE_CENTER.z);
  scene.add(sandMesh);

  return { waterMesh, sandMesh };
}
