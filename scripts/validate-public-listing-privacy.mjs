// Public listing privacy contract (2026-11-16, 루인 #65 "public listing privacy and access").
// The buyer-facing listing is built only from buildPublicListingSnapshot (allowlist). This validator feeds it a property
// and Data Room evidence full of private canaries (lot number, detail address, owner / tenant / manager identity, phone,
// e-mail, internal id and name, notes, file-name source labels, signed photo URL, comparable deal rows) and fails if any
// canary survives anywhere in the snapshot, if the snapshot grows a field outside the allowlist, or if the pages read
// the Property row directly instead of the snapshot.
import { readFileSync } from 'node:fs';
import { importTs } from './lib/ts-module-loader.mjs';

const snap = await importTs('src/domain/platform/publicListingSnapshot.ts');
const ledger = await importTs('src/domain/platform/evidenceLedger.ts');
const fail = (message) => { throw new Error(message); };
let checks = 0;
const expect = (ok, message) => { checks += 1; if (!ok) fail(message); };

// 1. Free-text scrubbing.
const scrubCases = [
  ['방배동 815-11 앞 8m 도로', '방배동 앞 8m 도로'],
  ['동광로18길 7 접면, 도로 8m 접함', '동광로18길 접면, 도로 8m 접함'],
  ['산12-3 임야 인접', '임야 인접'],
  ['123번지 일대', '일대'],
  ['3층 301호 공실', '3층 공실'],
  ['문의 010-1234-5678 / broker@example.com', '문의 /'],
  ['2010-05-12 사용승인', '2010-05-12 사용승인'],
  ['도보 7분', '도보 7분'],
  ['지하 1층 · 지상 5층', '지하 1층 · 지상 5층'],
  ['제2종일반주거지역', '제2종일반주거지역'],
];
for (const [input, want] of scrubCases) expect(snap.scrubPublicText(input) === want, `공개 문구 정리 오류: "${input}" → "${snap.scrubPublicText(input)}" (기대 "${want}")`);

// 2. Source names: allowlisted document names only; file names / notes fall back to the source type.
expect(snap.publicSourceLabel('건축물대장', '공식 문서', '2026-11-10') === '건축물대장(2026-11-10 자료)', '허용 서류명은 그대로');
expect(snap.publicSourceLabel('방배동 815-11 등기부등본.pdf', '공식 문서', '') === '공식 문서', '파일명 출처는 출처 종류로만 표시');
expect(snap.publicSourceLabel('홍길동 소유자 메모', '사용자 입력', '2026-11-01') === '사용자 입력(2026-11-01 자료)', '메모 출처는 출처 종류로만 표시');

// 3. Photos: policy and signed links.
expect(snap.publicPhotoUrl({ id: 'x', mainImage: '/assets/front.jpg' }) === '/assets/front.jpg', '허용 사진은 공개');
expect(snap.publicPhotoUrl({ id: 'x', mainImage: 'https://x.supabase.co/storage/v1/object/sign/m/a.jpg?token=abc' }) === '', '서명(만료) 링크 사진은 공개하지 않음');
expect(snap.publicPhotoUrl({ id: 'x', mainImage: 'https://s3.example.com/a.jpg?X-Amz-Signature=1' }) === '', 'S3 서명 링크 사진은 공개하지 않음');
expect(snap.publicPhotoUrl({ id: 'x', mainImage: '/assets/front.jpg', internalPhotoAllowed: false }) === '', '사진 공개 금지 물건은 사진 없음');
expect(snap.publicPhotoUrl({ id: 'daon-bangbae-815-11', name: '방배동 815-11', address: '서울특별시 서초구 방배동 815-11', mainImage: '/assets/front.jpg', internalPhotoAllowed: true }) === '', '방배 815-11은 플래그와 무관하게 사진 없음');

