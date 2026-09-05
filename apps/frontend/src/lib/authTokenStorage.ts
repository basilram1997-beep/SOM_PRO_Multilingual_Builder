import { readStoredValue, removeStoredValue, writeStoredValue } from "./browserStorage.ts";

const AUTH_TOKEN_KEY = "som-pro-session-auth-token-v3";
const LEGACY_AUTH_KEYS = ["som-pro-auth-token-v2", "som-pro-session-auth-token-v2", "som-pro-auth-token", "som-pro-session-auth-token"];

let authTokenMemory = "";

function clearLegacyAuthTokens() {
  for (const key of LEGACY_AUTH_KEYS) {
    removeStoredValue("localStorage", key);
    removeStoredValue("sessionStorage", key);
  }
}

function migrateLegacyAuthToken() {
  const legacyToken =
    readStoredValue("sessionStorage", "som-pro-session-auth-token-v2") ||
    readStoredValue("localStorage", "som-pro-auth-token-v2") ||
    readStoredValue("localStorage", "som-pro-auth-token") ||
    readStoredValue("sessionStorage", "som-pro-session-auth-token") ||
    "";

  if (!legacyToken) return "";
  clearLegacyAuthTokens();
  writeStoredValue("sessionStorage", AUTH_TOKEN_KEY, legacyToken);
  return legacyToken;
}

export function getAuthToken() {
  if (authTokenMemory) return authTokenMemory;
  const storedToken = readStoredValue("sessionStorage", AUTH_TOKEN_KEY);
  if (storedToken) {
    clearLegacyAuthTokens();
    authTokenMemory = storedToken;
    return authTokenMemory;
  }
  const migratedToken = migrateLegacyAuthToken();
  const resolvedToken = migratedToken || "";
  authTokenMemory = resolvedToken;
  return authTokenMemory;
}

export function setAuthToken(token: string) {
  clearLegacyAuthTokens();
  const cleanToken = String(token || "").trim();
  authTokenMemory = cleanToken;
  removeStoredValue("localStorage", AUTH_TOKEN_KEY);
  removeStoredValue("sessionStorage", AUTH_TOKEN_KEY);
  if (!cleanToken) return;
  writeStoredValue("sessionStorage", AUTH_TOKEN_KEY, cleanToken);
}

export function clearAuthToken() {
  authTokenMemory = "";
  clearLegacyAuthTokens();
  removeStoredValue("sessionStorage", AUTH_TOKEN_KEY);
}

export function getAuthTokenStorageKeys() {
  return {
    current: AUTH_TOKEN_KEY,
    legacy: [...LEGACY_AUTH_KEYS]
  };
}
