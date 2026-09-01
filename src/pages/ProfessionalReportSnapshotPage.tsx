import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowBackRounded, LockOutlined } from '@mui/icons-material';
import { Alert, Button, Chip, CircularProgress } from '@mui/material';
import type { ProfessionalReportViewModel, ReportValue } from '../domain/professionalReport/types';
import { REPORT_VALUE_LABELS } from '../domain/professionalReport/valuePolicy';
import type { ReportSnapshot } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';

function isViewModel(value: unknown): value is ProfessionalReportViewModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ProfessionalReportViewModel>;
  return Boolean(candidate.identity?.name && candidate.pricing?.salePrice && candidate.generated?.generatedAt);
}

function SnapshotValue({ label, item }: { label: string; item: ReportValue<unknown> }) {
  return <div><small>{label}</small><b>{item.display}</b><span className={`snapshot-value-state state-${item.state}`}>{REPORT_VALUE_LABELS[item.state]}</span></div>;
}

export default function ProfessionalReportSnapshotPage() {
  const { snapshotId = '' } = useParams(); const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<ReportSnapshot>(); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => { propertyDataRoomRepository.getReportSnapshot(snapshotId).then((value) => {
    if (!value) setError('요청한 보고서 Snapshot을 찾을 수 없습니다.'); else setSnapshot(value);
  }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Snapshot을 불러오지 못했습니다.')).finally(() => setLoading(false)); }, [snapshotId]);
  if (loading) return <div className="center"><CircularProgress /><p>저장된 보고서를 불러오는 중입니다.</p></div>;
  if (!snapshot || !isViewModel(snapshot.snapshotData)) return <main className="snapshot-error"><Alert severity="error">{error || '저장된 Snapshot 형식이 올바르지 않습니다.'}</Alert><Button startIcon={<ArrowBackRounded />} onClick={() => navigate(-1)}>돌아가기</Button></main>;
  const model = snapshot.snapshotData;
  return <main className="snapshot-preview-page"><header><div><Button startIcon={<ArrowBackRounded />} onClick={() => navigate(-1)}>Data Room</Button><p>IMMUTABLE PROFESSIONAL REPORT</p><h1>{model.identity.name.display}</h1><span>{model.identity.address.display}</span></div><div className="snapshot-lock"><LockOutlined /><div><b>저장 시점 데이터</b><small>현재 Property 변경과 분리된 불변 Snapshot</small></div></div></header>
    <section className="snapshot-meta"><div><small>REPORT VERSION</small><b>v{snapshot.reportVersion}</b></div><div><small>GENERATED</small><b>{new Date(snapshot.generatedAt).toLocaleString('ko-KR')}</b></div><div><small>TEMPLATE</small><b>{snapshot.templateVersion}</b></div><div><small>ENGINE</small><b>{snapshot.engineVersion || model.generated.engineVersion || '미기록'}</b></div><Chip label={snapshot.status} color="primary" /></section>
    <section className="snapshot-value-grid"><SnapshotValue label="가격" item={model.pricing.salePrice} /><SnapshotValue label="토지면적" item={model.land.landAreaPyeong} /><SnapshotValue label="토지면적 ㎡" item={model.land.landAreaSqm} /><SnapshotValue label="연면적" item={model.building.totalFloorAreaPyeong} /><SnapshotValue label="평당가" item={model.pricing.landUnitPrice} /></section>
    <section className="snapshot-summary-grid"><article><p>VERIFICATION</p><h2>검증 요약</h2><dl>{Object.entries(model.verification.counts).map(([key, count]) => <div key={key}><dt>{key}</dt><dd>{count}</dd></div>)}</dl></article><article><p>DOCUMENTS</p><h2>문서 요약</h2><strong>{model.documents.count}건</strong><span>공식 확인 {model.documents.verifiedCount}건</span><small>Snapshot 생성 당시 연결 문서 기준</small></article><article><p>DIGITAL TWIN</p><h2>Digital Twin</h2><strong>{model.digitalTwin?.connected ? `${model.digitalTwin.count}건` : '데이터 미연결'}</strong><span>{model.digitalTwin?.connected ? `처리 완료 ${model.digitalTwin.readyCount}건` : '저장된 3D 자산 없음'}</span><small>Snapshot 생성 당시 연결 상태</small></article></section>
    <footer>Snapshot ID · {snapshot.id}<span>Property를 다시 조회하지 않고 snapshotData만 표시합니다.</span></footer>
  </main>;
}
