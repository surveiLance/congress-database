import type { RecordFilters } from "@/components/AdvancedFilters";
import { agencyFilterMatches } from "./assistanceAgencies";
import { applicantIdentityKey, buildApplicantHistories } from "./applicantIdentity";
import { barangayDistrictGroup, canonicalBarangay, canonicalCategory } from "./recordTaxonomy";
import { AssistanceRecord, recordPayoutDate } from "./types";

export function filterAndSortRecords(
  records: AssistanceRecord[],
  query: string,
  filters: RecordFilters,
): AssistanceRecord[] {
  const visible = records.filter((record) => filters.status === "archived" ? Boolean(record.archivedAt) : !record.archivedAt);
  const histories = buildApplicantHistories(visible);
  const globalQuery = searchTokens(query);
  const nameQuery = searchTokens(filters.name);
  const diagnosisQuery = searchTokens(filters.diagnosis);
  return visible
    .filter((record) => recordMatches(record, globalQuery, nameQuery, diagnosisQuery, filters))
    .sort((first, second) => compareRecords(first, second, filters.sort, histories));
}

function recordMatches(
  record: AssistanceRecord,
  globalQuery: string[],
  nameQuery: string[],
  diagnosisQuery: string[],
  filters: RecordFilters,
) {
  const legacySearch = record.legacyApplication ? Object.values(record.legacyApplication).join(" ") : "";
  const searchable = normalizeSearchText(Object.values(record)
    .filter((value) => typeof value !== "string" || !value.startsWith("data:image/"))
    .join(" ") + " " + legacySearch + " " + record.familyComposition.map((member) =>
    `${member.fullName} ${member.relationship} ${member.birthday}`).join(" "));
  const fullName = normalizeSearchText(`${record.surname} ${record.firstName} ${record.middleName} ${record.suffix}`);
  const diagnosis = normalizeSearchText(record.diagnosis);
  const createdDate = record.applicationDate || (record.createdAt ? record.createdAt.slice(0, 10) : "");
  const payoutDate = recordPayoutDate(record);

  return tokensMatch(globalQuery, searchable) &&
    tokensMatch(nameQuery, fullName) &&
    (!filters.district || barangayDistrictGroup(record.brgy) === filters.district) &&
    (!filters.barangay || canonicalBarangay(filters.barangay) === canonicalBarangay(record.brgy)) &&
    normalizedOptionMatches(filters.sex, record.sex) &&
    inNumberRange(Number(record.age), filters.minAge, filters.maxAge) &&
    inNumberRange(record.householdMembers, filters.minHousehold, filters.maxHousehold) &&
    processingStageMatches(record, filters.processingStage) &&
    (!filters.category || canonicalCategory(filters.category) === canonicalCategory(record.category)) &&
    normalizedOptionMatches(filters.assistanceType, record.assistanceType) &&
    agencyFilterMatches(record.assistanceAgencies, filters.agencies, filters.agencyMatch) &&
    tokensMatch(diagnosisQuery, diagnosis) &&
    (!filters.conditionCategory || record.conditionCategories.some((category) => normalizedOptionMatches(filters.conditionCategory, category))) &&
    normalizedOptionMatches(filters.employmentStatus, record.employedStatus) &&
    inNumberRange(record.salary, filters.minIncome, filters.maxIncome) &&
    inNumberRange(record.monthlyExpenses, filters.minExpenses, filters.maxExpenses) &&
    inNumberRange(record.amount, filters.minAmount, filters.maxAmount) &&
    (!filters.createdFrom || createdDate >= filters.createdFrom) &&
    (!filters.createdTo || createdDate <= filters.createdTo) &&
    (!filters.payoutFrom || (Boolean(payoutDate) && payoutDate >= filters.payoutFrom)) &&
    (!filters.payoutTo || (Boolean(payoutDate) && payoutDate <= filters.payoutTo));
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-PH")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function searchTokens(value: string) {
  const normalized = normalizeSearchText(value);
  return normalized ? Array.from(new Set(normalized.split(" "))) : [];
}

function tokensMatch(tokens: string[], searchable: string) {
  return tokens.every((token) => searchable.includes(token));
}

function normalizedOptionMatches(filterValue: string, recordValue: string) {
  return !filterValue || normalizeSearchText(filterValue) === normalizeSearchText(recordValue);
}

function inNumberRange(value: number, minimum: string, maximum: string) {
  if (!Number.isFinite(value)) return !minimum && !maximum;
  return (!minimum || value >= Number(minimum)) && (!maximum || value <= Number(maximum));
}

function processingStageMatches(record: AssistanceRecord, stage: string) {
  if (!stage) return true;
  const applicationRecorded = Boolean(record.applicationDate);
  const payoutCompleted = Boolean(recordPayoutDate(record));
  if (stage === "application-recorded") return applicationRecorded;
  if (stage === "awaiting-payout") return applicationRecorded && !payoutCompleted;
  if (stage === "payout-completed") return payoutCompleted;
  if (stage === "application-date-missing") return !applicationRecorded;
  return true;
}

function compareRecords(
  first: AssistanceRecord,
  second: AssistanceRecord,
  sort: RecordFilters["sort"],
  histories: ReturnType<typeof buildApplicantHistories>,
) {
  const compareText = (firstValue: string, secondValue: string) => firstValue.localeCompare(secondValue, "en-PH", { sensitivity: "base" });
  if (sort === "name" || sort === "name-desc") {
    const result = compareText(`${first.surname} ${first.firstName}`, `${second.surname} ${second.firstName}`);
    return sort === "name-desc" ? -result : result;
  }
  if (sort === "amount-high") return second.amount - first.amount;
  if (sort === "amount-low") return first.amount - second.amount;
  if (sort === "birthday-newest" || sort === "birthday-oldest") {
    return compareOptionalDates(first.birthday, second.birthday, sort === "birthday-newest" ? "desc" : "asc");
  }
  if (sort === "barangay-asc" || sort === "barangay-desc") {
    const result = compareText(canonicalBarangay(first.brgy), canonicalBarangay(second.brgy));
    return sort === "barangay-desc" ? -result : result;
  }
  if (sort === "assistance-asc" || sort === "assistance-desc") {
    const result = compareText(first.assistanceType, second.assistanceType);
    return sort === "assistance-desc" ? -result : result;
  }
  if (sort === "payout-newest" || sort === "payout-oldest") {
    return compareOptionalDates(recordPayoutDate(first), recordPayoutDate(second), sort === "payout-newest" ? "desc" : "asc");
  }
  if (sort === "history-high" || sort === "history-low") {
    const firstTotal = first.historyTotalGranted ?? histories.get(applicantIdentityKey(first))?.totalGranted ?? first.amount;
    const secondTotal = second.historyTotalGranted ?? histories.get(applicantIdentityKey(second))?.totalGranted ?? second.amount;
    return sort === "history-high" ? secondTotal - firstTotal : firstTotal - secondTotal;
  }
  const firstDate = Date.parse(first.applicationDate || first.createdAt) || 0;
  const secondDate = Date.parse(second.applicationDate || second.createdAt) || 0;
  return sort === "oldest" ? firstDate - secondDate : secondDate - firstDate;
}

function compareOptionalDates(firstValue: string, secondValue: string, direction: "asc" | "desc") {
  if (!firstValue && !secondValue) return 0;
  if (!firstValue) return 1;
  if (!secondValue) return -1;
  const result = (Date.parse(firstValue) || 0) - (Date.parse(secondValue) || 0);
  return direction === "desc" ? -result : result;
}
