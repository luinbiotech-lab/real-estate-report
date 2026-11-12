import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowBackRounded, CloudUploadOutlined, DeleteOutlineRounded, DescriptionOutlined, DownloadRounded, EditOutlined, MapOutlined, PictureAsPdfOutlined, PostAddRounded, VisibilityOutlined } from '@mui/icons-material';
import { Alert, Button, Chip, CircularProgress, MenuItem, Tab, Tabs, TextField } from '@mui/material';
import PropertyHubPage from './PropertyHubPage';
import ComparableTransactionOverviewPanel from '../components/propertyDataRoom/ComparableTransactionOverviewPanel';
import ComparableTransactionPanel from '../components/propertyDataRoom/ComparableTransactionPanel';
import DocumentExtractionPanel from '../components/propertyDataRoom/DocumentExtractionPanel';
import MediaClassificationPanel from '../components/propertyDataRoom/MediaClassificationPanel';
import PropertySpaceOverviewPanel from '../components/propertyDataRoom/PropertySpaceOverviewPanel';
import SpatialDataRoomPanel from '../components/propertyDataRoom/SpatialDataRoomPanel';
import { DOCUMENT_TYPE_LABELS, SOURCE_TYPE_LABELS, VERIFICATION_LABELS } from '../domain/propertyDataRoom/labels';
import type { DataRoomBundle, DocumentType, PropertyDocument, PropertyVerificationCandidate, VerificationDecisionStatus, VerificationStatus } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { propertyRepository } from '../repositories/propertyRepository';
import { propertyDataRoomService } from '../services/propertyDataRoomService';
import { scopeDataRoomBundle } from '../services/propertyReadinessService';
import { applyDocumentVerification, DOCUMENT_VERIFICATION_OPTIONS, documentVerificationOptions, requiresOfficialConfirmation } from '../domain/propertyDetail/dataRoomDocumentRules';
import { reportSnapshotService } from '../services/reportEngine';
import type { Property } from '../types';
import { formatArea, formatWon } from '../utils/format';

type TabKey = 'summary' | 'overview' | 'media' | 'spatial' | 'documents' | 'official' | 'market' | 'verification' | 'reports' | 'digitalTwin' | 'more';
const TAB_KEYS: TabKey[] = ['summary', 'overview', 'media', 'spatial', 'documents', 'official', 'market', 'verification', 'reports', 'digitalTwin', 'more'];
// 2026-11-12 site redesign (owner approved): one property screen = 4 tabs the user knows + 더 보기. Every former Data Room
// tab still exists under one group, so old ?tab= links open the same panel.
type GroupKey = 'summary' | 'land' | 'market' | 'files' | 'more';
const TAB_GROUPS: Array<{ key: GroupKey; label: string; tabs: TabKey[] }> = [
  { key: 'summary', label: '요약', tabs: ['summary'] },
  { key: 'land', label: '토지·건물', tabs: ['official', 'spatial'] },
  { key: 'market', label: '실거래·가격', tabs: ['market'] },
  { key: 'files', label: '자료', tabs: ['overview', 'media', 'documents', 'verification', 'reports'] },
  { key: 'more', label: '더 보기', tabs: ['more', 'digitalTwin'] },
];
const SUB_TAB_LABELS: Partial<Record<TabKey, string>> = {
  official: '공적자료·출처', spatial: '도면·층별', overview: '자료 현황', media: '사진·영상', documents: '문서', verification: '자료 검증', reports: '보고서 버전', more: '전문 기능', digitalTwin: '3D·Walkthrough',
};
export function groupOfTab(tab: TabKey): GroupKey {
  return TAB_GROUPS.find((group) => group.tabs.includes(tab))?.key ?? 'summary';
}
const emptyBundle: DataRoomBundle = { documents: [], media: [], verifications: [], verificationCandidates: [], dataSources: [], reportSnapshots: [], digitalTwinAssets: [] };
const officialTypes: DocumentType[] = ['building_register', 'land_register', 'land_use_plan', 'registry', 'cadastral_map'];

function isTabKey(value: string | null): value is TabKey {
  return !!value && TAB_KEYS.includes(value as TabKey);
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="data-room-empty"><DescriptionOutlined /><h3>{title}</h3><p>{detail}</p></div>;
}

function VerificationBadge({ status }: { status: VerificationStatus }) {
  return <span className={`verification-badge status-${status}`}>{VERIFICATION_LABELS[status]}</span>;
}

function displayCandidateValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '미입력';
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  if (Array.isArray(value)) return value.length ? value.map((item) => String(item)).join(', ') : '없음';
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
}

const DECISION_LABELS: Record<VerificationDecisionStatus, string> = {
  pending: '검토 대기', approved: '승인', held: '보류', rejected: '거절',
};

