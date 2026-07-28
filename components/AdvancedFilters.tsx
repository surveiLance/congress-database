"use client";

import { AssistanceRecord } from "@/lib/types";
import { conditionCategories } from "@/lib/conditionCategories";

export type RecordStatusFilter = "active" | "archived";
export type RecordSort = "name" | "newest" | "oldest" | "amount-high" | "amount-low";

export interface RecordFilters {
  name: string;
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
  name: "", barangay: "", sex: "", minAge: "", maxAge: "", category: "",
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
  const update = (field: keyof RecordFilters, value: string) => {
    onChange({ ...filters, [field]: value });
  };
  const uniqueValues = (field: keyof AssistanceRecord) =>
    Array.from(new Set(records.map((record) => String(record[field] || "")).filter(Boolean))).sort((a, b) => a.localeCompare(b));

  return (
    <section className="filters-section" aria-labelledby="advanced-filters-title">
      <details className="advanced-filter-panel">
        <summary>
          <span><strong id="advanced-filters-title">Advanced Filters</strong><small>Combine filters to narrow the records table</small></span>
          <span className="filter-summary-count">{matchingCount} matching</span>
        </summary>
        <div className="filter-grid">
          <Filter label="Name"><input value={filters.name} onChange={(event) => update("name", event.target.value)} placeholder="Applicant name" /></Filter>
          <Filter label="Barangay"><Options value={filters.barangay} values={uniqueValues("brgy")} allLabel="All barangays" onChange={(value) => update("barangay", value)} /></Filter>
          <Filter label="Sex"><Options value={filters.sex} values={uniqueValues("sex")} allLabel="All" onChange={(value) => update("sex", value)} /></Filter>
          <Filter label="Minimum age"><input type="number" min="0" value={filters.minAge} onChange={(event) => update("minAge", event.target.value)} /></Filter>
          <Filter label="Maximum age"><input type="number" min="0" value={filters.maxAge} onChange={(event) => update("maxAge", event.target.value)} /></Filter>
          <Filter label="Category"><Options value={filters.category} values={uniqueValues("category")} allLabel="All categories" onChange={(value) => update("category", value)} /></Filter>
          <Filter label="Assistance type"><Options value={filters.assistanceType} values={uniqueValues("assistanceType")} allLabel="All types" onChange={(value) => update("assistanceType", value)} /></Filter>
          <Filter label="Diagnosis or condition"><input value={filters.diagnosis} onChange={(event) => update("diagnosis", event.target.value)} placeholder="Keyword" /></Filter>
          <Filter label="Condition category"><Options value={filters.conditionCategory} values={[...conditionCategories]} allLabel="All condition categories" onChange={(value) => update("conditionCategory", value)} /></Filter>
          <Filter label="Employment status"><Options value={filters.employmentStatus} values={uniqueValues("employedStatus")} allLabel="All statuses" onChange={(value) => update("employmentStatus", value)} /></Filter>
          <Filter label="Minimum monthly income"><MoneyInput value={filters.minIncome} onChange={(value) => update("minIncome", value)} /></Filter>
          <Filter label="Maximum monthly income"><MoneyInput value={filters.maxIncome} onChange={(value) => update("maxIncome", value)} /></Filter>
          <Filter label="Minimum monthly expenses"><MoneyInput value={filters.minExpenses} onChange={(value) => update("minExpenses", value)} /></Filter>
          <Filter label="Maximum monthly expenses"><MoneyInput value={filters.maxExpenses} onChange={(value) => update("maxExpenses", value)} /></Filter>
          <Filter label="Minimum amount granted"><MoneyInput value={filters.minAmount} onChange={(value) => update("minAmount", value)} /></Filter>
          <Filter label="Maximum amount granted"><MoneyInput value={filters.maxAmount} onChange={(value) => update("maxAmount", value)} /></Filter>
          <Filter label="Created from"><input type="date" value={filters.createdFrom} onChange={(event) => update("createdFrom", event.target.value)} /></Filter>
          <Filter label="Created to"><input type="date" value={filters.createdTo} onChange={(event) => update("createdTo", event.target.value)} /></Filter>
          <Filter label="Sort by">
            <select value={filters.sort} onChange={(event) => update("sort", event.target.value)}>
              <option value="name">Name</option><option value="newest">Newest</option><option value="oldest">Oldest</option>
              <option value="amount-high">Amount highest</option><option value="amount-low">Amount lowest</option>
            </select>
          </Filter>
        </div>
        <div className="filter-footer">
          <span><strong>{matchingCount}</strong> matching record{matchingCount === 1 ? "" : "s"}</span>
          <button className="btn secondary" type="button" onClick={() => onChange({ ...defaultRecordFilters, status: filters.status })}>Clear Filters</button>
        </div>
      </details>
    </section>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="filter-field"><span>{label}</span>{children}</label>;
}

function Options({ value, values, allLabel, onChange }: { value: string; values: string[]; allLabel: string; onChange: (value: string) => void }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)}><option value="">{allLabel}</option>{values.map((option) => <option key={option}>{option}</option>)}</select>;
}

function MoneyInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <input type="number" min="0" step=".01" value={value} onChange={(event) => onChange(event.target.value)} placeholder="₱0.00" />;
}
