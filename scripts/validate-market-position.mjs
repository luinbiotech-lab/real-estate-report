// 시세 위치 (property screen market position, 2026-11-13) — executable regression checks.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importTs } from './lib/ts-module-loader.mjs';

const mp = await importTs('src/domain/propertyDetail/marketPosition.ts');
const ds = (propertyId, rows, verificationStatus = 'imported') => ({ propertyId, resourceType: 'comparable_transaction_set', fieldKey: 'nearbyTransactions', verificationStatus, metadata: { rows } });
const row = (label, tradeDate, landUnitPrice) => ({ label, tradeDate, landUnitPrice, salePrice: landUnitPrice * 50, landAreaPyeong: 50 });
const subject = { id: 'p-1', salePrice: 6_000_000_000, landAreaPyeong: 100 }; // 6,000만/평 계산값

// 1. Property-scoped, invalid rows dropped (no 0 / bad date), sorted by date.
const sources = [
  ds('other', [row('남의 사례', '2026-01-01', 1)]),
  ds('p-1', [row('C', '2026-03-01', 70_000_000), row('A', '2025-06-01', 50_000_000), { label: 'bad-date', tradeDate: '2026/01/01', landUnitPrice: 1 }, { label: 'zero', tradeDate: '2026-01-01', landUnitPrice: 0 }, null, row('B', '2025-12-01', 55_000_000)]),
];
const pos = mp.marketPosition(subject, sources);
assert.deepEqual(pos.points.map((p) => p.label), ['A', 'B', 'C'], 'only this Property\'s valid rows, by trade date');
assert.equal(pos.median, 55_000_000);
assert.equal(pos.min, 50_000_000); assert.equal(pos.max, 70_000_000);
assert.equal(pos.subjectUnitPrice, 60_000_000);
assert.equal(pos.deltaPct, 9.1);
assert.equal(pos.band, 'within');
assert.match(pos.headline, /대상 6,000만\/평 · 비교 중앙값 대비 \+9.1% · 비교거래 범위 안/);
assert.ok(pos.basis.some((line) => /호가.*계산값.*실거래가가 아닙니다/.test(line)), 'subject value is labelled as an asking-price calculation');
assert.ok(pos.basis.some((line) => /동일 건물 거래로 확정하지 않습니다/.test(line)), 'comparables stay candidates');
assert.equal(mp.medianOf([1, 3, 2, 4]), 2.5);

// 1b. Impossible calendar dates are dropped before stats/table/chart (루인 #60 BLOCKING).
for (const bad of ['2026-13-01', '2026-02-30', '2025-02-29', '2026-00-10', '2026-04-31']) assert.equal(mp.isCalendarDate(bad), false, bad);
for (const good of ['2024-02-29', '2026-12-31', '2026-01-01']) assert.equal(mp.isCalendarDate(good), true, good);
const mixedDates = mp.marketPosition(subject, [ds('p-1', [row('A', '2025-06-01', 50_000_000), row('BAD-MONTH', '2026-13-01', 99_000_000), row('BAD-DAY', '2026-02-30', 10_000_000), row('C', '2026-03-01', 70_000_000)])]);
assert.deepEqual(mixedDates.points.map((p) => p.label), ['A', 'C'], 'invalid calendar dates never enter the sample');
assert.equal(mixedDates.latestTradeDate, '2026-03-01');
assert.equal(mixedDates.max, 70_000_000); assert.equal(mixedDates.min, 50_000_000);
assert.ok(mixedDates.points.every((p) => Number.isFinite(Date.parse(p.tradeDate))), 'every chart point has a finite x position');

// 2. Missing inputs never become 0 or a fake position.
const noPrice = mp.marketPosition({ id: 'p-1', landAreaPyeong: 100 }, sources);
assert.equal(noPrice.subjectUnitPrice, null); assert.equal(noPrice.deltaPct, null); assert.equal(noPrice.band, 'unknown');
assert.match(noPrice.headline, /계산 불가/);
const none = mp.marketPosition(subject, [ds('other', [row('x', '2026-01-01', 1)])]);
assert.equal(none.count, 0); assert.equal(none.band, 'unknown'); assert.match(none.headline, /비교거래 미연결/);
assert.equal(mp.marketPosition({ ...subject, salePrice: 9_000_000_000 }, sources).band, 'above');
assert.equal(mp.marketPosition({ ...subject, salePrice: 1_000_000_000 }, sources).band, 'below');
const thin = mp.marketPosition(subject, [ds('p-1', [row('A', '2025-06-01', 50_000_000)])]);
assert.ok(thin.basis.some((line) => /표본이 적어/.test(line)), 'small sample warning');

// 3. Page wiring: panel on summary (compact) and market tab, hidden when the last reload failed.
const page = readFileSync('src/pages/PropertyDataRoomPage.tsx', 'utf8');
for (const marker of ["freshness === 'current'", '<MarketPositionPanel', '{marketPanel(true)}', '{marketPanel(false)}', '자료 상태 확인 불가 — 시세 위치를 표시하지 않습니다']) {
  assert.ok(page.includes(marker), `PropertyDataRoomPage marker missing: ${marker}`);
}
const panel = readFileSync('src/components/propertyScreen/MarketPositionPanel.tsx', 'utf8');
for (const marker of ['aria-label="시세 위치"', '대상 평당가 <small>계산값</small>', 'aria-label="비교거래 목록"', '<title>']) {
  assert.ok(panel.includes(marker), `MarketPositionPanel marker missing: ${marker}`);
}
console.log('PASS market position: scoped rows, median/delta/band, missing-input fail-closed, candidate/asking-price labels, page wiring');
