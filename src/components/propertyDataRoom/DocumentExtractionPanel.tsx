import { useMemo, useState } from 'react';
import { Alert, Button, Chip, TextField } from '@mui/material';
import type { DocumentExtractionStatus, PropertyDocument } from '../../domain/propertyDataRoom/types';
import { documentExtractionService } from '../../services/documentExtractionService';
import { pdfTextExtractionService } from '../../services/pdfTextExtractionService';
import { propertyDataRoomService } from '../../services/propertyDataRoomService';

const EXTRACTION_STATUS_LABELS: Record<DocumentExtractionStatus, string> = {
  not_started: '추출 전',
  text_extracted: '텍스트 추출 완료',
  scan_ocr_required: 'OCR 필요',
  manual_review: '수동 검토',
  failed: '추출 실패',
};

export default function DocumentExtractionPanel({ document, onQueued }: { document: PropertyDocument; onQueued: () => Promise<void> | void }) {
  const fields = useMemo(() => documentExtractionService.fieldsFor(document.documentType), [document.documentType]);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [pageCount, setPageCount] = useState(document.extractionPageCount ?? 0);
  const [scanOnly, setScanOnly] = useState(document.extractionStatus === 'scan_ocr_required');
  const [extractionStatus, setExtractionStatus] = useState<DocumentExtractionStatus>(document.extractionStatus ?? 'not_started');
  const [error, setError] = useState(document.extractionError ?? '');

  if (!fields.length) return null;

  const persistExtraction = async (status: DocumentExtractionStatus, input?: { pageCount?: number; error?: string; method?: 'pdf_text' | 'ocr' | 'manual' }) => {
    await propertyDataRoomService.updateDocumentExtraction(document, { status, pageCount: input?.pageCount, error: input?.error, method: input?.method });
    setExtractionStatus(status);
  };

  const extractPdf = async () => {
    setExtracting(true); setError(''); setScanOnly(false);
    try {
      let source: Blob | undefined = document.fileData;
      if (!source && document.fileUrl) {
        const response = await fetch(document.fileUrl);
        if (!response.ok) throw new Error('저장된 PDF를 불러오지 못했습니다.');
        source = await response.blob();
      }
      if (!source) throw new Error('PDF 원본 파일을 찾을 수 없습니다.');
      const result = await pdfTextExtractionService.extract(source);
      setExtractedText(result.text);
      setPageCount(result.pageCount);
      if (!result.hasTextLayer) {
        setScanOnly(true);
        await persistExtraction('scan_ocr_required', { pageCount: result.pageCount, method: 'pdf_text' });
        return;
      }
      await persistExtraction('text_extracted', { pageCount: result.pageCount, method: 'pdf_text' });
      const prefills = pdfTextExtractionService.prefill(document.documentType, result.text);
      setValues((current) => ({ ...prefills, ...current }));
      if (!Object.keys(prefills).length) setError('PDF 텍스트는 읽었지만 자동으로 식별된 필드가 없습니다. 아래 값은 직접 확인해 입력해 주세요.');
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'PDF 텍스트를 읽지 못했습니다.';
      setError(message);
      try { await persistExtraction('failed', { error: message, method: 'pdf_text' }); } catch { /* 원본 오류를 우선 표시 */ }
    } finally { setExtracting(false); }
  };

  const queue = async () => {
    const extracted = fields
      .map((field) => ({ fieldKey: field.fieldKey, rawValue: values[String(field.fieldKey)] ?? '' }))
      .filter((field) => field.rawValue.trim());
    if (!extracted.length) { setError('후보값을 하나 이상 입력해 주세요.'); return; }
    setBusy(true); setError('');
    try {
      const queued = await documentExtractionService.queueExtractedFields(document, extracted);
      if (!queued) { setError('등록할 후보값이 없습니다.'); return; }
      if (!extractedText) await persistExtraction('manual_review', { pageCount, method: 'manual' });
      setValues({}); setExtractedText(''); setPageCount(0); setScanOnly(false); setOpen(false); await onQueued();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '추출 후보를 등록하지 못했습니다.');
    } finally { setBusy(false); }
  };

  return <div className="document-extraction-panel">
    <Button size="small" onClick={() => setOpen((value) => !value)}>{open ? '후보 입력 닫기' : '추출 후보 입력'}</Button>
    <Chip size="small" label={EXTRACTION_STATUS_LABELS[extractionStatus]} color={extractionStatus === 'text_extracted' ? 'success' : extractionStatus === 'scan_ocr_required' || extractionStatus === 'failed' ? 'warning' : 'default'} />
    {open && <div className="document-extraction-fields">
      <p>후보값은 즉시 Property에 반영되지 않고 자료 검증 Queue로 이동합니다. PDF 텍스트 자동 읽기 결과도 반드시 원문과 비교해 확인하세요.</p>
      {document.mimeType === 'application/pdf' && <div>
        <Button size="small" variant="outlined" disabled={extracting} onClick={extractPdf}>{extracting ? 'PDF 읽는 중…' : 'PDF 텍스트 읽기'}</Button>
        {pageCount > 0 && <small> · {pageCount}페이지</small>}
      </div>}
      {scanOnly && <Alert severity="warning">텍스트 레이어가 없는 스캔 PDF로 확인되었습니다. OCR 처리 대상 상태를 저장했습니다. 현재는 원문을 보면서 아래 값을 직접 입력할 수 있습니다.</Alert>}
      {extractedText && <TextField
        size="small"
        label="PDF 추출 텍스트 미리보기"
        value={extractedText.slice(0, 4000)}
        multiline
        minRows={3}
        maxRows={7}
        slotProps={{ input: { readOnly: true } }}
      />}
      {fields.map((field) => <TextField
        key={String(field.fieldKey)}
        size="small"
        label={field.label}
        value={values[String(field.fieldKey)] ?? ''}
        type={field.valueType === 'date' ? 'date' : 'text'}
        slotProps={field.valueType === 'date' ? { inputLabel: { shrink: true } } : undefined}
        onChange={(event) => setValues((current) => ({ ...current, [String(field.fieldKey)]: event.target.value }))}
      />)}
      {error && <small className="issue-line">{error}</small>}
      <div><Button variant="contained" size="small" disabled={busy} onClick={queue}>{busy ? '등록 중…' : '검증 후보 등록'}</Button></div>
    </div>}
  </div>;
}
