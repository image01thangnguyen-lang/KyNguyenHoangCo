/**
 * phaserGame.ts
 * Khởi Tạo & Cấu Hình Engine Phaser 3 cho "Kỷ Nguyên Hoang Cổ"
 *
 * Cấu hình:
 * 1. Chế độ Render: Phaser.AUTO (Ưu tiên WebGL tối đa 60 FPS, tự fallback Canvas).
 * 2. Hệ thống Vật lý: physics.arcade với gravity: { x: 0, y: 0 } (Game 2.5D Top-Down).
 * 3. Tự co giãn màn hình điện thoại & máy tính: Phaser.Scale.RESIZE / FIT.
 * 4. Chuỗi 3 Scenes chuẩn: BootScene -> PreloadScene -> MainGameScene.
 */

import { Phaser } from './phaserTypes.ts';
import { BootScene } from './scenes/BootScene.ts';
import { PreloadScene } from './scenes/PreloadScene.ts';
import { MainGameScene } from './scenes/MainGameScene.ts';

export interface PhaserGameOptions {
  canvas?: HTMLCanvasElement;
  parent?: HTMLElement | string;
  width?: number | string;
  height?: number | string;
  debug?: boolean;
}

let gameInstance: any = null;

export function initPhaserGame(options: PhaserGameOptions = {}): any {
  if (gameInstance) {
    return gameInstance;
  }

  // Cấu hình khởi tạo chuẩn Phaser 3
  const config: any = {
    type: Phaser.AUTO,
    backgroundColor: '#12100d',
    
    // Tự động co giãn theo kích thước container
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: '100%',
      height: '100%',
    },

    // Hệ thống vật lý Arcade không trọng lực rơi
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: options.debug ?? false,
      },
    },

    // Tối ưu hóa WebGL & Rendering
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false,
      powerPreference: 'high-performance',
    },

    fps: {
      target: 60,
      forceSetTimeOut: false,
    },

    // Đăng ký 3 Scenes chính
    scene: [BootScene, PreloadScene, MainGameScene],
  };

  if (options.canvas) {
    config.canvas = options.canvas;
  } else if (options.parent) {
    config.parent = options.parent;
  }

  // Khởi tạo thực thể Game
  gameInstance = new Phaser.Game(config);
  return gameInstance;
}

export function getPhaserGame(): any {
  return gameInstance;
}
