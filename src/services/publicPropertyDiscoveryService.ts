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
  registerKind?: string; detailUse?: string; dongName?: string;
  /** Register fields recorded as 0/blank — shown as 미기재, never as a measured 0. */
  unrecordedFields?: string[];
}
export type DiscoveredPropertyType = 'land' | 'apartment' | 'row_house' | 'officetel' | 'detached' | 'commercial_office' | 'factory_warehouse' | 'mixed' | 'unconfirmed';
export interface PropertyTypeClassification {
  type: DiscoveredPropertyType; label: string; confidence: 'register' | 'partial' | 'parcel_evidence' | 'none';
  basis: string[]; multipleBuildings: boolean; candidates?: DiscoveredPropertyType[];
}
export interface DiscoveredFloor { floorType: string; floor: string; areaSqm?: number; mainUse: string; structure: string }
export interface DiscoveredTrade {
  type: 'commercial' | 'land'; dealAmount?: number; sourceDealAmountTenThousandWon?: number;
  dealAmountSourceUnit?: '만원'; currency?: 'KRW'; dealDate: string; legalDong: string; jibun: string;
  buildingName: string; buildingAreaSqm?: number; landAreaSqm?: number; floor: string; buildingUse: string;
  matchLevel?: 'exact_lot' | 'masked_address_candidate' | 'same_dong_candidate' | 'regional_candidate';
  pricePerSqm?: number; pricePerPyeong?: number;
  buildingType?: string; comparableExclusion?: 'cancelled' | 'share_deal' | 'collective_unit'; landPricePerPyeong?: number;
}
export interface LandUseZone { type: string; code: string; name: string; representativeYn: string }
export interface LandProfile {
  pnu: string; standardYear: string;
  officialLandPricePerSqm?: number; estimatedOfficialLandValue?: number; landAreaSqm?: number;
  landCategory: string; landUseSituation: string; terrainHeight: string; terrainShape: string; roadSide: string;
  primaryUseZone: string; useZones: string[];
}
export interface MarketSummary {
  totalCandidates: number; exactLotCount: number; latestDealDate?: string; medianDealAmount?: number; medianPricePerPyeong?: number;
  comparableCount?: number; excluded?: { cancelled: number; share_deal: number; collective_unit: number }; medianLandPricePerPyeong?: number;
}
export interface BuildingUsageEvidence {
  state: 'energy_usage_observed' | 'no_public_record' | 'not_configured';
  interpretation: string;
  positiveMonths: number;
  latestObservedMonth?: string;
  monthly: Array<{ useYm: string; electricityKwh?: number; gasKwh?: number }>;
}
export interface OperatingBusiness {
  businessId: string; businessName: string; branchName: string;
  industryLarge: string; industryMiddle: string; industrySmall: string;
  lotAddress: string; roadAddress: string; buildingName: string; floor: string; unit: string;
  longitude?: number; latitude?: number;
}
export interface OperatingBusinessEvidence {
  state: 'operating_business_observed' | 'nearby_business_observed' | 'no_public_record' | 'provider_unavailable' | 'not_configured';
  interpretation: string;
  sameAddress: OperatingBusiness[];
  nearby: OperatingBusiness[];
}
export interface KakaoPoiItem {
  placeId: string; placeName: string; categoryName: string; categoryGroupCode: string; categoryGroupName: string;
  phone: string; lotAddress: string; roadAddress: string; distanceMeters?: number; longitude?: number; latitude?: number; placeUrl: string;
}
export interface KakaoPoiEvidence {
  state: 'same_address_poi_observed' | 'nearby_poi_observed' | 'no_public_record' | 'not_configured';
  interpretation: string;
  sameAddress: KakaoPoiItem[];
  nearby: KakaoPoiItem[];
}
export interface PropertyDiscoveryResult {
  status: 'ok' | 'partial' | 'not_found'; publicDataConfigured: boolean; vworldConfigured?: boolean; address?: DiscoveredAddress;
  building?: DiscoveredBuilding | null; buildingCandidates?: DiscoveredBuilding[]; floors?: DiscoveredFloor[];
  propertyType?: PropertyTypeClassification;
  landUseZones?: LandUseZone[];
  landProfile?: LandProfile | null;
  market?: { commercial: DiscoveredTrade[]; land: DiscoveredTrade[]; summary?: MarketSummary; exactLot?: DiscoveredTrade[] };
  usageEvidence?: BuildingUsageEvidence;
  operatingBusinessEvidence?: OperatingBusinessEvidence;
  kakaoPoiEvidence?: KakaoPoiEvidence;
  providerStatus?: Record<string, { ok: boolean; error?: string }>;
  sources?: Record<string,string>; collectedAt?: string;
}

