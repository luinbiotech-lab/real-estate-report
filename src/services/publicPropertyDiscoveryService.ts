import type { Property } from '../types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';

export interface DiscoveredAddress {
  query: string; officialAddress: string; roadAddress: string; lotAddress: string;
  latitude: number; longitude: number; region1: string; region2: string; region3: string;
  bCode: string; sigunguCd: string; bjdongCd: string; mountainYn: string; bun: string; ji: string;
}
export interface DiscoveredBuilding {
  buildingName: string; lotAddress: string; roadAddress: string;
  landAreaSqm?: number; landAreaPyeong?: number; buildingAreaSqm?: number; buildingAreaPyeong?: number;
  totalFloorAreaSqm?: number; totalFloorAreaPyeong?: number; buildingCoverageRate?: number; floorAreaRatio?: number;
  structure: string; mainUse: string; groundFloors: number; basementFloors: number;
  householdCount?: number; familyCount?: number; heightM?: number; elevatorCount?: number; parkingOfficial?: number;
  completionDate: string; rawPk: string;
}
export interface DiscoveredFloor { floorType: string; floor: string; areaSqm?: number; mainUse: string; structure: string }
export interface DiscoveredTrade {
  type: 'commercial' | 'land'; dealAmount?: number; dealDate: string; legalDong: string; jibun: string;
  buildingName: string; buildingAreaSqm?: number; landAreaSqm?: number; floor: string; buildingUse: string;
}
export interface BuildingUsageEvidence {
  state: 'energy_usage_observed' | 'no_public_record' | 'not_configured';
  interpretation: string;
  positiveMonths: number;
  latestObservedMonth?: string;
  monthly: Array<{ useYm: string; electricityKwh?: number; gasKwh?: number }>;
}
export interface PropertyDiscoveryResult {
  status: 'ok' | 'partial' | 'not_found'; publicDataConfigured: boolean; address?: DiscoveredAddress;
  building?: DiscoveredBuilding | null; buildingCandidates?: DiscoveredBuilding[]; floors?: DiscoveredFloor[];
  market?: { commercial: DiscoveredTrade[]; land: DiscoveredTrade[] };
  usageEvidence?: BuildingUsageEvidence;
  sources?: Record<string,string>; collectedAt?: string;
}

const fieldList = [
  'address','buildingName','latitude','longitude','landAreaSqm','landAreaPyeong','buildingAreaPyeong',
  'totalFloorAreaSqm','totalFloorAreaPyeong','buildingCoverageRate','floorAreaRatio','structure','mainUse',
  'groundFloors','basementFloors','completionDate','parkingOfficial','parkingSpaces','elevator'
];

export const publicPropertyDiscoveryService = {
  async discover(query: string): Promise<PropertyDiscoveryResult> {
    const response = await fetch(`/api/property-discovery?${new URLSearchParams({ query })}`, { cache: 'no-store' });
    const body = await response.json().catch(() => ({})) as PropertyDiscoveryResult & { message?: string };
    if (!response.ok) throw new Error(body.message || `공공데이터 조회 실패 (${response.status})`);
    return body;
  },

  patchFrom(result: PropertyDiscoveryResult): Partial<Property> {
    const address = result.address;
    const building = result.building;
    if (!address) return {};
    return {
      name: building?.buildingName || address.lotAddress || address.officialAddress,
      address: address.officialAddress || address.lotAddress,
      latitude: address.latitude,
      longitude: address.longitude,
      buildingName: building?.buildingName || '',
      landAreaSqm: building?.landAreaSqm || 0,
      landAreaPyeong: building?.landAreaPyeong || 0,
      buildingAreaPyeong: building?.buildingAreaPyeong || 0,
      totalFloorAreaSqm: building?.totalFloorAreaSqm || 0,
      totalFloorAreaPyeong: building?.totalFloorAreaPyeong || 0,
      buildingCoverageRate: building?.buildingCoverageRate || 0,
      floorAreaRatio: building?.floorAreaRatio || 0,
      structure: building?.structure || '',
      mainUse: building?.mainUse || '',
      groundFloors: building?.groundFloors || 0,
      basementFloors: building?.basementFloors || 0,
      completionDate: building?.completionDate || '',
      parkingOfficial: building?.parkingOfficial,
      parkingSpaces: building?.parkingOfficial || 0,
      elevator: building?.elevatorCount != null ? String(building.elevatorCount) : '',
    };
  },

  async persist(propertyId: string, result: PropertyDiscoveryResult) {
    if (!result.address) return;
    const now = result.collectedAt || new Date().toISOString();
    await propertyDataRoomRepository.saveDataSource({
      id: `public-address:${propertyId}`, propertyId, fieldKey: 'address', resourceType: 'address_resolution',
      sourceType: 'map_provider', sourceName: result.sources?.address || 'Kakao Local Address API',
      sourceReference: result.address.lotAddress || result.address.officialAddress, collectedAt: now,
      verificationStatus: 'confirmed', metadata: { ...result.address, explicitFields: ['address','latitude','longitude'] }, createdAt: now,
    });
    if (result.building) {
      await propertyDataRoomRepository.saveDataSource({
        id: `building-register:${propertyId}`, propertyId, resourceType: 'building_register_title',
        sourceType: 'public_api', sourceName: result.sources?.building || '국토교통부 건축HUB 건축물대장정보',
        sourceReference: result.building.rawPk || result.address.lotAddress, collectedAt: now,
        verificationStatus: 'confirmed',
        metadata: { building: result.building, floors: result.floors || [], explicitFields: fieldList }, createdAt: now,
      });
    }
    if ((result.market?.commercial.length || 0) + (result.market?.land.length || 0) > 0) {
      await propertyDataRoomRepository.saveDataSource({
        id: `public-market:${propertyId}`, propertyId, fieldKey: 'nearbyTransactions', resourceType: 'public_transaction_snapshot',
        sourceType: 'market_data', sourceName: '국토교통부 실거래가 공개자료',
        sourceReference: `${result.address.region2} 최근 6개월`, collectedAt: now,
        verificationStatus: 'confirmed', metadata: { market: result.market, explicitFields: ['nearbyTransactions'] }, createdAt: now,
      });
    }
    if (result.usageEvidence && result.usageEvidence.state !== 'not_configured') {
      await propertyDataRoomRepository.saveDataSource({
        id: `building-energy:${propertyId}`, propertyId, fieldKey: 'occupancyStatus', resourceType: 'building_energy_usage_evidence',
        sourceType: 'public_api', sourceName: result.sources?.energy || '국토교통부 건축HUB 건물에너지정보',
        sourceReference: result.address.lotAddress, collectedAt: now,
        verificationStatus: 'imported',
        metadata: {
          usageEvidence: result.usageEvidence,
          evidenceSemantics: 'occupancy_supporting_evidence_only',
          occupancyConfirmed: false,
        },
        createdAt: now,
      });
    }
  },
};
