// Blank-value policy for the DA:ON 1P/7P MASTER (owner decision 2026-10-30):
//  1. the MASTER never prints a "확인 필요"-style placeholder for a missing value — it hides it;
//  2. before publishing (1P print/PDF, 7P confirm/print) the user is shown the blank fields and asked to enter them;
//  3. only an explicit "숨김 처리하고 계속" publishes, and the page keeps saying the blanks are hidden.
import { readFileSync } from 'node:fs';

import { importTs } from './lib/ts-module-loader.mjs';

const fail = (message) => { throw new Error(message); };
const blank = await importTs('src/domain/professionalReport/reportBlankFields.ts');
const { emptyProperty } = await importTs('src/types.ts');

// 1. Domain rules — 1P.
const empty = { ...emptyProperty, id: 'p-1', name: '빈 물건' };
const emptyKeys = blank.onePageBlankFields(empty).map((field) => field.key);
for (const key of ['salePrice', 'address', 'zoning', 'landCategory', 'occupancyStatus', 'roadCondition', 'investmentPoints', 'parkingField']) {
  if (!emptyKeys.includes(key)) fail(`빈 물건의 1P 공란 목록에 ${key}가 없습니다: ${emptyKeys.join(',')}`);
}
const full = {
  ...empty, salePrice: 3_000_000_000, address: '서울 마포구 동교로 212-22', mainUse: '근린생활시설', zoning: '제2종일반주거지역', landCategory: '대',
  completionDate: '1995-03-02', landAreaSqm: 140.8, landAreaPyeong: 42.59, totalFloorAreaSqm: 266, totalFloorAreaPyeong: 80.47, buildingAreaPyeong: 25,
  basementFloors: 1, groundFloors: 3, parkingOfficial: 2, parkingField: 3, occupancyStatus: '소유자 사용 중', roadCondition: '8m 도로 접면',
  nearbyStation: '홍대입구역', stationDistance: '도보 7분', locationAnalysis: '연남동 생활권', features: '코너', investmentPoints: '사옥 적합',
  recommendedUse: '사옥', developmentPlan: '리모델링 검토',
};
const fullFields = blank.onePageBlankFields(full);
if (fullFields.length) fail(`모든 값이 있는 물건에 공란이 보고되었습니다: ${fullFields.map((f) => f.key).join(',')}`);
// 0 parking is a real value (no parking), not a blank; whitespace-only text is blank.
if (blank.onePageBlankFields({ ...full, parkingOfficial: 0, parkingField: 0 }).some((f) => f.key.startsWith('parking'))) fail('주차 0대는 공란이 아닙니다.');
if (!blank.onePageBlankFields({ ...full, zoning: '   ' }).some((f) => f.key === 'zoning')) fail('공백만 있는 값은 공란이어야 합니다.');

// 2. Domain rules — 7P (view-model shape).
const rv = (value) => ({ value, display: value === null ? '미입력' : String(value), state: value === null ? 'missing' : 'verified', sourceIds: [] });
const nullModel = {
  identity: { address: rv(null) }, pricing: { salePrice: rv(null), landUnitPrice: rv(null), occupancyStatus: rv(null) },
  land: { landAreaSqm: rv(null), landAreaPyeong: rv(null), zoning: rv(null), roadCondition: rv(null) },
  building: { totalFloorAreaSqm: rv(null), totalFloorAreaPyeong: rv(null), buildingAreaPyeong: rv(null), structure: rv(null), mainUse: rv(null), completionDate: rv(null), buildingCoverageRate: rv(null), floorAreaRatio: rv(null), parkingOfficial: rv(null), parkingField: rv(null) },
  location: { locationAnalysis: rv(null) },
  investment: { investmentPoints: rv(null), features: rv(null), recommendedUse: rv(null), developmentPlan: rv(null), overallOpinion: rv(null) },
  risks: { risks: rv(null) },
};
const detailAll = blank.detailBlankFields(nullModel);
if (detailAll.length < 20) fail(`빈 7P 모델의 공란이 누락되었습니다: ${detailAll.length}`);
const filled = JSON.parse(JSON.stringify(nullModel), (key, value) => (value && typeof value === 'object' && 'state' in value ? rv('값') : value));
if (blank.detailBlankFields(filled).length) fail('모든 값이 있는 7P 모델에 공란이 보고되었습니다.');

