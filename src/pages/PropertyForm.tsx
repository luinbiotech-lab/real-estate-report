import { useEffect, useState, type ChangeEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AddRounded, ArrowBackRounded, CloudUploadOutlined, DeleteOutlineRounded, SaveRounded } from '@mui/icons-material';
import { Alert, Button, Checkbox, CircularProgress, FormControlLabel, MenuItem, TextField } from '@mui/material';
import MapAutomationPanel from '../components/MapAutomationPanel';
import ExteriorVerificationPanel from '../components/ExteriorVerificationPanel';
import BrandMapEditor from '../components/BrandMapEditor';
import PropertyPublicDiscoveryPanel from '../components/PropertyPublicDiscoveryPanel';
import MarketPresencePanel from '../components/MarketPresencePanel';
import { propertyRepository } from '../repositories/propertyRepository';
import { BRIEFING_CATEGORIES } from '../services/briefingService';
import { streetViewProvenanceService } from '../services/streetViewProvenanceService';
import { publicPropertyDiscoveryService, type PropertyDiscoveryResult } from '../services/publicPropertyDiscoveryService';
import { marketPresenceService } from '../services/marketPresenceService';
import { buildPropertyToSave, parseNonNegativeNumberInput, type EditFormLoadState } from '../domain/propertyDetail/propertyDetailModel';
import { emptyProperty, type BriefingItem, type BrandMapSettings, type Property, type Settings, type StreetViewVerification } from '../types';

type Field = { label: string; key: keyof Property; type?: string };
type ChangeValue = string | number | boolean | string[] | BriefingItem[] | BrandMapSettings | StreetViewVerification;
const sections: Record<string, Field[]> = {
  기본정보: [{ label: '물건번호', key: 'propertyNumber' }, { label: '물건명 *', key: 'name' }, { label: '건물명', key: 'buildingName' }, { label: '거래유형 *', key: 'tradeType' }],
  거래정보: [{ label: '매매가 (원)', key: 'salePrice', type: 'number' }, { label: '보증금 (원)', key: 'deposit', type: 'number' }, { label: '월세 (원)', key: 'monthlyRent', type: 'number' }, { label: '명도상태', key: 'occupancyStatus' }],
  '주소 및 입지': [{ label: '주소 *', key: 'address' }, { label: '상세주소', key: 'detailAddress' }, { label: '인근역', key: 'nearbyStation' }, { label: '역 거리', key: 'stationDistance' }, { label: '도로조건', key: 'roadCondition' }],
  '토지 / 건물': [{ label: '대지면적 평', key: 'landAreaPyeong', type: 'number' }, { label: '대지면적 ㎡', key: 'landAreaSqm', type: 'number' }, { label: '개별공시지가 (원/㎡)', key: 'officialLandPricePerSqm', type: 'number' }, { label: '공시지가 총액 추정 (원)', key: 'estimatedOfficialLandValue', type: 'number' }, { label: '공시지가 기준연도', key: 'officialLandPriceYear' }, { label: '지목', key: 'landCategory' }, { label: '토지이용상황', key: 'landUseSituation' }, { label: '연면적 평', key: 'totalFloorAreaPyeong', type: 'number' }, { label: '연면적 ㎡', key: 'totalFloorAreaSqm', type: 'number' }, { label: '건축면적 평', key: 'buildingAreaPyeong', type: 'number' }, { label: '용도지역', key: 'zoning' }, { label: '주용도', key: 'mainUse' }, { label: '구조', key: 'structure' }, { label: '지하층', key: 'basementFloors', type: 'number' }, { label: '지상층', key: 'groundFloors', type: 'number' }, { label: '준공일', key: 'completionDate', type: 'date' }, { label: '건폐율 %', key: 'buildingCoverageRate', type: 'number' }, { label: '용적률 %', key: 'floorAreaRatio', type: 'number' }, { label: '승강기', key: 'elevator' }, { label: '주차대수', key: 'parkingSpaces', type: 'number' }],
  담당자: [{ label: '담당자명', key: 'managerName' }, { label: '전화번호', key: 'managerPhone' }, { label: '이메일', key: 'managerEmail', type: 'email' }, { label: '회사명', key: 'companyName' }],
};
const analysisFields: Field[] = [{ label: '특징', key: 'features' }, { label: '투자포인트', key: 'investmentPoints' }, { label: '입지분석', key: 'locationAnalysis' }, { label: '개발계획', key: 'developmentPlan' }, { label: '추천용도', key: 'recommendedUse' }, { label: '리스크', key: 'risks' }, { label: '종합의견', key: 'overallOpinion' }, { label: '인근거래사례', key: 'nearbyTransactions' }];

