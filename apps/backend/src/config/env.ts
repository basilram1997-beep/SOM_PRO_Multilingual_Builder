import "dotenv/config";

const rawCorsOrigins = process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173";
const rawAppEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";
const rawAppDebug =
  process.env.APP_DEBUG || (String(rawAppEnv).trim().toLowerCase() === "production" ? "false" : "true");
const rawTrustProxy = process.env.SOM_TRUST_PROXY ?? process.env.TRUST_PROXY ?? "false";

function parseTrustProxy(value: string): boolean | number {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized || normalized === "false" || normalized === "off" || normalized === "no") {
    return false;
  }
  if (normalized === "true" || normalized === "on" || normalized === "yes") {
    return true;
  }
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : false;
}

export const env = {
  port: Number(process.env.PORT || 4000),
  appEnv: String(rawAppEnv).trim().toLowerCase(),
  appDebug: String(rawAppDebug).trim().toLowerCase() === "true",
  trustProxy: parseTrustProxy(String(rawTrustProxy)),
  corsOrigins: rawCorsOrigins
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  authInactivityTimeoutSeconds: Number(process.env.SOM_PRO_AUTH_INACTIVITY_TIMEOUT_SECONDS || 30 * 60),
  disableThirdPartyIntegrations:
    String(process.env.SOM_DISABLE_THIRD_PARTY_INTEGRATIONS || "")
      .trim()
      .toLowerCase() === "true",
  enforceHttpsInProduction:
    String(process.env.SOM_ENFORCE_HTTPS_IN_PRODUCTION || "true")
      .trim()
      .toLowerCase() !== "false"
};
