import type { BuildingReleaseSnapshot } from './buildingReleaseSnapshotService';
import { GLTF_EXPORT_ADAPTER_VERSION, gltfExportService } from './gltfExportService';

export const BIM_HANDOFF_VERSION = 'daon-bim-external-handoff-v1';

export function buildBimExternalHandoff(snapshot: BuildingReleaseSnapshot) {
  const mesh = gltfExportService.buildMesh(snapshot);
  return {
    schemaVersion: BIM_HANDOFF_VERSION,
    generatedAt: new Date().toISOString(),
    releaseSnapshotId: snapshot.id,
    propertyId: snapshot.propertyId,
    integrity: {
      checksumAlgorithm: snapshot.checksumAlgorithm,
      checksumHex: snapshot.checksumHex,
      signatureAlgorithm: snapshot.signatureAlgorithm,
      signatureBase64: snapshot.signatureBase64,
      publicKeyJwk: snapshot.publicKeyJwk,
    },
    coordinateSystem: { units: 'meter', upAxis: 'Z', source: 'reviewed DXF + verified scale/floor placement' },
    external3D: {
      adapterVersion: GLTF_EXPORT_ADAPTER_VERSION,
      formats: ['gltf', 'glb'],
      vertexCount: mesh.vertices.length / 3,
      triangleCount: mesh.indices.length / 3,
      omittedSlabsWithHoles: mesh.omittedSlabsWithHoles,
      reviewMeshOnly: true,
    },
    bimMapping: {
      targetStandard: 'IFC4-compatible handoff mapping',
      nativeIfcGenerated: false,
      entities: [
        { source: 'floor', target: 'IfcBuildingStorey', status: 'mapped_metadata' },
        { source: 'wall partition', target: 'IfcWall', status: 'mapped_candidate' },
        { source: 'door opening', target: 'IfcOpeningElement/IfcDoor', status: 'mapped_candidate' },
        { source: 'window opening', target: 'IfcOpeningElement/IfcWindow', status: 'mapped_candidate' },
        { source: 'slab shell/core holes', target: 'IfcSlab/IfcOpeningElement', status: 'metadata_handoff' },
        { source: 'stair/elevator core', target: 'IfcStair/IfcTransportElement', status: 'metadata_handoff' },
      ],
      requiredExternalStep: '전문 IFC writer/geometry kernel에서 release snapshot과 GLB를 입력으로 native IFC를 생성하고 별도 BIM QA를 수행해야 합니다.',
    },
    provenance: snapshot.package.floors.map((floor) => ({
      floorLabel: floor.floorLabel,
      assetId: floor.assetId,
      promotionId: floor.promotionId,
      sourceFingerprint: floor.sourceFingerprint,
      engineId: floor.engineId,
    })),
    safety: {
      constructionReady: false,
      legalBimReady: false,
      statement: '본 handoff는 DA:ON 검증 후보의 외부 3D/BIM 연계 패키지이며 구조·소방·피난·인허가·실시설계 승인본이 아닙니다.',
    },
  };
}

export const bimExternalHandoffService = { build: buildBimExternalHandoff };