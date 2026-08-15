/**
 * Renderer bản đồ "Hoàng Cổ Đồ" (Antique Street Map Renderer)
 * Kết hợp giữa hệ thống đường phố GPS hiện đại chuẩn xác với phong cách bản đồ giấy da cổ kính (Antique Parchment).
 *
 * - Địa hình & đường phố: Vẽ bản đồ đường sá thực tế, phân lô phố phường, sông hồ ngọc bích.
 * - Các Địa Điểm (POI): Nổi 3D bồng bềnh dạng Trụ Huy Hiệu PokéStop với bóng đổ và thẻ cự ly.
 * - Vật phẩm rơi (World Drops): Viên ngọc nổi 3D lơ lửng trên ngã đường với icon to rõ.
 * - Nhân vật: Tạo hình Dũng Sĩ Hoàng Cổ chi tiết, oai vệ và thanh thoát.
 */

import { hashSeed } from '../../../packages/game-core/src/rng.js';
import {
  distanceMeters,
  metersToLatDegrees,
  metersToLonDegrees,
} from '../../../packages/game-core/src/world.js';
import { HANOI_BEAST_TERRITORIES } from '../../../packages/game-core/src/index.js';
                                                                                               
                                                                               
                                                                     

                            
             
                 
                 
              
              
              
                      
 

                              
                 
                         
               
                        
                                                               
                             
                                                                               
                      
                                                                 
                  
                                 
                                                       
                              
                                                                               
                      
                                                      
                       
                                                              
                              
                                                                                        
                         
                                                                                     
                    
                                                      
                     
                                   
                    
 

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

/** Bảng màu bản đồ phong cách Cuộn Tranh Cổ Trang (Imperial Silk Scroll & Ancient Map) */
const PALETTE = {
  day: {
    parchment: '#dfcaa5', // Nền cuộn lụa vàng gấm cổ phong
    parchmentTexture: '#d2b991',
    blockFill: '#c4a67b', // Khối phường phố hoàng thổ cổ kính
    blockStroke: '#835f37', // Nét mực tàu phân phường sắc sảo
    roadMain: '#f2dfc3', // Lòng cổ đạo lát đá ngà vàng sáng ấm
    roadMainCasing: '#503318', // Viền mực tàu đậm nét
    roadSec: '#e6cfad', // Lối mòn đất nung
    roadSecCasing: '#6d4824',
    roadTrail: '#dcbf98',
    roadTrailCasing: '#855c32',
    parkFill: '#829a66', // Vườn trúc / Mảng xanh ngọc bích cổ trang
    parkStroke: '#546f39',
    parkInner: '#6b844f',
    waterFill: '#397871', // Thủy mặc lam bích sâu thẳm
    waterStroke: '#1c4d47',
    waterShimmer: 'rgba(254, 240, 199, 0.65)',
    textInk: '#291404', // Chữ mực đen thư pháp
    textGold: '#fef08a', // Chữ son thếp vàng kim
    textSec: '#664322',
    gridLine: 'rgba(115, 78, 41, 0.22)',
    sealRed: '#b91c1c', // Dấu triện son đỏ
  },
  evening: {
    parchment: '#3d2b1c',
    parchmentTexture: '#2f2014',
    blockFill: '#332316',
    blockStroke: '#523a24',
    roadMain: '#ecd4b0',
    roadMainCasing: '#5a3d22',
    roadSec: '#dfc49c',
    roadSecCasing: '#4e331b',
    roadTrail: '#cfb188',
    roadTrailCasing: '#432a14',
    parkFill: '#2f3b1e',
    parkStroke: '#41522a',
    parkInner: '#243016',
    waterFill: '#25554f',
    waterStroke: '#163834',
    waterShimmer: 'rgba(251, 191, 36, 0.45)',
    textInk: '#fef3c7',
    textGold: '#fde047',
    textSec: '#fcd34d',
    gridLine: 'rgba(217, 119, 6, 0.20)',
    sealRed: '#dc2626',
  },
  night: {
    parchment: '#1c2638', // Nền lụa dạ lam huyền ảo, sáng rõ và sắc nét
    parchmentTexture: '#141d2c',
    blockFill: '#243247', // Phân lô khối phố màu lam đậm tương phản
    blockStroke: '#384d6b',
    roadMain: '#5a7ba7', // Đại lộ ánh trăng sáng rực rỡ, nhìn cực rõ nét
    roadMainCasing: '#7ea4d6',
    roadSec: '#476387', // Đường liên khu
    roadSecCasing: '#6488b8',
    roadTrail: '#374d6c', // Đường nhỏ / ngõ ngách
    roadTrailCasing: '#52729e',
    parkFill: '#1a4238', // Công viên xanh ngọc bích đêm
    parkStroke: '#2d6a5c',
    parkInner: '#123028',
    waterFill: '#1c556b', // Sông hồ dạ thủy ngọc bích sáng lấp lánh
    waterStroke: '#2f829e',
    waterShimmer: 'rgba(125, 211, 252, 0.75)',
    textInk: '#f8fafc', // Chữ trắng sáng nổi bật
    textGold: '#7dd3fc', // Chữ ánh kim lam phát sáng
    textSec: '#cbd5e1',
    gridLine: 'rgba(125, 211, 252, 0.22)',
    sealRed: '#f43f5e',
  },
}         ;

/** Hệ thống Sông lớn thực tế tự nhiên tại Hà Nội & lân cận */
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

import osmRoadsRaw from '../../../packages/game-core/data/osm-roads-hanoi.json' with { type: 'json' };

                   
             
               
               
                      
                             
                 
                 
                 
                 
 

/** 7,913 tuyến đường thực tế từ OpenStreetMap đã được tiền xử lý và lập chỉ mục không gian */
const OSM_ROADS            = (osmRoadsRaw         ).map((r) => {
  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;
  for (const [lat, lon] of r.points) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    widthMeters: r.widthMeters,
    points: r.points,
    minLat,
    maxLat,
    minLon,
    maxLon,
  };
});

                                
                            
                     
                     
 

export class MapView {
                   canvas                   ;
                   ctx                          ;
          dpr = 1;
          tick = 0;

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

  onViewportChange                                 ;
  onPanChange                              ;
  onDropClick                            ;
  onTrapClick                             ;
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

