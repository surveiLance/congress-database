import { AssistanceRecord } from "./types";

export const confidentMatchThreshold = 55;

export interface ScoredRecordMatch {
  record: AssistanceRecord;
  percentage: number;
  matchedFields: string[];
}

const weights = {
  surname: 20,
  firstName: 18,
  birthday: 25,
  address: 17,
  barangay: 10,
  idNumber: 10,
};

export function scoreDocumentMatches(rawText: string, records: AssistanceRecord[]): ScoredRecordMatch[] {
  const normalizedText = normalizeText(rawText);
  const compactText = normalizeCompact(rawText);
  const dateCandidates = extractDateCandidates(rawText);

  return records.map((record) => {
    let score = 0;
    let possible = weights.surname + weights.firstName + weights.birthday + weights.address + weights.barangay;
    const matchedFields: string[] = [];

    const surname = fieldTextScore(record.surname, normalizedText);
    if (surname.exact) {
      score += weights.surname;
      matchedFields.push("Surname (exact)");
    } else if (surname.similarity >= 0.72) {
      score += weights.surname * surname.similarity * 0.8;
      matchedFields.push(`Surname (similar ${percent(surname.similarity)})`);
    }

    const firstName = fieldTextScore(record.firstName, normalizedText);
    if (firstName.exact) {
      score += weights.firstName;
      matchedFields.push("First name (exact)");
    } else if (firstName.similarity >= 0.72) {
      score += weights.firstName * firstName.similarity * 0.8;
      matchedFields.push(`First name (similar ${percent(firstName.similarity)})`);
    }

    if (record.birthday && dateCandidates.has(record.birthday)) {
      score += weights.birthday;
      matchedFields.push("Birthday (exact)");
    }

    const addressSimilarity = addressScore(record.address, normalizedText);
    if (addressSimilarity >= 0.5) {
      score += weights.address * addressSimilarity;
      matchedFields.push(`Address (similar ${percent(addressSimilarity)})`);
    }

    const barangay = normalizeText(record.brgy);
    if (barangay && containsPhrase(normalizedText, barangay)) {
      score += weights.barangay;
      matchedFields.push("Barangay (exact)");
    }

    const idNumber = normalizeCompact(record.idNumber);
    if (idNumber.length >= 5) {
      possible += weights.idNumber;
      if (compactText.includes(idNumber)) {
        score += weights.idNumber;
        matchedFields.push("ID number (exact)");
      }
    }

    return {
      record,
      percentage: Math.min(100, Math.round((score / possible) * 100)),
      matchedFields,
    };
  }).sort((first, second) =>
    second.percentage - first.percentage ||
    second.matchedFields.length - first.matchedFields.length ||
    `${first.record.surname} ${first.record.firstName}`.localeCompare(`${second.record.surname} ${second.record.firstName}`),
  ).filter((match) => match.percentage > 0 && match.matchedFields.length > 0).slice(0, 5);
}

export function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCompact(value: string) {
  return normalizeText(value).replace(/\s+/g, "");
}

function fieldTextScore(value: string, normalizedText: string) {
  const target = normalizeText(value);
  return {
    exact: Boolean(target && containsPhrase(normalizedText, target)),
    similarity: target ? bestWindowSimilarity(target, normalizedText) : 0,
  };
}

function containsPhrase(text: string, phrase: string) {
  return ` ${text} `.includes(` ${phrase} `);
}

function bestWindowSimilarity(target: string, text: string) {
  const targetTokens = target.split(" ");
  const textTokens = text.split(" ");
  if (!targetTokens.length || !textTokens.length) return 0;
  let best = 0;
  const minimumSize = Math.max(1, targetTokens.length - 1);
  const maximumSize = Math.min(textTokens.length, targetTokens.length + 1);
  for (let size = minimumSize; size <= maximumSize; size += 1) {
    for (let index = 0; index <= textTokens.length - size; index += 1) {
      best = Math.max(best, similarity(target, textTokens.slice(index, index + size).join(" ")));
    }
  }
  return best;
}

function addressScore(address: string, normalizedText: string) {
  const target = normalizeText(address);
  if (!target) return 0;
  if (containsPhrase(normalizedText, target)) return 1;
  const targetTokens = new Set(target.split(" ").filter((token) => token.length > 1));
  const textTokens = new Set(normalizedText.split(" "));
  const matchedTokens = Array.from(targetTokens).filter((token) => textTokens.has(token)).length;
  const containment = targetTokens.size ? matchedTokens / targetTokens.size : 0;
  return Math.max(containment, bestWindowSimilarity(target, normalizedText));
}

function similarity(first: string, second: string) {
  const longest = Math.max(first.length, second.length);
  return longest ? 1 - levenshtein(first, second) / longest : 1;
}

function levenshtein(first: string, second: string) {
  const previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    const current = [firstIndex];
    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      current[secondIndex] = Math.min(
        current[secondIndex - 1] + 1,
        previous[secondIndex] + 1,
        previous[secondIndex - 1] + (first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[second.length];
}

function extractDateCandidates(text: string) {
  const dates = new Set<string>();
  const normalized = text.toLowerCase().replace(/,/g, " ");
  const numericPattern = /\b(\d{1,4})[./\-\s](\d{1,2})[./\-\s](\d{1,4})\b/g;
  for (const match of normalized.matchAll(numericPattern)) {
    const [, first, second, third] = match;
    if (first.length === 4) {
      addDate(dates, Number(first), Number(second), Number(third));
    } else if (third.length === 4) {
      addDate(dates, Number(third), Number(first), Number(second));
      addDate(dates, Number(third), Number(second), Number(first));
    }
  }

  const monthNames: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
    may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9,
    sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
    dec: 12, december: 12,
  };
  const names = Object.keys(monthNames).join("|");
  const monthFirst = new RegExp(`\\b(${names})\\s+(\\d{1,2})\\s+(\\d{4})\\b`, "g");
  const dayFirst = new RegExp(`\\b(\\d{1,2})\\s+(${names})\\s+(\\d{4})\\b`, "g");
  for (const match of normalized.matchAll(monthFirst)) addDate(dates, Number(match[3]), monthNames[match[1]], Number(match[2]));
  for (const match of normalized.matchAll(dayFirst)) addDate(dates, Number(match[3]), monthNames[match[2]], Number(match[1]));
  return dates;
}

function addDate(dates: Set<string>, year: number, month: number, day: number) {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return;
  dates.add(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}
