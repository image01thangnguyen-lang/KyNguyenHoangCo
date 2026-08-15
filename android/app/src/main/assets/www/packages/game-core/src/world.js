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
    'Bí Cảnh Khai Trí Viện (Học Đường Cổ)',
    'Thần Đạo Miếu Mạo (Đình Thần Cổ)',
    'Y Viện Thảo Dược Dân Gian',
    'Vạt Cây Rậm',
    'Bãi Hươu Sao Tiền Sử',
    'Hang Lợn Rừng Cổ',
    'Rừng Đại Cổ Thụ',
    'Bách Thảo Điền Viên',
    'Rặng Cây Cổ Thụ',
  ],
  water: [
    'Đầm Nước Thiêng',
    'Mạch Nước Ngầm',
    'Hồ Nước Ngọt Thổ Dân',
    'Bến Nước Cổ Đại',
    'Mỏ Đất Sét Ven Suối',
    'Đầm Sen Cổ Thạch',
    'Khe Nước Nhỏ',
    'Vũng Nước Trầm',
  ],
  merchant: [
    'Highlands Coffee (Trạm Cà Phê Cổ)',
    'The Coffee House (Quán Trà Đá Cổ)',
    'Trà Quán Phúc Long Cổ Đại',
    'Cộng Trà Quán (Bí Cảnh Tiền Sử)',
    'Vịnh Xén Hè Xe Buýt (Trạm Lữ Khách)',
    'Tiệm Trao Đổi WinMart',
    'Tiệm Trao Đổi Circle K',
    'Quán Phở Cổ Truyền Thổ Tộc',
    'Lò Bánh Nướng Tiền Sử',
    'Khu Chợ Trao Đổi Dân Sinh',
    'Mỏ Vàng Lộ Thiên',
    'Trạm Tiếp Năng Lượng Thần Thú',
  ],
  wilderness: [
    'Mỏ Than Đen',
    'Vách Quặng Sắt',
    'Bãi Hoang Sỏi Đá',
    'Vạt Đất Trống Cổ',
    'Vách Đá Trầm Tích',
    'Trầm Tích Cổ Đại',
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

      // 3.2. Quán Ăn Cổ Truyền Danh Bất Hư Truyền Tại Hà Nội
      { id: 'pho_thin_loduc',       zone: 'merchant', nameVi: 'Phở Thìn Lò Đúc (Cổ Quán Phở Tái Lăn)',        lat: 21.0158, lon: 105.8568, radiusMeters: 30 },
      { id: 'pho_bat_dan',          zone: 'merchant', nameVi: 'Phở Gia Truyền Bát Đàn (Cổ Phố 36 Hàng)',      lat: 21.0338, lon: 105.8478, radiusMeters: 30 },
      { id: 'buncha_huonglien',     zone: 'merchant', nameVi: 'Bún Chả Hương Liên (Bún Chả Obama - Lê Văn Hưu)',lat: 21.0182, lon: 105.8525, radiusMeters: 30 },
      { id: 'banhcuon_bahoanh',     zone: 'merchant', nameVi: 'Bánh Cuốn Bà Hoành (Cổ Đạo Tô Hiến Thành)',    lat: 21.0142, lon: 105.8505, radiusMeters: 30 },
      { id: 'chaca_lavong',         zone: 'merchant', nameVi: 'Chả Cá Lã Vọng Thiên Thu (Cổ Phố Chả Cá)',     lat: 21.0362, lon: 105.8488, radiusMeters: 30 },
      { id: 'bundau_ngotram',       zone: 'merchant', nameVi: 'Bún Đậu Mắm Tôm Ngõ Trạm (Cổ Điểm)',          lat: 21.0322, lon: 105.8465, radiusMeters: 25 },
      { id: 'chaca_thanglong',      zone: 'merchant', nameVi: 'Chả Cá Thăng Long (Cổ Đạo Đường Thành)',       lat: 21.0328, lon: 105.8468, radiusMeters: 30 },

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

      // 4. Mạng Lưới Vịnh Xén Hè Xe Buýt & Trạm Trung Chuyển Thần Thú
      { id: 'bus_caugiay',      zone: 'merchant', nameVi: 'Vịnh Xén Hè Xe Buýt (Giao Điểm Cầu Giấy — Chùa Hà)', lat: 21.0338, lon: 105.7932, radiusMeters: 25 },
      { id: 'bus_hotungmau',    zone: 'merchant', nameVi: 'Vịnh Xén Hè Xe Buýt (Cổ Lộ Hồ Tùng Mậu)',          lat: 21.0375, lon: 105.7695, radiusMeters: 25 },
      { id: 'bus_nguyentrai',   zone: 'merchant', nameVi: 'Vịnh Xén Hè Xe Buýt (Cổ Đạo Nguyễn Trãi — Khuất Duy Tiến)', lat: 20.9965, lon: 105.8015, radiusMeters: 25 },
      { id: 'bus_giaiphong',    zone: 'merchant', nameVi: 'Vịnh Xén Hè Xe Buýt (Thiên Lý Cổ Lộ Giải Phóng)',   lat: 20.9855, lon: 105.8415, radiusMeters: 25 },
      { id: 'bus_kimma',        zone: 'merchant', nameVi: 'Vịnh Xén Hè Xe Buýt (Cổ Đạo Kim Mã — Ngọc Khánh)', lat: 21.0315, lon: 105.8165, radiusMeters: 25 },
      { id: 'bus_longbien',     zone: 'merchant', nameVi: 'Vịnh Xén Hè Trung Chuyển Long Biên (Yên Phụ)',     lat: 21.0415, lon: 105.8515, radiusMeters: 40 },

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
    ],
  });
}
