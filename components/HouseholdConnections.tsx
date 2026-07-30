"use client";

import { useMemo, useState } from "react";
import {
  applicantIdentityKey,
  buildApplicantHistories,
  formatPeso,
  normalizeIdentityPart,
} from "@/lib/applicantIdentity";
import {
  HouseholdConnection,
  householdSummaryForRecord,
} from "@/lib/householdMatching";
import { AssistanceRecord, RelativeLink } from "@/lib/types";

const relationshipOptions = [
  "Spouse", "Husband", "Wife", "Partner", "Father", "Mother", "Son", "Daughter",
  "Brother", "Sister", "Grandfather", "Grandmother", "Grandson", "Granddaughter",
  "Father-in-law", "Mother-in-law", "Son-in-law", "Daughter-in-law",
  "Brother-in-law", "Sister-in-law", "Uncle", "Aunt", "Nephew", "Niece",
  "Cousin", "Guardian", "Other relative",
];

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
  const [comparison, setComparison] = useState<HouseholdConnection | null>(null);
  const [relationship, setRelationship] = useState("");
  const [manualSearch, setManualSearch] = useState("");
  const summary = householdSummaryForRecord(record, allRecords);
  const nameOnlyConnections = summary.nameOnlyConnections;
  const primaryConnections = summary.connections.filter(
    (connection) => connection.status !== "possible" || connection.evidenceTier !== "name-only",
  );

  const manualResults = useMemo(() => {
    const query = normalizeIdentityPart(manualSearch);
    if (query.length < 2) return [];
    const currentKey = applicantIdentityKey(record);
    return Array.from(buildApplicantHistories(allRecords).values())
      .filter((history) => history.key !== currentKey)
      .filter((history) => {
        const applicant = history.latestApplication;
        return [
          applicantName(applicant),
          applicant.contact,
          applicant.idNumber,
          applicant.birthday,
          applicant.address,
          applicant.brgy,
          applicant.legacyApplication?.idPresented || "",
        ].some((value) => normalizeIdentityPart(value).includes(query));
      })
      .slice(0, 6)
      .map((history): HouseholdConnection => ({
        key: history.key,
        applicant: history.latestApplication,
        history,
        status: record.confirmedRelativeKeys.includes(history.key)
          ? "confirmed"
          : record.relativeLinks.some((link) => link.key === history.key)
            ? "related"
            : "possible",
        evidenceTier: "possible",
        score: 0,
        reasons: ["Found by staff search"],
        declaredRelationship: record.relativeLinks.find((link) => link.key === history.key)?.relationship || "",
      }));
  }, [allRecords, manualSearch, record]);

  const updateConnection = async (
    connection: HouseholdConnection,
    decision: "same-household" | "different-household" | "dismiss",
  ) => {
    if (!onUpdate) return;
    if (decision !== "dismiss" && !relationship) {
      setError("Select the person’s relationship before saving.");
      return;
    }
    const key = connection.key;
    setSavingKey(key);
    setError("");
    try {
      const nextLinks = record.relativeLinks.filter((link) => link.key !== key);
      if (decision !== "dismiss") {
        const link: RelativeLink = {
          key,
          relationship,
          householdStatus: decision,
          confirmedAt: new Date().toISOString(),
        };
        nextLinks.push(link);
      }
      await onUpdate({
        ...record,
        confirmedRelativeKeys: decision === "same-household"
          ? Array.from(new Set([...record.confirmedRelativeKeys, key]))
          : record.confirmedRelativeKeys.filter((item) => item !== key),
        dismissedRelativeKeys: decision === "dismiss"
          ? Array.from(new Set([...record.dismissedRelativeKeys, key]))
          : record.dismissedRelativeKeys.filter((item) => item !== key),
        relativeLinks: nextLinks,
        updatedAt: new Date().toISOString(),
      });
      setComparison(null);
      setRelationship("");
    } catch (reason) {
      console.error(reason);
      setError("The relationship decision could not be saved. Please try again.");
    } finally {
      setSavingKey("");
    }
  };

  const openComparison = (connection: HouseholdConnection) => {
    setComparison(connection);
    setRelationship(connection.declaredRelationship || "");
    setError("");
  };

  if (compact) {
    if (!summary.connections.length) {
      return <div className="household-compact empty-connection"><strong>No household connection found</strong><span>Staff can still search for a relative in the applicant record.</span></div>;
    }
    return (
      <div className="household-compact">
        <div>
          <span>Household check</span>
          <strong>
            {summary.confirmedConnections.length
              ? `${summary.confirmedConnections.length} confirmed household member${summary.confirmedConnections.length === 1 ? "" : "s"}`
              : `${summary.possibleConnections.length} suggestion${summary.possibleConnections.length === 1 ? "" : "s"} to review`}
          </strong>
        </div>
        <div>
          <span>Confirmed household assistance</span>
          <strong>{formatPeso(summary.confirmedAssistance)}</strong>
        </div>
        <small>{summary.connections.slice(0, 3).map((connection) => applicantName(connection.applicant)).join(" · ")}</small>
      </div>
    );
  }

  return (
    <section className="household-section" aria-labelledby="household-connections-title">
      <div className="household-section-heading">
        <div>
          <span className="eyebrow">Household check</span>
          <h3 id="household-connections-title">Family & Related Applicants</h3>
          <p>Compare supporting details before deciding. Name patterns are clues only and never confirm a relationship automatically.</p>
        </div>
        <div className="household-total">
          <span>Confirmed same-household assistance</span>
          <strong>{formatPeso(summary.confirmedAssistance)}</strong>
          <small>{summary.confirmedApplications} application{summary.confirmedApplications === 1 ? "" : "s"} · {summary.confirmedPeople} confirmed person{summary.confirmedPeople === 1 ? "" : "s"}</small>
        </div>
      </div>

      <div className="household-count-strip">
        <div><span>Recorded household size</span><strong>{record.householdMembers || "Not recorded"}</strong></div>
        <div><span>Names listed</span><strong>{record.familyComposition.length}</strong></div>
        <div><span>Needs staff review</span><strong>{summary.possibleConnections.length}</strong></div>
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

      <div className="relative-search">
        <div>
          <strong>Find a family member manually</strong>
          <span>Search by name, contact, National ID, birthday, or specific address.</span>
        </div>
        <input
          value={manualSearch}
          onChange={(event) => setManualSearch(event.target.value)}
          placeholder="Type at least 2 characters"
          aria-label="Find a family member"
        />
        {manualResults.length > 0 && (
          <div className="relative-search-results">
            {manualResults.map((connection) => (
              <button type="button" key={connection.key} onClick={() => openComparison(connection)}>
                <span><strong>{applicantName(connection.applicant)}</strong><small>{connection.applicant.birthday} · {connection.applicant.brgy || "No barangay"}</small></span>
                <span>Compare</span>
              </button>
            ))}
          </div>
        )}
        {manualSearch.trim().length >= 2 && !manualResults.length && <small>No applicant found for this search.</small>}
      </div>

      {error && <div className="notice error" role="alert">{error}</div>}

      {primaryConnections.length > 0 && (
        <div className="household-connection-list">
          {primaryConnections.map((connection) => (
            <ConnectionCard
              connection={connection}
              key={connection.key}
              saving={savingKey === connection.key}
              onCompare={() => openComparison(connection)}
              onView={onView}
              onRemove={() => void updateConnection(connection, "dismiss")}
              canUpdate={Boolean(onUpdate)}
            />
          ))}
        </div>
      )}

      {nameOnlyConnections.length > 0 && (
        <details className="name-pattern-details">
          <summary>
            {nameOnlyConnections.length} name-pattern match{nameOnlyConnections.length === 1 ? "" : "es"} — compare only if needed
          </summary>
          <p>These suggestions do not have supporting household details. A surname or middle-name pattern by itself is not proof.</p>
          <div className="household-connection-list">
            {nameOnlyConnections.map((connection) => (
              <ConnectionCard
                connection={connection}
                key={connection.key}
                saving={savingKey === connection.key}
                onCompare={() => openComparison(connection)}
                onView={onView}
                onRemove={() => void updateConnection(connection, "dismiss")}
                canUpdate={Boolean(onUpdate)}
              />
            ))}
          </div>
        </details>
      )}

      {!summary.connections.length && (
        <div className="household-no-match">
          <strong>No suggested relative was found.</strong>
          <span>Use the manual search above if the family member uses a different name or address.</span>
        </div>
      )}

      {comparison && (
        <ComparisonPanel
          current={record}
          connection={comparison}
          relationship={relationship}
          saving={savingKey === comparison.key}
          onRelationship={setRelationship}
          onClose={() => { setComparison(null); setRelationship(""); setError(""); }}
          onDecision={(decision) => void updateConnection(comparison, decision)}
        />
      )}
    </section>
  );
}

