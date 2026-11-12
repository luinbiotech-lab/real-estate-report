// Home 지역 필터 + 지도 핀 (2026-11-13) — executable regression checks.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importTs } from './lib/ts-module-loader.mjs';

const m = await importTs('src/domain/propertyDetail/portfolioMap.ts');
assert.equal(m.regionOf({ address: '서울 서초구 방배동 815-11' }), '서초구');
assert.equal(m.regionOf({ address: '경기도 성남시 분당구 정자동 1' }), '분당구');
assert.equal(m.regionOf({ address: '경기도 화성시 동탄' }), '화성시');
assert.equal(m.regionOf({ address: '' }), m.UNKNOWN_REGION, 'no address → 지역 미확인, never guessed');
assert.equal(m.regionOf({ address: '서울특별시' }), m.UNKNOWN_REGION);
const counts = m.regionCounts([{ address: '' }, { address: '서울 강남구 역삼동' }, { address: '서울 서초구 방배동' }, { address: '서울 서초구 서초동' }]);
assert.deepEqual(counts.map((c) => `${c.region}:${c.count}`), ['서초구:2', '강남구:1', `${m.UNKNOWN_REGION}:1`], 'by count, 지역 미확인 last');

const p = (id, latitude, longitude) => ({ id, name: `<b>${id}`, latitude, longitude, salePrice: 1 });
const { pins, missing } = m.mapPins([p('a', 37.48, 126.99), p('b', undefined, undefined), p('c', 0, 0), p('d', 37.5, Number.NaN), p('e', 35.1, 129.0)], () => '1억');
assert.deepEqual(pins.map((pin) => pin.id), ['a', 'e'], 'only real in-Korea coordinates become pins');
assert.equal(missing, 3, '0/NaN/missing coordinates are counted as 좌표 없음, not placed');
assert.equal(m.escapeHtml('<b>"x" & \'y\''), '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;');

const page = readFileSync('src/pages/PropertyList.tsx', 'utf8');
for (const marker of ['aria-label="지역"', "region === '전체' || regionOf(property) === region", 'portfolioMapAvailable()', '<PortfolioMapPanel', 'mapPins(filtered']) {
  assert.ok(page.includes(marker), `PropertyList marker missing: ${marker}`);
}
const panel = readFileSync('src/components/PortfolioMapPanel.tsx', 'utf8');
assert.ok(panel.includes('escapeHtml(pin.name)') && panel.includes('escapeHtml(pin.priceLabel)'), 'overlay text must be escaped');
assert.ok(panel.includes('Boolean(getKakaoJavascriptKey())'), 'map is gated on a configured key (no empty map box)');
console.log('PASS portfolio map: region parsing/counts, coordinate-gated pins, escaping, key gate, home wiring');
