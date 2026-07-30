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
import { ExcelImportSummary, parseMaipExcelImport } from "@/lib/excelImport";
import { addRecords, getCompleteRecords, updateRecord, usesSharedDatabase } from "@/lib/recordStore";

type ImportFormat = "JSON" | "CSV" | "Excel";
type PreviewFilter = "all" | "ready" | "duplicate" | "failed";

interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
}

export default function DataTransfer({ records, onChanged }: { records: AssistanceRecord[]; onChanged: () => Promise<void> }) {
  const jsonInput = useRef<HTMLInputElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);
  const excelInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreviewRow[] | null>(null);
  const [format, setFormat] = useState<ImportFormat>("JSON");
  const [fileName, setFileName] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [progress, setProgress] = useState("");
  const [excelSummary, setExcelSummary] = useState<ExcelImportSummary | null>(null);
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>("all");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const exportJson = async () => {
    setExportingBackup(true);
    setMessage(null);
    try {
      const completeRecords = await getCompleteRecords();
      const exportRecords = completeRecords.map((record) => {
        const exportRecord: Partial<AssistanceRecord> = { ...record };
        delete exportRecord.recordLoadState;
        return exportRecord;
      });
      const backup = { version: 1, exportedAt: new Date().toISOString(), records: exportRecords };
      downloadFile(JSON.stringify(backup, null, 2), `assistance-backup-${dateStamp()}.json`, "application/json");
      setMessage({ type: "success", text: `Exported ${completeRecords.length} complete record${completeRecords.length === 1 ? "" : "s"} and attached images to JSON.` });
    } catch (error) {
      console.error(error);
      setMessage({ type: "error", text: "The complete JSON backup could not be prepared. Check the connection and try again." });
    } finally {
      setExportingBackup(false);
    }
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
      const parsedExcel = selectedFormat === "Excel" ? await parseMaipExcelImport(file) : null;
      const text = parsedExcel ? "" : await file.text();
      const rows = parsedExcel?.rows || (selectedFormat === "JSON" ? parseJsonImport(text) : parseCsvImport(text));
      if (!rows.length) throw new Error("The selected file contains no records.");
      setFormat(selectedFormat);
      setFileName(file.name);
      setExcelSummary(parsedExcel?.summary || null);
      const nextPreview = createImportPreview(rows, records);
      setPreview(nextPreview);
      setPreviewFilter(nextPreview.some((row) => row.status === "failed") ? "failed" : "all");
    } catch (error) {
      setPreview(null);
      setExcelSummary(null);
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
    setProgress("Preparing import...");
    try {
      let imported = 0;
      let failed = preview.filter((row) => row.status === "failed").length;
      const skipped = preview.filter((row) => row.status === "duplicate" && (!overwrite || row.duplicateId === undefined)).length;

      const readyRecords = preview.flatMap((row) => row.status === "ready" && row.record ? [row.record] : []);
      const bulkResult = await addRecords(readyRecords, (completed, total) => {
        setProgress(`Saving ${completed.toLocaleString()} of ${total.toLocaleString()} new applications...`);
      });
      imported += bulkResult.imported;
      failed += bulkResult.failed;

      const overwriteRows = overwrite
        ? preview.filter((row) => row.status === "duplicate" && row.record && row.duplicateId !== undefined)
        : [];
      for (let index = 0; index < overwriteRows.length; index += 1) {
        const row = overwriteRows[index];
        if (!row.record || row.duplicateId === undefined) continue;
        try {
          setProgress(`Updating ${index + 1} of ${overwriteRows.length} confirmed duplicate applications...`);
          await updateRecord({ ...row.record, id: row.duplicateId });
          imported += 1;
        } catch (error) {
          console.error("Import row failed:", error);
          failed += 1;
        }
      }

      await onChanged();
      const importResult = { imported, skipped, failed };
      setResult(importResult);
      setMessage({
        type: failed ? "error" : "success",
        text: `Import complete: ${imported} imported, ${skipped} skipped, ${failed} failed.`,
      });
    } catch (error) {
      console.error("Import failed:", error);
      setMessage({ type: "error", text: error instanceof Error ? error.message : "The import could not be completed." });
    } finally {
      setImporting(false);
      setProgress("");
    }
  };

  const closePreview = () => {
    setPreview(null);
    setResult(null);
    setOverwrite(false);
    setExcelSummary(null);
    setProgress("");
    setPreviewFilter("all");
  };

  const counts = preview ? {
    ready: preview.filter((row) => row.status === "ready").length,
    duplicate: preview.filter((row) => row.status === "duplicate").length,
    failed: preview.filter((row) => row.status === "failed").length,
  } : null;
  const filteredPreview = previewFilter === "all"
    ? preview || []
    : (preview || []).filter((row) => row.status === previewFilter);

  return (
    <>
      <section className="transfer-panel" aria-labelledby="transfer-title">
        <div>
          <h2 id="transfer-title">Data Backup & Transfer</h2>
          <p>Export a backup or preview imported records before saving them to the {usesSharedDatabase ? "shared database" : "current browser"}.</p>
        </div>
        <div className="transfer-actions">
          <button className="btn secondary" disabled={exportingBackup} onClick={() => void exportJson()}>{exportingBackup ? "Preparing Backup…" : "Export JSON"}</button>
          <button className="btn secondary" onClick={() => jsonInput.current?.click()}>Import JSON</button>
          <button className="btn secondary" onClick={exportCsv}>Export CSV</button>
          <button className="btn secondary" onClick={() => csvInput.current?.click()}>Import CSV</button>
          <button className="btn" onClick={() => excelInput.current?.click()}>Import MAIP Excel</button>
          <input ref={jsonInput} className="sr-only" type="file" accept=".json,application/json" onChange={(event) => void selectFile(event, "JSON")} />
          <input ref={csvInput} className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => void selectFile(event, "CSV")} />
          <input ref={excelInput} className="sr-only" type="file" accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12" onChange={(event) => void selectFile(event, "Excel")} />
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
              <button className={`count ready${previewFilter === "ready" ? " active" : ""}`} type="button" onClick={() => setPreviewFilter(previewFilter === "ready" ? "all" : "ready")}>{counts.ready} ready</button>
              <button className={`count duplicate${previewFilter === "duplicate" ? " active" : ""}`} type="button" onClick={() => setPreviewFilter(previewFilter === "duplicate" ? "all" : "duplicate")}>{counts.duplicate} duplicate</button>
              <button className={`count failed${previewFilter === "failed" ? " active" : ""}`} type="button" onClick={() => setPreviewFilter(previewFilter === "failed" ? "all" : "failed")}>{counts.failed} failed</button>
              <span className="import-count-help">Select a count to show only those rows.</span>
            </div>
            {excelSummary && (
              <div className="excel-import-summary">
                <strong>{excelSummary.sourceRows.toLocaleString()} workbook rows reviewed</strong>
                <span>
                  Application dates: {excelSummary.firstApplicationDate || "not recorded"} to {excelSummary.lastApplicationDate || "not recorded"}.
                  Existing applications and duplicates inside the file will be skipped unless you explicitly allow overwriting.
                </span>
              </div>
            )}

            <div className="table-container import-preview-table">
              <table>
                <thead><tr><th>Row</th><th>Applicant</th><th>Application Date</th><th>Assistance</th><th>Amount</th><th>Status</th><th>Details</th></tr></thead>
                <tbody>
                  {filteredPreview.slice(0, 150).map((row) => (
                    <tr key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      <td>{row.record ? `${row.record.surname}, ${row.record.firstName} ${row.record.middleName}`.trim() : "Invalid row"}</td>
                      <td>{row.record?.applicationDate || row.record?.createdAt.slice(0, 10) || "—"}</td>
                      <td>{row.record?.assistanceType || "—"}</td>
                      <td>{row.record ? `₱${row.record.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "—"}</td>
                      <td><span className={`status-badge ${row.status}`}>{row.status}</span></td>
                      <td>{row.errors.join(" ") || "Valid and ready to import."}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filteredPreview.length && <p className="import-preview-limit">No {previewFilter === "all" ? "" : `${previewFilter} `}rows to display.</p>}
            {filteredPreview.length > 150 && <p className="import-preview-limit">Showing the first 150 of {filteredPreview.length.toLocaleString()} {previewFilter === "all" ? "preview" : previewFilter} rows. All {preview.length.toLocaleString()} rows remain included in the counts and import.</p>}

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
              {importing && <span className="import-progress" role="status">{progress}</span>}
              {!result && <button type="button" className="btn" disabled={importing || counts.ready + (overwrite ? counts.duplicate : 0) === 0} onClick={() => void importPreview()}>{importing ? "Importing..." : `Import ${counts.ready.toLocaleString()} Ready Records`}</button>}
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
