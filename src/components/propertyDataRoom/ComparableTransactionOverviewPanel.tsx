import { TrendingUpRounded } from '@mui/icons-material';
import { Alert, Button, Chip } from '@mui/material';
import { VERIFICATION_LABELS } from '../../domain/propertyDataRoom/labels';
import type { PropertyDataSource } from '../../domain/propertyDataRoom/types';

interface ComparableRow {
  label: string;
  salePrice: number;
  landAreaPyeong: number;
  landUnitPrice: number;
  approvalYear?: number;
  tradeDate: string;
  address?: string;
}

function readRows(source?: PropertyDataSource): ComparableRow[] {
  const rows = source?.metadata?.rows;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const value = row as Record<string, unknown>;
    const label = typeof value.label === 'string' ? value.label.trim() : '';
    const salePrice = Number(value.salePrice);
    const landAreaPyeong = Number(value.landAreaPyeong);
    const landUnitPrice = Number(value.landUnitPrice);
    const tradeDate = typeof value.tradeDate === 'string' ? value.tradeDate : '';
    if (!label || !tradeDate || !Number.isFinite(salePrice) || !Number.isFinite(landAreaPyeong) || !Number.isFinite(landUnitPrice)) return [];
    return [{
      label,
      salePrice,
      landAreaPyeong,
      landUnitPrice,
      approvalYear: Number.isFinite(Number(value.approvalYear)) ? Number(value.approvalYear) : undefined,
      tradeDate,
      address: typeof value.address === 'string' ? value.address : undefined,
    }];
  });
}

function formatUnitPrice(value: number) {
  return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만/평`;
}

export default function ComparableTransactionOverviewPanel({ sources, onOpenMarket }: {
  sources: PropertyDataSource[];
  onOpenMarket: () => void;
}) {
  const source = sources.find((item) => item.resourceType === 'comparable_transaction_set' && item.fieldKey === 'nearbyTransactions');
  const rows = readRows(source);
  const unitPrices = rows.map((row) => row.landUnitPrice);
  const latestTradeDate = rows.map((row) => row.tradeDate).sort((a, b) => b.localeCompare(a))[0];
  const minUnitPrice = unitPrices.length ? Math.min(...unitPrices) : null;
  const maxUnitPrice = unitPrices.length ? Math.max(...unitPrices) : null;
  const provenance = source?.metadata?.provenance && typeof source.metadata.provenance === 'object'
    ? source.metadata.provenance as Record<string, unknown>
    : undefined;
  const provenanceCompleteCount = Number(provenance?.completeCount);
  const provenanceMissingCount = Number(provenance?.missingCount);
  const provenanceStatus = provenance?.status === 'complete' ? 'complete' : 'review_required';

  return <section style={{ gridColumn: '1 / -1', border: '1px solid #dfe5ec', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
    <div style={{ padding: '15px 18px', background: '#f7f9fb', borderBottom: '1px solid #e5eaf0', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><TrendingUpRounded color="primary" /><div><p className="eyebrow" style={{ margin: 0 }}>MARKET COMPARABLES</p><h2 style={{ margin: '3px 0 0' }}>비교거래 요약</h2></div></div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Chip size="small" variant="outlined" label={`${rows.length}건`} />{source && <Chip size="small" variant="outlined" color={source.verificationStatus === 'verified' || source.verificationStatus === 'confirmed' ? 'success' : source.verificationStatus === 'imported' ? 'info' : 'warning'} label={VERIFICATION_LABELS[source.verificationStatus]} />}</div>
    </div>

    {!rows.length ? <Alert severity="info" sx={{ m: 2 }}>구조화된 비교거래가 없습니다. 비교거래 탭에서 거래사례를 연결하면 시장 요약이 표시됩니다.</Alert> : <div style={{ padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(150px,1fr))', gap: 10 }}>
        <div style={{ padding: 13, border: '1px solid #edf0f4', borderRadius: 9 }}><small style={{ color: '#667085' }}>거래사례</small><strong style={{ display: 'block', fontSize: 22, marginTop: 4 }}>{rows.length}건</strong></div>
        <div style={{ padding: 13, border: '1px solid #edf0f4', borderRadius: 9 }}><small style={{ color: '#667085' }}>토지 평당가 범위</small><strong style={{ display: 'block', fontSize: 17, marginTop: 6 }}>{minUnitPrice !== null && maxUnitPrice !== null ? `${formatUnitPrice(minUnitPrice)} ~ ${formatUnitPrice(maxUnitPrice)}` : '-'}</strong></div>
        <div style={{ padding: 13, border: '1px solid #edf0f4', borderRadius: 9 }}><small style={{ color: '#667085' }}>최근 거래일</small><strong style={{ display: 'block', fontSize: 17, marginTop: 6 }}>{latestTradeDate || '-'}</strong></div>
        <div style={{ padding: 13, border: '1px solid #edf0f4', borderRadius: 9 }}><small style={{ color: '#667085' }}>출처 · 원문 위치</small><strong style={{ display: 'block', fontSize: 13, marginTop: 6 }}>{source?.sourceReference || source?.sourceName || '출처 미연결'}</strong><span style={{ display: 'block', marginTop: 4, color: provenanceStatus === 'complete' ? '#247a4d' : '#a15c00', fontSize: 12 }}>{Number.isFinite(provenanceCompleteCount) ? `row provenance ${provenanceCompleteCount}/${rows.length}` : 'row provenance 미기록'}{Number.isFinite(provenanceMissingCount) && provenanceMissingCount > 0 ? ` · 검토 ${provenanceMissingCount}` : ''}</span></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}><small style={{ color: '#667085' }}>요약치는 구조화된 DataSource rows만 사용하며 원문 검증상태를 그대로 유지합니다.</small><Button size="small" onClick={onOpenMarket}>비교거래 전체 보기</Button></div>
    </div>}
  </section>;
}