function ConnectionCard({
  connection,
  saving,
  onCompare,
  onView,
  onRemove,
  canUpdate,
}: {
  connection: HouseholdConnection;
  saving: boolean;
  onCompare: () => void;
  onView?: (record: AssistanceRecord) => void;
  onRemove: () => void;
  canUpdate: boolean;
}) {
  const label = connection.status === "confirmed"
    ? "Confirmed same household"
    : connection.status === "related"
      ? "Related · different household"
      : connection.evidenceTier === "name-only"
        ? "Name pattern only"
        : "Possible relative · compare";
  return (
    <article className={`household-connection ${connection.status} ${connection.evidenceTier}`}>
      <div className="household-connection-person">
        <span>{label}</span>
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
        <button className="btn small" type="button" onClick={onCompare}>Compare Details</button>
        {connection.status !== "possible" && canUpdate && (
          <button className="btn tertiary small" type="button" disabled={saving} onClick={onRemove}>
            {saving ? "Saving…" : "Remove Link"}
          </button>
        )}
      </div>
    </article>
  );
}

function ComparisonPanel({
  current,
  connection,
  relationship,
  saving,
  onRelationship,
  onClose,
  onDecision,
}: {
  current: AssistanceRecord;
  connection: HouseholdConnection;
  relationship: string;
  saving: boolean;
  onRelationship: (value: string) => void;
  onClose: () => void;
  onDecision: (decision: "same-household" | "different-household" | "dismiss") => void;
}) {
  const candidate = connection.applicant;
  const rows = [
    ["Full name", applicantName(current), applicantName(candidate), false],
    ["Birthday", current.birthday || "Not recorded", candidate.birthday || "Not recorded", exact(current.birthday, candidate.birthday)],
    ["Sex", current.sex || "Not recorded", candidate.sex || "Not recorded", exact(current.sex, candidate.sex)],
    ["Address", addressLabel(current), addressLabel(candidate), exact(current.address, candidate.address)],
    ["Barangay", current.brgy || "Not recorded", candidate.brgy || "Not recorded", exact(current.brgy, candidate.brgy)],
    ["Contact", current.contact || "Not recorded", candidate.contact || "Not recorded", exactDigits(current.contact, candidate.contact)],
    ["National / ID no.", idLabel(current), idLabel(candidate), exact(current.idNumber, candidate.idNumber)],
    ["Beneficiary", beneficiaryLabel(current), beneficiaryLabel(candidate), exact(current.benName, candidate.benName)],
  ] as const;
  return (
    <div className="relative-compare-backdrop" role="dialog" aria-modal="true" aria-labelledby="relative-compare-title">
      <div className="relative-compare-panel">
        <div className="relative-compare-heading">
          <div><span className="eyebrow">Staff verification</span><h3 id="relative-compare-title">Compare Applicant Details</h3></div>
          <button className="close" type="button" onClick={onClose} aria-label="Close comparison">&times;</button>
        </div>
        <p className="relative-compare-guidance">Matching cells are highlighted, but staff must verify the relationship. Different addresses can still belong to relatives living separately.</p>
        <div className="relative-compare-table">
          <div className="compare-header"><span>Detail</span><strong>Current applicant</strong><strong>Possible relative</strong></div>
          {rows.map(([label, currentValue, candidateValue, matches]) => (
            <div className={matches ? "matches" : ""} key={label}>
              <span>{label}</span><strong>{currentValue}</strong><strong>{candidateValue}</strong>
            </div>
          ))}
          <div>
            <span>Assistance history</span>
            <strong>Current record</strong>
            <strong>{connection.history.applicationCount} application{connection.history.applicationCount === 1 ? "" : "s"} · {formatPeso(connection.history.totalGranted)}</strong>
          </div>
        </div>
        <label className="relative-relationship">
          <span>Relationship <b aria-hidden="true">*</b></span>
          <select value={relationship} onChange={(event) => onRelationship(event.target.value)}>
            <option value="">Select relationship</option>
            {relationshipOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <div className="relative-decision-help">
          <span><strong>Same household</strong> counts the relative’s assistance in the household total.</span>
          <span><strong>Different household</strong> records the family link without adding their assistance to this household total.</span>
        </div>
        <div className="relative-compare-actions">
          <button className="btn secondary" type="button" onClick={onClose}>Review Later</button>
          <button className="btn tertiary danger-text" type="button" disabled={saving} onClick={() => onDecision("dismiss")}>Not Related</button>
          <button className="btn secondary" type="button" disabled={saving || !relationship} onClick={() => onDecision("different-household")}>Related, Different Household</button>
          <button className="btn" type="button" disabled={saving || !relationship} onClick={() => onDecision("same-household")}>
            {saving ? "Saving…" : "Confirm Same Household"}
          </button>
        </div>
      </div>
    </div>
  );
}

function applicantName(record: AssistanceRecord): string {
  return `${record.surname}, ${record.firstName} ${record.middleName}`.replace(/\s+/g, " ").trim();
}

function addressLabel(record: AssistanceRecord): string {
  return [record.address, record.brgy].filter(Boolean).join(" · ") || "Not recorded";
}

function idLabel(record: AssistanceRecord): string {
  return record.idNumber || record.legacyApplication?.idPresented || "Not recorded";
}

function beneficiaryLabel(record: AssistanceRecord): string {
  const name = record.benName || "Not recorded";
  return record.relationship ? `${name} · ${record.relationship}` : name;
}

function exact(first: string, second: string): boolean {
  const a = normalizeIdentityPart(first);
  const b = normalizeIdentityPart(second);
  return Boolean(a && b && a === b);
}

function exactDigits(first: string, second: string): boolean {
  const a = String(first || "").replace(/\D/g, "");
  const b = String(second || "").replace(/\D/g, "");
  return Boolean(a.length >= 7 && b.length >= 7 && a.slice(-10) === b.slice(-10));
}
