import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Chip, IconButton, MenuItem, Pagination, Select, TextField, Tooltip } from '@mui/material';
import { AddRounded, ChevronRightRounded, GridViewRounded, TableRowsRounded, DeleteOutlineRounded, DescriptionOutlined, EditOutlined, FileDownloadOutlined, FolderSharedOutlined, MapOutlined, PictureAsPdfOutlined, SearchRounded } from '@mui/icons-material';
import { propertyRepository } from '../repositories/propertyRepository';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { reportSnapshotService } from '../services/reportEngine';
import PortfolioOperationsHub, { isCoreProfileReady, PortfolioShortcuts, type PortfolioLoadState } from '../components/PortfolioOperationsHub';
import { compareByUpdatedAtDesc, type RejectedPropertyRecord } from '../domain/propertyRecordGuard';
import { classifyPropertyRecord, RECORD_CLASS_BASIS_LABEL, RECORD_CLASS_LABEL, splitSampleProperties } from '../domain/sampleProperty';
import { internalPhotoAllowed } from '../domain/professionalReport/reportAccessPolicy';
import type { Property } from '../types';
import { formatArea, formatWon } from '../utils/format';
import { LISTING_STATUS_LABEL } from '../services/marketPresenceService';
import PortfolioMapPanel, { portfolioMapAvailable } from '../components/PortfolioMapPanel';
import { mapPins, regionCounts, regionOf } from '../domain/propertyDetail/portfolioMap';

const PROPERTY_PAGE_SIZE = 50;

/** Next step shown on each phone card: fill the core profile first (same rule as the 기본정보 입력 KPI), then open the property. */
function nextStepOf(property: Property) {
  return isCoreProfileReady(property)
    ? { label: '자료 확인 · 보고서', to: `/property/${property.id}` }
    : { label: '기본정보 보완', to: `/property/${property.id}/edit` };
}

type ListView = 'cards' | 'table';
const VIEW_KEY = 'daon.propertyList.view';
function readView(): ListView {
  try { return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'cards'; } catch { return 'cards'; }
}

/** Card picture: the main photo only when the property's photo policy allows it (Bangbae 815-11: never), else the 동 name block. */
function cardVisual(property: Property) {
  if (property.mainImage && internalPhotoAllowed(property)) return <span className="property-card-visual has-photo"><img src={property.mainImage} alt="" loading="lazy" /></span>;
  const dong = [property.address, property.name].flatMap((text) => String(text || '').split(/\s+/)).find((part) => /^[가-힣0-9]+[동가리]$/.test(part)) || '위치';
  return <span className="property-card-visual"><b>{dong}</b><small>사진 미연결</small></span>;
}

