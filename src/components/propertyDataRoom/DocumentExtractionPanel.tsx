import { useMemo, useState } from 'react';
import { Button, TextField } from '@mui/material';
import type { PropertyDocument } from '../../domain/propertyDataRoom/types';
import { documentExtractionService } from '../../services/documentExtractionService';

export default function DocumentExtractionPanel({ document, onQueued }: { document: PropertyDocument; onQueued: () => Promise<void> | void }) {
  const fields = useMemo(() => documentExtractionService.fieldsFor(document.documentType), [document.documentType]);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!fields.length) return null;

  const queue = async () => {
    const extracted = fields
      .map((field) => ({ fieldKey: field.fieldKey, rawValue: values[String(field.fieldKey)] ?? '' }))
      .filter((field) => field.rawValue.trim());
    if (!extracted.length) { setError('후보값을 하나 이상 입력해 주세요.'); return; }
    setBusy(true); setError('');
    try {
      const queued = await documentExtractionService.queueExtractedFields(document, extracted);
      if (!queued) { setError('등록할 후보값이 없습니다.'); return; }
      setValues({}); setOpen(false); await onQueued();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '추출 후보를 등록하지 못했습니다.');
    } finally { setBusy(false); }
  };

  return <div className="document-extraction-panel">
    <Button size="small" onClick={() => setOpen((value) => !value)}>{open ? '후보 입력 닫기' : '추출 후보 입력'}</Button>
    {open && <div className="document-extraction-fields">
      <p>문서에서 확인한 값만 입력하세요. 입력값은 즉시 Property에 반영되지 않고 자료 검증 Queue로 이동합니다.</p>
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
