"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildApplicantHistories } from "@/lib/applicantIdentity";
import { AssistanceRecord } from "@/lib/types";

const colors = ["#2563eb", "#16a34a", "#d97706", "#7c3aed", "#dc2626", "#0891b2", "#4f46e5", "#65a30d"];

interface DashboardProps {
  records: AssistanceRecord[];
  onView: (record: AssistanceRecord) => void;
}

export default function Dashboard({ records, onView }: DashboardProps) {
  const [drilldown, setDrilldown] = useState<{ chart: string; group: ChartDatum } | null>(null);
  const total = records.reduce((sum, record) => sum + record.amount, 0);
  const histories = Array.from(buildApplicantHistories(records).values());
  const applicants = histories.map((history) => history.latestApplication);
  const cards = [
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
  ];

  const barangayCounts = groupCount(applicants, (record) => record.brgy || "Unspecified");
  const assistanceCounts = groupCount(records, (record) => record.assistanceType || "Unspecified");
  const sexCounts = groupCount(applicants, (record) => record.sex || "Unspecified");
  const monthlyCounts = groupByMonth(records);
  const diagnosisCounts = groupConditionCategories(records).slice(0, 8);
  const barangayAmounts = groupSum(records, (record) => record.brgy || "Unspecified", (record) => record.amount);
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
            <BarChart data={barangayCounts} margin={{ top: 8, right: 8, left: -20, bottom: 44 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={60} tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip content={<ApplicantChartTooltip />} />
              <Bar dataKey="value" name="Applicants" fill="#2563eb" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(entry) => openDrilldown("Applicants by Barangay", entry)} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Assistance Type Distribution" hasData={assistanceCounts.length > 0}>
          <DistributionChart data={assistanceCounts} onSelect={(entry) => openDrilldown("Assistance Type Distribution", entry)} />
        </ChartCard>

        <ChartCard title="Sex Distribution" hasData={sexCounts.length > 0}>
          <DistributionChart data={sexCounts} onSelect={(entry) => openDrilldown("Sex Distribution", entry)} />
        </ChartCard>

        <ChartCard title="Applications by Month" hasData={monthlyCounts.length > 0}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyCounts} margin={{ top: 8, right: 16, left: -20, bottom: 12 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip content={<ApplicantChartTooltip />} />
              <Line
                type="monotone"
                dataKey="value"
                name="Applications"
                stroke="#2563eb"
                strokeWidth={3}
                dot={{ r: 5, cursor: "pointer" }}
                activeDot={{ r: 7, cursor: "pointer", onClick: (_event, entry) => openDrilldown("Applications by Month", entry) }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Standardized Condition Categories" hasData={diagnosisCounts.length > 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={diagnosisCounts} layout="vertical" margin={{ top: 8, right: 16, left: 20, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={105} tick={{ fontSize: 11 }} />
              <Tooltip content={<ApplicantChartTooltip />} />
              <Bar dataKey="value" name="Cases" fill="#7c3aed" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(entry) => openDrilldown("Top Standardized Condition Categories", entry)} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Amount Granted by Barangay" hasData={barangayAmounts.length > 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barangayAmounts} margin={{ top: 8, right: 8, left: 8, bottom: 44 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={60} tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={compactMoney} width={58} />
              <Tooltip content={<ApplicantChartTooltip currency />} />
              <Bar dataKey="value" name="Amount granted" fill="#16a34a" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(entry) => openDrilldown("Amount Granted by Barangay", entry)} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        </div>
      </details>
      {drilldown && (
        <ChartApplicantModal
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

function DistributionChart({ data, onSelect }: { data: ChartDatum[]; onSelect: (value: unknown) => void }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={45} outerRadius={82} paddingAngle={2} cursor="pointer" onClick={onSelect}>
          {data.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}
        </Pie>
        <Tooltip content={<ApplicantChartTooltip />} />
        <Legend verticalAlign="bottom" height={40} />
      </PieChart>
    </ResponsiveContainer>
  );
}

interface ChartDatum {
  name: string;
  value: number;
  records: AssistanceRecord[];
  key?: string;
}

function countValue(records: AssistanceRecord[], field: "sex" | "assistanceType", value: string) {
  return records.filter((record) => record[field].trim().toLowerCase() === value).length;
}

function groupCount(records: AssistanceRecord[], getGroup: (record: AssistanceRecord) => string): ChartDatum[] {
  const groups = new Map<string, AssistanceRecord[]>();
  records.forEach((record) => {
    const group = getGroup(record);
    groups.set(group, [...(groups.get(group) || []), record]);
  });
  return Array.from(groups, ([name, groupedRecords]) => ({
    name,
    value: groupedRecords.length,
    records: groupedRecords,
  })).sort((first, second) => second.value - first.value);
}

function groupSum(records: AssistanceRecord[], getGroup: (record: AssistanceRecord) => string, getValue: (record: AssistanceRecord) => number): ChartDatum[] {
  const groups = new Map<string, AssistanceRecord[]>();
  records.forEach((record) => {
    const group = getGroup(record);
    groups.set(group, [...(groups.get(group) || []), record]);
  });
  return Array.from(groups, ([name, groupedRecords]) => ({
    name,
    value: groupedRecords.reduce((sum, record) => sum + getValue(record), 0),
    records: groupedRecords,
  })).sort((first, second) => second.value - first.value);
}

function groupByMonth(records: AssistanceRecord[]): ChartDatum[] {
  const groups = new Map<string, AssistanceRecord[]>();
  records.forEach((record) => {
    const date = new Date(record.applicationDate || record.createdAt);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    groups.set(key, [...(groups.get(key) || []), record]);
  });
  return Array.from(groups, ([key, groupedRecords]) => ({
    key,
    name: new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(`${key}-01T00:00:00`)),
    value: groupedRecords.length,
    records: groupedRecords,
  })).sort((first, second) => String(first.key).localeCompare(String(second.key)));
}

function groupConditionCategories(records: AssistanceRecord[]): ChartDatum[] {
  const groups = new Map<string, AssistanceRecord[]>();
  records.forEach((record) => {
    record.conditionCategories.forEach((category) => groups.set(category, [...(groups.get(category) || []), record]));
  });
  return Array.from(groups, ([name, groupedRecords]) => ({
    name,
    value: groupedRecords.length,
    records: groupedRecords,
  })).sort((first, second) => second.value - first.value);
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
      <b>{currency ? money(group.value) : `${group.value} application${group.value === 1 ? "" : "s"}`}</b>
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
  const sorted = [...group.records].sort(
    (first, second) => (Date.parse(second.applicationDate || second.createdAt) || 0) - (Date.parse(first.applicationDate || first.createdAt) || 0),
  );
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
        <div className="chart-applicant-summary">
          <strong>{sorted.length} application{sorted.length === 1 ? "" : "s"}</strong>
          <span>Total granted: {money(sorted.reduce((sum, record) => sum + record.amount, 0))}</span>
        </div>
        <div className="chart-applicant-list">
          {sorted.map((record) => (
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
