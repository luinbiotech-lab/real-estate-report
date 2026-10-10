import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress } from '@mui/material';
import SearchRounded from '@mui/icons-material/SearchRounded';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import type { Property } from '../types';
import { publicPropertyDiscoveryService, type PropertyDiscoveryResult } from '../services/publicPropertyDiscoveryService';

const won = (value?: number) => value ? new Intl.NumberFormat('ko-KR').format(value) + '원' : '-';
const sqm = (value?: number) => value != null ? new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(value) + '㎡' : '-';

export default function PropertyPublicDiscoveryPanel({
  property,
  onApply,
  onResolved,
}: {
  property: Property;
  onApply: (patch: Partial<Property>) => void;
  onResolved: (result: PropertyDiscoveryResult) => void;
}) {
  const [query, setQuery] = useState(property.address || '');
  const [result, setResult] = useState<PropertyDiscoveryResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!query && property.address) setQuery(property.address);
  }, [property.address, query]);

  const search = async () => {
    const value = query.trim();
    if (!value) return;
    setLoading(true); setError('');
    try {
      const next = await publicPropertyDiscoveryService.discover(value);
      setResult(next);
      onResolved(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '부동산 공공데이터 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const building = result?.building;
  const trades = [...(result?.market?.commercial || []), ...(result?.market?.land || [])]
    .sort((a, b) => b.dealDate.localeCompare(a.dealDate))
    .slice(0, 6);

  return <section className="form-section">
    <div className="section-heading-row">
      <div>
        <p className="eyebrow">PROPERTY DISCOVERY</p>
        <h2>주소 · 지번으로 건물 자동조회</h2>
        <p>주소를 입력하면 필지/건물을 먼저 식별하고 공적 장부와 최근 실거래를 조회합니다. 조회값은 확인 후 적용됩니다.</p>
      </div>
      <Chip size="small" icon={<VerifiedRounded />} label="출처 추적" />
    </div>

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr auto' }, gap: 1 }}>
      <input
        aria-label="건물 조회 주소"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void search(); } }}
        placeholder="예: 서울 서초구 방배동 815-11"
        style={{ minHeight: 44, border: '1px solid #c8d0da', borderRadius: 8, padding: '0 12px', fontSize: 15 }}
      />
      <Button variant="contained" startIcon={loading ? <CircularProgress size={16} /> : <SearchRounded />} disabled={loading || !query.trim()} onClick={() => void search()}>
        건물 조회
      </Button>
    </Box>

    {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
    {result?.status === 'not_found' && <Alert severity="warning" sx={{ mt: 1.5 }}>주소/지번에 해당하는 위치를 찾지 못했습니다.</Alert>}
    {result?.address && <Box sx={{ mt: 1.5, border: '1px solid #dce2e9', borderRadius: 2, p: 1.5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <strong>{result.address.officialAddress}</strong>
          <div style={{ color: '#667085', fontSize: 13, marginTop: 4 }}>
            지번 {result.address.lotAddress || '-'} · 법정동코드 {result.address.bCode || '-'} · 좌표 {result.address.latitude.toFixed(6)}, {result.address.longitude.toFixed(6)}
          </div>
        </div>
        <Chip size="small" color="success" label="주소 식별 완료" />
      </div>

      {!result.publicDataConfigured && <Alert severity="info" sx={{ mt: 1.25 }}>
        주소·좌표 식별은 완료했습니다. 건축물대장/국토부 실거래 자동조회는 공공데이터포털 서비스키 등록 후 활성화됩니다.
      </Alert>}

      {building && <Box sx={{ mt: 1.5 }}>
        <h3 style={{ margin: '0 0 8px' }}>{building.buildingName || '건축물대장 조회 건물'}</h3>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1 }}>
          {[
            ['대지면적', sqm(building.landAreaSqm)],
            ['연면적', sqm(building.totalFloorAreaSqm)],
            ['건축면적', sqm(building.buildingAreaSqm)],
            ['층수', `지상 ${building.groundFloors} / 지하 ${building.basementFloors}`],
            ['주용도', building.mainUse || '-'],
            ['구조', building.structure || '-'],
            ['건폐율', building.buildingCoverageRate != null ? building.buildingCoverageRate + '%' : '-'],
            ['용적률', building.floorAreaRatio != null ? building.floorAreaRatio + '%' : '-'],
            ['사용승인일', building.completionDate || '-'],
            ['주차', building.parkingOfficial != null ? building.parkingOfficial + '대' : '-'],
            ['승강기', building.elevatorCount != null ? building.elevatorCount + '대' : '-'],
            ['층별개요', (result.floors?.length || 0) + '건'],
          ].map(([label, value]) => <div key={label} style={{ background: '#f7f9fb', borderRadius: 8, padding: 10 }}>
            <small style={{ color: '#667085' }}>{label}</small><div style={{ marginTop: 3, fontWeight: 700 }}>{value}</div>
          </div>)}
        </Box>
        <Button sx={{ mt: 1.5 }} variant="outlined" onClick={() => onApply(publicPropertyDiscoveryService.patchFrom(result))}>공적정보 적용</Button>
      </Box>}

      {result.publicDataConfigured && !building && <Alert severity="warning" sx={{ mt: 1.25 }}>
        주소는 식별됐지만 해당 지번에서 건축물대장 표제부를 찾지 못했습니다. 나대지/부속지번/집합건물 여부를 추가 확인해야 합니다.
      </Alert>}

      {trades.length > 0 && <Box sx={{ mt: 1.5 }}>
        <strong>최근 실거래 후보</strong>
        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
          {trades.map((trade, index) => <div key={index} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 130px', gap: 8, padding: '8px 10px', border: '1px solid #e4e7ec', borderRadius: 8, fontSize: 13 }}>
            <span>{trade.dealDate || '-'}</span>
            <span>{trade.legalDong} {trade.jibun} {trade.buildingName}</span>
            <strong style={{ textAlign: 'right' }}>{won(trade.dealAmount)}</strong>
          </div>)}
        </div>
        <small style={{ display: 'block', marginTop: 7, color: '#667085' }}>동일 건물 확정 거래가 아니라 법정동·최근기간 기준 후보입니다. 지번/면적/용도 일치도를 추가 검증해 비교거래로 승격합니다.</small>
      </Box>}
    </Box>}
  </section>;
}
