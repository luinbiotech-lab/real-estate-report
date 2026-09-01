import type { PropertyDataSource, PropertyVerification, VerificationStatus } from '../propertyDataRoom/types';
import type { ReportValue, ReportValueState } from './types';

export const REPORT_VALUE_LABELS: Record<ReportValueState, string> = {
  actual: '실제 값', missing: '데이터 없음', disconnected: '데이터 미연결', estimated: '추정값',
  calculated: '계산값', ai_analysis: 'AI 분석', unverified: '미확인',
};

export interface ValueContext {
  fieldKey: string;
  verifications: PropertyVerification[];
  sources: PropertyDataSource[];
  disconnected?: boolean;
  calculated?: boolean;
  formatter?: (value: never) => string;
}

const toState = (status?: VerificationStatus, calculated?: boolean): ReportValueState => {
  if (calculated || status === 'calculated') return 'calculated';
  if (status === 'estimated') return 'estimated';
  if (status === 'ai_analysis') return 'ai_analysis';
  if (status === 'unverified') return 'unverified';
  return 'actual';
};

function contextFor(fieldKey: string, verifications: PropertyVerification[], sources: PropertyDataSource[]) {
  const verification = [...verifications].reverse().find((item) => item.fieldKey === fieldKey);
  const relatedSources = sources.filter((item) => item.fieldKey === fieldKey || item.resourceType === fieldKey);
  const sourceStatus = relatedSources.at(-1)?.verificationStatus;
  return { verificationStatus: verification?.status ?? sourceStatus, sourceIds: relatedSources.map((item) => item.id) };
}

export function reportValue<T>(value: T | null | undefined, context: ValueContext): ReportValue<T> {
  const { verificationStatus, sourceIds } = contextFor(context.fieldKey, context.verifications, context.sources);
  const absent = value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
  if (absent) return { value: null, display: context.disconnected ? REPORT_VALUE_LABELS.disconnected : REPORT_VALUE_LABELS.missing, state: context.disconnected ? 'disconnected' : 'missing', verificationStatus, sourceIds };
  const state = toState(verificationStatus, context.calculated);
  const formatter = context.formatter as ((input: T) => string) | undefined;
  return { value, display: formatter ? formatter(value) : String(value), state, verificationStatus, sourceIds };
}

export function numericReportValue(value: number | null | undefined, context: ValueContext): ReportValue<number> {
  const { verificationStatus } = contextFor(context.fieldKey, context.verifications, context.sources);
  const explicitlyConfirmedZero = value === 0 && verificationStatus && !['missing', 'unverified'].includes(verificationStatus);
  return reportValue(value && Number.isFinite(value) ? value : explicitlyConfirmedZero ? 0 : null, context);
}