export default function PropertyForm({ settings }: { settings: Settings }) {
  const { id } = useParams(); const navigate = useNavigate(); const location = useLocation();
  const [property, setProperty] = useState<Property>({ ...emptyProperty, managerName: settings.defaultManager, managerPhone: settings.phone, managerEmail: settings.email, companyName: settings.companyName });
  const [error, setError] = useState('');
  const [discoveryResult, setDiscoveryResult] = useState<PropertyDiscoveryResult>();
  // Edit mode must not show (or save) the blank default form as if it were the record being edited.
  const [loadState, setLoadState] = useState<EditFormLoadState>(id ? 'loading' : 'new');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (id) {
      let cancelled = false;
      setLoadState('loading'); setError('');
      propertyRepository.getById(id)
        .then((value) => {
          if (cancelled) return;
          if (!value || value.id !== id) { setLoadState('not_found'); return; }
          setProperty({ ...emptyProperty, ...value, briefingItems: value.briefingItems ?? [] });
          setLoadState('ready');
        })
        .catch((reason: unknown) => {
          if (cancelled) return;
          setError(reason instanceof Error ? reason.message : '물건 정보를 불러오지 못했습니다.');
          setLoadState('error');
        });
      return () => { cancelled = true; };
    }
    setLoadState('new');
    const state = location.state as { discoveryResult?: PropertyDiscoveryResult; discoveryPatch?: Partial<Property> } | null;
    if (state?.discoveryResult) {
      setDiscoveryResult(state.discoveryResult);
      setProperty((previous) => ({ ...previous, ...(state.discoveryPatch ?? publicPropertyDiscoveryService.patchFrom(state.discoveryResult!)) }));
    }
  }, [id, location.state]);
  const change = (key: keyof Property, value: ChangeValue) => setProperty((previous) => { const next = { ...previous, [key]: value }; if (key === 'landAreaPyeong') next.landAreaSqm = Math.round(Number(value) * 3.3058 * 100) / 100; if (key === 'landAreaSqm') next.landAreaPyeong = Math.round(Number(value) / 3.3058 * 100) / 100; if (key === 'totalFloorAreaPyeong') next.totalFloorAreaSqm = Math.round(Number(value) * 3.3058 * 100) / 100; if (key === 'totalFloorAreaSqm') next.totalFloorAreaPyeong = Math.round(Number(value) / 3.3058 * 100) / 100; return next; });
  const upload = (key: 'mainImage' | 'mapImage' | 'locationAnalysisImage' | 'additionalImages', event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const files = [...(input.files || [])];
    Promise.all(files.map((file) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error ?? new Error(`${file.name} 파일을 읽지 못했습니다.`)); reader.readAsDataURL(file); })))
      // Functional update: edits made while files were being read must not be overwritten by a stale snapshot.
      .then((urls) => setProperty((previous) => ({ ...previous, [key]: key === 'additionalImages' ? [...previous.additionalImages, ...urls] : urls[0] || '' })))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : '이미지 파일을 읽지 못했습니다.'))
      .finally(() => { input.value = ''; });
  };
  const makeAdditionalPrimary = (index: number) => { const selected = property.additionalImages[index]; if (!selected) return; const remaining = property.additionalImages.filter((_, itemIndex) => itemIndex !== index); change('additionalImages', property.mainImage ? [property.mainImage, ...remaining] : remaining); change('mainImage', selected); };
  const addBriefingItem = () => change('briefingItems', [...property.briefingItems, { category: 'fashion', name: '', description: '', source: 'manual' }]);
  const updateBriefingItem = (index: number, patch: Partial<BriefingItem>) => change('briefingItems', property.briefingItems.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const removeBriefingItem = (index: number) => change('briefingItems', property.briefingItems.filter((_, itemIndex) => itemIndex !== index));
  const save = async () => {
    if (saving) return;
    if (!property.name || !property.address || !property.tradeType) { setError('물건명, 주소, 거래유형은 필수입니다.'); return; }
    setError(''); setSaving(true);
    try {
      const data = buildPropertyToSave(property, id, loadState, new Date().toISOString(), () => crypto.randomUUID());
      await (id ? propertyRepository.update(data) : propertyRepository.create(data));
      if (discoveryResult) await publicPropertyDiscoveryService.persist(data.id, discoveryResult);
      await marketPresenceService.persist(data);
      await streetViewProvenanceService.ensure(data);
      // Address → registration → Data Room: land on the saved property hub, new or edited.
      navigate(`/property/${encodeURIComponent(data.id)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '물건 저장에 실패했습니다.');
    } finally { setSaving(false); }
  };
  if (id && loadState === 'loading') return <div className="center"><CircularProgress /><p>물건 정보를 불러오는 중입니다.</p></div>;
  if (id && (loadState === 'not_found' || loadState === 'error')) return <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => navigate('/')}>물건 목록</Button>}>{loadState === 'not_found' ? '수정할 물건을 찾을 수 없습니다. 저장하면 새 물건이 만들어지므로 편집 화면을 열지 않았습니다.' : `물건 정보를 불러오지 못했습니다. ${error}`}</Alert>;
  return <><header className="page-header compact"><div><Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/')}>목록으로</Button><h1>{id ? '물건 수정' : '개별 물건 등록'}</h1><p>입력한 하나의 물건 데이터가 보고서·제안서·입지 브리핑에 함께 반영됩니다.</p></div><Button className="form-save-button" variant="contained" startIcon={<SaveRounded />} onClick={save} disabled={saving}>저장하기</Button></header>{error && <div className="error-banner">{error}</div>}<div className="form-layout"><div>
    <PropertyPublicDiscoveryPanel
      property={property}
      onResolved={setDiscoveryResult}
      onApply={(patch) => setProperty((previous) => ({ ...previous, ...patch }))}
    />
    {Object.entries(sections).map(([title, fields]) => <section className="form-section" key={title}><h2>{title}</h2><div className="field-grid">{fields.map((field) => field.key === 'tradeType' ? <TextField select key={field.key} label={field.label} value={property.tradeType} onChange={(event) => change(field.key, event.target.value)}>{['매매', '전세', '월세'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField> : <TextField key={field.key} label={field.label} type={field.type || 'text'} value={String(property[field.key] ?? '')} InputLabelProps={field.type === 'date' ? { shrink: true } : undefined} onChange={(event) => { if (field.type !== 'number') { change(field.key, event.target.value); return; } const parsed = parseNonNegativeNumberInput(event.target.value); if (parsed !== undefined) change(field.key, parsed); }} inputProps={field.type === 'number' ? { min: 0 } : undefined} />)}</div>{title === '거래정보' && <FormControlLabel control={<Checkbox checked={property.negotiable} onChange={(event) => change('negotiable', event.target.checked)} />} label="가격 협의 가능" />}</section>)}
    <MarketPresencePanel property={property} onChange={(patch) => setProperty((previous) => ({ ...previous, ...patch }))} />
    <MapAutomationPanel property={property} change={change} />
    <section className="form-section"><h2>분석 / 설명</h2><div className="field-grid textareas">{analysisFields.map((field) => <TextField key={field.key} multiline minRows={3} label={field.label} value={String(property[field.key])} onChange={(event) => change(field.key, event.target.value)} />)}</div></section>
    <section className="form-section briefing-form"><div className="section-heading-row"><div><h2>입지 브리핑 정보</h2><p>확인된 브랜드·시설만 입력하세요. 카카오 후보와 수동 입력 항목은 함께 보존됩니다.</p></div><Button startIcon={<AddRounded />} onClick={addBriefingItem}>항목 추가</Button></div>{property.briefingItems.length ? <div className="briefing-item-list">{property.briefingItems.map((item, index) => <div className="briefing-item-row" key={index}><TextField select label="카테고리" value={item.category} onChange={(event) => updateBriefingItem(index, { category: event.target.value as BriefingItem['category'] })}>{BRIEFING_CATEGORIES.map((category) => <MenuItem key={category.key} value={category.key}>{category.label}</MenuItem>)}</TextField><TextField label="항목명" value={item.name} onChange={(event) => updateBriefingItem(index, { name: event.target.value })} /><TextField label={item.source === 'kakao' ? '간단 설명 · 카카오 후보' : '간단 설명'} value={item.description} onChange={(event) => updateBriefingItem(index, { description: event.target.value })} /><Button color="error" aria-label={`브리핑 항목 ${index + 1} 삭제`} onClick={() => removeBriefingItem(index)}><DeleteOutlineRounded /></Button></div>)}</div> : <div className="briefing-empty-form">아직 입력된 브리핑 항목이 없습니다.</div>}</section>
    <BrandMapEditor property={property} onSettings={(value) => change('brandMapSettings', value)} onItems={(value) => change('briefingItems', value)} />
  </div><aside className="upload-panel"><h2>이미지</h2><ExteriorVerificationPanel property={property} onVerified={(value) => change('streetViewVerification', value)} /><ImageUpload label="대표사진" value={property.mainImage} multiple={false} onChange={(event) => upload('mainImage', event)} onRemove={() => change('mainImage', '')} />{([['mapImage', '위치지도'], ['locationAnalysisImage', '입지분석 이미지']] as const).map(([key, label]) => <ImageUpload key={key} label={label} value={property[key]} multiple={false} onChange={(event) => upload(key, event)} onRemove={() => change(key, '')} />)}<ImageUpload label="추가사진" value={property.additionalImages} multiple onChange={(event) => upload('additionalImages', event)} onRemove={(index) => change('additionalImages', property.additionalImages.filter((_, itemIndex) => itemIndex !== index))} onMakePrimary={makeAdditionalPrimary} /></aside></div></>;
}

function ImageUpload({ label, value, multiple, onChange, onRemove, onMakePrimary }: { label: string; value: string | string[]; multiple: boolean; onChange: (event: ChangeEvent<HTMLInputElement>) => void; onRemove: (index?: number) => void; onMakePrimary?: (index: number) => void }) { const images = Array.isArray(value) ? value : value ? [value] : []; return <div className="uploader"><b>{label}</b>{images.map((src, index) => <div className="thumb" key={index}><img src={src} alt={`${label} 미리보기`} /><div className="thumb-actions">{onMakePrimary && <button type="button" onClick={() => onMakePrimary(index)}>대표 지정</button>}<button type="button" onClick={() => onRemove(index)}>삭제</button></div></div>)}<Button component="label" size="small" startIcon={<CloudUploadOutlined />}>{images.length && !multiple ? '교체' : '이미지 선택'}<input hidden type="file" accept="image/*" multiple={multiple} onChange={onChange} /></Button></div>; }
