import { Alert, Button } from '@mui/material';
import type { FixedPdfState } from '../../hooks/useFixedReportPdf';

/** Result line for "PDF 저장" (fixed server engine). On failure the browser print is offered, labelled as a fallback. */
export function FixedPdfStatus({ state, onClose, onFallbackPrint, className }: { state: FixedPdfState; onClose: () => void; onFallbackPrint: () => void; className?: string }) {
  if (state.phase === 'working') return <Alert severity="info" className={className} data-testid="fixed-pdf-status">고정 엔진으로 PDF를 만드는 중입니다. 사진이 많으면 10초 정도 걸립니다.</Alert>;
  if (state.phase === 'done') return <Alert severity={state.warning ? 'warning' : 'success'} className={className} onClose={onClose} data-testid="fixed-pdf-status">PDF를 저장했습니다{state.pages ? ` (${state.pages}쪽)` : ''}. 어느 기기에서 받아도 같은 모양입니다.{state.warning ? ` ${state.warning}` : ''}</Alert>;
  if (state.phase === 'error') return <Alert severity="error" className={className} onClose={onClose} data-testid="fixed-pdf-status" action={<Button color="inherit" size="small" onClick={onFallbackPrint}>브라우저 인쇄</Button>}>{state.message} 급하면 브라우저 인쇄로 저장할 수 있지만, 기기마다 크기·여백이 달라질 수 있습니다.</Alert>;
  return null;
}
