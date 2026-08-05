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

-- Keep a compact, photo-free lookup table beside the source records. The
-- original application JSON remains authoritative and unchanged. This table is
-- rebuilt once below, then maintained automatically by a trigger.
create table if not exists public.assistance_record_index (
  record_id bigint primary key references public.assistance_records(id) on delete cascade,
  summary_record jsonb not null default '{}'::jsonb,
  surname_normalized text not null,
  first_name_normalized text not null,
  birthday date not null,
  name_text text not null default '',
  search_text text not null default '',
  is_archived boolean not null default false,
  has_application_date boolean not null default false,
  application_date text not null default '',
  payout_date text not null default '',
  canonical_barangay text not null default 'Not recorded',
  canonical_category text not null default 'Not recorded',
  sex_label text not null default 'Not recorded',
  sex_normalized text not null default '',
  age_value numeric not null default 0,
  household_members numeric not null default 0,
  assistance_type text not null default 'Not recorded',
  assistance_type_normalized text not null default '',
  agencies jsonb not null default '[]'::jsonb,
  diagnosis_text text not null default '',
  condition_categories jsonb not null default '[]'::jsonb,
  employment_status text not null default 'Not recorded',
  employment_status_normalized text not null default '',
  income_value numeric not null default 0,
  expenses_value numeric not null default 0,
  amount_value numeric not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create or replace function public.sync_assistance_record_index(
  p_id bigint,
  p_record jsonb,
  p_surname_normalized text,
  p_first_name_normalized text,
  p_birthday date,
  p_created_at timestamptz,
  p_updated_at timestamptz
)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  insert into public.assistance_record_index (
    record_id, summary_record, surname_normalized, first_name_normalized, birthday,
    name_text, search_text, is_archived, has_application_date, application_date,
    payout_date, canonical_barangay, canonical_category, sex_label, sex_normalized,
    age_value, household_members, assistance_type, assistance_type_normalized,
    agencies, diagnosis_text, condition_categories, employment_status,
    employment_status_normalized, income_value, expenses_value, amount_value,
    created_at, updated_at
  ) values (
    p_id,
    p_record - 'idImage' - 'idImageBack',
    p_surname_normalized,
    p_first_name_normalized,
    p_birthday,
    public.assistance_normalize(concat_ws(' ', p_record->>'surname', p_record->>'firstName', p_record->>'middleName', p_record->>'suffix')),
    public.assistance_normalize((p_record - 'idImage' - 'idImageBack')::text),
    coalesce(p_record->>'archivedAt', '') <> '',
    coalesce(p_record->>'applicationDate', '') <> '',
    coalesce(nullif(p_record->>'applicationDate', ''), p_created_at::date::text),
    coalesce(nullif(p_record->>'payoutDate', ''), p_record->'legacyApplication'->>'payoutDate', ''),
    public.assistance_barangay(p_record->>'brgy'),
    public.assistance_category(p_record->>'category'),
    coalesce(nullif(trim(p_record->>'sex'), ''), 'Not recorded'),
    public.assistance_normalize(p_record->>'sex'),
    public.assistance_number(p_record->>'age'),
    public.assistance_number(p_record->>'householdMembers'),
    coalesce(nullif(trim(p_record->>'assistanceType'), ''), 'Not recorded'),
    public.assistance_normalize(p_record->>'assistanceType'),
    public.assistance_record_agencies(p_record),
    public.assistance_normalize(p_record->>'diagnosis'),
    case when jsonb_typeof(p_record->'conditionCategories') = 'array' then p_record->'conditionCategories' else '[]'::jsonb end,
    coalesce(nullif(trim(p_record->>'employedStatus'), ''), 'Not recorded'),
    public.assistance_normalize(p_record->>'employedStatus'),
    public.assistance_number(p_record->>'salary'),
    public.assistance_number(p_record->>'monthlyExpenses'),
    public.assistance_number(p_record->>'amount'),
    p_created_at,
    p_updated_at
  )
  on conflict (record_id) do update set
    summary_record = excluded.summary_record,
    surname_normalized = excluded.surname_normalized,
    first_name_normalized = excluded.first_name_normalized,
    birthday = excluded.birthday,
    name_text = excluded.name_text,
    search_text = excluded.search_text,
    is_archived = excluded.is_archived,
    has_application_date = excluded.has_application_date,
    application_date = excluded.application_date,
    payout_date = excluded.payout_date,
    canonical_barangay = excluded.canonical_barangay,
    canonical_category = excluded.canonical_category,
    sex_label = excluded.sex_label,
    sex_normalized = excluded.sex_normalized,
    age_value = excluded.age_value,
    household_members = excluded.household_members,
    assistance_type = excluded.assistance_type,
    assistance_type_normalized = excluded.assistance_type_normalized,
    agencies = excluded.agencies,
    diagnosis_text = excluded.diagnosis_text,
    condition_categories = excluded.condition_categories,
    employment_status = excluded.employment_status,
    employment_status_normalized = excluded.employment_status_normalized,
    income_value = excluded.income_value,
    expenses_value = excluded.expenses_value,
    amount_value = excluded.amount_value,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at;
$$;

revoke all on function public.sync_assistance_record_index(bigint, jsonb, text, text, date, timestamptz, timestamptz) from public;
revoke all on function public.sync_assistance_record_index(bigint, jsonb, text, text, date, timestamptz, timestamptz) from anon;
revoke all on function public.sync_assistance_record_index(bigint, jsonb, text, text, date, timestamptz, timestamptz) from authenticated;

create or replace function public.assistance_record_index_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.assistance_record_index where record_id = old.id;
    return old;
  end if;

  perform public.sync_assistance_record_index(
    new.id, new.record, new.surname_normalized, new.first_name_normalized,
    new.birthday, new.created_at, new.updated_at
  );
  return new;
end;
$$;

drop trigger if exists assistance_records_sync_search_index on public.assistance_records;
create trigger assistance_records_sync_search_index
  after insert or update or delete on public.assistance_records
  for each row execute function public.assistance_record_index_trigger();

-- Populate or refresh the lookup rows without updating source applications or
-- changing their created/updated timestamps.
do $backfill$
declare
  source_record record;
begin
  for source_record in
    select id, record, surname_normalized, first_name_normalized, birthday, created_at, updated_at
    from public.assistance_records
  loop
    perform public.sync_assistance_record_index(
      source_record.id,
      source_record.record,
      source_record.surname_normalized,
      source_record.first_name_normalized,
      source_record.birthday,
      source_record.created_at,
      source_record.updated_at
    );
  end loop;
end;
$backfill$;

create index if not exists assistance_record_index_status_date_idx
  on public.assistance_record_index (is_archived, application_date desc, record_id desc);
create index if not exists assistance_record_index_identity_idx
  on public.assistance_record_index (surname_normalized, first_name_normalized, birthday);
create index if not exists assistance_record_index_barangay_idx
  on public.assistance_record_index (canonical_barangay);
create index if not exists assistance_record_index_assistance_type_idx
  on public.assistance_record_index (assistance_type_normalized);
create index if not exists assistance_record_index_amount_idx
  on public.assistance_record_index (amount_value);
create index if not exists assistance_record_index_agencies_idx
  on public.assistance_record_index using gin (agencies);

alter table public.assistance_record_index enable row level security;
revoke all on public.assistance_record_index from anon;
grant select on public.assistance_record_index to authenticated;
drop policy if exists "Authenticated staff can read the assistance search index" on public.assistance_record_index;
create policy "Authenticated staff can read the assistance search index"
  on public.assistance_record_index for select to authenticated using (true);

create or replace view public.assistance_record_summaries
with (security_invoker = true)
as
select
  record_id as id,
  summary_record as record,
  surname_normalized,
  first_name_normalized,
  birthday,
  created_at,
  updated_at
from public.assistance_record_index;

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
  select * from public.assistance_record_index
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
        where e.search_text not like '%' || token || '%'
      )
    )
    and (
      public.assistance_normalize(p_filters->>'name') = '' or not exists (
        select 1 from regexp_split_to_table(public.assistance_normalize(p_filters->>'name'), ' +') token
        where e.name_text not like '%' || token || '%'
      )
    )
    and (
      coalesce(p_filters->>'district', '') = '' or
      (p_filters->>'district' = 'district-1' and e.canonical_barangay in ('Bagong Nayon','Beverly Hills','De La Paz','Mambugan','Mayamot','Munting Dilao','San Isidro','Santa Cruz')) or
      (p_filters->>'district' = 'outside-district-1' and e.canonical_barangay not in ('Not recorded','Bagong Nayon','Beverly Hills','De La Paz','Mambugan','Mayamot','Munting Dilao','San Isidro','Santa Cruz')) or
      (p_filters->>'district' = 'not-recorded' and e.canonical_barangay = 'Not recorded')
    )
    and (coalesce(p_filters->>'barangay', '') = '' or e.canonical_barangay = public.assistance_barangay(p_filters->>'barangay'))
    and (coalesce(p_filters->>'sex', '') = '' or e.sex_normalized = public.assistance_normalize(p_filters->>'sex'))
    and (coalesce(p_filters->>'minAge', '') = '' or e.age_value >= public.assistance_number(p_filters->>'minAge'))
    and (coalesce(p_filters->>'maxAge', '') = '' or e.age_value <= public.assistance_number(p_filters->>'maxAge'))
    and (coalesce(p_filters->>'minHousehold', '') = '' or e.household_members >= public.assistance_number(p_filters->>'minHousehold'))
    and (coalesce(p_filters->>'maxHousehold', '') = '' or e.household_members <= public.assistance_number(p_filters->>'maxHousehold'))
    and (
      coalesce(p_filters->>'processingStage', '') = '' or
      (p_filters->>'processingStage' = 'application-recorded' and e.application_date <> '') or
      (p_filters->>'processingStage' = 'awaiting-payout' and e.application_date <> '' and e.payout_date = '') or
      (p_filters->>'processingStage' = 'payout-completed' and e.payout_date <> '') or
      (p_filters->>'processingStage' = 'application-date-missing' and not e.has_application_date)
    )
    and (coalesce(p_filters->>'category', '') = '' or e.canonical_category = public.assistance_category(p_filters->>'category'))
    and (coalesce(p_filters->>'assistanceType', '') = '' or e.assistance_type_normalized = public.assistance_normalize(p_filters->>'assistanceType'))
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
        where e.diagnosis_text not like '%' || token || '%'
      )
    )
    and (
      coalesce(p_filters->>'conditionCategory', '') = '' or exists (
        select 1 from jsonb_array_elements_text(e.condition_categories) condition
        where public.assistance_normalize(condition) = public.assistance_normalize(p_filters->>'conditionCategory')
      )
    )
    and (coalesce(p_filters->>'employmentStatus', '') = '' or e.employment_status_normalized = public.assistance_normalize(p_filters->>'employmentStatus'))
    and (coalesce(p_filters->>'minIncome', '') = '' or e.income_value >= public.assistance_number(p_filters->>'minIncome'))
    and (coalesce(p_filters->>'maxIncome', '') = '' or e.income_value <= public.assistance_number(p_filters->>'maxIncome'))
    and (coalesce(p_filters->>'minExpenses', '') = '' or e.expenses_value >= public.assistance_number(p_filters->>'minExpenses'))
    and (coalesce(p_filters->>'maxExpenses', '') = '' or e.expenses_value <= public.assistance_number(p_filters->>'maxExpenses'))
    and (coalesce(p_filters->>'minAmount', '') = '' or e.amount_value >= public.assistance_number(p_filters->>'minAmount'))
    and (coalesce(p_filters->>'maxAmount', '') = '' or e.amount_value <= public.assistance_number(p_filters->>'maxAmount'))
    and (coalesce(p_filters->>'createdFrom', '') = '' or e.application_date >= p_filters->>'createdFrom')
    and (coalesce(p_filters->>'createdTo', '') = '' or e.application_date <= p_filters->>'createdTo')
    and (coalesce(p_filters->>'payoutFrom', '') = '' or (e.payout_date <> '' and e.payout_date >= p_filters->>'payoutFrom'))
    and (coalesce(p_filters->>'payoutTo', '') = '' or (e.payout_date <> '' and e.payout_date <= p_filters->>'payoutTo'))
),
ordered as (
  select f.*, row_number() over (order by
    case when p_filters->>'sort' = 'name' then f.name_text end asc,
    case when p_filters->>'sort' = 'name-desc' then f.name_text end desc,
    case when p_filters->>'sort' = 'oldest' then f.application_date end asc,
    case when coalesce(p_filters->>'sort', 'newest') = 'newest' then f.application_date end desc,
    case when p_filters->>'sort' = 'birthday-oldest' then f.birthday end asc,
    case when p_filters->>'sort' = 'birthday-newest' then f.birthday end desc,
    case when p_filters->>'sort' = 'barangay-asc' then f.canonical_barangay end asc,
    case when p_filters->>'sort' = 'barangay-desc' then f.canonical_barangay end desc,
    case when p_filters->>'sort' = 'assistance-asc' then f.assistance_type_normalized end asc,
    case when p_filters->>'sort' = 'assistance-desc' then f.assistance_type_normalized end desc,
    case when p_filters->>'sort' = 'amount-low' then f.amount_value end asc,
    case when p_filters->>'sort' = 'amount-high' then f.amount_value end desc,
    case when p_filters->>'sort' = 'payout-oldest' then nullif(f.payout_date, '') end asc nulls last,
    case when p_filters->>'sort' = 'payout-newest' then nullif(f.payout_date, '') end desc nulls last,
    case when p_filters->>'sort' = 'history-low' then f.total_granted end asc,
    case when p_filters->>'sort' = 'history-high' then f.total_granted end desc,
    f.record_id desc
  ) as page_order
  from filtered f
  limit greatest(1, least(coalesce(p_page_size, 20), 100))
  offset (greatest(1, coalesce(p_page, 1)) - 1) * greatest(1, least(coalesce(p_page_size, 20), 100))
),
filter_options as (
  select jsonb_build_object(
    'barangays', coalesce((select jsonb_agg(value order by value) from (select distinct canonical_barangay value from base) valueset), '[]'::jsonb),
    'assistanceTypes', coalesce((select jsonb_agg(value order by value) from (select distinct assistance_type value from base) valueset), '[]'::jsonb),
    'sexes', coalesce((select jsonb_agg(value order by value) from (select distinct sex_label value from base) valueset), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(value order by value) from (select distinct canonical_category value from base) valueset), '[]'::jsonb),
    'employmentStatuses', coalesce((select jsonb_agg(value order by value) from (select distinct employment_status value from base) valueset), '[]'::jsonb)
  ) value
)
select jsonb_build_object(
  'records', coalesce((select jsonb_agg(jsonb_build_object(
    'id', record_id,
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
