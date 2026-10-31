import type { Property } from '../../types';
import type { ProfessionalReportViewModel, ReportValue } from './types';

/*
 * Blank-value policy for the DA:ON 1P/7P MASTER (owner decision 2026-10-30).
 *
 * 1. A field without a value is never printed as a "확인 필요" placeholder; the MASTER hides it.
 * 2. Before a report is published (1P print/PDF, 7P confirm or print) the user is shown which fields are blank and is asked
 *    whether to enter them first. Only after the user explicitly chooses to continue is the report published with those
 *    fields hidden, and the page keeps saying so.
 * The lists below are the single source for both the pre-publish check and the regression validator, so the check can
 * never drift from what the MASTER actually hides.
 *
 * Mixed policy (owner decision 2026-10-31, after "빈 항목 때문에 페이지마다 공백이 생긴다"):
 * 3. Core fields (REQUIRED_REPORT_FIELD_KEYS) can never be hidden — publishing is blocked until they are entered.
 * 4. Other blanks are hidden AND the remaining items move forward within the same row/strip, so no empty slot is left.
 * 5. 7P detail pages without enough real content are omitted as a whole (see detailPagePlan in reportLayoutFill.ts).
 */

export type ReportBlankFieldGroup = '가격' | '공적자료' | '현장·이용' | '입지' | '투자 검토';

export interface ReportBlankField {
  key: string;
  label: string;
  group: ReportBlankFieldGroup;
  /** Core field: cannot be hidden; publishing waits until it is entered. */
  required?: boolean;
}

/** Core fields of both 1P and 7P (owner decision 2026-10-31). */
export const REQUIRED_REPORT_FIELD_KEYS = ['salePrice', 'address', 'landArea', 'totalFloorArea', 'mainUse', 'zoning'] as const;
const markRequired = (field: ReportBlankField): ReportBlankField =>
  (REQUIRED_REPORT_FIELD_KEYS as readonly string[]).includes(field.key) ? { ...field, required: true } : field;

/** Blank core fields — while any remain, the report cannot be published (no "hide and continue"). */
export function requiredBlankFields(fields: ReportBlankField[]) {
  return fields.filter((field) => field.required);
}

export const REPORT_REQUIRED_NOTICE = '핵심 항목(희망매매가·주소·토지면적·연면적·주용도·용도지역)은 숨길 수 없어, 입력해야 발행할 수 있습니다.';

/** Placeholder phrases that must never be printed in a published MASTER (they read as data but carry none). */
export const REPORT_PLACEHOLDER_PATTERN = /확인 필요|검토 필요|분석 필요/;

export const REPORT_BLANK_HIDE_NOTICE = '입력되지 않은 항목은 리포트에서 숨김 처리되어 발행됩니다.';

export function isBlankText(value: string | null | undefined) {
  return !value || !value.trim();
}

const blankNumber = (value: number | null | undefined) => typeof value !== 'number' || !Number.isFinite(value) || value <= 0;
const blankCount = (value: number | null | undefined) => typeof value !== 'number' || !Number.isFinite(value);
const blankLines = (value: string | null | undefined) => isBlankText(value) || !String(value).split(/\r?\n|[•]/).some((line) => line.trim());

/** Fields the 1P MASTER would hide for this property. Order follows the sheet top → bottom. */
export function onePageBlankFields(p: Property): ReportBlankField[] {
  const checks: Array<[boolean, ReportBlankField]> = [
    [blankNumber(p.salePrice), { key: 'salePrice', label: '희망매매가', group: '가격' }],
    [blankNumber(p.landAreaPyeong) && blankNumber(p.landAreaSqm), { key: 'landArea', label: '토지면적', group: '공적자료' }],
    [blankNumber(p.totalFloorAreaPyeong) && blankNumber(p.totalFloorAreaSqm), { key: 'totalFloorArea', label: '연면적', group: '공적자료' }],
    [isBlankText(p.address), { key: 'address', label: '주소', group: '공적자료' }],
    [isBlankText(p.mainUse), { key: 'mainUse', label: '주용도', group: '공적자료' }],
    [isBlankText(p.zoning), { key: 'zoning', label: '용도지역', group: '공적자료' }],
    [isBlankText(p.landCategory), { key: 'landCategory', label: '지목', group: '공적자료' }],
    [isBlankText(p.completionDate), { key: 'completionDate', label: '사용승인일', group: '공적자료' }],
    [blankNumber(p.buildingAreaPyeong), { key: 'buildingArea', label: '건축면적', group: '공적자료' }],
    [blankNumber(p.groundFloors) && blankNumber(p.basementFloors), { key: 'floors', label: '규모(층수)', group: '공적자료' }],
    [blankCount(p.parkingOfficial) && blankCount(p.parkingSpaces), { key: 'parkingOfficial', label: '공부상 주차', group: '공적자료' }],
    [blankCount(p.parkingField), { key: 'parkingField', label: '현장 주차', group: '현장·이용' }],
    [blankLines(p.occupancyStatus), { key: 'occupancyStatus', label: '현재 이용·명도', group: '현장·이용' }],
    [blankLines(p.roadCondition), { key: 'roadCondition', label: '도로 조건', group: '입지' }],
    [isBlankText(p.nearbyStation), { key: 'nearbyStation', label: '인근역', group: '입지' }],
    [isBlankText(p.stationDistance), { key: 'stationDistance', label: '역 접근거리', group: '입지' }],
    [blankLines(p.locationAnalysis), { key: 'locationAnalysis', label: '입지·배후수요 분석', group: '입지' }],
    [blankLines(p.features) && blankLines(p.investmentPoints), { key: 'investmentPoints', label: '핵심 투자포인트', group: '투자 검토' }],
    [blankLines(p.recommendedUse), { key: 'recommendedUse', label: '활용 제안', group: '투자 검토' }],
    [blankLines(p.developmentPlan), { key: 'developmentPlan', label: '개발·인허가 계획', group: '투자 검토' }],
  ];
  return checks.filter(([blank]) => blank).map(([, field]) => markRequired(field));
}

