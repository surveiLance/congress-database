"use client";

import Image from "next/image";
import { ChangeEvent, useRef, useState } from "react";
import { conditionCategories, suggestConditionCategories } from "@/lib/conditionCategories";
import { AssistanceRecord, emptyRecord } from "@/lib/types";

type Confidence = "High" | "Medium" | "Low";
type FieldKey = keyof EncoderValues;

interface EncoderValues {
  surname: string;
  firstName: string;
  middleName: string;
  suffix: string;
  birthday: string;
  sex: string;
  contact: string;
  barangay: string;
  address: string;
  occupation: string;
  monthlySalary: string;
  employmentStatus: string;
  civilStatus: string;
  category: string;
  assistanceType: string;
  amountRequested: string;
  amountGranted: string;
  beneficiaryName: string;
  relationship: string;
  diagnosis: string;
  conditionCategories: string[];
  remarks: string;
  monthlyExpenses: string;
  householdMembers: string;
  householdEmployed: string;
}

interface ExtractedField {
  confidence: Confidence;
}

interface ReviewSection {
  title: string;
  description: string;
  fields: FieldKey[];
}

const fieldOrder: FieldKey[] = [
  "surname", "firstName", "middleName", "suffix", "birthday", "sex", "contact",
  "barangay", "address", "occupation", "monthlySalary", "employmentStatus",
  "civilStatus", "category", "assistanceType", "amountRequested", "amountGranted",
  "beneficiaryName", "relationship", "diagnosis", "conditionCategories", "remarks",
  "monthlyExpenses", "householdMembers", "householdEmployed",
];

const labels: Record<FieldKey, string> = {
  surname: "Surname", firstName: "First Name", middleName: "Middle Name", suffix: "Suffix",
  birthday: "Birthday", sex: "Sex", contact: "Contact", barangay: "Barangay",
  address: "Address", occupation: "Occupation", monthlySalary: "Monthly Salary",
  employmentStatus: "Employment Status", civilStatus: "Civil Status", category: "Category",
  assistanceType: "Assistance Type", amountRequested: "Amount Requested",
  amountGranted: "Amount Granted", beneficiaryName: "Beneficiary Name",
  relationship: "Relationship", diagnosis: "Diagnosis", conditionCategories: "Condition Categories",
  remarks: "Remarks", monthlyExpenses: "Monthly Expenses",
  householdMembers: "Total Household Members",
  householdEmployed: "Household Employed Count",
};

const selectOptions: Partial<Record<FieldKey, string[]>> = {
  sex: ["Male", "Female"],
  barangay: ["Dela Paz", "San Isidro", "Sta.cruz", "Bagong Nayon", "Mambugan", "Mayamot", "Beverly Hills", "Muntindilaw"],
  employmentStatus: ["Employed", "Seasonal", "Unemployed"],
  civilStatus: ["Single", "Married", "Widowed", "Separated"],
  category: ["FHONA", "SENIOR", "PLHIV"],
  assistanceType: ["Medical", "Financial", "Educational", "Burial"],
};

const numericFields = new Set<FieldKey>(["monthlySalary", "amountRequested", "amountGranted", "monthlyExpenses", "householdMembers", "householdEmployed"]);
const longTextFields = new Set<FieldKey>(["address", "diagnosis", "remarks"]);
const requiredFields: FieldKey[] = ["surname", "firstName", "birthday", "sex", "contact", "barangay", "address", "civilStatus", "category", "assistanceType", "amountGranted"];
const reviewSections: ReviewSection[] = [
  {
    title: "Applicant",
    description: "Name, birthday, sex, and contact information",
    fields: ["surname", "firstName", "middleName", "suffix", "birthday", "sex", "contact"],
  },
  {
    title: "Address",
    description: "Barangay and complete residential address",
    fields: ["barangay", "address"],
  },
  {
    title: "Work & Status",
    description: "Employment, income, civil status, and applicant category",
    fields: ["occupation", "monthlySalary", "employmentStatus", "civilStatus", "category"],
  },
  {
    title: "Assistance",
    description: "Requested assistance and approved amounts",
    fields: ["assistanceType", "amountRequested", "amountGranted"],
  },
  {
    title: "Medical & Beneficiary",
    description: "Beneficiary, diagnosis, condition categories, and remarks",
    fields: ["beneficiaryName", "relationship", "diagnosis", "conditionCategories", "remarks"],
  },
  {
    title: "Household",
    description: "Household size, monthly expenses, and employed members",
    fields: ["householdMembers", "householdEmployed", "monthlyExpenses"],
  },
];

