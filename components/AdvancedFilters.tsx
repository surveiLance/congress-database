"use client";

import { useState } from "react";
import { AssistanceRecord } from "@/lib/types";
import { conditionCategories } from "@/lib/conditionCategories";
import { canonicalBarangay, canonicalCategory, canonicalLabel } from "@/lib/recordTaxonomy";

export type RecordStatusFilter = "active" | "archived";
export type RecordSort = "name" | "newest" | "oldest" | "amount-high" | "amount-low";

export interface RecordFilters {
  name: string;
  district: string;
  barangay: string;
  sex: string;
  minAge: string;
  maxAge: string;
  category: string;
  assistanceType: string;
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
  status: RecordStatusFilter;
  sort: RecordSort;
}

export const defaultRecordFilters: RecordFilters = {
  name: "", district: "", barangay: "", sex: "", minAge: "", maxAge: "", category: "",
  assistanceType: "", diagnosis: "", conditionCategory: "", employmentStatus: "", minIncome: "",
  maxIncome: "", minExpenses: "", maxExpenses: "", minAmount: "", maxAmount: "",
  createdFrom: "", createdTo: "", status: "active", sort: "newest",
};

interface Props {
  filters: RecordFilters;
  records: AssistanceRecord[];
  matchingCount: number;
  onChange: (filters: RecordFilters) => void;
}

export default function AdvancedFilters({ filters, records, matchingCount, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const update = (field: keyof RecordFilters, value: string) => {
    onChange({ ...filters, [field]: value });
  };
  const uniqueValues = (field: keyof AssistanceRecord, canonicalize = canonicalLabel) =>
    Array.from(new Set(records.map((record) => canonicalize(String(record[field] || ""))).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b));
  const activeFilters = getActiveFilters(filters);
  const clearFilters = () => onChange({ ...defaultRecordFilters, status: filters.status });
  const barangays = uniqueValues("brgy", canonicalBarangay);
  const assistanceTypes = uniqueValues("assistanceType");

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
        <Filter label="Sort">
          <select value={filters.sort} onChange={(event) => update("sort", event.target.value)}>
            <option value="name">Name</option><option value="newest">Newest</option><option value="oldest">Oldest</option>
            <option value="amount-high">Amount highest</option><option value="amount-low">Amount lowest</option>
          </select>
        </Filter>
        <button className="more-filter-button" type="button" onClick={() => setExpanded(true)} aria-haspopup="dialog">
          More filters{activeFilters.length ? <span>{activeFilters.length}</span> : null}
        </button>
        <span className="filter-summary-count">{matchingCount} matching</span>
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
                onClick={() => update(filter.field, filter.clearValue ?? "")}
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
              </FilterGroup>
              <FilterGroup title="Applicant">
                <Filter label="Sex"><Options value={filters.sex} values={uniqueValues("sex")} allLabel="All" onChange={(value) => update("sex", value)} /></Filter>
                <Filter label="Minimum age"><input type="number" min="0" value={filters.minAge} onChange={(event) => update("minAge", event.target.value)} /></Filter>
                <Filter label="Maximum age"><input type="number" min="0" value={filters.maxAge} onChange={(event) => update("maxAge", event.target.value)} /></Filter>
                <Filter label="Category"><Options value={filters.category} values={uniqueValues("category", canonicalCategory)} allLabel="All categories" onChange={(value) => update("category", value)} /></Filter>
              </FilterGroup>
              <FilterGroup title="Medical">
                <Filter label="Diagnosis or condition"><input value={filters.diagnosis} onChange={(event) => update("diagnosis", event.target.value)} placeholder="Keyword" /></Filter>
                <Filter label="Condition category"><Options value={filters.conditionCategory} values={[...conditionCategories]} allLabel="All condition categories" onChange={(value) => update("conditionCategory", value)} /></Filter>
              </FilterGroup>
              <FilterGroup title="Employment & financial">
                <Filter label="Employment status"><Options value={filters.employmentStatus} values={uniqueValues("employedStatus")} allLabel="All statuses" onChange={(value) => update("employmentStatus", value)} /></Filter>
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
  add("category", `Category: ${filters.category}`);
  add("assistanceType", `Assistance: ${filters.assistanceType}`);
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
  if (filters.sort !== defaultRecordFilters.sort) {
    const labels: Record<RecordSort, string> = {
      name: "Name",
      newest: "Newest",
      oldest: "Oldest",
      "amount-high": "Amount highest",
      "amount-low": "Amount lowest",
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
