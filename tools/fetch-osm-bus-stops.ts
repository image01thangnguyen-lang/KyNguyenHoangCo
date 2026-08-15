import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// Tạo các ô con 0.03 x 0.03 phủ toàn bộ nội ngoại thành Hà Nội
const SUB_BOXES: { name: string; bbox: string }[] = [];
for (let lat = 20.94; lat < 21.10; lat += 0.04) {
  for (let lon = 105.72; lon < 105.90; lon += 0.04) {
    const latMax = Math.min(21.10, Math.round((lat + 0.04) * 100) / 100);
    const lonMax = Math.min(105.90, Math.round((lon + 0.04) * 100) / 100);
    const bStr = `${lat.toFixed(2)},${lon.toFixed(2)},${latMax.toFixed(2)},${lonMax.toFixed(2)}`;
    SUB_BOXES.push({ name: `Ô [${lat.toFixed(2)},${lon.toFixed(2)}]`, bbox: bStr });
  }
}

async function fetchOsmBbox(bboxStr: string) {
  const query = `[out:json][timeout:10];(node["highway"="bus_stop"](${bboxStr});node["public_transport"="platform"](${bboxStr}););out body;`;
  
  for (const serverUrl of OVERPASS_SERVERS) {
    try {
      const res = await fetch(serverUrl, {
        method: 'POST',
        headers: {
          'User-Agent': 'KyNguyenHoangCo/2.0 (Offline Survival RPG)',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const json = await res.json();
        return json.elements || [];
      }
    } catch (e: any) {
      // thử server kế tiếp
    }
  }
  return [];
}

export function toAncientBusStopName(name: string, ref?: string): string {
  if (!name || name.trim() === '') {
    return ref ? `Tiền Đồn Trạm Dừng (Tuyến ${ref})` : 'Tiền Đồn Trạm Dừng Xe Buýt';
  }

  let clean = name
    .replace(/^Điểm đỗ xe buýt\s+/i, '')
    .replace(/^Trạm xe buýt\s+/i, '')
    .replace(/^Nhà chờ xe buýt\s+/i, '')
    .replace(/^Bến xe buýt\s+/i, '')
    .trim();

  clean = clean
    .replace(/Đường\s+/g, 'Cổ Đạo ')
    .replace(/Phố\s+/g, 'Cổ Phố ')
    .replace(/Cầu\s+/g, 'Thạch Kiều ')
    .replace(/Bệnh viện\s+/g, 'Y Viện ')
    .replace(/Trường đại học\s+/g, 'Học Viện ')
    .replace(/Đại học\s+/g, 'Học Viện ')
    .replace(/Chợ\s+/g, 'Thương Thị ');

  return `Tiền Đồn Trạm Dừng (${clean})`;
}

async function main() {
  const allStopsMap = new Map<number, any>();

  for (const box of SUB_BOXES) {
    console.log(`📡 Đang tải trạm xe buýt ${box.name}...`);
    try {
      const elements = await fetchOsmBbox(box.bbox);
      console.log(`  -> Nhận được ${elements.length} trạm.`);
      for (const el of elements) {
        if (el.type === 'node' && el.lat && el.lon) {
          allStopsMap.set(el.id, el);
        }
      }
    } catch (e: any) {
      console.warn(`  ⚠️ Lỗi tải ${box.name}:`, e.message);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n🎉 Tổng số trạm xe buýt thu được: ${allStopsMap.size}`);

  const processed = Array.from(allStopsMap.values()).map((el: any) => {
    const rawName = el.tags?.name || el.tags?.['name:vi'] || el.tags?.description || '';
    const ref = el.tags?.ref || el.tags?.bus_routes || '';
    const ancientName = toAncientBusStopName(rawName, ref);
    return {
      id: `bus_osm_${el.id}`,
      zone: 'merchant',
      nameVi: ancientName,
      lat: Math.round(el.lat * 100000) / 100000,
      lon: Math.round(el.lon * 100000) / 100000,
      radiusMeters: 35,
    };
  });

  const outPath = join(process.cwd(), 'packages/game-core/data/bus-stops-hanoi.json');
  writeFileSync(outPath, JSON.stringify(processed, null, 2), 'utf8');
  console.log(`💾 Đã lưu thành công ${processed.length} trạm xe buýt vào ${outPath}`);
}

main().catch(console.error);
