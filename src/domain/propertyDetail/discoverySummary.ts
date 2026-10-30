import type { DiscoveredBuilding, DiscoveredTrade, PropertyDiscoveryResult } from '../../services/publicPropertyDiscoveryService';

/*
 * Mobile-first summary for an address/lot lookup (Issue #37). Pure so scripts/validate-property-detail-pages.mjs can run it.
 * Rules: show only what the user needs first (type, core price/area, verification state, cautions); never present the
 * official-land-price product as a market price; a 0/blank register value is 미기재; no register title is 미확인.
 */

export const SQM_PER_PYEONG = 3.3058;

export interface DiscoveryFact { label: string; value: string; note?: string }
export interface DiscoverySummary {
  typeLabel: string;
  typeConfidence: 'register' | 'partial' | 'parcel_evidence' | 'none';
  typeBasis: string[];
  facts: DiscoveryFact[];
  cautions: string[];
  needsBuildingChoice: boolean;
}

const fmtNumber = (value: number, digits = 2) => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: digits }).format(value);
export const formatWonShort = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '-';
  if (value >= 100_000_000) return `${fmtNumber(value / 100_000_000, value >= 10_000_000_000 ? 0 : 1)}억원`;
  if (value >= 10_000) return `${fmtNumber(Math.round(value / 10_000), 0)}만원`;
  return `${fmtNumber(value, 0)}원`;
};
export const perPyeongFromPerSqm = (perSqm: number) => (Number.isFinite(perSqm) && perSqm > 0 ? Math.round(perSqm * SQM_PER_PYEONG) : 0);

/** Register value for display: positive numbers formatted, recorded-as-0 → 미기재, missing → 미확인. */
export function registerValue(building: DiscoveredBuilding | null | undefined, key: keyof DiscoveredBuilding, unit = '㎡') {
  if (!building) return '미확인';
  const value = building[key];
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return `${fmtNumber(value)}${unit}`;
  if (building.unrecordedFields?.includes(String(key)) || value === 0) return '미기재';
  return '미확인';
}

export function buildDiscoverySummary(result: PropertyDiscoveryResult): DiscoverySummary {
  const type = result.propertyType;
  const building = result.building ?? null;
  const land = result.landProfile ?? null;
  const market = result.market?.summary;
  const facts: DiscoveryFact[] = [];

  const landArea = land?.landAreaSqm && land.landAreaSqm > 0 ? land.landAreaSqm : building?.landAreaSqm && building.landAreaSqm > 0 ? building.landAreaSqm : 0;
  facts.push({ label: '토지면적', value: landArea ? `${fmtNumber(landArea)}㎡ (${fmtNumber(landArea / SQM_PER_PYEONG)}평)` : '미확인', note: land?.landAreaSqm ? 'VWorld 토지특성' : building?.landAreaSqm ? '건축물대장' : undefined });
  if (building) facts.push({ label: '연면적', value: registerValue(building, 'totalFloorAreaSqm'), note: '건축물대장' });
  if (land?.officialLandPricePerSqm) {
    facts.push({ label: '개별공시지가', value: `${formatWonShort(perPyeongFromPerSqm(land.officialLandPricePerSqm))}/평`, note: `${land.standardYear || ''} 공시 · 시세 아님`.trim() });
  }
  const landUnitMedian = market?.medianLandPricePerPyeong;
  if (landUnitMedian) facts.push({ label: '주변 토지평당(중앙값)', value: `${formatWonShort(landUnitMedian)}/평`, note: `비교가능 ${market?.comparableCount ?? 0}건 · 후보` });

  const cautions: string[] = [];
  if (land?.estimatedOfficialLandValue) cautions.push('공시지가 기준 토지가액은 공시지가×면적 계산값이며 매매 시세·감정가가 아닙니다.');
  if (!building && result.publicDataConfigured) cautions.push('건축물대장 표제부가 조회되지 않았습니다. 건물이 없다는 뜻이 아니라 미확인입니다.');
  if (building?.unrecordedFields?.length) cautions.push(`건축물대장에 기재되지 않은 항목이 있습니다(${building.unrecordedFields.length}개). 0이 아니라 미기재로 표시합니다.`);
  if (type?.multipleBuildings) cautions.push('이 지번에 건축물대장 표제부가 여러 건 있습니다. 대상 건물을 선택해야 합니다(호실은 추정하지 않습니다).');
  if (market && market.totalCandidates > 0) {
    cautions.push(market.exactLotCount > 0
      ? `동일 지번 거래 ${market.exactLotCount}건이 있으나 동일 건물 거래로 확정하지 않습니다.`
      : '주변 실거래는 같은 동·최근 6개월의 후보이며, 동일 지번 거래는 없습니다.');
  }
  if (!result.publicDataConfigured) cautions.push('공공데이터 서비스키 미연결 — 건축물대장·실거래는 조회되지 않았습니다.');

  return {
    typeLabel: type?.label ?? '미확인',
    typeConfidence: type?.confidence ?? 'none',
    typeBasis: type?.basis ?? ['유형 판정 정보 없음'],
    facts: facts.slice(0, 4),
    cautions,
    needsBuildingChoice: Boolean(type?.multipleBuildings && (result.buildingCandidates?.length ?? 0) > 1),
  };
}

export interface GroupedTrade { trade: DiscoveredTrade; count: number }

/** Identical public rows (same type/date/lot/amount/area) are shown once with a count, so a list of shares is not a wall of repeats. */
export function groupIdenticalTrades(trades: DiscoveredTrade[]): GroupedTrade[] {
  const groups = new Map<string, GroupedTrade>();
  for (const trade of trades) {
    const key = [trade.type, trade.dealDate, trade.legalDong, trade.jibun, trade.dealAmount ?? '', trade.landAreaSqm ?? '', trade.buildingAreaSqm ?? '', trade.floor ?? ''].join('|');
    const current = groups.get(key);
    if (current) current.count += 1; else groups.set(key, { trade, count: 1 });
  }
  return [...groups.values()];
}
