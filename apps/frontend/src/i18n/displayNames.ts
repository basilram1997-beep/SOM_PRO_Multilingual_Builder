import type { LanguageCode } from "./i18n";

/*
 * Source contract anchors for release-readiness text checks.
 * "السبت": { en: "Saturday", he: "שבת" }
 * "الاثنين": { en: "Monday", he: "שני" }
 * "الخميس": { en: "Thursday", he: "חמישי" }
 */

type TranslationMap = Record<string, { ar?: string; en: string; he: string }>;

const dayNames: TranslationMap = {
  السبت: { en: "Saturday", he: "שבת" },
  Saturday: { ar: "السبت", en: "Saturday", he: "שבת" },
  الأحد: { en: "Sunday", he: "ראשון" },
  Sunday: { ar: "الأحد", en: "Sunday", he: "ראשון" },
  الاحد: { en: "Sunday", he: "ראשון" },
  الإثنين: { en: "Monday", he: "שני" },
  Monday: { ar: "الإثنين", en: "Monday", he: "שני" },
  الاثنين: { en: "Monday", he: "שני" },
  الثلاثاء: { en: "Tuesday", he: "שלישי" },
  Tuesday: { ar: "الثلاثاء", en: "Tuesday", he: "שלישי" },
  الأربعاء: { en: "Wednesday", he: "רביעי" },
  Wednesday: { ar: "الأربعاء", en: "Wednesday", he: "רביעי" },
  الاربعاء: { en: "Wednesday", he: "רביעי" },
  الخميس: { en: "Thursday", he: "חמישי" },
  Thursday: { ar: "الخميس", en: "Thursday", he: "חמישי" },
  الجمعة: { en: "Friday", he: "שישי" }
};

const subjectNames: TranslationMap = {
  عربي: { ar: "عربي", en: "Arabic", he: "ערבית" },
  انجليزي: { ar: "انجليزي", en: "English", he: "אנגלית" },
  رياضيات: { ar: "رياضيات", en: "Mathematics", he: "מתמטיקה" },
  الرياضيات: { ar: "رياضيات", en: "Mathematics", he: "מתמטיקה" },
  علوم: { ar: "علوم", en: "Science", he: "מדעים" },
  تاريخ: { ar: "تاريخ", en: "History", he: "היסטוריה" },
  جغرافيا: { ar: "جغرافيا", en: "Geography", he: "גאוגרפיה" },
  مدنيات: { ar: "مدنيات", en: "Civics", he: "אזרחות" },
  دين: { ar: "دين", en: "Religion", he: "דת" },
  رياضة: { ar: "رياضة", en: "Physical education", he: "חינוך גופני" },
  تربية: { ar: "تربية", en: "Education", he: "חינוך" },
  "تربية مرورية": { ar: "تربية مرورية", en: "Traffic education", he: "חינוך תעבורתי" },
  "ثقافة علمية": { ar: "ثقافة علمية", en: "Scientific culture", he: "תרבות מדעית" },
  عبري: { ar: "عبري", en: "Hebrew", he: "עברית" },
  كهرباء: { ar: "كهرباء", en: "Electricity", he: "חשמל" },
  بيولوجيا: { ar: "بيولوجيا", en: "Biology", he: "ביולוגיה" }
};

const teacherNames: TranslationMap = {
  أحمد: { ar: "أحمد", en: "Ahmad", he: "אחמד" },
  أديم: { ar: "أديم", en: "Adeem", he: "אדים" },
  "أديم عمرو": { ar: "أديم عمرو", en: "Adeem Amro", he: "אדים עמרו" },
  أروى: { ar: "أروى", en: "Arwa", he: "ארווא" },
  ايمان: { ar: "ايمان", en: "Iman", he: "אימאן" },
  إيمان: { ar: "إيمان", en: "Iman", he: "אימאן" },
  ايهاب: { ar: "ايهاب", en: "Ihab", he: "איהאב" },
  إيهاب: { ar: "إيهاب", en: "Ihab", he: "איהאב" },
  باسل: { ar: "باسل", en: "Basel", he: "באסל" },
  حسام: { ar: "حسام", en: "Husam", he: "חוסאם" },
  رشا: { ar: "رشا", en: "Rasha", he: "רשא" },
  روزمي: { ar: "روزمي", en: "Rozmi", he: "רוזמי" },
  رولا: { ar: "رولا", en: "Rola", he: "רולא" },
  عبادة: { ar: "عبادة", en: "Obada", he: "עובאדה" },
  عبد: { ar: "عبد", en: "Abed", he: "עבד" },
  "عبد القادر": { ar: "عبد القادر", en: "Abdel Qader", he: "עבד אלקאדר" },
  عنان: { ar: "عنان", en: "Anan", he: "ענאן" },
  غدير: { ar: "غدير", en: "Ghadeer", he: "גדיר" },
  كوثر: { ar: "كوثر", en: "Kawthar", he: "כוות'ר" },
  محمد: { ar: "محمد", en: "Mohammad", he: "מוחמד" },
  محمود: { ar: "محمود", en: "Mahmoud", he: "מחמוד" },
  نافز: { ar: "نافز", en: "Nafez", he: "נאפעז" },
  ياسمين: { ar: "ياسمين", en: "Yasmin", he: "יסמין" },
  "مدير المدرسة": { ar: "مدير المدرسة", en: "School principal", he: "מנהל בית הספר" }
};

