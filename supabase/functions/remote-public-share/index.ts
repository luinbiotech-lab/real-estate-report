// DA:ON Real Estate Platform — REMOTE / PUBLIC share Edge Function
// PREPARED ONLY. Deploy only to a dedicated real-estate Supabase project.
// This function intentionally accepts anonymous requests for token resolve/review,
// so deployment must disable platform JWT verification for this function while
// keeping issue/revoke/list protected by the explicit user/session checks below.

import { createClient } from 'npm:@supabase/supabase-js@2';

type Json = Record<string, unknown>;
type ShareRow = {
  id: string;
  property_id: string;
  snapshot_id: string;
  snapshot_payload: unknown;
  allow_download: boolean;
  recipient_note: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const PUBLIC_SHARE_BASE_URL = Deno.env.get('PUBLIC_SHARE_BASE_URL') ?? '';
const PUBLIC_SHARE_ALLOWED_ORIGINS = (Deno.env.get('PUBLIC_SHARE_ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('REMOTE / PUBLIC share server environment is incomplete.');
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function corsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function allowedOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return null;
  const sameOrigin = origin === new URL(req.url).origin;
  if (!sameOrigin && !PUBLIC_SHARE_ALLOWED_ORIGINS.includes(origin)) {
    throw new Response(JSON.stringify({ error: 'origin_not_allowed' }), {
      status: 403,
      headers: { 'content-type': 'application/json; charset=utf-8', 'Vary': 'Origin' },
    });
  }
  return origin;
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...corsHeaders(origin),
    },
  });
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const entries = Object.entries(value as Json)
    .filter(([, child]) => child !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalize(child)}`).join(',')}}`;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function createRawToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function text(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function optionalFutureIso(value: unknown) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new Error('expiresAt must be an ISO date string.');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('expiresAt is invalid.');
  if (date.getTime() <= Date.now()) throw new Error('expiresAt must be in the future.');
  return date.toISOString();
}

function sanitizeSnapshot(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeSnapshot);
  if (!value || typeof value !== 'object') return value;
  const blocked = /(password|secret|private[_-]?key|service[_-]?role|raw[_-]?token|token[_-]?hash)/i;
  return Object.fromEntries(
    Object.entries(value as Json)
      .filter(([key]) => !blocked.test(key))
      .map(([key, child]) => [key, sanitizeSnapshot(child)]),
  );
}

async function validateSnapshot(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('snapshot is required.');
  const row = snapshot as Json;
  const id = text(row.id, 300);
  const propertyId = text(row.propertyId, 300);
  const schemaVersion = text(row.schemaVersion, 200);
  const canonicalPackage = text(row.canonicalPackage, 2_000_000);
  const checksumHex = text(row.checksumHex, 128).toLowerCase();
  const signatureBase64 = text(row.signatureBase64, 1000);
  const checksumAlgorithm = text(row.checksumAlgorithm, 50);
  const signatureAlgorithm = text(row.signatureAlgorithm, 80);

  if (!id || !propertyId || !schemaVersion) throw new Error('snapshot id/propertyId/schemaVersion are required.');
  if (schemaVersion !== 'daon-building-release-snapshot-v1') throw new Error('snapshot schemaVersion is not supported.');
  if (row.immutable !== true) throw new Error('snapshot must be immutable.');
  if (checksumAlgorithm !== 'SHA-256' || signatureAlgorithm !== 'ECDSA_P256_SHA256') throw new Error('snapshot integrity algorithms are invalid.');
  if (!row.package || typeof row.package !== 'object' || !canonicalPackage || !checksumHex || !signatureBase64 || !row.publicKeyJwk) {
    throw new Error('snapshot integrity fields are required.');
  }

  const canonical = canonicalize(row.package);
  if (canonical !== canonicalPackage) throw new Error('snapshot canonical payload mismatch.');
  if (await sha256Hex(canonical) !== checksumHex) throw new Error('snapshot checksum verification failed.');

  let signatureValid = false;
  try {
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      row.publicKeyJwk as JsonWebKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    signatureValid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      base64ToBytes(signatureBase64),
      new TextEncoder().encode(canonical),
    );
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) throw new Error('snapshot signature verification failed.');

  return { id, propertyId, payload: sanitizeSnapshot(snapshot) };
}

