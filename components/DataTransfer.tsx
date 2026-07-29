"use client";

import { ChangeEvent, useRef, useState } from "react";
import { AssistanceRecord } from "@/lib/types";
import {
  createImportPreview,
  ImportPreviewRow,
  parseCsvImport,
  parseJsonImport,
  recordsToCsv,
} from "@/lib/dataTransfer";
import { addRecord, updateRecord, usesSharedDatabase } from "@/lib/recordStore";

type ImportFormat = "JSON" | "CSV";

interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
}

export default function DataTransfer({ records, onChanged }: { records: AssistanceRecord[]; onChanged: () => Promise<void> }) {
  const jsonInput = useRef<HTMLInputElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreviewRow[] | null>(null);
  const [format, setFormat] = useState<ImportFormat>("JSON");
  const [fileName, setFileName] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const exportJson = () => {
    const backup = { version: 1, exportedAt: new Date().toISOString(), records };
    downloadFile(JSON.stringify(backup, null, 2), `assistance-backup-${dateStamp()}.json`, "application/json");
    setMessage({ type: "success", text: `Exported ${records.length} record${records.length === 1 ? "" : "s"} to JSON.` });
  };

  const exportCsv = () => {
    downloadFile(recordsToCsv(records), `assistance-records-${dateStamp()}.csv`, "text/csv;charset=utf-8");
    setMessage({ type: "success", text: `Exported ${records.length} record${records.length === 1 ? "" : "s"} to CSV.` });
  };

  const selectFile = async (event: ChangeEvent<HTMLInputElement>, selectedFormat: ImportFormat) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage(null);
    setResult(null);
    setOverwrite(false);
    try {
      const text = await file.text();
      const rows = selectedFormat === "JSON" ? parseJsonImport(text) : parseCsvImport(text);
      if (!rows.length) throw new Error("The selected file contains no records.");
      setFormat(selectedFormat);
      setFileName(file.name);
      setPreview(createImportPreview(rows, records));
    } catch (error) {
      setPreview(null);
      setMessage({ type: "error", text: error instanceof Error ? error.message : "The selected file could not be read." });
    }
  };

  const importPreview = async () => {
    if (!preview) return;
    const overwriteable = preview.filter((row) => row.status === "duplicate" && row.duplicateId !== undefined).length;
    if (overwrite && overwriteable > 0 && !window.confirm(`Overwrite ${overwriteable} existing record${overwriteable === 1 ? "" : "s"} with the imported data?`)) {
      return;
    }

    setImporting(true);
    let imported = 0;
    let failed = preview.filter((row) => row.status === "failed").length;
    let skipped = 0;

    for (const row of preview) {
      if (!row.record || row.status === "failed") continue;
      const canOverwrite = row.status === "duplicate" && row.duplicateId !== undefined;
      if (row.status === "duplicate" && (!overwrite || !canOverwrite)) {
        skipped += 1;
        continue;
      }
      try {
        if (canOverwrite) {
          await updateRecord({ ...row.record, id: row.duplicateId });
        } else {
          await addRecord(row.record);
        }
        imported += 1;
      } catch (error) {
        console.error("Import row failed:", error);
        failed += 1;
      }
    }

    await onChanged();
    const importResult = { imported, skipped, failed };
    setResult(importResult);
    setImporting(false);
    setMessage({
      type: failed ? "error" : "success",
      text: `Import complete: ${imported} imported, ${skipped} skipped, ${failed} failed.`,
    });
  };

  const closePreview = () => {
    setPreview(null);
    setResult(null);
    setOverwrite(false);
  };

  const counts = preview ? {
    ready: preview.filter((row) => row.status === "ready").length,
    duplicate: preview.filter((row) => row.status === "duplicate").length,
    failed: preview.filter((row) => row.status === "failed").length,
  } : null;

  return (
    <>
      <section className="transfer-panel" aria-labelledby="transfer-title">
        <div>
          <h2 id="transfer-title">Data Backup & Transfer</h2>
          <p>Export a backup or preview imported records before saving them to the {usesSharedDatabase ? "shared database" : "current browser"}.</p>
        </div>
        <div className="transfer-actions">
          <button className="btn secondary" onClick={exportJson}>Export JSON</button>
          <button className="btn secondary" onClick={() => jsonInput.current?.click()}>Import JSON</button>
          <button className="btn secondary" onClick={exportCsv}>Export CSV</button>
          <button className="btn secondary" onClick={() => csvInput.current?.click()}>Import CSV</button>
          <input ref={jsonInput} className="sr-only" type="file" accept=".json,application/json" onChange={(event) => void selectFile(event, "JSON")} />
          <input ref={csvInput} className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => void selectFile(event, "CSV")} />
        </div>
      </section>
      {message && <div className={`notice ${message.type}`} role={message.type === "error" ? "alert" : "status"}>{message.text}</div>}

      {preview && counts && (
        <div className="modal active" role="dialog" aria-modal="true" aria-labelledby="import-preview-title">
          <div className="modal-content import-modal">
            <div className="modal-header">
              <div><h2 id="import-preview-title">Import {format} Preview</h2><p className="muted">{fileName}</p></div>
              <button className="close" type="button" onClick={closePreview} aria-label="Close import preview">&times;</button>
            </div>

            <div className="import-counts" aria-label="Preview counts">
              <span className="count ready">{counts.ready} ready</span>
              <span className="count duplicate">{counts.duplicate} duplicate</span>
              <span className="count failed">{counts.failed} failed</span>
            </div>

            <div className="table-container import-preview-table">
              <table>
                <thead><tr><th>Row</th><th>Applicant</th><th>Birthday</th><th>Status</th><th>Details</th></tr></thead>
                <tbody>
                  {preview.map((row) => (
                    <tr key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      <td>{row.record ? `${row.record.surname}, ${row.record.firstName} ${row.record.middleName}`.trim() : "Invalid row"}</td>
                      <td>{row.record?.birthday || "—"}</td>
                      <td><span className={`status-badge ${row.status}`}>{row.status}</span></td>
                      <td>{row.errors.join(" ") || "Valid and ready to import."}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {counts.duplicate > 0 && (
              <label className="overwrite-option">
                <input type="checkbox" checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)} />
                Overwrite matching existing records. You will be asked to confirm before saving.
              </label>
            )}

            {result && (
              <div className="import-result" role="status">
                <strong>Import result</strong>
                <span>{result.imported} imported</span><span>{result.skipped} skipped</span><span>{result.failed} failed</span>
              </div>
            )}

            <div className="modal-footer">
              <button type="button" className="btn secondary" onClick={closePreview}>{result ? "Close" : "Cancel"}</button>
              {!result && <button type="button" className="btn" disabled={importing || counts.ready + (overwrite ? counts.duplicate : 0) === 0} onClick={() => void importPreview()}>{importing ? "Importing..." : "Import Records"}</button>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function downloadFile(contents: string, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
