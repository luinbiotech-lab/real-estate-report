import { useEffect, useMemo, useState } from 'react';
import { CloudUploadRounded, RefreshRounded } from '@mui/icons-material';
import { Alert, Button, Chip, CircularProgress, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import type { MediaCategory, PropertyMedia } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { propertyRepository } from '../repositories/propertyRepository';
import { spatialIntakeService } from '../services/spatialIntakeService';
import type { Property } from '../types';

const CATEGORY_LABELS: Partial<Record<MediaCategory, string>> = {
  interior: '인테리어', floor_plan: '도면', exterior: '외관', parking: '주차', rooftop: '옥상', mechanical_room: '기계·설비실', '360': '360 사진',
};

function MediaPreview({ media }: { media: PropertyMedia }) {
  const [src, setSrc] = useState(media.url || '');
  useEffect(() => {
    if (media.url || !media.fileData) { setSrc(media.url || ''); return; }
    const next = URL.createObjectURL(media.fileData);
    setSrc(next);
    return () => URL.revokeObjectURL(next);
  }, [media]);
  return src ? <img src={src} alt={media.caption || media.fileName} style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 8 }} /> : <div style={{ height: 150, display: 'grid', placeItems: 'center', background: '#eef2f6', borderRadius: 8, color: '#7b8794' }}>미리보기 없음</div>;
}

