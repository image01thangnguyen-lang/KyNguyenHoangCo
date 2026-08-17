import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  SpriteSheetAnimator,
  type EntityState,
} from '../../../apps/game/src/animation/spriteSheetAnimator.ts';
import {
  EntityCatalogId,
  ENTITY_CATALOG,
  getCatalogEntry,
  mapBeastSpeciesToCatalog,
} from '../../../apps/game/src/animation/entityCatalog.ts';
import { YSortManager } from '../../../apps/game/src/animation/ySortManager.ts';
import { Entity } from '../../../apps/game/src/entities/entity.ts';

describe('1. Module SpriteSheetAnimator & Auto Frame Cutting', () => {
  test('Tính toán tọa độ cắt ảnh chuẩn 6 cột: sx = frameIndex * frameWidth, sy = rowIndex * frameHeight', () => {
    const animator = new SpriteSheetAnimator({
      numCols: 6,
      numRows: 4,
      rowIndex: 2,
      frameWidth: 60,
      frameHeight: 50,
    });

    // Mặc định IDLE -> frame 0
    let cut = animator.calculateCutRect();
    assert.equal(cut.sx, 0); // 0 * 60
    assert.equal(cut.sy, 100); // 2 * 50
    assert.equal(cut.sw, 60);
    assert.equal(cut.sh, 50);

    // Chuyển sang WALK và update frame
    animator.setState('WALK', true);
    assert.equal(animator.currentFrameNumber, 1);
    cut = animator.calculateCutRect();
    assert.equal(cut.sx, 60); // 1 * 60
    assert.equal(cut.sy, 100); // 2 * 50

    // Khi ở frame 4
    animator.setState('ATTACK', true);
    assert.equal(animator.currentFrameNumber, 4);
    cut = animator.calculateCutRect();
    assert.equal(cut.sx, 240); // 4 * 60
    assert.equal(cut.sy, 100); // 2 * 50
  });

  test('Cắt ảnh chính xác từ vùng Catalog Strip (Catalog Bounds)', () => {
    const animator = new SpriteSheetAnimator({
      numCols: 6,
      stripBounds: {
        startX: 160,
        startY: 264,
        stripWidth: 300,
        stripHeight: 40,
      },
    });

    assert.equal(animator.frameWidth, 50); // 300 / 6
    assert.equal(animator.frameHeight, 40);

    // Frame 0
    let cut = animator.calculateCutRect();
    assert.equal(cut.sx, 160);
    assert.equal(cut.sy, 264);
    assert.equal(cut.sw, 50);
    assert.equal(cut.sh, 40);

    // Chuyển sang Frame 3
    animator.setState('WALK', true);
    animator.update(0.15); // 0.15s với 8fps ~ 1.2 frames -> chuyển sang frame index 2 (frame number 3)
    cut = animator.calculateCutRect();
    assert.equal(cut.sx, 160 + animator.currentFrameNumber * 50);
  });

  test('Độc lập FPS với Delta Time: Tốc độ lặp khung hình được kiểm soát chính xác bằng dt', () => {
    const animator = new SpriteSheetAnimator({
      fps: 10, // 1 frame mỗi 0.1 giây (100ms)
      numCols: 6,
      stateFrames: {
        WALK: [1, 2, 3],
      },
    });

    animator.setState('WALK', true);
    assert.equal(animator.currentFrameNumber, 1);

    // Trôi qua 0.05s (< 0.1s) -> vẫn giữ frame 1
    animator.update(0.05);
    assert.equal(animator.currentFrameNumber, 1);

    // Trôi qua thêm 0.06s (tổng 0.11s >= 0.1s) -> chuyển sang frame 2
    animator.update(0.06);
    assert.equal(animator.currentFrameNumber, 2);

    // Trôi qua thêm 0.1s -> chuyển sang frame 3
    animator.update(0.1);
    assert.equal(animator.currentFrameNumber, 3);

    // Trôi qua thêm 0.1s -> tuần hoàn quay lại frame 1
    animator.update(0.1);
    assert.equal(animator.currentFrameNumber, 1);
  });
});

