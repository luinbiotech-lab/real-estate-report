import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { openingCutService } from './openingCutService';
import { wallGeometryMergeService } from './wallGeometryMergeService';
import { wallModelService } from './wallModelService';

export interface OpeningBooleanEligibility {
  candidateId: string;
  semantic: 'door' | 'window';
  wallLayer: string;
  wallSegmentIndex: number;
  eligible: boolean;
  booleanApplied: false;
  clearanceM?: number;
  reasons: string[];
}

function length(a: { x: number; y: number }, b: { x: number; y: number }) { return Math.hypot(b.x - a.x, b.y - a.y); }

export function buildOpeningBooleanEligibility(asset: DigitalTwinAsset): OpeningBooleanEligibility[] {
  const walls = wallModelService.build(asset);
  const mergeEligibility = wallGeometryMergeService.build(asset);
  const blockedSegments = new Set(mergeEligibility.filter((item) => !item.eligible).flatMap((item) => item.segmentIndexes));

  return openingCutService.build(asset).map((cut) => {
    const wall = walls[cut.wallSegmentIndex];
    const reasons: string[] = [];
    if (!wall) reasons.push('대상 wall segment를 찾을 수 없습니다.');
    if (blockedSegments.has(cut.wallSegmentIndex)) reasons.push('인접 wall junction 정합이 review_required 상태입니다.');
    if (!(cut.widthM > 0 && cut.heightM > 0)) reasons.push('개구부 폭/높이 검증값이 없습니다.');
    if (wall && cut.sillHeightM + cut.heightM > wall.heightM + 0.02) reasons.push('개구부 상단이 검증 벽 높이를 초과합니다.');
    const wallLength = wall ? length(wall.start, wall.end) : 0;
    const clearanceM = wall ? (wallLength - cut.widthM) / 2 : undefined;
    if (wall && cut.widthM >= wallLength) reasons.push('개구부 폭이 wall segment 길이 이상입니다.');
    if (clearanceM != null && clearanceM < Math.max(0.05, wall!.thicknessM * 0.5)) reasons.push('wall segment 끝단 여유가 부족합니다.');
    return {
      candidateId: cut.candidateId,
      semantic: cut.semantic,
      wallLayer: cut.wallLayer,
      wallSegmentIndex: cut.wallSegmentIndex,
      eligible: reasons.length === 0,
      booleanApplied: false,
      clearanceM,
      reasons: reasons.length ? reasons : ['벽체/개구부 치수 및 junction 정합 조건이 충족되었습니다. 실제 boolean은 명시적 후속 단계에서만 적용합니다.'],
    };
  });
}

export const openingBooleanEligibilityService = { build: buildOpeningBooleanEligibility };
