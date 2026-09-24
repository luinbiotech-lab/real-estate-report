import type { VerificationStatus } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { propertyRepository } from '../repositories/propertyRepository';
import { formatWon } from '../utils/format';

export interface ComparableTransactionInput {
  label: string;
  address?: string;
  sourceRow?: number;
  sourceRecordLabel?: string;
  salePrice: number;
  landAreaPyeong: number;
  landUnitPrice: number;
  approvalYear?: number;
  tradeDate: string;
}

export interface ComparableTransactionSource {
  sourceName: string;
  sourceReference?: string;
  sourceDate?: string;
  collectedAt?: string;
  verificationStatus: Extract<VerificationStatus, 'verified' | 'confirmed' | 'imported' | 'unverified'>;
}

export type ComparableArithmeticReviewStatus = 'consistent' | 'review_required';

export interface ComparableTransactionStoredRow extends ComparableTransactionInput {
  sourceLandUnitPrice: number;
  derivedLandUnitPrice: number;
  landUnitPriceVariancePct: number;
  arithmeticReviewStatus: ComparableArithmeticReviewStatus;
  sourceValueSemantics: 'source_reported';
}

export const COMPARABLE_ARITHMETIC_TOLERANCE_PCT = 0.5;
export const COMPARABLE_ARITHMETIC_VERSION = 'source-land-unit-v1';

function roundVariance(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function enrichComparableArithmetic(row: ComparableTransactionInput): ComparableTransactionStoredRow {
  const derivedLandUnitPrice = Math.round(row.salePrice / row.landAreaPyeong);
  const landUnitPriceVariancePct = roundVariance(((row.landUnitPrice - derivedLandUnitPrice) / derivedLandUnitPrice) * 100);
  return {
    ...row,
    sourceLandUnitPrice: row.landUnitPrice,
    derivedLandUnitPrice,
    landUnitPriceVariancePct,
    arithmeticReviewStatus: Math.abs(landUnitPriceVariancePct) > COMPARABLE_ARITHMETIC_TOLERANCE_PCT ? 'review_required' : 'consistent',
    sourceValueSemantics: 'source_reported',
  };
}

function formatComparable(row: ComparableTransactionInput) {
  const approval = row.approvalYear ? ` · 승인 ${row.approvalYear}` : '';
  return `${row.label} | ${formatWon(row.salePrice)} | 대지 ${row.landAreaPyeong.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}평 | 토지평당 ${formatWon(row.landUnitPrice)}${approval} · 거래일 ${row.tradeDate}`;
}

function validateRow(row: ComparableTransactionInput) {
  if (!row.label.trim()) throw new Error('비교거래 명칭이 비어 있습니다.');
  if (!Number.isFinite(row.salePrice) || row.salePrice <= 0) throw new Error(`${row.label}: 거래금액이 올바르지 않습니다.`);
  if (!Number.isFinite(row.landAreaPyeong) || row.landAreaPyeong <= 0) throw new Error(`${row.label}: 대지면적이 올바르지 않습니다.`);
  if (!Number.isFinite(row.landUnitPrice) || row.landUnitPrice <= 0) throw new Error(`${row.label}: 토지 평당가가 올바르지 않습니다.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.tradeDate)) throw new Error(`${row.label}: 거래일은 YYYY-MM-DD 형식이어야 합니다.`);
}

export const comparableTransactionService = {
  async replace(propertyId: string, rows: ComparableTransactionInput[], source: ComparableTransactionSource) {
    if (!rows.length) throw new Error('비교거래를 1건 이상 입력해 주세요.');
    rows.forEach(validateRow);
    const property = await propertyRepository.getById(propertyId);
    if (!property) throw new Error('비교거래를 연결할 물건을 찾을 수 없습니다.');

    const now = new Date().toISOString();
    const sourceId = `market-comparables:${propertyId}`;
    const verificationId = `verification:market-comparables:${propertyId}`;
    const existingSources = await propertyDataRoomRepository.getDataSources(propertyId);
    const existingVerifications = await propertyDataRoomRepository.getVerifications(propertyId);
    const storedRows = rows.map(enrichComparableArithmetic);
    const arithmeticReviewRequired = storedRows.filter((row) => row.arithmeticReviewStatus === 'review_required');
    const provenanceComplete = storedRows.filter((row) =>
      Number.isInteger(row.sourceRow) && Number(row.sourceRow) > 0 && Boolean(row.sourceRecordLabel?.trim())
    );
    const provenanceMissing = storedRows.filter((row) => !provenanceComplete.includes(row));
    const summary = storedRows.map(formatComparable).join('\n');

    await propertyDataRoomRepository.saveDataSource({
      id: sourceId,
      propertyId,
      fieldKey: 'nearbyTransactions',
      resourceType: 'comparable_transaction_set',
      sourceType: 'market_data',
      sourceName: source.sourceName,
      sourceReference: source.sourceReference,
      collectedAt: source.collectedAt ?? now,
      sourceDate: source.sourceDate,
      verificationStatus: source.verificationStatus,
      metadata: {
        rows: storedRows.map((row) => ({ ...row })),
        count: storedRows.length,
        provenance: {
          status: provenanceMissing.length === 0 ? 'complete' : 'review_required',
          completeCount: provenanceComplete.length,
          missingCount: provenanceMissing.length,
          missingLabels: provenanceMissing.map((row) => row.label),
          rowLocator: 'sourceRow',
          recordLocator: 'sourceRecordLabel',
        },
        arithmetic: {
          version: COMPARABLE_ARITHMETIC_VERSION,
          tolerancePct: COMPARABLE_ARITHMETIC_TOLERANCE_PCT,
          sourceValueSemantics: 'source_reported',
          consistentCount: storedRows.length - arithmeticReviewRequired.length,
          reviewRequiredCount: arithmeticReviewRequired.length,
          reviewRequiredLabels: arithmeticReviewRequired.map((row) => row.label),
        },
      },
      createdAt: existingSources.find((item) => item.id === sourceId)?.createdAt ?? now,
    });

    await propertyDataRoomRepository.saveVerification({
      id: verificationId,
      propertyId,
      fieldKey: 'nearbyTransactions',
      status: source.verificationStatus,
      note: `${source.sourceName} 비교거래 ${storedRows.length}건 원문 전사 검증 · row provenance ${provenanceComplete.length}/${storedRows.length} · 원문 평당가 보존 · 산술 차이 검토 ${arithmeticReviewRequired.length}건`,
      verifiedAt: source.verificationStatus === 'verified' || source.verificationStatus === 'confirmed' ? now : undefined,
      createdAt: existingVerifications.find((item) => item.id === verificationId)?.createdAt ?? now,
      updatedAt: now,
    });

    const updated = {
      ...property,
      nearbyTransactions: summary,
      updatedAt: now,
    };
    await propertyRepository.update(updated);
    return { property: updated, rows: storedRows, sourceId, verificationId, arithmeticReviewRequired, provenanceComplete, provenanceMissing };
  },
};
