import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowBackRounded, CheckCircleOutlineRounded, LockOutlined, PrintRounded } from '@mui/icons-material';
import { Alert, Button, Chip, CircularProgress } from '@mui/material';
import { useReactToPrint } from 'react-to-print';
import { ProfessionalReportV1 } from '../components/professionalReport/ProfessionalReportV1';
import { DaonDetail7PageMaster } from '../components/professionalReport/DaonDetail7PageMaster';
import { DAON_DETAIL_MASTER_TEMPLATE_ID, resolveProfessionalTemplate } from '../domain/professionalReport/templateIds';
import type { ProfessionalReportViewModel } from '../domain/professionalReport/types';
import type { ReportSnapshot } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { reportSnapshotService } from '../services/reportEngine';
import '../professional-report.css';
import '../daon-detail-master.css';

function isViewModel(value: unknown): value is ProfessionalReportViewModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ProfessionalReportViewModel>;
  return Boolean(candidate.identity?.name && candidate.pricing?.salePrice && candidate.generated?.generatedAt);
}

export default function ProfessionalReportSnapshotPage() {
  const { snapshotId = '' } = useParams();
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);
  const [snapshot, setSnapshot] = useState<ReportSnapshot>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const print = useReactToPrint({ contentRef, documentTitle: snapshot ? `Professional_Report_v${snapshot.reportVersion}` : 'Professional_Report' });

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

  if (loading) return <div className="center"><CircularProgress /><p>저장된 보고서를 불러오는 중입니다.</p></div>;
  if (!snapshot || !isViewModel(snapshot.snapshotData)) return <main className="snapshot-error"><Alert severity="error">{error || '저장된 Snapshot 형식이 올바르지 않습니다.'}</Alert><Button startIcon={<ArrowBackRounded />} onClick={() => navigate(-1)}>돌아가기</Button></main>;

  const templateId = resolveProfessionalTemplate(snapshot);
  if (!templateId) return <main className="snapshot-error"><Alert severity="warning">지원되지 않는 보고서 템플릿입니다: {snapshot.templateId || snapshot.templateVersion}</Alert><Button startIcon={<ArrowBackRounded />} onClick={() => navigate(-1)}>돌아가기</Button></main>;

  const report = templateId === DAON_DETAIL_MASTER_TEMPLATE_ID
    ? <DaonDetail7PageMaster snapshot={snapshot} model={snapshot.snapshotData} />
    : <ProfessionalReportV1 snapshot={snapshot} model={snapshot.snapshotData} />;

  return <main className="professional-report-shell"><nav className="professional-report-toolbar" aria-label="Professional Report 작업"><div><Button startIcon={<ArrowBackRounded />} onClick={() => navigate(-1)}>Data Room</Button><span><LockOutlined /> Snapshot 전용 미리보기</span><Chip size="small" label={snapshot.status === 'ready' ? '확정됨' : '초안'} color={snapshot.status === 'ready' ? 'success' : 'default'} /></div><div>{snapshot.status === 'draft' && <Button variant="outlined" startIcon={<CheckCircleOutlineRounded />} disabled={confirming} onClick={markReady}>보고서 확정</Button>}<Button variant="contained" startIcon={<PrintRounded />} onClick={() => print()}>인쇄 / PDF 저장</Button></div></nav>{error && <Alert severity="error" className="professional-report-alert">{error}</Alert>}<div ref={contentRef}>{report}</div></main>;
}
