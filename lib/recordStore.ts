import { AssistanceRecord, normalizeRecord } from "./types";
import { normalizeIdentityPart, standardizeApplicantText } from "./applicantIdentity";
import {
  addRecord as addLocalRecord,
  addRecords as addLocalRecords,
  deleteRecord as deleteLocalRecord,
  getRecords as getLocalRecords,
  updateRecord as updateLocalRecord,
} from "./indexedDb";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import type { RecordFilters } from "@/components/AdvancedFilters";
import { filterAndSortRecords } from "./recordQuery";

interface SharedRecordRow {
  id: number | string;
  record: Partial<AssistanceRecord>;
}

export interface RecordFilterOptions {
  barangays: string[];
  assistanceTypes: string[];
  sexes: string[];
  categories: string[];
  employmentStatuses: string[];
}

export interface RecordPageResult {
  records: AssistanceRecord[];
  total: number;
  activeCount: number;
  archivedCount: number;
  filterOptions: RecordFilterOptions;
  fastPath: boolean;
}

interface RecordPageRequest {
  query: string;
  filters: RecordFilters;
  page: number;
  pageSize: number;
}

export { getLocalRecords };
export const usesSharedDatabase = isSupabaseConfigured;

export async function getRecords(): Promise<AssistanceRecord[]> {
  if (!isSupabaseConfigured) return getLocalRecords();

  try {
    return await getSharedRecords("assistance_record_summaries", true);
  } catch (summaryError) {
    console.warn("Lightweight record view unavailable; using the compatible full-record query.", summaryError);
    return getSharedRecords("assistance_records", false);
  }
}

export async function getRecordPage({ query, filters, page, pageSize }: RecordPageRequest): Promise<RecordPageResult> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await getSupabaseClient().rpc("search_assistance_records", {
        p_query: query,
        p_filters: filters,
        p_page: page,
        p_page_size: pageSize,
      });
      if (error) throw error;
      const result = (data || {}) as {
        records?: Array<SharedRecordRow & { history_application_count?: number; history_total_granted?: number }>;
        total?: number;
        active_count?: number;
        archived_count?: number;
        filter_options?: Partial<RecordFilterOptions>;
      };
      return {
        records: (result.records || []).map((row) => normalizeRecord({
          ...row.record,
          id: Number(row.id),
          recordLoadState: "summary",
          historyApplicationCount: Number(row.history_application_count) || 1,
          historyTotalGranted: Number(row.history_total_granted) || Number(row.record?.amount) || 0,
        })),
        total: Number(result.total) || 0,
        activeCount: Number(result.active_count) || 0,
        archivedCount: Number(result.archived_count) || 0,
        filterOptions: normalizeFilterOptions(result.filter_options),
        fastPath: true,
      };
    } catch (error) {
      console.warn("Paginated database search is unavailable; using the compatible in-browser query.", error);
    }
  }

  const allRecords = await getRecords();
  const matching = filterAndSortRecords(allRecords, query, filters);
  const start = (Math.max(1, page) - 1) * pageSize;
  return {
    records: matching.slice(start, start + pageSize),
    total: matching.length,
    activeCount: allRecords.filter((record) => !record.archivedAt).length,
    archivedCount: allRecords.filter((record) => Boolean(record.archivedAt)).length,
    filterOptions: filterOptionsFromRecords(allRecords),
    fastPath: false,
  };
}

async function getSharedRecords(
  source: "assistance_record_summaries" | "assistance_records",
  summaries: boolean,
): Promise<AssistanceRecord[]> {
  const rows: SharedRecordRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await getSupabaseClient()
      .from(source)
      .select("id, record")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(databaseMessage(error.message));
    const page = (data || []) as SharedRecordRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows.map((row) =>
    normalizeRecord({
      ...row.record,
      id: Number(row.id),
      recordLoadState: summaries ? "summary" : "full",
    }),
  );
}

export async function getRecord(id: number): Promise<AssistanceRecord> {
  if (!isSupabaseConfigured) {
    const record = (await getLocalRecords()).find((candidate) => candidate.id === id);
    if (!record) throw new Error("The requested record could not be found.");
    return record;
  }

  const { data, error } = await getSupabaseClient()
    .from("assistance_records")
    .select("id, record")
    .eq("id", id)
    .single();
  if (error) throw new Error(databaseMessage(error.message));
  const row = data as SharedRecordRow;
  return normalizeRecord({ ...row.record, id: Number(row.id), recordLoadState: "full" });
}

export async function getCompleteRecords(): Promise<AssistanceRecord[]> {
  if (!isSupabaseConfigured) return getLocalRecords();
  return getSharedRecords("assistance_records", false);
}

export async function addRecord(record: AssistanceRecord): Promise<void> {
  const standardized = standardizeApplicantText(record);
  if (!isSupabaseConfigured) return addLocalRecord(standardized);

  const client = getSupabaseClient();
  const user = await requireUser();
  const payload = toSharedPayload(standardized);
  const { error } = await client.from("assistance_records").insert({
    ...payload,
    created_by: user.id,
    updated_by: user.id,
  });
  if (error) throw new Error(databaseMessage(error.message));
}

