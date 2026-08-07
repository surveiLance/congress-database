import { Ref, useMemo } from "react";
import { applicantIdentityKey, buildApplicantHistories, formatPeso } from "@/lib/applicantIdentity";
import { householdSummaryForRecord } from "@/lib/householdMatching";
import { AssistanceRecord, recordPayoutDate } from "@/lib/types";
import type { RecordSort } from "@/components/AdvancedFilters";
import { formatAgencyCombination } from "@/lib/assistanceAgencies";

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
  completeContext?: boolean;
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
  completeContext = true,
}: Props) {
  const histories = useMemo(() => buildApplicantHistories(allRecords), [allRecords]);
  const selectableIds = records.flatMap((record) => record.id === undefined ? [] : [record.id]);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
  return (
    <div className="table-container record-table-container" ref={containerRef}>
      <table className="record-table">
        <colgroup>
          {onToggleSelected && <col className="record-selection-col" />}
          <col className="record-applicant-col" />
          <col className="record-application-col" />
          <col className="record-grant-col" />
          <col className="record-payout-col" />
          <col className="record-action-col" />
        </colgroup>
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
          <GroupedSortHeader
            label="Applicant"
            options={[
              { label: "Name", ascending: "name", descending: "name-desc" },
              { label: "Birthday", ascending: "birthday-oldest", descending: "birthday-newest" },
              { label: "Barangay", ascending: "barangay-asc", descending: "barangay-desc" },
            ]}
            sort={sort}
            onSort={onSort}
          />
          <GroupedSortHeader
            label="Application"
            options={[
              { label: "Date", ascending: "oldest", descending: "newest" },
              { label: "Type", ascending: "assistance-asc", descending: "assistance-desc" },
            ]}
            sort={sort}
            onSort={onSort}
          />
          <GroupedSortHeader
            label="Grant & history"
            options={[
              { label: "This grant", ascending: "amount-low", descending: "amount-high" },
              { label: "Total", ascending: "history-low", descending: "history-high" },
            ]}
            sort={sort}
            onSort={onSort}
          />
          <SortHeader label="Payout" sort={sort} ascending="payout-oldest" descending="payout-newest" onSort={onSort} />
          <th className="record-action-heading">Action</th>
        </tr></thead>
        <tbody>
          {!records.length && <tr><td colSpan={onToggleSelected ? 6 : 5} className="empty">No records found.</td></tr>}
          {records.map((record) => {
            const history = histories.get(applicantIdentityKey(record));
            const household = completeContext ? householdSummaryForRecord(record, allRecords, histories) : null;
            const historyCount = record.historyApplicationCount ?? history?.applicationCount ?? 1;
            const historyTotal = record.historyTotalGranted ?? history?.totalGranted ?? record.amount;
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
              <td className="record-applicant-cell">
                <strong>{record.surname}, {record.firstName} {record.middleName} {record.suffix}</strong>
                <span className="record-cell-meta"><span>{record.birthday} ({record.age} yrs)</span><span>{record.brgy}</span></span>
              </td>
              <td className="record-application-cell">
                <span className="record-application-date"><small>Application date</small><strong>{record.applicationDate || record.createdAt.slice(0, 10) || "—"}</strong></span>
                <span className="assistance-type-cell">
                  <strong>{record.assistanceType}</strong>
                  <small>{formatAgencyCombination(record.assistanceAgencies)}</small>
                </span>
              </td>
              <td className="record-grant-cell">
                <div className="record-grant-layout">
                  <div className="record-grant-current">
                    <span>This grant</span>
                    <strong>{formatPeso(record.amount)}</strong>
                  </div>
                  <div className={`history-summary${historyCount > 1 ? " returning" : ""}`}>
                    <span>Total assistance</span>
                    <strong>{formatPeso(historyTotal)}</strong>
                    <span>{historyCount} application{historyCount === 1 ? "" : "s"}</span>
                    {household && household.confirmedConnections.length > 0 && (
                      <span className="household-confirmed-mini">Household: {formatPeso(household.confirmedAssistance)}</span>
                    )}
                    {household && household.possibleConnections.length > 0 && (
                      <span className="household-possible-mini">{household.possibleConnections.length} family match{household.possibleConnections.length === 1 ? "" : "es"} to review</span>
                    )}
                  </div>
                </div>
              </td>
              <td className="record-payout-cell">
                {recordPayoutDate(record)
                  ? <span className="payout-status completed"><strong>{recordPayoutDate(record)}</strong><small>Payout done</small></span>
                  : <span className="payout-status pending"><strong>Pending</strong><small>No payout date</small></span>}
              </td>
              <td className="record-actions-cell">
                <div className="actions">
                  <button className="btn secondary small" onClick={() => onView(record)}>View History</button>
                  {!archived && onEdit && <button className="btn secondary small" onClick={() => onEdit(record)}>Edit</button>}
                  {!archived && onArchive && <button className="btn warning small" onClick={() => onArchive(record)}>Archive</button>}
                  {archived && onRestore && <button className="btn small" onClick={() => onRestore(record)}>Restore</button>}
                  {archived && onPermanentDelete && <button className="btn danger small" onClick={() => onPermanentDelete(record)}>Delete Permanently</button>}
                </div>
              </td>
            </tr>
          )})}
        </tbody>
      </table>
    </div>
  );
}

function GroupedSortHeader({
  label,
  options,
  sort,
  onSort,
}: {
  label: string;
  options: Array<{ label: string; ascending: RecordSort; descending: RecordSort }>;
  sort: RecordSort;
  onSort?: (sort: RecordSort) => void;
}) {
  return (
    <th className="record-group-heading">
      <span>{label}</span>
      <span className="record-group-sort-options">
        {options.map((option) => {
          const direction = sort === option.ascending ? "ascending" : sort === option.descending ? "descending" : "none";
          const nextSort = sort === option.ascending ? option.descending : option.ascending;
          return (
            <button
              className={direction !== "none" ? "active" : ""}
              type="button"
              onClick={() => onSort?.(nextSort)}
              aria-label={`Sort by ${option.label} ${direction === "ascending" ? "descending" : "ascending"}`}
              aria-pressed={direction !== "none"}
              key={option.label}
            >
              {option.label} <span aria-hidden="true">{direction === "ascending" ? "▲" : direction === "descending" ? "▼" : "↕"}</span>
            </button>
          );
        })}
      </span>
    </th>
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
