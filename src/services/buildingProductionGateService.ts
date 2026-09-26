import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { readFloorPlacement } from './floorPlacementService';
import { geometryProductionStateService } from './geometryProductionStateService';

export const BUILDING_PRODUCTION_CANDIDATE_VERSION = 'daon-building-production-candidate-v1';

export interface BuildingProductionFloor {
  assetId: string;
  floorLabel: string;
  elevationM: number;
  slabThicknessM: number;
  promotionId?: string;
  promotedAt?: string;
  sourceFingerprint: string;
  engineId?: string;
  geometry: unknown;
  validation: unknown;
}

export interface BuildingProductionCandidate {
  schemaVersion: typeof BUILDING_PRODUCTION_CANDIDATE_VERSION;
  generatedAt: string;
  propertyId?: string;
  status: 'ready' | 'blocked';
  floors: BuildingProductionFloor[];
  blockers: string[];
  currentCandidateCount: number;
  staleCandidateCount: number;
  productionCandidateReady: boolean;
  constructionReady: false;
  legalBimReady: false;
}

export function buildBuildingProductionCandidate(assets: DigitalTwinAsset[]): BuildingProductionCandidate {
  const blockers: string[] = [];
  const floors: BuildingProductionFloor[] = [];
  let staleCandidateCount = 0;

  if (!assets.length) blockers.push('Digital Twin 자산이 없습니다.');

  for (const asset of assets) {
    const label = asset.fileName || asset.id;
    const placement = readFloorPlacement(asset);
    if (!placement) {
      blockers.push(`${label}: 검증된 floor placement가 없습니다.`);
      continue;
    }
    const state = geometryProductionStateService.getState(asset);
    if (state.state !== 'current') {
      if (state.state === 'stale') staleCandidateCount += 1;
      blockers.push(`${placement.floorLabel}: production candidate ${state.state} — ${state.reason}`);
      continue;
    }
    const candidate = asset.metadata.productionGeometryCandidate as Record<string, unknown>;
    floors.push({
      assetId: asset.id,
      floorLabel: placement.floorLabel,
      elevationM: placement.elevationM,
      slabThicknessM: placement.slabThicknessM,
      promotionId: typeof candidate.promotionId === 'string' ? candidate.promotionId : undefined,
      promotedAt: typeof candidate.promotedAt === 'string' ? candidate.promotedAt : undefined,
      sourceFingerprint: state.sourceFingerprint,
      engineId: typeof candidate.engineId === 'string' ? candidate.engineId : undefined,
      geometry: candidate.geometry,
      validation: candidate.validation,
    });
  }

  floors.sort((a, b) => a.elevationM - b.elevationM);
  const duplicatedElevations = floors.filter((floor, index) => floors.findIndex((other) => Math.abs(other.elevationM - floor.elevationM) < 1e-6) !== index);
  if (duplicatedElevations.length) blockers.push(`중복 층 기준고가 있습니다: ${[...new Set(duplicatedElevations.map((item) => item.floorLabel))].join(', ')}`);
  if (floors.length !== assets.length) blockers.push(`전체 ${assets.length}개 자산 중 현재 production candidate 사용 가능 ${floors.length}개입니다.`);

  const productionCandidateReady = assets.length > 0 && blockers.length === 0 && floors.length === assets.length;
  return {
    schemaVersion: BUILDING_PRODUCTION_CANDIDATE_VERSION,
    generatedAt: new Date().toISOString(),
    propertyId: assets[0]?.propertyId,
    status: productionCandidateReady ? 'ready' : 'blocked',
    floors,
    blockers,
    currentCandidateCount: floors.length,
    staleCandidateCount,
    productionCandidateReady,
    constructionReady: false,
    legalBimReady: false,
  };
}

export function buildingProductionCandidateToJson(assets: DigitalTwinAsset[]) {
  return JSON.stringify(buildBuildingProductionCandidate(assets), null, 2);
}

export const buildingProductionGateService = {
  build: buildBuildingProductionCandidate,
  toJson: buildingProductionCandidateToJson,
};
