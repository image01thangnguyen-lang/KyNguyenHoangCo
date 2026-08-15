import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Khu vực trọng tâm game (Cầu Giấy, Nam Từ Liêm, Mỹ Đình, Hoàn Kiếm, Ba Đình, Đống Đa, Tây Hồ...)
const BBOXES = [
  // Khu 1: Cầu Giấy - Mỹ Đình - Nam Từ Liêm (Vùng người chơi thử nghiệm: Hàm Nghi, Lê Đức Thọ, Hồ Tùng Mậu, Phạm Hùng...)
  { name: 'Khu Mỹ Đình - Cầu Giấy', bbox: '21.01,105.74,21.06,105.80' },
  // Khu 2: Ba Đình - Đống Đa - Tây Hồ - Hoàn Kiếm (Trung tâm Hà Nội)
  { name: 'Khu Trung Tâm Hoàn Kiếm - Ba Đình', bbox: '21.01,105.80,21.06,105.86' },
];

export function toAncientRoadName(modernName: string, highwayType: string): string {
  if (!modernName) {
    if (highwayType === 'motorway' || highwayType === 'trunk') return 'Thiên Lý Cổ Đạo';
    if (highwayType === 'primary') return 'Đại Quan Đạo';
    if (highwayType === 'secondary') return 'Thương Cổ Đạo';
    if (highwayType === 'tertiary') return 'Bình Lộ Thôn Trang';
    if (highwayType === 'residential') return 'Lối Nhai Phường Cổ';
    return 'Cổ Đạo Hoang Dã';
  }

  let name = modernName.trim();

  // Bảng chuyển đổi các danh xưng địa danh đặc trưng
  const directMap: Record<string, string> = {
    'Đại lộ Thăng Long': 'Thăng Long Thiên Lý Đạo',
    'Phạm Hùng': 'Thần Long Cổ Lộ (Phạm Hùng)',
    'Cầu Giấy': 'Thạch Kiều Cổ Đạo (Cầu Giấy)',
    'Xuân Thủy': 'Xuân Thủy Quan Đạo',
    'Hồ Tùng Mậu': 'Tùng Mậu Cổ Lộ',
    'Lê Đức Thọ': 'Đức Thọ Cổ Đạo',
    'Hàm Nghi': 'Nghĩa Dũng Lối Mòn (Hàm Nghi)',
    'Nguyễn Hoàng': 'Hoàng Đạo Nguyễn Hoàng',
    'Trần Duy Hưng': 'Duy Hưng Đại Lộ',
    'Kim Mã': 'Kim Mã Thần Đạo',
    'Nguyễn Chí Thanh': 'Chí Thanh Cổ Đạo',
    'Hoàng Hoa Thám': 'Hoàng Hoa Sơn Đạo',
    'Đường Láng': 'Láng Giang Duyên Đạo',
    'Tây Sơn': 'Tây Sơn Cổ Lộ',
    'Nguyễn Trãi': 'Nguyễn Trãi Đại Quan Đạo',
    'Lê Văn Lương': 'Văn Lương Cổ Đạo',
    'Hoàng Đạo Thúy': 'Đạo Thúy Cổ Lộ',
    'Trung Kính': 'Trung Kính Phường Đạo',
    'Mễ Trì': 'Mễ Trì Cổ Đạo',
    'Dương Đình Nghệ': 'Đình Nghệ Cổ Lộ',
    'Trần Thái Tông': 'Thái Tông Quan Lộ',
    'Duy Tân': 'Duy Tân Cổ Phố',
    'Tôn Thất Thuyết': 'Tôn Thất Thần Đạo',
    'Phạm Văn Đồng': 'Văn Đồng Thiên Lý Đạo',
    'Võ Chí Công': 'Chí Công Long Đạo',
    'Lạc Long Quân': 'Lạc Long Quân Cổ Đạo',
    'Âu Cơ': 'Âu Cơ Thánh Đạo',
    'Hoàng Quốc Việt': 'Quốc Việt Đại Đạo',
    'Bưởi': 'Bưởi Giang Cổ Lộ',
    'Đội Cấn': 'Đội Cấn Cổ Nhai',
    'Liễu Giai': 'Liễu Giai Hoa Đạo',
    'Văn Cao': 'Văn Cao Cổ Lộ',
    'Nguyễn Thái Học': 'Thái Học Văn Đạo',
    'Tràng Tiền': 'Tràng Tiền Kim Đạo',
    'Đinh Tiên Hoàng': 'Tiên Hoàng Cổ Lộ',
    'Hàng Đào': 'Đào Hoa Cổ Phố',
    'Hàng Bạc': 'Ngân Bảo Cổ Phố',
    'Hàng Mã': 'Linh Phù Cổ Phố',
    'Hàng Gai': 'Gai Tiên Cổ Phố',
    'Hàng Bông': 'Bông Tuyết Cổ Phố',
    'Hàng Trống': 'Chiến Cổ Cổ Phố',
    'Quán Thánh': 'Chân Vũ Quán Thánh Đạo',
    'Thanh Niên': 'Cổ Ngư Thủy Đạo (Thanh Niên)',
    'Phan Đình Phùng': 'Đình Phùng Cổ Lộ',
    'Điện Biên Phủ': 'Điện Biên Thần Đạo',
    'Hai Bà Trưng': 'Trưng Nữ Vương Thánh Đạo',
    'Lý Thường Kiệt': 'Thường Kiệt Chiến Đạo',
    'Trần Hưng Đạo': 'Hưng Đạo Đại Vương Lộ',
    'Bà Triệu': 'Triệu Trinh Nữ Cổ Lộ',
    'Phố Huế': 'Huế Thành Cổ Phố',
    'Đại Cồ Việt': 'Đại Cồ Việt Thiên Lý Đạo',
    'Giải Phóng': 'Giải Phóng Nam Quan Đạo',
    'Trường Chinh': 'Trường Chinh Đại Đạo',
    'Minh Khai': 'Minh Khai Cổ Lộ',
  };

  for (const [key, ancient] of Object.entries(directMap)) {
    if (name.includes(key)) return ancient;
  }

  // Quy tắc thay thế tiền tố hiện đại sang tiền tố cổ trang
  name = name
    .replace(/^Đường\s+/i, 'Cổ Đạo ')
    .replace(/^Phố\s+/i, 'Cổ Phố ')
    .replace(/^Ngõ\s+/i, 'Ngõ Hẻm ')
    .replace(/^Ngách\s+/i, 'Khúc Quanh ')
    .replace(/^Đại lộ\s+/i, 'Thiên Lý Đạo ')
    .replace(/^Cầu\s+/i, 'Thạch Kiều ');

  if (!name.startsWith('Cổ Đạo') && !name.startsWith('Cổ Phố') && !name.startsWith('Lối Mòn') && !name.startsWith('Thiên Lý Đạo') && !name.startsWith('Thạch Kiều') && !name.startsWith('Ngõ Hẻm')) {
    if (highwayType === 'motorway' || highwayType === 'trunk') name = `Thiên Lý Đạo ${name}`;
    else if (highwayType === 'primary') name = `Đại Quan Đạo ${name}`;
    else if (highwayType === 'secondary') name = `Cổ Đạo ${name}`;
    else if (highwayType === 'tertiary') name = `Cổ Lộ ${name}`;
    else name = `Lối Mòn ${name}`;
  }

  return name;
}