const blankValue = (item: ReportValue<unknown> | undefined) => !item || item.value === null || item.value === undefined || item.value === ''
  || (Array.isArray(item.value) && item.value.length === 0);

/** Fields the 7P MASTER would hide for this snapshot view model. */
export function detailBlankFields(model: ProfessionalReportViewModel): ReportBlankField[] {
  const checks: Array<[boolean, ReportBlankField]> = [
    [blankValue(model.pricing.salePrice), { key: 'salePrice', label: '희망매매가', group: '가격' }],
    [blankValue(model.pricing.landUnitPrice), { key: 'landUnitPrice', label: '토지 평당가', group: '가격' }],
    [blankValue(model.identity.address), { key: 'address', label: '소재지', group: '공적자료' }],
    [blankValue(model.land.landAreaSqm) && blankValue(model.land.landAreaPyeong), { key: 'landArea', label: '토지면적', group: '공적자료' }],
    [blankValue(model.building.totalFloorAreaSqm) && blankValue(model.building.totalFloorAreaPyeong), { key: 'totalFloorArea', label: '연면적', group: '공적자료' }],
    [blankValue(model.building.buildingAreaPyeong), { key: 'buildingArea', label: '건축면적', group: '공적자료' }],
    [blankValue(model.building.structure), { key: 'structure', label: '구조', group: '공적자료' }],
    [blankValue(model.building.mainUse), { key: 'mainUse', label: '주용도', group: '공적자료' }],
    [blankValue(model.land.zoning), { key: 'zoning', label: '용도지역', group: '공적자료' }],
    [blankValue(model.building.completionDate), { key: 'completionDate', label: '사용승인일', group: '공적자료' }],
    [blankValue(model.building.buildingCoverageRate), { key: 'buildingCoverageRate', label: '건폐율', group: '공적자료' }],
    [blankValue(model.building.floorAreaRatio), { key: 'floorAreaRatio', label: '용적률', group: '공적자료' }],
    [blankValue(model.building.parkingOfficial), { key: 'parkingOfficial', label: '공부상 주차', group: '공적자료' }],
    [blankValue(model.building.parkingField), { key: 'parkingField', label: '현장 주차', group: '현장·이용' }],
    [blankValue(model.pricing.occupancyStatus), { key: 'occupancyStatus', label: '현재 이용·명도', group: '현장·이용' }],
    [blankValue(model.land.roadCondition), { key: 'roadCondition', label: '도로 조건', group: '입지' }],
    [blankValue(model.location.locationAnalysis), { key: 'locationAnalysis', label: '입지·배후수요 분석', group: '입지' }],
    [blankValue(model.investment.investmentPoints) && blankValue(model.investment.features), { key: 'investmentPoints', label: '매입 검토 포인트', group: '투자 검토' }],
    [blankValue(model.investment.recommendedUse), { key: 'recommendedUse', label: '활용 시나리오', group: '투자 검토' }],
    [blankValue(model.investment.developmentPlan), { key: 'developmentPlan', label: '개발·신축 검토', group: '투자 검토' }],
    [blankValue(model.investment.overallOpinion), { key: 'overallOpinion', label: '종합 의견', group: '투자 검토' }],
    [blankValue(model.risks.risks), { key: 'risks', label: '권리·리스크', group: '투자 검토' }],
  ];
  return checks.filter(([blank]) => blank).map(([, field]) => markRequired(field));
}

export type ReportPublishAction = 'print' | 'finalize';

/**
 * Pre-publish decision. Blank fields always require one explicit acknowledgement per page visit before publishing; the
 * acknowledgement is tied to the exact blank set, so entering or clearing a value invalidates it.
 */
export function blankFieldsSignature(fields: ReportBlankField[]) {
  return fields.map((field) => field.key).sort().join('|');
}

export function needsBlankFieldConfirmation(fields: ReportBlankField[], acknowledgedSignature: string | null) {
  // A blank core field can never be acknowledged away.
  if (requiredBlankFields(fields).length > 0) return true;
  return fields.length > 0 && acknowledgedSignature !== blankFieldsSignature(fields);
}

export function blankFieldsSummary(fields: ReportBlankField[]) {
  if (!fields.length) return '';
  return fields.map((field) => field.label).join(', ');
}