// 3. Confirmation decision: ask while unacknowledged; acknowledgement is bound to the exact blank set.
// (Core fields are filled here; a blank core field can never be acknowledged — see section 7.)
const coreOnly = { ...empty, salePrice: 3_000_000_000, address: '서울 마포구 동교로 212-22', landAreaSqm: 140.8, landAreaPyeong: 42.59, totalFloorAreaSqm: 266, totalFloorAreaPyeong: 80.47, mainUse: '근린생활시설', zoning: '제2종일반주거지역', investmentPoints: '사옥 적합' };
const fields = blank.onePageBlankFields(coreOnly);
if (!fields.length || blank.requiredBlankFields(fields).length) fail('핵심 항목만 있는 물건은 선택 항목 공란만 있어야 합니다.');
if (!blank.needsBlankFieldConfirmation(fields, null)) fail('공란이 있으면 발행 전에 확인을 받아야 합니다.');
const signature = blank.blankFieldsSignature(fields);
if (blank.needsBlankFieldConfirmation(fields, signature)) fail('확인한 공란 집합은 다시 묻지 않아야 합니다.');
const changed = blank.onePageBlankFields({ ...coreOnly, landCategory: '대' });
if (!blank.needsBlankFieldConfirmation(changed, signature)) fail('공란 집합이 바뀌면 다시 확인해야 합니다.');
if (blank.needsBlankFieldConfirmation([], null)) fail('공란이 없으면 확인 없이 발행할 수 있어야 합니다.');
if (!/숨김 처리되어 발행/.test(blank.REPORT_BLANK_HIDE_NOTICE)) fail('숨김 발행 안내 문구가 없습니다.');

// 4. MASTER sources never print placeholder phrases (comments excluded).
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
for (const file of ['src/components/professionalReport/DaonOnePageMaster.tsx', 'src/components/professionalReport/DaonDetail7PageMaster.tsx']) {
  const code = stripComments(readFileSync(file, 'utf8'));
  const hit = code.match(new RegExp(`.{0,40}(${blank.REPORT_PLACEHOLDER_PATTERN.source}|미등록).{0,20}`));
  if (hit) fail(`${file}에 공란 placeholder 문구가 남아 있습니다: ${hit[0]}`);
}
const onePage = readFileSync('src/components/professionalReport/DaonOnePageMaster.tsx', 'utf8');
if (!onePage.includes("label=\"지목\" value={p.landCategory || ''}")) fail('1P 지목은 물건의 landCategory 값을 사용해야 합니다.');

// 5. Publish points ask first (1P print, 7P confirm + print) and show the hide notice.
const preview = readFileSync('src/pages/DocumentPreview.tsx', 'utf8');
for (const marker of ['onePageBlankFields(property)', 'onClick={requestPrint}', 'if (!blankAcknowledgedNow) { setBlankDialogOpen(true); return; }', '<ReportBlankFieldsNotice', 'setBlankAcknowledged(blankFieldsSignature(blankFields))']) {
  if (!preview.includes(marker)) fail(`1P 발행 전 공란 확인 누락: ${marker}`);
}
if (/onClick=\{\(\) => print\(\)\}/.test(preview)) fail('1P 인쇄 버튼이 공란 확인을 우회합니다.');
const snapshotPage = readFileSync('src/pages/ProfessionalReportSnapshotPage.tsx', 'utf8');
for (const marker of ['detailBlankFields(model)', "onClick={() => requestPublishAction('finalize')}", "onClick={() => requestPublishAction('print')}", 'if (!blankAcknowledgedNow) { setBlankPrompt(action); return; }', '<ReportBlankFieldsNotice']) {
  if (!snapshotPage.includes(marker)) fail(`7P 발행 전 공란 확인 누락: ${marker}`);
}
if (/onClick=\{markReady\}|onClick=\{\(\) => print\(\)\}/.test(snapshotPage)) fail('7P 확정/인쇄 버튼이 공란 확인을 우회합니다.');
const gate = readFileSync('src/components/professionalReport/ReportBlankFieldsGate.tsx', 'utf8');
for (const marker of ['값 입력하러 가기', "'숨김 처리하고 ' : '그대로 '}{actionLabel}", 'REPORT_BLANK_HIDE_NOTICE']) if (!gate.includes(marker)) fail(`공란 확인 대화상자 누락: ${marker}`);

