/**
 * phaserTypes.ts
 * Khai báo Định kiểu & Interfaces cho Hệ thống Game Phaser 3 "Kỷ Nguyên Hoang Cổ"
 *
 * Tương thích với TypeScript type stripping của Node 24 (không yêu cầu cài đặt npm package phaser).
 */

// Lấy đối tượng toàn cục Phaser được nạp từ CDN Phaser 3
export const Phaser: any =
  (globalThis as any).Phaser ||
  (typeof window !== 'undefined' ? (window as any).Phaser : undefined) ||
  {};

export interface Position2D {
  x: number;
  y: number;
}

export interface LatLonCoord {
  lat: number;
  lon: number;
}

export type EntityAnimationState = 'idle' | 'walk' | 'attack' | 'dead';

export interface BeastConfig {
  id: string;
  species: string;
  nameVi: string;
  x: number;
  y: number;
  lat?: number;
  lon?: number;
  hp: number;
  maxHp: number;
  level: number;
  attackPower: number;
  defense: number;
  speed: number;
  roamRadius?: number;
  aggroRadius?: number;
  spriteKey?: string;
  catalogId?: string;
  drops?: Array<{ itemId: string; nameVi: string; qty: number; chance: number }>;
}

export interface WorldDropConfig {
  id: string;
  itemId: string;
  nameVi: string;
  qty: number;
  x: number;
  y: number;
  lat?: number;
  lon?: number;
  icon?: string;
  rarity?: string;
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  satiety: number;
  hydration: number;
  level: number;
  gender: 'male' | 'female';
  equippedWeapon?: string;
  ammo?: number;
}

export interface CombatActionPayload {
  isSkill: boolean;
  weaponType: 'spear' | 'bow' | 'axe' | 'sword' | 'bare_hands';
  damage: number;
  directionAngle?: number;
}

export interface GameBridgeEvents {
  onBeastHit: (beastId: string, damage: number, remainingHp: number) => void;
  onBeastDefeated: (beast: BeastConfig) => void;
  onDropCollected: (drop: WorldDropConfig) => void;
  onPlayerDamaged: (damage: number, attackerName: string) => void;
  onPoiInteracted: (poiId: string) => void;
  onPlayerMoved: (x: number, y: number, heading: number) => void;
}
