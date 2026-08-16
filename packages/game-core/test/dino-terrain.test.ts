/**
 * TEST SUITE: DINO TERRAIN & ENVIRONMENT SYSTEM
 * Kiểm thử toàn diện 3 module Core Game Engine:
 * 1. Terrain Modifiers & Footprint Object Pooling
 * 2. Biome Map Generator (Sa Mạc Đỏ Tam Điệp & Rừng Rậm Giura)
 * 3. Top-Down Vision Manager (Canopy Fade & Stealth Brush)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TerrainType,
  getTerrainSurfaceDef,
  TERRAIN_SURFACE_REGISTRY,
  EntityWeightCategory,
  getWeightCategory,
  WEIGHT_CATEGORY_DEFS,
  ObjectPool,
  Footprint,
  FootprintManager,
  ProceduralNoise,
  DinoBiomeMap,
  ObstacleType,
  TopDownVisionManager,
} from '../src/index.ts';

describe('MODULE 1: LOGIC MẶT ĐẤT & TƯƠNG TÁC VẬT LÝ (TERRAIN CORE)', () => {
  it('1.1. Phân loại bề mặt và điều chỉnh tốc độ di chuyển chính xác', () => {
    // Thảm dương xỉ = 100% (1.0)
    const fern = getTerrainSurfaceDef(TerrainType.FERN_CARPET);
    assert.equal(fern.speedModifier, 1.0);
    assert.equal(fern.footprintDepth, 0.3);

    // Cát mịn = giảm 15% (0.85)
    const sand = getTerrainSurfaceDef(TerrainType.FINE_SAND);
    assert.equal(sand.speedModifier, 0.85);
    assert.equal(sand.hasHeavyDeformation, true);

    // Cát đỏ Tam điệp = giảm 15% (0.85)
    const redSand = getTerrainSurfaceDef(TerrainType.RED_SAND);
    assert.equal(redSand.speedModifier, 0.85);
    assert.equal(redSand.hasHeavyDeformation, true);

    // Đầm lầy = giảm 40% (0.60)
    const mud = getTerrainSurfaceDef(TerrainType.SWAMP_MUD);
    assert.equal(mud.speedModifier, 0.60);
    assert.equal(mud.footprintDepth, 2.5);
    assert.equal(mud.particleType, 'mud_splash');

    // Đất nứt nẻ = giảm 10% (0.90)
    const cracked = getTerrainSurfaceDef(TerrainType.CRACKED_EARTH);
    assert.equal(cracked.speedModifier, 0.90);

    // Đá dăm = giảm 5% (0.95)
    const gravel = getTerrainSurfaceDef(TerrainType.GRAVEL_ROCK);
    assert.equal(gravel.speedModifier, 0.95);
  });

  it('1.2. Phân hạng cân nặng sinh vật và tỷ lệ kích thước dấu chân', () => {
    // Nhỏ (<50kg)
    assert.equal(getWeightCategory(15), EntityWeightCategory.SMALL);
    assert.equal(WEIGHT_CATEGORY_DEFS[EntityWeightCategory.SMALL].sizeScale, 0.5);

    // Người / Velociraptor (50 - 500kg)
    assert.equal(getWeightCategory(70), EntityWeightCategory.MEDIUM);
    assert.equal(WEIGHT_CATEGORY_DEFS[EntityWeightCategory.MEDIUM].sizeScale, 1.0);

    // Khủng long ăn cỏ lớn (500 - 4000kg)
    assert.equal(getWeightCategory(2500), EntityWeightCategory.LARGE);
    assert.equal(WEIGHT_CATEGORY_DEFS[EntityWeightCategory.LARGE].sizeScale, 2.2);

    // T-Rex / Sauropod khổng lồ (>4000kg)
    assert.equal(getWeightCategory(8000), EntityWeightCategory.COLOSSAL);
    assert.equal(WEIGHT_CATEGORY_DEFS[EntityWeightCategory.COLOSSAL].causesGroundShake, true);
    assert.equal(WEIGHT_CATEGORY_DEFS[EntityWeightCategory.COLOSSAL].strideMeters, 4.2);
  });

  it('1.3. Object Pool tái sử dụng bộ nhớ không rác (Zero GC Overhead)', () => {
    const pool = new ObjectPool(() => new Footprint(), 10);
    assert.equal(pool.totalCapacity, 10);
    assert.equal(pool.activeCount, 0);

    // Acquire 3 items
    const fp1 = pool.acquire();
    const fp2 = pool.acquire();
    const fp3 = pool.acquire();
    assert.equal(pool.activeCount, 3);
    assert.equal(fp1.active, true);

    // Release 1 item
    pool.release(fp2);
    assert.equal(pool.activeCount, 2);
    assert.equal(fp2.active, false);

    // Acquire tiếp theo tái sử dụng slot vừa release
    const fp4 = pool.acquire();
    assert.equal(fp4, fp2); // Đúng cùng tham chiếu bộ nhớ
    assert.equal(pool.activeCount, 3);

    // Release all
    pool.releaseAll();
    assert.equal(pool.activeCount, 0);
  });

  it('1.4. FootprintManager sinh dấu chân và kích hoạt hạt khi đi trên Đầm Lầy/Cát Đỏ', () => {
    const fm = new FootprintManager(50, 100);

    // Bước 1: Khởi tạo vị trí
    const res1 = fm.onEntityMove('player_1', 0, 0, 0, 75, TerrainType.SWAMP_MUD);
    assert.equal(res1.spawnedFootprint, false);

    // Bước 2: Đi chưa đủ cự ly sải chân (< 1.4m)
    const res2 = fm.onEntityMove('player_1', 0.5, 0, 0, 75, TerrainType.SWAMP_MUD);
    assert.equal(res2.spawnedFootprint, false);

    // Bước 3: Đi vượt sải chân (1.6m) trên Đầm Lầy -> Sinh dấu chân sâu + Văng bùn
    const res3 = fm.onEntityMove('player_1', 1.6, 0, 0, 75, TerrainType.SWAMP_MUD);
    assert.equal(res3.spawnedFootprint, true);
    assert.ok(res3.spawnedParticlesCount > 0, 'Phải sinh hạt văng bùn trên đầm lầy');
    assert.equal(fm.footprintPool.activeCount, 1);

    // Bước 4: Kiểm tra mờ dần theo thời gian (Tick fade out)
    fm.tick(9.0); // 9 giây trôi qua (thời gian sống là 18s)
    let foundActive = false;
    fm.footprintPool.forEachActive((fp) => {
      foundActive = true;
      assert.ok(fp.alpha < 0.6 && fp.alpha > 0.4, `Alpha phải mờ còn ~0.5 (thực tế: ${fp.alpha})`);
    });
    assert.ok(foundActive);

    // Bước 5: Hết 18s dấu chân tự thu hồi về Pool
    fm.tick(10.0);
    assert.equal(fm.footprintPool.activeCount, 0, 'Dấu chân phải được thu hồi về Pool khi hết hạn');
  });
});

describe('MODULE 2: THUẬT TOÁN SINH ĐỊA HÌNH CHO 2 BẢN ĐỒ (BIOME MAP GENERATOR)', () => {
  it('2.1. Procedural Noise sinh số ngẫu nhiên xác định và liên tục', () => {
    const noise = new ProceduralNoise(999);
    const v1 = noise.fbm(1.5, 2.5);
    const v2 = noise.fbm(1.5, 2.5);
    assert.equal(v1, v2, 'Cùng toạ độ và seed phải ra cùng kết quả');
    assert.ok(v1 >= 0 && v1 <= 1.0);
  });

  it('2.2. Map 1: Sa Mạc Đỏ Tam Điệp sinh đúng tỷ lệ Cát Đỏ 70%, Vách Đá Canyon và Ốc Đảo', () => {
    const map = new DinoBiomeMap('triassic_red_desert', 48, 48, 2.0, 1234);
    assert.equal(map.biome, 'triassic_red_desert');

    let redSandCount = 0;
    let canyonWallCount = 0;
    let fossilCount = 0;
    let oasisWaterCount = 0;
    let totalCells = 48 * 48;

    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 48; x++) {
        const cell = map.cells[y][x];
        if (cell.terrainType === TerrainType.RED_SAND) redSandCount++;
        if (cell.obstacleType === ObstacleType.CANYON_WALL) canyonWallCount++;
        if (cell.obstacleType === ObstacleType.GIANT_FOSSIL_SKELETON) fossilCount++;
        if (cell.terrainType === TerrainType.DEEP_WATER && cell.isOasisPoi) oasisWaterCount++;
      }
    }

    const redSandRatio = redSandCount / totalCells;
    assert.ok(redSandRatio >= 0.55 && redSandRatio <= 0.85, `Cát đỏ phải chiếm ~70% (thực tế: ${(redSandRatio * 100).toFixed(1)}%)`);
    assert.ok(canyonWallCount > 0, 'Phải có vách đá Canyon tạo chokepoints');
    assert.ok(fossilCount > 0, 'Phải có bộ xương hóa thạch khủng long');
    assert.ok(oasisWaterCount > 0, 'Phải sinh hồ nước tại Ốc đảo');
    assert.ok(map.oasisPoiPosition !== null, 'Phải có toạ độ Ốc đảo POI');
  });

  it('2.3. Map 2: Rừng Rậm Lục Bảo Giura phủ kín Thảm Dương Xỉ, Đầm Lầy, Rễ Cây & Thân Cây Đổ', () => {
    const map = new DinoBiomeMap('jurassic_emerald_jungle', 48, 48, 2.0, 5678);
    assert.equal(map.biome, 'jurassic_emerald_jungle');

    let fernCount = 0;
    let swampCount = 0;
    let coniferTreeCount = 0;
    let buttressRootCount = 0;
    let fallenLogCount = 0;
    let stealthBrushCount = 0;

    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 48; x++) {
        const cell = map.cells[y][x];
        if (cell.terrainType === TerrainType.FERN_CARPET) fernCount++;
        if (cell.terrainType === TerrainType.SWAMP_MUD) swampCount++;
        if (cell.obstacleType === ObstacleType.GIANT_CONIFER_TREE) coniferTreeCount++;
        if (cell.obstacleType === ObstacleType.BUTTRESS_ROOT) buttressRootCount++;
        if (cell.obstacleType === ObstacleType.FALLEN_LOG) fallenLogCount++;
        if (cell.isStealthBrush) stealthBrushCount++;
      }
    }

    assert.ok(fernCount > 0, 'Phải có thảm dương xỉ cổ đại');
    assert.ok(swampCount > 0, 'Phải có đầm lầy bùn đen ở vùng trũng');
    assert.ok(coniferTreeCount > 0, 'Phải có cây lá kim cổ thụ');
    assert.ok(buttressRootCount > 0, 'Phải có rễ cây cổ thụ khổng lồ nổi trên mặt đất');
    assert.ok(fallenLogCount > 0, 'Phải có thân cây đổ ngang qua đầm');
    assert.ok(stealthBrushCount > 0, 'Phải có bụi dương xỉ thân gỗ ẩn nấp');
    assert.ok(map.stealthZones.length > 0, 'Phải đăng ký danh sách Stealth Zones');
  });
});

describe('MODULE 3: QUẢN LÝ TẦM NHÌN GÓC NHÌN TRÊN CAO (TOP-DOWN VISION)', () => {
  it('3.1. Cơ chế làm mờ tán cây (Canopy Fade): Smooth Lerp từ 1.0 xuống 0.2 khi đứng dưới tán', () => {
    const map = new DinoBiomeMap('jurassic_emerald_jungle', 32, 32, 2.0, 111);
    const vision = new TopDownVisionManager(map);

    const firstCanopy = Array.from(vision.canopies.values())[0];
    assert.ok(firstCanopy, 'Phải có ít nhất một tán cây');
    assert.equal(firstCanopy.currentAlpha, 1.0);

    // Người chơi đứng ngay dưới tâm tán cây
    vision.updateCanopyFade(firstCanopy.worldX, firstCanopy.worldY, 0.05);
    assert.equal(firstCanopy.targetAlpha, 0.2);
    assert.ok(firstCanopy.currentAlpha < 1.0, 'Alpha phải bắt đầu giảm');

    // Chạy tiếp 0.5s để hoàn tất fade out
    vision.updateCanopyFade(firstCanopy.worldX, firstCanopy.worldY, 0.5);
    assert.ok(Math.abs(firstCanopy.currentAlpha - 0.2) < 0.01, `Alpha phải đạt 0.2 (thực tế: ${firstCanopy.currentAlpha})`);

    // Người chơi bước ra xa khỏi tán cây
    vision.updateCanopyFade(firstCanopy.worldX + 50, firstCanopy.worldY + 50, 0.5);
    assert.equal(firstCanopy.targetAlpha, 1.0);
    assert.ok(Math.abs(firstCanopy.currentAlpha - 1.0) < 0.01, `Alpha phải hồi phục về 1.0 (thực tế: ${firstCanopy.currentAlpha})`);
  });

  it('3.2. Bụi cỏ ẩn nấp (Stealth Brush): Ẩn tầm nhìn khỏi kẻ địch bên ngoài (cơ chế MOBA)', () => {
    const map = new DinoBiomeMap('jurassic_emerald_jungle', 48, 48, 2.0, 222);
    const vision = new TopDownVisionManager(map);

    const firstZone = vision.stealthZones[0];
    assert.ok(firstZone, 'Phải có ít nhất 1 stealth zone');

    // Nhân vật bước vào bụi cỏ
    const insidePlayer = vision.checkEntityStealth('player', firstZone.x, firstZone.y);
    assert.equal(insidePlayer.isStealthed, true);
    assert.equal(insidePlayer.stealthOpacity, 0.5);

    // Kẻ địch (T-Rex/Raptor) đứng cách 5m ở NGOÀI bụi cỏ (tầm nhìn 15m)
    const enemyCheck1 = vision.canEnemyDetectTarget(
      firstZone.x + 5.0,
      firstZone.y,
      15.0,
      firstZone.x,
      firstZone.y,
      insidePlayer,
    );
    assert.equal(enemyCheck1.canDetect, false, 'Kẻ địch ở ngoài bụi KHÔNG THỂ phát hiện người chơi đang ẩn nấp');

    // Kẻ địch cũng bước vào CHUNG bụi cỏ và đứng cách 1.2m (<= 2m)
    const enemyCheck2 = vision.canEnemyDetectTarget(
      firstZone.x + 1.2,
      firstZone.y,
      15.0,
      firstZone.x,
      firstZone.y,
      insidePlayer,
    );
    assert.equal(enemyCheck2.canDetect, true, 'Kẻ địch ở cùng bụi cỏ trong cự ly <= 2m sẽ phát hiện được mục tiêu');

    // Nhân vật bước ra ngoài bãi đất trống
    const outsidePlayer = vision.checkEntityStealth('player', firstZone.x + 25.0, firstZone.y + 25.0);
    assert.equal(outsidePlayer.isStealthed, false);
    assert.equal(outsidePlayer.stealthOpacity, 1.0);

    const enemyCheck3 = vision.canEnemyDetectTarget(
      firstZone.x + 20.0,
      firstZone.y + 25.0,
      15.0,
      firstZone.x + 25.0,
      firstZone.y + 25.0,
      outsidePlayer,
    );
    assert.equal(enemyCheck3.canDetect, true, 'Kẻ địch phát hiện bình thường khi người chơi ở ngoài đất trống');
  });
});
