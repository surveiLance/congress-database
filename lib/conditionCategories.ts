export const conditionCategories = [
  "Kidney or renal",
  "Cancer",
  "Cardiovascular",
  "Respiratory",
  "Diabetes",
  "Disability",
  "Pregnancy or maternal",
  "Injury or accident",
  "Infectious disease",
  "Mental health",
  "Other",
] as const;

export type ConditionCategory = (typeof conditionCategories)[number];

const keywordRules: { category: ConditionCategory; pattern: RegExp }[] = [
  { category: "Kidney or renal", pattern: /kidney|renal|dialysis|nephri/ },
  { category: "Cancer", pattern: /cancer|tumou?r|oncolog|carcinoma|leukemia|lymphoma/ },
  { category: "Cardiovascular", pattern: /heart|cardiac|cardio|hypertension|stroke|blood pressure/ },
  { category: "Respiratory", pattern: /asthma|lung|pneumonia|respiratory|copd|bronch|emphysema/ },
  { category: "Diabetes", pattern: /diabet|blood sugar|hyperglyc/ },
  { category: "Disability", pattern: /disabil|pwd|paraly|blind|deaf|amput|cerebral palsy|autis/ },
  { category: "Pregnancy or maternal", pattern: /pregnan|maternal|obstetric|prenatal|postpartum|miscarriage/ },
  { category: "Injury or accident", pattern: /injur|fracture|wound|accident|trauma|burn/ },
  { category: "Infectious disease", pattern: /infect|tuberculosis|\btb\b|dengue|covid|hepatitis|hiv|aids|malaria|measles/ },
  { category: "Mental health", pattern: /depress|anxiety|mental|psychiatric|bipolar|schizo|ptsd/ },
];

export function suggestConditionCategories(diagnosis: string): ConditionCategory[] {
  const normalized = diagnosis.trim().toLowerCase();
  if (!normalized) return [];
  const suggestions = keywordRules.filter(({ pattern }) => pattern.test(normalized)).map(({ category }) => category);
  return suggestions.length ? suggestions : ["Other"];
}

export function normalizeConditionCategories(value: unknown): ConditionCategory[] {
  let values: unknown[] = [];
  if (Array.isArray(value)) {
    values = value;
  } else if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        values = Array.isArray(parsed) ? parsed : [];
      } catch {
        values = trimmed.split(/[,;|]/);
      }
    } else {
      values = trimmed.split(/[,;|]/);
    }
  }
  return Array.from(new Set(values.map((item) => String(item).trim()).filter((item): item is ConditionCategory =>
    conditionCategories.includes(item as ConditionCategory),
  )));
}
