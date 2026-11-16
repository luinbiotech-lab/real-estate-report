import type { AchievablePriceEstimate } from '../domain/professionalReport/priceLayerView';
import type { ReportSnapshot } from '../domain/propertyDataRoom/types';
import type { Property } from '../types';

/*
 * Fixed-engine report PDF (2026-11-16, owner: "형식이 변하지 않고 유지가 돼야" — the same report on every device).
 * The browser that shows the report sends this payload to /api/report-pdf; the server renders it in headless Chromium
 * with the bundled fonts (render.html) and returns the PDF. Images travel inline (data: URLs) so the renderer never
 * fetches anything from the network: the result depends only on the payload and the deployed bundle.
 */

export const REPORT_RENDER_PAYLOAD_VERSION = 1;
export const MAX_RENDER_IMAGES = 40;

export type ReportRenderPayload =
  | { version: 1; kind: 'proposal'; property: Property; priceEstimate: AchievablePriceEstimate | null; images: Record<string, string> }
  | { version: 1; kind: 'detail'; snapshot: ReportSnapshot; images: Record<string, string> };

export type ParsedRenderPayload = { ok: true; payload: ReportRenderPayload } | { ok: false; error: string };

const DATA_IMAGE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Shape check shared by the render page and (as a mirror in api/_lib/reportPdf.mjs) by the server. */
export function parseReportRenderPayload(value: unknown): ParsedRenderPayload {
  if (!isObject(value)) return { ok: false, error: '보고서 자료가 없습니다.' };
  if (value.version !== REPORT_RENDER_PAYLOAD_VERSION) return { ok: false, error: `지원하지 않는 보고서 자료 버전입니다: ${String(value.version)}` };
  const images = value.images ?? {};
  if (!isObject(images)) return { ok: false, error: '이미지 목록 형식이 올바르지 않습니다.' };
  const entries = Object.entries(images);
  if (entries.length > MAX_RENDER_IMAGES) return { ok: false, error: `이미지가 너무 많습니다(${entries.length}개, 최대 ${MAX_RENDER_IMAGES}개).` };
  for (const [key, data] of entries) {
    if (!key || typeof data !== 'string' || !DATA_IMAGE.test(data)) return { ok: false, error: '이미지는 PNG·JPEG·WebP data URL만 받을 수 있습니다.' };
  }
  if (value.kind === 'proposal') {
    const property = value.property;
    if (!isObject(property) || typeof property.id !== 'string' || !property.id || typeof property.name !== 'string') return { ok: false, error: '1P 보고서의 물건 정보가 올바르지 않습니다.' };
    const priceEstimate = value.priceEstimate ?? null;
    if (priceEstimate !== null && !isObject(priceEstimate)) return { ok: false, error: '가격 추정 형식이 올바르지 않습니다.' };
    return { ok: true, payload: { version: 1, kind: 'proposal', property: property as unknown as Property, priceEstimate: priceEstimate as AchievablePriceEstimate | null, images: images as Record<string, string> } };
  }
  if (value.kind === 'detail') {
    const snapshot = value.snapshot;
    if (!isObject(snapshot) || typeof snapshot.id !== 'string' || typeof snapshot.propertyId !== 'string' || !isObject(snapshot.snapshotData)) return { ok: false, error: '상세 보고서 Snapshot 형식이 올바르지 않습니다.' };
    return { ok: true, payload: { version: 1, kind: 'detail', snapshot: snapshot as unknown as ReportSnapshot, images: images as Record<string, string> } };
  }
  return { ok: false, error: `지원하지 않는 보고서 종류입니다: ${String(value.kind)}` };
}

/**
 * Replace every string that exactly equals an original image address with its inline copy. Exact-match only, so text
 * fields are never rewritten; an address the client could not inline stays as it is and the renderer shows it blank
 * (the renderer has no network), which the client warns about before sending.
 */
export function substituteImages<T>(value: T, images: Record<string, string>): T {
  if (!Object.keys(images).length) return value;
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') return Object.prototype.hasOwnProperty.call(images, node) ? images[node] : node;
    if (Array.isArray(node)) return node.map(walk);
    if (isObject(node)) return Object.fromEntries(Object.entries(node).map(([key, child]) => [key, walk(child)]));
    return node;
  };
  return walk(value) as T;
}
