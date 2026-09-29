import type { BuildingReleaseSnapshot } from './buildingReleaseSnapshotService';
import { bimExternalHandoffService } from './bimExternalHandoffService';

export interface BimWriterAdapterDescriptor {
  id: string;
  label: string;
  target: 'IFC4';
  mode: 'handoff_only' | 'native_writer';
  supportsNativeIfc: boolean;
  requiresExternalRuntime: boolean;
  acceptedInputs: string[];
  outputFormats: string[];
}

export interface BimWriterHandoffPackage {
  adapter: BimWriterAdapterDescriptor;
  releaseSnapshotId: string;
  propertyId: string;
  hierarchy: Array<{ type: 'IfcBuildingStorey'; name: string; elevationM: number; externalId: string }>;
  propertySets: Array<{ name: string; properties: Record<string, string | number | boolean | undefined> }>;
  elementExternalIds: Array<{ sourceType: string; sourceId: string; externalId: string; targetIfcType: string }>;
  handoff: ReturnType<typeof bimExternalHandoffService.build>;
  nativeIfcGenerated: false;
}

export const DEFAULT_BIM_WRITER_ADAPTER: BimWriterAdapterDescriptor = {
  id: 'daon-ifc4-writer-adapter-v1',
  label: 'DA:ON IFC4 Writer Adapter Boundary',
  target: 'IFC4',
  mode: 'handoff_only',
  supportsNativeIfc: false,
  requiresExternalRuntime: true,
  acceptedInputs: ['buildingReleaseSnapshot', 'glTF', 'GLB', 'bimHandoffManifest'],
  outputFormats: ['ifc'],
};

function stableId(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) { hash ^= seed.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return `daon-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function buildBimWriterHandoff(snapshot: BuildingReleaseSnapshot): BimWriterHandoffPackage {
  const handoff = bimExternalHandoffService.build(snapshot);
  const hierarchy = snapshot.package.floors.map((floor) => ({ type: 'IfcBuildingStorey' as const, name: floor.floorLabel, elevationM: floor.elevationM, externalId: stableId(`${snapshot.id}:storey:${floor.assetId}`) }));
  const elementExternalIds: BimWriterHandoffPackage['elementExternalIds'] = [];
  for (const floor of snapshot.package.floors) {
    const geometry = floor.geometry as { walls?: Array<{ wallSegmentIndex: number; openingIds?: string[] }>; slabs?: Array<{ roomId: string; holes?: Array<{ coreId: string }> }> };
    for (const wall of geometry.walls ?? []) {
      elementExternalIds.push({ sourceType: 'wall', sourceId: `${floor.assetId}:wall:${wall.wallSegmentIndex}`, externalId: stableId(`${snapshot.id}:${floor.assetId}:wall:${wall.wallSegmentIndex}`), targetIfcType: 'IfcWall' });
      for (const openingId of wall.openingIds ?? []) elementExternalIds.push({ sourceType: 'opening', sourceId: openingId, externalId: stableId(`${snapshot.id}:${openingId}`), targetIfcType: 'IfcOpeningElement' });
    }
    for (const slab of geometry.slabs ?? []) {
      elementExternalIds.push({ sourceType: 'slab', sourceId: slab.roomId, externalId: stableId(`${snapshot.id}:${floor.assetId}:slab:${slab.roomId}`), targetIfcType: 'IfcSlab' });
      for (const hole of slab.holes ?? []) elementExternalIds.push({ sourceType: 'coreOpening', sourceId: hole.coreId, externalId: stableId(`${snapshot.id}:${floor.assetId}:core:${hole.coreId}`), targetIfcType: 'IfcOpeningElement' });
    }
  }
  return {
    adapter: DEFAULT_BIM_WRITER_ADAPTER,
    releaseSnapshotId: snapshot.id,
    propertyId: snapshot.propertyId,
    hierarchy,
    propertySets: [{ name: 'Pset_DAON_ReleaseProvenance', properties: { releaseSnapshotId: snapshot.id, checksumHex: snapshot.checksumHex, signatureAlgorithm: snapshot.signatureAlgorithm, constructionReady: false, legalBimReady: false } }],
    elementExternalIds,
    handoff,
    nativeIfcGenerated: false,
  };
}

export const bimWriterAdapterService = { descriptor: DEFAULT_BIM_WRITER_ADAPTER, buildHandoff: buildBimWriterHandoff };
