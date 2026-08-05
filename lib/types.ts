import { normalizeConditionCategories } from "./conditionCategories";
import { normalizeAssistanceAgencies } from "./assistanceAgencies";

export interface FamilyMember {
  fullName: string;
  relationship: string;
  birthday: string;
}

export interface RelativeLink {
  key: string;
  relationship: string;
  householdStatus: "same-household" | "different-household";
  confirmedAt: string;
}

export interface LegacyApplicationData {
  sourceFile: string;
  sourceRow: number;
  dateSubmitted: string;
  systemUpdated: string;
  payoutStatus: string;
  repayrollDate: string;
  repayroll: string;
  payoutDate: string;
  district: string;
  city: string;
  sourceOfFund: string;
  purpose: string;
  beneficiaryDistrict: string;
  beneficiaryCity: string;
  beneficiaryBarangay: string;
  modeOfAssistance: string;
  admissionMode: string;
  subcategory: string;
  status: string;
  releaseDetails: string;
  idPresented: string;
}

export interface AssistanceRecord {
  id?: number;
  /** Client-only loading hint. Never persisted to Supabase or exports. */
  recordLoadState?: "summary" | "full";
  surname: string;
  firstName: string;
  middleName: string;
  suffix: string;
  birthday: string;
  age: string;
  sex: string;
  contact: string;
  idNumber: string;
  brgy: string;
  address: string;
  work: string;
  salary: number;
  employedStatus: string;
  householdMembers: number;
  familyComposition: FamilyMember[];
  confirmedRelativeKeys: string[];
  dismissedRelativeKeys: string[];
  relativeLinks: RelativeLink[];
  totalEmployed: number;
  monthlyExpenses: number;
  civilStatus: string;
  category: string;
  assistanceType: string;
  assistanceAgencies: string[];
  /** @deprecated Kept so older JSON/CSV backups remain importable. */
  otherAgencyAssistance: string[];
  otherAgencyRemarks: string;
  amountRequested: number;
  amount: number;
  relationship: string;
  benName: string;
  benBday: string;
  benAge: string;
  benSex: string;
  benFamilyMember: string;
  benCivilStatus: string;
  benCategory: string;
  diagnosis: string;
  conditionCategories: string[];
  conditionOther: string;
  remarks: string;
  idImage: string | null;
  idImageBack: string | null;
  applicationDate: string;
  payoutDate: string;
  legacyApplication: LegacyApplicationData | null;
  createdAt: string;
  updatedAt?: string;
  archivedAt?: string;
}

export const emptyRecord: AssistanceRecord = {
  surname: "", firstName: "", middleName: "", suffix: "", birthday: "", age: "",
  sex: "", contact: "", idNumber: "", brgy: "", address: "", work: "", salary: 0,
  employedStatus: "Employed", householdMembers: 0, familyComposition: [],
  confirmedRelativeKeys: [], dismissedRelativeKeys: [], relativeLinks: [], totalEmployed: 0, monthlyExpenses: 0,
  civilStatus: "", category: "", assistanceType: "", assistanceAgencies: ["DSWD"], otherAgencyAssistance: [], otherAgencyRemarks: "", amountRequested: 0, amount: 0, relationship: "",
  benName: "", benBday: "", benAge: "", benSex: "", benFamilyMember: "",
  benCivilStatus: "", benCategory: "", diagnosis: "", conditionCategories: [],
  conditionOther: "", remarks: "", idImage: null, idImageBack: null,
  applicationDate: "", payoutDate: "",
  legacyApplication: null,
  createdAt: "",
  updatedAt: "",
  archivedAt: "",
};

