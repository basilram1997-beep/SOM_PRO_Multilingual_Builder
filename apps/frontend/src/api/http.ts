import { Capacitor } from "@capacitor/core";
import { apiErrorMessage, isLocalApiUrl, readResponseBody } from "./httpUtils";
import { readStoredValue, removeStoredValue, writeStoredValue } from "../lib/browserStorage";

const LOCAL_API_URL = "http://localhost:4000";
const SAME_ORIGIN_API_URL = "/api";
const ENV_API_URL = (import.meta.env.VITE_API_URL || "").trim();
const DESKTOP_DEVICE = window.somDesktop?.device;
const REQUEST_TIMEOUT_MS = 20_000;
const NETWORK_TIMEOUT_MESSAGE = "استغرق الاتصال بالخادم وقتًا طويلًا. حاول مرة أخرى.";
const LOCAL_API_CONNECTION_MESSAGE =
  "تعذر الاتصال بخادم البرنامج المحلي. تأكد أن Backend يعمل على http://localhost:4000 وأن خادم الترخيص يعمل على http://localhost:4100.";
const SAAS_CONNECTION_MESSAGE = "تعذر الاتصال بخادم SOM PRO. تحقق من اتصال الإنترنت ثم حاول مرة أخرى.";
const GENERIC_API_ERROR_MESSAGE = "حدث خطأ في الاتصال بالخادم";
const PRODUCTION_HTTPS_ERROR = "يجب ضبط عنوان الخادم في بيئة الإنتاج ليكون HTTPS. نسخ SaaS لا يجب أن تعتمد على HTTP.";
const MOBILE_API_URL_ERROR =
  "نسخة الهاتف تحتاج عنوان API خارجي عبر VITE_API_URL ويجب أن يكون HTTPS قبل التصدير إلى Google Play أو App Store.";

function fileNameFromDisposition(header: string | null) {
  if (!header) return "";
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const plainMatch = header.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] || "";
}

function desktopDeviceHeaders(): Record<string, string> {
  if (!DESKTOP_DEVICE?.deviceId) return {};
  return {
    "X-SOM-Device-Id": DESKTOP_DEVICE.deviceId,
    "X-SOM-Device-Name": DESKTOP_DEVICE.deviceName || "SOM PRO Desktop",
    "X-SOM-App-Version": DESKTOP_DEVICE.appVersion || "1.5.5",
    "X-SOM-Platform": DESKTOP_DEVICE.platform || "desktop"
  };
}

const AUTH_TOKEN_KEY = "som-pro-auth-token-v2";
const SESSION_AUTH_TOKEN_KEY = "som-pro-session-auth-token-v2";
const OLD_AUTH_KEYS = ["som-pro-auth-token", "som-pro-session-auth-token"];
let authTokenMemory = "";

export function clearLegacyAuthTokens() {
  for (const key of OLD_AUTH_KEYS) {
    removeStoredValue("localStorage", key);
    removeStoredValue("sessionStorage", key);
  }
}

function clearCurrentAuthTokenStorage() {
  removeStoredValue("localStorage", AUTH_TOKEN_KEY);
  removeStoredValue("sessionStorage", SESSION_AUTH_TOKEN_KEY);
}

export function getAuthToken() {
  if (authTokenMemory) return authTokenMemory;
  const storedToken =
    readStoredValue("sessionStorage", SESSION_AUTH_TOKEN_KEY) || readStoredValue("localStorage", AUTH_TOKEN_KEY) || "";
  authTokenMemory = storedToken;
  return authTokenMemory;
}

export function setAuthToken(token: string) {
  clearLegacyAuthTokens();
  const cleanToken = String(token || "").trim();
  authTokenMemory = cleanToken;
  clearCurrentAuthTokenStorage();
  if (!cleanToken) return;
  writeStoredValue("sessionStorage", SESSION_AUTH_TOKEN_KEY, cleanToken);
}

clearLegacyAuthTokens();

