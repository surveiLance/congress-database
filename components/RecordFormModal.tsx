"use client";

import Image from "next/image";
import { ChangeEvent, DragEvent as ReactDragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  ApplicantHistory,
  applicantIdentityKey,
  buildApplicantHistories,
  formatPeso,
  normalizeIdentityPart,
  standardizeApplicantText,
} from "@/lib/applicantIdentity";
import { conditionCategories } from "@/lib/conditionCategories";
import {
  ApplicationDraft,
  deleteApplicationDraft,
  getApplicationDraft,
  saveApplicationDraft,
} from "@/lib/draftStore";
import { householdSummaryForRecord } from "@/lib/householdMatching";
import { AssistanceRecord, emptyRecord, FamilyMember } from "@/lib/types";
import { antipoloBarangays } from "@/lib/recordTaxonomy";

interface Props {
  open: boolean;
  initialRecord: AssistanceRecord | null;
  existingRecords: AssistanceRecord[];
  onClose: () => void;
  onSave: (record: AssistanceRecord) => Promise<void>;
}

const barangays = [...antipoloBarangays];
const familyRelationships = [
  "Husband", "Wife", "Partner",
  "Son", "Daughter", "Stepson", "Stepdaughter",
  "Father", "Mother", "Stepfather", "Stepmother",
  "Brother", "Sister", "Half-brother", "Half-sister",
  "Father-in-law", "Mother-in-law", "Brother-in-law", "Sister-in-law",
  "Son-in-law", "Daughter-in-law",
  "Grandfather", "Grandmother", "Grandson", "Granddaughter",
  "Uncle", "Aunt", "Nephew", "Niece", "Cousin",
  "Guardian", "Other relative", "Non-relative household member",
];
const NEW_APPLICATION_DRAFT_KEY = "new-application";
const today = () => new Date().toISOString().slice(0, 10);
const freshRecord = (): AssistanceRecord => ({ ...emptyRecord, applicationDate: today() });

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
  const [form, setForm] = useState<AssistanceRecord>(() => initialRecord ? { ...initialRecord } : freshRecord());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [copiedApplicantKey, setCopiedApplicantKey] = useState("");
  const [draftCandidate, setDraftCandidate] = useState<ApplicationDraft | null>(null);
  const [draftReady, setDraftReady] = useState(Boolean(initialRecord));
  const [draftSavedAt, setDraftSavedAt] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [dragTarget, setDragTarget] = useState<"idImage" | "idImageBack" | null>(null);

  const currentApplicantKey = applicantIdentityKey({
    surname: form.surname,
    firstName: form.firstName,
    birthday: form.birthday,
  });

  const applicantHistories = useMemo(() => {
    const surname = normalizeIdentityPart(form.surname);
    const firstName = normalizeIdentityPart(form.firstName);
    if (!surname || !firstName) return [];

    return Array.from(buildApplicantHistories(existingRecords).values())
      .filter((history) => {
        const latest = history.latestApplication;
        const sameName = normalizeIdentityPart(latest.surname) === surname &&
          normalizeIdentityPart(latest.firstName) === firstName;
        return sameName && (!currentApplicantKey || history.key === currentApplicantKey);
      })
      .map((history) => ({
        ...history,
        priorApplications: history.records.filter((record) => record.id !== initialRecord?.id),
      }))
      .filter((history) => history.priorApplications.length > 0)
      .sort((first, second) => (Date.parse(second.latestApplicationDate) || 0) - (Date.parse(first.latestApplicationDate) || 0));
  }, [currentApplicantKey, existingRecords, form.firstName, form.surname, initialRecord?.id]);

  const householdReview = useMemo(() => {
    const hasHouseholdClue = Boolean(
      form.surname.trim() ||
      form.address.trim() ||
      form.contact.trim() ||
      form.familyComposition.some((member) => member.fullName.trim()),
    );
    if (!hasHouseholdClue) return null;
    const summary = householdSummaryForRecord(form, existingRecords);
    return summary.connections.length ? summary : null;
  }, [existingRecords, form]);

  useEffect(() => {
    if (initialRecord) return;
    let active = true;
    void getApplicationDraft(NEW_APPLICATION_DRAFT_KEY)
      .then((draft) => {
        if (!active) return;
        setDraftCandidate(draft);
        if (draft) {
          setForm({
            ...emptyRecord,
            ...draft.record,
            applicationDate: draft.record.applicationDate || today(),
            id: undefined,
            createdAt: "",
            updatedAt: "",
            archivedAt: "",
          });
        }
        setDraftSavedAt(draft?.savedAt || "");
        setDraftReady(true);
      })
      .catch((reason) => {
        console.error(reason);
        if (active) {
          setDraftError("Draft storage could not be opened in this browser.");
          setDraftReady(true);
        }
      });
    return () => { active = false; };
  }, [initialRecord]);

  useEffect(() => {
    if (initialRecord || !draftReady || !hasDraftContent(form)) return;
    const timeout = window.setTimeout(() => {
      void saveApplicationDraft(NEW_APPLICATION_DRAFT_KEY, form)
        .then((draft) => {
          setDraftSavedAt(draft.savedAt);
          setDraftError("");
        })
        .catch((reason) => {
          console.error(reason);
          setDraftError("Automatic draft saving failed. Use Save Draft & Close to try again.");
        });
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [draftReady, form, initialRecord]);

  if (!open) return null;

  const applyExistingApplicantDetails = (applicantHistory: ApplicantHistory) => {
    const existing = applicantHistory.latestApplication;
    setForm((current) => ({
      ...current,
      surname: existing.surname,
      firstName: existing.firstName,
      middleName: existing.middleName,
      suffix: existing.suffix,
      birthday: existing.birthday,
      age: ageFromBirthday(existing.birthday),
      sex: existing.sex,
      contact: existing.contact,
      idNumber: existing.idNumber,
      brgy: existing.brgy,
      address: existing.address,
      work: existing.work,
      salary: existing.salary,
      employedStatus: existing.employedStatus,
      civilStatus: existing.civilStatus,
      category: existing.category,
      householdMembers: existing.householdMembers,
      familyComposition: existing.familyComposition.map((member) => ({ ...member })),
      confirmedRelativeKeys: [...existing.confirmedRelativeKeys],
      dismissedRelativeKeys: [...existing.dismissedRelativeKeys],
      relativeLinks: existing.relativeLinks.map((link) => ({ ...link })),
      totalEmployed: existing.totalEmployed,
      monthlyExpenses: existing.monthlyExpenses,
      diagnosis: existing.diagnosis,
      conditionCategories: [...existing.conditionCategories],
      conditionOther: existing.conditionOther,
    }));
    setCopiedApplicantKey(applicantHistory.key);
  };

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

  const addFamilyMember = () => {
    setForm((current) => {
      const familyComposition = [
        ...current.familyComposition,
        { fullName: "", relationship: "", birthday: "" },
      ];
      return {
        ...current,
        familyComposition,
        householdMembers: Math.max(current.householdMembers, familyComposition.length + 1),
      };
    });
  };

  const updateFamilyMember = (index: number, key: keyof FamilyMember, value: string) => {
    setForm((current) => ({
      ...current,
      familyComposition: current.familyComposition.map((member, memberIndex) =>
        memberIndex === index ? { ...member, [key]: value } : member,
      ),
    }));
  };

  const removeFamilyMember = (index: number) => {
    setForm((current) => ({
      ...current,
      familyComposition: current.familyComposition.filter((_, memberIndex) => memberIndex !== index),
    }));
  };

  const loadPhoto = (field: "idImage" | "idImageBack", file: File) => {
    if (!file.type.startsWith("image/")) {
      setDraftError("Please use an image file for the ID photo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update(field, String(reader.result));
    reader.readAsDataURL(file);
  };

  const fileChanged = (field: "idImage" | "idImageBack") => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) loadPhoto(field, file);
  };

  const photoDropped = (field: "idImage" | "idImageBack") => (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragTarget(null);
    const file = event.dataTransfer.files?.[0];
    if (file) loadPhoto(field, file);
  };

  const discardDraft = async () => {
    try {
      await deleteApplicationDraft(NEW_APPLICATION_DRAFT_KEY);
      setDraftCandidate(null);
      setDraftSavedAt("");
      setForm(freshRecord());
      setDraftError("");
    } catch (reason) {
      console.error(reason);
      setDraftError("The saved draft could not be discarded.");
    }
  };

  const saveDraftAndClose = async () => {
    if (initialRecord || !hasDraftContent(form)) return;
    setSavingDraft(true);
    setDraftError("");
    try {
      await saveApplicationDraft(NEW_APPLICATION_DRAFT_KEY, form);
      onClose();
    } catch (reason) {
      console.error(reason);
      setDraftError("The draft could not be saved. Please try again before closing.");
    } finally {
      setSavingDraft(false);
    }
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
      if (!initialRecord) {
        try {
          await deleteApplicationDraft(NEW_APPLICATION_DRAFT_KEY);
        } catch (reason) {
          console.error("The completed application was saved, but its local draft could not be removed.", reason);
        }
      }
      setForm(freshRecord());
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The record could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const close = async () => {
    if (!initialRecord && hasDraftContent(form)) {
      try {
        await saveApplicationDraft(NEW_APPLICATION_DRAFT_KEY, form);
      } catch (reason) {
        console.error(reason);
        setDraftError("The draft could not be saved. Use Save Draft & Close to try again.");
        return;
      }
    }
    setForm(freshRecord());
    onClose();
  };

  return (
    <div className="modal active" role="dialog" aria-modal="true" aria-labelledby="record-form-title">
      <div className="modal-content record-form-modal">
        <div className="modal-header">
          <h2 id="record-form-title">{initialRecord ? "Edit Assistance Record" : "New Assistance Record"}</h2>
          <button className="close" type="button" onClick={() => void close()} aria-label="Close">&times;</button>
        </div>
        <form onSubmit={submit}>
          <div className="record-form-layout">
            <div className="record-form-fields">
              {applicantHistories.length === 1 && (
                <div className="applicant-history-alert" role="status">
                  <div>
                    <span className="eyebrow">Existing applicant found</span>
                    <strong>{applicantHistories[0].priorApplications.length} previous application{applicantHistories[0].priorApplications.length === 1 ? "" : "s"}</strong>
                    <p>
                      Previously granted: <b>{formatPeso(applicantHistories[0].priorApplications.reduce((sum, record) => sum + record.amount, 0))}</b>
                      {applicantHistories[0].latestApplicationDate ? ` · Latest application ${new Date(applicantHistories[0].latestApplicationDate).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <div className="applicant-history-actions">
                    <span className="history-total">Current recorded total: {formatPeso(applicantHistories[0].totalGranted)}</span>
                    {!initialRecord && (
                      <button className="btn history-fill-button" type="button" onClick={() => applyExistingApplicantDetails(applicantHistories[0])}>
                        Reuse Previous Applicant Information
                      </button>
                    )}
                    {!initialRecord && (
                      <small>
                        Copies identity, contact, address, work, income, household, and health information.
                        Assistance and beneficiary details are kept separate for this application.
                      </small>
                    )}
                    {copiedApplicantKey === applicantHistories[0].key && <small role="status">Previous information copied. Review any changes before saving.</small>}
                  </div>
                </div>
              )}
              {applicantHistories.length > 1 && !initialRecord && (
                <div className="applicant-choice-alert" role="status">
                  <div>
                    <span className="eyebrow">Possible existing applicants</span>
                    <strong>{applicantHistories.length} people have this name</strong>
                    <p>Select the correct person using their birthday and barangay. Their previous information will fill the form.</p>
                  </div>
                  <div className="applicant-choice-list">
                    {applicantHistories.map((history) => {
                      const applicant = history.latestApplication;
                      return (
                        <button
                          className="applicant-choice"
                          type="button"
                          key={history.key}
                          onClick={() => applyExistingApplicantDetails(history)}
                        >
                          <span>
                            <strong>{applicant.firstName} {applicant.middleName} {applicant.surname}</strong>
                            <small>{formatApplicantBirthday(applicant.birthday)} · {applicant.brgy || "No barangay recorded"}</small>
                          </span>
                          <span>
                            <b>{formatPeso(history.totalGranted)}</b>
                            <small>{history.applicationCount} application{history.applicationCount === 1 ? "" : "s"}</small>
                          </span>
                          <span className="applicant-choice-use">Use</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {saveError && <div className="notice error" role="alert">{saveError}</div>}
              {draftError && <div className="notice error" role="alert">{draftError}</div>}
              {!initialRecord && draftCandidate && (
                <div className="draft-recovery-alert" role="status">
                  <div>
                    <span className="eyebrow">Saved application draft</span>
                    <strong>Your unfinished application was restored automatically.</strong>
                    <small>Last saved locally on this device {formatDraftTime(draftCandidate.savedAt)}.</small>
                  </div>
                  <div>
                    <button className="btn secondary small" type="button" onClick={() => void discardDraft()}>Discard and Start New</button>
                  </div>
                </div>
              )}
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

                <h3 className="section-title">4. Household & Family</h3>
                <Field label="Total Household Members">
                  <input
                    type="number"
                    min="0"
                    value={form.householdMembers}
                    onFocus={selectInitialZero}
                    onChange={(e) => update("householdMembers", Number(e.target.value))}
                  />
                </Field>
                <Field label="Employed Household Members"><input type="number" min="0" value={form.totalEmployed} onFocus={selectInitialZero} onChange={(e) => update("totalEmployed", Number(e.target.value))} /></Field>
                <Field label="Monthly Expenses (₱)"><input type="number" min="0" step=".01" value={form.monthlyExpenses} onFocus={selectInitialZero} onChange={(e) => update("monthlyExpenses", Number(e.target.value))} /></Field>
                <div className="family-composition-editor">
                  <div className="family-composition-heading">
                    <div>
                      <strong>Family names <span>(optional)</span></strong>
                      <small>Add names when they appear on the paperwork. The record can still be saved when names are unavailable.</small>
                    </div>
                    <button className="btn secondary small" type="button" onClick={addFamilyMember}>+ Add Family Name</button>
                  </div>
                  {!form.familyComposition.length && (
                    <div className="family-composition-empty">
                      No names provided. The system checks matching surnames first; exact addresses and contact numbers are supporting evidence only.
                    </div>
                  )}
                  {form.familyComposition.map((member, index) => (
                    <div className="family-member-row" key={index}>
                      <label>
                        <span>Full name</span>
                        <input
                          value={member.fullName}
                          placeholder="Family member’s full name"
                          onChange={(event) => updateFamilyMember(index, "fullName", event.target.value)}
                        />
                      </label>
                      <label>
                        <span>Exact relationship</span>
                        <input
                          list="family-relationship-options"
                          value={member.relationship}
                          placeholder="e.g. Daughter, Mother-in-law"
                          onChange={(event) => updateFamilyMember(index, "relationship", event.target.value)}
                        />
                      </label>
                      <label>
                        <span>Birthday (if known)</span>
                        <input type="date" value={member.birthday} onChange={(event) => updateFamilyMember(index, "birthday", event.target.value)} />
                      </label>
                      <button className="family-member-remove" type="button" onClick={() => removeFamilyMember(index)} aria-label={`Remove family member ${index + 1}`}>&times;</button>
                    </div>
                  ))}
                  <datalist id="family-relationship-options">
                    {familyRelationships.map((relationship) => <option value={relationship} key={relationship} />)}
                  </datalist>
                  {form.familyComposition.length > 0 && (
                    <button
                      className="family-count-helper"
                      type="button"
                      onClick={() => update("householdMembers", form.familyComposition.length + 1)}
                    >
                      Use listed household count: applicant + {form.familyComposition.length} member{form.familyComposition.length === 1 ? "" : "s"} = {form.familyComposition.length + 1}
                    </button>
                  )}
                </div>
                {householdReview && (
                  <div className="encoding-household-alert" role="status">
                    <div className="encoding-household-heading">
                      <div>
                        <span className="eyebrow">Household check</span>
                        <strong>{householdReview.connections.length} possible related applicant{householdReview.connections.length === 1 ? "" : "s"} found</strong>
                      </div>
                      <small>Review only—nothing is linked automatically.</small>
                    </div>
                    <div className="encoding-household-list">
                      {householdReview.connections.slice(0, 3).map((connection) => (
                        <div key={connection.key}>
                          <span>
                            <strong>{connection.applicant.surname}, {connection.applicant.firstName} {connection.applicant.middleName}</strong>
                            <small>{connection.reasons.join(" · ")}</small>
                          </span>
                          <span>
                            <strong>{formatPeso(connection.history.totalGranted)}</strong>
                            <small>{connection.history.applicationCount} application{connection.history.applicationCount === 1 ? "" : "s"}</small>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <h3 className="section-title">5. Work & Income</h3>
                <Field label="Work/Occupation"><input value={form.work} onChange={(e) => update("work", e.target.value)} /></Field>
                <Field label="Monthly Salary (₱)"><input type="number" min="0" step=".01" value={form.salary} onFocus={selectInitialZero} onChange={(e) => update("salary", Number(e.target.value))} /></Field>
                <Field label="Employment Status"><Select value={form.employedStatus} options={["Employed", "Seasonal", "Unemployed"]} onChange={(v) => update("employedStatus", v)} /></Field>

                <h3 className="section-title">6. Status & Category</h3>
                <Field label="Civil Status *"><Select required value={form.civilStatus} options={["Single", "Married", "Widowed", "Separated"]} placeholder="Select" onChange={(v) => update("civilStatus", v)} /></Field>
                <Field label="Category *"><Select required value={form.category} options={["FHONA", "SENIOR", "PLHIV"]} placeholder="Select Category" onChange={(v) => update("category", v)} /></Field>

                <h3 className="section-title">7. Assistance Granted</h3>
                <Field label="Application Date *"><input required type="date" value={form.applicationDate} onChange={(event) => update("applicationDate", event.target.value)} /></Field>
                <Field label="Payout Date (when completed)"><input type="date" value={form.payoutDate} onChange={(event) => update("payoutDate", event.target.value)} /></Field>
                <Field label="Type of Assistance *"><Select required value={form.assistanceType} options={["Medical", "Food", "Financial", "Educational", "Funeral", "Burial", "Cash Relief"]} placeholder="Select Type" onChange={(v) => update("assistanceType", v)} /></Field>
                <Field label="Amount Requested (₱)"><input type="number" min="0" step=".01" value={form.amountRequested} onFocus={selectInitialZero} onChange={(e) => update("amountRequested", Number(e.target.value))} /></Field>
                <Field label="Amount Granted (₱) *"><input required type="number" min="0" step=".01" value={form.amount} onFocus={selectInitialZero} onChange={(e) => update("amount", Number(e.target.value))} /></Field>
                <Field label="Relationship to Beneficiary"><input value={form.relationship} placeholder="e.g. Self, Parent, Child" onChange={(e) => update("relationship", e.target.value)} /></Field>

                <h3 className="section-title">8. Beneficiary & Medical Details</h3>
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

              </div>
            </div>

            <aside className="record-photo-reference" aria-labelledby="application-photo-title">
              <div>
                <span className="eyebrow">Identity Reference</span>
                <h3 id="application-photo-title">ID Front & Back</h3>
                <p>Take clear photos of both sides. Existing records with one photo remain valid.</p>
              </div>
              <div className="record-photo-slot">
                <div className="record-photo-slot-heading">
                  <strong>ID Front</strong>
                  {form.idImage && <button type="button" onClick={() => update("idImage", null)}>Remove</button>}
                </div>
                <div
                  className={`record-photo-frame compact photo-drop-zone${form.idImage ? " has-image" : ""}${dragTarget === "idImage" ? " drag-over" : ""}`}
                  onDragEnter={(event) => { event.preventDefault(); setDragTarget("idImage"); }}
                  onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragTarget("idImage"); }}
                  onDragLeave={() => setDragTarget(null)}
                  onDrop={photoDropped("idImage")}
                >
                  {form.idImage
                    ? <Image unoptimized src={form.idImage} width={1000} height={650} alt="Front of attached ID" />
                    : <div className="record-photo-empty"><strong>Drop ID front here</strong><span>Or take/upload a clear photo using the button below.</span></div>}
                </div>
                <label className="btn secondary record-photo-button">
                  {form.idImage ? "Replace Front" : "Take or Upload Front"}
                  <input type="file" accept="image/*" capture="environment" onChange={fileChanged("idImage")} />
                </label>
              </div>
              <div className="record-photo-slot">
                <div className="record-photo-slot-heading">
                  <strong>ID Back</strong>
                  {form.idImageBack && <button type="button" onClick={() => update("idImageBack", null)}>Remove</button>}
                </div>
                <div
                  className={`record-photo-frame compact photo-drop-zone${form.idImageBack ? " has-image" : ""}${dragTarget === "idImageBack" ? " drag-over" : ""}`}
                  onDragEnter={(event) => { event.preventDefault(); setDragTarget("idImageBack"); }}
                  onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragTarget("idImageBack"); }}
                  onDragLeave={() => setDragTarget(null)}
                  onDrop={photoDropped("idImageBack")}
                >
                  {form.idImageBack
                    ? <Image unoptimized src={form.idImageBack} width={1000} height={650} alt="Back of attached ID" />
                    : <div className="record-photo-empty"><strong>Drop ID back here</strong><span>Or take/upload the reverse side using the button below.</span></div>}
                </div>
                <label className="btn secondary record-photo-button">
                  {form.idImageBack ? "Replace Back" : "Take or Upload Back"}
                  <input type="file" accept="image/*" capture="environment" onChange={fileChanged("idImageBack")} />
                </label>
              </div>
              <p className="record-photo-note">Both photos stay in the local draft and are added to the record only after Save Record.</p>
            </aside>
          </div>
          <div className="modal-footer">
            {!initialRecord && (
              <span className="draft-save-status">
                {draftSavedAt ? `Draft saved locally ${formatDraftTime(draftSavedAt)}` : "Progress saves locally as you type"}
              </span>
            )}
            <button type="button" className="btn secondary" onClick={() => void close()}>Close</button>
            {!initialRecord && (
              <button
                type="button"
                className="btn secondary"
                disabled={savingDraft || !hasDraftContent(form)}
                onClick={() => void saveDraftAndClose()}
              >
                {savingDraft ? "Saving Draft…" : "Save Draft & Close"}
              </button>
            )}
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

function formatApplicantBirthday(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-PH");
}

function formatDraftTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function hasDraftContent(record: AssistanceRecord) {
  return Boolean(
    record.surname.trim() ||
    record.firstName.trim() ||
    record.contact.trim() ||
    record.address.trim() ||
    record.birthday ||
    record.brgy ||
    record.assistanceType ||
    record.amountRequested ||
    record.amount ||
    record.remarks.trim() ||
    record.idImage ||
    record.idImageBack ||
    record.familyComposition.some((member) => member.fullName.trim()),
  );
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
