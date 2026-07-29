"use client";

import { ChangeEvent, useState } from "react";
import Image from "next/image";
import { confidentMatchThreshold, ScoredRecordMatch, scoreDocumentMatches } from "@/lib/scoredMatching";
import { householdSummaryForRecord } from "@/lib/householdMatching";
import { AssistanceRecord } from "@/lib/types";
import HouseholdConnections from "./HouseholdConnections";

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
  const possible = Boolean(matches?.length);
  const topMatch = matches?.[0] || null;
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
          <div className="scanner-upload">
            <label className="btn secondary file-button">Upload ID or Document<input type="file" accept="image/*" capture="environment" onChange={scan} /></label>
            {preview && <Image unoptimized src={preview} width={800} height={500} className="scan-preview" alt="Document preview" />}
          </div>
          <div className="scanner-review">
            <div className="scanner-result-heading">
              <div>
                <span className="eyebrow">Possible fields from the document</span>
                <h4>{busy ? "Reading the document…" : topMatch ? "Compare these fields" : preview ? "No usable applicant fields detected" : "Upload an ID to begin"}</h4>
              </div>
              {topMatch && <span className={`match-percentage${confident ? "" : " low"}`}>{topMatch.percentage}% match</span>}
            </div>
            {topMatch ? (
              <DetectedFields match={topMatch} />
            ) : (
              <div className="scanner-empty-summary">
                <strong>{busy ? "OCR is checking the image." : preview ? "Try a clearer, straighter photo." : "Surname, first name, birthday, address, and barangay will appear here."}</strong>
                <span>Staff must still confirm the correct applicant.</span>
              </div>
            )}
            {preview && (
              <details className="scanner-ocr-details">
                <summary><span>Show OCR details</span><small>For troubleshooting only</small></summary>
                <div className="scan-output">{text}</div>
              </details>
            )}
          </div>
        </div>
      </section>
      {matches && (
        <section className="match-section">
          <div className="match-heading">
            <div><h3>Possible Applicants</h3><p>Only applicants with at least one matching field are shown. Staff must confirm the correct person.</p></div>
            <span className={`match-status ${confident ? "confident" : "not-confident"}`}>
              {confident ? "Strong Possible Match" : possible ? "Possible Match — Verify" : "No Match Found"}
            </span>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Rank</th><th>Applicant</th><th>Birthday</th><th>Barangay</th><th>Match</th><th>Household Check</th><th>Matched Fields</th><th>Staff Action</th></tr></thead>
              <tbody>
                {!matches.length && <tr><td colSpan={8} className="empty">No applicants matched the readable information. Try a clearer photo or search the records manually.</td></tr>}
                {matches.map((match, index) => {
                  const { record } = match;
                  const isConfirmed = record.id !== undefined && confirmedId === record.id;
                  const household = householdSummaryForRecord(record, records);
                  return (
                    <tr key={record.id}>
                      <td>#{index + 1}</td>
                      <td><strong>{record.surname}, {record.firstName} {record.middleName}</strong></td>
                      <td>{record.birthday}</td>
                      <td>{record.brgy}</td>
                      <td><span className={`match-percentage${match.percentage < confidentMatchThreshold ? " low" : ""}`}>{match.percentage}%</span></td>
                      <td>
                        {household.confirmedConnections.length > 0
                          ? <span className="scanner-household confirmed">{household.confirmedConnections.length} confirmed</span>
                          : household.possibleConnections.length > 0
                            ? <span className="scanner-household possible">{household.possibleConnections.length} possible relative{household.possibleConnections.length === 1 ? "" : "s"}</span>
                            : <span className="scanner-household none">None found</span>}
                      </td>
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
                          {isConfirmed ? "Confirmed ✓" : "Confirm This Applicant"}
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
              <HouseholdConnections record={confirmedMatch.record} allRecords={records} compact />
              {attached && <div className="confirmed-match-message" role="status">The scanned document is now attached to this existing record.</div>}
            </section>
          )}
        </section>
      )}
    </>
  );
}

function DetectedFields({ match }: { match: ScoredRecordMatch }) {
  const matched = (field: string) => match.matchedFields.some((item) => item.toLowerCase().startsWith(field.toLowerCase()));
  const fields = [
    ["Surname", matched("Surname") ? match.record.surname : ""],
    ["First name", matched("First name") ? match.record.firstName : ""],
    ["Birthday", matched("Birthday") ? match.record.birthday : ""],
    ["Barangay", matched("Barangay") ? match.record.brgy : ""],
    ["Address", matched("Address") ? match.record.address : ""],
    ["ID number", matched("ID number") ? match.record.idNumber : ""],
  ];
  return (
    <div className="detected-field-grid">
      {fields.map(([label, value]) => (
        <div className={value ? "detected" : "missing"} key={label}>
          <span>{label}</span>
          <strong>{value || "Not detected"}</strong>
          <small>{value ? "Matched" : "Verify manually"}</small>
        </div>
      ))}
    </div>
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
