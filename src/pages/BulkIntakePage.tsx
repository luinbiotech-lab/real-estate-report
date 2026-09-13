import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Checkbox, Chip, CircularProgress, MenuItem, TextField } from '@mui/material';
import { ArrowBackRounded, CloudUploadRounded } from '@mui/icons-material';
import { DOCUMENT_TYPE_LABELS } from '../domain/propertyDataRoom/labels';
import type { PropertyDocument, PropertyVerificationCandidate, VerificationDecisionStatus } from '../domain/propertyDataRoom/types';
import { propertyRepository } from '../repositories/propertyRepository';
import { documentExtractionService } from '../services/documentExtractionService';
import { pdfTextExtractionService } from '../services/pdfTextExtractionService';
import { propertyDataRoomService } from '../services/propertyDataRoomService';
import type { Property } from '../types';

const EXTRACTION_LABELS: Record<string, string> = {
  not_started: '추출 전',
  text_extracted: '텍스트 추출 완료',
  scan_ocr_required: 'OCR 필요',
  manual_review: '수동 검토',
  failed: '추출 실패',
};

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '미입력';
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function BulkIntakePage() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [documents, setDocuments] = useState<PropertyDocument[]>([]);
  const [candidates, setCandidates] = useState<PropertyVerificationCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    propertyRepository.getAll().then((items) => {
      setProperties(items);
      if (items.length) setPropertyId(items[0].id);
    }).finally(() => setLoading(false));
  }, []);

  const loadBundle = async (id = propertyId) => {
    if (!id) return;
    const bundle = await propertyDataRoomService.getBundle(id);
    setDocuments(bundle.documents);
    setCandidates(bundle.verificationCandidates);
    setSelected(new Set(bundle.verificationCandidates.filter((item) => item.decisionStatus === 'pending' || item.decisionStatus === 'held').map((item) => item.id)));
  };

  useEffect(() => { if (propertyId) void loadBundle(propertyId); }, [propertyId]);

  const pending = useMemo(() => candidates.filter((item) => item.decisionStatus === 'pending' || item.decisionStatus === 'held'), [candidates]);

  const processFile = async (file: File) => {
    const classified = propertyDataRoomService.classifyDocument(file.name);
    const document = await propertyDataRoomService.uploadDocument(propertyId, file, {
      documentType: classified,
      title: file.name.replace(/\.[^.]+$/, ''),
      sourceName: '공적자료 일괄 등록',
    });

    if (file.type !== 'application/pdf') {
      await propertyDataRoomService.updateDocumentExtraction(document, { status: 'scan_ocr_required', method: 'ocr' });
      return { queued: 0, ocr: 1, manual: 0 };
    }

    try {
      const result = await pdfTextExtractionService.extract(file);
      if (!result.hasTextLayer) {
        await propertyDataRoomService.updateDocumentExtraction(document, { status: 'scan_ocr_required', method: 'ocr', pageCount: result.pageCount });
        return { queued: 0, ocr: 1, manual: 0 };
      }
      const prefills = pdfTextExtractionService.prefill(classified, result.text);
      const fields = Object.entries(prefills).map(([fieldKey, rawValue]) => ({ fieldKey: fieldKey as keyof Property, rawValue }));
      const queued = fields.length ? await documentExtractionService.queueExtractedFields(document, fields) : 0;
      await propertyDataRoomService.updateDocumentExtraction(document, {
        status: queued ? 'text_extracted' : 'manual_review', method: 'pdf_text', pageCount: result.pageCount,
      });
      return { queued, ocr: 0, manual: queued ? 0 : 1 };
    } catch (reason) {
      await propertyDataRoomService.updateDocumentExtraction(document, {
        status: 'failed', method: 'pdf_text', error: reason instanceof Error ? reason.message : 'PDF 추출 실패',
      });
      return { queued: 0, ocr: 0, manual: 1 };
    }
  };

  const uploadFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!propertyId || !files.length) return;
    setBusy(true); setError(''); setMessage('');
    let queued = 0; let ocr = 0; let manual = 0; let failed = 0;
    for (const file of files) {
      try {
        const result = await processFile(file);
        queued += result.queued; ocr += result.ocr; manual += result.manual;
      } catch { failed += 1; }
    }
    await loadBundle();
    setMessage(`문서 ${files.length}건 처리 · 검증 후보 ${queued}건 · OCR 필요 ${ocr}건 · 수동 검토 ${manual}건${failed ? ` · 실패 ${failed}건` : ''}`);
    if (failed) setError('일부 파일 처리에 실패했습니다. 실패 파일은 문서 목록에서 다시 확인해 주세요.');
    setBusy(false);
  };

  const bulkDecision = async (status: VerificationDecisionStatus) => {
    const targets = pending.filter((item) => selected.has(item.id));
    if (!targets.length) { setError('처리할 검증 후보를 선택해 주세요.'); return; }
    setBusy(true); setError(''); setMessage('');
    let processed = 0;
    for (const candidate of targets) {
      try { await propertyDataRoomService.decideVerificationCandidate(candidate, status); processed += 1; }
      catch (reason) { setError(reason instanceof Error ? reason.message : '일괄 처리 중 오류가 발생했습니다.'); break; }
    }
    await loadBundle();
    setMessage(`${processed}건을 ${status === 'approved' ? '승인' : status === 'held' ? '보류' : '거절'} 처리했습니다.`);
    setBusy(false);
  };

  if (loading) return <div className="center"><CircularProgress /></div>;

  return <main className="data-room-page">
    <header className="data-room-header">
      <div><Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/')}>물건 목록</Button><p className="eyebrow">BULK DATA INTAKE</p><h1>공적자료 일괄 등록 · 검증</h1><p>여러 문서를 한 번에 등록하고 자동 분류·추출한 후보값을 승인합니다.</p></div>
    </header>

    {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
    {message && <Alert severity="success" onClose={() => setMessage('')}>{message}</Alert>}

    <section className="panel" style={{ display: 'grid', gap: 16 }}>
      <TextField select label="대상 물건" value={propertyId} onChange={(event) => setPropertyId(event.target.value)}>
        {properties.map((property) => <MenuItem key={property.id} value={property.id}>{property.name} · {property.address}</MenuItem>)}
      </TextField>
      <Button component="label" variant="contained" startIcon={<CloudUploadRounded />} disabled={busy || !propertyId}>
        {busy ? '처리 중…' : 'PDF / 이미지 여러 파일 등록'}
        <input hidden multiple type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={uploadFiles} />
      </Button>
    </section>

    <section className="panel">
      <h2>등록 문서</h2>
      {documents.length ? <div className="document-list">{documents.map((document) => <article key={document.id}>
        <div><b>{document.title}</b><span>{DOCUMENT_TYPE_LABELS[document.documentType]} · {(document.fileSize / 1024 / 1024).toFixed(2)}MB</span><small>{EXTRACTION_LABELS[document.extractionStatus || 'not_started'] || document.extractionStatus}</small></div>
        <Chip size="small" label={document.extractionStatus === 'scan_ocr_required' ? 'OCR 필요' : document.extractionStatus === 'failed' ? '확인 필요' : '처리됨'} color={document.extractionStatus === 'failed' ? 'error' : document.extractionStatus === 'scan_ocr_required' ? 'warning' : 'default'} />
      </article>)}</div> : <p>등록된 문서가 없습니다.</p>}
    </section>

    <section className="panel">
      <div className="toolbar"><div><h2>검증 후보</h2><p>승인 전에는 Property 원본값이 변경되지 않습니다.</p></div><span className="spacer" /><Button disabled={busy} color="success" onClick={() => bulkDecision('approved')}>선택 승인</Button><Button disabled={busy} onClick={() => bulkDecision('held')}>선택 보류</Button><Button disabled={busy} color="error" onClick={() => bulkDecision('rejected')}>선택 거절</Button></div>
      {pending.length ? <div className="table-wrap"><table className="bulk-table"><thead><tr><th>선택</th><th>항목</th><th>현재값</th><th>후보값</th><th>출처</th><th>상태</th></tr></thead><tbody>{pending.map((candidate) => <tr key={candidate.id}>
        <td><Checkbox checked={selected.has(candidate.id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(candidate.id); else next.delete(candidate.id); return next; })} /></td>
        <td><b>{candidate.fieldKey}</b></td><td>{displayValue(candidate.currentValue)}</td><td>{displayValue(candidate.candidateValue)}</td><td>{candidate.sourceName}<small>{candidate.sourceReference || ''}</small></td><td><Chip size="small" label={candidate.decisionStatus === 'held' ? '보류' : '검토 대기'} /></td>
      </tr>)}</tbody></table></div> : <Alert severity="info">현재 검증 대기 후보가 없습니다.</Alert>}
    </section>
  </main>;
}
