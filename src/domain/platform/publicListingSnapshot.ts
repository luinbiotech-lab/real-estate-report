/*
 * Public listing snapshot (2026-11-16, 루인 #65 review: "client-side masking is insufficient if raw records are sent").
 * The public listing page and the explore cards render ONLY from this allowlist object, never from the Property row or
 * the Data Room bundle. Phase 2 (public posting) builds the same object on the server and stores it as the public row,
 * so a buyer's browser receives exactly these fields and nothing else.
 *
 * Left out on purpose: internal property id, property name (can carry the lot number), full address / lot / detail
 * address, owner, tenant, manager name / phone / email, company, notes, risk notes, listing-status notes, comparable deal
 * rows (only count / range / latest date travel), free-text source names (they are often upload file names such as
 * "방배동 815-11 등기부등본.pdf"), and photos that are policy-blocked or carry a signed / expiring URL.
 * Pure functions: the privacy validator and the pages share them.
 */
import type { Property, PropertyRecordClass } from '../../types';
import { formatWon } from '../../utils/format';
import { internalPhotoAllowed } from '../professionalReport/reportAccessPolicy';
import { classifyPropertyRecord } from '../sampleProperty';
import { DOCUMENT_TYPE_LABELS } from '../propertyDataRoom/labels';
import { DEFAULT_ADDRESS_LEVEL, maskAddress, publicFacts, type AddressLevel, type FactBadge } from './publicListing';
import type { TrustGradeResult } from './trustGrade';
import type { DueDiligenceRow, FactEvidence } from './evidenceLedger';
import type { MarketPosition } from '../propertyDetail/marketPosition';

/** Lot numbers (815-11, 산12-3, 123번지), unit numbers (101호), building numbers after a road name, phone numbers, e-mail. */
const LOT = /(?<![\d-])산?\d{1,5}-\d{1,4}(?![\d-])/g;
const LOT_WORD = /(?<!\d)산?\d{1,5}\s*(번지|호)(?![가-힣])/g;
const ROAD_NUMBER = /((?:[가-힣0-9]+)(?:로|길))\s*\d{1,4}(?:-\d{1,4})?(?![\d가-힣A-Za-z㎡%.])/g;
const PHONE = /(?<!\d)0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/g;
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;

/** Strip anything that could locate the exact building or reach a person from a free-text public value. */
export function scrubPublicText(value: unknown): string {
  return String(value ?? '')
    .replace(EMAIL, '')
    .replace(PHONE, '')
    .replace(LOT, '')
    .replace(LOT_WORD, '')
    .replace(ROAD_NUMBER, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,)])/g, '$1')
    .trim();
}

/** Document / provider names a buyer may see. Anything else (file names, notes) is shown by its source type only. */
const PUBLIC_SOURCE_NAMES = new Set<string>([
  ...Object.values(DOCUMENT_TYPE_LABELS).filter((label) => label !== '기타'),
  '토지이용계획확인서', '건축물대장 표제부', '일반건축물대장', '집합건축물대장', '토지대장등본',
  '국토교통부 건축HUB 건축물대장정보', '국토교통부 건축HUB 건물에너지정보', '국토교통부 VWorld NED 토지정보',
  '국토교통부 실거래가 공개시스템', 'Kakao Local Address API',
]);

/** Public label for one evidence source: the allowlisted document name, else the source type, plus the source date. */
export function publicSourceLabel(name: string, typeLabel: string, date: string): string {
  const clean = String(name ?? '').trim();
  const label = PUBLIC_SOURCE_NAMES.has(clean) ? clean : typeLabel || '출처';
  return date ? `${label}(${date} 자료)` : label;
}

const SIGNED_URL = /[?&](token|sig|signature|x-amz-[a-z-]+|expires|se|sp|sv)=/i;

