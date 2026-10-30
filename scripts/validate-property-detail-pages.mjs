// Property detail pages (/property/:id hub, /property/:id/edit form) — executable regression checks (2026-10-30).
import { readFileSync } from 'node:fs';
import { importTs } from './lib/ts-module-loader.mjs';

const model = await importTs('src/domain/propertyDetail/propertyDetailModel.ts');
const fail = (message) => { throw new Error(message); };

// 1. Hub hero image follows the report privacy rule and the active Property.
const bangbae = { id: 'sample-bangbae-815-11', name: '방배동 815-11', address: '서울 서초구 방배동 815-11', detailAddress: '' };
const ordinary = { id: 'p-1', name: '일반 물건', address: '서울 성동구 성수동', detailAddress: '' };
const m = (id, propertyId, category, extra = {}) => ({ id, propertyId, mediaType: 'image', category, url: `https://x/${id}.jpg`, isPrimary: false, verificationStatus: 'imported', ...extra });
const media = [
  m('bb-interior-primary', bangbae.id, 'interior', { isPrimary: true }),
  m('bb-other', bangbae.id, 'other'),
  m('bb-360', bangbae.id, '360'),
  m('bb-exterior', bangbae.id, 'exterior'),
  m('p1-interior-primary', ordinary.id, 'interior', { isPrimary: true }),
  m('p1-exterior', ordinary.id, 'exterior'),
  m('p1-video', ordinary.id, 'exterior', { mediaType: 'video', isPrimary: true }),
  m('p1-nourl', ordinary.id, 'exterior', { url: '', isPrimary: true }),
];
if (model.selectHubHeroMedia(media, bangbae)?.id !== 'bb-exterior') fail('방배동 대표 이미지는 외관으로 분류된 사진만 허용해야 합니다(내부·미분류·360 금지).');
if (model.selectHubHeroMedia(media.filter((x) => x.id !== 'bb-exterior'), bangbae) !== undefined) fail('방배동에 외관 사진이 없으면 대표 이미지를 비워야 합니다(내부/미분류 대체 금지).');
if (model.selectHubHeroMedia(media, { ...ordinary, internalPhotoAllowed: true })?.id !== 'p1-interior-primary') fail('내부사진 허용 물건은 대표(isPrimary) 이미지를 우선해야 합니다.');
if (model.selectHubHeroMedia(media, { ...ordinary, internalPhotoAllowed: false })?.id !== 'p1-exterior') fail('internalPhotoAllowed=false 물건도 내부 대표사진을 쓰면 안 됩니다.');
if (model.selectHubHeroMedia(media.filter((x) => x.propertyId === bangbae.id), ordinary) !== undefined) fail('다른 물건의 미디어를 대표 이미지로 쓰면 안 됩니다.');

// 2. Comparable summary is Property-scoped and never turns missing prices into 0.
const ds = (propertyId, rows) => ({ propertyId, resourceType: 'comparable_transaction_set', fieldKey: 'nearbyTransactions', verificationStatus: 'imported', metadata: { rows } });
const mixed = { dataSources: [ds('other', [{ landUnitPrice: 1 }]), ds(ordinary.id, [{ landUnitPrice: 30_000_000 }, { landUnitPrice: 'x' }, null, { landUnitPrice: -5 }, { landUnitPrice: 45_000_000 }])] };
const summary = model.summarizeComparables(mixed, ordinary.id);
if (summary.count !== 5 || summary.pricedCount !== 2 || summary.min !== 30_000_000 || summary.max !== 45_000_000) fail(`비교거래 요약 오류: ${JSON.stringify(summary)}`);
if (model.summarizeComparables({ dataSources: [ds('other', [{ landUnitPrice: 1 }])] }, ordinary.id).count !== 0) fail('다른 물건의 비교거래를 요약하면 안 됩니다.');
for (const [value, expected] of [[0, '-'], [-1, '-'], [Number.NaN, '-'], [30_000_000, '3,000만/평']]) if (model.formatUnitPricePerPyeong(value) !== expected) fail(`단가 표시 오류: ${value}`);

