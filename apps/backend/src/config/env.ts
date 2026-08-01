import "dotenv/config";

const rawCorsOrigins = process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173";
const rawAppEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";
const rawAppDebug =
  process.env.APP_DEBUG || (String(rawAppEnv).trim().toLowerCase() === "production" ? "false" : "true");

export const env = {
  port: Number(process.env.PORT || 4000),
  appEnv: String(rawAppEnv).trim().toLowerCase(),
  appDebug: String(rawAppDebug).trim().toLowerCase() === "true",
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
