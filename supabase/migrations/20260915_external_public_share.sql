-- DA:ON ASSET remote/public external-share foundation
-- PREPARED ONLY: this migration is not deployed to any Supabase project yet.
-- Raw share tokens MUST NOT be stored. Server functions hash presented tokens with SHA-256
-- and compare against token_hash. Anonymous clients must not query these tables directly.

create extension if not exists pgcrypto;

create table if not exists public.external_share_sessions (
  id uuid primary key default gen_random_uuid(),
  property_id text not null,
  snapshot_id text not null,
  provider text not null default 'remote_public' check (provider = 'remote_public'),
  access_mode text not null default 'read_only' check (access_mode = 'read_only'),
  token_hash text not null unique,
  allow_download boolean not null default false,
  recipient_note text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_share_sessions_token_hash_not_raw check (length(token_hash) >= 64)
);

create index if not exists external_share_sessions_property_idx
  on public.external_share_sessions(property_id, created_at desc);
create index if not exists external_share_sessions_snapshot_idx
  on public.external_share_sessions(snapshot_id, created_at desc);
create index if not exists external_share_sessions_expiry_idx
  on public.external_share_sessions(expires_at)
  where revoked_at is null;

create table if not exists public.external_share_review_notes (
  id uuid primary key default gen_random_uuid(),
  share_session_id uuid not null references public.external_share_sessions(id) on delete cascade,
  snapshot_id text not null,
  author_label text not null,
  body text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create index if not exists external_share_review_notes_session_idx
  on public.external_share_review_notes(share_session_id, created_at desc);
create index if not exists external_share_review_notes_open_idx
  on public.external_share_review_notes(snapshot_id, created_at desc)
  where status = 'open';

alter table public.external_share_sessions enable row level security;
alter table public.external_share_review_notes enable row level security;

-- Intentionally NO anon SELECT/INSERT/UPDATE/DELETE policies.
-- Public token access must be mediated by a server/Edge Function that:
-- 1) hashes the presented raw token,
-- 2) resolves token_hash,
-- 3) rejects revoked or expired sessions,
-- 4) enforces read_only + allow_download,
-- 5) returns only the minimal snapshot payload required by the public viewer,
-- 6) accepts review-note writes only after the same token validation.

comment on table public.external_share_sessions is
  'Server-controlled remote/public share sessions. Never store raw external share tokens.';
comment on column public.external_share_sessions.token_hash is
  'SHA-256 or stronger one-way hash of the raw token. Raw token exists only at issuance/presentation time.';
comment on table public.external_share_review_notes is
  'Remote reviewer comments associated with a token-validated public share session.';
