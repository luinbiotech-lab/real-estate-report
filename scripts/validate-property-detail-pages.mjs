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

// 8. Discovery → registered property matching (stage b, 2026-10-30).
const match = await importTs('src/domain/propertyDetail/discoveryMatch.ts');
const rows = [
  { id: 'a', address: '서울 서초구 방배동 815-11' },
  { id: 'b', address: '서울특별시 성동구 성수동2가 331-7' },
  { id: 'c', address: '서울특별시 서초구 방배동 815-11' },
  { id: 'd', address: '' },
];
const hit = (address) => match.findRegisteredMatches(address, rows).map((row) => row.id).join(',');
if (hit({ lotAddress: '서울특별시 서초구 방배동 815-11' }) !== 'a,c') fail('서울특별시/서울 표기 차이를 같은 주소로 대조하고, 중복 등록을 모두 찾아야 합니다.');
if (hit({ roadAddress: '서울 성동구 성수동2가 331-7' }) !== 'b') fail('도로명/지번 중 하나만 일치해도 찾아야 합니다.');
if (hit({ lotAddress: '서울 서초구 방배동 815-1' }) !== '') fail('번지가 다른 주소를 같은 물건으로 보면 안 됩니다.');
if (hit({}) !== '' || hit(undefined) !== '' || hit({ officialAddress: '   ' }) !== '') fail('빈 주소는 어떤 물건과도 일치하면 안 됩니다(빈 주소 등록 물건 포함).');
const discovery = readFileSync('src/pages/PropertyDiscoveryPage.tsx', 'utf8');
for (const marker of ['requestId !== matchRequestRef.current', 'found.length === 1 ? found[0] : undefined', 'matches.length > 1', 'severity={refreshFailed ?', 'setMatchError(']) if (!discovery.includes(marker)) fail(`주소 조회 화면 계약 누락: ${marker}`);
if (discovery.includes("refreshMessage.includes('실패')")) fail('저장 실패 여부를 메시지 문구로 추정하면 안 됩니다.');
const discoveryPanel = readFileSync('src/components/PropertyPublicDiscoveryPanel.tsx', 'utf8');
for (const marker of ['if (!value || loading) return;', 'requestId !== searchRequestRef.current']) if (!discoveryPanel.includes(marker)) fail(`공공자료 조회 패널 계약 누락: ${marker}`);
console.log('Discovery matching validation passed.');
if (!form.includes('navigate(`/property/${encodeURIComponent(data.id)}`);')) fail('신규 등록 후에도 저장된 물건 상세(→ Data Room)로 이어져야 합니다.');

// 9. Report-adjacent pages outside the MASTER renderer (stage c, 2026-10-30).
const briefing = readFileSync('src/pages/PropertyBriefingPage.tsx', 'utf8');
for (const marker of ['let cancelled = false', "setLoadError('요청한 물건을 찾을 수 없습니다.')", '.catch((reason: unknown)', 'property.id !== id']) if (!briefing.includes(marker)) fail(`입지 브리핑 로딩 계약 누락: ${marker}`);
if (briefing.includes('propertyRepository.getById(id).then(setProperty)')) fail('입지 브리핑이 없는 물건에서 무한 로딩되고 오류가 처리되지 않습니다.');
if (briefing.indexOf('useReactToPrint(') > briefing.indexOf('if (loadError) return')) fail('입지 브리핑의 hook은 조건부 return보다 앞에 있어야 합니다.');
const reportHistory = readFileSync('src/pages/ReportHistoryPage.tsx', 'utf8');
for (const marker of ['Promise.allSettled(', "result.status === 'rejected'", 'classifyPropertyRecord(property)', "'생성 시각 미기록'"]) if (!reportHistory.includes(marker)) fail(`보고서 이력 계약 누락: ${marker}`);
console.log('Report-adjacent page validation passed.');