async function requireShareManager(req: Request) {
  const authorization = req.headers.get('authorization') ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) throw new Error('authentication_required');

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) throw new Error('authentication_required');

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role,is_active')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (profileError || !profile?.is_active || !['owner', 'admin'].includes(profile.role)) {
    throw new Error('share_management_forbidden');
  }
  return userData.user;
}

async function resolveShare(rawToken: string): Promise<{ row?: ShareRow; status: 'active' | 'revoked' | 'expired' | 'not_found' }> {
  if (!rawToken || rawToken.length < 32 || rawToken.length > 200) return { status: 'not_found' };
  const tokenHash = await sha256Hex(rawToken);
  const { data, error } = await admin
    .from('external_share_sessions')
    .select('id,property_id,snapshot_id,snapshot_payload,allow_download,recipient_note,expires_at,revoked_at,created_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (error || !data) return { status: 'not_found' };
  const row = data as ShareRow;
  if (row.revoked_at) return { row, status: 'revoked' };
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return { row, status: 'expired' };
  return { row, status: 'active' };
}

async function issue(body: Json, req: Request, origin: string | null) {
  const requestUrl = new URL(req.url);
  const shareBaseUrl = PUBLIC_SHARE_BASE_URL || `${requestUrl.origin}${requestUrl.pathname}`;
  const user = await requireShareManager(req);
  const snapshot = await validateSnapshot(body.snapshot);
  const expiresAt = optionalFutureIso(body.expiresAt);
  const allowDownload = body.allowDownload === true;
  const recipientNote = text(body.recipientNote, 500) || null;
  const rawToken = createRawToken();
  const tokenHash = await sha256Hex(rawToken);

  const { data, error } = await admin
    .from('external_share_sessions')
    .insert({
      property_id: snapshot.propertyId,
      snapshot_id: snapshot.id,
      snapshot_payload: snapshot.payload,
      token_hash: tokenHash,
      allow_download: allowDownload,
      recipient_note: recipientNote,
      expires_at: expiresAt,
      created_by: user.id,
    })
    .select('id,created_at')
    .single();
  if (error || !data) throw new Error('share_issue_failed');

  const publicUrl = `${shareBaseUrl.replace(/\/$/, '')}#token=${encodeURIComponent(rawToken)}`;
  return json({
    remoteShareId: data.id,
    publicUrl,
    rawToken,
    status: 'active',
    expiresAt: expiresAt ?? undefined,
    allowDownload,
    createdAt: data.created_at,
  }, 201, origin);
}

async function revoke(body: Json, req: Request, origin: string | null) {
  await requireShareManager(req);
  const remoteShareId = text(body.remoteShareId, 100);
  if (!remoteShareId) throw new Error('remoteShareId is required.');
  const { error } = await admin
    .from('external_share_sessions')
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', remoteShareId)
    .is('revoked_at', null);
  if (error) throw new Error('share_revoke_failed');
  return json({ ok: true }, 200, origin);
}

async function list(body: Json, req: Request, origin: string | null) {
  await requireShareManager(req);
  const snapshotId = text(body.snapshotId, 300);
  if (!snapshotId) throw new Error('snapshotId is required.');
  const { data, error } = await admin
    .from('external_share_sessions')
    .select('id,property_id,snapshot_id,allow_download,recipient_note,expires_at,revoked_at,created_at')
    .eq('snapshot_id', snapshotId)
    .order('created_at', { ascending: false });
  if (error) throw new Error('share_list_failed');
  const rows = (data ?? []).map((row) => ({
    remoteShareId: row.id,
    snapshotId: row.snapshot_id,
    propertyId: row.property_id,
    status: row.revoked_at
      ? 'revoked'
      : row.expires_at && new Date(row.expires_at).getTime() <= Date.now()
        ? 'expired'
        : 'active',
    expiresAt: row.expires_at ?? undefined,
    allowDownload: row.allow_download,
    recipientNote: row.recipient_note ?? undefined,
    createdAt: row.created_at,
    revokedAt: row.revoked_at ?? undefined,
  }));
  return json({ shares: rows }, 200, origin);
}

async function resolve(body: Json, origin: string | null) {
  const rawToken = text(body.rawToken, 200);
  const result = await resolveShare(rawToken);
  if (!result.row) return json({ status: 'not_found' }, 404, origin);
  if (result.status !== 'active') {
    return json({
      status: result.status,
      snapshotId: result.row.snapshot_id,
      propertyId: result.row.property_id,
      expiresAt: result.row.expires_at ?? undefined,
    }, 410, origin);
  }
  return json({
    status: 'active',
    snapshotId: result.row.snapshot_id,
    propertyId: result.row.property_id,
    allowDownload: result.row.allow_download,
    expiresAt: result.row.expires_at ?? undefined,
    payload: result.row.snapshot_payload,
  }, 200, origin);
}

async function addReview(body: Json, origin: string | null) {
  const rawToken = text(body.rawToken, 200);
  const author = text(body.author, 80);
  const noteBody = text(body.body, 5000);
  if (!author || !noteBody) throw new Error('author and body are required.');
  const result = await resolveShare(rawToken);
  if (!result.row) return json({ status: 'not_found' }, 404, origin);
  if (result.status !== 'active') return json({ status: result.status }, 410, origin);

  const { data, error } = await admin
    .from('external_share_review_notes')
    .insert({
      share_session_id: result.row.id,
      snapshot_id: result.row.snapshot_id,
      author_label: author,
      body: noteBody,
    })
    .select('id,snapshot_id,author_label,body,status,created_at,resolved_at')
    .single();
  if (error || !data) throw new Error('review_note_write_failed');
  return json({
    id: data.id,
    propertyId: result.row.property_id,
    snapshotId: data.snapshot_id,
    author: data.author_label,
    body: data.body,
    status: data.status,
    createdAt: data.created_at,
    resolvedAt: data.resolved_at ?? undefined,
  }, 201, origin);
}


function viewerHtml(req: Request) {
  const endpoint = new URL(req.url);
  endpoint.search = '';
  endpoint.hash = '';
  const endpointJson = JSON.stringify(endpoint.toString());
  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>DA:ON ASSET | External Review</title>
<style>
:root{font-family:Inter,Pretendard,"Noto Sans KR",system-ui,sans-serif;color:#162230;background:#f5f3ed}
body{margin:0}.top{background:#082f4f;color:#fff;padding:22px 24px}.top b{letter-spacing:.08em}.wrap{max-width:980px;margin:0 auto;padding:24px}
.card{background:#fff;border:1px solid #ddd8cb;border-radius:14px;padding:20px;box-shadow:0 8px 24px #0000000a}
.badge{display:inline-block;border:1px solid #b99655;color:#806328;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:700}
.notice{margin:12px 0;color:#59636e;font-size:13px;line-height:1.6}
pre{white-space:pre-wrap;word-break:break-word;background:#f7f8fa;border:1px solid #e5e8eb;border-radius:10px;padding:14px;max-height:62vh;overflow:auto}
button{border:0;border-radius:8px;padding:10px 14px;background:#082f4f;color:#fff;font-weight:700;cursor:pointer}
.err{color:#a32424}.muted{color:#6e7781}
</style>
</head>
<body>
<header class="top"><b>DA:ON ASSET</b><div style="margin-top:6px;font-size:13px;opacity:.82">READ-ONLY EXTERNAL REVIEW</div></header>
<main class="wrap"><section class="card">
<span class="badge">READ ONLY</span>
<h1 style="font-size:22px;margin:12px 0 4px">외부 검토 자료</h1>
<p class="notice">이 화면은 서버가 유효성을 확인한 Snapshot만 표시합니다. 만료되거나 회수된 링크는 열리지 않습니다.</p>
<div id="status" class="muted">접근 토큰 확인 중…</div>
<pre id="payload" hidden></pre>
<button id="download" hidden>검토자료 JSON 저장</button>
<div id="reviewBox" hidden style="margin-top:18px;padding-top:16px;border-top:1px solid #e5e8eb">
  <strong>검토 의견 남기기</strong>
  <div style="display:grid;gap:8px;margin-top:10px">
    <input id="author" maxlength="80" placeholder="검토자 이름" style="padding:10px;border:1px solid #d7dce2;border-radius:8px">
    <textarea id="reviewBody" maxlength="2000" rows="4" placeholder="검토 의견" style="padding:10px;border:1px solid #d7dce2;border-radius:8px;resize:vertical"></textarea>
    <button id="submitReview">검토 의견 등록</button>
    <div id="reviewStatus" class="muted"></div>
  </div>
</div>
</section></main>
<script>
const endpoint=${endpointJson};
const statusEl=document.getElementById('status');
const payloadEl=document.getElementById('payload');
const downloadBtn=document.getElementById('download');
const reviewBox=document.getElementById('reviewBox');
const authorEl=document.getElementById('author');
const reviewBodyEl=document.getElementById('reviewBody');
const submitReview=document.getElementById('submitReview');
const reviewStatus=document.getElementById('reviewStatus');
const token=new URLSearchParams(location.hash.slice(1)).get('token')||'';
history.replaceState(null,'',location.pathname);
(async()=>{
  if(!token){statusEl.className='err';statusEl.textContent='유효한 접근 토큰이 없습니다.';return;}
  try{
    const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'resolve',rawToken:token}),cache:'no-store'});
    const data=await response.json();
    if(!response.ok||data.status!=='active'){
      statusEl.className='err';
      statusEl.textContent=data.status==='revoked'?'회수된 링크입니다.':data.status==='expired'?'만료된 링크입니다.':'유효하지 않은 링크입니다.';
      return;
    }
    statusEl.textContent='서버 검증 완료 · Snapshot '+(data.snapshotId||'');
    payloadEl.hidden=false;
    payloadEl.textContent=JSON.stringify(data.payload,null,2);
    reviewBox.hidden=false;
    submitReview.onclick=async()=>{
      const author=authorEl.value.trim();
      const body=reviewBodyEl.value.trim();
      if(!author||!body){reviewStatus.className='err';reviewStatus.textContent='검토자 이름과 의견을 입력하세요.';return;}
      submitReview.disabled=true;reviewStatus.className='muted';reviewStatus.textContent='등록 중…';
      try{
        const reviewResponse=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'add_review',rawToken:token,author,body}),cache:'no-store'});
        const reviewData=await reviewResponse.json();
        if(!reviewResponse.ok) throw new Error(reviewData.status||reviewData.error||'review_failed');
        reviewBodyEl.value='';reviewStatus.className='muted';reviewStatus.textContent='검토 의견이 서버에 등록되었습니다.';
      }catch{
        reviewStatus.className='err';reviewStatus.textContent='검토 의견을 등록하지 못했습니다. 링크 상태를 확인하세요.';
      }finally{submitReview.disabled=false;}
    };
    if(data.allowDownload){
      downloadBtn.hidden=false;
      downloadBtn.onclick=()=>{
        const blob=new Blob([JSON.stringify(data.payload,null,2)],{type:'application/json'});
        const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='daon-external-review.json';a.click();URL.revokeObjectURL(a.href);
      };
    }
  }catch{
    statusEl.className='err';statusEl.textContent='검토자료를 불러오지 못했습니다.';
  }
})();
</script>
</body></html>`;
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    },
  });
}

Deno.serve(async (req) => {
  let origin: string | null = null;
  try {
    if (req.method === 'GET') return viewerHtml(req);
    origin = allowedOrigin(req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);

    const body = await req.json() as Json;
    switch (body.action) {
      case 'issue': return await issue(body, req, origin);
      case 'revoke': return await revoke(body, req, origin);
      case 'list': return await list(body, req, origin);
      case 'resolve': return await resolve(body, origin);
      case 'add_review': return await addReview(body, origin);
      default: return json({ error: 'unsupported_action' }, 400, origin);
    }
  } catch (reason) {
    if (reason instanceof Response) return reason;
    const message = reason instanceof Error ? reason.message : 'remote_share_error';
    const status = message === 'authentication_required' ? 401
      : message === 'share_management_forbidden' ? 403
        : /required|invalid|future|unsupported|mismatch|verification failed|immutable/.test(message) ? 400
          : 500;
    return json({ error: message }, status, origin);
  }
});
