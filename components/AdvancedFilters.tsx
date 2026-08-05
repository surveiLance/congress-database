"use client";

import { useState } from "react";
import { AssistanceRecord } from "@/lib/types";
import { conditionCategories } from "@/lib/conditionCategories";
import { canonicalBarangay, canonicalCategory, canonicalLabel } from "@/lib/recordTaxonomy";
import { assistanceAgencies } from "@/lib/assistanceAgencies";
import type { RecordFilterOptions } from "@/lib/recordStore";

export type RecordStatusFilter = "active" | "archived";
export type RecordSort =
  | "name" | "name-desc"
  | "newest" | "oldest"
  | "birthday-newest" | "birthday-oldest"
  | "barangay-asc" | "barangay-desc"
  | "assistance-asc" | "assistance-desc"
  | "amount-high" | "amount-low"
  | "payout-newest" | "payout-oldest"
  | "history-high" | "history-low";

export interface RecordFilters {
  name: string;
  district: string;
  barangay: string;
  sex: string;
  minAge: string;
  maxAge: string;
  minHousehold: string;
  maxHousehold: string;
  processingStage: string;
  category: string;
  assistanceType: string;
  agencies: string[];
  agencyMatch: "includes" | "exact";
  diagnosis: string;
  conditionCategory: string;
  employmentStatus: string;
  minIncome: string;
  maxIncome: string;
  minExpenses: string;
  maxExpenses: string;
  minAmount: string;
  maxAmount: string;
  createdFrom: string;
  createdTo: string;
  payoutFrom: string;
  payoutTo: string;
  status: RecordStatusFilter;
  sort: RecordSort;
}

export const defaultRecordFilters: RecordFilters = {
  name: "", district: "", barangay: "", sex: "", minAge: "", maxAge: "", minHousehold: "", maxHousehold: "", processingStage: "", category: "",
  assistanceType: "", agencies: [], agencyMatch: "includes", diagnosis: "", conditionCategory: "", employmentStatus: "", minIncome: "",
  maxIncome: "", minExpenses: "", maxExpenses: "", minAmount: "", maxAmount: "",
  createdFrom: "", createdTo: "", payoutFrom: "", payoutTo: "", status: "active", sort: "newest",
};

interface Props {
  filters: RecordFilters;
  records: AssistanceRecord[];
  optionValues?: RecordFilterOptions;
  matchingCount: number;
  onChange: (filters: RecordFilters) => void;
}

