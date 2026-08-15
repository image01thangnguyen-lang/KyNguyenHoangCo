/**
 * Thế giới offline (§4.2 bản 2.0).
 *
 * Hai lớp dữ liệu, xếp chồng lên nhau:
 *
 *  1. LỚP THỦ TỤC — luôn có, ở mọi nơi trên Trái Đất, không cần tải gì.
 *     Mặt đất chia thành ô 200 m; mỗi ô được gán vùng bằng hàm băm toạ độ. Cùng một ô
 *     luôn cho cùng một vùng, trên mọi máy, mãi mãi. Đây là lớp bảo đảm người chơi ở nông
 *     thôn hoặc chưa tải gói dữ liệu vẫn chơi được đầy đủ (§11).
 *
 *  2. LỚP GÓI POI — dữ liệu OSM lọc sẵn lúc build, đóng theo tỉnh/thành, tải một lần.
 *     Khi có gói, POI thật (công viên, hồ, siêu thị) đè lên lớp thủ tục và cho trải nghiệm
 *     "thế giới thật là bản đồ" đúng nghĩa.
 *
 * Không hàm nào trong module này gọi mạng.
 */

import { POI, ZONES } from './balance.js';
import { createRng, hashSeed, pickWeighted } from './rng.js';
import { HANOI_BUS_STOPS } from './busStopsData.js';
import { HANOI_BEAST_DENS } from './beasts.js';

export const EARTH_RADIUS_M = 6_371_000;
const METERS_PER_DEGREE_LAT = 111_320;

                         
              
              
 

/** Khoảng cách haversine, mét. */
export function distanceMeters(a        , b        )         {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const lat1 = a.lat * toRad;
  const lat2 = b.lat * toRad;

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Quy đổi mét sang độ kinh tuyến tại một vĩ độ — dùng cho lưới ô và cho renderer bản đồ. */
export function metersToLonDegrees(meters        , atLat        )         {
  const scale = Math.cos((atLat * Math.PI) / 180);
  return meters / (METERS_PER_DEGREE_LAT * Math.max(0.01, scale));
}

export function metersToLatDegrees(meters        )         {
  return meters / METERS_PER_DEGREE_LAT;
}

// ------------------------------------------------------------------ lưới ô

                           
             
              
              
                    
                    
                     
 

/**
 * Ô lưới chứa một toạ độ.
 *
 * Hàng chia đều theo vĩ độ; cột chia theo kinh độ đã bù cos(vĩ độ) của TÂM HÀNG (không phải
 * của điểm) — nhờ vậy mọi ô trong cùng một hàng rộng bằng nhau và id ô ổn định tuyệt đối.
 */
export function cellAt(lat        , lon        , sizeMeters = POI.wildernessGrid.cellSizeMeters)           {
  const latStep = metersToLatDegrees(sizeMeters);
  const row = Math.floor(lat / latStep);
  const rowCenterLat = (row + 0.5) * latStep;

  const lonStep = metersToLonDegrees(sizeMeters, rowCenterLat);
  const col = Math.floor(lon / lonStep);

  return {
    id: `${sizeMeters}/${row}/${col}`,
    row,
    col,
    centerLat: rowCenterLat,
    centerLon: (col + 0.5) * lonStep,
    sizeMeters,
  };
}

export function cellById(id        )                  {
  const parts = id.split('/');
  if (parts.length !== 3) return null;
  const sizeMeters = Number(parts[0]);
  const row = Number(parts[1]);
  const col = Number(parts[2]);
  if (!Number.isFinite(sizeMeters) || !Number.isFinite(row) || !Number.isFinite(col)) return null;

  const latStep = metersToLatDegrees(sizeMeters);
  const rowCenterLat = (row + 0.5) * latStep;
  const lonStep = metersToLonDegrees(sizeMeters, rowCenterLat);

  return {
    id,
    row,
    col,
    centerLat: rowCenterLat,
    centerLon: (col + 0.5) * lonStep,
    sizeMeters,
  };
}

/** Vùng thủ tục của một ô — xác định, giống nhau trên mọi máy. */
export function proceduralZone(cell          )         {
  const weights = POI.wildernessGrid.proceduralZoneWeights                          ;
  const entries = (Object.keys(weights)            )
    .filter((zone) => typeof weights[zone] === 'number')
    .map((zone) => ({ zone, weight: weights[zone]           }));

  const rng = createRng(hashSeed('zone', cell.id));
  return pickWeighted(rng, entries).zone;
}

// ------------------------------------------------------------------ gói POI offline

                           
             
               
                 
              
              
                       
 

                          
                        
                   
                 
                                         
                   
                                                                                        
                                   
 

export function indexKeyFor(lat        , lon        )         {
  return cellAt(lat, lon, POI.pack.indexCellSizeMeters).id;
}

/** Dựng chỉ mục cho gói vừa nạp (tool đóng gói cũng dùng chính hàm này). */
export function buildPackIndex(pack         )          {
  const index                           = {};
  pack.pois.forEach((poi, i) => {
    const key = indexKeyFor(poi.lat, poi.lon);
    (index[key] ??= []).push(i);
  });
  return { ...pack, index };
}

export function validatePack(pack         )           {
  const errors           = [];
  if (pack.formatVersion !== POI.pack.formatVersion) {
    errors.push(`Gói "${pack.regionId}" dùng formatVersion ${pack.formatVersion}, game cần ${POI.pack.formatVersion}`);
  }
  for (const poi of pack.pois) {
    if (!(poi.zone in ZONES)) errors.push(`POI "${poi.id}" có vùng lạ "${poi.zone}"`);
    if (!Number.isFinite(poi.lat) || !Number.isFinite(poi.lon)) {
      errors.push(`POI "${poi.id}" có toạ độ không hợp lệ`);
    }
  }
  return errors;
}

/** POI trong bán kính quanh một toạ độ, sắp xếp theo khoảng cách tăng dần. */
export function poisNear(
  pack                ,
  at        ,
  radiusMeters = POI.queryRadiusMeters,
)                                            {
  if (!pack) return [];

  const candidates = new Set        ();
  if (pack.index) {
    // Quét 3×3 ô chỉ mục quanh vị trí: ô 500 m nên bán kính 500 m luôn nằm gọn trong đó.
    const latStep = metersToLatDegrees(POI.pack.indexCellSizeMeters);
    const lonStep = metersToLonDegrees(POI.pack.indexCellSizeMeters, at.lat);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const key = indexKeyFor(at.lat + dr * latStep, at.lon + dc * lonStep);
        for (const i of pack.index[key] ?? []) candidates.add(i);
      }
    }
  } else {
    pack.pois.forEach((_, i) => candidates.add(i));
  }

  const out                                            = [];
  for (const i of candidates) {
    const poi = pack.pois[i];
    if (!poi) continue;
    const d = distanceMeters(at, poi);
    if (d <= radiusMeters) out.push({ ...poi, distanceMeters: d });
  }

  out.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return out.slice(0, POI.maxPoisPerQuery);
}

// ------------------------------------------------------------------ vùng người chơi đang đứng

                               
                 
                                         
               
                     
                                                   
                             
                                                                         
                      
                           
                                                    
                                                                                     
                        
 

/**
 * Xác định người chơi đang ở vùng nào.
 *
 * Thứ tự ưu tiên: đang đứng TRONG một POI thật → vùng của POI đó. Không thì rơi về lớp
 * thủ tục của ô 200 m. Lớp thủ tục dùng hệ số 1,2× (§4.2) để bù cho việc không có POI —
 * người chơi nông thôn không bao giờ thiệt hơn người chơi thành phố.
 */
export function locationAt(at        , pack                 = null)               {
  const cell = cellAt(at.lat, at.lon);
  const nearby = poisNear(pack, at);
  const inside = nearby.find((poi) => poi.distanceMeters <= Math.max(poi.radiusMeters, 60)) ?? null;

  if (inside) {
    return {
      cell,
      zone: inside.zone,
      zoneNameVi: ZONES[inside.zone].nameVi,
      insidePoi: inside,
      procedural: false,
      pickupMultiplier: ZONES[inside.zone].pickupMultiplier,
      nearby,
      explanationVi: `Bạn đang ở ${inside.nameVi} — ${ZONES[inside.zone].nameVi}.`,
    };
  }

  const sparse = nearby.length < POI.wildernessGrid.activateWhenPoiCountBelow;
  const zone         = sparse ? 'wilderness' : 'trail';

  return {
    cell,
    zone,
    zoneNameVi: ZONES[zone].nameVi,
    insidePoi: null,
    procedural: true,
    pickupMultiplier: ZONES[zone].pickupMultiplier,
    nearby,
    explanationVi: sparse
      ? `Quanh đây thưa dấu vết người xưa. Vùng hoang dã bù lại hệ số ${ZONES.wilderness.pickupMultiplier}×.`
      : 'Bạn đang trên đường mòn hoang dã. Cứ 100 bước là một lượt nhặt.',
  };
}

// ------------------------------------------------------------------ dữ liệu cho renderer bản đồ

                             
                             
             
               
                 
              
              
                       
 

/**
 * Mọi thứ cần vẽ trong một khung nhìn. Ô thủ tục chỉ được "hiện hình" thành cảnh vật khi
 * vùng của nó khác đường mòn — nếu không bản đồ sẽ dày đặc điểm vô nghĩa.
 */
export function scanArea(
  at        ,
  radiusMeters        ,
  pack                 = null,
)               {
  const features               = [];
  const claimed = new Set        ();

  for (const poi of poisNear(pack, at, radiusMeters)) {
    features.push({
      kind: 'poi',
      id: poi.id,
      zone: poi.zone,
      nameVi: poi.nameVi,
      lat: poi.lat,
      lon: poi.lon,
      radiusMeters: poi.radiusMeters,
    });
    claimed.add(cellAt(poi.lat, poi.lon).id);
  }

  const size = POI.wildernessGrid.cellSizeMeters;
  const latStep = metersToLatDegrees(size);
  const lonStep = metersToLonDegrees(size, at.lat);
  const span = Math.ceil(radiusMeters / size);

  for (let dr = -span; dr <= span; dr++) {
    for (let dc = -span; dc <= span; dc++) {
      const cell = cellAt(at.lat + dr * latStep, at.lon + dc * lonStep);
      if (claimed.has(cell.id)) continue;
      claimed.add(cell.id);

      const zone = proceduralZone(cell);
      if (zone === 'trail') continue;
      if (distanceMeters(at, { lat: cell.centerLat, lon: cell.centerLon }) > radiusMeters) continue;

      features.push({
        kind: 'procedural',
        id: `proc:${cell.id}`,
        zone,
        nameVi: proceduralNameFor(zone, cell),
        lat: cell.centerLat,
        lon: cell.centerLon,
        radiusMeters: size * 0.42,
      });
    }
  }

  return features;
}

const PROCEDURAL_NAMES                                             = {
  forest: [
    'Bí Cảnh Khai Trí Viện (Trường Học / Giảng Đường)',
    'Thần Đạo Miếu Mạo (Đình Đền / Chùa Chiền)',
    'Y Viện Thảo Dược Dân Gian (Bệnh Viện / Trạm Y Tế / Nhà Thuốc)',
    'Vạt Cây Rậm (Vườn Hoa / Công Viên)',
    'Bãi Hươu Sao Tiền Sử (Khu Sinh Thái Cây Xanh)',
    'Hang Lợn Rừng Cổ (Gò Đất / Bụi Rậm Tự Nhiên)',
    'Rừng Đại Cổ Thụ (Vườn Cây Cổ Thụ Đô Thị)',
    'Bách Thảo Điền Viên (Công Viên Cây Xanh)',
    'Rặng Cây Cổ Thụ (Hàng Cây Ven Đường)',
  ],
  water: [
    'Đầm Nước Thiêng (Hồ Tự Nhiên)',
    'Mạch Nước Ngầm (Kênh Mương / Giếng Cổ)',
    'Hồ Nước Ngọt Thổ Dân (Hồ Điều Hoà)',
    'Bến Nước Cổ Đại (Bến Thuyền / Cảng Sông)',
    'Mỏ Đất Sét Ven Suối (Bờ Nước Bồi Lắng)',
    'Đầm Sen Cổ Thạch (Đầm Sen / Hồ Cảnh Quan)',
    'Khe Nước Nhỏ (Rãnh Nước / Suối Nhỏ)',
    'Vũng Nước Trầm (Ao Nước Đô Thị)',
  ],
  merchant: [
    'Highlands Coffee (Trạm Cà Phê Cổ)',
    'The Coffee House (Quán Trà Cà Phê)',
    'Trà Quán Phúc Long Cổ Đại (Trà Phúc Long)',
    'Cộng Trà Quán (Cà Phê Cộng Xưa)',
    'Vịnh Xén Hè Xe Buýt (Trạm Chờ Xe Buýt)',
    'Tiệm Trao Đổi WinMart (Cửa Hàng Tiện Lợi)',
    'Tiệm Trao Đổi Circle K (Cửa Hàng 24h)',
    'Quán Phở Cổ Truyền Thổ Tộc (Quán Ăn / Phở)',
    'Lò Bánh Nướng Tiền Sử (Tiệm Bánh Mì)',
    'Khu Chợ Trao Đổi Dân Sinh (Chợ Dân Sinh)',
    'Mỏ Vàng Lộ Thiên (Ngân Hàng / Cây ATM)',
    'Trạm Tiếp Năng Lượng Thần Thú (Cây Xăng / Trạm Sạc)',
  ],
  wilderness: [
    'Mỏ Than Đen (Khu Công Nghiệp / Đất Cứng)',
    'Vách Quặng Sắt (Khu Xây Dựng / Cơ Khí)',
    'Bãi Hoang Sỏi Đá (Bãi Đất Trống)',
    'Vạt Đất Trống Cổ (Đất Chưa Quy Hoạch)',
    'Vách Đá Trầm Tích (Bờ Tường / Cắt Đường)',
    'Trầm Tích Cổ Đại (Khu Đô Thị Mới)',
  ],
};

function proceduralNameFor(zone        , cell          )         {
  if (zone === 'trail') return ZONES.trail.nameVi;
  const names = PROCEDURAL_NAMES[zone];
  const rng = createRng(hashSeed('name', cell.id));
  return names[Math.floor(rng() * names.length)] ?? ZONES[zone].nameVi;
}

/**
 * Gói POI Hà Nội Tiền Sử Hoá toàn diện:
 *  - Tuyến Tàu Điện Trên Cao Cát Linh - Hà Đông (Huyết Mạch Cự Mộc)
 *  - Cầu Long Biên (Cầu Cổ Long Cốt), Hoàng Thành Thăng Long, Hồ Tây, Mỹ Đình, Keangnam...
 *  - Toàn bộ chuỗi Quán Cà Phê (Highlands, Phúc Long, The Coffee House, Cộng, Trung Nguyên...)
 *  - Vịnh Xén Hè Xe Buýt, Tiệm Trao Đổi (WinMart, Circle K), Chợ Dân Sinh, Trường Học, Bệnh Viện...
 *  - Mỏ Vàng, Mỏ Than/Quặng Sắt, Bãi Hươu Sao, Hang Lợn Rừng, Mỏ Đất Sét...
 */

