-- Run once in Supabase Dashboard > SQL Editor for an existing project.
-- This does not change or delete application records.
--
-- The view excludes front/back ID images from the initial records download.
-- The application fetches a complete record from assistance_records only when
-- staff opens or edits it.

create or replace view public.assistance_record_summaries
with (security_invoker = true)
as
select
  id,
  record - 'idImage' - 'idImageBack' as record,
  surname_normalized,
  first_name_normalized,
  birthday,
  created_at,
  updated_at
from public.assistance_records;

grant select on public.assistance_record_summaries to authenticated;