// 4. Full snapshot with private canaries.
const CANARY = {
  id: 'prop-internal-7f3a9c',
  name: '홍길동빌딩(815-11)',
  lot: '815-11',
  detail: '비밀상세주소-B동',
  owner: '소유자김철수',
  tenant: '임차인박영희',
  manager: '담당자이몽룡',
  phone: '010-9876-5432',
  email: 'private.broker@example.com',
  company: '비밀중개법인',
  note: '내부메모-매도인급매',
  risk: '근저당-채권최고액-비공개',
  file: '방배동815-11_등기부등본_원본.pdf',
  photo: 'https://x.supabase.co/storage/v1/object/sign/media/a.jpg?token=SIGNEDTOKEN123',
  deal: '비교거래-역삼동123-4',
  rationale: '협상가근거-비공개',
};
const property = {
  id: CANARY.id, propertyNumber: 'P-0001', name: CANARY.name, buildingName: CANARY.name, tradeType: '매매',
  salePrice: 4_150_000_000, deposit: 300_000_000, monthlyRent: 12_000_000, negotiable: true, occupancyStatus: `${CANARY.tenant} 영업 중`,
  listingStatus: 'on_market', listingStatusSource: CANARY.manager, listingStatusCheckedAt: '2026-11-01', listingStatusNote: CANARY.note,
  address: `서울특별시 서초구 방배동 ${CANARY.lot}`, detailAddress: CANARY.detail, latitude: 37.481234, longitude: 126.991234,
  nearbyStation: '방배역', stationDistance: '도보 7분', roadCondition: `방배동 ${CANARY.lot} 앞 8m 도로, 문의 ${CANARY.phone}`,
  landAreaPyeong: 92.4, landAreaSqm: 305.5, totalFloorAreaPyeong: 300, totalFloorAreaSqm: 991.7, buildingAreaPyeong: 55,
  brokerAchievablePrice: 3_900_000_000, brokerAchievablePriceRationale: CANARY.rationale,
  zoning: '제2종일반주거지역', mainUse: '근린생활시설', structure: '철근콘크리트구조', basementFloors: 1, groundFloors: 5, completionDate: '2010-05-12',
  buildingCoverageRate: 59, floorAreaRatio: 199, elevator: '있음', parkingSpaces: 5,
  features: CANARY.note, investmentPoints: CANARY.note, locationAnalysis: CANARY.note, developmentPlan: CANARY.note, recommendedUse: '',
  risks: CANARY.risk, overallOpinion: CANARY.note, nearbyTransactions: CANARY.deal,
  managerName: CANARY.manager, managerPhone: CANARY.phone, managerEmail: CANARY.email, companyName: CANARY.company,
  mainImage: CANARY.photo, additionalImages: [CANARY.photo], mapImage: '', locationAnalysisImage: '',
  briefingItems: [{ id: 'b', title: CANARY.owner, body: CANARY.owner }], briefingUpdatedAt: '', recordClass: 'operational',
  createdAt: '2026-11-01', updatedAt: '2026-11-15',
};
const ver = { id: 'v', propertyId: CANARY.id, fieldKey: 'zoning', status: 'verified', note: CANARY.note, verifiedAt: '2026-11-10T01:00:00Z', verifiedBy: CANARY.manager, createdAt: '', updatedAt: '2026-11-10' };
const sources = [
  { id: 's1', propertyId: CANARY.id, fieldKey: 'zoning', sourceType: 'official_document', sourceName: CANARY.file, collectedAt: '2026-11-09T00:00:00Z', verificationStatus: 'verified', metadata: { owner: CANARY.owner }, createdAt: '' },
  { id: 's2', propertyId: CANARY.id, fieldKey: 'zoning', sourceType: 'official_document', sourceName: '토지이용계획확인서', collectedAt: '2026-11-08T00:00:00Z', verificationStatus: 'verified', metadata: {}, createdAt: '' },
];
const proof = ledger.factEvidence('zoning', CANARY.id, [ver], sources);
expect(proof?.publicSources?.length === 2 && proof.publicSources.includes('공식 문서(2026-11-09 자료)') && proof.publicSources.includes('토지이용계획확인서(2026-11-08 자료)'), `공개 근거 라벨 (${JSON.stringify(proof?.publicSources)})`);
const detail = {
  grade: { grade: 'B', label: 'B', hint: '원본 대부분 확보', criteria: [{ key: 'official', label: '필수 공적서류', value: '1/4', met: false }] },
  verifiedFieldKeys: new Set(['zoning']),
  evidence: new Map([['zoning', proof]]),
  checklist: [{ key: 'risk', label: '규제·리스크 점검', state: 'open', detail: `확인 필요 1건 (${CANARY.lot} 위반건축물)` }],
  market: { points: [{ tradeDate: '2026-10-01', unitPrice: 1, label: CANARY.deal, address: CANARY.deal }], count: 1, min: 1, max: 2, median: 1, latestTradeDate: '2026-10-01', subjectUnitPrice: 1, deltaPct: 0, band: 'within', headline: '대상 4,491만 원/평', basis: ['비교거래는 후보 사례입니다.'] },
  readyReport: { version: 3, generatedAt: '2026-11-12' },
};