/** A photo travels only when the media policy allows it and its address is not a signed / expiring link. */
export function publicPhotoUrl(property: Pick<Property, 'mainImage'> & Parameters<typeof internalPhotoAllowed>[0]): string {
  const url = String(property.mainImage ?? '').trim();
  if (!url || !internalPhotoAllowed(property)) return '';
  if (SIGNED_URL.test(url)) return '';
  if (/^blob:|^file:/i.test(url)) return '';
  return url;
}

export interface PublicFactView {
  key: string;
  label: string;
  value: string;
  badge: FactBadge;
  /** Allowlisted evidence labels and the date a person confirmed the value. */
  proof?: { sources: string[]; verifiedAt: string };
}

export interface PublicListingSnapshot {
  place: string;
  title: string;
  mainUse: string;
  tradeType: string;
  priceText: string;
  salePrice: number;
  landAreaPyeong: number;
  recordClass: PropertyRecordClass;
  photo: string;
  /** Why there is no photo, when there is none. */
  photoNote: string;
  facts: PublicFactView[];
  pending: string[];
  grade?: TrustGradeResult;
  checklist?: DueDiligenceRow[];
  market?: Pick<MarketPosition, 'count' | 'min' | 'max' | 'latestTradeDate' | 'headline' | 'basis'>;
  readyReport?: { version: number; generatedAt: string };
}

/** What the listing page needs beyond the Property row (the Data Room derived parts). */
export interface PublicListingDetailInput {
  grade?: TrustGradeResult;
  verifiedFieldKeys?: ReadonlySet<string>;
  evidence?: ReadonlyMap<string, FactEvidence>;
  checklist?: DueDiligenceRow[];
  market?: MarketPosition;
  readyReport?: { version: number; generatedAt: string };
}

const positive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0;

export function buildPublicListingSnapshot(property: Property, detail: PublicListingDetailInput | null | undefined, level: AddressLevel = DEFAULT_ADDRESS_LEVEL): PublicListingSnapshot {
  const place = maskAddress(property.address, level) || '위치 확인 중';
  const mainUse = scrubPublicText(property.mainUse) || '건물';
  const facts = publicFacts(property, detail?.verifiedFieldKeys ?? new Set());
  const photo = publicPhotoUrl(property);
  return {
    place,
    title: `${place} ${mainUse}`,
    mainUse,
    tradeType: scrubPublicText(property.tradeType) || '매매',
    priceText: positive(property.salePrice) ? formatWon(property.salePrice) : '가격 확인 중',
    salePrice: positive(property.salePrice) ? property.salePrice : 0,
    landAreaPyeong: positive(property.landAreaPyeong) ? property.landAreaPyeong : 0,
    recordClass: classifyPropertyRecord(property).recordClass,
    photo,
    photoNote: photo ? '' : internalPhotoAllowed(property) ? '권리가 확인된 외관 사진이 아직 없습니다.' : '이 매물은 사진 공개 제한 정책이 적용됩니다.',
    facts: facts.shown.map((fact) => {
      const proof = detail?.evidence?.get(fact.key);
      return {
        key: fact.key,
        label: fact.label,
        value: fact.badge === 'calculated' ? fact.value : scrubPublicText(fact.value),
        badge: fact.badge,
        proof: proof ? { sources: proof.publicSources, verifiedAt: proof.verifiedAt } : undefined,
      };
    }).filter((fact) => fact.value),
    pending: facts.pending,
    grade: detail?.grade,
    checklist: detail?.checklist?.map((row) => ({ ...row, detail: scrubPublicText(row.detail) })),
    market: detail?.market ? {
      count: detail.market.count,
      min: detail.market.min,
      max: detail.market.max,
      latestTradeDate: detail.market.latestTradeDate,
      headline: scrubPublicText(detail.market.headline),
      basis: detail.market.basis.map(scrubPublicText),
    } : undefined,
    readyReport: detail?.readyReport,
  };
}

/** Every string a public snapshot carries, for the leak validator and the rendered smoke. */
export function publicSnapshotStrings(snapshot: PublicListingSnapshot): string[] {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === 'string') out.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') Object.values(node).forEach(walk);
  };
  walk(snapshot);
  return out;
}
