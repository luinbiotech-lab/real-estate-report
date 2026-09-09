import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, ButtonGroup, CircularProgress } from '@mui/material';
import { ArrowBackRounded, PrintRounded } from '@mui/icons-material';
import { useReactToPrint } from 'react-to-print';
import { QRCodeSVG } from 'qrcode.react';
import { propertyRepository } from '../repositories/propertyRepository';
import type { Property, Settings } from '../types';
import { formatArea, formatWon, lines, pricePerPyeong } from '../utils/format';
import { InfoGrid, MetricStrip, Photo, TextBlock } from '../components/DocumentParts';
import { DAON_ONE_PAGE_MASTER_TEMPLATE_ID, DAON_ONE_PAGE_MASTER_TEMPLATE_VERSION } from '../domain/professionalReport/templateIds';
import { internalPhotoAllowed } from '../domain/professionalReport/reportAccessPolicy';

export default function DocumentPreview({ settings }: { settings: Settings }) {
  const { id, kind } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState<Property>();
  const contentRef = useRef<HTMLDivElement>(null);
  const proposalLayout = params.get('layout') === 'landscape' ? 'landscape' : 'portrait';
  useEffect(() => { if (id) propertyRepository.getById(id).then(setProperty); }, [id]);
  const print = useReactToPrint({ contentRef, documentTitle: property ? `${property.name}_${kind === 'report' ? '투자분석보고서' : '고객제안서'}` : '부동산문서' });
  if (!property) return <div className="center"><CircularProgress /></div>;
  return <div className="preview-shell"><div className="preview-toolbar"><Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/')}>물건 목록</Button><div><b>{kind === 'report' ? '부동산 투자 분석 보고서' : '고객용 부동산 제안서'}</b><small>화면과 동일한 구성으로 인쇄하거나 PDF로 저장합니다.</small></div>{kind === 'proposal' && <ButtonGroup size="small" aria-label="제안서 용지 방향"><Button variant={proposalLayout === 'portrait' ? 'contained' : 'outlined'} onClick={() => setParams({ layout: 'portrait' })}>세로 기본</Button><Button variant={proposalLayout === 'landscape' ? 'contained' : 'outlined'} onClick={() => setParams({ layout: 'landscape' })}>가로</Button></ButtonGroup>}<Button variant="contained" startIcon={<PrintRounded />} onClick={print}>인쇄 / PDF 저장</Button></div><div className="paper-stage"><div ref={contentRef}>{kind === 'report' ? <Report property={property} settings={settings} /> : <DaonOnePageMaster property={property} settings={settings} layout={proposalLayout} />}</div></div></div>;
}

export function Brand({ settings }: { settings: Settings }) {
  return settings.logo ? <img className="doc-logo" src={settings.logo} alt={`${settings.companyName} 로고`} /> : <div className="wordmark"><i>AB</i><span>{settings.companyName}<small>REAL ESTATE ADVISORY</small></span></div>;
}

const floorText = (p: Property) => `지하 ${p.basementFloors || 0}층 / 지상 ${p.groundFloors || 0}층`;
const short = (value: string, fallback: string) => lines(value)[0] || fallback;
const corePoints = (p: Property) => [...lines(p.features), ...lines(p.investmentPoints)].filter(Boolean).slice(0, 6);

