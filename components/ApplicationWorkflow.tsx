"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { applicantIdentityKey, buildApplicantHistories, formatPeso } from "@/lib/applicantIdentity";
import { AssistanceRecord } from "@/lib/types";
import { requirementCategories } from "@/components/IntakeFormModal";

interface Props {
  mode: "intake" | "review";
  records: AssistanceRecord[];
  onEditIntake: (record: AssistanceRecord) => void;
  onCompleteEncoding: (record: AssistanceRecord) => void;
  onUpdate: (record: AssistanceRecord) => Promise<void>;
}

export default function ApplicationWorkflow({ mode, records, onEditIntake, onCompleteEncoding, onUpdate }: Props) {
  const [reviewing, setReviewing] = useState<AssistanceRecord | null>(null);
  const drafts = records.filter((record) => record.workflowStage === "intake" || record.workflowStage === "returned");
  const waiting = records.filter((record) => record.workflowStage === "for-review");
  const approved = records.filter((record) => record.workflowStage === "approved");

  if (mode === "intake") {
    return (
      <div className="workflow-board">
        <WorkflowSummary
          steps={[
            ["Draft / Returned", drafts.length, "Complete the first-level information and document packet."],
            ["With Reviewer", waiting.length, "Submitted upstairs for requirements and grant review."],
            ["Ready to Encode", approved.length, "Approved amount is ready for final downstairs encoding."],
          ]}
        />
        <WorkflowSection
          title="First-level applications"
          description="Drafts and returned packets that still need work."
          empty="No intake drafts or returned applications."
        >
          {drafts.map((record) => (
            <WorkflowCard key={record.id} record={record}>
              <button className="btn" type="button" onClick={() => onEditIntake(record)}>
                {record.workflowStage === "returned" ? "Fix & Resubmit" : "Continue Application"}
              </button>
            </WorkflowCard>
          ))}
        </WorkflowSection>
        <WorkflowSection
          title="Sent upstairs — waiting for review"
          description="Submitted packets remain visible here while the reviewer checks them."
          empty="No submitted applications are currently waiting upstairs."
        >
          {waiting.map((record) => (
            <WorkflowCard key={record.id} record={record}>
              <button className="btn secondary" type="button" onClick={() => setReviewing(record)}>View Submitted Packet</button>
            </WorkflowCard>
          ))}
        </WorkflowSection>
        <WorkflowSection
          title="Approved — ready for final encoding"
          description="The reviewer has checked the packet and entered the granted amount."
          empty="No approved applications are waiting for encoding."
          accent="approved"
        >
          {approved.map((record) => (
            <WorkflowCard key={record.id} record={record} showGranted>
              <button className="btn" type="button" onClick={() => onCompleteEncoding(record)}>Verify & Complete Record</button>
              <button className="btn secondary" type="button" onClick={() => setReviewing(record)}>View Approval Packet</button>
            </WorkflowCard>
          ))}
        </WorkflowSection>
        {reviewing && (
          <ReviewModal
            readOnly
            record={reviewing}
            allRecords={records}
            onClose={() => setReviewing(null)}
            onUpdate={onUpdate}
          />
        )}
      </div>
    );
  }

  return (
    <div className="workflow-board">
      <WorkflowSummary
        steps={[
          ["Waiting for Review", waiting.length, "Packets sent from first-level intake."],
          ["Approved for Encoding", approved.length, "Checked packets already sent downstairs."],
          ["Returned", drafts.filter((record) => record.workflowStage === "returned").length, "Packets sent back for missing or incorrect information."],
        ]}
      />
      <WorkflowSection
        title="Applications waiting for review"
        description="Open each packet, check the attached requirements, then approve an amount or return it."
        empty="No applications are currently waiting for review."
      >
        {waiting.map((record) => (
          <WorkflowCard key={record.id} record={record}>
            <button className="btn" type="button" onClick={() => setReviewing(record)}>Review Application</button>
          </WorkflowCard>
        ))}
      </WorkflowSection>
      <WorkflowSection
        title="Approved and sent for encoding"
        description="These amounts are confirmed and visible to the downstairs encoder."
        empty="No applications have been approved yet."
        accent="approved"
      >
        {approved.map((record) => (
          <WorkflowCard key={record.id} record={record} showGranted>
            <button className="btn secondary" type="button" onClick={() => setReviewing(record)}>View Approval</button>
          </WorkflowCard>
        ))}
      </WorkflowSection>
      {reviewing && (
        <ReviewModal
          readOnly={reviewing.workflowStage === "approved"}
          record={reviewing}
          allRecords={records}
          onClose={() => setReviewing(null)}
          onUpdate={async (record) => {
            await onUpdate(record);
            setReviewing(null);
          }}
        />
      )}
    </div>
  );
}

