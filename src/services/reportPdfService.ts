import type { ReportRenderPayload } from '../render/reportRenderPayload';

/*
 * Fixed-engine report PDF client (2026-11-16). The report is not printed by this device's browser any more (iOS print
 * ignored the A4 margins and shrank every page to ~88%); the shown data is sent to /api/report-pdf and the PDF that the
 * server's headless Chromium prints comes back. Photos are copied inline because the renderer has no network.
 */

export const MAX_PDF_REQUEST_CHARS = 4_100_000; // keep under the 4.5 MB serverless body limit
const MAX_IMAGE_EDGE = 1600;

export class ReportPdfError extends Error {
  constructor(message: string, readonly code: string) { super(message); }
}

/** Addresses that must be copied inline: anything the renderer could not load by itself. */
export function needsInlineCopy(src: string): boolean {
  if (!src) return false;
  if (src.startsWith('data:')) return false; // already travels inside the payload
  if (src.startsWith('/assets/')) return false; // part of the deployed bundle, served to the renderer
  return true;
}

async function toJpegDataUrl(blob: Blob, quality: number): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas unavailable');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', quality);
}

/** Copy every image shown in the report inline. Returns the map and the addresses that could not be copied. */
export async function collectReportImages(container: HTMLElement, quality = 0.86): Promise<{ images: Record<string, string>; failed: string[] }> {
  const sources = [...new Set([...container.querySelectorAll('img')].map((img) => img.getAttribute('src') || '').filter(needsInlineCopy))];
  const images: Record<string, string> = {};
  const failed: string[] = [];
  for (const src of sources) {
    try {
      const response = await fetch(src, { cache: 'force-cache' });
      if (!response.ok) throw new Error(String(response.status));
      images[src] = await toJpegDataUrl(await response.blob(), quality);
    } catch {
      failed.push(src);
    }
  }
  return { images, failed };
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { message?: string };
    if (body?.message) return body.message;
  } catch { /* not JSON */ }
  return `PDF 생성 서버 응답 오류 (${response.status})`;
}

/** Build the payload with inline photos, shrinking photo quality once if the request would be too large. */
export async function buildReportPdfRequest(container: HTMLElement, base: Omit<ReportRenderPayload, 'images'>): Promise<{ body: string; failed: string[] }> {
  for (const quality of [0.86, 0.7, 0.55]) {
    const { images, failed } = await collectReportImages(container, quality);
    const body = JSON.stringify({ ...base, images });
    if (body.length <= MAX_PDF_REQUEST_CHARS) return { body, failed };
  }
  throw new ReportPdfError('사진이 많거나 커서 PDF 요청 한도(약 4MB)를 넘습니다. 보고서에 쓰는 사진 수를 줄여 주세요.', 'PAYLOAD_TOO_LARGE');
}

/** POST the payload and return the PDF. Throws ReportPdfError with a user-facing Korean message. */
export async function requestReportPdf(body: string): Promise<{ blob: Blob; pages: number; brokenImages: number }> {
  let response: Response;
  try {
    response = await fetch('/api/report-pdf', { method: 'POST', headers: { 'content-type': 'application/json' }, body, cache: 'no-store' });
  } catch {
    throw new ReportPdfError('PDF 생성 서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.', 'NETWORK');
  }
  if (!response.ok) throw new ReportPdfError(await readError(response), `HTTP_${response.status}`);
  const blob = await response.blob();
  if (blob.type && !blob.type.includes('pdf')) throw new ReportPdfError('PDF가 아닌 응답을 받았습니다.', 'NOT_PDF');
  return { blob, pages: Number(response.headers.get('x-report-pages') || 0), brokenImages: Number(response.headers.get('x-report-broken-images') || 0) };
}

/** Save the PDF with the given name (works on desktop browsers and iOS/Android share or download). */
export function saveReportPdf(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
