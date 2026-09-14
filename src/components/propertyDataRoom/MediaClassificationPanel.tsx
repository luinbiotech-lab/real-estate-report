import { useState } from 'react';
import { Alert, Chip, MenuItem, TextField } from '@mui/material';
import type { MediaCategory, PropertyMedia } from '../../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../../repositories/propertyDataRoomRepository';

const reportCategories: MediaCategory[] = ['exterior', 'road', 'surroundings', 'entrance', 'facade_detail', 'aerial', 'parking', 'other'];
const labels: Record<MediaCategory, string> = {
  exterior: '외관', interior: '내부', lobby: '로비', office: '오피스', corridor: '복도', restroom: '화장실', basement: '지하', rooftop: '옥상', roof: '지붕', parking: '주차', mechanical_room: '기계실', mechanical: '설비', road: '도로', entrance: '출입구', surroundings: '주변환경', floor_plan: '평면도', facade_detail: '파사드', aerial: '항공/드론', '360': '360', other: '기타',
};

export default function MediaClassificationPanel({ media, internalPhotoAllowed, onSaved }: {
  media: PropertyMedia[];
  internalPhotoAllowed: boolean;
  onSaved: () => Promise<void> | void;
}) {
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const update = async (item: PropertyMedia, category: MediaCategory) => {
    setSavingId(item.id); setError('');
    try {
      await propertyDataRoomRepository.updateMedia({ ...item, category, updatedAt: new Date().toISOString() });
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '미디어 분류를 저장하지 못했습니다.');
    } finally { setSavingId(''); }
  };

  if (!media.length) return null;
  return <section style={{ marginTop: 20 }}>
    <div className="document-toolbar"><div><h2>보고서 미디어 분류</h2><p>외관·도로·주변환경으로 분류된 미디어를 7P가 우선 사용합니다. 내부사진 제외 물건은 내부 카테고리를 보고서에서 사용하지 않습니다.</p></div><Chip size="small" label={internalPhotoAllowed ? '내부사진 허용' : '내부사진 제외'} color={internalPhotoAllowed ? 'default' : 'warning'} /></div>
    {error && <Alert severity="error">{error}</Alert>}
    <div className="document-list">{media.map((item) => <article key={item.id}>
      <div className="file-icon">{item.url ? <img src={item.url} alt={item.caption || item.fileName} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} /> : null}</div>
      <div><b>{item.caption || item.fileName}</b><span>{labels[item.category]} · {item.verificationStatus}</span><small>{item.floor ? `${item.floor} · ` : ''}{item.captureDate || item.createdAt.slice(0, 10)}</small></div>
      <TextField select size="small" label="보고서 분류" value={reportCategories.includes(item.category) ? item.category : 'other'} disabled={savingId === item.id} onChange={(event) => update(item, event.target.value as MediaCategory)}>{reportCategories.map((category) => <MenuItem key={category} value={category}>{labels[category]}</MenuItem>)}</TextField>
    </article>)}</div>
  </section>;
}
