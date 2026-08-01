export type BarangayDistrictGroup = "district-1" | "outside-district-1" | "not-recorded";

export const district1Barangays = [
  "Bagong Nayon",
  "Beverly Hills",
  "De La Paz",
  "Mambugan",
  "Mayamot",
  "Munting Dilao",
  "San Isidro",
  "Santa Cruz",
] as const;

export const district2Barangays = [
  "Calawis",
  "Cupang",
  "Dalig",
  "Inarawan",
  "San Jose",
  "San Juan",
  "San Luis",
  "San Roque",
] as const;

export const antipoloBarangays = [...district1Barangays, ...district2Barangays];

const district1Keys = new Set(district1Barangays.map(normalizeTaxonomyKey));

export function canonicalBarangay(value: string): string {
  const normalized = normalizeTaxonomyKey(value);
  if (!normalized || normalized === "not recorded" || normalized === "unspecified") return "Not recorded";
  const aliases: Record<string, string> = {
    "bagong nayon": "Bagong Nayon",
    "beverly hills": "Beverly Hills",
    "de la paz": "De La Paz",
    "dela paz": "De La Paz",
    mambugan: "Mambugan",
    mayamot: "Mayamot",
    "munting dilao": "Munting Dilao",
    "munting dilaw": "Munting Dilao",
    muntingdilao: "Munting Dilao",
    muntingdilaw: "Munting Dilao",
    muntindilao: "Munting Dilao",
    muntindilaw: "Munting Dilao",
    "san isidro": "San Isidro",
    "sta cruz": "Santa Cruz",
    "santa cruz": "Santa Cruz",
    stacruz: "Santa Cruz",
    calawis: "Calawis",
    cupang: "Cupang",
    dalig: "Dalig",
    inarawan: "Inarawan",
    "san jose": "San Jose",
    "san juan": "San Juan",
    "san luis": "San Luis",
    "san roque": "San Roque",
  };
  return aliases[normalized] || titleCase(normalized);
}

export function barangayDistrictGroup(value: string): BarangayDistrictGroup {
  const canonical = canonicalBarangay(value);
  if (canonical === "Not recorded") return "not-recorded";
  return district1Keys.has(normalizeTaxonomyKey(canonical)) ? "district-1" : "outside-district-1";
}

export function canonicalCategory(value: string): string {
  const normalized = normalizeTaxonomyKey(value);
  if (!normalized || normalized === "not recorded" || normalized === "unspecified") return "Not recorded";
  if (normalized === "fhona" || normalized.includes("family heads")) return "FHONA";
  if (normalized.includes("senior")) return "Senior";
  if (normalized === "plhiv" || normalized.includes("hiv aids") || normalized.includes("living with hiv")) return "PLHIV";
  if (normalized === "pwd" || normalized.includes("person with disability") || normalized.includes("disabled")) return "PWD";
  return titleCase(normalized);
}

export function canonicalLabel(value: string): string {
  const normalized = normalizeTaxonomyKey(value);
  if (!normalized || normalized === "not recorded" || normalized === "unspecified") return "Not recorded";
  return titleCase(normalized);
}

export function normalizeTaxonomyKey(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-PH")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleCase(value: string): string {
  return value.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("en-PH"));
}
