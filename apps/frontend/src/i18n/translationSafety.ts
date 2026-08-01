type TranslationDictionary = Record<string, string>;
type StorageLike = Pick<Storage, "getItem" | "setItem"> | null;

import { repairMojibake } from "./displayNames.ts";

const BACKUP_PREFIX = "som-pro-i18n-backup";

export function isBrokenLocalizedText(value: string) {
  const text = repairMojibake(value || "").trim();
  if (!text) return true;
  if (/^[?\u061f\s._,:;|/()[\]{}-]+$/.test(text)) return true;
  if (/[ï¿½Ã˜Ã—ÃƒÃ‚]/.test(text)) return true;

  const questionMarks = (text.match(/[?\u061f]/g) || []).length;
  const hasMixedScripts = /[A-Za-z]/.test(text) && (/[\u0600-\u06FF]/.test(text) || /[\u0590-\u05FF]/.test(text));
  const repeatedChunk = /(.{1,4})\1{2,}/u.test(text);

  return (questionMarks > 0 && questionMarks / Math.max(text.length, 1) > 0.35) || hasMixedScripts || repeatedChunk;
}

function resolveStorage(): StorageLike {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function backupKey(language: string) {
  return `${BACKUP_PREFIX}:${language}`;
}

function readBackup(language: string, storage: StorageLike) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(backupKey(language));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as TranslationDictionary;
  } catch {
    return null;
  }
}

function writeBackup(language: string, storage: StorageLike, dictionary: TranslationDictionary) {
  if (!storage) return;
  try {
    storage.setItem(backupKey(language), JSON.stringify(dictionary));
  } catch {
    // Backup is best-effort only.
  }
}

function chooseSafeValue(
  value: string | undefined,
  backupValue: string | undefined,
  fallbackValue: string | undefined,
  key: string
) {
  const current = repairMojibake(value || "").trim();
  if (current && current !== key && !isBrokenLocalizedText(current)) return current;

  const fallback = repairMojibake(fallbackValue || "").trim();
  if (fallback && fallback !== key && !isBrokenLocalizedText(fallback)) return fallback;

  const backup = repairMojibake(backupValue || "").trim();
  if (backup && backup !== key && !isBrokenLocalizedText(backup)) return backup;

  return key;
}

export function createSafeDictionary(
  language: string,
  current: TranslationDictionary,
  fallback: TranslationDictionary
) {
  const storage = resolveStorage();
  const backup = readBackup(language, storage) || {};
  const next: TranslationDictionary = {};
  let changed = false;

  const keys = new Set([...Object.keys(fallback), ...Object.keys(current), ...Object.keys(backup)]);
  for (const key of keys) {
    const resolved = chooseSafeValue(current[key], backup[key], fallback[key], key);
    next[key] = resolved;
    if (backup[key] !== resolved) changed = true;
  }

  if (changed) writeBackup(language, storage, next);
  return next;
}

export function getBackupStorageKey(language: string) {
  return backupKey(language);
}
