import { DownloadRounded } from '@mui/icons-material';
import { Alert, Button, Chip } from '@mui/material';
import { useMemo } from 'react';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { BUILDING_PRODUCTION_CANDIDATE_VERSION, buildingProductionGateService } from '../services/buildingProductionGateService';
import BuildingReleasePanel from './BuildingReleasePanel';

function downloadText(content: string, fileName: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function BuildingProductionGatePanel({ assets }: { assets: DigitalTwinAsset[] }) {
  const candidate = useMemo(() => buildingProductionGateService.build(assets), [assets]);
  return <>
    <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 18, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>Building Production Gate / 다층 Candidate Release</h2>
          <p style={{ margin: '6px 0 0', color: '#667085' }}>각 층의 production geometry candidate가 최신 Human Review 소스와 일치할 때만 다층 production candidate package를 구성합니다.</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip color={candidate.productionCandidateReady ? 'success' : 'warning'} label={candidate.productionCandidateReady ? 'RELEASE READY' : 'BLOCKED'} />
          <Chip variant="outlined" label={`Current ${candidate.currentCandidateCount}/${assets.length}`} />
          <Chip variant="outlined" color={candidate.staleCandidateCount ? 'warning' : 'default'} label={`Stale ${candidate.staleCandidateCount}`} />
          <Button size="small" variant="outlined" startIcon={<DownloadRounded />} disabled={!candidate.productionCandidateReady} onClick={() => downloadText(buildingProductionGateService.toJson(assets), `${BUILDING_PRODUCTION_CANDIDATE_VERSION}.json`)}>Production Package JSON</Button>
        </div>
      </div>

      {candidate.blockers.length > 0 ? <Alert severity="warning" sx={{ mt: 1.5 }}>{candidate.blockers.join(' / ')}</Alert> : <Alert severity="success" sx={{ mt: 1.5 }}>모든 층 candidate가 현재 검증 소스와 일치합니다. 다층 production candidate package를 내보낼 수 있습니다.</Alert>}

      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {candidate.floors.map((floor) => <div key={floor.assetId} style={{ display: 'grid', gridTemplateColumns: '90px 120px 1fr auto', gap: 10, alignItems: 'center', padding: 10, border: '1px solid #e5eaf0', borderRadius: 8 }}>
          <strong>{floor.floorLabel}</strong>
          <span>Z {floor.elevationM.toFixed(2)}m</span>
          <small style={{ color: '#667085' }}>{floor.engineId || 'engine 미확인'} · {floor.sourceFingerprint}</small>
          <Chip size="small" color="success" label="CURRENT" />
        </div>)}
      </div>

      <Alert severity="warning" sx={{ mt: 1.5 }}>RELEASE READY는 DA:ON 내부 production candidate package 생성 조건 충족을 의미합니다. constructionReady=false / legalBimReady=false이며 구조·소방·피난·인허가·실시설계 승인과 동일하지 않습니다.</Alert>
    </section>
    <BuildingReleasePanel assets={assets} />
  </>;
}