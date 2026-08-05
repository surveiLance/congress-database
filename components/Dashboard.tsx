"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RecordFilters } from "@/components/AdvancedFilters";
import { getDashboardReport, getReportRecordPage } from "@/lib/recordStore";
import { emptyDashboardReport, ReportGroup } from "@/lib/reportData";
import { canonicalBarangay } from "@/lib/recordTaxonomy";
import { AssistanceRecord } from "@/lib/types";

interface DashboardProps {
  query: string;
  filters: RecordFilters;
  refreshKey: number;
  onView: (record: AssistanceRecord) => void;
}

export default function Dashboard({ query, filters, refreshKey, onView }: DashboardProps) {
  const [report, setReport] = useState(emptyDashboardReport);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drilldown, setDrilldown] = useState<{ chart: string; dimension: RecordFilters["reportDimension"]; group: ReportGroup } | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");
    void getDashboardReport(query, filters)
      .then((result) => {
        if (requestId.current === currentRequest) setReport(result);
      })
      .catch((reason) => {
        console.error(reason);
        if (requestId.current === currentRequest) setError("Reports could not be prepared. Run the Supabase reporting update, then try again.");
      })
      .finally(() => {
        if (requestId.current === currentRequest) setLoading(false);
      });
  }, [filters, query, refreshKey]);

  const openDrilldown = (chart: string, dimension: RecordFilters["reportDimension"], value: unknown) => {
    const group = chartDatumFromEvent(value);
    if (group) setDrilldown({ chart, dimension, group });
  };

  if (loading) return <ReportStatus label="Supabase is calculating the complete district report…" />;
  if (error) return <div className="error" role="alert">{error}</div>;

  return (
    <section className="dashboard-report" aria-labelledby="dashboard-title">
      <div className="dashboard-heading">
        <div>
          <h2 id="dashboard-title">Dashboard Overview</h2>
          <p>Supabase summarized {report.uniqueApplicants.toLocaleString()} unique applicant{report.uniqueApplicants === 1 ? "" : "s"} across {report.totalApplications.toLocaleString()} application{report.totalApplications === 1 ? "" : "s"}. Only aggregated figures were sent to this browser.</p>
        </div>
        <button className="btn secondary print-hide" type="button" onClick={() => window.print()}>Print Report</button>
      </div>
      <p className="report-data-note">Every total covers the complete filtered database. Open a chart category to request its applications 20 at a time.</p>

      <div className="grid-stats" aria-label="Program statistics">
        {report.cards.map((card) => (
          <article className="card" key={card.label}>
            <h3>{card.label}</h3>
            <div className="number">{card.format === "currency" ? money(card.value) : card.value.toLocaleString()}</div>
          </article>
        ))}
      </div>

      <details className="report-charts">
        <summary><strong>View detailed charts</strong><span>6 database-generated charts</span></summary>
        <div className="chart-grid">
          <ChartCard title="Applicants by Barangay" groups={report.barangayCounts.slice(0, 16)} onSelect={(group) => setDrilldown({ chart: "Applicants by Barangay", dimension: "applicant-barangay", group })}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.barangayCounts.slice(0, 16)} layout="vertical" margin={{ top: 8, right: 16, left: 12, bottom: 8 }} onClick={(entry) => openDrilldown("Applicants by Barangay", "applicant-barangay", entry)}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 10 }} />
                <Tooltip content={<ReportTooltip />} /><Bar dataKey="value" name="Applicants" fill="#2563eb" radius={[0, 4, 4, 0]} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Applications by Assistance Type" groups={report.assistanceCounts} onSelect={(group) => setDrilldown({ chart: "Applications by Assistance Type", dimension: "assistance", group })}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.assistanceCounts} layout="vertical" margin={{ top: 8, right: 16, left: 12, bottom: 8 }} onClick={(entry) => openDrilldown("Applications by Assistance Type", "assistance", entry)}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 10 }} />
                <Tooltip content={<ReportTooltip />} /><Bar dataKey="value" name="Applications" fill="#7c3aed" radius={[0, 4, 4, 0]} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Applications & Grants by Month" groups={report.monthlyCounts} onSelect={(group) => setDrilldown({ chart: "Applications & Grants by Month", dimension: "month", group })}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={report.monthlyCounts} margin={{ top: 8, right: 8, left: -12, bottom: 12 }} onClick={(entry) => openDrilldown("Applications & Grants by Month", "month", entry)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis yAxisId="applications" allowDecimals={false} /><YAxis yAxisId="amount" orientation="right" tickFormatter={compactMoney} width={48} />
                <Tooltip content={<ReportTooltip />} /><Bar yAxisId="applications" dataKey="value" name="Applications" fill="#2563eb" radius={[4, 4, 0, 0]} cursor="pointer" /><Line yAxisId="amount" type="monotone" dataKey="amount" name="Amount granted" stroke="#16a34a" strokeWidth={3} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="First-time vs Returning Applicants" groups={report.applicantFrequency} onSelect={(group) => setDrilldown({ chart: "First-time vs Returning Applicants", dimension: "frequency", group })}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.applicantFrequency} layout="vertical" margin={{ top: 36, right: 24, left: 24, bottom: 36 }} onClick={(entry) => openDrilldown("First-time vs Returning Applicants", "frequency", entry)}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={112} tick={{ fontSize: 11 }} />
                <Tooltip content={<ReportTooltip />} /><Bar dataKey="value" name="Applicants" fill="#0891b2" radius={[0, 4, 4, 0]} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Applicants by Age Group" groups={report.ageGroups} onSelect={(group) => setDrilldown({ chart: "Applicants by Age Group", dimension: "age-group", group })}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.ageGroups} layout="vertical" margin={{ top: 8, right: 16, left: 12, bottom: 8 }} onClick={(entry) => openDrilldown("Applicants by Age Group", "age-group", entry)}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 10 }} />
                <Tooltip content={<ReportTooltip />} /><Bar dataKey="value" name="Applicants" fill="#d97706" radius={[0, 4, 4, 0]} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Amount Granted by Barangay" groups={report.barangayAmounts.slice(0, 16)} currency onSelect={(group) => setDrilldown({ chart: "Amount Granted by Barangay", dimension: "grant-barangay", group })}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.barangayAmounts.slice(0, 16)} layout="vertical" margin={{ top: 8, right: 16, left: 12, bottom: 8 }} onClick={(entry) => openDrilldown("Amount Granted by Barangay", "grant-barangay", entry)}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tickFormatter={compactMoney} /><YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 10 }} />
                <Tooltip content={<ReportTooltip currency />} /><Bar dataKey="value" name="Amount granted" fill="#16a34a" radius={[0, 4, 4, 0]} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </details>

      {drilldown && <ReportDrilldown key={`${drilldown.chart}-${drilldown.group.key || drilldown.group.name}`} {...drilldown} query={query} filters={filters} onClose={() => setDrilldown(null)} onView={(record) => { setDrilldown(null); onView(record); }} />}
    </section>
  );
}

