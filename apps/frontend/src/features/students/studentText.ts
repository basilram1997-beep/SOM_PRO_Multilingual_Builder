import type { LanguageCode, TranslationKey } from "../../i18n/i18n";

export function studentText(
  t: (key: TranslationKey) => string,
  language: LanguageCode,
  key: TranslationKey,
  arabicFallback: string,
  hebrewFallback: string
) {
  const translated = t(key);
  if (translated && translated !== key) return translated;

  const normalized = String(language || "").toLowerCase();
  if (normalized.startsWith("he")) return hebrewFallback;
  if (normalized.startsWith("ar")) return arabicFallback;

  return translated || key;
}
