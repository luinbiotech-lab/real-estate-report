import { existsSync, readFileSync } from 'node:fs';

const requiredFiles = [
  'src/components/professionalReport/DaonOnePageMaster.tsx',
  'src/components/professionalReport/DaonDetail7PageMaster.tsx',
  'src/daon-one-page-master.css',
  'src/daon-detail-master.css',
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

console.log('DA:ON report master integrity: PASS');
