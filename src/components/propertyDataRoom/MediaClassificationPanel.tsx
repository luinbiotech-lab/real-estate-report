import { useState, type ChangeEvent } from 'react';
import { Alert, Button, Chip, MenuItem, TextField } from '@mui/material';
import type { MediaCategory, PropertyMedia, PropertySpace } from '../../domain/propertyDataRoom/types';
import { isInternalMediaCategory } from '../../domain/professionalReport/reportAccessPolicy';
import { propertyDataRoomRepository } from '../../repositories/propertyDataRoomRepository';
import { propertyDataRoomService } from '../../services/propertyDataRoomService';
import { createVworldAerialImage } from '../../services/maps/vworldMapProvider';

const reportCategories: MediaCategory[] = ['exterior', 'road', 'surroundings', 'entrance', 'facade_detail', 'aerial', 'parking', 'other'];
const labels: Record<MediaCategory, string> = {
  exterior: '외관', interior: '내부', lobby: '로비', office: '오피스', corridor: '복도', restroom: '화장실', basement: '지하', rooftop: '옥상', roof: '지붕', parking: '주차', mechanical_room: '기계실', mechanical: '설비', road: '도로', entrance: '출입구', surroundings: '주변환경', floor_plan: '평면도', facade_detail: '파사드', aerial: '항공/드론', '360': '360', other: '기타',
};

