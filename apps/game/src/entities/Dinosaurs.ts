// ====================================================
// MODULE: Dinosaurs.ts — QUẦN XÃ DÃ THÚ & T-REX BOSS 3 PHASE
// ====================================================

import { scene } from '../core/Engine.ts';
import { getTerrainHeight } from '../world/Terrain.ts';
import { worldSpatialGrid } from '../world/SpatialGrid.ts';

export const dinosaurs = [];

export class DinosaurEntity {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.species = config.species;
    this.hp = config.hp;
    this.maxHp = config.hp;
    this.atk = config.atk || 15;
    this.speed = config.speed || 3.2;
    this.aggroRadius = config.aggroRadius || 12;
    this.spawnPos = config.pos ? config.pos.clone() : new THREE.Vector3();
    this.pos = this.spawnPos.clone();
    this.mesh = null;
    this.mixer = null;
    this.state = 'PATROL';
    this.patrolTimer = 0;
    this.patrolTarget = this.spawnPos.clone();
    this.target = null;
    this.isDead = false;
    this.phase = 1;
    this.isBoss = config.isBoss || false;
  }

  takeDamage(amount, callbacks = {}) {
    if (this.isDead) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.isDead = true;
      this.state = 'DEAD';
      if (callbacks.onDinoKilled) callbacks.onDinoKilled(this);
    }
  }

  update(dt, playerPos, callbacks = {}) {
    if (this.isDead || !this.mesh) return;

    const distToPlayer = this.pos.distanceTo(playerPos);

    if (this.state === 'PATROL') {
      if (distToPlayer <= this.aggroRadius) {
        this.state = 'AGGRO';
      } else {
        this.patrolTimer -= dt;
        if (this.patrolTimer <= 0) {
          this.patrolTimer = 3 + Math.random() * 4;
          const r = 8;
          this.patrolTarget.set(
            this.spawnPos.x + (Math.random() - 0.5) * r * 2,
            0,
            this.spawnPos.z + (Math.random() - 0.5) * r * 2
          );
        }
        const dir = this.patrolTarget.clone().sub(this.pos);
        if (dir.length() > 0.5) {
          dir.normalize();
          this.pos.addScaledVector(dir, this.speed * 0.5 * dt);
          this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        }
      }
    } else if (this.state === 'AGGRO') {
      if (distToPlayer > this.aggroRadius * 1.8) {
        this.state = 'PATROL';
      } else if (distToPlayer <= 2.2) {
        // Tấn công người chơi
        if (callbacks.onAttackPlayer) callbacks.onAttackPlayer(this.atk);
      } else {
        const dir = playerPos.clone().sub(this.pos);
        dir.normalize();
        this.pos.addScaledVector(dir, this.speed * dt);
        this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      }
    }

    this.pos.y = getTerrainHeight(this.pos.x, this.pos.z);
    this.mesh.position.copy(this.pos);
    worldSpatialGrid.update(this, this.pos.x, this.pos.z);
  }
}
