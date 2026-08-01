"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdvancedFilters, { defaultRecordFilters, RecordFilters } from "@/components/AdvancedFilters";
import Dashboard from "@/components/Dashboard";
import DataTransfer from "@/components/DataTransfer";
import DistrictLogo from "@/components/DistrictLogo";
import DocumentScanner from "@/components/DocumentScanner";
import LocalRecordsMigration from "@/components/LocalRecordsMigration";
import RecordFormModal from "@/components/RecordFormModal";
import RecordTable from "@/components/RecordTable";
import StaffAuthGate from "@/components/StaffAuthGate";
import ViewRecordModal from "@/components/ViewRecordModal";
import { addRecord, deleteRecord, getRecord, getRecords, subscribeToRecordChanges, updateRecord } from "@/lib/recordStore";
import { applicantIdentityKey } from "@/lib/applicantIdentity";
import { getSupabaseClient } from "@/lib/supabase";
import { AssistanceRecord } from "@/lib/types";

type Workspace = "records" | "matching" | "reports" | "utilities";

const workspaces: Array<{ id: Workspace; label: string; shortLabel: string }> = [
  { id: "records", label: "Applicant Records", shortLabel: "Records" },
  { id: "matching", label: "Document Matching", shortLabel: "Match" },
  { id: "reports", label: "Reports", shortLabel: "Reports" },
  { id: "utilities", label: "Utilities", shortLabel: "Utilities" },
];

export default function Home() {
  return (
    <StaffAuthGate>
      {(session) => (
        <AssistanceApp
          sharedDatabase={Boolean(session)}
          staffEmail={session?.user.email || ""}
          testMode={Boolean(session?.user.is_anonymous)}
        />
      )}
    </StaffAuthGate>
  );
}