export default function MediaClassificationPanel({ propertyId, media, spaces, internalPhotoAllowed, onSaved, latitude, longitude }: {
  propertyId: string;
  latitude?: number;
  longitude?: number;
  media: PropertyMedia[];
  spaces: PropertySpace[];
  internalPhotoAllowed: boolean;
  onSaved: () => Promise<void> | void;
}) {
  const [savingId, setSavingId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<MediaCategory>('exterior');
  const [caption, setCaption] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const update = async (item: PropertyMedia, nextCategory: MediaCategory) => {
    if (!internalPhotoAllowed && isInternalMediaCategory(item.category)) {
      setError('내부사진 제외 물건의 기존 실내 미디어는 보고서용 외부 카테고리로 변경할 수 없습니다.');
      return;
    }
    setSavingId(item.id); setError(''); setMessage('');
    try {
      await propertyDataRoomRepository.updateMedia({ ...item, category: nextCategory, updatedAt: new Date().toISOString() });
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '미디어 분류를 저장하지 못했습니다.');
    } finally { setSavingId(''); }
  };

  const setPrimary = async (item: PropertyMedia) => {
    if (!internalPhotoAllowed && isInternalMediaCategory(item.category)) {
      setError('내부사진 제외 물건의 실내 미디어는 대표사진으로 지정할 수 없습니다.');
      return;
    }
    setSavingId(item.id); setError(''); setMessage('');
    try {
      const now = new Date().toISOString();
      for (const current of media) {
        const shouldBePrimary = current.id === item.id;
        if (current.isPrimary === shouldBePrimary) continue;
        await propertyDataRoomRepository.updateMedia({ ...current, isPrimary: shouldBePrimary, updatedAt: now });
      }
      setMessage(`${item.caption || item.fileName}을 보고서 대표 외관 미디어로 지정했습니다.`);
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '대표 미디어를 저장하지 못했습니다.');
    } finally { setSavingId(''); }
  };

  // No field photo yet: a VWorld aerial image (public map imagery, labelled on the image as 항공사진 · 현장사진 아님) can
  // fill the report hero. It is stored as category 'aerial' and stays unverified like any other uploaded media.
  const addAerial = async () => {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') { setError('좌표가 없어 항공사진을 가져올 수 없습니다. 주소 조회로 좌표를 먼저 연결해 주세요.'); return; }
    setUploading(true); setError(''); setMessage('');
    try {
      const dataUrl = await createVworldAerialImage({ latitude, longitude });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `vworld-aerial-${propertyId}.jpg`, { type: 'image/jpeg' });
      await propertyDataRoomService.uploadMedia(propertyId, file, { category: 'aerial', caption: '항공사진 · 국토교통부 브이월드(VWorld) · 현장사진 아님' });
      setMessage('VWorld 항공사진을 항공 미디어로 연결했습니다. 현장 외관사진이 연결되면 보고서는 외관사진을 우선 사용합니다.');
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'VWorld 항공사진을 가져오지 못했습니다.');
    } finally { setUploading(false); }
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    setUploading(true); setError(''); setMessage('');
    try {
      const selectedSpace = spaces.find((space) => space.id === spaceId);
      await propertyDataRoomService.uploadMedia(propertyId, file, {
        category,
        caption,
        spaceId: selectedSpace?.id,
        floor: selectedSpace?.floor,
        room: selectedSpace?.name,
      });
      setCaption('');
      setMessage((file.type.startsWith('video/') ? '영상' : labels[category] + ' 미디어') + '를 Data Room에 연결했습니다.' + (selectedSpace ? ' 공간: ' + selectedSpace.name : ''));
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '미디어를 등록하지 못했습니다.');
    } finally { setUploading(false); event.target.value = ''; }
  };

  return <section style={{ marginTop: 20 }}>
    <div className="document-toolbar"><div><h2>보고서 미디어 연결</h2><p>실제 외관·도로·주변 이미지를 category와 함께 저장합니다. 내부사진 제외 물건은 내부 사진을 Professional Report에서 사용하지 않습니다.</p></div><Chip size="small" label={internalPhotoAllowed ? '내부사진 허용' : '내부사진 제외'} color={internalPhotoAllowed ? 'default' : 'warning'} /></div>
    {message && <Alert severity="success">{message}</Alert>}
    {error && <Alert severity="error">{error}</Alert>}
    <div style={{ display: 'grid', gridTemplateColumns: '160px minmax(180px, 1fr) minmax(220px, 1.4fr) auto', gap: 12, margin: '12px 0 18px' }}>
      <TextField select size="small" label="미디어 분류" value={category} onChange={(event) => setCategory(event.target.value as MediaCategory)}>{reportCategories.map((value) => <MenuItem key={value} value={value}>{labels[value]}</MenuItem>)}</TextField>
      <TextField select size="small" label="공간 연결" value={spaceId} onChange={(event) => setSpaceId(event.target.value)}>
        <MenuItem value="">공간 미지정</MenuItem>
        {spaces.map((space) => <MenuItem key={space.id} value={space.id}>{space.floor ? space.floor + ' · ' : ''}{space.name}</MenuItem>)}
      </TextField>
      <TextField size="small" label="캡션" value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="예: 동광로18길 코너 외관" />
      <Button component="label" variant="contained" disabled={uploading}>{uploading ? '등록 중…' : '사진/영상 등록'}<input hidden type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={upload} /></Button>
      {!media.some((item) => item.category === 'aerial' && !item.deletedAt) && <Button variant="outlined" disabled={uploading} onClick={addAerial}>VWorld 항공사진 가져오기</Button>}
    </div>
    {media.length ? <div className="document-list">{media.map((item) => {
      const lockedInternal = !internalPhotoAllowed && isInternalMediaCategory(item.category);
      return <article key={item.id}>
        <div className="file-icon">{item.mediaType === 'video' ? <span style={{ fontSize: 12, fontWeight: 700 }}>VIDEO</span> : item.url ? <img src={item.url} alt={item.caption || item.fileName} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} /> : null}</div>
        <div><b>{item.caption || item.fileName}{item.isPrimary ? ' · 대표' : ''}</b><span>{item.mediaType === 'video' ? '영상' : labels[item.category]} · {item.verificationStatus}{lockedInternal ? ' · 보고서 제외 고정' : ''}</span><small>{item.floor ? `${item.floor} · ` : ''}{item.room ? `${item.room} · ` : ''}{item.captureDate || item.createdAt.slice(0, 10)}</small></div>
        <TextField select size="small" label={lockedInternal ? '보고서 제외' : '보고서 분류'} value={reportCategories.includes(item.category) ? item.category : 'other'} disabled={savingId === item.id || lockedInternal} onChange={(event) => update(item, event.target.value as MediaCategory)}>{reportCategories.map((value) => <MenuItem key={value} value={value}>{labels[value]}</MenuItem>)}</TextField>
        {!lockedInternal && item.mediaType === 'image' && <Button size="small" variant={item.isPrimary ? 'contained' : 'outlined'} disabled={savingId === item.id} onClick={() => setPrimary(item)}>{item.isPrimary ? '대표 지정됨' : '대표 지정'}</Button>}
      </article>;
    })}</div> : <Alert severity="info">등록된 Data Room 미디어가 없습니다. 외관·도로·주변환경 이미지를 위에서 등록하세요.</Alert>}
  </section>;
}