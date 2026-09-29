import type { BuildingReleaseSnapshot } from './buildingReleaseSnapshotService';

type FloorStats = { wallCount: number; openingSubtractionCount: number; slabCount: number; slabCoreSubtractionCount: number; junctionUnionCount: number };

function statsOf(snapshot: BuildingReleaseSnapshot) {
  const map = new Map<string, FloorStats>();
  for (const floor of snapshot.package.floors) {
    const stats = (floor.geometry as { validation?: { stats?: Partial<FloorStats> } })?.validation?.stats ?? {};
    map.set(floor.floorLabel, {
      wallCount: stats.wallCount ?? 0,
      openingSubtractionCount: stats.openingSubtractionCount ?? 0,
      slabCount: stats.slabCount ?? 0,
      slabCoreSubtractionCount: stats.slabCoreSubtractionCount ?? 0,
      junctionUnionCount: stats.junctionUnionCount ?? 0,
    });
  }
  return map;
}

export function compareBuildingReleaseSnapshots(older: BuildingReleaseSnapshot, newer: BuildingReleaseSnapshot) {
  const a = statsOf(older); const b = statsOf(newer);
  const floors = [...new Set([...a.keys(), ...b.keys()])].sort();
  return {
    fromSnapshotId: older.id,
    toSnapshotId: newer.id,
    checksumChanged: older.checksumHex !== newer.checksumHex,
    floorCountDelta: newer.package.floors.length - older.package.floors.length,
    floors: floors.map((floorLabel) => {
      const from = a.get(floorLabel) ?? { wallCount: 0, openingSubtractionCount: 0, slabCount: 0, slabCoreSubtractionCount: 0, junctionUnionCount: 0 };
      const to = b.get(floorLabel) ?? { wallCount: 0, openingSubtractionCount: 0, slabCount: 0, slabCoreSubtractionCount: 0, junctionUnionCount: 0 };
      return {
        floorLabel,
        added: !a.has(floorLabel) && b.has(floorLabel),
        removed: a.has(floorLabel) && !b.has(floorLabel),
        delta: {
          wallCount: to.wallCount - from.wallCount,
          openingSubtractionCount: to.openingSubtractionCount - from.openingSubtractionCount,
          slabCount: to.slabCount - from.slabCount,
          slabCoreSubtractionCount: to.slabCoreSubtractionCount - from.slabCoreSubtractionCount,
          junctionUnionCount: to.junctionUnionCount - from.junctionUnionCount,
        },
      };
    }),
  };
}

export const buildingReleaseCompareService = { compare: compareBuildingReleaseSnapshots };
