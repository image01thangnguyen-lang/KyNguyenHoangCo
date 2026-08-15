import test from 'node:test';
import assert from 'node:assert/strict';

import { POI } from '../src/balance.js';
import {
  buildPackIndex,
  cellAt,
  cellById,
  distanceMeters,
  locationAt,
  poisNear,
  proceduralZone,
  sampleHanoiPack,
  scanArea,
  validatePack,
} from '../src/world.js';
import { forecast, modifiersOf, rainHarvest, regionOf, weatherFor } from '../src/weather.js';
import { createClockState, readClock } from '../src/clock.js';
import { checkSpeed, createSpeedState } from '../src/safety.js';

const HOAN_KIEM = { lat: 21.0287, lon: 105.8524 };
const T0 = Date.UTC(2026, 7, 14, 3, 0, 0);

test('khoảng cách haversine đúng ở thang mét', () => {
  const d = distanceMeters(HOAN_KIEM, { lat: 21.0287, lon: 105.8534 });
  assert.ok(Math.abs(d - 104) < 5, `đo được ${d.toFixed(1)} m`);
});

test('ô lưới 200 m ổn định: cùng toạ độ luôn ra cùng ô', () => {
  const a = cellAt(HOAN_KIEM.lat, HOAN_KIEM.lon);
  const b = cellAt(HOAN_KIEM.lat, HOAN_KIEM.lon);

  assert.equal(a.id, b.id);
  assert.equal(a.sizeMeters, POI.wildernessGrid.cellSizeMeters);
});

test('đi 500 m thì sang ô khác, nhích 10 m thì không', () => {
  const here = cellAt(HOAN_KIEM.lat, HOAN_KIEM.lon);
  const nudge = cellAt(HOAN_KIEM.lat + 0.00005, HOAN_KIEM.lon);
  const far = cellAt(HOAN_KIEM.lat + 0.0045, HOAN_KIEM.lon);

  assert.equal(here.id, nudge.id);
  assert.notEqual(here.id, far.id);
});

test('id ô giải mã ngược được về đúng tâm ô', () => {
  const cell = cellAt(HOAN_KIEM.lat, HOAN_KIEM.lon);
  const decoded = cellById(cell.id) ;

  assert.equal(decoded.id, cell.id);
  assert.ok(Math.abs(decoded.centerLat - cell.centerLat) < 1e-9);
  assert.ok(Math.abs(decoded.centerLon - cell.centerLon) < 1e-9);
});

test('vùng thủ tục xác định: cùng ô luôn ra cùng vùng, trên mọi máy', () => {
  const cell = cellAt(HOAN_KIEM.lat, HOAN_KIEM.lon);
  const zones = Array.from({ length: 20 }, () => proceduralZone(cell));

  assert.equal(new Set(zones).size, 1);
});

test('vùng thủ tục phân bố hợp lý: đường mòn chiếm đa số', () => {
  const counts                         = {};
  for (let i = 0; i < 600; i++) {
    const cell = cellAt(21 + i * 0.002, 105.8 + i * 0.001);
    const zone = proceduralZone(cell);
    counts[zone] = (counts[zone] ?? 0) + 1;
  }

  assert.ok(counts.trail  > 300, `đường mòn chỉ có ${counts.trail}/600`);
  assert.ok(counts.forest  > 60);
  assert.ok(counts.water  > 20);
});

test('gói POI mẫu hợp lệ và tra cứu được theo bán kính', () => {
  const pack = sampleHanoiPack();
  assert.deepEqual(validatePack(pack), []);

  const near = poisNear(pack, HOAN_KIEM, 300);
  assert.ok(near.length >= 1);
  assert.equal(near[0] .nameVi, 'Hồ Gươm');
  assert.ok(near[0] .distanceMeters < 5);
});

test('chỉ mục ô 500 m cho cùng kết quả với quét toàn bộ', () => {
  const pack = sampleHanoiPack();
  const unindexed = { ...pack, index: undefined };

  const withIndex = poisNear(pack, HOAN_KIEM, 500).map((p) => p.id).sort();
  const without = poisNear(unindexed, HOAN_KIEM, 500).map((p) => p.id).sort();

  assert.deepEqual(withIndex, without);
});

test('đứng trong POI thật thì vùng lấy theo POI', () => {
  const info = locationAt(HOAN_KIEM, sampleHanoiPack());

  assert.equal(info.zone, 'water');
  assert.equal(info.procedural, false);
  assert.equal(info.insidePoi .nameVi, 'Hồ Gươm');
});

test('nơi không có gói dữ liệu vẫn chơi được nhờ vùng hoang dã 1,2× (§4.2)', () => {
  const middleOfNowhere = { lat: 15.1234, lon: 108.4321 };
  const info = locationAt(middleOfNowhere, null);

  assert.equal(info.zone, 'wilderness');
  assert.equal(info.procedural, true);
  assert.equal(info.pickupMultiplier, 1.2);
  assert.match(info.explanationVi, /hoang dã/);
});

test('scanArea trả cả POI thật lẫn cảnh vật thủ tục để renderer có gì mà vẽ', () => {
  const features = scanArea(HOAN_KIEM, 700, sampleHanoiPack());

  assert.ok(features.some((f) => f.kind === 'poi'));
  assert.ok(features.some((f) => f.kind === 'procedural'));
  assert.ok(features.every((f) => distanceMeters(HOAN_KIEM, f) <= 800));
});

