import type { DataRoomBundle } from '../../domain/propertyDataRoom/types';

// A market DataSource is not report-grade merely because its rows are connected.
// Preserve source-reported prices, but block finalization while row provenance
// or arithmetic discrepancies remain unresolved. This does not alter the MASTER.
export function assessReportComparableReadiness(bundle: Pick<DataRoomBundle, 'dataSources'>): { ready: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const sources = bundle.dataSources.filter((source) =>
    source.resourceType === 'comparable_transaction_set' && source.fieldKey === 'nearbyTransactions');
  for (const source of sources) {
    const rows = source.metadata?.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      reasons.push(`${source.id}: 비교거래 원문 행 누락`);
      continue;
    }
    rows.forEach((entry, index) => {
      const row = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
      const label = typeof row.label === 'string' && row.label.trim() ? row.label.trim() : `행 ${index + 1}`;
      const price = row.salePrice;
      const area = row.landAreaPyeong;
      const unit = row.landUnitPrice;
      const validNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
      const rowLocatorValid = typeof row.sourceRow === 'number' && Number.isSafeInteger(row.sourceRow) && row.sourceRow > 0 &&
        typeof row.sourceRecordLabel === 'string' && row.sourceRecordLabel.trim().length > 0;
      if (!rowLocatorValid) reasons.push(`${source.id}/${label}: 원문 행번호·기록명 미확인`);
      if (!validNumber(price) || !validNumber(area) || !validNumber(unit)) {
        reasons.push(`${source.id}/${label}: 거래금액·대지면적·평당가 오류`);
        return;
      }
      const calculatedUnit = price / area;
      const variancePct = Math.abs((unit - calculatedUnit) / calculatedUnit) * 100;
      if (!Number.isFinite(variancePct) || variancePct > 0.5 || row.arithmeticReviewStatus === 'review_required') {
        reasons.push(`${source.id}/${label}: 원문 평당가 산술 불일치(검토 필요)`);
      }
      const date = row.tradeDate;
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
          new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
        reasons.push(`${source.id}/${label}: 거래일 유효성 오류`);
      }
    });
  }
  return { ready: reasons.length === 0, reasons };
}
