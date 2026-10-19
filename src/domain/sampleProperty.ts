import type { Property } from '../types';

/*
 * Sample/demo records are kept (deep links, QA and the Bangbae media pipeline depend on them) but must never be
 * counted or presented as the operator's real inventory (Issue #9). Only explicit markers are used — never a guess
 * from address or name: the record id prefix `sample-` (e.g. sample-bangbae-815-11, sample-seongsu) or the
 * property number prefix `SAMPLE-` (e.g. SAMPLE-BB-815-11).
 */
export function isSampleProperty(property: Pick<Property, 'id' | 'propertyNumber'>) {
  return /^sample-/i.test(property.id ?? '') || /^SAMPLE-/i.test(property.propertyNumber ?? '');
}

export function splitSampleProperties<T extends Pick<Property, 'id' | 'propertyNumber'>>(items: T[]) {
  const real: T[] = [];
  const samples: T[] = [];
  for (const item of items) (isSampleProperty(item) ? samples : real).push(item);
  return { real, samples };
}
