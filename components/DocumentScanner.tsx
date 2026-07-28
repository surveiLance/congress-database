"use client";

import { ChangeEvent, useState } from "react";
import Image from "next/image";
import { confidentMatchThreshold, ScoredRecordMatch, scoreDocumentMatches } from "@/lib/scoredMatching";
import { AssistanceRecord } from "@/lib/types";

interface Props {
  records: AssistanceRecord[];
  onView: (record: AssistanceRecord) => void;
  onAttachDocument: (record: AssistanceRecord, imageData: string) => Promise<boolean>;
}

export default function DocumentScanner({ records, onView, onAttachDocument }: Props) {
  const [preview, setPreview] = useState("");
  const [imageData, setImageData] = useState("");
  const [text, setText] = useState("Upload or snap a photo of an ID/document to extract details and search existing records.");
  const [busy, setBusy] = useState(false);
  const [matches, setMatches] = useState<ScoredRecordMatch[] | null>(null);
  const [confirmedId, setConfirmedId] = useState<number | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [attached, setAttached] = useState(false);

  const scan = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setImageData(await fileToDataUrl(file));
    setBusy(true);
    setMatches(null);
    setConfirmedId(null);
    setAttached(false);
    setText("Analyzing image and reading text using OCR...");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const result = await worker.recognize(file);
      await worker.terminate();
      const extracted = result.data.text || "";
      setText(extracted || "No legible text recognized.");
      setMatches(scoreDocumentMatches(extracted, records));
    } catch (error) {
      console.error(error);
      setText("Error reading document text. Please try again with a clearer photo.");
      setMatches([]);
    } finally {
      setBusy(false);
    }
  };

  const confident = Boolean(matches?.length && matches[0].percentage >= confidentMatchThreshold);
  const confirmedMatch = matches?.find((match) => match.record.id !== undefined && match.record.id === confirmedId) || null;

  const attachDocument = async () => {
    if (!confirmedMatch || !imageData) return;
    setAttaching(true);
    try {
      const didAttach = await onAttachDocument(confirmedMatch.record, imageData);
      setAttached(didAttach);
    } finally {
      setAttaching(false);
    }
  };

  return (
    <>
      <section className="scanner-card">
        <div className="scanner-header"><h3>Document / ID Matching</h3>{busy && <span>Reading document…</span>}</div>
        <div className="scanner-body">
          <div>
            <label className="btn secondary file-button">Upload ID or Document<input type="file" accept="image/*" capture="environment" onChange={scan} /></label>
            {preview && <Image unoptimized src={preview} width={800} height={500} className="scan-preview" alt="Document preview" />}
          </div>
          <div><label>Raw OCR Text for Staff Review:</label><div className="scan-output">{text}</div></div>
        </div>
      </section>
      {matches && (
        <section className="match-section">
          <div className="match-heading">
            <div><h3>Scored Database Matches</h3><p>Review the top five candidates. No record is selected automatically.</p></div>
            <span className={`match-status ${confident ? "confident" : "not-confident"}`}>
              {confident ? "Possible Confident Match" : "No Confident Match"}
            </span>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Rank</th><th>Applicant</th><th>Birthday</th><th>Barangay</th><th>Match</th><th>Matched Fields</th><th>Staff Action</th></tr></thead>
              <tbody>
                {!matches.length && <tr><td colSpan={7} className="empty">No database records are available for comparison.</td></tr>}
                {matches.map((match, index) => {
                  const { record } = match;
                  const isConfirmed = record.id !== undefined && confirmedId === record.id;
                  return (
                    <tr key={record.id}>
                      <td>#{index + 1}</td>
                      <td><strong>{record.surname}, {record.firstName} {record.middleName}</strong></td>
                      <td>{record.birthday}</td>
                      <td>{record.brgy}</td>
                      <td><span className={`match-percentage${match.percentage < confidentMatchThreshold ? " low" : ""}`}>{match.percentage}%</span></td>
                      <td>
                        <div className="matched-fields">
                          {match.matchedFields.length
                            ? match.matchedFields.map((field) => <span key={field}>{field}</span>)
                            : <em>No scored fields matched</em>}
                        </div>
                      </td>
                      <td className="actions match-actions">
                        <button className="btn secondary small" type="button" onClick={() => onView(record)}>View Details</button>
                        <button
                          className={`btn small${match.percentage < confidentMatchThreshold ? " warning" : ""}${isConfirmed ? " confirmed-match" : ""}`}
                          type="button"
                          disabled={record.id === undefined}
                          onClick={() => { setConfirmedId(record.id as number); setAttached(false); }}
                        >
                          {isConfirmed ? "Selected ✓" : match.percentage < confidentMatchThreshold ? "Select Anyway" : "Select Match"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {confirmedMatch && (
            <section className="match-outcome" aria-labelledby="match-outcome-title">
              <div className="match-outcome-heading">
                <span>Existing applicant selected</span>
                <h3 id="match-outcome-title">{confirmedMatch.record.firstName} {confirmedMatch.record.middleName} {confirmedMatch.record.surname}</h3>
                <p>Use the existing record to avoid creating a duplicate application.</p>
              </div>
              <div className="match-outcome-actions">
                <button className="btn secondary" type="button" onClick={() => onView(confirmedMatch.record)}>Open Existing Record</button>
                <button className="btn" type="button" disabled={attaching || attached || !imageData} onClick={() => void attachDocument()}>
                  {attached ? "Document Attached ✓" : attaching ? "Attaching…" : "Attach Document to Record"}
                </button>
              </div>
              {attached && <div className="confirmed-match-message" role="status">The scanned document is now attached to this existing record.</div>}
            </section>
          )}
        </section>
      )}
    </>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
