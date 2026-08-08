import { createSafeDictionary } from "./translationSafety.ts";
import { buildReviewedLocaleDictionary } from "./localeTranslation.ts";

export type LocaleDictionary = Record<string, string>;
export type LocaleModule = Record<string, unknown> & { default?: unknown };

export type LocaleOption = {
  code: string;
  label: string;
  short: string;
  dir: "rtl" | "ltr";
};

export type LocaleRegistry = {
  dictionaries: Record<string, LocaleDictionary>;
  options: LocaleOption[];
};

function isDictionary(value: unknown): value is LocaleDictionary {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function inferLanguageCode(sourcePath: string) {
  const match = sourcePath.match(/([a-z]{2,5})\.ts$/i);
  return match?.[1]?.toLowerCase() || null;
}

function extractDictionary(code: string, module: LocaleModule) {
  if (isDictionary(module.default)) return module.default;

  const direct = module[code];
  if (isDictionary(direct)) return direct;

  const namedDictionary = module.dictionary;
  if (isDictionary(namedDictionary)) return namedDictionary;

  for (const value of Object.values(module)) {
    if (isDictionary(value)) return value;
  }

  return null;
}

function languageMeta(code: string): LocaleOption {
  if (code === "ar") return { code, label: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629", short: "AR", dir: "rtl" };
  if (code === "en") return { code, label: "English", short: "EN", dir: "ltr" };
  if (code === "he") return { code, label: "\u05e2\u05d1\u05e8\u05d9\u05ea", short: "HE", dir: "rtl" };

  const resolvedLabel =
    typeof Intl !== "undefined" && "DisplayNames" in Intl
      ? new Intl.DisplayNames(["en"], { type: "language" }).of(code) || code.toUpperCase()
      : code.toUpperCase();

  return {
    code,
    label: resolvedLabel,
    short: code.slice(0, 2).toUpperCase(),
    dir: /^(ar|he|fa|ur|ps|ku)$/i.test(code) ? "rtl" : "ltr"
  };
}

function languageSortRank(code: string) {
  if (code === "ar") return 0;
  if (code === "en") return 1;
  if (code === "he") return 2;
  return 100;
}

export function buildLocaleRegistry(modules: Record<string, LocaleModule>) {
  const entries = Object.entries(modules)
    .map(([sourcePath, module]) => {
      const code = inferLanguageCode(sourcePath);
      if (!code) return null;

      const dictionary = extractDictionary(code, module);
      if (!dictionary) return null;

      return { code, dictionary };
    })
    .filter((entry): entry is { code: string; dictionary: LocaleDictionary } => Boolean(entry));

  const englishDictionary = entries.find((entry) => entry.code === "en")?.dictionary || entries[0]?.dictionary || {};

  const safeEntries = entries.map((entry) => {
    const reviewedFallback =
      entry.code === "ar" || entry.code === "he"
        ? buildReviewedLocaleDictionary(englishDictionary, entry.code)
        : englishDictionary;
    const safeDictionary = createSafeDictionary(entry.code, entry.dictionary, reviewedFallback);
    return {
      code: entry.code,
      dictionary: safeDictionary,
      option: languageMeta(entry.code)
    };
  });

  safeEntries.sort((left, right) => {
    const rankDelta = languageSortRank(left.code) - languageSortRank(right.code);
    if (rankDelta !== 0) return rankDelta;
    return left.code.localeCompare(right.code);
  });

  return {
    dictionaries: Object.fromEntries(safeEntries.map((entry) => [entry.code, entry.dictionary])),
    options: safeEntries.map((entry) => entry.option)
  } satisfies LocaleRegistry;
}
