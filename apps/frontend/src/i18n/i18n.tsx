import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { buildLocaleRegistry, type LocaleOption } from "./localeRegistry";
import { readStoredValue, writeStoredValue } from "../lib/browserStorage";
export { normalizeVisibleName, repairMojibake, uniqueVisibleNameOptions } from "./displayNames";

export type LanguageCode = string;
export type TranslationKey = string;

const localeModules = import.meta.glob("./dictionaries/*.ts", { eager: true });
const { dictionaries, options } = buildLocaleRegistry(localeModules as Record<string, Record<string, unknown>>);

function pickTranslation(language: LanguageCode, key: string) {
  return dictionaries[language]?.[key] || dictionaries.en?.[key] || key;
}

type I18nValue = {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  t: (key: TranslationKey) => string;
  options: LocaleOption[];
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const saved = readStoredValue("localStorage", "som-pro-language") as LanguageCode | null;
    return saved && saved in dictionaries ? saved : "ar";
  });

  const setLanguage = (next: LanguageCode) => {
    writeStoredValue("localStorage", "som-pro-language", next);
    setLanguageState(next);
  };

  useEffect(() => {
    const option = options.find((item) => item.code === language) ||
      options[0] || { code: language, label: language, short: language.slice(0, 2).toUpperCase(), dir: "ltr" as const };
    document.documentElement.lang = language;
    document.documentElement.dir = option.dir;
    document.body.dir = option.dir;
    writeStoredValue("localStorage", "som-pro-language", language);
  }, [language]);

  const value = useMemo<I18nValue>(
    () => ({
      language,
      setLanguage,
      t: (key) => pickTranslation(language, key),
      options
    }),
    [language]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}

export function LanguageSwitcher() {
  const { language, setLanguage, options, t } = useI18n();

  return (
    <div className="language-switcher no-print" aria-label={t("language.select")} title={t("language.select")}>
      {options.map((option) => (
        <button
          key={option.code}
          className={language === option.code ? "active" : ""}
          onClick={() => setLanguage(option.code)}
          title={option.label}
          type="button"
        >
          {option.short}
        </button>
      ))}
    </div>
  );
}
