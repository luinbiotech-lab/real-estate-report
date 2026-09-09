import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, CircularProgress } from '@mui/material';
import { ArrowBackRounded, PrintRounded } from '@mui/icons-material';
import { useReactToPrint } from 'react-to-print';
import { propertyRepository } from '../repositories/propertyRepository';
import type { Property, Settings } from '../types';
import { Brand } from './DocumentPreview';
import BrandMapRenderer from '../components/BrandMapRenderer';
import { createBrandMapModel } from '../services/locationIntelligence/brandMapService';

function DaonBrand() {
  return <div className="wordmark daon-wordmark"><i>D</i><span>DA:ON ASSET<small>REAL ESTATE ADVISORY</small></span></div>;
}

export default function PropertyBriefingPage({ settings }: { settings: Settings }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState<Property>();
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (id) propertyRepository.getById(id).then(setProperty); }, [id]);
  const print = useReactToPrint({ contentRef, documentTitle: property ? `${property.name}_입지브리핑` : '입지브리핑' });
  if (!property) return <div className="center"><CircularProgress /></div>;
  const model = createBrandMapModel(property);
  const updated = new Date(property.briefingUpdatedAt || property.updatedAt).toLocaleDateString('ko-KR');
  const isDaon = property.companyName === 'DA:ON ASSET';
  const footerText = isDaon ? '본 자료는 매각 검토용 참고자료이며 계약 전 최신 공부·권리관계·현장·인허가 사항 확인이 필요합니다.' : settings.footerText;
  return <div className="preview-shell briefing-preview"><div className="preview-toolbar"><Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/')}>물건 목록</Button><div><b>입지 브리핑</b><small>A4 가로 · 선택 POI 기반 Location Intelligence</small></div><Button variant="contained" startIcon={<PrintRounded />} onClick={print}>인쇄 / PDF 저장</Button></div><div className="paper-stage"><div ref={contentRef}><article className="a4 landscape briefing-sheet brand-map-sheet"><header><div><p>PROPERTY LOCATION & BRAND MAP</p><h1>{property.name}</h1><span>{property.address}</span></div><div className="briefing-date"><small>REFERENCE DATE</small><b>{updated}</b></div></header><main>{model ? <BrandMapRenderer model={model} fallbackImage={property.mapImage} /> : <div className="brand-map-unavailable">좌표를 적용하면 자동 브랜드맵을 생성할 수 있습니다.</div>}</main>{model && <div className="location-summary"><div><small>SELECTED POI</small><b>{model.selectedCount}개</b></div><div><small>WITHIN 500M</small><b>{model.summary.within500m}개</b></div><div><small>NEAREST</small><b>{model.summary.nearest ? `${model.summary.nearest.name} · ${model.summary.nearest.distanceMeters}m` : '-'}</b></div><div><small>TRANSPORT / F&B</small><b>{model.summary.transportCount} / {model.summary.foodCount}</b></div></div>}<footer>{isDaon ? <DaonBrand /> : <Brand settings={settings} />}<div><small>PROPERTY MANAGER</small><b>{property.managerName || settings.defaultManager}</b><span>{property.managerPhone || settings.phone}</span><span>{property.managerEmail || settings.email}</span></div><p>{footerText}<small>작성 기준일 {updated} · 사용자 선택 및 확인 데이터 기준</small></p></footer></article>{property.locationAnalysisImage && <aside className="manual-analysis-note">수동 입지분석 이미지는 보존되어 투자분석보고서에서 계속 사용됩니다.</aside>}</div></div></div>;
}
