/*
 * Trust grade + public facts for one or many properties (2026-11-15 platform upgrade).
 * Reads the Data Room only; writes nothing. A property whose Data Room fails to load gets no grade (shown as
 * '등급 확인 불가'), never a guessed one.
 */
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { propertyDataRoomService } from './propertyDataRoomService';
import { trustGrade, type TrustGradeResult } from '../domain/platform/trustGrade';
import type { Property } from '../types';
import { factCompleteness, publicFacts } from '../domain/platform/publicListing';
import { dueDiligenceRows, factEvidence, type DueDiligenceRow, type FactEvidence } from '../domain/platform/evidenceLedger';
import { marketPosition, type MarketPosition } from '../domain/propertyDetail/marketPosition';
import { assessRequiredDocumentReadiness, scopeDataRoomBundle } from './propertyReadinessService';
import { DOCUMENT_TYPE_LABELS, REQUIRED_DOCUMENT_TYPES } from '../domain/propertyDataRoom/labels';

export interface ListingTrust {
  propertyId: string;
  grade: TrustGradeResult;
  verifiedFieldKeys: Set<string>;
}

export async function loadListingTrust(property: Property): Promise<ListingTrust> {
  const bundle = await propertyDataRoomRepository.getBundle(property.id);
  const summary = propertyDataRoomService.summarize(property, bundle);
  const facts = factCompleteness(property);
  const verifiedFieldKeys = new Set(bundle.verifications
    .filter((row) => row.propertyId === property.id && row.status === 'verified')
    .map((row) => row.fieldKey));
  return {
    propertyId: property.id,
    verifiedFieldKeys,
    grade: trustGrade({
      factsFilled: facts.filled,
      factsTotal: facts.total,
      requiredSourcePresent: summary.requiredSourcePresent,
      requiredOfficiallyVerified: summary.requiredOfficiallyVerified,
      requiredDocumentTotal: summary.requiredDocumentTotal,
      verificationPending: summary.verificationPending,
    }),
  };
}

/** Grades for a list (bounded). Failures are left out of the map, so callers show '확인 불가' for them. */
export async function loadListingTrustMany(properties: Property[], limit = 200): Promise<Map<string, ListingTrust>> {
  const settled = await Promise.allSettled(properties.slice(0, limit).map(loadListingTrust));
  const map = new Map<string, ListingTrust>();
  for (const result of settled) if (result.status === 'fulfilled') map.set(result.value.propertyId, result.value);
  return map;
}

/** Everything the public listing page shows beyond the grade: evidence per value, buyer checklist, price position, report. */
export interface ListingDetail extends ListingTrust {
  evidence: Map<string, FactEvidence>;
  checklist: DueDiligenceRow[];
  market: MarketPosition;
  /** Latest confirmed (ready) report snapshot, if any. Drafts are never offered to buyers. */
  readyReport?: { version: number; generatedAt: string };
}

export async function loadListingDetail(property: Property): Promise<ListingDetail> {
  const bundle = scopeDataRoomBundle(await propertyDataRoomRepository.getBundle(property.id), property.id);
  const trust = await loadListingTrust(property);
  const required = assessRequiredDocumentReadiness(bundle, property.id);
  const facts = publicFacts(property, trust.verifiedFieldKeys);
  const evidence = new Map<string, FactEvidence>();
  for (const fact of facts.shown) {
    const row = factEvidence(fact.key, property.id, bundle.verifications, bundle.dataSources);
    if (row) evidence.set(fact.key, row);
  }
  const risk = [...(bundle.riskAssessments ?? [])].filter((row) => !row.deletedAt).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  const checklist = dueDiligenceRows({
    documents: REQUIRED_DOCUMENT_TYPES.map((type) => ({ type, label: DOCUMENT_TYPE_LABELS[type] })),
    present: required.present,
    verified: required.verified,
    pendingCandidates: (bundle.verificationCandidates ?? []).filter((row) => row.decisionStatus === 'pending' || row.decisionStatus === 'held').length,
    pendingFacts: facts.pending,
    risk: risk ? { checks: risk.checks, personConfirmed: risk.verificationStatus === 'verified' || risk.verificationStatus === 'confirmed' } : undefined,
  });
  const ready = bundle.reportSnapshots.filter((row) => row.status === 'ready').sort((a, b) => b.reportVersion - a.reportVersion)[0];
  return {
    ...trust,
    evidence,
    checklist,
    market: marketPosition(property, bundle.dataSources),
    readyReport: ready ? { version: ready.reportVersion, generatedAt: String(ready.generatedAt).slice(0, 10) } : undefined,
  };
}
