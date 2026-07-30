import {
  applicantIdentityKey,
  ApplicantHistory,
  buildApplicantHistories,
  normalizeIdentityPart,
} from "./applicantIdentity";
import { AssistanceRecord, FamilyMember } from "./types";

export interface HouseholdConnection {
  key: string;
  applicant: AssistanceRecord;
  history: ApplicantHistory;
  status: "confirmed" | "possible";
  score: number;
  reasons: string[];
  declaredRelationship: string;
}

export interface HouseholdSummary {
  connections: HouseholdConnection[];
  confirmedConnections: HouseholdConnection[];
  possibleConnections: HouseholdConnection[];
  confirmedPeople: number;
  confirmedApplications: number;
  confirmedAssistance: number;
}

export function householdSummaryForRecord(
  record: AssistanceRecord,
  allRecords: AssistanceRecord[],
  historiesOverride?: Map<string, ApplicantHistory>,
): HouseholdSummary {
  const currentKey = applicantIdentityKey(record);
  const histories = historiesOverride || buildApplicantHistories(allRecords);
  const currentHistory = histories.get(currentKey);
  const currentApplications = currentHistory?.records || [record];
  const profileRecord: AssistanceRecord = {
    ...record,
    familyComposition: mergeFamilyComposition(currentApplications),
    confirmedRelativeKeys: mergeKeys(currentApplications, "confirmedRelativeKeys"),
    dismissedRelativeKeys: mergeKeys(currentApplications, "dismissedRelativeKeys"),
  };

  const connections = Array.from(histories.values())
    .filter((history) => history.key && history.key !== currentKey)
    .map((history) => scoreHouseholdConnection(profileRecord, history, currentKey))
    .filter((connection): connection is HouseholdConnection => Boolean(connection))
    .filter((connection) => !profileRecord.dismissedRelativeKeys.includes(connection.key))
    .sort((first, second) =>
      Number(second.status === "confirmed") - Number(first.status === "confirmed") ||
      second.score - first.score ||
      applicantName(first.applicant).localeCompare(applicantName(second.applicant)),
    )
    .slice(0, 8);

  const confirmedConnections = connections.filter((connection) => connection.status === "confirmed");
  const possibleConnections = connections.filter((connection) => connection.status === "possible");
  return {
    connections,
    confirmedConnections,
    possibleConnections,
    confirmedPeople: 1 + confirmedConnections.length,
    confirmedApplications: (currentHistory?.applicationCount || 1) +
      confirmedConnections.reduce((total, connection) => total + connection.history.applicationCount, 0),
    confirmedAssistance: (currentHistory?.totalGranted || record.amount) +
      confirmedConnections.reduce((total, connection) => total + connection.history.totalGranted, 0),
  };
}

