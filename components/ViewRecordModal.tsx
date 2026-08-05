import { AssistanceRecord, recordPayoutDate } from "@/lib/types";
import { formatPeso, historyForRecord } from "@/lib/applicantIdentity";
import Image from "next/image";
import HouseholdConnections from "./HouseholdConnections";
import { formatAgencyCombination } from "@/lib/assistanceAgencies";

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
  const historyAgencies = Array.from(new Set(applications.flatMap((application) => application.assistanceAgencies)));
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
        <section className="other-agency-history has-records" aria-label="Agencies in applicant history">
          <div>
            <span>Agencies in applicant history</span>
            <strong>{formatAgencyCombination(historyAgencies)}</strong>
          </div>
          <small>Combined from all recorded assistance for this applicant.</small>
        </section>
        <h3 className="section-title">Application History</h3>
        <div className="application-history-list">
          {applications.map((application, index) => (
            <button
              className={`application-history-item${application.id === record.id ? " selected" : ""}`}
              type="button"
              key={application.id ?? `${application.createdAt}-${index}`}
              onClick={() => onView?.(application)}
              aria-current={application.id === record.id ? "true" : undefined}
              title={application.id === record.id ? "Currently displayed application" : "Show this application's details"}
            >
              <div>
                <strong>{formatTimestamp(application.applicationDate || application.createdAt, true)}</strong>
                <span>{application.assistanceType || "Unspecified assistance"} · {formatAgencyCombination(application.assistanceAgencies)}</span>
              </div>
              <strong>{formatPeso(application.amount)}</strong>
              <span className={`history-status${application.archivedAt ? " archived" : ""}`}>
                {application.id === record.id ? "Selected" : application.archivedAt ? "Archived · View" : "View details →"}
              </span>
            </button>
          ))}
        </div>
        <p className="selected-application-label">Selected application</p>
        <section className="selected-application-summary" aria-label="Selected application summary">
          <div><span>Application date</span><strong>{formatTimestamp(record.applicationDate || record.createdAt, true)}</strong></div>
          <div><span>Payout</span><strong>{recordPayoutDate(record) ? formatTimestamp(recordPayoutDate(record), true) : "Awaiting payout date"}</strong></div>
          <div><span>Assistance</span><strong>{record.assistanceType || "Not recorded"}</strong></div>
          <div className="selected-grant"><span>Amount granted</span><strong>{formatPeso(record.amount)}</strong></div>
          <div><span>Beneficiary</span><strong>{record.benName || "Self / applicant"}</strong></div>
          <div className="selected-application-reason"><span>Diagnosis, purpose, or remarks</span><strong>{record.diagnosis || record.legacyApplication?.purpose || record.remarks || "Not recorded"}</strong></div>
        </section>
        <HouseholdConnections record={record} allRecords={allRecords} onView={onView} onUpdate={onUpdate} />
        <div className="record-detail-groups">
        <Details title="Applicant details" rows={[
          ["Full Name", `${record.surname}, ${record.firstName} ${record.middleName} ${record.suffix}`],
          ["Birthday / Age / Sex", `${record.birthday} (${record.age} yrs) / ${record.sex}`],
          ["Contact", record.contact],
          ["ID Number", record.idNumber || "Not recorded"],
          ["Address & Barangay", `${record.address}, Brgy. ${record.brgy}`],
          ["Civil Status & Category", `${record.civilStatus} | ${record.category}`],
          ["Application Date", formatTimestamp(record.applicationDate || record.createdAt, true)],
          ["Payout Date", recordPayoutDate(record) ? formatTimestamp(recordPayoutDate(record), true) : "Not yet recorded"],
          ["Created", formatTimestamp(record.createdAt)],
          ["Last Updated", formatTimestamp(record.updatedAt)],
          ...(record.archivedAt ? [["Archived", formatTimestamp(record.archivedAt)]] : []),
        ]} />
        <Details title="Employment & household" rows={[
          ["Work & Salary", `${record.work || "N/A"} (${formatPeso(record.salary)}/mo) - ${record.employedStatus}`],
          ["Total Household Members", record.householdMembers ? String(record.householdMembers) : "Not recorded"],
          ["Employed Household Members", String(record.totalEmployed)],
          ["Monthly Expenses", formatPeso(record.monthlyExpenses)],
        ]} />
        <Details title="Assistance details" rows={[
          ["Assistance Type", record.assistanceType],
          ["Amount Requested", formatPeso(record.amountRequested)],
          ["Amount Granted", formatPeso(record.amount)],
          ["Relation to Beneficiary", record.relationship || "Self"],
          ["Agencies for This Application", formatAgencyCombination(record.assistanceAgencies)],
          ...(record.otherAgencyRemarks ? [["Agency Notes", record.otherAgencyRemarks]] : []),
        ]} />
        <Details title="Beneficiary & medical details" rows={[
          ["Beneficiary Name", record.benName || "N/A"],
          ["Beneficiary Age/Sex", `${record.benAge ? `${record.benAge} yrs` : "N/A"} / ${record.benSex || "N/A"}`],
          ["Diagnosis/Problem", record.diagnosis || "None"],
          ["Condition Categories", record.conditionCategories.length ? record.conditionCategories.join(", ") : "Not categorized"],
          ...(record.conditionOther ? [["Other Condition", record.conditionOther]] : []),
          ["Remarks", record.remarks || "None"],
        ]} />
        {record.legacyApplication && (
          <Details title="Imported MAIP details" rows={[
            ["Source", `${record.legacyApplication.sourceFile || "MAIP workbook"} · row ${record.legacyApplication.sourceRow || "—"}`],
            ["Source of Fund", record.legacyApplication.sourceOfFund || "Not recorded"],
            ["Purpose", record.legacyApplication.purpose || "Not recorded"],
            ["Date Submitted", record.legacyApplication.dateSubmitted || "Not recorded"],
            ["Payout", [record.legacyApplication.payoutStatus, record.legacyApplication.payoutDate].filter(Boolean).join(" · ") || "Not recorded"],
            ["Repayroll", [record.legacyApplication.repayroll, record.legacyApplication.repayrollDate].filter(Boolean).join(" · ") || "Not recorded"],
            ["Mode / Admission", [record.legacyApplication.modeOfAssistance, record.legacyApplication.admissionMode].filter(Boolean).join(" · ") || "Not recorded"],
            ["Status / Release", [record.legacyApplication.status, record.legacyApplication.releaseDetails].filter(Boolean).join(" · ") || "Not recorded"],
            ["ID Presented", record.legacyApplication.idPresented || "Not recorded"],
          ]} />
        )}
        <details className="record-detail-section">
          <summary><span>Attached ID photos</span><small>{record.idImage || record.idImageBack ? `${Number(Boolean(record.idImage)) + Number(Boolean(record.idImageBack))} attached` : "None attached"}</small></summary>
          <div className="record-detail-content">
            {record.idImage || record.idImageBack ? (
              <div className="id-image-grid">
                {record.idImage && (
                  <figure>
                    <figcaption>ID Front</figcaption>
                    <Image unoptimized src={record.idImage} width={800} height={500} className="id-image-preview" alt="Front of attached ID" />
                  </figure>
                )}
                {record.idImageBack && (
                  <figure>
                    <figcaption>ID Back</figcaption>
                    <Image unoptimized src={record.idImageBack} width={800} height={500} className="id-image-preview" alt="Back of attached ID" />
                  </figure>
                )}
              </div>
            ) : <p className="muted">No ID photos attached for this record.</p>}
          </div>
        </details>
        </div>
        <div className="modal-footer"><button className="btn secondary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

function Details({ title, rows }: { title: string; rows: string[][] }) {
  return <details className="record-detail-section"><summary><span>{title}</span><small>{rows.length} fields</small></summary><div className="record-detail-content">{rows.map(([label, value]) => <div className="detail-row" key={label}><strong>{label}:</strong><span>{value}</span></div>)}</div></details>;
}

function formatTimestamp(value?: string, dateOnly = false) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateOnly ? date.toLocaleDateString() : date.toLocaleString();
}