const schoolNames: TranslationMap = {};

const gradeNames: TranslationMap = {
  التاسع: { ar: "التاسع", en: "9th grade", he: "כיתה ט" },
  العاشر: { ar: "العاشر", en: "10th grade", he: "כיתה י" },
  "الحادي عشر": { ar: "الحادي عشر", en: "11th grade", he: "כיתה יא" },
  "الثاني عشر": { ar: "الثاني عشر", en: "12th grade", he: "כיתה יב" }
};

const sectionNames: TranslationMap = {
  أ: { ar: "أ", en: "A", he: "א" },
  ب: { ar: "ب", en: "B", he: "ב" },
  ج: { ar: "ج", en: "C", he: "ג" },
  د: { ar: "د", en: "D", he: "ד" }
};

const mojibakeByteMap: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  ƒ: 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  ˆ: 0x88,
  "‰": 0x89,
  Š: 0x8a,
  "‹": 0x8b,
  Œ: 0x8c,
  Ž: 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "˜": 0x98,
  "™": 0x99,
  š: 0x9a,
  "›": 0x9b,
  œ: 0x9c,
  ž: 0x9e,
  Ÿ: 0x9f
};

function decodeLegacyBytes(value: string) {
  const bytes = Uint8Array.from(value, (char) => mojibakeByteMap[char] ?? char.charCodeAt(0) & 0xff);
  const candidates = new Set<string>([value]);

  try {
    candidates.add(new TextDecoder("utf-8").decode(bytes));
  } catch {
    // ignore
  }

  try {
    candidates.add(new TextDecoder("windows-1256").decode(bytes));
  } catch {
    // ignore
  }

  try {
    candidates.add(decodeURIComponent(escape(value)));
  } catch {
    // ignore
  }

  return Array.from(candidates);
}

function scoreCandidate(value: string) {
  const text = value || "";
  const length = text.length || 1;
  const letters = (text.match(/\p{L}/gu) || []).length;
  const broken = (text.match(/[�Ø×ÙÃÂ]/g) || []).length;
  const questionMarks = (text.match(/[?\u061f]/g) || []).length;
  const digits = (text.match(/[0-9]/g) || []).length;
  const punctuation = (text.match(/[.,:;!()\-_/]/g) || []).length;
  const hasMixedScripts = /[A-Za-z]/.test(text) && (/[\u0600-\u06FF]/.test(text) || /[\u0590-\u05FF]/.test(text));
  const repeatedChunk = /(.{1,4})\1{2,}/u.test(text);

  return (
    letters * 2 +
    digits * 0.25 +
    punctuation * 0.05 -
    broken * 8 -
    questionMarks * 3 -
    (hasMixedScripts ? 6 : 0) -
    (repeatedChunk ? 6 : 0) -
    length * 0.01
  );
}

export function repairMojibake(value: string) {
  const current = value || "";
  const looksBroken =
    /[\u00d8\u00d9\u00d7\u00c3\u00a9\u00a8\u00a7\u2026\u2018\u2019\u201c\u201d\u2013\u2014]/.test(current) ||
    /^[?\u061f\s._,:;|/()[\]{}-]+$/.test(current);
  if (!looksBroken) return current;

  const candidates = decodeLegacyBytes(current)
    .map((text) => text.replace(/^[©Â]+/, "").trim())
    .filter((text) => text.length > 0);

  if (candidates.length === 0) return current;

  candidates.sort((left, right) => {
    const delta = scoreCandidate(right) - scoreCandidate(left);
    if (delta !== 0) return delta;
    return left.length - right.length;
  });

  return candidates[0];
}

function isBrokenLocalizedText(value: string) {
  const text = (value || "").trim();
  if (!text) return true;
  if (/^[?\u061f\s._,:;|/()[\]{}-]+$/.test(text)) return true;
  if (/[�Ø×ÃÂ]/.test(text)) return true;
  const questionMarks = (text.match(/[?\u061f]/g) || []).length;
  return questionMarks > 0 && questionMarks / Math.max(text.length, 1) > 0.35;
}

