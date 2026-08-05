import { Ref, useMemo } from "react";
import { applicantIdentityKey, buildApplicantHistories, formatPeso } from "@/lib/applicantIdentity";
import { householdSummaryForRecord } from "@/lib/householdMatching";
import { AssistanceRecord, recordPayoutDate } from "@/lib/types";
import type { RecordSort } from "@/components/AdvancedFilters";

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
  sort?: RecordSort;
  onSort?: (sort: RecordSort) => void;
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
  sort = "newest",
  onSort,
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
          <SortHeader label="Full Name" sort={sort} ascending="name" descending="name-desc" onSort={onSort} />
          <SortHeader label="Application Date" sort={sort} ascending="oldest" descending="newest" onSort={onSort} />
          <SortHeader label="Birthday / Age" sort={sort} ascending="birthday-oldest" descending="birthday-newest" onSort={onSort} />
          <SortHeader label="Barangay" sort={sort} ascending="barangay-asc" descending="barangay-desc" onSort={onSort} />
          <SortHeader label="Assistance Type" sort={sort} ascending="assistance-asc" descending="assistance-desc" onSort={onSort} />
          <SortHeader label="This Grant" sort={sort} ascending="amount-low" descending="amount-high" onSort={onSort} />
          <SortHeader label="Applicant History" sort={sort} ascending="history-low" descending="history-high" onSort={onSort} />
          <SortHeader label="Payout" sort={sort} ascending="payout-oldest" descending="payout-newest" onSort={onSort} />
          <th>Action</th>
        </tr></thead>
        <tbody>
          {!records.length && <tr><td colSpan={onToggleSelected ? 10 : 9} className="empty">No records found.</td></tr>}
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
              <td>
                {recordPayoutDate(record)
                  ? <span className="payout-status completed"><strong>{recordPayoutDate(record)}</strong><small>Payout done</small></span>
                  : <span className="payout-status pending"><strong>Pending</strong><small>No payout date</small></span>}
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

function SortHeader({
  label,
  sort,
  ascending,
  descending,
  onSort,
}: {
  label: string;
  sort: RecordSort;
  ascending: RecordSort;
  descending: RecordSort;
  onSort?: (sort: RecordSort) => void;
}) {
  const direction = sort === ascending ? "ascending" : sort === descending ? "descending" : "none";
  const nextSort = sort === ascending ? descending : ascending;
  return (
    <th aria-sort={direction}>
      <button className={`table-sort-button${direction !== "none" ? " active" : ""}`} type="button" onClick={() => onSort?.(nextSort)}>
        <span>{label}</span>
        <span className="table-sort-arrow" aria-hidden="true">{direction === "ascending" ? "▲" : direction === "descending" ? "▼" : "↕"}</span>
      </button>
    </th>
  );
}
