/*
 * R-ONE Open API helpers (pure, testable). Verified 2026-11-03 from GitHub runner in sample mode:
 *  - SttsApiTbl.do (table list) → {SttsApiTbl:[{head:[{list_total_count},{RESULT}]},{row:[{STATBL_ID,STATBL_NM,DTACYCLE_CD,...}]}]}
 *  - SttsApiTblItm.do / SttsApiTblData.do without required params → {RESULT:{CODE:'ERROR-300',...}}
 *  - Unknown service → ERROR-310. Success code INFO-000.
 * Parameter names follow the R-ONE developer guide (STATBL_ID, DTACYCLE_CD, CLS_ID, ITM_ID, START_WRTTIME, END_WRTTIME).
 */
export const RONE_BASE = 'https://www.reb.or.kr/r-one/openapi';

export const RONE_OPS = {
  tables: { service: 'SttsApiTbl', required: [], allowed: ['STATBL_ID'] },
  items: { service: 'SttsApiTblItm', required: ['STATBL_ID'], allowed: ['STATBL_ID'] },
  data: { service: 'SttsApiTblData', required: ['STATBL_ID', 'DTACYCLE_CD'], allowed: ['STATBL_ID', 'DTACYCLE_CD', 'CLS_ID', 'ITM_ID', 'START_WRTTIME', 'END_WRTTIME', 'WRTTIME_IDTFR_ID'] },
};

const SAFE = /^[A-Za-z0-9_]{1,40}$/;

export function buildRoneUrl(op, params, key) {
  const spec = RONE_OPS[op];
  if (!spec) throw new Error(`알 수 없는 op: ${op}`);
  const query = new URLSearchParams({ Type: 'json' });
  if (key) query.set('KEY', key);
  for (const name of spec.allowed) {
    const value = params.get(name);
    if (value == null || value === '') continue;
    if (!SAFE.test(value)) throw new Error(`${name} 값 형식이 올바르지 않습니다.`);
    query.set(name, value);
  }
  for (const name of spec.required) if (!query.get(name)) throw new Error(`${name}가 필요합니다.`);
  const pIndex = Number(params.get('pIndex') || 1), pSize = Number(params.get('pSize') || 100);
  query.set('pIndex', String(Number.isInteger(pIndex) && pIndex > 0 && pIndex <= 100 ? pIndex : 1));
  query.set('pSize', String(Number.isInteger(pSize) && pSize > 0 && pSize <= 1000 ? pSize : 100));
  return `${RONE_BASE}/${spec.service}.do?${query}`;
}

/** Normalises the R-ONE envelope; never echoes the request URL (it carries the key). */
export function parseRoneResponse(op, status, text) {
  let body;
  try { body = JSON.parse(text); } catch { return { ok: false, op, code: `HTTP_${status}`, message: 'JSON이 아닌 응답', rows: [], total: 0 }; }
  const service = RONE_OPS[op].service;
  if (body?.RESULT && !body[service]) return { ok: false, op, code: String(body.RESULT.CODE || ''), message: String(body.RESULT.MESSAGE || ''), rows: [], total: 0 };
  const parts = Array.isArray(body?.[service]) ? body[service] : [];
  const head = parts.find((part) => part.head)?.head || [];
  const result = head.find((item) => item.RESULT)?.RESULT || {};
  const total = Number(head.find((item) => item.list_total_count != null)?.list_total_count || 0);
  const rows = parts.find((part) => part.row)?.row || [];
  const code = String(result.CODE || '');
  return { ok: code.startsWith('INFO'), op, code, message: String(result.MESSAGE || ''), total, rows };
}
