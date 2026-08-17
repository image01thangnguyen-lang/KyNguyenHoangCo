/**
 * gameBridge.ts
 * Cầu Nối Giao Tiếp 2 Chiều Giữa Giao Diện HTML/CSS và Engine Phaser 3 (Game Bridge)
 *
 * Chức năng:
 * 1. Cho phép giao diện bên ngoài (Nút Đánh, Joystick, Túi đồ, Đổi vũ khí) gửi lệnh vào Phaser Scene.
 * 2. Cho phép Phaser Scene phát sự kiện ngược lại ra UI (Nhặt vật phẩm, Quái chết, Máu giảm, Đạt thành tựu).
 */

import type {
  BeastConfig,
  WorldDropConfig,
  PlayerStats,
  CombatActionPayload,
  GameBridgeEvents,
} from './phaserTypes.ts';

export class PhaserGameBridge {
  private static instance: PhaserGameBridge | null = null;
  private mainScene: any = null;

  // Vector điều khiển từ Joystick ảo
  public joystickVector: { x: number; y: number } = { x: 0, y: 0 };
  
  // Trạng thái vũ khí hiện tại
  public currentWeapon: 'spear' | 'bow' | 'axe' | 'sword' | 'bare_hands' = 'spear';
  public currentAmmo: number = 0;
  
  // Đăng ký các hàm Callback lắng nghe từ UI bên ngoài
  public listeners: Partial<GameBridgeEvents> = {};

  private constructor() {}

  public static getInstance(): PhaserGameBridge {
    if (!PhaserGameBridge.instance) {
      PhaserGameBridge.instance = new PhaserGameBridge();
    }
    return PhaserGameBridge.instance;
  }

  /** Đăng ký MainGameScene khi scene khởi động */
  public registerMainScene(scene: any): void {
    this.mainScene = scene;
  }

  public getMainScene(): any {
    return this.mainScene;
  }

  /** Gửi vector di chuyển từ Joystick ảo (HTML) vào Phaser Scene */
  public sendJoystickInput(x: number, y: number): void {
    this.joystickVector.x = x;
    this.joystickVector.y = y;
    if (this.mainScene && this.mainScene.player) {
      this.mainScene.player.setMoveVector(x, y);
    }
  }

  /** Kích hoạt hành động ĐÁNH / KỸ NĂNG từ HTML Combat Pad */
  public triggerPlayerAttack(isSkill: boolean = false, targetAngle?: number): void {
    if (this.mainScene && this.mainScene.player) {
      this.mainScene.player.performAttack(isSkill, targetAngle);
    }
  }

  /** Đổi nhanh loại vũ khí từ HTML */
  public setEquippedWeapon(weapon: 'spear' | 'bow' | 'axe' | 'sword' | 'bare_hands', ammo: number = 0): void {
    this.currentWeapon = weapon;
    this.currentAmmo = ammo;
    if (this.mainScene && this.mainScene.player) {
      this.mainScene.player.setWeapon(weapon, ammo);
    }
  }

  /** Đặt lại góc nhìn camera về vị trí trung tâm nhân vật */
  public recenterCamera(): void {
    if (this.mainScene && this.mainScene.cameras && this.mainScene.player) {
      const cam = this.mainScene.cameras.main;
      cam.pan(this.mainScene.player.x, this.mainScene.player.y, 400, 'Power2');
    }
  }

  /** Đồng bộ dữ liệu thế giới (Dã thú, Vật phẩm rơi, Doanh trại) từ Game Loop vào Phaser Scene */
  public syncWorldData(data: {
    beasts?: BeastConfig[];
    drops?: WorldDropConfig[];
    playerStats?: Partial<PlayerStats>;
    centerLat?: number;
    centerLon?: number;
    weather?: string;
  }): void {
    if (!this.mainScene) return;

    if (data.beasts) {
      this.mainScene.syncBeasts(data.beasts);
    }
    if (data.drops) {
      this.mainScene.syncDrops(data.drops);
    }
    if (data.playerStats && this.mainScene.player) {
      this.mainScene.player.updateStats(data.playerStats);
    }
  }

  // =========================================================================
  // CÁC SỰ KIỆN PHÁT TỪ PHASER SCENE RA GIAO DIỆN HTML NGOÀI
  // =========================================================================

  /** Khi quái vật nhận sát thương */
  public emitBeastHit(beastId: string, damage: number, remainingHp: number): void {
    if (this.listeners.onBeastHit) {
      this.listeners.onBeastHit(beastId, damage, remainingHp);
    }
  }

  /** Khi quái vật bị tiêu diệt hoàn toàn */
  public emitBeastDefeated(beast: BeastConfig): void {
    if (this.listeners.onBeastDefeated) {
      this.listeners.onBeastDefeated(beast);
    }
  }

  /** Khi người chơi nhặt một vật phẩm rơi trên mặt đất */
  public emitDropCollected(drop: WorldDropConfig): void {
    if (this.listeners.onDropCollected) {
      this.listeners.onDropCollected(drop);
    }
  }

  /** Khi người chơi bị dã thú đánh trúng */
  public emitPlayerDamaged(damage: number, attackerName: string): void {
    if (this.listeners.onPlayerDamaged) {
      this.listeners.onPlayerDamaged(damage, attackerName);
    }
  }

  /** Khi người chơi tương tác với trạm di tích / POI */
  public emitPoiInteracted(poiId: string): void {
    if (this.listeners.onPoiInteracted) {
      this.listeners.onPoiInteracted(poiId);
    }
  }

  /** Khi người chơi di chuyển (đồng bộ tọa độ và bước chân) */
  public emitPlayerMoved(x: number, y: number, heading: number): void {
    if (this.listeners.onPlayerMoved) {
      this.listeners.onPlayerMoved(x, y, heading);
    }
  }
}
