import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

interface Road {
  id: number;
  name: string;
  type: string;
  widthMeters: number;
  points: [number, number][];
}

interface BusStopPOI {
  id: string;
  zone: string;
  nameVi: string;
  lat: number;
  lon: number;
  radiusMeters: number;
}

const EARTH_RADIUS_M = 6_371_000;
function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function buildComprehensiveHanoiBusStops(): BusStopPOI[] {
  const allStops: BusStopPOI[] = [];
  const existingCoords: [number, number][] = [];

  // 1. Tải các trạm đã fetch được từ OSM (nếu có)
  const osmPath = join(process.cwd(), 'packages/game-core/data/bus-stops-hanoi.json');
  if (existsSync(osmPath)) {
    try {
      const osmData = JSON.parse(readFileSync(osmPath, 'utf8'));
      if (Array.isArray(osmData)) {
        for (const s of osmData) {
          allStops.push(s);
          existingCoords.push([s.lat, s.lon]);
        }
      }
    } catch {}
  }

  // 2. Trích xuất trạm xe buýt dọc theo toàn bộ 7.913 tuyến đường & đại lộ thực tế của Hà Nội
  const roadsPath = join(process.cwd(), 'packages/game-core/data/osm-roads-hanoi.json');
  if (existsSync(roadsPath)) {
    const roads: Road[] = JSON.parse(readFileSync(roadsPath, 'utf8'));
    
    // Chỉ lấy các tuyến đường chính có xe buýt chạy: motorway, trunk, primary, secondary, tertiary
    const busRoads = roads.filter(r => ['trunk', 'primary', 'secondary', 'tertiary'].includes(r.type));

    for (const road of busRoads) {
      if (!road.points || road.points.length < 2) continue;

      let roadDist = 0;
      let lastStopPt = road.points[0];

      // Đặt trạm xe buýt cách nhau khoảng 350m - 500m dọc theo tuyến
      for (let i = 1; i < road.points.length; i++) {
        const p1 = road.points[i - 1];
        const p2 = road.points[i];
        const segDist = distanceMeters(p1[0], p1[1], p2[0], p2[1]);
        roadDist += segDist;

        const distFromLast = distanceMeters(lastStopPt[0], lastStopPt[1], p2[0], p2[1]);
        if (distFromLast >= 380) {
          // Kiểm tra không đặt trùng với trạm đã có trong bán kính 100m
          const isDup = existingCoords.some(c => distanceMeters(c[0], c[1], p2[0], p2[1]) < 100);
          if (!isDup) {
            const stopId = `bus_stop_${road.id}_${i}`;
            const cleanRoadName = road.name.replace(/^(Thiên Lý Đạo|Đại Quan Đạo|Thương Cổ Đạo|Cổ Đạo|Cổ Lộ|Lối Mòn)\s+/i, '');
            const stopName = `Tiền Đồn Trạm Dừng (${cleanRoadName})`;

            const newStop: BusStopPOI = {
              id: stopId,
              zone: 'merchant',
              nameVi: stopName,
              lat: p2[0],
              lon: p2[1],
              radiusMeters: 35,
            };

            allStops.push(newStop);
            existingCoords.push([p2[0], p2[1]]);
            lastStopPt = p2;
          }
        }
      }
    }
  }

  return allStops;
}

const stops = buildComprehensiveHanoiBusStops();
console.log(`🎉 Tổng số Tiền Đồn Trạm Dừng Xe Buýt trên toàn thành phố Hà Nội: ${stops.length} trạm!`);

const jsonOutPath = join(process.cwd(), 'packages/game-core/data/bus-stops-hanoi.json');
writeFileSync(jsonOutPath, JSON.stringify(stops, null, 2), 'utf8');

const tsContent = `/**
 * Danh mục toàn bộ Tiền Đồn Trạm Dừng Xe Buýt & Ga Metro trên toàn địa bàn Hà Nội.
 * Tự động tạo bởi tools/build-full-bus-stops.ts từ mạng lưới giao thông thực tế.
 */

import type { PoiDef } from './world.ts';

export const HANOI_BUS_STOPS: PoiDef[] = ${JSON.stringify(stops, null, 2)};
`;

const tsOutPath = join(process.cwd(), 'packages/game-core/src/busStopsData.ts');
writeFileSync(tsOutPath, tsContent, 'utf8');
console.log(`💾 Đã lưu thành công ${stops.length} trạm xe buýt vào ${tsOutPath}`);

