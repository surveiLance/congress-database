import { applicantIdentityKey, buildApplicantHistories, formatPeso } from "@/lib/applicantIdentity";
import { AssistanceRecord } from "@/lib/types";

interface Props {
  records: AssistanceRecord[];
  allRecords?: AssistanceRecord[];
  archived?: boolean;
  onView: (record: AssistanceRecord) => void;
  onEdit?: (record: AssistanceRecord) => void;
  onArchive?: (record: AssistanceRecord) => void;
  onRestore?: (record: AssistanceRecord) => void;
  onPermanentDelete?: (record: AssistanceRecord) => void;
}

export default function RecordTable({ records, allRecords = records, archived = false, onView, onEdit, onArchive, onRestore, onPermanentDelete }: Props) {
  const histories = buildApplicantHistories(allRecords);
  return (
    <div className="table-container">
      <table>
        <thead><tr><th>Full Name</th><th>Birthday / Age</th><th>Barangay</th><th>Assistance Type</th><th>This Grant</th><th>Applicant History</th><th>Action</th></tr></thead>
        <tbody>
          {!records.length && <tr><td colSpan={7} className="empty">No records found.</td></tr>}
          {records.map((record) => {
            const history = histories.get(applicantIdentityKey(record));
            return (
            <tr key={record.id}>
              <td><strong>{record.surname}, {record.firstName} {record.middleName} {record.suffix}</strong></td>
              <td>{record.birthday} ({record.age} yrs)</td>
              <td>{record.brgy}</td>
              <td>{record.assistanceType}</td>
              <td><strong>{formatPeso(record.amount)}</strong></td>
              <td>
                <div className={`history-summary${(history?.applicationCount || 0) > 1 ? " returning" : ""}`}>
                  <strong>{formatPeso(history?.totalGranted || record.amount)}</strong>
                  <span>{history?.applicationCount || 1} application{(history?.applicationCount || 1) === 1 ? "" : "s"} total</span>
                </div>
              </td>
              <td className="actions">
                <button className="btn secondary small" onClick={() => onView(record)}>View History</button>
                {!archived && onEdit && <button className="btn secondary small" onClick={() => onEdit(record)}>Edit</button>}
                {!archived && onArchive && <button className="btn warning small" onClick={() => onArchive(record)}>Archive</button>}
                {archived && onRestore && <button className="btn small" onClick={() => onRestore(record)}>Restore</button>}
                {archived && onPermanentDelete && <button className="btn danger small" onClick={() => onPermanentDelete(record)}>Delete Permanently</button>}
              </td>
            </tr>
          )})}
        </tbody>
      </table>
    </div>
  );
}