export default function AdvancedFilters({ filters, records, optionValues, matchingCount, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const update = (field: keyof RecordFilters, value: string) => {
    onChange({ ...filters, [field]: value });
  };
  const uniqueValues = (field: keyof AssistanceRecord, canonicalize = canonicalLabel) =>
    Array.from(new Set(records.map((record) => canonicalize(String(record[field] || ""))).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b));
  const canonicalOptions = (values: string[], canonicalize = canonicalLabel) =>
    Array.from(new Set(values.map(canonicalize).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const activeFilters = getActiveFilters(filters);
  const clearFilters = () => onChange({ ...defaultRecordFilters, status: filters.status });
  const removeFilter = (filter: ActiveFilter) => {
    if (filter.field === "agencies") {
      onChange({ ...filters, agencies: [], agencyMatch: "includes" });
      return;
    }
    update(filter.field, filter.clearValue ?? "");
  };
  const toggleAgency = (agency: string) => {
    const agencies = filters.agencies.includes(agency)
      ? filters.agencies.filter((selected) => selected !== agency)
      : [...filters.agencies, agency];
    onChange({ ...filters, agencies });
  };
  const barangays = optionValues ? canonicalOptions(optionValues.barangays, canonicalBarangay) : uniqueValues("brgy", canonicalBarangay);
  const assistanceTypes = optionValues?.assistanceTypes || uniqueValues("assistanceType");

  return (
    <section className="filters-section" aria-labelledby="advanced-filters-title">
      <div className={`quick-filter-bar${activeFilters.length ? " has-active" : ""}`}>
        <div className="quick-filter-heading">
          <span className="filter-toggle-icon" aria-hidden="true">≡</span>
          <span>
            <strong id="advanced-filters-title">Quick filters</strong>
            <small>Common checks stay within reach</small>
          </span>
        </div>
        <Filter label="District">
          <select value={filters.district} onChange={(event) => update("district", event.target.value)}>
            <option value="">All locations</option>
            <option value="district-1">District 1</option>
            <option value="outside-district-1">Outside District 1</option>
            <option value="not-recorded">Not recorded</option>
          </select>
        </Filter>
        <Filter label="Barangay"><Options value={filters.barangay} values={barangays} allLabel="All barangays" onChange={(value) => update("barangay", value)} /></Filter>
        <Filter label="Assistance"><Options value={filters.assistanceType} values={assistanceTypes} allLabel="All types" onChange={(value) => update("assistanceType", value)} /></Filter>
        <Filter label="Family count">
          <span className="family-count-range">
            <input aria-label="Minimum family count" type="number" min="0" step="1" value={filters.minHousehold} onChange={(event) => update("minHousehold", event.target.value)} placeholder="Min" />
            <span aria-hidden="true">to</span>
            <input aria-label="Maximum family count" type="number" min="0" step="1" value={filters.maxHousehold} onChange={(event) => update("maxHousehold", event.target.value)} placeholder="Max" />
          </span>
        </Filter>
        <Filter label="Processing stage">
          <select value={filters.processingStage} onChange={(event) => update("processingStage", event.target.value)}>
            <option value="">All stages</option>
            <option value="application-recorded">Application done</option>
            <option value="awaiting-payout">Awaiting payout</option>
            <option value="payout-completed">Payout done</option>
            <option value="application-date-missing">Application date missing</option>
          </select>
        </Filter>
        <Filter label="Sort">
          <select value={filters.sort} onChange={(event) => update("sort", event.target.value)}>
            <option value="name">Name A–Z</option><option value="name-desc">Name Z–A</option>
            <option value="newest">Application newest</option><option value="oldest">Application oldest</option>
            <option value="birthday-newest">Birthday newest</option><option value="birthday-oldest">Birthday oldest</option>
            <option value="barangay-asc">Barangay A–Z</option><option value="barangay-desc">Barangay Z–A</option>
            <option value="assistance-asc">Assistance A–Z</option><option value="assistance-desc">Assistance Z–A</option>
            <option value="amount-high">Grant highest</option><option value="amount-low">Grant lowest</option>
            <option value="payout-newest">Payout latest</option><option value="payout-oldest">Payout earliest</option>
            <option value="history-high">History total highest</option><option value="history-low">History total lowest</option>
          </select>
        </Filter>
        <button className="more-filter-button" type="button" onClick={() => setExpanded(true)} aria-haspopup="dialog">
          More filters{activeFilters.length ? <span>{activeFilters.length}</span> : null}
        </button>
        <span className="filter-summary-count">{matchingCount} matching</span>
      </div>

      <div className={`agency-filter-strip${filters.agencies.length ? " has-active" : ""}`}>
        <div className="agency-filter-heading">
          <strong>Agency filter</strong>
          <small>Check one or more agencies</small>
        </div>
        <div className="agency-filter-options" role="group" aria-label="Agencies">
          {assistanceAgencies.map((agency) => (
            <label className={filters.agencies.includes(agency) ? "selected" : ""} key={agency}>
              <input type="checkbox" checked={filters.agencies.includes(agency)} onChange={() => toggleAgency(agency)} />
              <span>{agency}</span>
            </label>
          ))}
        </div>
        <label className="agency-match-mode">
          <span>Match</span>
          <select
            value={filters.agencyMatch}
            disabled={!filters.agencies.length}
            onChange={(event) => onChange({ ...filters, agencyMatch: event.target.value === "exact" ? "exact" : "includes" })}
          >
            <option value="includes">Includes selected</option>
            <option value="exact">Exact combination only</option>
          </select>
        </label>
      </div>

      {activeFilters.length > 0 && (
        <div className="active-filter-bar" aria-label="Applied filters">
          <span className="active-filter-label">Applied:</span>
          <div className="active-filter-chips">
            {activeFilters.map((filter) => (
              <button
                className="active-filter-chip"
                type="button"
                key={filter.field}
                onClick={() => removeFilter(filter)}
                aria-label={`Remove ${filter.label} filter`}
                title={`Remove ${filter.label} filter`}
              >
                <span>{filter.label}</span>
                <span className="active-filter-remove" aria-hidden="true">×</span>
              </button>
            ))}
          </div>
          <button className="clear-filter-link" type="button" onClick={clearFilters}>Clear all</button>
        </div>
      )}

      {expanded && (
        <div className="filter-drawer-backdrop" role="dialog" aria-modal="true" aria-labelledby="more-filters-title">
          <div className="advanced-filter-panel" id="advanced-filter-fields">
            <div className="filter-panel-heading">
              <div><span className="eyebrow">Records desk</span><h2 id="more-filters-title">More filters</h2><p>Use only the extra details needed for this search.</p></div>
              <button className="close" type="button" onClick={() => setExpanded(false)} aria-label="Close filters">&times;</button>
            </div>
            <div className="filter-groups">
              <FilterGroup title="Application">
                <Filter label="Applicant name"><input value={filters.name} onChange={(event) => update("name", event.target.value)} placeholder="Name within current results" /></Filter>
                <Filter label="Application date from"><input type="date" value={filters.createdFrom} onChange={(event) => update("createdFrom", event.target.value)} /></Filter>
                <Filter label="Application date to"><input type="date" value={filters.createdTo} onChange={(event) => update("createdTo", event.target.value)} /></Filter>
                <Filter label="Payout date from"><input type="date" value={filters.payoutFrom} onChange={(event) => update("payoutFrom", event.target.value)} /></Filter>
                <Filter label="Payout date to"><input type="date" value={filters.payoutTo} onChange={(event) => update("payoutTo", event.target.value)} /></Filter>
              </FilterGroup>
              <FilterGroup title="Applicant">
                <Filter label="Sex"><Options value={filters.sex} values={optionValues?.sexes || uniqueValues("sex")} allLabel="All" onChange={(value) => update("sex", value)} /></Filter>
                <Filter label="Minimum age"><input type="number" min="0" value={filters.minAge} onChange={(event) => update("minAge", event.target.value)} /></Filter>
                <Filter label="Maximum age"><input type="number" min="0" value={filters.maxAge} onChange={(event) => update("maxAge", event.target.value)} /></Filter>
                <Filter label="Category"><Options value={filters.category} values={optionValues ? canonicalOptions(optionValues.categories, canonicalCategory) : uniqueValues("category", canonicalCategory)} allLabel="All categories" onChange={(value) => update("category", value)} /></Filter>
              </FilterGroup>
              <FilterGroup title="Medical">
                <Filter label="Diagnosis or condition"><input value={filters.diagnosis} onChange={(event) => update("diagnosis", event.target.value)} placeholder="Keyword" /></Filter>
                <Filter label="Condition category"><Options value={filters.conditionCategory} values={[...conditionCategories]} allLabel="All condition categories" onChange={(value) => update("conditionCategory", value)} /></Filter>
              </FilterGroup>
              <FilterGroup title="Household">
                <Filter label="Minimum family members"><input type="number" min="0" step="1" value={filters.minHousehold} onChange={(event) => update("minHousehold", event.target.value)} placeholder="e.g. 5" /></Filter>
                <Filter label="Maximum family members"><input type="number" min="0" step="1" value={filters.maxHousehold} onChange={(event) => update("maxHousehold", event.target.value)} /></Filter>
              </FilterGroup>
              <FilterGroup title="Employment & financial">
                <Filter label="Employment status"><Options value={filters.employmentStatus} values={optionValues?.employmentStatuses || uniqueValues("employedStatus")} allLabel="All statuses" onChange={(value) => update("employmentStatus", value)} /></Filter>
                <Filter label="Minimum monthly income"><MoneyInput value={filters.minIncome} onChange={(value) => update("minIncome", value)} /></Filter>
                <Filter label="Maximum monthly income"><MoneyInput value={filters.maxIncome} onChange={(value) => update("maxIncome", value)} /></Filter>
                <Filter label="Minimum monthly expenses"><MoneyInput value={filters.minExpenses} onChange={(value) => update("minExpenses", value)} /></Filter>
                <Filter label="Maximum monthly expenses"><MoneyInput value={filters.maxExpenses} onChange={(value) => update("maxExpenses", value)} /></Filter>
                <Filter label="Minimum amount granted"><MoneyInput value={filters.minAmount} onChange={(value) => update("minAmount", value)} /></Filter>
                <Filter label="Maximum amount granted"><MoneyInput value={filters.maxAmount} onChange={(value) => update("maxAmount", value)} /></Filter>
              </FilterGroup>
            </div>
            <div className="filter-footer">
              <span><strong>{matchingCount}</strong> matching record{matchingCount === 1 ? "" : "s"}</span>
              <div className="filter-footer-actions">
                {activeFilters.length > 0 && <button className="btn secondary" type="button" onClick={clearFilters}>Clear all</button>}
                <button className="btn" type="button" onClick={() => setExpanded(false)}>Show results</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

type ActiveFilter = {
  field: keyof RecordFilters;
  label: string;
  clearValue?: string;
};

function getActiveFilters(filters: RecordFilters): ActiveFilter[] {
  const money = (value: string) => `₱${Number(value).toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
  const active: ActiveFilter[] = [];
  const add = (field: keyof RecordFilters, label: string, clearValue?: string) => {
    if (filters[field]) active.push({ field, label, clearValue });
  };

  add("name", `Name: ${filters.name}`);
  if (filters.district) {
    const districtLabels: Record<string, string> = {
      "district-1": "District: District 1",
      "outside-district-1": "District: Outside District 1",
      "not-recorded": "District: Barangay not recorded",
    };
    active.push({ field: "district", label: districtLabels[filters.district] || filters.district });
  }
  add("barangay", `Barangay: ${filters.barangay}`);
  add("sex", `Sex: ${filters.sex}`);
  add("minAge", `Age: ${filters.minAge}+`);
  add("maxAge", `Age: up to ${filters.maxAge}`);
  add("minHousehold", `Household: ${filters.minHousehold}+ members`);
  add("maxHousehold", `Household: up to ${filters.maxHousehold} members`);
  if (filters.processingStage) {
    const stageLabels: Record<string, string> = {
      "application-recorded": "Stage: Application done",
      "awaiting-payout": "Stage: Awaiting payout",
      "payout-completed": "Stage: Payout done",
      "application-date-missing": "Stage: Application date missing",
    };
    active.push({ field: "processingStage", label: stageLabels[filters.processingStage] || filters.processingStage });
  }
  add("category", `Category: ${filters.category}`);
  add("assistanceType", `Assistance: ${filters.assistanceType}`);
  if (filters.agencies.length) {
    const selected = assistanceAgencies.filter((agency) => filters.agencies.includes(agency));
    active.push({
      field: "agencies",
      label: `Agencies: ${filters.agencyMatch === "exact" ? "exactly " : "includes "}${selected.join(" + ")}`,
    });
  }
  add("diagnosis", `Diagnosis: ${filters.diagnosis}`);
  add("conditionCategory", `Condition: ${filters.conditionCategory}`);
  add("employmentStatus", `Employment: ${filters.employmentStatus}`);
  if (filters.minIncome) active.push({ field: "minIncome", label: `Income: ${money(filters.minIncome)}+` });
  if (filters.maxIncome) active.push({ field: "maxIncome", label: `Income: up to ${money(filters.maxIncome)}` });
  if (filters.minExpenses) active.push({ field: "minExpenses", label: `Expenses: ${money(filters.minExpenses)}+` });
  if (filters.maxExpenses) active.push({ field: "maxExpenses", label: `Expenses: up to ${money(filters.maxExpenses)}` });
  if (filters.minAmount) active.push({ field: "minAmount", label: `Granted: ${money(filters.minAmount)}+` });
  if (filters.maxAmount) active.push({ field: "maxAmount", label: `Granted: up to ${money(filters.maxAmount)}` });
  add("createdFrom", `Applied from: ${filters.createdFrom}`);
  add("createdTo", `Applied to: ${filters.createdTo}`);
  add("payoutFrom", `Paid from: ${filters.payoutFrom}`);
  add("payoutTo", `Paid to: ${filters.payoutTo}`);
  if (filters.sort !== defaultRecordFilters.sort) {
    const labels: Record<RecordSort, string> = {
      name: "Name",
      "name-desc": "Name Z–A",
      newest: "Newest",
      oldest: "Oldest",
      "birthday-newest": "Birthday newest",
      "birthday-oldest": "Birthday oldest",
      "barangay-asc": "Barangay A–Z",
      "barangay-desc": "Barangay Z–A",
      "assistance-asc": "Assistance A–Z",
      "assistance-desc": "Assistance Z–A",
      "amount-high": "Amount highest",
      "amount-low": "Amount lowest",
      "payout-newest": "Latest payout",
      "payout-oldest": "Earliest payout",
      "history-high": "History total highest",
      "history-low": "History total lowest",
    };
    active.push({ field: "sort", label: `Sort: ${labels[filters.sort]}`, clearValue: defaultRecordFilters.sort });
  }
  return active;
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="filter-field"><span>{label}</span>{children}</label>;
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <fieldset className="filter-group"><legend>{title}</legend><div>{children}</div></fieldset>;
}

function Options({ value, values, allLabel, onChange }: { value: string; values: string[]; allLabel: string; onChange: (value: string) => void }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)}><option value="">{allLabel}</option>{values.map((option) => <option key={option}>{option}</option>)}</select>;
}

function MoneyInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <input type="number" min="0" step=".01" value={value} onChange={(event) => onChange(event.target.value)} placeholder="₱0.00" />;
}
