import { AssistanceRecord } from "@/lib/types";
import Image from "next/image";

export default function ViewRecordModal({ record, onClose }: { record: AssistanceRecord | null; onClose: () => void }) {
  if (!record) return null;
  const money = (value: number) => `₱${value.toLocaleString("en-US")}`;
  return (
    <div className="modal active" role="dialog" aria-modal="true" aria-labelledby="profile-title">
      <div className="modal-content">
        <div className="modal-header"><h2 id="profile-title">Applicant Full Record Profile</h2><button className="close" onClick={onClose} aria-label="Close">&times;</button></div>
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
          ["Work & Salary", `${record.work || "N/A"} (${money(record.salary)}/mo) - ${record.employedStatus}`],
          ["Household Employed", String(record.totalEmployed)],
          ["Monthly Expenses", money(record.monthlyExpenses)],
        ]} />
        <Details title="3. Assistance Granted" rows={[
          ["Assistance Type", record.assistanceType],
          ["Amount Requested", money(record.amountRequested)],
          ["Amount Granted", money(record.amount)],
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

function formatTimestamp(value?: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
