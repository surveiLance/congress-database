"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import AdvancedFilters, { defaultRecordFilters, RecordFilters } from "@/components/AdvancedFilters";
import DistrictLogo from "@/components/DistrictLogo";
import RecordTable from "@/components/RecordTable";
import StaffAuthGate from "@/components/StaffAuthGate";
import { addRecord, deleteRecord, findExistingApplicantRecords, getApplicantContext, getRecord, getRecordPage, getRecords, RecordFilterOptions, subscribeToRecordChanges, updateRecord } from "@/lib/recordStore";
import { getSupabaseClient } from "@/lib/supabase";
import { AssistanceRecord } from "@/lib/types";

const Dashboard = dynamic(() => import("@/components/Dashboard"), {
  loading: () => <WorkspaceLoading label="Opening district reports…" />,
});
const DataTransfer = dynamic(() => import("@/components/DataTransfer"), {
  loading: () => <WorkspaceLoading label="Opening data transfer tools…" />,
});
const DocumentScanner = dynamic(() => import("@/components/DocumentScanner"), {
  loading: () => <WorkspaceLoading label="Opening document matching…" />,
});
const LocalRecordsMigration = dynamic(() => import("@/components/LocalRecordsMigration"));
const RecordFormModal = dynamic(() => import("@/components/RecordFormModal"));
const ViewRecordModal = dynamic(() => import("@/components/ViewRecordModal"));

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
  const [supportRecords, setSupportRecords] = useState<AssistanceRecord[] | null>(null);
  const [recordTotal, setRecordTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [archivedCount, setArchivedCount] = useState(0);
  const [filterOptions, setFilterOptions] = useState<RecordFilterOptions>({ barangays: [], assistanceTypes: [], sexes: [], categories: [], employmentStatuses: [] });
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [fastRecordPaging, setFastRecordPaging] = useState(true);
  const [reportRefreshKey, setReportRefreshKey] = useState(0);
  const [workspace, setWorkspace] = useState<Workspace>("records");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AssistanceRecord | null>(null);
  const [selected, setSelected] = useState<AssistanceRecord | null>(null);
  const [selectedContextRecords, setSelectedContextRecords] = useState<AssistanceRecord[]>([]);
  const [filters, setFilters] = useState<RecordFilters>({ ...defaultRecordFilters });
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [recordPage, setRecordPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const recordTableRef = useRef<HTMLDivElement>(null);
  const supportLoadPromise = useRef<Promise<AssistanceRecord[]> | null>(null);

  const refresh = useCallback(async () => {
    setRecordsLoading(true);
    try {
      const result = await getRecordPage({ query, filters, page: recordPage, pageSize });
      setRecords(result.records);
      setRecordTotal(result.total);
      setActiveCount(result.activeCount);
      setArchivedCount(result.archivedCount);
      setFilterOptions(result.filterOptions);
      setFastRecordPaging(result.fastPath);
      setError("");
    } catch (reason) {
      console.error(reason);
      setError(sharedDatabase ? "The shared database could not be loaded." : "The local database could not be opened in this browser.");
    } finally {
      setRecordsLoading(false);
    }
  }, [filters, pageSize, query, recordPage, sharedDatabase]);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), query || filters.name || filters.diagnosis ? 250 : 0);
    return () => clearTimeout(timer);
  }, [refresh, query, filters.name, filters.diagnosis]);

  useEffect(() => {
    if (!sharedDatabase) return;
    return subscribeToRecordChanges(() => {
      setSupportRecords(null);
      supportLoadPromise.current = null;
      setReportRefreshKey((value) => value + 1);
      void refresh();
    });
  }, [refresh, sharedDatabase]);

  const showArchived = filters.status === "archived";
  const pageCount = Math.max(1, Math.ceil(recordTotal / pageSize));
  const firstVisibleRecord = recordTotal ? (recordPage - 1) * pageSize + 1 : 0;
  const lastVisibleRecord = Math.min(recordPage * pageSize, recordTotal);

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
    const visibleIds = new Set(records.flatMap((record) => record.id === undefined ? [] : [record.id]));
    setSelectedIds((current) => {
      const next = new Set(Array.from(current).filter((id) => visibleIds.has(id)));
      return next.size === current.size && Array.from(next).every((id) => current.has(id)) ? current : next;
    });
  }, [records]);

  const selectedApplications = useMemo(
    () => records.filter((record) => record.id !== undefined && selectedIds.has(record.id)),
    [records, selectedIds],
  );

  const ensureSupportRecords = useCallback(async () => {
    if (supportRecords) return supportRecords;
    if (supportLoadPromise.current) return supportLoadPromise.current;
    const request = getRecords()
      .then((savedRecords) => {
        setSupportRecords(savedRecords);
        return savedRecords;
      })
      .finally(() => {
        supportLoadPromise.current = null;
      });
    supportLoadPromise.current = request;
    return request;
  }, [supportRecords]);

  const refreshAfterChange = useCallback(async () => {
    setSupportRecords(null);
    supportLoadPromise.current = null;
    setReportRefreshKey((value) => value + 1);
    await refresh();
  }, [refresh]);

  const save = async (record: AssistanceRecord) => {
    if (record.id === undefined) {
      await addRecord(record);
    } else {
      await updateRecord(record);
    }
    await refreshAfterChange();
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
    try {
      const [complete, context] = await Promise.all([loadCompleteRecord(record), getApplicantContext(record)]);
      if (complete) {
        setSelectedContextRecords(context);
        setSelected(complete);
      }
    } catch (reason) {
      console.error(reason);
      setError("Applicant history could not be loaded. Check the connection and try again.");
    }
  };

  const openEditRecord = async (record: AssistanceRecord) => {
    try {
      const complete = await loadCompleteRecord(record);
      if (!complete) return;
      setEditing(complete);
      setFormOpen(true);
    } catch (reason) {
      console.error(reason);
      setError("The application could not be prepared for editing. Check the connection and try again.");
    }
  };

  const archive = async (record: AssistanceRecord) => {
    if (record.id === undefined || !window.confirm(`Archive the record for ${record.firstName} ${record.surname}? It can be restored later.`)) return;
    await updateRecord({ ...record, archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await refreshAfterChange();
  };

  const restore = async (record: AssistanceRecord) => {
    if (record.id === undefined || !window.confirm(`Restore the record for ${record.firstName} ${record.surname} to active records?`)) return;
    await updateRecord({ ...record, archivedAt: "", updatedAt: new Date().toISOString() });
    await refreshAfterChange();
  };

  const permanentlyDelete = async (record: AssistanceRecord) => {
    if (record.id === undefined || !record.archivedAt) return;
    const response = window.prompt(
      `WARNING: Permanently deleting the archived application for ${record.firstName} ${record.surname} will remove it from applicant history, reports, and the shared database. This cannot be undone.\n\nType DELETE to continue.`,
    );
    if (response !== "DELETE") return;
    try {
      await deleteRecord(record.id);
      await refreshAfterChange();
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
    const matchingIds = records.flatMap((record) => record.id === undefined ? [] : [record.id]);
    const everyMatchingRecordSelected = matchingIds.length > 0 && matchingIds.every((id) => selectedIds.has(id));
    setSelectedIds((current) => {
      const next = new Set(current);
      matchingIds.forEach((id) => everyMatchingRecordSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const toggleCurrentPage = () => {
    const pageIds = records.flatMap((record) => record.id === undefined ? [] : [record.id]);
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
      await refreshAfterChange();
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
      await refreshAfterChange();
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
      await refreshAfterChange();
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
    await refreshAfterChange();
    return true;
  };

  const saveHouseholdDecision = async (record: AssistanceRecord) => {
    const applicantRecords = await findExistingApplicantRecords(record.surname, record.firstName, record.birthday);
    await Promise.all(applicantRecords.map((application) => updateRecord({
      ...application,
      confirmedRelativeKeys: [...record.confirmedRelativeKeys],
      dismissedRelativeKeys: [...record.dismissedRelativeKeys],
      relativeLinks: record.relativeLinks.map((link) => ({ ...link })),
      updatedAt: record.updatedAt,
    })));
    await refreshAfterChange();
    const [complete, context] = await Promise.all([
      record.id === undefined ? Promise.resolve(record) : getRecord(record.id),
      getApplicantContext(record),
    ]);
    setSelectedContextRecords(context);
    setSelected(complete);
  };

  const changeWorkspace = (nextWorkspace: Workspace) => {
    setWorkspace(nextWorkspace);
    if (nextWorkspace === "utilities") {
      void ensureSupportRecords().catch((reason) => {
        console.error(reason);
        setError("The complete application set could not be loaded for this tool.");
      });
    }
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
            onClick={() => changeWorkspace(item.id)}
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
        {sharedDatabase && !recordsLoading && !fastRecordPaging && (
          <div className="notice warning" role="status">Records are available in compatibility mode. The Supabase performance update is still pending, so searches may take longer than normal.</div>
        )}

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
                  Active <span>{activeCount}</span>
                </button>
                <button className={`view-tab${showArchived ? " active" : ""}`} onClick={() => { setFilters((current) => ({ ...current, status: "archived" })); setQuery(""); }}>
                  Archived <span>{archivedCount}</span>
                </button>
              </nav>
              <section className="search-section">
                <label className="sr-only" htmlFor="record-search">Search records</label>
                <input id="record-search" type="search" className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${showArchived ? "archived" : "active"} records by name, birthday, barangay, diagnosis, or remarks`} />
              </section>
              <AdvancedFilters filters={filters} records={records} optionValues={filterOptions} matchingCount={recordTotal} onChange={setFilters} />
            </div>
            {showArchived && <div className="archive-info"><strong>Archived Records</strong><span>Restore an application, or permanently delete it when it should no longer be included in applicant history and reports.</span></div>}
            <div className="record-list-controls">
              <div className="record-results" role="status">
                <strong>{recordTotal.toLocaleString()}</strong> matching record{recordTotal === 1 ? "" : "s"}
                <span> · showing {firstVisibleRecord.toLocaleString()}–{lastVisibleRecord.toLocaleString()}</span>
                {recordsLoading && <span className="records-loading-status">Updating…</span>}
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
              <button className="bulk-select-toggle" type="button" disabled={!records.length} onClick={toggleAllMatching}>
                {selectedApplications.length === records.length && records.length > 0 ? "Deselect page" : `Select page (${records.length})`}
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
              records={records}
              allRecords={supportRecords || records}
              completeContext={Boolean(supportRecords)}
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
              sort={filters.sort}
              onSort={(sort) => setFilters((current) => ({ ...current, sort }))}
            />
            {recordTotal > pageSize && (
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
            <DocumentScanner onView={openViewRecord} onAttachDocument={attachMatchedDocument} />
        </div>

        {workspace === "reports" && <div className="workspace-view">
            <section className="workspace-intro compact">
              <div>
                <span className="eyebrow">District Summary</span>
                <h2>Reports and statistics</h2>
                <p>Figures use the current record filters and contain no personally identifiable information.</p>
              </div>
            </section>
            <Dashboard query={query} filters={filters} refreshKey={reportRefreshKey} onView={openViewRecord} />
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
              {supportRecords ? (
                <>
                  {sharedDatabase && <LocalRecordsMigration sharedRecords={supportRecords} onChanged={refreshAfterChange} />}
                  <DataTransfer records={supportRecords} onChanged={refreshAfterChange} />
                </>
              ) : <WorkspaceLoading label="Preparing backup and import tools…" />}
            </div>
        </div>
      </div>

      {formOpen && (
        <RecordFormModal
          key={editing?.id ?? "new-record"}
          open
          initialRecord={editing}
          existingRecords={supportRecords || records}
          onFindExistingApplicants={findExistingApplicantRecords}
          onFindHouseholdCandidates={getApplicantContext}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSave={save}
        />
      )}
      {selected && (
        <ViewRecordModal
          record={selected}
          allRecords={selectedContextRecords}
          onClose={() => { setSelected(null); setSelectedContextRecords([]); }}
          onView={openViewRecord}
          onUpdate={saveHouseholdDecision}
        />
      )}
    </main>
  );
}

function WorkspaceLoading({ label }: { label: string }) {
  return <div className="workspace-loading" role="status"><span className="loading-spinner" aria-hidden="true" /><strong>{label}</strong></div>;
}
