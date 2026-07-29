import { AssistanceRecord } from "./types";

export interface ApplicantHistory {
  key: string;
  records: AssistanceRecord[];
  applicationCount: number;
  totalGranted: number;
  latestApplication: AssistanceRecord;
  latestApplicationDate: string;
}

export function normalizeIdentityPart(value: string): string {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function applicantIdentityKey(record: Pick<AssistanceRecord, "surname" | "firstName" | "birthday">): string {
  const surname = normalizeIdentityPart(record.surname);
  const firstName = normalizeIdentityPart(record.firstName);
  const birthday = normalizeBirthday(record.birthday);
  if (!surname || !firstName || !birthday) return "";
  return `${surname}|${firstName}|${birthday}`;
}

export function standardizeApplicantText(record: AssistanceRecord): AssistanceRecord {
  return {
    ...record,
    surname: cleanName(record.surname),
    firstName: cleanName(record.firstName),
    middleName: cleanName(record.middleName),
    suffix: cleanName(record.suffix),
    contact: record.contact.trim(),
    idNumber: record.idNumber.trim(),
    address: cleanSpacing(record.address),
    work: cleanSpacing(record.work),
    relationship: cleanSpacing(record.relationship),
    benName: cleanSpacing(record.benName),
    diagnosis: cleanSpacing(record.diagnosis),
    conditionOther: cleanSpacing(record.conditionOther),
    remarks: cleanSpacing(record.remarks),
  };
}

export function buildApplicantHistories(records: AssistanceRecord[]): Map<string, ApplicantHistory> {
  const grouped = new Map<string, AssistanceRecord[]>();
  records.forEach((record) => {
    const key = applicantIdentityKey(record);
    if (!key) return;
    grouped.set(key, [...(grouped.get(key) || []), record]);
  });

  return new Map(
    Array.from(grouped, ([key, applications]) => {
      const sorted = [...applications].sort(
        (first, second) => recordDate(second) - recordDate(first),
      );
      return [
        key,
        {
          key,
          records: sorted,
          applicationCount: sorted.length,
          totalGranted: sorted.reduce((sum, application) => sum + application.amount, 0),
          latestApplication: sorted[0],
          latestApplicationDate: sorted[0]?.createdAt || "",
        },
      ];
    }),
  );
}

export function historyForRecord(record: AssistanceRecord, allRecords: AssistanceRecord[]): ApplicantHistory | null {
  return buildApplicantHistories(allRecords).get(applicantIdentityKey(record)) || null;
}

export function formatPeso(value: number): string {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizeBirthday(value: string): string {
  const trimmed = String(value || "").trim();
  const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatch) return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed.toLowerCase();
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function cleanName(value: string): string {
  return cleanSpacing(value).toUpperCase();
}

function cleanSpacing(value: string): string {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function recordDate(record: AssistanceRecord): number {
  return Date.parse(record.createdAt || record.updatedAt || "") || 0;
}
