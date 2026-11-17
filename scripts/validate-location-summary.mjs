// 입지 · 주변 panel contract (2026-11-13): no guessed coordinates, entered vs POI-candidate labels, no tenancy claims.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importTs } from './lib/ts-module-loader.mjs';

const loc = await importTs('src/domain/propertyDetail/locationSummary.ts');

// Coordinates: only stored values inside Korea are used.
assert.equal(loc.validCoordinates(37.48, 126.99), true);
for (const [lat, lng] of [[0, 0], [undefined, 127], [37.5, null], [51.5, -0.12], [NaN, 127], ['37.5', '127']]) assert.equal(loc.validCoordinates(lat, lng), false, `${lat},${lng}`);

// Distances.
assert.equal(loc.formatDistance(420.4), '420m');
assert.equal(loc.formatDistance(1530), '1.5km');
assert.equal(loc.formatDistance(undefined), '');
assert.equal(loc.formatDistance(-5), '');

// Grouping: fixed category order, nearest first, missing distance last, blank names dropped, source labels kept.
const items = [
  { category: 'food', name: '카페 B', description: '', source: 'kakao', distanceMeters: 300 },
  { category: 'food', name: '카페 A', description: '', source: 'kakao', distanceMeters: 120 },
  { category: 'food', name: '식당 C', description: '', source: 'manual' },
  { category: 'transport', name: '방배역', description: '', source: 'manual', distanceMeters: 450 },
  { category: 'food', name: '  ', description: '', source: 'kakao', distanceMeters: 10 },
  { category: 'unknown', name: '기타 시설', description: '' },
];
const groups = loc.groupNearby(items);
assert.deepEqual(groups.map((g) => g.category), ['transport', 'food', 'other']);
assert.deepEqual(groups[1].items.map((i) => i.name), ['카페 A', '카페 B', '식당 C']);
assert.equal(groups[1].count, 3);
assert.equal(groups[1].items[0].sourceLabel, '카카오 POI 후보');
assert.equal(groups[1].items[2].sourceLabel, '직접 입력');
assert.equal(loc.groupNearby(items, 2)[1].items.length, 2);

// Summary.
const none = loc.locationSummary({ latitude: undefined, longitude: undefined, nearbyStation: '', stationDistance: '', briefingItems: [] });
assert.equal(none.coordinates, null);
assert.equal(none.station, null);
assert.match(none.headline, /^좌표 미저장 · 인근역 미입력 · 주변 시설 미연결$/);
assert.ok(none.basis.some((line) => line.includes('추정 위치 사용 안 함')));
const full = loc.locationSummary({ latitude: 37.4812, longitude: 126.9935, nearbyStation: '방배역', stationDistance: '도보 6분', briefingItems: items });
assert.deepEqual(full.coordinates, { latitude: 37.4812, longitude: 126.9935 });
assert.equal(full.headline, '방배역 도보 6분 · 주변 시설 5곳');
assert.equal(full.kakaoCount, 2);
assert.ok(full.basis.some((line) => line.includes('입력값')));
assert.ok(full.basis.some((line) => line.includes('임차·영업을 확정하지 않습니다')));
const outside = loc.locationSummary({ latitude: 51.5, longitude: -0.12, nearbyStation: '', stationDistance: '', briefingItems: null });
assert.equal(outside.coordinates, null);

// UI contract: wired on the summary tab; live search is labelled unsaved; 로드뷰 is labelled as a reference, not a site photo.
const panel = readFileSync('src/components/propertyScreen/LocationPanel.tsx', 'utf8');
for (const marker of ['aria-label="입지 · 주변"', '저장 안 됨', '현장 사진이 아닌 참고 화면', 'mergePoiIntoBriefing(property, found)', "getProvider('kakao')", 'summary.coordinates && roadviewKey']) assert.ok(panel.includes(marker), `LocationPanel marker missing: ${marker}`);
const page = readFileSync('src/pages/PropertyDataRoomPage.tsx', 'utf8');
assert.ok(/tab === 'summary' && <>.*<LocationPanel property=\{property\}/.test(page), '요약 탭에 입지 · 주변 패널이 있어야 합니다.');

console.log('Location summary validation passed.');
