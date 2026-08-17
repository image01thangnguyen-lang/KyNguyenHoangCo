/**
 * spriteSheetAnimator.ts
 * Module Điều Khiển Diễn Hoạt Sprite Sheet (Sprite Sheet Animation System)
 *
 * Hỗ trợ:
 * 1. Tự động cắt 6 khung hình từ Catalog / Sprite Sheet theo công thức:
 *    sx = frameIndex * frameWidth, sy = rowIndex * frameHeight
 * 2. Máy trạng thái (State Machine): IDLE, WALK, RUN, ATTACK, DEAD, REST
 * 3. Đồng bộ tốc độ khung hình (Frame Rate) bằng Delta Time độc lập với FPS màn hình.
 * 4. Đồng bộ hướng di chuyển (Flip Direction qua ctx.scale(-1, 1)).
 * 5. Căn chỉnh theo điểm neo (Anchor Point 0.5, 1.0 tại chân đối tượng).
 */

import { EntityCatalogId, ENTITY_CATALOG, getCatalogEntry, type CatalogStripBounds } from './entityCatalog.ts';
import { AssetLoader } from '../assets/assetLoader.ts';
import { ProceduralCatalogAtlas } from './proceduralCatalogAtlas.ts';

export type EntityState = 'IDLE' | 'WALK' | 'RUN' | 'ATTACK' | 'DEAD' | 'REST';

export interface AnimatorRenderOptions {
  /** Hệ số co giãn thêm (scale multiplier) */
  scale?: number;
  /** Độ trong suốt (0.0 -> 1.0) */
  alpha?: number;
  /** Góc xoay (radians) */
  rotation?: number;
  /** Đang lật sang trái (hoặc tự động tính từ velocityX) */
  flipX?: boolean;
  /** Màu phủ bóng (tint color dạng rgba) */
  tintColor?: string;
  /** Bật nhịp thở squash & stretch nhẹ khi đứng yên IDLE */
  idleBreathing?: boolean;
}

export interface SpriteSheetAnimatorConfig {
  /** Hình ảnh Sprite Sheet hoặc HTMLCanvasElement */
  image?: HTMLImageElement | HTMLCanvasElement;
  /** Số cột khung hình trong mỗi hàng (Mặc định: 6 cột) */
  numCols?: number;
  /** Số hàng trong toàn bộ Sprite Sheet (Mặc định: 1) */
  numRows?: number;
  /** Chỉ số hàng (0-indexed) */
  rowIndex?: number;
  /** Chiều rộng của 1 khung hình (nếu không set sẽ tự chia theo image.width / numCols) */
  frameWidth?: number;
  /** Chiều cao của 1 khung hình (nếu không set sẽ tự chia theo image.height / numRows) */
  frameHeight?: number;
  /** Tọa độ vùng dải strip trên catalog sheet (nếu có) */
  stripBounds?: CatalogStripBounds;
  /** Tốc độ khung hình (FPS) mặc định (Mặc định: 8 fps) */
  fps?: number;
  /** Điểm neo X (0.0 = mép trái, 0.5 = giữa, 1.0 = mép phải. Mặc định 0.5) */
  anchorX?: number;
  /** Điểm neo Y (0.0 = đỉnh đầu, 1.0 = chân đối tượng. Mặc định 1.0) */
  anchorY?: number;
  /** Trạng thái ban đầu */
  initialState?: EntityState;
  /** Cấu hình mảng khung hình cho từng trạng thái */
  stateFrames?: Partial<Record<EntityState, number[]>>;
}

export class SpriteSheetAnimator {
  public image?: HTMLImageElement | HTMLCanvasElement;
  public numCols: number = 6;
  public numRows: number = 1;
  public rowIndex: number = 0;
  public frameWidth: number = 64;
  public frameHeight: number = 64;
  public stripBounds?: CatalogStripBounds;

  public anchorX: number = 0.5;
  public anchorY: number = 1.0;

  // Máy trạng thái (State Machine)
  public state: EntityState = 'IDLE';
  public currentFrameNumber: number = 0; // 0..5
  public currentSequenceIndex: number = 0; // Vị trí trong mảng frame của state hiện tại
  public elapsedTime: number = 0; // Bộ đếm thời gian tích lũy (giây)
  public fps: number = 8;
  public facingLeft: boolean = false;
  public isPlaying: boolean = true;

