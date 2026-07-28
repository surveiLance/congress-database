import { normalizeConditionCategories } from "./conditionCategories";

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
}

export const emptyRecord: AssistanceRecord = {
  surname: "", firstName: "", middleName: "", suffix: "", birthday: "", age: "",
  sex: "", contact: "", idNumber: "", brgy: "", address: "", work: "", salary: 0,
  employedStatus: "Employed", totalEmployed: 0, monthlyExpenses: 0,
  civilStatus: "", category: "", assistanceType: "", amountRequested: 0, amount: 0, relationship: "",
  benName: "", benBday: "", benAge: "", benSex: "", benFamilyMember: "",
  benCivilStatus: "", benCategory: "", diagnosis: "", conditionCategories: [],
  conditionOther: "", remarks: "", idImage: null,
  createdAt: "",
  updatedAt: "",
  archivedAt: "",
};

export function normalizeRecord(record: Partial<AssistanceRecord>): AssistanceRecord {
  return {
    ...emptyRecord,
    ...record,
    salary: Number(record.salary) || 0,
    amountRequested: Number(record.amountRequested) || 0,
    amount: Number(record.amount) || 0,
    monthlyExpenses: Number(record.monthlyExpenses) || 0,
    totalEmployed: Number(record.totalEmployed) || 0,
    conditionCategories: normalizeConditionCategories(record.conditionCategories),
    conditionOther: record.conditionOther || "",
    idNumber: record.idNumber || "",
    idImage: record.idImage || null,
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || record.createdAt || "",
    archivedAt: record.archivedAt || "",
  };
}
