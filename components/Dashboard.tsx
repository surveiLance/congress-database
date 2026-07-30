"use client";

import { useMemo, useState } from "react";
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
import { ApplicantHistory, buildApplicantHistories } from "@/lib/applicantIdentity";
import { AssistanceRecord } from "@/lib/types";

interface DashboardProps {
  records: AssistanceRecord[];
  onView: (record: AssistanceRecord) => void;
}

export default function Dashboard({ records, onView }: DashboardProps) {
  const [drilldown, setDrilldown] = useState<{ chart: string; group: ChartDatum } | null>(null);
  const report = useMemo(() => {
    const total = records.reduce((sum, record) => sum + record.amount, 0);
    const histories = Array.from(buildApplicantHistories(records).values());
    const applicants = histories.map((history) => history.latestApplication);
    const canonicalBarangay = (record: AssistanceRecord) => normalizeBarangay(record.brgy);
    const canonicalAssistance = (record: AssistanceRecord) => normalizeLabel(record.assistanceType);
    return {
      histories,
      cards: [
        ["Unique Active Applicants", applicants.filter((record) => !record.archivedAt).length.toLocaleString()],
        ["Returning Applicants", histories.filter((history) => history.applicationCount > 1).length.toLocaleString()],
        ["Total Applications", records.length.toLocaleString()],
        ["Male Applicants", countValue(applicants, "sex", "male").toLocaleString()],
        ["Female Applicants", countValue(applicants, "sex", "female").toLocaleString()],
        ["Senior Applicants", applicants.filter((record) => record.category.toLowerCase() === "senior" || Number(record.age) >= 60).length.toLocaleString()],
        ["Medical Assistance Cases", countValue(records, "assistanceType", "medical").toLocaleString()],
        ["Total Amount Granted", money(total)],
        ["Average Amount Granted", money(records.length ? total / records.length : 0)],
        ["Applicants with Diagnoses", histories.filter((history) => history.records.some((record) => record.diagnosis.trim())).length.toLocaleString()],
      ],
      barangayCounts: groupCount(applicants, canonicalBarangay, "applicants"),
      assistanceCounts: groupCount(records, canonicalAssistance, "applications", true),
      monthlyCounts: groupByMonth(records),
      applicantFrequency: groupApplicantFrequency(histories),
      ageGroups: groupAgeRanges(applicants),
      barangayAmounts: groupSum(records, canonicalBarangay, (record) => record.amount),
    };
  }, [records]);
  const { histories, cards, barangayCounts, assistanceCounts, monthlyCounts, applicantFrequency, ageGroups, barangayAmounts } = report;
  const openDrilldown = (chart: string, value: unknown) => {
    const group = chartDatumFromEvent(value);
    if (group) setDrilldown({ chart, group });
  };

  return (
    <section className="dashboard-report" aria-labelledby="dashboard-title">
      <div className="dashboard-heading">
        <div>
          <h2 id="dashboard-title">Dashboard Overview</h2>
          <p>Aggregated report for {histories.length} unique applicant{histories.length === 1 ? "" : "s"} across {records.length} application{records.length === 1 ? "" : "s"}. Hover over a chart to see names, then click it to open the application list.</p>
        </div>
        <button className="btn secondary print-hide" type="button" onClick={() => window.print()}>Print Report</button>
      </div>
      <p className="report-data-note">Barangay capitalization, spacing, and common abbreviations are combined in these charts. Open any bar or point to review the applications behind it.</p>

      <div className="grid-stats" aria-label="Program statistics">
        {cards.map(([label, value]) => (
          <article className="card" key={label}>
            <h3>{label}</h3>
            <div className="number">{value}</div>
          </article>
        ))}
      </div>

      <details className="report-charts">
        <summary><strong>View detailed charts</strong><span>6 aggregated charts</span></summary>
        <div className="chart-grid">
        <ChartCard title="Applicants by Barangay" hasData={barangayCounts.length > 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barangayCounts.slice(0, 16)} layout="vertical" margin={{ top: 8, right: 16, left: 12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 10 }} />
              <Tooltip content={<ApplicantChartTooltip />} />
              <Bar dataKey="value" name="Applicants" fill="#2563eb" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(entry) => openDrilldown("Applicants by Barangay", entry)} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Applications by Assistance Type" hasData={assistanceCounts.length > 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={assistanceCounts} layout="vertical" margin={{ top: 8, right: 16, left: 12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 10 }} />
              <Tooltip content={<ApplicantChartTooltip />} />
              <Bar dataKey="value" name="Applications" fill="#7c3aed" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(entry) => openDrilldown("Applications by Assistance Type", entry)} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Applications & Grants by Month" hasData={monthlyCounts.length > 0}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlyCounts} margin={{ top: 8, right: 8, left: -12, bottom: 12 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="applications" allowDecimals={false} />
              <YAxis yAxisId="amount" orientation="right" tickFormatter={compactMoney} width={48} />
              <Tooltip content={<ApplicantChartTooltip />} />
              <Bar
                yAxisId="applications"
                dataKey="value"
                name="Applications"
                fill="#2563eb"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                onClick={(entry) => openDrilldown("Applications & Grants by Month", entry)}
              />
              <Line
                yAxisId="amount"
                type="monotone"
                dataKey="amount"
                name="Amount granted"
                stroke="#16a34a"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="First-time vs Returning Applicants" hasData={applicantFrequency.length > 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={applicantFrequency} layout="vertical" margin={{ top: 36, right: 24, left: 24, bottom: 36 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={112} tick={{ fontSize: 11 }} />
              <Tooltip content={<ApplicantChartTooltip />} />
              <Bar dataKey="value" name="Applicants" fill="#0891b2" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(entry) => openDrilldown("First-time vs Returning Applicants", entry)} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Applicants by Age Group" hasData={ageGroups.length > 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ageGroups} layout="vertical" margin={{ top: 8, right: 16, left: 12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 10 }} />
              <Tooltip content={<ApplicantChartTooltip />} />
              <Bar dataKey="value" name="Applicants" fill="#d97706" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(entry) => openDrilldown("Applicants by Age Group", entry)} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Amount Granted by Barangay" hasData={barangayAmounts.length > 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barangayAmounts.slice(0, 16)} layout="vertical" margin={{ top: 8, right: 16, left: 12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={compactMoney} />
              <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 10 }} />
              <Tooltip content={<ApplicantChartTooltip currency />} />
              <Bar dataKey="value" name="Amount granted" fill="#16a34a" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(entry) => openDrilldown("Amount Granted by Barangay", entry)} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        </div>
      </details>
      {drilldown && (
        <ChartApplicantModal
          key={`${drilldown.chart}-${drilldown.group.key || drilldown.group.name}`}
          chart={drilldown.chart}
          group={drilldown.group}
          onClose={() => setDrilldown(null)}
          onView={(record) => {
            setDrilldown(null);
            onView(record);
          }}
        />
      )}
    </section>
  );
}

