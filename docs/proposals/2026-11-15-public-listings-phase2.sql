-- DA:ON platform phase 2: public listings + inquiries.
-- SUPERSEDED 2026-11-17: applied to production as supabase/migrations/20261117075320_daon_public_listings_phase2.sql
-- (private.* helpers, anon-only public_id + column grants). Kept for history; do not apply this file.
-- PROPOSAL ONLY. NOT APPLIED. Kept outside supabase/migrations on purpose so nothing applies it by accident.
-- Applying it changes the production database and needs 루치오's explicit approval (CLAUDE.md: production DB changes).
-- Requires: 20260916_auth_profiles_rls.sql, 20260916_property_data_rls.sql (daon_is_active_user / daon_can_edit_data /
--           daon_can_verify_data / daon_touch_updated_at).
--
-- Design:
--  * Anonymous buyers never read Data Room rows. Publishing freezes a public view model (masked address, facts with
--    badges, grade + criteria, 매수 전 확인표, 시세 위치 basis) into public_listings.snapshot. Withdrawing hides it at once.
--  * Only owner/admin (daon_can_verify_data) may publish or withdraw; editors may prepare drafts.
--  * Inquiries: anonymous insert only with explicit consent; nobody anonymous can read them back. Staff read them.
--    Contact data is personal information: 90-day retention proposed, purge job is a separate approval item.
-- Rollback: drop table public.public_listing_inquiries; drop table public.public_listings; (no existing table changes).

begin;

create table if not exists public.public_listings (
  property_id text primary key references public.properties(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'published', 'withdrawn')),
  address_level text not null default 'dong' check (address_level in ('gu', 'dong', 'full')),
  -- Frozen public view model. Built by the app from verified Data Room rows at publish time; never raw payloads.
  snapshot jsonb not null default '{}'::jsonb,
  snapshot_version integer not null default 0,
  published_at timestamptz,
  published_by uuid references auth.users(id),
  withdrawn_at timestamptz,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_listings_published_has_snapshot check (status <> 'published' or (published_at is not null and snapshot <> '{}'::jsonb))
);

create trigger public_listings_touch before update on public.public_listings
  for each row execute function public.daon_touch_updated_at();

alter table public.public_listings enable row level security;

-- Anyone (including anon) sees published listings only.
create policy public_listings_read_published on public.public_listings
  for select to anon, authenticated using (status = 'published');
-- Staff see every row (drafts, withdrawn).
create policy public_listings_staff_read on public.public_listings
  for select to authenticated using (public.daon_is_active_user());
-- Editors prepare drafts; only owner/admin can set published/withdrawn.
create policy public_listings_draft_write on public.public_listings
  for insert to authenticated with check (public.daon_can_edit_data() and status = 'draft');
create policy public_listings_update on public.public_listings
  for update to authenticated using (public.daon_can_edit_data())
  with check (status = 'draft' or public.daon_can_verify_data());

create table if not exists public.public_listing_inquiries (
  id uuid primary key default gen_random_uuid(),
  property_id text not null references public.public_listings(property_id) on delete cascade,
  kind text not null check (kind in ('inquiry', 'report_request')),
  name text not null check (char_length(name) between 1 and 40),
  contact text not null check (char_length(contact) between 5 and 80),
  message text not null default '' check (char_length(message) <= 1000),
  consent_at timestamptz not null,
  status text not null default 'new' check (status in ('new', 'answered', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.public_listing_inquiries enable row level security;

-- Anonymous insert only for a currently published listing, with consent. No anonymous select/update/delete.
create policy inquiries_public_insert on public.public_listing_inquiries
  for insert to anon, authenticated
  with check (
    consent_at is not null
    and exists (select 1 from public.public_listings l where l.property_id = public_listing_inquiries.property_id and l.status = 'published')
  );
create policy inquiries_staff_read on public.public_listing_inquiries
  for select to authenticated using (public.daon_is_active_user());
create policy inquiries_staff_update on public.public_listing_inquiries
  for update to authenticated using (public.daon_can_edit_data()) with check (public.daon_can_edit_data());

commit;
