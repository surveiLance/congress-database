-- Run once in Supabase Dashboard > SQL Editor after performance.sql.
-- Reports are calculated inside PostgreSQL. The browser receives only totals,
-- chart points, or one 20-row drilldown page -- never the full record set.

create or replace function public.filtered_assistance_report_records(
  p_query text default '',
  p_filters jsonb default '{}'::jsonb
)
returns table (
  record_id bigint,
  summary_record jsonb,
  surname_normalized text,
  first_name_normalized text,
  birthday date,
  application_date text,
  canonical_barangay text,
  canonical_category text,
  sex_normalized text,
  age_value numeric,
  assistance_type text,
  assistance_type_normalized text,
  diagnosis_text text,
  amount_value numeric,
  created_at timestamptz,
  application_count bigint,
  history_total_granted numeric
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
with status_base as (
  select *
  from public.assistance_record_index i
  where case when coalesce(p_filters->>'status', 'active') = 'archived' then i.is_archived else not i.is_archived end
),
candidate as (
  select i.*
  from status_base i
  where
    (
      public.assistance_normalize(p_query) = '' or not exists (
        select 1 from regexp_split_to_table(public.assistance_normalize(p_query), ' +') token
        where i.search_text not like '%' || token || '%'
      )
    )
    and (
      public.assistance_normalize(p_filters->>'name') = '' or not exists (
        select 1 from regexp_split_to_table(public.assistance_normalize(p_filters->>'name'), ' +') token
        where i.name_text not like '%' || token || '%'
      )
    )
    and (
      coalesce(p_filters->>'district', '') = '' or
      (p_filters->>'district' = 'district-1' and i.canonical_barangay in ('Bagong Nayon','Beverly Hills','De La Paz','Mambugan','Mayamot','Munting Dilao','San Isidro','Santa Cruz')) or
      (p_filters->>'district' = 'outside-district-1' and i.canonical_barangay not in ('Not recorded','Bagong Nayon','Beverly Hills','De La Paz','Mambugan','Mayamot','Munting Dilao','San Isidro','Santa Cruz')) or
      (p_filters->>'district' = 'not-recorded' and i.canonical_barangay = 'Not recorded')
    )
    and (coalesce(p_filters->>'barangay', '') = '' or i.canonical_barangay = public.assistance_barangay(p_filters->>'barangay'))
    and (coalesce(p_filters->>'sex', '') = '' or i.sex_normalized = public.assistance_normalize(p_filters->>'sex'))
    and (coalesce(p_filters->>'minAge', '') = '' or i.age_value >= public.assistance_number(p_filters->>'minAge'))
    and (coalesce(p_filters->>'maxAge', '') = '' or i.age_value <= public.assistance_number(p_filters->>'maxAge'))
    and (coalesce(p_filters->>'minHousehold', '') = '' or i.household_members >= public.assistance_number(p_filters->>'minHousehold'))
    and (coalesce(p_filters->>'maxHousehold', '') = '' or i.household_members <= public.assistance_number(p_filters->>'maxHousehold'))
    and (
      coalesce(p_filters->>'processingStage', '') = '' or
      (p_filters->>'processingStage' = 'application-recorded' and i.application_date <> '') or
      (p_filters->>'processingStage' = 'awaiting-payout' and i.application_date <> '' and i.payout_date = '') or
      (p_filters->>'processingStage' = 'payout-completed' and i.payout_date <> '') or
      (p_filters->>'processingStage' = 'application-date-missing' and not i.has_application_date)
    )
    and (coalesce(p_filters->>'category', '') = '' or i.canonical_category = public.assistance_category(p_filters->>'category'))
    and (coalesce(p_filters->>'assistanceType', '') = '' or i.assistance_type_normalized = public.assistance_normalize(p_filters->>'assistanceType'))
    and (
      jsonb_array_length(coalesce(p_filters->'agencies', '[]'::jsonb)) = 0 or
      not exists (
        select 1 from jsonb_array_elements_text(p_filters->'agencies') selected_agency
        where not exists (
          select 1 from jsonb_array_elements_text(i.agencies) record_agency
          where public.assistance_normalize(record_agency) = public.assistance_normalize(selected_agency)
        )
      )
    )
    and (
      coalesce(p_filters->>'agencyMatch', 'includes') <> 'exact' or
      jsonb_array_length(coalesce(p_filters->'agencies', '[]'::jsonb)) = 0 or
      (select count(distinct public.assistance_normalize(record_agency)) from jsonb_array_elements_text(i.agencies) record_agency) = jsonb_array_length(p_filters->'agencies')
    )
    and (
      public.assistance_normalize(p_filters->>'diagnosis') = '' or not exists (
        select 1 from regexp_split_to_table(public.assistance_normalize(p_filters->>'diagnosis'), ' +') token
        where i.diagnosis_text not like '%' || token || '%'
      )
    )
    and (
      coalesce(p_filters->>'conditionCategory', '') = '' or exists (
        select 1 from jsonb_array_elements_text(i.condition_categories) condition
        where public.assistance_normalize(condition) = public.assistance_normalize(p_filters->>'conditionCategory')
      )
    )
    and (coalesce(p_filters->>'employmentStatus', '') = '' or i.employment_status_normalized = public.assistance_normalize(p_filters->>'employmentStatus'))
    and (coalesce(p_filters->>'minIncome', '') = '' or i.income_value >= public.assistance_number(p_filters->>'minIncome'))
    and (coalesce(p_filters->>'maxIncome', '') = '' or i.income_value <= public.assistance_number(p_filters->>'maxIncome'))
    and (coalesce(p_filters->>'minExpenses', '') = '' or i.expenses_value >= public.assistance_number(p_filters->>'minExpenses'))
    and (coalesce(p_filters->>'maxExpenses', '') = '' or i.expenses_value <= public.assistance_number(p_filters->>'maxExpenses'))
    and (coalesce(p_filters->>'minAmount', '') = '' or i.amount_value >= public.assistance_number(p_filters->>'minAmount'))
    and (coalesce(p_filters->>'maxAmount', '') = '' or i.amount_value <= public.assistance_number(p_filters->>'maxAmount'))
    and (coalesce(p_filters->>'createdFrom', '') = '' or i.application_date >= p_filters->>'createdFrom')
    and (coalesce(p_filters->>'createdTo', '') = '' or i.application_date <= p_filters->>'createdTo')
    and (coalesce(p_filters->>'payoutFrom', '') = '' or (i.payout_date <> '' and i.payout_date >= p_filters->>'payoutFrom'))
    and (coalesce(p_filters->>'payoutTo', '') = '' or (i.payout_date <> '' and i.payout_date <= p_filters->>'payoutTo'))
),
history as (
  select
    c.surname_normalized,
    c.first_name_normalized,
    c.birthday,
    count(*) as application_count,
    sum(c.amount_value) as history_total_granted
  from candidate c
  group by c.surname_normalized, c.first_name_normalized, c.birthday
)
select
  c.record_id, c.summary_record, c.surname_normalized, c.first_name_normalized,
  c.birthday, c.application_date, c.canonical_barangay, c.canonical_category,
  c.sex_normalized, c.age_value, c.assistance_type, c.assistance_type_normalized,
  c.diagnosis_text, c.amount_value, c.created_at,
  h.application_count, h.history_total_granted
from candidate c
join history h using (surname_normalized, first_name_normalized, birthday);
$$;

revoke execute on function public.filtered_assistance_report_records(text, jsonb) from anon;
grant execute on function public.filtered_assistance_report_records(text, jsonb) to authenticated;

create or replace function public.get_assistance_dashboard(
  p_query text default '',
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language sql
stable
security invoker
set search_path = public, extensions
as $$
with filtered as (
  select * from public.filtered_assistance_report_records(p_query, p_filters)
),
ranked as (
  select f.*, row_number() over (
    partition by f.surname_normalized, f.first_name_normalized, f.birthday
    order by f.application_date desc, f.record_id desc
  ) as applicant_order
  from filtered f
),
applicants as (
  select * from ranked where applicant_order = 1
),
identity_summary as (
  select
    surname_normalized, first_name_normalized, birthday,
    max(application_count) as application_count,
    bool_or(diagnosis_text <> '') as has_diagnosis
  from filtered
  group by surname_normalized, first_name_normalized, birthday
),
totals as (
  select count(*) as applications, coalesce(sum(amount_value), 0) as amount from filtered
),
barangay_counts as (
  select canonical_barangay as name, count(*) as value
  from applicants group by canonical_barangay order by value desc, name
),
assistance_counts as (
  select assistance_type as name, count(*) as value, coalesce(sum(amount_value), 0) as amount
  from filtered group by assistance_type order by value desc, name
),
monthly_counts as (
  select left(application_date, 7) as key, count(*) as value, coalesce(sum(amount_value), 0) as amount
  from filtered where application_date ~ '^\d{4}-\d{2}'
  group by left(application_date, 7) order by key
),
frequency_counts as (
  select case when application_count > 1 then 'Returning' else 'First-time' end as name, count(*) as value
  from identity_summary group by 1 order by 1
),
age_counts as (
  select case
    when age_value <= 0 then 'Not recorded'
    when age_value < 18 then 'Under 18'
    when age_value < 30 then '18–29'
    when age_value < 45 then '30–44'
    when age_value < 60 then '45–59'
    else '60+'
  end as name, count(*) as value
  from applicants group by 1
),
barangay_amounts as (
  select canonical_barangay as name, coalesce(sum(amount_value), 0) as value,
    count(*) as applications, coalesce(avg(amount_value), 0) as average
  from filtered group by canonical_barangay order by value desc, name
)
select jsonb_build_object(
  'uniqueApplicants', (select count(*) from identity_summary),
  'totalApplications', (select applications from totals),
  'cards', jsonb_build_array(
    jsonb_build_object('label', 'Unique Active Applicants', 'value', (select count(*) from applicants), 'format', 'number'),
    jsonb_build_object('label', 'Returning Applicants', 'value', (select count(*) from identity_summary where application_count > 1), 'format', 'number'),
    jsonb_build_object('label', 'Total Applications', 'value', (select applications from totals), 'format', 'number'),
    jsonb_build_object('label', 'Male Applicants', 'value', (select count(*) from applicants where sex_normalized = 'male'), 'format', 'number'),
    jsonb_build_object('label', 'Female Applicants', 'value', (select count(*) from applicants where sex_normalized = 'female'), 'format', 'number'),
    jsonb_build_object('label', 'Senior Applicants', 'value', (select count(*) from applicants where canonical_category = 'Senior' or age_value >= 60), 'format', 'number'),
    jsonb_build_object('label', 'Medical Assistance Cases', 'value', (select count(*) from filtered where assistance_type_normalized = 'medical'), 'format', 'number'),
    jsonb_build_object('label', 'Total Amount Granted', 'value', (select amount from totals), 'format', 'currency'),
    jsonb_build_object('label', 'Average Amount Granted', 'value', (select case when applications > 0 then amount / applications else 0 end from totals), 'format', 'currency'),
    jsonb_build_object('label', 'Applicants with Diagnoses', 'value', (select count(*) from identity_summary where has_diagnosis), 'format', 'number')
  ),
  'barangayCounts', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'value', value, 'unit', 'applicants') order by value desc, name) from barangay_counts), '[]'::jsonb),
  'assistanceCounts', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'value', value, 'amount', amount, 'applications', value, 'unit', 'applications') order by value desc, name) from assistance_counts), '[]'::jsonb),
  'monthlyCounts', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'name', to_char(to_date(key || '-01', 'YYYY-MM-DD'), 'Mon YYYY'), 'value', value, 'amount', amount, 'applications', value, 'unit', 'applications') order by key) from monthly_counts), '[]'::jsonb),
  'applicantFrequency', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'value', value, 'unit', 'applicants') order by name) from frequency_counts), '[]'::jsonb),
  'ageGroups', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'value', value, 'unit', 'applicants') order by case name when 'Under 18' then 1 when '18–29' then 2 when '30–44' then 3 when '45–59' then 4 when '60+' then 5 else 6 end) from age_counts), '[]'::jsonb),
  'barangayAmounts', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'value', value, 'applications', applications, 'average', average) order by value desc, name) from barangay_amounts), '[]'::jsonb)
);
$$;