export function sampleHanoiPack()          {
  return buildPackIndex({
    formatVersion: POI.pack.formatVersion,
    regionId: 'hanoi-sample',
    nameVi: 'Hà Nội Cổ Đại (Kỷ Nguyên Hoang Cổ - Toàn Bộ 30 Quận Huyện)',
    bbox: [105.28, 20.56, 106.02, 21.38],
    pois: [
      ...HANOI_BUS_STOPS,
      // 1. Tuyến Tàu Điện Trên Cao Cát Linh - Hà Đông ("Huyết Mạch Cự Mộc")
      { id: 'cl_01', zone: 'merchant', nameVi: 'Huyết Mạch Cự Mộc — Trụ Cát Linh',         lat: 21.0282, lon: 105.8284, radiusMeters: 55 },
      { id: 'cl_02', zone: 'forest',   nameVi: 'Cự Mộc — Nhánh La Thành',                  lat: 21.0215, lon: 105.8219, radiusMeters: 50 },
      { id: 'cl_03', zone: 'merchant', nameVi: 'Cự Mộc — Trạm Cổ Thái Hà',                 lat: 21.0152, lon: 105.8176, radiusMeters: 50 },
      { id: 'cl_04', zone: 'water',    nameVi: 'Cự Mộc — Cầu Rễ Sông Tô Lịch (Láng)',      lat: 21.0094, lon: 105.8118, radiusMeters: 60 },
      { id: 'cl_05', zone: 'merchant', nameVi: 'Cự Mộc — Vương Trạm Thượng Đình',          lat: 21.0007, lon: 105.8152, radiusMeters: 55 },
      { id: 'cl_06', zone: 'forest',   nameVi: 'Cự Mộc — Rừng Trụ Vành Đai 3',             lat: 20.9926, lon: 105.8035, radiusMeters: 50 },
      { id: 'cl_07', zone: 'merchant', nameVi: 'Cự Mộc — Bến Giao Thương Phùng Khoang',    lat: 20.9882, lon: 105.7954, radiusMeters: 50 },
      { id: 'cl_08', zone: 'water',    nameVi: 'Cự Mộc — Đầm Cổ Văn Quán',                 lat: 20.9796, lon: 105.7865, radiusMeters: 65 },
      { id: 'cl_09', zone: 'merchant', nameVi: 'Cự Mộc — Hà Đông Cổ Vương Phủ',           lat: 20.9702, lon: 105.7761, radiusMeters: 60 },
      { id: 'cl_10', zone: 'forest',   nameVi: 'Cự Mộc — Vạt Cây Cổ La Khê',               lat: 20.9631, lon: 105.7667, radiusMeters: 50 },
      { id: 'cl_11', zone: 'merchant', nameVi: 'Cự Mộc — Bến Nghỉ Văn Khê',                lat: 20.9575, lon: 105.7588, radiusMeters: 50 },
      { id: 'cl_12', zone: 'forest',   nameVi: 'Huyết Mạch Cự Mộc — Đuôi Rồng Yên Nghĩa',  lat: 20.9502, lon: 105.7482, radiusMeters: 70 },

      // 2. Khu Vực Mỹ Đình, Lê Đức Thọ, Mai Dịch, Cầu Giấy (Cực Kỳ Chi Tiết & Chuẩn Xác Từng Điểm)
      { id: 'sun_square',           zone: 'merchant', nameVi: 'Tòa Cự Thạch Sun Square (Cổ Đạo Lê Đức Thọ)',   lat: 21.0316, lon: 105.7728, radiusMeters: 55 },
      { id: 'highlands_sunsquare',  zone: 'merchant', nameVi: 'Highlands Coffee (Sun Square - Lê Đức Thọ)',   lat: 21.0312, lon: 105.7726, radiusMeters: 25 },
      { id: 'bus_sunsquare',        zone: 'merchant', nameVi: 'Vịnh Xén Hè Xe Buýt Sun Square (Nguyễn Hoàng)',lat: 21.0308, lon: 105.7733, radiusMeters: 25 },
      { id: 'truong_nhat_ban',      zone: 'forest',   nameVi: 'Trường Nhật Bản Hà Nội (Japanese School)',     lat: 21.0322, lon: 105.7708, radiusMeters: 65 },
      { id: 'bus_leductho',         zone: 'merchant', nameVi: 'Trạm Chờ Xe Buýt (Giao Điểm Lê Đức Thọ - Hàm Nghi)', lat: 21.0328, lon: 105.7716, radiusMeters: 25 },
      { id: 'hd_mon_city',          zone: 'merchant', nameVi: 'Thành Cổ HD Mon City (Lối Mòn Hàm Nghi)',      lat: 21.0335, lon: 105.7685, radiusMeters: 70 },
      { id: 'highlands_hamnghi',    zone: 'merchant', nameVi: 'Highlands Coffee (Lối Mòn Hàm Nghi)',          lat: 21.0342, lon: 105.7672, radiusMeters: 25 },
      { id: 'vinhomes_gardenia',    zone: 'forest',   nameVi: 'Vườn Địa Đàng Vinhomes Gardenia',              lat: 21.0395, lon: 105.7615, radiusMeters: 90 },
      { id: 'cho_mydinh',           zone: 'merchant', nameVi: 'Chợ Cổ Mỹ Đình (Lối Mòn Mỹ Đình)',              lat: 21.0255, lon: 105.7738, radiusMeters: 55 },
      { id: 'nt_maidich',           zone: 'forest',   nameVi: 'Cổ Mộ Tiền Nhân (Nghĩa Trang Mai Dịch)',        lat: 21.0375, lon: 105.7745, radiusMeters: 110 },
      { id: 'dolphin_plaza',        zone: 'merchant', nameVi: 'Song Ngư Thạch Tháp (Dolphin Plaza - Nguyễn Hoàng)',lat: 21.0298, lon: 105.7762, radiusMeters: 60 },
      { id: 'tch_mydinh',           zone: 'merchant', nameVi: 'The Coffee House (Lối Mòn Nguyễn Hoàng)',      lat: 21.0292, lon: 105.7775, radiusMeters: 25 },
      { id: 'flc_landmark',         zone: 'merchant', nameVi: 'Đại Thạch Đài FLC (Cổ Đạo Lê Đức Thọ)',        lat: 21.0285, lon: 105.7712, radiusMeters: 60 },
      { id: 'my_dinh_stadium',      zone: 'merchant', nameVi: 'Đấu Trường Quái Thú Tiền Sử (Sân Mỹ Đình)',    lat: 21.0205, lon: 105.7638, radiusMeters: 160 },
      { id: 'cung_dien_kinh',       zone: 'merchant', nameVi: 'Cung Điền Kinh Cổ Đại (Lối Mòn Trần Hữu Dực)',  lat: 21.0235, lon: 105.7585, radiusMeters: 100 },
      { id: 'cung_thieu_nhi',       zone: 'forest',   nameVi: 'Ấu Thú Điền Viên (Cung Thiếu Nhi Mới)',         lat: 21.0185, lon: 105.7795, radiusMeters: 75 },
      { id: 'bx_mydinh',            zone: 'merchant', nameVi: 'Trạm Lữ Khách Phương Bắc (Bến Xe Mỹ Đình)',     lat: 21.0285, lon: 105.7785, radiusMeters: 90 },
      { id: 'bv_198',               zone: 'forest',   nameVi: 'Y Viện Thảo Dược 198 (Lối Mòn Trần Bình)',      lat: 21.0345, lon: 105.7772, radiusMeters: 70 },
      { id: 'dh_thuongmai',         zone: 'merchant', nameVi: 'Thương Viện Cổ Đại (ĐH Thương Mại - Hồ Tùng Mậu)',lat: 21.0368, lon: 105.7718, radiusMeters: 80 },
      { id: 'dh_supham',            zone: 'forest',   nameVi: 'Sư Viện Khai Trí (ĐH Sư Phạm Hà Nội)',          lat: 21.0372, lon: 105.7832, radiusMeters: 75 },
      { id: 'dh_quocgia',           zone: 'forest',   nameVi: 'Đại Bí Cảnh Tri Thức (ĐH Quốc Gia - Xuân Thuỷ)',lat: 21.0365, lon: 105.7815, radiusMeters: 85 },
      { id: 'iph_plaza',            zone: 'merchant', nameVi: 'Ngũ Hành Thạch Tháp (Indochina Plaza - Xuân Thủy)', lat: 21.0358, lon: 105.7845, radiusMeters: 65 },
      { id: 'discovery_complex',    zone: 'merchant', nameVi: 'Cự Thạch Trụ Cầu Giấy (Discovery Complex)',     lat: 21.0335, lon: 105.7925, radiusMeters: 70 },
      { id: 'cv_caugiay',       zone: 'forest',   nameVi: 'Rừng Nguyên Sinh Cầu Giấy (Công Viên Cầu Giấy)',     lat: 21.0242, lon: 105.7895, radiusMeters: 130 },
      { id: 'cv_nghiado',       zone: 'forest',   nameVi: 'Thung Lũng Hoa Rừng (Công Viên Nghĩa Đô)',          lat: 21.0405, lon: 105.7975, radiusMeters: 120 },
      { id: 'ho_nghiado',       zone: 'water',    nameVi: 'Hồ Nước Ngọt Nghĩa Đô',                             lat: 21.0408, lon: 105.7985, radiusMeters: 80 },
      { id: 'keangnam',         zone: 'merchant', nameVi: 'Cự Tháp Đá Chọc Trời (Keangnam Landmark 72)',      lat: 21.0168, lon: 105.7838, radiusMeters: 75 },
      { id: 'the_manor',        zone: 'merchant', nameVi: 'Vương Quốc Đá Cổ Mễ Trì (The Manor / The Garden)',   lat: 21.0135, lon: 105.7765, radiusMeters: 85 },
      { id: 'ncc_hoinghi',      zone: 'merchant', nameVi: 'Đại Doanh Trại Tộc Trưởng (Hội Nghị Quốc Gia)',     lat: 21.0065, lon: 105.7852, radiusMeters: 120 },
      { id: 'baotang_hn',       zone: 'merchant', nameVi: 'Kim Tự Tháp Ngược (Bảo Tàng Hà Nội)',               lat: 21.0085, lon: 105.7885, radiusMeters: 75 },
      { id: 'bigc_thanglong',   zone: 'merchant', nameVi: 'Đại Thương Thị Thăng Long (Big C Thăng Long)',       lat: 21.0055, lon: 105.7925, radiusMeters: 80 },
      { id: 'royal_city',       zone: 'merchant', nameVi: 'Thành Cổ Ngầm Hoàng Gia (Royal City - Nguyễn Trãi)', lat: 21.0025, lon: 105.8155, radiusMeters: 130 },
      { id: 'times_city',       zone: 'merchant', nameVi: 'Thủy Cung Ngầm Khổng Lồ (Times City - Minh Khai)',  lat: 20.9955, lon: 105.8675, radiusMeters: 140 },
      { id: 'vincom_ba_trieu',  zone: 'merchant', nameVi: 'Tam Tinh Bảo Tháp (Vincom Bà Triệu)',               lat: 21.0112, lon: 105.8492, radiusMeters: 65 },
      { id: 'mipec_tower',      zone: 'merchant', nameVi: 'Huyền Thạch Trụ Tây Sơn (Mipec Tower)',             lat: 21.0075, lon: 105.8235, radiusMeters: 60 },

      // 3. Chuỗi Quán Cà Phê, Trà Đạo & Tiệm Trao Đổi Toàn Thành Phố (Highlands, Phúc Long, The Coffee House...)
      { id: 'hl_nhahatlon',     zone: 'merchant', nameVi: 'Highlands Coffee (Nhà Hát Lớn — Cổ Đạo Tràng Tiền)', lat: 21.0246, lon: 105.8578, radiusMeters: 30 },
      { id: 'hl_hamca',         zone: 'merchant', nameVi: 'Highlands Coffee (Hàm Cá Mập — Cổ Đạo Đinh Tiên Hoàng)', lat: 21.0315, lon: 105.8528, radiusMeters: 30 },
      { id: 'hl_tayho',         zone: 'merchant', nameVi: 'Highlands Coffee (Du Thuyền Tây Hồ)',              lat: 21.0535, lon: 105.8365, radiusMeters: 35 },
      { id: 'hl_hoangdaothuy',  zone: 'merchant', nameVi: 'Highlands Coffee (Lối Mòn Hoàng Đạo Thúy)',         lat: 21.0085, lon: 105.8015, radiusMeters: 25 },
      { id: 'hl_xuanthuy',      zone: 'merchant', nameVi: 'Highlands Coffee (Cổ Lộ Xuân Thủy)',               lat: 21.0362, lon: 105.7855, radiusMeters: 25 },
      { id: 'hl_lotte',         zone: 'merchant', nameVi: 'Highlands Coffee (Lotte Liễu Giai)',               lat: 21.0318, lon: 105.8125, radiusMeters: 25 },
      { id: 'hl_hadong',        zone: 'merchant', nameVi: 'Highlands Coffee (Quang Trung Hà Đông)',           lat: 20.9705, lon: 105.7755, radiusMeters: 25 },
      { id: 'hl_longbien',      zone: 'merchant', nameVi: 'Highlands Coffee (Nguyễn Văn Cừ Long Biên)',       lat: 21.0425, lon: 105.8715, radiusMeters: 25 },
      { id: 'tch_thaiha',       zone: 'merchant', nameVi: 'The Coffee House (Lối Mòn Thái Hà)',               lat: 21.0145, lon: 105.8185, radiusMeters: 25 },
      { id: 'tch_trandainghia', zone: 'merchant', nameVi: 'The Coffee House (Lối Mòn Trần Đại Nghĩa)',        lat: 21.0015, lon: 105.8455, radiusMeters: 25 },
      { id: 'phuclong_lythuongkiet', zone: 'merchant', nameVi: 'Trà Quán Phúc Long (Cổ Đạo Lý Thường Kiệt)',  lat: 21.0252, lon: 105.8505, radiusMeters: 25 },
      { id: 'phuclong_caugiay', zone: 'merchant', nameVi: 'Trà Quán Phúc Long (Cổ Lộ Cầu Giấy)',              lat: 21.0332, lon: 105.7945, radiusMeters: 25 },
      { id: 'cong_trieuvietvuong', zone: 'merchant', nameVi: 'Cộng Trà Quán (Lối Mòn Triệu Việt Vương)',      lat: 21.0125, lon: 105.8512, radiusMeters: 25 },
      { id: 'cong_trangtien',   zone: 'merchant', nameVi: 'Cộng Cà Phê (Cổ Đạo Tràng Tiền)',                  lat: 21.0245, lon: 105.8568, radiusMeters: 25 },
      { id: 'trungnguyen_nhatho', zone: 'merchant', nameVi: 'Trung Nguyên Legend (Cổ Đạo Nhà Thờ)',          lat: 21.0282, lon: 105.8491, radiusMeters: 25 },
      { id: 'aha_nhahatlon',    zone: 'merchant', nameVi: 'Aha Cafe (Lối Mòn Phan Chu Trinh)',                lat: 21.0238, lon: 105.8558, radiusMeters: 25 },

      // --- Cà Phê Di Sản & Phố Cổ Hà Nội ---
      { id: 'cafe_giang_trung', zone: 'merchant', nameVi: 'Cà Phê Trứng Giảng Cổ Điểm (Nguyễn Hữu Huân)',    lat: 21.0345, lon: 105.8540, radiusMeters: 30 },
      { id: 'cafe_dinh_dinh',   zone: 'merchant', nameVi: 'Cà Phê Đinh (Bờ Hồ Gươm — Đinh Tiên Hoàng)',        lat: 21.0310, lon: 105.8525, radiusMeters: 25 },
      { id: 'cafe_lam_nguyenhuuhuan', zone: 'merchant', nameVi: 'Cà Phê Lâm Hội Họa (Nguyễn Hữu Huân)',      lat: 21.0352, lon: 105.8545, radiusMeters: 25 },
      { id: 'cafe_yen_quanthan',zone: 'merchant', nameVi: 'Cà Phê Yên Cổ Quán (Quán Thánh — Ba Đình)',        lat: 21.0425, lon: 105.8395, radiusMeters: 25 },
      { id: 'all_day_coffee_quangtrung', zone: 'merchant', nameVi: 'All Day Coffee (Cổ Đạo Quang Trung)',     lat: 21.0210, lon: 105.8505, radiusMeters: 30 },

      { id: 'winmart_times',    zone: 'merchant', nameVi: 'Tiệm Trao Đổi WinMart (Times City)',               lat: 20.9962, lon: 105.8682, radiusMeters: 30 },
      { id: 'winmart_royal',    zone: 'merchant', nameVi: 'Tiệm Trao Đổi WinMart (Royal City)',               lat: 21.0031, lon: 105.8148, radiusMeters: 30 },
      { id: 'circlek_hangbac',  zone: 'merchant', nameVi: 'Tiệm Trao Đổi Circle K (Lối Mòn Hàng Bạc)',        lat: 21.0345, lon: 105.8512, radiusMeters: 25 },
      { id: 'circlek_chualang', zone: 'merchant', nameVi: 'Tiệm Trao Đổi Circle K (Lối Mòn Chùa Láng)',       lat: 21.0265, lon: 105.8025, radiusMeters: 25 },

      // 3.1. Đại Chuỗi Nhà Hàng & Ẩm Thực Cỡ Vừa Đến Lớn Tại Hà Nội
      { id: 'haidilao_metropolis',  zone: 'merchant', nameVi: 'Haidilao Hotpot (Metropolis Liễu Giai)',       lat: 21.0315, lon: 105.8145, radiusMeters: 45 },
      { id: 'haidilao_phamngocthach',zone: 'merchant',nameVi: 'Haidilao Hotpot (Vincom Phạm Ngọc Thạch)',    lat: 21.0068, lon: 105.8328, radiusMeters: 45 },
      { id: 'haidilao_tranduyhung', zone: 'merchant', nameVi: 'Haidilao Hotpot (Vincom Trần Duy Hưng)',      lat: 21.0072, lon: 105.7942, radiusMeters: 45 },
      { id: 'haidilao_oceanpark',   zone: 'merchant', nameVi: 'Haidilao Hotpot (Vincom Ocean Park)',          lat: 20.9932, lon: 105.9462, radiusMeters: 45 },
      { id: 'pizza4ps_hoangthanh',  zone: 'merchant', nameVi: 'Pizza 4P\'s (Cổ Đạo Hoàng Thành)',             lat: 21.0342, lon: 105.8412, radiusMeters: 35 },
      { id: 'pizza4ps_lotte',       zone: 'merchant', nameVi: 'Pizza 4P\'s (Lotte Center Liễu Giai)',         lat: 21.0321, lon: 105.8118, radiusMeters: 35 },
      { id: 'pizza4ps_xuanthuy',    zone: 'merchant', nameVi: 'Pizza 4P\'s (IPH Cổ Lộ Xuân Thủy)',            lat: 21.0355, lon: 105.7838, radiusMeters: 35 },
      { id: 'pizza4ps_phankebinh',  zone: 'merchant', nameVi: 'Pizza 4P\'s (Lối Mòn Phan Kế Bính)',           lat: 21.0338, lon: 105.8122, radiusMeters: 35 },
      { id: 'gogi_tranthaitong',    zone: 'merchant', nameVi: 'Quán Nướng Gogi House (Trần Thái Tông)',       lat: 21.0295, lon: 105.7892, radiusMeters: 35 },
      { id: 'kichikichi_royal',     zone: 'merchant', nameVi: 'Lẩu Băng Chuyền Kichi Kichi (Royal City)',     lat: 21.0028, lon: 105.8152, radiusMeters: 35 },
      { id: 'manwah_thaiha',        zone: 'merchant', nameVi: 'Lẩu Đài Loan Manwah (Lối Mòn Thái Hà)',        lat: 21.0142, lon: 105.8192, radiusMeters: 35 },
      { id: 'manwah_levanluong',    zone: 'merchant', nameVi: 'Lẩu Đài Loan Manwah (Cổ Đạo Lê Văn Lương)',    lat: 21.0062, lon: 105.8032, radiusMeters: 35 },
      { id: 'goldengate_dichvong',  zone: 'merchant', nameVi: 'Thần Tửu Lầu Golden Gate (Dịch Vọng Hậu)',     lat: 21.0312, lon: 105.7862, radiusMeters: 40 },
      { id: 'kombo_hoangdaothuy',   zone: 'merchant', nameVi: 'Cơm Niêu Singapore Kombo (Hoàng Đạo Thúy)',    lat: 21.0078, lon: 105.8022, radiusMeters: 30 },
      { id: 'kombo_levanthiem',     zone: 'merchant', nameVi: 'Cơm Niêu Singapore Kombo (Lê Văn Thiêm)',      lat: 21.0008, lon: 105.8038, radiusMeters: 30 },
      { id: 'nethue_hangbong',      zone: 'merchant', nameVi: 'Ẩm Thực Cố Đô Nét Huế (Cổ Phố Hàng Bông)',     lat: 21.0305, lon: 105.8475, radiusMeters: 30 },
      { id: 'quan_an_ngon',         zone: 'merchant', nameVi: 'Đại Tửu Quán Ăn Ngon (Phan Bội Châu)',         lat: 21.0258, lon: 105.8442, radiusMeters: 40 },

      // 3.2. Quán ăn cổ truyền & Đặc sản nổi tiếng toàn địa bàn Hà Nội
      // --- Phở & Mì truyền thống ---
      { id: 'pho_thin_loduc',       zone: 'merchant', nameVi: 'Phở Thìn Lò Đúc (Phở tái lăn gia truyền)',        lat: 21.0158, lon: 105.8568, radiusMeters: 30 },
      { id: 'pho_bat_dan',          zone: 'merchant', nameVi: 'Phở gia truyền Bát Đàn (Phố cổ 36 hàng)',        lat: 21.0338, lon: 105.8478, radiusMeters: 30 },
      { id: 'pho_10_lyquocsu',      zone: 'merchant', nameVi: 'Phở 10 Lý Quốc Sư (Hoàn Kiếm)',                  lat: 21.0302, lon: 105.8488, radiusMeters: 30 },
      { id: 'pho_thin_boho',        zone: 'merchant', nameVi: 'Phở Thìn Bờ Hồ (Đinh Tiên Hoàng)',               lat: 21.0318, lon: 105.8528, radiusMeters: 25 },
      { id: 'pho_suong_maihacde',   zone: 'merchant', nameVi: 'Phở Sướng (Mai Hắc Đế - Hai Bà Trưng)',          lat: 21.0118, lon: 105.8495, radiusMeters: 25 },
      { id: 'pho_khoi_hoi',         zone: 'merchant', nameVi: 'Phở Khôi Hói (Hàng Vải)',                        lat: 21.0365, lon: 105.8482, radiusMeters: 25 },
      { id: 'pho_ga_cham',          zone: 'merchant', nameVi: 'Phở gà Châm (Yên Ninh - Ba Đình)',               lat: 21.0415, lon: 105.8445, radiusMeters: 25 },
      { id: 'pho_cu_cu_mydinh',     zone: 'merchant', nameVi: 'Phở bò Cụ Cử (Lê Đức Thọ - Mỹ Đình)',            lat: 21.0320, lon: 105.7725, radiusMeters: 25 },
      { id: 'mi_van_than_duyanh',   zone: 'merchant', nameVi: 'Mì vằn thắn Duy Anh (Trần Hưng Đạo)',            lat: 21.0225, lon: 105.8495, radiusMeters: 25 },

      // --- Bún chả, Bún thang, Bún ốc, Bún đậu & Bún riêu ---
      { id: 'buncha_huonglien',     zone: 'merchant', nameVi: 'Bún chả Hương Liên (Bún chả Obama - Lê Văn Hưu)',lat: 21.0182, lon: 105.8525, radiusMeters: 30 },
      { id: 'buncha_dackim',        zone: 'merchant', nameVi: 'Bún chả Đắc Kim (Hàng Mành)',                    lat: 21.0335, lon: 105.8492, radiusMeters: 30 },
      { id: 'buncha_sinhtu',        zone: 'merchant', nameVi: 'Bún chả Sinh Từ (Nguyễn Khuyến)',                lat: 21.0275, lon: 105.8398, radiusMeters: 30 },
      { id: 'buncha_hadong',        zone: 'merchant', nameVi: 'Bún chả Bà Cụ (Quang Trung - Hà Đông)',          lat: 20.9712, lon: 105.7745, radiusMeters: 30 },
      { id: 'buncha_longbien',      zone: 'merchant', nameVi: 'Bún chả Ngọc Lâm (Long Biên)',                   lat: 21.0465, lon: 105.8685, radiusMeters: 30 },
      { id: 'bunthang_baduc',       zone: 'merchant', nameVi: 'Bún thang bà Đức (Cầu Gỗ)',                      lat: 21.0325, lon: 105.8532, radiusMeters: 25 },
      { id: 'bunoc_co_hue',         zone: 'merchant', nameVi: 'Bún ốc cô Huệ (Nguyễn Siêu)',                    lat: 21.0368, lon: 105.8515, radiusMeters: 25 },
      { id: 'bunoc_phutayho',       zone: 'merchant', nameVi: 'Bún ốc Phủ Tây Hồ (Quảng An)',                   lat: 21.0685, lon: 105.8315, radiusMeters: 35 },
      { id: 'bunoc_baluong',        zone: 'merchant', nameVi: 'Bún ốc bà Lương (Khương Thượng - Đống Đa)',      lat: 21.0065, lon: 105.8265, radiusMeters: 30 },
      { id: 'bundau_ngotram',       zone: 'merchant', nameVi: 'Bún đậu mắm tôm Ngõ Trạm',                       lat: 21.0322, lon: 105.8465, radiusMeters: 25 },
      { id: 'bundau_hangkhay',      zone: 'merchant', nameVi: 'Bún đậu mắm tôm Hàng Khay',                      lat: 21.0282, lon: 105.8522, radiusMeters: 25 },
      { id: 'bundau_cayda',         zone: 'merchant', nameVi: 'Bún đậu Cây Đa (Thụy Khuê - Tây Hồ)',            lat: 21.0435, lon: 105.8285, radiusMeters: 25 },
      { id: 'bunrieu_hangbac',      zone: 'merchant', nameVi: 'Bún riêu cua cô Hoàn (Hàng Bạc)',                lat: 21.0348, lon: 105.8518, radiusMeters: 25 },
      { id: 'bunrieu_tohieu',       zone: 'merchant', nameVi: 'Bún riêu cua Tô Hiệu (Cầu Giấy)',                lat: 21.0412, lon: 105.7942, radiusMeters: 25 },
      { id: 'bunca_cay_haiphong',   zone: 'merchant', nameVi: 'Bún cá cay Hải Phòng (Nguyễn Trãi - Thanh Xuân)',lat: 20.9985, lon: 105.8115, radiusMeters: 25 },
      { id: 'bunbo_oxuan',          zone: 'merchant', nameVi: 'Bún bò Huế O Xuân (Quang Trung - Hoàn Kiếm)',    lat: 21.0162, lon: 105.8502, radiusMeters: 25 },

      // --- Chả cá, Bánh tôm, Phở cuốn, Bánh cuốn & Bánh mì ---
      { id: 'chaca_lavong',         zone: 'merchant', nameVi: 'Chả cá Lã Vọng (Chả Cá - Hoàn Kiếm)',            lat: 21.0362, lon: 105.8488, radiusMeters: 30 },
      { id: 'chaca_thanglong',      zone: 'merchant', nameVi: 'Chả cá Thăng Long (Đường Thành)',                lat: 21.0328, lon: 105.8468, radiusMeters: 30 },
      { id: 'banhtom_hotay',        zone: 'merchant', nameVi: 'Bánh tôm Hồ Tây (Đường Thanh Niên)',             lat: 21.0475, lon: 105.8368, radiusMeters: 40 },
      { id: 'phocuon_chinhthang',   zone: 'merchant', nameVi: 'Phở cuốn Chinh Thắng (Ngũ Xã - Trúc Bạch)',       lat: 21.0445, lon: 105.8385, radiusMeters: 30 },
      { id: 'phocuon_hungben',      zone: 'merchant', nameVi: 'Phở cuốn Hưng Bền (Ngũ Xã - Ba Đình)',           lat: 21.0448, lon: 105.8388, radiusMeters: 30 },
      { id: 'banhcuon_bahoanh',     zone: 'merchant', nameVi: 'Bánh cuốn Bà Hoành (Tô Hiến Thành)',             lat: 21.0142, lon: 105.8505, radiusMeters: 30 },
      { id: 'banhcuon_giaan_hadong',zone: 'merchant', nameVi: 'Bánh cuốn Gia An (Quang Trung - Hà Đông)',       lat: 20.9725, lon: 105.7758, radiusMeters: 25 },
      { id: 'banhcuon_giaan_thanhxuan',zone: 'merchant',nameVi: 'Bánh cuốn Gia An (Nguyễn Trãi - Thanh Xuân)',  lat: 20.9995, lon: 105.8085, radiusMeters: 25 },
      { id: 'banhmi_sotvang_dinhngang',zone: 'merchant',nameVi: 'Bánh mì sốt vang Đình Ngang (Cửa Nam)',       lat: 21.0298, lon: 105.8452, radiusMeters: 25 },
      { id: 'banhmi_cay_longbien',  zone: 'merchant', nameVi: 'Bánh mì cay Hải Phòng (Ngọc Lâm - Long Biên)',   lat: 21.0455, lon: 105.8695, radiusMeters: 25 },

      // --- Món ăn vặt & Đặc sản đường phố Hà Nội ---
      { id: 'xoi_yen',              zone: 'merchant', nameVi: 'Xôi Yến (Nguyễn Hữu Huân - Hoàn Kiếm)',          lat: 21.0348, lon: 105.8542, radiusMeters: 30 },
      { id: 'nom_longvidung',       zone: 'merchant', nameVi: 'Nộm bò khô Long Vi Dung (Hồ Hoàn Kiếm)',        lat: 21.0315, lon: 105.8538, radiusMeters: 25 },
      { id: 'banhgoi_gocda',        zone: 'merchant', nameVi: 'Bánh gối Quán Gốc Đa (Lý Quốc Sư)',              lat: 21.0295, lon: 105.8485, radiusMeters: 25 },
      { id: 'banhduc_lengoc han',   zone: 'merchant', nameVi: 'Bánh đúc nóng Lê Ngọc Hân (Hai Bà Trưng)',       lat: 21.0175, lon: 105.8535, radiusMeters: 25 },
      { id: 'chaoson_hangdieu',     zone: 'merchant', nameVi: 'Cháo sườn sụn cô Là (Hàng Điếu)',                lat: 21.0328, lon: 105.8462, radiusMeters: 25 },
      { id: 'nemchua_tamthuong',    zone: 'merchant', nameVi: 'Nem chua rán Tạm Thương (Hàng Bông)',            lat: 21.0308, lon: 105.8465, radiusMeters: 25 },
      { id: 'che_bonmua_hangcan',   zone: 'merchant', nameVi: 'Chè Bốn Mùa (Hàng Cân - Hoàn Kiếm)',              lat: 21.0342, lon: 105.8498, radiusMeters: 25 },
      { id: 'che_sen_tayho',        zone: 'merchant', nameVi: 'Chè sen Tây Hồ (Quảng Bá - Tây Hồ)',             lat: 21.0625, lon: 105.8285, radiusMeters: 30 },

      // --- Lẩu, Nướng & Cơm đặc sản các quận ---
      { id: 'lauech_nganbeo',       zone: 'merchant', nameVi: 'Lẩu ếch Ngân Béo (Trúc Bạch - Ba Đình)',          lat: 21.0452, lon: 105.8392, radiusMeters: 35 },
      { id: 'lauech_dungha_mydinh', zone: 'merchant', nameVi: 'Lẩu ếch Dũng Hà (Mỹ Đình 2)',                    lat: 21.0272, lon: 105.7715, radiusMeters: 30 },
      { id: 'laude_nhatly',         zone: 'merchant', nameVi: 'Lẩu dê Nhất Ly (Giải Phóng - Hoàng Mai)',        lat: 20.9855, lon: 105.8425, radiusMeters: 35 },
      { id: 'vit_vandinh_linhdam',  zone: 'merchant', nameVi: 'Vịt cỏ Vân Đình (Bán đảo Linh Đàm - Hoàng Mai)',lat: 20.9685, lon: 105.8285, radiusMeters: 35 },
      { id: 'comtam_sabichuong',    zone: 'merchant', nameVi: 'Cơm tấm Sà Bì Chưởng (Nguyễn Phong Sắc - Cầu Giấy)', lat: 21.0378, lon: 105.7905, radiusMeters: 30 },
      { id: 'banhtrang_hoangbeo',   zone: 'merchant', nameVi: 'Bánh tráng cuốn thịt heo Hoàng Bèo (Duy Tân)',   lat: 21.0288, lon: 105.7872, radiusMeters: 25 },

      // 3.3. Chuỗi Cà Phê, Trà Sữa Cao Cấp & Trẻ Trung Lớn
      { id: 'starbucks_pressclub',  zone: 'merchant', nameVi: 'Starbucks Coffee (Press Club Lý Đạo Thành)',    lat: 21.0255, lon: 105.8562, radiusMeters: 35 },
      { id: 'starbucks_iph',        zone: 'merchant', nameVi: 'Starbucks Coffee (Indochina Plaza Cầu Giấy)',  lat: 21.0361, lon: 105.7842, radiusMeters: 35 },
      { id: 'starbucks_batrieu',    zone: 'merchant', nameVi: 'Starbucks Coffee (Cổ Đạo Bà Triệu)',           lat: 21.0125, lon: 105.8498, radiusMeters: 35 },
      { id: 'starbucks_duytan',     zone: 'merchant', nameVi: 'Starbucks Coffee (Lối Mòn Duy Tân)',           lat: 21.0305, lon: 105.7825, radiusMeters: 35 },
      { id: 'katinat_trangtien',    zone: 'merchant', nameVi: 'Katinat Saigon Kafe (Cổ Đạo Tràng Tiền)',      lat: 21.0248, lon: 105.8565, radiusMeters: 35 },
      { id: 'katinat_phandinhphung',zone: 'merchant', nameVi: 'Katinat Saigon Kafe (Cổ Phố Phan Đình Phùng)', lat: 21.0402, lon: 105.8415, radiusMeters: 35 },
      { id: 'phela_hangcot',        zone: 'merchant', nameVi: 'Trà Ô Long Phê La (Cổ Phố Hàng Cót)',          lat: 21.0385, lon: 105.8472, radiusMeters: 30 },
      { id: 'phela_dangtiendong',   zone: 'merchant', nameVi: 'Trà Ô Long Phê La (Đặng Tiến Đông)',           lat: 21.0135, lon: 105.8238, radiusMeters: 30 },
      { id: 'phela_thanhthai',      zone: 'merchant', nameVi: 'Trà Ô Long Phê La (Lối Mòn Thành Thái)',        lat: 21.0268, lon: 105.7915, radiusMeters: 30 },
      { id: 'dingtea_caugiay',      zone: 'merchant', nameVi: 'Ding Tea Trà Quán (Cổ Lộ Cầu Giấy)',           lat: 21.0345, lon: 105.7928, radiusMeters: 25 },
      { id: 'mixue_bachkhoa',       zone: 'merchant', nameVi: 'Mixue Trà Kem Tuyết (Tạ Quang Bửu - Bách Khoa)',lat: 21.0048, lon: 105.8458, radiusMeters: 25 },
      { id: 'mixue_hadong',         zone: 'merchant', nameVi: 'Mixue Trà Kem Tuyết (Trần Phú Hà Đông)',       lat: 20.9812, lon: 105.7882, radiusMeters: 25 },
      { id: 'kfc_hoangdaothuy',     zone: 'merchant', nameVi: 'Gà Rán KFC (Lối Mòn Hoàng Đạo Thúy)',          lat: 21.0072, lon: 105.8028, radiusMeters: 30 },
      { id: 'lotteria_giangvo',     zone: 'merchant', nameVi: 'Gà Rán Lotteria (Cổ Đạo Giảng Võ)',            lat: 21.0268, lon: 105.8218, radiusMeters: 30 },
      { id: 'mcdonalds_hoguom',     zone: 'merchant', nameVi: 'McDonald\'s Cổ Điểm (Bờ Hồ Gươm - Hàng Khay)',  lat: 21.0262, lon: 105.8522, radiusMeters: 35 },

      // ═══════════════════════════════════════════════════════════════
      // HỆ THỐNG ĐẠI CHUỖI CÀ PHÊ & TRÀ ĐẠO LỚN TRÊN TOÀN HÀ NỘI
      // ═══════════════════════════════════════════════════════════════
      // --- Highlands Coffee mở rộng ---
      { id: 'hl_vincom_smartcity',   zone: 'merchant', nameVi: 'Highlands Coffee (Vincom Mega Mall Smart City)',  lat: 21.0045, lon: 105.7428, radiusMeters: 30 },
      { id: 'hl_vincom_oceanpark',   zone: 'merchant', nameVi: 'Highlands Coffee (Vincom Ocean Park)',          lat: 20.9935, lon: 105.9465, radiusMeters: 30 },
      { id: 'hl_timescity',          zone: 'merchant', nameVi: 'Highlands Coffee (Times City Minh Khai)',       lat: 20.9958, lon: 105.8678, radiusMeters: 30 },
      { id: 'hl_royalcity',          zone: 'merchant', nameVi: 'Highlands Coffee (Royal City Nguyễn Trãi)',     lat: 21.0022, lon: 105.8158, radiusMeters: 30 },
      { id: 'hl_bigc_thanglong',     zone: 'merchant', nameVi: 'Highlands Coffee (Big C Thăng Long Trần Duy Hưng)', lat: 21.0052, lon: 105.7922, radiusMeters: 30 },
      { id: 'hl_huynhthuckhang',     zone: 'merchant', nameVi: 'Highlands Coffee (Huỳnh Thúc Kháng - Đống Đa)', lat: 21.0185, lon: 105.8115, radiusMeters: 30 },
      { id: 'hl_levanluong',         zone: 'merchant', nameVi: 'Highlands Coffee (Lê Văn Lương - Thanh Xuân)',  lat: 21.0058, lon: 105.8018, radiusMeters: 30 },
      { id: 'hl_linhdam',            zone: 'merchant', nameVi: 'Highlands Coffee (Bán Đảo Linh Đàm)',          lat: 20.9678, lon: 105.8292, radiusMeters: 30 },
      { id: 'hl_duongnoi',           zone: 'merchant', nameVi: 'Highlands Coffee (Aeon Mall Hà Đông)',          lat: 20.9782, lon: 105.7488, radiusMeters: 30 },
      { id: 'hl_giangvo',            zone: 'merchant', nameVi: 'Highlands Coffee (Giảng Võ - Ba Đình)',         lat: 21.0272, lon: 105.8228, radiusMeters: 30 },
      { id: 'hl_batrieu',            zone: 'merchant', nameVi: 'Highlands Coffee (Vincom Bà Triệu)',           lat: 21.0115, lon: 105.8495, radiusMeters: 30 },
      { id: 'hl_catlinh',            zone: 'merchant', nameVi: 'Highlands Coffee (Ga Cát Linh)',                lat: 21.0285, lon: 105.8288, radiusMeters: 30 },
      { id: 'hl_lottemall_tayho',    zone: 'merchant', nameVi: 'Highlands Coffee (Lotte Mall Tây Hồ)',          lat: 21.0768, lon: 105.8128, radiusMeters: 30 },

      // --- Phúc Long Tea & Coffee mở rộng ---
      { id: 'phuclong_xuanthuy',     zone: 'merchant', nameVi: 'Trà Quán Phúc Long (IPH Xuân Thủy)',            lat: 21.0355, lon: 105.7842, radiusMeters: 30 },
      { id: 'phuclong_hangdieu',     zone: 'merchant', nameVi: 'Trà Quán Phúc Long (Hàng Điếu - Hoàn Kiếm)',    lat: 21.0325, lon: 105.8465, radiusMeters: 30 },
      { id: 'phuclong_batrieu',      zone: 'merchant', nameVi: 'Trà Quán Phúc Long (Vincom Bà Triệu)',          lat: 21.0118, lon: 105.8488, radiusMeters: 30 },
      { id: 'phuclong_timescity',    zone: 'merchant', nameVi: 'Trà Quán Phúc Long (Times City)',               lat: 20.9962, lon: 105.8685, radiusMeters: 30 },
      { id: 'phuclong_royalcity',    zone: 'merchant', nameVi: 'Trà Quán Phúc Long (Royal City)',               lat: 21.0028, lon: 105.8152, radiusMeters: 30 },
      { id: 'phuclong_aeon_longbien',zone: 'merchant', nameVi: 'Trà Quán Phúc Long (Aeon Mall Long Biên)',      lat: 21.0255, lon: 105.8985, radiusMeters: 30 },
      { id: 'phuclong_aeon_hadong',  zone: 'merchant', nameVi: 'Trà Quán Phúc Long (Aeon Mall Hà Đông)',        lat: 20.9788, lon: 105.7482, radiusMeters: 30 },
      { id: 'phuclong_lottemall',    zone: 'merchant', nameVi: 'Trà Quán Phúc Long (Lotte Mall Tây Hồ)',        lat: 21.0762, lon: 105.8122, radiusMeters: 30 },
      { id: 'phuclong_tranduyhung',  zone: 'merchant', nameVi: 'Trà Quán Phúc Long (Vincom Trần Duy Hưng)',     lat: 21.0065, lon: 105.7945, radiusMeters: 30 },

      // --- The Coffee House mở rộng ---
      { id: 'tch_buithixuan',        zone: 'merchant', nameVi: 'The Coffee House (Bùi Thị Xuân)',               lat: 21.0148, lon: 105.8505, radiusMeters: 30 },
      { id: 'tch_caugiay',           zone: 'merchant', nameVi: 'The Coffee House (Cầu Giấy)',                   lat: 21.0348, lon: 105.7938, radiusMeters: 30 },
      { id: 'tch_levanluong',        zone: 'merchant', nameVi: 'The Coffee House (Lê Văn Lương)',               lat: 21.0052, lon: 105.8025, radiusMeters: 30 },
      { id: 'tch_nguyenvanloc',      zone: 'merchant', nameVi: 'The Coffee House (Nguyễn Văn Lộc - Mỗ Lao)',    lat: 20.9815, lon: 105.7865, radiusMeters: 30 },
      { id: 'tch_linhdam',           zone: 'merchant', nameVi: 'The Coffee House (Linh Đàm)',                  lat: 20.9672, lon: 105.8298, radiusMeters: 30 },
      { id: 'tch_timescity',         zone: 'merchant', nameVi: 'The Coffee House (Times City)',                 lat: 20.9952, lon: 105.8672, radiusMeters: 30 },
      { id: 'tch_ngothinham',        zone: 'merchant', nameVi: 'The Coffee House (Ngô Thì Nhậm - Hà Đông)',     lat: 20.9655, lon: 105.7725, radiusMeters: 30 },

      // --- Cộng Cà Phê mở rộng ---
      { id: 'cong_nhatho',           zone: 'merchant', nameVi: 'Cộng Cà Phê (Nhà Thờ Lớn)',                     lat: 21.0285, lon: 105.8495, radiusMeters: 30 },
      { id: 'cong_dinh_tien_hoang',  zone: 'merchant', nameVi: 'Cộng Cà Phê (Đinh Tiên Hoàng - Bờ Hồ)',         lat: 21.0312, lon: 105.8525, radiusMeters: 30 },
      { id: 'cong_mamay',            zone: 'merchant', nameVi: 'Cộng Cà Phê (Mã Mây - Phố Cổ)',                 lat: 21.0355, lon: 105.8528, radiusMeters: 30 },
      { id: 'cong_hoangcau',         zone: 'merchant', nameVi: 'Cộng Cà Phê (Hoàng Cầu - Đống Đa)',             lat: 21.0188, lon: 105.8228, radiusMeters: 30 },
      { id: 'cong_nguyenhuuhuan',    zone: 'merchant', nameVi: 'Cộng Cà Phê (Nguyễn Hữu Huân)',                 lat: 21.0348, lon: 105.8545, radiusMeters: 30 },
      { id: 'cong_vanphuc',          zone: 'merchant', nameVi: 'Cộng Cà Phê (Làng Lụa Vạn Phúc - Hà Đông)',     lat: 20.9785, lon: 105.7715, radiusMeters: 30 },
      { id: 'cong_trichsai',         zone: 'merchant', nameVi: 'Cộng Cà Phê (Trích Sài - Ven Hồ Tây)',          lat: 21.0485, lon: 105.8225, radiusMeters: 30 },
      { id: 'cong_lieugiai',         zone: 'merchant', nameVi: 'Cộng Cà Phê (Liễu Giai - Ba Đình)',             lat: 21.0325, lon: 105.8135, radiusMeters: 30 },
      { id: 'cong_thaiha',           zone: 'merchant', nameVi: 'Cộng Cà Phê (Thái Hà)',                         lat: 21.0142, lon: 105.8182, radiusMeters: 30 },
      { id: 'cong_duytan',           zone: 'merchant', nameVi: 'Cộng Cà Phê (Duy Tân - Cầu Giấy)',              lat: 21.0312, lon: 105.7838, radiusMeters: 30 },

      // --- Phê La & Katinat mở rộng ---
      { id: 'phela_caugiay',         zone: 'merchant', nameVi: 'Trà Ô Long Phê La (Trần Quốc Vượng - Cầu Giấy)',lat: 21.0365, lon: 105.7875, radiusMeters: 30 },
      { id: 'phela_truongconggiai',  zone: 'merchant', nameVi: 'Trà Ô Long Phê La (Trương Công Giai)',          lat: 21.0285, lon: 105.7925, radiusMeters: 30 },
      { id: 'phela_phamngocthach',   zone: 'merchant', nameVi: 'Trà Ô Long Phê La (Phạm Ngọc Thạch - Đống Đa)', lat: 21.0085, lon: 105.8325, radiusMeters: 30 },
      { id: 'phela_yenphu',          zone: 'merchant', nameVi: 'Trà Ô Long Phê La (Yên Phụ - Tây Hồ)',          lat: 21.0515, lon: 105.8395, radiusMeters: 30 },
      { id: 'phela_lythuongkiet',    zone: 'merchant', nameVi: 'Trà Ô Long Phê La (Lý Thường Kiệt)',            lat: 21.0245, lon: 105.8495, radiusMeters: 30 },
      { id: 'katinat_nguyenchithanh',zone: 'merchant', nameVi: 'Katinat Saigon Kafe (Nguyễn Chí Thanh)',        lat: 21.0215, lon: 105.8095, radiusMeters: 30 },
      { id: 'katinat_vuphamham',     zone: 'merchant', nameVi: 'Katinat Saigon Kafe (Vũ Phạm Hàm - Cầu Giấy)',  lat: 21.0145, lon: 105.7985, radiusMeters: 30 },
      { id: 'katinat_lottemall',     zone: 'merchant', nameVi: 'Katinat Saigon Kafe (Lotte Mall Tây Hồ)',       lat: 21.0765, lon: 105.8125, radiusMeters: 30 },
      { id: 'katinat_tranphu_hd',    zone: 'merchant', nameVi: 'Katinat Saigon Kafe (Trần Phú - Hà Đông)',      lat: 20.9825, lon: 105.7885, radiusMeters: 30 },

      // --- Starbucks & Trung Nguyên mở rộng ---
      { id: 'starbucks_lottemall',   zone: 'merchant', nameVi: 'Starbucks Coffee (Lotte Mall Tây Hồ)',          lat: 21.0768, lon: 105.8122, radiusMeters: 35 },
      { id: 'starbucks_metropolis',  zone: 'merchant', nameVi: 'Starbucks Coffee (Vincom Metropolis Liễu Giai)',lat: 21.0315, lon: 105.8142, radiusMeters: 35 },
      { id: 'starbucks_aeon_hadong', zone: 'merchant', nameVi: 'Starbucks Coffee (Aeon Mall Hà Đông)',          lat: 20.9785, lon: 105.7482, radiusMeters: 35 },
      { id: 'starbucks_thegarden',   zone: 'merchant', nameVi: 'Starbucks Coffee (The Garden Mễ Trì)',          lat: 21.0138, lon: 105.7765, radiusMeters: 35 },
      { id: 'starbucks_oceanpark',   zone: 'merchant', nameVi: 'Starbucks Coffee (Vincom Ocean Park)',          lat: 20.9932, lon: 105.9465, radiusMeters: 35 },
      { id: 'trungnguyen_batrieu',   zone: 'merchant', nameVi: 'Trung Nguyên Legend (Bà Triệu)',                lat: 21.0135, lon: 105.8492, radiusMeters: 30 },
      { id: 'trungnguyen_quangtrung',zone: 'merchant', nameVi: 'Trung Nguyên Legend (Quang Trung - Hoàn Kiếm)', lat: 21.0195, lon: 105.8505, radiusMeters: 30 },
      { id: 'trungnguyen_hoangdaothuy',zone: 'merchant',nameVi: 'Trung Nguyên Legend (Hoàng Đạo Thúy)',         lat: 21.0075, lon: 105.8015, radiusMeters: 30 },

      // ═══════════════════════════════════════════════════════════════
      // HỆ THỐNG ĐẠI NHÀ HÀNG & ẨM THỰC VỪA VÀ LỚN HÀ NỘI
      // ═══════════════════════════════════════════════════════════════
      // --- Buffet, Lẩu Nướng & Nhà Hàng Quy Mô Lớn ---
      { id: 'sen_tayho',             zone: 'merchant', nameVi: 'Đại Tửu Lầu Sen Tây Hồ (Buffet Lạc Long Quân)', lat: 21.0695, lon: 105.8235, radiusMeters: 80 },
      { id: 'sen_namthanh',          zone: 'merchant', nameVi: 'Sen Nam Thanh (Nguyễn Du - Hai Bà Trưng)',      lat: 21.0175, lon: 105.8475, radiusMeters: 45 },
      { id: 'sen_lythaito',          zone: 'merchant', nameVi: 'Maison Sens (Trần Hưng Đạo - Hoàn Kiếm)',        lat: 21.0235, lon: 105.8535, radiusMeters: 45 },
      { id: 'trongdong_canhho',      zone: 'merchant', nameVi: 'Trống Đồng Palace Cảnh Hồ (Lê Trọng Tấn)',      lat: 20.9985, lon: 105.8285, radiusMeters: 60 },
      { id: 'trongdong_hoanggia',    zone: 'merchant', nameVi: 'Trống Đồng Palace Hoàng Gia (Lãng Yên)',        lat: 21.0115, lon: 105.8685, radiusMeters: 55 },
      { id: 'vantue_sontay',         zone: 'merchant', nameVi: 'Nhà Hàng Vạn Tuế (Sơn Tây)',                    lat: 21.1385, lon: 105.5035, radiusMeters: 50 },

      // --- Golden Gate & RedSun Chains ---
      { id: 'gogi_oceanpark',        zone: 'merchant', nameVi: 'Gogi House (Vincom Ocean Park)',                lat: 20.9935, lon: 105.9462, radiusMeters: 35 },
      { id: 'gogi_smartcity',        zone: 'merchant', nameVi: 'Gogi House (Vincom Mega Mall Smart City)',      lat: 21.0042, lon: 105.7425, radiusMeters: 35 },
      { id: 'gogi_aeon_hadong',      zone: 'merchant', nameVi: 'Gogi House (Aeon Mall Hà Đông)',                lat: 20.9785, lon: 105.7485, radiusMeters: 35 },
      { id: 'kichikichi_timescity',  zone: 'merchant', nameVi: 'Kichi Kichi (Times City)',                      lat: 20.9958, lon: 105.8675, radiusMeters: 35 },
      { id: 'kichikichi_hadong',     zone: 'merchant', nameVi: 'Kichi Kichi (Hồ Gươm Plaza Hà Đông)',           lat: 20.9835, lon: 105.7875, radiusMeters: 35 },
      { id: 'manwah_metropolis',     zone: 'merchant', nameVi: 'Manwah Taiwanese Hotpot (Metropolis Liễu Giai)',lat: 21.0318, lon: 105.8142, radiusMeters: 35 },
      { id: 'manwah_aeon_longbien',  zone: 'merchant', nameVi: 'Manwah Hotpot (Aeon Mall Long Biên)',           lat: 21.0258, lon: 105.8982, radiusMeters: 35 },
      { id: 'kingbbq_thegarden',     zone: 'merchant', nameVi: 'King BBQ Buffet (The Garden Mễ Trì)',           lat: 21.0135, lon: 105.7765, radiusMeters: 35 },
      { id: 'kingbbq_royalcity',     zone: 'merchant', nameVi: 'King BBQ (Royal City)',                         lat: 21.0028, lon: 105.8155, radiusMeters: 35 },
      { id: 'kingbbq_timescity',     zone: 'merchant', nameVi: 'King BBQ (Times City)',                         lat: 20.9955, lon: 105.8672, radiusMeters: 35 },
      { id: 'hotpotstory_royal',     zone: 'merchant', nameVi: 'Hotpot Story (Royal City Nguyễn Trãi)',         lat: 21.0025, lon: 105.8152, radiusMeters: 35 },
      { id: 'isushi_hoangdaothuy',   zone: 'merchant', nameVi: 'Isushi Japanese Dining (Hoàng Đạo Thúy)',       lat: 21.0078, lon: 105.8018, radiusMeters: 35 },
      { id: 'sumobbq_huynhthuckhang',zone: 'merchant', nameVi: 'Sumo Yakiniku (Huỳnh Thúc Kháng)',             lat: 21.0182, lon: 105.8118, radiusMeters: 35 },
      { id: 'ashima_trieuvietvuong', zone: 'merchant', nameVi: 'Lẩu Nấm Thiên Nhiên Ashima (Triệu Việt Vương)', lat: 21.0128, lon: 105.8515, radiusMeters: 35 },
      { id: 'cowboy_jacks_tranduyhung',zone: 'merchant',nameVi: 'Cowboy Jack\'s Saloon (Trần Duy Hưng)',        lat: 21.0068, lon: 105.7942, radiusMeters: 35 },

      // --- Fast Food & Pizza Chains ---
      { id: 'kfc_xuanthuy',          zone: 'merchant', nameVi: 'Gà Rán KFC (Xuân Thủy - Cầu Giấy)',             lat: 21.0368, lon: 105.7852, radiusMeters: 30 },
      { id: 'kfc_hadong',            zone: 'merchant', nameVi: 'Gà Rán KFC (Quang Trung - Hà Đông)',            lat: 20.9715, lon: 105.7758, radiusMeters: 30 },
      { id: 'kfc_batrieu',           zone: 'merchant', nameVi: 'Gà Rán KFC (Bà Triệu - Hoàn Kiếm)',             lat: 21.0125, lon: 105.8495, radiusMeters: 30 },
      { id: 'lotteria_caugiay',      zone: 'merchant', nameVi: 'Gà Rán Lotteria (Cầu Giấy)',                    lat: 21.0345, lon: 105.7945, radiusMeters: 30 },
      { id: 'lotteria_thanhxuan',    zone: 'merchant', nameVi: 'Gà Rán Lotteria (Nguyễn Trãi)',                 lat: 20.9985, lon: 105.8085, radiusMeters: 30 },
      { id: 'mcdonalds_hoangdaothuy',zone: 'merchant', nameVi: 'McDonald\'s (Hoàng Đạo Thúy - Cầu Giấy)',       lat: 21.0082, lon: 105.8022, radiusMeters: 35 },
      { id: 'mcdonalds_aeon_longbien',zone: 'merchant',nameVi: 'McDonald\'s (Aeon Mall Long Biên)',             lat: 21.0252, lon: 105.8985, radiusMeters: 35 },
      { id: 'jollibee_coopmart',     zone: 'merchant', nameVi: 'Gà Rán Jollibee (Co.opmart Hà Đông)',           lat: 20.9828, lon: 105.7892, radiusMeters: 30 },
      { id: 'pizzahut_xuanthuy',     zone: 'merchant', nameVi: 'Pizza Hut (Xuân Thủy - Cầu Giấy)',              lat: 21.0362, lon: 105.7845, radiusMeters: 30 },
      { id: 'pizzahut_tonducthang',  zone: 'merchant', nameVi: 'Pizza Hut (Tôn Đức Thắng - Đống Đa)',           lat: 21.0245, lon: 105.8345, radiusMeters: 30 },
      { id: 'dominos_tranduyhung',   zone: 'merchant', nameVi: 'Domino\'s Pizza (Trần Duy Hưng)',               lat: 21.0075, lon: 105.7955, radiusMeters: 30 },
      { id: 'thepizzacompany_caugiay',zone: 'merchant',nameVi: 'The Pizza Company (Cầu Giấy)',                  lat: 21.0342, lon: 105.7935, radiusMeters: 30 },
      { id: 'thepizzacompany_times', zone: 'merchant', nameVi: 'The Pizza Company (Times City)',                lat: 20.9958, lon: 105.8678, radiusMeters: 30 },

      // 3.4. Đại Siêu Thị, Trung Tâm Mua Sắm & Đại Trung Tâm Thương Mại Mới
      { id: 'lottemall_tayho',      zone: 'merchant', nameVi: 'Đại Thạch Thành Lotte Mall Tây Hồ (Võ Chí Công)',lat: 21.0765, lon: 105.8125, radiusMeters: 160 },
      { id: 'aeon_hadong',          zone: 'merchant', nameVi: 'Đại Thương Thị Aeon Mall Hà Đông (Dương Nội)', lat: 20.9785, lon: 105.7485, radiusMeters: 170 },
      { id: 'megamarket_thanglong', zone: 'merchant', nameVi: 'Đại Kho MM Mega Market Thăng Long (Phạm Văn Đồng)',lat: 21.0515, lon: 105.7812, radiusMeters: 120 },
      { id: 'coopmart_hadong',      zone: 'merchant', nameVi: 'Đại Siêu Thị Co.opmart (Trần Phú Hà Đông)',    lat: 20.9825, lon: 105.7895, radiusMeters: 80 },
      { id: 'topsmarket_thegarden', zone: 'merchant', nameVi: 'Tops Market (The Garden Mễ Trì)',              lat: 21.0138, lon: 105.7768, radiusMeters: 75 },
      { id: 'topsmarket_parkcity',  zone: 'merchant', nameVi: 'Tops Market (Park City Hà Đông)',              lat: 20.9615, lon: 105.7562, radiusMeters: 75 },
      { id: 'vincom_smartcity',     zone: 'merchant', nameVi: 'Đại Trung Tâm Vincom Mega Mall (Smart City)',  lat: 21.0042, lon: 105.7425, radiusMeters: 130 },
      { id: 'vincom_metropolis',    zone: 'merchant', nameVi: 'Thần Điện Mua Sắm Vincom Center (Metropolis)', lat: 21.0318, lon: 105.8142, radiusMeters: 70 },
      { id: 'vincom_nguyenchi thanh',zone: 'merchant',nameVi: 'Kim Tháp Vincom Center (Nguyễn Chí Thanh)',     lat: 21.0235, lon: 105.8115, radiusMeters: 75 },
      { id: 'vincom_tranduyhung',   zone: 'merchant', nameVi: 'Thạch Trấn Vincom Plaza (Trần Duy Hưng)',      lat: 21.0068, lon: 105.7948, radiusMeters: 75 },

      // 3.5. Hệ Thống Thảo Dược Đường FPT Long Châu & Thần Dược Phường Pharmacity (Hồi Máu, Cấp Cứu, Trị Bệnh)
      // --- FPT LONG CHÂU ---
      { id: 'pharm_lc_caugiay',     zone: 'merchant', nameVi: 'Thảo Dược Đường FPT Long Châu (Cầu Giấy)',        lat: 21.0342, lon: 105.7965, radiusMeters: 30 },
      { id: 'pharm_lc_xuanthuy',    zone: 'merchant', nameVi: 'Thảo Dược Đường FPT Long Châu (Xuân Thủy)',       lat: 21.0368, lon: 105.7865, radiusMeters: 30 },
      { id: 'pharm_lc_hamnghi',     zone: 'merchant', nameVi: 'Thảo Dược Đường FPT Long Châu (Hàm Nghi - Mỹ Đình)', lat: 21.0348, lon: 105.7668, radiusMeters: 30 },
      { id: 'pharm_lc_leductho',    zone: 'merchant', nameVi: 'Thảo Dược Đường FPT Long Châu (Lê Đức Thọ)',       lat: 21.0305, lon: 105.7725, radiusMeters: 30 },
      { id: 'pharm_lc_hotungmau',   zone: 'merchant', nameVi: 'Thảo Dược Đường FPT Long Châu (Hồ Tùng Mậu)',     lat: 21.0378, lon: 105.7705, radiusMeters: 30 },
      { id: 'pharm_lc_nguyenphongsac',zone: 'merchant',nameVi: 'Thảo Dược Đường FPT Long Châu (Nguyễn Phong Sắc)',lat: 21.0368, lon: 105.7905, radiusMeters: 30 },
      { id: 'pharm_lc_tranduyhung', zone: 'merchant', nameVi: 'Thảo Dược Đường FPT Long Châu (Trần Duy Hưng)',   lat: 21.0078, lon: 105.7965, radiusMeters: 30 },
      { id: 'pharm_lc_nguyentrai',  zone: 'merchant', nameVi: 'Thảo Dược Đường FPT Long Châu (Nguyễn Trãi - Thanh Xuân)', lat: 20.9975, lon: 105.8085, radiusMeters: 30 },
      { id: 'pharm_lc_levanluong',  zone: 'merchant', nameVi: 'Thảo Dược Đường FPT Long Châu (Lê Văn Lương)',    lat: 21.0055, lon: 105.8015, radiusMeters: 30 },
      { id: 'pharm_lc_quangtrung',  zone: 'merchant', nameVi: 'Thảo Dược Đường FPT Long Châu (Quang Trung - Hà Đông)', lat: 20.9718, lon: 105.7752, radiusMeters: 30 },
      { id: 'pharm_lc_tranphu',     zone: 'merchant', nameVi: 'Thảo Dược Đường FPT Long Châu (Trần Phú - Hà Đông)', lat: 20.9835, lon: 105.7875, radiusMeters: 30 },
      { id: 'pharm_lc_kimma',       zone: 'merchant', nameVi: 'Thảo Dược Đường FPT Long Châu (Kim Mã - Ba Đình)', lat: 21.0318, lon: 105.8175, radiusMeters: 30 },
      { id: 'pharm_lc_doican',      zone: 'merchant', nameVi: 'Thảo Dược Đường FPT Long Châu (Đội Cấn)',         lat: 21.0375, lon: 105.8235, radiusMeters: 30 },
      { id: 'pharm_lc_tayson',      zone: 'merchant', nameVi: 'Thảo Dược Đường FPT Long Châu (Tây Sơn - Đống Đa)', lat: 21.0085, lon: 105.8245, radiusMeters: 30 },
      { id: 'pharm_lc_hangbong',    zone: 'merchant', nameVi: 'Thảo Dược Đường FPT Long Châu (Hàng Bông - Hoàn Kiếm)', lat: 21.0305, lon: 105.8458, radiusMeters: 30 },
      { id: 'pharm_lc_haibatrung',  zone: 'merchant', nameVi: 'Thảo Dược Đường FPT Long Châu (Hai Bà Trưng)',    lat: 21.0238, lon: 105.8525, radiusMeters: 30 },
      { id: 'pharm_lc_giaiphong',   zone: 'merchant', nameVi: 'Thảo Dược Đường FPT Long Châu (Giải Phóng)',       lat: 20.9865, lon: 105.8405, radiusMeters: 30 },
      { id: 'pharm_lc_minhkhai',    zone: 'merchant', nameVi: 'Thảo Dược Đường FPT Long Châu (Minh Khai)',       lat: 20.9968, lon: 105.8625, radiusMeters: 30 },
      { id: 'pharm_lc_laclongquan', zone: 'merchant', nameVi: 'Thảo Dược Đường FPT Long Châu (Lạc Long Quân - Tây Hồ)', lat: 21.0615, lon: 105.8095, radiusMeters: 30 },
      { id: 'pharm_lc_nguyenvancu', zone: 'merchant', nameVi: 'Thảo Dược Đường FPT Long Châu (Nguyễn Văn Cừ - Long Biên)', lat: 21.0465, lon: 105.8715, radiusMeters: 30 },
      { id: 'pharm_lc_linhdam',     zone: 'merchant', nameVi: 'Thảo Dược Đường FPT Long Châu (Bán Đảo Linh Đàm)', lat: 20.9675, lon: 105.8295, radiusMeters: 30 },

      // --- PHARMACITY ---
      { id: 'pharm_pm_duytan',      zone: 'merchant', nameVi: 'Thần Dược Phường Pharmacity (Duy Tân - Cầu Giấy)', lat: 21.0308, lon: 105.7835, radiusMeters: 30 },
      { id: 'pharm_pm_xuanthuy',    zone: 'merchant', nameVi: 'Thần Dược Phường Pharmacity (Xuân Thủy)',         lat: 21.0362, lon: 105.7852, radiusMeters: 30 },
      { id: 'pharm_pm_nguyenhoang', zone: 'merchant', nameVi: 'Thần Dược Phường Pharmacity (Nguyễn Hoàng - Mỹ Đình)', lat: 21.0295, lon: 105.7758, radiusMeters: 30 },
      { id: 'pharm_pm_tranthaitong',zone: 'merchant', nameVi: 'Thần Dược Phường Pharmacity (Trần Thái Tông)',    lat: 21.0315, lon: 105.7902, radiusMeters: 30 },
      { id: 'pharm_pm_metri',       zone: 'merchant', nameVi: 'Thần Dược Phường Pharmacity (Mễ Trì)',            lat: 21.0125, lon: 105.7755, radiusMeters: 30 },
      { id: 'pharm_pm_tranhungdao', zone: 'merchant', nameVi: 'Thần Dược Phường Pharmacity (Trần Hưng Đạo)',    lat: 21.0235, lon: 105.8512, radiusMeters: 30 },
      { id: 'pharm_pm_giangvo',     zone: 'merchant', nameVi: 'Thần Dược Phường Pharmacity (Giảng Võ - Ba Đình)', lat: 21.0275, lon: 105.8225, radiusMeters: 30 },
      { id: 'pharm_pm_xadan',       zone: 'merchant', nameVi: 'Thần Dược Phường Pharmacity (Xã Đàn - Đống Đa)',  lat: 21.0155, lon: 105.8325, radiusMeters: 30 },
      { id: 'pharm_pm_chuaboc',     zone: 'merchant', nameVi: 'Thần Dược Phường Pharmacity (Chùa Bộc)',          lat: 21.0068, lon: 105.8285, radiusMeters: 30 },
      { id: 'pharm_pm_nguyentuan',  zone: 'merchant', nameVi: 'Thần Dược Phường Pharmacity (Nguyễn Tuân - Thanh Xuân)', lat: 21.0015, lon: 105.8035, radiusMeters: 30 },
      { id: 'pharm_pm_vutrongphung',zone: 'merchant', nameVi: 'Thần Dược Phường Pharmacity (Vũ Trọng Phụng)',    lat: 21.0028, lon: 105.8062, radiusMeters: 30 },
      { id: 'pharm_pm_tohieu',      zone: 'merchant', nameVi: 'Thần Dược Phường Pharmacity (Tô Hiệu - Hà Đông)', lat: 20.9685, lon: 105.7785, radiusMeters: 30 },
      { id: 'pharm_pm_timescity',   zone: 'merchant', nameVi: 'Thần Dược Phường Pharmacity (Times City - Hai Bà Trưng)', lat: 20.9958, lon: 105.8682, radiusMeters: 30 },
      { id: 'pharm_pm_smartcity',   zone: 'merchant', nameVi: 'Thần Dược Phường Pharmacity (Vinhomes Smart City)', lat: 21.0035, lon: 105.7435, radiusMeters: 30 },
      { id: 'pharm_pm_xuanla',      zone: 'merchant', nameVi: 'Thần Dược Phường Pharmacity (Xuân La - Tây Hồ)',   lat: 21.0628, lon: 105.8035, radiusMeters: 30 },
      { id: 'pharm_pm_ngogiattu',   zone: 'merchant', nameVi: 'Thần Dược Phường Pharmacity (Ngô Gia Tự - Long Biên)', lat: 21.0655, lon: 105.8885, radiusMeters: 30 },

      // 4. Mạng Lưới Tiền Đồn Trạm Dừng Xe Buýt & Ga Metro Trung Chuyển Toàn Thành
      { id: 'bus_caugiay',      zone: 'merchant', nameVi: 'Tiền Đồn Trạm Dừng (Cầu Giấy — Chùa Hà)', lat: 21.0338, lon: 105.7932, radiusMeters: 30 },
      { id: 'bus_hotungmau',    zone: 'merchant', nameVi: 'Tiền Đồn Trạm Dừng (Hồ Tùng Mậu)',          lat: 21.0375, lon: 105.7695, radiusMeters: 30 },
      { id: 'bus_nguyentrai',   zone: 'merchant', nameVi: 'Tiền Đồn Trạm Dừng (Nguyễn Trãi — Khuất Duy Tiến)', lat: 20.9965, lon: 105.8015, radiusMeters: 30 },
      { id: 'bus_giaiphong',    zone: 'merchant', nameVi: 'Tiền Đồn Trạm Dừng (Giải Phóng — Đuôi Cá)',   lat: 20.9855, lon: 105.8415, radiusMeters: 30 },
      { id: 'bus_kimma',        zone: 'merchant', nameVi: 'Tiền Đồn Trạm Dừng (Kim Mã — Ngọc Khánh)', lat: 21.0315, lon: 105.8165, radiusMeters: 30 },
      { id: 'bus_longbien',     zone: 'merchant', nameVi: 'Đại Tiền Đồn Trung Chuyển Long Biên (Yên Phụ)', lat: 21.0415, lon: 105.8515, radiusMeters: 45 },
      { id: 'bus_mydinh',       zone: 'merchant', nameVi: 'Đại Tiền Đồn Viễn Chinh Bến Xe Mỹ Đình',     lat: 21.0285, lon: 105.7782, radiusMeters: 50 },
      { id: 'bus_hadong',       zone: 'merchant', nameVi: 'Tiền Đồn Trạm Dừng (Bưu Điện Hà Đông)',      lat: 20.9715, lon: 105.7765, radiusMeters: 30 },
      { id: 'bus_nhathalon',    zone: 'merchant', nameVi: 'Tiền Đồn Trạm Dừng (Nhà Hát Lớn — Tràng Tiền)', lat: 21.0245, lon: 105.8568, radiusMeters: 30 },
      { id: 'bus_catlinh',      zone: 'merchant', nameVi: 'Đại Tiền Đồn Ga Metro Cát Linh',            lat: 21.0282, lon: 105.8275, radiusMeters: 40 },
      { id: 'bus_tayho',        zone: 'merchant', nameVi: 'Tiền Đồn Trạm Dừng (Lạc Long Quân — Hồ Tây)', lat: 21.0625, lon: 105.8085, radiusMeters: 30 },
      { id: 'bus_nuocngam',     zone: 'merchant', nameVi: 'Tiền Đồn Bến Xe Nước Ngầm (Pháp Vân)',       lat: 20.9635, lon: 105.8425, radiusMeters: 45 },

      // 5. Khu Trung Tâm Hoàn Kiếm, Ba Đình & Cầu Long Biên
      { id: 'p1',   zone: 'water',    nameVi: 'Hồ Gươm',                                    lat: 21.0287, lon: 105.8524, radiusMeters: 140 },
      { id: 'p2',   zone: 'forest',   nameVi: 'Vườn hoa Lý Thái Tổ',                        lat: 21.0295, lon: 105.8546, radiusMeters: 65 },
      { id: 'p3',   zone: 'merchant', nameVi: 'Chợ Đồng Xuân',                              lat: 21.0382, lon: 105.8497, radiusMeters: 55 },
      { id: 'p4',   zone: 'forest',   nameVi: 'Vườn hoa Cổ Tân',                            lat: 21.0245, lon: 105.8583, radiusMeters: 50 },
      { id: 'p5',   zone: 'merchant', nameVi: 'Cửa hàng Tràng Tiền',                        lat: 21.0248, lon: 105.8535, radiusMeters: 45 },
      { id: 'p6',   zone: 'water',    nameVi: 'Hồ Thiền Quang',                             lat: 21.0165, lon: 105.8467, radiusMeters: 90 },
      { id: 'p7',   zone: 'forest',   nameVi: 'Công viên Thống Nhất',                       lat: 21.0128, lon: 105.8434, radiusMeters: 220 },
      { id: 'hk_05', zone: 'merchant', nameVi: 'Đại Điện Thính Âm Cổ (Nhà Hát Lớn)',       lat: 21.0243, lon: 105.8576, radiusMeters: 50 },
      { id: 'hk_06', zone: 'forest',   nameVi: 'Cổ Tháp Đá Thánh (Nhà Thờ Lớn)',           lat: 21.0288, lon: 105.8495, radiusMeters: 45 },
      { id: 'hk_07', zone: 'forest',   nameVi: 'Cầu Cổ Long Cốt (Cầu Long Biên)',          lat: 21.0435, lon: 105.8569, radiusMeters: 90 },
      { id: 'bd_01', zone: 'forest',   nameVi: 'Phế Tích Cổ Loa Vương Thành (Hoàng Thành)',lat: 21.0348, lon: 105.8398, radiusMeters: 130 },
      { id: 'bd_02', zone: 'forest',   nameVi: 'Thánh Địa Trưởng Lão Ba Đình (Lăng Bác)',  lat: 21.0368, lon: 105.8347, radiusMeters: 120 },
      { id: 'bd_03', zone: 'merchant', nameVi: 'Thần Điện Văn Miếu Quốc Tử Giám',          lat: 21.0293, lon: 105.8355, radiusMeters: 75 },
      { id: 'bd_04', zone: 'merchant', nameVi: 'Hầm Mỏ Đầu Rồng Cổ (Ga Hà Nội)',           lat: 21.0245, lon: 105.8415, radiusMeters: 65 },
      { id: 'bd_05', zone: 'forest',   nameVi: 'Liên Hoa Cổ Tự (Chùa Một Cột)',            lat: 21.0358, lon: 105.8335, radiusMeters: 45 },

      // 6. Tây Hồ & Trúc Bạch
      { id: 'th_01', zone: 'water',    nameVi: 'Đại Hồ Sương Mù Tây Hồ',                   lat: 21.0558, lon: 105.8235, radiusMeters: 350 },
      { id: 'th_02', zone: 'water',    nameVi: 'Vịnh Nước Thần Trúc Bạch',                 lat: 21.0475, lon: 105.8375, radiusMeters: 120 },
      { id: 'th_03', zone: 'forest',   nameVi: 'Bảo Tháp Phù Vân Trấn Quốc',               lat: 21.0478, lon: 105.8362, radiusMeters: 55 },
      { id: 'th_04', zone: 'forest',   nameVi: 'Rừng Dừa Ven Đại Hồ Tây',                  lat: 21.0625, lon: 105.8285, radiusMeters: 90 },
      { id: 'lotte_center', zone: 'merchant', nameVi: 'Bạch Ngọc Tháp Cổ (Lotte Liễu Giai)',lat: 21.0322, lon: 105.8122, radiusMeters: 70 },
      { id: 'cv_thule',     zone: 'forest',   nameVi: 'Bách Thú Thần Viên (Công Viên Thủ Lệ)', lat: 21.0315, lon: 105.8085, radiusMeters: 140 },
      { id: 'cv_bachthao',  zone: 'forest',   nameVi: 'Vạn Mộc Thảo Viên (Công Viên Bách Thảo)',lat: 21.0395, lon: 105.8315, radiusMeters: 110 },

      // 7. Hai Bà Trưng, Đống Đa & Hoàng Mai & Thanh Xuân
      { id: 'tn_02', zone: 'water',    nameVi: 'Hồ Cá Thần Bảy Mẫu',                       lat: 21.0115, lon: 105.8425, radiusMeters: 130 },
      { id: 'tn_03', zone: 'water',    nameVi: 'Vũng Nước Thiêng Ba Mẫu',                  lat: 21.0145, lon: 105.8395, radiusMeters: 80 },
      { id: 'tn_06', zone: 'forest',   nameVi: 'Thảo Dược Viện Cổ Bạch Mai (Bệnh Viện)',   lat: 21.0028, lon: 105.8398, radiusMeters: 85 },
      { id: 'tn_07', zone: 'merchant', nameVi: 'Lò Luyện Kim Khí Bách Khoa (ĐH Bách Khoa)',lat: 21.0055, lon: 105.8435, radiusMeters: 80 },
      { id: 'dh_ktqd', zone: 'merchant', nameVi: 'Đại Thương Hội Quốc Dân (ĐH KTQD)',       lat: 21.0005, lon: 105.8425, radiusMeters: 75 },
      { id: 'dh_xaydung', zone: 'merchant', nameVi: 'Thạch Thợ Viện Xây Dựng (ĐH Xây Dựng)',lat: 21.0035, lon: 105.8445, radiusMeters: 70 },
      { id: 'dh_y',     zone: 'forest',   nameVi: 'Dược Thảo Học Viện (ĐH Y Hà Nội)',       lat: 21.0035, lon: 105.8315, radiusMeters: 75 },
      { id: 'dh_ftu',   zone: 'merchant', nameVi: 'Vạn Lý Bang Hội (ĐH Ngoại Thương)',      lat: 21.0225, lon: 105.8035, radiusMeters: 70 },
      { id: 'dh_luat',  zone: 'merchant', nameVi: 'Hình Luật Thần Điện (ĐH Luật Hà Nội)',   lat: 21.0205, lon: 105.8085, radiusMeters: 65 },
      { id: 'hv_bank',  zone: 'merchant', nameVi: 'Kim Khí Khố Viện (Học Viện Ngân Hàng)',  lat: 21.0095, lon: 105.8295, radiusMeters: 70 },
      { id: 'hm_01', zone: 'water',    nameVi: 'Đầm Lầy Cá Thần Yên Sở (Công Viên Yên Sở)',lat: 20.9735, lon: 105.8612, radiusMeters: 260 },
      { id: 'hm_02', zone: 'water',    nameVi: 'Quần Đảo Đầm Linh Đàm (Bán Đảo Linh Đàm)', lat: 20.9665, lon: 105.8295, radiusMeters: 180 },
      { id: 'ho_trieukhuc', zone: 'water', nameVi: 'Hồ Nước Đọng Cổ Triều Khúc',            lat: 20.9885, lon: 105.8015, radiusMeters: 65 },
      { id: 'ho_dongda',    zone: 'water', nameVi: 'Đầm Súng Hoàng Cầu (Hồ Đống Đa)',       lat: 21.0195, lon: 105.8225, radiusMeters: 90 },
      { id: 'ho_thanhcong', zone: 'water', nameVi: 'Hồ Nước Ngọt Thành Công',              lat: 21.0205, lon: 105.8155, radiusMeters: 80 },
      { id: 'ho_giangvo',   zone: 'water', nameVi: 'Vũng Nước Trầm Giảng Võ',              lat: 21.0285, lon: 105.8225, radiusMeters: 85 },
      { id: 'ho_ngocthanh', zone: 'water', nameVi: 'Đầm Ngọc Khánh',                        lat: 21.0285, lon: 105.8115, radiusMeters: 75 },

      // --- THƯỢNG ĐÌNH & THANH XUÂN ---
      { id: 'nha_may_bia_thuongdinh', zone: 'merchant', nameVi: 'Lò Nấu Thần Tửu Tiền Sử (Nhà Máy Bia Hà Nội - Thượng Đình)', lat: 20.9945, lon: 105.8215, radiusMeters: 120 },
      { id: 'cv_thuongdinh',          zone: 'forest',   nameVi: 'Thảo Nguyên Hoang Cổ Thượng Đình (Công Viên Thượng Đình)',  lat: 20.9915, lon: 105.8255, radiusMeters: 100 },
      { id: 'cho_thuongdinh',         zone: 'merchant', nameVi: 'Chợ Phiên Cổ Đại (Chợ Thượng Đình)',                        lat: 20.9935, lon: 105.8195, radiusMeters: 75 },
      { id: 'ho_thuongdinh',          zone: 'water',    nameVi: 'Hồ Câu Cá Thần Thượng Đình (Hồ Thượng Đình)',               lat: 20.9928, lon: 105.8172, radiusMeters: 80 },
      { id: 'highlands_thuongdinh',   zone: 'merchant', nameVi: 'Highlands Coffee (Lối Mòn Thượng Đình)',                    lat: 20.9950, lon: 105.8230, radiusMeters: 28 },
      { id: 'tch_thuongdinh',         zone: 'merchant', nameVi: 'The Coffee House (Khu Thượng Đình)',                        lat: 20.9960, lon: 105.8240, radiusMeters: 28 },
      { id: 'cong_thuongdinh',        zone: 'merchant', nameVi: 'Cộng Cà Phê (Cổ Đạo Nguyễn Trãi - Thượng Đình)',           lat: 20.9925, lon: 105.8265, radiusMeters: 28 },
      { id: 'cv_nguyentrai_tx',       zone: 'forest',   nameVi: 'Vườn Rừng Nguyễn Trãi (Công Viên Nhỏ Thanh Xuân)',         lat: 20.9975, lon: 105.8180, radiusMeters: 60 },
      { id: 'bx_giapbat',             zone: 'merchant', nameVi: 'Trạm Lữ Khách Phương Nam (Bến Xe Giáp Bát)',               lat: 20.9908, lon: 105.8388, radiusMeters: 90 },
      { id: 'hl_giapbat',             zone: 'merchant', nameVi: 'Highlands Coffee (Bến Xe Giáp Bát)',                       lat: 20.9912, lon: 105.8395, radiusMeters: 28 },
      { id: 'vincom_nguyen_chi_thanh_tx', zone: 'merchant', nameVi: 'Đại Tháp Vincom (Cổ Đạo Nguyễn Chí Thanh - Thanh Xuân)', lat: 21.0030, lon: 105.8088, radiusMeters: 70 },

      // 8. Khu Vực Bắc Từ Liêm, Đông Anh, Mê Linh & Sóc Sơn
      { id: 'cv_hoabinh',   zone: 'forest',   nameVi: 'Thung Lũng Cổ Bình Yên (Công Viên Hoà Bình)', lat: 21.0655, lon: 105.7865, radiusMeters: 140 },
      { id: 'dh_congnghiep',zone: 'merchant', nameVi: 'Đại Lò Rèn Khí Cụ (ĐH Công Nghiệp Hà Nội)', lat: 21.0535, lon: 105.7355, radiusMeters: 80 },
      { id: 'dh_mo_diachat',zone: 'merchant', nameVi: 'Thần Khai Khoáng Điện (ĐH Mỏ - Địa Chất)',   lat: 21.0725, lon: 105.7735, radiusMeters: 75 },

      // --- ĐÔNG ANH ---
      { id: 'thanh_coloa',  zone: 'forest',   nameVi: 'Kinh Đô Cổ Rùa Vàng (Thành Cổ Loa - Đông Anh)', lat: 21.1125, lon: 105.8715, radiusMeters: 250 },
      { id: 'gieng_ngoc_coloa', zone: 'water', nameVi: 'Giếng Ngọc Mỵ Châu Trọng Thủy (Cổ Loa)',       lat: 21.1145, lon: 105.8705, radiusMeters: 80 },
      { id: 'ho_vantri',    zone: 'water',    nameVi: 'Đại Hồ Sinh Thái Vân Trì (Đông Anh)',          lat: 21.1340, lon: 105.7980, radiusMeters: 260 },
      { id: 'cho_to_donganh',zone: 'merchant', nameVi: 'Chợ Cổ Nghìn Năm (Chợ Tó - Đông Anh)',         lat: 21.1310, lon: 105.8570, radiusMeters: 100 },
      { id: 'lang_moc_vanha',zone: 'merchant', nameVi: 'Mộc Nghệ Thần Thôn (Làng Nghề Mộc Vân Hà)',     lat: 21.1350, lon: 105.9080, radiusMeters: 110 },
      { id: 'bai_cat_nhattan',zone: 'water',  nameVi: 'Bãi Cát Phù Sa Bắc Sông Hồng (Cầu Nhật Tân)',  lat: 21.0920, lon: 105.8180, radiusMeters: 160 },
      { id: 'cho_kimchung', zone: 'merchant', nameVi: 'Thương Hội Vùng Biên (Chợ Kim Chung - Đông Anh)',lat: 21.1210, lon: 105.7790, radiusMeters: 90 },
      { id: 'lang_duc_dong_mailam', zone: 'merchant', nameVi: 'Lò Đúc Đồng Cổ Truyền (Mai Lâm - Đông Anh)', lat: 21.0880, lon: 105.8820, radiusMeters: 85 },
      { id: 'highlands_donganh', zone: 'merchant', nameVi: 'Highlands Coffee (Lối Mòn Cao Lỗ — Đông Anh)', lat: 21.1380, lon: 105.8475, radiusMeters: 30 },
      { id: 'tch_donganh',  zone: 'merchant', nameVi: 'The Coffee House (Cao Lỗ — Đông Anh)',         lat: 21.1392, lon: 105.8465, radiusMeters: 30 },
      { id: 'cong_donganh', zone: 'merchant', nameVi: 'Cộng Cà Phê (Thị Trấn Đông Anh)',              lat: 21.1365, lon: 105.8490, radiusMeters: 30 },
      { id: 'aha_donganh',  zone: 'merchant', nameVi: 'Aha Cafe (Khu Đô Thị Uy Nỗ — Đông Anh)',       lat: 21.1345, lon: 105.8530, radiusMeters: 30 },
      { id: 'cafe_vantri_eco', zone: 'merchant', nameVi: 'Cà Phê View Thủy Tạ Hồ Vân Trì (Đông Anh)', lat: 21.1335, lon: 105.7995, radiusMeters: 35 },
      { id: 'mixue_donganh',zone: 'merchant', nameVi: 'Mixue Trà Kem Tuyết (Cao Lỗ — Đông Anh)',     lat: 21.1370, lon: 105.8480, radiusMeters: 25 },

      // --- MÊ LINH ---
      { id: 'den_haibatrung',zone: 'forest',  nameVi: 'Nữ Vương Thần Miếu (Đền Hai Bà Trưng - Mê Linh)', lat: 21.1785, lon: 105.7235, radiusMeters: 180 },
      { id: 'lang_hoa_melinh',zone: 'forest', nameVi: 'Vạn Sắc Bách Hoa Viên (Làng Hoa Mê Linh)',      lat: 21.1680, lon: 105.7480, radiusMeters: 200 },
      { id: 'dam_trang_melinh',zone: 'water', nameVi: 'Đại Đầm Trắng Thần Thủy (Đầm Trắng - Mê Linh)', lat: 21.2050, lon: 105.7180, radiusMeters: 220 },
      { id: 'cho_hoa_melinh',zone: 'merchant',nameVi: 'Chợ Hoa Đầu Mối Nông Sản Mê Linh',              lat: 21.1620, lon: 105.7380, radiusMeters: 100 },
      { id: 'bai_boi_thachda',zone: 'water',  nameVi: 'Bãi Bồi Nông Phì Chu Phan - Thạch Đà (Mê Linh)',lat: 21.2150, lon: 105.6750, radiusMeters: 160 },
      { id: 'doi_thong_melinh',zone: 'forest',nameVi: 'Đồi Thông Thần Cốc (Khu Đồi Sinh Thái Mê Linh)',lat: 21.2280, lon: 105.7350, radiusMeters: 150 },
      { id: 'trung_tam_melinh',zone: 'merchant',nameVi: 'Thương Thành Cổ Phía Bắc (Mê Linh Plaza)',    lat: 21.1750, lon: 105.7580, radiusMeters: 120 },
      { id: 'highlands_melinh',zone: 'merchant',nameVi: 'Highlands Coffee (Mê Linh Plaza)',            lat: 21.1755, lon: 105.7585, radiusMeters: 35 },
      { id: 'tch_melinh',   zone: 'merchant', nameVi: 'The Coffee House (KĐT Hà Phong — Mê Linh)',     lat: 21.1720, lon: 105.7510, radiusMeters: 30 },
      { id: 'cong_melinh',  zone: 'merchant', nameVi: 'Cộng Cà Phê (Đại Lộ Mê Linh)',                  lat: 21.1690, lon: 105.7540, radiusMeters: 30 },
      { id: 'cafe_vuonhoa_melinh', zone: 'merchant', nameVi: 'Cà Phê Vườn Hoa Hồng (Làng Hoa Mê Linh)',lat: 21.1675, lon: 105.7460, radiusMeters: 35 },
      { id: 'aha_melinh',   zone: 'merchant', nameVi: 'Aha Cafe (Cienco 5 Mê Linh)',                   lat: 21.1610, lon: 105.7610, radiusMeters: 30 },
      { id: 'cafe_damtrang_view', zone: 'merchant', nameVi: 'Cà Phê Thủy Cảnh Đầm Trắng (Mê Linh)',   lat: 21.2040, lon: 105.7190, radiusMeters: 35 },

      // --- SÓC SƠN ---
      { id: 'den_soc',      zone: 'forest',   nameVi: 'Thánh Địa Phù Đổng Thiên Vương (Đền Gióng Sóc Sơn)', lat: 21.2825, lon: 105.8235, radiusMeters: 180 },
      { id: 'ho_hamlon',    zone: 'water',    nameVi: 'Đại Đầm Thủy Quái Hàm Lợn (Sóc Sơn)',        lat: 21.3125, lon: 105.7935, radiusMeters: 200 },
      { id: 'ho_dongquan',  zone: 'water',    nameVi: 'Hồ Nước Thiêng Đồng Quan (Sóc Sơn)',         lat: 21.2955, lon: 105.8155, radiusMeters: 160 },

      // 9. Khu Vực Long Biên & Gia Lâm (Phía Đông Sông Hồng)
      { id: 'aeon_longbien',zone: 'merchant', nameVi: 'Đông Cương Đại Thương Thị (Aeon Mall Long Biên)', lat: 21.0255, lon: 105.8985, radiusMeters: 110 },
      { id: 'thao_nguyen_hoa',zone: 'forest', nameVi: 'Bách Hoa Thảo Nguyên Long Biên',               lat: 21.0225, lon: 105.8755, radiusMeters: 90 },
      { id: 'lang_battrang',zone: 'water',    nameVi: 'Thần Lò Gốm Sứ Thiên Thu (Làng Gốm Bát Tràng)',lat: 20.9725, lon: 105.9125, radiusMeters: 130 },
      { id: 'ocean_park',   zone: 'water',    nameVi: 'Biển Hồ Nước Mặn Tiền Sử (Vinhomes Ocean Park)',lat: 20.9925, lon: 105.9455, radiusMeters: 200 },

      // 10. Khu Vực Sơn Tây & Ba Vì (Thánh Địa Phía Tây)
      { id: 'thanh_sontay', zone: 'forest',   nameVi: 'Thạch Thành Cổ Đá Ong (Thành Cổ Sơn Tây)',   lat: 21.1385, lon: 105.5035, radiusMeters: 170 },
      { id: 'lang_duonglam',zone: 'merchant', nameVi: 'Cổ Thôn Nhị Vị Tiên Vương (Đường Lâm)',      lat: 21.1465, lon: 105.4785, radiusMeters: 140 },
      { id: 'ho_dongmo',    zone: 'water',    nameVi: 'Đại Hồ Đảo Ngọc Đồng Mô (Sơn Tây)',          lat: 21.0925, lon: 105.4525, radiusMeters: 300 },
      { id: 'nui_bavi',     zone: 'forest',   nameVi: 'Thánh Sơn Tản Viên (Vườn Quốc Gia Ba Vì)',   lat: 21.0785, lon: 105.3625, radiusMeters: 400 },
      { id: 'ao_vua',       zone: 'water',    nameVi: 'Ao Vua Thần Thủy (Ba Vì)',                  lat: 21.0985, lon: 105.3425, radiusMeters: 150 },
      { id: 'khoang_xanh',  zone: 'forest',   nameVi: 'Khoang Xanh Suối Tiên Thần Cốc (Ba Vì)',    lat: 21.0625, lon: 105.3725, radiusMeters: 160 },

      // 11. Khu Vực Thạch Thất, Quốc Oai, Hoài Đức, Đan Phượng, Chương Mỹ
      { id: 'chua_tayphuong',zone: 'forest',  nameVi: 'La Hán Thần Tự (Chùa Tây Phương - Thạch Thất)', lat: 21.0285, lon: 105.5925, radiusMeters: 100 },
      { id: 'chua_thay',    zone: 'water',    nameVi: 'Thủy Đình Thần Tiên (Chùa Thầy - Quốc Oai)',  lat: 20.9955, lon: 105.6425, radiusMeters: 110 },
      { id: 'chua_tram',    zone: 'forest',   nameVi: 'Tử Trầm Cổ Động (Chùa Trầm - Chương Mỹ)',     lat: 20.9255, lon: 105.7025, radiusMeters: 100 },
      { id: 'song_day_hoaiduc',zone: 'water', nameVi: 'Đầm Bãi Phù Sa Sông Đáy (Hoài Đức)',         lat: 21.0185, lon: 105.6985, radiusMeters: 90 },
      { id: 'song_hong_danphuong',zone: 'water', nameVi: 'Bãi Bồi Thần Ngư (Đan Phượng)',           lat: 21.1185, lon: 105.6825, radiusMeters: 110 },

      // 12. Khu Vực Mỹ Đức, Ứng Hòa, Thanh Oai, Thanh Trì, Thường Tín, Phú Xuyên
      { id: 'chua_huong',   zone: 'forest',   nameVi: 'Nam Thiên Đệ Nhất Động (Chùa Hương - Mỹ Đức)',lat: 20.6185, lon: 105.8035, radiusMeters: 300 },
      { id: 'suoi_yen',     zone: 'water',    nameVi: 'Suối Yến Thanh Tịnh (Chùa Hương)',           lat: 20.6285, lon: 105.8155, radiusMeters: 160 },
      { id: 'ho_quanson',   zone: 'water',    nameVi: 'Đại Hồ Động Tiên Quan Sơn (Mỹ Đức)',         lat: 20.6885, lon: 105.7725, radiusMeters: 280 },
      { id: 'ho_tuylai',    zone: 'water',    nameVi: 'Vịnh Nước Tuy Lai Thần Bí (Mỹ Đức)',         lat: 20.7325, lon: 105.7485, radiusMeters: 220 },
      { id: 'chua_dau',     zone: 'forest',   nameVi: 'Xá Lợi Thần Tự (Chùa Đậu - Thường Tín)',     lat: 20.8785, lon: 105.8625, radiusMeters: 90 },
      { id: 'dam_trien_thanhtri',zone: 'water', nameVi: 'Vạn Thảo Đầm Trì (Thanh Trì)',             lat: 20.9425, lon: 105.8455, radiusMeters: 120 },
      { id: 'bv_k_tantrieu',zone: 'forest',   nameVi: 'Đan Dược Viện Tân Triều (BV K Tân Triều)',   lat: 20.9715, lon: 105.7995, radiusMeters: 85 },
      { id: 'lang_khm_phuxuyen',zone: 'merchant', nameVi: 'Khảm Xà Cừ Thần Thôn (Phú Xuyên)',       lat: 20.7325, lon: 105.9125, radiusMeters: 80 },

      // 13. Các Trường Học & Khai Trí Viện Danh Tiếng
      { id: 'thpt_chuvanan',zone: 'forest',   nameVi: 'Chu Văn An Thần Học Viện (Thụy Khuê)',       lat: 21.0442, lon: 105.8295, radiusMeters: 80 },
      { id: 'thpt_ams',     zone: 'merchant', nameVi: 'Amsterdam Thần Tài Viện (Hoàng Minh Giám)',  lat: 21.0078, lon: 105.7995, radiusMeters: 85 },
      { id: 'thpt_chuyen_sp',zone: 'forest',  nameVi: 'Kỳ Tài Sư Viện (Chuyên Sư Phạm - Xuân Thủy)',lat: 21.0378, lon: 105.7825, radiusMeters: 75 },
      { id: 'thpt_chuyen_nn',zone: 'merchant',nameVi: 'Vạn Ngữ Thần Đàn (Chuyên Ngoại Ngữ)',        lat: 21.0385, lon: 105.7795, radiusMeters: 70 },
      { id: 'thpt_luongthevinh',zone: 'forest',nameVi: 'Trạng Nguyên Học Xá (Lương Thế Vinh Tân Triều)', lat: 20.9735, lon: 105.7965, radiusMeters: 70 },
      { id: 'thpt_kimlien', zone: 'forest',   nameVi: 'Kim Liên Khai Trí Điện (Đống Đa)',           lat: 21.0115, lon: 105.8335, radiusMeters: 65 },
      { id: 'thpt_vietduc', zone: 'merchant', nameVi: 'Việt Đức Cổ Thư Viện (Lý Thường Kiệt)',      lat: 21.0255, lon: 105.8485, radiusMeters: 65 },
      { id: 'thpt_mariecurie',zone: 'merchant',nameVi: 'Marie Curie Tiên Học Đường (Mỹ Đình)',      lat: 21.0185, lon: 105.7735, radiusMeters: 70 },

      // 14. Các Bệnh Viện Chuyên Khoa Lớn
      { id: 'bv_108',       zone: 'forest',   nameVi: 'Quân Y Thần Viện 108 (Trần Hưng Đạo)',       lat: 21.0185, lon: 105.8615, radiusMeters: 90 },
      { id: 'bv_xanhpon',   zone: 'forest',   nameVi: 'Thần Dược Viện Xanh Pôn (Chu Văn An)',       lat: 21.0315, lon: 105.8345, radiusMeters: 75 },
      { id: 'bv_tim_hn',    zone: 'forest',   nameVi: 'Tâm Huyết Y Quán (Bệnh Viện Tim Hà Nội)',    lat: 21.0225, lon: 105.8465, radiusMeters: 60 },
      { id: 'bv_mat_tw',    zone: 'forest',   nameVi: 'Minh Mãn Y Viện (Bệnh Viện Mắt TW - Bà Triệu)', lat: 21.0165, lon: 105.8495, radiusMeters: 60 },
      { id: 'bv_dalieu_tw', zone: 'forest',   nameVi: 'Hoàng Bì Dược Viện (BV Da Liễu TW)',          lat: 21.0015, lon: 105.8375, radiusMeters: 60 },
      { id: 'bv_e',         zone: 'forest',   nameVi: 'Bắc Thành Y Viện (Bệnh Viện E - Trần Cung)', lat: 21.0505, lon: 105.7895, radiusMeters: 75 },

      // 15. Các Chợ Truyền Thống & Đại Siêu Thị
      { id: 'cho_hom',      zone: 'merchant', nameVi: 'Chợ Hôm Cổ Phố (Phố Huế)',                  lat: 21.0185, lon: 105.8515, radiusMeters: 60 },
      { id: 'cho_mo',       zone: 'merchant', nameVi: 'Chợ Mơ Cổ Thị (Bạch Mai)',                  lat: 20.9985, lon: 105.8495, radiusMeters: 65 },
      { id: 'cho_buoi',     zone: 'merchant', nameVi: 'Chợ Bưởi Kẻ Bưởi (Hoàng Hoa Thám)',          lat: 21.0455, lon: 105.8055, radiusMeters: 60 },
      { id: 'cho_nhaxanh',  zone: 'merchant', nameVi: 'Chợ Nhà Xanh Sầm Uất (Phan Văn Trường)',    lat: 21.0375, lon: 105.7865, radiusMeters: 60 },
      { id: 'cho_phungkhoang',zone: 'merchant',nameVi: 'Chợ Đêm Phùng Khoang',                      lat: 20.9895, lon: 105.7945, radiusMeters: 65 },
      { id: 'cho_hadong',   zone: 'merchant', nameVi: 'Đại Thương Phủ Hà Đông (Chợ Hà Đông)',       lat: 20.9715, lon: 105.7775, radiusMeters: 80 },
      { id: 'cho_ninhhiep', zone: 'merchant', nameVi: 'Thiên Phủ Vải Vóc (Chợ Ninh Hiệp - Gia Lâm)',lat: 21.0985, lon: 105.9455, radiusMeters: 120 },
      { id: 'cho_hoa_quangan',zone: 'forest', nameVi: 'Dạ Hoa Thần Thị (Chợ Hoa Quảng An)',         lat: 21.0625, lon: 105.8315, radiusMeters: 70 },

      // 16. Các Đại Đô Thị & Thạch Thành Cổ Đại
      { id: 'smart_city',   zone: 'merchant', nameVi: 'Đại Thạch Thành Tây Mỗ (Vinhomes Smart City)',lat: 21.0025, lon: 105.7385, radiusMeters: 200 },
      { id: 'ciputra',      zone: 'merchant', nameVi: 'Kinh Đô Cổ Tây Hồ (Khu Đô Thị Ciputra)',     lat: 21.0785, lon: 105.8015, radiusMeters: 180 },
      { id: 'starlake',     zone: 'merchant', nameVi: 'Tinh Tú Hồ Cổ Thành (Starlake Tây Hồ Tây)',  lat: 21.0555, lon: 105.7985, radiusMeters: 160 },
      { id: 'ngoai_giao_doan',zone: 'merchant',nameVi: 'Vương Phủ Xuân Đỉnh (Khu Ngoại Giao Đoàn)', lat: 21.0625, lon: 105.7955, radiusMeters: 140 },
      { id: 'gamuda',       zone: 'forest',   nameVi: 'Lục Bảo Điền Viên (Gamuda Gardens Yên Sở)',  lat: 20.9715, lon: 105.8685, radiusMeters: 160 },
      { id: 'splendora',    zone: 'merchant', nameVi: 'Bắc An Khánh Thạch Trấn (Splendora)',        lat: 21.0115, lon: 105.7155, radiusMeters: 150 },
      { id: 'park_city',    zone: 'forest',   nameVi: 'Công Viên Thạch Cung (Park City Hà Đông)',   lat: 20.9625, lon: 105.7555, radiusMeters: 130 },
      { id: 'ecopark',      zone: 'forest',   nameVi: 'Vạn Mộc Thành Cổ (Ecopark Ven Sông)',        lat: 20.9585, lon: 105.9325, radiusMeters: 250 },

      // 17. Bổ Sung Chi Tiết Từng Cửa Hàng Theo Phường/Xã Còn Thiếu

      // --- CẦU GIẤY: Trung Hòa, Yên Hòa, Quan Hoa, Dịch Vọng ---
      { id: 'cho_trungho',          zone: 'merchant', nameVi: 'Chợ Trung Hòa Cổ (Trung Hòa - Cầu Giấy)',               lat: 21.0168, lon: 105.7985, radiusMeters: 60 },
      { id: 'highlands_trungho',    zone: 'merchant', nameVi: 'Highlands Coffee (Trần Duy Hưng - Trung Hòa)',           lat: 21.0175, lon: 105.7972, radiusMeters: 28 },
      { id: 'tch_trungho',          zone: 'merchant', nameVi: 'The Coffee House (Nguyễn Thị Định - Trung Hòa)',         lat: 21.0162, lon: 105.7998, radiusMeters: 28 },
      { id: 'cong_yenh oa',         zone: 'merchant', nameVi: 'Cộng Cà Phê (Yên Hòa - Cầu Giấy)',                      lat: 21.0198, lon: 105.7948, radiusMeters: 28 },
      { id: 'vinmart_yenh oa',      zone: 'merchant', nameVi: 'Tiệm Trao Đổi WinMart (Yên Hòa)',                        lat: 21.0205, lon: 105.7942, radiusMeters: 35 },
      { id: 'cho_yenh oa',          zone: 'merchant', nameVi: 'Chợ Yên Hòa Cổ Phiên (Yên Hòa - Cầu Giấy)',             lat: 21.0215, lon: 105.7938, radiusMeters: 55 },
      { id: 'aha_quanhoa',          zone: 'merchant', nameVi: 'Aha Cafe (Quan Hoa - Cầu Giấy)',                         lat: 21.0388, lon: 105.7908, radiusMeters: 28 },
      { id: 'cho_quanhoa',          zone: 'merchant', nameVi: 'Chợ Cổ Quan Hoa (Cổ Đạo Hoàng Quốc Việt)',              lat: 21.0395, lon: 105.7918, radiusMeters: 55 },
      { id: 'highlands_dichvong',   zone: 'merchant', nameVi: 'Highlands Coffee (Xuân Thủy - Dịch Vọng)',               lat: 21.0355, lon: 105.7872, radiusMeters: 28 },
      { id: 'starbucks_dichvonghau',zone: 'merchant', nameVi: 'Starbucks Coffee (Cầu Giấy - Dịch Vọng Hậu)',            lat: 21.0322, lon: 105.7858, radiusMeters: 35 },
      { id: 'phela_dichvong',       zone: 'merchant', nameVi: 'Trà Ô Long Phê La (Trần Thái Tông - Dịch Vọng)',         lat: 21.0278, lon: 105.7895, radiusMeters: 30 },
      { id: 'mixue_dichvonghau',    zone: 'merchant', nameVi: 'Mixue Trà Kem Tuyết (Dịch Vọng Hậu)',                    lat: 21.0315, lon: 105.7845, radiusMeters: 25 },
      { id: 'ho_nghiado2',          zone: 'water',    nameVi: 'Hồ Nhỏ Cây Xanh Cầu Giấy (Trần Thái Tông)',             lat: 21.0272, lon: 105.7908, radiusMeters: 50 },

      // --- HOÀNG MAI: Trương Định, Tương Mai, Thịnh Liệt, Hoàng Văn Thụ ---
      { id: 'cho_truongdinh',       zone: 'merchant', nameVi: 'Chợ Cổ Trương Định (Hai Bà Trưng / Hoàng Mai)',          lat: 21.0028, lon: 105.8538, radiusMeters: 65 },
      { id: 'highlands_truongdinh', zone: 'merchant', nameVi: 'Highlands Coffee (Trương Định - Hoàng Mai)',             lat: 21.0022, lon: 105.8545, radiusMeters: 28 },
      { id: 'tch_tuongmai',         zone: 'merchant', nameVi: 'The Coffee House (Tương Mai - Hoàng Mai)',               lat: 20.9968, lon: 105.8572, radiusMeters: 28 },
      { id: 'cong_tuongmai',        zone: 'merchant', nameVi: 'Cộng Cà Phê (Đường Tương Mai - Hoàng Mai)',              lat: 20.9975, lon: 105.8558, radiusMeters: 28 },
      { id: 'cho_tuongmai',         zone: 'merchant', nameVi: 'Chợ Tương Mai Cổ Phiên (Tương Mai)',                     lat: 20.9985, lon: 105.8565, radiusMeters: 60 },
      { id: 'vincom_hm',            zone: 'merchant', nameVi: 'Đại Tháp Thương Hội (Vincom Hoàng Mai)',                 lat: 20.9862, lon: 105.8462, radiusMeters: 90 },
      { id: 'highlands_hm2',        zone: 'merchant', nameVi: 'Highlands Coffee (Vincom Hoàng Mai)',                    lat: 20.9868, lon: 105.8468, radiusMeters: 28 },
      { id: 'cho_thinhli et',       zone: 'merchant', nameVi: 'Chợ Thịnh Liệt (Hoàng Mai)',                             lat: 20.9768, lon: 105.8428, radiusMeters: 60 },
      { id: 'aha_hoangvanthu',      zone: 'merchant', nameVi: 'Aha Cafe (Hoàng Văn Thụ - Hoàng Mai)',                   lat: 20.9842, lon: 105.8388, radiusMeters: 28 },

      // --- ĐỐNG ĐA: Phương Liên, Trung Liệt, Nam Đồng, Phương Mai ---
      { id: 'cho_namdo ng',         zone: 'merchant', nameVi: 'Chợ Nam Đồng Cổ (Đống Đa)',                              lat: 21.0138, lon: 105.8298, radiusMeters: 60 },
      { id: 'highlands_namdong',    zone: 'merchant', nameVi: 'Highlands Coffee (Nam Đồng - Đống Đa)',                  lat: 21.0145, lon: 105.8305, radiusMeters: 28 },
      { id: 'tch_phuongmai',        zone: 'merchant', nameVi: 'The Coffee House (Phương Mai - Đống Đa)',                lat: 21.0072, lon: 105.8368, radiusMeters: 28 },
      { id: 'cong_phuonglien',      zone: 'merchant', nameVi: 'Cộng Cà Phê (Phương Liên - Đống Đa)',                    lat: 21.0095, lon: 105.8355, radiusMeters: 28 },
      { id: 'cho_phuonglien',       zone: 'merchant', nameVi: 'Chợ Phương Liên (Đống Đa)',                              lat: 21.0088, lon: 105.8342, radiusMeters: 55 },
      { id: 'aha_trunglie t',       zone: 'merchant', nameVi: 'Aha Cafe (Trung Liệt - Đống Đa)',                        lat: 21.0122, lon: 105.8262, radiusMeters: 28 },
      { id: 'mixue_phuongmai',      zone: 'merchant', nameVi: 'Mixue Trà Kem Tuyết (Phương Mai)',                       lat: 21.0065, lon: 105.8375, radiusMeters: 25 },
      { id: 'cho_trunglie t',       zone: 'merchant', nameVi: 'Chợ Trung Liệt Cổ (Đống Đa)',                            lat: 21.0118, lon: 105.8258, radiusMeters: 55 },

      // --- ĐAN PHƯỢNG: Thị Trấn, Đan Phượng, Song Phượng ---
      { id: 'ubnd_danph uong',      zone: 'merchant', nameVi: 'Trung Tâm Hành Chính Đan Phượng (UBND Huyện)',           lat: 21.0755, lon: 105.6575, radiusMeters: 80 },
      { id: 'cho_danphu ong',       zone: 'merchant', nameVi: 'Chợ Phiên Đan Phượng (TT Phùng)',                        lat: 21.0765, lon: 105.6555, radiusMeters: 75 },
      { id: 'highlands_danphuong',  zone: 'merchant', nameVi: 'Highlands Coffee (TT Phùng - Đan Phượng)',               lat: 21.0758, lon: 105.6562, radiusMeters: 28 },
      { id: 'ho_tanhoi_dp',         zone: 'water',    nameVi: 'Hồ Tân Hội - Bãi Câu Cá Đan Phượng',                    lat: 21.0628, lon: 105.6748, radiusMeters: 80 },
      { id: 'lang_moc_thanh_oai',   zone: 'merchant', nameVi: 'Làng Nghề Mộc Song Phượng (Đan Phượng)',                 lat: 21.0835, lon: 105.6665, radiusMeters: 85 },

      // --- HOÀI ĐỨC: Trạm Trôi, An Khánh, Di Trạch ---
      { id: 'tt_tramtroi',          zone: 'merchant', nameVi: 'Thị Trấn Trạm Trôi (Hoài Đức)',                          lat: 21.0235, lon: 105.7085, radiusMeters: 90 },
      { id: 'cho_hoaiduc',          zone: 'merchant', nameVi: 'Chợ Hoài Đức (Trạm Trôi)',                               lat: 21.0228, lon: 105.7078, radiusMeters: 70 },
      { id: 'highlands_hoaiduc',    zone: 'merchant', nameVi: 'Highlands Coffee (Trạm Trôi - Hoài Đức)',                lat: 21.0242, lon: 105.7092, radiusMeters: 28 },
      { id: 'kdt_ankhanh',          zone: 'merchant', nameVi: 'Khu Đô Thị An Khánh (Splendora - Hoài Đức)',             lat: 21.0112, lon: 105.7148, radiusMeters: 130 },
      { id: 'lang_la_phu',          zone: 'merchant', nameVi: 'Làng Nghề Dệt Lụa La Phù (Hoài Đức)',                   lat: 20.9985, lon: 105.7318, radiusMeters: 90 },

      // --- THẠCH THẤT: Liên Quan, Thạch Hoà, Đại Đồng ---
      { id: 'tt_lienquan',          zone: 'merchant', nameVi: 'Thị Trấn Liên Quan (Thạch Thất)',                        lat: 21.0155, lon: 105.5688, radiusMeters: 90 },
      { id: 'cho_thachthat',        zone: 'merchant', nameVi: 'Chợ Thạch Thất (Liên Quan)',                             lat: 21.0148, lon: 105.5675, radiusMeters: 70 },
      { id: 'highlands_thachthat',  zone: 'merchant', nameVi: 'Highlands Coffee (Liên Quan - Thạch Thất)',              lat: 21.0162, lon: 105.5695, radiusMeters: 28 },
      { id: 'lang_moc_chanh',       zone: 'merchant', nameVi: 'Làng Nghề Mộc Chàng Sơn (Thạch Thất)',                  lat: 21.0228, lon: 105.5728, radiusMeters: 90 },
      { id: 'khu_cong_nghe',        zone: 'merchant', nameVi: 'Thần Kỹ Thành Hòa Lạc (Khu CNC Hòa Lạc)',               lat: 21.0085, lon: 105.5258, radiusMeters: 180 },

      // --- QUỐC OAI: Quốc Oai, Sài Sơn, Ngọc Liệp ---
      { id: 'tt_quocoai',           zone: 'merchant', nameVi: 'Thị Trấn Quốc Oai (Quốc Oai)',                           lat: 20.9975, lon: 105.6568, radiusMeters: 85 },
      { id: 'cho_quocoai',          zone: 'merchant', nameVi: 'Chợ Quốc Oai (Thị Trấn)',                                lat: 20.9968, lon: 105.6558, radiusMeters: 65 },
      { id: 'highlands_quocoai',    zone: 'merchant', nameVi: 'Highlands Coffee (Thị Trấn Quốc Oai)',                   lat: 20.9982, lon: 105.6575, radiusMeters: 28 },
      { id: 'lang_lua_quocoai',     zone: 'forest',   nameVi: 'Đồng Lúa Vàng Ngọc Liệp (Quốc Oai)',                    lat: 21.0088, lon: 105.6748, radiusMeters: 110 },

      // --- CHƯƠNG MỸ: Chúc Sơn, Xuân Mai, Lam Điền ---
      { id: 'tt_chucson',           zone: 'merchant', nameVi: 'Thị Trấn Chúc Sơn (Chương Mỹ)',                          lat: 20.9268, lon: 105.7278, radiusMeters: 90 },
      { id: 'cho_chucson',          zone: 'merchant', nameVi: 'Chợ Chúc Sơn (Chương Mỹ)',                               lat: 20.9262, lon: 105.7268, radiusMeters: 70 },
      { id: 'tt_xuanmai',           zone: 'merchant', nameVi: 'Thị Trấn Xuân Mai (Chương Mỹ)',                          lat: 20.8745, lon: 105.6158, radiusMeters: 95 },
      { id: 'cho_xuanmai',          zone: 'merchant', nameVi: 'Chợ Xuân Mai (Chương Mỹ)',                               lat: 20.8738, lon: 105.6148, radiusMeters: 70 },
      { id: 'highlands_xuanmai',    zone: 'merchant', nameVi: 'Highlands Coffee (Xuân Mai - Chương Mỹ)',                lat: 20.8752, lon: 105.6162, radiusMeters: 28 },
      { id: 'ho_xuanmai',           zone: 'water',    nameVi: 'Hồ Xuân Mai Thần Thuỷ (Chương Mỹ)',                      lat: 20.8828, lon: 105.6228, radiusMeters: 130 },

      // --- THANH OAI: Thị Trấn Kim Bài, Bích Hòa ---
      { id: 'tt_kimbai',            zone: 'merchant', nameVi: 'Thị Trấn Kim Bài (Thanh Oai)',                           lat: 20.8658, lon: 105.8178, radiusMeters: 85 },
      { id: 'cho_kimbai',           zone: 'merchant', nameVi: 'Chợ Kim Bài (Thanh Oai)',                                lat: 20.8652, lon: 105.8168, radiusMeters: 65 },
      { id: 'highlands_kimbai',     zone: 'merchant', nameVi: 'Highlands Coffee (Kim Bài - Thanh Oai)',                 lat: 20.8665, lon: 105.8182, radiusMeters: 28 },
      { id: 'lang_non_la',          zone: 'forest',   nameVi: 'Làng Nghề Nón Lá Chuông (Thanh Oai)',                    lat: 20.8548, lon: 105.7998, radiusMeters: 90 },
      { id: 'lang_may_tre',         zone: 'forest',   nameVi: 'Làng Nghề Mây Tre Đan Phú Vinh (Chương Mỹ - Thanh Oai)',lat: 20.9115, lon: 105.7648, radiusMeters: 95 },

      // --- THƯỜNG TÍN: Thị Trấn Thường Tín, Hà Hồi ---
      { id: 'tt_thuongtin',         zone: 'merchant', nameVi: 'Thị Trấn Thường Tín (Thường Tín)',                       lat: 20.8718, lon: 105.8738, radiusMeters: 90 },
      { id: 'cho_thuongtin',        zone: 'merchant', nameVi: 'Chợ Thường Tín Cổ Phố (Thường Tín)',                     lat: 20.8712, lon: 105.8728, radiusMeters: 70 },
      { id: 'highlands_thuongtin',  zone: 'merchant', nameVi: 'Highlands Coffee (Thị Trấn Thường Tín)',                 lat: 20.8725, lon: 105.8745, radiusMeters: 28 },
      { id: 'lang_sơn_mai',         zone: 'merchant', nameVi: 'Làng Nghề Sơn Mài Duyên Thái (Thường Tín)',              lat: 20.8888, lon: 105.8858, radiusMeters: 90 },
      { id: 'lang_thu_cong',        zone: 'merchant', nameVi: 'Làng Nghề Thủ Công Hà Hồi (Thường Tín)',                 lat: 20.9018, lon: 105.8688, radiusMeters: 80 },

      // --- THANH TRÌ: Văn Điển, Ngũ Hiệp, Tứ Hiệp ---
      { id: 'tt_vandien',           zone: 'merchant', nameVi: 'Khu Công Nghiệp Văn Điển (Thanh Trì)',                   lat: 20.9568, lon: 105.8468, radiusMeters: 110 },
      { id: 'cho_nguhiep',          zone: 'merchant', nameVi: 'Chợ Ngũ Hiệp (Thanh Trì)',                               lat: 20.9658, lon: 105.8238, radiusMeters: 65 },
      { id: 'highlands_vandien',    zone: 'merchant', nameVi: 'Highlands Coffee (Văn Điển - Thanh Trì)',                lat: 20.9575, lon: 105.8475, radiusMeters: 28 },
      { id: 'tch_tuhiep',           zone: 'merchant', nameVi: 'The Coffee House (Tứ Hiệp - Thanh Trì)',                 lat: 20.9728, lon: 105.8318, radiusMeters: 28 },
      { id: 'cong_nguhiep',         zone: 'merchant', nameVi: 'Cộng Cà Phê (Ngũ Hiệp - Thanh Trì)',                    lat: 20.9662, lon: 105.8245, radiusMeters: 28 },
      { id: 'lang_gom_vandien',     zone: 'merchant', nameVi: 'Lò Gốm Sứ Cổ Văn Điển (Thanh Trì)',                     lat: 20.9555, lon: 105.8458, radiusMeters: 85 },

      // --- PHÚ XUYÊN: Thị Trấn Phú Minh, Phú Túc ---
      { id: 'tt_phuminh',           zone: 'merchant', nameVi: 'Thị Trấn Phú Minh (Phú Xuyên)',                          lat: 20.7178, lon: 105.9068, radiusMeters: 85 },
      { id: 'cho_phuxuyen',         zone: 'merchant', nameVi: 'Chợ Phú Xuyên Cổ (Phú Minh)',                            lat: 20.7172, lon: 105.9058, radiusMeters: 65 },
      { id: 'highlands_phuxuyen',   zone: 'merchant', nameVi: 'Highlands Coffee (Thị Trấn Phú Xuyên)',                  lat: 20.7185, lon: 105.9075, radiusMeters: 28 },
      { id: 'lang_ren_da_si',       zone: 'merchant', nameVi: 'Lò Rèn Cổ Đại Đa Sỹ (Phú Xuyên)',                       lat: 20.7258, lon: 105.9148, radiusMeters: 85 },
      { id: 'ho_phuxuyen',          zone: 'water',    nameVi: 'Hồ Câu Cá Tiên Phú Xuyên',                               lat: 20.7228, lon: 105.8988, radiusMeters: 80 },

      // --- ỨNG HÒA: Thị Trấn Vân Đình, Hoa Sơn ---
      { id: 'tt_vandinh',           zone: 'merchant', nameVi: 'Thị Trấn Vân Đình (Ứng Hòa)',                            lat: 20.7568, lon: 105.7778, radiusMeters: 90 },
      { id: 'cho_vandinh',          zone: 'merchant', nameVi: 'Chợ Vân Đình Cổ Phố (Ứng Hòa)',                          lat: 20.7562, lon: 105.7768, radiusMeters: 70 },
      { id: 'highlands_unghoa',     zone: 'merchant', nameVi: 'Highlands Coffee (Vân Đình - Ứng Hòa)',                  lat: 20.7575, lon: 105.7785, radiusMeters: 28 },
      { id: 'ho_unghoa',            zone: 'water',    nameVi: 'Hồ Vân Đình Thần Thủy (Ứng Hòa)',                        lat: 20.7628, lon: 105.7838, radiusMeters: 100 },
      { id: 'lang_lua_unghoa',      zone: 'forest',   nameVi: 'Đồng Lúa Tiền Sử Hoa Sơn (Ứng Hòa)',                    lat: 20.7828, lon: 105.8038, radiusMeters: 120 },

      // --- MỸ ĐỨC (Ngoài Chùa Hương): Thị Trấn Tế Tiêu, Hương Sơn ---
      { id: 'tt_tetieu',            zone: 'merchant', nameVi: 'Thị Trấn Tế Tiêu (Mỹ Đức)',                              lat: 20.6858, lon: 105.7458, radiusMeters: 85 },
      { id: 'cho_mytieu',           zone: 'merchant', nameVi: 'Chợ Tế Tiêu Cổ (Mỹ Đức)',                                lat: 20.6852, lon: 105.7448, radiusMeters: 65 },
      { id: 'highlands_myduc',      zone: 'merchant', nameVi: 'Highlands Coffee (Tế Tiêu - Mỹ Đức)',                    lat: 20.6865, lon: 105.7465, radiusMeters: 28 },
      { id: 'song_day_myduc',       zone: 'water',    nameVi: 'Bãi Bồi Sông Đáy Mỹ Đức (Hương Sơn)',                    lat: 20.6528, lon: 105.7758, radiusMeters: 130 },
      { id: 'rung_huong_son',       zone: 'forest',   nameVi: 'Rừng Nguyên Sinh Hương Sơn (Mỹ Đức)',                    lat: 20.6328, lon: 105.7958, radiusMeters: 200 },

      // 18. Các Hồ Nước Nổi Tiếng & Đầm Lầy Tiền Sử Bổ Sung
      { id: 'ho_dinhcong',  zone: 'water',    nameVi: 'Hồ Nước Ngọt Định Công (Hoàng Mai)',         lat: 20.9855, lon: 105.8325, radiusMeters: 90 },
      { id: 'ho_damhong',   zone: 'water',    nameVi: 'Đầm Sen Hồng Khương Đình (Thanh Xuân)',      lat: 20.9985, lon: 105.8215, radiusMeters: 85 },
      { id: 'ho_dambau',    zone: 'water',    nameVi: 'Vũng Nước Đầm Bầu (Thanh Xuân)',             lat: 20.9995, lon: 105.8125, radiusMeters: 75 },
      { id: 'ho_suoihai',   zone: 'water',    nameVi: 'Đại Đầm Suối Hai Mênh Mông (Ba Vì)',         lat: 21.1255, lon: 105.3785, radiusMeters: 350 },
      { id: 'ho_tiensa',    zone: 'water',    nameVi: 'Hồ Tiên Sa Thần Cảnh (Ba Vì)',               lat: 21.0925, lon: 105.3715, radiusMeters: 160 },

      // ═══════════════════════════════════════════════════════════════
      // LÀNG NGHỀ NGOẠI THÀNH (Bổ Sung Đầy Đủ)
      // ═══════════════════════════════════════════════════════════════

      // Hà Đông
      { id: 'lang_lua_van_phuc',    zone: 'merchant', nameVi: 'Làng Lụa Vạn Phúc Thiên Niên (Hà Đông)',               lat: 20.9728, lon: 105.7548, radiusMeters: 100 },
      { id: 'lang_ren_da_sy_hd',    zone: 'merchant', nameVi: 'Lò Rèn Đa Sỹ Cổ Nghề (Kiến Hưng - Hà Đông)',          lat: 20.9578, lon: 105.7778, radiusMeters: 90 },
      { id: 'lang_may_phung_xa',    zone: 'merchant', nameVi: 'Làng Nghề May Phùng Xá (Mỹ Đức)',                      lat: 20.6968, lon: 105.7368, radiusMeters: 85 },

      // Thường Tín
      { id: 'lang_theu_quat_dong',  zone: 'merchant', nameVi: 'Làng Thêu Ren Quất Động Ngàn Kim Chỉ (Thường Tín)',   lat: 20.8618, lon: 105.8978, radiusMeters: 90 },
      { id: 'lang_dieu_khac_nhan_hien', zone: 'merchant', nameVi: 'Làng Điêu Khắc Đá Nhân Hiền (Thường Tín)',        lat: 20.8478, lon: 105.8888, radiusMeters: 85 },
      { id: 'lang_dan_lat_thuy_ung',zone: 'merchant', nameVi: 'Làng Đan Lát Thụy Ứng (Thường Tín)',                  lat: 20.8728, lon: 105.8618, radiusMeters: 90 },

      // Ứng Hòa
      { id: 'lang_tam_huong_qpc',   zone: 'merchant', nameVi: 'Làng Tăm Hương Quảng Phú Cầu (Ứng Hòa)',              lat: 20.7978, lon: 105.8178, radiusMeters: 95 },

      // Chương Mỹ
      { id: 'lang_tho_cam_phu_nghia',zone: 'merchant',nameVi: 'Làng Dệt Thổ Cẩm Phú Nghĩa (Chương Mỹ)',              lat: 20.9068, lon: 105.7468, radiusMeters: 90 },
      { id: 'lang_may_tre_phu_vinh2',zone: 'forest',  nameVi: 'Rừng Mây Tre Đan Phú Vinh (Chương Mỹ)',               lat: 20.9115, lon: 105.7618, radiusMeters: 95 },

      // Hoài Đức
      { id: 'lang_chup_anh_lai_xa', zone: 'merchant', nameVi: 'Làng Nghề Nhiếp Ảnh Lai Xá (Hoài Đức)',               lat: 21.0178, lon: 105.7218, radiusMeters: 80 },
      { id: 'lang_nuoc_mam_cu_da',  zone: 'merchant', nameVi: 'Làng Nghề Nước Mắm Cự Đà (Thanh Oai)',                lat: 20.9018, lon: 105.8018, radiusMeters: 80 },

      // Gia Lâm
      { id: 'lang_gom_kim_lan',     zone: 'merchant', nameVi: 'Làng Gốm Kim Lan Cổ (Gia Lâm)',                       lat: 20.9858, lon: 105.9068, radiusMeters: 90 },
      { id: 'lang_tranh_dong_ho',   zone: 'merchant', nameVi: 'Làng Tranh Dân Gian Đông Hồ (Gia Lâm)',               lat: 21.1158, lon: 106.0328, radiusMeters: 90 },

      // Đông Anh
      { id: 'lang_che_bien_lim_dong',zone:'merchant', nameVi: 'Làng Nghề Chế Biến Lâm Sản Đông Anh',                lat: 21.0958, lon: 105.8758, radiusMeters: 85 },

      // Sóc Sơn
      { id: 'lang_moc_pha_thi',     zone: 'merchant', nameVi: 'Làng Nghề Mộc Phù Lỗ (Sóc Sơn)',                     lat: 21.2155, lon: 105.8255, radiusMeters: 90 },
      { id: 'lang_go_my_nghe_ss',   zone: 'merchant', nameVi: 'Làng Nghề Gỗ Mỹ Nghệ Sóc Sơn',                      lat: 21.2358, lon: 105.7958, radiusMeters: 85 },

      // ═══════════════════════════════════════════════════════════════
      // TRUNG TÂM THƯƠNG MẠI & ĐẠI SIÊU THỊ (Bổ Sung Đầy Đủ)
      // ═══════════════════════════════════════════════════════════════

      { id: 'vincom_op',            zone: 'merchant', nameVi: 'Đại Thành Vincom Mega Mall Ocean Park (Gia Lâm)',      lat: 20.9928, lon: 105.9462, radiusMeters: 200 },
      { id: 'vincom_pnt',           zone: 'merchant', nameVi: 'Kim Tháp Vincom Center Phạm Ngọc Thạch',              lat: 21.0068, lon: 105.8328, radiusMeters: 80 },
      { id: 'vincom_long_bien',     zone: 'merchant', nameVi: 'Vincom Plaza Long Biên (Cổ Linh)',                    lat: 21.0458, lon: 105.8888, radiusMeters: 90 },
      { id: 'mipec_lb',             zone: 'merchant', nameVi: 'Mipec Mall Long Biên (Cầu Chương Dương)',             lat: 21.0478, lon: 105.8748, radiusMeters: 85 },
      { id: 'savico_lb',            zone: 'merchant', nameVi: 'Savico MegaMall Long Biên',                          lat: 21.0398, lon: 105.8878, radiusMeters: 110 },
      { id: 'indochina_plaza',      zone: 'merchant', nameVi: 'Indochina Plaza Hà Nội (Xuân Thủy)',                  lat: 21.0358, lon: 105.7842, radiusMeters: 70 },
      { id: 'parkson_thai_ha',      zone: 'merchant', nameVi: 'Parkson Viet Tower (Thái Hà)',                        lat: 21.0148, lon: 105.8178, radiusMeters: 75 },
      { id: 'intimex_giang_vo',     zone: 'merchant', nameVi: 'Tổ Hợp Intimex Giảng Võ (Giảng Võ)',                 lat: 21.0268, lon: 105.8258, radiusMeters: 80 },
      { id: 'aeon_hadong2',         zone: 'merchant', nameVi: 'AEON Mall Hà Đông (Dương Nội)',                       lat: 20.9785, lon: 105.7485, radiusMeters: 170 },
      { id: 'aeon_giaolam',         zone: 'merchant', nameVi: 'AEON Mall Gia Lâm (Đa Tốn)',                         lat: 21.0078, lon: 105.9278, radiusMeters: 160 },
      { id: 'bigc_thanglong2',      zone: 'merchant', nameVi: 'Big C Thăng Long (Trần Duy Hưng)',                   lat: 21.0058, lon: 105.7928, radiusMeters: 80 },
      { id: 'mega_market_nlp',      zone: 'merchant', nameVi: 'Mega Market Nguyễn Xiển (Thanh Xuân)',               lat: 20.9778, lon: 105.8258, radiusMeters: 100 },
      { id: 'lotte_tbn',            zone: 'merchant', nameVi: 'Lotte Mart Tây Bắc Ngã Tư Sở (Tây Sơn)',             lat: 21.0048, lon: 105.8398, radiusMeters: 85 },
      { id: 'the_garden',           zone: 'merchant', nameVi: 'The Garden Shopping Center (Mễ Trì)',                lat: 21.0135, lon: 105.7768, radiusMeters: 90 },
      { id: 'pacific_place',        zone: 'merchant', nameVi: 'Pacific Place (Lý Thường Kiệt)',                     lat: 21.0262, lon: 105.8548, radiusMeters: 60 },
      { id: 'trang_tien_plaza',     zone: 'merchant', nameVi: 'Tràng Tiền Plaza (Hoàn Kiếm)',                       lat: 21.0248, lon: 105.8532, radiusMeters: 60 },
      { id: 'ctu_artex_sontay',     zone: 'merchant', nameVi: 'Artex Sơn Tây (Thị Xã Sơn Tây)',                    lat: 21.1392, lon: 105.5042, radiusMeters: 75 },

      // ═══════════════════════════════════════════════════════════════
      // BỆNH VIỆN — ĐẦY ĐỦ TOÀN THÀNH PHỐ
      // ═══════════════════════════════════════════════════════════════

      // Tuyến Trung Ương
      { id: 'bv_bachimai',          zone: 'forest',   nameVi: 'Thần Dược Đại Viện Bạch Mai (BV Bạch Mai - Giải Phóng)',lat: 21.0025, lon: 105.8438, radiusMeters: 110 },
      { id: 'bv_viet_duc',          zone: 'forest',   nameVi: 'Phẫu Thuật Thần Điện Việt Đức (Tràng Thi)',           lat: 21.0282, lon: 105.8448, radiusMeters: 80 },
      { id: 'bv_huu_nghi',          zone: 'forest',   nameVi: 'Hữu Nghị Bang Giao Y Quán (Trần Khánh Dư)',           lat: 21.0218, lon: 105.8598, radiusMeters: 75 },
      { id: 'bv_phu_san_tw',        zone: 'forest',   nameVi: 'Sinh Linh Thần Viện TW (BV Phụ Sản TW - Tràng Thi)',  lat: 21.0278, lon: 105.8428, radiusMeters: 70 },
      { id: 'bv_nhi_tw',            zone: 'forest',   nameVi: 'Ấu Nhi Thần Y Viện TW (BV Nhi TW - La Thành)',        lat: 21.0218, lon: 105.8358, radiusMeters: 75 },
      { id: 'bv_k_quanhoa',         zone: 'forest',   nameVi: 'Ung Bướu Diệt Trừ Viện K (Cầu Giấy - Quan Hoa)',     lat: 21.0388, lon: 105.7958, radiusMeters: 80 },
      { id: 'bv_tai_mu_hong',       zone: 'forest',   nameVi: 'Thanh Âm Thần Viện (BV Tai Mũi Họng TW - Trần Phú)', lat: 21.0275, lon: 105.8375, radiusMeters: 65 },
      { id: 'bv_rang_ham_mat',      zone: 'forest',   nameVi: 'Ngọc Nha Y Điện (BV Răng Hàm Mặt TW)',               lat: 21.0248, lon: 105.8438, radiusMeters: 60 },
      { id: 'bv_noi_tiet',          zone: 'forest',   nameVi: 'Huyết Mạch Điều Tiết Viện (BV Nội Tiết TW)',         lat: 21.0258, lon: 105.8318, radiusMeters: 65 },
      { id: 'bv_phy_phuc_hoi',      zone: 'forest',   nameVi: 'Phục Hồi Thần Lực Viện (BV PHCN TW - Điện Biên Phủ)',lat: 21.0398, lon: 105.8398, radiusMeters: 70 },
      { id: 'bv_pham_ngoc_thach',   zone: 'forest',   nameVi: 'Phế Khí Thần Viện (BV Phạm Ngọc Thạch - Phụ Sản HN)',lat: 21.0388, lon: 105.8348, radiusMeters: 65 },
      { id: 'bv_saint_paul',        zone: 'forest',   nameVi: 'Thánh Paul Y Điện (BV Saint-Paul - Phủ Doãn)',       lat: 21.0282, lon: 105.8448, radiusMeters: 70 },
      { id: 'bv_119',               zone: 'forest',   nameVi: 'Cấp Cứu Thần Tốc 115 (BV Cấp Cứu Trưng Vương)',     lat: 21.0178, lon: 105.8498, radiusMeters: 65 },

      // Tuyến Thành Phố & Quận
      { id: 'bv_phu_san_hn',        zone: 'forest',   nameVi: 'Nữ Thần Sinh Linh Y Viện (BV Phụ Sản HN - Đê La Thành)',lat: 21.0218, lon: 105.8388, radiusMeters: 80 },
      { id: 'bv_nhi_ha_noi',        zone: 'forest',   nameVi: 'Ấu Nhi Bảo Hộ Y Điện (BV Nhi HN - Tuệ Tĩnh)',       lat: 21.0148, lon: 105.8488, radiusMeters: 70 },
      { id: 'bv_thanh_nhan',        zone: 'forest',   nameVi: 'Thanh Nhàn Cứu Chữa Điện (Phố Thanh Nhàn)',          lat: 21.0068, lon: 105.8588, radiusMeters: 75 },
      { id: 'bv_dong_da',           zone: 'forest',   nameVi: 'Đống Đa Hồi Phục Viện (Kim Liên - Đống Đa)',         lat: 21.0118, lon: 105.8358, radiusMeters: 75 },
      { id: 'bv_ha_dong',           zone: 'forest',   nameVi: 'Hà Đông Thái Y Điện (BV Hà Đông - Trần Phú)',        lat: 20.9718, lon: 105.7798, radiusMeters: 80 },
      { id: 'bv_duc_giang',         zone: 'forest',   nameVi: 'Đức Giang Thần Y Quán (BV Đức Giang - Long Biên)',   lat: 21.0478, lon: 105.8798, radiusMeters: 80 },
      { id: 'bv_son_tay',           zone: 'forest',   nameVi: 'Sơn Tây Thái Y Viện (BV Đa Khoa Sơn Tây)',          lat: 21.1368, lon: 105.5048, radiusMeters: 80 },
      { id: 'bv_dong_anh',          zone: 'forest',   nameVi: 'Đông Anh Đại Y Điện (BV Đa Khoa Đông Anh)',         lat: 21.1398, lon: 105.8428, radiusMeters: 85 },
      { id: 'bv_me_linh',           zone: 'forest',   nameVi: 'Mê Linh Thần Y Quán (BV Đa Khoa Mê Linh)',          lat: 21.1718, lon: 105.7558, radiusMeters: 80 },
      { id: 'bv_gia_lam',           zone: 'forest',   nameVi: 'Gia Lâm Bảo Sinh Y Điện (BV Đa Khoa Gia Lâm)',      lat: 21.0348, lon: 105.9118, radiusMeters: 80 },
      { id: 'bv_soc_son',           zone: 'forest',   nameVi: 'Sóc Sơn Hoang Dã Y Viện (BV Đa Khoa Sóc Sơn)',      lat: 21.2618, lon: 105.8418, radiusMeters: 80 },
      { id: 'bv_buu_dien',          zone: 'forest',   nameVi: 'Bưu Chính Y Quán (BV Bưu Điện - Đinh Tiên Hoàng)',  lat: 21.0338, lon: 105.8548, radiusMeters: 65 },
      { id: 'bv_nong_nghiep',       zone: 'forest',   nameVi: 'Nông Nghiệp Thảo Y Viện (BV Nông Nghiệp - Phương Mai)',lat: 21.0048, lon: 105.8388, radiusMeters: 70 },
      { id: 'bv_thanh_tri',         zone: 'forest',   nameVi: 'Thanh Trì Y Điện (BV Đa Khoa Thanh Trì)',           lat: 20.9618, lon: 105.8368, radiusMeters: 75 },
      { id: 'bv_hoai_duc',          zone: 'forest',   nameVi: 'Hoài Đức Thần Y Quán (BV Đa Khoa Hoài Đức)',        lat: 21.0218, lon: 105.7068, radiusMeters: 75 },
      { id: 'bv_chuong_my',         zone: 'forest',   nameVi: 'Chương Mỹ Thảo Dược Viện (BV Đa Khoa Chương Mỹ)',   lat: 20.9258, lon: 105.7258, radiusMeters: 75 },
      { id: 'bv_thuong_tin',        zone: 'forest',   nameVi: 'Thường Tín Y Điện (BV Đa Khoa Thường Tín)',         lat: 20.8728, lon: 105.8728, radiusMeters: 75 },
      { id: 'bv_phu_xuyen',         zone: 'forest',   nameVi: 'Phú Xuyên Thái Y Quán (BV Đa Khoa Phú Xuyên)',     lat: 20.7188, lon: 105.9068, radiusMeters: 75 },
      { id: 'bv_ung_hoa',           zone: 'forest',   nameVi: 'Ứng Hòa Dược Thảo Viện (BV Đa Khoa Ứng Hòa)',      lat: 20.7578, lon: 105.7788, radiusMeters: 75 },
      { id: 'bv_my_duc',            zone: 'forest',   nameVi: 'Mỹ Đức Sơn Thảo Y Điện (BV Đa Khoa Mỹ Đức)',       lat: 20.6868, lon: 105.7468, radiusMeters: 75 },
      { id: 'bv_ba_vi',             zone: 'forest',   nameVi: 'Ba Vì Linh Dược Viện (BV Đa Khoa Ba Vì)',           lat: 21.0828, lon: 105.4258, radiusMeters: 80 },

      // ═══════════════════════════════════════════════════════════════
      // TRƯỜNG HỌC & ĐẠI HỌC — ĐẦY ĐỦ TOÀN THÀNH PHỐ
      // ═══════════════════════════════════════════════════════════════

      // Đại Học & Học Viện Còn Thiếu
      { id: 'dh_ha_noi_ulis',       zone: 'forest',   nameVi: 'Ngôn Ngữ Bí Thư Điện (ĐH Hà Nội ULIS - Từ Liêm)',    lat: 21.0135, lon: 105.7598, radiusMeters: 80 },
      { id: 'dh_kien_truc',         zone: 'forest',   nameVi: 'Thạch Trúc Kiến Thiết Điện (ĐH Kiến Trúc - Nguyễn Trãi)',lat: 21.0068, lon: 105.8188, radiusMeters: 80 },
      { id: 'dh_giao_thong',        zone: 'merchant', nameVi: 'Vạn Đạo Giao Thông Viện (ĐH GTVT - Láng Thượng)',    lat: 21.0165, lon: 105.8048, radiusMeters: 80 },
      { id: 'dh_dien_luc',          zone: 'merchant', nameVi: 'Lôi Điện Thần Điện (ĐH Điện Lực - Hoàng Quốc Việt)',  lat: 21.0498, lon: 105.7828, radiusMeters: 75 },
      { id: 'dh_thuy_loi',          zone: 'water',    nameVi: 'Thủy Trị Đại Thần Viện (ĐH Thủy Lợi - Tây Sơn)',     lat: 21.0085, lon: 105.8228, radiusMeters: 80 },
      { id: 'dh_lam_nghiep',        zone: 'forest',   nameVi: 'Vạn Lâm Thảo Học Viện (ĐH Lâm Nghiệp - Xuân Mai)',   lat: 20.8742, lon: 105.6128, radiusMeters: 85 },
      { id: 'hv_ky_thuat_quan_su',  zone: 'merchant', nameVi: 'Quân Sự Kỳ Kỹ Điện (HV Kỹ Thuật Quân Sự - Hoàng Quốc Việt)',lat: 21.0548, lon: 105.7888, radiusMeters: 90 },
      { id: 'hv_tai_chinh',         zone: 'merchant', nameVi: 'Kim Khố Học Điện (HV Tài Chính - Đức Thắng)',         lat: 21.0578, lon: 105.7788, radiusMeters: 80 },
      { id: 'hv_an_ninh',           zone: 'forest',   nameVi: 'An Ninh Thần Điện (HV An Ninh Nhân Dân - Lê Đức Thọ)', lat: 21.0265, lon: 105.7738, radiusMeters: 85 },
      { id: 'hv_canh_sat',          zone: 'forest',   nameVi: 'Cảnh Sát Hộ Pháp Điện (HV Cảnh Sát - Trần Phú)',     lat: 21.1528, lon: 105.7758, radiusMeters: 85 },
      { id: 'hv_quan_y',            zone: 'forest',   nameVi: 'Quân Y Thần Lực Học Viện (HV Quân Y - Phùng Chí Kiên)',lat: 21.0628, lon: 105.7988, radiusMeters: 80 },
      { id: 'dh_phuong_dong',       zone: 'merchant', nameVi: 'Phương Đông Tư Viện (ĐH Phương Đông - Trung Hòa)',    lat: 21.0158, lon: 105.7978, radiusMeters: 75 },
      { id: 'dh_dai_nam',           zone: 'merchant', nameVi: 'Đại Nam Thương Học Điện (ĐH Đại Nam - Hà Đông)',      lat: 20.9668, lon: 105.7598, radiusMeters: 80 },
      { id: 'dh_hoa_binh',          zone: 'merchant', nameVi: 'Hòa Bình Đại Thư Viện (ĐH Hòa Bình - Lê Văn Thiêm)', lat: 21.0028, lon: 105.8028, radiusMeters: 75 },
      { id: 'dh_cntt_hn',           zone: 'merchant', nameVi: 'Số Hóa Thần Điện (ĐH CNTT Hà Nội - Duy Tân)',         lat: 21.0318, lon: 105.7828, radiusMeters: 75 },
      { id: 'hv_ngan_hang2',        zone: 'merchant', nameVi: 'Tiền Tệ Học Điện 2 (HV Ngân Hàng CS2 - Nam Từ Liêm)',lat: 21.0118, lon: 105.7748, radiusMeters: 70 },
      { id: 'dh_mo_dia_chat2',      zone: 'merchant', nameVi: 'Khai Thác Cơ Sở 2 (ĐH Mỏ ĐC CS2 - Đông Anh)',        lat: 21.1028, lon: 105.8328, radiusMeters: 70 },

      // THPT Còn Thiếu (Các Trường Trung Học Phổ Thông Danh Tiếng)
      { id: 'thpt_nguyen_gia_thieu', zone: 'forest',  nameVi: 'Nguyễn Gia Thiều Thần Học Điện (Long Biên)',          lat: 21.0518, lon: 105.8868, radiusMeters: 70 },
      { id: 'thpt_yen_hoa',          zone: 'forest',  nameVi: 'Yên Hòa Khai Trí Điện (Cầu Giấy)',                   lat: 21.0218, lon: 105.7948, radiusMeters: 70 },
      { id: 'thpt_phan_dinh_phung',  zone: 'forest',  nameVi: 'Phan Đình Phùng Cổ Học Đường (Ba Đình)',              lat: 21.0408, lon: 105.8418, radiusMeters: 70 },
      { id: 'thpt_tran_hung_dao_hd', zone: 'forest',  nameVi: 'Trần Hưng Đạo Học Đường (Hà Đông)',                  lat: 20.9718, lon: 105.7728, radiusMeters: 65 },
      { id: 'thpt_nguyen_hue_hd',    zone: 'forest',  nameVi: 'Nguyễn Huệ Thần Tài Điện (Hà Đông)',                 lat: 20.9628, lon: 105.7758, radiusMeters: 65 },
      { id: 'thpt_hoang_van_thu_lb', zone: 'forest',  nameVi: 'Hoàng Văn Thụ Khai Trí (Long Biên)',                  lat: 21.0448, lon: 105.8748, radiusMeters: 65 },
      { id: 'thpt_nguyen_trai_tx',   zone: 'forest',  nameVi: 'Nguyễn Trãi Đại Học Đường (Thanh Xuân)',              lat: 20.9978, lon: 105.8238, radiusMeters: 65 },
      { id: 'thpt_khoa_hoc_tu_nhien',zone: 'forest',  nameVi: 'Khoa Học Tự Nhiên Thần Điện (Chuyên TN - Cầu Giấy)',  lat: 21.0382, lon: 105.7822, radiusMeters: 70 },
      { id: 'thpt_tran_phu_hd',      zone: 'forest',  nameVi: 'Trần Phú Cổ Học Xá (Hà Đông)',                       lat: 20.9748, lon: 105.7908, radiusMeters: 65 },
      { id: 'thpt_duong_xa_gl',      zone: 'forest',  nameVi: 'Đường Xá Học Đường (Gia Lâm)',                       lat: 21.0228, lon: 105.9148, radiusMeters: 65 },
      { id: 'thpt_dong_anh_da',      zone: 'forest',  nameVi: 'Đông Anh Thư Viện Thần (THPT Đông Anh)',              lat: 21.1368, lon: 105.8428, radiusMeters: 65 },
      { id: 'thpt_soc_son_ss',       zone: 'forest',  nameVi: 'Sóc Sơn Học Đường (THPT Sóc Sơn)',                   lat: 21.2638, lon: 105.8378, radiusMeters: 65 },
      { id: 'thpt_me_linh_ml',       zone: 'forest',  nameVi: 'Mê Linh Khai Trí Điện (THPT Mê Linh)',               lat: 21.1728, lon: 105.7548, radiusMeters: 65 },
      { id: 'thpt_thanh_tri_tt',     zone: 'forest',  nameVi: 'Thanh Trì Học Viện (THPT Thanh Trì)',                 lat: 20.9628, lon: 105.8368, radiusMeters: 65 },

      // 18. Các Bến Xe & Trục Cầu Sông Hồng

      { id: 'bx_giapbat',   zone: 'merchant', nameVi: 'Đại Trạm Lữ Khách Phía Nam (Bến Xe Giáp Bát)', lat: 20.9785, lon: 105.8415, radiusMeters: 95 },
      { id: 'bx_nuocngam',  zone: 'merchant', nameVi: 'Mạch Nước Ngầm Lữ Điểm (Bến Xe Nước Ngầm)',   lat: 20.9615, lon: 105.8385, radiusMeters: 85 },
      { id: 'cau_nhattan',  zone: 'forest',   nameVi: 'Ngũ Trụ Cầu Thần (Cầu Nhật Tân)',             lat: 21.0925, lon: 105.8235, radiusMeters: 110 },
      { id: 'cau_thanglong',zone: 'forest',   nameVi: 'Cự Kiều Hai Tầng (Cầu Thăng Long)',           lat: 21.0985, lon: 105.7875, radiusMeters: 110 },
      { id: 'cau_vinhthuy', zone: 'forest',   nameVi: 'Đại Cầu Phía Đông (Cầu Vĩnh Tuy)',             lat: 21.0025, lon: 105.8795, radiusMeters: 100 },
      { id: 'cau_thanhchi', zone: 'forest',   nameVi: 'Trường Kiều Nam Hà (Cầu Thanh Trì)',          lat: 20.9785, lon: 105.9015, radiusMeters: 110 },

      // 19. Mạng Lưới Mỏ Khoáng Sản & Bãi Thú Tiền Sử Trải Khắp 30 Quận Huyện
      { id: 'mine_gold_01', zone: 'merchant',   nameVi: 'Mỏ Vàng Cổ Đại Kim Mã',             lat: 21.0312, lon: 105.8235, radiusMeters: 60 },
      { id: 'mine_gold_02', zone: 'merchant',   nameVi: 'Vỉa Vàng Nguyên Sinh Tây Hồ',        lat: 21.0625, lon: 105.8115, radiusMeters: 60 },
      { id: 'mine_gold_03', zone: 'merchant',   nameVi: 'Mỏ Vàng Ven Sông Hồng Long Biên',   lat: 21.0455, lon: 105.8655, radiusMeters: 65 },
      { id: 'mine_gold_04', zone: 'merchant',   nameVi: 'Vỉa Vàng Thần Núi Ba Vì',           lat: 21.0855, lon: 105.3555, radiusMeters: 75 },
      { id: 'mine_gold_05', zone: 'merchant',   nameVi: 'Mỏ Vàng Núi Sóc Sơn',               lat: 21.2855, lon: 105.8315, radiusMeters: 70 },
      { id: 'mine_iron_01', zone: 'wilderness', nameVi: 'Mỏ Than & Quặng Sắt Thanh Xuân',   lat: 20.9955, lon: 105.8085, radiusMeters: 75 },
      { id: 'mine_iron_02', zone: 'wilderness', nameVi: 'Vách Đá Trầm Tích Nam Từ Liêm',    lat: 21.0115, lon: 105.7685, radiusMeters: 75 },
      { id: 'mine_iron_03', zone: 'wilderness', nameVi: 'Mỏ Than Đen Bắc Từ Liêm',          lat: 21.0555, lon: 105.7615, radiusMeters: 75 },
      { id: 'mine_iron_04', zone: 'wilderness', nameVi: 'Mỏ Quặng Sắt Vùng Núi Quốc Oai',   lat: 20.9855, lon: 105.6315, radiusMeters: 75 },
      { id: 'mine_iron_05', zone: 'wilderness', nameVi: 'Vách Quặng Sắt Vùng Rừng Sóc Sơn',  lat: 21.2915, lon: 105.8085, radiusMeters: 75 },
      { id: 'deer_01',      zone: 'forest',     nameVi: 'Bãi Hươu Sao Tiền Sử Cầu Giấy',    lat: 21.0265, lon: 105.7915, radiusMeters: 80 },
      { id: 'deer_02',      zone: 'forest',     nameVi: 'Bãi Hươu Rừng Hoàng Mai',          lat: 20.9785, lon: 105.8515, radiusMeters: 80 },
      { id: 'deer_03',      zone: 'forest',     nameVi: 'Bãi Hươu Hoang Sơ Mễ Trì',         lat: 21.0155, lon: 105.7695, radiusMeters: 80 },
      { id: 'deer_04',      zone: 'forest',     nameVi: 'Đàn Hươu Rừng Nguyên Sinh Ba Vì',   lat: 21.0725, lon: 105.3695, radiusMeters: 90 },
      { id: 'deer_05',      zone: 'forest',     nameVi: 'Bãi Hươu Sao Thung Lũng Sóc Sơn',  lat: 21.2755, lon: 105.8215, radiusMeters: 85 },
      { id: 'boar_01',      zone: 'forest',     nameVi: 'Hang Lợn Rừng Cổ Bắc Tây Hồ',      lat: 21.0685, lon: 105.8315, radiusMeters: 70 },
      { id: 'boar_02',      zone: 'forest',     nameVi: 'Hang Lợn Rừng Đầm Lầy Yên Nghĩa',  lat: 20.9485, lon: 105.7415, radiusMeters: 75 },
      { id: 'boar_03',      zone: 'forest',     nameVi: 'Hang Cự Thú Rừng Tản Viên Ba Vì',  lat: 21.0815, lon: 105.3515, radiusMeters: 85 },
      { id: 'clay_01',      zone: 'water',      nameVi: 'Mỏ Đất Sét Ven Sông Hồng (Phúc Xá)',lat: 21.0465, lon: 105.8515, radiusMeters: 75 },
      { id: 'clay_02',      zone: 'water',      nameVi: 'Mỏ Đất Sét Sông Nhuệ (Hà Đông)',   lat: 20.9755, lon: 105.7815, radiusMeters: 70 },
      { id: 'clay_03',      zone: 'water',      nameVi: 'Bãi Đất Sét Sông Đáy Hoài Đức',    lat: 20.9855, lon: 105.7115, radiusMeters: 75 },
      { id: 'clay_04',      zone: 'water',      nameVi: 'Mỏ Đất Sét Làng Bát Tràng (Gia Lâm)',lat: 20.9695, lon: 105.9185, radiusMeters: 80 },

      // 20. Mạng Lưới Công Viên Nhỏ, Vườn Hoa & Khu Sinh Thái 30 Quận Huyện Hà Nội
      // --- Hoàn Kiếm, Ba Đình, Hai Bà Trưng ---
      { id: 'vh_lythaito',    zone: 'forest', nameVi: 'Vườn Hoa Lý Thái Tổ (Đinh Tiên Hoàng)',        lat: 21.0288, lon: 105.8548, radiusMeters: 55 },
      { id: 'vh_cotan',       zone: 'forest', nameVi: 'Vườn Hoa Cổ Tân (Nhà Hát Lớn)',                lat: 21.0242, lon: 105.8585, radiusMeters: 45 },
      { id: 'vh_dienhong',    zone: 'forest', nameVi: 'Vườn Hoa Diên Hồng (Vườn Hoa Con Cóc)',        lat: 21.0268, lon: 105.8562, radiusMeters: 50 },
      { id: 'vh_198',         zone: 'forest', nameVi: 'Vườn Hoa 19-8 (Nhà Hát Lớn - Hoàn Kiếm)',      lat: 21.0248, lon: 105.8572, radiusMeters: 45 },
      { id: 'vh_hangdau',     zone: 'forest', nameVi: 'Vườn Hoa Hàng Đậu (Tháp Nước Hàng Đậu)',       lat: 21.0395, lon: 105.8455, radiusMeters: 50 },
      { id: 'vh_vanxuan',     zone: 'forest', nameVi: 'Vườn Hoa Vạn Xuân (Quán Thánh - Ba Đình)',     lat: 21.0405, lon: 105.8432, radiusMeters: 50 },
      { id: 'vh_maixuanthuong',zone: 'forest',nameVi: 'Vườn Hoa Mai Xuân Thưởng (Đầu Hồ Tây)',        lat: 21.0435, lon: 105.8348, radiusMeters: 50 },
      { id: 'vh_pasteur',     zone: 'forest', nameVi: 'Vườn Hoa Pasteur (Hai Bà Trưng)',              lat: 21.0168, lon: 105.8582, radiusMeters: 45 },
      { id: 'vh_yersin',      zone: 'forest', nameVi: 'Vườn Hoa Yersin (Hai Bà Trưng)',               lat: 21.0152, lon: 105.8595, radiusMeters: 45 },
      { id: 'vh_tangbatho',   zone: 'forest', nameVi: 'Vườn Hoa Tăng Bạt Hổ (Hai Bà Trưng)',          lat: 21.0175, lon: 105.8612, radiusMeters: 45 },
      { id: 'cv_indiragandhi',zone: 'forest', nameVi: 'Công Viên Indira Gandhi (Hồ Thành Công)',      lat: 21.0188, lon: 105.8158, radiusMeters: 90 },

      // --- Đống Đa, Thanh Xuân, Cầu Giấy ---
      { id: 'vh_tranquangdieu',zone: 'forest',nameVi: 'Vườn Hoa Trần Quang Diệu (Hoàng Cầu)',         lat: 21.0165, lon: 105.8238, radiusMeters: 55 },
      { id: 'vh_1_6',         zone: 'forest', nameVi: 'Vườn Hoa 1-6 (Đoàn Thị Điểm - Đống Đa)',       lat: 21.0265, lon: 105.8335, radiusMeters: 45 },
      { id: 'cv_thanhxuan',   zone: 'forest', nameVi: 'Công Viên Thanh Xuân (Hồ Nhân Chính)',         lat: 21.0028, lon: 105.7978, radiusMeters: 130 },
      { id: 'vh_phungkhoang', zone: 'forest', nameVi: 'Vườn Hoa Phùng Khoang (Thanh Xuân)',          lat: 20.9898, lon: 105.7928, radiusMeters: 50 },
      { id: 'cv_nghiado',     zone: 'forest', nameVi: 'Công Viên Nghĩa Đô (Cầu Giấy)',                lat: 21.0408, lon: 105.7978, radiusMeters: 120 },
      { id: 'vh_nghiatan',    zone: 'forest', nameVi: 'Vườn Hoa Nghĩa Tân (Tô Hiệu - Cầu Giấy)',      lat: 21.0428, lon: 105.7928, radiusMeters: 50 },
      { id: 'vh_dichvonghau', zone: 'forest', nameVi: 'Vườn Hoa Dịch Vọng Hậu (Trần Thái Tông)',      lat: 21.0335, lon: 105.7865, radiusMeters: 50 },
      { id: 'vh_yenhoa',      zone: 'forest', nameVi: 'Vườn Hoa Yên Hòa (Trung Kính)',                lat: 21.0195, lon: 105.7935, radiusMeters: 50 },
      { id: 'vh_namtrungyen', zone: 'forest', nameVi: 'Vườn Hoa Nam Trung Yên (Mạc Thái Tổ)',         lat: 21.0125, lon: 105.7885, radiusMeters: 55 },

      // --- Nam Từ Liêm, Bắc Từ Liêm, Tây Hồ ---
      { id: 'cv_metriha',     zone: 'forest', nameVi: 'Công Viên Mễ Trì Hạ (Nam Từ Liêm)',            lat: 21.0148, lon: 105.7828, radiusMeters: 80 },
      { id: 'cv_vuonnhat_sc', zone: 'forest', nameVi: 'Công Viên Vườn Nhật (Vinhomes Smart City)',    lat: 21.0068, lon: 105.7468, radiusMeters: 110 },
      { id: 'cv_trungtam_sc', zone: 'forest', nameVi: 'Công Viên Trung Tâm Hồ Cát Trắng Smart City',  lat: 21.0018, lon: 105.7455, radiusMeters: 150 },
      { id: 'cv_anbinh',      zone: 'forest', nameVi: 'Công Viên Hồ An Bình (Thành Phố Giao Lưu)',    lat: 21.0548, lon: 105.7768, radiusMeters: 130 },
      { id: 'cv_ngoaigiaodoan',zone: 'forest',nameVi: 'Công Viên Ngoại Giao Đoàn (Xuân Tảo)',        lat: 21.0628, lon: 105.7958, radiusMeters: 110 },
      { id: 'vh_trinhcongson',zone: 'forest', nameVi: 'Vườn Hoa Phố Đi Bộ Trịnh Công Sơn (Tây Hồ)',  lat: 21.0698, lon: 105.8198, radiusMeters: 60 },
      { id: 'vh_quangan',     zone: 'forest', nameVi: 'Vườn Hoa Quảng An (Bờ Hồ Tây)',                lat: 21.0615, lon: 105.8285, radiusMeters: 55 },
      { id: 'vh_nhattan',     zone: 'forest', nameVi: 'Vườn Hoa Lạc Long Quân (Nhật Tân)',            lat: 21.0785, lon: 105.8185, radiusMeters: 60 },

      // --- Hà Đông, Hoàng Mai, Long Biên ---
      { id: 'cv_vanquan',     zone: 'forest', nameVi: 'Công Viên Hồ Văn Quán (Hà Đông)',              lat: 20.9788, lon: 105.7898, radiusMeters: 110 },
      { id: 'cv_thienvanhoc', zone: 'forest', nameVi: 'Công Viên Thiên Văn Học (KĐT Dương Nội)',      lat: 20.9818, lon: 105.7468, radiusMeters: 140 },
      { id: 'vh_nguyentrai_hd',zone: 'forest',nameVi: 'Vườn Hoa Nguyễn Trãi (Trung Tâm Hà Đông)',     lat: 20.9728, lon: 105.7795, radiusMeters: 60 },
      { id: 'vh_hacau',       zone: 'forest', nameVi: 'Vườn Hoa Hà Cầu (Hà Đông)',                    lat: 20.9635, lon: 105.7745, radiusMeters: 50 },
      { id: 'cv_denlu',       zone: 'forest', nameVi: 'Công Viên Hồ Đền Lừ (Hoàng Mai)',              lat: 20.9888, lon: 105.8568, radiusMeters: 120 },
      { id: 'cv_linhdam',     zone: 'forest', nameVi: 'Công Viên Cây Xanh Bán Đảo Linh Đàm',          lat: 20.9658, lon: 105.8288, radiusMeters: 130 },
      { id: 'vh_dinhcong',    zone: 'forest', nameVi: 'Vườn Hoa Định Công (Hoàng Mai)',               lat: 20.9845, lon: 105.8315, radiusMeters: 50 },
      { id: 'vh_ngoclam',     zone: 'forest', nameVi: 'Vườn Hoa Ngọc Lâm (Long Biên)',                lat: 21.0488, lon: 105.8698, radiusMeters: 55 },
      { id: 'vh_bode',        zone: 'forest', nameVi: 'Vườn Hoa Bồ Đề (Long Biên)',                   lat: 21.0365, lon: 105.8715, radiusMeters: 50 },
      { id: 'vh_gialam',      zone: 'forest', nameVi: 'Vườn Hoa Gia Lâm (Ngô Gia Khảm)',              lat: 21.0515, lon: 105.8795, radiusMeters: 50 },
      { id: 'vh_thachban',    zone: 'forest', nameVi: 'Vườn Hoa Thạch Bàn (Long Biên)',               lat: 21.0185, lon: 105.9085, radiusMeters: 55 },

      // 21. Toàn Bộ Hang Ổ & Tổ Dã Thú Tiền Sử (Boss & Dã Thú Nhỏ)
      ...HANOI_BEAST_DENS.map((den) => ({
        id: den.id,
        zone: 'forest'         ,
        nameVi: den.nameVi,
        lat: den.lat,
        lon: den.lon,
        radiusMeters: den.radiusMeters,
      })),
    ],
  });
}