// 6. Negative control: a gate that never asks must be detected.
const source = readFileSync('src/domain/professionalReport/reportBlankFields.ts', 'utf8');
const broken = source.replace('return fields.length > 0 && acknowledgedSignature !== blankFieldsSignature(fields);', 'return false;');
if (broken === source) fail('negative control이 실제 규칙을 변경하지 못했습니다.');

// 7. Mixed policy (owner decision 2026-10-31): core fields are cautioned (user chooses); no empty slots; thin 7P pages omitted.
const emptyFields = blank.onePageBlankFields(empty);
const requiredKeys = blank.requiredBlankFields(emptyFields).map((field) => field.key).sort();
if (JSON.stringify(requiredKeys) !== JSON.stringify([...blank.REQUIRED_REPORT_FIELD_KEYS].sort())) fail(`1P 필수 공란 오류: ${requiredKeys.join(',')}`);
if (!blank.needsBlankFieldConfirmation(emptyFields, null)) fail('필수 항목 공란은 발행 전에 반드시 팝업으로 알려야 합니다.');
if (blank.needsBlankFieldConfirmation(emptyFields, blank.blankFieldsSignature(emptyFields))) fail('주의사항을 확인하고 선택했으면 다시 막지 않아야 합니다(사용자 선택).');
if (JSON.stringify(blank.requiredBlankFields(detailAll).map((f) => f.key).sort()) !== JSON.stringify([...blank.REQUIRED_REPORT_FIELD_KEYS].sort())) fail('7P 필수 공란 오류');
if (!gate.includes('data-testid="report-required-fields"') || !gate.includes('주의사항 확인, ') || gate.includes('disabled={required.length > 0}')) fail('필수 공란은 주의 팝업으로 알리고 사용자가 선택하게 해야 합니다.');
const fill = await importTs('src/domain/professionalReport/reportLayoutFill.ts');
if (fill.equalColumns(3) !== 'repeat(3, 1fr)' || fill.equalColumns(0) !== 'none') fail('equalColumns 오류');
const thinPlan = fill.detailPagePlan(nullModel, false, 0);
if (JSON.stringify(thinPlan.pages.map((p) => p.id)) !== '[1,2,7]') fail(`내용 없는 7P는 1·2·7쪽만 남아야 합니다: ${thinPlan.pages.map((p) => p.id)}`);
if (JSON.stringify(thinPlan.pages.map((p) => p.number)) !== '[1,2,3]') fail('남은 페이지는 1부터 다시 번호를 매겨야 합니다.');
if (thinPlan.omitted.length !== 4 || !thinPlan.omitted.every((o) => o.reason.includes('필요'))) fail('생략 페이지와 사유 기록 오류');
const fullPlan = fill.detailPagePlan(filled, true, 3);
if (fullPlan.pages.length !== 7 || fullPlan.omitted.length) fail('자료가 충분하면 7쪽 모두 출력해야 합니다.');
const oneInput = fill.detailPagePlan({ ...nullModel, location: { locationAnalysis: rv('역세권') } }, false, 0);
if (oneInput.pages.some((p) => p.id === 3)) fail('입지 페이지는 실제 입력 2개 이상일 때만 출력합니다.');
const withMap = fill.detailPagePlan({ ...nullModel, location: { locationAnalysis: rv('역세권') } }, true, 0);
if (!withMap.pages.some((p) => p.id === 3)) fail('지도 + 입지 분석이면 입지 페이지를 출력해야 합니다.');
// Owner test 2026-11-11: the production sample had occupancy + one feature line (page 5) and coverage/FAR/approval date
// (page 6) but no use scenario or development plan, so both pages printed as fixed copy. They must now be omitted.
const sampleLike = JSON.parse(JSON.stringify(nullModel));
Object.assign(sampleLike.pricing, { occupancyStatus: rv('소유자 사옥·주택 / 잔금일 기준 전체 명도 협의'), landUnitPrice: rv(81_610_000) });
Object.assign(sampleLike.investment, { features: rv('지하 방음시설 음악·취미·모임 공간 활용') });
Object.assign(sampleLike.building, { buildingCoverageRate: rv(48.8), floorAreaRatio: rv(146.3), completionDate: rv('1978-07-31') });
const samplePlan = fill.detailPagePlan(sampleLike, false, 6);
if (JSON.stringify(samplePlan.pages.map((p) => p.id)) !== '[1,2,4,7]') fail(`서술 입력 없는 5·6쪽은 생략해야 합니다: ${samplePlan.pages.map((p) => p.id)}`);
const withPlan = fill.detailPagePlan({ ...sampleLike, investment: { ...sampleLike.investment, developmentPlan: rv('리노베이션 또는 신축 검토') } }, false, 6);
if (!withPlan.pages.some((p) => p.id === 5) || !withPlan.pages.some((p) => p.id === 6)) fail('개발 계획이 있으면 5·6쪽을 출력해야 합니다.');
if (fill.detailPagePlan(sampleLike, false, 6, true).pages.some((p) => p.id === 6) !== true) fail('본건 외관 사진이 있으면 6쪽을 출력해야 합니다.');
// Boundary (Luin review on PR #56): neighbourhood photos only must not keep page 6. The component passes Boolean(hero)
// (main/exterior photo of the property), never the general photo list.
if (fill.detailPagePlan(sampleLike, false, 6, false).pages.some((p) => p.id === 6)) fail('본건 사진 없이 주변 사진·건물 지표만으로 6쪽을 출력하면 안 됩니다.');
{ const src = readFileSync('src/components/professionalReport/DaonDetail7PageMaster.tsx', 'utf8');
  if (!src.includes('detailPagePlan(model, Boolean(map), comparables.length, Boolean(hero))') || /detailPagePlan\([^)]*hasPhotos/.test(src)) fail('6쪽 생략 판단에는 본건 외관 사진(hero)만 전달해야 합니다.'); }
