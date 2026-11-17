import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, CircularProgress } from '@mui/material';
import { ArrowBackRounded, PictureAsPdfRounded, PrintRounded } from '@mui/icons-material';
import { useFixedReportPdf } from '../hooks/useFixedReportPdf';
import { FixedPdfStatus } from '../components/professionalReport/FixedPdfStatus';
import { useReactToPrint } from 'react-to-print';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { propertyRepository } from '../repositories/propertyRepository';
import { internalPhotoAllowed, reportMediaCategoryAllowed } from '../domain/professionalReport/reportAccessPolicy';
import { reportSnapshotService } from '../services/reportEngine';
import { createReportDraftOnce } from '../services/reportEngine/reportDraftSingleFlight';
import type { ReportSnapshot } from '../domain/propertyDataRoom/types';
import type { Property } from '../types';
import { DaonOnePageMaster } from '../components/professionalReport/DaonOnePageMaster';
import { findPriceEstimate, type AchievablePriceEstimate } from '../domain/professionalReport/priceLayerView';
import { ReportBlankFieldsDialog, ReportBlankFieldsNotice } from '../components/professionalReport/ReportBlankFieldsGate';
import { blankFieldsSignature, needsBlankFieldConfirmation, onePageBlankFields, onePageLengthWarnings } from '../domain/professionalReport/reportBlankFields';
import '../daon-one-page-master.css';
import '../assets/fonts/noto-sans-kr/index.css';
import '../report-device-fit.css';
import { useReportDeviceFit } from '../hooks/useReportDeviceFit';
import '../assets/fonts/montserrat/index.css';
// Device-independent fonts for the report (2026-11-16): MASTER family names -> bundled files.
import '../assets/fonts/report-font-lock/index.css';
import '../daon-master-refinement.css';
import '../daon-one-page-quality.css';
import '../report-layout-guard.css';

type PreviewState =
  | { routeKey: string; phase: 'loading' }
  | { routeKey: string; phase: 'error'; error: string }
  | { routeKey: string; phase: 'ready'; property: Property; priceEstimate: AchievablePriceEstimate | null };

export default function DocumentPreview() {
  useReportDeviceFit();
  const { id = '', kind = 'proposal' } = useParams();
  const navigate = useNavigate();
  const [view, setView] = useState<PreviewState>({ routeKey: '', phase: 'loading' });
  const contentRef = useRef<HTMLDivElement>(null);
  // Blank-field pre-publish check: signature of the blank set the user agreed to publish hidden (null = not yet asked).
  const [blankAcknowledged, setBlankAcknowledged] = useState<string | null>(null);
  const [blankDialogOpen, setBlankDialogOpen] = useState(false);
  // Per-component scope prevents StrictMode effect replay from persisting two
  // Draft Snapshots; never share pending creations across auth sessions.
  const draftRequests = useRef(new Map<string, Promise<ReportSnapshot>>());
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
  const buildPdfBase = () => (current.phase === 'ready' ? { version: 1 as const, kind: 'proposal' as const, property: current.property, priceEstimate: current.priceEstimate } : null);
  const fixedPdf = useFixedReportPdf(contentRef, buildPdfBase, current.phase === 'ready' ? `${current.property.name}_DAON_1P_MASTER` : 'DAON_1P_MASTER');
  // Which output the pre-publish dialog continues to: the fixed-engine PDF (default) or the browser print fallback.
  const [pendingOutput, setPendingOutput] = useState<'pdf' | 'print'>('pdf');

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
      void createReportDraftOnce(draftRequests.current, id, (propertyId) => reportSnapshotService.createDraft(propertyId))
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
        // Field photos win; a VWorld aerial image (labelled on the image) fills the hero only when none exists.
        const dataRoomHero = bundle.media.find((item) => item.propertyId === id && !item.deletedAt && item.mediaType === 'image' && item.url && item.category !== 'aerial' && reportMediaCategoryAllowed(item.category, allowInternal))?.url || bundle.media.find((item) => item.propertyId === id && !item.deletedAt && item.mediaType === 'image' && item.url && item.category === 'aerial' && reportMediaCategoryAllowed(item.category, allowInternal))?.url || '';
        const mainImage = allowInternal ? (value.mainImage || dataRoomHero) : dataRoomHero;
        setView({ routeKey, phase: 'ready', property: { ...value, mainImage }, priceEstimate: findPriceEstimate(bundle.dataSources, id) });
      })
      .catch((reason) => {
        if (!cancelled) setView({ routeKey, phase: 'error', error: reason instanceof Error ? reason.message : '물건을 불러오지 못했습니다.' });
      });
    return () => { cancelled = true; };
  }, [id, kind, navigate, routeKey]);

  if (current.phase === 'loading') return <div className="center"><CircularProgress /><p>{kind === 'report' ? 'DAON_DETAIL_7P_MASTER를 생성하는 중입니다.' : '물건 보고서를 불러오는 중입니다.'}</p></div>;
  if (current.phase === 'error') return <main className="snapshot-error"><p>{current.error}</p><Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/properties')}>물건 목록</Button></main>;
  if (kind !== 'proposal') return <div className="center"><CircularProgress /></div>;

  const property = current.property;
  const blankFields = [...onePageBlankFields(property), ...onePageLengthWarnings(property)];
  const blankAcknowledgedNow = !needsBlankFieldConfirmation(blankFields, blankAcknowledged);
  const runOutput = (output: 'pdf' | 'print') => { if (output === 'pdf') void fixedPdf.save(); else print(); };
  const requestOutput = (output: 'pdf' | 'print') => {
    setPendingOutput(output);
    if (!blankAcknowledgedNow) { setBlankDialogOpen(true); return; }
    runOutput(output);
  };
  return <div className="preview-shell">
    <div className="preview-toolbar">
      <Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/properties')}>물건 목록</Button>
      <div><b>DA:ON ASSET 1P 요약제안서</b><small>DAON_1P_MASTER · 검증 데이터 기반 동적 렌더링</small></div>
      <Button variant="outlined" startIcon={<PrintRounded />} onClick={() => requestOutput('print')} title="이 기기의 인쇄 기능을 씁니다. 기기마다 크기·여백이 달라질 수 있습니다.">브라우저 인쇄</Button>
      <Button variant="contained" startIcon={<PictureAsPdfRounded />} disabled={fixedPdf.state.phase === 'working'} onClick={() => requestOutput('pdf')}>{fixedPdf.state.phase === 'working' ? 'PDF 만드는 중…' : 'PDF 저장'}</Button>
    </div>
    <FixedPdfStatus state={fixedPdf.state} onClose={fixedPdf.reset} onFallbackPrint={() => { fixedPdf.reset(); print(); }} className="preview-blank-notice" />
    <ReportBlankFieldsNotice fields={blankFields} acknowledged={blankAcknowledgedNow} className="preview-blank-notice" />
    <ReportBlankFieldsDialog
      open={blankDialogOpen}
      fields={blankFields}
      actionLabel={pendingOutput === 'pdf' ? 'PDF 저장' : '브라우저 인쇄'}
      onClose={() => setBlankDialogOpen(false)}
      onEnterValues={() => { setBlankDialogOpen(false); navigate(`/property/${encodeURIComponent(property.id)}/edit`); }}
      onContinue={() => { setBlankAcknowledged(blankFieldsSignature(blankFields)); setBlankDialogOpen(false); runOutput(pendingOutput); }}
    />
    <div className="paper-stage"><div ref={contentRef}><DaonOnePageMaster property={property} priceEstimate={current.priceEstimate} /></div></div>
  </div>;
}