  // Mảng frame cho từng trạng thái theo quy chuẩn 6 khung hình
  // Frame 0: IDLE
  // Frame 1, 2, 3: WALK / RUN (Loop 1 -> 2 -> 3 -> 2 hoặc 1 -> 2 -> 3)
  // Frame 4 -> 5: ATTACK (Chạy 1 lần rồi về IDLE)
  // Frame 5: DEAD / REST (Cố định ở khung 5)
  private stateFrames: Record<EntityState, number[]> = {
    IDLE: [0],
    WALK: [1, 2, 3, 2],
    RUN: [1, 2, 3],
    ATTACK: [4, 5],
    DEAD: [5],
    REST: [5],
  };

  /** Callback khi hoạt ảnh ATTACK hoặc 1-shot hoàn tất */
  public onAnimationComplete?: (state: EntityState) => void;

  private tickCount: number = 0;

  constructor(config?: SpriteSheetAnimatorConfig) {
    if (config) {
      this.configure(config);
    }
  }

  /**
   * Khởi tạo cấu hình cho Animator
   */
  public configure(config: SpriteSheetAnimatorConfig): this {
    if (config.image !== undefined) this.image = config.image;
    if (config.numCols !== undefined) this.numCols = config.numCols;
    if (config.numRows !== undefined) this.numRows = config.numRows;
    if (config.rowIndex !== undefined) this.rowIndex = config.rowIndex;
    if (config.fps !== undefined) this.fps = config.fps;
    if (config.anchorX !== undefined) this.anchorX = config.anchorX;
    if (config.anchorY !== undefined) this.anchorY = config.anchorY;
    if (config.stripBounds !== undefined) this.stripBounds = config.stripBounds;

    if (config.stateFrames) {
      this.stateFrames = { ...this.stateFrames, ...config.stateFrames };
    }

    if (config.frameWidth !== undefined) {
      this.frameWidth = config.frameWidth;
    } else if (this.stripBounds) {
      this.frameWidth = this.stripBounds.stripWidth / this.numCols;
    } else if (this.image) {
      this.frameWidth = this.image.width / this.numCols;
    }

    if (config.frameHeight !== undefined) {
      this.frameHeight = config.frameHeight;
    } else if (this.stripBounds) {
      this.frameHeight = this.stripBounds.stripHeight;
    } else if (this.image) {
      this.frameHeight = this.image.height / this.numRows;
    }

    if (config.initialState) {
      this.setState(config.initialState, true);
    } else {
      this.updateCurrentFrame();
    }

    return this;
  }

  /**
   * Tạo Animator tự động từ EntityCatalogId
   */
  public static fromCatalog(
    catalogId: EntityCatalogId | string,
    image?: HTMLImageElement | HTMLCanvasElement,
  ): SpriteSheetAnimator {
    const entry = getCatalogEntry(catalogId);
    const animator = new SpriteSheetAnimator();

    if (entry) {
      // Ưu tiên dùng dải 6 khung hình HD trong suốt tuyệt đối từ ProceduralCatalogAtlas
      const atlas = ProceduralCatalogAtlas.getInstance();
      const stripCanvas = atlas.getStrip(entry.id);

      if (stripCanvas) {
        animator.configure({
          image: stripCanvas,
          numCols: 6,
          numRows: 1,
          rowIndex: 0,
          frameWidth: stripCanvas.width / 6,
          frameHeight: stripCanvas.height,
          fps: entry.defaultFps || 8,
          anchorX: 0.5,
          anchorY: 1.0,
        });
      } else {
        animator.configure({
          image,
          numCols: entry.numFrames || 6,
          rowIndex: entry.rowIndex,
          fps: entry.defaultFps || 8,
          stripBounds: entry.catalogBounds,
          anchorX: 0.5,
          anchorY: 1.0,
        });
      }
    }

    return animator;
  }

  /**
   * Chuyển đổi trạng thái (State Transition)
   * @param newState Trạng thái mới
   * @param resetTime Có reset bộ đếm thời gian về 0 hay không
   */
  public setState(newState: EntityState, resetTime: boolean = false): void {
    if (this.state === newState && !resetTime) return;

    this.state = newState;
    if (resetTime) {
      this.elapsedTime = 0;
      this.currentSequenceIndex = 0;
    }

    const frames = this.stateFrames[this.state] || [0];
    if (this.currentSequenceIndex >= frames.length) {
      this.currentSequenceIndex = 0;
    }

    this.updateCurrentFrame();
  }