// 10. Workspaces (stage d-1): readiness center, rental/income.
const rental = await importTs('src/domain/propertyDetail/rentalInput.ts');
for (const [key, raw, expected] of [['monthlyRent', '', 0], ['monthlyRent', '1200000', 1_200_000], ['monthlyRent', '-1', undefined], ['vacancyRatePct', '101', undefined], ['vacancyRatePct', '100', 100], ['operatingExpenseRatePct', '-5', undefined], ['purchasePrice', 'NaN', undefined], ['purchasePrice', '150', 150]]) {
  if (rental.sanitizeRentalInput(key, raw) !== expected) fail(`임대 입력 처리 오류: ${key}="${raw}"`);
}
const props = [{ id: 'p1' }, { id: 'daon-bangbae-815-11' }];
const picked = rental.pickRentalTarget(props, 'missing');
if (picked.target !== undefined || !picked.missingRequested) fail('없는 propertyId로 다른 물건의 수익 분석을 열면 안 됩니다.');
if (rental.pickRentalTarget(props, 'daon-bangbae-815-11').target?.id !== 'daon-bangbae-815-11') fail('지정한 물건은 정확히 선택되어야 합니다.');
if (rental.pickRentalTarget(props, null).target?.id !== 'p1') fail('지정이 없으면 첫 물건을 선택합니다.');
const rentalPage = readFileSync('src/pages/RentalIncomeWorkspacePage.tsx', 'utf8');
if (rentalPage.includes("rows.find((item) => item.id === 'daon-bangbae-815-11')")) fail('수익 분석이 하드코딩된 방배동 ID로 대체 선택하면 안 됩니다.');
for (const marker of ['pickRentalTarget(rows, searchParams.get(\'propertyId\'))', 'sanitizeRentalInput(String(key), event.target.value)', "if (!propertyId) { setError('대상 물건을 먼저 선택해 주세요.'); return; }", 'className="rental-workspace-grid"', '} catch (reason) {']) if (!rentalPage.includes(marker)) fail(`임대·수익 화면 계약 누락: ${marker}`);
const readinessPage = readFileSync('src/pages/PropertyReadinessCenterPage.tsx', 'utf8');
for (const marker of ['Promise.allSettled(', 'setLoadError(', 'compareByUpdatedAtDesc(a.property, b.property)', '{loadError && <Alert']) if (!readinessPage.includes(marker)) fail(`준비도 센터 계약 누락: ${marker}`);
for (const [name, text] of [['준비도 센터', readinessPage], ['임대·수익', rentalPage]]) if (/<main[\s>]/.test(text)) fail(`${name} 화면이 Layout <main> 안에 <main>을 중첩합니다.`);
console.log('Workspace (readiness, rental) validation passed.');