export default function PropertyDataRoomPage() {
  const { id = '' } = useParams(); const navigate = useNavigate(); const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [property, setProperty] = useState<Property>(); const [bundle, setBundle] = useState<DataRoomBundle>(emptyBundle);
  const [tab, setTab] = useState<TabKey>(() => isTabKey(requestedTab) ? requestedTab : 'summary'); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false); const [documentType, setDocumentType] = useState<DocumentType>('other');
  const [creatingReport, setCreatingReport] = useState(false); const [reviewingCandidateId, setReviewingCandidateId] = useState('');
  const [documentActionId, setDocumentActionId] = useState('');
  const [marketEditorOpen, setMarketEditorOpen] = useState(false);
  const loadRequestRef = useRef(0);
  // Property whose data is on screen. Reloading the same Property after a save refreshes in place; it used to blank the
  // page, which unmounted the panels and erased their success messages (E2E real-photo path, 2026-10-30).
  const loadedIdRef = useRef('');

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    const refresh = loadedIdRef.current === id;
    setError('');
    if (!refresh) {
      setLoading(true);
      // Never leave another Property's documents/actions visible during a route change.
      setProperty(undefined); setBundle(emptyBundle);
    }
    try {
      const item = await propertyRepository.getById(id);
      if (requestId !== loadRequestRef.current) return;
      if (!item || item.id !== id) { loadedIdRef.current = ''; setProperty(undefined); setBundle(emptyBundle); setError('요청한 물건을 찾을 수 없습니다.'); return; }
      const nextBundle = await propertyDataRoomService.getBundle(id);
      if (requestId !== loadRequestRef.current) return;
      // Repository filtering is not a boundary; never render another Property's rows here.
      setProperty(item); setBundle(scopeDataRoomBundle(nextBundle, id));
      loadedIdRef.current = id;
    } catch (reason) {
      if (requestId === loadRequestRef.current) {
        setError(reason instanceof Error ? reason.message : 'Data Room 자료를 불러오지 못했습니다.');
      }
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
    return () => { loadRequestRef.current += 1; };
  }, [load]);
  useEffect(() => {
    const nextTab = searchParams.get('tab');
    if (isTabKey(nextTab)) setTab(nextTab);
  }, [searchParams]);

  const summary = useMemo(() => property ? propertyDataRoomService.summarize(property, bundle) : undefined, [property, bundle]);
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const classified = propertyDataRoomService.classifyDocument(file.name);
    const resolvedType = classified === 'other' ? documentType : classified;
    setDocumentType(resolvedType);
    setUploading(true); setError('');
    try { await propertyDataRoomService.uploadDocument(id, file, { documentType: resolvedType, title: file.name.replace(/\.[^.]+$/, ''), sourceName: '사용자 업로드' }); await load(); setTab('documents'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '문서를 등록하지 못했습니다.'); }
    finally { setUploading(false); event.target.value = ''; }
  };
  const uploadSourceDocument = async (source: DataRoomBundle['dataSources'][number], event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const referenceForClassification = source.sourceReference || source.sourceName || file.name;
    const classifiedFromSource = propertyDataRoomService.classifyDocument(referenceForClassification);
    const classifiedFromFile = propertyDataRoomService.classifyDocument(file.name);
    const resolvedType = classifiedFromSource !== 'other' ? classifiedFromSource : classifiedFromFile !== 'other' ? classifiedFromFile : documentType;
    setDocumentType(resolvedType);
    setUploading(true); setError('');
    try {
      const savedDocument = await propertyDataRoomService.uploadDocument(id, file, {
        documentType: resolvedType,
        title: source.sourceName || file.name.replace(/\.[^.]+$/, ''),
        sourceName: source.sourceName || '사용자 업로드',
      });
      await propertyDataRoomRepository.saveDataSource({
        ...source,
        sourceReference: savedDocument.originalFileName,
        verificationStatus: 'confirmed',
        metadata: {
          ...source.metadata,
          originalSourcePresence: 'confirmed',
          binaryStorageStatus: source.metadata?.binaryStorageStatus === 'connected' ? 'connected' : 'not_connected',
          storagePath: source.metadata?.storagePath ?? null,
          sourceReviewed: source.metadata?.sourceReviewed === true,
          matchedDocumentId: savedDocument.id,
          note: source.metadata?.sourceReviewed === true
            ? '확인된 원본과 등록 파일을 연결했습니다. private Storage 연결은 Production migration에서 수행합니다.'
            : '원본 파일 등록으로 존재를 확인했습니다. 문서 내용은 별도 검증이 필요하며 private Storage 연결은 Production migration에서 수행합니다.',
        },
      });
      await load();
      setTab('official');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '원본 문서를 등록하지 못했습니다.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };
  const uploadSourceDocuments = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const inventories = bundle.dataSources.filter((source) => source.resourceType === 'source_document_inventory');
    const plans: Array<{ source: DataRoomBundle['dataSources'][number]; file: File; documentType: DocumentType }> = [];
    const matchedSourceIds = new Set<string>();
    let linkedCount = 0;

    setUploading(true); setError('');
    try {
      for (const file of files) {
        const validationError = propertyDataRoomService.validateDocument(file);
        if (validationError) throw new Error(`${file.name}: ${validationError}`);

        const normalizedFileName = normalizedSourceFileName(file.name);
        const exactMatches = inventories.filter((source) => {
          const sourceReference = typeof source.sourceReference === 'string' ? source.sourceReference : '';
          return sourceReference && normalizedSourceFileName(sourceReference) === normalizedFileName;
        });
        const classifiedFromFile = propertyDataRoomService.classifyDocument(file.name);
        const typeMatches = exactMatches.length ? [] : inventories.filter((source) => {
          const inventoryType = typeof source.metadata?.documentType === 'string' ? source.metadata.documentType : '';
          if (inventoryType === 'registry_land' || inventoryType === 'registry_building' || inventoryType === 'registry') return false;
          return classifiedFromFile !== 'other' && propertyDataRoomService.classifyDocument(source.sourceReference || source.sourceName) === classifiedFromFile;
        });
        const matches = exactMatches.length ? exactMatches : typeMatches;
        if (matches.length !== 1) {
          throw new Error(matches.length
            ? `${file.name}: 공적자료 원본 후보가 여러 개라 자동 연결할 수 없습니다.`
            : `${file.name}: source inventory와 일치하는 공적자료를 찾지 못했습니다.`);
        }

        const source = matches[0];
        if (matchedSourceIds.has(source.id)) throw new Error(`${file.name}: 같은 공적자료 source가 두 번 선택되었습니다.`);
        const existing = bundle.documents.find((document) => sourceInventoryDocumentMatches(source, document) && Boolean(document.fileData || document.fileUrl));
        if (existing) throw new Error(`${file.name}: 이미 이관 파일이 연결된 공적자료입니다 (${existing.originalFileName}).`);

        const referenceForClassification = source.sourceReference || source.sourceName || file.name;
        const classifiedFromSource = propertyDataRoomService.classifyDocument(referenceForClassification);
        const resolvedType = classifiedFromSource !== 'other'
          ? classifiedFromSource
          : classifiedFromFile !== 'other'
            ? classifiedFromFile
            : documentType;
        plans.push({ source, file, documentType: resolvedType });
        matchedSourceIds.add(source.id);
      }

      for (const plan of plans) {
        const savedDocument = await propertyDataRoomService.uploadDocument(id, plan.file, {
          documentType: plan.documentType,
          title: plan.source.sourceName || plan.file.name.replace(/\.[^.]+$/, ''),
          sourceName: plan.source.sourceName || '사용자 업로드',
        });
        await propertyDataRoomRepository.saveDataSource({
          ...plan.source,
          sourceReference: savedDocument.originalFileName,
          verificationStatus: 'confirmed',
          metadata: {
            ...plan.source.metadata,
            originalSourcePresence: 'confirmed',
            binaryStorageStatus: plan.source.metadata?.binaryStorageStatus === 'connected' ? 'connected' : 'not_connected',
            storagePath: plan.source.metadata?.storagePath ?? null,
            sourceReviewed: plan.source.metadata?.sourceReviewed === true,
            matchedDocumentId: savedDocument.id,
            note: plan.source.metadata?.sourceReviewed === true
              ? '확인된 원본과 등록 파일을 일괄 연결했습니다. private Storage 연결은 Production migration에서 수행합니다.'
              : '원본 파일 일괄 등록으로 존재를 확인했습니다. 문서 내용은 별도 검증이 필요하며 private Storage 연결은 Production migration에서 수행합니다.',
          },
        });
        linkedCount += 1;
      }

      await load();
      setTab('official');
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : '공적자료 원본을 일괄 등록하지 못했습니다.';
      // Uploads are not transactional: say how many files were already linked before the failure.
      // Reload first (load() clears the error banner), then report the partial result.
      if (linkedCount) await load().catch(() => undefined);
      setError(linkedCount ? `${linkedCount}건은 연결된 뒤 중단되었습니다. ${detail}` : detail);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };
  const removeDocument = async (document: PropertyDocument) => {
    if (documentActionId) return;
    if (!confirm(`“${document.title}” 문서를 삭제할까요? 파일 본문은 복구되지 않습니다.`)) return;
    setDocumentActionId(document.id); setError('');
    try { await propertyDataRoomRepository.deleteDocument(document.id); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '문서를 삭제하지 못했습니다.'); }
    finally { setDocumentActionId(''); }
  };
  const changeVerification = async (document: PropertyDocument, status: VerificationStatus) => {
    if (documentActionId || status === document.verificationStatus) return;
    if (requiresOfficialConfirmation(document.verificationStatus, status)
      && !confirm(`“${document.title}”을(를) 공식 확인으로 표시합니다. 발급 원본과 내용을 직접 대조했습니까? 이 상태는 보고서 확정 조건에 사용됩니다.`)) return;
    setDocumentActionId(document.id); setError('');
    try { await propertyDataRoomRepository.updateDocument(applyDocumentVerification(document, status, new Date().toISOString())); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '문서 검증 상태를 바꾸지 못했습니다.'); }
    finally { setDocumentActionId(''); }
  };
  const decideCandidate = async (candidate: PropertyVerificationCandidate, decisionStatus: VerificationDecisionStatus) => {
    setReviewingCandidateId(candidate.id); setError('');
    try { await propertyDataRoomService.decideVerificationCandidate(candidate, decisionStatus); await load(); setTab('verification'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '검증 후보를 처리하지 못했습니다.'); }
    finally { setReviewingCandidateId(''); }
  };
  const createProfessionalReport = async () => {
    setCreatingReport(true); setError('');
    try { const created = await reportSnapshotService.createDraft(id, property?.managerName || undefined); navigate(`/professional-report/snapshot/${created.id}`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '전문 보고서를 생성하지 못했습니다.'); }
    finally { setCreatingReport(false); }
  };

  if (loading || (property && property.id !== id)) return <div className="center"><CircularProgress /><p>Property Data Room을 불러오는 중입니다.</p></div>;
  if (!property) return <main className="data-room-error"><Alert severity="error">{error || '요청한 물건을 찾을 수 없습니다.'}</Alert><Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/')}>물건 목록</Button></main>;

  const photos = [
    property.mainImage && { id: 'main', url: property.mainImage, label: '대표사진', primary: true },
    ...property.additionalImages.map((url, index) => ({ id: `additional-${index}`, url, label: `추가사진 ${index + 1}`, primary: false })),
    property.mapImage && { id: 'map', url: property.mapImage, label: '위치지도', primary: false },
    property.locationAnalysisImage && { id: 'analysis', url: property.locationAnalysisImage, label: '입지분석', primary: false },
    ...bundle.media.filter((item) => item.mediaType === 'image' && item.url).map((item) => ({ id: item.id, url: item.url!, label: item.caption || item.fileName, primary: item.isPrimary })),
  ].filter(Boolean) as { id: string; url: string; label: string; primary: boolean }[];
  const officialDocuments = bundle.documents.filter((item) => officialTypes.includes(item.documentType));
  const activeGroup = TAB_GROUPS.find((group) => group.key === groupOfTab(tab))!;
  const latestReport = bundle.reportSnapshots.filter((snapshot) => snapshot.reportType === 'professional_report').sort((a, b) => b.reportVersion - a.reportVersion)[0];

  return <main className="data-room-page">
    <header className="data-room-header property-screen-header"><div><Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/')}>물건 목록</Button><p className="eyebrow">물건</p><h1>{property.name}</h1><p>{property.address} · {property.propertyNumber || '물건번호 미입력'}</p></div><div className="actions"><Button startIcon={<EditOutlined />} onClick={() => navigate(`/property/${property.id}/edit`)}>물건 수정</Button></div></header>
    {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
    <section className="data-room-workspace"><Tabs value={activeGroup.key} onChange={(_, value: GroupKey) => setTab(TAB_GROUPS.find((group) => group.key === value)!.tabs[0])} variant="fullWidth" aria-label="물건 화면 메뉴" className="property-screen-tabs">
      {TAB_GROUPS.map((group) => <Tab key={group.key} value={group.key} label={group.label} />)}
    </Tabs>
    {activeGroup.tabs.length > 1 && <div className="property-screen-subtabs" role="tablist" aria-label={`${activeGroup.label} 세부 메뉴`}>{activeGroup.tabs.map((key) => <Chip key={key} role="tab" aria-selected={tab === key} clickable color={tab === key ? 'primary' : 'default'} variant={tab === key ? 'filled' : 'outlined'} label={key === 'verification' && summary?.verificationPending ? `${SUB_TAB_LABELS[key]} ${summary.verificationPending}` : SUB_TAB_LABELS[key]} onClick={() => setTab(key)} />)}</div>}
    <div className="data-room-content">
      {tab === 'summary' && <PropertyHubPage section="summary" />}
      {tab === 'more' && <><PropertyHubPage section="more" /><nav className="property-more-docs" aria-label="문서 바로가기"><Button startIcon={<DescriptionOutlined />} onClick={() => navigate(`/document/report/${property.id}`)}>투자분석보고서</Button><Button startIcon={<PictureAsPdfOutlined />} onClick={() => navigate(`/document/proposal/${property.id}`)}>고객 제안서(1P)</Button><Button startIcon={<MapOutlined />} onClick={() => navigate(`/properties/${property.id}/briefing`)}>입지 브리핑</Button></nav></>}
      {tab === 'overview' && <Overview property={property} bundle={bundle} missing={summary?.missingDocumentTypes ?? []} onTab={setTab} />}
      {tab === 'media' && <><div>{photos.length ? <div className="data-room-gallery">{photos.map((photo) => <figure key={photo.id}><img src={photo.url} alt={photo.label} /><figcaption>{photo.label}{photo.primary && <Chip size="small" label="대표" />}</figcaption></figure>)}</div> : <EmptyState title="등록된 사진/영상이 없습니다." detail="실제 촬영 자료와 출처가 확인된 미디어를 등록하세요. AI 시각화는 실제 현장사진과 분리해서 관리합니다." />}</div><MediaClassificationPanel propertyId={property.id} latitude={property.latitude} longitude={property.longitude} media={bundle.media} spaces={bundle.spaces ?? []} internalPhotoAllowed={property.internalPhotoAllowed !== false} onSaved={load} /></>}
      {tab === 'spatial' && <SpatialDataRoomPanel propertyId={property.id} propertyAddress={property.address} mode="spatial" legacyBundle={bundle} />}
      {tab === 'documents' && <DocumentPanel documents={bundle.documents} documentType={documentType} setDocumentType={setDocumentType} upload={upload} uploading={uploading} remove={removeDocument} changeVerification={changeVerification} busyDocumentId={documentActionId} onQueued={async () => { await load(); setTab('verification'); }} />}
      {tab === 'official' && <OfficialPanel documents={officialDocuments} sources={bundle.dataSources} uploading={uploading} onUploadSource={uploadSourceDocument} onUploadSources={uploadSourceDocuments} />}
      {/* 실거래·가격: summary first; the paste/edit form opens on demand (redesign 2026-11-12). */}
      {tab === 'market' && <><ComparableTransactionOverviewPanel sources={bundle.dataSources} onOpenMarket={() => setMarketEditorOpen(true)} /><details className="property-market-editor" open={marketEditorOpen} onToggle={(event) => setMarketEditorOpen((event.currentTarget as HTMLDetailsElement).open)}><summary>비교거래 입력·수정</summary><ComparableTransactionPanel key={property.id} propertyId={property.id} sources={bundle.dataSources} onSaved={load} /></details></>}
      {tab === 'verification' && <VerificationPanel candidates={bundle.verificationCandidates ?? []} reviewingId={reviewingCandidateId} onDecision={decideCandidate} />}
      {tab === 'reports' && <ReportPanel property={property} snapshots={bundle.reportSnapshots} navigate={navigate} creating={creatingReport} onCreate={createProfessionalReport} />}
      {tab === 'digitalTwin' && <div>
        <SpatialDataRoomPanel
          propertyId={property.id}
          propertyAddress={property.address}
          mode="viewer"
          legacyBundle={bundle}
        />
        {bundle.digitalTwinAssets.length > 0 && <section className="data-room-overview"><section><p className="eyebrow">LEGACY / SOURCE ASSETS</p><h2>기존 Digital Twin 원본</h2><div className="asset-list">{bundle.digitalTwinAssets.map((asset) => <article key={asset.id}><b>{asset.assetType}</b><span>{asset.fileFormat} · v{asset.version}</span><Chip size="small" label={asset.processingStatus} /></article>)}</div></section></section>}
        <nav aria-label="3D 탭 Workspace 연결" style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {/* Single Digital Twin Intake entrypoint for the 3D tab (SpatialDataRoomPanel's own intake button is intentionally not enabled to avoid duplicates). */}
          <Button variant="contained" startIcon={<CloudUploadOutlined />} onClick={() => navigate(`/digital-twin-intake?propertyId=${encodeURIComponent(id)}`)}>도면 · 3D 자료 등록/추가</Button>
          <Button variant="outlined" onClick={() => navigate(`/room-ops?propertyId=${encodeURIComponent(id)}`)}>Room Intelligence 열기</Button>
          <Button variant="outlined" onClick={() => navigate(`/interior?propertyId=${encodeURIComponent(id)}`)}>Interior Intelligence 열기</Button>
        </nav>
      </div>}
    </div></section>
    {/* Report button stays at the bottom of the property screen (redesign 2026-11-12): newest report in one tap, or create one. */}
    <div className="property-report-bar" role="region" aria-label="보고서">
      <span>{latestReport ? `전문 보고서 v${latestReport.reportVersion}` : '보고서 없음'}{summary && !summary.reportReady ? ` · 확인할 자료 ${summary.missingDocumentTypes.length}건` : ''}</span>
      <Button variant="contained" startIcon={latestReport ? <VisibilityOutlined /> : <PostAddRounded />} disabled={creatingReport} onClick={() => latestReport ? navigate(`/professional-report/snapshot/${latestReport.id}`) : void createProfessionalReport()}>{creatingReport ? '생성 중…' : latestReport ? '보고서 보기' : '보고서 만들기'}</Button>
    </div>
  </main>;
}