function ChartCard({ title, hasData, children }: { title: string; hasData: boolean; children: React.ReactNode }) {
  return (
    <article className="chart-card">
      <div className="chart-card-heading">
        <h3>{title}</h3>
        {hasData && <span>Hover for names · Click to view</span>}
      </div>
      <div className="chart-area">
        {hasData ? children : <div className="chart-empty">No matching data to display.</div>}
      </div>
    </article>
  );
}

interface ChartDatum {
  name: string;
  value: number;
  records: AssistanceRecord[];
  key?: string;
  amount?: number;
  average?: number;
  unit?: "applications" | "applicants";
}

function countValue(records: AssistanceRecord[], field: "sex" | "assistanceType", value: string) {
  return records.filter((record) => record[field].trim().toLowerCase() === value).length;
}

function groupCount(
  records: AssistanceRecord[],
  getGroup: (record: AssistanceRecord) => string,
  unit: ChartDatum["unit"] = "applications",
  includeAmount = false,
): ChartDatum[] {
  const groups = new Map<string, AssistanceRecord[]>();
  records.forEach((record) => {
    const group = getGroup(record);
    const groupedRecords = groups.get(group);
    if (groupedRecords) groupedRecords.push(record);
    else groups.set(group, [record]);
  });
  return Array.from(groups, ([name, groupedRecords]) => ({
    name,
    value: groupedRecords.length,
    records: groupedRecords,
    unit,
    amount: includeAmount ? groupedRecords.reduce((sum, record) => sum + record.amount, 0) : undefined,
  })).sort((first, second) => second.value - first.value);
}

function groupSum(records: AssistanceRecord[], getGroup: (record: AssistanceRecord) => string, getValue: (record: AssistanceRecord) => number): ChartDatum[] {
  const groups = new Map<string, AssistanceRecord[]>();
  records.forEach((record) => {
    const group = getGroup(record);
    const groupedRecords = groups.get(group);
    if (groupedRecords) groupedRecords.push(record);
    else groups.set(group, [record]);
  });
  return Array.from(groups, ([name, groupedRecords]) => ({
    name,
    value: groupedRecords.reduce((sum, record) => sum + getValue(record), 0),
    records: groupedRecords,
    average: groupedRecords.length
      ? groupedRecords.reduce((sum, record) => sum + getValue(record), 0) / groupedRecords.length
      : 0,
  })).sort((first, second) => second.value - first.value);
}

