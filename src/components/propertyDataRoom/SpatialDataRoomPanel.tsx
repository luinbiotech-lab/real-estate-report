import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Chip, CircularProgress } from '@mui/material';
import {
  BANGBAE_815_11_MEDIA_POLICY,
  FLOOR_PLAN_EXTRACTION_LABELS,
  MEDIA_PROCESSING_LABELS,
  MEDIA_SPACE_MATCH_LABELS,
  SPATIAL_VERIFICATION_LABELS,
  type SpatialMediaDataRoomBundle,
} from '../../domain/propertyDataRoom/spatialMediaModel';
import type { DataRoomBundle } from '../../domain/propertyDataRoom/types';
import { spatialMediaRepository } from '../../repositories/spatialMediaRepository';
import { spatialMediaViewService } from '../../services/spatialMediaViewService';
import { spatialMediaCompatibilityService } from '../../services/spatialMediaCompatibilityService';
import LightweightSpatialViewer from './LightweightSpatialViewer';
const ThreeGlbViewer = lazy(() => import('./ThreeGlbViewer'));
const ThreeSchematicSpaceViewer = lazy(() => import('./ThreeSchematicSpaceViewer'));

const emptySpatialBundle: SpatialMediaDataRoomBundle = {
  floorPlans: [],
  spaces: [],
  mediaAssets: [],
  mediaSpaceLinks: [],
  viewerScenes: [],
  viewerNodes: [],
  viewerEdges: [],
  walkthroughRoutes: [],
  walkthroughSteps: [],
  verificationEvents: [],
};

function StatusChip({ status }: { status: keyof typeof SPATIAL_VERIFICATION_LABELS }) {
  const color: 'default' | 'warning' | 'success' | 'error' = status === 'conflict' || status === 'rejected'
    ? 'error'
    : status === 'field_checked' || status === 'owner_confirmed' || status === 'agent_verified'
      ? 'success'
      : status === 'estimated' || status === 'ai_estimated'
        ? 'warning'
        : 'default';
  return <Chip size="small" color={color} label={SPATIAL_VERIFICATION_LABELS[status]} />;
}

function EmptyLine({ children }: { children: string }) {
  return <p className="readiness-copy">{children}</p>;
}

