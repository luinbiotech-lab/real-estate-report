import { ApartmentRounded, DescriptionOutlined } from '@mui/icons-material';
import { Alert, Chip } from '@mui/material';
import { VERIFICATION_LABELS } from '../../domain/propertyDataRoom/labels';
import type { PropertyDataSource, PropertySpace } from '../../domain/propertyDataRoom/types';

function floorRank(value?: string) {
  const floor = String(value || '').trim().toUpperCase();
  const basement = floor.match(/^B(\d+)$/);
  if (basement) return -Number(basement[1]);
  const ground = floor.match(/^(\d+)F$/);
  if (ground) return Number(ground[1]);
  return -999;
}

function formatArea(areaSqm?: number) {
  if (!areaSqm) return '면적 미확인';
  const pyeong = areaSqm / 3.305785;
  return `${areaSqm.toFixed(2)}㎡ · ${pyeong.toFixed(2)}평`;
}

export default function PropertySpaceOverviewPanel({ spaces, sources }: { spaces: PropertySpace[]; sources: PropertyDataSource[] }) {
  const rows = [...spaces].sort((left, right) => floorRank(right.floor) - floorRank(left.floor));
  const sourceRows = sources.filter((source) => source.resourceType === 'property_space');
  const sourceNames = [...new Set(sourceRows.map((source) => source.sourceReference || source.sourceName).filter(Boolean))];
  const totalArea = rows.reduce((sum, row) => sum + (row.areaSqm || 0), 0);
  const distinctFloorCount = new Set(rows.map((row) => String(row.floor || '').trim().toUpperCase()).filter(Boolean)).size;

  return <section style={{ gridColumn: '1 / -1', border: '1px solid #dfe5ec', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
    <div style={{ padding: '15px 18px', background: '#f7f9fb', borderBottom: '1px solid #e5eaf0', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><ApartmentRounded color="primary" /><div><p className="eyebrow" style={{ margin: 0 }}>OFFICIAL FLOOR STRUCTURE</p><h2 style={{ margin: '3px 0 0' }}>층별 구성 · Data Room</h2></div></div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Chip size="small" variant="outlined" label={`${distinctFloorCount}개 층 · ${rows.length}개 공간`} />{totalArea > 0 && <Chip size="small" variant="outlined" label={`합계 ${totalArea.toFixed(2)}㎡`} />}</div>
    </div>

    {!rows.length ? <Alert severity="info" sx={{ m: 2 }}>연결된 층별 공간정보가 없습니다. 건축물대장 추출 또는 공간자료 검토 후 이 영역에 층별 구성이 표시됩니다.</Alert> : <div style={{ padding: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '88px minmax(260px,1.5fr) minmax(180px,.8fr) 130px', gap: 10, padding: '7px 10px', color: '#667085', fontSize: 11, fontWeight: 700 }}><span>층</span><span>공부상 용도 / 공간명</span><span>면적</span><span>검증상태</span></div>
      {rows.map((space) => <div key={space.id} style={{ display: 'grid', gridTemplateColumns: '88px minmax(260px,1.5fr) minmax(180px,.8fr) 130px', gap: 10, padding: '11px 10px', borderTop: '1px solid #edf0f4', alignItems: 'center' }}>
        <strong>{space.floor || '층 미확인'}</strong>
        <div><strong style={{ fontSize: 13 }}>{space.name}</strong>{space.currentCondition && <small style={{ display: 'block', marginTop: 3, color: '#667085' }}>현장상태: {space.currentCondition}</small>}</div>
        <span style={{ fontSize: 13 }}>{formatArea(space.areaSqm)}</span>
        <Chip size="small" color={space.verificationStatus === 'verified' || space.verificationStatus === 'confirmed' ? 'success' : space.verificationStatus === 'imported' ? 'info' : 'warning'} variant="outlined" label={VERIFICATION_LABELS[space.verificationStatus]} />
      </div>)}
      <div style={{ marginTop: 10, padding: '10px 12px', background: '#fbfcfe', borderRadius: 8, color: '#667085', fontSize: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}><DescriptionOutlined fontSize="small" /> <span><strong style={{ color: '#344054' }}>출처</strong> {sourceNames.length ? sourceNames.join(' · ') : '출처 연결 대기'}<br />공부상 용도와 현장 실제 이용상태는 별도 provenance로 관리하며, 원본 문서 대조가 완료된 항목만 verified로 관리합니다.</span></div>
    </div>}
  </section>;
}
