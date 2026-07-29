import { AssistanceRecord, normalizeRecord } from "./types";
import { applicantIdentityKey } from "./applicantIdentity";

export const recordFields: (keyof AssistanceRecord)[] = [
  "id", "surname", "firstName", "middleName", "suffix", "birthday", "age",
  "sex", "contact", "idNumber", "brgy", "address", "work", "salary", "employedStatus",
  "householdMembers", "familyComposition", "confirmedRelativeKeys", "dismissedRelativeKeys",
  "totalEmployed", "monthlyExpenses", "civilStatus", "category",
  "assistanceType", "amountRequested", "amount", "relationship", "benName", "benBday", "benAge",
  "benSex", "benFamilyMember", "benCivilStatus", "benCategory", "diagnosis",
  "conditionCategories", "conditionOther", "remarks", "idImage", "createdAt",
  "updatedAt", "archivedAt",
];

const requiredFields: (keyof AssistanceRecord)[] = [
  "surname", "firstName", "birthday", "sex", "contact", "brgy", "address",
  "civilStatus", "category", "assistanceType", "amount",
];

const numericFields = new Set<keyof AssistanceRecord>([
  "id", "salary", "householdMembers", "totalEmployed", "monthlyExpenses", "amountRequested", "amount",
]);

export type PreviewStatus = "ready" | "duplicate" | "failed";

export interface ImportPreviewRow {
  rowNumber: number;
  record: AssistanceRecord | null;
  status: PreviewStatus;
  errors: string[];
  duplicateId?: number;
}

export function duplicateKey(record: Partial<AssistanceRecord>): string {
  const identity = applicantIdentityKey({
    surname: String(record.surname || ""),
    firstName: String(record.firstName || ""),
    birthday: String(record.birthday || ""),
  });
  const applicationDate = String(record.createdAt || "").trim().slice(0, 19);
  const assistanceType = String(record.assistanceType || "").trim().toLowerCase();
  const amount = Number(record.amount) || 0;
  const requested = Number(record.amountRequested) || 0;
  return `${identity}|${applicationDate}|${assistanceType}|${amount}|${requested}`;
}

export function createImportPreview(
  sourceRows: unknown[],
  existingRecords: AssistanceRecord[],
): ImportPreviewRow[] {
  const existing = new Map(existingRecords.map((record) => [duplicateKey(record), record]));
  const seenInFile = new Set<string>();

  return sourceRows.map((source, index) => {
    const result = validateRecord(source);
    if (!result.record) {
      return { rowNumber: index + 1, record: null, status: "failed", errors: result.errors };
    }

    const key = duplicateKey(result.record);
    if (seenInFile.has(key)) {
      return {
        rowNumber: index + 1,
        record: result.record,
        status: "duplicate",
        errors: ["Duplicate application within this import file."],
      };
    }
    seenInFile.add(key);

    const existingMatch = existing.get(key);
    if (existingMatch) {
      return {
        rowNumber: index + 1,
        record: result.record,
        status: "duplicate",
        errors: ["Matches an existing application for this applicant, date, assistance type, and amount."],
        duplicateId: existingMatch.id,
      };
    }

    return { rowNumber: index + 1, record: result.record, status: "ready", errors: [] };
  });
}

function validateRecord(source: unknown): { record: AssistanceRecord | null; errors: string[] } {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return { record: null, errors: ["Row must be a record object."] };
  }

  const raw = source as Record<string, unknown>;
  const errors: string[] = [];
  for (const field of requiredFields) {
    if (raw[field] === undefined || raw[field] === null || String(raw[field]).trim() === "") {
      errors.push(`Missing required field: ${field}.`);
    }
  }

  for (const field of numericFields) {
    const value = raw[field];
    if (value !== undefined && value !== null && value !== "" && !Number.isFinite(Number(value))) {
      errors.push(`Invalid number in ${field}.`);
    }
  }

  const birthday = String(raw.birthday || "");
  if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
    errors.push("Birthday must use YYYY-MM-DD format.");
  }

  if (errors.length) return { record: null, errors };

  const partial: Partial<AssistanceRecord> = {};
  for (const field of recordFields) {
    if (raw[field] !== undefined) {
      (partial as Record<string, unknown>)[field] = numericFields.has(field) && raw[field] !== ""
        ? Number(raw[field])
        : raw[field];
    }
  }
  const record = normalizeRecord(partial);
  if (!record.createdAt) record.createdAt = new Date().toISOString();
  return { record, errors: [] };
}

export function parseJsonImport(text: string): unknown[] {
  const parsed: unknown = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { records?: unknown }).records)) {
    return (parsed as { records: unknown[] }).records;
  }
  throw new Error("JSON must contain an array of records or an object with a records array.");
}

export function parseCsvImport(text: string): unknown[] {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("CSV must include a header and at least one data row.");
  const headers = rows[0].map(resolveHeader);
  if (!headers.some(Boolean)) throw new Error("CSV does not contain recognized record columns.");

  return rows.slice(1)
    .filter((row) => row.some((cell) => cell.trim() !== ""))
    .map((row) => {
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        if (header) record[header] = row[index] ?? "";
      });
      return record;
    });
}

function resolveHeader(header: string): string {
  const normalized = header.trim().toLowerCase().replace(/[\s_-]+/g, "");
  return recordFields.find((field) => field.toLowerCase() === normalized) || "";
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  if (value || row.length) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

export function recordsToCsv(records: AssistanceRecord[]): string {
  const lines = [recordFields.map(String).map(csvCell).join(",")];
  records.forEach((record) => {
    lines.push(recordFields.map((field) => csvCell(record[field] ?? "")).join(","));
  });
  return `\uFEFF${lines.join("\r\n")}`;
}

function csvCell(value: unknown): string {
  const text = Array.isArray(value) || (value && typeof value === "object")
    ? JSON.stringify(value)
    : String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
