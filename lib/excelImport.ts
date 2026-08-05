import { readSheet } from "read-excel-file/browser";
import { AssistanceRecord, LegacyApplicationData } from "./types";
import { canonicalBarangay, canonicalCategory } from "./recordTaxonomy";

type CellValue = string | number | boolean | Date | null | undefined;

const requiredWorkbookHeaders = [
  "DATE APPLIED",
  "C_SURNAME",
  "C_FIRST NAME",
  "DOB",
  "TYPE OF ASSISTANCE",
  "AMOUNT",
];

export interface ExcelImportSummary {
  sourceRows: number;
  firstApplicationDate: string;
  lastApplicationDate: string;
}

export async function parseMaipExcelImport(file: File): Promise<{
  rows: unknown[];
  summary: ExcelImportSummary;
}> {
  const worksheet = await readSheet(file, "Data") as CellValue[][];
  const headerIndex = worksheet.findIndex((row) => {
    const values = new Set(row.map(headerText));
    return requiredWorkbookHeaders.every((header) => values.has(header));
  });

  if (headerIndex < 0) {
    throw new Error("The Data sheet does not contain the expected MAIP columns.");
  }

  const headers = worksheet[headerIndex].map(headerText);
  const missing = requiredWorkbookHeaders.filter((header) => !headers.includes(header));
  if (missing.length) {
    throw new Error(`The workbook is missing required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`);
  }

  const rows = worksheet
    .slice(headerIndex + 1)
    .map((cells, index) => mapMaipRow(headers, cells, headerIndex + index + 2, file.name))
    .filter((row): row is Record<string, unknown> => Boolean(row));

  if (!rows.length) throw new Error("The Data sheet contains no populated application rows.");
  const dates = rows
    .map((row) => String(row.applicationDate || ""))
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
    .sort();

  return {
    rows,
    summary: {
      sourceRows: rows.length,
      firstApplicationDate: dates[0] || "",
      lastApplicationDate: dates.at(-1) || "",
    },
  };
}

function mapMaipRow(
  headers: string[],
  cells: CellValue[],
  sourceRow: number,
  sourceFile: string,
): Record<string, unknown> | null {
  const source = new Map<string, CellValue>();
  headers.forEach((header, index) => {
    if (header) source.set(header, cells[index]);
  });
  if (!Array.from(source.values()).some(hasValue)) return null;

  const applicationDate = dateValue(source.get("DATE APPLIED"));
  const birthday = dateValue(source.get("DOB"));
  const beneficiaryBirthday = dateValue(source.get("B_DOB"));
  const surname = textValue(source.get("C_SURNAME"));
  const firstName = textValue(source.get("C_FIRST NAME"));
  const assistanceType = assistanceValue(source.get("TYPE OF ASSISTANCE"));
  const amount = numberValue(source.get("AMOUNT"));

  const legacyApplication: LegacyApplicationData = {
    sourceFile,
    sourceRow,
    dateSubmitted: dateValue(source.get("DATE SUBMITTED")),
    systemUpdated: textValue(source.get("SYSTEM UPDATED")),
    payoutStatus: textValue(source.get("PAYOUT/NO SHOW/PROVIDED")),
    repayrollDate: dateValue(source.get("REPAYROLL DATE")),
    repayroll: textValue(source.get("REPAYROLL")),
    payoutDate: dateValue(source.get("PAYOUT DATE")),
    district: textValue(source.get("DISTRICT")),
    city: textValue(source.get("CITY / MUNICIPALITY")),
    sourceOfFund: textValue(source.get("SOURCE OF FUND")),
    purpose: textValue(source.get("PURPOSE")),
    beneficiaryDistrict: textValue(source.get("DISTRICT2")),
    beneficiaryCity: textValue(source.get("CITY / MUNICIPALITY3")),
    beneficiaryBarangay: textValue(source.get("BARANGAY4")),
    modeOfAssistance: textValue(source.get("MODE OF ASSISTANCE")),
    admissionMode: textValue(source.get("MODE OF ADMISSION (WALK-IN OR REFERRAL)")),
    subcategory: textValue(source.get("SUB CATHEGORY")),
    status: textValue(source.get("STATUS")),
    releaseDetails: textValue(source.get("DATE RELEASED (DATE-AMOUNT-WHERE)")),
    idPresented: textValue(source.get("ID PRESENTED")),
  };

  const imported: Partial<AssistanceRecord> & { __sourceRow: number } = {
    __sourceRow: sourceRow,
    surname,
    firstName,
    middleName: textValue(source.get("C_MIDDLE NAME")),
    suffix: textValue(source.get("EXTENSION NAME")),
    birthday,
    age: textValue(source.get("AGE")),
    sex: choiceValue(source.get("SEX"), "Not recorded"),
    contact: contactValue(source.get("CONTACT NUMBER")) || "Not recorded",
    idNumber: "",
    brgy: canonicalBarangay(textValue(source.get("BARANGAY"))),
    address: textValue(source.get("ADDRESS")) || "Not recorded",
    work: textValue(source.get("OCCUPATION")),
    salary: numberValue(source.get("SALARY")),
    employedStatus: textValue(source.get("OCCUPATION")) ? "Employed" : "Not recorded",
    householdMembers: 0,
    familyComposition: [],
    confirmedRelativeKeys: [],
    dismissedRelativeKeys: [],
    relativeLinks: [],
    totalEmployed: 0,
    monthlyExpenses: 0,
    civilStatus: choiceValue(source.get("CIVIL STATUS"), "Not recorded"),
    category: categoryValue(source.get("CATEGORY")) || "Not recorded",
    assistanceType,
    amountRequested: 0,
    amount,
    relationship: relationshipValue(source.get("RELATIONSHIP TO BENEFICIARY")),
    benName: beneficiaryName(source),
    benBday: beneficiaryBirthday,
    benAge: textValue(source.get("B_AGE")),
    benSex: choiceValue(source.get("B_GENDER")),
    benFamilyMember: relationshipValue(source.get("RELATIONSHIP TO BENEFICIARY")),
    benCivilStatus: choiceValue(source.get("B_CIVIL STATUS")),
    benCategory: categoryValue(source.get("B_CATEGORY")),
    diagnosis: textValue(source.get("DIAGNOSIS")),
    conditionCategories: [],
    conditionOther: "",
    remarks: textValue(source.get("REMARKS")),
    idImage: null,
    idImageBack: null,
    applicationDate,
    payoutDate: legacyApplication.payoutDate,
    legacyApplication,
    createdAt: applicationDate ? `${applicationDate}T00:00:00.000Z` : "",
    updatedAt: applicationDate ? `${applicationDate}T00:00:00.000Z` : "",
    archivedAt: "",
  };
  return imported;
}

