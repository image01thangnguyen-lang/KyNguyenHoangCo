/**
 * Renderer bản đồ "tiền sử hoá" — vẽ thẳng lên canvas, không SDK bản đồ, không tile online
 * (§4.1 bản 2.0).
 *
 * Bản đồ này KHÔNG cố vẽ lại thế giới thật cho chính xác. Nó vẽ thế giới thật NHÌN QUA MẮT
 * người tiền sử: đường sá thành lối mòn đất, ô lưới thành thảm cỏ, POI thành rặng cây và
 * vũng nước. Đó vừa là phong cách, vừa là lý do gói dữ liệu offline chỉ cần vài MB.
 *
 * Mọi hình dạng sinh từ hàm băm toạ độ nên cùng một chỗ luôn trông giống nhau qua các phiên,
 * và hai người chơi đứng cạnh nhau thấy đúng một cảnh.
 */

import { createRng, hashSeed } from '../../../packages/game-core/src/rng.js';
import {
  distanceMeters,
  metersToLatDegrees,
  metersToLonDegrees,
} from '../../../packages/game-core/src/world.js';
                                                                                               
                                                                               
                                                                     

                            
             
                 
                 
              
              
              
                      
 

                              
                 
                         
               
                        
                                                                         
                             
                                                                               
                      
                                                                 
                  
                                 
                                                       
                              
                                                                               
                      
                                                      
                       
                                                              
                              
 

export function itemEmoji(id        )         {
  switch (id) {
    case 'dry_branch':
    case 'log':
    case 'wood':
      return '🪵';
    case 'sharp_stone':
    case 'stone_block':
    case 'flint':
    case 'stone':
      return '🪨';
    case 'coal':
      return '⬛';
    case 'gold_ore':
      return '✨';
    case 'iron_ore':
    case 'iron_ingot':
      return '⛓️';
    case 'wild_berries':
    case 'berries':
    case 'wild_berry':
    case 'fruit':
      return '🍓';
    case 'medicinal_herb':
    case 'herbs':
    case 'mushroom':
    case 'red_mushroom':
      return '🍄';
    case 'raw_water':
    case 'clean_water':
    case 'boiled_water':
    case 'water':
      return '💧';
    case 'raw_meat':
    case 'cooked_meat':
    case 'grilled_meat':
    case 'meat':
    case 'dried_meat':
      return '🍖';
    case 'raw_fish':
    case 'grilled_fish':
    case 'fish':
      return '🐟';
    case 'fiber':
    case 'vine':
    case 'rope':
      return '🌾';
    case 'clay':
    case 'fired_brick':
    case 'clay_pot':
      return '🏺';
    case 'feather':
      return '🪶';
    case 'leather':
    case 'fur':
      return '🥋';
    case 'ancient_coin':
      return '🪙';
    case 'rabbit_trap':
      return '🪤';
    case 'deer_trap':
      return '🦌';
    case 'beast_trap':
      return '🐺';
    case 'spike_trap':
      return '📌';
    case 'stone_axe':
    case 'iron_axe':
      return '🪓';
    case 'stone_spear':
    case 'iron_spear':
      return '🗡️';
    case 'torch':
      return '🔥';
    default:
      return '📦';
  }
}

const PALETTE = {
  day: {
    ground: '#252c1b',
    dirt: '#3d2e1d',
    rock: '#2e312e',
    sand: '#4d4027',
    trail: '#47361e',
  },
  evening: {
    ground: '#1d2114',
    dirt: '#302416',
    rock: '#242624',
    sand: '#3d321d',
    trail: '#382916',
  },
  night: {
    ground: '#090c09',
    dirt: '#140f09',
    rock: '#101210',
    sand: '#17130b',
    trail: '#140d06',
  },
}         ;

const NATURAL_RIVERS                                                            = [
  {
    name: 'Sông Hồng',
    widthMeters: 160,
    points: [
      { lat: 21.22, lon: 105.48 },
      { lat: 21.18, lon: 105.56 },
      { lat: 21.14, lon: 105.65 },
      { lat: 21.1, lon: 105.76 },
      { lat: 21.09, lon: 105.82 },
      { lat: 21.06, lon: 105.85 },
      { lat: 21.04, lon: 105.865 },
      { lat: 21.01, lon: 105.88 },
      { lat: 20.97, lon: 105.905 },
      { lat: 20.92, lon: 105.92 },
      { lat: 20.85, lon: 105.935 },
    ],
  },
  {
    name: 'Sông Đuống',
    widthMeters: 90,
    points: [
      { lat: 21.085, lon: 105.855 },
      { lat: 21.075, lon: 105.89 },
      { lat: 21.055, lon: 105.925 },
      { lat: 21.025, lon: 105.975 },
    ],
  },
  {
    name: 'Sông Tô Lịch',
    widthMeters: 38,
    points: [
      { lat: 21.045, lon: 105.805 },
      { lat: 21.032, lon: 105.802 },
      { lat: 21.015, lon: 105.809 },
      { lat: 21.002, lon: 105.818 },
      { lat: 20.985, lon: 105.818 },
      { lat: 20.965, lon: 105.845 },
    ],
  },
  {
    name: 'Sông Đáy',
    widthMeters: 75,
    points: [
      { lat: 21.12, lon: 105.68 },
      { lat: 21.05, lon: 105.69 },
      { lat: 20.98, lon: 105.68 },
      { lat: 20.91, lon: 105.7 },
      { lat: 20.78, lon: 105.76 },
      { lat: 20.65, lon: 105.81 },
    ],
  },
];

const REAL_ROADS                                                            = [
  {
    name: 'Cổ Đạo Lê Đức Thọ',
    widthMeters: 28,
    points: [
      { lat: 21.0425, lon: 105.7705 },
      { lat: 21.0315, lon: 105.7725 },
      { lat: 21.0205, lon: 105.7665 },
      { lat: 21.0145, lon: 105.7645 },
    ],
  },
  {
    name: 'Lối Mòn Hàm Nghi',
    widthMeters: 22,
    points: [
      { lat: 21.0315, lon: 105.7725 },
      { lat: 21.0335, lon: 105.7685 },
      { lat: 21.0395, lon: 105.7615 },
    ],
  },
  {
    name: 'Lối Mòn Nguyễn Hoàng',
    widthMeters: 24,
    points: [
      { lat: 21.0315, lon: 105.7725 },
      { lat: 21.0298, lon: 105.7762 },
      { lat: 21.0285, lon: 105.7785 },
    ],
  },
  {
    name: 'Cổ Lộ Hồ Tùng Mậu — Cầu Giấy',
    widthMeters: 32,
    points: [
      { lat: 21.0455, lon: 105.7625 },
      { lat: 21.0368, lon: 105.7718 },
      { lat: 21.0365, lon: 105.7815 },
      { lat: 21.0335, lon: 105.7925 },
      { lat: 21.0315, lon: 105.8085 },
    ],
  },
  {
    name: 'Thiên Lý Đạo Phạm Hùng (Vành Đai 3)',
    widthMeters: 36,
    points: [
      { lat: 21.0485, lon: 105.7785 },
      { lat: 21.0285, lon: 105.7785 },
      { lat: 21.0168, lon: 105.7838 },
      { lat: 21.0055, lon: 105.7925 },
      { lat: 20.9925, lon: 105.8035 },
    ],
  },
  {
    name: 'Đại Quan Đạo Thăng Long — Trần Duy Hưng',
    widthMeters: 35,
    points: [
      { lat: 21.0025, lon: 105.7655 },
      { lat: 21.0055, lon: 105.7925 },
      { lat: 21.0105, lon: 105.8045 },
    ],
  },
  {
    name: 'Cổ Đạo Kim Mã — Tràng Thi',
    widthMeters: 26,
    points: [
      { lat: 21.0315, lon: 105.8085 },
      { lat: 21.0325, lon: 105.8285 },
      { lat: 21.0293, lon: 105.8355 },
      { lat: 21.0287, lon: 105.8524 },
    ],
  },
  {
    name: 'Thiên Lý Cổ Lộ Giải Phóng',
    widthMeters: 30,
    points: [
      { lat: 21.0245, lon: 105.8415 },
      { lat: 21.0128, lon: 105.8434 },
      { lat: 21.0028, lon: 105.8398 },
      { lat: 20.9735, lon: 105.8612 },
    ],
  },
];

// Mảng ngẫu nhiên tĩnh để vẽ hạt mưa & bụi ánh sáng mà không cần sinh RNG 60 lần/giây
const STATIC_RAIN_DROPS = Array.from({ length: 90 }, (_, i) => {
  const r1 = Math.abs(Math.sin(i * 12.9898 + 78.233));
  const r2 = Math.abs(Math.cos(i * 37.719 + 11.13));
  return { u: r1 % 1, v: r2 % 1, lenFactor: 8 + ((r1 * 10) % 10) };
});

const STATIC_POLLEN = Array.from({ length: 14 }, (_, p) => {
  const r1 = Math.abs(Math.sin(p * 43.123 + 17.5));
  const r2 = Math.abs(Math.cos(p * 29.876 + 5.12));
  return { u: r1 % 1, v: r2 % 1, speed: 0.8 + ((r1 * 0.6) % 0.6), size: 1.2 + ((r2 * 1.4) % 1.4) };
});

const STATIC_EMBERS = Array.from({ length: 16 }, (_, e) => {
  const r1 = Math.abs(Math.sin(e * 31.415 + 9.2));
  const r2 = Math.abs(Math.cos(e * 19.283 + 3.7));
  return { u: r1 % 1, v: r2 % 1, speed: 1.5 + ((r1 * 1.5) % 1.5), size: 1.2 + ((r2 * 1.8) % 1.8), isAmber: r1 > 0.5 };
});

                                
                            
                     
                     
 

export class MapView {
                   canvas                   ;
                   ctx                          ;
          dpr = 1;
          tick = 0;

  // Trạng thái Phóng to / Thu nhỏ (Zoom) & Kéo bản đồ tự do (Pan / Drag)
          zoomFactor = 1.0;
          panX = 0;
          panY = 0;
          isDragging = false;
          activePointers = new Map                                  ();
          pinchStartDist = 0;
          pinchStartZoom = 1.0;
          lastPointer                                  = null;
          pointerDownPos                                  = null;
          pointerDownTime = 0;
          lastInput                     = null;
          lastProject                                            = null;

  /** Callback khi trạng thái kéo hoặc zoom bản đồ thay đổi. */
  onViewportChange                                 ;
  /** Callback tương thích cũ khi trạng thái kéo thay đổi. */
  onPanChange                              ;
  /** Callback khi chạm vào một món đồ rơi trên bản đồ để nhặt. */
  onDropClick                            ;
  /** Callback khi chạm vào bẫy thú trên bản đồ để thu hoạch. */
  onTrapClick                             ;
  /** Callback khi chạm vào một Địa Điểm / Hàng Quán / POI trên bản đồ. */
  onFeatureClick                                ;

          viewportDirty = false;
          cachedInputFeatures                      = null;
          cachedWaterFeatures               = [];
          cachedSolidFeatures               = [];

  constructor(canvas                   ) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Trình duyệt không hỗ trợ canvas 2D.');
    this.ctx = ctx;

