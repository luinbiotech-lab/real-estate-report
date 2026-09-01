import type { DataSourceType, DocumentType, VerificationStatus } from './types';

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  verified: '공식 확인', confirmed: '사용자 확인', imported: '외부자료', calculated: '시스템 계산',
  estimated: '추정', ai_analysis: 'AI 분석', unverified: '미확인', missing: '데이터 없음',
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  building_register: '건축물대장', land_register: '토지대장', land_use_plan: '토지이용계획', registry: '등기부등본',
  cadastral_map: '지적도', lease_status: '임대차 현황', floor_plan: '도면', appraisal: '감정평가서', contract: '계약서',
  financial: '재무자료', development: '개발자료', due_diligence: '실사자료', other: '기타',
};

export const SOURCE_TYPE_LABELS: Record<DataSourceType, string> = {
  manual: '사용자 입력', excel_import: '엑셀 등록', public_api: '공공 API', official_document: '공식 문서',
  map_provider: '지도 공급자', market_data: '시장 데이터', calculated: '시스템 계산', ai: 'AI', external: '외부 자료',
};

export const REQUIRED_DOCUMENT_TYPES: DocumentType[] = ['building_register', 'land_register', 'land_use_plan', 'registry'];