export async function addRecords(
  records: AssistanceRecord[],
  onProgress?: (completed: number, total: number) => void,
): Promise<{ imported: number; failed: number }> {
  if (!records.length) return { imported: 0, failed: 0 };
  const standardized = records.map(standardizeApplicantText);
  if (!isSupabaseConfigured) {
    try {
      await addLocalRecords(standardized);
      onProgress?.(standardized.length, standardized.length);
      return { imported: standardized.length, failed: 0 };
    } catch {
      return { imported: 0, failed: standardized.length };
    }
  }

  const client = getSupabaseClient();
  const user = await requireUser();
  const batchSize = 200;
  let imported = 0;
  let failed = 0;
  for (let index = 0; index < standardized.length; index += batchSize) {
    const batch = standardized.slice(index, index + batchSize);
    const { error } = await client.from("assistance_records").insert(batch.map((record) => ({
      ...toSharedPayload(record),
      created_by: user.id,
      updated_by: user.id,
    })));
    if (error) {
      console.error("Bulk import batch failed; retrying its records individually:", error);
      for (const record of batch) {
        const { error: rowError } = await client.from("assistance_records").insert({
          ...toSharedPayload(record),
          created_by: user.id,
          updated_by: user.id,
        });
        if (rowError) {
          console.error(`Import failed for ${record.surname}, ${record.firstName}:`, rowError);
          failed += 1;
        } else {
          imported += 1;
        }
      }
    } else {
      imported += batch.length;
    }
    onProgress?.(Math.min(index + batch.length, standardized.length), standardized.length);
  }
  return { imported, failed };
}

export async function updateRecord(record: AssistanceRecord): Promise<void> {
  let standardized = standardizeApplicantText(record);
  if (!isSupabaseConfigured) return updateLocalRecord(standardized);
  if (record.id === undefined) throw new Error("An existing record ID is required.");
  if (record.recordLoadState === "summary") {
    const complete = await getRecord(record.id);
    standardized = standardizeApplicantText({
      ...complete,
      ...record,
      idImage: complete.idImage,
      idImageBack: complete.idImageBack,
      recordLoadState: "full",
    });
  }

  const client = getSupabaseClient();
  const user = await requireUser();
  const { error } = await client
    .from("assistance_records")
    .update({ ...toSharedPayload(standardized), updated_by: user.id })
    .eq("id", record.id);
  if (error) throw new Error(databaseMessage(error.message));
}

export async function deleteRecord(id: number): Promise<void> {
  if (!isSupabaseConfigured) return deleteLocalRecord(id);

  await requireUser();
  const { error } = await getSupabaseClient()
    .from("assistance_records")
    .delete()
    .eq("id", id);
  if (error) throw new Error(databaseMessage(error.message));
}

export function subscribeToRecordChanges(onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => undefined;

  const client = getSupabaseClient();
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  const channel = client
    .channel("assistance-record-updates")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "assistance_records" },
      () => {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(onChange, 400);
      },
    )
    .subscribe();

  return () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    void client.removeChannel(channel);
  };
}

async function requireUser() {
  const { data, error } = await getSupabaseClient().auth.getUser();
  if (error || !data.user) throw new Error("Your staff session has expired. Sign in again.");
  return data.user;
}

function toSharedPayload(record: AssistanceRecord) {
  const storedRecord: Partial<AssistanceRecord> = { ...record };
  delete storedRecord.id;
  delete storedRecord.recordLoadState;
  delete storedRecord.historyApplicationCount;
  delete storedRecord.historyTotalGranted;
  return {
    record: storedRecord,
    surname_normalized: normalizeIdentityPart(record.surname),
    first_name_normalized: normalizeIdentityPart(record.firstName),
    birthday: record.birthday,
  };
}

function normalizeFilterOptions(value?: Partial<RecordFilterOptions>): RecordFilterOptions {
  return {
    barangays: normalizeOptionArray(value?.barangays),
    assistanceTypes: normalizeOptionArray(value?.assistanceTypes),
    sexes: normalizeOptionArray(value?.sexes),
    categories: normalizeOptionArray(value?.categories),
    employmentStatuses: normalizeOptionArray(value?.employmentStatuses),
  };
}

function filterOptionsFromRecords(records: AssistanceRecord[]): RecordFilterOptions {
  const unique = (values: string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  return {
    barangays: unique(records.map((record) => record.brgy)),
    assistanceTypes: unique(records.map((record) => record.assistanceType)),
    sexes: unique(records.map((record) => record.sex)),
    categories: unique(records.map((record) => record.category)),
    employmentStatuses: unique(records.map((record) => record.employedStatus)),
  };
}

function normalizeOptionArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function databaseMessage(message: string): string {
  if (message.includes("assistance_records_applicant_identity_idx") || message.includes("duplicate key")) {
    return "A shared record already exists for this surname, first name, and birthday.";
  }
  if (message.includes("row-level security")) {
    return "Your staff account is not allowed to perform this database action.";
  }
  return message;
}