for (const marker of ["dd-p1-top${hero ? '' : ' no-photo'}", "dd-location-grid${map ? '' : ' no-map'}", '{scenarios.length > 0 && <SectionBar', '{points.length > 0 && <SectionBar right="KEY POINTS">']) if (!readFileSync('src/components/professionalReport/DaonDetail7PageMaster.tsx', 'utf8').includes(marker)) fail(`빈 사진·지도·제목 숨김 누락: ${marker}`);
for (const file of ['src/components/professionalReport/DaonOnePageMaster.tsx', 'src/components/professionalReport/DaonDetail7PageMaster.tsx']) {
  const code = stripComments(readFileSync(file, 'utf8'));
  if (code.includes('aria-hidden="true" />')) fail(`${file}: 빈 자리 채움용 빈 칸(aria-hidden)이 남아 있습니다.`);
}
const detailSource = readFileSync('src/components/professionalReport/DaonDetail7PageMaster.tsx', 'utf8');
for (const marker of ['detailPagePlan(model', 'shows(3) &&', 'shows(6) &&', 'number={pageNumber(7)}']) if (!detailSource.includes(marker)) fail(`7P 페이지 생략 연결 누락: ${marker}`);

// 8. Price layers view (owner decisions 2026-11-01/02): present cells only, honest labels, broker figure overrides estimate.
const pv = await importTs('src/domain/professionalReport/priceLayerView.ts');
const est = { state: 'estimated', method: 'm', note: 'n', computedAt: 't', comparableCount: 5, low: 3021459221, mid: 4019268503, high: 5729742663, unitLow: 70939914, unitMid: 94367172, unitHigh: 134526870 };
const base8 = { salePrice: 3_000_000_000, landAreaPyeong: 42.59, estimatedOfficialLandValue: 1_125_273_600, officialLandPriceYear: '2026' };
const four = pv.priceLayerCells(base8, est);
if (JSON.stringify(four.map((c) => c.key)) !== '["asking","official","market","achievable"]') fail(`가격 4단계 순서 오류: ${four.map((c) => c.key)}`);
if (four[0].value !== '30억원' || four[1].value !== '약 11.3억원' || four[2].value !== '평당 9,437만원' || four[3].value !== '30.2억~57.3억원') fail(`가격 표기 오류: ${four.map((c) => c.value).join(' | ')}`);
// Units (루인 review on #43): ③ is a land unit price, ①②④ are totals; raw amounts kept for exact-value checks.
if (JSON.stringify(four.map((c) => c.unit)) !== '["total","total","per_pyeong","total"]') fail(`가격 단위 구분 오류: ${four.map((c) => c.unit)}`);
if (four[0].amount !== 3_000_000_000 || four[2].amount !== 94367172 || JSON.stringify(four[3].amount) !== JSON.stringify([3021459221, 5729742663])) fail('가격 원값(amount) 보존 오류');
if (!four[2].sub.includes('총액 아님')) fail('단가 칸은 총액이 아님을 표시해야 합니다.');
// Exact entered amount vs rounded calculated amount.
if (pv.formatExactWon(4_150_000_000) !== '41억 5,000만원' || pv.formatExactWon(4_100_000_000) !== '41억원' || pv.formatExactWon(98_000_000) !== '9,800만원' || pv.formatExactWon(1_234_567_890) !== '12억 3,456만 7,890원' || pv.formatExactWon(50_000) !== '5만원' || pv.formatExactWon(100_000_000) !== '1억원') fail('정확 금액 표기 오류');
if (pv.priceLayerCells({ salePrice: 4_155_000_000 }, null)[0].value !== '41억 5,500만원') fail('매도 희망가는 반올림 없이 만원 단위 전체 금액');
if (pv.formatEok(99_995_000) !== '1억' || pv.formatEok(99_994_999) !== '9,999만' || pv.formatEok(1_000_000_000) !== '10억' || pv.formatEok(12_345_678_901) !== '123억' || pv.formatEok(1_234_567_890) !== '12.3억' || pv.formatEok(123_456_789) !== '1.23억') fail(`추정·계산값 반올림 경계 오류: ${[99_995_000, 99_994_999, 1e9, 12_345_678_901, 1_234_567_890, 123_456_789].map(pv.formatEok).join(' | ')}`);
// A broker figure without a written basis is not shown as "확정".
const noBasis = pv.priceLayerCells({ ...base8, brokerAchievablePrice: 3_800_000_000 }, est)[3];
if (noBasis.state !== 'entered' || noBasis.badge.includes('확정') || !noBasis.badge.includes('근거 미입력')) fail(`근거 없는 중개사 가격은 확정으로 표시하면 안 됩니다: ${noBasis.badge}`);
const withBasis = pv.priceLayerCells({ ...base8, brokerAchievablePrice: 3_800_000_000, brokerAchievablePriceRationale: '인근 2건 매수 문의', brokerAchievablePriceConfirmedAt: '2026-11-06T01:00:00Z' }, est)[3];
if (withBasis.state !== 'confirmed' || !withBasis.badge.startsWith('중개사 확정 2026-11-06')) fail(`근거·확정일이 있으면 확정 표시: ${withBasis.badge}`);
// Confirmation date is the Korean calendar date (UTC 2026-11-05T16:00Z = KST 2026-11-06 01:00).
if (pv.koreaDate('2026-11-05T16:00:00Z') !== '2026-11-06' || pv.koreaDate('2026-11-05T14:59:59Z') !== '2026-11-05' || pv.koreaDate('') !== '' || pv.koreaDate('not-a-date') !== '') fail('확정일은 한국 날짜로 표시해야 합니다.');
// 1P (whole Property) and 7P (report model) must carry the same confirmation date (루인 review on #43).
const builderSrc = readFileSync('src/services/reportEngine/reportDataBuilder.ts', 'utf8');
if (!builderSrc.includes("brokerAchievablePriceConfirmedAt: text('brokerAchievablePriceConfirmedAt')") || !readFileSync('src/components/professionalReport/DaonDetail7PageMaster.tsx', 'utf8').includes('brokerAchievablePriceConfirmedAt: model.pricing.brokerAchievablePriceConfirmedAt')) fail('7P 가격 칸에 중개사 확정일이 전달되지 않습니다(1P와 불일치).');
if (!pv.PRICE_ESTIMATE_METHOD_NOTE.includes('5건 이상') || pv.PRICE_ESTIMATE_METHOD_NOTE.includes('공인중개사의 가격 의견')) fail('산출 방법 문구가 서버 산식과 다릅니다.');
if (!four[1].badge.includes('감정평가 아님') || !four[3].badge.includes('감정평가 아님')) fail('공시지가·추정은 감정평가 아님 표시');
const confirmed = pv.priceLayerCells({ ...base8, brokerAchievablePrice: 3_800_000_000, brokerAchievablePriceRationale: '근거' }, est);
if (confirmed[3].state !== 'confirmed' || confirmed[3].value !== '38억원' || !confirmed[3].sub.includes('30.2억~57.3억')) fail('중개사 확정가가 추정보다 우선하고 추정 범위를 함께 보여야 합니다.');
if (pv.priceLayerCells({ salePrice: 3_000_000_000 }, null).length !== 1) fail('없는 단계는 숨김(빈 칸 없음)');
if (pv.priceLayerCells(base8, { ...est, state: 'insufficient', low: undefined, mid: undefined, high: undefined, unitMid: undefined }).length !== 2) fail('비교거래 부족이면 시세·추정 칸 숨김');
if (!pv.askingPosition(3_000_000_000, est).includes('낮습니다')) fail('희망가 위치 해석 오류');
const srcs = [{ id: 'achievable-price:p1', propertyId: 'p1', metadata: { estimate: est } }, { id: 'achievable-price:p2', propertyId: 'p2', metadata: { estimate: { ...est, mid: 1 } } }];
if (pv.findPriceEstimate(srcs, 'p1')?.mid !== est.mid || pv.findPriceEstimate(srcs, 'p3') !== null) fail('물건별 추정 출처 조회 오류');
const one8 = readFileSync('src/components/professionalReport/DaonOnePageMaster.tsx', 'utf8');
const seven8 = readFileSync('src/components/professionalReport/DaonDetail7PageMaster.tsx', 'utf8');
if (!one8.includes('priceLayerCells(p, priceEstimate)') || !one8.includes('data-testid="d1-price-layers"')) fail('1P 가격띠가 가격 4단계를 쓰지 않습니다.');
if (!seven8.includes('data-testid="dd-price-layers"') || !seven8.includes('PRICE_ESTIMATE_METHOD_NOTE')) fail('7P 4쪽 가격 4단계·산출 방법 누락');
if (!seven8.includes('data-page-number={String(number)')) fail('7P 큰 페이지 번호가 출력 번호를 따르지 않습니다.');
const refinement = readFileSync('src/daon-master-refinement.css', 'utf8');
if (!refinement.includes('.daon-detail-page .dd-head[data-page-number]:before{content:attr(data-page-number)}')) fail('7P 페이지 번호 배지 CSS 누락');
// 1P short labels / length warning (owner decision 2026-11-04, Luin review on PR #46): originals are never shortened.
const longText = '현재 소유자 직접 사용 중이며 잔금일 기준 전체 명도 협의가 가능합니다';
const longWarn = blank.onePageLengthWarnings({ ...full, occupancyStatus: longText, shortOccupancyLabel: '' });
if (!longWarn.some((f) => f.key === 'shortOccupancyLabel' && f.tooLong)) fail('긴 명도 문구는 발행 전 길이 경고를 내야 합니다.');
if (blank.onePageLengthWarnings({ ...full, occupancyStatus: longText, shortOccupancyLabel: '전체 명도 협의 가능' }).some((f) => f.key === 'shortOccupancyLabel')) fail('짧은 표시 문구가 있으면 길이 경고가 없어야 합니다.');
if (blank.onePageLengthWarnings({ ...full, occupancyStatus: '전체 명도 불가' }).length && blank.onePageLengthWarnings({ ...full, occupancyStatus: '전체 명도 불가' }).some((f) => f.key === 'shortOccupancyLabel')) fail('짧은 원문에는 길이 경고가 없어야 합니다.');
const onePageSource = readFileSync('src/components/professionalReport/DaonOnePageMaster.tsx', 'utf8');
for (const marker of ['p.shortOccupancyLabel', 'p.shortRoadLabel', 'p.shortUseLabel', 'p.shortDevelopmentLabel']) if (!onePageSource.includes(marker)) fail(`1P 짧은 표시 문구 연결 누락: ${marker}`);
if (!readFileSync('src/pages/DocumentPreview.tsx', 'utf8').includes('onePageLengthWarnings(property)')) fail('1P 발행 전 길이 경고 연결 누락');