// 3. Edit form never mints a new id for an existing property (duplicate-record defect).
const draft = { id: '', name: 'n', briefingItems: [], createdAt: '', briefingUpdatedAt: '' };
let minted = 0;
const newId = () => { minted += 1; return 'minted-id'; };
for (const state of ['loading', 'not_found', 'error']) {
  try { model.buildPropertyToSave(draft, 'p-1', state, 'T', newId); fail(`편집 상태 ${state}에서 저장이 허용되었습니다.`); } catch (error) { if (String(error.message).includes('저장이 허용')) throw error; }
}
try { model.buildPropertyToSave({ ...draft, id: 'p-2' }, 'p-1', 'ready', 'T', newId); fail('다른 물건 ID로 편집 저장이 허용되었습니다.'); } catch (error) { if (String(error.message).includes('허용되었습니다')) throw error; }
const edited = model.buildPropertyToSave({ ...draft, id: 'p-1', createdAt: '2026-01-01' }, 'p-1', 'ready', 'T', newId);
if (edited.id !== 'p-1' || edited.createdAt !== '2026-01-01' || edited.updatedAt !== 'T' || minted !== 0) fail('편집 저장은 기존 ID·생성일을 유지하고 새 ID를 만들면 안 됩니다.');
const created = model.buildPropertyToSave(draft, undefined, 'new', 'T', newId);
if (created.id !== 'minted-id' || created.createdAt !== 'T' || minted !== 1) fail('신규 저장은 새 ID와 생성일을 부여해야 합니다.');

// 4. Number inputs.
for (const [raw, expected] of [['', 0], [' 12.5 ', 12.5], ['0', 0], ['-3', undefined], ['abc', undefined], ['Infinity', undefined]]) {
  if (model.parseNonNegativeNumberInput(raw) !== expected) fail(`숫자 입력 처리 오류: "${raw}"`);
}

