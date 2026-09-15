import { useState, type ChangeEvent } from 'react';
import { Alert, Button, Chip, MenuItem, TextField } from '@mui/material';
import type { MediaCategory, PropertyMedia } from '../../domain/propertyDataRoom/types';
import { isInternalMediaCategory } from '../../domain/professionalReport/reportAccessPolicy';
import { propertyDataRoomRepository } from '../../repositories/propertyDataRoomRepository';
import { propertyDataRoomService } from '../../services/propertyDataRoomService';

const reportCategories: MediaCategory[] = ['exterior', 'road', 'surroundings', 'entrance', 'facade_detail', 'aerial', 'parking', 'other'];
const labels: Record<MediaCategory, string> = {
  exterior: '외관', interior: '내부', lobby: '로비', office: '오피스', corridor: '복도', restroom: '화장실', basement: '지하', rooftop: '옥상', roof: '지붕', parking: '주차', mechanical_room: '기계실', mechanical: '설비', road: '도로', entrance: '출입구', surroundings: '주변환경', floor_plan: '평면도', facade_detail: '파사드', aerial: '항공/드론', '360': '360', other: '기타',
};

export default function MediaClassificationPanel({ propertyId, media, internalPhotoAllowed, onSaved }: {
  propertyId: string;
  media: PropertyMedia[];
  internalPhotoAllowed: boolean;
  onSaved: () => Promise<void> | void;
}) {
  const [savingId, setSavingId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<MediaCategory>('exterior');
  const [caption, setCaption] = useState('');
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

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    setUploading(true); setError(''); setMessage('');
    try {
      await propertyDataRoomService.uploadMedia(propertyId, file, { category, caption });
      setCaption('');
      setMessage(`${labels[category]} 미디어를 Data Room과 Professional Report 소스로 연결했습니다.`);
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '미디어를 등록하지 못했습니다.');
    } finally { setUploading(false); event.target.value = ''; }
  };

  return <section style={{ marginTop: 20 }}>
    <div className="document-toolbar"><div><h2>보고서 미디어 연결</h2><p>실제 외관·도로·주변 이미지를 category와 함께 저장합니다. 내부사진 제외 물건은 내부 사진을 Professional Report에서 사용하지 않습니다.</p></div><Chip size="small" label={internalPhotoAllowed ? '내부사진 허용' : '내부사진 제외'} color={internalPhotoAllowed ? 'default' : 'warning'} /></div>
    {message && <Alert severity="success">{message}</Alert>}
    {error && <Alert severity="error">{error}</Alert>}
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr auto', gap: 12, margin: '12px 0 18px' }}>
      <TextField select size="small" label="미디어 분류" value={category} onChange={(event) => setCategory(event.target.value as MediaCategory)}>{reportCategories.map((value) => <MenuItem key={value} value={value}>{labels[value]}</MenuItem>)}</TextField>
      <TextField size="small" label="캡션" value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="예: 동광로18길 코너 외관" />
      <Button component="label" variant="contained" disabled={uploading}>{uploading ? '등록 중…' : '사진 등록'}<input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} /></Button>
    </div>
    {media.length ? <div className="document-list">{media.map((item) => {
      const lockedInternal = !internalPhotoAllowed && isInternalMediaCategory(item.category);
      return <article key={item.id}>
        <div className="file-icon">{item.url ? <img src={item.url} alt={item.caption || item.fileName} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} /> : null}</div>
        <div><b>{item.caption || item.fileName}</b><span>{labels[item.category]} · {item.verificationStatus}{lockedInternal ? ' · 보고서 제외 고정' : ''}</span><small>{item.floor ? `${item.floor} · ` : ''}{item.captureDate || item.createdAt.slice(0, 10)}</small></div>
        <TextField select size="small" label={lockedInternal ? '보고서 제외' : '보고서 분류'} value={reportCategories.includes(item.category) ? item.category : 'other'} disabled={savingId === item.id || lockedInternal} onChange={(event) => update(item, event.target.value as MediaCategory)}>{reportCategories.map((value) => <MenuItem key={value} value={value}>{labels[value]}</MenuItem>)}</TextField>
      </article>;
    })}</div> : <Alert severity="info">등록된 Data Room 미디어가 없습니다. 외관·도로·주변환경 이미지를 위에서 등록하세요.</Alert>}
  </section>;
}