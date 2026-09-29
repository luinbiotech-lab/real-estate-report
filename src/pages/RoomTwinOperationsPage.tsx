import { RefreshRounded } from '@mui/icons-material';
import { Alert, Button, CircularProgress, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import RoomTwinOperationsPanel from '../components/RoomTwinOperationsPanel';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { propertyRepository } from '../repositories/propertyRepository';
import type { Property } from '../types';

export default function RoomTwinOperationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPropertyId = searchParams.get('propertyId') || '';
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof propertyDataRoomRepository.getBundle>>>({ documents: [], media: [], verifications: [], verificationCandidates: [], dataSources: [], reportSnapshots: [], digitalTwinAssets: [] });
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const selected = useMemo(() => properties.find((item) => item.id === propertyId), [properties, propertyId]);
  const load = async (id = propertyId) => { if (id) setBundle(await propertyDataRoomRepository.getBundle(id)); };
  useEffect(() => { (async () => { try {
    const list = await propertyRepository.getAll();
    setProperties(list);
    const requestedExists = requestedPropertyId && list.some((item) => item.id === requestedPropertyId);
    const first = (requestedExists ? requestedPropertyId : '') || list[0]?.id || '';
    setPropertyId(first);
    if (first) await load(first);
  } catch (reason) { setError(reason instanceof Error ? reason.message : 'Room Twin Operations를 불러오지 못했습니다.'); } finally { setLoading(false); } })(); }, []);
  if (loading) return <div className="center"><CircularProgress /><p>Room Twin Operations를 준비하는 중입니다.</p></div>;
  return <main style={{ padding: 28, maxWidth: 1360, margin: '0 auto' }}>
    <header style={{ marginBottom: 24 }}><p className="eyebrow">DIGITAL TWIN × INTERIOR INTELLIGENCE</p><h1 style={{ margin: '6px 0' }}>Room Twin Operations</h1><p style={{ color: '#667085' }}>Digital Twin room geometry와 Interior evidence, 위치 Human Review, 상태/리노베이션 이력을 한 운영 화면에서 통합 점검합니다.</p></header>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <section style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <FormControl size="small" fullWidth><InputLabel id="room-ops-property-label">대상 물건</InputLabel><Select labelId="room-ops-property-label" label="대상 물건" value={propertyId} onChange={async (event) => { const nextId = event.target.value; setPropertyId(nextId); setSearchParams({ propertyId: nextId }); await load(nextId); }}>{properties.map((item) => <MenuItem key={item.id} value={item.id}>{item.name} · {item.address}</MenuItem>)}</Select></FormControl>
      <Button startIcon={<RefreshRounded />} onClick={() => load()}>새로고침</Button>
      {selected && <div style={{ gridColumn: '1 / -1', color: '#667085' }}>{selected.propertyNumber || '물건번호 미입력'} · {selected.name}</div>}
    </section>
    <RoomTwinOperationsPanel bundle={bundle} />
  </main>;
}