function Report({ property: p, settings: s }: { property: Property; settings: Settings }) {
  const unitPrice = pricePerPyeong(p);
  const buildingInfo: [string, string][] = [['대지면적', formatArea(p.landAreaPyeong)], ['연면적', formatArea(p.totalFloorAreaPyeong)], ['용도지역', p.zoning], ['도로조건', p.roadCondition], ['규모', floorText(p)], ['준공일', p.completionDate], ['건폐율', p.buildingCoverageRate ? `${p.buildingCoverageRate}%` : '-'], ['용적률', p.floorAreaRatio ? `${p.floorAreaRatio}%` : '-'], ['주차', p.parkingSpaces ? `${p.parkingSpaces}대` : '-'], ['승강기', p.elevator]];
  const additionalImages = internalPhotoAllowed(p) ? p.additionalImages : [];
  return <div className="report-v2 document">
    <article className="a4 portrait report-page report-page-one">
      <header className="report-top"><div><p>PROPERTY INVESTMENT ANALYSIS · {p.propertyNumber || 'PROPERTY'}</p><h1>부동산 투자 분석 보고서</h1></div><Brand settings={s} /></header>
      <section className="report-identity"><div><span>{p.tradeType}</span><h2>{p.name}</h2><p>{p.address} {p.detailAddress}</p></div><div className="report-price"><small>매매가</small><strong>{formatWon(p.salePrice)}</strong><b>평당 {formatWon(unitPrice)}</b></div></section>
      <section className="report-columns"><div className="report-media"><Photo src={p.mainImage} label="대표사진" className="report-main-photo" /><div className="map-card"><Photo src={p.mapImage} label="위치지도" /><p><b>LOCATION</b>{p.nearbyStation || '주요 교통 및 현장 위치는 지도 이미지를 등록해 표시할 수 있습니다.'}</p></div></div><div className="report-facts"><h3 className="section-title">물건 개요</h3><InfoGrid className="dense-info" items={[['거래유형', p.tradeType], ['명도상태', p.occupancyStatus], ['주용도', p.mainUse], ['구조', p.structure], ...buildingInfo.slice(0, 4)]} /><div className="point-card"><h3>CORE POINTS</h3><ol>{corePoints(p).map((point, index) => <li key={index}><span>{String(index + 1).padStart(2, '0')}</span>{point}</li>)}</ol></div><h3 className="section-title">토지 · 건물 정보</h3><InfoGrid className="dense-info" items={buildingInfo.slice(4)} /></div></section>
      <MetricStrip items={[['입지', short(p.locationAnalysis, '핵심 상권 접근성')], ['가격경쟁력', unitPrice ? `평당 ${formatWon(unitPrice)}` : '가격 검토'], ['개발잠재력', short(p.developmentPlan, '개발 여건 검토')], ['활용성', short(p.recommendedUse, '추천 용도 검토')]]} />
      <footer><span>{s.footerText}</span><b>{p.managerName || s.defaultManager} · {p.managerPhone || s.phone}</b></footer>
    </article>
    <article className="a4 portrait report-page report-page-two">
      <header className="report-subhead"><div><span>02</span><p>LOCATION & INVESTMENT REVIEW</p><h2>{p.name}</h2></div><Brand settings={s} /></header>
      <section className={`location-dossier ${p.locationAnalysisImage ? 'has-analysis-image' : ''}`}><div className="location-visual"><Photo src={p.locationAnalysisImage || p.mapImage} label={p.locationAnalysisImage ? '입지분석 이미지' : '위치지도'} /></div><div className="location-copy"><p className="mini-label">LOCATION ANALYSIS</p><h3>입지 및 상권 분석</h3><p>{p.locationAnalysis || '입지분석 이미지와 주요 시설 정보를 등록하면 이 영역에 함께 표시됩니다.'}</p><div className="facility-list">{[p.nearbyStation, ...lines(p.features)].filter(Boolean).slice(0, 5).map((item, i) => <div key={i}><span>{String(i + 1).padStart(2, '0')}</span>{item}</div>)}</div></div></section>
      <section className="analysis-layout">
        <div className="analysis-transactions"><TextBlock title="인근 거래사례" value={p.nearbyTransactions} limit={3} /></div>
        <div className="analysis-price"><TextBlock title="가격 분석" value={unitPrice ? `입력된 매매가와 대지면적 기준 평당 ${formatWon(unitPrice)}입니다.` : '가격 또는 대지면적 입력이 필요합니다.'} accent limit={2} /></div>
        <div><TextBlock title="투자 포인트" value={p.investmentPoints} accent limit={3} /></div>
        <div><TextBlock title="개발 계획" value={p.developmentPlan} limit={3} /></div>
        <div><TextBlock title="추천 용도" value={p.recommendedUse} limit={3} /></div>
        <div><TextBlock title="리스크" value={p.risks} limit={3} /></div>
        <div className="analysis-summary"><TextBlock title="종합 의견" value={p.overallOpinion} accent limit={4} />{additionalImages.length > 0 && <div className="analysis-thumbs">{additionalImages.slice(0, 2).map((src, index) => <Photo key={index} src={src} label={`현장사진 ${index + 1}`} />)}</div>}</div>
      </section>
      <footer><span>{s.footerText}</span><b>{s.companyName}</b></footer>
    </article>
  </div>;
}