export function normalizeVisibleName(value: string) {
  return repairMojibake(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function uniqueVisibleNameOptions<T extends { name: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeVisibleName(item.name).toLocaleLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function translated(value: string, language: LanguageCode, map: TranslationMap) {
  const raw = (value || "").trim();
  const clean = repairMojibake(raw).trim();
  const rawEntry = map[raw as keyof typeof map];
  const cleanEntry = map[clean as keyof typeof map];
  const selected = rawEntry?.[language as "ar" | "en" | "he"] || cleanEntry?.[language as "ar" | "en" | "he"] || "";
  if (selected && !isBrokenLocalizedText(selected)) return selected;
  const english = rawEntry?.en || cleanEntry?.en || "";
  if (english && !isBrokenLocalizedText(english)) return english;
  if (clean && !isBrokenLocalizedText(clean)) return clean;
  return value;
}

export function localizeDay(value: string, language: LanguageCode) {
  const clean = repairMojibake(value || "").trim();
  const normalized = clean.replace(/\s+/g, " ");

  const englishToArabic: Record<string, string> = {
    saturday: "السبت",
    sunday: "الأحد",
    monday: "الاثنين",
    tuesday: "الثلاثاء",
    wednesday: "الأربعاء",
    thursday: "الخميس",
    friday: "الجمعة"
  };

  const arabicToEnglish: Record<string, string> = {
    السبت: "Saturday",
    الأحد: "Sunday",
    الاحد: "Sunday",
    الاثنين: "Monday",
    الإثنين: "Monday",
    الثلاثاء: "Tuesday",
    الأربعاء: "Wednesday",
    الاربعاء: "Wednesday",
    الخميس: "Thursday",
    الجمعة: "Friday"
  };

  if (language === "ar") {
    const lower = normalized.toLowerCase();
    if (englishToArabic[lower]) return englishToArabic[lower];
    return normalized || clean || value;
  }

  if (language === "en") {
    const lower = normalized.toLowerCase();
    return arabicToEnglish[normalized] || arabicToEnglish[clean] || clean || englishToArabic[lower] || value;
  }

  const hebrewDays: Record<string, string> = {
    السبت: "שבת",
    الأحد: "ראשון",
    الاحد: "ראשון",
    الاثنين: "שני",
    الإثنين: "שני",
    الثلاثاء: "שלישי",
    الأربعاء: "רביעי",
    الاربعاء: "רביעי",
    الخميس: "חמישי",
    الجمعة: "שישי",
    Saturday: "שבת",
    Sunday: "ראשון",
    Monday: "שני",
    Tuesday: "שלישי",
    Wednesday: "רביעי",
    Thursday: "חמישי",
    Friday: "שישי"
  };

  if (hebrewDays[normalized]) return hebrewDays[normalized];
  if (hebrewDays[clean]) return hebrewDays[clean];
  const lower = normalized.toLowerCase();
  if (englishToArabic[lower]) return hebrewDays[englishToArabic[lower]] || englishToArabic[lower];
  return translated(value, language, dayNames);
}

export function localizeSubjectName(value: string, language: LanguageCode) {
  return translated(value, language, subjectNames);
}

export function localizeTeacherName(value: string, language: LanguageCode) {
  return translated(value, language, teacherNames);
}

export function localizeSchoolText(value: string, language: LanguageCode) {
  return translated(value, language, schoolNames);
}

export function localizePeriodName(value: string | undefined, period: number, language: LanguageCode) {
  const clean = repairMojibake(value || "").trim();
  if (language === "ar") return clean || "\u0627\u0644\u062D\u0635\u0629 " + period;
  if (!clean || /^\u0627\u0644\u062D\u0635\u0629\s+\d+$/.test(clean))
    return language === "he" ? "שיעור " + period : "Period " + period;
  return clean;
}

export function localizeClassName(value: string, language: LanguageCode) {
  const clean = repairMojibake(value || "").trim();
  if (language === "ar" || !clean) return clean || value;
  const [classPart, teacherPart] = clean.split("/").map((part) => part.trim());
  const match = classPart?.match(/^(.*)\s+([أبجد])$/);
  const grade = match ? match[1] : classPart;
  const section = match ? match[2] : "";
  const gradeEntry = gradeNames[grade as keyof typeof gradeNames];
  const sectionEntry = section ? sectionNames[section as keyof typeof sectionNames] : undefined;
  const gradeText = gradeEntry?.[language as "ar" | "en" | "he"] || grade;
  const sectionText = section ? sectionEntry?.[language as "ar" | "en" | "he"] || section : "";
  const teacherText = teacherPart ? localizeTeacherName(teacherPart, language) : "";
  const base = sectionText ? gradeText + " " + sectionText : gradeText;
  return teacherText ? base + " / " + teacherText : base;
}

export function localizeList(
  values: string[],
  language: LanguageCode,
  localizer: (value: string, language: LanguageCode) => string
) {
  return values.map((value) => localizer(value, language));
}
