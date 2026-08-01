type StorageKind = "localStorage" | "sessionStorage";

function resolveStorage(kind: StorageKind): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window[kind] || null;
  } catch {
    return null;
  }
}

export function readStoredValue(kind: StorageKind, key: string) {
  try {
    return resolveStorage(kind)?.getItem(key) || null;
  } catch {
    return null;
  }
}

export function writeStoredValue(kind: StorageKind, key: string, value: string) {
  try {
    resolveStorage(kind)?.setItem(key, value);
  } catch {
    // Storage is a convenience only; keep the app usable if it is blocked.
  }
}

export function removeStoredValue(kind: StorageKind, key: string) {
  try {
    resolveStorage(kind)?.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

export function readStoredJson<T>(kind: StorageKind, key: string): T | null {
  const raw = readStoredValue(kind, key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    removeStoredValue(kind, key);
    return null;
  }
}

export function writeStoredJson(kind: StorageKind, key: string, value: unknown) {
  writeStoredValue(kind, key, JSON.stringify(value));
}
