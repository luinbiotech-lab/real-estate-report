// Platform trust contract (2026-11-15 platform upgrade, 루치오: "다온을 부동산플랫폼으로 격상").
//  1. the A–D trust grade is computed only from what the Data Room holds; pending candidates block A; no documents = never A/B,
//  2. public addresses are masked to the chosen level (no lot / building number below '전체'),
//  3. every public value carries a badge; missing values are listed as '확인 중', never shown as 0 or '-',
//  4. the preview pages say they are not published, keep inquiry disabled and respect the photo policy.
import { readFileSync } from 'node:fs';
import { importTs } from './lib/ts-module-loader.mjs';

const { trustGrade, gradeAtLeast } = await importTs('src/domain/platform/trustGrade.ts');
const listing = await importTs('src/domain/platform/publicListing.ts');
const fail = (message) => { throw new Error(message); };
let checks = 0;
const expect = (ok, message) => { checks += 1; if (!ok) fail(message); };

const base = { factsFilled: 11, factsTotal: 11, requiredSourcePresent: 4, requiredOfficiallyVerified: 4, requiredDocumentTotal: 4, verificationPending: 0 };
const g = (over) => trustGrade({ ...base, ...over }).grade;
expect(g({}) === 'A', 'A: 기본정보 충분 + 필수서류 모두 공식확인 + 후보 없음');
expect(g({ verificationPending: 1 }) === 'B', '검토 대기 후보가 있으면 A가 될 수 없음');
expect(g({ requiredOfficiallyVerified: 3 }) === 'B', '공식확인이 하나라도 빠지면 A가 아님');
expect(g({ requiredOfficiallyVerified: 0, requiredSourcePresent: 3 }) === 'B', 'B: 원본 대부분(총-1) 확보');
expect(g({ requiredOfficiallyVerified: 0, requiredSourcePresent: 2 }) === 'C', '원본이 2개 이상 빠지면 C');
expect(g({ factsFilled: 6, requiredOfficiallyVerified: 0, requiredSourcePresent: 0 }) === 'C', 'C: 기본정보 절반 이상');
expect(g({ factsFilled: 5, requiredOfficiallyVerified: 0, requiredSourcePresent: 0 }) === 'D', 'D: 기본정보 절반 미만');
expect(g({ factsFilled: 0, factsTotal: 0 }) === 'D', '기본정보 항목이 없으면 D');
expect(!['A', 'B'].includes(g({ requiredDocumentTotal: 0, requiredSourcePresent: 0, requiredOfficiallyVerified: 0 })), '필수서류 목록이 비면 A·B가 될 수 없음');
const result = trustGrade(base);
expect(result.criteria.length === 4 && result.criteria.every((row) => row.label && row.value), '등급 기준 4개가 숫자와 함께 설명됨');
expect(gradeAtLeast('A', 'B') && gradeAtLeast('B', 'B') && !gradeAtLeast('C', 'B'), 'B 이상 필터 = A·B');

const { maskAddress } = listing;
const cases = [
  ['서울특별시 서초구 방배동 815-11', 'dong', '서울특별시 서초구 방배동'],
  ['서울특별시 서초구 방배동 815-11', 'gu', '서울특별시 서초구'],
  ['서울특별시 서초구 방배동 815-11', 'full', '서울특별시 서초구 방배동 815-11'],
  ['서울특별시 서초구 동광로18길 7', 'dong', '서울특별시 서초구 동광로18길'],
  ['서울 강남구 역삼동 123-4 역삼빌딩', 'dong', '서울 강남구 역삼동'],
  ['경기도 성남시 분당구 정자동 1-2', 'dong', '경기도 성남시 분당구 정자동'],
  ['서울특별시 중구 을지로2가 199', 'dong', '서울특별시 중구 을지로2가'],
  ['  서울특별시   마포구 동교동 ', 'dong', '서울특별시 마포구 동교동'],
  ['', 'dong', ''],
];
for (const [input, level, want] of cases) expect(maskAddress(input, level) === want, `주소 가림 오류: ${input} (${level}) → ${maskAddress(input, level)} (기대 ${want})`);
for (const [input, level] of cases) if (level !== 'full') expect(!/\d+-\d+|\s\d+$/.test(maskAddress(input, level)), `전체 공개가 아니면 지번·건물번호가 남으면 안 됨: ${maskAddress(input, level)}`);
expect(listing.DEFAULT_ADDRESS_LEVEL === 'dong', '기본 공개 범위는 동·도로명');

const property = { salePrice: 4_500_000_000, landAreaPyeong: 90, totalFloorAreaSqm: 0, zoning: '제2종일반주거지역', mainUse: '근린생활시설', structure: '', groundFloors: 5, basementFloors: 1, completionDate: '', nearbyStation: '방배역', stationDistance: '도보 7분', roadCondition: '' };
const facts = listing.publicFacts(property, new Set(['zoning']));
const byKey = Object.fromEntries(facts.shown.map((row) => [row.key, row]));
expect(byKey.zoning?.badge === 'verified', '검증 기록이 있는 값은 공식확인');
expect(byKey.salePrice?.badge === 'input', '검증 기록이 없는 값은 중개사 입력');
expect(byKey.unitPrice?.badge === 'calculated' && byKey.unitPrice.value === '5,000만 원/평', `평당가는 계산값으로 표시 (${byKey.unitPrice?.value})`);
expect(['연면적', '구조', '사용승인일', '도로 조건'].every((label) => facts.pending.includes(label)), `빈 값은 확인 중 목록으로: ${facts.pending.join(',')}`);
expect(!facts.shown.some((row) => /^0|^-$|NaN|undefined/.test(row.value)), '0·-·NaN을 값처럼 보이지 않음');
expect(!listing.publicFacts({ ...property, landAreaPyeong: 0 }, new Set()).shown.some((row) => row.key === 'unitPrice'), '대지면적이 없으면 평당가를 계산하지 않음');
expect(listing.inPriceBand(3_000_000_000, '30to50') && !listing.inPriceBand(3_000_000_000, 'lt30') && listing.inPriceBand(10_000_000_000, 'gte100'), '가격대 경계값');
expect(!listing.inPriceBand(0, 'lt30') && listing.inPriceBand(0, 'all'), '가격 미입력은 가격대 필터에서 빠짐(전체 제외)');

