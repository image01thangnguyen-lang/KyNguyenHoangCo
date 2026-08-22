// ====================================================
// MODULE: Terrain.ts — BẢN ĐỒ ĐỊA HÌNH & THẢM CỎ GHIBLI ANISOTROPIC
// ====================================================

import { renderer, scene, currentGraphicsProfile } from '../core/Engine.ts';

export function getTerrainHeight(x, z) {
  const dCampSq = x * x + z * z;
  if (dCampSq < 400) return 0; // Trại trung tâm bằng phẳng
  const distFromCamp = Math.sqrt(dCampSq);
  const blend = Math.min(1, Math.max(0, (distFromCamp - 20) / 15));
  const wave1 = Math.sin(x * 0.035) * Math.cos(z * 0.035) * 1.8;
  const wave2 = Math.sin(x * 0.08 + 1.2) * Math.sin(z * 0.08 + 0.5) * 0.6;
  return (wave1 + wave2) * blend;
}

export function createStylizedLushGrassTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const c = canvas.getContext('2d');

  const grad = c.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#589e34');
  grad.addColorStop(0.5, '#6ab63c');
  grad.addColorStop(1, '#4d8c2d');
  c.fillStyle = grad;
  c.fillRect(0, 0, 512, 512);

  c.fillStyle = 'rgba(45, 85, 25, 0.12)';
  for (let i = 0; i < 40; i++) {
    c.beginPath();
    c.arc((i * 137) % 512, (i * 223) % 512, 24 + (i % 20), 0, Math.PI * 2);
    c.fill();
  }

  const flowerColors = ['#fef08a', '#fbcfe8', '#fed7aa', '#e9d5ff'];
  for (let i = 0; i < 70; i++) {
    const cx = (i * 83) % 500 + 6;
    const cy = (i * 157) % 500 + 6;
    c.fillStyle = flowerColors[i % flowerColors.length];
    c.beginPath();
    c.arc(cx, cy, 1.2, 0, Math.PI * 2);
    c.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(40, 40);
  texture.encoding = THREE.sRGBEncoding;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const maxAniso = renderer.capabilities.getMaxAnisotropy() || 1;
  texture.anisotropy = currentGraphicsProfile === 'ultra' ? Math.min(maxAniso, 4) : currentGraphicsProfile === 'balanced' ? Math.min(maxAniso, 2) : 1;
  texture.needsUpdate = true;
  return texture;
}

export const grassTexture = createStylizedLushGrassTexture();
export const groundGeo = new THREE.PlaneGeometry(360, 360, 60, 60);
groundGeo.rotateX(-Math.PI / 2);

const pos = groundGeo.attributes.position;
for (let i = 0; i < pos.count; i++) {
  const vx = pos.getX(i);
  const vz = pos.getZ(i);
  pos.setY(i, getTerrainHeight(vx, vz));
}
groundGeo.computeVertexNormals();

export const groundMat = new THREE.MeshStandardMaterial({
  map: grassTexture,
  color: 0xffffff,
  roughness: 0.85,
  metalness: 0.05,
  flatShading: false
});

export const ground = new THREE.Mesh(groundGeo, groundMat);
ground.receiveShadow = true;
scene.add(ground);