// 5. Wiring in the pages.
const hub = readFileSync('src/pages/PropertyHubPage.tsx', 'utf8');
for (const marker of ['let cancelled = false', 'return () => { cancelled = true; };', 'scopeDataRoomBundle(loaded, id)', 'selectHubHeroMedia(bundle.media, property)', 'setBundle(emptyBundle)', 'item.id !== id']) if (!hub.includes(marker)) fail(`물건 상세 허브 계약 누락: ${marker}`);
if (/<main[\s>]/.test(hub)) fail('물건 상세 허브는 Layout의 <main> 안에 또 <main>을 두면 안 됩니다.');
if (/gridTemplateColumns: 'repeat\(4/.test(hub) || hub.includes("minmax(300px,.9fr)")) fail('물건 상세 허브의 고정 4열/300px 그리드는 반응형 CSS 클래스로 옮겨야 합니다.');
const css = readFileSync('src/mobile-shell.css', 'utf8');
for (const marker of ['.property-hub-overview{', '.property-hub-cards,.property-hub-counts{', '@media(max-width:760px){.property-hub-hero']) if (!css.includes(marker)) fail(`물건 상세 허브 반응형 CSS 누락: ${marker}`);
const form = readFileSync('src/pages/PropertyForm.tsx', 'utf8');
for (const marker of ['buildPropertyToSave(property, id, loadState', 'disabled={saving}', "if (saving) return;", "setLoadState('not_found')", 'setProperty((previous) => ({ ...previous, [key]:', 'parseNonNegativeNumberInput(event.target.value)']) if (!form.includes(marker)) fail(`물건 편집 화면 계약 누락: ${marker}`);
if (form.includes('id: property.id || crypto.randomUUID()')) fail('편집 저장에서 빈 ID를 새 UUID로 바꾸는 경로가 남아 있습니다.');

console.log('Property detail pages validation passed (hero privacy 5, comparables 3, edit-save integrity 6, number input 6, wiring).');

// 6. Data Room document actions (2026-10-30).
const docRules = await importTs('src/domain/propertyDetail/dataRoomDocumentRules.ts');
const doc = { id: 'd1', propertyId: 'p-1', title: '건축물대장', verificationStatus: 'imported', verifiedAt: undefined, updatedAt: 'old' };
if (JSON.stringify(docRules.documentVerificationOptions('imported')) !== JSON.stringify(['unverified', 'imported', 'confirmed', 'verified'])) fail('문서 검증 선택지는 미확인/외부자료/사용자 확인/공식 확인만이어야 합니다.');
if (docRules.documentVerificationOptions('ai_analysis')[0] !== 'ai_analysis') fail('기존(레거시) 상태는 선택지에 보존 표시되어야 합니다.');
for (const bad of ['calculated', 'estimated', 'ai_analysis', 'missing']) {
  try { docRules.applyDocumentVerification(doc, bad, 'T'); fail(`문서에 시스템 전용 상태 ${bad}를 지정할 수 있습니다.`); } catch (error) { if (String(error.message).includes('지정할 수 있습니다')) throw error; }
}
const verifiedDoc = docRules.applyDocumentVerification(doc, 'verified', 'T');
if (verifiedDoc.verificationStatus !== 'verified' || verifiedDoc.verifiedAt !== 'T' || verifiedDoc.updatedAt !== 'T') fail('공식 확인 시 시각이 기록되어야 합니다.');
if (docRules.applyDocumentVerification(verifiedDoc, 'confirmed', 'U').verifiedAt !== undefined) fail('공식 확인 해제 시 verifiedAt을 지워야 합니다.');
if (docRules.applyDocumentVerification(doc, 'imported', 'T') !== doc) fail('같은 상태 선택은 저장하지 않아야 합니다.');
if (!docRules.requiresOfficialConfirmation('imported', 'verified') || docRules.requiresOfficialConfirmation('verified', 'verified') || docRules.requiresOfficialConfirmation('imported', 'confirmed')) fail('공식 확인으로 올릴 때만 사람 확인 절차가 필요합니다.');
const dataRoom = readFileSync('src/pages/PropertyDataRoomPage.tsx', 'utf8');
for (const marker of ['setBundle(scopeDataRoomBundle(nextBundle, id))', 'applyDocumentVerification(document, status,', 'requiresOfficialConfirmation(document.verificationStatus, status)', "catch (reason) { setError(reason instanceof Error ? reason.message : '문서를 삭제하지 못했습니다.'); }", 'documentVerificationOptions(document.verificationStatus)', 'disabled={Boolean(busyDocumentId)}']) if (!dataRoom.includes(marker)) fail(`Data Room 문서 처리 계약 누락: ${marker}`);
if (dataRoom.includes('Object.entries(VERIFICATION_LABELS).map(([key, label]) => <MenuItem')) fail('문서 검증 선택지에 시스템 전용 상태 전체를 노출하면 안 됩니다.');
console.log('Data Room document action validation passed.');

// 7. Comparable transaction panel: parse errors visible, Korean status labels, responsive fields.
const comparablePanel = readFileSync('src/components/propertyDataRoom/ComparableTransactionPanel.tsx', 'utf8');
if (comparablePanel.includes('catch { return []; }')) fail('비교거래 입력 오류를 숨기고 0건으로 표시하면 안 됩니다.');
for (const marker of ['parseError && !error', 'VERIFICATION_LABELS[status]', 'Boolean(parseError)', 'className="comparable-source-fields"']) if (!comparablePanel.includes(marker)) fail(`비교거래 패널 계약 누락: ${marker}`);
if (!readFileSync('src/mobile-shell.css', 'utf8').includes('@media(max-width:480px){.comparable-source-fields')) fail('비교거래 출처 입력 반응형 CSS 누락');
console.log('Comparable panel validation passed.');
const bulkStart = dataRoom.indexOf('const uploadSourceDocuments = async');
const bulk = dataRoom.slice(bulkStart, dataRoom.indexOf('const removeDocument = async', bulkStart));
if (!bulk.includes('linkedCount += 1;') || bulk.indexOf('if (linkedCount) await load()') > bulk.indexOf('setError(linkedCount ?')) fail('공적자료 일괄 등록이 중간에 실패하면 이미 연결된 건수를 (재로드 후) 알려야 합니다.');
console.log('Bulk source upload partial-failure validation passed.');
