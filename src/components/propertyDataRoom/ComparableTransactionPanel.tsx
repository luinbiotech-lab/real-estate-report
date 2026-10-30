import { useMemo, useState } from 'react';
import { Alert, Button, Chip, MenuItem, TextField } from '@mui/material';
import type { PropertyDataSource, VerificationStatus } from '../../domain/propertyDataRoom/types';
import { comparableTransactionService, type ComparableTransactionInput } from '../../services/comparableTransactionService';
import { VERIFICATION_LABELS } from '../../domain/propertyDataRoom/labels';

const statusOptions: Array<Extract<VerificationStatus, 'confirmed' | 'imported' | 'unverified'>> = ['confirmed', 'imported', 'unverified'];

const example = [
  '방배동 811-20\t4500000000\t56.29\t79050000\t1986\t2025-11-25\t서울 서초구 방배동\t11\t방배동 811-20',
  '방배동 2112\t5100000000\t59.89\t85160000\t1989\t2025-10-24\t서울 서초구 방배동\t10\t방배동 2112',
].join('\n');

function normalizeNumber(value: string) {
  return Number(value.replace(/[\s,원]/g, ''));
}

function parseRows(text: string): ComparableTransactionInput[] {
  return text.split(/\r?\n/).filter((line) => line.trim().length > 0).map((line, index) => {
    // Tab/pipe rows support explicit source locators. Legacy comma-separated
    // rows keep their remaining columns as address (never infer a locator).
    const structured = line.includes('\t') || line.includes('|');
    const columns = (line.includes('\t') ? line.split('\t') :
      line.includes('|') ? line.split(/\s*\|\s*/) : line.split(/\s*,\s*/))
      .map((value) => value.trim());
    if (columns.length < 6) throw new Error(`${index + 1}행: 명칭, 거래가, 대지평, 토지평당, 승인연도, 거래일 6개 항목이 필요합니다.`);
    if (structured && ![6, 7, 9].includes(columns.length)) {
      throw new Error(`${index + 1}행: 원문 위치는 주소 다음에 행번호와 원문 기록명을 함께 입력해야 합니다 (총 9개 항목).`);
    }
    const [label, salePriceRaw, landAreaRaw, unitPriceRaw, approvalYearRaw, tradeDate] = columns;
    const salePrice = normalizeNumber(salePriceRaw);
    const landAreaPyeong = normalizeNumber(landAreaRaw);
    const landUnitPrice = normalizeNumber(unitPriceRaw);
    const approvalYear = approvalYearRaw ? Number(approvalYearRaw) : undefined;
    const address = structured ? columns[6] : columns.slice(6).join(', ');
    const sourceRowRaw = structured && columns.length === 9 ? columns[7] : '';
    const sourceRecordLabelRaw = structured && columns.length === 9 ? columns[8] : '';
    const sourceRow = sourceRowRaw ? Number(sourceRowRaw) : undefined;
    if (sourceRowRaw && (!Number.isSafeInteger(sourceRow) || sourceRow === undefined || sourceRow <= 0)) {
      throw new Error(`${index + 1}행: 원문 행번호는 1 이상의 정수여야 합니다.`);
    }
    if (Boolean(sourceRowRaw) !== Boolean(sourceRecordLabelRaw)) {
      throw new Error(`${index + 1}행: 원문 행번호와 원문 기록명을 모두 입력하거나 모두 비워 두세요.`);
    }
    return {
      label, salePrice, landAreaPyeong, landUnitPrice,
      approvalYear: Number.isFinite(approvalYear) ? approvalYear : undefined,
      tradeDate, address: address || undefined,
      sourceRow, sourceRecordLabel: sourceRecordLabelRaw || undefined,
    };
  });
}

function rowsFromSource(source?: PropertyDataSource) {
  const rows = source?.metadata?.rows;
  if (!Array.isArray(rows)) return '';
  return rows.map((row) => {
    if (!row || typeof row !== 'object') return '';
    const item = row as Record<string, unknown>;
    return [item.label, item.salePrice, item.landAreaPyeong, item.landUnitPrice, item.approvalYear ?? '', item.tradeDate, item.address ?? '', item.sourceRow ?? '', item.sourceRecordLabel ?? ''].join('\t');
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
  const [verificationStatus, setVerificationStatus] = useState<Extract<VerificationStatus, 'confirmed' | 'imported' | 'unverified'>>(
    existing && statusOptions.includes(existing.verificationStatus as typeof statusOptions[number])
      ? existing.verificationStatus as typeof statusOptions[number]
      : 'unverified',
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Show the parse problem while typing; previously it was swallowed and the count silently read "0건".
  const { parsedRows, parseError } = useMemo(() => {
    try { return { parsedRows: text.trim() ? parseRows(text) : [], parseError: '' }; }
    catch (reason) { return { parsedRows: [] as ComparableTransactionInput[], parseError: reason instanceof Error ? reason.message : '입력 형식을 확인해 주세요.' }; }
  }, [text]);
  const parsedCount = parsedRows.length;
  const missingProvenance = parsedRows.filter((row) => !row.sourceRow || !row.sourceRecordLabel).length;

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
      const pending = rows.filter((row) => !row.sourceRow || !row.sourceRecordLabel).length;
      setMessage(`비교거래 ${rows.length}건을 DataSource / Verification / Report 데이터로 연결했습니다.${pending ? ` 원문 위치 미입력 ${pending}건은 보고서 확정이 차단됩니다.` : ''}`);
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
    {parseError && !error && <Alert severity="warning" role="status">입력 형식 오류: {parseError}</Alert>}
    {existing?.verificationStatus === 'verified' && <Alert severity="warning" sx={{ mb: 2 }}>
      기존 비교거래 검증은 수정·재저장 시 재검토가 필요합니다. 이 화면에서는 공식 검증 완료를 지정할 수 없으며, 저장 후 별도 검증 이력을 확인해야 합니다.
    </Alert>}
    {missingProvenance > 0 && <Alert severity="warning" sx={{ mb: 2 }}>
      원문 행번호·기록명 미입력 {missingProvenance}건. 저장은 가능하지만 원문 대조 전에는 전문 보고서를 확정할 수 없습니다.
    </Alert>}
    <div className="comparable-source-fields">
      <TextField size="small" label="출처명" value={sourceName} onChange={(event) => setSourceName(event.target.value)} />
      <TextField size="small" label="출처 참조" value={sourceReference} onChange={(event) => setSourceReference(event.target.value)} placeholder="파일명 / URL / 문서 ID" />
      <TextField size="small" type="date" label="자료 기준일" value={sourceDate} onChange={(event) => setSourceDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField select size="small" label="검증 상태" value={verificationStatus} onChange={(event) => setVerificationStatus(event.target.value as typeof verificationStatus)}>{statusOptions.map((status) => <MenuItem key={status} value={status}>{VERIFICATION_LABELS[status]}</MenuItem>)}</TextField>
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
      helperText="한 행: 명칭 | 거래가(원) | 대지면적(평) | 토지평당가(원) | 승인연도 | 거래일(YYYY-MM-DD) | 주소 | 원문 행번호 | 원문 기록명. 원문 위치는 탭/파이프 구분 9열로 입력하세요. 기존 6~7열·쉼표 입력도 가능하지만 최종 확정 전 출처 보완이 필요합니다."
    />
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><Button variant="contained" disabled={busy || !text.trim() || Boolean(parseError)} onClick={save}>{busy ? '저장 중…' : '비교거래 저장 및 보고서 연결'}</Button></div>
  </div>;
}
