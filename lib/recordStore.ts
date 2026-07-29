import { AssistanceRecord, normalizeRecord } from "./types";
import { normalizeIdentityPart, standardizeApplicantText } from "./applicantIdentity";
import {
  addRecord as addLocalRecord,
  deleteRecord as deleteLocalRecord,
  getRecords as getLocalRecords,
  updateRecord as updateLocalRecord,
} from "./indexedDb";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

interface SharedRecordRow {
  id: number | string;
  record: Partial<AssistanceRecord>;
}

export { getLocalRecords };
export const usesSharedDatabase = isSupabaseConfigured;

export async function getRecords(): Promise<AssistanceRecord[]> {
  if (!isSupabaseConfigured) return getLocalRecords();

  const { data, error } = await getSupabaseClient()
    .from("assistance_records")
    .select("id, record")
    .order("created_at", { ascending: false });

  if (error) throw new Error(databaseMessage(error.message));
  return ((data || []) as SharedRecordRow[]).map((row) =>
    normalizeRecord({ ...row.record, id: Number(row.id) }),
  );
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

export async function updateRecord(record: AssistanceRecord): Promise<void> {
  const standardized = standardizeApplicantText(record);
  if (!isSupabaseConfigured) return updateLocalRecord(standardized);
  if (record.id === undefined) throw new Error("An existing record ID is required.");

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
  const channel = client
    .channel("assistance-record-updates")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "assistance_records" },
      onChange,
    )
    .subscribe();

  return () => {
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
  return {
    record: storedRecord,
    surname_normalized: normalizeIdentityPart(record.surname),
    first_name_normalized: normalizeIdentityPart(record.firstName),
    birthday: record.birthday,
  };
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