function scoreHouseholdConnection(
  record: AssistanceRecord,
  history: ApplicantHistory,
  currentKey: string,
): HouseholdConnection | null {
  const applicant = history.latestApplication;
  const applicantProfile: AssistanceRecord = {
    ...applicant,
    familyComposition: mergeFamilyComposition(history.records),
    confirmedRelativeKeys: mergeKeys(history.records, "confirmedRelativeKeys"),
    dismissedRelativeKeys: mergeKeys(history.records, "dismissedRelativeKeys"),
  };
  const candidateKey = history.key;
  const reasons: string[] = [];
  let score = 0;
  let declaredRelationship = "";

  const declaredMember = findDeclaredMember(record.familyComposition, applicant);
  if (declaredMember) {
    declaredRelationship = declaredMember.relationship;
    const birthdayMatches = Boolean(declaredMember.birthday && declaredMember.birthday === applicant.birthday);
    score += birthdayMatches ? 80 : 58;
    reasons.push(birthdayMatches ? "Listed family member · birthday matches" : "Listed in family composition");
  }

  const reverseMember = findDeclaredMember(applicantProfile.familyComposition, record);
  if (reverseMember) {
    declaredRelationship ||= reverseMember.relationship;
    const birthdayMatches = Boolean(reverseMember.birthday && reverseMember.birthday === record.birthday);
    score += birthdayMatches ? 75 : 55;
    reasons.push("Applicant is listed in their family composition");
  }

  const recordSurname = usableNamePart(record.surname);
  const applicantSurname = usableNamePart(applicant.surname);
  const recordMiddleName = usableMiddleName(record.middleName);
  const applicantMiddleName = usableMiddleName(applicant.middleName);
  const sameSurname = Boolean(recordSurname && recordSurname === applicantSurname);
  const sameMiddleName = Boolean(recordMiddleName && recordMiddleName === applicantMiddleName);
  const surnameMiddleLink = Boolean(
    (recordSurname && recordSurname === applicantMiddleName) ||
    (applicantSurname && applicantSurname === recordMiddleName),
  );

  if (sameSurname && sameMiddleName) {
    score += 72;
    reasons.push("Same surname and middle name");
  } else {
    if (sameSurname) {
      score += 28;
      reasons.push("Same surname");
    }
    if (sameMiddleName) {
      score += 32;
      reasons.push("Same middle name");
    }
  }
  if (surnameMiddleLink) {
    score += 54;
    reasons.push("Surname matches the other applicant's middle name");
  }

  const sameAddress = normalizedAddress(record.address) &&
    normalizedAddress(record.address) === normalizedAddress(applicant.address);
  const hasNameLink = sameSurname || sameMiddleName || surnameMiddleLink;
  if (sameAddress && (hasNameLink || declaredMember || reverseMember)) {
    score += 24;
    reasons.push("Same recorded address");
  }

  const sameContact = normalizedContact(record.contact) &&
    normalizedContact(record.contact) === normalizedContact(applicant.contact);
  if (sameContact && (hasNameLink || declaredMember || reverseMember)) {
    score += 28;
    reasons.push("Same contact number");
  }

  const confirmed = (
    record.confirmedRelativeKeys.includes(candidateKey) &&
    !record.dismissedRelativeKeys.includes(candidateKey)
  ) || (
    applicantProfile.confirmedRelativeKeys.includes(currentKey) &&
    !applicantProfile.dismissedRelativeKeys.includes(currentKey)
  );
  if (confirmed && !reasons.length) reasons.push("Relationship confirmed by staff");
  const hasFamilyEvidence = hasNameLink || Boolean(declaredMember) || Boolean(reverseMember);
  if (!confirmed && (!hasFamilyEvidence || score < 52)) return null;

  return {
    key: candidateKey,
    applicant,
    history,
    status: confirmed ? "confirmed" : "possible",
    score: Math.min(100, score),
    reasons: Array.from(new Set(reasons)),
    declaredRelationship,
  };
}

function findDeclaredMember(family: FamilyMember[], applicant: AssistanceRecord): FamilyMember | null {
  const candidateNames = applicantNameVariants(applicant);
  return family.find((member) => candidateNames.has(normalizeIdentityPart(member.fullName))) || null;
}

function applicantNameVariants(record: AssistanceRecord): Set<string> {
  return new Set([
    `${record.firstName} ${record.middleName} ${record.surname}`,
    `${record.firstName} ${record.surname}`,
    `${record.surname} ${record.firstName} ${record.middleName}`,
    `${record.surname} ${record.firstName}`,
  ].map(normalizeIdentityPart).filter(Boolean));
}

function applicantName(record: AssistanceRecord): string {
  return `${record.surname}, ${record.firstName} ${record.middleName}`.replace(/\s+/g, " ").trim();
}

function mergeFamilyComposition(records: AssistanceRecord[]): FamilyMember[] {
  const members = new Map<string, FamilyMember>();
  records.forEach((application) => {
    application.familyComposition.forEach((member) => {
      const key = `${normalizeIdentityPart(member.fullName)}|${member.birthday}`;
      if (key !== "|") members.set(key, member);
    });
  });
  return Array.from(members.values());
}

function mergeKeys(
  records: AssistanceRecord[],
  field: "confirmedRelativeKeys" | "dismissedRelativeKeys",
): string[] {
  return Array.from(new Set(records.flatMap((application) => application[field])));
}

function normalizedAddress(value: string): string {
  const normalized = normalizeIdentityPart(value)
    .replace(/\b(?:street|st|road|rd|avenue|ave|barangay|brgy)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const genericLocations = new Set([
    "antipolo",
    "antipolocity",
    "cityofantipolo",
    "notrecorded",
    "na",
    "none",
  ]);
  return genericLocations.has(normalized) ? "" : normalized;
}

function normalizedContact(value: string): string {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 7 ? digits.slice(-10) : "";
}

function usableNamePart(value: string): string {
  const normalized = normalizeIdentityPart(value);
  return ["", "notrecorded", "na", "none", "unknown"].includes(normalized) ? "" : normalized;
}

function usableMiddleName(value: string): string {
  const normalized = usableNamePart(value);
  const letters = normalized.replace(/[^a-z0-9]/g, "");
  return letters.length > 1 ? normalized : "";
}