describe('2. Máy Trạng Thái (State Machine) 6 Khung Hình', () => {
  test('State IDLE: Cố định ở khung hình 0', () => {
    const animator = new SpriteSheetAnimator();
    animator.setState('IDLE', true);
    assert.equal(animator.currentFrameNumber, 0);

    animator.update(1.0); // Dù trôi qua 1 giây vẫn ở khung 0
    assert.equal(animator.currentFrameNumber, 0);
  });

  test('State WALK / RUN: Lặp tuần hoàn giữa khung 1, 2, 3 theo vận tốc', () => {
    const animator = new SpriteSheetAnimator({ fps: 10 });
    animator.setState('WALK', true);

    const frameSequence: number[] = [];
    for (let i = 0; i < 8; i++) {
      frameSequence.push(animator.currentFrameNumber);
      animator.update(0.1);
    }

    // Chuỗi tuần hoàn [1, 2, 3, 2, 1, 2, 3, 2]
    assert.deepEqual(frameSequence, [1, 2, 3, 2, 1, 2, 3, 2]);
  });

  test('State ATTACK: Chạy khung 4 -> 5 rồi tự động quay về IDLE và gọi onComplete callback', () => {
    const animator = new SpriteSheetAnimator({ fps: 10 });
    let completed = false;

    animator.playAttack(() => {
      completed = true;
    });

    assert.equal(animator.state, 'ATTACK');
    assert.equal(animator.currentFrameNumber, 4);

    // Update sang frame 5
    animator.update(0.1);
    assert.equal(animator.currentFrameNumber, 5);
    assert.equal(animator.state, 'ATTACK');
    assert.equal(completed, false);

    // Update tiếp -> kết thúc ATTACK, tự động về IDLE
    animator.update(0.1);
    assert.equal(animator.state, 'IDLE');
    assert.equal(animator.currentFrameNumber, 0);
    assert.equal(completed, true);
  });

  test('State DEAD / REST: Cố định ở khung hình 5', () => {
    const animator = new SpriteSheetAnimator({ fps: 10 });
    animator.playDead();
    assert.equal(animator.state, 'DEAD');
    assert.equal(animator.currentFrameNumber, 5);

    animator.update(2.0);
    assert.equal(animator.state, 'DEAD');
    assert.equal(animator.currentFrameNumber, 5);
  });
});

describe('3. Đồng Bộ Hướng Di Chuyển (Flip Direction)', () => {
  test('Lật hướng theo vận tốc vx: vx < 0 lật trái, vx >= 0 quay phải', () => {
    const animator = new SpriteSheetAnimator();

    animator.setFacingFromVelocity(-2.5);
    assert.equal(animator.facingLeft, true);

    animator.setFacingFromVelocity(3.0);
    assert.equal(animator.facingLeft, false);
  });

  test('Render Canvas: Gọi ctx.scale(-1, 1) khi quay sang trái quanh Anchor Point (0.5, 1.0)', () => {
    const animator = new SpriteSheetAnimator({
      frameWidth: 64,
      frameHeight: 64,
      anchorX: 0.5,
      anchorY: 1.0,
    });

    const mockCtx: any = {
      saveCalls: 0,
      restoreCalls: 0,
      scaleCalls: [] as Array<[number, number]>,
      translateCalls: [] as Array<[number, number]>,
      drawCalls: [] as any[],
      save() { this.saveCalls++; },
      restore() { this.restoreCalls++; },
      translate(x: number, y: number) { this.translateCalls.push([x, y]); },
      scale(x: number, y: number) { this.scaleCalls.push([x, y]); },
      drawImage(img: any, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) {
        this.drawCalls.push({ sx, sy, sw, sh, dx, dy, dw, dh });
      },
    };

    animator.image = {} as any; // Mock image
    animator.facingLeft = true;

    animator.render(mockCtx, 100, 200, 64, 64);

    assert.equal(mockCtx.saveCalls, 1);
    assert.equal(mockCtx.restoreCalls, 1);
    assert.deepEqual(mockCtx.translateCalls[0], [100, 200]);
    // Kiểm tra đã gọi scale(-1, 1)
    const hasFlip = mockCtx.scaleCalls.some((c: [number, number]) => c[0] === -1 && c[1] === 1);
    assert.equal(hasFlip, true);

    // Kiểm tra căn lề theo Anchor Point (0.5, 1.0): dx = -32, dy = -64
    assert.equal(mockCtx.drawCalls[0].dx, -32);
    assert.equal(mockCtx.drawCalls[0].dy, -64);
  });
});

