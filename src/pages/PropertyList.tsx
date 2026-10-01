import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Chip, IconButton, Menu, MenuItem, Pagination, Select, TextField, Tooltip } from '@mui/material';
import { AddRounded, DeleteOutlineRounded, DescriptionOutlined, EditOutlined, FileDownloadOutlined, FolderSharedOutlined, MapOutlined, MoreHorizRounded, PictureAsPdfOutlined, SearchRounded, UploadFileRounded } from '@mui/icons-material';
import { propertyRepository } from '../repositories/propertyRepository';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { reportSnapshotService } from '../services/reportEngine';
import type { Property } from '../types';
import { formatArea, formatWon } from '../utils/format';

const PAGE_SIZE = 25;

export default function PropertyList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Property[]>([]);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('전체');
  const [manager, setManager] = useState('전체');
  const [dataKind, setDataKind] = useState('전체');
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuProperty, setMenuProperty] = useState<Property | null>(null);

  const load = () => propertyRepository.getAll().then((values) => setItems(values.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))));
  useEffect(() => { load(); }, []);

  const managers = [...new Set(items.map((item) => item.managerName).filter(Boolean))];
  const filtered = useMemo(() => items.filter((property) =>
    (type === '전체' || property.tradeType === type)
    && (manager === '전체' || property.managerName === manager)
    && (dataKind === '전체' || (dataKind === '샘플' ? property.propertyNumber.startsWith('SAMPLE-') : !property.propertyNumber.startsWith('SAMPLE-')))
    && [property.name, property.address, property.propertyNumber, property.buildingName]
      .some((value) => value.toLowerCase().includes(query.toLowerCase()))
  ), [items, query, type, manager, dataKind]);

  const remove = async (id: string) => {
    if (confirm('이 물건과 연결된 Data Room 자료를 함께 보관 처리한 뒤 삭제할까요?')) {
      await propertyDataRoomRepository.archiveProperty(id);
      await propertyRepository.delete(id);
      setMenuAnchor(null);
      setMenuProperty(null);
      load();
    }
  };

  const openDetailedReport = async (id: string) => {
    const snapshot = await reportSnapshotService.createDraft(id);
    navigate(`/professional-report/snapshot/${snapshot.id}`);
  };

  const openBulkReports = async () => {
    for (const id of selected) {
      const snapshot = await reportSnapshotService.createDraft(id);
      window.open(`/professional-report/snapshot/${snapshot.id}`, '_blank');
    }
  };

  useEffect(() => { setPage(1); }, [query, type, manager, dataKind]);
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (page > maxPage) setPage(maxPage);
  }, [filtered.length, page]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const latestUpdated = items[0] ? new Date(items[0].updatedAt).toLocaleDateString('ko-KR') : '-';

  return <main className="property-list-focus">
    <header className="page-header property-list-header">
      <div>
        <p className="eyebrow">PROPERTY DATABASE</p>
        <h1>물건 · Data Room</h1>
        <p>물건을 찾고 열어 자료·검증·보고 흐름을 이어갑니다.</p>
      </div>
      <div className="actions">
        <Button variant="outlined" startIcon={<UploadFileRounded />} onClick={() => navigate('/import')}>엑셀 대량 등록</Button>
        <Button variant="contained" startIcon={<AddRounded />} onClick={() => navigate('/property/new')}>개별 물건 등록</Button>
      </div>
    </header>

    <section className="property-list-summary">
      <div><small>전체</small><strong>{items.length}</strong><span>건</span></div>
      <div><small>매매</small><strong>{items.filter((item) => item.tradeType === '매매').length}</strong><span>건</span></div>
      <div><small>현재 필터</small><strong>{filtered.length}</strong><span>건</span></div>
      <div className="property-list-latest"><small>최근 업데이트</small><strong>{latestUpdated}</strong></div>
    </section>

    <section className="panel property-list-panel">
      <div className="toolbar property-list-toolbar">
        <TextField
          size="small"
          placeholder="물건명, 주소, 물건번호 검색"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          InputProps={{ startAdornment: <SearchRounded className="search-icon" /> }}
        />
        <Select size="small" value={type} onChange={(event) => setType(event.target.value)}>
          {['전체', '매매', '전세', '월세'].map((value) => <MenuItem value={value} key={value}>거래유형 · {value}</MenuItem>)}
        </Select>
        <Select size="small" value={manager} onChange={(event) => setManager(event.target.value)}>
          <MenuItem value="전체">담당자 · 전체</MenuItem>
          {managers.map((value) => <MenuItem value={value} key={value}>{value}</MenuItem>)}
        </Select>
        <Select size="small" value={dataKind} onChange={(event) => setDataKind(event.target.value)}>
          <MenuItem value="전체">데이터 유형 · 전체</MenuItem>
          <MenuItem value="샘플">샘플</MenuItem>
          <MenuItem value="운영">운영</MenuItem>
        </Select>
        <span className="spacer" />
        {selected.length > 0 && <Button startIcon={<FileDownloadOutlined />} onClick={openBulkReports}>선택 {selected.length}건 7P 출력</Button>}
      </div>

      <div className="table-wrap">
        <table className="property-focus-table">
          <thead>
            <tr>
              <th><input aria-label="전체 물건 선택" type="checkbox" checked={filtered.length > 0 && selected.length === filtered.length} onChange={(event) => setSelected(event.target.checked ? filtered.map((item) => item.id) : [])} /></th>
              <th>물건</th>
              <th>거래</th>
              <th>매매가</th>
              <th>대지면적</th>
              <th>담당자</th>
              <th>수정일</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((property) => <tr key={property.id}>
              <td><input aria-label={`${property.name} 선택`} type="checkbox" checked={selected.includes(property.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, property.id] : selected.filter((id) => id !== property.id))} /></td>
              <td className="property-primary-cell">
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}><button className="property-name-link" onClick={() => navigate(`/property/${property.id}`)}>{property.name}</button>{property.propertyNumber.startsWith('SAMPLE-') && <Chip size="small" label="샘플" variant="outlined" color="secondary" />}</div>
                <small>{property.propertyNumber || '물건번호 미입력'} · {property.buildingName || '건물명 미입력'}</small>
                <span>{property.address}</span>
              </td>
              <td><Chip size="small" label={property.tradeType} color={property.tradeType === '매매' ? 'primary' : 'default'} /></td>
              <td className="price">{formatWon(property.salePrice)}</td>
              <td>{formatArea(property.landAreaPyeong)}</td>
              <td>{property.managerName || '-'}</td>
              <td className="muted">{new Date(property.updatedAt).toLocaleDateString('ko-KR')}</td>
              <td className="property-row-actions">
                <Button size="small" variant="outlined" startIcon={<FolderSharedOutlined />} onClick={() => navigate(`/property/${property.id}`)}>열기</Button>
                <Tooltip title="더보기">
                  <IconButton aria-label={`${property.name} 더보기`} onClick={(event) => { setMenuAnchor(event.currentTarget); setMenuProperty(property); }}><MoreHorizRounded /></IconButton>
                </Tooltip>
              </td>
            </tr>)}
          </tbody>
        </table>
        {!filtered.length && <div className="empty">조건에 맞는 물건이 없습니다.</div>}
      </div>
      {filtered.length > PAGE_SIZE && <div className="property-list-pagination"><span>{((page - 1) * PAGE_SIZE + 1).toLocaleString('ko-KR')}–{Math.min(page * PAGE_SIZE, filtered.length).toLocaleString('ko-KR')} / {filtered.length.toLocaleString('ko-KR')}건</span><Pagination page={page} count={Math.ceil(filtered.length / PAGE_SIZE)} onChange={(_, value) => setPage(value)} /></div>}
    </section>

    <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => { setMenuAnchor(null); setMenuProperty(null); }}>
      {menuProperty && [
        { label: 'DA:ON 7P 상세보고서', icon: <DescriptionOutlined fontSize="small" />, action: () => void openDetailedReport(menuProperty.id) },
        { label: 'DA:ON 1P 요약제안서', icon: <PictureAsPdfOutlined fontSize="small" />, action: () => navigate(`/document/proposal/${menuProperty.id}`) },
        { label: '입지 브리핑', icon: <MapOutlined fontSize="small" />, action: () => navigate(`/properties/${menuProperty.id}/briefing`) },
        { label: '물건 수정', icon: <EditOutlined fontSize="small" />, action: () => navigate(`/property/${menuProperty.id}/edit`) },
      ].map((item) => <MenuItem key={item.label} onClick={() => { setMenuAnchor(null); item.action(); }} sx={{ gap: 1.2 }}>{item.icon}{item.label}</MenuItem>)}
      {menuProperty && <MenuItem onClick={() => void remove(menuProperty.id)} sx={{ gap: 1.2, color: 'error.main' }}><DeleteOutlineRounded fontSize="small" />삭제</MenuItem>}
    </Menu>
  </main>;
}
