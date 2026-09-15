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
  if (!PUBLIC_SHARE_ALLOWED_ORIGINS.includes(origin)) {
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
  if (!PUBLIC_SHARE_BASE_URL) throw new Error('PUBLIC_SHARE_BASE_URL is required before issuing public URLs.');
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

  const publicUrl = `${PUBLIC_SHARE_BASE_URL.replace(/\/$/, '')}#token=${encodeURIComponent(rawToken)}`;
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
    snapshotId: data.snapshot_id,
    author: data.author_label,
    body: data.body,
    status: data.status,
    createdAt: data.created_at,
    resolvedAt: data.resolved_at ?? undefined,
  }, 201, origin);
}

Deno.serve(async (req) => {
  let origin: string | null = null;
  try {
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
