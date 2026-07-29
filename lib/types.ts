import { normalizeConditionCategories } from "./conditionCategories";

export type WorkflowStage = "intake" | "for-review" | "returned" | "approved" | "completed";

export interface ApplicationDocument {
  id: string;
  category: string;
  fileName: string;
  dataUrl: string;
  uploadedAt: string;
}

export interface AssistanceRecord {
  id?: number;
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
  totalEmployed: number;
  monthlyExpenses: number;
  civilStatus: string;
  category: string;
  assistanceType: string;
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
  createdAt: string;
  updatedAt?: string;
  archivedAt?: string;
  workflowStage: WorkflowStage;
  intakeDate: string;
  submittedForReviewAt: string;
  reviewedAt: string;
  approvedAt: string;
  encodedAt: string;
  reviewNotes: string;
  requirementChecks: string[];
  documents: ApplicationDocument[];
}

export const emptyRecord: AssistanceRecord = {
  surname: "", firstName: "", middleName: "", suffix: "", birthday: "", age: "",
  sex: "", contact: "", idNumber: "", brgy: "", address: "", work: "", salary: 0,
  employedStatus: "Employed", householdMembers: 0, totalEmployed: 0, monthlyExpenses: 0,
  civilStatus: "", category: "", assistanceType: "", amountRequested: 0, amount: 0, relationship: "",
  benName: "", benBday: "", benAge: "", benSex: "", benFamilyMember: "",
  benCivilStatus: "", benCategory: "", diagnosis: "", conditionCategories: [],
  conditionOther: "", remarks: "", idImage: null,
  createdAt: "",
  updatedAt: "",
  archivedAt: "",
  workflowStage: "completed",
  intakeDate: "",
  submittedForReviewAt: "",
  reviewedAt: "",
  approvedAt: "",
  encodedAt: "",
  reviewNotes: "",
  requirementChecks: [],
  documents: [],
};

export function normalizeRecord(record: Partial<AssistanceRecord>): AssistanceRecord {
  return {
    ...emptyRecord,
    ...record,
    salary: Number(record.salary) || 0,
    amountRequested: Number(record.amountRequested) || 0,
    amount: Number(record.amount) || 0,
    monthlyExpenses: Number(record.monthlyExpenses) || 0,
    householdMembers: Number(record.householdMembers) || 0,
    totalEmployed: Number(record.totalEmployed) || 0,
    conditionCategories: normalizeConditionCategories(record.conditionCategories),
    conditionOther: record.conditionOther || "",
    idNumber: record.idNumber || "",
    idImage: record.idImage || null,
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || record.createdAt || "",
    archivedAt: record.archivedAt || "",
    workflowStage: normalizeWorkflowStage(record.workflowStage),
    intakeDate: record.intakeDate || "",
    submittedForReviewAt: record.submittedForReviewAt || "",
    reviewedAt: record.reviewedAt || "",
    approvedAt: record.approvedAt || "",
    encodedAt: record.encodedAt || "",
    reviewNotes: record.reviewNotes || "",
    requirementChecks: Array.isArray(record.requirementChecks) ? record.requirementChecks.map(String) : [],
    documents: Array.isArray(record.documents)
      ? record.documents.filter((document) => document && typeof document === "object").map((document) => ({
        id: String(document.id || cryptoId()),
        category: String(document.category || "Other Supporting Document"),
        fileName: String(document.fileName || "Document"),
        dataUrl: String(document.dataUrl || ""),
        uploadedAt: String(document.uploadedAt || record.createdAt || new Date().toISOString()),
      })).filter((document) => document.dataUrl)
      : [],
  };
}

function normalizeWorkflowStage(value?: string): WorkflowStage {
  return value === "intake" || value === "for-review" || value === "returned" || value === "approved"
    ? value
    : "completed";
}

function cryptoId() {
  return `document-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
