import { useCallback, useState, type RefObject } from 'react';
import type { ReportRenderPayload } from '../render/reportRenderPayload';
import { buildReportPdfRequest, ReportPdfError, requestReportPdf, saveReportPdf } from '../services/reportPdfService';

export type FixedPdfState =
  | { phase: 'idle' }
  | { phase: 'working' }
  | { phase: 'done'; pages: number; warning: string }
  | { phase: 'error'; message: string };

/**
 * "PDF 저장" for the 1P and detail report (2026-11-16): the fixed server engine prints the report, never this device's
 * print dialog, so the PDF is the same on every phone and PC. The browser print stays only as a labelled fallback.
 */
export function useFixedReportPdf(contentRef: RefObject<HTMLElement | null>, buildBase: () => Omit<ReportRenderPayload, 'images'> | null, fileName: string) {
  const [state, setState] = useState<FixedPdfState>({ phase: 'idle' });
  const save = useCallback(async () => {
    const base = buildBase();
    if (!base || !contentRef.current) { setState({ phase: 'error', message: '보고서가 아직 준비되지 않았습니다.' }); return; }
    setState({ phase: 'working' });
    try {
      const { body, failed } = await buildReportPdfRequest(contentRef.current, base);
      const { blob, pages, brokenImages } = await requestReportPdf(body);
      saveReportPdf(blob, fileName);
      const missing = failed.length + brokenImages;
      setState({ phase: 'done', pages, warning: missing ? `사진 ${missing}개를 PDF에 넣지 못해 빈 칸으로 표시했습니다.` : '' });
    } catch (error) {
      setState({ phase: 'error', message: error instanceof ReportPdfError ? error.message : 'PDF를 만들지 못했습니다.' });
    }
  }, [buildBase, contentRef, fileName]);
  return { state, save, reset: () => setState({ phase: 'idle' }) };
}
