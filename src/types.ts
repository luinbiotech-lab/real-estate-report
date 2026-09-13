export type TradeType = '매매' | '전세' | '월세';
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

export interface Property {
  id: string; propertyNumber: string; name: string; buildingName: string; tradeType: TradeType;
  salePrice: number; deposit: number; monthlyRent: number; negotiable: boolean; occupancyStatus: string;
  address: string; detailAddress: string; latitude?: number; longitude?: number; nearbyStation: string; stationDistance: string; roadCondition: string;
  landAreaPyeong: number; landAreaSqm: number; totalFloorAreaPyeong: number; totalFloorAreaSqm: number; buildingAreaPyeong: number;
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
  createdAt: string; updatedAt: string;
}

export interface Settings { companyName: string; logo: string; defaultManager: string; phone: string; email: string; footerText: string }

export const emptyProperty: Property = {
  id: '', propertyNumber: '', name: '', buildingName: '', tradeType: '매매', salePrice: 0, deposit: 0, monthlyRent: 0,
  negotiable: false, occupancyStatus: '', address: '', detailAddress: '', nearbyStation: '', stationDistance: '', roadCondition: '',
  landAreaPyeong: 0, landAreaSqm: 0, totalFloorAreaPyeong: 0, totalFloorAreaSqm: 0, buildingAreaPyeong: 0,
  zoning: '', mainUse: '', structure: '', basementFloors: 0, groundFloors: 0, completionDate: '', buildingCoverageRate: 0,
  floorAreaRatio: 0, elevator: '', parkingSpaces: 0, features: '', investmentPoints: '', locationAnalysis: '', developmentPlan: '',
  recommendedUse: '', risks: '', overallOpinion: '', nearbyTransactions: '', managerName: '', managerPhone: '', managerEmail: '',
  companyName: '', mainImage: '', additionalImages: [], mapImage: '', locationAnalysisImage: '', briefingItems: [], briefingUpdatedAt: '',
  createdAt: '', updatedAt: '',
};
