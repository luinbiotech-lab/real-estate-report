import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, CircularProgress } from '@mui/material';
import { ArrowBackRounded, PrintRounded } from '@mui/icons-material';
import { useReactToPrint } from 'react-to-print';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { propertyRepository } from '../repositories/propertyRepository';
import { internalPhotoAllowed, reportMediaCategoryAllowed } from '../domain/professionalReport/reportAccessPolicy';
import { reportSnapshotService } from '../services/reportEngine';
import type { Property } from '../types';
import { DaonOnePageMaster } from '../components/professionalReport/DaonOnePageMaster';
import '../daon-one-page-master.css';
import '../daon-master-refinement.css';

type PreviewState =
  | { routeKey: string; phase: 'loading' }
  | { routeKey: string; phase: 'error'; error: string }
  | { routeKey: string; phase: 'ready'; property: Property };

export default function DocumentPreview() {
  const { id = '', kind = 'proposal' } = useParams();
  const navigate = useNavigate();
  const [view, setView] = useState<PreviewState>({ routeKey: '', phase: 'loading' });
  const contentRef = useRef<HTMLDivElement>(null);
  const routeKey = `${kind}:${id}`;
  // React Router can reuse this page while its URL changes. Reject the previous
  // property's content synchronously, before useEffect has reset the state.
  const current = view.routeKey === routeKey && (
    view.phase !== 'ready' || (kind === 'proposal' && view.property.id === id)
  ) ? view : { routeKey, phase: 'loading' } as PreviewState;
  const print = useReactToPrint({
    contentRef,
    documentTitle: current.phase === 'ready' ? `${current.property.name}_DAON_1P_MASTER` : 'DAON_1P_MASTER',
  });

  useEffect(() => {
    let cancelled = false;
    setView({ routeKey, phase: 'loading' });
    if (!id) {
      setView({ routeKey, phase: 'error', error: '물건 ID가 없습니다.' });
      return () => { cancelled = true; };
    }
    if (kind === 'report') {
      // Existing workflow: generate a new draft and navigate to its Snapshot.
      // A late completion may persist the draft, but must not navigate this route.
      void reportSnapshotService.createDraft(id)
        .then((snapshot) => { if (!cancelled) navigate(`/professional-report/snapshot/${snapshot.id}`, { replace: true }); })
        .catch((reason) => {
          if (!cancelled) setView({ routeKey, phase: 'error', error: reason instanceof Error ? reason.message : '7P 상세보고서를 생성하지 못했습니다.' });
        });
      return () => { cancelled = true; };
    }
    if (kind !== 'proposal') {
      setView({ routeKey, phase: 'error', error: '지원되지 않는 보고서 종류입니다.' });
      return () => { cancelled = true; };
    }
    void Promise.all([propertyRepository.getById(id), propertyDataRoomRepository.getBundle(id)])
      .then(([value, bundle]) => {
        if (cancelled) return;
        if (!value || value.id !== id) {
          setView({ routeKey, phase: 'error', error: '요청한 물건을 찾을 수 없습니다.' });
          return;
        }
        const allowInternal = internalPhotoAllowed(value);
        const dataRoomHero = bundle.media.find((item) => item.url && reportMediaCategoryAllowed(item.category, allowInternal))?.url || '';
        const mainImage = allowInternal ? (value.mainImage || dataRoomHero) : dataRoomHero;
        setView({ routeKey, phase: 'ready', property: { ...value, mainImage } });
      })
      .catch((reason) => {
        if (!cancelled) setView({ routeKey, phase: 'error', error: reason instanceof Error ? reason.message : '물건을 불러오지 못했습니다.' });
      });
    return () => { cancelled = true; };
  }, [id, kind, navigate, routeKey]);

  if (current.phase === 'loading') return <div className="center"><CircularProgress /><p>{kind === 'report' ? 'DAON_DETAIL_7P_MASTER를 생성하는 중입니다.' : '물건 보고서를 불러오는 중입니다.'}</p></div>;
  if (current.phase === 'error') return <main className="snapshot-error"><p>{current.error}</p><Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/')}>물건 목록</Button></main>;
  if (kind !== 'proposal') return <div className="center"><CircularProgress /></div>;

  const property = current.property;
  return <div className="preview-shell">
    <div className="preview-toolbar">
      <Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/')}>물건 목록</Button>
      <div><b>DA:ON ASSET 1P 요약제안서</b><small>DAON_1P_MASTER · 검증 데이터 기반 동적 렌더링</small></div>
      <Button variant="contained" startIcon={<PrintRounded />} onClick={() => print()}>인쇄 / PDF 저장</Button>
    </div>
    <div className="paper-stage"><div ref={contentRef}><DaonOnePageMaster property={property} /></div></div>
  </div>;
}
