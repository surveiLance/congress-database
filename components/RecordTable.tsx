import { Ref, useMemo } from "react";
import { applicantIdentityKey, buildApplicantHistories, formatPeso } from "@/lib/applicantIdentity";
import { householdSummaryForRecord } from "@/lib/householdMatching";
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
  selectedIds?: Set<number>;
  onToggleSelected?: (record: AssistanceRecord) => void;
  onToggleAll?: () => void;
  containerRef?: Ref<HTMLDivElement>;
}

export default function RecordTable({
  records,
  allRecords = records,
  archived = false,
  onView,
  onEdit,
  onArchive,
  onRestore,
  onPermanentDelete,
  selectedIds = new Set<number>(),
  onToggleSelected,
  onToggleAll,
  containerRef,
}: Props) {
  const histories = useMemo(() => buildApplicantHistories(allRecords), [allRecords]);
  const selectableIds = records.flatMap((record) => record.id === undefined ? [] : [record.id]);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
  return (
    <div className="table-container record-table-container" ref={containerRef}>
      <table>
        <thead><tr>
          {onToggleSelected && (
            <th className="selection-column">
              <input
                type="checkbox"
                checked={allSelected}
                disabled={!selectableIds.length}
                onChange={onToggleAll}
                aria-label={allSelected ? "Deselect all matching applications" : "Select all matching applications"}
              />
            </th>
          )}
          <th>Full Name</th><th>Application Date</th><th>Birthday / Age</th><th>Barangay</th><th>Assistance Type</th><th>This Grant</th><th>Applicant History</th><th>Action</th>
        </tr></thead>
        <tbody>
          {!records.length && <tr><td colSpan={onToggleSelected ? 9 : 8} className="empty">No records found.</td></tr>}
          {records.map((record) => {
            const history = histories.get(applicantIdentityKey(record));
            const household = householdSummaryForRecord(record, allRecords, histories);
            const selected = record.id !== undefined && selectedIds.has(record.id);
            return (
            <tr className={selected ? "selected-record-row" : ""} key={record.id}>
              {onToggleSelected && (
                <td className="selection-column">
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={record.id === undefined}
                    onChange={() => onToggleSelected(record)}
                    aria-label={`Select application for ${record.firstName} ${record.surname}`}
                  />
                </td>
              )}
              <td><strong>{record.surname}, {record.firstName} {record.middleName} {record.suffix}</strong></td>
              <td>{record.applicationDate || record.createdAt.slice(0, 10) || "—"}</td>
              <td>{record.birthday} ({record.age} yrs)</td>
              <td>{record.brgy}</td>
              <td>{record.assistanceType}</td>
              <td><strong>{formatPeso(record.amount)}</strong></td>
              <td>
                <div className={`history-summary${(history?.applicationCount || 0) > 1 ? " returning" : ""}`}>
                  <strong>{formatPeso(history?.totalGranted || record.amount)}</strong>
                  <span>{history?.applicationCount || 1} application{(history?.applicationCount || 1) === 1 ? "" : "s"} total</span>
                  {household.confirmedConnections.length > 0 && (
                    <span className="household-confirmed-mini">Household: {formatPeso(household.confirmedAssistance)}</span>
                  )}
                  {household.possibleConnections.length > 0 && (
                    <span className="household-possible-mini">{household.possibleConnections.length} family match{household.possibleConnections.length === 1 ? "" : "es"} to review</span>
                  )}
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
