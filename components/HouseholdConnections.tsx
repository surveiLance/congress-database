"use client";

import { useState } from "react";
import { formatPeso } from "@/lib/applicantIdentity";
import { householdSummaryForRecord } from "@/lib/householdMatching";
import { AssistanceRecord } from "@/lib/types";

interface Props {
  record: AssistanceRecord;
  allRecords: AssistanceRecord[];
  compact?: boolean;
  onView?: (record: AssistanceRecord) => void;
  onUpdate?: (record: AssistanceRecord) => Promise<void>;
}

export default function HouseholdConnections({
  record,
  allRecords,
  compact = false,
  onView,
  onUpdate,
}: Props) {
  const [savingKey, setSavingKey] = useState("");
  const [error, setError] = useState("");
  const summary = householdSummaryForRecord(record, allRecords);

  const updateConnection = async (key: string, decision: "confirm" | "dismiss") => {
    if (!onUpdate) return;
    setSavingKey(key);
    setError("");
    try {
      await onUpdate({
        ...record,
        confirmedRelativeKeys: decision === "confirm"
          ? Array.from(new Set([...record.confirmedRelativeKeys, key]))
          : record.confirmedRelativeKeys.filter((item) => item !== key),
        dismissedRelativeKeys: decision === "dismiss"
          ? Array.from(new Set([...record.dismissedRelativeKeys, key]))
          : record.dismissedRelativeKeys.filter((item) => item !== key),
        updatedAt: new Date().toISOString(),
      });
    } catch (reason) {
      console.error(reason);
      setError("The household decision could not be saved. Please try again.");
    } finally {
      setSavingKey("");
    }
  };

  if (compact) {
    if (!summary.connections.length) {
      return <div className="household-compact empty-connection"><strong>No household connection found</strong><span>Staff can still review the family list in the applicant record.</span></div>;
    }
    return (
      <div className="household-compact">
        <div>
          <span>Household check</span>
          <strong>
            {summary.confirmedConnections.length
              ? `${summary.confirmedConnections.length} confirmed relative${summary.confirmedConnections.length === 1 ? "" : "s"}`
              : `${summary.possibleConnections.length} possible relative${summary.possibleConnections.length === 1 ? "" : "s"}`}
          </strong>
        </div>
        <div>
          <span>Confirmed household assistance</span>
          <strong>{formatPeso(summary.confirmedAssistance)}</strong>
        </div>
        <small>
          {summary.connections.slice(0, 3).map((connection) => applicantName(connection.applicant)).join(" · ")}
        </small>
      </div>
    );
  }

  return (
    <section className="household-section" aria-labelledby="household-connections-title">
      <div className="household-section-heading">
        <div>
          <span className="eyebrow">Household check</span>
          <h3 id="household-connections-title">Family & Related Applicants</h3>
          <p>Suggestions help staff review assistance history. They do not automatically prove a relationship.</p>
        </div>
        <div className="household-total">
          <span>Confirmed household assistance</span>
          <strong>{formatPeso(summary.confirmedAssistance)}</strong>
          <small>{summary.confirmedApplications} application{summary.confirmedApplications === 1 ? "" : "s"} · {summary.confirmedPeople} confirmed person{summary.confirmedPeople === 1 ? "" : "s"}</small>
        </div>
      </div>

      <div className="household-count-strip">
        <div><span>Recorded household size</span><strong>{record.householdMembers || "Not recorded"}</strong></div>
        <div><span>Names listed</span><strong>{record.familyComposition.length}</strong></div>
        <div><span>Possible relatives</span><strong>{summary.possibleConnections.length}</strong></div>
      </div>

      {record.familyComposition.length > 0 && (
        <details className="family-list-details">
          <summary>View {record.familyComposition.length} listed family member{record.familyComposition.length === 1 ? "" : "s"}</summary>
          <div className="family-list">
            {record.familyComposition.map((member, index) => (
              <div key={`${member.fullName}-${member.birthday}-${index}`}>
                <strong>{member.fullName}</strong>
                <span>{member.relationship || "Relationship not recorded"}{member.birthday ? ` · ${member.birthday}` : ""}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {error && <div className="notice error" role="alert">{error}</div>}
      {!summary.connections.length ? (
        <div className="household-no-match">
          <strong>No related applicant was found in the current records.</strong>
          <span>Add family-member names when available to improve future checks.</span>
        </div>
      ) : (
        <div className="household-connection-list">
          {summary.connections.map((connection) => (
            <article className={`household-connection ${connection.status}`} key={connection.key}>
              <div className="household-connection-person">
                <span>{connection.status === "confirmed" ? "Confirmed relative" : "Possible relative — verify"}</span>
                <strong>{applicantName(connection.applicant)}</strong>
                <small>{connection.applicant.birthday} · {connection.applicant.brgy || "No barangay"}</small>
              </div>
              <div className="household-connection-history">
                <span>Applicant assistance</span>
                <strong>{formatPeso(connection.history.totalGranted)}</strong>
                <small>{connection.history.applicationCount} application{connection.history.applicationCount === 1 ? "" : "s"}</small>
              </div>
              <div className="household-reasons">
                {connection.declaredRelationship && <span>{connection.declaredRelationship}</span>}
                {connection.reasons.map((reason) => <span key={reason}>{reason}</span>)}
              </div>
              <div className="household-actions">
                {onView && <button className="btn secondary small" type="button" onClick={() => onView(connection.applicant)}>View History</button>}
                {connection.status === "possible" && onUpdate && (
                  <>
                    <button className="btn small" type="button" disabled={Boolean(savingKey)} onClick={() => void updateConnection(connection.key, "confirm")}>
                      {savingKey === connection.key ? "Saving…" : "Confirm Relative"}
                    </button>
                    <button className="btn tertiary small" type="button" disabled={Boolean(savingKey)} onClick={() => void updateConnection(connection.key, "dismiss")}>Not Related</button>
                  </>
                )}
                {connection.status === "confirmed" && onUpdate && (
                  <button className="btn tertiary small" type="button" disabled={Boolean(savingKey)} onClick={() => void updateConnection(connection.key, "dismiss")}>Remove Link</button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function applicantName(record: AssistanceRecord): string {
  return `${record.surname}, ${record.firstName} ${record.middleName}`.replace(/\s+/g, " ").trim();
}