const fieldList = [
  'address','buildingName','latitude','longitude','landAreaSqm','landAreaPyeong','buildingAreaPyeong',
  'totalFloorAreaSqm','totalFloorAreaPyeong','buildingCoverageRate','floorAreaRatio','structure','mainUse',
  'groundFloors','basementFloors','completionDate','parkingOfficial','parkingSpaces','elevator',
  'officialLandPricePerSqm','estimatedOfficialLandValue','officialLandPriceYear','landCategory','landUseSituation','zoning'
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
    const landProfile = result.landProfile;
    if (!address) return {};

    const patch: Partial<Property> = {
      name: building?.buildingName || address.lotAddress || address.officialAddress,
      address: address.officialAddress || address.lotAddress,
      latitude: address.latitude,
      longitude: address.longitude,
    };

    if (building) {
      if (building.buildingName) patch.buildingName = building.buildingName;
      if (building.landAreaSqm) {
        patch.landAreaSqm = building.landAreaSqm;
        patch.landAreaPyeong = Math.round((building.landAreaSqm / 3.3058) * 100) / 100;
      }
      if (building.buildingAreaPyeong) patch.buildingAreaPyeong = building.buildingAreaPyeong;
      if (building.totalFloorAreaSqm) patch.totalFloorAreaSqm = building.totalFloorAreaSqm;
      if (building.totalFloorAreaPyeong) patch.totalFloorAreaPyeong = building.totalFloorAreaPyeong;
      if (building.buildingCoverageRate != null) patch.buildingCoverageRate = building.buildingCoverageRate;
      if (building.floorAreaRatio != null) patch.floorAreaRatio = building.floorAreaRatio;
      if (building.structure) patch.structure = building.structure;
      if (building.mainUse) patch.mainUse = building.mainUse;
      if (building.groundFloors) patch.groundFloors = building.groundFloors;
      if (building.basementFloors) patch.basementFloors = building.basementFloors;
      if (building.completionDate) patch.completionDate = building.completionDate;
      if (building.parkingOfficial != null) {
        patch.parkingOfficial = building.parkingOfficial;
        patch.parkingSpaces = building.parkingOfficial;
      }
      if (building.elevatorCount != null) patch.elevator = String(building.elevatorCount);
    }

    if (!patch.landAreaSqm && landProfile?.landAreaSqm) {
      patch.landAreaSqm = landProfile.landAreaSqm;
      patch.landAreaPyeong = Math.round((landProfile.landAreaSqm / 3.3058) * 100) / 100;
    }
    if (landProfile?.officialLandPricePerSqm) patch.officialLandPricePerSqm = landProfile.officialLandPricePerSqm;
    if (landProfile?.estimatedOfficialLandValue) patch.estimatedOfficialLandValue = landProfile.estimatedOfficialLandValue;
    if (landProfile?.standardYear) patch.officialLandPriceYear = landProfile.standardYear;
    if (landProfile?.landCategory) patch.landCategory = landProfile.landCategory;
    if (landProfile?.landUseSituation) patch.landUseSituation = landProfile.landUseSituation;

    const zoning = (result.landUseZones || []).map((zone) => zone.name).filter(Boolean).join(', ')
      || landProfile?.useZones?.join(', ')
      || landProfile?.primaryUseZone
      || '';
    if (zoning) patch.zoning = zoning;

    return patch;
  },

  async refreshExisting(property: Property, result: PropertyDiscoveryResult) {
    await this.persist(property.id, result);
    const patch = this.patchFrom(result);
    const existingCandidates = await propertyDataRoomRepository.getVerificationCandidates(property.id);
    const created = [];
    const now = result.collectedAt || new Date().toISOString();
    const isMeaningful = (value: unknown) => value !== undefined && value !== null && value !== '' && !(typeof value === 'number' && value === 0);
    const same = (a: unknown, b: unknown) => {
      if (typeof a === 'number' || typeof b === 'number') return Number(a || 0) === Number(b || 0);
      return String(a ?? '').trim() === String(b ?? '').trim();
    };
    for (const [fieldKey, candidateValue] of Object.entries(patch)) {
      if (fieldKey === 'name') continue;
      if (!isMeaningful(candidateValue)) continue;
      const currentValue = property[fieldKey as keyof Property];
      if (fieldKey === 'address' && result.address) {
        const normalizeAddress = (value: unknown) => String(value ?? '').replace(/\s+/g, '').toLowerCase();
        const currentAddress = normalizeAddress(currentValue);
        const equivalentAddresses = [result.address.officialAddress, result.address.roadAddress, result.address.lotAddress]
          .filter(Boolean)
          .map(normalizeAddress);
        if (equivalentAddresses.includes(currentAddress)) continue;
      }
      if (same(currentValue, candidateValue)) continue;
      const duplicate = existingCandidates.some((candidate) =>
        candidate.fieldKey === fieldKey &&
        candidate.decisionStatus === 'pending' &&
        same(candidate.candidateValue, candidateValue)
      );
      if (duplicate) continue;
      const addressField = ['address', 'latitude', 'longitude'].includes(fieldKey);
      const calculatedField = fieldKey === 'estimatedOfficialLandValue';
      const landProfileField = ['officialLandPricePerSqm','officialLandPriceYear','landCategory','landUseSituation'].includes(fieldKey)
        || (fieldKey === 'zoning' && Boolean(result.landProfile));
      const candidate = {
        id: crypto.randomUUID(),
        propertyId: property.id,
        fieldKey,
        currentValue,
        candidateValue,
        sourceType: addressField ? 'map_provider' as const : calculatedField ? 'calculated' as const : 'public_api' as const,
        sourceName: addressField
          ? result.sources?.address || 'Kakao Local Address API'
          : calculatedField
            ? '개별공시지가 × 공개 토지면적 계산'
            : landProfileField
              ? result.sources?.landProfile || '국토교통부 VWorld NED 토지정보'
              : result.sources?.building || '국토교통부 건축HUB 건축물대장정보',
        sourceReference: addressField
          ? result.address?.lotAddress || result.address?.officialAddress
          : calculatedField || landProfileField
            ? result.landProfile?.pnu || result.address?.lotAddress
            : result.building?.rawPk || result.address?.lotAddress,
        confidence: addressField ? 0.99 : 0.95,
        decisionStatus: 'pending' as const,
        note: '공공데이터 자동조회 결과가 현재 Property 값과 달라 검토가 필요합니다.',
        createdAt: now,
      };
      await propertyDataRoomRepository.saveVerificationCandidate(candidate);
      created.push(candidate);
    }
    return { persisted: true, candidateCount: created.length, candidates: created };
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
    if (result.landProfile) {
      await propertyDataRoomRepository.saveDataSource({
        id: `official-land-profile:${propertyId}`, propertyId, resourceType: 'official_land_profile',
        sourceType: 'public_api', sourceName: result.sources?.landProfile || '국토교통부 VWorld NED 토지정보',
        sourceReference: result.landProfile.pnu || result.address.lotAddress, collectedAt: now,
        sourceDate: result.landProfile.standardYear ? `${result.landProfile.standardYear}-01-01` : undefined,
        verificationStatus: 'confirmed',
        metadata: {
          landProfile: result.landProfile,
          explicitFields: ['officialLandPricePerSqm','officialLandPriceYear','landCategory','landUseSituation','landAreaSqm','landAreaPyeong','zoning'],
        },
        createdAt: now,
      });
    }
    if (result.landProfile?.estimatedOfficialLandValue) {
      await propertyDataRoomRepository.saveDataSource({
        id: `official-land-value-calculation:${propertyId}`, propertyId, fieldKey: 'estimatedOfficialLandValue',
        resourceType: 'official_land_value_calculation', sourceType: 'calculated',
        sourceName: '개별공시지가 × 공개 토지면적 계산',
        sourceReference: result.landProfile.pnu || result.address.lotAddress, collectedAt: now,
        sourceDate: result.landProfile.standardYear ? `${result.landProfile.standardYear}-01-01` : undefined,
        verificationStatus: 'calculated',
        metadata: {
          formula: 'officialLandPricePerSqm * landAreaSqm',
          officialLandPricePerSqm: result.landProfile.officialLandPricePerSqm,
          landAreaSqm: result.landProfile.landAreaSqm,
          estimatedOfficialLandValue: result.landProfile.estimatedOfficialLandValue,
          explicitFields: ['estimatedOfficialLandValue'],
          semantics: 'derived_value_not_appraisal_or_market_value',
        },
        createdAt: now,
      });
    }
    if (result.building) {
      await propertyDataRoomRepository.saveDataSource({
        id: `building-register:${propertyId}`, propertyId, resourceType: 'building_register_title',
        sourceType: 'public_api', sourceName: result.sources?.building || '국토교통부 건축HUB 건축물대장정보',
        sourceReference: result.building.rawPk || result.address.lotAddress, collectedAt: now,
        verificationStatus: 'confirmed',
        metadata: { building: result.building, floors: result.floors || [], landUseZones: result.landUseZones || [], explicitFields: fieldList }, createdAt: now,
      });
    }
    if ((result.market?.commercial.length || 0) + (result.market?.land.length || 0) > 0) {
      await propertyDataRoomRepository.saveDataSource({
        id: `public-market:${propertyId}`, propertyId, fieldKey: 'nearbyTransactions', resourceType: 'public_transaction_snapshot',
        sourceType: 'market_data', sourceName: '국토교통부 실거래가 공개자료',
        sourceReference: `${result.address.region2} 최근 6개월`, collectedAt: now,
        // Public transaction rows are candidates (masked lots, other buildings), never confirmed comparables. A
        // 'confirmed' status here used to make the report's nearbyTransactions field look confirmed by automation alone.
        verificationStatus: 'imported',
        metadata: { market: result.market, explicitFields: ['nearbyTransactions'], evidenceSemantics: 'transaction_candidates_not_confirmed_comparables' },
        createdAt: now,
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
    if (result.operatingBusinessEvidence && !['not_configured', 'provider_unavailable'].includes(result.operatingBusinessEvidence.state)) {
      await propertyDataRoomRepository.saveDataSource({
        id: `operating-businesses:${propertyId}`, propertyId, fieldKey: 'occupancyStatus', resourceType: 'operating_business_evidence',
        sourceType: 'public_api', sourceName: result.sources?.operatingBusinesses || '소상공인시장진흥공단 상가(상권)정보',
        sourceReference: result.address.lotAddress, collectedAt: now,
        verificationStatus: 'imported',
        metadata: {
          evidence: result.operatingBusinessEvidence,
          evidenceSemantics: 'commercial_activity_supporting_evidence_only',
          occupancyConfirmed: false,
        },
        createdAt: now,
      });
    }
    if (result.kakaoPoiEvidence && result.kakaoPoiEvidence.state !== 'not_configured') {
      await propertyDataRoomRepository.saveDataSource({
        id: `kakao-poi-activity:${propertyId}`, propertyId, fieldKey: 'occupancyStatus', resourceType: 'kakao_poi_activity_evidence',
        sourceType: 'map_provider', sourceName: result.sources?.kakaoPoi || 'Kakao Local Category Search',
        sourceReference: result.address.roadAddress || result.address.lotAddress, collectedAt: now,
        verificationStatus: 'imported',
        metadata: {
          evidence: result.kakaoPoiEvidence,
          evidenceSemantics: 'commercial_activity_supporting_evidence_only',
          occupancyConfirmed: false,
        },
        createdAt: now,
      });
    }
  },
};