export default function ApplicationDocumentEncoder({ onSave }: { onSave: (record: AssistanceRecord) => Promise<void> }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [values, setValues] = useState<EncoderValues | null>(null);
  const [fieldMeta, setFieldMeta] = useState<Record<FieldKey, ExtractedField> | null>(null);
  const [confirmed, setConfirmed] = useState<FieldKey[]>([]);
  const [activeSection, setActiveSection] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setImageData(await fileToDataUrl(file));
    setValues(emptyEncoderValues());
    setFieldMeta(emptyFieldMeta());
    setConfirmed([]);
    setActiveSection(0);
    setOcrText("");
    setExtracting(true);
    setMessage("Reading the complete image with local OCR. This can take a moment.");
    setError("");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      try {
        const result = await worker.recognize(file);
        const rawText = result.data.text.trim();
        setOcrText(rawText);
        if (!rawText) {
          setMessage("");
          setError("No readable text was found. Try a clearer, upright image or enter the details manually.");
          return;
        }
        const extraction = extractApplicationFromOcr(rawText);
        setValues(extraction.values);
        setFieldMeta(extraction.meta);
        const detectedCount = fieldOrder.filter((key) => hasEncoderValue(extraction.values[key])).length;
        setMessage(`OCR finished. ${detectedCount} of ${fieldOrder.length} fields were detected. Review the image and correct every value before saving.`);
      } finally {
        await worker.terminate();
      }
    } catch (reason) {
      console.error(reason);
      setMessage("");
      setError("The image could not be read by OCR. Try a clearer image or use manual entry.");
    } finally {
      setExtracting(false);
    }
  };

  const update = <Key extends FieldKey>(key: Key, value: EncoderValues[Key]) => {
    setValues((current) => current ? { ...current, [key]: value } : current);
    setConfirmed((current) => current.includes(key) ? current : [...current, key]);
  };

  const toggleConfirmed = (key: FieldKey) => {
    setConfirmed((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  };

  const acceptHighConfidence = () => {
    if (!fieldMeta) return;
    const highFields = fieldOrder.filter((key) => fieldMeta[key].confidence === "High");
    setConfirmed((current) => Array.from(new Set([...current, ...highFields])));
  };

  const confirmCurrentSection = () => {
    const sectionFields = reviewSections[activeSection].fields;
    setConfirmed((current) => Array.from(new Set([...current, ...sectionFields])));
  };

  const clear = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setImageData(null);
    setValues(null);
    setFieldMeta(null);
    setConfirmed([]);
    setActiveSection(0);
    setExtracting(false);
    setOcrText("");
    setMessage("");
    setError("");
    if (fileInput.current) fileInput.current.value = "";
  };

  const confirmAndSave = async () => {
    if (!values || confirmed.length !== fieldOrder.length) {
      setError("Review and confirm every extracted field before saving.");
      return;
    }
    const missing = requiredFields.filter((key) => !String(values[key]).trim());
    if (missing.length) {
      setError(`Complete the required fields: ${missing.map((key) => labels[key]).join(", ")}.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const now = new Date().toISOString();
      await onSave({
        ...emptyRecord,
        surname: values.surname,
        firstName: values.firstName,
        middleName: values.middleName,
        suffix: values.suffix,
        birthday: values.birthday,
        age: calculateAge(values.birthday),
        sex: values.sex,
        contact: values.contact,
        brgy: values.barangay,
        address: values.address,
        work: values.occupation,
        salary: Number(values.monthlySalary) || 0,
        employedStatus: values.employmentStatus,
        civilStatus: values.civilStatus,
        category: values.category,
        assistanceType: values.assistanceType,
        amountRequested: Number(values.amountRequested) || 0,
        amount: Number(values.amountGranted) || 0,
        benName: values.beneficiaryName,
        relationship: values.relationship,
        diagnosis: values.diagnosis,
        conditionCategories: values.conditionCategories,
        remarks: values.remarks,
        monthlyExpenses: Number(values.monthlyExpenses) || 0,
        householdMembers: Number(values.householdMembers) || 0,
        totalEmployed: Number(values.householdEmployed) || 0,
        idImage: imageData,
        createdAt: now,
        updatedAt: now,
      });
      clear();
      setMessage("Application confirmed and saved to the local database.");
    } catch (reason) {
      console.error(reason);
      setError("The confirmed application could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const confirmedCount = confirmed.length;
  const currentSection = reviewSections[activeSection];
  const currentSectionConfirmed = currentSection.fields.filter((field) => confirmed.includes(field)).length;

  return (
    <section className="encoder-panel" aria-labelledby="encoder-title">
      <div className="encoder-heading">
        <div>
          <h2 id="encoder-title">Application Document Encoder</h2>
          <p>Upload the complete application image. Local OCR fills only the details it can read for staff review.</p>
        </div>
        {values && <span className="encoder-progress">{confirmedCount}/{fieldOrder.length} confirmed</span>}
      </div>

      {!values && (
        <div className="encoder-upload">
          <input ref={fileInput} type="file" accept="image/*" onChange={(event) => void upload(event)} />
          <span>The selected image remains local until the reviewed record is saved.</span>
        </div>
      )}

      {message && <div className="notice success" role="status">{message}</div>}
      {error && <div className="notice error" role="alert">{error}</div>}

      {values && fieldMeta && (
        <>
          <div className="encoder-toolbar">
            <button className="btn secondary" type="button" disabled={extracting} onClick={acceptHighConfidence}>Accept All High Confidence Fields</button>
            <button className="btn secondary" type="button" onClick={clear}>Clear Extraction</button>
          </div>
          <nav className="encoder-section-nav" aria-label="Application review sections">
            {reviewSections.map((section, index) => {
              const sectionConfirmed = section.fields.filter((field) => confirmed.includes(field)).length;
              return (
                <button
                  className={`encoder-section-tab${activeSection === index ? " active" : ""}${sectionConfirmed === section.fields.length ? " complete" : ""}`}
                  type="button"
                  key={section.title}
                  onClick={() => setActiveSection(index)}
                  aria-current={activeSection === index ? "step" : undefined}
                >
                  <span>{index + 1}</span>
                  <strong>{section.title}</strong>
                  <small>{sectionConfirmed}/{section.fields.length}</small>
                </button>
              );
            })}
          </nav>
          <div className="encoder-workspace">
            <div className="encoder-preview">
              <div className="encoder-preview-heading">
                <div><h3>Complete Source Image</h3><p>Compare every value with the uploaded document.</p></div>
                {previewUrl && <a href={previewUrl} target="_blank" rel="noreferrer">Open full size</a>}
              </div>
              {previewUrl && <Image unoptimized src={previewUrl} width={900} height={1200} alt="Uploaded application preview" />}
              <details className="encoder-ocr-text">
                <summary>{extracting ? "Reading OCR text…" : "View raw OCR text"}</summary>
                <pre>{ocrText || (extracting ? "Processing the complete image…" : "No OCR text was recognized.")}</pre>
              </details>
            </div>
            <div className="encoder-section">
              <div className="encoder-section-heading">
                <div>
                  <span>Section {activeSection + 1} of {reviewSections.length}</span>
                  <h3>{currentSection.title}</h3>
                  <p>{currentSection.description}</p>
                </div>
                <button className="btn secondary small" type="button" disabled={extracting} onClick={confirmCurrentSection}>
                  Confirm This Section
                </button>
              </div>
              <div className="encoder-review">
                {currentSection.fields.map((key) => (
                  <ReviewField
                    key={key}
                    fieldKey={key}
                    value={values[key]}
                    confidence={fieldMeta[key].confidence}
                    confirmed={confirmed.includes(key)}
                    onConfirm={() => toggleConfirmed(key)}
                    onChange={(value) => update(key, value as never)}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="encoder-save">
            <div className="encoder-step-actions">
              <button className="btn secondary" type="button" disabled={activeSection === 0} onClick={() => setActiveSection((current) => current - 1)}>Previous</button>
              <button className="btn secondary" type="button" disabled={activeSection === reviewSections.length - 1} onClick={() => setActiveSection((current) => current + 1)}>Next</button>
            </div>
            <span>
              {confirmedCount === fieldOrder.length
                ? "All fields reviewed."
                : `${currentSectionConfirmed}/${currentSection.fields.length} in this section · ${fieldOrder.length - confirmedCount} remaining`}
            </span>
            <button className="btn" type="button" disabled={extracting || saving || confirmedCount !== fieldOrder.length} onClick={() => void confirmAndSave()}>
              {saving ? "Saving..." : "Confirm and Save"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function ReviewField<Key extends FieldKey>({ fieldKey, value, confidence, confirmed, onConfirm, onChange }: {
  fieldKey: Key;
  value: EncoderValues[Key];
  confidence: Confidence;
  confirmed: boolean;
  onConfirm: () => void;
  onChange: (value: EncoderValues[Key]) => void;
}) {
  const options = selectOptions[fieldKey];
  return (
    <article className={`encoder-field${confidence === "Low" ? " low-confidence" : ""}${confirmed ? " confirmed" : ""}`}>
      <div className="encoder-field-heading">
        <label htmlFor={`encoder-${fieldKey}`}>{labels[fieldKey]}</label>
        <span className={`confidence ${confidence.toLowerCase()}`}>{confidence}</span>
      </div>
      {fieldKey === "conditionCategories" ? (
        <div id={`encoder-${fieldKey}`} className="encoder-condition-options">
          {conditionCategories.map((category) => (
            <label key={category}>
              <input
                type="checkbox"
                checked={(value as string[]).includes(category)}
                onChange={() => {
                  const categories = value as string[];
                  onChange((categories.includes(category) ? categories.filter((item) => item !== category) : [...categories, category]) as EncoderValues[Key]);
                }}
              />
              <span>{category}</span>
            </label>
          ))}
        </div>
      ) : options ? (
        <select id={`encoder-${fieldKey}`} value={value as string} onChange={(event) => onChange(event.target.value as EncoderValues[Key])}>
          <option value="">Select</option>{options.map((option) => <option key={option}>{option}</option>)}
        </select>
      ) : longTextFields.has(fieldKey) ? (
        <textarea id={`encoder-${fieldKey}`} rows={2} value={value as string} onChange={(event) => onChange(event.target.value as EncoderValues[Key])} />
      ) : (
        <input
          id={`encoder-${fieldKey}`}
          type={fieldKey === "birthday" ? "date" : numericFields.has(fieldKey) ? "number" : "text"}
          min={numericFields.has(fieldKey) ? "0" : undefined}
          step={numericFields.has(fieldKey) ? ".01" : undefined}
          value={value as string}
          onChange={(event) => onChange(event.target.value as EncoderValues[Key])}
        />
      )}
      <button className={`field-confirm${confirmed ? " active" : ""}`} type="button" onClick={onConfirm}>
        {confirmed ? "Confirmed ✓" : "Confirm Field"}
      </button>
    </article>
  );
}

function emptyEncoderValues(): EncoderValues {
  return {
    surname: "", firstName: "", middleName: "", suffix: "", birthday: "", sex: "", contact: "",
    barangay: "", address: "", occupation: "", monthlySalary: "", employmentStatus: "",
    civilStatus: "", category: "", assistanceType: "", amountRequested: "", amountGranted: "",
    beneficiaryName: "", relationship: "", diagnosis: "", conditionCategories: [], remarks: "",
    monthlyExpenses: "", householdMembers: "", householdEmployed: "",
  };
}

function emptyFieldMeta(): Record<FieldKey, ExtractedField> {
  return Object.fromEntries(fieldOrder.map((key) => [key, { confidence: "Low" }])) as Record<FieldKey, ExtractedField>;
}

function hasEncoderValue(value: string | string[]) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value.trim());
}

function extractApplicationFromOcr(rawText: string): { values: EncoderValues; meta: Record<FieldKey, ExtractedField> } {
  const values = emptyEncoderValues();
  const meta = emptyFieldMeta();
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/[|[\]{}]/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const normalizedText = lines.join("\n");

  const setValue = <Key extends FieldKey>(key: Key, value: EncoderValues[Key], confidence: Confidence = "High") => {
    if (!hasEncoderValue(value)) return;
    values[key] = value;
    meta[key] = { confidence };
  };

  setValue("surname", titleCase(labeledValue(lines, [
    /(?:apelyido\s*\/?\s*last\s*name|surname)\s*:?\s*(.*)$/i,
  ])));
  setValue("firstName", titleCase(labeledValue(lines, [
    /(?:mga\s+pangalan\s*\/?\s*given\s*names?|given\s*names?|first\s*name)\s*:?\s*(.*)$/i,
  ])));
  setValue("middleName", titleCase(labeledValue(lines, [
    /(?:gitnang\s+apelyido\s*\/?\s*middle\s*name|middle\s*name)\s*:?\s*(.*)$/i,
  ])));
  setValue("suffix", titleCase(labeledValue(lines, [/(?:suffix|name\s+extension)\s*:?\s*(.*)$/i])));

  const birthdayText = labeledValue(lines, [
    /(?:petsa\s+ng\s+kapanganakan\s*\/?\s*date\s+of\s+birth|date\s+of\s+birth|birthday|birth\s*date)\s*:?\s*(.*)$/i,
  ]);
  setValue("birthday", normalizeDateValue(birthdayText));

  const sexText = labeledValue(lines, [/(?:kasarian\s*\/?\s*sex|sex|gender)\s*:?\s*(.*)$/i]);
  setValue("sex", normalizeOption(sexText, ["Male", "Female"]));
  if (!values.sex) {
    const standaloneSex = lines.find((line) => /^(male|female|lalaki|babae)$/i.test(line));
    setValue("sex", normalizeOption(standaloneSex || "", ["Male", "Female"]), "Medium");
  }

  const phone = normalizedText.match(/(?:\+?63|0)\s*9\d{2}[\s-]?\d{3}[\s-]?\d{4}/)?.[0] || "";
  setValue("contact", phone.replace(/\s+/g, " "), "Medium");

  const address = multilineAfterLabel(lines, /(?:tirahan\s*\/?\s*address|complete\s+address|address)\s*:?\s*(.*)$/i, 3);
  setValue("address", titleCaseAddress(address));
  const barangay = selectOptions.barangay?.find((item) => normalizedText.toLowerCase().includes(item.toLowerCase())) || "";
  setValue("barangay", barangay, "Medium");

  setValue("occupation", titleCase(labeledValue(lines, [/(?:occupation|hanapbuhay|work)\s*:?\s*(.*)$/i])));
  setValue("monthlySalary", moneyValue(labeledValue(lines, [/(?:monthly\s+(?:salary|income)|buwanang\s+kita)\s*:?\s*(.*)$/i])));
  setValue("employmentStatus", normalizeOption(labeledValue(lines, [/(?:employment\s+status)\s*:?\s*(.*)$/i]), ["Employed", "Seasonal", "Unemployed"]));
  setValue("civilStatus", normalizeOption(labeledValue(lines, [/(?:civil\s+status)\s*:?\s*(.*)$/i]), ["Single", "Married", "Widowed", "Separated"]));
  setValue("category", normalizeOption(labeledValue(lines, [/(?:applicant\s+category|category)\s*:?\s*(.*)$/i]), ["FHONA", "SENIOR", "PLHIV"]));
  setValue("assistanceType", normalizeOption(labeledValue(lines, [/(?:type\s+of\s+assistance|assistance\s+type)\s*:?\s*(.*)$/i]), ["Medical", "Financial", "Educational", "Burial"]));
  setValue("amountRequested", moneyValue(labeledValue(lines, [/(?:amount\s+requested)\s*:?\s*(.*)$/i])));
  setValue("amountGranted", moneyValue(labeledValue(lines, [/(?:amount\s+granted|approved\s+amount)\s*:?\s*(.*)$/i])));
  setValue("beneficiaryName", titleCase(labeledValue(lines, [/(?:beneficiary\s+(?:full\s+)?name)\s*:?\s*(.*)$/i])));
  setValue("relationship", titleCase(labeledValue(lines, [/(?:relationship(?:\s+to\s+beneficiary)?)\s*:?\s*(.*)$/i])));
  setValue("diagnosis", labeledValue(lines, [/(?:diagnosis|medical\s+condition)\s*:?\s*(.*)$/i]));
  setValue("remarks", labeledValue(lines, [/(?:remarks|notes)\s*:?\s*(.*)$/i]));
  setValue("monthlyExpenses", moneyValue(labeledValue(lines, [/(?:monthly\s+expenses)\s*:?\s*(.*)$/i])));
  setValue("householdMembers", moneyValue(labeledValue(lines, [/(?:total\s+(?:household|family)\s+members|household\s+size|family\s+size)\s*:?\s*(.*)$/i])));
  setValue("householdEmployed", moneyValue(labeledValue(lines, [/(?:household\s+employed(?:\s+count)?|total\s+employed)\s*:?\s*(.*)$/i])));

  const suggestedCategories = suggestConditionCategories(values.diagnosis);
  if (suggestedCategories.length) setValue("conditionCategories", suggestedCategories, "Medium");

  return { values, meta };
}

function labeledValue(lines: string[], patterns: RegExp[]) {
  for (let index = 0; index < lines.length; index += 1) {
    for (const pattern of patterns) {
      const match = lines[index].match(pattern);
      if (!match) continue;
      const sameLineValue = cleanExtractedValue(match[1] || "");
      if (sameLineValue) return sameLineValue;
      const nextLine = lines.slice(index + 1, index + 3).find((line) => !isLabelLine(line));
      if (nextLine) return cleanExtractedValue(nextLine);
    }
  }
  return "";
}

function multilineAfterLabel(lines: string[], pattern: RegExp, maximumLines: number) {
  const index = lines.findIndex((line) => pattern.test(line));
  if (index < 0) return "";
  const match = lines[index].match(pattern);
  const collected: string[] = [];
  const sameLine = cleanExtractedValue(match?.[1] || "");
  if (sameLine) collected.push(sameLine);
  for (let cursor = index + 1; cursor < lines.length && collected.length < maximumLines; cursor += 1) {
    if (isLabelLine(lines[cursor])) break;
    if (/^(?:digital\s+id|philsys|pcn|qr|signature)/i.test(lines[cursor])) break;
    collected.push(cleanExtractedValue(lines[cursor]));
  }
  return collected.filter(Boolean).join(", ");
}

function isLabelLine(value: string) {
  return /(?:last\s*name|surname|given\s*names?|first\s*name|middle\s*name|date\s+of\s+birth|birthday|sex|gender|address|occupation|civil\s+status|category|assistance|amount|beneficiary|relationship|diagnosis|remarks|monthly|household)\s*:?\s*$/i.test(value)
    || /(?:apelyido|mga\s+pangalan|gitnang|kapanganakan|tirahan)\s*\/?/i.test(value);
}

function cleanExtractedValue(value: string) {
  return value.replace(/^[:\-–—\s]+|[:\-–—\s]+$/g, "").replace(/\s+/g, " ").trim();
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b[\p{L}'][\p{L}'-]*/gu, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function titleCaseAddress(value: string) {
  return titleCase(value).replace(/\b(?:St|Rd|Ave|Brgy)\b/g, (word) => word);
}

function normalizeOption(value: string, options: string[]) {
  const normalized = value.toLowerCase();
  if (normalized.includes("babae")) return "Female";
  if (normalized.includes("lalaki")) return "Male";
  return options.find((option) => normalized.includes(option.toLowerCase())) || "";
}

function moneyValue(value: string) {
  return value.replace(/[^\d.]/g, "");
}

function normalizeDateValue(value: string) {
  if (!value) return "";
  const monthNames: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  };
  const named = value.toLowerCase().match(/([a-z]+)\s+(\d{1,2})[,\s]+(\d{4})/);
  if (named && monthNames[named[1]]) return dateParts(Number(named[3]), monthNames[named[1]], Number(named[2]));
  const numeric = value.match(/\b(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})\b/);
  if (!numeric) return "";
  if (numeric[1].length === 4) return dateParts(Number(numeric[1]), Number(numeric[2]), Number(numeric[3]));
  const year = Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]);
  const first = Number(numeric[1]);
  const second = Number(numeric[2]);
  return first > 12 ? dateParts(year, second, first) : dateParts(year, first, second);
}

function dateParts(year: number, month: number, day: number) {
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return "";
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function calculateAge(birthday: string) {
  const date = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  if (today.getMonth() < date.getMonth() || (today.getMonth() === date.getMonth() && today.getDate() < date.getDate())) age -= 1;
  return String(Math.max(0, age));
}