describe('4. Danh Mục Thực Thể (Catalog Mapping)', () => {
  test('Ánh xạ chính xác toàn bộ 20+ danh mục nhân vật & quái vật', () => {
    const male = getCatalogEntry(EntityCatalogId.HERO_MALE);
    assert.ok(male);
    assert.equal(male.rowIndex, 0);
    assert.equal(male.numFrames, 6);

    const female = getCatalogEntry(EntityCatalogId.HERO_FEMALE);
    assert.ok(female);
    assert.equal(female.rowIndex, 1);

    const trex = getCatalogEntry(EntityCatalogId.TREX);
    assert.ok(trex);
    assert.equal(trex.rowIndex, 4);

    const mammoth = getCatalogEntry(EntityCatalogId.MAMMOTH);
    assert.ok(mammoth);
    assert.equal(mammoth.rowIndex, 13);
  });

  test('mapBeastSpeciesToCatalog chuyển đổi đúng tên loài sang CatalogId', () => {
    assert.equal(mapBeastSpeciesToCatalog('trex'), EntityCatalogId.TREX);
    assert.equal(mapBeastSpeciesToCatalog('spinosaurus'), EntityCatalogId.SPINOSAURUS);
    assert.equal(mapBeastSpeciesToCatalog('ankylosaurus'), EntityCatalogId.ANKYLOSAURUS);
    assert.equal(mapBeastSpeciesToCatalog('mammoth'), EntityCatalogId.MAMMOTH);
    assert.equal(mapBeastSpeciesToCatalog('wolf'), EntityCatalogId.WOLF_PACK);
    assert.equal(mapBeastSpeciesToCatalog('plesiosaur'), EntityCatalogId.PLESIOSAUR);
  });
});

describe('5. Y-Sorting & Depth Engine', () => {
  class MockEntity extends Entity {
    public update() {}
    public render() {}
  }

  test('Sắp xếp chính xác theo trục Y (getSortY = worldY + zIndexOffset)', () => {
    const ySort = new YSortManager();

    const entityFar = new MockEntity('e1', 100, 50);   // Y = 50 (ở xa)
    const entityMid = new MockEntity('e2', 100, 150);  // Y = 150 (ở giữa)
    const entityNear = new MockEntity('e3', 100, 300); // Y = 300 (ở gần)

    ySort.addEntity(entityNear, 100, 300);
    ySort.addEntity(entityFar, 100, 50);
    ySort.addEntity(entityMid, 100, 150);

    const renderOrder: string[] = [];
    const mockCtx: any = {};

    ySort.renderAll(mockCtx, 1, 1, {});

    const queue = ySort.getQueue();
    assert.equal(queue[0].entity.id, 'e1');
    assert.equal(queue[1].entity.id, 'e2');
    assert.equal(queue[2].entity.id, 'e3');
  });

  test('Tách 3 pass: Shadow Pass -> Entity Body Pass -> Overlay Pass', () => {
    const ySort = new YSortManager();
    const e = new MockEntity('player', 100, 200);

    const callLog: string[] = [];
    ySort.addEntity(e, 100, 200, {
      shadowRenderFn: () => callLog.push('shadow'),
      customRenderFn: () => callLog.push('body'),
      overlayRenderFn: () => callLog.push('overlay'),
    });

    const mockCtx: any = {};
    ySort.renderAll(mockCtx, 1, 1);

    assert.deepEqual(callLog, ['shadow', 'body', 'overlay']);
  });
});
