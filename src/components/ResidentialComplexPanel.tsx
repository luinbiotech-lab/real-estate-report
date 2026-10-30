import { useMemo, useState } from 'react';
import { Alert, Box, Chip, ToggleButton, ToggleButtonGroup } from '@mui/material';
import type { ResidentialDealKind, ResidentialMarket } from '../services/publicPropertyDiscoveryService';
import { formatWonShort } from '../domain/propertyDetail/discoverySummary';
import {
  DEAL_KIND_LABELS, apiStatusLabel, areaBandLabel, complexMatchLabel, dealPriceText, dealsInBand, defaultAreaBand, unapprovedApis,
} from '../domain/propertyDetail/residentialCompare';

/*
 * Issue #37 phase 2: apartment / row-house / officetel / detached comparison. Complex → area band → sale / jeonse / monthly.
 * A unit (호실) is never inferred from the lot; every row is a candidate and the jeonse ratio is a calculated value.
 */
export default function ResidentialComplexPanel({ market }: { market: ResidentialMarket }) {
  const bands = market.summary?.areaBands ?? [];
  const [bandKey, setBandKey] = useState<string | undefined>(() => defaultAreaBand(bands)?.key);
  const [kind, setKind] = useState<ResidentialDealKind | 'all'>('all');
  const band = bands.find((item) => item.key === bandKey) ?? defaultAreaBand(bands);
  const deals = useMemo(() => dealsInBand(market.complexDeals ?? [], band, kind).slice(0, 12), [market.complexDeals, band, kind]);
  const missing = unapprovedApis(market);
  const statuses = Object.entries(market.apiStatus ?? {});

  return <Box data-testid="residential-complex" sx={{ mt: 1.5 }}>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
      {statuses.map(([id, status]) => <Chip key={id} size="small"
        color={status.status === 'ok' ? 'success' : status.status === 'partial' ? 'warning' : 'default'}
        variant={status.status === 'ok' ? 'filled' : 'outlined'}
        label={`${status.label.replace('국토교통부 ', '').replace(' 실거래가', '')}: ${apiStatusLabel(status)}`} />)}
    </Box>
    {market.error && <Alert severity="warning" sx={{ mt: 1 }}>주거 실거래 조회 중 오류: {market.error}</Alert>}
    {missing.length > 0 && <Alert severity="info" sx={{ mt: 1 }} data-testid="residential-unapproved">
      공공데이터포털 활용신청이 승인되지 않은 자료가 있습니다: {missing.join(', ')}. 승인 전에는 해당 거래를 0건이 아니라 <strong>미연결</strong>로 표시합니다.
    </Alert>}

    {market.summary && <>
      <div style={{ marginTop: 10, fontSize: 13, color: '#475467' }}>
        대상: <strong>{market.target?.complexName || market.summary.complexNames[0] || '단지명 미확인'}</strong> · 지번 {market.target?.lot || '-'}
        {market.summary.complexNames.length > 1 ? ` · 거래 단지명 ${market.summary.complexNames.join(', ')}` : ''}
      </div>

      {bands.length > 0 ? <>
        <div style={{ marginTop: 10, fontWeight: 700, fontSize: 13 }}>전용면적 선택</div>
        <Box data-testid="residential-area-bands" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
          {bands.map((item) => <Chip key={item.key} clickable color={item.key === band?.key ? 'primary' : 'default'} variant={item.key === band?.key ? 'filled' : 'outlined'}
            onClick={() => setBandKey(item.key)} label={`${areaBandLabel(item)} · ${item.sale.count + item.jeonse.count + item.monthly.count}건`} />)}
        </Box>

        {band && <Box data-testid="residential-band-stats" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1, mt: 1 }}>
          {([
            ['매매 중앙값', band.sale.medianDealAmount ? formatWonShort(band.sale.medianDealAmount) : '거래 없음',
              `${band.sale.comparableCount}건${band.sale.medianPricePerPyeong ? ` · 전용 ${formatWonShort(band.sale.medianPricePerPyeong)}/평` : ''}${band.sale.cancelledCount ? ` · 해제 ${band.sale.cancelledCount}건 제외` : ''}`],
            ['전세 중앙값', band.jeonse.medianDeposit ? formatWonShort(band.jeonse.medianDeposit) : '거래 없음',
              `${band.jeonse.comparableCount}건${band.jeonseRatioPercent != null ? ` · 전세가율 ${band.jeonseRatioPercent}% (계산값)` : ''}`],
            ['월세 중앙값', band.monthly.medianMonthlyRent ? `보증금 ${formatWonShort(band.monthly.medianDeposit ?? 0)} / 월 ${formatWonShort(band.monthly.medianMonthlyRent)}` : '거래 없음',
              `${band.monthly.comparableCount}건`],
          ] as const).map(([label, value, note]) => <div key={label} style={{ background: '#fff', border: '1px solid #e4e7ec', borderRadius: 8, padding: 10, minWidth: 0 }}>
            <small style={{ color: '#667085' }}>{label}</small>
            <div style={{ fontWeight: 700, marginTop: 3, overflowWrap: 'anywhere' }}>{value}</div>
            <small style={{ color: '#8a94a3', display: 'block', overflowWrap: 'anywhere' }}>{note}</small>
          </div>)}
        </Box>}

        <ToggleButtonGroup size="small" exclusive value={kind} onChange={(_, value) => value && setKind(value)} sx={{ mt: 1.25, flexWrap: 'wrap' }} aria-label="거래 구분">
          <ToggleButton value="all">전체</ToggleButton>
          {(['sale', 'jeonse', 'monthly'] as const).map((item) => <ToggleButton key={item} value={item}>{DEAL_KIND_LABELS[item]}</ToggleButton>)}
        </ToggleButtonGroup>

        <div data-testid="residential-deals" style={{ display: 'grid', gap: 6, marginTop: 8 }}>
          {deals.map((deal, index) => <div key={`${deal.dealDate}-${index}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, padding: '8px 10px', border: '1px solid #e4e7ec', borderRadius: 8, fontSize: 13 }}>
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
              <strong>{DEAL_KIND_LABELS[deal.dealKind]}</strong> · {deal.dealDate || '-'} · {deal.floor ? `${deal.floor}층` : '층 미기재'} · {deal.exclusiveAreaSqm ? `${deal.exclusiveAreaSqm}㎡` : '면적 미기재'}
              {deal.complexDong ? ` · ${deal.complexDong}` : ''}
              <small style={{ display: 'block', color: '#667085' }}>{complexMatchLabel(deal)}{deal.contractType ? ` · ${deal.contractType}` : ''}</small>
            </span>
            <strong style={{ textAlign: 'right' }}>{dealPriceText(deal)}
              {deal.comparableExclusion && <small style={{ display: 'block', fontWeight: 400, color: '#b54708' }}>해제 거래 · 비교 제외</small>}
            </strong>
          </div>)}
          {!deals.length && <Alert severity="info">선택한 면적·구분의 거래 후보가 없습니다.</Alert>}
        </div>
      </> : <Alert severity="info" sx={{ mt: 1 }} data-testid="residential-no-complex">
        최근 {market.months?.length ?? 6}개월 동안 동일 지번·단지명의 거래 후보가 없습니다. 같은 동 후보: 매매 {market.summary.neighbourhood.sale.count}건 · 전세 {market.summary.neighbourhood.jeonse.count}건 · 월세 {market.summary.neighbourhood.monthly.count}건.
      </Alert>}
    </>}
    <small style={{ display: 'block', marginTop: 8, color: '#667085' }}>{market.interpretation || '모든 거래는 후보이며 호실 거래로 확정하지 않습니다.'}</small>
  </Box>;
}