function groupByMonth(records: AssistanceRecord[]): ChartDatum[] {
  const groups = new Map<string, AssistanceRecord[]>();
  records.forEach((record) => {
    const date = new Date(record.applicationDate || record.createdAt);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const groupedRecords = groups.get(key);
    if (groupedRecords) groupedRecords.push(record);
    else groups.set(key, [record]);
  });
  return Array.from(groups, ([key, groupedRecords]) => ({
    key,
    name: new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(`${key}-01T00:00:00`)),
    value: groupedRecords.length,
    records: groupedRecords,
    amount: groupedRecords.reduce((sum, record) => sum + record.amount, 0),
    unit: "applications" as const,
  })).sort((first, second) => String(first.key).localeCompare(String(second.key)));
}

function groupApplicantFrequency(histories: ApplicantHistory[]): ChartDatum[] {
  const firstTime = histories.filter((history) => history.applicationCount === 1);
  const returning = histories.filter((history) => history.applicationCount > 1);
  return [
    {
      name: "First-time",
      value: firstTime.length,
      records: firstTime.flatMap((history) => history.records),
      unit: "applicants" as const,
    },
    {
      name: "Returning",
      value: returning.length,
      records: returning.flatMap((history) => history.records),
      unit: "applicants" as const,
    },
  ].filter((group) => group.value > 0);
}

function groupAgeRanges(records: AssistanceRecord[]): ChartDatum[] {
  const order = ["Under 18", "18–29", "30–44", "45–59", "60+", "Not recorded"];
  return groupCount(records, (record) => {
    const age = applicantAge(record);
    if (age === null) return "Not recorded";
    if (age < 18) return "Under 18";
    if (age < 30) return "18–29";
    if (age < 45) return "30–44";
    if (age < 60) return "45–59";
    return "60+";
  }, "applicants").sort((first, second) => order.indexOf(first.name) - order.indexOf(second.name));
}

function applicantAge(record: AssistanceRecord): number | null {
  const birthday = String(record.birthday || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (birthday) {
    const birthDate = new Date(Number(birthday[1]), Number(birthday[2]) - 1, Number(birthday[3]));
    if (
      birthDate.getFullYear() === Number(birthday[1]) &&
      birthDate.getMonth() === Number(birthday[2]) - 1 &&
      birthDate.getDate() === Number(birthday[3])
    ) {
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      if (
        today.getMonth() < birthDate.getMonth() ||
        (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
      ) age -= 1;
      if (age >= 0 && age <= 130) return age;
    }
  }
  const recordedAge = Number(record.age);
  return Number.isFinite(recordedAge) && recordedAge >= 0 && recordedAge <= 130 ? recordedAge : null;
}

function normalizeBarangay(value: string): string {
  const normalized = normalizeSearchText(value);
  if (!normalized) return "Unspecified";
  const aliases: Record<string, string> = {
    "bagong nayon": "Bagong Nayon",
    "beverly hills": "Beverly Hills",
    "de la paz": "Dela Paz",
    "dela paz": "Dela Paz",
    "munting dilaw": "Muntingdilaw",
    muntingdilaw: "Muntingdilaw",
    "san isidro": "San Isidro",
    "sta cruz": "Sta. Cruz",
    "santa cruz": "Sta. Cruz",
  };
  return aliases[normalized] || titleCase(normalized);
}

function normalizeLabel(value: string): string {
  const normalized = normalizeSearchText(value);
  return normalized ? titleCase(normalized) : "Unspecified";
}

function titleCase(value: string): string {
  return value.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("en-PH"));
}

function chartDatumFromEvent(value: unknown): ChartDatum | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as { payload?: unknown; records?: unknown };
  const candidate = entry.payload && typeof entry.payload === "object" ? entry.payload : entry;
  if (!("records" in candidate) || !Array.isArray(candidate.records)) return null;
  return candidate as ChartDatum;
}

function ApplicantChartTooltip({
  active,
  payload,
  currency = false,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartDatum; value?: number }>;
  currency?: boolean;
}) {
  const group = payload?.[0]?.payload;
  if (!active || !group) return null;
  const applicants = uniqueApplicants(group.records);
  return (
    <div className="applicant-chart-tooltip">
      <strong>{group.name}</strong>
      <b>{currency ? money(group.value) : `${group.value.toLocaleString()} ${group.unit || "applications"}`}</b>
      {group.amount !== undefined && <small>Total granted: {money(group.amount)}</small>}
      {group.average !== undefined && <small>Average grant: {money(group.average)}</small>}
      <span>{applicants.slice(0, 4).map(applicantName).join(", ")}</span>
      {applicants.length > 4 && <small>+{applicants.length - 4} more</small>}
      <small>Click the chart to view details</small>
    </div>
  );
}