const explore = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const preview = readFileSync('src/pages/PublicListingPreviewPage.tsx', 'utf8');
const service = readFileSync('src/services/platformListingService.ts', 'utf8');
expect(!/\{property\.name\}/.test(explore) && explore.includes('publicTitle(property)'), '탐색 카드는 내부 물건명(지번 포함 가능) 대신 가린 주소를 제목으로 씀');
expect(explore.includes('internalPhotoAllowed(property)') && preview.includes('internalPhotoAllowed(property)'), '공개 화면도 사진 정책(방배 815-11 사진 금지)을 따름');
expect(preview.includes('공개 화면 미리보기') && preview.includes('아직 인터넷에 게시되지 않았습니다'), '미리보기 배너 필수');
expect((preview.match(/disabled>/g) || []).length >= 2, '문의·보고서 요청은 2단계 전까지 비활성');
expect(explore.includes('Math.round(value * 1000) / 1000'), '공개 지도 핀은 약 100m 단위로 흐리게');
expect(!/\.(put|create|update|delete)\(/.test(service), '등급 서비스는 읽기 전용');

// Differentiation (11/15): evidence per value + buyer checklist. Only 'verified' rows count; open items are never hidden.
const ledger = await importTs('src/domain/platform/evidenceLedger.ts');
const ver = (over) => ({ id: 'v', propertyId: 'p1', fieldKey: 'zoning', status: 'verified', note: '', verifiedAt: '2026-11-10T01:00:00Z', createdAt: '', updatedAt: '2026-11-10', ...over });
const src = (over) => ({ id: 's', propertyId: 'p1', fieldKey: 'zoning', sourceType: 'official_document', sourceName: '토지이용계획확인서', collectedAt: '2026-11-09T00:00:00Z', verificationStatus: 'verified', metadata: {}, createdAt: '', ...over });
const proof = ledger.factEvidence('zoning', 'p1', [ver()], [src()]);
expect(proof?.verifiedAt === '2026-11-10' && proof.sources[0] === '토지이용계획확인서(공식 문서, 2026-11-09 자료)', `근거 표시 형식 (${JSON.stringify(proof)})`);
expect(ledger.factEvidence('zoning', 'p1', [ver({ status: 'confirmed' })], [src()]) === undefined, '사용자 확인(confirmed)은 공식확인 근거로 쓰지 않음');
expect(ledger.factEvidence('zoning', 'p1', [ver({ propertyId: 'p2' })], [src()]) === undefined, '다른 물건의 검증 기록을 섞지 않음');
expect(ledger.factEvidence('zoning', 'p1', [ver()], [src({ propertyId: 'p2' })])?.sources.length === 0, '다른 물건의 출처를 섞지 않음');
const docs = [{ type: 'building_register', label: '건축물대장' }, { type: 'land_register', label: '토지대장' }, { type: 'land_use_plan', label: '토지이용계획' }, { type: 'registry', label: '등기부등본' }];
const rows = ledger.dueDiligenceRows({ documents: docs, present: ['building_register', 'land_register'], verified: ['building_register'], pendingCandidates: 2, pendingFacts: ['연면적'], risk: undefined });
const state = Object.fromEntries(rows.map((row) => [row.key, row.state]));
expect(state['doc:building_register'] === 'done' && state['doc:land_register'] === 'partial' && state['doc:registry'] === 'open', '서류별 상태: 공식확인/원본만/미확보');
expect(state.candidates === 'open' && state.facts === 'open' && state.risk === 'open', '후보값·빈 정보·미점검 리스크는 열린 항목');
expect(ledger.dueDiligenceProgress(rows).done === 1 && ledger.dueDiligenceProgress(rows).total === 7, '확인표 진행률');
const aiRisk = ledger.dueDiligenceRows({ documents: [], present: [], verified: [], pendingCandidates: 0, pendingFacts: [], risk: { checks: [{ key: 'k', label: '위반건축물', status: 'clear', detail: '' }], personConfirmed: false } });
expect(aiRisk.find((row) => row.key === 'risk').state === 'partial' && aiRisk.find((row) => row.key === 'risk').detail.includes('사람 확인 전'), '자동 리스크 점검은 사람 확인 전이면 완료로 표시하지 않음');
const home = readFileSync('src/pages/HomePage.tsx', 'utf8');
expect(home.includes('aria-label="다른 부동산 사이트와 차이"') && !/직방|다방|네이버/.test(home.replace(/\/\*[\s\S]*?\*\//g, '')), '메인 비교표는 경쟁사 이름 없이(비교광고 근거 문제) 일반 매물 사이트로 표기');
expect(preview.includes('aria-label="매수 전 확인표"') && preview.includes('aria-label="시세 위치"') && preview.includes('실거래가 아님'), '공개 화면: 확인표·시세 위치·계산값 설명');

console.log(`Platform trust validation passed (${checks} checks).`);