function headerText(value: CellValue): string {
  return textValue(value).toUpperCase().replace(/\s+/g, " ").trim();
}

function hasValue(value: CellValue): boolean {
  return value instanceof Date || (value !== null && value !== undefined && String(value).trim() !== "");
}

function textValue(value: CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return dateValue(value);
  return String(value).replace(/\s+/g, " ").trim();
}

function numberValue(value: CellValue): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(textValue(value).replace(/[₱,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value: CellValue): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = textValue(value);
  if (!text) return "";
  const direct = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (direct) return `${direct[1]}-${direct[2].padStart(2, "0")}-${direct[3].padStart(2, "0")}`;
  const common = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!common) return text;
  const year = common[3].length === 2
    ? String(Number(common[3]) + (Number(common[3]) <= 30 ? 2000 : 1900))
    : common[3];
  return `${year}-${common[1].padStart(2, "0")}-${common[2].padStart(2, "0")}`;
}

function contactValue(value: CellValue): string {
  const text = textValue(value).replace(/\.0$/, "").replace(/[^\d+]/g, "");
  if (/^9\d{9}$/.test(text)) return `0${text}`;
  return text;
}

function choiceValue(value: CellValue, fallback = ""): string {
  const text = textValue(value);
  if (!text) return fallback;
  return text.toLowerCase().replace(/(^|[\s/-])\p{L}/gu, (letter) => letter.toUpperCase());
}

function assistanceValue(value: CellValue): string {
  return textValue(value)
    .replace(/\s+ASSISTANCE$/i, "")
    .toLowerCase()
    .replace(/(^|\s)\p{L}/gu, (letter) => letter.toUpperCase());
}

function categoryValue(value: CellValue): string {
  return canonicalCategory(textValue(value));
}

function relationshipValue(value: CellValue): string {
  const text = choiceValue(value);
  if (/^(Herself|Himself|Self)$/.test(text)) return "Self";
  return text;
}

function beneficiaryName(source: Map<string, CellValue>): string {
  const surname = textValue(source.get("B_SURNAME"));
  const given = [
    textValue(source.get("B_FIRST NAME")),
    textValue(source.get("B_MIDDLE NAME")),
    textValue(source.get("B_EXTNAME")),
  ].filter(Boolean).join(" ");
  if (!surname) return given;
  return given ? `${surname}, ${given}` : surname;
}