function WorkflowSummary({ steps }: { steps: Array<[string, number, string]> }) {
  return (
    <section className="workflow-summary" aria-label="Application handoff summary">
      {steps.map(([label, count, description], index) => (
        <article key={label}>
          <span>{index + 1}</span>
          <div>
            <strong>{count} {label}</strong>
            <small>{description}</small>
          </div>
        </article>
      ))}
    </section>
  );
}

function WorkflowSection({
  title,
  description,
  empty,
  accent = "",
  children,
}: {
  title: string;
  description: string;
  empty: string;
  accent?: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  const hasItems = items.some(Boolean);
  return (
    <section className={`workflow-section${accent ? ` ${accent}` : ""}`}>
      <div className="workflow-section-heading">
        <div><h3>{title}</h3><p>{description}</p></div>
      </div>
      <div className="workflow-list">
        {hasItems ? children : <div className="workflow-empty">{empty}</div>}
      </div>
    </section>
  );
}

function WorkflowCard({ record, showGranted = false, children }: { record: AssistanceRecord; showGranted?: boolean; children: React.ReactNode }) {
  const status = workflowStatus(record);
  return (
    <article className="workflow-card">
      <div className="workflow-card-person">
        <span className={`workflow-status ${status.className}`}>{status.label}</span>
        <strong>{record.surname}, {record.firstName} {record.middleName}</strong>
        <small>Applied {formatDate(record.intakeDate || record.createdAt)} · {record.brgy || "No barangay"}</small>
        {record.workflowStage === "returned" && record.reviewNotes && <p><b>Returned:</b> {record.reviewNotes}</p>}
      </div>
      <div className="workflow-card-request">
        <span>{record.assistanceType || "Unspecified assistance"}</span>
        <strong>Requested {formatPeso(record.amountRequested)}</strong>
        {showGranted && <b>Granted {formatPeso(record.amount)}</b>}
        <small>{record.documents.length} document photo{record.documents.length === 1 ? "" : "s"}</small>
      </div>
      <div className="workflow-card-actions">{children}</div>
    </article>
  );
}

function ReviewModal({
  record,
  allRecords,
  readOnly,
  onClose,
  onUpdate,
}: {
  record: AssistanceRecord;
  allRecords: AssistanceRecord[];
  readOnly: boolean;
  onClose: () => void;
  onUpdate: (record: AssistanceRecord) => Promise<void>;
}) {
  const [amount, setAmount] = useState(record.amount || 0);
  const [notes, setNotes] = useState(record.reviewNotes || "");
  const [checks, setChecks] = useState<string[]>([...record.requirementChecks]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const approvedPacket = record.workflowStage === "approved";
  const completedHistories = useMemo(
    () => buildApplicantHistories(allRecords.filter((item) => item.workflowStage === "completed")),
    [allRecords],
  );
  const previousHistory = completedHistories.get(applicantIdentityKey(record));

  const toggleCheck = (category: string) => {
    setChecks((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category]);
  };

  const approve = async () => {
    if (amount <= 0) {
      setError("Enter the approved amount before sending this application for encoding.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const now = new Date().toISOString();
      await onUpdate({
        ...record,
        amount,
        reviewNotes: notes,
        requirementChecks: checks,
        workflowStage: "approved",
        reviewedAt: now,
        approvedAt: now,
        updatedAt: now,
      });
    } catch (reason) {
      console.error(reason);
      setError(reason instanceof Error ? reason.message : "The review could not be saved.");
      setSaving(false);
    }
  };

  const returnToIntake = async () => {
    if (!notes.trim()) {
      setError("Explain what is missing or needs correction before returning the application.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onUpdate({
        ...record,
        reviewNotes: notes.trim(),
        requirementChecks: checks,
        workflowStage: "returned",
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (reason) {
      console.error(reason);
      setError(reason instanceof Error ? reason.message : "The application could not be returned.");
      setSaving(false);
    }
  };

  return (
    <div className="modal active" role="dialog" aria-modal="true" aria-labelledby="review-application-title">
      <div className="modal-content workflow-review-modal">
        <div className="modal-header">
          <div>
            <span className="eyebrow">{readOnly ? approvedPacket ? "Approved packet" : "Submitted packet" : "Supervisor review"}</span>
            <h2 id="review-application-title">{record.surname}, {record.firstName} {record.middleName}</h2>
          </div>
          <button className="close" type="button" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        {error && <div className="notice error" role="alert">{error}</div>}
        <section className="review-key-numbers">
          <div><span>First-level date</span><strong>{formatDate(record.intakeDate)}</strong></div>
          <div><span>Requested</span><strong>{formatPeso(record.amountRequested)}</strong></div>
          <div><span>Previously granted</span><strong>{formatPeso(previousHistory?.totalGranted || 0)}</strong><small>{previousHistory?.applicationCount || 0} completed application{previousHistory?.applicationCount === 1 ? "" : "s"}</small></div>
          {readOnly ? (
            <div className={approvedPacket ? "approved" : ""}>
              <span>{approvedPacket ? "Approved amount" : "Grant decision"}</span>
              <strong>{approvedPacket ? formatPeso(record.amount) : "Awaiting review"}</strong>
            </div>
          ) : (
            <label className="review-decision-card">
              <span>Grant decision (₱) *</span>
              <input
                autoFocus
                type="number"
                min="0"
                step=".01"
                value={amount || ""}
                onChange={(event) => setAmount(Number(event.target.value))}
                placeholder="Enter approved amount"
              />
            </label>
          )}
        </section>
        <div className="workflow-review-layout">
          <div className="review-information">
            <ReviewDetails title="Applicant & Request" rows={[
              ["Birthday / Age / Sex", `${record.birthday} · ${record.age || "—"} yrs · ${record.sex || "—"}`],
              ["Contact", record.contact || "Not recorded"],
              ["Address", `${record.address || "Not recorded"}, ${record.brgy || ""}`],
              ["Assistance", record.assistanceType || "Not specified"],
              ["Beneficiary", record.benName || "Self / applicant"],
              ["Diagnosis / Reason", record.diagnosis || "Not recorded"],
            ]} />
            <ReviewDetails title="Financial & Household Basis" rows={[
              ["Occupation / Status", `${record.work || "Not recorded"} · ${record.employedStatus || "Not recorded"}`],
              ["Monthly income", formatPeso(record.salary)],
              ["Monthly expenses", formatPeso(record.monthlyExpenses)],
              ["Household members", String(record.householdMembers || "Not recorded")],
              ["Employed members", String(record.totalEmployed || "Not recorded")],
              ["Intake remarks", record.remarks || "None"],
            ]} />
            <fieldset className="review-checklist" disabled={readOnly}>
              <legend>Requirements checked</legend>
              <p>Mark the papers you verified in the uploaded packet.</p>
              {requirementCategories.map((category) => (
                <label key={category}>
                  <input type="checkbox" checked={checks.includes(category)} onChange={() => toggleCheck(category)} />
                  <span>{category}</span>
                </label>
              ))}
            </fieldset>
            <label className="review-notes">
              <span>Reviewer notes {readOnly ? "" : "/ reason for return"}</span>
              <textarea readOnly={readOnly} rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Record missing documents, corrections, or approval notes." />
            </label>
          </div>
          <aside className="review-documents">
            <div>
              <span className="eyebrow">Submitted packet</span>
              <h3>{record.documents.length} document photo{record.documents.length === 1 ? "" : "s"}</h3>
              <p>Open any image to inspect it at full size.</p>
            </div>
            {!record.documents.length && <div className="document-empty"><strong>No photos attached</strong><span>Return the application if documents are required.</span></div>}
            {record.documents.map((document) => (
              <a className="review-document" key={document.id} href={document.dataUrl} target="_blank" rel="noreferrer">
                <Image unoptimized src={document.dataUrl} width={600} height={420} alt={document.category} />
                <span><strong>{document.category}</strong><small>Open full size</small></span>
              </a>
            ))}
          </aside>
        </div>
        <div className="modal-footer workflow-review-actions">
          <button className="btn secondary" type="button" onClick={onClose}>Close</button>
          {!readOnly && <button className="btn warning" type="button" disabled={saving} onClick={() => void returnToIntake()}>Return for Correction</button>}
          {!readOnly && <button className="btn" type="button" disabled={saving} onClick={() => void approve()}>{saving ? "Saving..." : "Approve & Send to Encoding"}</button>}
        </div>
      </div>
    </div>
  );
}

function ReviewDetails({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <section className="review-detail-section">
      <h3>{title}</h3>
      {rows.map(([label, value]) => <div key={label}><strong>{label}</strong><span>{value}</span></div>)}
    </section>
  );
}

function workflowStatus(record: AssistanceRecord) {
  if (record.workflowStage === "returned") return { label: "Returned", className: "returned" };
  if (record.workflowStage === "for-review") return { label: "With Reviewer", className: "review" };
  if (record.workflowStage === "approved") return { label: "Approved", className: "approved" };
  return { label: "Draft", className: "draft" };
}

function formatDate(value: string) {
  if (!value) return "Not recorded";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-PH");
}