function Overview({ property, bundle, missing, onTab }: { property: Property; bundle: DataRoomBundle; missing: DocumentType[]; onTab: (tab: TabKey) => void }) {
  const overview = [['거래유형', property.tradeType], ['매매가', formatWon(property.salePrice)], ['대지면적', formatArea(property.landAreaPyeong)], ['용도지역', property.zoning || '-'], ['담당자', property.managerName || '-'], ['최종 수정', new Date(property.updatedAt).toLocaleDateString('ko-KR')]];
  return <div className="data-room-overview"><section><div className="section-heading-row"><div><p className="eyebrow">PROPERTY PROFILE</p><h2>물건 개요</h2></div><VerificationBadge status="confirmed" /></div><dl>{overview.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section><section><p className="eyebrow">READINESS CHECK</p><h2>자료 준비 현황</h2>{missing.length ? <><p className="readiness-copy">보고서의 근거자료 완성도를 높이려면 아래 자료를 확인해 주세요.</p><div className="missing-list">{missing.map((type) => <span key={type}>{DOCUMENT_TYPE_LABELS[type]} <VerificationBadge status="missing" /></span>)}</div><Button onClick={() => onTab('documents')}>문서 등록하기</Button></> : <Alert severity="success">필수 공적자료가 모두 등록되어 있습니다.</Alert>}</section><section><p className="eyebrow">DATA QUALITY</p><h2>출처와 검증</h2>{bundle.dataSources.length || bundle.verifications.length ? <p>{bundle.dataSources.length}개 출처 · {bundle.verifications.length}개 필드 검증 기록</p> : <EmptyState title="검증 이력이 없습니다." detail="공식자료와 데이터 출처가 연결되면 이곳에서 신뢰도를 확인할 수 있습니다." />}</section><PropertySpaceOverviewPanel spaces={bundle.spaces ?? []} sources={bundle.dataSources} /><ComparableTransactionOverviewPanel sources={bundle.dataSources} onOpenMarket={() => onTab('market')} /></div>;
}

function DocumentPanel({ documents, documentType, setDocumentType, upload, uploading, remove, changeVerification, busyDocumentId, onQueued }: { busyDocumentId: string; documents: PropertyDocument[]; documentType: DocumentType; setDocumentType: (value: DocumentType) => void; upload: (event: ChangeEvent<HTMLInputElement>) => void; uploading: boolean; remove: (item: PropertyDocument) => void | Promise<void>; changeVerification: (item: PropertyDocument, status: VerificationStatus) => void | Promise<void>; onQueued: () => Promise<void> | void }) {
  return <><div className="document-toolbar"><div><h2>문서 자료</h2><p>파일명으로 문서 유형을 1차 자동 분류하고, 출처·검증 메타데이터를 별도 보존합니다.</p></div><TextField select size="small" label="문서 분류" value={documentType} onChange={(event) => setDocumentType(event.target.value as DocumentType)}>{Object.entries(DOCUMENT_TYPE_LABELS).map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}</TextField><Button component="label" variant="contained" startIcon={<CloudUploadOutlined />} disabled={uploading}>{uploading ? '등록 중…' : '문서 등록'}<input hidden type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={upload} /></Button></div>{documents.length ? <div className="document-list">{documents.map((document) => <article key={document.id}><div className="file-icon"><DescriptionOutlined /></div><div><b>{document.title}</b><span>{DOCUMENT_TYPE_LABELS[document.documentType]} · {(document.fileSize / 1024 / 1024).toFixed(2)}MB · v{document.version}</span><small>{document.sourceName} · {new Date(document.uploadedAt).toLocaleDateString('ko-KR')}</small><DocumentExtractionPanel document={document} onQueued={onQueued} /></div><TextField select size="small" value={document.verificationStatus} disabled={Boolean(busyDocumentId)} onChange={(event) => { void changeVerification(document, event.target.value as VerificationStatus); }} aria-label={`${document.title} 검증 상태`}>{documentVerificationOptions(document.verificationStatus).map((key) => <MenuItem key={key} value={key} disabled={!DOCUMENT_VERIFICATION_OPTIONS.includes(key)}>{VERIFICATION_LABELS[key]}</MenuItem>)}</TextField><Button startIcon={<DownloadRounded />} onClick={() => propertyDataRoomService.downloadDocument(document)}>다운로드</Button><Button color="error" startIcon={<DeleteOutlineRounded />} disabled={Boolean(busyDocumentId)} onClick={() => { void remove(document); }}>{busyDocumentId === document.id ? "처리 중" : "삭제"}</Button></article>)}</div> : <EmptyState title="등록된 문서가 없습니다." detail="건축물대장, 토지대장, 등기부등본 등 확인된 원본 자료를 등록하세요." />}</>;
}

function normalizedSourceFileName(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

function sourceInventoryDocumentMatches(source: DataRoomBundle['dataSources'][number], document: PropertyDocument) {
  const sourceReference = typeof source.sourceReference === 'string' ? source.sourceReference : '';
  if (sourceReference && normalizedSourceFileName(document.originalFileName) === normalizedSourceFileName(sourceReference)) return true;

  const inventoryType = typeof source.metadata?.documentType === 'string' ? source.metadata.documentType : '';
  if (inventoryType === 'registry_land' || inventoryType === 'registry_building' || inventoryType === 'registry') return false;

  const expectedDocumentType = propertyDataRoomService.classifyDocument(sourceReference || source.sourceName);
  return expectedDocumentType !== 'other' && document.documentType === expectedDocumentType;
}

function OfficialPanel({ documents, sources, uploading, onUploadSource, onUploadSources }: { documents: PropertyDocument[]; sources: DataRoomBundle['dataSources']; uploading: boolean; onUploadSource: (source: DataRoomBundle['dataSources'][number], event: ChangeEvent<HTMLInputElement>) => void; onUploadSources: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return <div><div className="document-toolbar"><div><h2>공적자료 및 데이터 출처</h2><p className="readiness-copy">공식 문서와 외부 데이터의 출처·기준일·검증 상태를 구분합니다. 원본 확인, migration upload 준비, private Storage 연결을 각각 분리해 관리합니다.</p></div><Button component="label" variant="contained" startIcon={<CloudUploadOutlined />} disabled={uploading}>{uploading ? '연결 중…' : '공적자료 일괄 연결'}<input hidden multiple type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={onUploadSources} /></Button></div>{documents.length || sources.length ? <div className="official-grid">{documents.map((item) => <article key={item.id}><b>{DOCUMENT_TYPE_LABELS[item.documentType]}</b><span>{item.title}</span><VerificationBadge status={item.verificationStatus} /></article>)}{sources.map((source) => {
    const isSourceInventory = source.resourceType === 'source_document_inventory';
    const binaryStorageStatus = source.metadata?.binaryStorageStatus;
    const originalSourcePresence = source.metadata?.originalSourcePresence;
    const matchingDocument = isSourceInventory
      ? documents.find((document) => sourceInventoryDocumentMatches(source, document))
      : undefined;
    const migrationUploadReady = Boolean(matchingDocument && (matchingDocument.fileData || matchingDocument.fileUrl));
    return <article key={source.id}>
      <b>{source.sourceName}</b>
      <span>{SOURCE_TYPE_LABELS[source.sourceType]} · {source.sourceDate || source.collectedAt.slice(0, 10)}</span>
      <VerificationBadge status={source.verificationStatus} />
      {isSourceInventory && <div className="source-inventory-status">
        <Chip size="small" label={originalSourcePresence === 'confirmed' ? '원본 확인' : '원본 상태 미확인'} color={originalSourcePresence === 'confirmed' ? 'success' : 'default'} />
        <Chip size="small" label={migrationUploadReady ? '이관 파일 준비' : '이관 파일 미등록'} color={migrationUploadReady ? 'success' : 'warning'} />
        <Chip size="small" label={binaryStorageStatus === 'connected' ? 'Storage 연결' : 'Storage 미연결'} color={binaryStorageStatus === 'connected' ? 'success' : 'warning'} />
        {matchingDocument && <small>{matchingDocument.originalFileName} · {(matchingDocument.fileSize / 1024 / 1024).toFixed(1)} MiB</small>}
        {!migrationUploadReady && binaryStorageStatus !== 'connected' && <Button component="label" size="small" variant="outlined" startIcon={<CloudUploadOutlined />} disabled={uploading}>
          {uploading ? '등록 중…' : '원본 파일 등록'}
          <input hidden type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => onUploadSource(source, event)} />
        </Button>}
      </div>}
    </article>;
  })}</div> : <EmptyState title="등록된 공적자료가 없습니다." detail="문서 탭에서 공적자료를 등록하면 출처와 검증 상태가 함께 표시됩니다." />}</div>;
}

function VerificationPanel({ candidates, reviewingId, onDecision }: { candidates: PropertyVerificationCandidate[]; reviewingId: string; onDecision: (candidate: PropertyVerificationCandidate, status: VerificationDecisionStatus) => void }) {
  const ordered = [...candidates].sort((a, b) => {
    const aPending = a.decisionStatus === 'pending' || a.decisionStatus === 'held';
    const bPending = b.decisionStatus === 'pending' || b.decisionStatus === 'held';
    if (aPending !== bPending) return aPending ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
  if (!ordered.length) return <EmptyState title="검증 대기 데이터가 없습니다." detail="Excel·공적자료·외부 데이터에서 후보값이 생성되면 기존값과 비교해 승인할 수 있습니다." />;
  return <div><div className="document-toolbar"><div><h2>자료 검증</h2><p>후보값은 승인하기 전까지 Property 원본을 변경하지 않습니다.</p></div></div><div className="document-list">{ordered.map((candidate) => {
    const active = candidate.decisionStatus === 'pending' || candidate.decisionStatus === 'held';
    const busy = reviewingId === candidate.id;
    return <article key={candidate.id}>
      <div className="file-icon"><DescriptionOutlined /></div>
      <div><b>{candidate.fieldKey}</b><span>현재값: {displayCandidateValue(candidate.currentValue)}</span><span>후보값: {displayCandidateValue(candidate.candidateValue)}</span><small>{candidate.sourceName}{candidate.sourceDate ? ` · ${candidate.sourceDate}` : ''}{typeof candidate.confidence === 'number' ? ` · 신뢰도 ${Math.round(candidate.confidence * 100)}%` : ''}</small>{candidate.note && <small>{candidate.note}</small>}</div>
      <Chip size="small" label={DECISION_LABELS[candidate.decisionStatus]} color={candidate.decisionStatus === 'approved' ? 'success' : candidate.decisionStatus === 'rejected' ? 'error' : 'default'} />
      {active && <><Button disabled={busy} color="success" onClick={() => onDecision(candidate, 'approved')}>승인</Button><Button disabled={busy} onClick={() => onDecision(candidate, 'held')}>보류</Button><Button disabled={busy} color="error" onClick={() => onDecision(candidate, 'rejected')}>거절</Button></>}
    </article>;
  })}</div></div>;
}

function ReportPanel({ property, snapshots, navigate, creating, onCreate }: { property: Property; snapshots: DataRoomBundle['reportSnapshots']; navigate: ReturnType<typeof useNavigate>; creating: boolean; onCreate: () => void }) {
  const professionalSnapshots = snapshots.filter((snapshot) => snapshot.reportType === 'professional_report').sort((a, b) => b.reportVersion - a.reportVersion);
  return <div><div className="document-toolbar report-toolbar"><div><h2>보고서 및 스냅샷</h2><p>생성 시점 데이터가 고정되며 이후 물건 수정의 영향을 받지 않습니다.</p></div><Button startIcon={<DescriptionOutlined />} onClick={() => navigate(`/document/report/${property.id}`)}>투자분석보고서</Button><Button startIcon={<PictureAsPdfOutlined />} onClick={() => navigate(`/document/proposal/${property.id}`)}>고객 제안서</Button><Button startIcon={<MapOutlined />} onClick={() => navigate(`/properties/${property.id}/briefing`)}>입지 브리핑</Button><Button variant="contained" startIcon={<PostAddRounded />} disabled={creating} onClick={onCreate}>{creating ? '생성 중…' : '전문 보고서 생성'}</Button></div>{professionalSnapshots.length ? <div className="snapshot-list">{professionalSnapshots.map((snapshot) => <article key={snapshot.id}><div className="snapshot-version">v{snapshot.reportVersion}</div><div><b>전문 보고서 v{snapshot.reportVersion}</b><span>{new Date(snapshot.generatedAt).toLocaleString('ko-KR')}</span><small>{snapshot.templateVersion} · {snapshot.engineVersion || 'engine 미기록'}</small></div><Chip label={snapshot.status} size="small" /><Button startIcon={<VisibilityOutlined />} onClick={() => navigate(`/professional-report/snapshot/${snapshot.id}`)}>미리보기</Button></article>)}</div> : <EmptyState title="생성된 전문 보고서가 없습니다." detail="현재 물건과 자료실 데이터를 고정한 첫 보고서를 생성하세요." />}</div>;
}