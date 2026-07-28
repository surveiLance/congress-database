"use client";

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
import { AssistanceRecord } from "@/lib/types";

const colors = ["#2563eb", "#16a34a", "#d97706", "#7c3aed", "#dc2626", "#0891b2", "#4f46e5", "#65a30d"];

export default function Dashboard({ records }: { records: AssistanceRecord[] }) {
  const total = records.reduce((sum, record) => sum + record.amount, 0);
  const cards = [
    ["Total Active Applicants", records.filter((record) => !record.archivedAt).length.toLocaleString()],
    ["Male Applicants", countValue(records, "sex", "male").toLocaleString()],
    ["Female Applicants", countValue(records, "sex", "female").toLocaleString()],
    ["Senior Applicants", records.filter((record) => record.category.toLowerCase() === "senior" || Number(record.age) >= 60).length.toLocaleString()],
    ["Medical Assistance Cases", countValue(records, "assistanceType", "medical").toLocaleString()],
    ["Total Amount Granted", money(total)],
    ["Average Amount Granted", money(records.length ? total / records.length : 0)],
    ["Recorded Diagnoses", records.filter((record) => record.diagnosis.trim()).length.toLocaleString()],
  ];

  const barangayCounts = groupCount(records, (record) => record.brgy || "Unspecified");
  const assistanceCounts = groupCount(records, (record) => record.assistanceType || "Unspecified");
  const sexCounts = groupCount(records, (record) => record.sex || "Unspecified");
  const monthlyCounts = groupByMonth(records);
  const diagnosisCounts = groupConditionCategories(records).slice(0, 8);
  const barangayAmounts = groupSum(records, (record) => record.brgy || "Unspecified", (record) => record.amount);

  return (
    <section className="dashboard-report" aria-labelledby="dashboard-title">
      <div className="dashboard-heading">
        <div>
          <h2 id="dashboard-title">Dashboard Overview</h2>
          <p>Aggregated report for {records.length} matching record{records.length === 1 ? "" : "s"}. Charts contain no applicant names or contact details.</p>
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
              <Tooltip />
              <Bar dataKey="value" name="Applicants" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Assistance Type Distribution" hasData={assistanceCounts.length > 0}>
          <DistributionChart data={assistanceCounts} />
        </ChartCard>

        <ChartCard title="Sex Distribution" hasData={sexCounts.length > 0}>
          <DistributionChart data={sexCounts} />
        </ChartCard>

        <ChartCard title="Applications by Month" hasData={monthlyCounts.length > 0}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyCounts} margin={{ top: 8, right: 16, left: -20, bottom: 12 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="value" name="Applications" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Standardized Condition Categories" hasData={diagnosisCounts.length > 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={diagnosisCounts} layout="vertical" margin={{ top: 8, right: 16, left: 20, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={105} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" name="Cases" fill="#7c3aed" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Amount Granted by Barangay" hasData={barangayAmounts.length > 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barangayAmounts} margin={{ top: 8, right: 8, left: 8, bottom: 44 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={60} tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={compactMoney} width={58} />
              <Tooltip formatter={(value) => [money(Number(value)), "Amount granted"]} />
              <Bar dataKey="value" name="Amount granted" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        </div>
      </details>
    </section>
  );
}

function ChartCard({ title, hasData, children }: { title: string; hasData: boolean; children: React.ReactNode }) {
  return (
    <article className="chart-card">
      <h3>{title}</h3>
      <div className="chart-area">
        {hasData ? children : <div className="chart-empty">No matching data to display.</div>}
      </div>
    </article>
  );
}

function DistributionChart({ data }: { data: ChartDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={45} outerRadius={82} paddingAngle={2}>
          {data.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}
        </Pie>
        <Tooltip />
        <Legend verticalAlign="bottom" height={40} />
      </PieChart>
    </ResponsiveContainer>
  );
}

interface ChartDatum {
  name: string;
  value: number;
  key?: string;
}

function countValue(records: AssistanceRecord[], field: "sex" | "assistanceType", value: string) {
  return records.filter((record) => record[field].trim().toLowerCase() === value).length;
}

function groupCount(records: AssistanceRecord[], getGroup: (record: AssistanceRecord) => string): ChartDatum[] {
  const groups = new Map<string, number>();
  records.forEach((record) => {
    const group = getGroup(record);
    groups.set(group, (groups.get(group) || 0) + 1);
  });
  return Array.from(groups, ([name, value]) => ({ name, value })).sort((first, second) => second.value - first.value);
}

function groupSum(records: AssistanceRecord[], getGroup: (record: AssistanceRecord) => string, getValue: (record: AssistanceRecord) => number): ChartDatum[] {
  const groups = new Map<string, number>();
  records.forEach((record) => {
    const group = getGroup(record);
    groups.set(group, (groups.get(group) || 0) + getValue(record));
  });
  return Array.from(groups, ([name, value]) => ({ name, value })).sort((first, second) => second.value - first.value);
}

function groupByMonth(records: AssistanceRecord[]): ChartDatum[] {
  const groups = new Map<string, number>();
  records.forEach((record) => {
    const date = new Date(record.createdAt);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    groups.set(key, (groups.get(key) || 0) + 1);
  });
  return Array.from(groups, ([key, value]) => ({
    key,
    name: new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(`${key}-01T00:00:00`)),
    value,
  })).sort((first, second) => String(first.key).localeCompare(String(second.key)));
}

function groupConditionCategories(records: AssistanceRecord[]): ChartDatum[] {
  const groups = new Map<string, number>();
  records.forEach((record) => {
    record.conditionCategories.forEach((category) => groups.set(category, (groups.get(category) || 0) + 1));
  });
  return Array.from(groups, ([name, value]) => ({ name, value })).sort((first, second) => second.value - first.value);
}

function money(value: number) {
  return `₱${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function compactMoney(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
