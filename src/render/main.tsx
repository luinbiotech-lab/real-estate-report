import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { DaonOnePageMaster } from '../components/professionalReport/DaonOnePageMaster';
import { DaonProfessionalReportMaster } from '../components/professionalReport/DaonProfessionalReportMaster';
import { buildDetailRenderModel, isViewModel, snapshotMatchesProperty } from '../domain/professionalReport/snapshotRenderModel';
import { DAON_DETAIL_MASTER_TEMPLATE_ID, resolveProfessionalTemplate } from '../domain/professionalReport/templateIds';
import { parseReportRenderPayload, substituteImages } from './reportRenderPayload';
// Same global and report styles as the in-app report pages (main.tsx + DocumentPreview + ProfessionalReportSnapshotPage).
import '../styles.css';
import '../design-system.css';
import '../professional-report.css';
import '../daon-one-page-master.css';
import '../daon-detail-master.css';
import '../daon-report-frame.css';
import '../assets/fonts/noto-sans-kr/index.css';
import '../report-device-fit.css';
import '../assets/fonts/montserrat/index.css';
// Device-independent fonts for the report (2026-11-16): MASTER family names -> bundled files.
import '../assets/fonts/report-font-lock/index.css';
import '../daon-master-refinement.css';
import '../daon-one-page-quality.css';
import '../daon-detail-quality.css';
import '../report-layout-guard.css';

/*
 * Fixed-engine render page (2026-11-16). Loaded only by the server renderer (api/_lib/reportPdf.mjs) in headless
 * Chromium with no network: no app shell, no login, no IndexedDB. It renders exactly one MASTER document from the payload
 * and reports readiness on <html data-render-state>, after the bundled fonts and every image have finished loading.
 */

declare global { interface Window { __DAON_RENDER__?: unknown } }

const root = document.documentElement;
const fail = (message: string) => { root.dataset.renderState = 'error'; root.dataset.renderError = message; };

function Document() {
  const parsed = parseReportRenderPayload(window.__DAON_RENDER__);
  if (!parsed.ok) throw new Error(parsed.error);
  const payload = parsed.payload;
  if (payload.kind === 'proposal') {
    const property = substituteImages(payload.property, payload.images);
    return <div className="preview-shell report-render"><div className="paper-stage"><div><DaonOnePageMaster property={property} priceEstimate={payload.priceEstimate} /></div></div></div>;
  }
  const snapshot = substituteImages(payload.snapshot, payload.images);
  if (!isViewModel(snapshot.snapshotData)) throw new Error('Snapshot 보고서 본문 형식이 올바르지 않습니다.');
  if (!snapshotMatchesProperty(snapshot)) throw new Error('Snapshot의 물건 ID와 보고서 본문의 물건 ID가 일치하지 않습니다.');
  if (resolveProfessionalTemplate(snapshot) !== DAON_DETAIL_MASTER_TEMPLATE_ID) throw new Error('DAON_DETAIL_7P_MASTER Snapshot만 PDF로 만들 수 있습니다.');
  const model = buildDetailRenderModel({ ...snapshot, snapshotData: snapshot.snapshotData });
  return <main className="professional-report-shell report-render"><div><DaonProfessionalReportMaster snapshot={snapshot} model={model} /></div></main>;
}

function Ready() {
  // Runs after the document has been committed to the DOM.
  useEffect(() => { void settle().catch((error) => fail(error instanceof Error ? error.message : String(error))); }, []);
  return null;
}

const nextFrames = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));

async function settle() {
  // Font subsets load on demand while layout discovers characters, so wait until no face is loading across frames.
  for (let round = 0; round < 20; round++) {
    await document.fonts.ready;
    await nextFrames();
    if (document.fonts.status === 'loaded' && ![...document.fonts].some((font) => font.status === 'loading')) break;
  }
  const images = [...document.images];
  await Promise.all(images.map((img) => (img.complete ? Promise.resolve() : new Promise<void>((done) => { img.addEventListener('load', () => done(), { once: true }); img.addEventListener('error', () => done(), { once: true }); }))));
  await Promise.all(images.map((img) => img.decode().catch(() => undefined)));
  root.dataset.brokenImages = String(images.filter((img) => !img.naturalWidth).length);
  // Two frames so layout after font swap is final before the PDF is printed.
  await nextFrames();
  root.dataset.renderState = 'ready';
}

try {
  const element = document.getElementById('root');
  if (!element) throw new Error('render root missing');
  // Validate synchronously so a bad payload reports an error instead of an empty PDF.
  const parsed = parseReportRenderPayload(window.__DAON_RENDER__);
  if (!parsed.ok) throw new Error(parsed.error);
  createRoot(element, { onUncaughtError: (error) => fail(error instanceof Error ? error.message : String(error)) }).render(<><Document /><Ready /></>);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
