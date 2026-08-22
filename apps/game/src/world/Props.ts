// ====================================================
// MODULE: Props.ts — CÔNG TRÌNH TIỀN ĐỒN & TÀI NGUYÊN KHAI THÁC
// ====================================================

import { scene, freezeStaticModel, setupModelMesh } from '../core/Engine.ts';
import { getTerrainHeight } from './Terrain.ts';
import { worldSpatialGrid } from './SpatialGrid.ts';

export const harvestNodes = [];
export const worldChunks = [];

export function registerWorldChunk(id, center, radius, getGroup, onVisibilityChanged) {
  const chunk = {
    id,
    center: center.clone(),
    radius,
    radiusSq: radius * radius,
    getGroup,
    visible: true,
    show() {
      this.visible = true;
      const group = this.getGroup ? this.getGroup() : null;
      if (group) group.visible = true;
      if (this.onVisibilityChanged) this.onVisibilityChanged(true);
    },
    hide() {
      this.visible = false;
      const group = this.getGroup ? this.getGroup() : null;
      if (group) group.visible = false;
      if (this.onVisibilityChanged) this.onVisibilityChanged(false);
    },
    onVisibilityChanged
  };
  worldChunks.push(chunk);
  return chunk;
}

export function createProceduralFloraAndRocks() {
  const floraGroup = new THREE.Group();
  scene.add(floraGroup);

  // 1. Cây đại thụ quanh bản đồ
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 3.8, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
  const leavesGeo = new THREE.ConeGeometry(2.2, 4.5, 6);
  const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.8 });

  for (let i = 0; i < 65; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 24 + Math.random() * 95;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const y = getTerrainHeight(x, z);

    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.9;
    trunk.castShadow = true;
    tree.add(trunk);

    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.y = 4.2;
    leaves.castShadow = true;
    tree.add(leaves);

    tree.position.set(x, y, z);
    freezeStaticModel(tree);
    floraGroup.add(tree);

    const node = {
      id: 'tree_' + i,
      type: 'wood',
      name: 'Đại Thụ Tiền Sử',
      x, y, z,
      amount: 15,
      maxAmount: 15,
      mesh: tree
    };
    harvestNodes.push(node);
    worldSpatialGrid.insert(node, x, z);
  }

  // 2. Mỏ đá & Quặng thô
  const rockGeo = new THREE.DodecahedronGeometry(1.2, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.95 });

  for (let i = 0; i < 45; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 18 + Math.random() * 105;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const y = getTerrainHeight(x, z);

    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(x, y + 0.6, z);
    rock.scale.set(1 + Math.random() * 0.5, 0.8 + Math.random() * 0.6, 1 + Math.random() * 0.5);
    rock.castShadow = true;
    freezeStaticModel(rock);
    floraGroup.add(rock);

    const node = {
      id: 'rock_' + i,
      type: 'stone',
      name: 'Khối Cự Thạch',
      x, y, z,
      amount: 10,
      maxAmount: 10,
      mesh: rock
    };
    harvestNodes.push(node);
    worldSpatialGrid.insert(node, x, z);
  }

  return floraGroup;
}