export function getRoadWidthMeters(highwayType: string): number {
  switch (highwayType) {
    case 'motorway':
    case 'trunk':
      return 32;
    case 'primary':
      return 24;
    case 'secondary':
      return 18;
    case 'tertiary':
      return 14;
    case 'residential':
      return 10;
    default:
      return 8;
  }
}

// Chia thành các ô nhỏ 0.03 x 0.03 để máy chủ Overpass phản hồi ngay lập tức trong 2 giây mà không bị timeout
const SUB_BOXES: { name: string; bbox: string }[] = [];
for (let lat = 21.00; lat < 21.08; lat += 0.03) {
  for (let lon = 105.74; lon < 105.86; lon += 0.03) {
    const latMax = Math.min(21.08, Math.round((lat + 0.03) * 100) / 100);
    const lonMax = Math.min(105.86, Math.round((lon + 0.03) * 100) / 100);
    const bStr = `${lat.toFixed(2)},${lon.toFixed(2)},${latMax.toFixed(2)},${lonMax.toFixed(2)}`;
    SUB_BOXES.push({ name: `Ô [${lat.toFixed(2)},${lon.toFixed(2)}]`, bbox: bStr });
  }
}

const OVERPASS_SERVERS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

async function fetchOsmBbox(bboxStr: string) {
  const query = `[out:json][timeout:15];way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street"](${bboxStr});out geom;`;
  
  for (const serverUrl of OVERPASS_SERVERS) {
    try {
      const res = await fetch(serverUrl, {
        method: 'POST',
        headers: {
          'User-Agent': 'KyNguyenHoangCo/2.0 (Offline Survival RPG)',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e: any) {
      // Thử server tiếp theo
    }
  }
  throw new Error(`Tất cả máy chủ Overpass đều bận.`);
}

async function main() {
  const allRoadsMap = new Map<number, any>();

  for (const box of SUB_BOXES) {
    console.log(`📡 Đang tải ${box.name} (${box.bbox})...`);
    try {
      const data = await fetchOsmBbox(box.bbox);
      const elements = data.elements || [];
      console.log(`  -> Nhận được ${elements.length} ways từ OSM.`);
      for (const el of elements) {
        if (el.type === 'way' && el.geometry && el.geometry.length >= 2) {
          allRoadsMap.set(el.id, el);
        }
      }
    } catch (e: any) {
      console.warn(`  ⚠️ Lỗi tải ${box.name}:`, e.message);
    }
    // Nghỉ nhẹ 300ms giữa các request để tôn trọng rate limit của OSM
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n🎉 Tổng số đường duy nhất thu được: ${allRoadsMap.size}`);

  const processedRoads: {
    id: number;
    name: string;
    type: string;
    widthMeters: number;
    points: [number, number][];
  }[] = [];

  for (const el of allRoadsMap.values()) {
    const highway = el.tags?.highway || 'road';
    const rawName = el.tags?.name || el.tags?.['name:vi'] || '';
    const ancientName = toAncientRoadName(rawName, highway);
    const width = getRoadWidthMeters(highway);

    const points: [number, number][] = el.geometry.map((pt: any) => [
      Math.round(pt.lat * 100000) / 100000,
      Math.round(pt.lon * 100000) / 100000,
    ]);

    processedRoads.push({
      id: el.id,
      name: ancientName,
      type: highway,
      widthMeters: width,
      points,
    });
  }

  // Lưu file vào packages/game-core/data/osm-roads-hanoi.json
  const outPath = join(process.cwd(), 'packages/game-core/data/osm-roads-hanoi.json');
  writeFileSync(outPath, JSON.stringify(processedRoads), 'utf8');
  console.log(`💾 Đã lưu thành công ${processedRoads.length} tuyến đường vào ${outPath}`);
  console.log(`📦 Dung lượng file: ${(Buffer.byteLength(JSON.stringify(processedRoads)) / 1024).toFixed(1)} KB`);
}

main().catch(err => console.error('Lỗi chính:', err));
