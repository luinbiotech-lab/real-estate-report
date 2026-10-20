import type { Property, PropertyRecordClass } from '../types';
import { BANGBAE_815_11_LEGACY_LOCAL_PROPERTY_ID } from './propertyDataRoom/bangbaeIdentity';

/*
 * Record provenance classification (Issue #9 / #12, ChatGPT review of PR #14).
 *
 * Sample/QA records are kept — deep links, QA and the Bangbae media pipeline depend on them — but must never be counted
 * or presented as the operator's real inventory. Order of evidence:
 *   1. explicit metadata `recordClass` (also lets the owner promote a legacy-marked record to operational),
 *   2. legacy markers for records written before the field existed (no data migration required):
 *      id prefix `sample-`, property number prefix `SAMPLE-`, or a known local bootstrap seed id.
 * Nothing is inferred from address or name.
 */
export const PROPERTY_RECORD_CLASSES: readonly PropertyRecordClass[] = ['operational', 'sample', 'qa_fixture'];

/** Records created by localBootstrapService in local/QA builds before `recordClass` existed. */
export const LOCAL_BOOTSTRAP_SEED_IDS: readonly string[] = ['sample-seongsu', BANGBAE_815_11_LEGACY_LOCAL_PROPERTY_ID];

export type RecordClassBasis = 'explicit' | 'legacy-id-prefix' | 'legacy-number-prefix' | 'local-bootstrap-seed' | 'default';

export interface RecordClassification {
  recordClass: PropertyRecordClass;
  basis: RecordClassBasis;
  /** Set when recordClass held a value outside PROPERTY_RECORD_CLASSES; the record is then classified by legacy rules. */
  invalidExplicitValue?: string;
}

type Classifiable = Pick<Property, 'id' | 'propertyNumber'> & Partial<Pick<Property, 'recordClass'>>;

export function classifyPropertyRecord(property: Classifiable): RecordClassification {
  const explicit = property.recordClass as string | undefined;
  let invalidExplicitValue: string | undefined;
  if (explicit !== undefined && explicit !== '') {
    if ((PROPERTY_RECORD_CLASSES as readonly string[]).includes(explicit)) return { recordClass: explicit as PropertyRecordClass, basis: 'explicit' };
    invalidExplicitValue = explicit;
  }
  const withInvalid = (result: RecordClassification): RecordClassification => (invalidExplicitValue ? { ...result, invalidExplicitValue } : result);
  if (/^sample-/i.test(property.id ?? '')) return withInvalid({ recordClass: 'sample', basis: 'legacy-id-prefix' });
  if (/^SAMPLE-/i.test(property.propertyNumber ?? '')) return withInvalid({ recordClass: 'sample', basis: 'legacy-number-prefix' });
  if (LOCAL_BOOTSTRAP_SEED_IDS.includes(property.id)) return withInvalid({ recordClass: 'sample', basis: 'local-bootstrap-seed' });
  return withInvalid({ recordClass: 'operational', basis: 'default' });
}

export function isSampleProperty(property: Classifiable) {
  return classifyPropertyRecord(property).recordClass !== 'operational';
}

export const RECORD_CLASS_LABEL: Record<PropertyRecordClass, string> = {
  operational: '운영 물건',
  sample: '샘플',
  qa_fixture: '테스트 자료',
};

export const RECORD_CLASS_BASIS_LABEL: Record<RecordClassBasis, string> = {
  explicit: '레코드에 지정된 분류',
  'legacy-id-prefix': '기존 ID 표식(sample-)',
  'legacy-number-prefix': '기존 물건번호 표식(SAMPLE-)',
  'local-bootstrap-seed': '로컬 기본 시연 자료',
  default: '표식 없음 — 운영 물건으로 간주',
};

export function splitSampleProperties<T extends Classifiable>(items: T[]) {
  const real: T[] = [];
  const samples: T[] = [];
  for (const item of items) (isSampleProperty(item) ? samples : real).push(item);
  return { real, samples };
}