// Luin review 2026-11-04 (re-review): negated / uncertain road or owner text must never become a positive label.
const detailTitleSource = readFileSync('src/components/professionalReport/DaonDetail7PageMaster.tsx', 'utf8');
// 7P titles must not infer a corner from free text, incl. '코너 · 여부 미확인', '코너로 보기 어렵다', '코너; 앞 문구는 오기'.
if (/isCorner|statesPlainly|includes\('코너'\)|'보이는 코너'|'가시성 높은 코너 입지'|'코너 대지의 존재감'/.test(detailTitleSource)) fail('7P 제목은 자유 문장에서 코너를 추론하면 안 됩니다(중립 제목 고정).');
if (/key="owner"/.test(onePageSource)) fail('1P는 명도 원문에서 "소유자 직접 사용" 배지를 추론하면 안 됩니다.');
if (/'코너 입지'/.test(onePageSource)) fail('1P 도로 칩은 원문 또는 짧은 표시 문구만 사용해야 합니다.');

// Report purpose (owner decision 2026-11-05): analysis reports never print the exclusive-sale wording.
const purpose = await importTs('src/domain/professionalReport/reportPurpose.ts');
if (purpose.reportWording('analysis').titlePrefix.includes('전속') || purpose.reportWording('analysis').pageTag.includes('EXCLUSIVE')) fail('분석 보고서에 전속매각 문구가 남아 있습니다.');
if (purpose.reportWording(undefined).titlePrefix !== '전속매각') fail('보고서 종류 기본값은 전속매각이어야 합니다.');
for (const file of ['src/components/professionalReport/DaonOnePageMaster.tsx', 'src/components/professionalReport/DaonDetail7PageMaster.tsx', 'src/components/professionalReport/DaonReportOpeningPage.tsx']) {
  const code = readFileSync(file, 'utf8');
  if (/>\s*전속매각|EXCLUSIVE SALE|전속매각 문의/.test(code.replace(/\/\*[\s\S]*?\*\//g, ''))) fail(`${file}: 전속매각 문구는 reportWording으로만 출력해야 합니다.`);
}

console.log(`Report blank-field policy validation passed (1P blank fields for empty property: ${fields.length}, 7P: ${detailAll.length}).`);