function ChartCard({ title, groups, currency = false, onSelect, children }: { title: string; groups: ReportGroup[]; currency?: boolean; onSelect: (group: ReportGroup) => void; children: React.ReactNode }) {
  const hasData = groups.length > 0;
  return <article className="chart-card">
    <div className="chart-card-heading"><h3>{title}</h3>{hasData && <span>Hover for summary</span>}</div>
    <div className="chart-area">{hasData ? children : <div className="chart-empty">No matching data to display.</div>}</div>
    {hasData && <label className="chart-open-control"><span>Open application list</span><select aria-label={`${title}: open application list`} value="" onChange={(event) => { const group = groups[Number(event.target.value)]; if (group) onSelect(group); }}><option value="">Choose a category…</option>{groups.map((group, index) => <option value={index} key={group.key || `${group.name}-${index}`}>{group.name} · {currency ? money(group.value) : group.value.toLocaleString()}</option>)}</select></label>}
  </article>;
}

function ReportTooltip({ active, payload, currency = false }: { active?: boolean; payload?: Array<{ payload?: ReportGroup }>; currency?: boolean }) {
  const group = payload?.[0]?.payload;
  if (!active || !group) return null;
  return <div className="applicant-chart-tooltip"><strong>{group.name}</strong>{currency ? <><Metric label="Total granted" value={money(group.value)} /><Metric label="Applications" value={(group.applications || 0).toLocaleString()} /></> : <Metric label={titleCase(group.unit || "applications")} value={group.value.toLocaleString()} />}{!currency && group.amount !== undefined && <Metric label="Total granted" value={money(group.amount)} />}{group.average !== undefined && <Metric label="Average grant" value={money(group.average)} />}<small>Open this category to request its applications</small></div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><b>{value}</b></div>; }

