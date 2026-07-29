"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useState } from "react";
import { ApplicationDocument, AssistanceRecord, emptyRecord } from "@/lib/types";

interface Props {
  initialRecord?: AssistanceRecord | null;
  onClose: () => void;
  onSave: (record: AssistanceRecord) => Promise<void>;
}

const barangays = ["Dela Paz", "San Isidro", "Sta.cruz", "Bagong Nayon", "Mambugan", "Mayamot", "Beverly Hills", "Muntindilaw"];

export const requirementCategories = [
  "Information Sheet / Family Composition",
  "General Intake Sheet",
  "Certificate of Eligibility",
  "Valid ID",
  "Medical Certificate / Abstract",
  "Prescription",
  "Laboratory Request",
  "Statement of Account / Quotation",
  "Discharge Summary / Treatment Protocol",
  "Funeral / Death Documents",
  "Referral Letter",
  "Employment / Income Document",
  "Other Supporting Document",
] as const;

export default function IntakeFormModal({ initialRecord = null, onClose, onSave }: Props) {
  const [form, setForm] = useState<AssistanceRecord>(() => initialRecord
    ? { ...initialRecord, documents: [...initialRecord.documents] }
    : {
      ...emptyRecord,
      workflowStage: "intake",
      intakeDate: localDate(),
      employedStatus: "",
    });
  const [documentCategory, setDocumentCategory] = useState<string>(requirementCategories[0]);
  const [saving, setSaving] = useState(false);
  const [processingFiles, setProcessingFiles] = useState(false);
  const [message, setMessage] = useState("");

  const update = <Key extends keyof AssistanceRecord>(key: Key, value: AssistanceRecord[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const uploadDocuments = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    const remainingSlots = Math.max(0, 12 - form.documents.length);
    if (!remainingSlots) {
      setMessage("This application already has the maximum of 12 document photos.");
      return;
    }

    setProcessingFiles(true);
    setMessage("");
    try {
      const documents: ApplicationDocument[] = [];
      for (const file of files.slice(0, remainingSlots)) {
        documents.push({
          id: globalThis.crypto?.randomUUID?.() || `document-${Date.now()}-${documents.length}`,
          category: documentCategory,
          fileName: file.name,
          dataUrl: await compressImage(file),
          uploadedAt: new Date().toISOString(),
        });
      }
      setForm((current) => ({ ...current, documents: [...current.documents, ...documents] }));
      if (files.length > remainingSlots) setMessage(`Only ${remainingSlots} more document photo${remainingSlots === 1 ? "" : "s"} could be added.`);
    } catch (error) {
      console.error(error);
      setMessage("One of the selected photos could not be prepared. Try a JPEG, PNG, or a new camera photo.");
    } finally {
      setProcessingFiles(false);
    }
  };

  const persist = async (sendForReview: boolean) => {
    if (!form.surname.trim() || !form.firstName.trim() || !form.birthday || !form.intakeDate) {
      setMessage("Surname, first name, birthday, and first-level application date are required even for a draft.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const now = new Date().toISOString();
      await onSave({
        ...form,
        id: initialRecord?.id,
        createdAt: initialRecord?.createdAt || now,
        updatedAt: now,
        workflowStage: sendForReview ? "for-review" : "intake",
        submittedForReviewAt: sendForReview ? now : form.submittedForReviewAt,
        reviewNotes: sendForReview ? "" : form.reviewNotes,
      });
      onClose();
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "The intake application could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void persist(true);
  };

  return (
    <div className="modal active" role="dialog" aria-modal="true" aria-labelledby="intake-form-title">
      <div className="modal-content intake-form-modal">
        <div className="modal-header">
          <div>
            <span className="eyebrow">First-level application</span>
            <h2 id="intake-form-title">{initialRecord ? "Update Intake Application" : "New Intake Application"}</h2>
          </div>
          <button className="close" type="button" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <form onSubmit={submit}>
          <div className="intake-form-layout">
            <div className="intake-form-fields">
              {form.reviewNotes && (
                <div className="notice error">
                  <strong>Returned by reviewer:</strong> {form.reviewNotes}
                </div>
              )}
              {message && <div className="notice error" role="alert">{message}</div>}
              <div className="form-grid">
                <h3 className="section-title">1. Application & Applicant</h3>
                <Field label="First-level application date *"><input required type="date" value={form.intakeDate} onChange={(event) => update("intakeDate", event.target.value)} /></Field>
                <Field label="Assistance requested *"><Select required value={form.assistanceType} placeholder="Select type" options={["Medical", "Financial", "Educational", "Burial"]} onChange={(value) => update("assistanceType", value)} /></Field>
                <Field label="Surname *"><input required autoFocus value={form.surname} onChange={(event) => update("surname", event.target.value)} /></Field>
                <Field label="First Name *"><input required value={form.firstName} onChange={(event) => update("firstName", event.target.value)} /></Field>
                <Field label="Middle Name"><input value={form.middleName} onChange={(event) => update("middleName", event.target.value)} /></Field>
                <Field label="Suffix"><input value={form.suffix} onChange={(event) => update("suffix", event.target.value)} placeholder="e.g. Jr., III" /></Field>
                <Field label="Birthday *"><input required type="date" value={form.birthday} onChange={(event) => setForm((current) => ({ ...current, birthday: event.target.value, age: ageFromBirthday(event.target.value) }))} /></Field>
                <Field label="Sex *"><Select required value={form.sex} placeholder="Select" options={["Male", "Female"]} onChange={(value) => update("sex", value)} /></Field>
                <Field label="Contact number *"><input required type="tel" value={form.contact} onChange={(event) => update("contact", event.target.value)} /></Field>
                <Field label="Civil status"><Select value={form.civilStatus} placeholder="Select" options={["Single", "Married", "Widowed", "Separated"]} onChange={(value) => update("civilStatus", value)} /></Field>

                <h3 className="section-title">2. Address, Work & Household</h3>
                <Field label="Barangay *"><Select required value={form.brgy} placeholder="Select barangay" options={barangays} onChange={(value) => update("brgy", value)} /></Field>
                <Field label="Complete address *" full><input required value={form.address} onChange={(event) => update("address", event.target.value)} /></Field>
                <Field label="Occupation"><input value={form.work} onChange={(event) => update("work", event.target.value)} /></Field>
                <Field label="Employment status"><Select value={form.employedStatus} placeholder="Select" options={["Employed", "Seasonal", "Unemployed"]} onChange={(value) => update("employedStatus", value)} /></Field>
                <Field label="Monthly income (₱)"><NumberInput value={form.salary} onChange={(value) => update("salary", value)} /></Field>
                <Field label="Monthly family expenses (₱)"><NumberInput value={form.monthlyExpenses} onChange={(value) => update("monthlyExpenses", value)} /></Field>
                <Field label="Household members"><NumberInput value={form.householdMembers} integer onChange={(value) => update("householdMembers", value)} /></Field>
                <Field label="Employed household members"><NumberInput value={form.totalEmployed} integer onChange={(value) => update("totalEmployed", value)} /></Field>

                <h3 className="section-title">3. Request & Case Information</h3>
                <Field label="Amount requested (₱) *"><NumberInput required value={form.amountRequested} onChange={(value) => update("amountRequested", value)} /></Field>
                <Field label="Relationship to beneficiary"><input value={form.relationship} onChange={(event) => update("relationship", event.target.value)} placeholder="e.g. Self, Parent, Child" /></Field>
                <Field label="Beneficiary name" full><input value={form.benName} onChange={(event) => update("benName", event.target.value)} /></Field>
                <Field label="Diagnosis / reason for assistance" full><textarea rows={3} value={form.diagnosis} onChange={(event) => update("diagnosis", event.target.value)} /></Field>
                <Field label="Intake remarks" full><textarea rows={3} value={form.remarks} onChange={(event) => update("remarks", event.target.value)} /></Field>
              </div>
            </div>

            <aside className="intake-documents">
              <div>
                <span className="eyebrow">Application packet</span>
                <h3>Requirements & Photos</h3>
                <p>Add clear photos of every form, ID, medical paper, quotation, or other supporting requirement.</p>
              </div>
              <label className="document-category-field">
                <span>Document type</span>
                <select value={documentCategory} onChange={(event) => setDocumentCategory(event.target.value)}>
                  {requirementCategories.map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>
              <label className={`btn document-upload-button${processingFiles ? " disabled" : ""}`}>
                {processingFiles ? "Preparing photos..." : "Take or Add Photos"}
                <input disabled={processingFiles} type="file" accept="image/*" capture="environment" multiple onChange={(event) => void uploadDocuments(event)} />
              </label>
              <span className="document-limit">{form.documents.length}/12 photos attached</span>
              <div className="intake-document-list">
                {!form.documents.length && (
                  <div className="document-empty">
                    <strong>No requirements attached yet</strong>
                    <span>You can save a draft now and add photos before sending it for review.</span>
                  </div>
                )}
                {form.documents.map((document) => (
                  <article className="intake-document-card" key={document.id}>
                    <Image unoptimized src={document.dataUrl} width={500} height={360} alt={document.category} />
                    <div>
                      <strong>{document.category}</strong>
                      <span>{document.fileName}</span>
                    </div>
                    <button type="button" onClick={() => update("documents", form.documents.filter((item) => item.id !== document.id))} aria-label={`Remove ${document.category}`}>&times;</button>
                  </article>
                ))}
              </div>
            </aside>
          </div>
          <div className="modal-footer intake-actions">
            <button type="button" className="btn tertiary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn secondary" disabled={saving || processingFiles} onClick={() => void persist(false)}>Save Draft</button>
            <button type="submit" className="btn" disabled={saving || processingFiles}>{saving ? "Saving..." : "Send for Review"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, full = false, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return <label className={`form-group${full ? " full-width" : ""}`}><span>{label}</span>{children}</label>;
}

function Select({ value, options, placeholder, required, onChange }: { value: string; options: readonly string[]; placeholder?: string; required?: boolean; onChange: (value: string) => void }) {
  return (
    <select required={required} value={value} onChange={(event) => onChange(event.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  );
}

function NumberInput({ value, integer = false, required = false, onChange }: { value: number; integer?: boolean; required?: boolean; onChange: (value: number) => void }) {
  return <input required={required} type="number" min="0" step={integer ? "1" : ".01"} value={value || ""} onChange={(event) => onChange(Number(event.target.value))} placeholder="0" />;
}

function ageFromBirthday(value: string) {
  if (!value) return "";
  const birthday = new Date(`${value}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();
  if (today.getMonth() < birthday.getMonth() || (today.getMonth() === birthday.getMonth() && today.getDate() < birthday.getDate())) age -= 1;
  return String(Math.max(0, age));
}

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

async function compressImage(file: File): Promise<string> {
  let browserImage: Blob = file;
  const heic = file.type.toLowerCase().includes("heic") || file.type.toLowerCase().includes("heif") || /\.hei[cf]$/i.test(file.name);
  if (heic) {
    const { default: heic2any } = await import("heic2any");
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.82 });
    browserImage = Array.isArray(converted) ? converted[0] : converted;
  }
  return compressBrowserImage(browserImage);
}

function compressBrowserImage(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const image = new window.Image();
      image.onerror = () => reject(new Error("Unsupported image"));
      image.onload = () => {
        const maximum = 1600;
        const scale = Math.min(1, maximum / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("Image processing is unavailable"));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