export default function PropertyList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Property[]>([]); const [query, setQuery] = useState('');
  const [type, setType] = useState('전체'); const [manager, setManager] = useState('전체'); const [selected, setSelected] = useState<string[]>([]); const [page, setPage] = useState(1);
  const [loadState, setLoadState] = useState<PortfolioLoadState>('loading'); const [loadError, setLoadError] = useState(''); const [rejected, setRejected] = useState<RejectedPropertyRecord[]>([]);
  // Loading and failure must not look like an empty portfolio (Issue #9).
  const load = () => {
    setLoadState('loading'); setLoadError('');
    return propertyRepository.getAllWithDiagnostics()
      .then(({ items: values, rejected: invalid }) => { setItems([...values].sort(compareByUpdatedAtDesc)); setRejected(invalid); setLoadState('ready'); })
      .catch((reason: unknown) => { setLoadError(reason instanceof Error ? reason.message : ''); setLoadState('error'); });
  };
  useEffect(() => { void load(); }, []);
  const [view, setView] = useState<ListView>(readView);
  const chooseView = (next: ListView) => { setView(next); try { localStorage.setItem(VIEW_KEY, next); } catch { /* per-viewer convenience only */ } };
  const { real: realItems, samples: sampleItems } = useMemo(() => splitSampleProperties(items), [items]);
  const needsProfile = realItems.filter((item) => !isCoreProfileReady(item)).length;
  const managers = [...new Set(items.map((item) => item.managerName).filter(Boolean))];
  const [region, setRegion] = useState('전체'); const [hoverId, setHoverId] = useState<string>();
  const regions = useMemo(() => regionCounts(items), [items]);
  const filtered = useMemo(() => items.filter((property) => (region === '전체' || regionOf(property) === region) && (type === '전체' || property.tradeType === type) && (manager === '전체' || property.managerName === manager) && [property.name, property.address, property.propertyNumber, property.buildingName].some((value) => String(value ?? '').toLowerCase().includes(query.toLowerCase()))), [items, query, type, manager, region]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PROPERTY_PAGE_SIZE));
  const visible = useMemo(() => filtered.slice((page - 1) * PROPERTY_PAGE_SIZE, page * PROPERTY_PAGE_SIZE), [filtered, page]);
  const visibleIds = useMemo(() => visible.map((item) => item.id), [visible]);
  const pageAllSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  useEffect(() => { setPage(1); }, [query, type, manager, region]);
  useEffect(() => { setPage((current) => Math.min(current, pageCount)); }, [pageCount]);
  const showMap = portfolioMapAvailable();
  const pinData = useMemo(() => mapPins(filtered, (property) => formatWon(property.salePrice)), [filtered]);
  const openProperty = useCallback((id: string) => navigate(`/property/${id}`), [navigate]);
  const remove = async (id: string) => { if (confirm('이 물건과 연결된 Data Room 자료를 함께 보관 처리한 뒤 삭제할까요?')) { await propertyDataRoomRepository.archiveProperty(id); await propertyRepository.delete(id); load(); } };
  const openDetailedReport = async (id: string) => { const snapshot = await reportSnapshotService.createDraft(id); navigate(`/professional-report/snapshot/${snapshot.id}`); };
  const openBulkReports = async () => { for (const id of selected) { const snapshot = await reportSnapshotService.createDraft(id); window.open(`/professional-report/snapshot/${snapshot.id}`, '_blank'); } };

  return <>
    <header className="page-header property-home-header home-masthead"><div><p className="eyebrow">DA:ON 물건 · 근거 · 보고서</p><h1>물건 관리</h1><p>주소 조회 → 물건 등록 → 자료 확인 → 보고서</p>
      {loadState === 'ready' && <dl className="home-masthead-kpis" aria-label="물건 현황"><div><dt>운영 물건</dt><dd>{realItems.length}</dd></div><div><dt>기본정보 보완 필요</dt><dd>{needsProfile}</dd></div><div><dt>샘플 · 테스트</dt><dd>{sampleItems.length}</dd></div></dl>}</div>
      <div className="actions"><Button variant="outlined" startIcon={<SearchRounded />} onClick={() => navigate('/discover')}>주소 조회</Button><Button variant="contained" startIcon={<AddRounded />} onClick={() => navigate('/property/new')}>새 물건</Button></div></header>
    <PortfolioOperationsHub items={items} loadState={loadState} loadError={loadError} rejected={rejected} onRetry={() => { void load(); }} />
    <section className="panel"><div className="toolbar"><TextField size="small" placeholder="물건명, 주소, 물건번호 검색" value={query} onChange={(event) => setQuery(event.target.value)} InputProps={{ startAdornment: <SearchRounded className="search-icon" /> }} /><Select size="small" value={type} onChange={(event) => setType(event.target.value)}>{['전체', '매매', '전세', '월세'].map((value) => <MenuItem value={value} key={value}>거래유형 · {value}</MenuItem>)}</Select><Select size="small" value={manager} onChange={(event) => setManager(event.target.value)}><MenuItem value="전체">담당자 · 전체</MenuItem>{managers.map((value) => <MenuItem value={value} key={value}>{value}</MenuItem>)}</Select><span className="spacer" /><span className="list-view-toggle" role="group" aria-label="보기 방식"><Button size="small" variant={view === 'cards' ? 'contained' : 'outlined'} startIcon={<GridViewRounded />} aria-pressed={view === 'cards'} onClick={() => chooseView('cards')}>카드</Button><Button size="small" variant={view === 'table' ? 'contained' : 'outlined'} startIcon={<TableRowsRounded />} aria-pressed={view === 'table'} onClick={() => chooseView('table')}>표</Button></span>{selected.length > 0 && <><small className="muted">선택 {selected.length}건</small><Button startIcon={<FileDownloadOutlined />} onClick={openBulkReports}>선택 7P 출력</Button></>}</div>
      {regions.length > 1 && <div className="region-filter" role="group" aria-label="지역"><Chip label={`전체 ${items.length}`} color={region === '전체' ? 'primary' : 'default'} variant={region === '전체' ? 'filled' : 'outlined'} onClick={() => setRegion('전체')} aria-pressed={region === '전체'} />{regions.map((item) => <Chip key={item.region} label={`${item.region} ${item.count}`} color={region === item.region ? 'primary' : 'default'} variant={region === item.region ? 'filled' : 'outlined'} onClick={() => setRegion(item.region)} aria-pressed={region === item.region} />)}</div>}
      <div className={`property-browse ${showMap ? 'has-map' : ''}`}><div className="property-browse-list">
      <ul className={`property-cards view-${view}`} aria-label="물건 목록">{visible.map((property) => { const record = classifyPropertyRecord(property); const next = nextStepOf(property); return <li key={property.id} onMouseEnter={() => setHoverId(property.id)} onMouseLeave={() => setHoverId(undefined)}><button type="button" onClick={() => navigate(next.to)}>{cardVisual(property)}<span className="property-card-main"><strong>{property.name}</strong>{record.recordClass !== 'operational' && <Chip size="small" variant="outlined" color="warning" label={RECORD_CLASS_LABEL[record.recordClass]} className="sample-badge" />}<small>{property.address || '주소 미입력'}</small><span className="property-card-facts">{property.tradeType} · {formatWon(property.salePrice)} · 대지 {formatArea(property.landAreaPyeong)}</span></span><span className="property-card-next"><small>다음 할 일</small><b>{next.label}</b></span><ChevronRightRounded /></button></li>; })}</ul><div className="table-wrap"><table className="property-list-table"><thead><tr><th><input aria-label="현재 페이지 물건 선택" type="checkbox" checked={pageAllSelected} onChange={(event) => setSelected((current) => event.target.checked ? [...new Set([...current, ...visibleIds])] : current.filter((id) => !visibleIds.includes(id)))} /></th><th>물건번호</th><th>물건명 / 건물명</th><th>주소</th><th>거래유형</th><th>매매가</th><th>대지면적</th><th>담당자</th><th>수정일</th><th>빠른 작업</th></tr></thead><tbody>{visible.map((property) => <tr key={property.id}><td><input aria-label={`${property.name} 선택`} type="checkbox" checked={selected.includes(property.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, property.id] : selected.filter((id) => id !== property.id))} /></td><td className="muted">{property.propertyNumber || '-'}</td><td><button className="property-name-link" onClick={() => navigate(`/property/${property.id}`)}>{property.name}</button>{(() => { const record = classifyPropertyRecord(property); return record.recordClass !== 'operational' && <Chip size="small" variant="outlined" color="warning" label={RECORD_CLASS_LABEL[record.recordClass]} title={`분류 근거: ${RECORD_CLASS_BASIS_LABEL[record.basis]}`} className="sample-badge" />; })()}<small>{property.buildingName || '건물명 미입력'}</small></td><td>{property.address}</td><td><Chip size="small" label={property.tradeType} color={property.tradeType === '매매' ? 'primary' : 'default'} /><small>{LISTING_STATUS_LABEL[property.listingStatus || 'unknown'] || '미확인'}</small></td><td className="price">{formatWon(property.salePrice)}</td><td>{formatArea(property.landAreaPyeong)}</td><td>{property.managerName || '-'}</td><td>{new Date(property.updatedAt).toLocaleDateString('ko-KR')}</td><td className="row-actions"><Tooltip title="Property Data Room"><IconButton aria-label="Property Data Room" onClick={() => navigate(`/property/${property.id}`)}><FolderSharedOutlined /></IconButton></Tooltip><Tooltip title="DA:ON 7P 상세보고서"><IconButton aria-label="DA:ON 7P 상세보고서" onClick={() => openDetailedReport(property.id)}><DescriptionOutlined /></IconButton></Tooltip><Tooltip title="DA:ON 1P 요약제안서"><IconButton aria-label="DA:ON 1P 요약제안서" onClick={() => navigate(`/document/proposal/${property.id}`)}><PictureAsPdfOutlined /></IconButton></Tooltip><Tooltip title="입지 브리핑"><IconButton aria-label="입지 브리핑" onClick={() => navigate(`/properties/${property.id}/briefing`)}><MapOutlined /></IconButton></Tooltip><Tooltip title="수정"><IconButton aria-label="수정" onClick={() => navigate(`/property/${property.id}/edit`)}><EditOutlined /></IconButton></Tooltip><Tooltip title="삭제"><IconButton aria-label="삭제" color="error" onClick={() => remove(property.id)}><DeleteOutlineRounded /></IconButton></Tooltip></td></tr>)}</tbody></table>{loadState === 'ready' && !filtered.length && <div className="empty">{items.length ? '조건에 맞는 물건이 없습니다.' : '등록된 물건이 없습니다.'}</div>}</div></div>{showMap && <PortfolioMapPanel pins={pinData.pins} missing={pinData.missing} activeId={hoverId} onOpen={openProperty} />}</div>
      {filtered.length > 0 && <div className="toolbar" style={{ marginTop: 12 }}><small>검색 결과 {filtered.length.toLocaleString('ko-KR')}건 · 페이지당 {PROPERTY_PAGE_SIZE}건</small><span className="spacer" /><Pagination page={page} count={pageCount} onChange={(_, value) => setPage(value)} /></div>}
    </section>
    <PortfolioShortcuts />
  </>;
}
