export const CENTRAL_LICENSE_URL = process.env.SOM_PRO_LICENSE_SERVER_URL || process.env.SOM_LICENSE_SERVER_URL || "";
export const REQUIRE_CENTRAL_LICENSE = process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE === "true";
export const CENTRAL_TIMEOUT_MS = Number(process.env.SOM_PRO_LICENSE_TIMEOUT_MS || 5000);
export const GRACE_PERIOD_DAYS = Number(process.env.SOM_PRO_LICENSE_GRACE_DAYS || 3);
export const DEFAULT_ADMIN_NAME = "مدير المدرسة";
export const REQUIRED_CENTRAL_NOT_CONFIGURED_MESSAGE = "لم يتم ضبط خادم الترخيص المركزي لهذه النسخة";
export const RUNTIME_MODE = String(process.env.SOM_RUNTIME_MODE || process.env.NODE_ENV || "development")
  .trim()
  .toLowerCase();