export function DaonOnePageMaster({ property: p, settings: s, layout }: { property: Property; settings: Settings; layout: 'portrait' | 'landscape' }) {
  const unitPrice = pricePerPyeong(p);
  const statuses: [string, string][] = [['명도', p.occupancyStatus || '협의 필요'], ['사용 가능', p.occupancyStatus.includes('완료') ? '즉시 검토 가능' : '일정 협의'], ['코너부지', p.roadCondition.includes('코너') ? '코너 입지' : '현장 확인'], ['투자가치', p.investmentPoints ? '투자 검토 추천' : '분석 필요']];
  const buildingInfo: [string, string][] = [['주소', p.address], ['교통', [p.nearbyStation, p.stationDistance].filter(Boolean).join(' · ')], ['대지면적', formatArea(p.landAreaPyeong)], ['연면적', formatArea(p.totalFloorAreaPyeong)], ['용도지역', p.zoning], ['도로', p.roadCondition], ['규모', floorText(p)], ['준공', p.completionDate], ['건폐율', p.buildingCoverageRate ? `${p.buildingCoverageRate}%` : '-'], ['용적률', p.floorAreaRatio ? `${p.floorAreaRatio}%` : '-'], ['주차', p.parkingSpaces ? `${p.parkingSpaces}대` : '-'], ['승강기', p.elevator]];
  return <div className={`proposal-v2 document proposal-${layout}`} data-template-id={DAON_ONE_PAGE_MASTER_TEMPLATE_ID} data-template-version={DAON_ONE_PAGE_MASTER_TEMPLATE_VERSION}><article className={`a4 ${layout} proposal-sheet`}>
    <header className="proposal-v2-head"><div className="deal-chip">{p.tradeType}</div><div><p>EXCLUSIVE PROPERTY OFFER</p><h1>{p.name}</h1></div><div className="proposal-agent"><small>PROPERTY MANAGER</small><b>{p.managerName || s.defaultManager}</b><span>{p.managerPhone || s.phone}</span></div><Brand settings={s} /></header>
    <section className="proposal-price"><div><small>OFFER PRICE</small><strong>{p.tradeType === '매매' ? formatWon(p.salePrice) : `보증금 ${formatWon(p.deposit)} · 월 ${formatWon(p.monthlyRent)}`}</strong></div><div><small>LAND UNIT PRICE</small><b>{formatWon(unitPrice)}<em>/ 3.3㎡</em></b></div><span>{p.negotiable ? '가격 협의 가능' : '제시 조건'}</span><span>{p.occupancyStatus || '명도 협의'}</span></section>
    <section className="status-grid">{statuses.map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}</section>
    <section className="proposal-showcase"><Photo src={p.mainImage} label="대표 외관사진" className="proposal-main-photo" /><div className="proposal-points"><p className="mini-label">KEY HIGHLIGHTS</p><h2>핵심 포인트</h2><ol>{corePoints(p).map((point, index) => <li key={index}><span>{String(index + 1).padStart(2, '0')}</span><b>{point}</b></li>)}</ol></div></section>
    <section className="proposal-details"><div><h3 className="section-title">PROPERTY INFORMATION</h3><InfoGrid className="proposal-info" items={buildingInfo} /></div><div className="proposal-location"><Photo src={p.mapImage} label="위치지도" /><small>LOCATION MAP</small></div></section>
    <MetricStrip items={[['입지우수', short(p.locationAnalysis, '상권 접근성 검토')], ['개발호재', short(p.developmentPlan, '주변 개발계획 검토')], ['가격경쟁력', unitPrice ? `평당 ${formatWon(unitPrice)}` : '비교 검토'], ['투자활용성', short(p.recommendedUse, '다양한 활용 가능')]]} />
    <footer className="proposal-v2-footer"><div><b>{p.managerName || s.defaultManager}</b><span>{p.managerPhone || s.phone}</span><span>{p.managerEmail || s.email}</span><small>{s.companyName}</small></div><p>{s.footerText}<small>Updated {new Date(p.updatedAt).toLocaleDateString('ko-KR')}</small></p><QRCodeSVG value={`${location.origin}/document/proposal/${p.id}`} size={58} /></footer>
  </article></div>;
}
