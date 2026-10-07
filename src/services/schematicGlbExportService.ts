import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import type { SpatialPropertySpace } from '../domain/propertyDataRoom/spatialMediaModel';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { spatialMediaRepository } from '../repositories/spatialMediaRepository';

function normalizedRect(space: SpatialPropertySpace) {
  const geometry = space.geometry2d;
  if (!geometry || geometry.type !== 'normalized_rect' || geometry.coordinateSpace !== 'floor_plan_image') return undefined;
  const x = Number(geometry.x);
  const y = Number(geometry.y);
  const width = Number(geometry.width);
  const height = Number(geometry.height);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return undefined;
  return { x, y, width, height };
}

function scaledSpace(space: SpatialPropertySpace) {
  const rect = normalizedRect(space);
  const estimated = space.estimatedGeometry3d;
  const widthM = Number(estimated?.widthM);
  const depthM = Number(estimated?.depthM);
  if (!rect || estimated?.scaleVerified !== true || !(widthM > 0) || !(depthM > 0)) return undefined;
  return { space, rect, widthM, depthM };
}

async function exportBinary(scene: THREE.Scene) {
  const exporter = new GLTFExporter();
  return new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(result);
        else reject(new Error('Binary GLB 생성 결과가 ArrayBuffer가 아닙니다.'));
      },
      (error) => reject(error instanceof Error ? error : new Error(String(error))),
      { binary: true, onlyVisible: true },
    );
  });
}

export const schematicGlbExportService = {
  async exportFromRasterSpaces(sourceAsset: DigitalTwinAsset) {
    const spaces = (await spatialMediaRepository.getSpaces(sourceAsset.propertyId))
      .filter((space) => !space.deletedAt)
      .map(scaledSpace)
      .filter((item): item is NonNullable<ReturnType<typeof scaledSpace>> => Boolean(item));

    if (!spaces.length) throw new Error('GLB를 생성하려면 축척 검증된 raster 공간 매핑이 최소 1개 필요합니다.');

    const first = spaces[0];
    const planWidthM = first.widthM / first.rect.width;
    const planDepthM = first.depthM / first.rect.height;
    if (!(planWidthM > 0) || !(planDepthM > 0)) throw new Error('도면 전체 meter scale을 계산할 수 없습니다.');

    const scene = new THREE.Scene();
    scene.name = 'DAON_Schematic_Estimated_Model';

    const root = new THREE.Group();
    root.name = 'RasterManualMapping';
    scene.add(root);

    const displayHeightM = Math.max(0.18, Math.min(0.35, Math.max(planWidthM, planDepthM) * 0.025));
    const palette = [0xb8c5d6, 0xd5c7b8, 0xbfcfbd, 0xd5bfd0, 0xc9c3dd, 0xd5d1b7];

    spaces.forEach(({ space, rect, widthM, depthM }, index) => {
      const geometry = new THREE.BoxGeometry(widthM, displayHeightM, depthM);
      const material = new THREE.MeshStandardMaterial({ color: palette[index % palette.length], roughness: 0.8, metalness: 0 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = space.spaceName || space.id;
      mesh.position.set(
        (rect.x + rect.width / 2) * planWidthM - planWidthM / 2,
        displayHeightM / 2,
        (rect.y + rect.height / 2) * planDepthM - planDepthM / 2,
      );
      mesh.userData = {
        spaceId: space.id,
        spaceName: space.spaceName,
        verificationStatus: space.verificationStatus,
        modelClass: 'schematic_estimated',
        scaleVerified: true,
        heightStatus: 'unknown',
      };
      root.add(mesh);
    });

    const binary = await exportBinary(scene);
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });

    const existing = await propertyDataRoomRepository.getDigitalTwinAssets(sourceAsset.propertyId);
    const version = Math.max(0, ...existing.filter((asset) => asset.assetType === 'glb').map((asset) => asset.version || 0)) + 1;
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const fileName = `daon-schematic-estimated-v${version}.glb`;
    const blob = new Blob([binary], { type: 'model/gltf-binary' });

    const asset: DigitalTwinAsset = {
      id,
      propertyId: sourceAsset.propertyId,
      assetType: 'glb',
      fileFormat: 'glb',
      storagePath: `properties/${sourceAsset.propertyId}/digital-twin/${id}-${fileName}`,
      fileName,
      mimeType: 'model/gltf-binary',
      fileData: blob,
      floor: sourceAsset.floor,
      version,
      processingStatus: 'ready',
      metadata: {
        intakeSource: 'generated_schematic',
        generatedFrom: 'raster_manual_mapping',
        sourceFloorPlanAssetId: sourceAsset.id,
        sourceSpaceIds: spaces.map(({ space }) => space.id),
        modelClass: 'schematic_estimated',
        horizontalScaleVerified: true,
        heightStatus: 'unknown',
        displayHeightM,
        planWidthM: Number(planWidthM.toFixed(4)),
        planDepthM: Number(planDepthM.toFixed(4)),
        fileSize: blob.size,
      },
      createdAt: now,
      updatedAt: now,
    };

    const saved = await propertyDataRoomRepository.saveDigitalTwinAsset(asset);
    await propertyDataRoomRepository.saveDataSource({
      id: `digital-twin-source:${id}`,
      propertyId: sourceAsset.propertyId,
      resourceType: 'digital_twin_asset',
      sourceType: 'calculated',
      sourceName: fileName,
      sourceReference: id,
      collectedAt: now,
      verificationStatus: 'estimated',
      metadata: {
        assetId: id,
        sourceFloorPlanAssetId: sourceAsset.id,
        sourceSpaceIds: spaces.map(({ space }) => space.id),
        modelClass: 'schematic_estimated',
        horizontalScaleVerified: true,
        heightStatus: 'unknown',
      },
      createdAt: now,
    });

    return saved;
  },
};
