"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { applicantIdentityKey, formatPeso, standardizeApplicantText } from "@/lib/applicantIdentity";
import { conditionCategories } from "@/lib/conditionCategories";
import { AssistanceRecord, emptyRecord } from "@/lib/types";

interface Props {
  open: boolean;
  initialRecord: AssistanceRecord | null;
  existingRecords: AssistanceRecord[];
  onClose: () => void;
  onSave: (record: AssistanceRecord) => Promise<void>;
}

const barangays = ["Dela Paz", "San Isidro", "Sta.cruz", "Bagong Nayon", "Mambugan", "Mayamot", "Beverly Hills", "Muntindilaw"];

function ageFromBirthday(value: string) {
  if (!value) return "";
  const birthday = new Date(`${value}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();
  const beforeBirthday = today.getMonth() < birthday.getMonth() ||
    (today.getMonth() === birthday.getMonth() && today.getDate() < birthday.getDate());
  if (beforeBirthday) age -= 1;
  return String(Math.max(0, age));
}

export default function RecordFormModal({ open, initialRecord, existingRecords, onClose, onSave }: Props) {
  const [form, setForm] = useState<AssistanceRecord>(() => initialRecord ? { ...initialRecord } : { ...emptyRecord });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const applicantHistory = useMemo(() => {
    const key = applicantIdentityKey({
      surname: form.surname,
      firstName: form.firstName,
      birthday: form.birthday,
    });
    if (!key) return null;
    const applications = existingRecords
      .filter((record) => applicantIdentityKey(record) === key)
      .sort((first, second) => (Date.parse(second.createdAt) || 0) - (Date.parse(first.createdAt) || 0));
    const priorApplications = applications.filter((record) => record.id !== initialRecord?.id);
    if (!priorApplications.length) return null;
    return {
      applications,
      priorApplications,
      totalGranted: applications.reduce((sum, record) => sum + record.amount, 0),
      latest: priorApplications[0],
    };
  }, [existingRecords, form.birthday, form.firstName, form.surname, initialRecord?.id]);

  if (!open) return null;

  const update = <Key extends keyof AssistanceRecord>(key: Key, value: AssistanceRecord[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleConditionCategory = (category: string) => {
    setForm((current) => {
      const selected = current.conditionCategories.includes(category);
      return {
        ...current,
        conditionCategories: selected
          ? current.conditionCategories.filter((item) => item !== category)
          : [...current.conditionCategories, category],
        conditionOther: category === "Other" && selected ? "" : current.conditionOther,
      };
    });
  };

  const fileChanged = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update("idImage", String(reader.result));
    reader.readAsDataURL(file);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      const now = new Date().toISOString();
      await onSave(standardizeApplicantText({
        ...form,
        id: initialRecord?.id,
        createdAt: initialRecord?.createdAt || now,
        updatedAt: now,
      }));
      setForm({ ...emptyRecord });
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The record could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    setForm({ ...emptyRecord });
    onClose();
  };

  return (
    <div className="modal active" role="dialog" aria-modal="true" aria-labelledby="record-form-title">
      <div className="modal-content record-form-modal">
        <div className="modal-header">
          <h2 id="record-form-title">{initialRecord ? "Edit Assistance Record" : "New Assistance Record"}</h2>
          <button className="close" type="button" onClick={close} aria-label="Close">&times;</button>
        </div>
        <form onSubmit={submit}>
          <div className="record-form-layout">
            <div className="record-form-fields">
              {applicantHistory && (
                <div className="applicant-history-alert" role="status">
                  <div>
                    <span className="eyebrow">Existing applicant found</span>
                    <strong>{applicantHistory.priorApplications.length} previous application{applicantHistory.priorApplications.length === 1 ? "" : "s"}</strong>
                    <p>
                      Previously granted: <b>{formatPeso(applicantHistory.priorApplications.reduce((sum, record) => sum + record.amount, 0))}</b>
                      {applicantHistory.latest?.createdAt ? ` · Latest application ${new Date(applicantHistory.latest.createdAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <span className="history-total">Current recorded total: {formatPeso(applicantHistory.totalGranted)}</span>
                </div>
              )}
              {saveError && <div className="notice error" role="alert">{saveError}</div>}
              <div className="form-grid">
                <h3 className="section-title">1. Name Details</h3>
                <Field label="Surname *"><input autoFocus required value={form.surname} onChange={(e) => update("surname", e.target.value)} /></Field>
                <Field label="First Name *"><input required value={form.firstName} onChange={(e) => update("firstName", e.target.value)} /></Field>
                <Field label="Middle Name"><input value={form.middleName} onChange={(e) => update("middleName", e.target.value)} /></Field>
                <Field label="Suffix"><input value={form.suffix} placeholder="e.g. Jr., III" onChange={(e) => update("suffix", e.target.value)} /></Field>

                <h3 className="section-title">2. Personal Info</h3>
                <Field label="Birthday *"><input required type="date" value={form.birthday} onChange={(e) => setForm((current) => ({ ...current, birthday: e.target.value, age: ageFromBirthday(e.target.value) }))} /></Field>
                <Field label="Age"><input readOnly type="number" value={form.age} /></Field>
                <Field label="Sex *"><Select required value={form.sex} options={["Male", "Female"]} placeholder="Select" onChange={(v) => update("sex", v)} /></Field>
                <Field label="Contact Number *"><input required type="tel" value={form.contact} onChange={(e) => update("contact", e.target.value)} /></Field>
                <Field label="ID Number (optional)"><input value={form.idNumber} onChange={(e) => update("idNumber", e.target.value)} placeholder="Government or program ID number" /></Field>

                <h3 className="section-title">3. Address & Barangay</h3>
                <Field label="Barangay *"><Select required value={form.brgy} options={barangays} placeholder="Select Barangay" onChange={(v) => update("brgy", v)} /></Field>
                <Field label="Address *" full><input required value={form.address} onChange={(e) => update("address", e.target.value)} /></Field>

                <h3 className="section-title">4. Work & Income</h3>
                <Field label="Work/Occupation"><input value={form.work} onChange={(e) => update("work", e.target.value)} /></Field>
                <Field label="Monthly Salary (₱)"><input type="number" min="0" step=".01" value={form.salary} onFocus={selectInitialZero} onChange={(e) => update("salary", Number(e.target.value))} /></Field>
                <Field label="Employment Status"><Select value={form.employedStatus} options={["Employed", "Seasonal", "Unemployed"]} onChange={(v) => update("employedStatus", v)} /></Field>

                <h3 className="section-title">5. Status & Category</h3>
                <Field label="Civil Status *"><Select required value={form.civilStatus} options={["Single", "Married", "Widowed", "Separated"]} placeholder="Select" onChange={(v) => update("civilStatus", v)} /></Field>
                <Field label="Category *"><Select required value={form.category} options={["FHONA", "SENIOR", "PLHIV"]} placeholder="Select Category" onChange={(v) => update("category", v)} /></Field>

                <h3 className="section-title">6. Assistance Request</h3>
                <Field label="Type of Assistance *"><Select required value={form.assistanceType} options={["Medical", "Financial", "Educational", "Burial"]} placeholder="Select Type" onChange={(v) => update("assistanceType", v)} /></Field>
                <Field label="Amount Requested (₱)"><input type="number" min="0" step=".01" value={form.amountRequested} onFocus={selectInitialZero} onChange={(e) => update("amountRequested", Number(e.target.value))} /></Field>
                <Field label="Amount Granted (₱) *"><input required type="number" min="0" step=".01" value={form.amount} onFocus={selectInitialZero} onChange={(e) => update("amount", Number(e.target.value))} /></Field>
                <Field label="Relationship to Beneficiary"><input value={form.relationship} placeholder="e.g. Self, Parent, Child" onChange={(e) => update("relationship", e.target.value)} /></Field>

                <h3 className="section-title">7. Beneficiary & Medical Details</h3>
                <Field label="Beneficiary Full Name" full><input value={form.benName} onChange={(e) => update("benName", e.target.value)} /></Field>
                <Field label="Beneficiary Birthday"><input type="date" value={form.benBday} onChange={(e) => setForm((current) => ({ ...current, benBday: e.target.value, benAge: ageFromBirthday(e.target.value) }))} /></Field>
                <Field label="Beneficiary Age"><input readOnly type="number" value={form.benAge} /></Field>
                <Field label="Beneficiary Sex"><Select value={form.benSex} options={["Male", "Female"]} placeholder="Select" onChange={(v) => update("benSex", v)} /></Field>
                <Field label="Family Member Relation"><input value={form.benFamilyMember} onChange={(e) => update("benFamilyMember", e.target.value)} /></Field>
                <Field label="Beneficiary Civil Status"><Select value={form.benCivilStatus} options={["Single", "Married", "Widowed", "Separated"]} placeholder="Select" onChange={(v) => update("benCivilStatus", v)} /></Field>
                <Field label="Beneficiary Category"><Select value={form.benCategory} options={["FHONA", "SENIOR", "PLHIV"]} placeholder="Select" onChange={(v) => update("benCategory", v)} /></Field>
                <Field label="Diagnosis / Condition" full><textarea rows={2} value={form.diagnosis} onChange={(e) => update("diagnosis", e.target.value)} /></Field>
                <fieldset className="form-group full-width condition-selector">
                  <legend>Standardized Condition Categories</legend>
                  <p>Select every category that applies. The original diagnosis text remains unchanged.</p>
                  <div className="condition-options">
                    {conditionCategories.map((category) => (
                      <label key={category}>
                        <input type="checkbox" checked={form.conditionCategories.includes(category)} onChange={() => toggleConditionCategory(category)} />
                        <span>{category}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {form.conditionCategories.includes("Other") && (
                  <Field label="Other condition specification" full>
                    <input value={form.conditionOther} onChange={(event) => update("conditionOther", event.target.value)} placeholder="Specify the other condition category" />
                  </Field>
                )}
                <Field label="Remarks" full><textarea rows={2} value={form.remarks} onChange={(e) => update("remarks", e.target.value)} /></Field>

                <h3 className="section-title">8. Expenses & Household</h3>
                <Field label="Monthly Expenses (₱)"><input type="number" min="0" step=".01" value={form.monthlyExpenses} onFocus={selectInitialZero} onChange={(e) => update("monthlyExpenses", Number(e.target.value))} /></Field>
                <Field label="Total Employed in Household"><input type="number" min="0" value={form.totalEmployed} onFocus={selectInitialZero} onChange={(e) => update("totalEmployed", Number(e.target.value))} /></Field>
              </div>
            </div>

            <aside className="record-photo-reference" aria-labelledby="application-photo-title">
              <div>
                <span className="eyebrow">Reference Only</span>
                <h3 id="application-photo-title">Application Photo</h3>
                <p>Keep the document visible while typing. No automatic extraction is performed.</p>
              </div>
              <div className={`record-photo-frame${form.idImage ? " has-image" : ""}`}>
                {form.idImage
                  ? <Image unoptimized src={form.idImage} width={1000} height={1300} alt="Application document reference" />
                  : <div className="record-photo-empty"><strong>No photo attached</strong><span>Use a clear, upright photo of the complete document.</span></div>}
              </div>
              <label className="btn secondary record-photo-button">
                {form.idImage ? "Replace Photo" : "Take or Upload Photo"}
                <input type="file" accept="image/*" capture="environment" onChange={fileChanged} />
              </label>
              {form.idImage && <button className="btn secondary small" type="button" onClick={() => update("idImage", null)}>Remove Photo</button>}
              <p className="record-photo-note">The image is saved with this application only after you click Save Record.</p>
            </aside>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn secondary" onClick={close}>Cancel</button>
            <button type="submit" className="btn" disabled={saving}>{saving ? "Saving..." : initialRecord ? "Save Changes" : "Save Record"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function selectInitialZero(event: React.FocusEvent<HTMLInputElement>) {
  if (event.currentTarget.value === "0") event.currentTarget.select();
}

function Field({ label, full = false, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return <label className={`form-group${full ? " full-width" : ""}`}><span>{label}</span>{children}</label>;
}

function Select({ value, options, placeholder, required, onChange }: { value: string; options: string[]; placeholder?: string; required?: boolean; onChange: (value: string) => void }) {
  return (
    <select required={required} value={value} onChange={(e) => onChange(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option) => <option value={option} key={option}>{option}</option>)}
    </select>
  );
}
