import { Alert, Chip } from '@mui/material';
import { useMemo } from 'react';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { openingCutService } from '../services/openingCutService';

export default function OpeningCutPanel({ asset }: { asset: DigitalTwinAsset }) {
  const cuts = useMemo(() => openingCutService.build(asset), [asset]);

  return <section style={{ border: '1px solid #d9e0e8', borderRadius: 10, padding: 14, background: '#fbfcfe' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div>
        <strong>Opening Cut / 문·창 절삭 후보</strong>
        <p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13 }}>승인된 문·창 연결, 검증 치수, 검증 벽 두께를 결합해 어느 벽체에 어떤 개구부를 절삭할지 후보를 구성합니다.</p>
      </div>
      <Chip size="small" color={cuts.length ? 'success' : 'default'} variant="outlined" label={`Cut candidate ${cuts.length}`} />
    </div>

    {!cuts.length ? <Alert severity="info" sx={{ mt: 1.5 }}>개구부 절삭 후보를 만들려면 승인된 wall layer, 벽 두께, 승인된 door/window topology, 확인 치수가 모두 필요합니다.</Alert> : <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
      {cuts.map((cut) => <div key={cut.candidateId} style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 10, alignItems: 'center', padding: 10, border: '1px solid #e5eaf0', borderRadius: 8, background: '#fff' }}>
        <strong>{cut.semantic === 'door' ? 'Door' : 'Window'}</strong>
        <div style={{ color: '#475467', fontSize: 13 }}>{cut.wallLayer} · {cut.widthM.toFixed(2)}m × {cut.heightM.toFixed(2)}m · sill {cut.sillHeightM.toFixed(2)}m</div>
        <Chip size="small" variant="outlined" label="Boolean 미적용" />
      </div>)}
    </div>}

    <Alert severity="warning" sx={{ mt: 1.5 }}>현재 단계는 절삭 위치·치수의 reviewed candidate입니다. 실제 mesh boolean 절삭은 벽체 접합/좌표 정합성 검증 전까지 실행하지 않습니다.</Alert>
  </section>;
}
