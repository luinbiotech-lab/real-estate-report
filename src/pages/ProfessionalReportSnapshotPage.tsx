import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowBackRounded, CheckCircleOutlineRounded, LockOutlined, PrintRounded, RefreshRounded } from '@mui/icons-material';
import { Alert, Button, Chip, CircularProgress } from '@mui/material';
import { useReactToPrint } from 'react-to-print';
import { DaonDetail7PageMaster } from '../components/professionalReport/DaonDetail7PageMaster';
import { DAON_DETAIL_MASTER_TEMPLATE_ID, resolveProfessionalTemplate } from '../domain/professionalReport/templateIds';
import type { ProfessionalReportViewModel } from '../domain/professionalReport/types';
import type { ReportSnapshot } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { reportSnapshotService } from '../services/reportEngine';
import '../professional-report.css';
import '../daon-detail-master.css';
import '../daon-master-refinement.css';

function isViewModel(value: unknown): value is ProfessionalReportViewModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ProfessionalReportViewModel>;
  return Boolean(candidate.identity?.name && candidate.pricing?.salePrice && candidate.generated?.generatedAt && candidate.dataQuality);
}

export default function ProfessionalReportSnapshotPage() {
  const { snapshotId = '' } = useParams();
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);
  const [snapshot, setSnapshot] = useState<ReportSnapshot>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const print = useReactToPrint({ contentRef, documentTitle: snapshot ? `DAON_Professional_Report_v${snapshot.reportVersion}` : 'DAON_Professional_Report' });

  useEffect(() => {
    propertyDataRoomRepository.getReportSnapshot(snapshotId).then((value) => {
      if (!value) setError('요청한 보고서 Snapshot을 찾을 수 없습니다.'); else setSnapshot(value);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Snapshot을 불러오지 못했습니다.')).finally(() => setLoading(false));
  }, [snapshotId]);

  const markReady = async () => {
    setConfirming(true); setError('');
    try { setSnapshot(await reportSnapshotService.markReady(snapshotId)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '보고서를 확정하지 못했습니다.'); }
    finally { setConfirming(false); }
  };

  const regenerateWithMaster = async () => {
    if (!snapshot) return;
    setRegenerating(true); setError('');
    try {
      const next = await reportSnapshotService.createDraft(snapshot.propertyId);
      navigate(`/professional-report/snapshot/${next.id}`, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '현재 DA:ON MASTER 보고서를 생성하지 못했습니다.');
      setRegenerating(false);
    }
  };

  if (loading) return <div className="center"><CircularProgress /><p>저장된 보고서를 불러오는 중입니다.</p></div>;
  if (!snapshot || !isViewModel(snapshot.snapshotData)) return <main className="snapshot-error"><Alert severity="error">{error || '저장된 Snapshot 형식이 올바르지 않습니다.'}</Alert><Button startIcon={<ArrowBackRounded />} onClick={() => navigate(-1)}>돌아가기</Button></main>;

  const templateId = resolveProfessionalTemplate(snapshot);
  if (!templateId) return <main className="snapshot-error"><Alert severity="warning">지원되지 않는 보고서 템플릿입니다: {snapshot.templateId || snapshot.templateVersion}</Alert><Button startIcon={<ArrowBackRounded />} onClick={() => navigate(-1)}>돌아가기</Button></main>;

  const isDaonMaster = templateId === DAON_DETAIL_MASTER_TEMPLATE_ID;
  if (!isDaonMaster) {
    return <main className="snapshot-error">
      <Alert severity="warning">이 Snapshot은 구형 보고서 형식입니다. 현재 5174 보고서 화면에서는 확정된 DAON_DETAIL_7P_MASTER만 사용합니다. 기존 Snapshot 데이터는 삭제하지 않습니다.</Alert>
      {error && <Alert severity="error">{error}</Alert>}
      <div className="actions">
        <Button startIcon={<ArrowBackRounded />} onClick={() => navigate(-1)}>Data Room</Button>
        <Button variant="contained" startIcon={<RefreshRounded />} disabled={regenerating} onClick={regenerateWithMaster}>{regenerating ? 'MASTER 생성 중…' : '현재 DA:ON MASTER로 다시 생성'}</Button>
      </div>
    </main>;
  }

  const model = snapshot.snapshotData;
  const reportReady = model.dataQuality.reportReady;
  const report = <DaonDetail7PageMaster snapshot={snapshot} model={model} />;

  return <main className="professional-report-shell">
    <nav className="professional-report-toolbar" aria-label="Professional Report 작업">
      <div><Button startIcon={<ArrowBackRounded />} onClick={() => navigate(-1)}>Data Room</Button><span><LockOutlined /> DAON_DETAIL_7P_MASTER · 동적 Snapshot</span><Chip size="small" label={snapshot.status === 'ready' ? '확정됨' : reportReady ? '확정 가능' : '검증 필요'} color={snapshot.status === 'ready' ? 'success' : reportReady ? 'primary' : 'warning'} /></div>
      <div>
        {snapshot.status === 'draft' && <Button startIcon={<RefreshRounded />} disabled={regenerating} onClick={regenerateWithMaster}>{regenerating ? '재생성 중…' : '최신 데이터로 다시 생성'}</Button>}
        {snapshot.status === 'draft' && <Button variant="outlined" startIcon={<CheckCircleOutlineRounded />} disabled={confirming || !reportReady} onClick={markReady}>보고서 확정</Button>}
        <Button variant="contained" startIcon={<PrintRounded />} onClick={() => print()}>인쇄 / PDF 저장</Button>
      </div>
    </nav>
    {!reportReady && snapshot.status === 'draft' && <Alert severity="warning" className="professional-report-alert">필수 공적자료 검증 또는 검증 대기 후보 처리가 남아 있습니다. 초안 미리보기·인쇄는 가능하지만, 모든 검증이 끝나기 전에는 보고서를 확정할 수 없습니다. Data Room 검증 후 ‘최신 데이터로 다시 생성’을 사용하세요.</Alert>}
    {error && <Alert severity="error" className="professional-report-alert">{error}</Alert>}
    <div ref={contentRef}>{report}</div>
  </main>;
}
