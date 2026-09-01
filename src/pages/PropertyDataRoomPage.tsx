import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowBackRounded, CloudUploadOutlined, DeleteOutlineRounded, DescriptionOutlined, DownloadRounded, EditOutlined, MapOutlined, PictureAsPdfOutlined } from '@mui/icons-material';
import { Alert, Button, Chip, CircularProgress, MenuItem, Tab, Tabs, TextField } from '@mui/material';
import { DOCUMENT_TYPE_LABELS, SOURCE_TYPE_LABELS, VERIFICATION_LABELS } from '../domain/propertyDataRoom/labels';
import type { DataRoomBundle, DocumentType, PropertyDocument, VerificationStatus } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { propertyRepository } from '../repositories/propertyRepository';
import { propertyDataRoomService } from '../services/propertyDataRoomService';
import type { Property } from '../types';
import { formatArea, formatWon } from '../utils/format';

type TabKey = 'overview' | 'media' | 'documents' | 'official' | 'reports' | 'digitalTwin';
const emptyBundle: DataRoomBundle = { documents: [], media: [], verifications: [], dataSources: [], reportSnapshots: [], digitalTwinAssets: [] };
const officialTypes: DocumentType[] = ['building_register', 'land_register', 'land_use_plan', 'registry', 'cadastral_map'];

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="data-room-empty"><DescriptionOutlined /><h3>{title}</h3><p>{detail}</p></div>;
}

function VerificationBadge({ status }: { status: VerificationStatus }) {
  return <span className={`verification-badge status-${status}`}>{VERIFICATION_LABELS[status]}</span>;
}

export default function PropertyDataRoomPage() {
  const { id = '' } = useParams(); const navigate = useNavigate();
  const [property, setProperty] = useState<Property>(); const [bundle, setBundle] = useState<DataRoomBundle>(emptyBundle);
  const [tab, setTab] = useState<TabKey>('overview'); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false); const [documentType, setDocumentType] = useState<DocumentType>('building_register');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const item = await propertyRepository.getById(id);
      if (!item) { setError('요청한 물건을 찾을 수 없습니다.'); return; }
      setProperty(item); setBundle(await propertyDataRoomService.getBundle(id));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Data Room 자료를 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => property ? propertyDataRoomService.summarize(property, bundle) : undefined, [property, bundle]);
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    setUploading(true); setError('');
    try { await propertyDataRoomService.uploadDocument(id, file, { documentType, title: file.name.replace(/\.[^.]+$/, ''), sourceName: '사용자 업로드' }); await load(); setTab('documents'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '문서를 등록하지 못했습니다.'); }
    finally { setUploading(false); event.target.value = ''; }
  };
  const removeDocument = async (document: PropertyDocument) => {
    if (!confirm(`“${document.title}” 문서를 삭제할까요? 파일 본문은 복구되지 않습니다.`)) return;
    await propertyDataRoomRepository.deleteDocument(document.id); await load();
  };
  const changeVerification = async (document: PropertyDocument, status: VerificationStatus) => {
    const now = new Date().toISOString();
    await propertyDataRoomRepository.updateDocument({ ...document, verificationStatus: status, verifiedAt: status === 'verified' ? now : undefined, updatedAt: now }); await load();
  };

  if (loading) return <div className="center"><CircularProgress /><p>Property Data Room을 불러오는 중입니다.</p></div>;
  if (!property) return <main className="data-room-error"><Alert severity="error">{error || '요청한 물건을 찾을 수 없습니다.'}</Alert><Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/')}>물건 목록</Button></main>;

  const photos = [
    property.mainImage && { id: 'main', url: property.mainImage, label: '대표사진', primary: true },
    ...property.additionalImages.map((url, index) => ({ id: `additional-${index}`, url, label: `추가사진 ${index + 1}`, primary: false })),
    property.mapImage && { id: 'map', url: property.mapImage, label: '위치지도', primary: false },
    property.locationAnalysisImage && { id: 'analysis', url: property.locationAnalysisImage, label: '입지분석', primary: false },
    ...bundle.media.filter((item) => item.url).map((item) => ({ id: item.id, url: item.url!, label: item.caption || item.fileName, primary: item.isPrimary })),
  ].filter(Boolean) as { id: string; url: string; label: string; primary: boolean }[];
  const officialDocuments = bundle.documents.filter((item) => officialTypes.includes(item.documentType));

  return <main className="data-room-page">
    <header className="data-room-header"><div><Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/')}>물건 목록</Button><p className="eyebrow">PROPERTY DATA ROOM</p><h1>{property.name}</h1><p>{property.address} · {property.propertyNumber || '물건번호 미입력'}</p></div><div className="actions"><Button startIcon={<EditOutlined />} onClick={() => navigate(`/property/${property.id}/edit`)}>물건 수정</Button><Button variant="contained" startIcon={<DescriptionOutlined />} onClick={() => navigate(`/document/report/${property.id}`)}>투자분석보고서</Button></div></header>
    {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
    <section className="data-room-summary">
      {[['문서', summary?.documents ?? 0, '건'], ['사진', summary?.media ?? 0, '개'], ['공식확인', summary?.officiallyVerified ?? 0, '건'], ['확인 필요', summary?.unverified ?? 0, '건'], ['보고서', summary?.reports ?? 0, '건'], ['3D', summary?.digitalTwin ? `${summary.digitalTwin}건` : '미연결', '']].map(([label, value, unit]) => <div key={label}><small>{label}</small><strong>{value}</strong><span>{unit}</span></div>)}
      <div className={summary?.reportReady ? 'ready' : 'attention'}><small>보고서 준비도</small><strong>{summary?.reportReady ? '핵심자료 충족' : `${summary?.missingDocumentTypes.length ?? 0}개 자료 필요`}</strong></div>
    </section>
    <section className="data-room-workspace"><Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" aria-label="Property Data Room 메뉴">
      <Tab value="overview" label="개요" /><Tab value="media" label="사진" /><Tab value="documents" label="문서" /><Tab value="official" label="공적자료" /><Tab value="reports" label="보고서" /><Tab value="digitalTwin" label="3D" />
    </Tabs>
    <div className="data-room-content">
      {tab === 'overview' && <Overview property={property} bundle={bundle} missing={summary?.missingDocumentTypes ?? []} onTab={setTab} />}
      {tab === 'media' && (photos.length ? <div className="data-room-gallery">{photos.map((photo) => <figure key={photo.id}><img src={photo.url} alt={photo.label} /><figcaption>{photo.label}{photo.primary && <Chip size="small" label="대표" />}</figcaption></figure>)}</div> : <EmptyState title="등록된 사진이 없습니다." detail="물건 수정 화면에서 직접 촬영하거나 보유한 사진을 등록하세요." />)}
      {tab === 'documents' && <DocumentPanel documents={bundle.documents} documentType={documentType} setDocumentType={setDocumentType} upload={upload} uploading={uploading} remove={removeDocument} changeVerification={changeVerification} />}
      {tab === 'official' && <OfficialPanel documents={officialDocuments} sources={bundle.dataSources} />}
      {tab === 'reports' && <ReportPanel property={property} snapshots={bundle.reportSnapshots} navigate={navigate} />}
      {tab === 'digitalTwin' && (bundle.digitalTwinAssets.length ? <div className="asset-list">{bundle.digitalTwinAssets.map((asset) => <article key={asset.id}><b>{asset.assetType}</b><span>{asset.fileFormat} · v{asset.version}</span><Chip size="small" label={asset.processingStatus} /></article>)}</div> : <EmptyState title="Digital Twin 데이터가 연결되지 않았습니다." detail="도면·360 사진·3D 모델을 연결할 수 있는 저장 구조만 준비되어 있습니다." />)}
    </div></section>
  </main>;
}

