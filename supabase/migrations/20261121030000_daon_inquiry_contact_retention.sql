-- DA:ON public listing inquiries: retention (루치오 승인 2026-11-21 "90일 삭제 / 연락처 별도 관리(이름 및 내용 기록)").
-- Option A (recommended, pending the decision card): 90 days after receipt the contact (phone / e-mail) is erased;
-- the name and message stay as inquiry history and are deleted 3 years after receipt.
-- The consent text on /p/:publicId states the same periods (src/pages/PublicListingPage.tsx).
-- Rollback: select cron.unschedule('daon-inquiry-retention'); drop function private.daon_purge_inquiry_contacts();
--           alter table public.public_listing_inquiries drop constraint public_listing_inquiries_contact_or_purged,
--             drop column contact_purged_at; (contact can only be made NOT NULL again while no row has been purged)

create extension if not exists pg_cron;

alter table public.public_listing_inquiries
  alter column contact drop not null,
  add column contact_purged_at timestamptz,
  add constraint public_listing_inquiries_contact_or_purged check (contact is not null or contact_purged_at is not null);
-- anon may insert only the columns granted in phase 2; contact_purged_at is not among them, so a new inquiry always
-- needs a contact (the check above) and anon can never mark one as purged.

create index if not exists public_listing_inquiries_created_idx on public.public_listing_inquiries (created_at);

create or replace function private.daon_purge_inquiry_contacts()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  erased integer;
  removed integer;
begin
  update public.public_listing_inquiries
     set contact = null, contact_purged_at = now()
   where contact is not null and created_at < now() - interval '90 days';
  get diagnostics erased = row_count;
  delete from public.public_listing_inquiries where created_at < now() - interval '3 years';
  get diagnostics removed = row_count;
  return jsonb_build_object('contacts_erased', erased, 'rows_deleted', removed, 'ran_at', now());
end;
$$;
revoke all on function private.daon_purge_inquiry_contacts() from public, anon, authenticated;

-- Daily at 18:10 UTC (03:10 KST).
select cron.schedule('daon-inquiry-retention', '10 18 * * *', $$select private.daon_purge_inquiry_contacts()$$);
