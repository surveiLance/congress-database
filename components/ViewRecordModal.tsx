import { AssistanceRecord } from "@/lib/types";
import { formatPeso, historyForRecord } from "@/lib/applicantIdentity";
import Image from "next/image";
import HouseholdConnections from "./HouseholdConnections";

export default function ViewRecordModal({
  record,
  allRecords,
  onClose,
  onView,
  onUpdate,
}: {
  record: AssistanceRecord | null;
  allRecords: AssistanceRecord[];
  onClose: () => void;
  onView?: (record: AssistanceRecord) => void;
  onUpdate?: (record: AssistanceRecord) => Promise<void>;
}) {
  if (!record) return null;
  const history = historyForRecord(record, allRecords);
  const applications = history?.records || [record];
  return (
    <div className="modal active" role="dialog" aria-modal="true" aria-labelledby="profile-title">
      <div className="modal-content">
        <div className="modal-header"><h2 id="profile-title">Applicant Assistance History</h2><button className="close" onClick={onClose} aria-label="Close">&times;</button></div>
        <section className="applicant-lifetime-summary" aria-label="Applicant cumulative assistance">
          <div>
            <span>Applicant</span>
            <strong>{record.surname}, {record.firstName} {record.middleName}</strong>
            <small>{record.birthday}</small>
          </div>
          <div>
            <span>Total Applications</span>
            <strong>{history?.applicationCount || 1}</strong>
            <small>Matched by normalized name and birthday</small>
          </div>
          <div className="lifetime-total">
            <span>Total Assistance Granted</span>
            <strong>{formatPeso(history?.totalGranted || record.amount)}</strong>
            <small>Across all recorded applications</small>
          </div>
        </section>
        <HouseholdConnections record={record} allRecords={allRecords} onView={onView} onUpdate={onUpdate} />
        <h3 className="section-title">Application History</h3>
        <div className="application-history-list">
          {applications.map((application) => (
            <article className={`application-history-item${application.id === record.id ? " selected" : ""}`} key={application.id}>
              <div>
                <strong>{formatTimestamp(application.createdAt, true)}</strong>
                <span>{application.assistanceType || "Unspecified assistance"}</span>
              </div>
              <strong>{formatPeso(application.amount)}</strong>
              <span className={`history-status${application.archivedAt ? " archived" : ""}`}>
                {application.id === record.id ? "Selected" : application.archivedAt ? "Archived" : "Recorded"}
              </span>
            </article>
          ))}
        </div>
        <p className="selected-application-label">Selected application details</p>
        <Details title="1. Applicant Details" rows={[
          ["Full Name", `${record.surname}, ${record.firstName} ${record.middleName} ${record.suffix}`],
          ["Birthday / Age / Sex", `${record.birthday} (${record.age} yrs) / ${record.sex}`],
          ["Contact", record.contact],
          ["ID Number", record.idNumber || "Not recorded"],
          ["Address & Barangay", `${record.address}, Brgy. ${record.brgy}`],
          ["Civil Status & Category", `${record.civilStatus} | ${record.category}`],
          ["Created", formatTimestamp(record.createdAt)],
          ["Last Updated", formatTimestamp(record.updatedAt)],
          ...(record.archivedAt ? [["Archived", formatTimestamp(record.archivedAt)]] : []),
        ]} />
        <Details title="2. Employment & Expenses" rows={[
          ["Work & Salary", `${record.work || "N/A"} (${formatPeso(record.salary)}/mo) - ${record.employedStatus}`],
          ["Total Household Members", record.householdMembers ? String(record.householdMembers) : "Not recorded"],
          ["Employed Household Members", String(record.totalEmployed)],
          ["Monthly Expenses", formatPeso(record.monthlyExpenses)],
        ]} />
        <Details title="3. Assistance Granted" rows={[
          ["Assistance Type", record.assistanceType],
          ["Amount Requested", formatPeso(record.amountRequested)],
          ["Amount Granted", formatPeso(record.amount)],
          ["Relation to Beneficiary", record.relationship || "Self"],
        ]} />
        <Details title="4. Beneficiary Details" rows={[
          ["Beneficiary Name", record.benName || "N/A"],
          ["Beneficiary Age/Sex", `${record.benAge ? `${record.benAge} yrs` : "N/A"} / ${record.benSex || "N/A"}`],
          ["Diagnosis/Problem", record.diagnosis || "None"],
          ["Condition Categories", record.conditionCategories.length ? record.conditionCategories.join(", ") : "Not categorized"],
          ...(record.conditionOther ? [["Other Condition", record.conditionOther]] : []),
          ["Remarks", record.remarks || "None"],
        ]} />
        <h3 className="section-title">5. Attached ID Photo</h3>
        {record.idImage ? <Image unoptimized src={record.idImage} width={800} height={500} className="id-image-preview" alt="Attached valid ID" /> : <p className="muted">No ID attached for this record.</p>}
        <div className="modal-footer"><button className="btn secondary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

function Details({ title, rows }: { title: string; rows: string[][] }) {
  return <><h3 className="section-title">{title}</h3>{rows.map(([label, value]) => <div className="detail-row" key={label}><strong>{label}:</strong><span>{value}</span></div>)}</>;
}

function formatTimestamp(value?: string, dateOnly = false) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateOnly ? date.toLocaleDateString() : date.toLocaleString();
}
