-- DA:ON platform phase 2: public listings + inquiries (approved by 루치오 2026-11-17 "2단계 DB 적용").
-- Differences from docs/proposals/2026-11-15-public-listings-phase2.sql, found while checking production:
--  * RLS helpers live in schema private (moved 2026-09-17), not public.
--  * Buyers never see the internal property id (it can carry a lot number, e.g. daon-bangbae-815-11):
--    anon gets a random public_id and column-level grants only; inquiries reference public_id.
--  * created_by / updated_by / published_by must be the caller; inquiries are always inserted as status 'new'.
-- Rollback: drop table public.public_listing_inquiries; drop table public.public_listings; (no existing table changes).

create table public.public_listings (
  property_id text primary key references public.properties(id) on delete cascade,
  public_id uuid not null unique default gen_random_uuid(),
  status text not null default 'draft' check (status in ('draft', 'published', 'withdrawn')),
  address_level text not null default 'dong' check (address_level in ('gu', 'dong', 'full')),
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
create index public_listings_status_idx on public.public_listings (status);
create index public_listings_published_by_idx on public.public_listings (published_by);
create index public_listings_created_by_idx on public.public_listings (created_by);
create index public_listings_updated_by_idx on public.public_listings (updated_by);

create trigger public_listings_touch before update on public.public_listings
  for each row execute function public.daon_touch_updated_at();

alter table public.public_listings enable row level security;

create policy public_listings_read_published on public.public_listings
  for select to anon using (status = 'published');
create policy public_listings_staff_read on public.public_listings
  for select to authenticated using ((select private.daon_is_active_user()));
create policy public_listings_draft_write on public.public_listings
  for insert to authenticated
  with check ((select private.daon_can_edit_data()) and status = 'draft'
              and created_by = (select auth.uid()) and updated_by = (select auth.uid()));
create policy public_listings_update on public.public_listings
  for update to authenticated using ((select private.daon_can_edit_data()))
  with check (updated_by = (select auth.uid())
              and (status = 'draft' or (select private.daon_can_verify_data())));

revoke all on public.public_listings from anon;
grant select (public_id, status, address_level, snapshot, snapshot_version, published_at) on public.public_listings to anon;

create table public.public_listing_inquiries (
  id uuid primary key default gen_random_uuid(),
  public_listing_id uuid not null references public.public_listings(public_id) on delete cascade,
  kind text not null check (kind in ('inquiry', 'report_request')),
  name text not null check (char_length(name) between 1 and 40),
  contact text not null check (char_length(contact) between 5 and 80),
  message text not null default '' check (char_length(message) <= 1000),
  consent_at timestamptz not null,
  status text not null default 'new' check (status in ('new', 'answered', 'closed')),
  created_at timestamptz not null default now()
);
create index public_listing_inquiries_listing_idx on public.public_listing_inquiries (public_listing_id, created_at desc);

alter table public.public_listing_inquiries enable row level security;

create policy inquiries_public_insert on public.public_listing_inquiries
  for insert to anon, authenticated
  with check (
    status = 'new'
    and consent_at is not null
    and exists (select 1 from public.public_listings l where l.public_id = public_listing_inquiries.public_listing_id and l.status = 'published')
  );
create policy inquiries_staff_read on public.public_listing_inquiries
  for select to authenticated using ((select private.daon_is_active_user()));
create policy inquiries_staff_update on public.public_listing_inquiries
  for update to authenticated using ((select private.daon_can_edit_data())) with check ((select private.daon_can_edit_data()));

revoke all on public.public_listing_inquiries from anon;
grant insert (public_listing_id, kind, name, contact, message, consent_at) on public.public_listing_inquiries to anon;
