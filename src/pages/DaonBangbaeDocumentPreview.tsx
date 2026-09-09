import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';
import { ArrowBackRounded, PrintRounded } from '@mui/icons-material';
import { useReactToPrint } from 'react-to-print';
import { DaonBangbaeOnePageGolden } from '../components/professionalReport/DaonBangbaeGoldenReference';
import '../daon-golden-reference.css';

export default function DaonBangbaeDocumentPreview() {
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);
  const print = useReactToPrint({ contentRef, documentTitle: 'DAON_방배동_815-11_1P_Summary' });
  return <div className="preview-shell">
    <div className="preview-toolbar">
      <Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/')}>물건 목록</Button>
      <div><b>DA:ON ASSET 전속매각 요약본</b><small>DAON_1P_MASTER · 방배동 815-11 고정 MASTER</small></div>
      <Button variant="contained" startIcon={<PrintRounded />} onClick={() => print()}>인쇄 / PDF 저장</Button>
    </div>
    <div className="paper-stage"><div ref={contentRef}><DaonBangbaeOnePageGolden /></div></div>
  </div>;
}