export function normalizeRecord(record: Partial<AssistanceRecord>): AssistanceRecord {
  const legacyApplication = normalizeLegacyApplication(record.legacyApplication);
  return {
    ...emptyRecord,
    ...record,
    salary: Number(record.salary) || 0,
    amountRequested: Number(record.amountRequested) || 0,
    amount: Number(record.amount) || 0,
    monthlyExpenses: Number(record.monthlyExpenses) || 0,
    householdMembers: Number(record.householdMembers) || 0,
    familyComposition: normalizeFamilyComposition(record.familyComposition),
    confirmedRelativeKeys: normalizeStringArray(record.confirmedRelativeKeys),
    dismissedRelativeKeys: normalizeStringArray(record.dismissedRelativeKeys),
    relativeLinks: normalizeRelativeLinks(record.relativeLinks, record.confirmedRelativeKeys),
    totalEmployed: Number(record.totalEmployed) || 0,
    conditionCategories: normalizeConditionCategories(record.conditionCategories),
    conditionOther: record.conditionOther || "",
    assistanceAgencies: normalizeAssistanceAgencies(record.assistanceAgencies, record.otherAgencyAssistance),
    otherAgencyAssistance: normalizeStringArray(record.otherAgencyAssistance),
    otherAgencyRemarks: record.otherAgencyRemarks || "",
    idNumber: record.idNumber || "",
    idImage: record.idImage || null,
    idImageBack: record.idImageBack || null,
    applicationDate: record.applicationDate || String(record.createdAt || "").slice(0, 10),
    payoutDate: record.payoutDate || legacyApplication?.payoutDate || "",
    legacyApplication,
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || record.createdAt || "",
    archivedAt: record.archivedAt || "",
  };
}

export function recordPayoutDate(record: AssistanceRecord): string {
  return record.payoutDate || record.legacyApplication?.payoutDate || "";
}

function normalizeRelativeLinks(
  value: unknown,
  legacyConfirmedKeys: unknown,
): RelativeLink[] {
  const links = Array.isArray(value)
    ? value.flatMap((item): RelativeLink[] => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const source = item as Record<string, unknown>;
      const key = String(source.key || "").trim();
      if (!key) return [];
      return [{
        key,
        relationship: String(source.relationship || ""),
        householdStatus: source.householdStatus === "different-household"
          ? "different-household"
          : "same-household",
        confirmedAt: String(source.confirmedAt || ""),
      }];
    })
    : [];
  const known = new Set(links.map((link) => link.key));
  normalizeStringArray(legacyConfirmedKeys).forEach((key) => {
    if (!known.has(key)) {
      links.push({
        key,
        relationship: "",
        householdStatus: "same-household",
        confirmedAt: "",
      });
    }
  });
  return links;
}

function normalizeLegacyApplication(value: unknown): LegacyApplicationData | null {
  const parsed = parsePossibleJson(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const source = parsed as Record<string, unknown>;
  return {
    sourceFile: String(source.sourceFile || ""),
    sourceRow: Number(source.sourceRow) || 0,
    dateSubmitted: String(source.dateSubmitted || ""),
    systemUpdated: String(source.systemUpdated || ""),
    payoutStatus: String(source.payoutStatus || ""),
    repayrollDate: String(source.repayrollDate || ""),
    repayroll: String(source.repayroll || ""),
    payoutDate: String(source.payoutDate || ""),
    district: String(source.district || ""),
    city: String(source.city || ""),
    sourceOfFund: String(source.sourceOfFund || ""),
    purpose: String(source.purpose || ""),
    beneficiaryDistrict: String(source.beneficiaryDistrict || ""),
    beneficiaryCity: String(source.beneficiaryCity || ""),
    beneficiaryBarangay: String(source.beneficiaryBarangay || ""),
    modeOfAssistance: String(source.modeOfAssistance || ""),
    admissionMode: String(source.admissionMode || ""),
    subcategory: String(source.subcategory || ""),
    status: String(source.status || ""),
    releaseDetails: String(source.releaseDetails || ""),
    idPresented: String(source.idPresented || ""),
  };
}

function normalizeFamilyComposition(value: unknown): FamilyMember[] {
  const parsed = parsePossibleJson(value);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((member): member is Record<string, unknown> => Boolean(member && typeof member === "object" && !Array.isArray(member)))
    .map((member) => ({
      fullName: String(member.fullName || member.name || "").trim(),
      relationship: String(member.relationship || member.relation || "").trim(),
      birthday: String(member.birthday || member.birthdate || "").trim(),
    }))
    .filter((member) => Boolean(member.fullName));
}

function normalizeStringArray(value: unknown): string[] {
  const parsed = parsePossibleJson(value);
  if (Array.isArray(parsed)) return Array.from(new Set(parsed.map(String).map((item) => item.trim()).filter(Boolean)));
  if (typeof parsed === "string") return parsed.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function parsePossibleJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}
