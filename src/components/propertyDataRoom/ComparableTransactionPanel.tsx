import { useMemo, useState } from 'react';
import { Alert, Button, Chip, MenuItem, TextField } from '@mui/material';
import type { PropertyDataSource, VerificationStatus } from '../../domain/propertyDataRoom/types';
import { comparableTransactionService, type ComparableTransactionInput } from '../../services/comparableTransactionService';

const statusOptions: Array<Extract<VerificationStatus, 'verified' | 'confirmed' | 'imported' | 'unverified'>> = ['verified', 'confirmed', 'imported', 'unverified'];

const example = [
  '방배동 811-20\t4500000000\t56.29\t79050000\t1986\t2025-11-25',
  '방배동 2112\t5100000000\t59.89\t85160000\t1989\t2025-10-24',
].join('\n');

function normalizeNumber(value: string) {
  return Number(value.replace(/[\s,원]/g, ''));
}

function parseRows(text: string): ComparableTransactionInput[] {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const columns = line.split(/\t|\s*\|\s*|\s*,\s*/).map((value) => value.trim());
    if (columns.length < 6) throw new Error(`${index + 1}행: 명칭, 거래가, 대지평, 토지평당, 승인연도, 거래일 6개 항목이 필요합니다.`);
    const [label, salePriceRaw, landAreaRaw, unitPriceRaw, approvalYearRaw, tradeDate, ...addressParts] = columns;
    const salePrice = normalizeNumber(salePriceRaw);
    const landAreaPyeong = normalizeNumber(landAreaRaw);
    const landUnitPrice = normalizeNumber(unitPriceRaw);
    const approvalYear = approvalYearRaw ? Number(approvalYearRaw) : undefined;
    return {
      label,
      salePrice,
      landAreaPyeong,
      landUnitPrice,
      approvalYear: Number.isFinite(approvalYear) ? approvalYear : undefined,
      tradeDate,
      address: addressParts.join(', ') || undefined,
    };
  });
}

function rowsFromSource(source?: PropertyDataSource) {
  const rows = source?.metadata?.rows;
  if (!Array.isArray(rows)) return '';
  return rows.map((row) => {
    if (!row || typeof row !== 'object') return '';
    const item = row as Record<string, unknown>;
    return [item.label, item.salePrice, item.landAreaPyeong, item.landUnitPrice, item.approvalYear ?? '', item.tradeDate, item.address ?? ''].join('\t');
  }).filter(Boolean).join('\n');
}

export default function ComparableTransactionPanel({ propertyId, sources, onSaved }: {
  propertyId: string;
  sources: PropertyDataSource[];
  onSaved: () => Promise<void> | void;
}) {
  const existing = useMemo(() => sources.find((source) => source.resourceType === 'comparable_transaction_set' && source.fieldKey === 'nearbyTransactions'), [sources]);
  const [text, setText] = useState(() => rowsFromSource(existing));
  const [sourceName, setSourceName] = useState(existing?.sourceName || '비교거래 원본자료');
  const [sourceReference, setSourceReference] = useState(existing?.sourceReference || '');
  const [sourceDate, setSourceDate] = useState(existing?.sourceDate || '');
  const [verificationStatus, setVerificationStatus] = useState<Extract<VerificationStatus, 'verified' | 'confirmed' | 'imported' | 'unverified'>>(
    existing && statusOptions.includes(existing.verificationStatus as typeof statusOptions[number])
      ? existing.verificationStatus as typeof statusOptions[number]
      : 'unverified',
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const parsedCount = useMemo(() => {
    try { return text.trim() ? parseRows(text).length : 0; } catch { return 0; }
  }, [text]);

  const save = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const rows = parseRows(text);
      await comparableTransactionService.replace(propertyId, rows, {
        sourceName: sourceName.trim() || '비교거래 원본자료',
        sourceReference: sourceReference.trim() || undefined,
        sourceDate: sourceDate || undefined,
        verificationStatus,
      });
      setMessage(`비교거래 ${rows.length}건을 DataSource / Verification / Report 데이터로 연결했습니다.`);
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '비교거래를 저장하지 못했습니다.');
    } finally { setBusy(false); }
  };

  return <div className="market-data-panel">
    <div className="document-toolbar">
      <div><h2>비교거래 데이터</h2><p>거래사례를 구조화해 DataSource와 Verification 이력을 보존하고 Professional Report에 연결합니다.</p></div>
      <Chip label={`${parsedCount}건`} size="small" color={parsedCount ? 'primary' : 'default'} />
    </div>
    {message && <Alert severity="success">{message}</Alert>}
    {error && <Alert severity="error">{error}</Alert>}
    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 180px 180px', gap: 12, marginBottom: 12 }}>
      <TextField size="small" label="출처명" value={sourceName} onChange={(event) => setSourceName(event.target.value)} />
      <TextField size="small" label="출처 참조" value={sourceReference} onChange={(event) => setSourceReference(event.target.value)} placeholder="파일명 / URL / 문서 ID" />
      <TextField size="small" type="date" label="자료 기준일" value={sourceDate} onChange={(event) => setSourceDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField select size="small" label="검증 상태" value={verificationStatus} onChange={(event) => setVerificationStatus(event.target.value as typeof verificationStatus)}>{statusOptions.map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}</TextField>
    </div>
    <TextField
      fullWidth
      multiline
      minRows={9}
      maxRows={18}
      label="거래사례 붙여넣기"
      value={text}
      onChange={(event) => setText(event.target.value)}
      placeholder={example}
      helperText="한 행: 명칭 | 거래가(원) | 대지면적(평) | 토지평당가(원) | 승인연도 | 거래일(YYYY-MM-DD) | 주소(선택). 탭/파이프/쉼표 구분 지원."
    />
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><Button variant="contained" disabled={busy || !text.trim()} onClick={save}>{busy ? '저장 중…' : '비교거래 저장 및 보고서 연결'}</Button></div>
  </div>;
}
