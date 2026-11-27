export type TradeType = '매매' | '전세' | '월세';
export type ListingStatus = 'unknown' | 'daon_exclusive' | 'daon_active' | 'external_observed' | 'off_market_confirmed';
export type BriefingCategory = 'fashion' | 'beauty' | 'food' | 'officeCulture' | 'transport' | 'development' | 'other';
export interface BriefingItem {
  category: BriefingCategory; name: string; description: string;
  source?: 'manual' | 'kakao'; distanceMeters?: number; latitude?: number; longitude?: number;
  brandMapVisible?: boolean;
}
export interface BrandMapSettings { radiusMeters: 500 | 1000 | 2000; maxMarkers: 8 | 12 | 16 | 20 }
export interface StreetViewVerification {
  provider?: 'naver' | 'kakao'; panoId?: string; checkedAt?: string; photoDate?: string;
}

/**
 * Provenance class of a Property record (Issue #9/#12). Optional for backward compatibility: records written before
 * this field existed (IndexedDB and the remote `properties.payload` jsonb) are classified by legacy markers instead.
 * operational = the operator's real inventory; sample = demo/showcase record; qa_fixture = automated test data.
 */
export type PropertyRecordClass = 'operational' | 'sample' | 'qa_fixture';

export interface Property {
  id: string; propertyNumber: string; name: string; buildingName: string; tradeType: TradeType;
  salePrice: number; deposit: number; monthlyRent: number; negotiable: boolean; occupancyStatus: string;
  listingStatus?: ListingStatus; listingStatusSource?: string; listingStatusCheckedAt?: string; listingStatusNote?: string;
  address: string; detailAddress: string; latitude?: number; longitude?: number; nearbyStation: string; stationDistance: string; roadCondition: string;
  landAreaPyeong: number; landAreaSqm: number; totalFloorAreaPyeong: number; totalFloorAreaSqm: number; buildingAreaPyeong: number;
  officialLandPricePerSqm?: number; estimatedOfficialLandValue?: number; officialLandPriceYear?: string;
  landCategory?: string; landUseSituation?: string;
  /** Broker-confirmed achievable price (KRW) and its rationale (owner decision 2026-11-01: auto estimate + broker confirms). Not an appraisal. */
  brokerAchievablePrice?: number; brokerAchievablePriceRationale?: string; brokerAchievablePriceConfirmedAt?: string;
  /**
   * Optional broker-checked short labels for the 1P status/highlight chips (owner decision 2026-11-04, Luin review on
   * PR #46). When blank the stored original sentence is printed as written; nothing is shortened automatically.
   */
  reportPurpose?: 'exclusive_sale' | 'analysis'; shortHeadline?: string; shortOccupancyLabel?: string; shortRoadLabel?: string; shortUseLabel?: string; shortDevelopmentLabel?: string;
  zoning: string; mainUse: string; structure: string; basementFloors: number; groundFloors: number; completionDate: string;
  buildingCoverageRate: number; floorAreaRatio: number; elevator: string;
  /** Legacy parking field retained for backward compatibility. */
  parkingSpaces: number;
  /** Official/public-record parking count. */
  parkingOfficial?: number;
  /** Field-observed usable parking count. Never present as an official count. */
  parkingField?: number;
  parkingFieldNote?: string;
  features: string; investmentPoints: string; locationAnalysis: string; developmentPlan: string; recommendedUse: string;
  risks: string; overallOpinion: string; nearbyTransactions: string;
  managerName: string; managerPhone: string; managerEmail: string; companyName: string;
  mainImage: string; additionalImages: string[]; mapImage: string; locationAnalysisImage: string;
  internalPhotoAllowed?: boolean;
  streetViewVerification?: StreetViewVerification;
  briefingItems: BriefingItem[]; briefingUpdatedAt: string;
  brandMapSettings?: BrandMapSettings;
  /** Explicit provenance class; when absent, see classifyPropertyRecord(). */
  recordClass?: PropertyRecordClass;
  /** Who/what set recordClass (e.g. 'local-bootstrap', 'owner'), for audit. */
  recordClassSource?: string;
  createdAt: string; updatedAt: string;
}

