import { Box, Chip, MenuItem, TextField } from '@mui/material';
import type { ListingStatus, Property } from '../types';

const OPTIONS: Array<{ value: ListingStatus; label: string; note: string }> = [
  { value: 'unknown', label: '미확인', note: '외부/내부 매물 근거 미확인' },
  { value: 'daon_exclusive', label: 'DA:ON 전속 매물', note: '전속계약 또는 내부 확인 필요' },
  { value: 'daon_active', label: 'DA:ON 일반 매물', note: '내부 매물 등록/영업 확인' },
  { value: 'external_observed', label: '외부 매물 확인', note: '외부 공급원 관측값' },
  { value: 'off_market_confirmed', label: '비매물 확인', note: '소유자/현장/공급원 확인 필요' },
];

export default function MarketPresencePanel({
  property,
  onChange,
}: {
  property: Property;
  onChange: (patch: Partial<Property>) => void;
}) {
  const status = property.listingStatus || 'unknown';
  const option = OPTIONS.find((item) => item.value === status) || OPTIONS[0];

  return <section className="form-section">
    <div className="section-heading-row">
      <div>
        <p className="eyebrow">MARKET PRESENCE</p>
        <h2>현재 매물 상태</h2>
        <p>거래유형과 별개로 실제 매물 노출/계약 상태를 관리합니다. 외부 공급원이 연결되기 전에는 자동으로 매물이라고 판단하지 않습니다.</p>
      </div>
      <Chip size="small" color={status === 'unknown' ? 'default' : 'primary'} label={option.label} />
    </div>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.25 }}>
      <TextField
        select
        label="매물 상태"
        value={status}
        onChange={(event) => {
          const value = event.target.value as ListingStatus;
          onChange({
            listingStatus: value,
            listingStatusCheckedAt: value === 'unknown' ? '' : new Date().toISOString(),
          });
        }}
      >
        {OPTIONS.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
      </TextField>
      <TextField
        label="확인 출처"
        value={property.listingStatusSource || ''}
        onChange={(event) => onChange({ listingStatusSource: event.target.value })}
        placeholder="예: 전속계약서, 소유자 확인, 외부 공급원"
      />
      <TextField
        multiline
        minRows={2}
        label="매물 상태 메모"
        value={property.listingStatusNote || ''}
        onChange={(event) => onChange({ listingStatusNote: event.target.value })}
        placeholder="확인 근거와 예외사항"
      />
      <Box sx={{ p: 1.25, bgcolor: '#f8fafc', border: '1px solid #e4e7ec', borderRadius: 1 }}>
        <small style={{ color: '#667085' }}>판정 기준</small>
        <div style={{ fontWeight: 700, marginTop: 4 }}>{option.note}</div>
        <div style={{ color: '#667085', fontSize: 12, marginTop: 4 }}>
          {property.listingStatusCheckedAt ? `최근 확인 ${new Date(property.listingStatusCheckedAt).toLocaleString('ko-KR')}` : '확인 시점 없음'}
        </div>
      </Box>
    </Box>
  </section>;
}
