-- DA:ON Real Estate Platform
-- Auth / profile / role RLS draft.
-- IMPORTANT: this migration is prepared only. Do not apply it to GPS/Sports projects.
-- Apply only after a dedicated real-estate Supabase/backend project is provisioned.

begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'daon_access_role') then
    create type public.daon_access_role as enum ('owner', 'admin', 'editor', 'viewer');
  end if;
end $$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role public.daon_access_role not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.daon_current_role()
returns public.daon_access_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.user_id = auth.uid()
    and p.is_active = true
  limit 1
$$;

revoke all on function public.daon_current_role() from public;
grant execute on function public.daon_current_role() to authenticated;

create or replace function public.daon_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.daon_current_role() = 'owner'::public.daon_access_role, false)
$$;

revoke all on function public.daon_is_owner() from public;
grant execute on function public.daon_is_owner() to authenticated;

create or replace function public.daon_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, display_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email, '사용자'),
    'viewer',
    true
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.daon_handle_new_user() from public;

drop trigger if exists daon_on_auth_user_created on auth.users;
create trigger daon_on_auth_user_created
after insert on auth.users
for each row execute function public.daon_handle_new_user();

-- A user may read their own profile. OWNER may read all profiles.
drop policy if exists "profiles_select_self_or_owner" on public.profiles;
create policy "profiles_select_self_or_owner"
on public.profiles
for select
to authenticated
using (user_id = auth.uid() or public.daon_is_owner());

-- Role/status administration is OWNER-only. Users cannot self-promote.
drop policy if exists "profiles_insert_owner_only" on public.profiles;
create policy "profiles_insert_owner_only"
on public.profiles
for insert
to authenticated
with check (public.daon_is_owner());

drop policy if exists "profiles_update_owner_only" on public.profiles;
create policy "profiles_update_owner_only"
on public.profiles
for update
to authenticated
using (public.daon_is_owner())
with check (public.daon_is_owner());

drop policy if exists "profiles_delete_owner_only" on public.profiles;
create policy "profiles_delete_owner_only"
on public.profiles
for delete
to authenticated
using (public.daon_is_owner());

-- No anonymous policies are created. Public/anon cannot read profile data.
-- Bootstrap rule: promote the first owner only through a trusted server/admin path.
-- Do NOT expose service_role credentials to the browser.

commit;
