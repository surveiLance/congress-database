import { AssistanceRecord } from "./types";

const DB_NAME = "AssistanceDraftDB";
const STORE_NAME = "drafts";

export interface ApplicationDraft {
  key: string;
  record: AssistanceRecord;
  savedAt: string;
}

export async function getApplicationDraft(key: string): Promise<ApplicationDraft | null> {
  const database = await openDraftDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve((request.result as ApplicationDraft | undefined) || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveApplicationDraft(key: string, record: AssistanceRecord): Promise<ApplicationDraft> {
  const database = await openDraftDatabase();
  const draft = { key, record, savedAt: new Date().toISOString() };
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(draft);
    transaction.oncomplete = () => resolve(draft);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function deleteApplicationDraft(key: string): Promise<void> {
  const database = await openDraftDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function openDraftDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
