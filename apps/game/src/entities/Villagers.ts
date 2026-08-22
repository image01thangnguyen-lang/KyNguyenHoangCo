// ====================================================
// MODULE: Villagers.ts — AI DÂN LÀNG FSM TỰ ĐỘNG THU THẬP
// ====================================================

import { GameState, ROLE_INFO } from '../core/State.ts';
import { getTerrainHeight } from '../world/Terrain.ts';
import { harvestNodes } from '../world/Props.ts';

export function updateVillagersFSM(dt) {
  if (!GameState.villagers) return;

  GameState.villagers.forEach((v) => {
    if (v.role === 'RESTING' || !v.meshGroup) return;

    if (v.state === 'SEEKING_NODE') {
      // Tìm tài nguyên phù hợp
      let targetNode = null;
      let minDist = Infinity;
      const targetType = v.role === 'LUMBERJACK' ? 'wood' : v.role === 'MINER' ? 'stone' : 'herb';

      for (let i = 0; i < harvestNodes.length; i++) {
        const node = harvestNodes[i];
        if (node.type === targetType && node.amount > 0) {
          const dx = node.x - v.x;
          const dz = node.z - v.z;
          const d = dx * dx + dz * dz;
          if (d < minDist) {
            minDist = d;
            targetNode = node;
          }
        }
      }

      if (targetNode) {
        v.targetNode = targetNode;
        v.state = 'GATHERING';
      }
    } else if (v.state === 'GATHERING') {
      if (!v.targetNode || v.targetNode.amount <= 0) {
        v.state = 'SEEKING_NODE';
        return;
      }
      const dx = v.targetNode.x - v.x;
      const dz = v.targetNode.z - v.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 1.8) {
        v.x += (dx / dist) * 2.8 * dt;
        v.z += (dz / dist) * 2.8 * dt;
      } else {
        // Thu hoạch
        v.carriedAmount = (v.carriedAmount || 0) + dt * 1.5;
        if (v.carriedAmount >= 10) {
          v.state = 'RETURNING_CAMP';
        }
      }
    } else if (v.state === 'RETURNING_CAMP') {
      const dx = 0 - v.x;
      const dz = 0 - v.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 2.0) {
        v.x += (dx / dist) * 2.8 * dt;
        v.z += (dz / dist) * 2.8 * dt;
      } else {
        // Nộp tài nguyên vào kho
        if (v.role === 'LUMBERJACK') GameState.empire.wood += Math.floor(v.carriedAmount);
        else if (v.role === 'MINER') GameState.empire.stone += Math.floor(v.carriedAmount);
        else if (v.role === 'FORAGER') GameState.empire.food += Math.floor(v.carriedAmount);
        v.carriedAmount = 0;
        v.state = 'SEEKING_NODE';
      }
    }

    v.meshGroup.position.set(v.x, getTerrainHeight(v.x, v.z), v.z);
  });
}
