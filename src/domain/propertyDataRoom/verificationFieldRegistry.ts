import type { Property } from '../../types';

export const VERIFICATION_FIELD_REGISTRY = {
  propertyNumber: '물건번호',
  name: '물건명',
  buildingName: '건물명',
  tradeType: '거래유형',
  salePrice: '매매가',
  deposit: '보증금',
  monthlyRent: '월세',
  negotiable: '협의여부',
  occupancyStatus: '명도상태',
  address: '주소',
  detailAddress: '상세주소',
  nearbyStation: '인근역',
  stationDistance: '역거리',
  roadCondition: '도로조건',
  landAreaPyeong: '대지면적(평)',
  landAreaSqm: '대지면적(㎡)',
  totalFloorAreaPyeong: '연면적(평)',
  totalFloorAreaSqm: '연면적(㎡)',
  buildingAreaPyeong: '건축면적(평)',
  zoning: '용도지역',
  mainUse: '주용도',
  structure: '구조',
  basementFloors: '지하층',
  groundFloors: '지상층',
  completionDate: '사용승인일',
  buildingCoverageRate: '건폐율',
  floorAreaRatio: '용적률',
  elevator: '승강기',
  parkingSpaces: '주차대수(레거시)',
  parkingOfficial: '공부상 주차대수',
  parkingField: '현장 주차대수',
  parkingFieldNote: '현장 주차 메모',
  features: '특징',
  investmentPoints: '투자포인트',
  locationAnalysis: '입지분석',
  developmentPlan: '개발계획',
  recommendedUse: '추천용도',
  risks: '리스크',
  overallOpinion: '종합의견',
  nearbyTransactions: '인근거래사례',
  managerName: '담당자',
  managerPhone: '담당자 연락처',
  managerEmail: '담당자 이메일',
  companyName: '회사명',
  internalPhotoAllowed: '내부사진 허용',
} as const satisfies Partial<Record<keyof Property, string>>;

export type VerificationFieldKey = keyof typeof VERIFICATION_FIELD_REGISTRY;

export function isVerificationFieldKey(value: string): value is VerificationFieldKey {
  return Object.prototype.hasOwnProperty.call(VERIFICATION_FIELD_REGISTRY, value);
}

export function verificationFieldLabel(value: string): string {
  return isVerificationFieldKey(value) ? VERIFICATION_FIELD_REGISTRY[value] : value;
}
