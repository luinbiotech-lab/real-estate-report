// POST /api/report-pdf — fixed-engine DA:ON report PDF (2026-11-16).
// The browser that shows a 1P or detail report sends the same data it displays (images inlined); this function renders
// it with headless Chromium and the bundled fonts and returns application/pdf. Nothing is stored: the payload lives only
// for the request. No secrets are read or exposed. Pages are printed by one engine, so a report looks the same whether it
// was requested from an iPhone, Android, Windows or Mac browser.
import path from 'node:path';
import { allowedOrigin, fail, securityHeaders } from './_lib/providerProxy.mjs';
import { MAX_REPORT_PDF_BODY_BYTES, renderReportPdf, reportPdfFileName, validateReportPdfPayload } from './_lib/reportPdf.mjs';

let browserPromise;
async function launchBrowser() {
  const { chromium } = await import('playwright-core');
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const { default: serverless } = await import('@sparticuz/chromium');
    return chromium.launch({ executablePath: await serverless.executablePath(), args: serverless.args, headless: true });
  }
  // Local development / CI: Playwright's own Chromium (same major version as @sparticuz/chromium in package.json).
  return chromium.launch({ headless: true, ...(process.env.REPORT_PDF_CHROMIUM ? { executablePath: process.env.REPORT_PDF_CHROMIUM } : {}) });
}
async function sharedBrowser() {
  if (!browserPromise) browserPromise = launchBrowser().catch((error) => { browserPromise = undefined; throw error; });
  const browser = await browserPromise;
  if (!browser.isConnected()) { browserPromise = undefined; return sharedBrowser(); }
  return browser;
}

async function readJsonBody(request) {
  if (request.body !== undefined && request.body !== null && typeof request.body !== 'string' && !Buffer.isBuffer(request.body)) return request.body;
  let raw = typeof request.body === 'string' || Buffer.isBuffer(request.body) ? Buffer.from(request.body) : undefined;
  if (!raw) {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > MAX_REPORT_PDF_BODY_BYTES) throw Object.assign(new Error('too large'), { code: 'PAYLOAD_TOO_LARGE' });
      chunks.push(chunk);
    }
    raw = Buffer.concat(chunks);
  }
  if (raw.length > MAX_REPORT_PDF_BODY_BYTES) throw Object.assign(new Error('too large'), { code: 'PAYLOAD_TOO_LARGE' });
  return JSON.parse(raw.toString('utf8'));
}

export default async function handler(request, response) {
  const origin = allowedOrigin(request);
  if (!origin) return fail(response, 403, 'ORIGIN_NOT_ALLOWED', '허용되지 않은 origin입니다.');
  if (request.method === 'OPTIONS') {
    response.statusCode = 204;
    for (const [key, value] of Object.entries({ ...securityHeaders(origin), 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type' })) response.setHeader(key, value);
    return response.end();
  }
  if (request.method !== 'POST') return fail(response, 405, 'METHOD_NOT_ALLOWED', 'POST 요청만 지원합니다.', origin);
  let payload;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    if (error?.code === 'PAYLOAD_TOO_LARGE') return fail(response, 413, 'PAYLOAD_TOO_LARGE', '보고서 자료(사진 포함)가 너무 큽니다. 사진 수를 줄여 다시 시도해 주세요.', origin);
    return fail(response, 400, 'INVALID_JSON', '보고서 자료를 읽지 못했습니다.', origin);
  }
  const invalid = validateReportPdfPayload(payload);
  if (invalid) return fail(response, 400, 'INVALID_REQUEST', invalid, origin);
  try {
    const browser = await sharedBrowser();
    const { pdf, layout } = await renderReportPdf({ browser, distDir: path.join(process.cwd(), 'dist'), payload });
    response.statusCode = 200;
    for (const [key, value] of Object.entries({
      ...securityHeaders(origin),
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${reportPdfFileName(payload)}"`,
      'x-report-pages': String(layout.pages),
      'x-report-broken-images': String(layout.brokenImages),
      'access-control-expose-headers': 'x-report-pages, x-report-broken-images, content-disposition',
    })) response.setHeader(key, value);
    return response.end(pdf);
  } catch (error) {
    const message = error?.code === 'RENDER_FAILED' ? `보고서를 그리지 못했습니다: ${String(error.message).slice(0, 200)}` : 'PDF 생성 서버 오류입니다. 잠시 후 다시 시도해 주세요.';
    return fail(response, error?.code === 'RENDER_FAILED' ? 422 : 500, error?.code === 'RENDER_FAILED' ? 'RENDER_FAILED' : 'PDF_ENGINE_FAILED', message, origin);
  }
}
