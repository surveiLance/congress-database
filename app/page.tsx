"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdvancedFilters, { defaultRecordFilters, RecordFilters } from "@/components/AdvancedFilters";
import ConditionMigration from "@/components/ConditionMigration";
import Dashboard from "@/components/Dashboard";
import DataTransfer from "@/components/DataTransfer";
import DocumentScanner from "@/components/DocumentScanner";
import RecordFormModal from "@/components/RecordFormModal";
import RecordTable from "@/components/RecordTable";
import ViewRecordModal from "@/components/ViewRecordModal";
import { addRecord, deleteRecord, getRecords, updateRecord } from "@/lib/indexedDb";
import { AssistanceRecord } from "@/lib/types";

type Workspace = "records" | "matching" | "reports" | "utilities";

const workspaces: Array<{ id: Workspace; label: string; shortLabel: string }> = [
  { id: "records", label: "Applicant Records", shortLabel: "Records" },
  { id: "matching", label: "Document Matching", shortLabel: "Match" },
  { id: "reports", label: "Reports", shortLabel: "Reports" },
  { id: "utilities", label: "Utilities", shortLabel: "Utilities" },
];

export default function Home() {
  const [records, setRecords] = useState<AssistanceRecord[]>([]);
  const [workspace, setWorkspace] = useState<Workspace>("records");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AssistanceRecord | null>(null);
  const [selected, setSelected] = useState<AssistanceRecord | null>(null);
  const [filters, setFilters] = useState<RecordFilters>({ ...defaultRecordFilters });
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setRecords(await getRecords());
      setError("");
    } catch (reason) {
      console.error(reason);
      setError("The local database could not be opened in this browser.");
    }
  }, []);

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
        if (active) setError("The local database could not be opened in this browser.");
      });
    return () => { active = false; };
  }, []);

  const activeRecords = useMemo(() => records.filter((record) => !record.archivedAt), [records]);
  const archivedRecords = useMemo(() => records.filter((record) => Boolean(record.archivedAt)), [records]);
  const showArchived = filters.status === "archived";
  const visibleRecords = showArchived ? archivedRecords : activeRecords;

  const filtered = useMemo(() => {
    const globalQuery = query.trim().toLowerCase();
    const nameQuery = filters.name.trim().toLowerCase();
    const diagnosisQuery = filters.diagnosis.trim().toLowerCase();
    const matching = visibleRecords.filter((record) => {
      const searchable = Object.values(record)
        .filter((value) => typeof value !== "string" || !value.startsWith("data:image/"))
        .join(" ")
        .toLowerCase();
      const fullName = `${record.surname} ${record.firstName} ${record.middleName} ${record.suffix}`.toLowerCase();
      const createdDate = record.createdAt ? record.createdAt.slice(0, 10) : "";

      return (!globalQuery || searchable.includes(globalQuery)) &&
        (!nameQuery || fullName.includes(nameQuery)) &&
        (!filters.barangay || record.brgy === filters.barangay) &&
        (!filters.sex || record.sex === filters.sex) &&
        inNumberRange(Number(record.age), filters.minAge, filters.maxAge) &&
        (!filters.category || record.category === filters.category) &&
        (!filters.assistanceType || record.assistanceType === filters.assistanceType) &&
        (!diagnosisQuery || record.diagnosis.toLowerCase().includes(diagnosisQuery)) &&
        (!filters.conditionCategory || record.conditionCategories.includes(filters.conditionCategory)) &&
        (!filters.employmentStatus || record.employedStatus === filters.employmentStatus) &&
        inNumberRange(record.salary, filters.minIncome, filters.maxIncome) &&
        inNumberRange(record.monthlyExpenses, filters.minExpenses, filters.maxExpenses) &&
        inNumberRange(record.amount, filters.minAmount, filters.maxAmount) &&
        (!filters.createdFrom || createdDate >= filters.createdFrom) &&
        (!filters.createdTo || createdDate <= filters.createdTo);
    });

    return matching.sort((first, second) => compareRecords(first, second, filters.sort));
  }, [filters, query, visibleRecords]);

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

  const openEditRecord = (record: AssistanceRecord) => {
    setEditing(record);
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
    if (process.env.NODE_ENV !== "development" || record.id === undefined) return;
    const response = window.prompt(`DEVELOPMENT ONLY: Permanently deleting ${record.firstName} ${record.surname} cannot be undone. Type DELETE to continue.`);
    if (response !== "DELETE") return;
    await deleteRecord(record.id);
    await refresh();
  };

  const attachMatchedDocument = async (record: AssistanceRecord, imageData: string) => {
    if (record.id === undefined) return false;
    if (record.idImage && !window.confirm(`Replace the document already attached to ${record.firstName} ${record.surname}?`)) return false;
    await updateRecord({ ...record, idImage: imageData, updatedAt: new Date().toISOString() });
    await refresh();
    return true;
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="district-brand">
          <div className="district-mark" aria-hidden="true"><span>1ST</span></div>
          <div>
            <p className="district-kicker">Antipolo City · First District</p>
            <h1>Assistance Program System</h1>
            <p className="district-subtitle">Congressional District Office</p>
          </div>
        </div>
        <button className="btn header-action" onClick={openNewRecord}>+ New Application</button>
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
            {showArchived && <div className="archive-info"><strong>Archived Records</strong><span>Supervisors can review and restore records from this view.</span></div>}
            <div className="record-results" role="status">
              <strong>{filtered.length}</strong> matching record{filtered.length === 1 ? "" : "s"}
            </div>
            <RecordTable
              records={filtered}
              archived={showArchived}
              onView={setSelected}
              onEdit={showArchived ? undefined : openEditRecord}
              onArchive={showArchived ? undefined : archive}
              onRestore={showArchived ? restore : undefined}
              onPermanentDelete={showArchived && process.env.NODE_ENV === "development" ? permanentlyDelete : undefined}
            />
        </div>

        <div className="workspace-view" hidden={workspace !== "matching"}>
            <section className="workspace-intro compact">
              <div>
                <span className="eyebrow">Document Desk</span>
                <h2>Scan and match an existing applicant</h2>
                <p>OCR text and possible matches stay visible for staff review.</p>
              </div>
            </section>
            <DocumentScanner records={activeRecords} onView={setSelected} onAttachDocument={attachMatchedDocument} />
        </div>

        <div className="workspace-view" hidden={workspace !== "reports"}>
            <section className="workspace-intro compact">
              <div>
                <span className="eyebrow">District Summary</span>
                <h2>Reports and statistics</h2>
                <p>Figures use the current record filters and contain no personally identifiable information.</p>
              </div>
            </section>
            <Dashboard records={filtered} />
        </div>

        <div className="workspace-view" hidden={workspace !== "utilities"}>
            <section className="workspace-intro compact">
              <div>
                <span className="eyebrow">Supervisor Tools</span>
                <h2>Backup, transfer, and data maintenance</h2>
                <p>These occasional tasks are kept separate from daily encoding.</p>
              </div>
            </section>
            <div className="utility-stack">
              <DataTransfer records={records} onChanged={refresh} />
              <ConditionMigration records={records} onChanged={refresh} />
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
      <ViewRecordModal record={selected} onClose={() => setSelected(null)} />
    </main>
  );
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
  const firstDate = Date.parse(first.createdAt) || 0;
  const secondDate = Date.parse(second.createdAt) || 0;
  return sort === "oldest" ? firstDate - secondDate : secondDate - firstDate;
}
