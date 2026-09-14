import { HomeWorkRounded, ImageRounded, Inventory2Rounded, TipsAndUpdatesRounded } from '@mui/icons-material';
import { Alert, Chip, MenuItem, Select } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import type { AgentResult, DigitalTwinAsset, PropertyFacility, PropertyMedia, PropertySpace, RenovationAssessment, SpaceMediaLink, SpaceRoomLink } from '../domain/propertyDataRoom/types';
import { roomIntelligenceService } from '../services/roomIntelligenceService';

const FACILITY_LABEL: Record<PropertyFacility['category'], string> = {
  hvac: '냉난방/HVAC', electrical: '전기', plumbing: '급배수', fire_safety: '소방', elevator: '엘리베이터', restroom: '화장실', kitchen: '주방', internet: '통신', access_control: '출입통제', cctv: 'CCTV', signage: '사인', soundproofing: '방음', other: '기타',
};

function RoomShape({ points }: { points: Array<{ x: number; y: number }> }) {
  if (!points.length) return <div style={{ height: 240, background: '#f6f8fb', borderRadius: 12 }} />;
  const xs = points.map((p) => p.x); const ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const width = maxX - minX || 1, height = maxY - minY || 1;
  const mapped = points.map((p) => `${20 + ((p.x - minX) / width) * 260},${220 - ((p.y - minY) / height) * 190}`).join(' ');
  return <svg viewBox="0 0 300 240" style={{ width: '100%', height: 240, background: '#f7f9fc', borderRadius: 12 }}><polygon points={mapped} fill="#eef3f8" stroke="#1f3b5b" strokeWidth="3" /><text x="18" y="24" fontSize="12" fill="#667085">Reviewed room boundary</text></svg>;
}

function MediaThumb({ media }: { media: PropertyMedia }) {
  const [src, setSrc] = useState(media.url || '');
  useEffect(() => {
    if (media.url) { setSrc(media.url); return; }
    if (!media.fileData) { setSrc(''); return; }
    const url = URL.createObjectURL(media.fileData); setSrc(url); return () => URL.revokeObjectURL(url);
  }, [media]);
  return <article style={{ border: '1px solid #e3e8ef', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
    {src ? <img src={src} alt={media.caption || media.fileName} style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }} /> : <div style={{ height: 150, display: 'grid', placeItems: 'center', background: '#f4f6f8', color: '#98a2b3' }}><ImageRounded /></div>}
    <div style={{ padding: 9 }}><strong style={{ display: 'block', fontSize: 13 }}>{media.caption || media.fileName}</strong><small style={{ color: '#667085' }}>{media.category} · {media.verificationStatus}</small></div>
  </article>;
}