  /**
   * Kích hoạt đòn đánh / tấn công (State ATTACK)
   * Chạy frame 4 -> 5 rồi tự động quay về IDLE
   */
  public playAttack(onComplete?: () => void): void {
    this.setState('ATTACK', true);
    if (onComplete) {
      this.onAnimationComplete = () => {
        onComplete();
      };
    }
  }

  /**
   * Đặt trạng thái đã bị hạ gục (DEAD)
   */
  public playDead(): void {
    this.setState('DEAD', true);
  }

  /**
   * Đặt hướng quay mặt theo vận tốc vx hoặc cự ly
   */
  public setFacingFromVelocity(vx: number): void {
    if (vx < -0.05) {
      this.facingLeft = true;
    } else if (vx > 0.05) {
      this.facingLeft = false;
    }
  }

  /**
   * Cập nhật logic hoạt họa qua Delta Time (dt tính bằng giây)
   * Độc lập hoàn toàn với FPS màn hình
   * @param dt Thời gian trôi qua giữa 2 frame (giây)
   * @param speedMultiplier Hệ số tăng tốc độ chuyển frame (ví dụ khi chạy nhanh)
   */
  public update(dt: number, speedMultiplier: number = 1.0): void {
    this.tickCount++;

    if (!this.isPlaying) return;

    const frames = this.stateFrames[this.state] || [0];
    if (frames.length <= 1) {
      this.currentSequenceIndex = 0;
      this.currentFrameNumber = frames[0] ?? 0;
      return;
    }

    // Tính chu kỳ thời gian cho 1 frame
    const effectiveFps = Math.max(1, this.fps * speedMultiplier);
    const frameDuration = 1.0 / effectiveFps;

    this.elapsedTime += dt;

    if (this.elapsedTime >= frameDuration) {
      const stepFrames = Math.floor(this.elapsedTime / frameDuration);
      this.elapsedTime %= frameDuration;

      this.currentSequenceIndex += stepFrames;

      // Xử lý khi hết chuỗi hoạt họa
      if (this.currentSequenceIndex >= frames.length) {
        if (this.state === 'ATTACK') {
          // Khi đánh xong (frame 4 -> 5) -> tự động quay về IDLE
          const cb = this.onAnimationComplete;
          this.onAnimationComplete = undefined;
          this.setState('IDLE', true);
          if (cb) cb('ATTACK');
          return;
        } else if (this.state === 'DEAD' || this.state === 'REST') {
          // Trạng thái chết / nghỉ: cố định ở khung cuối cùng
          this.currentSequenceIndex = frames.length - 1;
        } else {
          // Lặp tuần hoàn (Loop cho WALK, RUN, IDLE)
          this.currentSequenceIndex %= frames.length;
        }
      }

      this.updateCurrentFrame();
    }
  }

  private updateCurrentFrame(): void {
    const frames = this.stateFrames[this.state] || [0];
    const idx = Math.min(this.currentSequenceIndex, frames.length - 1);
    this.currentFrameNumber = frames[idx] ?? 0;
  }

  /**
   * Tính toán tọa độ cắt khung hình từ Sprite Sheet (Bounding Box sx, sy, sw, sh)
   */
  public calculateCutRect(): { sx: number; sy: number; sw: number; sh: number } {
    if (this.stripBounds) {
      // Trường hợp cắt từ catalog strip có vùng tọa độ cụ thể
      const frameW = this.stripBounds.stripWidth / this.numCols;
      const frameH = this.stripBounds.stripHeight;
      const sx = this.stripBounds.startX + this.currentFrameNumber * frameW;
      const sy = this.stripBounds.startY;
      return {
        sx,
        sy,
        sw: frameW,
        sh: frameH,
      };
    }

    // Trường hợp cắt Sprite Sheet chuẩn dạng lưới (Grid)
    // sx = frameIndex * frameWidth
    // sy = rowIndex * frameHeight
    const sx = this.currentFrameNumber * this.frameWidth;
    const sy = this.rowIndex * this.frameHeight;
    return {
      sx,
      sy,
      sw: this.frameWidth,
      sh: this.frameHeight,
    };
  }