    // Bắt sự kiện chạm đa điểm (Multi-touch Pinch to zoom) và vuốt 1 ngón (Drag / Pan)
    canvas.addEventListener('pointerdown', (e) => {
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture?.(e.pointerId);

      if (this.activePointers.size === 1) {
        this.isDragging = true;
        this.lastPointer = { x: e.clientX, y: e.clientY };
        this.pointerDownPos = { x: e.clientX, y: e.clientY };
        this.pointerDownTime = performance.now();
      } else if (this.activePointers.size === 2) {
        // Bắt đầu chụm/xòe 2 ngón tay (Pinch to Zoom)
        const [p1, p2] = Array.from(this.activePointers.values());
        this.pinchStartDist = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
        this.pinchStartZoom = this.zoomFactor;
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this.activePointers.has(e.pointerId)) return;
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.activePointers.size >= 2) {
        // Đang chụm/xòe 2 ngón tay để Zoom
        const [p1, p2] = Array.from(this.activePointers.values());
        const currentDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const ratio = currentDist / (this.pinchStartDist || 1);
        this.setZoom(this.pinchStartZoom * ratio);
      } else if (this.activePointers.size === 1 && this.isDragging && this.lastPointer) {
        // Vuốt 1 ngón tay để kéo bản đồ
        const dx = e.clientX - this.lastPointer.x;
        const dy = e.clientY - this.lastPointer.y;
        this.lastPointer = { x: e.clientX, y: e.clientY };

        this.panX += dx * this.dpr;
        this.panY += dy * this.dpr;
        this.viewportDirty = true;
      }
    });

    const endDrag = (e              ) => {
      const wasTracking = this.activePointers.has(e.pointerId);
      this.activePointers.delete(e.pointerId);

      if (this.activePointers.size === 1) {
        // Còn 1 ngón sau khi thả 1 ngón -> chuyển về chế độ kéo đơn
        const [p] = Array.from(this.activePointers.values());
        this.lastPointer = { x: p.x, y: p.y };
      } else if (this.activePointers.size === 0 && wasTracking) {
        this.isDragging = false;

        const duration = performance.now() - this.pointerDownTime;
        const dist = this.pointerDownPos
          ? Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y)
          : 999;

        // Nếu chạm nhanh (< 350ms) và nhích rất ít (< 10px) -> coi là cú chạm/click!
        if (dist < 10 && duration < 350 && this.lastProject) {
          const rect = canvas.getBoundingClientRect();
          const clickX = (e.clientX - rect.left) * this.dpr;
          const clickY = (e.clientY - rect.top) * this.dpr;

          // 1. Kiểm tra click vào bẫy thú trước
          if (this.lastInput?.traps) {
            let nearestTrap                    = null;
            let minTrapDist = 38 * this.dpr;

            for (const trap of this.lastInput.traps) {
              const [tx, ty] = this.lastProject({ lat: trap.lat, lon: trap.lon });
              const d = Math.hypot(clickX - tx, clickY - ty);
              if (d < minTrapDist) {
                minTrapDist = d;
                nearestTrap = trap;
              }
            }

            if (nearestTrap) {
              this.onTrapClick?.(nearestTrap);
              this.lastPointer = null;
              this.pointerDownPos = null;
              return;
            }
          }

          // 2. Tìm món đồ gần điểm chạm nhất trong bán kính 35px
          if (this.lastInput?.drops) {
            let nearestDrop                   = null;
            let minDropDist = 35 * this.dpr;

            for (const drop of this.lastInput.drops) {
              const [dx, dy] = this.lastProject({ lat: drop.lat, lon: drop.lon });
              const d = Math.hypot(clickX - dx, clickY - dy);
              if (d < minDropDist) {
                minDropDist = d;
                nearestDrop = drop;
              }
            }

            if (nearestDrop) {
              this.onDropClick?.(nearestDrop);
              this.lastPointer = null;
              this.pointerDownPos = null;
              return;
            }
          }

          // 3. Tìm Địa Điểm / Hàng Quán / POI gần điểm chạm nhất trong bán kính 45px
          if (this.lastInput?.features) {
            let nearestFeature                    = null;
            let minFeatureDist = 45 * this.dpr;

            for (const feat of this.lastInput.features) {
              const [fx, fy] = this.lastProject({ lat: feat.lat, lon: feat.lon });
              const d = Math.hypot(clickX - fx, clickY - fy);
              if (d < minFeatureDist) {
                minFeatureDist = d;
                nearestFeature = feat;
              }
            }

            if (nearestFeature) {
              this.onFeatureClick?.(nearestFeature);
            }
          }
        }

        this.lastPointer = null;
        this.pointerDownPos = null;
      }
    };

    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    // Cuộn chuột trên Desktop để Phóng to / Thu nhỏ (Mouse Wheel Zoom)
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.25 : 0.8;
        this.setZoom(this.zoomFactor * factor);
      },
      { passive: false },
    );
  }

  /** Đặt hệ số zoom với giới hạn từ 0.04 (toàn cảnh cả Hà Nội ~10km) đến 3.0 (cận cảnh ~140m). */
  setZoom(target        )       {
    const clamped = Math.max(0.04, Math.min(3.0, target));
    if (Math.abs(this.zoomFactor - clamped) > 0.001) {
      this.zoomFactor = clamped;
      this.notifyViewportChange();
    }
  }

  /** Phóng to 1 cấp (+35%). */
  zoomIn()       {
    this.setZoom(this.zoomFactor * 1.35);
  }

  /** Thu nhỏ 1 cấp (-35%) để mở rộng tầm nhìn toàn bản đồ. */
  zoomOut()       {
    this.setZoom(this.zoomFactor / 1.35);
  }

  /** Thu nhỏ tối đa để nhìn thấy trọn vẹn toàn bộ thành phố Hà Nội và 4 dòng sông. */
  zoomOverview()       {
    this.setZoom(0.05);
  }

  /** Kiểm tra xem bản đồ có đang bị kéo lệch hoặc zoom khác kích thước chuẩn (1.0x) không. */
  isPannedOrZoomed()          {
    const panned = Math.hypot(this.panX, this.panY) > 20 * this.dpr;
    const zoomed = Math.abs(this.zoomFactor - 1.0) > 0.05;
    return panned || zoomed;
  }

  /** Kiểm tra tương thích cũ: có đang pan kéo lệch tâm không. */
  isPanned()          {
    return this.isPannedOrZoomed();
  }

  /** Đưa bản đồ quay về kích thước ban đầu (1.0x) và trung tâm nhân vật. */
  recenterAndResetZoom()       {
    this.panX = 0;
    this.panY = 0;
    this.zoomFactor = 1.0;
    this.notifyViewportChange();
  }

  /** Tương thích cũ: gọi recenterAndResetZoom. */
  recenter()       {
    this.recenterAndResetZoom();
  }

          notifyViewportChange()       {
    const state                = {
      isPannedOrZoomed: this.isPannedOrZoomed(),
      zoomFactor: this.zoomFactor,
      spanMeters: 420 / this.zoomFactor,
    };
    this.onViewportChange?.(state);
    this.onPanChange?.(state.isPannedOrZoomed);
  }

  resize()       {
    const rect = this.canvas.getBoundingClientRect();
    // Sử dụng chuẩn DPR Retina tự nhiên của màn hình iPhone (2.0x - 3.0x) cho đồ hoạ siêu nét và chi tiết
    this.dpr = Math.min(globalThis.devicePixelRatio || 2, 3.0);
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
  }

  render(input             )       {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w < 2 || h < 2) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (this.viewportDirty) {
      this.viewportDirty = false;
      this.notifyViewportChange();
    }

    this.tick++;
    this.lastInput = input;

    const TILT_Y = 0.68; // Tỉ lệ phối cảnh nghiêng 2.5D Isometric (cos ~47 độ)
    const baseSpan = input.spanMeters ?? 420;
    const spanMeters = baseSpan / this.zoomFactor;
    const pxPerMeter = Math.min(w, h) / spanMeters;
    const palette = PALETTE[input.phase];

    const project = (at        )                   => {
      const dx = (at.lon - input.center.lon) / metersToLonDegrees(1, input.center.lat);
      const dy = (at.lat - input.center.lat) / metersToLatDegrees(1);
      return [w / 2 + dx * pxPerMeter + this.panX, h / 2 - dy * pxPerMeter * TILT_Y + this.panY];
    };
    this.lastProject = project;

    ctx.save();
    this.drawGround(w, h, palette, input, project, pxPerMeter);
    this.drawTrailGrid(w, h, pxPerMeter, palette, input.center);

    // 1. Vẽ các dòng sông lớn tự nhiên chảy qua Hà Nội trong không gian 2.5D
    this.drawNaturalRivers(project, pxPerMeter, input.phase);

    // 2. Vẽ các trục đường phố đại lộ thực tế trong không gian 2.5D
    this.drawRealRoads(project, pxPerMeter, input.phase);

    // Cập nhật bộ nhớ đệm features đã sắp xếp theo chiều sâu Y khi danh sách đầu vào thay đổi
    if (this.cachedInputFeatures !== input.features) {
      this.cachedInputFeatures = input.features;
      this.cachedWaterFeatures = input.features.filter((f) => f.zone === 'water');
      this.cachedSolidFeatures = input.features
        .filter((f) => f.zone !== 'water')
        .sort((a, b) => b.lat - a.lat);
    }

    // 3. Lớp nước dưới cùng (Hồ Gươm, Hồ Tây, Trúc Bạch...)
    for (const feature of this.cachedWaterFeatures) {
      this.drawFeature(feature, project, pxPerMeter, input);
    }

    // 4. Các công trình & cảnh vật nổi khối 3D sắp xếp theo chiều sâu Y
    for (const feature of this.cachedSolidFeatures) {
      this.drawFeature(feature, project, pxPerMeter, input);
    }

    if (input.homeCellCenter) this.drawCamp(project(input.homeCellCenter), pxPerMeter);

    // Vẽ các bẫy thú đang đặt ngoài thế giới
    if (input.traps && input.traps.length > 0) {
      this.drawTraps(project, input.traps, pxPerMeter, input);
    }

    // Vẽ các món đồ rơi trên bản đồ để người chơi nhặt trực tiếp
    if (input.drops && input.drops.length > 0) {
      this.drawDrops(project, input.drops, pxPerMeter, input);
    }

    // Vẽ nhân vật thổ dân tại vị trí đã cộng panX, panY
    this.drawPlayer(w / 2 + this.panX, h / 2 + this.panY, pxPerMeter, input);

    if (input.weather.raining) this.drawRain(w, h, input.weather.rainIntensity);
    this.drawAtmosphereAndLighting(w, h, input, project);
    ctx.restore();
  }

  // ---------------------------------------------------------------- các lớp vẽ

  /** Vẽ các bẫy thú đặt tại toạ độ thực tế trên bản đồ. */
          drawTraps(
    project                                  ,
    traps              ,
    pxPerMeter        ,
    input             ,
  )       {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    for (const trap of traps) {
      if (trap.collected) continue;
      const [x, y] = project({ lat: trap.lat, lon: trap.lon });
      if (x < -60 || x > w + 60 || y < -60 || y > h + 60) continue;

      const distMeters = distanceMeters(input.center, { lat: trap.lat, lon: trap.lon });
      const inRange = distMeters <= 35; // Trong bán kính tương tác thu bẫy (<= 35m)
      const hasCatch = Boolean(trap.caughtItem);
      const pulse = 0.6 + 0.4 * Math.sin(this.tick / 6);

      ctx.save();

      // 1. Bóng đổ bẫy dưới đất
      ctx.fillStyle = 'rgba(10, 8, 6, 0.55)';
      ctx.beginPath();
      ctx.ellipse(x, y + 10 * this.dpr, 14 * this.dpr, 6 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Vầng hào quang khi đã bắt được thú hoặc trong tầm tương tác
      if (hasCatch) {
        const glow = ctx.createRadialGradient(x, y, 4 * this.dpr, x, y, 26 * this.dpr);
        glow.addColorStop(0, `rgba(245, 158, 11, ${0.55 * pulse})`);
        glow.addColorStop(0.6, `rgba(234, 88, 12, ${0.25 * pulse})`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 26 * this.dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Khung vẽ bẫy 3D theo cấp bẫy (Dưới nước / Nhỏ / Vừa / Lớn)
      if (trap.tier === 'water') {
        // Rọ Cá: Lồng nan tre đan hình thoi màu lam viền sáng
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2.5 * this.dpr;
        ctx.beginPath();
        ctx.ellipse(x, y, 13 * this.dpr, 9 * this.dpr, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(14, 165, 233, 0.45)';
        ctx.fill();

        // Nan rọ cá
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5 * this.dpr;
        ctx.beginPath();
        ctx.moveTo(x - 8 * this.dpr, y - 6 * this.dpr);
        ctx.lineTo(x + 8 * this.dpr, y + 6 * this.dpr);
        ctx.moveTo(x - 8 * this.dpr, y + 6 * this.dpr);
        ctx.lineTo(x + 8 * this.dpr, y - 6 * this.dpr);
        ctx.stroke();
      } else if (trap.tier === 'small') {
        // Bẫy Thỏ: Khung gỗ đan dây
        ctx.strokeStyle = '#854d0e';
        ctx.lineWidth = 2.5 * this.dpr;
        ctx.strokeRect(x - 10 * this.dpr, y - 8 * this.dpr, 20 * this.dpr, 16 * this.dpr);

        ctx.fillStyle = '#b45309';
        ctx.fillRect(x - 8 * this.dpr, y - 6 * this.dpr, 16 * this.dpr, 12 * this.dpr);
      } else if (trap.tier === 'medium') {
        // Bẫy Hươu: Khung gỗ dày có chông đá
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 3 * this.dpr;
        ctx.strokeRect(x - 13 * this.dpr, y - 10 * this.dpr, 26 * this.dpr, 20 * this.dpr);

        ctx.fillStyle = '#78350f';
        ctx.fillRect(x - 10 * this.dpr, y - 8 * this.dpr, 20 * this.dpr, 16 * this.dpr);

        // Chông nhọn 2 bên
        ctx.fillStyle = '#78716c';
        ctx.beginPath();
        ctx.moveTo(x - 7 * this.dpr, y - 8 * this.dpr);
        ctx.lineTo(x - 4 * this.dpr, y - 14 * this.dpr);
        ctx.lineTo(x - 1 * this.dpr, y - 8 * this.dpr);
        ctx.fill();
      } else {
        // Bẫy Cự Thú: Khung sắt răng cưa hung dữ
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3.5 * this.dpr;
        ctx.beginPath();
        ctx.arc(x, y, 14 * this.dpr, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(x, y, 12 * this.dpr, 0, Math.PI * 2);
        ctx.fill();

        // Răng cưa kim loại
        ctx.fillStyle = '#cbd5e1';
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          const rx = x + Math.cos(ang) * 11 * this.dpr;
          const ry = y + Math.sin(ang) * 11 * this.dpr;
          ctx.fillRect(rx - 1.5 * this.dpr, ry - 1.5 * this.dpr, 3 * this.dpr, 3 * this.dpr);
        }
      }

      // 4. Biểu tượng trạng thái bẫy
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (hasCatch && trap.caughtItem) {
        // Đã bắt được thú! Hiện icon chiến lợi phẩm
        const icon = itemEmoji(trap.caughtItem.itemId);
        ctx.font = `${16 * this.dpr}px system-ui, sans-serif`;
        ctx.fillText(icon, x, y - 2 * this.dpr);
      } else {
        // Đang rình mồi
        ctx.font = `${12 * this.dpr}px system-ui, sans-serif`;
        ctx.fillText('🪤', x, y - 2 * this.dpr);
      }

      // 5. Nhãn thông tin bẫy
      ctx.fillStyle = hasCatch ? '#fef08a' : '#d4c5a9';
      ctx.font = `bold ${9.5 * this.dpr}px system-ui, sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.95)';
      ctx.shadowBlur = 4 * this.dpr;

      if (hasCatch && trap.caughtItem) {
        ctx.fillText(`🎯 ${trap.caughtItem.nameVi} ×${trap.caughtItem.qty}`, x, y + 20 * this.dpr);
        if (inRange) {
          ctx.fillStyle = '#f59e0b';
          ctx.font = `bold ${8 * this.dpr}px system-ui, sans-serif`;
          ctx.fillText('▼ Chạm để thu bẫy', x, y - 18 * this.dpr);
        }
      } else {
        ctx.fillText(trap.nameVi, x, y + 18 * this.dpr);
      }
      ctx.shadowBlur = 0;

      ctx.restore();
    }
  }

          drawDrops(
    project                                  ,
    drops             ,
    pxPerMeter        ,
    input             ,
  )       {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    for (const drop of drops) {
      const [x, y] = project({ lat: drop.lat, lon: drop.lon });
      // Bỏ qua nếu nằm hoàn toàn ngoài khung nhìn canvas
      if (x < -50 || x > w + 50 || y < -50 || y > h + 50) continue;

      const distMeters = distanceMeters(input.center, { lat: drop.lat, lon: drop.lon });
      const inRange = distMeters <= 30; // Trong bán kính tương tác 30m
      const seed = hashSeed(drop.id);
      const bob = Math.sin(this.tick / 9 + seed) * 3.5 * this.dpr;
      const pulse = 0.6 + 0.4 * Math.sin(this.tick / 7 + seed);

      ctx.save();

      // 1. Bóng đổ 3D mềm dưới đất
      ctx.fillStyle = 'rgba(8, 6, 4, 0.45)';
      ctx.beginPath();
      ctx.ellipse(x, y + 10 * this.dpr, 11 * this.dpr, 4.5 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      const dy = y + bob;

      // 2. Vầng hào quang phát sáng mời gọi nhặt đồ
      if (inRange) {
        const glow = ctx.createRadialGradient(x, dy, 2 * this.dpr, x, dy, 20 * this.dpr);
        glow.addColorStop(0, `rgba(245, 158, 11, ${0.48 * pulse})`);
        glow.addColorStop(0.55, `rgba(234, 88, 12, ${0.18 * pulse})`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, dy, 20 * this.dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Khối tròn nổi chứa icon vật phẩm
      ctx.fillStyle = inRange ? 'rgba(38, 28, 18, 0.95)' : 'rgba(24, 20, 16, 0.85)';
      ctx.strokeStyle = inRange ? `rgba(245, 158, 11, ${pulse})` : 'rgba(241, 218, 167, 0.35)';
      ctx.lineWidth = inRange ? 2.2 * this.dpr : 1.2 * this.dpr;
      ctx.beginPath();
      ctx.arc(x, dy, 14 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
      // 4. Icon Emoji vật phẩm
      const icon = itemEmoji(drop.itemId);
      ctx.font = `${14 * this.dpr}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, x, dy);

      // 5. Nhãn tên & số lượng
      ctx.fillStyle = inRange ? '#fef3c7' : '#d4c5a9';
      ctx.font = `bold ${9.5 * this.dpr}px system-ui, sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.95)';
      ctx.shadowBlur = 4 * this.dpr;
      ctx.fillText(`${drop.nameVi} ×${drop.qty}`, x, dy + 20 * this.dpr);
      ctx.shadowBlur = 0;

      // Nếu trong tầm: có nhãn chỉ dẫn 'Chạm nhặt'
      if (inRange) {
        ctx.fillStyle = '#f59e0b';
        ctx.font = `bold ${8 * this.dpr}px system-ui, sans-serif`;
        ctx.fillText('▼ Chạm nhặt', x, dy - 18 * this.dpr);
      }

      ctx.restore();
    }
  }

  /**
   * HỆ THỐNG ĐA ĐỊA HÌNH THỜI TIỀN SỬ (Natural Prehistoric Terrain Engine):
   * LOẠI BỎ HOÀN TOÀN CÁC HÌNH OVAL / ELLIPSE ĐƠN ĐIỆU!
   * Địa hình được kiến tạo chân thực với:
   *   - 🌾 Đồng Cỏ Thực Thụ: Hàng trăm ngọn cỏ nhọn vươn cao, uốn lượn và đung đưa theo gió.
   *   - 🍀 Thảm Cỏ Ba Lá & Hoa Dại: Hoa chuông vàng, hoa đỏ cam nở rộ.
   *   - 🏜️ Bãi Đất Nung Khô Cằn: Rãnh nứt nẻ ngoằn ngoèo, bụi đất, cành khô (Không có cỏ).
   *   - 🪨 Bãi Đá Sa Thạch Góc Cạnh: Phiến đá nham thạch góc cạnh, nứt nẻ 3D (Không có cỏ).
   *   - 🌿 Rừng Dương Xỉ Cổ Đại: Tán lá dương xỉ xoè rộng nhiều nhánh con.
   *   - 🏖️ Dải Cát Bồi Sông Hồ: Vệt cát phù sa uốn lượn tự nhiên.
   */
          drawGround(
    w        ,
    h        ,
    palette                    ,
    input             ,
    project                                  ,
    pxPerMeter        ,
  )       {
    const { ctx } = this;

    // 1. Nền thổ nhưỡng tự nhiên (Rich Earth Base)
    ctx.fillStyle = palette.ground;
    ctx.fillRect(0, 0, w, h);

    const baseSpan = input.spanMeters ?? 420;
    const spanMeters = baseSpan / this.zoomFactor;
    // Kích thước bước ô lưới địa hình
    const tileSizeMeters = Math.max(25, Math.min(200, spanMeters / 16));
    const latStep = metersToLatDegrees(tileSizeMeters);
    const lonStep = metersToLonDegrees(tileSizeMeters, input.center.lat);

    const isDetailed = spanMeters < 1600;

    // Tính toán chính xác toạ độ vùng nhìn thấy thực tế trên màn hình (Viewport Culling Bounding Box cho 2.5D Tilt)
    const margin = 100 * this.dpr;
    const halfSpanLat = ((h / (2 * 0.68) + margin) / pxPerMeter) * metersToLatDegrees(1);
    const halfSpanLon = ((w / 2 + margin) / pxPerMeter) * metersToLonDegrees(1, input.center.lat);
    const centerPanLat = input.center.lat + (this.panY / (pxPerMeter * 0.68)) * metersToLatDegrees(1);
    const centerPanLon = input.center.lon - (this.panX / pxPerMeter) * metersToLonDegrees(1, input.center.lat);

    const minLatIdx = Math.floor((centerPanLat - halfSpanLat) / latStep);
    const maxLatIdx = Math.ceil((centerPanLat + halfSpanLat) / latStep);
    const minLonIdx = Math.floor((centerPanLon - halfSpanLon) / lonStep);
    const maxLonIdx = Math.ceil((centerPanLon + halfSpanLon) / lonStep);

    // 2. Duyệt chính xác các ô địa hình trong tầm mắt
    for (let latIdx = minLatIdx; latIdx <= maxLatIdx; latIdx++) {
      for (let lonIdx = minLonIdx; lonIdx <= maxLonIdx; lonIdx++) {
        const cellLat = (latIdx + 0.5) * latStep;
        const cellLon = (lonIdx + 0.5) * lonStep;

        const [gx, gy] = project({ lat: cellLat, lon: cellLon });
        if (gx < -margin || gx > w + margin || gy < -margin || gy > h + margin) continue;

        // Băm số nguyên siêu tốc (0 object/string allocations)
        const seed = (((latIdx * 73856093) ^ (lonIdx * 19349663) ^ 0x85ebca6b) >>> 0);
        let s = seed;
        const rng = () => {
          s = (s * 1664525 + 1013904223) >>> 0;
          return s / 4294967296;
        };

        // Phân loại địa hình ngẫu nhiên theo toạ độ
        const biomeType = seed % 5;

        if (biomeType === 0) {
          // 🏜️ VÙNG ĐẤT NUNG & RÃNH NỨT KHÔ CẰN (Hoàn toàn không có cỏ)
          const patchR = (20 + rng() * 24) * this.dpr;
          this.drawBareDirtPatch(gx, gy, patchR, palette.dirt, input.phase, seed);
          if (isDetailed) {
            this.drawCrackedEarth(gx, gy, patchR, input.phase, seed);
            this.drawPebbles(gx, gy, patchR * 0.7, input.phase, seed ^ 0xabc1);
          }
        } else if (biomeType === 1) {
          // 🪨 BÃI ĐÁ SA THẠCH & PHIẾN ĐÁ GÓC CẠNH (Hoàn toàn không có cỏ)
          const patchR = (18 + rng() * 22) * this.dpr;
          this.drawRockScree(gx, gy, patchR, palette.rock, input.phase, seed);
          if (isDetailed) {
            this.drawPebbles(gx, gy, patchR * 0.8, input.phase, seed ^ 0xfe42);
          }
        } else if (biomeType === 2) {
          // 🌾 ĐỒNG CỎ HOANG DÃ (Từng ngọn cỏ nhọn vươn cao & đung đưa theo gió)
          if (isDetailed) {
            const tuftCount = 3 + Math.floor(rng() * 4);
            for (let t = 0; t < tuftCount; t++) {
              const tx = gx + (rng() - 0.5) * 44 * this.dpr;
              const ty = gy + (rng() - 0.5) * 44 * this.dpr;
              const scale = 0.8 + rng() * 0.55;
              this.drawGrassTuft(tx, ty, scale, input.phase, seed + t * 43);
            }
            // Thảm cỏ 3 lá
            if (rng() > 0.45) {
              const cx = gx + (rng() - 0.5) * 30 * this.dpr;
              const cy = gy + (rng() - 0.5) * 30 * this.dpr;
              this.drawClover(cx, cy, 0.9, input.phase, seed ^ 0x55aa);
            }
          }
        } else if (biomeType === 3) {
          // 🌿 RỪNG DƯƠNG XỈ TIỀN SỬ
          if (isDetailed) {
            const fernCount = 2 + Math.floor(rng() * 2);
            for (let f = 0; f < fernCount; f++) {
              const fx = gx + (rng() - 0.5) * 38 * this.dpr;
              const fy = gy + (rng() - 0.5) * 38 * this.dpr;
              const scale = 0.85 + rng() * 0.5;
              this.drawFern(fx, fy, scale, input.phase, seed + f * 61);
            }
            // Đốm cỏ nhỏ ven rừng
            this.drawGrassTuft(gx, gy, 0.7, input.phase, seed ^ 0x77aa);
          }
        } else {
          // 🏖️ DẢI CÁT BỒI PHÙ SA & SỎI VEN SÔNG
          const patchR = (20 + rng() * 22) * this.dpr;
          this.drawSandPatch(gx, gy, patchR, palette.sand, input.phase, seed);
          if (isDetailed) {
            this.drawSandRipples(gx, gy, patchR * 0.75, input.phase, seed);
            this.drawPebbles(gx, gy, patchR * 0.5, input.phase, seed ^ 0x33dd);
          }
        }
      }
    }
  }

  /** Vẽ một bụi cỏ thực tế với 5-8 ngọn cỏ nhọn đung đưa theo gió và hoa dại. */
          drawGrassTuft(
    x        ,
    y        ,
    scale        ,
    phase       ,
    seed        ,
  )       {
    const { ctx } = this;
    const rng = createRng(seed);
    const bladeCount = 5 + Math.floor(rng() * 4);

    const baseColor = phase === 'night' ? '#0d1a10' : phase === 'evening' ? '#223310' : '#234a16';
    const tipColor = phase === 'night' ? '#1c301f' : phase === 'evening' ? '#5a6e22' : '#65a30d';

    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = tipColor;
    ctx.lineWidth = Math.max(1.1 * this.dpr, 1.6 * scale * this.dpr);

    ctx.beginPath();
    // Vẽ gộp các ngọn cỏ nhọn trong một path duy nhất (chiều cao thấp vừa vặn, không che khuất tầm nhìn)
    for (let b = 0; b < bladeCount; b++) {
      const bRng = createRng(seed + b * 17);
      const height = (4.2 + bRng() * 4.0) * scale * this.dpr;
      const spread = (b - (bladeCount - 1) / 2) * (2.0 * scale * this.dpr);
      const windSway = Math.sin(this.tick / 15 + (x + b * 12) * 0.03) * (1.8 * scale * this.dpr);
      const tipX = x + spread * 1.2 + windSway;
      const tipY = y - height;

      ctx.moveTo(x + spread * 0.35, y);
      ctx.quadraticCurveTo(x + spread * 0.6 + windSway * 0.4, y - height * 0.55, tipX, tipY);
    }
    ctx.stroke();

    // Hoa dại nhỏ li ti nở trên thảm cỏ
    if (phase !== 'night' && rng() > 0.6) {
      const flowerColor = rng() > 0.5 ? '#f59e0b' : '#ef4444';
      const fHeight = (5.5 + rng() * 3.5) * scale * this.dpr;
      const fSway = Math.sin(this.tick / 15 + x * 0.03) * (1.8 * scale * this.dpr);
      const fx = x + fSway;
      const fy = y - fHeight;

      // Cánh hoa
      ctx.fillStyle = flowerColor;
      ctx.beginPath();
      ctx.arc(fx, fy, 1.6 * scale * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Nhuỵ vàng
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(fx, fy, 0.7 * scale * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /** Vẽ cành lá dương xỉ tiền sử với các nhánh lá con xoè rộng thấp sát đất. */
          drawFern(
    x        ,
    y        ,
    scale        ,
    phase       ,
    seed        ,
  )       {
    const { ctx } = this;
    const rng = createRng(seed);
    const fernColor = phase === 'night' ? '#142518' : phase === 'evening' ? '#3f571b' : '#4d7c0f';

    ctx.save();
    ctx.strokeStyle = fernColor;
    ctx.fillStyle = fernColor;
    ctx.lineWidth = 1.2 * this.dpr;
    ctx.lineCap = 'round';

    const frondCount = 3 + Math.floor(rng() * 2);
    for (let f = 0; f < frondCount; f++) {
      const angle = -Math.PI * 0.5 + (f - (frondCount - 1) / 2) * 0.45;
      const len = (6.5 + rng() * 4.5) * scale * this.dpr;
      const endX = x + Math.cos(angle) * len;
      const endY = y + Math.sin(angle) * len;

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + (endX - x) * 0.5 + 1.5 * this.dpr, y + (endY - y) * 0.5, endX, endY);
      ctx.stroke();

      // Nhánh lá con 2 bên sống lá
      const pairs = 3;
      for (let p = 1; p <= pairs; p++) {
        const t = p / (pairs + 1);
        const px = x + (endX - x) * t;
        const py = y + (endY - y) * t;
        const leafLen = (2.6 - p * 0.45) * scale * this.dpr;

        ctx.fillRect(px - leafLen, py - 0.8 * this.dpr, leafLen * 2, 1.4 * this.dpr);
      }
    }

    ctx.restore();
  }

  /** Rãnh nứt đất nung tiền sử khô cằn. */
          drawCrackedEarth(
    x        ,
    y        ,
    r        ,
    phase       ,
    seed        ,
  )       {
    const { ctx } = this;
    const rng = createRng(seed);

    ctx.save();
    ctx.strokeStyle = phase === 'night' ? 'rgba(5, 4, 3, 0.6)' : 'rgba(25, 17, 10, 0.45)';
    ctx.lineWidth = 1.2 * this.dpr;
    ctx.lineCap = 'round';

    const cracks = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < cracks; i++) {
      let cx = x + (rng() - 0.5) * r * 0.8;
      let cy = y + (rng() - 0.5) * r * 0.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let s = 0; s < 3; s++) {
        cx += (rng() - 0.5) * 8 * this.dpr;
        cy += (rng() - 0.5) * 8 * this.dpr;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  /** Sỏi đá tự nhiên rải rác với bóng đổ 3D. */
          drawPebbles(
    x        ,
    y        ,
    r        ,
    phase       ,
    seed        ,
  )       {
    const { ctx } = this;
    const rng = createRng(seed);
    const count = 3 + Math.floor(rng() * 4);

    ctx.save();
    for (let i = 0; i < count; i++) {
      const px = x + (rng() - 0.5) * r * 1.5;
      const py = y + (rng() - 0.5) * r * 1.2;
      const s = (1.5 + rng() * 2.2) * this.dpr;

      // Bóng đổ
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(px + 0.8 * this.dpr, py + 1.2 * this.dpr, s * 1.2, s * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Viên sỏi
      ctx.fillStyle = phase === 'night' ? '#232724' : rng() > 0.5 ? '#78716c' : '#a8a29e';
      ctx.beginPath();
      ctx.ellipse(px, py, s, s * 0.7, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Bãi đá nham thạch sa thạch nứt góc cạnh. */
          drawRockOutcrop(
    x        ,
    y        ,
    r        ,
    phase       ,
    seed        ,
  )       {
    const { ctx } = this;
    const rng = createRng(seed);

    ctx.save();
    // Khối phiến đá chính
    ctx.fillStyle = phase === 'night' ? '#171a17' : '#444844';
    ctx.strokeStyle = phase === 'night' ? '#0c0d0c' : '#222522';
    ctx.lineWidth = 1.4 * this.dpr;

    const corners = 5;
    ctx.beginPath();
    for (let c = 0; c < corners; c++) {
      const ang = (c / corners) * Math.PI * 2;
      const rad = r * (0.6 + rng() * 0.4);
      const rx = x + Math.cos(ang) * rad;
      const ry = y + Math.sin(ang) * rad * 0.7;
      if (c === 0) ctx.moveTo(rx, ry);
      else ctx.lineTo(rx, ry);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  /** Gợn sóng gió trên dải cát phù sa. */
          drawSandRipples(
    x        ,
    y        ,
    r        ,
    phase       ,
    seed        ,
  )       {
    const { ctx } = this;
    const rng = createRng(seed);

    ctx.save();
    ctx.strokeStyle = phase === 'night' ? 'rgba(10, 8, 6, 0.4)' : 'rgba(120, 95, 45, 0.35)';
    ctx.lineWidth = 1.2 * this.dpr;

    for (let i = 0; i < 3; i++) {
      const ry = y + (i - 1) * 7 * this.dpr;
      const rx = x + (rng() - 0.5) * 10 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(rx - r * 0.6, ry);
      ctx.quadraticCurveTo(rx, ry - 2 * this.dpr, rx + r * 0.6, ry);
      ctx.stroke();
    }

    ctx.restore();
  }

  /** Mảng đất nung / đất đỏ hoang dã tự nhiên hữu cơ (không dùng ellipse). */
          drawBareDirtPatch(
    x        ,
    y        ,
    r        ,
    color        ,
    phase       ,
    seed        ,
  )       {
    const { ctx } = this;
    const rng = createRng(seed);
    const pts = 8;

    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i <= pts; i++) {
      const ang = (i / pts) * Math.PI * 2;
      const dist = r * (0.75 + rng() * 0.45);
      const px = x + Math.cos(ang) * dist;
      const py = y + Math.sin(ang) * (dist * 0.75);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Phiến đá sa thạch góc cạnh nhấp nhô (không dùng ellipse). */
          drawRockScree(
    x        ,
    y        ,
    r        ,
    color        ,
    phase       ,
    seed        ,
  )       {
    const { ctx } = this;
    const rng = createRng(seed);

    ctx.save();
    // 1. Mảng sa thạch chính
    ctx.fillStyle = color;
    ctx.beginPath();
    const pts = 6;
    for (let i = 0; i <= pts; i++) {
      const ang = (i / pts) * Math.PI * 2;
      const dist = r * (0.7 + rng() * 0.5);
      const px = x + Math.cos(ang) * dist;
      const py = y + Math.sin(ang) * (dist * 0.7);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // 2. Vết nứt vát đá 3D
    ctx.strokeStyle = phase === 'night' ? '#080a08' : '#1e211e';
    ctx.lineWidth = 1.4 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.4, y - r * 0.2);
    ctx.lineTo(x + r * 0.1, y + r * 0.1);
    ctx.lineTo(x + r * 0.5, y - r * 0.1);
    ctx.stroke();

    ctx.restore();
  }

  /** Thảm cỏ ba lá tự nhiên (Clover Botanicals). */
          drawClover(
    x        ,
    y        ,
    scale        ,
    phase       ,
    seed        ,
  )       {
    const { ctx } = this;
    const cloverColor = phase === 'night' ? '#102415' : phase === 'evening' ? '#3d5218' : '#4d7c0f';

    ctx.save();
    ctx.fillStyle = cloverColor;

    // 3 Cánh lá hình trái tim
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2 - Math.PI / 2;
      const lx = x + Math.cos(ang) * 4 * scale * this.dpr;
      const ly = y + Math.sin(ang) * 4 * scale * this.dpr;
      ctx.beginPath();
      ctx.arc(lx, ly, 2.5 * scale * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /** Vệt cát bồi phù sa hữu cơ (không dùng ellipse). */
          drawSandPatch(
    x        ,
    y        ,
    r        ,
    color        ,
    phase       ,
    seed        ,
  )       {
    const { ctx } = this;
    const rng = createRng(seed);
    const pts = 7;

    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i <= pts; i++) {
      const ang = (i / pts) * Math.PI * 2;
      const dist = r * (0.8 + rng() * 0.4);
      const px = x + Math.cos(ang) * dist;
      const py = y + Math.sin(ang) * (dist * 0.65);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Lưới ô 200 m vẽ thành lối mòn đất hữu cơ mịn màng trong không gian 2.5D. */
          drawTrailGrid(
    w        ,
    h        ,
    pxPerMeter        ,
    palette                    ,
    center        ,
  )       {
    const { ctx } = this;
    const cellPxX = 200 * pxPerMeter;
    const cellPxY = 200 * pxPerMeter * 0.68;
    if (cellPxX < 24) return;

    const latStep = metersToLatDegrees(200);
    const lonStep = metersToLonDegrees(200, center.lat);
    const offsetX = (((center.lon / lonStep) % 1) + 1) % 1;
    const offsetY = (((center.lat / latStep) % 1) + 1) % 1;

    ctx.strokeStyle = palette.trail;
    ctx.lineWidth = Math.max(1.8 * this.dpr, 3.5 * this.dpr);
    ctx.lineCap = 'round';
    const minI = Math.floor((-w / 2 - this.panX) / cellPxX) - 2;
    const maxI = Math.ceil((w / 2 - this.panX) / cellPxX) + 2;
    const minJ = Math.floor((-h / 2 - this.panY) / cellPxY) - 2;
    const maxJ = Math.ceil((h / 2 - this.panY) / cellPxY) + 2;

    for (let i = minI; i <= maxI; i++) {
      const x = w / 2 + (i - offsetX) * cellPxX + this.panX;
      this.wobbleLine(x, -50, x, h + 50, cellPxX * 0.05, hashSeed('vx', i));
    }
    for (let j = minJ; j <= maxJ; j++) {
      const y = h / 2 + (j + offsetY) * cellPxY + this.panY;
      this.wobbleLine(-50, y, w + 50, y, cellPxY * 0.05, hashSeed('hz', j));
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Vẽ các dòng sông lớn tự nhiên chảy qua Hà Nội:
   * 1. Sông Hồng ("Hồng Hà Đại Long")
   * 2. Sông Đuống ("Thiên Đức Giang")
   * 3. Sông Tô Lịch ("Tô Lịch Cổ Thần Khê")
   * 4. Sông Đáy ("Đáy Giang Tiền Sử")
   */
          drawNaturalRivers(
    project                                  ,
    pxPerMeter        ,
    phase       ,
  )       {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Màu nước sông thời tiền sử
    const riverColor = phase === 'night' ? '#0e2b36' : phase === 'evening' ? '#155e75' : '#0891b2';
    const sandColor = phase === 'night' ? '#292524' : phase === 'evening' ? '#b45309' : '#eab308';

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const river of NATURAL_RIVERS) {
      const projected = river.points.map((p) => project(p));
      const riverWidthPx = Math.max(12 * this.dpr, river.widthMeters * pxPerMeter);

      // 1. Dải bãi bồi / bờ cát vàng ven sông
      ctx.strokeStyle = sandColor;
      ctx.lineWidth = riverWidthPx * 1.35;
      ctx.beginPath();
      ctx.moveTo(projected[0][0], projected[0][1]);
      for (let i = 1; i < projected.length; i++) {
        ctx.lineTo(projected[i][0], projected[i][1]);
      }
      ctx.stroke();

      // 2. Lòng sông nước xanh ngọc
      ctx.strokeStyle = riverColor;
      ctx.lineWidth = riverWidthPx;
      ctx.beginPath();
      ctx.moveTo(projected[0][0], projected[0][1]);
      for (let i = 1; i < projected.length; i++) {
        ctx.lineTo(projected[i][0], projected[i][1]);
      }
      ctx.stroke();

      // 3. Gợn sóng & vệt nước trôi lững lờ theo dòng chảy
      const waveAlpha = 0.3 + 0.2 * Math.sin(this.tick / 10);
      ctx.strokeStyle = `rgba(224, 242, 254, ${waveAlpha})`;
      ctx.lineWidth = Math.max(1.8 * this.dpr, riverWidthPx * 0.12);
      ctx.setLineDash([14 * this.dpr, 20 * this.dpr]);
      ctx.lineDashOffset = -this.tick * 0.8 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(projected[0][0], projected[0][1]);
      for (let i = 1; i < projected.length; i++) {
        ctx.lineTo(projected[i][0], projected[i][1]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }

    ctx.restore();
  }

          wobbleLine(x1        , y1        , x2        , y2        , amp        , seed        )       {
    const { ctx } = this;
    const rng = createRng(seed);
    const steps = 10;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const jitter = (rng() - 0.5) * amp;
      const nx = x1 + (x2 - x1) * t + (y2 - y1 === 0 ? 0 : jitter);
      const ny = y1 + (y2 - y1) * t + (x2 - x1 === 0 ? 0 : jitter);
      ctx.lineTo(nx, ny);
    }
    ctx.stroke();
  }

          drawFeature(
    feature            ,
    project                                  ,
    pxPerMeter        ,
    input             ,
  )       {
    const { ctx } = this;
    const [x, y] = project(feature);
    const isWater = feature.zone === 'water';
    const name = feature.nameVi;
    const fid = feature.id;

    // Phân loại địa điểm nhỏ (quán cafe, tiệm trà, tạp hoá, vịnh xe buýt, quán ăn...) vs địa điểm lớn (trường học, bệnh viện, hoàng thành, di tích...)
    const isSmallPoi =
      fid.includes('highlands') || name.includes('Highlands') ||
      name.includes('Phúc Long') || name.includes('The Coffee House') || name.includes('Cộng Trà') ||
      name.includes('Trà Quán') || name.includes('Trung Nguyên') || name.includes('Starbucks') ||
      name.includes('WinMart') || name.includes('Circle K') || name.includes('Tiệm Trao Đổi') ||
      fid.includes('bus') || name.includes('Vịnh Xén Hè') || name.includes('Điểm Dừng Xe Buýt') ||
      name.includes('Xe Buýt') || name.includes('Trạm Chờ Xe') || name.includes('Phở') ||
      name.includes('Bún') || name.includes('Bánh Cuốn') || name.includes('Pizza') ||
      name.includes('Haidilao') || name.includes('Gogi') || name.includes('Kichi') ||
      name.includes('Manwah') || name.includes('Kombo') || name.includes('Quán Ăn') ||
      name.includes('Mỏ Vàng') || name.includes('Mỏ Than') || name.includes('Mỏ Đất Sét') ||
      name.includes('Bãi Hươu');

    // Quán cafe & tiệm nhỏ có kích thước bằng 2/3 (66.7%) các địa điểm lớn như trường học, bệnh viện
    const typeScale = isWater ? 0.85 : (isSmallPoi ? 0.35 : 0.52);
    const minR = isSmallPoi ? 6.5 * this.dpr : 10 * this.dpr;
    const r = Math.max(minR, feature.radiusMeters * pxPerMeter * typeScale);
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Bỏ qua ngay nếu đối tượng nằm ngoài màn hình để giữ mượt mà 60 FPS
    if (x < -r - 100 * this.dpr || x > w + r + 100 * this.dpr ||
        y < -r - 100 * this.dpr || y > h + r + 100 * this.dpr) {
      return;
    }

    const seed = hashSeed(feature.id);
    const isActive = input.activePoiId === feature.id;

    ctx.save();

    // Phân loại cảnh quan đặc biệt
    if (fid === 'bd_05' || name.includes('Một Cột') || name.includes('Liên Hoa')) {
      // 🪷 LIÊN HOA CỔ TỰ (CHÙA MỘT CỘT)
      this.groundContactShadow(x, y, r * 0.9, seed);
      this.onePillarPagoda(x, y, r, seed);
    } else if (fid === 'bd_01' || name.includes('Hoàng Thành') || name.includes('Vương Thành')) {
      // 🏯 PHẾ TÍCH CỔ LOA VƯƠNG THÀNH (HOÀNG THÀNH THĂNG LONG & CỘT CỜ)
      this.groundContactShadow(x, y, r * 1.1, seed);
      this.hoangThanhCitadel(x, y, r, seed);
    } else if (fid === 'bd_03' || name.includes('Văn Miếu') || name.includes('Quốc Tử Giám')) {
      // 📜 THẦN ĐIỆN VĂN MIẾU QUỐC TỬ GIÁM
      this.groundContactShadow(x, y, r * 1.05, seed);
      this.templeOfLiterature(x, y, r, seed);
    } else if (fid === 'bd_02' || name.includes('Ba Đình') || name.includes('Lăng Bác')) {
      // 🏛️ THÁNH ĐỊA TRƯỞNG LÃO BA ĐÌNH (LĂNG BÁC)
      this.groundContactShadow(x, y, r * 1.1, seed);
      this.baDinhMausoleum(x, y, r, seed);
    } else if (fid === 'hk_06' || name.includes('Nhà Thờ') || name.includes('Tháp Thánh')) {
      // ⛪ CỔ THÁP ĐÁ THÁNH (NHÀ THỜ LỚN)
      this.groundContactShadow(x, y, r * 0.9, seed);
      this.ancientChurch(x, y, r, seed);
    } else if (fid.includes('highlands') || name.includes('Highlands')) {
      // ☕ QUÁN CÀ PHÊ HIGHLANDS COFFEE TIỀN SỬ
      this.groundContactShadow(x, y, r * 0.95, seed);
      this.highlandsCoffee(x, y, r, seed);
    } else if (name.includes('Phúc Long') || name.includes('The Coffee House') || name.includes('Cộng Trà') || name.includes('Trà Quán') || name.includes('Trung Nguyên')) {
      // 🍵 TRÀ QUÁN TIỀN SỬ (PHÚC LONG, THE COFFEE HOUSE, CỘNG...)
      this.groundContactShadow(x, y, r * 0.95, seed);
      this.teaHouse(x, y, r, seed);
    } else if (name.includes('WinMart') || name.includes('Circle K') || name.includes('Tiệm Trao Đổi')) {
      // 🏪 TIỆM TRAO ĐỔI VẬT PHẨM TIỀN SỬ (WINMART, CIRCLE K...)
      this.groundContactShadow(x, y, r * 0.95, seed);
      this.convenienceStore(x, y, r, seed);
    } else if (fid.includes('bus') || name.includes('Vịnh Xén Hè') || name.includes('Điểm Dừng Xe Buýt') || name.includes('Xe Buýt') || name.includes('Trạm Chờ Xe')) {
      // 🚌 VỊNH XÉN HÈ XE BUÝT / ĐIỂM DỪNG XE BUÝT
      this.groundContactShadow(x, y, r * 0.95, seed);
      this.busBay(x, y, r, seed);
    } else if (fid.includes('nhat_ban') || name.includes('Nhật Bản') || name.includes('Phù Tang')) {
      // ⛩️ TRƯỜNG NHẬT BẢN HÀ NỘI (BÍ CẢNH PHÙ TANG)
      this.groundContactShadow(x, y, r * 1.05, seed);
      this.japaneseSchool(x, y, r, seed);
    } else if (name.includes('Sun Square') || name.includes('Thái Dương')) {
      // ☀️ THÁI DƯƠNG CỰ THẠCH CUNG (SUN SQUARE)
      this.groundContactShadow(x, y, r * 1.1, seed);
      this.sunSquareMonolith(x, y, r, seed);
    } else if (name.includes('Cổ Mộ') || name.includes('Mai Dịch') || fid.includes('maidich')) {
      // 🪦 CỔ MỘ TIỀN NHÂN (NGHĨA TRANG MAI DỊCH)
      this.groundContactShadow(x, y, r * 0.95, seed);
      this.ancientTombs(x, y, r, seed);
    } else if (name.includes('Y Viện') || name.includes('Thảo Dược Viện') || name.includes('Bạch Mai') || name.includes('198')) {
      // 🌿 Y VIỆN THẢO DƯỢC
      this.groundContactShadow(x, y, r * 0.95, seed);
      this.healerLodge(x, y, r, seed);
    } else if (name.includes('Bí Cảnh Tri Thức') || name.includes('Thương Viện') || name.includes('Sư Viện') || name.includes('Học Viện')) {
      // 📜 ĐẠI BÍ CẢNH TRI THỨC / ĐẠI HỌC CỔ
      this.groundContactShadow(x, y, r * 0.95, seed);
      this.ancientAcademy(x, y, r, seed);
    } else if (name.includes('Đấu Trường') || name.includes('Mỹ Đình') || name.includes('Cung Điền Kinh')) {
      // 🏟️ ĐẤU TRƯỜNG QUÁI THÚ MỸ ĐÌNH
      this.groundContactShadow(x, y, r * 1.1, seed);
      this.ancientColosseum(x, y, r, seed);
    } else if (name.includes('Trạm Lữ Khách') || name.includes('Bến Xe') || name.includes('Lữ Điểm')) {
      // 🏕️ TRẠM DỪNG CHÂN LỮ KHÁCH (BẾN XE)
      this.groundContactShadow(x, y, r * 0.95, seed);
      this.travelersLodge(x, y, r, seed);
    } else if (name.includes('Vàng') || fid.includes('gold')) {
      // 🪙 MỎ VÀNG CỔ ĐẠI
      this.groundContactShadow(x, y, r * 0.9, seed);
      this.goldMine(x, y, r, seed);
    } else if (name.includes('Than') || name.includes('Quặng') || name.includes('Trầm Tích') || fid.includes('iron')) {
      // ⛏️ MỎ THAN & QUẶNG SẮT
      this.groundContactShadow(x, y, r * 0.9, seed);
      this.ironAndCoalMine(x, y, r, seed);
    } else if (name.includes('Hươu') || fid.includes('deer')) {
      // 🦌 BÃI HƯƠU SAO TIỀN SỬ
      this.groundContactShadow(x, y, r * 0.95, seed);
      this.deerGrove(x, y, r, seed);
    } else if (name.includes('Cự Mộc') || fid.startsWith('cl_')) {
      // 🌳 TUYẾN HUYẾT MẠCH CỰ MỘC CÁT LINH
      this.groundContactShadow(x, y, r * 0.95, seed);
      this.catLinhRoots(x, y, r, seed);
    } else if (name.includes('Đất Sét') || fid.includes('clay')) {
      // 🏺 MỎ ĐẤT SÉT VEN SÔNG
      this.groundContactShadow(x, y, r * 0.9, seed);
      this.clayDeposit(x, y, r, seed);
    } else if (name.includes('Tháp') || name.includes('Keangnam') || name.includes('Lotte') || name.includes('Dolphin') || name.includes('Discovery') || name.includes('Royal') || name.includes('Times')) {
      // 🗼 THẠCH TRỤ CHỌC TRỜI
      this.groundContactShadow(x, y, r * 0.85, seed);
      this.ancientTower(x, y, r, seed);
    } else if (name.includes('Long Cốt') || name.includes('Cầu')) {
      // 🐉 CẦU CỔ LONG CỐT
      this.groundContactShadow(x, y, r * 0.95, seed);
      this.ancientBridge(x, y, r, seed);
    } else {
      switch (feature.zone) {
        case 'water':
          if (feature.kind === 'procedural' || name.includes('Khe Nước') || name.includes('Mạch Nước') || name.includes('Hố Nước')) {
            // 💧 KHE NƯỚC NHỎ / MẠCH NƯỚC NGẦM THỦ TỤC
            this.smallStream(x, y, r, seed);
          } else if (feature.radiusMeters >= 180 || name.includes('Đại Hồ') || name.includes('Biển Hồ')) {
            // 🌊 ĐẠI HỒ KHỔNG LỒ THỰC TẾ (Hồ Tây, Suối Hai, Đồng Mô, Quan Sơn, Ocean Park...)
            this.greatLake(x, y, r, seed);
          } else {
            // 🏞️ HỒ NƯỚC VỪA & NHỎ THỰC TẾ (Hồ Gươm, Trúc Bạch, Nghĩa Đô, Thành Công, Giảng Võ...)
            this.pondOrLake(x, y, r, seed, fid);
          }
          break;
        case 'forest':
          // Vùng rừng rậm nhiệt đới có cây dừa & chuối rừng
          this.trees(x, y, r, seed);
          break;
        case 'merchant':
          // Tàn tích cự thạch phủ rêu
          this.groundContactShadow(x, y, r * 0.85, seed);
          this.ancientRuins(x, y, r, seed);
          break;
        default:
          this.crags(x, y, r * 0.75, seed);
      }
    }

    // 1. Vòng hào quang tương tác 2.5D và sóng radar khi nhân vật ở gần địa điểm
    if (isActive) {
      const pulse = 0.5 + 0.5 * Math.sin(this.tick / 8);
      ctx.save();
      ctx.strokeStyle = `rgba(245, 158, 11, ${0.5 + 0.45 * pulse})`;
      ctx.lineWidth = 2.2 * this.dpr;
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.35, r + 6 * this.dpr, (r + 6 * this.dpr) * 0.68, 0, 0, Math.PI * 2);
      ctx.stroke();

      const wave = ((this.tick * 0.8) % 36) / 36;
      ctx.strokeStyle = `rgba(251, 191, 36, ${0.55 * (1 - wave)})`;
      ctx.lineWidth = 1.4 * this.dpr;
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.35, r + wave * 18 * this.dpr, (r + wave * 18 * this.dpr) * 0.68, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Thẻ Tên Địa Điểm & Icon Phù Điêu Sang Trọng (Landmark Floating Pill Badge)
    const icon = this.getFeatureIcon(feature);
    const baseFontSize = isSmallPoi ? 8.2 : 9.8;
    const fontSize = Math.max(isSmallPoi ? 7.2 : 8.5, Math.min(isSmallPoi ? 9.5 : 11.2, baseFontSize * Math.pow(this.zoomFactor, 0.35))) * this.dpr;
    ctx.font = `bold ${fontSize}px 'Be Vietnam Pro', system-ui, sans-serif`;

    const text = `${icon} ${feature.nameVi}`;
    const textMetrics = ctx.measureText(text);
    const textW = textMetrics.width;
    const badgePadX = (isSmallPoi ? 5 : 6.5) * this.dpr;
    const badgePadY = (isSmallPoi ? 2.6 : 3.4) * this.dpr;
    const badgeW = textW + badgePadX * 2;
    const badgeH = fontSize + badgePadY * 2;
    const badgeX = x - badgeW / 2;
    const badgeY = y + r * 0.65 + (isSmallPoi ? 2 : 3) * this.dpr;

    ctx.save();
    // Bóng đổ của thẻ tên
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 5 * this.dpr;
    ctx.shadowOffsetY = 1.5 * this.dpr;

    // Nền thẻ sáp cổ điển bo góc
    ctx.fillStyle = isActive ? 'rgba(38, 26, 14, 0.96)' : 'rgba(20, 16, 12, 0.90)';
    ctx.strokeStyle = isActive ? '#f59e0b' : 'rgba(217, 151, 91, 0.55)';
    ctx.lineWidth = isActive ? 1.6 * this.dpr : 1.0 * this.dpr;

    ctx.beginPath();
    const rad = badgeH / 2;
    ctx.moveTo(badgeX + rad, badgeY);
    ctx.lineTo(badgeX + badgeW - rad, badgeY);
    ctx.arc(badgeX + badgeW - rad, badgeY + rad, rad, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(badgeX + rad, badgeY + badgeH);
    ctx.arc(badgeX + rad, badgeY + rad, rad, Math.PI / 2, Math.PI * 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

    // Chữ & Icon địa điểm
    ctx.fillStyle = isActive ? '#fef08a' : '#fef3c7';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, badgeY + badgeH / 2);

    // Nếu trong tầm tương tác: có nhãn phụ chỉ dẫn
    if (isActive) {
      ctx.fillStyle = '#f59e0b';
      ctx.font = `bold ${8 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
      ctx.fillText('▼ Chạm để mở', x, badgeY + badgeH + 7.5 * this.dpr);
    }
    ctx.restore();

    ctx.restore();
  }

  /** Biểu tượng Icon đặc trưng cho từng loại địa điểm / di tích. */
          getFeatureIcon(feature            )         {
    const name = feature.nameVi;
    const fid = feature.id;
    if (fid === 'bd_05' || name.includes('Một Cột') || name.includes('Liên Hoa')) return '🪷';
    if (fid === 'bd_01' || name.includes('Hoàng Thành') || name.includes('Vương Thành')) return '🏯';
    if (fid === 'bd_03' || name.includes('Văn Miếu') || name.includes('Quốc Tử Giám')) return '📜';
    if (fid === 'bd_02' || name.includes('Ba Đình') || name.includes('Lăng Bác')) return '🏛️';
    if (fid === 'hk_06' || name.includes('Nhà Thờ') || name.includes('Tháp Thánh')) return '⛪';
    if (fid.includes('highlands') || name.includes('Highlands') || name.includes('Cà phê')) return '☕';
    if (name.includes('Phúc Long') || name.includes('The Coffee House') || name.includes('Trà') || name.includes('Cộng')) return '🍵';
    if (name.includes('WinMart') || name.includes('Circle K') || name.includes('Tạp Hoá') || name.includes('Tiệm Trao Đổi')) return '🏪';
    if (fid.includes('bus') || name.includes('Xe Buýt') || name.includes('Bến Xe') || name.includes('Vịnh Xén Hè')) return '🚌';
    if (fid.includes('nhat_ban') || name.includes('Nhật Bản') || name.includes('Phù Tang')) return '⛩️';
    if (name.includes('Sun Square') || name.includes('Thái Dương')) return '☀️';
    if (name.includes('Cổ Mộ') || name.includes('Mai Dịch') || fid.includes('maidich')) return '🪦';
    if (name.includes('Y Viện') || name.includes('Thảo Dược') || name.includes('Bạch Mai') || name.includes('198')) return '🌿';
    if (name.includes('Học Viện') || name.includes('Tri Thức') || name.includes('Đại Học')) return '📜';
    if (name.includes('Đấu Trường') || name.includes('Mỹ Đình') || name.includes('Sân Vận Động')) return '🏟️';
    if (name.includes('Trạm Lữ Khách') || name.includes('Lữ Điểm')) return '🏕️';
    if (name.includes('Vàng') || fid.includes('gold')) return '🪙';
    if (name.includes('Than') || name.includes('Quặng') || name.includes('Sắt') || fid.includes('iron')) return '⛏️';
    if (name.includes('Hươu') || fid.includes('deer')) return '🦌';
    if (name.includes('Cự Mộc') || fid.startsWith('cl_')) return '🌳';
    if (name.includes('Đất Sét') || fid.includes('clay')) return '🏺';
    if (name.includes('Tháp') || name.includes('Keangnam') || name.includes('Lotte') || name.includes('Dolphin')) return '🗼';
    if (name.includes('Long Cốt') || name.includes('Cầu')) return '🐉';
    if (feature.zone === 'water') return '🏞️';
    if (feature.zone === 'forest') return '🌲';
    if (feature.zone === 'merchant') return '🏺';
    return '📍';
  }

  /** Bóng đổ mềm tiếp đất tự nhiên cho các công trình / địa danh trong không gian 2.5D. */
          groundContactShadow(x        , y        , r        , _seed        )       {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = 'rgba(10, 8, 5, 0.48)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.35, r * 0.95, r * 0.95 * 0.68, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Khe nước nhỏ / Mạch nước ngầm thủ tục (Chỉ vẽ rãnh suối nhỏ róc rách, không vẽ hồ to). */
          smallStream(x        , y        , r        , seed        )       {
    const { ctx } = this;
    const rng = createRng(seed ^ 0x9922);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Rãnh nước nhỏ uốn khúc
    const streamLen = Math.min(28 * this.dpr, r * 0.9);
    const sw = Math.max(3.5 * this.dpr, 5 * this.dpr);

    // 1. Viền đất ẩm ướt rêu phong
    ctx.strokeStyle = '#2d4016';
    ctx.lineWidth = sw + 4 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(x - streamLen, y - (rng() - 0.5) * 8 * this.dpr);
    ctx.quadraticCurveTo(x, y + (rng() - 0.5) * 12 * this.dpr, x + streamLen, y + (rng() - 0.5) * 8 * this.dpr);
    ctx.stroke();

    // 2. Mạch nước trong xanh
    ctx.strokeStyle = '#0891b2';
    ctx.lineWidth = sw;
    ctx.beginPath();
    ctx.moveTo(x - streamLen, y - (rng() - 0.5) * 8 * this.dpr);
    ctx.quadraticCurveTo(x, y + (rng() - 0.5) * 12 * this.dpr, x + streamLen, y + (rng() - 0.5) * 8 * this.dpr);
    ctx.stroke();

    // 3. Vài viên đá cuội nhỏ ven khe nước
    ctx.fillStyle = '#78716c';
    ctx.beginPath();
    ctx.arc(x - streamLen * 0.4, y + 4 * this.dpr, 2.2 * this.dpr, 0, Math.PI * 2);
    ctx.arc(x + streamLen * 0.5, y - 3 * this.dpr, 1.8 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    // 4. Bụi cỏ nước nhỏ
    ctx.fillStyle = '#84cc16';
    ctx.fillRect(x + 2 * this.dpr, y + 3 * this.dpr, 2 * this.dpr, 3.5 * this.dpr);

    ctx.restore();
  }

  /** Đại hồ khổng lồ (Hồ Tây, Suối Hai, Đồng Mô, Quan Sơn, Ocean Park...). */
          greatLake(x        , y        , r        , seed        )       {
    const { ctx } = this;
    const rng = createRng(seed ^ 0x4a7e);

    ctx.save();

    // 0. Bờ cát vàng phù sa và lòng đại hồ nước sâu
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.08, r * 0.88, 0, 0, Math.PI * 2);
    ctx.fill();

    const lakeGrad = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
    lakeGrad.addColorStop(0, '#083344');
    lakeGrad.addColorStop(0.65, '#0e7490');
    lakeGrad.addColorStop(1, '#06b6d4');
    ctx.fillStyle = lakeGrad;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // 1. Các dải bọt sóng trắng vỗ bờ nhấp nhô
    const wavePulse = Math.sin(this.tick / 14);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 2.2 * this.dpr;
    ctx.lineCap = 'round';

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + wavePulse * 0.1;
      const dist = r * (0.8 + wavePulse * 0.06);
      const wx = x + Math.cos(angle) * dist;
      const wy = y + Math.sin(angle) * dist * 0.82;
      ctx.beginPath();
      ctx.arc(wx, wy, 10 * this.dpr, 0, Math.PI);
      ctx.stroke();
    }

    // 2. Gợn sóng lăn tăn phản quang xanh lơ sâu
    ctx.strokeStyle = 'rgba(165, 243, 252, 0.65)';
    ctx.lineWidth = 1.6 * this.dpr;
    for (let i = 0; i < 8; i++) {
      const ox = (rng() - 0.5) * r * 0.85;
      const oy = (rng() - 0.5) * r * 0.65;
      const wlen = (10 + rng() * 16) * this.dpr;
      ctx.beginPath();
      ctx.moveTo(x + ox - wlen, y + oy);
      ctx.quadraticCurveTo(x + ox, y + oy - 2.5 * this.dpr, x + ox + wlen, y + oy);
      ctx.stroke();
    }

    // 3. Chiếc bè gỗ buồm neo ven bờ nước
    const raftX = x + r * 0.45;
    const raftY = y - r * 0.35;

    ctx.fillStyle = 'rgba(6, 78, 59, 0.5)';
    ctx.beginPath();
    ctx.ellipse(raftX, raftY + 4 * this.dpr, 14 * this.dpr, 6 * this.dpr, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1.2 * this.dpr;
    for (let k = 0; k < 4; k++) {
      ctx.fillRect(raftX - 10 * this.dpr, raftY - 6 * this.dpr + k * 3.5 * this.dpr, 20 * this.dpr, 3 * this.dpr);
    }

    // Cột buồm
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 2 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(raftX, raftY + 2 * this.dpr);
    ctx.lineTo(raftX - 2 * this.dpr, raftY - 12 * this.dpr);
    ctx.stroke();

    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.moveTo(raftX - 2 * this.dpr, raftY - 12 * this.dpr);
    ctx.lineTo(raftX + 8 * this.dpr, raftY - 5 * this.dpr);
    ctx.lineTo(raftX - 1 * this.dpr, raftY - 2 * this.dpr);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /** Hồ nước vừa & nhỏ thực tế (Hồ Gươm, Trúc Bạch, Nghĩa Đô, Thành Công, Giảng Võ, Triều Khúc...). */
          pondOrLake(x        , y        , r        , seed        , fid        )       {
    const { ctx } = this;
    const rng = createRng(seed ^ 0x3311);

    ctx.save();

    // 0. Bờ kè rêu xanh tự nhiên và lòng hồ nước
    ctx.fillStyle = '#2d4016';
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.06, r * 0.86, 0, 0, Math.PI * 2);
    ctx.fill();

    const pondGrad = ctx.createRadialGradient(x, y, r * 0.1, x, y, r * 0.88);
    pondGrad.addColorStop(0, '#0e7490');
    pondGrad.addColorStop(0.7, '#0891b2');
    pondGrad.addColorStop(1, '#06b6d4');
    ctx.fillStyle = pondGrad;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // 1. Gợn sóng lăn tăn nhẹ nhàng
    ctx.strokeStyle = 'rgba(207, 250, 254, 0.55)';
    ctx.lineWidth = 1.2 * this.dpr;
    for (let i = 0; i < 4; i++) {
      const ox = (rng() - 0.5) * r * 0.7;
      const oy = (rng() - 0.5) * r * 0.5;
      const wlen = (6 + rng() * 10) * this.dpr;
      ctx.beginPath();
      ctx.moveTo(x + ox - wlen, y + oy);
      ctx.quadraticCurveTo(x + ox, y + oy - 1.8 * this.dpr, x + ox + wlen, y + oy);
      ctx.stroke();
    }

    // 2. Hoa sen & lá sen xanh nổi trên mặt hồ
    for (let s = 0; s < 3; s++) {
      const lx = x + (rng() - 0.5) * r * 0.6;
      const ly = y + (rng() - 0.5) * r * 0.45;

      // Lá sen tròn
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.ellipse(lx, ly, 3.5 * this.dpr, 2.2 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Nụ hoa sen hồng
      if (s === 0) {
        ctx.fillStyle = '#f472b6';
        ctx.beginPath();
        ctx.arc(lx + 1 * this.dpr, ly - 1.5 * this.dpr, 1.5 * this.dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Nếu là Hồ Gươm (id: 'p1') -> Vẽ gò Tháp Rùa cự thạch mini ở trung tâm!
    if (fid === 'p1') {
      // Gò đất xanh giữa hồ
      ctx.fillStyle = '#166534';
      ctx.beginPath();
      ctx.ellipse(x, y, 7 * this.dpr, 4 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tháp Rùa đá cổ kính
      ctx.fillStyle = '#78716c';
      ctx.fillRect(x - 2.5 * this.dpr, y - 6 * this.dpr, 5 * this.dpr, 5 * this.dpr);
      ctx.fillStyle = '#dc2626'; // Mái ngói đỏ cổ
      ctx.fillRect(x - 3.5 * this.dpr, y - 7.5 * this.dpr, 7 * this.dpr, 1.8 * this.dpr);
    }

    ctx.restore();
  }

  /** Rừng nhiệt đới: Cây dừa cao vút uốn lượn, bóng dừa đổ dài và bụi chuối rừng lá to. */
          trees(x        , y        , r        , seed        )       {
    const { ctx } = this;
    const rng = createRng(seed ^ 0x5eed);
    const count = Math.max(3, Math.min(8, Math.round(r / (14 * this.dpr))));

    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = Math.sqrt(rng()) * r * 0.72;
      const tx = x + Math.cos(angle) * dist;
      const ty = y + Math.sin(angle) * dist * 0.82;
      const size = (12 + rng() * 10) * this.dpr;

      ctx.save();

      // 1. Bóng cây dừa đổ dài theo góc nghiêng mặt trời (hướng tây bắc)
      ctx.fillStyle = 'rgba(15, 23, 10, 0.45)';
      ctx.beginPath();
      ctx.ellipse(tx - size * 0.6, ty + size * 0.4, size * 0.85, size * 0.32, -0.35, 0, Math.PI * 2);
      ctx.fill();

      // 2. Bụi chuối rừng lá to ở gốc cây
      ctx.fillStyle = '#365314';
      for (let b = 0; b < 4; b++) {
        const bAngle = (b / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(
          tx + Math.cos(bAngle) * size * 0.28,
          ty + Math.sin(bAngle) * size * 0.18 + size * 0.1,
          size * 0.35,
          size * 0.16,
          bAngle,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }

      // 3. Thân cây dừa cong vút màu nâu xám có ngấn thân
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 3.2 * this.dpr;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty + size * 0.1);
      ctx.quadraticCurveTo(tx + size * 0.25, ty - size * 0.6, tx + size * 0.12, ty - size * 1.3);
      ctx.stroke();

      const topX = tx + size * 0.12;
      const topY = ty - size * 1.3;

      // 4. Chùm quả dừa nách lá
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.arc(topX - 1.5 * this.dpr, topY + 1 * this.dpr, 1.8 * this.dpr, 0, Math.PI * 2);
      ctx.arc(topX + 1.8 * this.dpr, topY + 1.5 * this.dpr, 1.8 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // 5. Tán lá dừa xoè 6 nhánh 3D uốn cong rực rỡ
      for (let f = 0; f < 6; f++) {
        const fAngle = (f / 6) * Math.PI * 2 + (this.tick / 80) * 0.1;
        const fLen = size * 0.85;
        const endX = topX + Math.cos(fAngle) * fLen;
        const endY = topY + Math.sin(fAngle) * fLen * 0.75;
        const midX = topX + Math.cos(fAngle) * fLen * 0.5;
        const midY = topY + Math.sin(fAngle) * fLen * 0.4 - 3 * this.dpr;

        ctx.strokeStyle = f % 2 === 0 ? '#4d7c0f' : '#65a30d';
        ctx.lineWidth = 2.4 * this.dpr;
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.quadraticCurveTo(midX, midY, endX, endY);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  /** Tàn tích thương nhân: Cổng Cự Thạch Hùng Vĩ & Rương Báu Hoàng Kim. */
          ancientRuins(x        , y        , r        , seed        )       {
    const { ctx } = this;
    ctx.save();

    const baseW = Math.max(36 * this.dpr, r * 1.3);
    const baseH = Math.max(24 * this.dpr, r * 0.75);

    // 1. Khuôn viên sân lát đá phiến cự thạch (Megastone Courtyard)
    ctx.fillStyle = '#292524';
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.8 * this.dpr;
    ctx.beginPath();
    ctx.roundRect(x - baseW / 2, y - baseH * 0.35, baseW, baseH, 6 * this.dpr);
    ctx.fill();
    ctx.stroke();

    // 2. Cổng Cự Thạch Đá Nguyên Khối (Stonehenge / Angkor Arch)
    const span = baseW * 0.32;
    const colW = Math.max(5 * this.dpr, baseW * 0.14);
    const colH = Math.max(16 * this.dpr, r * 0.65);

    // Cột đá trái & phải
    ctx.fillStyle = '#57534e';
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.4 * this.dpr;
    ctx.fillRect(x - span - colW / 2, y - colH, colW, colH);
    ctx.strokeRect(x - span - colW / 2, y - colH, colW, colH);

    ctx.fillRect(x + span - colW / 2, y - colH, colW, colH);
    ctx.strokeRect(x + span - colW / 2, y - colH, colW, colH);

    // Thanh xà đá ngang trên đỉnh
    ctx.fillStyle = '#78716c';
    ctx.fillRect(x - span * 1.4, y - colH - 6 * this.dpr, span * 2.8, 6 * this.dpr);
    ctx.strokeRect(x - span * 1.4, y - colH - 6 * this.dpr, span * 2.8, 6 * this.dpr);

    // Rêu phong phủ chân cột
    ctx.fillStyle = '#15803d';
    ctx.fillRect(x - span - colW / 2, y - 3 * this.dpr, colW, 3 * this.dpr);
    ctx.fillRect(x + span - colW / 2, y - 3 * this.dpr, colW, 3 * this.dpr);

    // 3. Rương báu vật thổ tộc mở nắp phát quang hoàng kim
    const chestW = 12 * this.dpr;
    const chestH = 8 * this.dpr;
    const pulse = 0.7 + 0.3 * Math.sin(this.tick / 6 + seed);

    // Vầng hào quang vàng kim rực sáng từ rương
    const goldGlow = ctx.createRadialGradient(x, y - 4 * this.dpr, 1, x, y - 4 * this.dpr, 14 * this.dpr);
    goldGlow.addColorStop(0, `rgba(250, 204, 21, ${0.9 * pulse})`);
    goldGlow.addColorStop(0.6, `rgba(217, 119, 6, ${0.35 * pulse})`);
    goldGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = goldGlow;
    ctx.beginPath();
    ctx.arc(x, y - 4 * this.dpr, 14 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    // Rương gỗ bọc đồng
    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 1.2 * this.dpr;
    ctx.fillRect(x - chestW / 2, y - chestH, chestW, chestH);
    ctx.strokeRect(x - chestW / 2, y - chestH, chestW, chestH);

    // Lõi kho báu vàng rực bên trong
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(x - chestW * 0.35, y - chestH + 1 * this.dpr, chestW * 0.7, 3 * this.dpr);

    // 4. Đuốc thương nhân bập bùng
    const flamePulse = 0.7 + 0.3 * Math.sin(this.tick / 5);
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.arc(x, y - colH - 8 * this.dpr, 3.5 * flamePulse * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** Mỏ vàng cổ đại: Mỏm đá hoa cương với các vỉa quặng vàng rực sáng óng ánh, lấp lánh 3D. */
          goldMine(x        , y        , r        , seed        )       {
    const { ctx } = this;
    const rng = createRng(seed ^ 0x901d);
    ctx.save();

    // Bóng mỏ vàng
    ctx.fillStyle = 'rgba(20, 14, 6, 0.55)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.3, r * 0.9, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Khối đá hoa cương trung tâm
    ctx.fillStyle = '#451a03';
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 1.6 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7, y + r * 0.2);
    ctx.lineTo(x - r * 0.3, y - r * 0.6);
    ctx.lineTo(x + r * 0.4, y - r * 0.5);
    ctx.lineTo(x + r * 0.7, y + r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Vỉa quặng vàng óng ánh & tinh thể phát sáng
    const pulse = 0.7 + 0.3 * Math.sin(this.tick / 8 + seed);
    for (let i = 0; i < 5; i++) {
      const gx = x + (rng() - 0.5) * r * 0.9;
      const gy = y + (rng() - 0.5) * r * 0.6;
      const gSize = (3 + rng() * 4) * this.dpr;

      // Vầng sáng vàng
      const glow = ctx.createRadialGradient(gx, gy, 1, gx, gy, gSize * 2.5);
      glow.addColorStop(0, `rgba(250, 204, 21, ${0.8 * pulse})`);
      glow.addColorStop(1, 'rgba(234, 179, 8, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(gx, gy, gSize * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Khối vàng
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(gx, gy, gSize, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /** Mỏ than & quặng sắt: Vách đá trầm tích nhiều tầng với xỉ than và cuốc đá. */
          ironAndCoalMine(x        , y        , r        , seed        )       {
    const { ctx } = this;
    const rng = createRng(seed ^ 0x1f04);
    ctx.save();

    // Bóng đổ
    ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.3, r * 0.85, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Các tầng vách đá trầm tích
    for (let l = 0; l < 3; l++) {
      const ly = y - r * 0.4 + l * r * 0.3;
      ctx.fillStyle = l % 2 === 0 ? '#1e293b' : '#334155';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.4 * this.dpr;
      ctx.fillRect(x - r * 0.6 + l * 4 * this.dpr, ly, r * 1.2 - l * 8 * this.dpr, r * 0.25);
      ctx.strokeRect(x - r * 0.6 + l * 4 * this.dpr, ly, r * 1.2 - l * 8 * this.dpr, r * 0.25);
    }

    // Các khối than đen và quặng sắt ánh kim
    for (let i = 0; i < 4; i++) {
      const ox = x + (rng() - 0.5) * r * 0.8;
      const oy = y + (rng() - 0.5) * r * 0.4;
      ctx.fillStyle = i % 2 === 0 ? '#020617' : '#94a3b8';
      ctx.fillRect(ox, oy, 4.5 * this.dpr, 4.5 * this.dpr);
    }

    ctx.restore();
  }

  /** Bãi hươu sao tiền sử: Đồng cỏ hoa với đàn hươu sao gặm cỏ. */
          deerGrove(x        , y        , r        , seed        )       {
    const { ctx } = this;
    ctx.save();

    const baseW = Math.max(36 * this.dpr, r * 1.3);
    const baseH = Math.max(24 * this.dpr, r * 0.75);

    // 1. Thảm cỏ đồi êm dịu nơi hươu gặm cỏ
    ctx.fillStyle = '#1e380e';
    ctx.strokeStyle = '#142609';
    ctx.lineWidth = 1.6 * this.dpr;
    ctx.beginPath();
    ctx.roundRect(x - baseW / 2, y - baseH * 0.35, baseW, baseH, 8 * this.dpr);
    ctx.fill();
    ctx.stroke();

    // Vẽ 2 chú hươu sao 3D
    const deers = [
      { dx: x - r * 0.25, dy: y - r * 0.1, scale: 1 },
      { dx: x + r * 0.3, dy: y + r * 0.15, scale: 0.85 },
    ];

    for (const d of deers) {
      const bob = Math.sin(this.tick / 15 + seed) * 1.5 * this.dpr;
      const hx = d.dx;
      const hy = d.dy + bob;
      const s = d.scale * this.dpr;

      // Bóng hươu
      ctx.fillStyle = 'rgba(20, 35, 10, 0.45)';
      ctx.beginPath();
      ctx.ellipse(hx, hy + 8 * s, 8 * s, 3.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // Thân hươu màu nâu vàng đốm trắng
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.ellipse(hx, hy, 7 * s, 4.5 * s, -0.15, 0, Math.PI * 2);
      ctx.fill();

      // Đốm trắng trên lưng
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.arc(hx - 2 * s, hy - 1.5 * s, 1 * s, 0, Math.PI * 2);
      ctx.arc(hx + 2 * s, hy - 1 * s, 1 * s, 0, Math.PI * 2);
      ctx.fill();

      // Cổ và đầu hươu
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.ellipse(hx + 6 * s, hy - 5 * s, 2.5 * s, 4 * s, 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Cặp sừng gạc hươu sao
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1.2 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(hx + 6 * s, hy - 7 * s);
      ctx.lineTo(hx + 7 * s, hy - 12 * s);
      ctx.lineTo(hx + 9 * s, hy - 10 * s);
      ctx.moveTo(hx + 6 * s, hy - 7 * s);
      ctx.lineTo(hx + 4 * s, hy - 11 * s);
      ctx.stroke();

      // Chân hươu
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.5 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(hx - 4 * s, hy + 3 * s);
      ctx.lineTo(hx - 4 * s, hy + 8 * s);
      ctx.moveTo(hx + 3 * s, hy + 3 * s);
      ctx.lineTo(hx + 3 * s, hy + 8 * s);
      ctx.stroke();
    }

    ctx.restore();
  }

  /** Tuyến Cát Linh: Rễ cây đại thụ khổng lồ uốn lượn như cầu rồng trên không. */
          catLinhRoots(x        , y        , r        , seed        )       {
    const { ctx } = this;
    ctx.save();

    // Bóng đổ đại thụ
    ctx.fillStyle = 'rgba(30, 10, 50, 0.45)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.35, r * 0.9, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cầu rễ cây cổ thụ khổng lồ uốn lượn
    ctx.strokeStyle = '#581c87';
    ctx.lineWidth = 6 * this.dpr;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7, y + r * 0.2);
    ctx.quadraticCurveTo(x, y - r * 0.6, x + r * 0.7, y + r * 0.1);
    ctx.stroke();

    ctx.strokeStyle = '#7e22ce';
    ctx.lineWidth = 3.5 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7, y + r * 0.2);
    ctx.quadraticCurveTo(x, y - r * 0.6, x + r * 0.7, y + r * 0.1);
    ctx.stroke();

    // Trụ rễ cây cắm xuống đất
    ctx.fillStyle = '#3b0764';
    ctx.fillRect(x - 3 * this.dpr, y - r * 0.3, 6 * this.dpr, r * 0.6);

    // Quả cầu rễ phát quang màu ngọc bích trên đỉnh
    const pulse = 0.7 + 0.3 * Math.sin(this.tick / 7 + seed);
    const glow = ctx.createRadialGradient(x, y - r * 0.35, 2 * this.dpr, x, y - r * 0.35, 12 * this.dpr);
    glow.addColorStop(0, `rgba(168, 85, 247, ${0.9 * pulse})`);
    glow.addColorStop(1, 'rgba(126, 34, 206, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.35, 12 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** Thạch trụ chọc trời (Keangnam / Lotte). */
          ancientTower(x        , y        , r        , seed        )       {
    const { ctx } = this;
    ctx.save();

    // Bóng trụ
    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.4, y + r * 0.35, r * 0.8, r * 0.3, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Tháp đá nhiều tầng cao vút
    const tw = r * 0.5;
    const th = r * 1.5;

    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2 * this.dpr;
    ctx.fillRect(x - tw / 2, y - th + r * 0.3, tw, th);
    ctx.strokeRect(x - tw / 2, y - th + r * 0.3, tw, th);

    // Tầng tháp thu nhỏ dần
    ctx.fillStyle = '#64748b';
    ctx.fillRect(x - tw * 0.35, y - th - th * 0.3 + r * 0.3, tw * 0.7, th * 0.3);
    ctx.strokeRect(x - tw * 0.35, y - th - th * 0.3 + r * 0.3, tw * 0.7, th * 0.3);

    // Điểm sáng ngọc trên đỉnh tháp
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(x, y - th - th * 0.3 + r * 0.25, 3 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** Cầu Cổ Long Cốt (Cầu Long Biên). */
          ancientBridge(x        , y        , r        , seed        )       {
    const { ctx } = this;
    ctx.save();

    // Vòm cầu xương rồng cổ
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 4 * this.dpr;
    ctx.beginPath();
    ctx.arc(x, y + r * 0.2, r * 0.7, Math.PI, Math.PI * 2);
    ctx.stroke();

    // Các nhịp xương ziczac
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2 * this.dpr;
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const ang = Math.PI + (i / steps) * Math.PI;
      const bx = x + Math.cos(ang) * r * 0.7;
      const by = y + r * 0.2 + Math.sin(ang) * r * 0.7;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx, y + r * 0.2);
      ctx.stroke();
    }

    ctx.restore();
  }

  /** Liên Hoa Cổ Tự (Chùa Một Cột) - Đài sen gỗ nổi trên trụ đá giữa đầm súng linh thiêng. */
          onePillarPagoda(x        , y        , r        , seed        )       {
    const { ctx } = this;
    ctx.save();

    // 1. Trụ đá nguyên khối cắm giữa đầm nước
    ctx.fillStyle = '#475569';
    ctx.fillRect(x - 4 * this.dpr, y - 8 * this.dpr, 8 * this.dpr, 16 * this.dpr);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5 * this.dpr;
    ctx.strokeRect(x - 4 * this.dpr, y - 8 * this.dpr, 8 * this.dpr, 16 * this.dpr);

    // 2. Đài sen gỗ sơn son thếp vàng vươn 4 phía
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.moveTo(x - 14 * this.dpr, y - 8 * this.dpr);
    ctx.lineTo(x + 14 * this.dpr, y - 8 * this.dpr);
    ctx.lineTo(x + 18 * this.dpr, y - 18 * this.dpr);
    ctx.lineTo(x - 18 * this.dpr, y - 18 * this.dpr);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. Mái ngói đao cong cổ kính
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.moveTo(x - 22 * this.dpr, y - 18 * this.dpr);
    ctx.quadraticCurveTo(x, y - 26 * this.dpr, x + 22 * this.dpr, y - 18 * this.dpr);
    ctx.lineTo(x, y - 30 * this.dpr);
    ctx.closePath();
    ctx.fill();

    // 4. Quả cầu ngọc sen phát sáng trên chóp
    const pulse = 0.6 + 0.4 * Math.sin(this.tick / 7 + seed);
    ctx.fillStyle = `rgba(250, 204, 21, ${pulse})`;
    ctx.beginPath();
    ctx.arc(x, y - 31 * this.dpr, 3.5 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    // Vài cánh hoa sen hồng trôi quanh trụ đá
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + seed;
      const lx = x + Math.cos(ang) * (r * 0.45);
      const ly = y + 4 * this.dpr + Math.sin(ang) * (r * 0.25);
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.ellipse(lx, ly, 4 * this.dpr, 2.5 * this.dpr, ang, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /** Phế Tích Cổ Loa Vương Thành (Hoàng Thành Thăng Long & Cột Cờ). */
          hoangThanhCitadel(x        , y        , r        , seed        )       {
    const { ctx } = this;
    ctx.save();

    // 1. Tường thành gạch vồ đất nung cổ nhiều tầng
    const tw = r * 0.9;
    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 2 * this.dpr;

    // Tầng thành đế rộng
    ctx.fillRect(x - tw / 2, y - 6 * this.dpr, tw, 14 * this.dpr);
    ctx.strokeRect(x - tw / 2, y - 6 * this.dpr, tw, 14 * this.dpr);

    // Cửa vòm cuốn đá ở cổng thành
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.arc(x, y + 8 * this.dpr, 6 * this.dpr, Math.PI, Math.PI * 2);
    ctx.fill();

    // Tầng lầu vọng đài thứ 2
    ctx.fillStyle = '#b45309';
    ctx.fillRect(x - tw * 0.35, y - 18 * this.dpr, tw * 0.7, 12 * this.dpr);
    ctx.strokeRect(x - tw * 0.35, y - 18 * this.dpr, tw * 0.7, 12 * this.dpr);

    // Mái ngói đỏ vút cong
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(x - tw * 0.45, y - 18 * this.dpr);
    ctx.lineTo(x + tw * 0.45, y - 18 * this.dpr);
    ctx.lineTo(x + tw * 0.25, y - 24 * this.dpr);
    ctx.lineTo(x - tw * 0.25, y - 24 * this.dpr);
    ctx.closePath();
    ctx.fill();

    // Cột cờ Thần Long uy nghiêm
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(x, y - 24 * this.dpr);
    ctx.lineTo(x, y - 36 * this.dpr);
    ctx.stroke();

    // Lá cờ thổ tộc rực đỏ bay trong gió
    const flagWave = Math.sin(this.tick / 6) * 3 * this.dpr;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(x, y - 36 * this.dpr);
    ctx.lineTo(x + 14 * this.dpr, y - 32 * this.dpr + flagWave);
    ctx.lineTo(x, y - 28 * this.dpr);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /** Thần Điện Văn Miếu Quốc Tử Giám - Cổ Các Khai Trí & Rùa Đội Bia Đá. */
          templeOfLiterature(x        , y        , r        , seed        )       {
    const { ctx } = this;
    ctx.save();

    // 1. Đài Khuê Văn Các bằng gỗ lim đỏ son
    const w = r * 0.65;
    ctx.fillStyle = '#991b1b';
    ctx.strokeStyle = '#450a0a';
    ctx.lineWidth = 2 * this.dpr;

    // 4 Cột trụ gỗ vuông
    ctx.fillRect(x - w / 2, y - 10 * this.dpr, w, 12 * this.dpr);
    ctx.strokeRect(x - w / 2, y - 10 * this.dpr, w, 12 * this.dpr);

    // Tầng gác trên với cửa sổ tròn Thái Cực
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(x - w * 0.4, y - 22 * this.dpr, w * 0.8, 12 * this.dpr);
    ctx.strokeRect(x - w * 0.4, y - 22 * this.dpr, w * 0.8, 12 * this.dpr);

    // Cửa tròn Khôi Tinh Tỏa Sáng
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(x, y - 16 * this.dpr, 4 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    // 2 Tầng mái chồng diêm cong vút
    ctx.fillStyle = '#7c2d12';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.6, y - 22 * this.dpr);
    ctx.lineTo(x + w * 0.6, y - 22 * this.dpr);
    ctx.lineTo(x, y - 29 * this.dpr);
    ctx.closePath();
    ctx.fill();

    // 2. Thần Quy Đá (Rùa thần đội bia đá) bên cạnh
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, y + 4 * this.dpr, 8 * this.dpr, 5 * this.dpr, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bia đá xanh cắm trên lưng rùa
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(x + w * 0.5 - 3 * this.dpr, y - 6 * this.dpr, 6 * this.dpr, 10 * this.dpr);

    ctx.restore();
  }

  /** Thánh Địa Trưởng Lão Ba Đình (Lăng Bác) - Thần Điện Đá Khối Uy Nghi. */
          baDinhMausoleum(x        , y        , r        , seed        )       {
    const { ctx } = this;
    ctx.save();

    // 1. Thềm đá hoa cương xám khổng lồ
    const w = r * 0.85;
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2 * this.dpr;

    ctx.fillRect(x - w / 2, y - 8 * this.dpr, w, 14 * this.dpr);
    ctx.strokeRect(x - w / 2, y - 8 * this.dpr, w, 14 * this.dpr);

    // Hàng cột thạch trụ trang nghiêm
    ctx.fillStyle = '#64748b';
    const cols = 5;
    for (let c = 0; c < cols; c++) {
      const cx = x - w * 0.35 + (c / (cols - 1)) * (w * 0.7);
      ctx.fillRect(cx - 2.5 * this.dpr, y - 22 * this.dpr, 5 * this.dpr, 14 * this.dpr);
    }

    // Mái ngọc đá khối thượng tầng
    ctx.fillStyle = '#475569';
    ctx.fillRect(x - w * 0.45, y - 26 * this.dpr, w * 0.9, 5 * this.dpr);
    ctx.strokeRect(x - w * 0.45, y - 26 * this.dpr, w * 0.9, 5 * this.dpr);

    // Hàng rặng tre xanh ngọc 2 bên điện thờ
    ctx.fillStyle = '#15803d';
    for (let t = 0; t < 3; t++) {
      ctx.fillRect(x - w / 2 - 8 * this.dpr + t * 2.5 * this.dpr, y - 18 * this.dpr, 2 * this.dpr, 24 * this.dpr);
      ctx.fillRect(x + w / 2 + 3 * this.dpr + t * 2.5 * this.dpr, y - 18 * this.dpr, 2 * this.dpr, 24 * this.dpr);
    }

    ctx.restore();
  }

  /** Cổ Tháp Đá Thánh (Nhà Thờ Lớn) - Tháp Đá Đôi Huyền Bí. */
          ancientChurch(x        , y        , r        , seed        )       {
    const { ctx } = this;
    ctx.save();

    const w = r * 0.65;
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2 * this.dpr;

    // 2 Tháp chuông đá nhọn 2 bên
    ctx.fillRect(x - w / 2, y - 28 * this.dpr, w * 0.32, 34 * this.dpr);
    ctx.strokeRect(x - w / 2, y - 28 * this.dpr, w * 0.32, 34 * this.dpr);

    ctx.fillRect(x + w / 2 - w * 0.32, y - 28 * this.dpr, w * 0.32, 34 * this.dpr);
    ctx.strokeRect(x + w / 2 - w * 0.32, y - 28 * this.dpr, w * 0.32, 34 * this.dpr);

    // Khối giữa với Cửa Sổ Hoa Hồng Đá
    ctx.fillStyle = '#475569';
    ctx.fillRect(x - w * 0.2, y - 18 * this.dpr, w * 0.4, 24 * this.dpr);
    ctx.strokeRect(x - w * 0.2, y - 18 * this.dpr, w * 0.4, 24 * this.dpr);

    // Cửa hoa hồng phát quang
    const pulse = 0.7 + 0.3 * Math.sin(this.tick / 9);
    ctx.fillStyle = `rgba(56, 189, 248, ${0.9 * pulse})`;
    ctx.beginPath();
    ctx.arc(x, y - 10 * this.dpr, 4.5 * this.dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Thái Dương Cự Thạch Cung (Sun Square - Lê Đức Thọ). */
          sunSquareMonolith(x        , y        , r        , seed        )       {
    const { ctx } = this;
    ctx.save();

    // Bóng đổ
    ctx.fillStyle = 'rgba(30, 20, 10, 0.55)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.35, r * 0.9, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // 4 Cột thạch trụ hoàng kim vuông vức
    const s = r * 0.28;
    ctx.fillStyle = '#ca8a04';
    ctx.strokeStyle = '#854d0e';
    ctx.lineWidth = 1.8 * this.dpr;

    const corners = [
      [-r * 0.35, -r * 0.35],
      [r * 0.35, -r * 0.35],
      [-r * 0.35, r * 0.25],
      [r * 0.35, r * 0.25],
    ];
    for (const [cx, cy] of corners) {
      ctx.fillRect(x + cx - s / 2, y + cy - s * 1.5, s, s * 1.8);
      ctx.strokeRect(x + cx - s / 2, y + cy - s * 1.5, s, s * 1.8);
    }

    // Đĩa Mặt Trời Thái Dương phát sáng ở trung tâm
    const pulse = 0.7 + 0.3 * Math.sin(this.tick / 6 + seed);
    const sunGlow = ctx.createRadialGradient(x, y - r * 0.2, 2 * this.dpr, x, y - r * 0.2, r * 0.5);
    sunGlow.addColorStop(0, `rgba(250, 204, 21, ${0.95 * pulse})`);
    sunGlow.addColorStop(0.6, `rgba(234, 88, 12, ${0.4 * pulse})`);
    sunGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.2, r * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(x, y - r * 0.2, 5 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** Cổ Mộ Tiền Nhân (Nghĩa Trang Mai Dịch). */
          ancientTombs(x        , y        , r        , seed        )       {
    const { ctx } = this;
    const rng = createRng(seed ^ 0x7788);
    ctx.save();

    // Gò đất cỏ cổ kính u tịch
    ctx.fillStyle = '#3f3f46';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.1, r * 0.85, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Các bia đá tiền nhân rêu phong xếp tầng
    for (let i = 0; i < 5; i++) {
      const bx = x + (rng() - 0.5) * r * 1.1;
      const by = y + (rng() - 0.5) * r * 0.6;
      const bw = (5 + rng() * 4) * this.dpr;
      const bh = (10 + rng() * 8) * this.dpr;

      // Bóng bia đá
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(bx, by + 2 * this.dpr, bw * 1.2, 3 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Thân bia đá xám trầm
      ctx.fillStyle = '#71717a';
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 1.2 * this.dpr;
      ctx.beginPath();
      ctx.roundRect(bx - bw / 2, by - bh, bw, bh, [3 * this.dpr, 3 * this.dpr, 0, 0]);
      ctx.fill();
      ctx.stroke();

      // Hoa dạ yến thảo dại màu tím nở quanh chân mộ
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.arc(bx + 3 * this.dpr, by, 1.5 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /** Y Viện Thảo Dược (Bệnh viện 198, Bạch Mai, Việt Đức...). */
          healerLodge(x        , y        , r        , seed        )       {
    const { ctx } = this;
    ctx.save();

    const baseW = Math.max(34 * this.dpr, r * 1.25);
    const baseH = Math.max(22 * this.dpr, r * 0.7);

    // 1. Khuôn viên sân vườn thảo mộc lát đá cuội tự nhiên (Clear Herb Garden Base)
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.6 * this.dpr;
    ctx.beginPath();
    ctx.roundRect(x - baseW / 2, y - baseH * 0.35, baseW, baseH, 6 * this.dpr);
    ctx.fill();
    ctx.stroke();

    // 2. Thần Điện Y Quán Thảo Mộc - Gỗ Lim & Mái Lá Thuốc Xanh Biếc
    const houseW = baseW * 0.7;
    const houseH = Math.max(18 * this.dpr, r * 0.55);

    // Sàn gỗ nâng cao
    ctx.fillStyle = '#78350f';
    ctx.fillRect(x - houseW / 2, y - houseH * 0.4, houseW, houseH * 0.4);

    // Mái điện thảo mộc hình nón nhiều tầng xanh ngọc
    ctx.fillStyle = '#15803d';
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.4 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(x, y - houseH - 12 * this.dpr);
    ctx.lineTo(x - houseW * 0.6, y - houseH * 0.35);
    ctx.lineTo(x + houseW * 0.6, y - houseH * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. Biểu tượng Chữ Thập Y Dược ngọc bích phát sáng
    const pulse = 0.7 + 0.3 * Math.sin(this.tick / 7 + seed);
    const crossGlow = ctx.createRadialGradient(x, y - houseH * 0.7, 1, x, y - houseH * 0.7, 8 * this.dpr);
    crossGlow.addColorStop(0, `rgba(74, 222, 128, ${0.95 * pulse})`);
    crossGlow.addColorStop(1, 'rgba(34, 197, 94, 0)');
    ctx.fillStyle = crossGlow;
    ctx.beginPath();
    ctx.arc(x, y - houseH * 0.7, 8 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#86efac';
    ctx.fillRect(x - 2 * this.dpr, y - houseH * 0.7 - 5 * this.dpr, 4 * this.dpr, 10 * this.dpr);
    ctx.fillRect(x - 5 * this.dpr, y - houseH * 0.7 - 2 * this.dpr, 10 * this.dpr, 4 * this.dpr);

    // 4. Lò sắc thuốc cổ bằng đồng bốc làn khói ngọc bích
    const calX = x + houseW * 0.38;
    const calY = y + 2 * this.dpr;
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.arc(calX, calY, 4 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    // Khói thuốc bay lên lượn lờ
    const smokeY = calY - (this.tick % 40) * 0.3 * this.dpr;
    ctx.fillStyle = 'rgba(134, 239, 172, 0.45)';
    ctx.beginPath();
    ctx.arc(calX + Math.sin(this.tick / 8) * 2 * this.dpr, smokeY, 3 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** Đại Bí Cảnh Tri Thức (ĐH Thương Mại, ĐH Quốc Gia, Sư Phạm, Bách Khoa...). */
          ancientAcademy(x        , y        , r        , seed        )       {
    const { ctx } = this;
    ctx.save();

    // 1. Khuôn viên sân thềm đá sa thạch rộng lớn (Courtyard Base Plaza)
    const baseW = Math.max(40 * this.dpr, r * 1.35);
    const baseH = Math.max(26 * this.dpr, r * 0.8);

    // Sân lát đá hoa cương cổ viền gạch nung
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2 * this.dpr;
    ctx.beginPath();
    ctx.roundRect(x - baseW / 2, y - baseH * 0.35, baseW, baseH, 5 * this.dpr);
    ctx.fill();
    ctx.stroke();

    // Lớp bậc thềm đá cẩm thạch tầng 2
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(x - baseW * 0.44, y - baseH * 0.45, baseW * 0.88, baseH * 0.7, 4 * this.dpr);
    ctx.fill();
    ctx.stroke();

    // Bậc tam cấp chính diện
    ctx.fillStyle = '#64748b';
    for (let k = 0; k < 3; k++) {
      ctx.fillRect(x - 10 * this.dpr - k * 2 * this.dpr, y + 2 * this.dpr + k * 3 * this.dpr, (20 + k * 4) * this.dpr, 2.6 * this.dpr);
    }

    // 2. Thần Điện Tri Thức - 4 Cột Trụ Cẩm Thạch & Khung Điện
    const hallW = baseW * 0.68;
    const hallH = Math.max(22 * this.dpr, r * 0.65);
    const colCount = 4;
    for (let c = 0; c < colCount; c++) {
      const cx = x - hallW * 0.42 + (c / (colCount - 1)) * (hallW * 0.84);
      // Thân cột cẩm thạch
      ctx.fillStyle = '#94a3b8';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.2 * this.dpr;
      ctx.fillRect(cx - 3 * this.dpr, y - hallH, 6 * this.dpr, hallH);
      ctx.strokeRect(cx - 3 * this.dpr, y - hallH, 6 * this.dpr, hallH);
      // Đầu cột chạm khắc vàng kim
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(cx - 4 * this.dpr, y - hallH - 2 * this.dpr, 8 * this.dpr, 3 * this.dpr);
    }

    // Tường sau thần điện màu xanh lam thẫm
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(x - hallW * 0.36, y - hallH + 2 * this.dpr, hallW * 0.72, hallH - 3 * this.dpr);

    // 3. Tầng Mái Đao 2 Tầng Chồng Diêm Xanh Ngọc Hoàng Gia
    // Tầng mái 1 (dưới)
    const roof1W = hallW * 1.35;
    ctx.fillStyle = '#2563eb';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.6 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(x - roof1W / 2, y - hallH);
    ctx.quadraticCurveTo(x, y - hallH - 5 * this.dpr, x + roof1W / 2, y - hallH);
    ctx.lineTo(x + roof1W * 0.38, y - hallH - 9 * this.dpr);
    ctx.quadraticCurveTo(x, y - hallH - 12 * this.dpr, x - roof1W * 0.38, y - hallH - 9 * this.dpr);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cổ diêm tầng 2
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(x - hallW * 0.28, y - hallH - 14 * this.dpr, hallW * 0.56, 6 * this.dpr);

    // Tầng mái thượng đỉnh vút cong
    const roof2W = hallW * 0.95;
    ctx.fillStyle = '#1e40af';
    ctx.beginPath();
    ctx.moveTo(x - roof2W / 2, y - hallH - 14 * this.dpr);
    ctx.quadraticCurveTo(x, y - hallH - 20 * this.dpr, x + roof2W / 2, y - hallH - 14 * this.dpr);
    ctx.lineTo(x, y - hallH - 26 * this.dpr);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Chóp ngọc tri thức trên đỉnh
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(x, y - hallH - 27 * this.dpr, 4 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    // 4. Cuộn Thư Tịch / Bia Đá Cổ Phát Quang Lam Ngọc
    const pulse = 0.7 + 0.3 * Math.sin(this.tick / 8 + seed);
    const scrollGlow = ctx.createRadialGradient(x, y - hallH * 0.45, 1, x, y - hallH * 0.45, 14 * this.dpr);
    scrollGlow.addColorStop(0, `rgba(96, 165, 250, ${0.95 * pulse})`);
    scrollGlow.addColorStop(0.6, `rgba(59, 130, 246, ${0.4 * pulse})`);
    scrollGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = scrollGlow;
    ctx.beginPath();
    ctx.arc(x, y - hallH * 0.45, 14 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    // Cuộn thư tịch màu vàng kim
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(x - 6 * this.dpr, y - hallH * 0.45 - 4 * this.dpr, 12 * this.dpr, 8 * this.dpr);
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 1.2 * this.dpr;
    ctx.strokeRect(x - 6 * this.dpr, y - hallH * 0.45 - 4 * this.dpr, 12 * this.dpr, 8 * this.dpr);

    // 5. Đèn đuốc ngọc 2 bên thềm điện
    for (const side of [-1, 1]) {
      const tx = x + side * (baseW * 0.38);
      const ty = y - baseH * 0.15;
      ctx.fillStyle = '#475569';
      ctx.fillRect(tx - 2 * this.dpr, ty - 8 * this.dpr, 4 * this.dpr, 10 * this.dpr);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(tx, ty - 9 * this.dpr, 3 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /** Đấu Trường Quái Thú Tiền Sử (Sân Mỹ Đình, Cung Điền Kinh...). */
          ancientColosseum(x        , y        , r        , seed        )       {
    const { ctx } = this;
    ctx.save();

    const baseW = Math.max(42 * this.dpr, r * 1.3);
    const baseH = Math.max(28 * this.dpr, r * 0.85);

    // 1. Khán đài cự thạch 3 tầng vòng cung giật cấp
    // Tầng 1: Vành đai sa thạch ngoài
    ctx.fillStyle = '#451a03';
    ctx.strokeStyle = '#291002';
    ctx.lineWidth = 2 * this.dpr;
    ctx.beginPath();
    ctx.ellipse(x, y, baseW * 0.5, baseH * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Tầng 2: Khán đài bậc thang
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.ellipse(x, y, baseW * 0.42, baseH * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tầng 3: Sân cát giác đấu màu vàng sa mạc
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.ellipse(x, y, baseW * 0.3, baseH * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. 4 Cổng tháp cự thạch hùng dũng tại 4 hướng
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2;
      const px = x + Math.cos(ang) * (baseW * 0.46);
      const py = y + Math.sin(ang) * (baseH * 0.46);

      // Tháp đá
      ctx.fillStyle = '#92400e';
      ctx.fillRect(px - 3.5 * this.dpr, py - 6 * this.dpr, 7 * this.dpr, 9 * this.dpr);

      // Ngọn đuốc đấu trường bập bùng
      const flamePulse = 0.7 + 0.3 * Math.sin(this.tick / 6 + i);
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(px, py - 7 * this.dpr, (3.5 * flamePulse) * this.dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(px, py - 7 * this.dpr, 1.8 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /** Trạm Lữ Khách Tiền Sử (Bến Xe Mỹ Đình, Giáp Bát...). */
          travelersLodge(x        , y        , r        , seed        )       {
    const { ctx } = this;
    ctx.save();

    const baseW = Math.max(38 * this.dpr, r * 1.25);
    const baseH = Math.max(24 * this.dpr, r * 0.75);

    // 1. Sân đất nện sạch sẽ & đống củi sưởi (Courtyard Foundation)
    ctx.fillStyle = '#3a2412';
    ctx.strokeStyle = '#241407';
    ctx.lineWidth = 1.6 * this.dpr;
    ctx.beginPath();
    ctx.roundRect(x - baseW / 2, y - baseH * 0.35, baseW, baseH, 6 * this.dpr);
    ctx.fill();
    ctx.stroke();

    // 2. Đại Đình Nhà Rông Lữ Khách
    const houseW = baseW * 0.65;
    const houseH = Math.max(22 * this.dpr, r * 0.65);

    // Mái nhà rông cao vút hình lưỡi rìu tiền sử
    ctx.fillStyle = '#c2410c';
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 1.8 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(x, y - houseH - 12 * this.dpr);
    ctx.quadraticCurveTo(x + houseW * 0.3, y - houseH * 0.5, x + houseW * 0.5, y + 2 * this.dpr);
    ctx.lineTo(x - houseW * 0.5, y + 2 * this.dpr);
    ctx.quadraticCurveTo(x - houseW * 0.3, y - houseH * 0.5, x, y - houseH - 12 * this.dpr);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cửa đình đón khách màu gỗ nâu sẫm
    ctx.fillStyle = '#431407';
    ctx.beginPath();
    ctx.arc(x, y + 2 * this.dpr, 5 * this.dpr, Math.PI, Math.PI * 2);
    ctx.fill();

    // Đèn lồng tre phát sáng ấm áp
    const pulse = 0.7 + 0.3 * Math.sin(this.tick / 9 + seed);
    ctx.fillStyle = `rgba(251, 191, 36, ${pulse})`;
    ctx.beginPath();
    ctx.arc(x, y - 6 * this.dpr, 3.5 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** Mỏ Đất Sét Ven Sông (Clay Deposit). */
          clayDeposit(x        , y        , r        , seed        )       {
    const { ctx } = this;
    ctx.save();

    const baseW = Math.max(34 * this.dpr, r * 1.2);
    const baseH = Math.max(22 * this.dpr, r * 0.7);

    // 1. Mảng phù sa bồi mịn màng ven sông
    ctx.fillStyle = '#7c2d12';
    ctx.strokeStyle = '#431407';
    ctx.lineWidth = 1.6 * this.dpr;
    ctx.beginPath();
    ctx.roundRect(x - baseW / 2, y - baseH * 0.35, baseW, baseH, 8 * this.dpr);
    ctx.fill();
    ctx.stroke();

    // 2. Vỉa đất sét đỏ nung & các vại gốm cổ đang phơi
    ctx.fillStyle = '#c2410c';
    ctx.beginPath();
    ctx.ellipse(x, y, baseW * 0.35, baseH * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Các chum gốm đất nung
    for (const [ox, oy] of [[-7, -3], [5, 2], [-2, 4]]) {
      ctx.fillStyle = '#ea580c';
      ctx.strokeStyle = '#7c2d12';
      ctx.lineWidth = 1 * this.dpr;
      ctx.beginPath();
      ctx.arc(x + ox * this.dpr, y + oy * this.dpr, 3.2 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  /** Mỏm đá nham nhở đính khoáng sản lấp lánh. */
          crags(x        , y        , r        , seed        )       {
    const { ctx } = this;
    const rng = createRng(seed ^ 0x3344);
    const count = Math.max(3, Math.min(6, Math.round(r / (10 * this.dpr))));

    ctx.save();
    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = rng() * r * 0.7;
      const cx = x + Math.cos(angle) * dist;
      const cy = y + Math.sin(angle) * dist * 0.8;
      const w = (6 + rng() * 6) * this.dpr;
      const h = (5 + rng() * 5) * this.dpr;

      ctx.fillStyle = '#57534e';
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 1.2 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(cx - w, cy + h * 0.4);
      ctx.lineTo(cx - w * 0.2, cy - h);
      ctx.lineTo(cx + w, cy + h * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Điểm sáng khoáng thạch
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(cx, cy - h * 0.2, 1.4 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** ☕ Quán Cà Phê Highlands Coffee Tiền Sử (Highlands Coffee - Sun Square, Hàm Nghi, Mỹ Đình). */
          highlandsCoffee(x        , y        , r        , seed        )       {
    const { ctx } = this;
    ctx.save();

    const baseW = Math.max(34 * this.dpr, r * 1.3);
    const baseH = Math.max(22 * this.dpr, r * 0.75);

    // 1. Sân gỗ & gạch đỏ booc-đô sang trọng (Courtyard Foundation)
    ctx.fillStyle = '#881337';
    ctx.strokeStyle = '#4c0519';
    ctx.lineWidth = 1.6 * this.dpr;
    ctx.beginPath();
    ctx.roundRect(x - baseW / 2, y - baseH * 0.35, baseW, baseH, 6 * this.dpr);
    ctx.fill();
    ctx.stroke();

    // 2. Quầy Cà Phê Highlands Mái Đỏ Thẫm
    const shopW = baseW * 0.6;
    const shopH = Math.max(16 * this.dpr, r * 0.55);

    // Thân nhà gỗ sẫm
    ctx.fillStyle = '#451a03';
    ctx.fillRect(x - shopW / 2, y - shopH * 0.5, shopW, shopH * 0.5);

    // Mái ngói đỏ Highlands vát cong
    ctx.fillStyle = '#be123c';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.2 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(x - shopW * 0.65, y - shopH * 0.5);
    ctx.lineTo(x + shopW * 0.65, y - shopH * 0.5);
    ctx.lineTo(x + shopW * 0.45, y - shopH - 6 * this.dpr);
    ctx.lineTo(x - shopW * 0.45, y - shopH - 6 * this.dpr);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. Biểu tượng Tách Cà Phê bốc khói vàng kim
    const cupX = x;
    const cupY = y - shopH * 0.75;
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(cupX, cupY, 4.5 * this.dpr, 0, Math.PI);
    ctx.fill();

    // Khói cà phê thơm bốc lên
    const smokeOffset = (this.tick % 30) * 0.25 * this.dpr;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.arc(cupX + Math.sin(this.tick / 6) * 1.5 * this.dpr, cupY - 4 * this.dpr - smokeOffset, 1.8 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    // 4. Chiếc Dù Che Màu Đỏ Highlands bên hiên
    const umbX = x + baseW * 0.32;
    const umbY = y - 2 * this.dpr;
    // Cán dù
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 1.5 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(umbX, umbY + 6 * this.dpr);
    ctx.lineTo(umbX, umbY - 8 * this.dpr);
    ctx.stroke();
    // Tán dù đỏ
    ctx.fillStyle = '#9f1239';
    ctx.beginPath();
    ctx.arc(umbX, umbY - 8 * this.dpr, 7 * this.dpr, Math.PI, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** 🚌 Vịnh Xén Hè Xe Buýt & Điểm Dừng Xe Buýt (Bus Bay / Bus Stop). */
          busBay(x        , y        , r        , seed        )       {
    const { ctx } = this;
    ctx.save();

    const baseW = Math.max(36 * this.dpr, r * 1.35);
    const baseH = Math.max(20 * this.dpr, r * 0.7);

    // 1. Vịnh xén hè đường với vạch kẻ đón khách vàng óng (Bus Bay Asphalt)
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.6 * this.dpr;
    ctx.beginPath();
    ctx.roundRect(x - baseW / 2, y - baseH * 0.35, baseW, baseH, 4 * this.dpr);
    ctx.fill();
    ctx.stroke();

    // Vạch kẻ đón xe buýt màu vàng
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 1.8 * this.dpr;
    ctx.setLineDash([4 * this.dpr, 4 * this.dpr]);
    ctx.strokeRect(x - baseW * 0.42, y - baseH * 0.25, baseW * 0.84, baseH * 0.5);
    ctx.setLineDash([]);

    // 2. Nhà chờ xe buýt có mái vòm xanh lam hiện đại
    const shelterW = baseW * 0.45;
    const shelterH = Math.max(12 * this.dpr, r * 0.45);
    const shX = x - baseW * 0.2;
    const shY = y - 4 * this.dpr;

    // Cột chống
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(shX - shelterW * 0.4, shY - shelterH, 2 * this.dpr, shelterH);
    ctx.fillRect(shX + shelterW * 0.4, shY - shelterH, 2 * this.dpr, shelterH);

    // Mái vòm xanh lam trong suốt
    ctx.fillStyle = 'rgba(2, 132, 199, 0.85)';
    ctx.beginPath();
    ctx.ellipse(shX, shY - shelterH, shelterW * 0.5, 4 * this.dpr, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Biển Báo Tuyến Xe Buýt Cổ Phát Sáng
    const signX = x + baseW * 0.32;
    const signY = y - 8 * this.dpr;
    ctx.fillStyle = '#0284c7';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.2 * this.dpr;
    ctx.fillRect(signX - 4 * this.dpr, signY - 8 * this.dpr, 8 * this.dpr, 8 * this.dpr);
    ctx.strokeRect(signX - 4 * this.dpr, signY - 8 * this.dpr, 8 * this.dpr, 8 * this.dpr);

    // Biểu tượng xe buýt mini
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(signX - 2.5 * this.dpr, signY - 6.5 * this.dpr, 5 * this.dpr, 4 * this.dpr);

    ctx.restore();
  }

  /** ⛩️ Trường Nhật Bản Hà Nội (Japanese School of Hanoi). */
          japaneseSchool(x        , y        , r        , seed        )       {
    const { ctx } = this;
    ctx.save();

    const baseW = Math.max(38 * this.dpr, r * 1.3);
    const baseH = Math.max(26 * this.dpr, r * 0.8);

    // 1. Sân sỏi trắng Zen thanh tịnh
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.6 * this.dpr;
    ctx.beginPath();
    ctx.roundRect(x - baseW / 2, y - baseH * 0.35, baseW, baseH, 6 * this.dpr);
    ctx.fill();
    ctx.stroke();

    // 2. Cổng Torii Đỏ Rực (Torii Gate)
    const toriiX = x - baseW * 0.25;
    const toriiY = y + 2 * this.dpr;
    const tw = 16 * this.dpr;
    const th = 18 * this.dpr;

    // 2 Trụ đỏ
    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 1 * this.dpr;
    ctx.fillRect(toriiX - tw * 0.4, toriiY - th, 2.5 * this.dpr, th);
    ctx.fillRect(toriiX + tw * 0.4 - 2.5 * this.dpr, toriiY - th, 2.5 * this.dpr, th);

    // Xà ngang trên
    ctx.fillRect(toriiX - tw * 0.6, toriiY - th - 3 * this.dpr, tw * 1.2, 3.5 * this.dpr);

    // 3. Giảng Đường Kiểu Nhật (Japanese Hall)
    const hallX = x + baseW * 0.15;
    const hallY = y - 2 * this.dpr;
    const hw = baseW * 0.45;
    const hh = 16 * this.dpr;

    // Tường nhà trắng xám
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(hallX - hw / 2, hallY - hh * 0.4, hw, hh * 0.4);

    // Mái ngói dốc đen kiểu Nhật
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(hallX - hw * 0.65, hallY - hh * 0.4);
    ctx.lineTo(hallX + hw * 0.65, hallY - hh * 0.4);
    ctx.lineTo(hallX, hallY - hh);
    ctx.closePath();
    ctx.fill();

    // 4. Cây Hoa Anh Đào (Sakura Tree) Hồng Thắm
    const treeX = x + baseW * 0.35;
    const treeY = y - baseH * 0.2;
    // Thân cây
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 2.5 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(treeX, treeY + 4 * this.dpr);
    ctx.quadraticCurveTo(treeX + 3 * this.dpr, treeY - 6 * this.dpr, treeX, treeY - 12 * this.dpr);
    ctx.stroke();

    // Tán hoa anh đào hồng
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.arc(treeX - 3 * this.dpr, treeY - 14 * this.dpr, 5 * this.dpr, 0, Math.PI * 2);
    ctx.arc(treeX + 4 * this.dpr, treeY - 13 * this.dpr, 6 * this.dpr, 0, Math.PI * 2);
    ctx.arc(treeX, treeY - 18 * this.dpr, 5.5 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** 🍵 Trà Quán Tiền Sử (Phúc Long, The Coffee House, Cộng Trà Quán, Trung Nguyên...). */
          teaHouse(x        , y        , r        , seed        )       {
    const { ctx } = this;
    ctx.save();

    const baseW = Math.max(34 * this.dpr, r * 1.3);
    const baseH = Math.max(22 * this.dpr, r * 0.75);

    // 1. Sân đất nện & thềm đá sa thạch
    ctx.fillStyle = '#451a03';
    ctx.strokeStyle = '#291002';
    ctx.lineWidth = 1.6 * this.dpr;
    ctx.beginPath();
    ctx.roundRect(x - baseW / 2, y - baseH * 0.35, baseW, baseH, 6 * this.dpr);
    ctx.fill();
    ctx.stroke();

    // 2. Mái rơm uốn cong phong cách quán trà mộc mạc
    const houseW = baseW * 0.62;
    const houseH = Math.max(16 * this.dpr, r * 0.55);

    // Mái rạ vàng hổ phách
    ctx.fillStyle = '#b45309';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.4 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(x - houseW * 0.65, y - houseH * 0.4);
    ctx.lineTo(x + houseW * 0.65, y - houseH * 0.4);
    ctx.lineTo(x, y - houseH - 4 * this.dpr);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. Ấm trà đất nung bốc khói ngọc bích
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.arc(x, y - houseH * 0.65, 4 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    // Khói trà xanh dịu dàng
    const smokeY = y - houseH * 0.65 - 4 * this.dpr - ((this.tick % 24) * 0.25 * this.dpr);
    ctx.fillStyle = 'rgba(167, 243, 208, 0.75)';
    ctx.beginPath();
    ctx.arc(x + Math.sin(this.tick / 5) * 1.5 * this.dpr, smokeY, 1.6 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** 🏪 Tiệm Trao Đổi Vật Phẩm & Hàng Quán Tiền Sử (WinMart, Circle K, Chợ Dân Sinh...). */
          convenienceStore(x        , y        , r        , seed        )       {
    const { ctx } = this;
    ctx.save();

    const baseW = Math.max(36 * this.dpr, r * 1.35);
    const baseH = Math.max(22 * this.dpr, r * 0.75);

    // 1. Sân đất nện thương nghiệp
    ctx.fillStyle = '#3b200c';
    ctx.strokeStyle = '#1f0d04';
    ctx.lineWidth = 1.6 * this.dpr;
    ctx.beginPath();
    ctx.roundRect(x - baseW / 2, y - baseH * 0.35, baseW, baseH, 5 * this.dpr);
    ctx.fill();
    ctx.stroke();

    // 2. Kệ hàng & quầy trao đổi đồ
    const shopW = baseW * 0.65;
    const shopH = Math.max(15 * this.dpr, r * 0.5);

    // Mái che bằng vải thô da thú
    ctx.fillStyle = '#ca8a04';
    ctx.strokeStyle = '#854d0e';
    ctx.lineWidth = 1.2 * this.dpr;
    ctx.fillRect(x - shopW / 2, y - shopH, shopW, shopH * 0.5);
    ctx.strokeRect(x - shopW / 2, y - shopH, shopW, shopH * 0.5);

    // Rương hàng & giỏ mây chứa đồ
    for (const [ox, color] of [[-8, '#ea580c'], [0, '#16a34a'], [8, '#0284c7']]                      ) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + ox * this.dpr, y - 2 * this.dpr, 3 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * MẠNG LƯỚI ĐẠI LỘ & ĐƯỜNG PHỐ THỰC TẾ HÀ NỘI (Real Hanoi Arterial Roads):
   * Đường Lê Đức Thọ, Phố Hàm Nghi, Phố Nguyễn Hoàng, Hồ Tùng Mậu, Phạm Hùng / Vành Đai 3,
   * Xuân Thủy - Cầu Giấy, Trần Duy Hưng - Đại Lộ Thăng Long, Kim Mã - Nguyễn Thái Học...
   */
          drawRealRoads(
    project                                  ,
    pxPerMeter        ,
    phase       ,
  )       {
    const { ctx } = this;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Tone màu đất nện, đất đỏ bazan, đất phù sa cổ hoang dã
    const dirtOuterColor = phase === 'night' ? '#1c1917' : phase === 'evening' ? '#451a03' : '#78350f';
    const dirtMainColor = phase === 'night' ? '#292524' : phase === 'evening' ? '#5c2d10' : '#854d0e';
    const dirtCenterGroove = phase === 'night' ? '#171412' : phase === 'evening' ? '#381a08' : '#573312';
    const pebbleColor = phase === 'night' ? '#44403c' : phase === 'evening' ? '#a8a29e' : '#d6d3d1';

    for (const road of REAL_ROADS) {
      const pts = road.points.map((p) => project(p));
      const rw = Math.max(10 * this.dpr, road.widthMeters * pxPerMeter);

      // 1. Viền đất bồi / cát mịn mềm mại ven lối mòn
      ctx.strokeStyle = dirtOuterColor;
      ctx.lineWidth = rw + 4 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();

      // 2. Lòng đường đất nện phẳng do dấu chân cổ đại qua lại
      ctx.strokeStyle = dirtMainColor;
      ctx.lineWidth = rw;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();

      // 3. Rãnh đất lún / vệt mòn sẫm màu tự nhiên ở giữa lối đi
      ctx.strokeStyle = dirtCenterGroove;
      ctx.lineWidth = Math.max(1.5 * this.dpr, rw * 0.22);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();

      // 4. Sỏi cuội & đá dăm tiền sử rải rác trên đường đất
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const dist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
        const numPebbles = Math.max(2, Math.floor(dist / (35 * this.dpr)));

        for (let k = 1; k <= numPebbles; k++) {
          const t = k / (numPebbles + 1);
          const px = p1[0] + (p2[0] - p1[0]) * t + ((k % 3) - 1) * 3 * this.dpr;
          const py = p1[1] + (p2[1] - p1[1]) * t + (((k * 2) % 3) - 1) * 3 * this.dpr;

          ctx.fillStyle = pebbleColor;
          ctx.beginPath();
          ctx.arc(px, py, 1.2 * this.dpr, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 5. Nhãn tên đường đất hoang cổ
      if (rw >= 12 * this.dpr) {
        const midIdx = Math.floor(pts.length / 2);
        const mx = (pts[midIdx - 1][0] + pts[midIdx][0]) / 2;
        const my = (pts[midIdx - 1][1] + pts[midIdx][1]) / 2;
        const angle = Math.atan2(pts[midIdx][1] - pts[midIdx - 1][1], pts[midIdx][0] - pts[midIdx - 1][0]);

        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(Math.abs(angle) > Math.PI / 2 ? angle + Math.PI : angle);
        ctx.font = `bold ${Math.max(9, Math.min(11, 10 * this.dpr))}px 'Be Vietnam Pro', system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fef08a';
        ctx.fillText(`🌾 ${road.name}`, 0, -4 * this.dpr);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  /**
   * CĂN CỨ / DOANH TRẠI SINH TỒN CHI TIẾT ĐỈNH CAO:
   *  - Túp lều mái lá dừa / tranh tiền sử 3D với kết cấu khung gỗ và cửa da thú.
   *  - Bếp lửa trại quay thịt nướng bập bùng, có khói xám bốc lên cao.
   *  - Giá phơi cá khô và tấm da thú căng nắng.
   *  - Hòm kho an toàn bọc da cạnh lều.
   */
          drawCamp(at                  , pxPerMeter        )       {
    const { ctx } = this;
    const [x, y] = at;
    const size = Math.max(24 * this.dpr, 34 * pxPerMeter);

    ctx.save();

    // 1. Quầng sáng ấm áp tỏa rộng của bếp lửa trại
    const pulse = 0.85 + 0.15 * Math.sin(this.tick / 8);
    const glow = ctx.createRadialGradient(x + size * 0.55, y + size * 0.25, 2 * this.dpr, x + size * 0.55, y + size * 0.25, size * 2.2 * pulse);
    glow.addColorStop(0, 'rgba(245, 158, 11, 0.42)');
    glow.addColorStop(0.5, 'rgba(234, 88, 12, 0.15)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x + size * 0.55, y + size * 0.25, size * 2.2 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // 2. Bóng đổ 3D của cả khu căn cứ (đổ theo hướng đông bắc/đông nam)
    ctx.fillStyle = 'rgba(12, 9, 6, 0.55)';
    ctx.beginPath();
    ctx.ellipse(x - size * 0.1, y + size * 0.4, size * 1.35, size * 0.52, 0.15, 0, Math.PI * 2);
    ctx.fill();

    // ==================== TÚP LỀU MÁI LÁ DỪA TIỀN SỬ (THATVHED HUT) ====================
    const hutX = x - size * 0.25;
    const hutY = y - size * 0.1;
    const hutW = size * 1.1;
    const hutH = size * 0.95;

    // Khung tường gỗ lều
    ctx.fillStyle = '#543820';
    ctx.fillRect(hutX - hutW * 0.42, hutY - hutH * 0.2, hutW * 0.84, hutH * 0.55);

    // Cửa lều vén bạt da thú
    ctx.fillStyle = '#1c130c';
    ctx.beginPath();
    ctx.moveTo(hutX - hutW * 0.15, hutY + hutH * 0.35);
    ctx.lineTo(hutX, hutY - hutH * 0.1);
    ctx.lineTo(hutX + hutW * 0.15, hutY + hutH * 0.35);
    ctx.closePath();
    ctx.fill();

    // Mái lợp lá dừa / tranh nhiều tầng (Thatched Roof)
    ctx.fillStyle = '#85532a';
    ctx.strokeStyle = '#d9975b';
    ctx.lineWidth = 1.8 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(hutX, hutY - hutH * 0.65);
    ctx.lineTo(hutX - hutW * 0.55, hutY + hutH * 0.2);
    ctx.lineTo(hutX + hutW * 0.55, hutY + hutH * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Tầng mái lá thứ hai xếp lớp
    ctx.fillStyle = '#a16834';
    ctx.beginPath();
    ctx.moveTo(hutX, hutY - hutH * 0.65);
    ctx.lineTo(hutX - hutW * 0.42, hutY - hutH * 0.05);
    ctx.lineTo(hutX + hutW * 0.42, hutY - hutH * 0.05);
    ctx.closePath();
    ctx.fill();

    // Cọc gỗ bắt chéo đỉnh nóc lều
    ctx.strokeStyle = '#45220c';
    ctx.lineWidth = 2.4 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(hutX - 4 * this.dpr, hutY - hutH * 0.82);
    ctx.lineTo(hutX + 3 * this.dpr, hutY - hutH * 0.55);
    ctx.moveTo(hutX + 4 * this.dpr, hutY - hutH * 0.82);
    ctx.lineTo(hutX - 3 * this.dpr, hutY - hutH * 0.55);
    ctx.stroke();

    // ==================== BẾP LỬA TRẠI QUAY THỊT (ROASTING SPIT) ====================
    const fireX = x + size * 0.62;
    const fireY = y + size * 0.22;

    // Vòng đá cuội xếp quanh bếp
    ctx.fillStyle = '#78716c';
    for (let r = 0; r < 8; r++) {
      const a = (r / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(fireX + Math.cos(a) * 7 * this.dpr, fireY + Math.sin(a) * 4.5 * this.dpr, 2.2 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hai cọc gỗ chạc ba cắm hai bên
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 2 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(fireX - 8 * this.dpr, fireY + 4 * this.dpr);
    ctx.lineTo(fireX - 8 * this.dpr, fireY - 10 * this.dpr);
    ctx.moveTo(fireX + 8 * this.dpr, fireY + 4 * this.dpr);
    ctx.lineTo(fireX + 8 * this.dpr, fireY - 10 * this.dpr);
    ctx.stroke();

    // Thanh ngang xiên thịt nướng
    ctx.beginPath();
    ctx.moveTo(fireX - 10 * this.dpr, fireY - 8 * this.dpr);
    ctx.lineTo(fireX + 10 * this.dpr, fireY - 8 * this.dpr);
    ctx.stroke();

    // Tảng thịt rừng nướng vàng ruộm trên xiên
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.ellipse(fireX, fireY - 8 * this.dpr, 5 * this.dpr, 2.8 * this.dpr, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ngọn lửa 3 tầng bập bùng
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(fireX, fireY - 2 * this.dpr, 4.5 * this.dpr * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(fireX, fireY - 3.5 * this.dpr, 3.2 * this.dpr * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(fireX, fireY - 4.5 * this.dpr, 1.8 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    // Cột khói xám bốc lên cao bồng bềnh
    for (let m = 0; m < 4; m++) {
      const smokeProg = ((this.tick * 0.7 + m * 16) % 64) / 64;
      const smkY = fireY - 10 * this.dpr - smokeProg * 32 * this.dpr;
      const smkX = fireX + Math.sin(this.tick / 9 + m) * 6 * this.dpr + smokeProg * 12 * this.dpr;
      const smkAlpha = (1 - smokeProg) * 0.38;
      const smkRadius = (3.5 + smokeProg * 8) * this.dpr;
      ctx.fillStyle = `rgba(226, 232, 240, ${smkAlpha})`;
      ctx.beginPath();
      ctx.arc(smkX, smkY, smkRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // ==================== GIÁ PHƠI CÁ & DA THÚ (DRYING RACK) ====================
    const rackX = x - size * 0.55;
    const rackY = y + size * 0.32;

    ctx.strokeStyle = '#543820';
    ctx.lineWidth = 1.8 * this.dpr;
    // Cọc trái & phải
    ctx.beginPath();
    ctx.moveTo(rackX - 7 * this.dpr, rackY + 5 * this.dpr);
    ctx.lineTo(rackX - 7 * this.dpr, rackY - 9 * this.dpr);
    ctx.moveTo(rackX + 7 * this.dpr, rackY + 5 * this.dpr);
    ctx.lineTo(rackX + 7 * this.dpr, rackY - 9 * this.dpr);
    // Xà ngang
    ctx.moveTo(rackX - 9 * this.dpr, rackY - 7 * this.dpr);
    ctx.lineTo(rackX + 9 * this.dpr, rackY - 7 * this.dpr);
    ctx.stroke();

    // Tấm da thú phơi căng
    ctx.fillStyle = '#a16207';
    ctx.fillRect(rackX - 5 * this.dpr, rackY - 6 * this.dpr, 10 * this.dpr, 8 * this.dpr);

    // ==================== HÒM KÉT KHO BỌC DA (STORAGE CHEST) ====================
    const chestX = hutX + hutW * 0.42;
    const chestY = hutY + hutH * 0.35;
    ctx.fillStyle = '#78350f';
    ctx.fillRect(chestX, chestY - 5 * this.dpr, 10 * this.dpr, 7 * this.dpr);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1 * this.dpr;
    ctx.strokeRect(chestX, chestY - 5 * this.dpr, 10 * this.dpr, 7 * this.dpr);

    // Nhãn Căn Cứ / Nhà nổi bật
    ctx.fillStyle = '#fef08a';
    ctx.font = `bold ${11.5 * this.dpr}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = 6 * this.dpr;
    ctx.fillText('🏕️ CĂN CỨ (NHÀ)', x, y + size * 1.25);
    ctx.shadowBlur = 0;

    ctx.restore();
  }

          drawPlayer(x        , y        , pxPerMeter        , input             )       {
    const { ctx } = this;
    const pulse = 0.5 + 0.5 * Math.sin(this.tick / 16);
    const bob = Math.sin(this.tick / 8) * 1.8 * this.dpr;
    const isFemale = input.gender === 'female';

    ctx.save();

    // 0. Sóng định vị Radar Beacon toả rộng dạng 2.5D (giúp thấy ngay vị trí khi zoom xa toàn bản đồ)
    const beaconTime = (this.tick % 45) / 45;
    const beaconRadius = (16 + beaconTime * 32) * this.dpr;
    ctx.strokeStyle = isFemale ? `rgba(45, 212, 191, ${0.75 * (1 - beaconTime)})` : `rgba(245, 158, 11, ${0.75 * (1 - beaconTime)})`;
    ctx.lineWidth = 2 * this.dpr;
    ctx.beginPath();
    ctx.ellipse(x, y, beaconRadius, beaconRadius * 0.68, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 1. Vòng bán kính tương tác 30m dạng 2.5D
    ctx.strokeStyle = `rgba(254, 240, 138, ${0.2 + pulse * 0.18})`;
    ctx.lineWidth = 1.8 * this.dpr;
    ctx.setLineDash([6 * this.dpr, 6 * this.dpr]);
    ctx.beginPath();
    ctx.ellipse(x, y, 30 * pxPerMeter, 30 * pxPerMeter * 0.68, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Vầng hào quang nhận thức mềm mịn quanh người chơi dạng 2.5D
    ctx.save();
    ctx.scale(1, 0.68);
    const glow = ctx.createRadialGradient(x, y / 0.68, 4 * this.dpr, x, y / 0.68, 36 * this.dpr);
    glow.addColorStop(0, isFemale ? 'rgba(45, 212, 191, 0.35)' : 'rgba(249, 115, 22, 0.35)');
    glow.addColorStop(0.55, isFemale ? 'rgba(13, 148, 136, 0.15)' : 'rgba(234, 88, 12, 0.15)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y / 0.68, 36 * this.dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Đom đóm / 6 hạt bụi ánh sáng linh hồn xoay 3D quanh nhân vật
    for (let s = 0; s < 6; s++) {
      const sAngle = (this.tick / 22) + (s * Math.PI / 3);
      const sRadius = (18 + Math.sin(this.tick / 10 + s) * 5) * this.dpr;
      const sx = x + Math.cos(sAngle) * sRadius;
      const sy = y + Math.sin(sAngle) * sRadius * 0.7;
      const sAlpha = 0.4 + 0.6 * Math.sin(this.tick / 7 + s * 1.5);
      ctx.fillStyle = isFemale ? `rgba(94, 234, 212, ${sAlpha})` : `rgba(254, 215, 170, ${sAlpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.8 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Bóng đổ 3D mềm mại tự nhiên dưới đất theo góc mặt trời
    ctx.fillStyle = 'rgba(8, 6, 4, 0.52)';
    ctx.beginPath();
    ctx.ellipse(x - 2 * this.dpr, y + 11 * this.dpr, 13 * this.dpr, 5.5 * this.dpr, -0.2, 0, Math.PI * 2);
    ctx.fill();

    const py = y + bob;

    if (isFemale) {
      // ==================== NỮ CHIẾN BINH TIỀN SỬ (THÁNH NỮ RỪNG XANH) ====================
      // Hai chân da bánh mật có dây da quấn cổ chân
      ctx.fillStyle = '#b47b52';
      ctx.fillRect(x - 5.5 * this.dpr, py + 4 * this.dpr, 3.2 * this.dpr, 7.5 * this.dpr);
      ctx.fillRect(x + 2.3 * this.dpr, py + 4 * this.dpr, 3.2 * this.dpr, 7.5 * this.dpr);
      // Dây da và ngọc quấn bắp chân
      ctx.fillStyle = '#0d9488';
      ctx.fillRect(x - 5.5 * this.dpr, py + 8.5 * this.dpr, 3.2 * this.dpr, 1.8 * this.dpr);
      ctx.fillRect(x + 2.3 * this.dpr, py + 8.5 * this.dpr, 3.2 * this.dpr, 1.8 * this.dpr);

      // Yếm & Váy da thú viền lông tuyết trắng phồng
      ctx.fillStyle = '#7c4a2d';
      ctx.beginPath();
      ctx.moveTo(x - 7 * this.dpr, py + 5 * this.dpr);
      ctx.lineTo(x + 7 * this.dpr, py + 5 * this.dpr);
      ctx.lineTo(x + 8.5 * this.dpr, py + 7.5 * this.dpr);
      ctx.lineTo(x + 6 * this.dpr, py - 5.5 * this.dpr);
      ctx.lineTo(x - 6 * this.dpr, py - 5.5 * this.dpr);
      ctx.lineTo(x - 8.5 * this.dpr, py + 7.5 * this.dpr);
      ctx.closePath();
      ctx.fill();

      // Viền lông trắng tuyết phồng mềm ở ngực
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.ellipse(x, py - 5.5 * this.dpr, 6.5 * this.dpr, 1.8 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Thắt lưng ngọc bích phát sáng ánh ngọc lam
      ctx.strokeStyle = '#2dd4bf';
      ctx.lineWidth = 2.2 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(x - 7 * this.dpr, py + 1.5 * this.dpr);
      ctx.lineTo(x + 7 * this.dpr, py + 1.5 * this.dpr);
      ctx.stroke();

      // Viên ngọc bích trung tâm thắt lưng phát sáng
      ctx.fillStyle = '#5eead4';
      ctx.beginPath();
      ctx.arc(x, py + 1.5 * this.dpr, 2.5 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Chuỗi hạt ngọc bích trước ngực
      ctx.fillStyle = '#2dd4bf';
      ctx.beginPath();
      ctx.arc(x - 2 * this.dpr, py - 2 * this.dpr, 1.2 * this.dpr, 0, Math.PI * 2);
      ctx.arc(x, py - 1 * this.dpr, 1.4 * this.dpr, 0, Math.PI * 2);
      ctx.arc(x + 2 * this.dpr, py - 2 * this.dpr, 1.2 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Bím tóc đen mun dài duyên dáng quàng 2 bên ngực
      ctx.fillStyle = '#140c06';
      ctx.beginPath();
      ctx.ellipse(x - 8 * this.dpr, py - 1 * this.dpr, 3 * this.dpr, 8.5 * this.dpr, 0.25, 0, Math.PI * 2);
      ctx.ellipse(x + 8 * this.dpr, py - 1 * this.dpr, 3 * this.dpr, 8.5 * this.dpr, -0.25, 0, Math.PI * 2);
      ctx.fill();

      // Vòng thắt ngọc bích ở đuôi bím tóc
      ctx.fillStyle = '#2dd4bf';
      ctx.beginPath();
      ctx.arc(x - 8.5 * this.dpr, py + 4.5 * this.dpr, 2 * this.dpr, 0, Math.PI * 2);
      ctx.arc(x + 8.5 * this.dpr, py + 4.5 * this.dpr, 2 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Quyền Trượng Linh Hồn tay phải
      const staffX = x + 11 * this.dpr;
      ctx.strokeStyle = '#854d0e';
      ctx.lineWidth = 2.2 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(staffX, py - 14 * this.dpr);
      ctx.lineTo(staffX, py + 10 * this.dpr);
      ctx.stroke();

      // Viên ngọc lục bảo toả sáng đỉnh trượng
      ctx.fillStyle = '#14b8a6';
      ctx.beginPath();
      ctx.arc(staffX, py - 14 * this.dpr, 4.2 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ccfbf1';
      ctx.beginPath();
      ctx.arc(staffX, py - 15 * this.dpr, 2 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Tia sao sáng lấp lánh (Sparkle Star) đỉnh trượng
      const starPulse = 0.6 + 0.4 * Math.sin(this.tick / 6);
      ctx.strokeStyle = `rgba(255, 255, 255, ${starPulse})`;
      ctx.lineWidth = 1.2 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(staffX - 6 * this.dpr, py - 14 * this.dpr);
      ctx.lineTo(staffX + 6 * this.dpr, py - 14 * this.dpr);
      ctx.moveTo(staffX, py - 20 * this.dpr);
      ctx.lineTo(staffX, py - 8 * this.dpr);
      ctx.stroke();

      // Đầu & Gương mặt
      ctx.fillStyle = '#c58e65';
      ctx.beginPath();
      ctx.arc(x, py - 9.5 * this.dpr, 6.2 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Tóc mái đen mun
      ctx.fillStyle = '#140c06';
      ctx.beginPath();
      ctx.arc(x, py - 11 * this.dpr, 6.5 * this.dpr, Math.PI * 0.9, Math.PI * 2.1);
      ctx.fill();

      // Dải băng cài lông công xanh ngọc
      ctx.strokeStyle = '#0f766e';
      ctx.lineWidth = 1.8 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(x - 6 * this.dpr, py - 9.5 * this.dpr);
      ctx.lineTo(x + 6 * this.dpr, py - 9.5 * this.dpr);
      ctx.stroke();

      // Lông chim công biếc cài trán
      ctx.fillStyle = '#0d9488';
      ctx.beginPath();
      ctx.moveTo(x + 4 * this.dpr, py - 11 * this.dpr);
      ctx.quadraticCurveTo(x + 12 * this.dpr, py - 20 * this.dpr, x + 9 * this.dpr, py - 9 * this.dpr);
      ctx.fill();

      // Vệt sơn má chiến binh ngọc lam
      ctx.fillStyle = '#2dd4bf';
      ctx.fillRect(x - 5 * this.dpr, py - 8 * this.dpr, 2.2 * this.dpr, 1.3 * this.dpr);
      ctx.fillRect(x + 2.8 * this.dpr, py - 8 * this.dpr, 2.2 * this.dpr, 1.3 * this.dpr);
    } else {
      // ==================== NAM THỢ SĂN TIỀN SỬ (CHÚA TỂ RỪNG HOANG) ====================
      // Hai chân cơ bắp lực lưỡng
      ctx.fillStyle = '#a1653d';
      ctx.fillRect(x - 6 * this.dpr, py + 4 * this.dpr, 4 * this.dpr, 8 * this.dpr);
      ctx.fillRect(x + 2 * this.dpr, py + 4 * this.dpr, 4 * this.dpr, 8 * this.dpr);
      // Dây da quấn cổ chân
      ctx.fillStyle = '#3a1e0b';
      ctx.fillRect(x - 6 * this.dpr, py + 9 * this.dpr, 4 * this.dpr, 1.8 * this.dpr);
      ctx.fillRect(x + 2 * this.dpr, py + 9 * this.dpr, 4 * this.dpr, 1.8 * this.dpr);

      // Thân người vạm vỡ cơ bắp cuồn cuộn
      ctx.fillStyle = '#b87a4b';
      ctx.beginPath();
      ctx.arc(x, py - 3 * this.dpr, 7 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Khối bóng cơ bắp ngực nổi 3D
      ctx.strokeStyle = '#94582e';
      ctx.lineWidth = 1.4 * this.dpr;
      ctx.beginPath();
      ctx.arc(x - 2.5 * this.dpr, py - 3 * this.dpr, 2.2 * this.dpr, 0, Math.PI * 0.8);
      ctx.arc(x + 2.5 * this.dpr, py - 3 * this.dpr, 2.2 * this.dpr, Math.PI * 0.2, Math.PI);
      ctx.stroke();

      // Khố da báo vằn đốm viền tua rua da thú
      ctx.fillStyle = '#8a4b20';
      ctx.beginPath();
      ctx.moveTo(x - 7.5 * this.dpr, py);
      ctx.lineTo(x + 7.5 * this.dpr, py);
      ctx.lineTo(x + 6 * this.dpr, py + 7.5 * this.dpr);
      ctx.lineTo(x - 6 * this.dpr, py + 7.5 * this.dpr);
      ctx.closePath();
      ctx.fill();

      // Họa tiết đốm da thú trên khố
      ctx.fillStyle = '#3a1e0b';
      ctx.fillRect(x - 3.5 * this.dpr, py + 2 * this.dpr, 2 * this.dpr, 2 * this.dpr);
      ctx.fillRect(x + 2 * this.dpr, py + 3.5 * this.dpr, 2.2 * this.dpr, 2 * this.dpr);

      // Dây da chéo ngực đính nanh thú
      ctx.strokeStyle = '#3e1f0a';
      ctx.lineWidth = 2.2 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(x - 6 * this.dpr, py - 8 * this.dpr);
      ctx.lineTo(x + 6 * this.dpr, py + 3 * this.dpr);
      ctx.stroke();

      // Chuỗi răng nanh gấu trắng ngà chạm khắc
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.moveTo(x, py - 2.5 * this.dpr);
      ctx.lineTo(x + 3 * this.dpr, py + 3.5 * this.dpr);
      ctx.lineTo(x - 1.2 * this.dpr, py + 1.8 * this.dpr);
      ctx.closePath();
      ctx.fill();

      // Ngọn Giáo Thợ Săn Thần Thoại tay phải
      const spearX = x + 12 * this.dpr;
      ctx.strokeStyle = '#5c381c';
      ctx.lineWidth = 2.4 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(spearX, py - 20 * this.dpr);
      ctx.lineTo(spearX, py + 11 * this.dpr);
      ctx.stroke();

      // Mũi giáo đá Obsidian vát nhọn sắc lẹm viền bạc
      ctx.fillStyle = '#e2e8f0';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.2 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(spearX, py - 26 * this.dpr);
      ctx.lineTo(spearX + 4 * this.dpr, py - 18 * this.dpr);
      ctx.lineTo(spearX - 4 * this.dpr, py - 18 * this.dpr);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 2 Dải lông vũ đỏ cam rực rỡ thắt cổ giáo bay theo gió
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.moveTo(spearX, py - 18 * this.dpr);
      ctx.lineTo(spearX + 6 * this.dpr, py - 14 * this.dpr);
      ctx.lineTo(spearX + 1.5 * this.dpr, py - 13 * this.dpr);
      ctx.fill();

      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(spearX, py - 18 * this.dpr);
      ctx.lineTo(spearX - 5 * this.dpr, py - 15 * this.dpr);
      ctx.lineTo(spearX - 1.5 * this.dpr, py - 14 * this.dpr);
      ctx.fill();

      // Đầu & Gương mặt
      ctx.fillStyle = '#b87a4b';
      ctx.beginPath();
      ctx.arc(x, py - 10 * this.dpr, 6.5 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Mái tóc đen rậm hoang dã bồng bềnh
      ctx.fillStyle = '#120b07';
      ctx.beginPath();
      ctx.arc(x, py - 11.5 * this.dpr, 7 * this.dpr, Math.PI * 0.85, Math.PI * 2.15);
      ctx.fill();

      // Dải băng da trùm trán
      ctx.strokeStyle = '#6c3b17';
      ctx.lineWidth = 2 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(x - 6.5 * this.dpr, py - 10 * this.dpr);
      ctx.lineTo(x + 6.5 * this.dpr, py - 10 * this.dpr);
      ctx.stroke();

      // Lông chim đại bàng đỏ rực cài trán
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(x - 4 * this.dpr, py - 11.5 * this.dpr);
      ctx.quadraticCurveTo(x - 14 * this.dpr, py - 21 * this.dpr, x - 7 * this.dpr, py - 8.5 * this.dpr);
      ctx.fill();

      // Vệt sơn chiến binh đỏ đất nung trên má
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(x - 5.5 * this.dpr, py - 8.5 * this.dpr, 2.4 * this.dpr, 1.5 * this.dpr);
      ctx.fillRect(x + 3 * this.dpr, py - 8.5 * this.dpr, 2.4 * this.dpr, 1.5 * this.dpr);
    }

    // 5. Vẽ Linh Thú tiền sử đồng hành chạy theo nhịp bước chân
    if (input.activePetId) {
      const petOffsetAngle = (this.tick / 18) + Math.PI * 0.75;
      const petDist = 18 * this.dpr;
      const petX = x + Math.cos(petOffsetAngle) * petDist;
      const petY = y + Math.sin(petOffsetAngle) * (petDist * 0.6) + Math.sin(this.tick / 6) * 1.5 * this.dpr;

      // Bóng đổ của thú cưng
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(petX, petY + 4 * this.dpr, 5 * this.dpr, 2.5 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      if (input.activePetId === 'saber_cub') {
        // Hổ con răng kiếm: thân vàng cam, vằn nâu, răng nanh nhỏ trắng
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(petX, petY, 4.5 * this.dpr, 0, Math.PI * 2);
        ctx.fill();
        // Tai nhỏ
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.arc(petX - 3 * this.dpr, petY - 4 * this.dpr, 1.8 * this.dpr, 0, Math.PI * 2);
        ctx.arc(petX + 3 * this.dpr, petY - 4 * this.dpr, 1.8 * this.dpr, 0, Math.PI * 2);
        ctx.fill();
        // Răng kiếm mini
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(petX - 1.5 * this.dpr, petY + 1 * this.dpr, 0.8 * this.dpr, 2 * this.dpr);
        ctx.fillRect(petX + 0.7 * this.dpr, petY + 1 * this.dpr, 0.8 * this.dpr, 2 * this.dpr);
      } else if (input.activePetId === 'baby_mammoth') {
        // Voi ma mút con: thân nâu hạt dẻ, vòi uốn lượn, ngà trắng
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.arc(petX, petY, 5 * this.dpr, 0, Math.PI * 2);
        ctx.fill();
        // Vòi nhỏ
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2 * this.dpr;
        ctx.beginPath();
        ctx.moveTo(petX, petY + 1 * this.dpr);
        ctx.quadraticCurveTo(petX - 3 * this.dpr, petY + 4 * this.dpr, petX - 1 * this.dpr, petY + 6 * this.dpr);
        ctx.stroke();
      } else {
        // Chim ưng cổ đại: linh điểu bay lượn trên vai
        const wingFlap = Math.sin(this.tick / 4) * 4 * this.dpr;
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(petX, petY - 6 * this.dpr);
        ctx.lineTo(petX - 6 * this.dpr, petY - 6 * this.dpr + wingFlap);
        ctx.lineTo(petX, petY - 3 * this.dpr);
        ctx.lineTo(petX + 6 * this.dpr, petY - 6 * this.dpr + wingFlap);
        ctx.closePath();
        ctx.fill();
      }
    }

    if (!input.hasFix) {
      // Nhãn vị trí ước lượng tinh tế
      ctx.fillStyle = '#d4c5a9';
      ctx.font = `600 ${10 * this.dpr}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 4 * this.dpr;
      ctx.fillText('📍 Vị trí ước lượng', x, y - 30 * pxPerMeter - 8 * this.dpr);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

          drawRain(w        , h        , intensity        )       {
    const { ctx } = this;
    const drops = Math.min(STATIC_RAIN_DROPS.length, Math.round(STATIC_RAIN_DROPS.length * intensity));

    ctx.save();
    ctx.strokeStyle = 'rgba(180, 200, 215, 0.34)';
    ctx.lineWidth = 1 * this.dpr;
    for (let i = 0; i < drops; i++) {
      const p = STATIC_RAIN_DROPS[i] ;
      const x = (p.u * w + this.tick * 1.6) % w;
      const y = (p.v * h + this.tick * 9) % h;
      const len = p.lenFactor * this.dpr;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - len * 0.28, y + len);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * HỆ THỐNG ÁNH SÁNG & KHÍ QUYỂN CHUẨN XÁC:
   *  - BAN NGÀY (Day): Ánh nắng chan hoà tươi sáng, không bị tối đen mép màn hình.
   *  - HOÀNG HÔN (Evening): Ánh cam ấm hổ phách của buổi chiều tà.
   *  - BAN ĐÊM (Night): Màn đêm đen huyền bí, đuốc người chơi & lửa trại căn cứ khoét sáng rực rỡ vùng xung quanh!
   */
          drawAtmosphereAndLighting(
    w        ,
    h        ,
    input             ,
    project                                  ,
  )       {
    const { ctx } = this;
    ctx.save();

    if (input.phase === 'day') {
      // 1. Hạt bụi phấn hoa vàng lấp lánh trôi nhẹ trong gió
      for (let p = 0; p < STATIC_POLLEN.length; p++) {
        const item = STATIC_POLLEN[p] ;
        const px = (item.u * w + this.tick * item.speed) % w;
        const py = (item.v * h + Math.sin(this.tick / 20 + p) * 20 * this.dpr) % h;
        const pAlpha = 0.3 + 0.35 * Math.sin(this.tick / 15 + p * 2);
        ctx.fillStyle = `rgba(254, 240, 138, ${pAlpha})`;
        ctx.beginPath();
        ctx.arc(px, py, item.size * this.dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (input.phase === 'evening') {
      // 1. Hoàng hôn / Chiều tà: Ánh hổ phách ấm nồng
      ctx.fillStyle = 'rgba(249, 115, 22, 0.16)';
      ctx.fillRect(0, 0, w, h);

      // Tàn lửa ấm áp bay lơ lửng trong gió chiều
      for (let e = 0; e < STATIC_EMBERS.length; e++) {
        const item = STATIC_EMBERS[e] ;
        const ex = (item.u * w + this.tick * 1.2) % w;
        const ey = (item.v * h - this.tick * item.speed) % h;
        const actualY = ey < 0 ? h + ey : ey;
        const eAlpha = 0.4 + 0.45 * Math.sin(this.tick / 10 + e);
        ctx.fillStyle = item.isAmber ? `rgba(245, 158, 11, ${eAlpha})` : `rgba(239, 68, 68, ${eAlpha})`;
        ctx.beginPath();
        ctx.arc(ex, actualY, item.size * this.dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // 1. Ban đêm: Màn đêm phủ dày với quầng sáng đuốc nhân vật và lửa trại
      const playerX = w / 2 + this.panX;
      const playerY = h / 2 + this.panY;
      const torchPulse = 0.92 + 0.08 * Math.sin(this.tick / 6);
      const torchRadius = 75 * this.dpr * torchPulse;

      const nightGrad = ctx.createRadialGradient(playerX, playerY, 16 * this.dpr, playerX, playerY, torchRadius * 1.9);
      nightGrad.addColorStop(0, 'rgba(4, 7, 14, 0.1)');
      nightGrad.addColorStop(0.45, 'rgba(5, 8, 16, 0.65)');
      nightGrad.addColorStop(1, 'rgba(4, 6, 12, 0.93)');

      ctx.fillStyle = nightGrad;
      ctx.fillRect(0, 0, w, h);

      // Nếu có Căn Cứ / Lửa Trại -> chiếu sáng thêm vùng quanh Căn Cứ
      if (input.homeCellCenter) {
        const [campX, campY] = project(input.homeCellCenter);
        const campGlow = ctx.createRadialGradient(campX, campY, 10 * this.dpr, campX, campY, 100 * this.dpr * torchPulse);
        campGlow.addColorStop(0, 'rgba(245, 158, 11, 0.52)');
        campGlow.addColorStop(0.55, 'rgba(234, 88, 12, 0.2)');
        campGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = campGlow;
        ctx.beginPath();
        ctx.arc(campX, campY, 100 * this.dpr * torchPulse, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Đàn Đom Đóm Đêm (Night Fireflies) bay lượn phát sáng sinh học huyền ảo
      for (let f = 0; f < 18; f++) {
        const seed = hashSeed('firefly', f);
        const rng = createRng(seed);
        const baseX = rng() * w;
        const baseY = rng() * h;
        const speed = 0.015 + rng() * 0.02;
        const radiusMotion = (25 + rng() * 35) * this.dpr;
        const fx = (baseX + Math.sin(this.tick * speed + f * 1.5) * radiusMotion + w) % w;
        const fy = (baseY + Math.cos(this.tick * speed * 0.8 + f) * (radiusMotion * 0.7) + h) % h;

        const pulse = 0.5 + 0.5 * Math.sin(this.tick / (8 + f % 5) + f * 2);
        const glowRadius = (6 + 8 * pulse) * this.dpr;

        // Vầng hào quang đom đóm (tối ưu hóa vẽ nhanh không tạo gradient)
        ctx.fillStyle = `rgba(163, 230, 53, ${0.35 * pulse})`;
        ctx.beginPath();
        ctx.arc(fx, fy, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Điểm sáng đom đóm trung tâm
        ctx.fillStyle = `rgba(254, 252, 232, ${0.95 * pulse})`;
        ctx.beginPath();
        ctx.arc(fx, fy, 1.4 * this.dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}

/** Chuyển toạ độ chạm trên canvas thành POI gần nhất — cho phép bấm vào cảnh vật. */
export function featureAtPoint(
  features              ,
  center        ,
  point                          ,
  canvas                   ,
  spanMeters = 420,
)                    {
  const TILT_Y = 0.68;
  const rect = canvas.getBoundingClientRect();
  const pxPerMeter = Math.min(rect.width, rect.height) / spanMeters;

  const dxMeters = (point.x - rect.width / 2) / pxPerMeter;
  const dyMeters = -(point.y - rect.height / 2) / (pxPerMeter * TILT_Y);

  const at         = {
    lat: center.lat + dyMeters * metersToLatDegrees(1),
    lon: center.lon + dxMeters * metersToLonDegrees(1, center.lat),
  };

  let best                    = null;
  let bestDistance = Infinity;

  for (const feature of features) {
    const d = distanceMeters(at, feature);
    if (d < Math.max(feature.radiusMeters, 25) && d < bestDistance) {
      best = feature;
      bestDistance = d;
    }
  }

  return best;
}