function ReportDrilldown({ chart, dimension, group, query: parentQuery, filters: parentFilters, onClose, onView }: {
  chart: string;
  dimension: RecordFilters["reportDimension"];
  group: ReportGroup;
  query: string;
  filters: RecordFilters;
  onClose: () => void;
  onView: (record: AssistanceRecord) => void;
}) {
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<AssistanceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalGranted, setTotalGranted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const reportFilters = useMemo<RecordFilters>(() => ({
    ...parentFilters,
    createdFrom: dateFrom || parentFilters.createdFrom,
    createdTo: dateTo || parentFilters.createdTo,
    reportDimension: dimension,
    reportValue: group.key || group.name,
    reportFrequency: dimension === "frequency" ? (group.name === "Returning" ? "returning" : "first-time") : "",
    sort: "newest",
  }), [dateFrom, dateTo, dimension, group.key, group.name, parentFilters]);

  useEffect(() => setPage(1), [query, dateFrom, dateTo]);
  useEffect(() => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");
    void getReportRecordPage({ query: [parentQuery, query].filter(Boolean).join(" "), filters: reportFilters, page, pageSize: 20 })
      .then((result) => {
        if (requestId.current !== currentRequest) return;
        setRecords(result.records); setTotal(result.total); setTotalGranted(result.totalGranted);
      })
      .catch((reason) => { console.error(reason); if (requestId.current === currentRequest) setError("This application list could not be loaded."); })
      .finally(() => { if (requestId.current === currentRequest) setLoading(false); });
  }, [page, parentQuery, query, reportFilters]);
  const pageCount = Math.max(1, Math.ceil(total / 20));

  return <div className="modal active" role="dialog" aria-modal="true" aria-labelledby="chart-applicants-title"><div className="modal-content chart-applicant-modal">
    <div className="modal-header"><div><span className="eyebrow">{chart}</span><h2 id="chart-applicants-title">{group.name}</h2></div><button className="close" type="button" onClick={onClose} aria-label="Close">&times;</button></div>
    <div className="chart-drilldown-filters">
      <label className="chart-drilldown-search"><span>Search this category</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, birthday, barangay, diagnosis…" /></label>
      <label><span>From</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
      <label><span>To</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
      {(query || dateFrom || dateTo) && <button className="btn secondary small" type="button" onClick={() => { setQuery(""); setDateFrom(""); setDateTo(""); }}>Clear filters</button>}
    </div>
    <div className="chart-applicant-summary"><strong>{total.toLocaleString()} matching application{total === 1 ? "" : "s"}</strong><span>Total granted: {money(totalGranted)}</span></div>
    {error && <div className="error" role="alert">{error}</div>}
    <div className="chart-applicant-list">
      {loading && <ReportStatus label="Requesting this page from Supabase…" />}
      {!loading && !records.length && <div className="chart-applicant-empty">No applications match these filters.</div>}
      {!loading && records.map((record) => <article className="chart-applicant-row" key={record.id}><div><strong>{applicantName(record)}</strong><span>{canonicalBarangay(record.brgy)} · {formatDate(record.applicationDate || record.createdAt)}</span></div><div><strong>{money(record.amount)}</strong><span>{record.assistanceType || "Unspecified assistance"}</span></div><button className="btn secondary small" type="button" onClick={() => onView(record)}>View History</button></article>)}
    </div>
    <div className="modal-footer"><span>Page {page} of {pageCount}</span><button className="btn secondary small" type="button" disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="btn secondary small" type="button" disabled={page >= pageCount || loading} onClick={() => setPage((value) => value + 1)}>Next</button><button className="btn secondary" type="button" onClick={onClose}>Close</button></div>
  </div></div>;
}

function ReportStatus({ label }: { label: string }) { return <div className="workspace-loading" role="status"><span className="loading-spinner" aria-hidden="true" /><strong>{label}</strong></div>; }
function chartDatumFromEvent(value: unknown): ReportGroup | null { if (!value || typeof value !== "object") return null; const entry = value as { activePayload?: Array<{ payload?: ReportGroup }>; payload?: ReportGroup; name?: string; value?: number }; return entry.activePayload?.[0]?.payload || entry.payload || (entry.name && typeof entry.value === "number" ? entry as ReportGroup : null); }
function applicantName(record: AssistanceRecord) { return `${record.surname}, ${record.firstName} ${record.middleName}`.replace(/\s+/g, " ").trim(); }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Date not recorded" : date.toLocaleDateString("en-PH"); }
function money(value: number) { return `₱${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function compactMoney(value: number) { return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value); }
function titleCase(value: string) { return value.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("en-PH")); }
