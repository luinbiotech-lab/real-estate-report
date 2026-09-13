import { existsSync, readFileSync } from 'node:fs';

const requiredFiles = [
  'src/components/professionalReport/DaonOnePageMaster.tsx',
  'src/components/professionalReport/DaonDetail7PageMaster.tsx',
  'src/daon-one-page-master.css',
  'src/daon-detail-master.css',
  'src/daon-master-refinement.css',
  'src/pages/DocumentPreview.tsx',
  'src/pages/ProfessionalReportSnapshotPage.tsx',
  'src/domain/professionalReport/templateIds.ts',
  'src/services/reportEngine/reportSnapshotService.ts',
];

const forbiddenFiles = [
  'src/components/professionalReport/DaonBangbaeGoldenReference.tsx',
  'src/components/professionalReport/DaonBangbaeDocumentPreview.tsx',
  'src/daon-golden-reference.css',
];

const forbiddenPhrases = [
  'BANGBAE-DONG PREMIUM ASSET',
  '서초의 가치가 만나는',
  '프리미엄이 모이는 서초의 중심, 방배동',
];

for (const file of requiredFiles) {
  if (!existsSync(file)) throw new Error(`MASTER 필수 파일 누락: ${file}`);
}

for (const file of forbiddenFiles) {
  if (existsSync(file)) throw new Error(`폐기된 MASTER 파일 재도입 금지: ${file}`);
}

const onePage = readFileSync(requiredFiles[0], 'utf8');
const detail = readFileSync(requiredFiles[1], 'utf8');
const onePageCss = readFileSync(requiredFiles[2], 'utf8');
const detailCss = readFileSync(requiredFiles[3], 'utf8');
const refinementCss = readFileSync(requiredFiles[4], 'utf8');
const documentPreview = readFileSync(requiredFiles[5], 'utf8');
const snapshotPage = readFileSync(requiredFiles[6], 'utf8');
const templateIds = readFileSync(requiredFiles[7], 'utf8');
const snapshotService = readFileSync(requiredFiles[8], 'utf8');

for (const phrase of forbiddenPhrases) {
  if (onePage.includes(phrase) || detail.includes(phrase)) {
    throw new Error(`특정 물건 전용 하드코딩 문구 재도입 금지: ${phrase}`);
  }
}

if (!onePage.includes('DAON_ONE_PAGE_MASTER_TEMPLATE_ID')) {
  throw new Error('1P MASTER template id 연결이 없습니다.');
}
if (!detail.includes('DAON_DETAIL_MASTER_TEMPLATE_ID')) {
  throw new Error('7P MASTER template id 연결이 없습니다.');
}
if (!templateIds.includes("DAON_ONE_PAGE_MASTER_TEMPLATE_VERSION = 'daon-1p-v2'")) {
  throw new Error('복원된 1P MASTER 버전은 daon-1p-v2를 유지해야 합니다.');
}
if (!templateIds.includes("DAON_DETAIL_MASTER_TEMPLATE_VERSION = 'daon-detail-7p-v2'")) {
  throw new Error('복원된 7P MASTER 버전은 daon-detail-7p-v2를 유지해야 합니다.');
}
if (!templateIds.includes("'daon-detail-7p-v1'")) {
  throw new Error('기존 7P immutable Snapshot 호환성을 유지해야 합니다.');
}
if (!onePageCss.includes('width:210mm') || !onePageCss.includes('height:297mm')) {
  throw new Error('1P MASTER는 A4 세로 고정 크기를 유지해야 합니다.');
}
if (!detailCss.includes('width:210mm') || !detailCss.includes('height:297mm')) {
  throw new Error('7P MASTER는 A4 세로 고정 크기를 유지해야 합니다.');
}
if (!detail.includes("item.category !== 'interior'")) {
  throw new Error('7P MASTER 내부사진 제외 정책 연결이 없습니다.');
}
if (onePage.includes("<Fact label=\"지목\" value={'대'}")) {
  throw new Error('지목 하드코딩 금지: 검증 데이터만 사용해야 합니다.');
}
const onePageFactCount = (onePage.match(/<Fact label=/g) || []).length;
if (onePageFactCount !== 12) {
  throw new Error(`1P MASTER property facts는 12개를 유지해야 합니다. 현재 ${onePageFactCount}개입니다.`);
}
if (!onePage.includes('label="공부상 주차"') || !onePage.includes('label="현장 주차"')) {
  throw new Error('1P MASTER facts에서 공부상 주차와 현장 주차를 각각 표시해야 합니다.');
}
if (onePage.includes('용적률 참고 계산')) {
  throw new Error('1P MASTER facts에 임의 용적률 계산면적을 공식값처럼 노출하지 않습니다.');
}
if (!onePage.includes('parkingOfficial') || !onePage.includes('parkingField')) {
  throw new Error('1P MASTER에서 공부상 주차와 현장 주차를 분리해야 합니다.');
}
if (!detail.includes('parkingOfficial') || !detail.includes('parkingField')) {
  throw new Error('7P MASTER에서 공부상 주차와 현장 주차를 분리해야 합니다.');
}
if (detail.includes('현장주차') && !detail.includes('공부상 주차')) {
  throw new Error('7P MASTER 현장 주차 표기에는 공부상 주차 구분도 함께 유지해야 합니다.');
}
if (!documentPreview.includes('DaonOnePageMaster') || documentPreview.includes('ProfessionalReportV1')) {
  throw new Error('현재 1P 미리보기는 DAON_1P_MASTER만 사용해야 합니다.');
}
if (!snapshotPage.includes('DaonDetail7PageMaster') || snapshotPage.includes("import { ProfessionalReportV1")) {
  throw new Error('현재 7P 미리보기는 DAON_DETAIL_7P_MASTER만 사용해야 합니다.');
}
if (!snapshotPage.includes('현재 DA:ON MASTER로 다시 생성')) {
  throw new Error('구형 Snapshot은 현재 MASTER 재생성 경로를 제공해야 합니다.');
}
if (!snapshotPage.includes('reportReady') || !snapshotPage.includes('검증 필요')) {
  throw new Error('7P 미리보기에서 검증 준비도를 표시해야 합니다.');
}
if (!snapshotService.includes('viewModel.dataQuality.reportReady')) {
  throw new Error('검증 미완료 Snapshot은 ready 확정을 차단해야 합니다.');
}
if (!documentPreview.includes("../daon-master-refinement.css") || !snapshotPage.includes("../daon-master-refinement.css")) {
  throw new Error('현재 1P/7P 미리보기는 공통 MASTER refinement layer를 적용해야 합니다.');
}
if (!refinementCss.includes('.d1-map>img') || !refinementCss.includes('.dd-image.map img')) {
  throw new Error('MASTER refinement layer의 지도 표시 규칙이 누락되었습니다.');
}

console.log('DA:ON report master integrity: PASS');