test('scanArea không vẽ trùng ô đã có POI thật', () => {
  const features = scanArea(HOAN_KIEM, 700, sampleHanoiPack());
  const ids = features.map((f) => f.id);

  assert.equal(new Set(ids).size, ids.length);
});

test('buildPackIndex phủ hết mọi POI', () => {
  const pack = buildPackIndex({ ...sampleHanoiPack(), index: undefined });
  const indexed = Object.values(pack.index ).flat().length;

  assert.equal(indexed, pack.pois.length);
});

// ---------------------------------------------------------------- thời tiết

test('phân vùng khí hậu theo vĩ độ', () => {
  assert.equal(regionOf(21.03), 'north');
  assert.equal(regionOf(16.05), 'central');
  assert.equal(regionOf(10.78), 'south');
});

test('thời tiết xác định: cùng ngày cùng chỗ luôn ra cùng kết quả', () => {
  const a = weatherFor(HOAN_KIEM, T0);
  const b = weatherFor(HOAN_KIEM, T0 + 3_600_000);

  assert.equal(a.condition, b.condition);
  assert.equal(a.day, b.day);
});

test('sang ngày khác thì thời tiết đổi được', () => {
  const days = forecast(HOAN_KIEM, T0, 14);
  const conditions = new Set(days.map((d) => d.condition));

  assert.ok(conditions.size >= 2, 'dự báo 14 ngày mà chỉ có một kiểu thời tiết là sai');
});

test('mùa mưa miền Nam rõ rệt hơn mùa khô', () => {
  const saigon = { lat: 10.78, lon: 106.7 };
  const count = (monthIndex        ) => {
    let rainy = 0;
    for (let d = 1; d <= 28; d++) {
      const ms = Date.UTC(2026, monthIndex, d, 3, 0, 0);
      if (weatherFor(saigon, ms).raining) rainy++;
    }
    return rainy;
  };

  const september = count(8);
  const february = count(1);
  assert.ok(september > february * 2, `tháng 9: ${september} ngày mưa, tháng 2: ${february}`);
});

test('mưa cho nước tại trại và tăng thu hoạch rừng (§11: ngày mưa là ngày lợi thế)', () => {
  const rainy = { ...weatherFor(HOAN_KIEM, T0), raining: true, rainIntensity: 1, rainHours: 6 };
  const harvest = rainHarvest(rainy, 5, true);

  assert.ok(harvest.qty > 0);
  assert.ok(harvest.qty <= 20);
  assert.equal(modifiersOf(rainy).forestPickupBonus, 0.25);
});

test('nắng gắt làm khát nhanh hơn nhưng bù bằng tốc độ chế tạo trong nhà', () => {
  const hot = { ...weatherFor(HOAN_KIEM, T0), raining: false, hot: true, cold: false };
  const mods = modifiersOf(hot);

  assert.ok(mods.hydrationDecayMultiplier > 1);
  assert.ok(mods.craftSpeedBonus > 0);
});

// ---------------------------------------------------------------- đồng hồ và an toàn

test('lùi đồng hồ thì thời gian game đứng yên và sự kiện theo lịch bị khoá (§4.3)', () => {
  const state = createClockState(T0);
  const rollback = readClock(state, T0 - 6 * 3_600_000);

  assert.equal(rollback.rolledBack, true);
  assert.equal(rollback.nowMs, T0, 'thời gian game phải giữ nguyên mốc cũ');
  assert.equal(rollback.scheduledEventsLocked, true);
  assert.equal(rollback.survivalFrozen, true);
});

test('đồng hồ tiến bình thường thì không có gì bị khoá', () => {
  const reading = readClock(createClockState(T0), T0 + 3_600_000);

  assert.equal(reading.rolledBack, false);
  assert.equal(reading.nowMs, T0 + 3_600_000);
  assert.equal(reading.state.maxSeenMs, T0 + 3_600_000);
});

test('lệch nhỏ trong dung sai không bị coi là gian lận', () => {
  const reading = readClock(createClockState(T0), T0 - 30_000);
  assert.equal(reading.rolledBack, false);
});

test('đi bộ bình thường không bao giờ bị khoá tốc độ', () => {
  let state = createSpeedState();
  // ~5 km/h: 1,4 m mỗi giây, lấy mẫu mỗi 10 giây.
  for (let i = 0; i < 5; i++) {
    const result = checkSpeed(state, {
      at: { lat: 21.0287 + i * 0.000125, lon: 105.8524 },
      atMs: T0 + i * 10_000,
    });
    state = result.state;
    assert.equal(result.locked, false, `bị khoá ở mẫu ${i} với ${result.kmh.toFixed(1)} km/h`);
  }
});

test('đi xe máy thì khoá tương tác POI sau 2 mẫu liên tiếp (§6.1)', () => {
  let state = createSpeedState();
  let locked = false;

  for (let i = 0; i < 4; i++) {
    const result = checkSpeed(state, {
      at: { lat: 21.0287 + i * 0.0025, lon: 105.8524 },
      atMs: T0 + i * 10_000,
    });
    state = result.state;
    locked = result.locked;
  }

  assert.equal(locked, true);
});

test('chậm lại một mẫu là mở khoá ngay — thà mở nhầm sớm còn hơn giữ khoá người đi bộ', () => {
  let state = { ...createSpeedState(), consecutiveFast: 5, locked: true, last: { at: HOAN_KIEM, atMs: T0 } };
  const result = checkSpeed(state, { at: { lat: 21.0288, lon: 105.8524 }, atMs: T0 + 30_000 });

  assert.equal(result.locked, false);
});
