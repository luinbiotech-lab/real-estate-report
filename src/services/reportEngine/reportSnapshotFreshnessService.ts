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

const TIMESTAMP_KEYS = ['updatedAt', 'createdAt', 'uploadedAt', 'verifiedAt', 'decidedAt', 'collectedAt', 'deletedAt'] as const;

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

function collectionCandidates(value: unknown, label: string) {
  if (Array.isArray(value)) return value.flatMap((item) => recordCandidates(item, label));
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
    if (property) candidates.push(...recordCandidates(property, 'Property'));

    for (const [key, value] of Object.entries(legacy)) {
      if (key === 'reportSnapshots') continue;
      candidates.push(...collectionCandidates(value, `Data Room · ${key}`));
    }

    for (const [key, value] of Object.entries(spatial)) {
      candidates.push(...collectionCandidates(value, `Spatial · ${key}`));
    }

    const latest = candidates.sort((left, right) => right.time - left.time)[0];
    const snapshotTime = Date.parse(snapshot.generatedAt);

    return {
      isStale: Boolean(latest && Number.isFinite(snapshotTime) && latest.time > snapshotTime),
      snapshotGeneratedAt: snapshot.generatedAt,
      latestDataAt: latest?.at,
      latestDataLabel: latest?.label,
    };
  },
};
