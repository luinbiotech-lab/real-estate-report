import { Alert, Button, Chip } from '@mui/material';
import { RestartAltRounded, RocketLaunchRounded, ScienceRounded } from '@mui/icons-material';
import { useEffect, useMemo, useState } from 'react';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { geometryMutationEngineService } from '../services/geometryMutationEngineService';
import { geometryMutationTransactionService } from '../services/geometryMutationTransactionService';
import { geometryProductionAuditService } from '../services/geometryProductionAuditService';

export default function GeometryMutationPanel({ asset, onSaved }: { asset: DigitalTwinAsset; onSaved?: () => void | Promise<void> }) {
  const [currentAsset, setCurrentAsset] = useState(asset);
  useEffect(() => setCurrentAsset(asset), [asset]);
  const preview = useMemo(() => geometryMutationEngineService.mutate(currentAsset), [currentAsset]);
  const productionCandidate = useMemo(() => geometryMutationTransactionService.getProductionCandidate(currentAsset), [currentAsset]);
  const productionState = useMemo(() => geometryMutationTransactionService.getState(currentAsset), [currentAsset]);
  const history = useMemo(() => geometryMutationTransactionService.getHistory(currentAsset), [currentAsset]);
  const audit = useMemo(() => geometryProductionAuditService.build(currentAsset), [currentAsset]);
  const rolledBackPromotionIds = useMemo(() => new Set(history.filter((item) => item.action === 'rollback' && item.targetPromotionId).map((item) => item.targetPromotionId)), [history]);
  const rollbackAvailable = useMemo(() => history.some((item) => item.action === 'production_candidate_promoted' && !rolledBackPromotionIds.has(item.id)), [history, rolledBackPromotionIds]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const run = async (action: 'save' | 'promote' | 'rollback') => {
    setBusy(action); setMessage(''); setError('');
    try {
      if (action === 'save') {
        const { asset: updated, result } = await geometryMutationTransactionService.runAndSave(currentAsset);
        setCurrentAsset(updated);
        setMessage(result.validation.valid ? 'Mutation 결과와 검증 결과를 저장했습니다.' : 'Mutation 결과는 저장했지만 validation blocker가 남아 있습니다.');
      } else if (action === 'promote') {
        const { asset: updated } = await geometryMutationTransactionService.promote(currentAsset);
        setCurrentAsset(updated);
        setMessage('검증을 통과한 geometry를 production candidate로 승격했습니다. construction/legal BIM ready 상태는 아닙니다.');
      } else {
        const updated = await geometryMutationTransactionService.rollback(currentAsset);
        setCurrentAsset(updated);
        setMessage('직전 rollback 가능 production candidate 승격을 복원했습니다. 원본 CAD/검증 데이터는 변경하지 않았습니다.');
      }
      await onSaved?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Geometry mutation 작업을 완료하지 못했습니다.');
    } finally { setBusy(''); }
  };

  const s = preview.validation.stats;
  const diffEntries = Object.entries(audit.diff.delta).filter(([, value]) => value !== 0);
  return <section style={{ border: '1px solid #d9e0e8', borderRadius: 12, padding: 18, background: '#fff' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div>
        <h3 style={{ margin: 0 }}>Geometry Mutation Engine / Production Candidate</h3>
        <p style={{ margin: '6px 0 0', color: '#667085' }}>DA:ON Solid Partition Engine v1이 검증된 wall/slab/opening 데이터에 실제 topology mutation을 적용하고, 검증 통과 시 production candidate로 승격합니다.</p>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Chip size="small" label={preview.engineId} variant="outlined" />
        <Chip size="small" color={preview.validation.valid ? 'success' : 'warning'} label={preview.validation.valid ? 'VALID' : 'BLOCKED'} />
        {productionCandidate && <Chip size="small" color={productionState.state === 'current' ? 'success' : productionState.state === 'stale' ? 'warning' : 'error'} label={`PRODUCTION · ${productionState.state.toUpperCase()}`} />}
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(100px,1fr))', gap: 8, marginTop: 14 }}>
      {[
        ['Walls', s.wallCount], ['Partitions', s.wallPartitionCount], ['Wall unions', s.junctionUnionCount], ['Opening subtract', s.openingSubtractionCount], ['Slabs', s.slabCount], ['Core subtract', s.slabCoreSubtractionCount],
      ].map(([label, value]) => <div key={String(label)} style={{ border: '1px solid #e5eaf0', borderRadius: 8, padding: 10 }}><small style={{ color: '#667085' }}>{label}</small><strong style={{ display: 'block', marginTop: 4, fontSize: 20 }}>{value}</strong></div>)}
    </div>

    {productionCandidate && productionState.state !== 'current' && <Alert severity={productionState.state === 'stale' ? 'warning' : 'error'} sx={{ mt: 1.5 }}>{productionState.reason} 최신 소스 기준으로 mutation 검증 후 다시 승격해야 Building Production Gate에서 사용할 수 있습니다.</Alert>}
    {preview.validation.errors.length > 0 && <Alert severity="warning" sx={{ mt: 1.5 }}>{preview.validation.errors.join(' / ')}</Alert>}
    {preview.validation.warnings.length > 0 && <Alert severity="info" sx={{ mt: 1.5 }}>{preview.validation.warnings.join(' / ')}</Alert>}
    {message && <Alert severity="success" sx={{ mt: 1.5 }} onClose={() => setMessage('')}>{message}</Alert>}
    {error && <Alert severity="error" sx={{ mt: 1.5 }} onClose={() => setError('')}>{error}</Alert>}

    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
      <Button variant="outlined" startIcon={<ScienceRounded />} disabled={Boolean(busy)} onClick={() => void run('save')}>Mutation 실행·검증 저장</Button>
      <Button variant="contained" startIcon={<RocketLaunchRounded />} disabled={Boolean(busy) || !preview.productionCandidateEligible} onClick={() => void run('promote')}>{productionState.state === 'stale' ? '최신 소스로 재승격' : 'Production Candidate 승격'}</Button>
      <Button variant="outlined" color="warning" startIcon={<RestartAltRounded />} disabled={Boolean(busy) || !rollbackAvailable} onClick={() => void run('rollback')}>Rollback</Button>
    </div>

    <div style={{ marginTop: 16, borderTop: '1px solid #e5eaf0', paddingTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><strong>Production Audit / 승격 이력</strong><span style={{ color: '#667085', fontSize: 13 }}>promotions {audit.promotions.length} · rollback {audit.rollbackCount}</span></div>
      {audit.promotions.length ? <div style={{ display: 'grid', gap: 7, marginTop: 10 }}>{audit.promotions.slice(-4).reverse().map((row) => <div key={row.promotionId} style={{ display: 'grid', gridTemplateColumns: 'minmax(145px,1fr) auto auto', gap: 8, alignItems: 'center', padding: 9, border: '1px solid #e5eaf0', borderRadius: 8 }}><div><strong style={{ fontSize: 13 }}>{row.promotionId}</strong><small style={{ display: 'block', color: '#667085', marginTop: 2 }}>{row.createdAt} · {row.sourceFingerprint || 'legacy fingerprint 없음'}</small></div><span style={{ color: '#667085', fontSize: 12 }}>walls {row.stats.wallCount} · openings {row.stats.openingSubtractionCount} · cores {row.stats.slabCoreSubtractionCount}</span><Chip size="small" color={row.rolledBack ? 'warning' : 'success'} label={row.rolledBack ? 'ROLLED BACK' : 'PROMOTED'} /></div>)}</div> : <p style={{ margin: '8px 0 0', color: '#667085', fontSize: 13 }}>아직 production 승격 이력이 없습니다.</p>}
      {audit.promotions.length >= 2 && <Alert severity={audit.diff.sourceChanged ? 'info' : 'success'} sx={{ mt: 1.2 }}>최근 두 승격 비교: source {audit.diff.sourceChanged ? '변경됨' : '동일'}{diffEntries.length ? ` · ${diffEntries.map(([key, value]) => `${key} ${value > 0 ? '+' : ''}${value}`).join(' / ')}` : ' · geometry count 변화 없음'}</Alert>}
    </div>

    <Alert severity="warning" sx={{ mt: 1.5 }}>production candidate는 자동 시공·구조·법정 BIM 승인이 아닙니다. constructionReady=false / legalBimReady=false를 유지하며 원본 CAD와 Human Review provenance는 보존됩니다.</Alert>
  </section>;
}
