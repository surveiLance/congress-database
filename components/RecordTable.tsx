import { AssistanceRecord } from "@/lib/types";

interface Props {
  records: AssistanceRecord[];
  archived?: boolean;
  onView: (record: AssistanceRecord) => void;
  onEdit?: (record: AssistanceRecord) => void;
  onArchive?: (record: AssistanceRecord) => void;
  onRestore?: (record: AssistanceRecord) => void;
  onPermanentDelete?: (record: AssistanceRecord) => void;
}

export default function RecordTable({ records, archived = false, onView, onEdit, onArchive, onRestore, onPermanentDelete }: Props) {
  return (
    <div className="table-container">
      <table>
        <thead><tr><th>Full Name</th><th>Birthday / Age</th><th>Barangay</th><th>Category</th><th>Assistance Type</th><th>Amount Granted</th><th>Action</th></tr></thead>
        <tbody>
          {!records.length && <tr><td colSpan={7} className="empty">No records found.</td></tr>}
          {records.map((record) => (
            <tr key={record.id}>
              <td><strong>{record.surname}, {record.firstName} {record.middleName} {record.suffix}</strong></td>
              <td>{record.birthday} ({record.age} yrs)</td>
              <td>{record.brgy}</td>
              <td><span className="badge">{record.category}</span></td>
              <td>{record.assistanceType}</td>
              <td>₱{record.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
              <td className="actions">
                <button className="btn secondary small" onClick={() => onView(record)}>🔍 View Details</button>
                {!archived && onEdit && <button className="btn secondary small" onClick={() => onEdit(record)}>Edit</button>}
                {!archived && onArchive && <button className="btn warning small" onClick={() => onArchive(record)}>Archive</button>}
                {archived && onRestore && <button className="btn small" onClick={() => onRestore(record)}>Restore</button>}
                {archived && onPermanentDelete && <button className="btn danger small" onClick={() => onPermanentDelete(record)}>Permanent Delete (Dev)</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
