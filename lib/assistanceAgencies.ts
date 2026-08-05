export const assistanceAgencies = ["DSWD", "DOH", "CHED", "TESDA", "DOLE", "Other"] as const;

const agencyOrder = new Map<string, number>(assistanceAgencies.map((agency, index) => [agency.toLowerCase(), index]));

export function normalizeAssistanceAgencies(value: unknown, legacyOtherAgencies?: unknown): string[] {
  const explicit = parseStringArray(value);
  const source = explicit.length ? explicit : ["DSWD", ...parseStringArray(legacyOtherAgencies)];
  return Array.from(new Set(source.map(canonicalAgency).filter(Boolean))).sort(compareAgencies);
}

export function formatAgencyCombination(value: string[]): string {
  return normalizeAssistanceAgencies(value).join(" + ");
}

export function agencyCombinationKey(value: string[]): string {
  return normalizeAssistanceAgencies(value).map((agency) => agency.toLowerCase()).join("|");
}

export function agencyFilterMatches(agencies: string[], filterValue: string): boolean {
  if (!filterValue) return true;
  const normalized = normalizeAssistanceAgencies(agencies);
  if (filterValue.startsWith("contains:")) {
    const requested = canonicalAgency(filterValue.slice("contains:".length));
    return normalized.includes(requested);
  }
  if (filterValue.startsWith("exact:")) {
    return agencyCombinationKey(normalized) === filterValue.slice("exact:".length);
  }
  return true;
}

export function agencyFilterLabel(filterValue: string): string {
  if (filterValue.startsWith("contains:")) return `Includes ${canonicalAgency(filterValue.slice("contains:".length))}`;
  if (filterValue.startsWith("exact:")) {
    const agencies = filterValue.slice("exact:".length).split("|").filter(Boolean).map(canonicalAgency);
    return `${agencies.join(" + ")} only`;
  }
  return "All agency combinations";
}

function canonicalAgency(value: string): string {
  const trimmed = String(value || "").trim();
  const known = assistanceAgencies.find((agency) => agency.toLowerCase() === trimmed.toLowerCase());
  return known || trimmed;
}

function compareAgencies(first: string, second: string): number {
  const firstOrder = agencyOrder.get(first.toLowerCase()) ?? assistanceAgencies.length;
  const secondOrder = agencyOrder.get(second.toLowerCase()) ?? assistanceAgencies.length;
  return firstOrder - secondOrder || first.localeCompare(second);
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.map(String).map((item) => item.trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
}
