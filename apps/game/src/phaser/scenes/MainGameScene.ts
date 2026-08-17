/**
 * MainGameScene.ts
 * Scene Gameplay Chính Chuẩn Classic Diablo II Isometric RPG ("Kỷ Nguyên Hoang Cổ")
 *
 * Tính năng:
 * 1. Phối cảnh Isometric 2:1 chuẩn Diablo II (Tọa độ, hướng nhìn, góc chiếu).
 * 2. Môi trường u tối (Gritty Diablo Encampment): Cỏ rêu trầm (#2d3e23), đất bùn nứt nẻ (#3d2e1e), bờ tường đá cổ, hàng rào gỗ xù xì, đống lửa trại rực than hồng.
 * 3. Hệ thống Ánh Sáng Đuốc Đêm & Fog of War (TorchLightSystem): Màn sương bóng tối phủ kín, quầng sáng vàng cam bập bùng quanh Player & Lửa trại.
 * 4. Hệ thống Bóng Đổ Định Hướng Nghiêng (Directional Hard Shadows) ngả góc trên bên trái (-45°).
 * 5. Điều khiển 8 Hướng Isometric & Sắp xếp Chiều Sâu 2.5D (Y-Sorting).
 */

import { Phaser, type BeastConfig, type WorldDropConfig } from '../phaserTypes.ts';
import { SkeletalPlayer } from '../entities/SkeletalPlayer.ts';
import { SkeletalBeast } from '../entities/SkeletalBeast.ts';
import { PhaserWorldDrop } from '../entities/PhaserWorldDrop.ts';
import { PhaserGameBridge } from '../gameBridge.ts';
import { TorchLightSystem } from '../lighting/torchLightSystem.ts';
import { IsoUtils } from '../isometric/isoUtils.ts';

export class MainGameScene extends Phaser.Scene {
  public player!: SkeletalPlayer;
  public beastGroup!: any;
  public dropGroup!: any;
  public poiGroup!: any;
  public sceneryGroup!: any;

  // Hệ Thống Ánh Sáng Đuốc Đêm & Màn Sương Bóng Tối
  public torchLightSystem!: TorchLightSystem;

  // Kích thước bản đồ thế giới giả lập (pixels)
  public worldWidth: number = 3600;
  public worldHeight: number = 3600;

  private groundTileSprite!: any;
  private terrainGraphics!: any;

  private beastsMap: Map<string, SkeletalBeast> = new Map();
  private dropsMap: Map<string, PhaserWorldDrop> = new Map();

  constructor() {
    super({ key: 'MainGameScene' });
  }

  public create(): void {
    // 1. Đăng ký Scene vào Cầu Nối Bridge
    PhaserGameBridge.getInstance().registerMainScene(this);

    // 2. Thiết lập ranh giới vật lý
    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);

    // 3. Khởi tạo Nền Đất U Tối Gritty Moss & Mud (Depth: 0)
    this.createGrittyBackground();

    // 4. Khởi tạo Nhóm Quản Lý Thực Thể & Cảnh Vật (Entity Groups)
    this.beastGroup = this.physics.add.group();
    this.dropGroup = this.add.group();
    this.poiGroup = this.add.group();
    this.sceneryGroup = this.add.group();

    // 5. Khởi tạo Nhân vật Dũng Sĩ Khớp Xương Isometric tại tâm bản đồ
    const startX = this.worldWidth / 2;
    const startY = this.worldHeight / 2;
    this.player = new SkeletalPlayer(this, startX, startY);

    // 6. Cài đặt Camera 2.5D bám theo mượt mà
    this.setupCameraFollow();

    // 7. Xây Dựng Doanh Trại Hoang Cổ Phong Cách Rogue Encampment (Tường đá, Lửa trại, Hàng rào)
    this.buildDiabloEncampment(startX, startY);

    // 8. Sinh Dã Thú Tiền Sử & Vật Phẩm Rơi
    this.spawnDefaultWorldEntities(startX, startY);

    // 9. Khởi tạo Hệ Thống Ánh Sáng Đuốc Đêm & Fog of War
    this.torchLightSystem = new TorchLightSystem(this);
    this.registerWorldLights(startX, startY);

