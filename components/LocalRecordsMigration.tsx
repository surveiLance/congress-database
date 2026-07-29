"use client";

import { useEffect, useMemo, useState } from "react";
import { createImportPreview } from "@/lib/dataTransfer";
import { addRecord, getLocalRecords } from "@/lib/recordStore";
import { AssistanceRecord } from "@/lib/types";

interface Props {
  sharedRecords: AssistanceRecord[];
  onChanged: () => Promise<void>;
}

export default function LocalRecordsMigration({ sharedRecords, onChanged }: Props) {
  const [localRecords, setLocalRecords] = useState<AssistanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void getLocalRecords()
      .then(setLocalRecords)
      .finally(() => setLoading(false));
  }, []);

  const preview = useMemo(
    () => createImportPreview(localRecords, sharedRecords),
    [localRecords, sharedRecords],
  );
  const ready = preview.filter((row) => row.status === "ready" && row.record);
  const duplicates = preview.filter((row) => row.status === "duplicate").length;

  if (loading || !localRecords.length) return null;

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
        <p>
          This browser contains {localRecords.length} local record{localRecords.length === 1 ? "" : "s"}.
          {" "}{ready.length} can be copied to the shared database and {duplicates} already match shared applicants.
        </p>
        {message && <div className="notice success" role="status">{message}</div>}
      </div>
      <button className="btn secondary" type="button" disabled={!ready.length || migrating} onClick={() => void migrate()}>
        {migrating ? "Copying…" : ready.length ? `Copy ${ready.length} to Shared Database` : "Everything Is Already Shared"}
      </button>
    </section>
  );
}