export default function SpatialDataRoomPanel({
  propertyId,
  propertyAddress,
  mode = 'spatial',
  onOpenDigitalTwinIntake,
  legacyBundle,
}: {
  propertyId: string;
  propertyAddress?: string;
  mode?: 'spatial' | 'viewer';
  onOpenDigitalTwinIntake?: () => void;
  legacyBundle?: DataRoomBundle;
}) {
  const [bundle, setBundle] = useState<SpatialMediaDataRoomBundle>(emptySpatialBundle);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const typed = await spatialMediaRepository.getBundle(propertyId);
      setBundle(legacyBundle ? spatialMediaCompatibilityService.mergePreferTyped(typed, legacyBundle) : typed);
    } catch (reason) {
      if (legacyBundle) {
        setBundle(spatialMediaCompatibilityService.fromLegacyBundle(legacyBundle));
        setError('새 spatial schema 연결 전이라 기존 Data Room 데이터를 호환 모드로 표시하고 있습니다.');
      } else {
        setError(reason instanceof Error ? reason.message : '공간·미디어 데이터를 불러오지 못했습니다.');
      }
    } finally {
      setLoading(false);
    }
  }, [legacyBundle, propertyId]);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => spatialMediaViewService.summarize(bundle), [bundle]);
  const isBangbae81511 = (propertyAddress ?? '').replace(/\s+/g, '').includes('방배동815-11');
  const effectivePolicy = bundle.mediaPolicy ?? (isBangbae81511 ? { propertyId, ...BANGBAE_815_11_MEDIA_POLICY } : undefined);

  if (loading) return <div className="center"><CircularProgress size={28} /><p>공간·미디어 구조를 불러오는 중입니다.</p></div>;

  return <div className="data-room-overview spatial-data-room-panel">
    {error && <Alert severity="error">{error}</Alert>}

    <section>
      <div className="section-heading-row">
        <div><p className="eyebrow">SPATIAL DATA QUALITY</p><h2>{mode === 'viewer' ? '3D / Walkthrough 준비도' : '도면 · 공간 · 미디어 준비도'}</h2></div>
        <Chip size="small" color={summary.reportSpatialReady ? 'success' : 'warning'} label={summary.reportSpatialReady ? '보고서 연결 가능' : '보완 필요'} />
      </div>
      <div className="data-room-summary">
        {[
          ['도면', summary.floorPlans, '건'],
          ['공간', summary.spaces, '개'],
          ['미디어', summary.mediaAssets, '개'],
          ['미매칭', summary.unmatchedMedia, '개'],
          ['Viewer', summary.readyViewerScenes, '개'],
          ['Walkthrough', summary.walkthroughRoutes, '개'],
          ['현장확인+', summary.fieldCheckedOrHigher, '건'],
        ].map(([label, value, unit]) => <div key={String(label)}><small>{label}</small><strong>{value}</strong><span>{unit}</span></div>)}
      </div>
      {summary.conflictCount > 0 && <Alert severity="error">출처 또는 검증 상태 충돌 {summary.conflictCount}건이 있습니다. 보고서 확정 전에 해소해야 합니다.</Alert>}
      {!summary.spatialReady && <Alert severity="warning">도면과 공간 구조가 모두 연결되어야 3D/Walkthrough 생성 단계로 넘어갈 수 있습니다.</Alert>}
    </section>

    {effectivePolicy && <section>
      <p className="eyebrow">PROPERTY MEDIA POLICY</p>
      <h2>매물별 미디어 사용 정책</h2>
      <div className="missing-list">
        <span>내부 사진 <Chip size="small" color={effectivePolicy.allowInteriorPhotos ? 'success' : 'warning'} label={effectivePolicy.allowInteriorPhotos ? '허용' : '사용 제한'} /></span>
        <span>외관 사진 <Chip size="small" color={effectivePolicy.allowExteriorPhotos ? 'success' : 'default'} label={effectivePolicy.allowExteriorPhotos ? '허용' : '제한'} /></span>
        <span>로드뷰 <Chip size="small" color={effectivePolicy.allowRoadview ? 'success' : 'default'} label={effectivePolicy.allowRoadview ? '허용' : '제한'} /></span>
        <span>AI 시각화 <Chip size="small" color={effectivePolicy.allowAiVisualization ? 'warning' : 'default'} label={effectivePolicy.allowAiVisualization ? '구분 표시 후 허용' : '미사용'} /></span>
      </div>
      {effectivePolicy.restrictionNote && <Alert severity="info">{effectivePolicy.restrictionNote}</Alert>}
      {!bundle.mediaPolicy && isBangbae81511 && <EmptyLine>현재 화면은 방배동 815-11 확정 정책을 기본값으로 표시하지만 Production DB에는 아직 별도 저장하지 않았습니다.</EmptyLine>}
    </section>}

    {mode === 'spatial' && <>
      <section>
        <div className="section-heading-row"><div><p className="eyebrow">FLOOR PLAN PIPELINE</p><h2>도면</h2></div><Chip size="small" label={String(summary.verifiedFloorPlans) + '/' + String(summary.floorPlans) + ' 검증'} /></div>
        {bundle.floorPlans.length ? <div className="asset-list">{bundle.floorPlans.map((plan) => <article key={plan.id}>
          <div><b>{plan.floorLabel || plan.originalFilename}</b><span>{plan.fileType.toUpperCase()} · {FLOOR_PLAN_EXTRACTION_LABELS[plan.extractionStatus]}</span></div>
          <StatusChip status={plan.verificationStatus} />
        </article>)}</div> : <EmptyLine>등록된 typed 도면이 없습니다. 기존 Digital Twin 원본은 유지되며 새 spatial contract와 연결이 필요합니다.</EmptyLine>}
      </section>

      <section>
        <div className="section-heading-row"><div><p className="eyebrow">SPACE MODEL</p><h2>층 · 공간 구조</h2></div><Chip size="small" label={String(summary.verifiedSpaces) + '/' + String(summary.spaces) + ' 검증'} /></div>
        {bundle.spaces.length ? <div className="asset-list">{bundle.spaces.map((space) => <article key={space.id}>
          <div><b>{space.spaceName}</b><span>{(space.floorId || '층 미지정') + ' · ' + space.spaceType + (typeof space.areaM2 === 'number' ? ' · ' + space.areaM2.toFixed(1) + '㎡' : '')}</span></div>
          <StatusChip status={space.verificationStatus} />
        </article>)}</div> : <EmptyLine>공간 구조가 아직 새 spatial schema에 연결되지 않았습니다.</EmptyLine>}
      </section>

      <section>
        <div className="section-heading-row"><div><p className="eyebrow">MEDIA TO SPACE</p><h2>사진 · 영상 → 공간 매칭</h2></div><Chip size="small" color={summary.unmatchedMedia ? 'warning' : 'success'} label={'미매칭 ' + String(summary.unmatchedMedia)} /></div>
        {bundle.mediaAssets.length ? <div className="asset-list">{bundle.mediaAssets.map((asset) => {
          const links = bundle.mediaSpaceLinks.filter((link) => link.mediaAssetId === asset.id);
          const best = links.find((link) => link.matchStatus === 'verified') ?? links.find((link) => link.matchStatus === 'matched') ?? links[0];
          return <article key={asset.id}>
            <div><b>{asset.caption || asset.originalFilename}</b><span>{asset.mediaType + ' · ' + MEDIA_PROCESSING_LABELS[asset.processingStatus] + (best ? ' · ' + MEDIA_SPACE_MATCH_LABELS[best.matchStatus] : ' · 공간 미매칭')}</span></div>
            <StatusChip status={asset.verificationStatus} />
          </article>;
        })}</div> : <EmptyLine>새 media_assets 구조에 연결된 사진·영상이 없습니다. 기존 Property Media는 그대로 유지됩니다.</EmptyLine>}
      </section>
    </>}

    {mode === 'viewer' && <>
      {bundle.spaces.some((space) => space.geometry2d?.type === 'normalized_rect' && space.geometry2d?.coordinateSpace === 'floor_plan_image') && <section>
        <div className="section-heading-row"><div><p className="eyebrow">SCHEMATIC 3D</p><h2>Raster 공간 박스 3D</h2></div><Chip size="small" color="warning" label="unscaled" /></div>
        <Suspense fallback={<div className="center"><CircularProgress size={28} /><p>공간 3D 모듈을 불러오는 중입니다.</p></div>}>
          <ThreeSchematicSpaceViewer spaces={bundle.spaces} />
        </Suspense>
      </section>}
      {bundle.viewerScenes.some((scene) => (scene.modelSourceType === 'glb' || scene.modelSourceType === 'gltf') && scene.modelUrl) && <section>
        <div className="section-heading-row"><div><p className="eyebrow">THREE.JS MODEL</p><h2>GLB / GLTF Viewer</h2></div><Chip size="small" color="success" label="3D model connected" /></div>
        {bundle.viewerScenes
          .filter((scene) => (scene.modelSourceType === 'glb' || scene.modelSourceType === 'gltf') && scene.modelUrl)
          .map((scene) => <Suspense key={scene.id} fallback={<div className="center"><CircularProgress size={28} /><p>3D Viewer 모듈을 불러오는 중입니다.</p></div>}><ThreeGlbViewer modelUrl={scene.modelUrl!} title={scene.title} /></Suspense>)}
      </section>}
      <section>
        <div className="section-heading-row"><div><p className="eyebrow">LIGHTWEIGHT VIEWER</p><h2>층 · 공간 구조 Viewer</h2></div><Chip size="small" label={String(summary.spaces) + ' spaces'} /></div>
        <LightweightSpatialViewer spaces={bundle.spaces} />
      </section>
      <section>
        <div className="section-heading-row"><div><p className="eyebrow">VIEWER SCENES</p><h2>3D Viewer</h2></div><Chip size="small" label={String(summary.readyViewerScenes) + '/' + String(summary.viewerScenes) + ' 준비'} /></div>
        {bundle.viewerScenes.length ? <div className="asset-list">{bundle.viewerScenes.map((scene) => <article key={scene.id}>
          <div><b>{scene.title}</b><span>{scene.sceneType + ' · ' + scene.generationStatus}</span></div>
          <StatusChip status={scene.verificationStatus} />
        </article>)}</div> : <EmptyLine>생성된 Viewer scene이 없습니다. 우선 floor_stack → space_model → photo_walkthrough 순서로 구축합니다.</EmptyLine>}
      </section>

      <section>
        <div className="section-heading-row"><div><p className="eyebrow">WALKTHROUGH</p><h2>이동 경로</h2></div><Chip size="small" color={summary.walkthroughReady ? 'success' : 'default'} label={summary.walkthroughReady ? '준비됨' : '미구성'} /></div>
        {bundle.walkthroughRoutes.length ? <div className="asset-list">{bundle.walkthroughRoutes.map((route) => {
          const steps = bundle.walkthroughSteps.filter((step) => step.routeId === route.id).sort((a, b) => a.sequenceOrder - b.sequenceOrder);
          return <article key={route.id}>
            <div><b>{route.title + (route.isDefault ? ' · 기본 경로' : '')}</b><span>{route.routeType + ' · ' + String(steps.length) + '단계' + (steps.length ? ' · ' + steps.map((step) => step.title).join(' → ') : '')}</span></div>
            <Chip size="small" label={String(steps.length) + ' steps'} />
          </article>;
        })}</div> : <EmptyLine>Walkthrough 경로가 없습니다. 공간·미디어 매칭 완료 후 경로를 구성합니다.</EmptyLine>}
      </section>

      <section>
        <p className="eyebrow">NEXT ACTION</p>
        <h2>3D 원본 연결</h2>
        <p className="readiness-copy">정밀 BIM을 먼저 만들지 않고 도면/공간/미디어가 검증된 뒤 lightweight viewer를 생성합니다.</p>
        {onOpenDigitalTwinIntake && <Button variant="contained" onClick={onOpenDigitalTwinIntake}>도면 · 3D 자료 등록/추가</Button>}
      </section>
    </>}
  </div>;
}