revoke execute on function public.get_assistance_dashboard(text, jsonb) from anon;
grant execute on function public.get_assistance_dashboard(text, jsonb) to authenticated;

create or replace function public.search_assistance_report_records(
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
with filtered as (
  select * from public.filtered_assistance_report_records(p_query, p_filters)
),
ranked as (
  select f.*, row_number() over (
    partition by f.surname_normalized, f.first_name_normalized, f.birthday
    order by f.application_date desc, f.record_id desc
  ) as applicant_order
  from filtered f
),
segmented as (
  select * from ranked r
  where
    coalesce(p_filters->>'reportDimension', '') = ''
    or (p_filters->>'reportDimension' = 'applicant-barangay' and r.applicant_order = 1 and r.canonical_barangay = public.assistance_barangay(p_filters->>'reportValue'))
    or (p_filters->>'reportDimension' = 'grant-barangay' and r.canonical_barangay = public.assistance_barangay(p_filters->>'reportValue'))
    or (p_filters->>'reportDimension' = 'assistance' and r.assistance_type_normalized = public.assistance_normalize(p_filters->>'reportValue'))
    or (p_filters->>'reportDimension' = 'month' and left(r.application_date, 7) = p_filters->>'reportValue')
    or (p_filters->>'reportDimension' = 'frequency' and p_filters->>'reportValue' = 'Returning' and r.application_count > 1)
    or (p_filters->>'reportDimension' = 'frequency' and p_filters->>'reportValue' = 'First-time' and r.application_count = 1)
    or (p_filters->>'reportDimension' = 'age-group' and r.applicant_order = 1 and case
      when r.age_value <= 0 then 'Not recorded'
      when r.age_value < 18 then 'Under 18'
      when r.age_value < 30 then '18–29'
      when r.age_value < 45 then '30–44'
      when r.age_value < 60 then '45–59'
      else '60+'
    end = p_filters->>'reportValue')
),
page_rows as (
  select * from segmented
  order by application_date desc, record_id desc
  limit greatest(1, least(coalesce(p_page_size, 20), 100))
  offset (greatest(1, coalesce(p_page, 1)) - 1) * greatest(1, least(coalesce(p_page_size, 20), 100))
)
select jsonb_build_object(
  'records', coalesce((select jsonb_agg(jsonb_build_object('id', record_id, 'record', summary_record) order by application_date desc, record_id desc) from page_rows), '[]'::jsonb),
  'total', (select count(*) from segmented),
  'total_granted', (select coalesce(sum(amount_value), 0) from segmented)
);
$$;

revoke execute on function public.search_assistance_report_records(text, jsonb, integer, integer) from anon;
grant execute on function public.search_assistance_report_records(text, jsonb, integer, integer) to authenticated;