function AssistanceApp({ sharedDatabase, staffEmail, testMode }: { sharedDatabase: boolean; staffEmail: string; testMode: boolean }) {
  const [records, setRecords] = useState<AssistanceRecord[]>([]);
  const [workspace, setWorkspace] = useState<Workspace>("records");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AssistanceRecord | null>(null);
  const [selected, setSelected] = useState<AssistanceRecord | null>(null);
  const [filters, setFilters] = useState<RecordFilters>({ ...defaultRecordFilters });
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [recordPage, setRecordPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const recordTableRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      setRecords(await getRecords());
      setError("");
    } catch (reason) {
      console.error(reason);
      setError(sharedDatabase ? "The shared database could not be loaded." : "The local database could not be opened in this browser.");
    }
  }, [sharedDatabase]);

  useEffect(() => {
    let active = true;
    void getRecords()
      .then((savedRecords) => {
        if (!active) return;
        setRecords(savedRecords);
        setError("");
      })
      .catch((reason) => {
        console.error(reason);
        if (active) setError(sharedDatabase ? "The shared database could not be loaded." : "The local database could not be opened in this browser.");
      });
    return () => { active = false; };
  }, [sharedDatabase]);

  useEffect(() => {
    if (!sharedDatabase) return;
    return subscribeToRecordChanges(() => {
      void refresh();
    });
  }, [refresh, sharedDatabase]);

  const activeRecords = useMemo(() => records.filter((record) => !record.archivedAt), [records]);
  const archivedRecords = useMemo(() => records.filter((record) => Boolean(record.archivedAt)), [records]);
  const showArchived = filters.status === "archived";
  const visibleRecords = showArchived ? archivedRecords : activeRecords;

  const filtered = useMemo(() => {
    const globalQuery = searchTokens(query);
    const nameQuery = searchTokens(filters.name);
    const diagnosisQuery = searchTokens(filters.diagnosis);
    const matching = visibleRecords.filter((record) => {
      const legacySearch = record.legacyApplication ? Object.values(record.legacyApplication).join(" ") : "";
      const searchable = normalizeSearchText(Object.values(record)
        .filter((value) => typeof value !== "string" || !value.startsWith("data:image/"))
        .join(" ") + " " + legacySearch + " " + record.familyComposition.map((member) =>
        `${member.fullName} ${member.relationship} ${member.birthday}`).join(" "));
      const fullName = normalizeSearchText(`${record.surname} ${record.firstName} ${record.middleName} ${record.suffix}`);
      const diagnosis = normalizeSearchText(record.diagnosis);
      const createdDate = record.applicationDate || (record.createdAt ? record.createdAt.slice(0, 10) : "");

      return tokensMatch(globalQuery, searchable) &&
        tokensMatch(nameQuery, fullName) &&
        normalizedOptionMatches(filters.barangay, record.brgy) &&
        normalizedOptionMatches(filters.sex, record.sex) &&
        inNumberRange(Number(record.age), filters.minAge, filters.maxAge) &&
        normalizedOptionMatches(filters.category, record.category) &&
        normalizedOptionMatches(filters.assistanceType, record.assistanceType) &&
        tokensMatch(diagnosisQuery, diagnosis) &&
        (!filters.conditionCategory || record.conditionCategories.some((category) => normalizedOptionMatches(filters.conditionCategory, category))) &&
        normalizedOptionMatches(filters.employmentStatus, record.employedStatus) &&
        inNumberRange(record.salary, filters.minIncome, filters.maxIncome) &&
        inNumberRange(record.monthlyExpenses, filters.minExpenses, filters.maxExpenses) &&
        inNumberRange(record.amount, filters.minAmount, filters.maxAmount) &&
        (!filters.createdFrom || createdDate >= filters.createdFrom) &&
        (!filters.createdTo || createdDate <= filters.createdTo);
    });

    return matching.sort((first, second) => compareRecords(first, second, filters.sort));
  }, [filters, query, visibleRecords]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const firstVisibleRecord = filtered.length ? (recordPage - 1) * pageSize + 1 : 0;
  const lastVisibleRecord = Math.min(recordPage * pageSize, filtered.length);
  const pagedRecords = useMemo(
    () => filtered.slice((recordPage - 1) * pageSize, recordPage * pageSize),
    [filtered, pageSize, recordPage],
  );

  useEffect(() => {
    setRecordPage(1);
  }, [filters, query]);

  useEffect(() => {
    if (recordPage > pageCount) setRecordPage(pageCount);
  }, [pageCount, recordPage]);

  const changeRecordPage = (page: number) => {
    setRecordPage(Math.min(pageCount, Math.max(1, page)));
    recordTableRef.current?.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const visibleIds = new Set(filtered.flatMap((record) => record.id === undefined ? [] : [record.id]));
    setSelectedIds((current) => {
      const next = new Set(Array.from(current).filter((id) => visibleIds.has(id)));
      return next.size === current.size && Array.from(next).every((id) => current.has(id)) ? current : next;
    });
  }, [filtered]);

  const selectedApplications = useMemo(
    () => filtered.filter((record) => record.id !== undefined && selectedIds.has(record.id)),
    [filtered, selectedIds],
  );

  const save = async (record: AssistanceRecord) => {
    if (record.id === undefined) {
      await addRecord(record);
    } else {
      await updateRecord(record);
    }
    await refresh();
  };

  const openNewRecord = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const loadCompleteRecord = async (record: AssistanceRecord): Promise<AssistanceRecord | null> => {
    if (record.id === undefined || record.recordLoadState !== "summary") return record;
    try {
      return await getRecord(record.id);
    } catch (reason) {
      console.error(reason);
      setError("The complete application could not be loaded. Check the connection and try again.");
      return null;
    }
  };

  const openViewRecord = async (record: AssistanceRecord) => {
    const complete = await loadCompleteRecord(record);
    if (complete) setSelected(complete);
  };

  const openEditRecord = async (record: AssistanceRecord) => {
    const complete = await loadCompleteRecord(record);
    if (!complete) return;
    setEditing(complete);
    setFormOpen(true);
  };

  const archive = async (record: AssistanceRecord) => {
    if (record.id === undefined || !window.confirm(`Archive the record for ${record.firstName} ${record.surname}? It can be restored later.`)) return;
    await updateRecord({ ...record, archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await refresh();
  };

  const restore = async (record: AssistanceRecord) => {
    if (record.id === undefined || !window.confirm(`Restore the record for ${record.firstName} ${record.surname} to active records?`)) return;
    await updateRecord({ ...record, archivedAt: "", updatedAt: new Date().toISOString() });
    await refresh();
  };

  const permanentlyDelete = async (record: AssistanceRecord) => {
    if (record.id === undefined || !record.archivedAt) return;
    const response = window.prompt(
      `WARNING: Permanently deleting the archived application for ${record.firstName} ${record.surname} will remove it from applicant history, reports, and the shared database. This cannot be undone.\n\nType DELETE to continue.`,
    );
    if (response !== "DELETE") return;
    try {
      await deleteRecord(record.id);
      await refresh();
      setError("");
      window.alert("The archived application was permanently deleted.");
    } catch (reason) {
      console.error(reason);
      setError("The archived application could not be deleted. Please try again.");
    }
  };

  const toggleSelectedApplication = (record: AssistanceRecord) => {
    if (record.id === undefined) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(record.id as number)) next.delete(record.id as number);
      else next.add(record.id as number);
      return next;
    });
  };

  const toggleAllMatching = () => {
    const matchingIds = filtered.flatMap((record) => record.id === undefined ? [] : [record.id]);
    const everyMatchingRecordSelected = matchingIds.length > 0 && matchingIds.every((id) => selectedIds.has(id));
    setSelectedIds((current) => {
      const next = new Set(current);
      matchingIds.forEach((id) => everyMatchingRecordSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const toggleCurrentPage = () => {
    const pageIds = pagedRecords.flatMap((record) => record.id === undefined ? [] : [record.id]);
    const everyPageRecordSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((current) => {
      const next = new Set(current);
      pageIds.forEach((id) => everyPageRecordSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const bulkArchive = async () => {
    if (!selectedApplications.length ||
      !window.confirm(`Archive ${selectedApplications.length} selected application${selectedApplications.length === 1 ? "" : "s"}? They can be restored later.`)) return;
    try {
      const now = new Date().toISOString();
      await Promise.all(selectedApplications.map((record) => updateRecord({ ...record, archivedAt: now, updatedAt: now })));
      setSelectedIds(new Set());
      await refresh();
    } catch (reason) {
      console.error(reason);
      setError("The selected applications could not all be archived. Refresh and try again.");
    }
  };

  const bulkRestore = async () => {
    if (!selectedApplications.length ||
      !window.confirm(`Restore ${selectedApplications.length} selected application${selectedApplications.length === 1 ? "" : "s"} to active records?`)) return;
    try {
      const now = new Date().toISOString();
      await Promise.all(selectedApplications.map((record) => updateRecord({ ...record, archivedAt: "", updatedAt: now })));
      setSelectedIds(new Set());
      await refresh();
    } catch (reason) {
      console.error(reason);
      setError("The selected applications could not all be restored. Refresh and try again.");
    }
  };

  const bulkPermanentDelete = async () => {
    if (!selectedApplications.length) return;
    const response = window.prompt(
      `WARNING: Permanently deleting ${selectedApplications.length} archived application${selectedApplications.length === 1 ? "" : "s"} will remove them from history, reports, and the shared database. This cannot be undone.\n\nType DELETE to continue.`,
    );
    if (response !== "DELETE") return;
    try {
      await Promise.all(selectedApplications.flatMap((record) => record.id === undefined ? [] : [deleteRecord(record.id)]));
      setSelectedIds(new Set());
      await refresh();
      window.alert(`${selectedApplications.length} archived application${selectedApplications.length === 1 ? " was" : "s were"} permanently deleted.`);
    } catch (reason) {
      console.error(reason);
      setError("The selected applications could not all be deleted. Refresh to check which records remain.");
    }
  };

  const attachMatchedDocument = async (record: AssistanceRecord, imageData: string) => {
    if (record.id === undefined) return false;
    const complete = await loadCompleteRecord(record);
    if (!complete) return false;
    if (complete.idImage && !window.confirm(`Replace the document already attached to ${record.firstName} ${record.surname}?`)) return false;
    await updateRecord({ ...complete, idImage: imageData, updatedAt: new Date().toISOString() });
    await refresh();
    return true;
  };

  const saveHouseholdDecision = async (record: AssistanceRecord) => {
    const identityKey = applicantIdentityKey(record);
    const applicantRecords = identityKey
      ? records.filter((application) => applicantIdentityKey(application) === identityKey)
      : [record];
    await Promise.all(applicantRecords.map((application) => updateRecord({
      ...application,
      confirmedRelativeKeys: [...record.confirmedRelativeKeys],
      dismissedRelativeKeys: [...record.dismissedRelativeKeys],
      relativeLinks: record.relativeLinks.map((link) => ({ ...link })),
      updatedAt: record.updatedAt,
    })));
    setSelected(record);
    await refresh();
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="district-brand">
          <DistrictLogo priority />
          <div>
            <p className="district-kicker">Antipolo City · First District</p>
            <h1>First District Assistance Management System</h1>
            <p className="district-subtitle">Congressional District Office</p>
          </div>
        </div>
        <div className="header-actions">
          {sharedDatabase && (
            <div className="shared-status" title={staffEmail}>
              <span className="shared-status-dot" aria-hidden="true" />
              <span>{testMode ? "Shared test database" : "Shared database"}</span>
            </div>
          )}
          {sharedDatabase && !testMode && (
            <button className="btn tertiary staff-sign-out" type="button" onClick={() => void getSupabaseClient().auth.signOut()}>
              Sign out
            </button>
          )}
          <button className="btn header-action" onClick={openNewRecord}>+ New Application</button>
        </div>
      </header>

      <nav className="workspace-nav" aria-label="Main workspaces">
        {workspaces.map((item) => (
          <button
            className={`workspace-tab${workspace === item.id ? " active" : ""}`}
            type="button"
            key={item.id}
            onClick={() => setWorkspace(item.id)}
            aria-current={workspace === item.id ? "page" : undefined}
          >
            <span className="workspace-full-label">{item.label}</span>
            <span className="workspace-short-label">{item.shortLabel}</span>
          </button>
        ))}
      </nav>

      <div className="workspace-surface">
        {testMode && (
          <div className="test-mode-banner" role="status">
            <strong>Temporary shared testing mode</strong>
            <span>No login is required. Use dummy applicant information only—do not enter real personal data.</span>
          </div>
        )}
        {error && <div className="error" role="alert">{error}</div>}

        <div className="workspace-view" hidden={workspace !== "records"}>
            <section className="workspace-intro compact">
              <div>
                <span className="eyebrow">Records Desk</span>
                <h2>Find and manage applicants</h2>
                <p>Search first, then use advanced filters only when needed.</p>
              </div>
            </section>
            <div className="records-toolbar">
              <nav className="record-view-tabs" aria-label="Record views">
                <button className={`view-tab${!showArchived ? " active" : ""}`} onClick={() => { setFilters((current) => ({ ...current, status: "active" })); setQuery(""); }}>
                  Active <span>{activeRecords.length}</span>
                </button>
                <button className={`view-tab${showArchived ? " active" : ""}`} onClick={() => { setFilters((current) => ({ ...current, status: "archived" })); setQuery(""); }}>
                  Archived <span>{archivedRecords.length}</span>
                </button>
              </nav>
              <section className="search-section">
                <label className="sr-only" htmlFor="record-search">Search records</label>
                <input id="record-search" type="search" className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${showArchived ? "archived" : "active"} records by name, birthday, barangay, diagnosis, or remarks`} />
              </section>
              <AdvancedFilters filters={filters} records={records} matchingCount={filtered.length} onChange={setFilters} />
            </div>
            {showArchived && <div className="archive-info"><strong>Archived Records</strong><span>Restore an application, or permanently delete it when it should no longer be included in applicant history and reports.</span></div>}
            <div className="record-list-controls">
              <div className="record-results" role="status">
                <strong>{filtered.length.toLocaleString()}</strong> matching record{filtered.length === 1 ? "" : "s"}
                <span> · showing {firstVisibleRecord.toLocaleString()}–{lastVisibleRecord.toLocaleString()}</span>
              </div>
              <nav className="record-pagination compact" aria-label="Record pages above table">
                <button className="btn secondary small" type="button" disabled={recordPage === 1} onClick={() => changeRecordPage(recordPage - 1)}>Previous</button>
                <span>Page <strong>{recordPage}</strong> of <strong>{pageCount}</strong></span>
                <button className="btn secondary small" type="button" disabled={recordPage === pageCount} onClick={() => changeRecordPage(recordPage + 1)}>Next</button>
              </nav>
              <label className="page-size-control">
                <span>Rows</span>
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setRecordPage(1);
                    recordTableRef.current?.scrollTo({ top: 0 });
                  }}
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
            </div>
            <div className={`bulk-record-bar${selectedApplications.length ? " has-selection" : ""}`}>
              <button className="bulk-select-toggle" type="button" disabled={!filtered.length} onClick={toggleAllMatching}>
                {selectedApplications.length === filtered.length && filtered.length > 0 ? "Deselect all" : `Select all ${filtered.length || ""}`.trim()}
              </button>
              <span>
                {selectedApplications.length
                  ? `${selectedApplications.length} application${selectedApplications.length === 1 ? "" : "s"} selected`
                  : "Select applications to manage them together"}
              </span>
              {selectedApplications.length > 0 && (
                <div className="bulk-record-actions">
                  <button className="btn secondary small" type="button" onClick={() => setSelectedIds(new Set())}>Clear</button>
                  {!showArchived && <button className="btn warning small" type="button" onClick={() => void bulkArchive()}>Archive Selected</button>}
                  {showArchived && <button className="btn small" type="button" onClick={() => void bulkRestore()}>Restore Selected</button>}
                  {showArchived && <button className="btn danger small" type="button" onClick={() => void bulkPermanentDelete()}>Delete Selected Permanently</button>}
                </div>
              )}
            </div>
            <RecordTable
              records={pagedRecords}
              allRecords={records}
              archived={showArchived}
              onView={openViewRecord}
              onEdit={showArchived ? undefined : openEditRecord}
              onArchive={showArchived ? undefined : archive}
              onRestore={showArchived ? restore : undefined}
              onPermanentDelete={showArchived ? permanentlyDelete : undefined}
              selectedIds={selectedIds}
              onToggleSelected={toggleSelectedApplication}
              onToggleAll={toggleCurrentPage}
              containerRef={recordTableRef}
            />
            {filtered.length > pageSize && (
              <nav className="record-pagination" aria-label="Record pages">
                <button className="btn secondary small" type="button" disabled={recordPage === 1} onClick={() => changeRecordPage(recordPage - 1)}>Previous</button>
                <span>Page <strong>{recordPage}</strong> of <strong>{pageCount}</strong></span>
                <button className="btn secondary small" type="button" disabled={recordPage === pageCount} onClick={() => changeRecordPage(recordPage + 1)}>Next</button>
              </nav>
            )}
        </div>

        <div className="workspace-view" hidden={workspace !== "matching"}>
            <section className="workspace-intro compact">
              <div>
                <span className="eyebrow">Document Desk</span>
                <h2>Scan and match an existing applicant</h2>
                <p>OCR text and possible matches stay visible for staff review.</p>
              </div>
            </section>
            <DocumentScanner records={activeRecords} onView={openViewRecord} onAttachDocument={attachMatchedDocument} />
        </div>

        {workspace === "reports" && <div className="workspace-view">
            <section className="workspace-intro compact">
              <div>
                <span className="eyebrow">District Summary</span>
                <h2>Reports and statistics</h2>
                <p>Figures use the current record filters and contain no personally identifiable information.</p>
              </div>
            </section>
            <Dashboard records={filtered} onView={openViewRecord} />
        </div>}

        <div className="workspace-view" hidden={workspace !== "utilities"}>
            <section className="workspace-intro compact">
              <div>
                <span className="eyebrow">Supervisor Tools</span>
                <h2>Backup, transfer, and data maintenance</h2>
                <p>These occasional tasks are kept separate from daily encoding.</p>
              </div>
            </section>
            <div className="utility-stack">
              {sharedDatabase && <LocalRecordsMigration sharedRecords={records} onChanged={refresh} />}
              <DataTransfer records={records} onChanged={refresh} />
            </div>
        </div>
      </div>

      {formOpen && (
        <RecordFormModal
          key={editing?.id ?? "new-record"}
          open
          initialRecord={editing}
          existingRecords={records}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSave={save}
        />
      )}
      <ViewRecordModal
        record={selected}
        allRecords={records}
        onClose={() => setSelected(null)}
        onView={openViewRecord}
        onUpdate={saveHouseholdDecision}
      />
    </main>
  );
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-PH")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function searchTokens(value: string) {
  const normalized = normalizeSearchText(value);
  return normalized ? Array.from(new Set(normalized.split(" "))) : [];
}

function tokensMatch(tokens: string[], searchable: string) {
  return tokens.every((token) => searchable.includes(token));
}

function normalizedOptionMatches(filterValue: string, recordValue: string) {
  return !filterValue || normalizeSearchText(filterValue) === normalizeSearchText(recordValue);
}

function inNumberRange(value: number, minimum: string, maximum: string) {
  if (!Number.isFinite(value)) return !minimum && !maximum;
  return (!minimum || value >= Number(minimum)) && (!maximum || value <= Number(maximum));
}

function compareRecords(first: AssistanceRecord, second: AssistanceRecord, sort: RecordFilters["sort"]) {
  if (sort === "name") {
    return `${first.surname} ${first.firstName}`.localeCompare(`${second.surname} ${second.firstName}`);
  }
  if (sort === "amount-high") return second.amount - first.amount;
  if (sort === "amount-low") return first.amount - second.amount;
  const firstDate = Date.parse(first.applicationDate || first.createdAt) || 0;
  const secondDate = Date.parse(second.applicationDate || second.createdAt) || 0;
  return sort === "oldest" ? firstDate - secondDate : secondDate - firstDate;
}
