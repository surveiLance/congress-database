"use client";

import { useMemo, useState } from "react";
import { suggestConditionCategories } from "@/lib/conditionCategories";
import { updateRecord } from "@/lib/recordStore";
import { AssistanceRecord } from "@/lib/types";

interface Suggestion {
  record: AssistanceRecord;
  categories: string[];
}

export default function ConditionMigration({ records, onChanged }: { records: AssistanceRecord[]; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<number, string[]>>({});
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState("");

  const suggestions = useMemo<Suggestion[]>(() => records.flatMap((record) => {
    if (record.id === undefined || !record.diagnosis.trim()) return [];
    const categories = suggestConditionCategories(record.diagnosis)
      .filter((category) => !record.conditionCategories.includes(category));
    return categories.length ? [{ record, categories }] : [];
  }), [records]);

  const beginReview = () => {
    setSelected(Object.fromEntries(suggestions.map(({ record, categories }) => [record.id as number, [...categories]])));
    setMessage("");
    setOpen(true);
  };

  const toggle = (id: number, category: string) => {
    setSelected((current) => {
      const categories = current[id] || [];
      return {
        ...current,
        [id]: categories.includes(category)
          ? categories.filter((item) => item !== category)
          : [...categories, category],
      };
    });
  };

  const apply = async () => {
    const selectedRows = suggestions.filter(({ record }) => record.id !== undefined && (selected[record.id] || []).length);
    if (!selectedRows.length || !window.confirm(`Apply reviewed condition categories to ${selectedRows.length} record${selectedRows.length === 1 ? "" : "s"}? Existing diagnosis text will not be changed.`)) {
      return;
    }
    setApplying(true);
    let applied = 0;
    for (const { record } of selectedRows) {
      const categories = selected[record.id as number] || [];
      try {
        await updateRecord({
          ...record,
          conditionCategories: Array.from(new Set([...record.conditionCategories, ...categories])),
          updatedAt: new Date().toISOString(),
        });
        applied += 1;
      } catch (error) {
        console.error("Condition category migration failed:", error);
      }
    }
    await onChanged();
    setApplying(false);
    setOpen(false);
    setMessage(`Applied reviewed category suggestions to ${applied} record${applied === 1 ? "" : "s"}. Diagnosis text was preserved.`);
  };

  return (
    <>
      <section className="condition-migration-panel">
        <div>
          <h2>Condition Category Migration</h2>
          <p>Review keyword-based suggestions for existing free-text diagnoses before applying them.</p>
        </div>
        <button className="btn secondary" type="button" disabled={!suggestions.length} onClick={beginReview}>
          {suggestions.length ? `Review ${suggestions.length} Suggestion${suggestions.length === 1 ? "" : "s"}` : "No Suggestions"}
        </button>
      </section>
      {message && <div className="notice success" role="status">{message}</div>}

      {open && (
        <div className="modal active" role="dialog" aria-modal="true" aria-labelledby="condition-review-title">
          <div className="modal-content condition-review-modal">
            <div className="modal-header">
              <div><h2 id="condition-review-title">Review Condition Category Suggestions</h2><p className="muted">Only checked suggestions will be added. Diagnosis text will never be replaced.</p></div>
              <button className="close" type="button" onClick={() => setOpen(false)} aria-label="Close category review">&times;</button>
            </div>
            <div className="condition-review-list">
              {suggestions.map(({ record, categories }) => (
                <article className="condition-review-row" key={record.id}>
                  <div>
                    <strong>{record.surname}, {record.firstName}</strong>
                    <p>{record.diagnosis}</p>
                  </div>
                  <fieldset>
                    <legend>Suggested categories</legend>
                    {categories.map((category) => (
                      <label key={category}>
                        <input type="checkbox" checked={(selected[record.id as number] || []).includes(category)} onChange={() => toggle(record.id as number, category)} />
                        <span>{category}</span>
                      </label>
                    ))}
                  </fieldset>
                </article>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn" type="button" disabled={applying} onClick={() => void apply()}>{applying ? "Applying..." : "Apply Reviewed Categories"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