export default function RoomIntelligencePanel(props: {
  spaces: PropertySpace[];
  assets: DigitalTwinAsset[];
  links: SpaceRoomLink[];
  media: PropertyMedia[];
  spaceMediaLinks: SpaceMediaLink[];
  facilities: PropertyFacility[];
  agentResults: AgentResult[];
  renovationAssessments: RenovationAssessment[];
}) {
  const views = useMemo(() => roomIntelligenceService.buildViews(props), [props.spaces, props.assets, props.links, props.media, props.spaceMediaLinks, props.facilities, props.agentResults, props.renovationAssessments]);
  const [selectedId, setSelectedId] = useState('');
  useEffect(() => { if (!views.length) setSelectedId(''); else if (!views.some((item) => item.link.id === selectedId)) setSelectedId(views[0].link.id); }, [views, selectedId]);
  const view = views.find((item) => item.link.id === selectedId) || views[0];

  return <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20, marginBottom: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div><h2 style={{ margin: 0 }}>Room Intelligence View</h2><p style={{ color: '#667085', margin: '6px 0 0' }}>승인된 Interior ↔ 3D Room 연결을 기준으로 사진·설비·상태·추천 용도·리노베이션 컨텍스트를 한 공간 단위로 묶어 봅니다.</p></div>
      <Chip icon={<HomeWorkRounded />} color={views.length ? 'success' : 'default'} variant="outlined" label={`Intelligent rooms ${views.length}`} />
    </div>

    {!views.length && <Alert severity="info" sx={{ mt: 1.5 }}>승인된 Interior ↔ 3D Room 연결이 생기면 Room Intelligence View가 활성화됩니다.</Alert>}

    {view && <>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px,.7fr) minmax(0,2fr)', gap: 14, marginTop: 16 }}>
        <div>
          <Select fullWidth size="small" value={view.link.id} onChange={(event) => setSelectedId(event.target.value)}>
            {views.map((item) => <MenuItem key={item.link.id} value={item.link.id}>{item.space.floor || '층 미확인'} · {item.space.name} → {item.room.roomName}</MenuItem>)}
          </Select>
          <div style={{ marginTop: 12 }}><RoomShape points={view.room.roomCandidate.points} /></div>
          <div style={{ display: 'grid', gap: 7, marginTop: 12 }}>
            <div><small style={{ color: '#667085' }}>Interior Space</small><strong style={{ display: 'block' }}>{view.space.name}</strong></div>
            <div><small style={{ color: '#667085' }}>3D Room</small><strong style={{ display: 'block' }}>{view.room.roomName}</strong></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Chip size="small" label={view.space.spaceType} /><Chip size="small" variant="outlined" label={view.space.floor || view.room.floor || '층 미확인'} />{view.room.roomCandidate.areaSqmCandidate && <Chip size="small" variant="outlined" label={`${view.room.roomCandidate.areaSqmCandidate.toFixed(1)}㎡ 후보`} />}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(110px,1fr))', gap: 8 }}>
            {[['사진', view.evidence.directMediaCount], ['설비', view.evidence.directFacilityCount], ['Vision 근거', view.evidence.visionResultCount], ['연결 신뢰도', `${Math.round((view.link.confidence ?? 0) * 100)}%`]].map(([label, value]) => <div key={String(label)} style={{ padding: 12, borderRadius: 10, background: '#f7f9fb', border: '1px solid #e7ebf0' }}><small style={{ color: '#667085' }}>{label}</small><strong style={{ display: 'block', fontSize: 20, marginTop: 4 }}>{value}</strong></div>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ border: '1px solid #e3e8ef', borderRadius: 10, padding: 14 }}><strong>현재 상태</strong><p style={{ color: '#475467', marginBottom: 0 }}>{view.space.currentCondition || '확인 필요'}</p></div>
            <div style={{ border: '1px solid #e3e8ef', borderRadius: 10, padding: 14 }}><strong>추천 용도</strong><p style={{ color: '#475467', marginBottom: 0 }}>{view.space.recommendedUse || '판단 보류'}</p></div>
          </div>

          <div><h3 style={{ margin: '0 0 9px' }}><ImageRounded fontSize="small" sx={{ verticalAlign: 'middle', mr: .7 }} />연결된 공간 사진</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 10 }}>{view.media.map((item) => <MediaThumb key={item.id} media={item} />)}{!view.media.length && <Alert severity="info">이 공간에 직접 연결된 사진이 아직 없습니다.</Alert>}</div></div>

          <div><h3 style={{ margin: '0 0 9px' }}><Inventory2Rounded fontSize="small" sx={{ verticalAlign: 'middle', mr: .7 }} />공간 설비</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8 }}>{view.facilities.map((item) => <div key={item.id} style={{ padding: 11, border: '1px solid #e3e8ef', borderRadius: 9 }}><strong>{item.name}</strong><small style={{ display: 'block', color: '#667085', marginTop: 4 }}>{FACILITY_LABEL[item.category]} · {item.condition}</small></div>)}{!view.facilities.length && <Alert severity="info">이 공간에 직접 연결된 설비가 아직 없습니다.</Alert>}</div>{view.floorFacilities.length > 0 && <p style={{ color: '#667085', fontSize: 12 }}>같은 층의 미배정 설비 {view.floorFacilities.length}건은 공간 직접 연결로 간주하지 않고 참고 정보로만 유지합니다.</p>}</div>

          <div><h3 style={{ margin: '0 0 9px' }}><TipsAndUpdatesRounded fontSize="small" sx={{ verticalAlign: 'middle', mr: .7 }} />리노베이션 컨텍스트</h3>{view.renovationContext.length ? <div style={{ display: 'grid', gap: 8 }}>{view.renovationContext.slice(0, 3).map((item) => <div key={item.id} style={{ padding: 12, border: '1px solid #e3e8ef', borderRadius: 9 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong>{item.title}</strong><Chip size="small" variant="outlined" label={item.scope} /></div><p style={{ color: '#667085', marginBottom: 5 }}>{item.summary}</p><small>Property-level assessment · room 직접 확정 아님</small></div>)}</div> : <Alert severity="info">리노베이션 검토 결과가 아직 없습니다.</Alert>}</div>
        </div>
      </div>
      <Alert severity="warning" sx={{ mt: 1.5 }}>Room Intelligence는 승인된 연결과 현재 Data Room 근거를 모아 보여주는 검토 화면입니다. 공간 사진·설비·상태가 없으면 추정해 채우지 않으며, property-level 리노베이션 평가는 room-specific 확정 판단으로 승격하지 않습니다.</Alert>
    </>}
  </section>;
}
