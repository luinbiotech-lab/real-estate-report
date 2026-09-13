import { useEffect, useMemo, useState } from 'react';
import { RefreshRounded, VisibilityRounded } from '@mui/icons-material';
import { Alert, Button, Chip, CircularProgress, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import type { PropertyFacility } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { propertyRepository } from '../repositories/propertyRepository';
import type { Property } from '../types';

const FACILITY_LABEL: Record<PropertyFacility['category'], string> = {
  hvac: '냉난방/HVAC', electrical: '전기', plumbing: '급배수', fire_safety: '소방', elevator: '엘리베이터', restroom: '화장실', kitchen: '주방', internet: '통신', access_control: '출입통제', cctv: 'CCTV', signage: '사인', soundproofing: '방음', other: '기타',
};

export default function InteriorWorkspacePage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof propertyDataRoomRepository.getBundle>>>({ documents: [], media: [], verifications: [], verificationCandidates: [], dataSources: [], reportSnapshots: [], digitalTwinAssets: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const selected = useMemo(() => properties.find((item) => item.id === propertyId), [properties, propertyId]);
  const load = async (id = propertyId) => { if (id) setBundle(await propertyDataRoomRepository.getBundle(id)); };

  useEffect(() => {
    (async () => {
      try {
        const list = await propertyRepository.getAll(); setProperties(list);
        const first = list[0]?.id || ''; setPropertyId(first); if (first) await load(first);
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Interior Workspace를 불러오지 못했습니다.'); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="center"><CircularProgress /><p>Interior Workspace를 준비하는 중입니다.</p></div>;

  const interiorMedia = bundle.media.filter((item) => item.mediaType === 'image' && item.category !== 'floor_plan');
  const facilities = bundle.facilities ?? [];
  const spaces = bundle.spaces ?? [];
  const visionResults = (bundle.agentResults ?? []).filter((item) => item.agentType === 'interior_vision');
  const pendingVision = (bundle.agentJobs ?? []).filter((item) => item.agentType === 'interior_vision' && item.status === 'review_required').length;

  return <main style={{ padding: 28, maxWidth: 1280, margin: '0 auto' }}>
    <header style={{ marginBottom: 24 }}><p className="eyebrow">INTERIOR INTELLIGENCE</p><h1 style={{ margin: '6px 0' }}>Interior Workspace</h1><p style={{ color: '#667085' }}>실내 사진 → 브라우저 Vision 신호 → Human Review → 공간/설비 인벤토리 → 리노베이션 검토로 이어지는 작업 화면입니다.</p></header>
    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

    <section style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <FormControl size="small" fullWidth><InputLabel id="interior-property-label">대상 물건</InputLabel><Select labelId="interior-property-label" label="대상 물건" value={propertyId} onChange={async (event) => { setPropertyId(event.target.value); await load(event.target.value); }}>{properties.map((item) => <MenuItem key={item.id} value={item.id}>{item.name} · {item.address}</MenuItem>)}</Select></FormControl>
      <Button startIcon={<RefreshRounded />} onClick={() => load()}>새로고침</Button>
      {selected && <div style={{ gridColumn: '1 / -1', color: '#667085' }}>{selected.propertyNumber || '물건번호 미입력'} · {selected.name}</div>}
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(120px, 1fr))', gap: 12, marginBottom: 20 }}>
      {[
        ['실내 사진', interiorMedia.length], ['Vision 결과', visionResults.length], ['검토 대기', pendingVision], ['공간 모델', spaces.length], ['설비 인벤토리', facilities.length],
      ].map(([label, value]) => <div key={String(label)} style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 16 }}><small style={{ color: '#667085' }}>{label}</small><strong style={{ display: 'block', fontSize: 28, marginTop: 6 }}>{value}</strong></div>)}
    </section>

    <Alert severity="info" sx={{ mb: 2 }}>현재 기본 Vision Provider는 브라우저 로컬 픽셀 분석입니다. 밝기·대비·에지 밀도와 메타데이터를 보조 신호로 사용하며 하자·구조·설비 상태를 자동 확정하지 않습니다.</Alert>

    <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <h2 style={{ marginTop: 0 }}>Vision 분석 기록</h2>
      <div style={{ display: 'grid', gap: 10 }}>
        {visionResults.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((result) => {
          const candidates = Array.isArray(result.payload.candidates) ? result.payload.candidates as Array<Record<string, unknown>> : [];
          return <article key={result.id} style={{ border: '1px solid #e1e6ec', borderRadius: 10, padding: 14 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><strong><VisibilityRounded fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />Interior Vision</strong><Chip size="small" label={`${Math.round((result.confidence ?? 0) * 100)}%`} /></div><p style={{ color: '#667085', marginBottom: 6 }}>후보 {candidates.length}건 · {String(result.payload.visionProvider || result.payload.method || 'provider 미확인')}</p><small>{new Date(result.createdAt).toLocaleString()}</small></article>;
        })}
        {!visionResults.length && <p style={{ color: '#7b8794' }}>Vision 분석 기록이 없습니다. Spatial Workspace에서 실내 사진을 등록하면 자동 분석됩니다.</p>}
      </div>
    </section>

    <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>승인된 설비 인벤토리</h2>
      <p style={{ color: '#667085' }}>Vision 결과 승인 후 명확하게 연결 가능한 설비만 생성합니다. 상태는 실제 확인 전까지 `unknown`으로 유지합니다.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
        {facilities.map((item) => <article key={item.id} style={{ border: '1px solid #e1e6ec', borderRadius: 10, padding: 14 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong>{item.name}</strong><Chip size="small" variant="outlined" label={item.condition} /></div><p style={{ color: '#667085' }}>{FACILITY_LABEL[item.category]} · {item.floor || '층 미확인'}</p><small>{item.notes}</small></article>)}
        {!facilities.length && <p style={{ color: '#7b8794' }}>승인된 설비 인벤토리가 아직 없습니다.</p>}
      </div>
    </section>
  </main>;
}