// 11. External share center (stage d-2).
const share = await importTs('src/domain/propertyDetail/shareRules.ts');
for (const [input, expected] of [['=HYPERLINK("x")', `"'=HYPERLINK(""x"")"`], ['+1', `"'+1"`], ['-2', `"'-2"`], ['@SUM(A1)', `"'@SUM(A1)"`], ['\tx', `"'\tx"`], ['정상 메모', '"정상 메모"'], [null, '""'], [12, '"12"']]) {
  if (share.safeCsvCell(input) !== expected) fail(`CSV 셀 처리 오류(수식 주입 방지): ${JSON.stringify(input)} → ${share.safeCsvCell(input)}`);
}
const now = '2026-10-30T00:00:00.000Z';
if (!share.canReissueShare({ status: 'active', expiresAt: '2026-11-01T00:00:00.000Z' }, now)) fail('유효한 공유는 다시 만들 수 있어야 합니다.');
if (!share.canReissueShare({ status: 'active' }, now)) fail('만료일 없는 유효 공유는 다시 만들 수 있어야 합니다.');
for (const blocked of [{ status: 'revoked' }, { status: 'expired' }, { status: 'active', expiresAt: '2026-10-29T00:00:00.000Z' }]) if (share.canReissueShare(blocked, now)) fail(`회수/만료 공유를 다시 발급할 수 있습니다: ${JSON.stringify(blocked)}`);
const sharePage = readFileSync('src/pages/ExternalShareCenterPage.tsx', 'utf8');
if (/function csvCell[\s\S]{0,120}return `"\$\{text\.replace/.test(sharePage)) fail('감사대장 CSV가 수식 주입 방지 없이 내보내집니다.');
for (const marker of ['const csvCell = safeCsvCell;', "if (!canReissueShare(share, new Date().toISOString())) { setNotice(''); setError('회수되었거나 만료된 공유는 Manifest", "if (!canReissueShare(share, new Date().toISOString())) { setNotice(''); setError('회수되었거나 만료된 공유는 공유 HTML", "if (!confirm('이 공유를 회수 처리할까요?", "share.status !== 'active'} onClick={() => void revoke(share)}"]) if (!sharePage.includes(marker)) fail(`외부 공유 화면 계약 누락: ${marker.slice(0, 60)}`);
if (/<main[\s>]/.test(sharePage)) fail('외부 공유 화면이 <main>을 중첩합니다.');
console.log('External share center validation passed.');

// 12. Backup center: MERGE overwrites same-id records, so every restore path asks first.
const backupPage = readFileSync('src/pages/DataBackupCenterPage.tsx', 'utf8');
for (const marker of ["mode === 'merge' && !window.confirm(", "백업 파일의 방배동 Phase 1 레코드를 현재 로컬 데이터에 병합합니다", "mode === 'replace' && !window.confirm("]) if (!backupPage.includes(marker)) fail(`백업 복원 확인 누락: ${marker.slice(0, 40)}`);
const backupSmoke = readFileSync('scripts/visual-backup-smoke.mjs', 'utf8');
if ((backupSmoke.match(/page\.once\('dialog', \(dialog\) => \{ void dialog\.accept\(\); \}\);/g) ?? []).length < 2) fail('백업 렌더 smoke가 병합/Phase 1 확인 창을 수락해야 합니다.');
console.log('Backup restore confirmation validation passed.');

// 13. Access management: owner lockout guard (client-side; server/RLS unchanged).
const owner = await importTs('src/domain/propertyDetail/ownerSafety.ts');
const team = [{ userId: 'o1', role: 'owner', active: true }, { userId: 'o2', role: 'owner', active: true }, { userId: 'e1', role: 'editor', active: true }];
const solo = [{ userId: 'o1', role: 'owner', active: true }, { userId: 'e1', role: 'editor', active: true }];
const reason = (profiles, actor, target, change) => owner.ownerChangeBlockReason(profiles, actor, target, change);
if (!reason(team, 'o1', team[0], { role: 'admin' })) fail('OWNER 본인 강등을 막아야 합니다.');
if (!reason(team, 'o1', team[0], { active: false })) fail('OWNER 본인 비활성화를 막아야 합니다.');
if (reason(team, 'o1', team[1], { role: 'admin' })) fail('다른 OWNER가 남아 있으면 다른 OWNER 강등은 허용됩니다.');
if (!reason(solo, 'x', solo[0], { role: 'viewer' })) fail('마지막 활성 OWNER 강등을 막아야 합니다.');
if (!reason(solo, 'x', solo[0], { active: false })) fail('마지막 활성 OWNER 비활성화를 막아야 합니다.');
if (reason(solo, 'o1', solo[1], { role: 'viewer' }) || reason(solo, 'o1', solo[1], { active: false })) fail('일반 사용자 변경은 막지 않습니다.');
if (reason(solo, 'o1', solo[0], { role: 'owner' }) || reason(solo, 'o1', solo[0], { active: true })) fail('권한을 낮추지 않는 변경은 막지 않습니다.');
const accessPage = readFileSync('src/pages/AccessManagementPage.tsx', 'utf8');
for (const marker of ['ownerChangeBlockReason(remoteProfiles, remoteSession?.userId, profile, { role })', 'ownerChangeBlockReason(remoteProfiles, remoteSession?.userId, profile, { active: !profile.active })']) if (!accessPage.includes(marker)) fail(`권한 관리 잠금 방지 연결 누락: ${marker.slice(0, 50)}`);
if ((accessPage.match(/window\.confirm\(`\$\{profile\.email \|\| profile\.userId\}/g) ?? []).length < 2) fail('권한 변경·활성 변경은 확인 후 실행해야 합니다.');
console.log('Access owner-lockout validation passed.');

// 14. 3D workspaces honor ?propertyId (found by the 2026-10-30 E2E run: intake → workspace showed the first property).
const twinPage = readFileSync('src/pages/DigitalTwinWorkspacePage.tsx', 'utf8');
const spatialPage = readFileSync('src/pages/SpatialWorkspacePage.tsx', 'utf8');
for (const [name, text] of [['Digital Twin Workspace', twinPage], ['Spatial Workspace', spatialPage]]) {
  if (!text.includes("pickRequestedProperty(list, searchParams.get('propertyId'))")) fail(`${name}가 ?propertyId를 무시하고 첫 물건을 선택합니다.`);
  if (!text.includes('setSearchParams({ propertyId: event.target.value })')) fail(`${name}에서 물건을 바꾸면 주소(?propertyId)도 갱신되어야 합니다.`);
}
const intakePage = readFileSync('src/pages/DigitalTwinIntakePage.tsx', 'utf8');
if (intakePage.includes("navigate('/digital-twin')")) fail('도면 등록 화면에서 Digital Twin으로 이동할 때 물건 ID를 넘겨야 합니다.');
console.log('3D workspace property deep-link validation passed.');