    // 10. Cài đặt Bàn Phím 8 Hướng (WASD / Mũi tên)
    this.setupKeyboardControls();
  }

  /** Tạo nền đất cỏ rêu phong (#2d3e23) pha đất bùn nứt nẻ sẫm màu (#3d2e1e) */
  private createGrittyBackground(): void {
    const textureKey = this.textures.exists('diablo_gritty_ground')
      ? 'diablo_gritty_ground'
      : 'lush_grass_ground_tile';

    this.groundTileSprite = this.add.tileSprite(
      this.worldWidth / 2,
      this.worldHeight / 2,
      this.worldWidth,
      this.worldHeight,
      textureKey
    );
    this.groundTileSprite.setDepth(0);

    // Vẽ dòng sông hắc ngọc và các cung đường mòn đất bùn
    this.terrainGraphics = this.add.graphics();
    this.terrainGraphics.setDepth(1);

    // Sông tối màu phong cách Diablo Act I
    this.terrainGraphics.lineStyle(42, 0x0c4a6e, 0.4);
    this.terrainGraphics.beginPath();
    this.terrainGraphics.moveTo(0, this.worldHeight * 0.35);
    this.terrainGraphics.bezierCurveTo(
      this.worldWidth * 0.3,
      this.worldHeight * 0.25,
      this.worldWidth * 0.6,
      this.worldHeight * 0.45,
      this.worldWidth,
      this.worldHeight * 0.38
    );
    this.terrainGraphics.strokePath();

    // Đường mòn đất bùn nứt nẻ gồ ghề
    this.terrainGraphics.lineStyle(32, 0x3d2e1e, 0.55);
    this.terrainGraphics.beginPath();
    this.terrainGraphics.moveTo(this.worldWidth * 0.2, 0);
    this.terrainGraphics.lineTo(this.worldWidth * 0.5, this.worldHeight * 0.5);
    this.terrainGraphics.lineTo(this.worldWidth * 0.8, this.worldHeight);
    this.terrainGraphics.strokePath();
  }

  /** Xây dựng Doanh Trại Diablo Rogue Encampment (Bờ tường đá, Cột đuốc, Hàng rào, Lửa trại) */
  private buildDiabloEncampment(cx: number, cy: number): void {
    // 1. Đống Lửa Trại Trung Tâm Than Hồng Bốc Khói
    const campfire = this.add.sprite(cx, cy + 30, 'diablo_campfire');
    campfire.setDepth(cy + 30);
    this.sceneryGroup.add(campfire);

    // Diễn hoạt lửa bập bùng
    this.tweens.add({
      targets: campfire,
      scaleY: 1.06,
      duration: 160,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 2. Bờ Tường Đá Cổ Rêu Phong (Cobblestone Walls)
    const wall1 = this.add.sprite(cx - 120, cy - 90, 'diablo_stone_wall');
    wall1.setDepth(cy - 90);
    this.sceneryGroup.add(wall1);

    const wall2 = this.add.sprite(cx - 30, cy - 110, 'diablo_stone_wall');
    wall2.setDepth(cy - 110);
    this.sceneryGroup.add(wall2);

    // 3. Hàng Rào Gỗ Xù Xì (Wood Fences)
    const fence1 = this.add.sprite(cx + 80, cy - 90, 'diablo_wood_fence');
    fence1.setDepth(cy - 90);
    this.sceneryGroup.add(fence1);

    const fence2 = this.add.sprite(cx + 150, cy - 80, 'diablo_wood_fence');
    fence2.setDepth(cy - 80);
    this.sceneryGroup.add(fence2);

    // 4. Cột Đuốc Cắm Đất (Torch Posts)
    const torch1 = this.add.sprite(cx - 100, cy + 80, 'diablo_torch_post');
    torch1.setDepth(cy + 80);
    this.sceneryGroup.add(torch1);

    const torch2 = this.add.sprite(cx + 110, cy + 80, 'diablo_torch_post');
    torch2.setDepth(cy + 80);
    this.sceneryGroup.add(torch2);

    // 5. Tảng Đá Rêu Phong (Mossy Boulders)
    const rock1 = this.add.sprite(cx - 180, cy + 20, 'diablo_mossy_boulder');
    rock1.setDepth(cy + 20);
    this.sceneryGroup.add(rock1);

    const rock2 = this.add.sprite(cx + 190, cy + 10, 'diablo_mossy_boulder');
    rock2.setDepth(cy + 10);
    this.sceneryGroup.add(rock2);
  }

  /** Đăng ký các nguồn sáng tĩnh vào TorchLightSystem */
  private registerWorldLights(cx: number, cy: number): void {
    // Nguồn sáng Đống Lửa Trại (bán kính rộng 280px, rực rỡ)
    this.torchLightSystem.addLight({
      x: cx,
      y: cy + 30,
      radius: 280,
      intensity: 0.96,
    });

    // Nguồn sáng 2 Cột Đuốc
    this.torchLightSystem.addLight({
      x: cx - 100,
      y: cy + 80,
      radius: 170,
      intensity: 0.88,
    });

    this.torchLightSystem.addLight({
      x: cx + 110,
      y: cy + 80,
      radius: 170,
      intensity: 0.88,
    });

    // Nguồn sáng Đền Cổ Hoang Sơ
    this.torchLightSystem.addLight({
      x: cx + 280,
      y: cy + 50,
      radius: 190,
      intensity: 0.9,
    });
  }

  private setupCameraFollow(): void {
    const cam = this.cameras.main;
    cam.startFollow(this.player, true, 0.08, 0.08);
    cam.setBounds(0, 0, this.worldWidth, this.worldHeight);
    cam.setZoom(1.0);
  }

  private setupKeyboardControls(): void {
    if (!this.input.keyboard) return;
    const cursors = this.input.keyboard.createCursorKeys();
    const wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      j: Phaser.Input.Keyboard.KeyCodes.J,
      k: Phaser.Input.Keyboard.KeyCodes.K,
      q: Phaser.Input.Keyboard.KeyCodes.Q,
    });

    this.events.on('update', () => {
      let vx = 0;
      let vy = 0;

      if (cursors.left.isDown || (wasd as any).left.isDown) vx -= 1;
      if (cursors.right.isDown || (wasd as any).right.isDown) vx += 1;
      if (cursors.up.isDown || (wasd as any).up.isDown) vy -= 1;
      if (cursors.down.isDown || (wasd as any).down.isDown) vy += 1;

      const jv = PhaserGameBridge.getInstance().joystickVector;
      if (vx !== 0 || vy !== 0) {
        this.player.setMoveVector(vx, vy);
      } else if (jv.x !== 0 || jv.y !== 0) {
        this.player.setMoveVector(jv.x, jv.y);
      } else {
        this.player.setMoveVector(0, 0);
      }
    });
  }

  private spawnDefaultWorldEntities(cx: number, cy: number): void {
    // Sinh Thú Cưng Cọp Răng Kiếm Đồng Hành
    this.addBeast({
      id: 'pet_sabertooth',
      species: 'sabertooth_pet',
      nameVi: 'Cọp Răng Kiếm (Smilodon)',
      x: cx - 70,
      y: cy + 50,
      hp: 250,
      maxHp: 250,
      level: 2,
      attackPower: 18,
      defense: 12,
      speed: 135,
      roamRadius: 90,
      aggroRadius: 110,
    });

    // Sinh Bạo Chúa T-Rex Khổng Lồ
    this.addBeast({
      id: 'beast_trex_boss',
      species: 'trex',
      nameVi: 'Bạo Chúa Gargantuan T-Rex',
      x: cx + 260,
      y: cy - 140,
      hp: 400,
      maxHp: 400,
      level: 5,
      attackPower: 26,
      defense: 18,
      speed: 100,
      roamRadius: 180,
      aggroRadius: 260,
    });

    // Sinh Hổ Răng Kiếm Hoang Dã
    this.addBeast({
      id: 'beast_wild_tiger',
      species: 'sabertooth_pet',
      nameVi: 'Hổ Răng Kiếm Hoang Dã',
      x: cx + 190,
      y: cy + 200,
      hp: 220,
      maxHp: 220,
      level: 3,
      attackPower: 16,
      defense: 10,
      speed: 120,
      roamRadius: 150,
      aggroRadius: 220,
    });

    // Vật phẩm rơi
    this.addWorldDrop({
      id: 'drop_meat_1',
      itemId: 'meat_raw',
      nameVi: 'Thịt Dã Thú Tươi',
      qty: 3,
      x: cx + 80,
      y: cy - 70,
    });

    this.addWorldDrop({
      id: 'drop_wood_1',
      itemId: 'wood',
      nameVi: 'Gỗ Cổ Thụ',
      qty: 5,
      x: cx - 110,
      y: cy - 90,
    });

    this.addWorldDrop({
      id: 'drop_stone_1',
      itemId: 'flint',
      nameVi: 'Đá Lửa Thạch Anh',
      qty: 2,
      x: cx + 140,
      y: cy + 80,
    });

    // Trạm Di Tích Cổ
    this.createPoiMarker(cx + 280, cy + 50, 'Di Tích Đền Cổ Hoang Sơ');
    this.createPoiMarker(cx - 260, cy - 180, 'Suối Nước Nóng Cổ Đại');
  }

  public addBeast(config: BeastConfig): SkeletalBeast {
    const beast = new SkeletalBeast(this, config);
    this.beastGroup.add(beast);
    this.beastsMap.set(config.id, beast);
    return beast;
  }

  public addWorldDrop(config: WorldDropConfig): PhaserWorldDrop {
    const drop = new PhaserWorldDrop(this, config);
    this.dropGroup.add(drop);
    this.dropsMap.set(config.id, drop);
    return drop;
  }

  private createPoiMarker(x: number, y: number, name: string): void {
    const container = this.add.container(x, y);

    const shadow = this.add.ellipse(0, 30, 36, 16, 0x000000, 0.4);
    container.add(shadow);

    const marker = this.add.sprite(0, 0, 'poi_pokestop_marker');
    container.add(marker);

    const label = this.add.text(0, -38, name, {
      fontFamily: 'Be Vietnam Pro, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#fef08a',
      backgroundColor: 'rgba(24, 18, 12, 0.85)',
      padding: { x: 5, y: 3 },
    });
    label.setOrigin(0.5, 0.5);
    container.add(label);

    container.setDepth(y);
    this.poiGroup.add(container);

    this.tweens.add({
      targets: marker,
      y: '-=6',
      yoyo: true,
      repeat: -1,
      duration: 1200,
      ease: 'Sine.easeInOut',
    });

    container.setSize(48, 64);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerdown', () => {
      PhaserGameBridge.getInstance().emitPoiInteracted(name);
    });
  }

  public getBeastsInRange(x: number, y: number, range: number): SkeletalBeast[] {
    const result: SkeletalBeast[] = [];
    this.beastGroup.children.iterate((beast: any) => {
      if (beast && beast.active && beast.aiState !== 'DEAD') {
        const dist = Phaser.Math.Distance.Between(x, y, beast.x, beast.y);
        if (dist <= range) {
          result.push(beast);
        }
      }
      return true;
    });
    return result;
  }

  public spawnDropFromBeast(x: number, y: number, beastConfig: BeastConfig): void {
    const dropId = `drop_loot_${Date.now()}`;
    this.addWorldDrop({
      id: dropId,
      itemId: 'meat_raw',
      nameVi: `Thịt ${beastConfig.nameVi}`,
      qty: 2 + Math.floor(Math.random() * 3),
      x: x + (Math.random() * 20 - 10),
      y: y + (Math.random() * 20 - 10),
    });
  }

  public syncBeasts(beasts: BeastConfig[]): void {
    const activeIds = new Set(beasts.map((b) => b.id));

    for (const [id, beast] of this.beastsMap.entries()) {
      if (!activeIds.has(id)) {
        beast.destroy();
        this.beastsMap.delete(id);
      }
    }

    for (const b of beasts) {
      const existing = this.beastsMap.get(b.id);
      if (!existing) {
        this.addBeast(b);
      } else {
        existing.hp = b.hp;
      }
    }
  }

  public syncDrops(drops: WorldDropConfig[]): void {
    const activeIds = new Set(drops.map((d) => d.id));

    for (const [id, drop] of this.dropsMap.entries()) {
      if (!activeIds.has(id)) {
        drop.destroy();
        this.dropsMap.delete(id);
      }
    }

    for (const d of drops) {
      if (!this.dropsMap.has(d.id)) {
        this.addWorldDrop(d);
      }
    }
  }

  /** Vòng lặp Gameplay chính chạy mỗi khung hình (Game Update Loop) */
  public update(time: number, delta: number): void {
    // 1. Cập nhật Player & Diễn Hoạt Khớp Xương 8 Hướng
    if (this.player && this.player.active) {
      this.player.updatePlayer(time, delta);
      this.player.setDepth(this.player.y);
    }

    // 2. Cập nhật AI và Độ Sâu cho Toàn Bộ Dã Thú
    this.beastGroup.children.iterate((beast: any) => {
      if (beast && beast.active) {
        beast.updateAI(this.player, delta);
        beast.setDepth(beast.y);
      }
      return true;
    });

    // 3. Cập nhật Độ Sâu cho Vật Phẩm Rơi
    this.dropGroup.children.iterate((drop: any) => {
      if (drop && drop.active) {
        drop.setDepth(drop.y);
      }
      return true;
    });

    // 4. Cập nhật Hệ Thống Ánh Sáng Đuốc Đêm & Màn Sương Bóng Tối (Fog of War)
    if (this.torchLightSystem && this.player && this.player.active) {
      this.torchLightSystem.update(this.player.x, this.player.y, delta);
    }
  }
}