function ChartApplicantModal({
  chart,
  group,
  onClose,
  onView,
}: {
  chart: string;
  group: ChartDatum;
  onClose: () => void;
  onView: (record: AssistanceRecord) => void;
}) {
  const [query, setQuery] = useState("");
  const [assistanceType, setAssistanceType] = useState("");
  const [barangay, setBarangay] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const assistanceOptions = useMemo(
    () => uniqueOptions(group.records.map((record) => record.assistanceType)),
    [group.records],
  );
  const barangayOptions = useMemo(
    () => uniqueOptions(group.records.map((record) => record.brgy)),
    [group.records],
  );
  const filtered = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    return group.records
      .filter((record) => {
        const applicationDate = (record.applicationDate || record.createdAt).slice(0, 10);
        const searchable = normalizeSearchText([
          applicantName(record),
          record.birthday,
          record.brgy,
          record.assistanceType,
          record.diagnosis,
          record.remarks,
        ].join(" "));
        return (!normalizedQuery || searchable.includes(normalizedQuery)) &&
          (!assistanceType || record.assistanceType === assistanceType) &&
          (!barangay || record.brgy === barangay) &&
          (!dateFrom || applicationDate >= dateFrom) &&
          (!dateTo || applicationDate <= dateTo);
      })
      .sort(
        (first, second) => (Date.parse(second.applicationDate || second.createdAt) || 0) - (Date.parse(first.applicationDate || first.createdAt) || 0),
      );
  }, [assistanceType, barangay, dateFrom, dateTo, group.records, query]);
  const hasFilters = Boolean(query || assistanceType || barangay || dateFrom || dateTo);
  const clearFilters = () => {
    setQuery("");
    setAssistanceType("");
    setBarangay("");
    setDateFrom("");
    setDateTo("");
  };
  return (
    <div className="modal active" role="dialog" aria-modal="true" aria-labelledby="chart-applicants-title">
      <div className="modal-content chart-applicant-modal">
        <div className="modal-header">
          <div>
            <span className="eyebrow">{chart}</span>
            <h2 id="chart-applicants-title">{group.name}</h2>
          </div>
          <button className="close" type="button" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="chart-drilldown-filters">
          <label className="chart-drilldown-search">
            <span>Search this chart</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, birthday, barangay, diagnosis…"
            />
          </label>
          <label>
            <span>Assistance</span>
            <select value={assistanceType} onChange={(event) => setAssistanceType(event.target.value)}>
              <option value="">All types</option>
              {assistanceOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span>Barangay</span>
            <select value={barangay} onChange={(event) => setBarangay(event.target.value)}>
              <option value="">All barangays</option>
              {barangayOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span>From</span>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label>
            <span>To</span>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          {hasFilters && <button className="btn secondary small" type="button" onClick={clearFilters}>Clear filters</button>}
        </div>
        <div className="chart-applicant-summary">
          <strong>{filtered.length} matching application{filtered.length === 1 ? "" : "s"}</strong>
          <span>Total granted: {money(filtered.reduce((sum, record) => sum + record.amount, 0))}</span>
        </div>
        <div className="chart-applicant-list">
          {!filtered.length && <div className="chart-applicant-empty">No applications match these filters.</div>}
          {filtered.map((record) => (
            <article className="chart-applicant-row" key={record.id ?? `${record.applicationDate || record.createdAt}-${applicantName(record)}`}>
              <div>
                <strong>{applicantName(record)}</strong>
                <span>{record.brgy || "No barangay"} · {formatReportDate(record.applicationDate || record.createdAt)}</span>
              </div>
              <div>
                <strong>{money(record.amount)}</strong>
                <span>{record.assistanceType || "Unspecified assistance"}</span>
              </div>
              <button className="btn secondary small" type="button" onClick={() => onView(record)}>View History</button>
            </article>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn secondary" type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function uniqueApplicants(records: AssistanceRecord[]) {
  const unique = new Map<string, AssistanceRecord>();
  records.forEach((record) => {
    const key = `${record.surname}|${record.firstName}|${record.birthday}`.toLocaleLowerCase("en-PH");
    if (!unique.has(key)) unique.set(key, record);
  });
  return Array.from(unique.values());
}

function uniqueOptions(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
    .sort((first, second) => first.localeCompare(second));
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-PH")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function applicantName(record: AssistanceRecord) {
  return `${record.surname}, ${record.firstName} ${record.middleName}`.replace(/\s+/g, " ").trim();
}

function formatReportDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date not recorded" : date.toLocaleDateString("en-PH");
}

function money(value: number) {
  return `₱${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function compactMoney(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
