import { buildApplicantHistories } from "./applicantIdentity";
import { canonicalBarangay, canonicalCategory } from "./recordTaxonomy";
import { AssistanceRecord } from "./types";

export interface ReportCard {
  label: string;
  value: number;
  format: "number" | "currency";
}

export interface ReportGroup {
  name: string;
  value: number;
  key?: string;
  amount?: number;
  average?: number;
  applications?: number;
  unit?: "applications" | "applicants";
}

export interface DashboardReportData {
  uniqueApplicants: number;
  totalApplications: number;
  cards: ReportCard[];
  barangayCounts: ReportGroup[];
  assistanceCounts: ReportGroup[];
  monthlyCounts: ReportGroup[];
  applicantFrequency: ReportGroup[];
  ageGroups: ReportGroup[];
  barangayAmounts: ReportGroup[];
}

export const emptyDashboardReport: DashboardReportData = {
  uniqueApplicants: 0,
  totalApplications: 0,
  cards: [],
  barangayCounts: [],
  assistanceCounts: [],
  monthlyCounts: [],
  applicantFrequency: [],
  ageGroups: [],
  barangayAmounts: [],
};

export function buildDashboardReport(records: AssistanceRecord[]): DashboardReportData {
  const total = records.reduce((sum, record) => sum + record.amount, 0);
  const histories = Array.from(buildApplicantHistories(records).values());
  const applicants = histories.map((history) => history.latestApplication);
  const barangay = (record: AssistanceRecord) => canonicalBarangay(record.brgy);
  const assistance = (record: AssistanceRecord) => normalizeLabel(record.assistanceType);
  return {
    uniqueApplicants: histories.length,
    totalApplications: records.length,
    cards: [
      card("Unique Active Applicants", applicants.filter((record) => !record.archivedAt).length),
      card("Returning Applicants", histories.filter((history) => history.applicationCount > 1).length),
      card("Total Applications", records.length),
      card("Male Applicants", countValue(applicants, "sex", "male")),
      card("Female Applicants", countValue(applicants, "sex", "female")),
      card("Senior Applicants", applicants.filter((record) => canonicalCategory(record.category) === "Senior" || Number(record.age) >= 60).length),
      card("Medical Assistance Cases", countValue(records, "assistanceType", "medical")),
      card("Total Amount Granted", total, "currency"),
      card("Average Amount Granted", records.length ? total / records.length : 0, "currency"),
      card("Applicants with Diagnoses", histories.filter((history) => history.records.some((record) => record.diagnosis.trim())).length),
    ],
    barangayCounts: groupCount(applicants, barangay, "applicants"),
    assistanceCounts: groupCount(records, assistance, "applications", true),
    monthlyCounts: groupByMonth(records),
    applicantFrequency: [
      { name: "First-time", value: histories.filter((history) => history.applicationCount === 1).length, unit: "applicants" },
      { name: "Returning", value: histories.filter((history) => history.applicationCount > 1).length, unit: "applicants" },
    ].filter((group) => group.value > 0) as ReportGroup[],
    ageGroups: groupAgeRanges(applicants),
    barangayAmounts: groupSum(records, barangay, (record) => record.amount),
  };
}

function card(label: string, value: number, format: ReportCard["format"] = "number"): ReportCard {
  return { label, value, format };
}

function countValue(records: AssistanceRecord[], field: "sex" | "assistanceType", value: string) {
  return records.filter((record) => record[field].trim().toLowerCase() === value).length;
}

function groupCount(
  records: AssistanceRecord[],
  getGroup: (record: AssistanceRecord) => string,
  unit: ReportGroup["unit"],
  includeAmount = false,
): ReportGroup[] {
  const groups = new Map<string, AssistanceRecord[]>();
  records.forEach((record) => groups.set(getGroup(record), [...(groups.get(getGroup(record)) || []), record]));
  return Array.from(groups, ([name, grouped]) => ({
    name,
    value: grouped.length,
    unit,
    applications: grouped.length,
    amount: includeAmount ? grouped.reduce((sum, record) => sum + record.amount, 0) : undefined,
  })).sort((first, second) => second.value - first.value);
}

function groupSum(records: AssistanceRecord[], getGroup: (record: AssistanceRecord) => string, getValue: (record: AssistanceRecord) => number): ReportGroup[] {
  const groups = new Map<string, AssistanceRecord[]>();
  records.forEach((record) => groups.set(getGroup(record), [...(groups.get(getGroup(record)) || []), record]));
  return Array.from(groups, ([name, grouped]) => {
    const value = grouped.reduce((sum, record) => sum + getValue(record), 0);
    return { name, value, applications: grouped.length, average: grouped.length ? value / grouped.length : 0 };
  }).sort((first, second) => second.value - first.value);
}

function groupByMonth(records: AssistanceRecord[]): ReportGroup[] {
  const groups = new Map<string, AssistanceRecord[]>();
  records.forEach((record) => {
    const date = new Date(record.applicationDate || record.createdAt);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    groups.set(key, [...(groups.get(key) || []), record]);
  });
  return Array.from(groups, ([key, grouped]) => ({
    key,
    name: new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(`${key}-01T00:00:00`)),
    value: grouped.length,
    amount: grouped.reduce((sum, record) => sum + record.amount, 0),
    applications: grouped.length,
    unit: "applications" as const,
  })).sort((first, second) => first.key.localeCompare(second.key));
}

function groupAgeRanges(records: AssistanceRecord[]): ReportGroup[] {
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
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    if (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) age -= 1;
    if (age >= 0 && age <= 130) return age;
  }
  const recorded = Number(record.age);
  return Number.isFinite(recorded) && recorded >= 0 && recorded <= 130 ? recorded : null;
}

function normalizeLabel(value: string) {
  const normalized = value.trim().toLocaleLowerCase("en-PH");
  return normalized ? normalized.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("en-PH")) : "Unspecified";
}
