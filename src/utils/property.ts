import type { Property, TradeType } from '../types';
import { SQM_PER_PYEONG } from '../domain/professionalReport/calculations';

export const VALID_TRADE_TYPES: TradeType[] = ['매매', '전세', '월세'];

export function normalizeDate(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const text = String(value).trim().replace(/[./]/g, '-');
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : text;
}

export function normalizeProperty(property: Property): Property {
  const value = { ...property, completionDate: normalizeDate(property.completionDate) };
  if (value.landAreaPyeong > 0 && !value.landAreaSqm) value.landAreaSqm = Math.round(value.landAreaPyeong * SQM_PER_PYEONG * 100) / 100;
  else if (value.landAreaSqm > 0 && !value.landAreaPyeong) value.landAreaPyeong = Math.round(value.landAreaSqm / SQM_PER_PYEONG * 100) / 100;
  if (value.totalFloorAreaPyeong > 0 && !value.totalFloorAreaSqm) value.totalFloorAreaSqm = Math.round(value.totalFloorAreaPyeong * SQM_PER_PYEONG * 100) / 100;
  else if (value.totalFloorAreaSqm > 0 && !value.totalFloorAreaPyeong) value.totalFloorAreaPyeong = Math.round(value.totalFloorAreaSqm / SQM_PER_PYEONG * 100) / 100;
  return value;
}

export function validateProperty(property: Property): string[] {
  const errors: string[] = [];
  if (!property.name.trim()) errors.push('물건명 누락');
  if (!property.address.trim()) errors.push('주소 누락');
  if (!VALID_TRADE_TYPES.includes(property.tradeType)) errors.push('거래유형 오류');
  return errors;
}

export function isSameProperty(a: Property, b: Property): boolean {
  if (a.id === b.id) return false;
  if (a.propertyNumber && b.propertyNumber && a.propertyNumber === b.propertyNumber) return true;
  return Boolean(a.name && a.address && a.name === b.name && a.address === b.address);
}