  /**
   * Vẽ khung hình hiện tại lên Canvas 2D
   * Tự động căn chỉnh theo điểm neo (Anchor Point 0.5, 1.0) và xử lý lật hướng (FlipX)
   *
   * @param ctx CanvasRenderingContext2D
   * @param screenX Tọa độ X trên màn hình (vị trí chân đối tượng)
   * @param screenY Tọa độ Y trên màn hình (vị trí chân đối tượng)
   * @param drawWidth Chiều rộng vẽ trên màn hình
   * @param drawHeight Chiều cao vẽ trên màn hình
   * @param options Tùy chọn vẽ nâng cao (flipX, rotation, scale, alpha, breathing)
   */
  public render(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    drawWidth: number = this.frameWidth,
    drawHeight: number = this.frameHeight,
    options?: AnimatorRenderOptions,
  ): void {
    const scale = options?.scale ?? 1.0;
    const isFlip = options?.flipX !== undefined ? options.flipX : this.facingLeft;
    const alpha = options?.alpha ?? 1.0;
    const rotation = options?.rotation ?? 0;

    const finalW = drawWidth * scale;
    const finalH = drawHeight * scale;

    // Tính điểm neo: mặc định anchorX = 0.5 (ở giữa), anchorY = 1.0 (ở chân)
    const offsetX = -finalW * this.anchorX;
    const offsetY = -finalH * this.anchorY;

    // Hiệu ứng nhấp nhô nhẹ thở khi IDLE (Squash & Stretch)
    let breathX = 1.0;
    let breathY = 1.0;
    if (options?.idleBreathing && this.state === 'IDLE') {
      const breathPhase = Math.sin(this.tickCount * 0.08);
      breathX = 1.0 + breathPhase * 0.025;
      breathY = 1.0 - breathPhase * 0.025;
    }

    ctx.save();
    ctx.translate(screenX, screenY);

    if (alpha < 1.0) {
      ctx.globalAlpha *= alpha;
    }

    if (rotation !== 0) {
      ctx.rotate(rotation);
    }

    // 3. ĐỒNG BỘ HƯỚNG DI CHUYỂN (Flip Direction)
    // Khi quay sang trái, ctx.scale(-1, 1) và vẽ đối xứng
    if (isFlip) {
      ctx.scale(-1, 1);
    }

    if (breathX !== 1.0 || breathY !== 1.0) {
      ctx.scale(breathX, breathY);
    }

    if (!this.image) {
      const catalogImg = AssetLoader.getInstance().getCatalogImage();
      if (catalogImg) {
        this.image = catalogImg;
        if (!this.stripBounds && this.frameWidth === 64 && catalogImg.width) {
          this.frameWidth = catalogImg.width / this.numCols;
          this.frameHeight = catalogImg.height / this.numRows;
        }
      }
    }

    if (this.image) {
      const cut = this.calculateCutRect();

      // Vẽ hình ảnh từ Sprite Sheet cắt theo sx, sy, sw, sh
      ctx.drawImage(
        this.image,
        cut.sx,
        cut.sy,
        cut.sw,
        cut.sh,
        offsetX,
        offsetY,
        finalW,
        finalH,
      );

      // Phủ màu (Tint) nếu được yêu cầu
      if (options?.tintColor) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = options.tintColor;
        ctx.fillRect(offsetX, offsetY, finalW, finalH);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  /**
   * Khung placeholder mẫu khi hình ảnh đang tải (chỉ vẽ bóng đổ nhẹ nếu cần)
   */
  private renderFallbackPlaceholder(
    ctx: CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void {
    // Không vẽ khung debug màu cam - giữ màn hình sạch sẽ
  }

  /**
   * Clone nhanh một instance Animator mới với cấu hình tương tự
   */
  public clone(): SpriteSheetAnimator {
    const cloned = new SpriteSheetAnimator({
      image: this.image,
      numCols: this.numCols,
      numRows: this.numRows,
      rowIndex: this.rowIndex,
      frameWidth: this.frameWidth,
      frameHeight: this.frameHeight,
      stripBounds: this.stripBounds ? { ...this.stripBounds } : undefined,
      fps: this.fps,
      anchorX: this.anchorX,
      anchorY: this.anchorY,
      initialState: this.state,
      stateFrames: { ...this.stateFrames },
    });
    cloned.facingLeft = this.facingLeft;
    return cloned;
  }
}
