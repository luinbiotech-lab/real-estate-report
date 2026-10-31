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
const coreOnly = { ...empty, salePrice: 3_000_000_000, address: '서울 마포구 동교로 212-22', landAreaSqm: 140.8, landAreaPyeong: 42.59, totalFloorAreaSqm: 266, totalFloorAreaPyeong: 80.47, mainUse: '근린생활시설', zoning: '제2종일반주거지역' };
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
for (const marker of ['값 입력하러 가기', '숨김 처리하고 {actionLabel}', 'REPORT_BLANK_HIDE_NOTICE']) if (!gate.includes(marker)) fail(`공란 확인 대화상자 누락: ${marker}`);

// 6. Negative control: a gate that never asks must be detected.
const source = readFileSync('src/domain/professionalReport/reportBlankFields.ts', 'utf8');
const broken = source.replace('return fields.length > 0 && acknowledgedSignature !== blankFieldsSignature(fields);', 'return false;');
if (broken === source) fail('negative control이 실제 규칙을 변경하지 못했습니다.');

// 7. Mixed policy (owner decision 2026-10-31): core fields cannot be hidden; no empty slots; thin 7P pages omitted.
const emptyFields = blank.onePageBlankFields(empty);
const requiredKeys = blank.requiredBlankFields(emptyFields).map((field) => field.key).sort();
if (JSON.stringify(requiredKeys) !== JSON.stringify([...blank.REQUIRED_REPORT_FIELD_KEYS].sort())) fail(`1P 필수 공란 오류: ${requiredKeys.join(',')}`);
if (!blank.needsBlankFieldConfirmation(emptyFields, blank.blankFieldsSignature(emptyFields))) fail('필수 항목 공란은 확인(숨김)으로 넘어갈 수 없습니다.');
if (JSON.stringify(blank.requiredBlankFields(detailAll).map((f) => f.key).sort()) !== JSON.stringify([...blank.REQUIRED_REPORT_FIELD_KEYS].sort())) fail('7P 필수 공란 오류');
if (gate.indexOf('disabled={required.length > 0}') < 0) fail('필수 공란이 있으면 "숨김 처리하고 계속"이 비활성이어야 합니다.');
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
for (const file of ['src/components/professionalReport/DaonOnePageMaster.tsx', 'src/components/professionalReport/DaonDetail7PageMaster.tsx']) {
  const code = stripComments(readFileSync(file, 'utf8'));
  if (code.includes('aria-hidden="true" />')) fail(`${file}: 빈 자리 채움용 빈 칸(aria-hidden)이 남아 있습니다.`);
}
const detailSource = readFileSync('src/components/professionalReport/DaonDetail7PageMaster.tsx', 'utf8');
for (const marker of ['detailPagePlan(model', 'shows(3) &&', 'shows(6) &&', 'number={pageNumber(7)}']) if (!detailSource.includes(marker)) fail(`7P 페이지 생략 연결 누락: ${marker}`);

console.log(`Report blank-field policy validation passed (1P blank fields for empty property: ${fields.length}, 7P: ${detailAll.length}).`);
