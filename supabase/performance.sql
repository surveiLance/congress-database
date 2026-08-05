-- Run once in Supabase Dashboard > SQL Editor for an existing project.
-- This migration is non-destructive: it does not change or delete applications.
-- It adds a lightweight summary view and a paginated search function so the
-- records desk downloads only the rows currently visible on screen.

create extension if not exists unaccent;

create or replace function public.assistance_normalize(value text)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select trim(regexp_replace(lower(unaccent(coalesce(value, ''))), '[^a-z0-9]+', ' ', 'g'));
$$;

create or replace function public.assistance_number(value text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  cleaned text;
begin
  cleaned := regexp_replace(coalesce(value, ''), '[^0-9.-]+', '', 'g');
  if cleaned = '' or cleaned = '-' or cleaned = '.' then return 0; end if;
  return cleaned::numeric;
exception when others then
  return 0;
end;
$$;

create or replace function public.assistance_barangay(value text)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select case public.assistance_normalize(value)
    when '' then 'Not recorded'
    when 'not recorded' then 'Not recorded'
    when 'unspecified' then 'Not recorded'
    when 'bagong nayon' then 'Bagong Nayon'
    when 'beverly hills' then 'Beverly Hills'
    when 'de la paz' then 'De La Paz'
    when 'dela paz' then 'De La Paz'
    when 'mambugan' then 'Mambugan'
    when 'mayamot' then 'Mayamot'
    when 'munting dilao' then 'Munting Dilao'
    when 'munting dilaw' then 'Munting Dilao'
    when 'muntingdilao' then 'Munting Dilao'
    when 'muntingdilaw' then 'Munting Dilao'
    when 'muntindilao' then 'Munting Dilao'
    when 'muntindilaw' then 'Munting Dilao'
    when 'san isidro' then 'San Isidro'
    when 'sta cruz' then 'Santa Cruz'
    when 'santa cruz' then 'Santa Cruz'
    when 'stacruz' then 'Santa Cruz'
    when 'calawis' then 'Calawis'
    when 'cupang' then 'Cupang'
    when 'dalig' then 'Dalig'
    when 'inarawan' then 'Inarawan'
    when 'san jose' then 'San Jose'
    when 'san juan' then 'San Juan'
    when 'san luis' then 'San Luis'
    when 'san roque' then 'San Roque'
    else initcap(public.assistance_normalize(value))
  end;
$$;

create or replace function public.assistance_category(value text)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select case
    when public.assistance_normalize(value) in ('', 'not recorded', 'unspecified') then 'Not recorded'
    when public.assistance_normalize(value) = 'fhona' or public.assistance_normalize(value) like '%family heads%' then 'FHONA'
    when public.assistance_normalize(value) like '%senior%' then 'Senior'
    when public.assistance_normalize(value) = 'plhiv' or public.assistance_normalize(value) like '%hiv aids%' or public.assistance_normalize(value) like '%living with hiv%' then 'PLHIV'
    when public.assistance_normalize(value) = 'pwd' or public.assistance_normalize(value) like '%person with disability%' or public.assistance_normalize(value) like '%disabled%' then 'PWD'
    else initcap(public.assistance_normalize(value))
  end;
$$;

create or replace function public.assistance_record_agencies(value jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select case
    when jsonb_typeof(value->'assistanceAgencies') = 'array' and jsonb_array_length(value->'assistanceAgencies') > 0
      then value->'assistanceAgencies'
    when jsonb_typeof(value->'otherAgencyAssistance') = 'array'
      then '["DSWD"]'::jsonb || value->'otherAgencyAssistance'
    else '["DSWD"]'::jsonb
  end;
$$;

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

create or replace function public.search_assistance_records(
  p_query text default '',
  p_filters jsonb default '{}'::jsonb,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language sql
stable
security invoker
set search_path = public, extensions
as $$
with base as (
  select
    ar.id,
    ar.record as full_record,
    ar.record - 'idImage' - 'idImageBack' as summary_record,
    ar.surname_normalized,
    ar.first_name_normalized,
    ar.birthday,
    ar.created_at,
    coalesce(ar.record->>'archivedAt', '') <> '' as is_archived,
    coalesce(nullif(ar.record->>'applicationDate', ''), ar.created_at::date::text) as application_date,
    coalesce(nullif(ar.record->>'payoutDate', ''), ar.record->'legacyApplication'->>'payoutDate', '') as payout_date,
    public.assistance_barangay(ar.record->>'brgy') as canonical_barangay,
    public.assistance_category(ar.record->>'category') as canonical_category,
    public.assistance_number(ar.record->>'amount') as amount_value,
    public.assistance_record_agencies(ar.record) as agencies
  from public.assistance_records ar
),
status_base as (
  select * from base
  where case when coalesce(p_filters->>'status', 'active') = 'archived' then is_archived else not is_archived end
),
history as (
  select
    surname_normalized,
    first_name_normalized,
    birthday,
    count(*)::integer as application_count,
    sum(amount_value) as total_granted
  from status_base
  group by surname_normalized, first_name_normalized, birthday
),
enriched as (
  select b.*, h.application_count, h.total_granted
  from status_base b
  left join history h using (surname_normalized, first_name_normalized, birthday)
),
filtered as (
  select e.*
  from enriched e
  where
    (
      public.assistance_normalize(p_query) = '' or not exists (
        select 1 from regexp_split_to_table(public.assistance_normalize(p_query), ' +') token
        where public.assistance_normalize(e.summary_record::text) not like '%' || token || '%'
      )
    )
    and (
      public.assistance_normalize(p_filters->>'name') = '' or not exists (
        select 1 from regexp_split_to_table(public.assistance_normalize(p_filters->>'name'), ' +') token
        where public.assistance_normalize(concat_ws(' ', e.full_record->>'surname', e.full_record->>'firstName', e.full_record->>'middleName', e.full_record->>'suffix')) not like '%' || token || '%'
      )
    )
    and (
      coalesce(p_filters->>'district', '') = '' or
      (p_filters->>'district' = 'district-1' and e.canonical_barangay in ('Bagong Nayon','Beverly Hills','De La Paz','Mambugan','Mayamot','Munting Dilao','San Isidro','Santa Cruz')) or
      (p_filters->>'district' = 'outside-district-1' and e.canonical_barangay not in ('Not recorded','Bagong Nayon','Beverly Hills','De La Paz','Mambugan','Mayamot','Munting Dilao','San Isidro','Santa Cruz')) or
      (p_filters->>'district' = 'not-recorded' and e.canonical_barangay = 'Not recorded')
    )
    and (coalesce(p_filters->>'barangay', '') = '' or e.canonical_barangay = public.assistance_barangay(p_filters->>'barangay'))
    and (coalesce(p_filters->>'sex', '') = '' or public.assistance_normalize(e.full_record->>'sex') = public.assistance_normalize(p_filters->>'sex'))
    and (coalesce(p_filters->>'minAge', '') = '' or public.assistance_number(e.full_record->>'age') >= public.assistance_number(p_filters->>'minAge'))
    and (coalesce(p_filters->>'maxAge', '') = '' or public.assistance_number(e.full_record->>'age') <= public.assistance_number(p_filters->>'maxAge'))
    and (coalesce(p_filters->>'minHousehold', '') = '' or public.assistance_number(e.full_record->>'householdMembers') >= public.assistance_number(p_filters->>'minHousehold'))
    and (coalesce(p_filters->>'maxHousehold', '') = '' or public.assistance_number(e.full_record->>'householdMembers') <= public.assistance_number(p_filters->>'maxHousehold'))
    and (
      coalesce(p_filters->>'processingStage', '') = '' or
      (p_filters->>'processingStage' = 'application-recorded' and e.application_date <> '') or
      (p_filters->>'processingStage' = 'awaiting-payout' and e.application_date <> '' and e.payout_date = '') or
      (p_filters->>'processingStage' = 'payout-completed' and e.payout_date <> '') or
      (p_filters->>'processingStage' = 'application-date-missing' and coalesce(e.full_record->>'applicationDate', '') = '')
    )
    and (coalesce(p_filters->>'category', '') = '' or e.canonical_category = public.assistance_category(p_filters->>'category'))
    and (coalesce(p_filters->>'assistanceType', '') = '' or public.assistance_normalize(e.full_record->>'assistanceType') = public.assistance_normalize(p_filters->>'assistanceType'))
    and (
      jsonb_array_length(coalesce(p_filters->'agencies', '[]'::jsonb)) = 0 or
      not exists (
        select 1 from jsonb_array_elements_text(p_filters->'agencies') selected_agency
        where not exists (
          select 1 from jsonb_array_elements_text(e.agencies) record_agency
          where public.assistance_normalize(record_agency) = public.assistance_normalize(selected_agency)
        )
      )
    )
    and (
      coalesce(p_filters->>'agencyMatch', 'includes') <> 'exact' or
      jsonb_array_length(coalesce(p_filters->'agencies', '[]'::jsonb)) = 0 or
      (select count(distinct public.assistance_normalize(record_agency)) from jsonb_array_elements_text(e.agencies) record_agency) = jsonb_array_length(p_filters->'agencies')
    )
    and (
      public.assistance_normalize(p_filters->>'diagnosis') = '' or not exists (
        select 1 from regexp_split_to_table(public.assistance_normalize(p_filters->>'diagnosis'), ' +') token
        where public.assistance_normalize(e.full_record->>'diagnosis') not like '%' || token || '%'
      )
    )
    and (
      coalesce(p_filters->>'conditionCategory', '') = '' or exists (
        select 1 from jsonb_array_elements_text(case when jsonb_typeof(e.full_record->'conditionCategories') = 'array' then e.full_record->'conditionCategories' else '[]'::jsonb end) condition
        where public.assistance_normalize(condition) = public.assistance_normalize(p_filters->>'conditionCategory')
      )
    )
    and (coalesce(p_filters->>'employmentStatus', '') = '' or public.assistance_normalize(e.full_record->>'employedStatus') = public.assistance_normalize(p_filters->>'employmentStatus'))
    and (coalesce(p_filters->>'minIncome', '') = '' or public.assistance_number(e.full_record->>'salary') >= public.assistance_number(p_filters->>'minIncome'))
    and (coalesce(p_filters->>'maxIncome', '') = '' or public.assistance_number(e.full_record->>'salary') <= public.assistance_number(p_filters->>'maxIncome'))
    and (coalesce(p_filters->>'minExpenses', '') = '' or public.assistance_number(e.full_record->>'monthlyExpenses') >= public.assistance_number(p_filters->>'minExpenses'))
    and (coalesce(p_filters->>'maxExpenses', '') = '' or public.assistance_number(e.full_record->>'monthlyExpenses') <= public.assistance_number(p_filters->>'maxExpenses'))
    and (coalesce(p_filters->>'minAmount', '') = '' or e.amount_value >= public.assistance_number(p_filters->>'minAmount'))
    and (coalesce(p_filters->>'maxAmount', '') = '' or e.amount_value <= public.assistance_number(p_filters->>'maxAmount'))
    and (coalesce(p_filters->>'createdFrom', '') = '' or e.application_date >= p_filters->>'createdFrom')
    and (coalesce(p_filters->>'createdTo', '') = '' or e.application_date <= p_filters->>'createdTo')
    and (coalesce(p_filters->>'payoutFrom', '') = '' or (e.payout_date <> '' and e.payout_date >= p_filters->>'payoutFrom'))
    and (coalesce(p_filters->>'payoutTo', '') = '' or (e.payout_date <> '' and e.payout_date <= p_filters->>'payoutTo'))
),
ordered as (
  select f.*, row_number() over (order by
    case when p_filters->>'sort' = 'name' then public.assistance_normalize(concat_ws(' ', f.full_record->>'surname', f.full_record->>'firstName')) end asc,
    case when p_filters->>'sort' = 'name-desc' then public.assistance_normalize(concat_ws(' ', f.full_record->>'surname', f.full_record->>'firstName')) end desc,
    case when p_filters->>'sort' = 'oldest' then f.application_date end asc,
    case when coalesce(p_filters->>'sort', 'newest') = 'newest' then f.application_date end desc,
    case when p_filters->>'sort' = 'birthday-oldest' then f.birthday end asc,
    case when p_filters->>'sort' = 'birthday-newest' then f.birthday end desc,
    case when p_filters->>'sort' = 'barangay-asc' then f.canonical_barangay end asc,
    case when p_filters->>'sort' = 'barangay-desc' then f.canonical_barangay end desc,
    case when p_filters->>'sort' = 'assistance-asc' then public.assistance_normalize(f.full_record->>'assistanceType') end asc,
    case when p_filters->>'sort' = 'assistance-desc' then public.assistance_normalize(f.full_record->>'assistanceType') end desc,
    case when p_filters->>'sort' = 'amount-low' then f.amount_value end asc,
    case when p_filters->>'sort' = 'amount-high' then f.amount_value end desc,
    case when p_filters->>'sort' = 'payout-oldest' then nullif(f.payout_date, '') end asc nulls last,
    case when p_filters->>'sort' = 'payout-newest' then nullif(f.payout_date, '') end desc nulls last,
    case when p_filters->>'sort' = 'history-low' then f.total_granted end asc,
    case when p_filters->>'sort' = 'history-high' then f.total_granted end desc,
    f.id desc
  ) as page_order
  from filtered f
  limit greatest(1, least(coalesce(p_page_size, 20), 100))
  offset (greatest(1, coalesce(p_page, 1)) - 1) * greatest(1, least(coalesce(p_page_size, 20), 100))
),
filter_options as (
  select jsonb_build_object(
    'barangays', coalesce((select jsonb_agg(value order by value) from (select distinct public.assistance_barangay(full_record->>'brgy') value from base) valueset), '[]'::jsonb),
    'assistanceTypes', coalesce((select jsonb_agg(value order by value) from (select distinct nullif(trim(full_record->>'assistanceType'), '') value from base) valueset where value is not null), '[]'::jsonb),
    'sexes', coalesce((select jsonb_agg(value order by value) from (select distinct nullif(trim(full_record->>'sex'), '') value from base) valueset where value is not null), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(value order by value) from (select distinct public.assistance_category(full_record->>'category') value from base) valueset), '[]'::jsonb),
    'employmentStatuses', coalesce((select jsonb_agg(value order by value) from (select distinct nullif(trim(full_record->>'employedStatus'), '') value from base) valueset where value is not null), '[]'::jsonb)
  ) value
)
select jsonb_build_object(
  'records', coalesce((select jsonb_agg(jsonb_build_object(
    'id', id,
    'record', summary_record,
    'history_application_count', application_count,
    'history_total_granted', total_granted
  ) order by page_order) from ordered), '[]'::jsonb),
  'total', (select count(*) from filtered),
  'active_count', (select count(*) from base where not is_archived),
  'archived_count', (select count(*) from base where is_archived),
  'filter_options', (select value from filter_options)
);
$$;

revoke execute on function public.search_assistance_records(text, jsonb, integer, integer) from anon;
grant execute on function public.search_assistance_records(text, jsonb, integer, integer) to authenticated;