function isLoopbackHost(hostname: string) {
  const normalized = String(hostname || "")
    .trim()
    .toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function resolveApiUrl() {
  const desktopMode = window.somDesktop?.mode?.trim();
  const desktopApiUrl = window.somDesktop?.apiUrl?.trim();
  if (desktopApiUrl) return desktopApiUrl;
  if (desktopMode === "local-trial" || desktopMode === "development") return LOCAL_API_URL;
  if (Capacitor.isNativePlatform()) {
    if (!ENV_API_URL) {
      throw new Error(MOBILE_API_URL_ERROR);
    }
    return ENV_API_URL;
  }
  if (window.location.protocol === "file:" || isLoopbackHost(window.location.hostname)) return LOCAL_API_URL;
  return ENV_API_URL || SAME_ORIGIN_API_URL;
}

export const API_URL = resolveApiUrl();

function resolveRequestUrl(path: string) {
  const cleanPath = String(path || "").startsWith("/") ? String(path || "") : `/${String(path || "")}`;
  if (API_URL === SAME_ORIGIN_API_URL && cleanPath.startsWith("/api/")) {
    return cleanPath;
  }
  return `${API_URL}${cleanPath}`;
}

function ensureProductionApiIsSecure() {
  if (!import.meta.env.PROD) return;
  if (window.somDesktop?.mode === "local-trial" || window.somDesktop?.mode === "development") return;
  if (window.location.protocol === "file:") return;
  if (Capacitor.isNativePlatform()) {
    if (!ENV_API_URL || !/^https:\/\//i.test(ENV_API_URL)) {
      throw new Error(MOBILE_API_URL_ERROR);
    }
    return;
  }
  if (isLocalApiUrl(API_URL)) return;
  if (window.somDesktop) return;
  if (/^https:\/\//i.test(API_URL) || !/^http:\/\//i.test(API_URL)) return;
  throw new Error(PRODUCTION_HTTPS_ERROR);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  ensureProductionApiIsSecure();
  const token = getAuthToken();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  for (const [key, value] of Object.entries(desktopDeviceHeaders())) headers.set(key, value);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(resolveRequestUrl(path), {
      ...options,
      headers,
      signal: controller.signal
    });
  } catch (error) {
    if (timedOut) throw new Error(NETWORK_TIMEOUT_MESSAGE, { cause: error });
    if (options.signal?.aborted) throw error;

    throw new Error(isLocalApiUrl(API_URL) ? LOCAL_API_CONNECTION_MESSAGE : SAAS_CONNECTION_MESSAGE, { cause: error });
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }

  const body = await readResponseBody(response);
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new CustomEvent("som-auth-expired"));
    throw new Error(apiErrorMessage(body, GENERIC_API_ERROR_MESSAGE));
  }

  return body as T;
}

async function download(path: string, options: RequestInit = {}) {
  ensureProductionApiIsSecure();
  const token = getAuthToken();
  const headers = new Headers(options.headers);
  for (const [key, value] of Object.entries(desktopDeviceHeaders())) headers.set(key, value);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(resolveRequestUrl(path), {
      ...options,
      headers,
      signal: controller.signal
    });
  } catch (error) {
    if (timedOut) throw new Error(NETWORK_TIMEOUT_MESSAGE, { cause: error });
    if (options.signal?.aborted) throw error;
    throw new Error(isLocalApiUrl(API_URL) ? LOCAL_API_CONNECTION_MESSAGE : SAAS_CONNECTION_MESSAGE, { cause: error });
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }

  if (!response.ok) {
    const body = await readResponseBody(response);
    if (response.status === 401) window.dispatchEvent(new CustomEvent("som-auth-expired"));
    throw new Error(apiErrorMessage(body, GENERIC_API_ERROR_MESSAGE));
  }

  return {
    blob: await response.blob(),
    fileName: fileNameFromDisposition(response.headers.get("Content-Disposition")),
    contentType: response.headers.get("Content-Type") || "application/octet-stream"
  };
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(data || {}) }),
  put: <T>(path: string, data?: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(data || {}) }),
  patch: <T>(path: string, data?: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(data || {}) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  download
};
