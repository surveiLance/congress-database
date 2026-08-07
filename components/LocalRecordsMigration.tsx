"use client";

import { useMemo, useState } from "react";
import { createImportPreview } from "@/lib/dataTransfer";
import { addRecord, getLocalRecords } from "@/lib/recordStore";
import { AssistanceRecord } from "@/lib/types";

interface Props {
  loadSharedRecords: () => Promise<AssistanceRecord[]>;
  onChanged: () => Promise<void>;
}

export default function LocalRecordsMigration({ loadSharedRecords, onChanged }: Props) {
  const [localRecords, setLocalRecords] = useState<AssistanceRecord[] | null>(null);
  const [sharedRecords, setSharedRecords] = useState<AssistanceRecord[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [message, setMessage] = useState("");

  const preview = useMemo(
    () => localRecords && sharedRecords ? createImportPreview(localRecords, sharedRecords) : [],
    [localRecords, sharedRecords],
  );
  const ready = preview.filter((row) => row.status === "ready" && row.record);
  const duplicates = preview.filter((row) => row.status === "duplicate").length;

  const checkBrowser = async () => {
    setChecking(true);
    setMessage("");
    try {
      const savedLocalRecords = await getLocalRecords();
      setLocalRecords(savedLocalRecords);
      if (!savedLocalRecords.length) {
        setMessage("No old browser-only records were found on this device.");
        return;
      }
      setSharedRecords(await loadSharedRecords());
    } catch (error) {
      console.error("Browser record check failed:", error);
      setMessage("The browser records could not be checked. Try again when the connection is stable.");
    } finally {
      setChecking(false);
    }
  };

  const migrate = async () => {
    if (!ready.length || !window.confirm(`Copy ${ready.length} local record${ready.length === 1 ? "" : "s"} into the shared database? Existing shared duplicates will be skipped.`)) return;
    setMigrating(true);
    let imported = 0;
    let failed = 0;
    for (const row of ready) {
      if (!row.record) continue;
      try {
        await addRecord(row.record);
        imported += 1;
      } catch (error) {
        console.error("Local record migration failed:", error);
        failed += 1;
      }
    }
    await onChanged();
    setMigrating(false);
    setMessage(`Local migration complete: ${imported} copied, ${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped, ${failed} failed.`);
  };

  return (
    <section className="condition-migration-panel shared-migration-panel">
      <div>
        <h2>Move Existing Browser Records</h2>
        {localRecords && sharedRecords ? <p>
          This browser contains {localRecords.length} local record{localRecords.length === 1 ? "" : "s"}.
          {" "}{ready.length} can be copied to the shared database and {duplicates} already match shared applicants.
        </p> : <p>Only use this if this device has older records saved before the shared database was connected.</p>}
        {message && <div className="notice success" role="status">{message}</div>}
      </div>
      {localRecords && sharedRecords ? <button className="btn secondary" type="button" disabled={!ready.length || migrating} onClick={() => void migrate()}>
        {migrating ? "Copying…" : ready.length ? `Copy ${ready.length} to Shared Database` : "Everything Is Already Shared"}
      </button> : <button className="btn secondary" type="button" disabled={checking} onClick={() => void checkBrowser()}>
        {checking ? "Checking…" : "Check This Browser"}
      </button>}
    </section>
  );
}