function Overview({ property, bundle, missing, onTab }: { property: Property; bundle: DataRoomBundle; missing: DocumentType[]; onTab: (tab: TabKey) => void }) {
  const overview = [['거래유형', property.tradeType], ['매매가', formatWon(property.salePrice)], ['대지면적', formatArea(property.landAreaPyeong)], ['용도지역', property.zoning || '-'], ['담당자', property.managerName || '-'], ['최종 수정', new Date(property.updatedAt).toLocaleDateString('ko-KR')]];
  return <div className="data-room-overview"><section><div className="section-heading-row"><div><p className="eyebrow">PROPERTY PROFILE</p><h2>물건 개요</h2></div><VerificationBadge status="confirmed" /></div><dl>{overview.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section><section><p className="eyebrow">READINESS CHECK</p><h2>자료 준비 현황</h2>{missing.length ? <><p className="readiness-copy">보고서의 근거자료 완성도를 높이려면 아래 자료를 확인해 주세요.</p><div className="missing-list">{missing.map((type) => <span key={type}>{DOCUMENT_TYPE_LABELS[type]} <VerificationBadge status="missing" /></span>)}</div><Button onClick={() => onTab('documents')}>문서 등록하기</Button></> : <Alert severity="success">필수 공적자료가 모두 등록되어 있습니다.</Alert>}</section><section><p className="eyebrow">DATA QUALITY</p><h2>출처와 검증</h2>{bundle.dataSources.length || bundle.verifications.length ? <p>{bundle.dataSources.length}개 출처 · {bundle.verifications.length}개 필드 검증 기록</p> : <EmptyState title="검증 이력이 없습니다." detail="공식자료와 데이터 출처가 연결되면 이곳에서 신뢰도를 확인할 수 있습니다." />}</section></div>;
}

function DocumentPanel({ documents, documentType, setDocumentType, upload, uploading, remove, changeVerification }: { documents: PropertyDocument[]; documentType: DocumentType; setDocumentType: (value: DocumentType) => void; upload: (event: ChangeEvent<HTMLInputElement>) => void; uploading: boolean; remove: (item: PropertyDocument) => void; changeVerification: (item: PropertyDocument, status: VerificationStatus) => void }) {
  return <><div className="document-toolbar"><div><h2>문서 자료</h2><p>파일 본문과 출처·검증 메타데이터를 분리해 관리합니다.</p></div><TextField select size="small" label="문서 분류" value={documentType} onChange={(event) => setDocumentType(event.target.value as DocumentType)}>{Object.entries(DOCUMENT_TYPE_LABELS).map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}</TextField><Button component="label" variant="contained" startIcon={<CloudUploadOutlined />} disabled={uploading}>{uploading ? '등록 중…' : '문서 등록'}<input hidden type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={upload} /></Button></div>{documents.length ? <div className="document-list">{documents.map((document) => <article key={document.id}><div className="file-icon"><DescriptionOutlined /></div><div><b>{document.title}</b><span>{DOCUMENT_TYPE_LABELS[document.documentType]} · {(document.fileSize / 1024 / 1024).toFixed(2)}MB · v{document.version}</span><small>{document.sourceName} · {new Date(document.uploadedAt).toLocaleDateString('ko-KR')}</small></div><TextField select size="small" value={document.verificationStatus} onChange={(event) => changeVerification(document, event.target.value as VerificationStatus)} aria-label={`${document.title} 검증 상태`}>{Object.entries(VERIFICATION_LABELS).map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}</TextField><Button startIcon={<DownloadRounded />} onClick={() => propertyDataRoomService.downloadDocument(document)}>다운로드</Button><Button color="error" startIcon={<DeleteOutlineRounded />} onClick={() => remove(document)}>삭제</Button></article>)}</div> : <EmptyState title="등록된 문서가 없습니다." detail="건축물대장, 토지대장, 등기부등본 등 확인된 원본 자료를 등록하세요." />}</>;
}

function OfficialPanel({ documents, sources }: { documents: PropertyDocument[]; sources: DataRoomBundle['dataSources'] }) {
  return <div><h2>공적자료 및 데이터 출처</h2><p className="readiness-copy">공식 문서와 외부 데이터의 출처·기준일·검증 상태를 구분합니다.</p>{documents.length || sources.length ? <div className="official-grid">{documents.map((item) => <article key={item.id}><b>{DOCUMENT_TYPE_LABELS[item.documentType]}</b><span>{item.title}</span><VerificationBadge status={item.verificationStatus} /></article>)}{sources.map((source) => <article key={source.id}><b>{source.sourceName}</b><span>{SOURCE_TYPE_LABELS[source.sourceType]} · {source.sourceDate || source.collectedAt.slice(0, 10)}</span><VerificationBadge status={source.verificationStatus} /></article>)}</div> : <EmptyState title="등록된 공적자료가 없습니다." detail="문서 탭에서 공적자료를 등록하면 출처와 검증 상태가 함께 표시됩니다." />}</div>;
}

function ReportPanel({ property, snapshots, navigate }: { property: Property; snapshots: DataRoomBundle['reportSnapshots']; navigate: ReturnType<typeof useNavigate> }) {
  return <div><div className="document-toolbar"><div><h2>보고서 및 스냅샷</h2><p>기존 문서는 유지되며, 향후 생성본은 당시 데이터를 고정한 스냅샷으로 관리합니다.</p></div><Button startIcon={<DescriptionOutlined />} onClick={() => navigate(`/document/report/${property.id}`)}>투자분석보고서</Button><Button startIcon={<PictureAsPdfOutlined />} onClick={() => navigate(`/document/proposal/${property.id}`)}>고객 제안서</Button><Button startIcon={<MapOutlined />} onClick={() => navigate(`/properties/${property.id}/briefing`)}>입지 브리핑</Button></div>{snapshots.length ? <div className="document-list">{snapshots.map((snapshot) => <article key={snapshot.id}><div className="file-icon"><PictureAsPdfOutlined /></div><div><b>{snapshot.reportType}</b><span>보고서 v{snapshot.reportVersion} · 템플릿 {snapshot.templateVersion}</span><small>{new Date(snapshot.generatedAt).toLocaleString('ko-KR')}</small></div><Chip label={snapshot.status} size="small" /></article>)}</div> : <EmptyState title="생성된 보고서 스냅샷이 없습니다." detail="기존 보고서는 바로 열 수 있으며, Snapshot 생성 엔진은 다음 단계에서 연결됩니다." />}</div>;
}
