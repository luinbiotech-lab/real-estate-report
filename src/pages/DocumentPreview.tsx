import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, CircularProgress } from '@mui/material';
import { ArrowBackRounded, PrintRounded } from '@mui/icons-material';
import { useReactToPrint } from 'react-to-print';
import { propertyRepository } from '../repositories/propertyRepository';
import { reportSnapshotService } from '../services/reportEngine';
import type { Property } from '../types';
import { DaonOnePageMaster } from '../components/professionalReport/DaonOnePageMaster';
import '../daon-one-page-master.css';
import '../daon-master-refinement.css';

export default function DocumentPreview() {
  const { id = '', kind = 'proposal' } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState<Property>();
  const [redirecting, setRedirecting] = useState(kind === 'report');
  const [error, setError] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const print = useReactToPrint({ contentRef, documentTitle: property ? `${property.name}_DAON_1P_MASTER` : 'DAON_1P_MASTER' });

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    if (kind === 'report') {
      setRedirecting(true);
      reportSnapshotService.createDraft(id)
        .then((snapshot) => { if (!cancelled) navigate(`/professional-report/snapshot/${snapshot.id}`, { replace: true }); })
        .catch((reason) => { if (!cancelled) { setError(reason instanceof Error ? reason.message : '7P 상세보고서를 생성하지 못했습니다.'); setRedirecting(false); } });
      return () => { cancelled = true; };
    }
    propertyRepository.getById(id)
      .then((value) => { if (!cancelled) { if (value) setProperty(value); else setError('물건을 찾을 수 없습니다.'); } })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : '물건을 불러오지 못했습니다.'); });
    return () => { cancelled = true; };
  }, [id, kind, navigate]);

  if (redirecting) return <div className="center"><CircularProgress /><p>DAON_DETAIL_7P_MASTER를 생성하는 중입니다.</p></div>;
  if (error) return <main className="snapshot-error"><p>{error}</p><Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/')}>물건 목록</Button></main>;
  if (!property) return <div className="center"><CircularProgress /></div>;

  return <div className="preview-shell">
    <div className="preview-toolbar">
      <Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/')}>물건 목록</Button>
      <div><b>DA:ON ASSET 1P 요약제안서</b><small>DAON_1P_MASTER · 검증 데이터 기반 동적 렌더링</small></div>
      <Button variant="contained" startIcon={<PrintRounded />} onClick={() => print()}>인쇄 / PDF 저장</Button>
    </div>
    <div className="paper-stage"><div ref={contentRef}><DaonOnePageMaster property={property} /></div></div>
  </div>;
}
