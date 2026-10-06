import { Alert, Chip } from '@mui/material';
import type { DigitalTwinAsset, PropertyMedia } from '../domain/propertyDataRoom/types';
import {
  digitalTwinVisionFoundationService,
  TWIN_INPUT_CAPABILITIES,
  TWIN_REALITY_MODES,
  TWIN_SPATIAL_MATCHING_STAGES,
  TWIN_VIEWER_CAPABILITIES,
} from '../services/digitalTwinVisionFoundationService';

const modeLabel = {
  concept_estimate: 'Concept Mode',
  assisted_reality: 'Assisted Reality',
  verified_twin: 'Verified Twin',
};

export default function DigitalTwinVisionFoundationPanel({ assets, media }: { assets: DigitalTwinAsset[]; media: PropertyMedia[] }) {
  const readiness = digitalTwinVisionFoundationService.summarizeReadiness(assets, media);
  return <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20, marginBottom: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
      <div>
        <p className="eyebrow">DIGITAL TWIN VISION FOUNDATION</p>
        <h2 style={{ margin: '4px 0' }}>도면·사진·영상·스캔 통합 3D 재현 구조</h2>
        <p style={{ color: '#667085', margin: 0 }}>도면만으로 Concept 3D를 만들고, 사진·영상으로 현장감을 보강하며, 스캔/현장확인으로 Verified Twin까지 승격하는 구조입니다.</p>
      </div>
      <Chip color="primary" label={modeLabel[readiness.recommendedMode]} />
    </div>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginBottom: 16 }}>
      {[
        ['도면 원본', readiness.drawingAssets], ['사진/360', readiness.photoMedia], ['동영상', readiness.videoMedia], ['스캔/mesh', readiness.scanAssets],
      ].map(([label, value]) => <div key={String(label)} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, background: '#fbfcfe' }}><small style={{ color: '#667085' }}>{label}</small><strong style={{ display: 'block', fontSize: 24, marginTop: 6 }}>{value}</strong></div>)}
    </section>

    {readiness.missingForNextMode.length > 0 && <Alert severity="info" sx={{ mb: 2 }}>다음 재현 수준으로 가려면 {readiness.missingForNextMode.join(' · ')} 자료가 필요합니다.</Alert>}

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
      <article style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
        <h3 style={{ marginTop: 0 }}>1. 입력 자료</h3>
        {TWIN_INPUT_CAPABILITIES.map((item) => <div key={item.family} style={{ marginTop: 10 }}><strong>{item.label}</strong><p style={{ color: '#667085', margin: '4px 0' }}>{item.purpose}</p><small>{item.acceptedSources.join(' · ')}</small></div>)}
      </article>
      <article style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
        <h3 style={{ marginTop: 0 }}>2. 재현 모드</h3>
        {TWIN_REALITY_MODES.map((item) => <div key={item.mode} style={{ marginTop: 10 }}><strong>{item.label}</strong><p style={{ color: '#667085', margin: '4px 0' }}>사용: {item.usableFor.join(' · ')}</p><small>차단: {item.blockedFor.join(' · ')}</small></div>)}
      </article>
      <article style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
        <h3 style={{ marginTop: 0 }}>3. 사진/영상 → 공간 매칭</h3>
        {TWIN_SPATIAL_MATCHING_STAGES.map((item) => <div key={item.id} style={{ marginTop: 10 }}><strong>{item.label}</strong><p style={{ color: '#667085', margin: '4px 0' }}>{item.output}</p><small>provenance required={String(item.provenanceRequired)} · {item.reviewState}</small></div>)}
      </article>
      <article style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
        <h3 style={{ marginTop: 0 }}>4. Viewer / Walkthrough / XR</h3>
        {TWIN_VIEWER_CAPABILITIES.map((item) => <div key={item.surface} style={{ marginTop: 10 }}><strong>{item.label}</strong><p style={{ color: '#667085', margin: '4px 0' }}>{item.purpose}</p><small>{item.readinessGate.join(' → ')}</small></div>)}
      </article>
    </div>

    <Alert severity="warning" sx={{ mt: 2 }}>모든 결과는 Concept / Assisted Reality / Verified Twin 상태를 구분합니다. 도면 기반 추정, 사진·영상 보강, 현장확인/스캔 검증은 같은 신뢰도로 취급하지 않습니다.</Alert>
  </section>;
}
