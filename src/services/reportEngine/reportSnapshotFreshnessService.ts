import type { ReportSnapshot } from '../../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../../repositories/propertyDataRoomRepository';
import { propertyRepository } from '../../repositories/propertyRepository';
import { spatialMediaRepository } from '../../repositories/spatialMediaRepository';

export interface ReportSnapshotFreshness {
  isStale: boolean;
  snapshotGeneratedAt: string;
  latestDataAt?: string;
  latestDataLabel?: string;
}

const TIMESTAMP_KEYS = ['updatedAt', 'createdAt', 'uploadedAt', 'verifiedAt', 'decidedAt', 'reviewedAt', 'collectedAt', 'deletedAt'] as const;

function candidate(value: unknown, label: string) {
  if (typeof value !== 'string' || !value) return undefined;
  const time = Date.parse(value);
  return Number.isFinite(time) ? { time, at: new Date(time).toISOString(), label } : undefined;
}

function recordCandidates(value: unknown, label: string) {
  if (!value || typeof value !== 'object') return [] as Array<{ time: number; at: string; label: string }>;
  const row = value as Record<string, unknown>;
  return TIMESTAMP_KEYS
    .map((key) => candidate(row[key], label))
    .filter((item): item is { time: number; at: string; label: string } => Boolean(item));
}

// Ignore foreign Property rows even if a repository returns a stale/mixed bundle.
// This prevents cross-Property false-stale signals without treating foreign data as evidence.
function collectionCandidates(value: unknown, label: string, propertyId: string) {
  if (Array.isArray(value)) return value
    .filter((item) => item && typeof item === 'object' && item.propertyId === propertyId)
    .flatMap((item) => recordCandidates(item, label));
  if (!value || typeof value !== 'object' || (value as { propertyId?: unknown }).propertyId !== propertyId) return [];
  return recordCandidates(value, label);
}

export const reportSnapshotFreshnessService = {
  async evaluate(snapshot: ReportSnapshot): Promise<ReportSnapshotFreshness> {
    const [property, legacy, spatial] = await Promise.all([
      propertyRepository.getById(snapshot.propertyId),
      propertyDataRoomRepository.getBundle(snapshot.propertyId),
      spatialMediaRepository.getBundle(snapshot.propertyId),
    ]);

    const candidates: Array<{ time: number; at: string; label: string }> = [];
    const matchingProperty = property?.id === snapshot.propertyId;
    if (matchingProperty) candidates.push(...recordCandidates(property, 'Property'));

    for (const [key, value] of Object.entries(legacy)) {
      if (key === 'reportSnapshots') continue;
      candidates.push(...collectionCandidates(value, `Data Room · ${key}`, snapshot.propertyId));
    }

    for (const [key, value] of Object.entries(spatial)) {
      candidates.push(...collectionCandidates(value, `Spatial · ${key}`, snapshot.propertyId));
    }

    const latest = candidates.sort((left, right) => right.time - left.time)[0];
    const snapshotTime = Date.parse(snapshot.generatedAt);
    // Missing/mismatched property and invalid/future-dated generation times must fail closed.
    // Otherwise a forged timestamp could bypass the final Snapshot freshness gate.
    const invalidSnapshotTime = !Number.isFinite(snapshotTime) || snapshotTime > Date.now() + 5 * 60 * 1000;

    return {
      isStale: !matchingProperty || invalidSnapshotTime || Boolean(latest && latest.time > snapshotTime),
      snapshotGeneratedAt: snapshot.generatedAt,
      latestDataAt: latest?.at,
      latestDataLabel: latest?.label,
    };
  },
};