const ALLOWED_KEYS = ['place', 'title', 'mainUse', 'tradeType', 'priceText', 'salePrice', 'landAreaPyeong', 'recordClass', 'photo', 'photoNote', 'facts', 'pending', 'grade', 'checklist', 'market', 'readyReport'].sort();
const FORBIDDEN = Object.entries(CANARY).map(([key, value]) => [key, value]).concat([['token', 'SIGNEDTOKEN'], ['lotDigits', '815'], ['latitude', '37.481234'], ['deposit', '300000000'], ['achievable', '3900000000']]);
for (const level of ['gu', 'dong']) {
  const snapshot = snap.buildPublicListingSnapshot(property, detail, level);
  const json = JSON.stringify(snapshot);
  expect(JSON.stringify(Object.keys(snapshot).sort()) === JSON.stringify(ALLOWED_KEYS), `공개 스냅샷 필드가 허용 목록과 다름 (${Object.keys(snapshot).join(',')})`);
  for (const [key, value] of FORBIDDEN) expect(!json.includes(value), `[${level}] 공개 스냅샷에 비공개 값(${key}) 노출: ${value}`);
  expect(!snapshot.market || !('points' in snapshot.market), `[${level}] 비교거래 원본 행은 공개하지 않음`);
  expect(snapshot.photo === '' && snapshot.photoNote.length > 0, `[${level}] 서명 링크 사진은 빼고 이유 표시`);
  expect(snapshot.facts.every((fact) => ['key', 'label', 'value', 'badge', 'proof'].includes(Object.keys(fact)[0])), `[${level}] 사실 항목 형식`);
}
const dong = snap.buildPublicListingSnapshot(property, detail, 'dong');
expect(dong.title === '서울특별시 서초구 방배동 근린생활시설', `공개 제목 (${dong.title})`);
expect(dong.facts.find((fact) => fact.key === 'roadCondition')?.value === '방배동 앞 8m 도로, 문의', `도로 조건 정리 (${dong.facts.find((fact) => fact.key === 'roadCondition')?.value})`);
expect(dong.facts.find((fact) => fact.key === 'completionDate')?.value === '2010-05-12', '사용승인일은 날짜 그대로');
// The 'full' level is the broker's explicit choice; it may show the lot but still nothing else private.
const full = JSON.stringify(snap.buildPublicListingSnapshot(property, detail, 'full'));
for (const [key, value] of FORBIDDEN.filter(([key]) => !['lot', 'lotDigits'].includes(key))) expect(!full.includes(value), `[full] 전체 주소 공개여도 비공개 값(${key}) 노출 금지: ${value}`);

// 5. Pages render only from the snapshot.
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const preview = strip(readFileSync('src/pages/PublicListingPreviewPage.tsx', 'utf8'));
const explore = strip(readFileSync('src/pages/ExplorePage.tsx', 'utf8'));
expect(preview.includes('buildPublicListingSnapshot(property, trust, level)'), '공개 미리보기는 스냅샷으로 렌더');
const previewRowReads = [...preview.matchAll(/property\.(\w+)/g)].map((match) => match[1]);
expect(previewRowReads.length === 0, `공개 미리보기가 Property 행을 직접 읽음: ${previewRowReads.join(', ')}`);
expect(!/trust\??\.(evidence|market|checklist|grade|readyReport)/.test(preview), '공개 미리보기가 자료실 결과를 직접 읽음(스냅샷 우회)');
expect(explore.includes('buildPublicListingSnapshot(property, row)') && /card\.photo/.test(explore) && /card\.title/.test(explore), '탐색 카드는 스냅샷으로 렌더');
const cardBlock = explore.slice(explore.indexOf('<ul className="explore-cards">'), explore.indexOf('</ul>', explore.indexOf('<ul className="explore-cards">')));
const cardRowReads = [...cardBlock.matchAll(/property\.(\w+)/g)].map((match) => match[1]).filter((field) => field !== 'id');
expect(cardRowReads.length === 0, `탐색 카드가 Property 행을 직접 읽음: ${cardRowReads.join(', ')}`);

console.log(`Public listing privacy validation passed (${checks} checks).`);
