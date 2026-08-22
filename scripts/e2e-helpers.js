const { generateE2ELicenseCode } = require("./e2e-license");
const { assertLocalService, assertTcpPortFree, waitForTcp } = require("./runtime/ports");
const {
  createProcessManager,
  normalizeWindowsEnv,
  runShell,
  shellCommand,
  startProcess,
  startShell,
  trace,
  waitForShutdownSignal,
  waitForUrl
} = require("./runtime/services");

function createE2EEnv(overrides = {}) {
  const e2eLicenseCode =
    process.env.SOM_E2E_LICENSE_CODE ||
    generateE2ELicenseCode({
      days: 365,
      schoolName: process.env.SOM_E2E_SCHOOL_NAME || "مدرسة تجريبية",
      institutionCode: process.env.SOM_E2E_INSTITUTION_CODE || "TRIAL-4100",
      secret: process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling"
    });

  return normalizeWindowsEnv({
    ...process.env,
    SOM_PRO_LICENSE_SERVER_URL: "",
    SOM_LICENSE_SERVER_URL: "",
    SOM_PRO_REQUIRE_CENTRAL_LICENSE: "false",
    SOM_PRO_LICENSE_SECRET: process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling",
    SOM_PRO_AUTH_SECRET: process.env.SOM_PRO_AUTH_SECRET || "change-this-auth-secret-before-selling",
    SOM_E2E_DISABLE_RATE_LIMIT: process.env.SOM_E2E_DISABLE_RATE_LIMIT || "true",
    DATABASE_URL: process.env.DATABASE_URL || "postgresql://som_user:som_password@localhost:5432/som?schema=public",
    REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",
    CORS_ORIGIN: "http://localhost:4188,http://127.0.0.1:4188",
    SOM_E2E_LICENSE_CODE: e2eLicenseCode,
    SOM_E2E_ADMIN_EMAIL: process.env.SOM_E2E_ADMIN_EMAIL || "admin@som-e2e.local",
    SOM_E2E_ADMIN_PASSWORD: process.env.SOM_E2E_ADMIN_PASSWORD || "SOM-E2E-Admin-123!",
    SOM_E2E_ADMIN_NAME: process.env.SOM_E2E_ADMIN_NAME || "SOM E2E Admin",
    SOM_E2E_SCHOOL_ID: process.env.SOM_E2E_SCHOOL_ID || "som-e2e-school",
    SOM_E2E_SCHOOL_NAME: process.env.SOM_E2E_SCHOOL_NAME || "SOM E2E School",
    SOM_E2E_INSTITUTION_CODE: process.env.SOM_E2E_INSTITUTION_CODE || "E2E-4100",
    SOM_E2E_CLASS_NAME: process.env.SOM_E2E_CLASS_NAME || "SOM E2E Class A",
    SOM_E2E_SUBJECT_NAME: process.env.SOM_E2E_SUBJECT_NAME || "SOM E2E Subject",
    SOM_E2E_TEACHER_NAME: process.env.SOM_E2E_TEACHER_NAME || "SOM E2E Teacher",
    SOM_E2E_TEACHER_EMAIL: process.env.SOM_E2E_TEACHER_EMAIL || "teacher@som-e2e.local",
    SOM_E2E_TEACHER_PASSWORD: process.env.SOM_E2E_TEACHER_PASSWORD || "SOM-E2E-Teacher-123!",
    SOM_E2E_STUDENT_NAME: process.env.SOM_E2E_STUDENT_NAME || "SOM E2E Student",
    SOM_E2E_STUDENT_EMAIL: process.env.SOM_E2E_STUDENT_EMAIL || "student@som-e2e.local",
    SOM_E2E_STUDENT_PASSWORD: process.env.SOM_E2E_STUDENT_PASSWORD || "SOM-E2E-Student-123!",
    SOM_E2E_PARENT_EMAIL: process.env.SOM_E2E_PARENT_EMAIL || "parent@som-e2e.local",
    SOM_E2E_PARENT_PASSWORD: process.env.SOM_E2E_PARENT_PASSWORD || "SOM-E2E-Parent-123!",
    SOM_TUNNEL_PROXY_USER: process.env.SOM_TUNNEL_PROXY_USER || "demo",
    SOM_TUNNEL_PROXY_PASSWORD: process.env.SOM_TUNNEL_PROXY_PASSWORD || "Demo-Tunnel-2026!",
    ...overrides
  });
}

module.exports = {
  assertLocalService,
  assertTcpPortFree,
  createE2EEnv,
  createProcessManager,
  normalizeWindowsEnv,
  runShell,
  shellCommand,
  startProcess,
  startShell,
  trace,
  waitForShutdownSignal,
  waitForTcp,
  waitForUrl
};