export interface Settings {
  companyName: string;
  brandSlogan: string;
  logo: string;
  defaultManager: string;
  phone: string;
  email: string;
  footerText: string;
  reportContactMode: 'mobile_email_only';
  /** 중개사무소 표시사항 (2026-11-26): shown on every public listing; publishing is blocked until all are filled. */
  brokerOffice?: BrokerOffice;
}

/** The brokerage that advertises public listings (공인중개사법 제18조의2 광고 표시사항 — ASSUMPTION, 원문 대조 필요). */
export interface BrokerOffice {
  name: string;
  address: string;
  phone: string;
  registrationNumber: string;
  representative: string;
  /** 2026-11-27 루인 #86 RB-5a07a4d: where the operator confirmed the registration (not shown publicly). */
  registrationCheckSource?: string;
  /** YYYY-MM-DD the registration was confirmed against an official source. */
  registrationCheckedAt?: string;
}

/** Official places to confirm a brokerage registration. Typing values alone is not proof; one of these must be checked. */
export const REGISTRATION_CHECK_SOURCES = ['국가공간정보포털 부동산중개업 조회', '시·군·구청 중개사무소 등록증 대조'] as const;
export const REGISTRATION_CHECK_LABEL = '등록정보 확인(확인 방법·확인일)';

export const BROKER_OFFICE_FIELDS: Array<{ key: keyof BrokerOffice; label: string }> = [
  { key: 'name', label: '중개사무소 명칭' },
  { key: 'address', label: '소재지' },
  { key: 'phone', label: '연락처' },
  { key: 'registrationNumber', label: '등록번호' },
  { key: 'representative', label: '대표 공인중개사 성명' },
];

export function missingBrokerOfficeFields(office: Partial<BrokerOffice> | null | undefined): string[] {
  const missing = BROKER_OFFICE_FIELDS.filter((field) => !String(office?.[field.key] ?? '').trim()).map((field) => field.label);
  const sourceOk = (REGISTRATION_CHECK_SOURCES as readonly string[]).includes(String(office?.registrationCheckSource ?? ''));
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(String(office?.registrationCheckedAt ?? ''));
  if (!sourceOk || !dateOk) missing.push(REGISTRATION_CHECK_LABEL);
  return missing;
}

export const emptyProperty: Property = {
  id: '', propertyNumber: '', name: '', buildingName: '', tradeType: '매매', salePrice: 0, deposit: 0, monthlyRent: 0,
  negotiable: false, occupancyStatus: '', listingStatus: 'unknown', listingStatusSource: '', listingStatusCheckedAt: '', listingStatusNote: '', address: '', detailAddress: '', nearbyStation: '', stationDistance: '', roadCondition: '',
  landAreaPyeong: 0, landAreaSqm: 0, totalFloorAreaPyeong: 0, totalFloorAreaSqm: 0, buildingAreaPyeong: 0,
  officialLandPricePerSqm: 0, estimatedOfficialLandValue: 0, officialLandPriceYear: '', landCategory: '', landUseSituation: '',
  zoning: '', mainUse: '', structure: '', basementFloors: 0, groundFloors: 0, completionDate: '', buildingCoverageRate: 0,
  floorAreaRatio: 0, elevator: '', parkingSpaces: 0, features: '', investmentPoints: '', locationAnalysis: '', developmentPlan: '',
  recommendedUse: '', risks: '', overallOpinion: '', nearbyTransactions: '', managerName: '', managerPhone: '', managerEmail: '',
  companyName: '', mainImage: '', additionalImages: [], mapImage: '', locationAnalysisImage: '', briefingItems: [], briefingUpdatedAt: '',
  createdAt: '', updatedAt: '',
};