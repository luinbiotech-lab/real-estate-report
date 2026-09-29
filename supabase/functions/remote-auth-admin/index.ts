// DA:ON Real Estate Platform — REMOTE AUTH administration Edge Function
// PREPARED ONLY. Deploy only to a dedicated real-estate Supabase project.
// Never deploy this function to GPS Tracker or Sports AI projects.

import { createClient } from 'npm:@supabase/supabase-js@2';

type Json = Record<string, unknown>;
type AccessRole = 'owner' | 'admin' | 'editor' | 'viewer';

type ProfileRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: AccessRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const DAON_OWNER_BOOTSTRAP_KEY = Deno.env.get('DAON_OWNER_BOOTSTRAP_KEY') ?? '';
const AUTH_ADMIN_ALLOWED_ORIGINS = (Deno.env.get('AUTH_ADMIN_ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('REMOTE AUTH admin server environment is incomplete.');
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
  if (!AUTH_ADMIN_ALLOWED_ORIGINS.includes(origin)) {
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

function text(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function accessRole(value: unknown): AccessRole {
  const role = text(value, 20) as AccessRole;
  if (!['owner', 'admin', 'editor', 'viewer'].includes(role)) throw new Error('invalid_role');
  return role;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function timingSafeEqualText(a: string, b: string) {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left[index] ^ right[index];
  return diff === 0;
}

async function authenticatedUser(req: Request) {
  const authorization = req.headers.get('authorization') ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) throw new Error('authentication_required');
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error('authentication_required');
  return data.user;
}

async function profileFor(userId: string) {
  const { data, error } = await admin
    .from('profiles')
    .select('user_id,email,display_name,role,is_active,created_at,updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) throw new Error('profile_not_found');
  return data as ProfileRow;
}

async function requireOwner(req: Request) {
  const user = await authenticatedUser(req);
  const profile = await profileFor(user.id);
  if (!profile.is_active || profile.role !== 'owner') throw new Error('owner_required');
  return { user, profile };
}

async function activeOwnerCount() {
  const { count, error } = await admin
    .from('profiles')
    .select('user_id', { count: 'exact', head: true })
    .eq('role', 'owner')
    .eq('is_active', true);
  if (error) throw new Error('owner_count_failed');
  return count ?? 0;
}

async function bootstrapOwner(body: Json, req: Request, origin: string | null) {
  if (!DAON_OWNER_BOOTSTRAP_KEY || DAON_OWNER_BOOTSTRAP_KEY.length < 32) {
    throw new Error('bootstrap_key_not_configured');
  }
  const user = await authenticatedUser(req);
  const suppliedKey = text(body.bootstrapKey, 500);
  if (!suppliedKey || !timingSafeEqualText(suppliedKey, DAON_OWNER_BOOTSTRAP_KEY)) {
    throw new Error('bootstrap_forbidden');
  }
  if (await activeOwnerCount() > 0) throw new Error('bootstrap_already_completed');

  const { data, error } = await admin
    .from('profiles')
    .update({ role: 'owner', is_active: true, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .select('user_id,email,display_name,role,is_active,created_at,updated_at')
    .single();
  if (error || !data) throw new Error('bootstrap_owner_failed');
  return json({ profile: data, bootstrap: 'completed' }, 200, origin);
}

async function inviteUser(body: Json, req: Request, origin: string | null) {
  await requireOwner(req);
  const email = text(body.email, 320).toLowerCase();
  const displayName = text(body.displayName, 120);
  const role = accessRole(body.role ?? 'viewer');
  if (!email || !email.includes('@')) throw new Error('invalid_email');

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: displayName ? { display_name: displayName } : undefined,
  });
  if (error || !data.user) throw new Error('invite_failed');

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .update({
      display_name: displayName || data.user.email || '사용자',
      role,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', data.user.id)
    .select('user_id,email,display_name,role,is_active,created_at,updated_at')
    .single();
  if (profileError || !profile) throw new Error('invite_profile_update_failed');
  return json({ profile }, 201, origin);
}

async function ensureOwnerContinuity(target: ProfileRow, nextRole: AccessRole, nextActive: boolean) {
  const removesActiveOwner = target.role === 'owner' && target.is_active && (nextRole !== 'owner' || !nextActive);
  if (removesActiveOwner && await activeOwnerCount() <= 1) throw new Error('last_active_owner_protected');
}

async function updateRole(body: Json, req: Request, origin: string | null) {
  await requireOwner(req);
  const userId = text(body.userId, 80);
  if (!isUuid(userId)) throw new Error('invalid_user_id');
  const role = accessRole(body.role);
  const target = await profileFor(userId);
  await ensureOwnerContinuity(target, role, target.is_active);

  const { data, error } = await admin
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('user_id,email,display_name,role,is_active,created_at,updated_at')
    .single();
  if (error || !data) throw new Error('role_update_failed');
  return json({ profile: data }, 200, origin);
}

async function setActive(body: Json, req: Request, origin: string | null) {
  await requireOwner(req);
  const userId = text(body.userId, 80);
  if (!isUuid(userId)) throw new Error('invalid_user_id');
  if (typeof body.active !== 'boolean') throw new Error('active_must_be_boolean');
  const target = await profileFor(userId);
  await ensureOwnerContinuity(target, target.role, body.active);

  const { data, error } = await admin
    .from('profiles')
    .update({ is_active: body.active, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('user_id,email,display_name,role,is_active,created_at,updated_at')
    .single();
  if (error || !data) throw new Error('active_update_failed');
  return json({ profile: data }, 200, origin);
}

async function listProfiles(req: Request, origin: string | null) {
  await requireOwner(req);
  const { data, error } = await admin
    .from('profiles')
    .select('user_id,email,display_name,role,is_active,created_at,updated_at')
    .order('created_at', { ascending: true });
  if (error) throw new Error('profile_list_failed');
  return json({ profiles: data ?? [] }, 200, origin);
}

Deno.serve(async (req) => {
  let origin: string | null = null;
  try {
    origin = allowedOrigin(req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);
    const body = await req.json() as Json;
    switch (body.action) {
      case 'bootstrap_owner': return await bootstrapOwner(body, req, origin);
      case 'invite_user': return await inviteUser(body, req, origin);
      case 'update_role': return await updateRole(body, req, origin);
      case 'set_active': return await setActive(body, req, origin);
      case 'list_profiles': return await listProfiles(req, origin);
      default: return json({ error: 'unsupported_action' }, 400, origin);
    }
  } catch (reason) {
    if (reason instanceof Response) return reason;
    const message = reason instanceof Error ? reason.message : 'remote_auth_admin_error';
    const status = message === 'authentication_required' ? 401
      : /forbidden|owner_required/.test(message) ? 403
        : /required|invalid|boolean|completed|protected|configured/.test(message) ? 400
          : 500;
    return json({ error: message }, status, origin);
  }
});