    canvas.addEventListener('pointerdown', (e) => {
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture?.(e.pointerId);

      if (this.activePointers.size === 1) {
        this.isDragging = true;
        this.lastPointer = { x: e.clientX, y: e.clientY };
        this.pointerDownPos = { x: e.clientX, y: e.clientY };
        this.pointerDownTime = performance.now();
      } else if (this.activePointers.size === 2) {
        const [p1, p2] = Array.from(this.activePointers.values());
        this.pinchStartDist = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
        this.pinchStartZoom = this.zoomFactor;
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this.activePointers.has(e.pointerId)) return;
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.activePointers.size >= 2) {
        const [p1, p2] = Array.from(this.activePointers.values());
        const currentDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const ratio = currentDist / (this.pinchStartDist || 1);
        this.setZoom(this.pinchStartZoom * ratio);
      } else if (this.activePointers.size === 1 && this.isDragging && this.lastPointer) {
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
        const [p] = Array.from(this.activePointers.values());
        this.lastPointer = { x: p.x, y: p.y };
      } else if (this.activePointers.size === 0 && wasTracking) {
        this.isDragging = false;

        const duration = performance.now() - this.pointerDownTime;
        const dist = this.pointerDownPos
          ? Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y)
          : 999;

        if (dist < 28 && duration < 500 && this.lastProject) {
          const rect = canvas.getBoundingClientRect();
          const clickX = (e.clientX - rect.left) * this.dpr;
          const clickY = (e.clientY - rect.top) * this.dpr;

          // 1. Click vào bẫy thú
          if (this.lastInput?.traps) {
            let nearestTrap                    = null;
            let minTrapDist = 48 * this.dpr;

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

          // 2. Click vào món đồ rơi (World Drop)
          if (this.lastInput?.drops) {
            let nearestDrop                   = null;
            let minDropDist = 48 * this.dpr;

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

          // 3. Click vào địa điểm POI
          if (this.lastInput?.features) {
            let nearestFeature                    = null;
            let minFeatureDist = 56 * this.dpr;

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

    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 0.85;
        this.setZoom(this.zoomFactor * factor);
      },
      { passive: false },
    );

    this.resize();
  }

  setZoom(factor        )       {
    const clamped = Math.max(0.4, Math.min(2.5, factor));
    if (Math.abs(clamped - this.zoomFactor) > 0.01) {
      this.zoomFactor = clamped;
      this.viewportDirty = true;
      this.notifyViewportChange();
    }
  }

  zoomIn()       {
    this.setZoom(this.zoomFactor * 1.25);
  }

  zoomOut()       {
    this.setZoom(this.zoomFactor * 0.8);
  }

  resetPan()       {
    this.panX = 0;
    this.panY = 0;
    this.zoomFactor = 1.0;
    this.viewportDirty = true;
    this.notifyViewportChange();
  }

  recenterAndResetZoom()       {
    this.resetPan();
  }

  isPanned()          {
    return Math.abs(this.panX) > 5 || Math.abs(this.panY) > 5 || Math.abs(this.zoomFactor - 1.0) > 0.05;
  }

          notifyViewportChange()       {
    const baseSpan = this.lastInput?.spanMeters ?? 135;
    const currentSpan = baseSpan / this.zoomFactor;
    this.onViewportChange?.({
      isPannedOrZoomed: this.isPanned(),
      zoomFactor: this.zoomFactor,
      spanMeters: currentSpan,
    });
    this.onPanChange?.(this.isPanned());
  }

  resize()       {
    const rect = this.canvas.getBoundingClientRect();
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

    // Góc nghiêng nhẹ 2.5D tạo chiều sâu bản đồ đô thị
    const TILT_Y = 0.72;
    const baseSpan = input.spanMeters ?? 135;
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

    // 1. Tầng nền giấy da cổ & Khối phố đô thị (Antique Parchment & Urban Blocks)
    this.drawAntiqueMapBase(w, h, palette, input, project, pxPerMeter);

    // 2. Tầng sông lớn & mặt nước tự nhiên
    this.drawNaturalRivers(project, pxPerMeter, palette);

    // 3. Tầng đường phố đại lộ & mạng lưới giao thông thực tế
    this.drawStreetNetwork(project, pxPerMeter, palette, input);

    // 4. Lớp nước POI (Hồ Gươm, Hồ Tây, hồ công viên...)
    if (this.cachedInputFeatures !== input.features) {
      this.cachedInputFeatures = input.features;
      this.cachedWaterFeatures = input.features.filter((f) => f.zone === 'water');
      this.cachedSolidFeatures = input.features
        .filter((f) => f.zone !== 'water')
        .sort((a, b) => b.lat - a.lat);
    }

    for (const feature of this.cachedWaterFeatures) {
      this.drawWaterFeature(feature, project, pxPerMeter, palette);
    }

    // 4b. Lãnh địa dã thú sương đỏ (Red Mist Beast Territories)
    this.drawBeastTerritories(project, pxPerMeter, palette);

    // 5. Cắm trại doanh trại
    if (input.homeCellCenter) {
      this.drawCampBadge(project(input.homeCellCenter), pxPerMeter, palette);
    }

    // 6. Các địa điểm NỔI 3D (Floating 3D PokéStop-style Badges)
    for (const feature of this.cachedSolidFeatures) {
      this.drawFloatingFeatureBadge(feature, project, pxPerMeter, input, palette);
    }

    // 7. Bẫy thú nổi 3D
    if (input.traps && input.traps.length > 0) {
      this.drawTraps(project, input.traps, pxPerMeter, input, palette);
    }

    // 8. Vật phẩm rơi (World Drops) nổi 3D bồng bềnh
    if (input.drops && input.drops.length > 0) {
      this.drawFloatingDrops(project, input.drops, pxPerMeter, input, palette);
    }

    // 9. Nhân vật Dũng Sĩ Hoàng Cổ đứng giữa cung đường
    this.drawPlayer(w / 2 + this.panX, h / 2 + this.panY, pxPerMeter, input, palette);

    // 9b. Linh Điểu Tiền Sử bay lượn & Vệt Gió Thần Tốc khi di chuyển nhanh (Xe buýt / Xe máy)
    if (input.speedKmh && input.speedKmh >= 12) {
      this.drawSpiritBirdAndWindTrails(w, h, w / 2 + this.panX, h / 2 + this.panY, input.speedKmh, palette);
    }

    // 10. Hiệu ứng thời tiết mưa & không khí cổ kính
    if (input.weather.raining) {
      this.drawRain(w, h, input.weather.rainIntensity);
    }
    this.drawCompassRose(w, h, palette);

    ctx.restore();
  }

  // ================================================================
  // 1. TẦNG NỀN CUỘN LỤA CỔ TRANG (ANTIQUE SILK SCROLL BASE)
  // ================================================================

          drawAntiqueMapBase(
    w        ,
    h        ,
    palette                    ,
    input             ,
    project                                  ,
    pxPerMeter        ,
  )       {
    const { ctx } = this;

    // 1. Nền cuộn lụa gấm cổ trang với quầng tối viền phong sương (Antique Silk Gradient)
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.85);
    bgGrad.addColorStop(0, palette.parchment);
    bgGrad.addColorStop(1, palette.parchmentTexture);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Hoa văn góc cuộn lụa cổ & Vân mây cổ trang bốn góc (Ancient Scroll Corners)
    const cw = 42 * this.dpr;
    const ch = 42 * this.dpr;
    ctx.strokeStyle = palette.roadMainCasing;
    ctx.lineWidth = 1.6 * this.dpr;

    // Góc trên trái
    ctx.beginPath();
    ctx.moveTo(6 * this.dpr, 6 * this.dpr + ch);
    ctx.lineTo(6 * this.dpr, 6 * this.dpr);
    ctx.lineTo(6 * this.dpr + cw, 6 * this.dpr);
    ctx.stroke();

    // Góc trên phải
    ctx.beginPath();
    ctx.moveTo(w - 6 * this.dpr - cw, 6 * this.dpr);
    ctx.lineTo(w - 6 * this.dpr, 6 * this.dpr);
    ctx.lineTo(w - 6 * this.dpr, 6 * this.dpr + ch);
    ctx.stroke();

    // Góc dưới trái
    ctx.beginPath();
    ctx.moveTo(6 * this.dpr, h - 6 * this.dpr - ch);
    ctx.lineTo(6 * this.dpr, h - 6 * this.dpr);
    ctx.lineTo(6 * this.dpr + cw, h - 6 * this.dpr);
    ctx.stroke();

    // Góc dưới phải
    ctx.beginPath();
    ctx.moveTo(w - 6 * this.dpr - cw, h - 6 * this.dpr);
    ctx.lineTo(w - 6 * this.dpr, h - 6 * this.dpr);
    ctx.lineTo(w - 6 * this.dpr, h - 6 * this.dpr - ch);
    ctx.stroke();
  }

  // ================================================================
  // 2. TẦNG SÔNG LỚN & MẶT NƯỚC TỰ NHIÊN
  // ================================================================

          drawNaturalRivers(
    project                                  ,
    pxPerMeter        ,
    palette                    ,
  )       {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    for (const river of NATURAL_RIVERS) {
      if (river.points.length < 2) continue;

      const screenPts = river.points.map(project);
      const isVisible = screenPts.some(([x, y]) => x >= -100 && x <= w + 100 && y >= -100 && y <= h + 100);
      if (!isVisible) continue;

      ctx.save();
      const riverWidth = Math.max(12 * this.dpr, river.widthMeters * pxPerMeter * 0.85);

      // Đường viền bờ sông
      ctx.strokeStyle = palette.waterStroke;
      ctx.lineWidth = riverWidth + 3 * this.dpr;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(screenPts[0][0], screenPts[0][1]);
      for (let i = 1; i < screenPts.length; i++) {
        const xc = (screenPts[i - 1][0] + screenPts[i][0]) / 2;
        const yc = (screenPts[i - 1][1] + screenPts[i][1]) / 2;
        ctx.quadraticCurveTo(screenPts[i - 1][0], screenPts[i - 1][1], xc, yc);
      }
      ctx.lineTo(screenPts[screenPts.length - 1][0], screenPts[screenPts.length - 1][1]);
      ctx.stroke();

      // Lòng sông màu ngọc bích
      ctx.strokeStyle = palette.waterFill;
      ctx.lineWidth = riverWidth;
      ctx.stroke();

      // Gợn sóng lăn tăn
      ctx.strokeStyle = palette.waterShimmer;
      ctx.lineWidth = 1.2 * this.dpr;
      ctx.setLineDash([8 * this.dpr, 14 * this.dpr]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Tên sông chữ thư pháp cổ
      const midIdx = Math.floor(screenPts.length / 2);
      const [mx, my] = screenPts[midIdx];
      if (mx >= 20 && mx <= w - 20 && my >= 20 && my <= h - 20) {
        ctx.font = `bold ${10 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
        ctx.fillStyle = palette.waterStroke;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`🌊 ${river.name}`, Math.round(mx), Math.round(my));
      }

      ctx.restore();
    }
  }

  // ================================================================
  // 3. TẦNG ĐƯỜNG PHỐ OPENSTREETMAP THỰC TẾ (MULTI-PASS SEAMLESS ROADS)
  // ================================================================

          drawStreetNetwork(
    project                                  ,
    pxPerMeter        ,
    palette                    ,
    input             ,
  )       {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Giới hạn toạ độ vùng nhìn (Viewport Bounding Box) để lọc siêu nhanh
    const margin = 60 * this.dpr;
    const halfSpanLat = ((h / (2 * 0.72) + margin) / pxPerMeter) * metersToLatDegrees(1);
    const halfSpanLon = ((w / 2 + margin) / pxPerMeter) * metersToLonDegrees(1, input.center.lat);
    const centerPanLat = input.center.lat + (this.panY / (pxPerMeter * 0.72)) * metersToLatDegrees(1);
    const centerPanLon = input.center.lon - (this.panX / pxPerMeter) * metersToLonDegrees(1, input.center.lat);

    const vMinLat = centerPanLat - halfSpanLat;
    const vMaxLat = centerPanLat + halfSpanLat;
    const vMinLon = centerPanLon - halfSpanLon;
    const vMaxLon = centerPanLon + halfSpanLon;

    // Lọc các tuyến đường nằm trong tầm mắt
    const visibleRoads                                               = [];

    for (const road of OSM_ROADS) {
      if (road.maxLat < vMinLat || road.minLat > vMaxLat || road.maxLon < vMinLon || road.minLon > vMaxLon) {
        continue;
      }
      const pts                     = road.points.map(([lat, lon]) => project({ lat, lon }));
      visibleRoads.push({ road, pts });
    }

    // Nhóm theo phân cấp đường
    const residential = visibleRoads.filter(r => r.road.type === 'residential' || r.road.type === 'living_street' || r.road.type === 'unclassified');
    const secondary = visibleRoads.filter(r => r.road.type === 'secondary' || r.road.type === 'tertiary');
    const primary = visibleRoads.filter(r => r.road.type === 'primary' || r.road.type === 'trunk' || r.road.type === 'motorway');

    ctx.save();
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';

    // ----------------------------------------------------------------
    // PASS 1: VẼ TOÀN BỘ VIỀN MỰC (ALL CASINGS FIRST — KHỬ TRIỆT ĐỂ ĐỨT KHÚC / CỤC HÌNH THOI)
    // ----------------------------------------------------------------
    // 1.1 Viền mực các lối mòn / ngõ nhỏ
    ctx.strokeStyle = palette.roadTrailCasing;
    for (const { road, pts } of residential) {
      const roadWidth = Math.max(5 * this.dpr, road.widthMeters * pxPerMeter * 0.65);
      ctx.lineWidth = roadWidth + 2.2 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }

    // 1.2 Viền mực đường cấp 2 & 3
    ctx.strokeStyle = palette.roadSecCasing;
    for (const { road, pts } of secondary) {
      const roadWidth = Math.max(8 * this.dpr, road.widthMeters * pxPerMeter * 0.75);
      ctx.lineWidth = roadWidth + 2.8 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }

    // 1.3 Viền mực trục đại lộ chính
    ctx.strokeStyle = palette.roadMainCasing;
    for (const { road, pts } of primary) {
      const roadWidth = Math.max(12 * this.dpr, road.widthMeters * pxPerMeter * 0.85);
      ctx.lineWidth = roadWidth + 3.4 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }

    // ----------------------------------------------------------------
    // PASS 2: VẼ LÒNG ĐƯỜNG TRÊN TẤT CẢ VIỀN MỰC (SEAMLESS FLUSH FILLS)
    // ----------------------------------------------------------------
    // 2.1 Lòng đường lối mòn
    ctx.strokeStyle = palette.roadTrail;
    for (const { road, pts } of residential) {
      const roadWidth = Math.max(5 * this.dpr, road.widthMeters * pxPerMeter * 0.65);
      ctx.lineWidth = roadWidth + 0.6 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }

    // 2.2 Lòng cổ đạo vàng sáng
    ctx.strokeStyle = palette.roadSec;
    for (const { road, pts } of secondary) {
      const roadWidth = Math.max(8 * this.dpr, road.widthMeters * pxPerMeter * 0.75);
      ctx.lineWidth = roadWidth + 0.6 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }

    // 2.3 Lòng đại lộ lát đá hoàng kim sáng ngà
    ctx.strokeStyle = palette.roadMain;
    for (const { road, pts } of primary) {
      const roadWidth = Math.max(12 * this.dpr, road.widthMeters * pxPerMeter * 0.85);
      ctx.lineWidth = roadWidth + 0.6 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }

    // ----------------------------------------------------------------
    // PASS 3: VẠCH CHỈ TIM ĐẠI QUAN ĐẠO
    // ----------------------------------------------------------------
    ctx.strokeStyle = palette.roadMainCasing;
    ctx.lineWidth = 1 * this.dpr;
    ctx.setLineDash([7 * this.dpr, 9 * this.dpr]);
    for (const { road, pts } of primary) {
      if (road.widthMeters >= 24) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // ----------------------------------------------------------------
    // PASS 4: NHÃN TÊN ĐƯỜNG THƯ PHÁP DỌC TRỤC ĐƯỜNG CHÍNH
    // ----------------------------------------------------------------
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    for (const { road, pts } of [...secondary, ...primary]) {
      if (pts.length < 2 || !road.name || road.name === 'Cổ Đạo Hoang Dã' || road.name === 'Lối Nhai Phường Cổ') continue;

      // Tìm đoạn dài nhất trong polyline để đặt chữ thẳng thớm
      let maxLen = 0;
      let bestSegment = [pts[0], pts[1]];
      for (let i = 1; i < pts.length; i++) {
        const segLen = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        if (segLen > maxLen) {
          maxLen = segLen;
          bestSegment = [pts[i - 1], pts[i]];
        }
      }

      if (maxLen < 45 * this.dpr) continue;

      const [p1, p2] = bestSegment;
      const mx = (p1[0] + p2[0]) / 2;
      const my = (p1[1] + p2[1]) / 2;

      if (mx >= 35 && mx <= w - 35 && my >= 35 && my <= h - 35) {
        const angle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
        let normalizedAngle = angle;
        if (normalizedAngle > Math.PI / 2) normalizedAngle -= Math.PI;
        else if (normalizedAngle < -Math.PI / 2) normalizedAngle += Math.PI;

        ctx.save();
        ctx.translate(Math.round(mx), Math.round(my));
        ctx.rotate(normalizedAngle);

        ctx.font = `bold ${8.5 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
        ctx.fillStyle = palette.textInk;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(road.name, 0, -2 * this.dpr);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  // ================================================================
  // 4. LỚP MẶT NƯỚC POI (HỒ GƯƠM, HỒ TÂY, HỒ CÔNG VIÊN)
  // ================================================================

          drawWaterFeature(
    feature            ,
    project                                  ,
    pxPerMeter        ,
    palette                    ,
  )       {
    const { ctx } = this;
    const [rawX, rawY] = project({ lat: feature.lat, lon: feature.lon });
    const x = Math.round(rawX);
    const y = Math.round(rawY);
    const r = Math.min(Math.max(22 * this.dpr, (feature.radiusMeters || 35) * pxPerMeter * 0.65), 75 * this.dpr);

    ctx.save();
    // Bờ hồ uốn lượn cổ
    ctx.fillStyle = palette.waterStroke;
    ctx.beginPath();
    ctx.ellipse(x, y, r + 2.5 * this.dpr, (r + 2.5 * this.dpr) * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mặt hồ xanh ngọc bích
    ctx.fillStyle = palette.waterFill;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();

    // Gợn sóng lăn tăn
    ctx.strokeStyle = palette.waterShimmer;
    ctx.lineWidth = 1.2 * this.dpr;
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y - r * 0.1, r * 0.35, 0, Math.PI * 0.8);
    ctx.stroke();

    // Thẻ tên hồ / Thủy vực sắc nét
    const labelText = `🏞️ ${feature.nameVi}`;
    ctx.font = `bold ${10 * this.dpr}px 'Be Vietnam Pro', system-ui, -apple-system, sans-serif`;
    const labelW = Math.round(ctx.measureText(labelText).width + 18 * this.dpr);
    const labelH = Math.round(20 * this.dpr);
    const pillX = Math.round(x - labelW / 2);
    const pillY = Math.round(y - labelH / 2);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#101c1f';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.4 * this.dpr;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, labelW, labelH, 4 * this.dpr);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e0f2fe';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, x, Math.round(pillY + labelH / 2));

    ctx.restore();
  }

  // ================================================================
  // 4b. LÃNH ĐỊA DÃ THÚ SƯƠNG ĐỎ (RED MIST BEAST TERRITORIES)
  // ================================================================

          drawBeastTerritories(
    project                                  ,
    pxPerMeter        ,
    palette                    ,
  )       {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    for (const terr of HANOI_BEAST_TERRITORIES) {
      const [rawX, rawY] = project({ lat: terr.lat, lon: terr.lon });
      const x = Math.round(rawX);
      const y = Math.round(rawY);
      const radiusPx = terr.radiusMeters * pxPerMeter;

      if (x < -radiusPx || x > w + radiusPx || y < -radiusPx || y > h + radiusPx) continue;

      ctx.save();

      // 1. Quầng Sương Mù Đỏ Thần Bí (Pulsating Red Mist)
      const pulse = Math.sin(this.tick / 15) * 0.15;
      const mistGrad = ctx.createRadialGradient(x, y, radiusPx * 0.2, x, y, radiusPx);
      mistGrad.addColorStop(0, `rgba(225, 29, 72, ${0.35 + pulse})`);
      mistGrad.addColorStop(0.65, `rgba(190, 18, 60, ${0.20 + pulse * 0.5})`);
      mistGrad.addColorStop(1, 'rgba(136, 19, 55, 0)');

      ctx.fillStyle = mistGrad;
      ctx.beginPath();
      ctx.ellipse(x, y, radiusPx, radiusPx * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Viền gai hung hiểm bao quanh lãnh địa
      ctx.strokeStyle = `rgba(244, 63, 94, ${0.55 + pulse})`;
      ctx.lineWidth = 2 * this.dpr;
      ctx.setLineDash([8 * this.dpr, 6 * this.dpr]);
      ctx.beginPath();
      ctx.ellipse(x, y, radiusPx, radiusPx * 0.72, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. Biểu tượng & Thẻ tên Lãnh Địa Quái Thú
      const badgeY = y - radiusPx * 0.6;
      ctx.font = `bold ${10.5 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
      const labelText = `⚠️ ${terr.nameVi} (X${terr.resourceMultiplier} Tài Nguyên)`;
      const labelW = ctx.measureText(labelText).width + 16 * this.dpr;

      ctx.fillStyle = 'rgba(76, 5, 25, 0.92)';
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.4 * this.dpr;
      ctx.beginPath();
      ctx.roundRect(x - labelW / 2, badgeY - 10 * this.dpr, labelW, 20 * this.dpr, 4 * this.dpr);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fecdd3';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, x, badgeY);

      ctx.restore();
    }
  }

  // ================================================================
  // 5. CẮM TRẠI DOANH TRẠI
  // ================================================================

          drawCampBadge(
    pos                  ,
    pxPerMeter        ,
    palette                    ,
  )       {
    const { ctx } = this;
    const [x, y] = pos;
    const rx = Math.round(x);
    const ry = Math.round(y);

    ctx.save();
    // Bóng đổ
    ctx.fillStyle = 'rgba(28, 16, 6, 0.45)';
    ctx.beginPath();
    ctx.ellipse(rx, ry + 8 * this.dpr, 18 * this.dpr, 7 * this.dpr, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trụ cắm trại nổi
    ctx.fillStyle = '#b45309';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2 * this.dpr;
    ctx.beginPath();
    ctx.arc(rx, ry - 6 * this.dpr, 16 * this.dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = `${16 * this.dpr}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏕️', rx, ry - 6 * this.dpr);

    // Nhãn Doanh Trại
    ctx.font = `bold ${9.5 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
    ctx.fillStyle = '#92400e';
    ctx.fillText('Doanh Trại Của Bạn', rx, ry + 18 * this.dpr);

    ctx.restore();
  }

  // ================================================================
  // 6. CÁC ĐỊA ĐIỂM NỔI 3D (CRISP ANCIENT LANDMARK PLAQUES — LÀM NÉT CHỮ)
  // ================================================================

          drawFloatingFeatureBadge(
    feature            ,
    project                                  ,
    pxPerMeter        ,
    input             ,
    palette                    ,
  )       {
    const { ctx } = this;
    const [rawX, rawY] = project({ lat: feature.lat, lon: feature.lon });
    const x = Math.round(rawX);
    const y = Math.round(rawY);
    const w = this.canvas.width;
    const h = this.canvas.height;

    if (x < -80 || x > w + 80 || y < -80 || y > h + 80) return;

    const distToPlayer = Math.round(distanceMeters(input.center, { lat: feature.lat, lon: feature.lon }));
    const inRange = distToPlayer <= Math.max(feature.radiusMeters || 0, 45);
    const isActive = input.activePoiId === feature.id;
    const icon = this.getFeatureIcon(feature);

    // Hiệu ứng bồng bềnh lơ lửng 3D
    const seed = hashSeed(feature.id);
    const bob = Math.sin(this.tick / 10 + seed) * 4 * this.dpr;
    const pulse = 0.6 + 0.4 * Math.sin(this.tick / 7 + seed);
    const badgeY = Math.round(y - 20 * this.dpr + bob);

    ctx.save();

    // 1. Bóng đổ chân trụ xuống mặt đường
    ctx.fillStyle = 'rgba(28, 16, 6, 0.42)';
    ctx.beginPath();
    ctx.ellipse(x, y + 3 * this.dpr, 16 * this.dpr, 6 * this.dpr, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Vòng phát sáng đài sen / trận đồ Bát Quái khi trong tầm
    if (inRange || isActive) {
      const glowGrad = ctx.createRadialGradient(x, y + 2 * this.dpr, 4 * this.dpr, x, y + 2 * this.dpr, 26 * this.dpr);
      glowGrad.addColorStop(0, `rgba(245, 158, 11, ${0.45 * pulse})`);
      glowGrad.addColorStop(0.7, `rgba(180, 83, 9, ${0.15 * pulse})`);
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.ellipse(x, y + 2 * this.dpr, 26 * this.dpr, 10 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(245, 158, 11, ${0.85 * pulse})`;
      ctx.lineWidth = 1.8 * this.dpr;
      ctx.beginPath();
      ctx.ellipse(x, y + 2 * this.dpr, 22 * this.dpr, 8.5 * this.dpr, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 3. Trụ đồng cổ đỡ huy hiệu nổi
    ctx.strokeStyle = inRange ? 'rgba(217, 119, 6, 0.95)' : 'rgba(84, 54, 27, 0.65)';
    ctx.lineWidth = 2 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(x, y + 2 * this.dpr);
    ctx.lineTo(x, badgeY + 14 * this.dpr);
    ctx.stroke();

    // 4. Huy Hiệu Nổi 3D — Thẻ Trúc / Phù Điêu Đồng Cổ
    const radius = Math.round(15 * this.dpr);
    const badgeGrad = ctx.createLinearGradient(x - radius, badgeY - radius, x + radius, badgeY + radius);
    if (inRange || isActive) {
      badgeGrad.addColorStop(0, '#fef08a');
      badgeGrad.addColorStop(0.4, '#d97706');
      badgeGrad.addColorStop(1, '#78350f');
    } else {
      badgeGrad.addColorStop(0, '#e2cb9f');
      badgeGrad.addColorStop(0.5, '#9a7548');
      badgeGrad.addColorStop(1, '#4a3219');
    }

    ctx.fillStyle = badgeGrad;
    ctx.beginPath();
    ctx.arc(x, badgeY, radius, 0, Math.PI * 2);
    ctx.fill();

    // Lòng gỗ gụ / trầm hương
    ctx.fillStyle = inRange ? '#2a1607' : '#1b1006';
    ctx.beginPath();
    ctx.arc(x, badgeY, radius - 2.2 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    // Icon biểu tượng chính giữa
    ctx.font = `${15 * this.dpr}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, x, badgeY);

    // 5. Thẻ Tên Địa Danh Sơn Mài Thếp Vàng — CHỮ CỰC KỲ SẮC NÉT (Crisp Pixel-Aligned Plaque)
    const labelText = `${feature.nameVi}`;
    const distText = `${distToPlayer}m`;

    // Tính toán kích thước thẻ
    ctx.font = `bold ${10.5 * this.dpr}px 'Be Vietnam Pro', system-ui, -apple-system, sans-serif`;
    const labelWidth = ctx.measureText(labelText).width;
    ctx.font = `bold ${9.5 * this.dpr}px 'Be Vietnam Pro', system-ui, -apple-system, sans-serif`;
    const distWidth = ctx.measureText(distText).width;

    const pillW = Math.round(labelWidth + distWidth + 24 * this.dpr);
    const pillH = Math.round(22 * this.dpr);
    const pillX = Math.round(x - pillW / 2);
    const pillY = Math.round(badgeY - radius - pillH - 4 * this.dpr);

    // Xoá mọi bóng mờ trước khi vẽ khung & chữ để chống nhòe
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Nền thẻ sơn mài đen tuyền viền vàng kim sắc sảo
    ctx.fillStyle = inRange ? '#1c0e04' : '#140a03';
    ctx.strokeStyle = inRange ? '#f59e0b' : '#c2934f';
    ctx.lineWidth = 1.6 * this.dpr;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 4 * this.dpr);
    ctx.fill();
    ctx.stroke();

    // Nút đính ngọc hoàng kim 2 đầu thẻ
    ctx.fillStyle = inRange ? '#f59e0b' : '#c2934f';
    ctx.beginPath();
    ctx.arc(pillX + 4.5 * this.dpr, pillY + pillH / 2, 2 * this.dpr, 0, Math.PI * 2);
    ctx.arc(pillX + pillW - 4.5 * this.dpr, pillY + pillH / 2, 2 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    // CHỮ TÊN ĐỊA DANH — NÉT CĂNG TRÊN NỀN ĐEN
    ctx.font = `bold ${10.5 * this.dpr}px 'Be Vietnam Pro', system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = inRange ? '#ffffff' : '#fef08a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, pillX + 9 * this.dpr, Math.round(pillY + pillH / 2));

    // CHỮ KHOẢNG CÁCH MÉT
    ctx.font = `bold ${9.5 * this.dpr}px 'Be Vietnam Pro', system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = inRange ? '#fde047' : '#e2b373';
    ctx.textAlign = 'right';
    ctx.fillText(distText, pillX + pillW - 9 * this.dpr, Math.round(pillY + pillH / 2));

    ctx.restore();
  }

  // ================================================================
  // 7. BẪY THÚ NỔI 3D
  // ================================================================

          drawTraps(
    project                                  ,
    traps              ,
    pxPerMeter        ,
    input             ,
    palette                    ,
  )       {
    const { ctx } = this;
    const now = Date.now();
    const w = this.canvas.width;
    const h = this.canvas.height;

    for (const trap of traps) {
      const [rawX, rawY] = project({ lat: trap.lat, lon: trap.lon });
      const x = Math.round(rawX);
      const y = Math.round(rawY);
      if (x < -40 || x > w + 40 || y < -40 || y > h + 40) continue;

      const isSprung = now >= trap.sprungAt;
      const isStolen = trap.spoiledAt ? now >= trap.spoiledAt : false;
      const distMeters = distanceMeters(input.center, { lat: trap.lat, lon: trap.lon });
      const inRange = distMeters <= 35;

      ctx.save();

      // 1. Bóng đổ
      ctx.fillStyle = 'rgba(28, 16, 6, 0.4)';
      ctx.beginPath();
      ctx.ellipse(x, y + 2 * this.dpr, 10 * this.dpr, 4 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Thân bẫy thú
      ctx.fillStyle = isSprung ? '#9a3412' : '#78350f';
      ctx.strokeStyle = inRange ? '#f59e0b' : '#c2934f';
      ctx.lineWidth = 1.6 * this.dpr;
      ctx.beginPath();
      ctx.arc(x, y - 6 * this.dpr, 12 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Icon bẫy
      ctx.font = `${12 * this.dpr}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const trapIcon = trap.type === 'fish_trap' ? '🐟' : isSprung ? '🥩' : '🪤';
      ctx.fillText(trapIcon, x, y - 6 * this.dpr);

      // Thẻ trạng thái
      ctx.font = `bold ${9 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
      const statusText = isStolen ? 'Bị cắn trộm' : isSprung ? 'Đã sập bẫy' : 'Đang chờ mồi';
      const labelW = Math.round(ctx.measureText(statusText).width + 12 * this.dpr);
      const pillX = Math.round(x - labelW / 2);
      const pillY = Math.round(y + 8 * this.dpr);

      ctx.fillStyle = '#140a03';
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, labelW, 16 * this.dpr, 3 * this.dpr);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isSprung ? '#fde047' : '#e2b373';
      ctx.fillText(statusText, x, Math.round(pillY + 8 * this.dpr));

      ctx.restore();
    }
  }

  // ================================================================
  // 8. VẬT PHẨM RƠI (WORLD DROPS) NỔI 3D
  // ================================================================

          drawFloatingDrops(
    project                                  ,
    drops           ,
    pxPerMeter        ,
    input             ,
    palette                    ,
  )       {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    for (const drop of drops) {
      const [x, y] = project({ lat: drop.lat, lon: drop.lon });
      if (x < -50 || x > w + 50 || y < -50 || y > h + 50) continue;

      const distMeters = distanceMeters(input.center, { lat: drop.lat, lon: drop.lon });
      const inRange = distMeters <= 30;
      const seed = hashSeed(drop.id);
      const bob = Math.sin(this.tick / 8 + seed) * 4 * this.dpr;
      const dy = y - 14 * this.dpr + bob;

      ctx.save();

      // 1. Bóng đổ 3D dưới lòng cổ đạo
      ctx.fillStyle = 'rgba(28, 16, 6, 0.4)';
      ctx.beginPath();
      ctx.ellipse(x, y + 2 * this.dpr, 10 * this.dpr, 4 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Viên ngọc bích / Linh Phù nổi 3D
      const rx = Math.round(x);
      const rdy = Math.round(dy);
      const orbGrad = ctx.createRadialGradient(rx - 3 * this.dpr, rdy - 3 * this.dpr, 2 * this.dpr, rx, rdy, 14 * this.dpr);
      if (inRange) {
        orbGrad.addColorStop(0, '#fef08a');
        orbGrad.addColorStop(0.5, '#f59e0b');
        orbGrad.addColorStop(1, '#9a3412');
      } else {
        orbGrad.addColorStop(0, '#fde68a');
        orbGrad.addColorStop(0.6, '#b45309');
        orbGrad.addColorStop(1, '#451a03');
      }

      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(rx, rdy, 13 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Lòng ngọc trầm
      ctx.fillStyle = inRange ? '#2e1305' : '#1f0d04';
      ctx.beginPath();
      ctx.arc(rx, rdy, 11 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Icon Emoji vật phẩm
      const icon = itemEmoji(drop.itemId);
      ctx.font = `${13 * this.dpr}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, rx, rdy);

      // Thẻ trúc số lượng [Gỗ ×2] — CHỮ SIÊU SẮC NÉT
      ctx.font = `bold ${9.5 * this.dpr}px 'Be Vietnam Pro', system-ui, -apple-system, sans-serif`;
      const dropLabel = `${drop.nameVi} ×${drop.qty}`;
      const dropW = Math.round(ctx.measureText(dropLabel).width + 16 * this.dpr);
      const dropH = Math.round(18 * this.dpr);
      const pillX = Math.round(rx - dropW / 2);
      const pillY = Math.round(rdy + 16 * this.dpr);

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      ctx.fillStyle = inRange ? '#1c0e04' : '#140a03';
      ctx.strokeStyle = inRange ? '#f59e0b' : '#c2934f';
      ctx.lineWidth = 1.4 * this.dpr;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, dropW, dropH, 4 * this.dpr);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = inRange ? '#ffffff' : '#fef08a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dropLabel, rx, Math.round(pillY + dropH / 2));

      ctx.restore();
    }
  }

  // ================================================================
  // 9. NHÂN VẬT DŨNG SĨ HOÀNG CỔ OAI VỆ & SIÊU CHI TIẾT (ĐÔNG SƠN WARRIOR)
  // ================================================================

          drawPlayer(
    x        ,
    y        ,
    pxPerMeter        ,
    input             ,
    palette                    ,
  )       {
    const { ctx } = this;
    const isFemale = input.gender === 'female';
    const bob = Math.sin(this.tick / 8) * 1.8 * this.dpr;
    const py = y + bob;
    const rx = Math.round(x);
    const rpy = Math.round(py);

    ctx.save();

    // 0. Nón ánh sáng định hướng di chuyển (Directional Vision Cone)
    const coneGrad = ctx.createRadialGradient(rx, rpy, 4 * this.dpr, rx, rpy, 36 * this.dpr);
    coneGrad.addColorStop(0, isFemale ? 'rgba(45, 212, 191, 0.40)' : 'rgba(245, 158, 11, 0.40)');
    coneGrad.addColorStop(0.7, isFemale ? 'rgba(15, 118, 110, 0.15)' : 'rgba(180, 83, 9, 0.15)');
    coneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = coneGrad;
    ctx.beginPath();
    ctx.moveTo(rx, rpy);
    ctx.arc(rx, rpy, 38 * this.dpr, -Math.PI * 0.75, -Math.PI * 0.25);
    ctx.closePath();
    ctx.fill();

    // 0b. ĐUỐC LỬA BAN ĐÊM: Vòng Hào Quang Ấm Áp 3D xua đuổi dã thú bóng tối
    if (input.hasTorch && input.isNight) {
      const torchGrad = ctx.createRadialGradient(rx, Math.round(y), 8 * this.dpr, rx, Math.round(y), 32 * pxPerMeter);
      torchGrad.addColorStop(0, 'rgba(251, 146, 60, 0.45)');
      torchGrad.addColorStop(0.5, 'rgba(234, 88, 12, 0.22)');
      torchGrad.addColorStop(0.85, 'rgba(194, 65, 12, 0.08)');
      torchGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = torchGrad;
      ctx.beginPath();
      ctx.ellipse(rx, Math.round(y), 32 * pxPerMeter, 32 * pxPerMeter * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 1. Vòng Radar tương tác 30m (bán kính nhặt tài nguyên)
    ctx.strokeStyle = isFemale ? 'rgba(45, 212, 191, 0.65)' : 'rgba(217, 119, 6, 0.65)';
    ctx.lineWidth = 1.8 * this.dpr;
    ctx.setLineDash([6 * this.dpr, 6 * this.dpr]);
    ctx.beginPath();
    ctx.ellipse(rx, Math.round(y), 30 * pxPerMeter, 30 * pxPerMeter * 0.72, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Sóng Radar định vị toả rộng êm ái
    const beaconTime = (this.tick % 40) / 40;
    const beaconR = (14 + beaconTime * 30) * this.dpr;
    ctx.strokeStyle = isFemale
      ? `rgba(45, 212, 191, ${0.75 * (1 - beaconTime)})`
      : `rgba(245, 158, 11, ${0.75 * (1 - beaconTime)})`;
    ctx.lineWidth = 2 * this.dpr;
    ctx.beginPath();
    ctx.ellipse(rx, Math.round(y), beaconR, beaconR * 0.72, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Bóng đổ 3D dưới đất
    ctx.fillStyle = 'rgba(28, 16, 6, 0.48)';
    ctx.beginPath();
    ctx.ellipse(rx, Math.round(y + 12 * this.dpr), 16 * this.dpr, 7 * this.dpr, 0, 0, Math.PI * 2);
    ctx.fill();

    if (isFemale) {
      // ==================== NỮ THÁNH NỮ HOÀNG CỔ (CHI TIẾT CAO CẤP) ====================
      // 1. Áo choàng lụa xanh ngọc bay sau lưng
      ctx.fillStyle = '#065f46';
      ctx.beginPath();
      ctx.moveTo(rx - 8 * this.dpr, rpy - 6 * this.dpr);
      ctx.lineTo(rx + 8 * this.dpr, rpy - 6 * this.dpr);
      ctx.quadraticCurveTo(rx + 14 * this.dpr, rpy + 15 * this.dpr, rx + 9 * this.dpr, rpy + 18 * this.dpr);
      ctx.quadraticCurveTo(rx, rpy + 14 * this.dpr, rx - 9 * this.dpr, rpy + 18 * this.dpr);
      ctx.quadraticCurveTo(rx - 14 * this.dpr, rpy + 15 * this.dpr, rx - 8 * this.dpr, rpy - 6 * this.dpr);
      ctx.fill();

      // 2. Chân thon bọc giáp xà cạp ngọc
      ctx.fillStyle = '#b47b52';
      ctx.fillRect(rx - 5.5 * this.dpr, rpy + 6 * this.dpr, 3.8 * this.dpr, 10 * this.dpr);
      ctx.fillRect(rx + 1.8 * this.dpr, rpy + 6 * this.dpr, 3.8 * this.dpr, 10 * this.dpr);
      ctx.strokeStyle = '#2dd4bf';
      ctx.lineWidth = 1.2 * this.dpr;
      ctx.strokeRect(rx - 5.5 * this.dpr, rpy + 9 * this.dpr, 3.8 * this.dpr, 4 * this.dpr);
      ctx.strokeRect(rx + 1.8 * this.dpr, rpy + 9 * this.dpr, 3.8 * this.dpr, 4 * this.dpr);

      // 3. Váy Yếm Thổ Cẩm Lạc Việt
      ctx.fillStyle = '#0f766e';
      ctx.beginPath();
      ctx.moveTo(rx - 8 * this.dpr, rpy + 7 * this.dpr);
      ctx.lineTo(rx + 8 * this.dpr, rpy + 7 * this.dpr);
      ctx.lineTo(rx + 10 * this.dpr, rpy + 12 * this.dpr);
      ctx.lineTo(rx + 6.5 * this.dpr, rpy - 5 * this.dpr);
      ctx.lineTo(rx - 6.5 * this.dpr, rpy - 5 * this.dpr);
      ctx.lineTo(rx - 10 * this.dpr, rpy + 12 * this.dpr);
      ctx.closePath();
      ctx.fill();

      // Hoa văn viền yếm thêu vàng
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.4 * this.dpr;
      ctx.stroke();

      // 4. Đai thắt lưng ngọc bích & ngọc bội rủ
      ctx.fillStyle = '#14b8a6';
      ctx.fillRect(rx - 8 * this.dpr, rpy + 1.5 * this.dpr, 16 * this.dpr, 3 * this.dpr);
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(rx, rpy + 3 * this.dpr, 2.5 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // 5. Trượng Thần Đài Sen Ngọc Bích (Held Staff)
      const staffX = rx + 12 * this.dpr;
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2.4 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(staffX, rpy - 18 * this.dpr);
      ctx.lineTo(staffX, rpy + 13 * this.dpr);
      ctx.stroke();

      // Đài sen ngọc bích phát sáng
      ctx.fillStyle = '#2dd4bf';
      ctx.beginPath();
      ctx.arc(staffX, rpy - 18 * this.dpr, 5 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(staffX, rpy - 18 * this.dpr, 2.5 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // 6. Gương mặt thanh tú & Suối tóc mây
      ctx.fillStyle = '#140c06';
      ctx.beginPath();
      ctx.ellipse(rx - 9 * this.dpr, rpy - 2 * this.dpr, 3.5 * this.dpr, 10 * this.dpr, 0.2, 0, Math.PI * 2);
      ctx.ellipse(rx + 9 * this.dpr, rpy - 2 * this.dpr, 3.5 * this.dpr, 10 * this.dpr, -0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#c58e65';
      ctx.beginPath();
      ctx.arc(rx, rpy - 9 * this.dpr, 6.8 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Đôi mắt thánh nữ
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(rx - 2.5 * this.dpr, rpy - 9.5 * this.dpr, 1.2 * this.dpr, 0, Math.PI * 2);
      ctx.arc(rx + 2.5 * this.dpr, rpy - 9.5 * this.dpr, 1.2 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Trâm cài tóc phượng hoàng ngọc lục bảo
      ctx.fillStyle = '#0d9488';
      ctx.beginPath();
      ctx.moveTo(rx + 4 * this.dpr, rpy - 12 * this.dpr);
      ctx.quadraticCurveTo(rx + 13 * this.dpr, rpy - 22 * this.dpr, rx + 10 * this.dpr, rpy - 10 * this.dpr);
      ctx.fill();
    } else {
      // ==================== NAM DŨNG SĨ ĐÔNG SƠN (SIÊU CHI TIẾT) ====================
      // 1. Áo choàng da hổ dũng mãnh viền lông thú
      ctx.fillStyle = '#7c2d12';
      ctx.beginPath();
      ctx.moveTo(rx - 9 * this.dpr, rpy - 6 * this.dpr);
      ctx.lineTo(rx + 9 * this.dpr, rpy - 6 * this.dpr);
      ctx.quadraticCurveTo(rx + 16 * this.dpr, rpy + 16 * this.dpr, rx + 10 * this.dpr, rpy + 19 * this.dpr);
      ctx.quadraticCurveTo(rx, rpy + 14 * this.dpr, rx - 10 * this.dpr, rpy + 19 * this.dpr);
      ctx.quadraticCurveTo(rx - 16 * this.dpr, rpy + 16 * this.dpr, rx - 9 * this.dpr, rpy - 6 * this.dpr);
      ctx.fill();

      // Viền lông trắng áo choàng
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1.8 * this.dpr;
      ctx.stroke();

      // 2. Đôi chân chiến binh cơ bắp & Giáp xà cạp đồng cổ
      ctx.fillStyle = '#a1653d';
      ctx.fillRect(rx - 7 * this.dpr, rpy + 6 * this.dpr, 5 * this.dpr, 10 * this.dpr);
      ctx.fillRect(rx + 2 * this.dpr, rpy + 6 * this.dpr, 5 * this.dpr, 10 * this.dpr);
      
      // Xà cạp đai đồng bảo hộ chân
      ctx.fillStyle = '#d97706';
      ctx.fillRect(rx - 7 * this.dpr, rpy + 8 * this.dpr, 5 * this.dpr, 5 * this.dpr);
      ctx.fillRect(rx + 2 * this.dpr, rpy + 8 * this.dpr, 5 * this.dpr, 5 * this.dpr);

      // 3. Khố Chiến Binh Da Thú Thêu Hoa Văn Đông Sơn
      ctx.fillStyle = '#831843';
      ctx.beginPath();
      ctx.moveTo(rx - 8 * this.dpr, rpy + 1 * this.dpr);
      ctx.lineTo(rx + 8 * this.dpr, rpy + 1 * this.dpr);
      ctx.lineTo(rx + 6.5 * this.dpr, rpy + 9 * this.dpr);
      ctx.lineTo(rx - 6.5 * this.dpr, rpy + 9 * this.dpr);
      ctx.closePath();
      ctx.fill();

      // Thắt lưng da bản to & Mặt khóa đồng tròn
      ctx.fillStyle = '#451a03';
      ctx.fillRect(rx - 8.5 * this.dpr, rpy + 1 * this.dpr, 17 * this.dpr, 3.5 * this.dpr);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(rx, rpy + 2.8 * this.dpr, 3 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // 4. Giáp Ngực Hộ Tâm Phiến Mặt Trời Đông Sơn (Bronze Solar Breastplate)
      ctx.fillStyle = '#b87a4b';
      ctx.beginPath();
      ctx.arc(rx, rpy - 3 * this.dpr, 7.8 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Tấm đồng hộ tâm mạ vàng chạm 8 tia sáng mặt trời Đông Sơn
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.arc(rx, rpy - 3 * this.dpr, 5.5 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.4 * this.dpr;
      ctx.stroke();

      // Tâm điểm mặt trời rực sáng
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(rx, rpy - 3 * this.dpr, 2.2 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // 5. Giáp vai đồng hai bên chạm hình chim Lạc (Pauldrons)
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(rx - 8 * this.dpr, rpy - 4.5 * this.dpr, 4.5 * this.dpr, 0, Math.PI * 2);
      ctx.arc(rx + 8 * this.dpr, rpy - 4.5 * this.dpr, 4.5 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.2 * this.dpr;
      ctx.stroke();

      // 6. Khiên Tròn Đồng Đông Sơn cầm tay trái (Sun Disc Bronze Shield)
      const shieldX = rx - 12 * this.dpr;
      const shieldY = rpy - 2 * this.dpr;
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(shieldX, shieldY, 8.5 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(shieldX, shieldY, 7 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.4 * this.dpr;
      ctx.beginPath();
      ctx.arc(shieldX, shieldY, 4.5 * this.dpr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(shieldX, shieldY, 2 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // 7. Thần Thương Mũi Đôi Đồng Cổ tay phải (Ancient Spear)
      const spearX = rx + 13 * this.dpr;
      ctx.strokeStyle = '#3b1806';
      ctx.lineWidth = 2.6 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(spearX, rpy - 20 * this.dpr);
      ctx.lineTo(spearX, rpy + 14 * this.dpr);
      ctx.stroke();

      // Tua cờ đỏ dưới ngọn giáo
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(spearX - 2 * this.dpr, rpy - 16 * this.dpr);
      ctx.lineTo(spearX + 4 * this.dpr, rpy - 14 * this.dpr);
      ctx.lineTo(spearX - 1 * this.dpr, rpy - 11 * this.dpr);
      ctx.fill();

      // Mũi giáo đồng 2 ngạnh Lạc Việt mạ vàng sắc nhọn
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(spearX, rpy - 26 * this.dpr);
      ctx.lineTo(spearX - 4 * this.dpr, rpy - 18 * this.dpr);
      ctx.lineTo(spearX, rpy - 19.5 * this.dpr);
      ctx.lineTo(spearX + 4 * this.dpr, rpy - 18 * this.dpr);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1.2 * this.dpr;
      ctx.stroke();

      // 8. Khuôn mặt dũng tướng kiên nghị & Tóc búi cao
      ctx.fillStyle = '#140c06';
      ctx.beginPath();
      ctx.arc(rx, rpy - 13 * this.dpr, 7 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#c58e65';
      ctx.beginPath();
      ctx.arc(rx, rpy - 10 * this.dpr, 6.8 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Đôi mắt chiến binh dũng mãnh & Vệt xăm văn thân Lạc Việt
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(rx - 2.6 * this.dpr, rpy - 10.5 * this.dpr, 1.3 * this.dpr, 0, Math.PI * 2);
      ctx.arc(rx + 2.6 * this.dpr, rpy - 10.5 * this.dpr, 1.3 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Vệt xăm đỏ trên má
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(rx - 5.2 * this.dpr, rpy - 8.5 * this.dpr, 2.2 * this.dpr, 1.2 * this.dpr);
      ctx.fillRect(rx + 3 * this.dpr, rpy - 8.5 * this.dpr, 2.2 * this.dpr, 1.2 * this.dpr);

      // Băng trán đồng Đông Sơn
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(rx - 7 * this.dpr, rpy - 13 * this.dpr, 14 * this.dpr, 2.8 * this.dpr);
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(rx, rpy - 11.6 * this.dpr, 1.8 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // 9. Mũ Lông Chim Lạc Việt 3 Tầng Ngũ Sắc Vương Giả (3-Tiered Feathers)
      const featherSway = Math.sin(this.tick / 6) * 1.5 * this.dpr;

      // Lông giữa cao vút màu đỏ son & ngà
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(rx - 2.5 * this.dpr, rpy - 13 * this.dpr);
      ctx.quadraticCurveTo(rx + featherSway, rpy - 27 * this.dpr, rx + 1 * this.dpr + featherSway, rpy - 28 * this.dpr);
      ctx.quadraticCurveTo(rx + 3 * this.dpr + featherSway, rpy - 20 * this.dpr, rx + 2.5 * this.dpr, rpy - 13 * this.dpr);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(rx + 1 * this.dpr + featherSway, rpy - 28 * this.dpr, 2 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Lông trái màu vàng kim
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(rx - 4 * this.dpr, rpy - 13 * this.dpr);
      ctx.quadraticCurveTo(rx - 9 * this.dpr + featherSway, rpy - 23 * this.dpr, rx - 7 * this.dpr + featherSway, rpy - 24 * this.dpr);
      ctx.quadraticCurveTo(rx - 3 * this.dpr, rpy - 18 * this.dpr, rx - 1.5 * this.dpr, rpy - 13 * this.dpr);
      ctx.fill();

      // Lông phải màu xanh ngọc bích
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.moveTo(rx + 1.5 * this.dpr, rpy - 13 * this.dpr);
      ctx.quadraticCurveTo(rx + 9 * this.dpr + featherSway, rpy - 23 * this.dpr, rx + 7 * this.dpr + featherSway, rpy - 24 * this.dpr);
      ctx.quadraticCurveTo(rx + 4 * this.dpr, rpy - 18 * this.dpr, rx + 4 * this.dpr, rpy - 13 * this.dpr);
      ctx.fill();
    }

    ctx.restore();
  }

  // ================================================================
  // 10. LA BÀN BÁT QUÁI BẢN ĐỒ CỔ & TRIỆN SON
  // ================================================================

          drawCompassRose(w        , h        , palette                    )       {
    const { ctx } = this;
    const cx = w - 32 * this.dpr;
    const cy = 36 * this.dpr;
    const r = 16 * this.dpr;

    ctx.save();
    // Vòng hoa la bàn Bát Quái cổ
    ctx.strokeStyle = palette.roadMainCasing;
    ctx.lineWidth = 1.6 * this.dpr;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = palette.gridLine;
    ctx.lineWidth = 1 * this.dpr;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 3 * this.dpr, 0, Math.PI * 2);
    ctx.stroke();

    // Mũi tên chỉ Bắc son đỏ
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.moveTo(cx, cy - r + 2 * this.dpr);
    ctx.lineTo(cx - 4 * this.dpr, cy);
    ctx.lineTo(cx + 4 * this.dpr, cy);
    ctx.closePath();
    ctx.fill();

    // Mũi tên chỉ Nam mực đen
    ctx.fillStyle = '#523318';
    ctx.beginPath();
    ctx.moveTo(cx, cy + r - 2 * this.dpr);
    ctx.lineTo(cx - 4 * this.dpr, cy);
    ctx.lineTo(cx + 4 * this.dpr, cy);
    ctx.closePath();
    ctx.fill();

    ctx.font = `bold ${8 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
    ctx.fillStyle = '#b91c1c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Bắc', cx, cy - r - 1 * this.dpr);

    // Con dấu triện son ở góc đối diện (Góc trên bên trái)
    const sealX = 14 * this.dpr;
    const sealY = 14 * this.dpr;
    const sealS = 18 * this.dpr;
    ctx.strokeStyle = palette.sealRed;
    ctx.lineWidth = 1.2 * this.dpr;
    ctx.beginPath();
    ctx.rect(sealX, sealY, sealS, sealS);
    ctx.stroke();
    ctx.font = `bold ${7 * this.dpr}px 'Be Vietnam Pro', serif`;
    ctx.fillStyle = palette.sealRed;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Hoàng', sealX + sealS / 2, sealY + sealS * 0.32);
    ctx.fillText('Cổ', sealX + sealS / 2, sealY + sealS * 0.72);

    ctx.restore();
  }

          drawSpiritBirdAndWindTrails(
    w        ,
    h        ,
    rx        ,
    rpy        ,
    speedKmh        ,
    palette                    ,
  )       {
    const { ctx } = this;
    ctx.save();

    // 1. Vệt gió lướt thần tốc (Speed Wind Streaks) dọc theo màn hình
    const streakCount = Math.min(18, Math.round(speedKmh / 3));
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.45)';
    ctx.lineWidth = 1.4 * this.dpr;
    for (let i = 0; i < streakCount; i++) {
      const sx = (this.tick * 18 + i * 73) % w;
      const sy = (this.tick * 8 + i * 47) % h;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - (20 + speedKmh * 0.8) * this.dpr, sy + (6 + speedKmh * 0.2) * this.dpr);
      ctx.stroke();
    }

    // 2. Linh Điểu Hoàng Cổ (Spirit Falcon) bay lượn trên cao bên cạnh người chơi
    const birdAngle = (this.tick / 15) % (Math.PI * 2);
    const birdDist = 32 * this.dpr;
    const birdX = rx + Math.cos(birdAngle) * birdDist + 18 * this.dpr;
    const birdY = rpy - 38 * this.dpr + Math.sin(birdAngle * 1.5) * 8 * this.dpr;
    const wingFlap = Math.sin(this.tick / 3.5) * 12 * this.dpr;

    // Hào quang linh điểu phát sáng
    const aura = ctx.createRadialGradient(birdX, birdY, 2 * this.dpr, birdX, birdY, 22 * this.dpr);
    aura.addColorStop(0, 'rgba(254, 240, 138, 0.85)');
    aura.addColorStop(0.5, 'rgba(245, 158, 11, 0.4)');
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(birdX, birdY, 22 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    // Thân Linh Điểu
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.ellipse(birdX, birdY, 9 * this.dpr, 4.5 * this.dpr, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Cánh Linh Điểu sải rộng rực lửa
    ctx.fillStyle = '#f59e0b';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.2 * this.dpr;

    // Cánh trái
    ctx.beginPath();
    ctx.moveTo(birdX - 2 * this.dpr, birdY);
    ctx.quadraticCurveTo(birdX - 16 * this.dpr, birdY - wingFlap, birdX - 18 * this.dpr, birdY - wingFlap - 4 * this.dpr);
    ctx.lineTo(birdX - 5 * this.dpr, birdY + 3 * this.dpr);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cánh phải
    ctx.beginPath();
    ctx.moveTo(birdX + 2 * this.dpr, birdY);
    ctx.quadraticCurveTo(birdX + 16 * this.dpr, birdY - wingFlap, birdX + 18 * this.dpr, birdY - wingFlap - 4 * this.dpr);
    ctx.lineTo(birdX + 5 * this.dpr, birdY + 3 * this.dpr);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Đầu và mỏ vàng
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(birdX + 7 * this.dpr, birdY - 2 * this.dpr, 3.5 * this.dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(birdX + 9 * this.dpr, birdY - 2 * this.dpr);
    ctx.lineTo(birdX + 14 * this.dpr, birdY - 1 * this.dpr);
    ctx.lineTo(birdX + 9 * this.dpr, birdY);
    ctx.closePath();
    ctx.fill();

    // Đuôi phượng hoàng xòe 3 nhánh
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 1.6 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(birdX - 7 * this.dpr, birdY + 1 * this.dpr);
    ctx.lineTo(birdX - 18 * this.dpr, birdY + 6 * this.dpr);
    ctx.moveTo(birdX - 7 * this.dpr, birdY + 1 * this.dpr);
    ctx.lineTo(birdX - 17 * this.dpr, birdY + 11 * this.dpr);
    ctx.stroke();

    // Thẻ trạng thái du hành viễn chinh
    const speedTag = `🦅 LINH ĐIỂU VIỄN CHINH • ${Math.round(speedKmh)} KM/H`;
    ctx.font = `bold ${8.5 * this.dpr}px 'Be Vietnam Pro', system-ui, sans-serif`;
    const tagW = Math.round(ctx.measureText(speedTag).width + 16 * this.dpr);
    const tagH = Math.round(18 * this.dpr);
    const tagX = Math.round(birdX - tagW / 2);
    const tagY = Math.round(birdY - 24 * this.dpr);

    ctx.fillStyle = '#1c0e04';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.4 * this.dpr;
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, tagW, tagH, 4 * this.dpr);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(speedTag, birdX, Math.round(tagY + tagH / 2));

    ctx.restore();
  }

          drawRain(w        , h        , intensity        )       {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 1.2 * this.dpr;
    const dropCount = Math.round(40 * intensity);
    for (let i = 0; i < dropCount; i++) {
      const rx = (this.tick * 9 + i * 47) % w;
      const ry = (this.tick * 14 + i * 79) % h;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 4 * this.dpr, ry + 12 * this.dpr);
      ctx.stroke();
    }
    ctx.restore();
  }

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
    if (fid.includes('bus') || name.includes('Xe Buýt') || name.includes('Bến Xe') || name.includes('Vịnh Xén Hè') || fid.includes('outpost') || name.includes('Tiền Đồn') || name.includes('Trạm Dừng')) return '🚏';
    if (fid.startsWith('den_fox') || name.includes('Tổ Cáo')) return '🦊';
    if (fid.startsWith('den_rabbit') || name.includes('Bãi Thỏ')) return '🐇';
    if (fid.startsWith('den_hedgehog') || name.includes('Tổ Nhím')) return '🦔';
    if (fid.startsWith('den_snake') || name.includes('Ổ Rắn') || name.includes('Mãng Xà')) return '🐍';
    if (fid.startsWith('den_boar') || name.includes('Lợn Rừng')) return '🐗';
    if (fid.startsWith('den_deer') || name.includes('Hươu')) return '🦌';
    if (fid.startsWith('den_wolf') || name.includes('Sói')) return '🐺';
    if (fid.startsWith('den_tiger') || name.includes('Hổ')) return '🐅';
    if (fid.startsWith('den_bear') || name.includes('Gấu')) return '🐻';
    if (fid.startsWith('den_') || name.includes('Hang') || name.includes('Động')) return '🪨';
    if (name.includes('Vườn Hoa') || name.includes('Công Viên')) return '🌳';
    if (fid.includes('pharm') || name.includes('Long Châu') || name.includes('Pharmacity') || name.includes('Nhà Thuốc') || name.includes('Thần Dược')) return '💊';
    if (name.includes('Y Viện') || name.includes('Thảo Dược') || name.includes('Bạch Mai') || name.includes('198')) return '🌿';
    if (name.includes('Học Viện') || name.includes('Tri Thức') || name.includes('Đại Học')) return '📜';
    if (name.includes('Đấu Trường') || name.includes('Mỹ Đình') || name.includes('Sân Vận Động')) return '🏟️';
    if (name.includes('Trạm Lữ Khách') || name.includes('Lữ Điểm')) return '🏕️';
    if (name.includes('Vàng') || fid.includes('gold')) return '🪙';
    if (name.includes('Than') || name.includes('Quặng') || name.includes('Sắt') || fid.includes('iron')) return '⛏️';
    if (name.includes('Hươu') || fid.includes('deer')) return '🦌';
    if (name.includes('Cự Mộc') || fid.startsWith('cl_')) return '🌳';
    if (name.includes('Đất Sét') || fid.includes('clay')) return '🏺';
    if (name.includes('Tháp') || name.includes('Keangnam') || name.includes('Lotte') || name.includes('Dolphin') || name.includes('Discovery')) return '🗼';
    if (name.includes('Long Cốt') || name.includes('Cầu')) return '🐉';
    if (feature.zone === 'forest') return '🌲';
    if (feature.zone === 'water') return '💧';
    if (feature.zone === 'merchant') return '🏛️';
    return '⛰️';
  }
}

/** Chuyển toạ độ chạm trên canvas thành POI gần nhất — cho phép bấm vào cảnh vật. */
export function featureAtPoint(
  features              ,
  center        ,
  point                          ,
  canvas                   ,
  spanMeters = 135,
)                    {
  const TILT_Y = 0.72;
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

