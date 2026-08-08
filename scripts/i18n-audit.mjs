import { ar } from "../apps/frontend/src/i18n/dictionaries/ar.ts";
import { en } from "../apps/frontend/src/i18n/dictionaries/en.ts";
import { he } from "../apps/frontend/src/i18n/dictionaries/he.ts";

/* global console, process */

const dictionaries = { ar, he };
const allowedLatinWords =
  /\b(SOM|PRO|PDF|HTML|JSONL|API|Node|PostgreSQL|Redis|Docker|GitHub|Prisma|Excel|CSV|JWT|ID|ms)\b/g;

function isTechnicalKey(value) {
  return /^[a-z][a-z0-9]*(?:\.[A-Za-z0-9_-]+)+$/.test(value.trim());
}

function isBlockingBrokenText(value) {
  const text = value.trim();
  if (!text || text === "-") return false;
  if (/^[?\u061f\s._,:;|/()[\]{}-]+$/.test(text)) return true;
  if (/[�ÃÂ]/.test(text)) return true;
  const questionMarks = (text.match(/[?\u061f]/g) || []).length;
  return questionMarks > 0 && questionMarks / Math.max(text.length, 1) > 0.35;
}

function latinLeakWords(value, language) {
  const text = value.replace(allowedLatinWords, "");
  const words = text.match(/[A-Za-z]{3,}/g) || [];
  if (language === "ar" && /[\u0600-\u06FF]/.test(text)) return words;
  if (language === "he" && /[\u0590-\u05FF]/.test(text)) return words;
  return [];
}

function formatIssue(issue) {
  return `${issue.language}.${issue.key}: ${issue.reason} => ${issue.value}`;
}

const hardIssues = [];
const reviewIssues = [];

for (const [language, dictionary] of Object.entries(dictionaries)) {
  for (const [key, englishValue] of Object.entries(en)) {
    const value = dictionary[key];
    if (value === undefined || value === null) {
      hardIssues.push({ language, key, reason: "missing translation", value: englishValue });
      continue;
    }

    if (value === key || isTechnicalKey(value)) {
      hardIssues.push({ language, key, reason: "technical key leaked", value });
      continue;
    }

    if (isBlockingBrokenText(value)) {
      hardIssues.push({ language, key, reason: "broken localized text", value });
      continue;
    }

    const leakWords = latinLeakWords(value, language);
    if (leakWords.length > 0) {
      reviewIssues.push({
        language,
        key,
        reason: `mixed-language text: ${Array.from(new Set(leakWords)).join(", ")}`,
        value
      });
    }
  }
}

if (hardIssues.length > 0) {
  console.error("i18n audit failed with blocking localization issues:");
  for (const issue of hardIssues.slice(0, 80)) console.error(`- ${formatIssue(issue)}`);
  if (hardIssues.length > 80) console.error(`- ...and ${hardIssues.length - 80} more`);
  process.exit(1);
}

console.log("i18n audit blocking checks: OK");
console.log(`i18n audit language-review findings: ${reviewIssues.length}`);
for (const issue of reviewIssues.slice(0, 40)) console.log(`- ${formatIssue(issue)}`);
if (reviewIssues.length > 40) console.log(`- ...and ${reviewIssues.length - 40} more`);