export default function SpatialWorkspacePage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [category, setCategory] = useState<MediaCategory>('interior');
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof propertyDataRoomRepository.getBundle>>>({ documents: [], media: [], verifications: [], verificationCandidates: [], dataSources: [], reportSnapshots: [], digitalTwinAssets: [] });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const selected = useMemo(() => properties.find((item) => item.id === propertyId), [properties, propertyId]);
  const load = async (id = propertyId) => {
    if (!id) return;
    setBundle(await propertyDataRoomRepository.getBundle(id));
  };

  useEffect(() => {
    (async () => {
      try {
        const list = await propertyRepository.getAll();
        setProperties(list);
        const first = list[0]?.id || '';
        setPropertyId(first);
        if (first) await load(first);
      } catch (reason) { setError(reason instanceof Error ? reason.message : '공간 데이터를 불러오지 못했습니다.'); }
      finally { setLoading(false); }
    })();
  }, []);

  const upload = async (files: FileList | null) => {
    if (!propertyId || !files?.length) return;
    setUploading(true); setError('');
    try {
      for (const file of Array.from(files)) await spatialIntakeService.upload(propertyId, file, category);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '공간 자료를 등록하지 못했습니다.'); }
    finally { setUploading(false); }
  };

  if (loading) return <div className="center"><CircularProgress /><p>Spatial Workspace를 준비하는 중입니다.</p></div>;

  const spaces = bundle.spaces ?? [];
  const links = bundle.spaceMediaLinks ?? [];
  const agentJobs = bundle.agentJobs ?? [];

  return <main style={{ padding: 28, maxWidth: 1360, margin: '0 auto' }}>
    <header style={{ marginBottom: 24 }}>
      <p className="eyebrow">INTERIOR · FLOOR PLAN · DIGITAL TWIN</p>
      <h1 style={{ margin: '6px 0' }}>Spatial Workspace</h1>
      <p style={{ color: '#667085' }}>사진과 도면을 공간 단위 데이터로 정리하고 Agent Queue 및 Digital Twin 자산으로 연결합니다.</p>
    </header>

    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

    <section style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12, background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <FormControl size="small" fullWidth>
        <InputLabel id="spatial-property-label">대상 물건</InputLabel>
        <Select labelId="spatial-property-label" label="대상 물건" value={propertyId} onChange={async (event) => { setPropertyId(event.target.value); await load(event.target.value); }}>
          {properties.map((item) => <MenuItem key={item.id} value={item.id}>{item.name} · {item.address}</MenuItem>)}
        </Select>
      </FormControl>
      <Button startIcon={<RefreshRounded />} onClick={() => load()}>새로고침</Button>
      {selected && <div style={{ gridColumn: '1 / -1', color: '#667085' }}>{selected.propertyNumber || '물건번호 미입력'} · {selected.name}</div>}
    </section>

    <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <h2 style={{ marginTop: 0 }}>공간 자료 Intake</h2>
      <p style={{ color: '#667085' }}>사진은 Interior Vision Agent, 도면은 Floor Plan Agent로 자동 라우팅됩니다. 업로드만으로 확정 데이터가 되지 않습니다.</p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="spatial-category-label">자료 유형</InputLabel>
          <Select labelId="spatial-category-label" label="자료 유형" value={category} onChange={(event) => setCategory(event.target.value as MediaCategory)}>
            {(['interior', 'floor_plan', 'exterior', 'parking', 'rooftop', 'mechanical_room', '360'] as MediaCategory[]).map((item) => <MenuItem key={item} value={item}>{CATEGORY_LABELS[item] || item}</MenuItem>)}
          </Select>
        </FormControl>
        <Button component="label" variant="contained" startIcon={<CloudUploadRounded />} disabled={!propertyId || uploading}>
          {uploading ? '등록 중' : '여러 이미지 등록'}
          <input hidden multiple type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void upload(event.target.files); event.target.value = ''; }} />
        </Button>
      </div>
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 20, marginBottom: 20 }}>
      <div style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 style={{ margin: 0 }}>미디어</h2><Chip label={`${bundle.media.length}개`} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 12, marginTop: 16 }}>
          {bundle.media.map((media) => <article key={media.id} style={{ border: '1px solid #e1e6ec', borderRadius: 10, padding: 10 }}>
            <MediaPreview media={media} />
            <strong style={{ display: 'block', marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{media.caption || media.fileName}</strong>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}><Chip size="small" label={CATEGORY_LABELS[media.category] || media.category} /><Chip size="small" variant="outlined" label={media.verificationStatus} />{media.floor && <Chip size="small" variant="outlined" label={media.floor} />}{media.room && <Chip size="small" variant="outlined" label={media.room} />}</div>
          </article>)}
          {!bundle.media.length && <p style={{ color: '#7b8794' }}>등록된 공간 미디어가 없습니다.</p>}
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>Automation 상태</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          <div><small>Agent Jobs</small><strong style={{ display: 'block', fontSize: 24 }}>{agentJobs.length}</strong></div>
          <div><small>검토 필요</small><strong style={{ display: 'block', fontSize: 24 }}>{agentJobs.filter((job) => job.status === 'review_required').length}</strong></div>
          <div><small>Space Model</small><strong style={{ display: 'block', fontSize: 24 }}>{spaces.length}</strong></div>
          <div><small>Digital Twin Assets</small><strong style={{ display: 'block', fontSize: 24 }}>{bundle.digitalTwinAssets.length}</strong></div>
        </div>
      </div>
    </section>

    <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <h2 style={{ marginTop: 0 }}>공간 모델</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
        {spaces.map((space) => <article key={space.id} style={{ border: '1px solid #e1e6ec', borderRadius: 10, padding: 14 }}><strong>{space.name}</strong><p style={{ margin: '6px 0', color: '#667085' }}>{space.spaceType} · {space.floor || '층 미지정'}</p><small>연결 미디어 {links.filter((link) => link.spaceId === space.id).length}개 · {space.verificationStatus}</small></article>)}
        {!spaces.length && <p style={{ color: '#7b8794' }}>승인된 Space Agent 결과가 아직 없습니다.</p>}
      </div>
    </section>

    <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>Digital Twin 준비 자산</h2>
      <div style={{ display: 'grid', gap: 10 }}>
        {bundle.digitalTwinAssets.map((asset) => <article key={asset.id} style={{ border: '1px solid #e1e6ec', borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between', gap: 12 }}><div><strong>{asset.assetType}</strong><p style={{ margin: '4px 0 0', color: '#667085' }}>{asset.floor || '층 미지정'} · {asset.fileFormat}</p></div><Chip label={asset.processingStatus} /></article>)}
        {!bundle.digitalTwinAssets.length && <p style={{ color: '#7b8794' }}>승인된 도면 Intake 결과가 없습니다.</p>}
      </div>
    </section>
  </main>;
}
