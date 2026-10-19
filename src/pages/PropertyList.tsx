import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Chip, IconButton, MenuItem, Pagination, Select, TextField, Tooltip } from '@mui/material';
import { DeleteOutlineRounded, DescriptionOutlined, EditOutlined, FileDownloadOutlined, FolderSharedOutlined, MapOutlined, PictureAsPdfOutlined, SearchRounded } from '@mui/icons-material';
import { propertyRepository } from '../repositories/propertyRepository';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { reportSnapshotService } from '../services/reportEngine';
import PortfolioOperationsHub, { type PortfolioLoadState } from '../components/PortfolioOperationsHub';
import { isSampleProperty } from '../domain/sampleProperty';
import type { Property } from '../types';
import { formatArea, formatWon } from '../utils/format';
import { LISTING_STATUS_LABEL } from '../services/marketPresenceService';

const PROPERTY_PAGE_SIZE = 50;

export default function PropertyList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Property[]>([]); const [query, setQuery] = useState('');
  const [type, setType] = useState('전체'); const [manager, setManager] = useState('전체'); const [selected, setSelected] = useState<string[]>([]); const [page, setPage] = useState(1);
  const [loadState, setLoadState] = useState<PortfolioLoadState>('loading'); const [loadError, setLoadError] = useState('');
  // Loading and failure must not look like an empty portfolio (Issue #9).
  const load = () => {
    setLoadState('loading'); setLoadError('');
    return propertyRepository.getAll()
      .then((values) => { setItems(values.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))); setLoadState('ready'); })
      .catch((reason: unknown) => { setLoadError(reason instanceof Error ? reason.message : ''); setLoadState('error'); });
  };
  useEffect(() => { void load(); }, []);
  const managers = [...new Set(items.map((item) => item.managerName).filter(Boolean))];
  const filtered = useMemo(() => items.filter((property) => (type === '전체' || property.tradeType === type) && (manager === '전체' || property.managerName === manager) && [property.name, property.address, property.propertyNumber, property.buildingName].some((value) => value.toLowerCase().includes(query.toLowerCase()))), [items, query, type, manager]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PROPERTY_PAGE_SIZE));
  const visible = useMemo(() => filtered.slice((page - 1) * PROPERTY_PAGE_SIZE, page * PROPERTY_PAGE_SIZE), [filtered, page]);
  const visibleIds = useMemo(() => visible.map((item) => item.id), [visible]);
  const pageAllSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  useEffect(() => { setPage(1); }, [query, type, manager]);
  useEffect(() => { setPage((current) => Math.min(current, pageCount)); }, [pageCount]);
  const remove = async (id: string) => { if (confirm('이 물건과 연결된 Data Room 자료를 함께 보관 처리한 뒤 삭제할까요?')) { await propertyDataRoomRepository.archiveProperty(id); await propertyRepository.delete(id); load(); } };
  const openDetailedReport = async (id: string) => { const snapshot = await reportSnapshotService.createDraft(id); navigate(`/professional-report/snapshot/${snapshot.id}`); };
  const openBulkReports = async () => { for (const id of selected) { const snapshot = await reportSnapshotService.createDraft(id); window.open(`/professional-report/snapshot/${snapshot.id}`, '_blank'); } };

  return <>
    <header className="page-header"><div><p className="eyebrow">PROPERTY DATABASE</p><h1>물건 관리</h1><p>주소 조회 → 물건 등록 → Data Room 검증 → DA:ON 1P/7P 보고서로 이어집니다.</p></div></header>
    <PortfolioOperationsHub items={items} loadState={loadState} loadError={loadError} onRetry={() => { void load(); }} />
    <section className="panel"><div className="toolbar"><TextField size="small" placeholder="물건명, 주소, 물건번호 검색" value={query} onChange={(event) => setQuery(event.target.value)} InputProps={{ startAdornment: <SearchRounded className="search-icon" /> }} /><Select size="small" value={type} onChange={(event) => setType(event.target.value)}>{['전체', '매매', '전세', '월세'].map((value) => <MenuItem value={value} key={value}>거래유형 · {value}</MenuItem>)}</Select><Select size="small" value={manager} onChange={(event) => setManager(event.target.value)}><MenuItem value="전체">담당자 · 전체</MenuItem>{managers.map((value) => <MenuItem value={value} key={value}>{value}</MenuItem>)}</Select><span className="spacer" />{selected.length > 0 && <><small className="muted">선택 {selected.length}건</small><Button startIcon={<FileDownloadOutlined />} onClick={openBulkReports}>선택 7P 출력</Button></>}</div>
      <div className="table-wrap"><table><thead><tr><th><input aria-label="현재 페이지 물건 선택" type="checkbox" checked={pageAllSelected} onChange={(event) => setSelected((current) => event.target.checked ? [...new Set([...current, ...visibleIds])] : current.filter((id) => !visibleIds.includes(id)))} /></th><th>물건번호</th><th>물건명 / 건물명</th><th>주소</th><th>거래유형</th><th>매매가</th><th>대지면적</th><th>담당자</th><th>수정일</th><th>빠른 작업</th></tr></thead><tbody>{visible.map((property) => <tr key={property.id}><td><input aria-label={`${property.name} 선택`} type="checkbox" checked={selected.includes(property.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, property.id] : selected.filter((id) => id !== property.id))} /></td><td className="muted">{property.propertyNumber || '-'}</td><td><button className="property-name-link" onClick={() => navigate(`/property/${property.id}`)}>{property.name}</button>{isSampleProperty(property) && <Chip size="small" variant="outlined" color="warning" label="샘플" className="sample-badge" />}<small>{property.buildingName || '건물명 미입력'}</small></td><td>{property.address}</td><td><Chip size="small" label={property.tradeType} color={property.tradeType === '매매' ? 'primary' : 'default'} /><small>{LISTING_STATUS_LABEL[property.listingStatus || 'unknown'] || '미확인'}</small></td><td className="price">{formatWon(property.salePrice)}</td><td>{formatArea(property.landAreaPyeong)}</td><td>{property.managerName || '-'}</td><td>{new Date(property.updatedAt).toLocaleDateString('ko-KR')}</td><td className="row-actions"><Tooltip title="Property Data Room"><IconButton aria-label="Property Data Room" onClick={() => navigate(`/property/${property.id}`)}><FolderSharedOutlined /></IconButton></Tooltip><Tooltip title="DA:ON 7P 상세보고서"><IconButton aria-label="DA:ON 7P 상세보고서" onClick={() => openDetailedReport(property.id)}><DescriptionOutlined /></IconButton></Tooltip><Tooltip title="DA:ON 1P 요약제안서"><IconButton aria-label="DA:ON 1P 요약제안서" onClick={() => navigate(`/document/proposal/${property.id}`)}><PictureAsPdfOutlined /></IconButton></Tooltip><Tooltip title="입지 브리핑"><IconButton aria-label="입지 브리핑" onClick={() => navigate(`/properties/${property.id}/briefing`)}><MapOutlined /></IconButton></Tooltip><Tooltip title="수정"><IconButton aria-label="수정" onClick={() => navigate(`/property/${property.id}/edit`)}><EditOutlined /></IconButton></Tooltip><Tooltip title="삭제"><IconButton aria-label="삭제" color="error" onClick={() => remove(property.id)}><DeleteOutlineRounded /></IconButton></Tooltip></td></tr>)}</tbody></table>{loadState === 'ready' && !filtered.length && <div className="empty">{items.length ? '조건에 맞는 물건이 없습니다.' : '등록된 물건이 없습니다.'}</div>}</div>
      {filtered.length > 0 && <div className="toolbar" style={{ marginTop: 12 }}><small>검색 결과 {filtered.length.toLocaleString('ko-KR')}건 · 페이지당 {PROPERTY_PAGE_SIZE}건</small><span className="spacer" /><Pagination page={page} count={pageCount} onChange={(_, value) => setPage(value)} /></div>}
    </section>
  </>;
}
