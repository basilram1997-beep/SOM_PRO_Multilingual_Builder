const fs = require("node:fs");
const { defineConfig } = require("@playwright/test");
const { generateE2ELicenseCode } = require("./scripts/e2e-license");

const browserExecutablePath =
  process.env.PLAYWRIGHT_E2E_BROWSER_EXECUTABLE_PATH ||
  [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ].find((candidatePath) => fs.existsSync(candidatePath));

const e2eLicenseCode =
  process.env.SOM_E2E_LICENSE_CODE ||
  generateE2ELicenseCode({
    days: 365,
    schoolName: process.env.SOM_E2E_SCHOOL_NAME || "مدرسة تجريبية",
    institutionCode: process.env.SOM_E2E_INSTITUTION_CODE || "TRIAL-4100",
    secret: process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling"
  });

process.env.SOM_E2E_LICENSE_CODE = e2eLicenseCode;

const e2eBaseUrl = process.env.SOM_E2E_BASE_URL || "http://127.0.0.1:4188";

const webServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER
  ? undefined
  : {
      command: "node scripts/e2e-server.js",
      url: e2eBaseUrl,
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        ...process.env,
        SOM_PRO_LICENSE_SECRET: process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling",
        SOM_PRO_AUTH_SECRET: process.env.SOM_PRO_AUTH_SECRET || "change-this-auth-secret-before-selling",
        SOM_PRO_REQUIRE_CENTRAL_LICENSE: process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE || "false",
        SOM_PRO_LICENSE_SERVER_URL: process.env.SOM_PRO_LICENSE_SERVER_URL || "",
        SOM_LICENSE_SERVER_URL: process.env.SOM_LICENSE_SERVER_URL || "",
        CORS_ORIGIN: process.env.CORS_ORIGIN || "http://127.0.0.1:4188,http://localhost:4188",
        SOM_E2E_LICENSE_CODE: e2eLicenseCode,
        SOM_E2E_ADMIN_EMAIL: process.env.SOM_E2E_ADMIN_EMAIL || "admin662452",
        SOM_E2E_ADMIN_PASSWORD: process.env.SOM_E2E_ADMIN_PASSWORD || "E2E-Playwright-123!",
        SOM_E2E_ADMIN_NAME: process.env.SOM_E2E_ADMIN_NAME || "مدير المدرسة",
        SOM_E2E_SCHOOL_ID: process.env.SOM_E2E_SCHOOL_ID || "default-school",
        SOM_E2E_SCHOOL_NAME: process.env.SOM_E2E_SCHOOL_NAME || "مدرسة تجريبية",
        SOM_E2E_INSTITUTION_CODE: process.env.SOM_E2E_INSTITUTION_CODE || "TRIAL-4100",
        SOM_E2E_CLASS_NAME: process.env.SOM_E2E_CLASS_NAME || "الصف التجريبي الأول",
        SOM_E2E_SUBJECT_NAME: process.env.SOM_E2E_SUBJECT_NAME || "رياضيات",
        SOM_E2E_TEACHER_NAME: process.env.SOM_E2E_TEACHER_NAME || "معلم تجريبي",
        SOM_E2E_STUDENT_NAME: process.env.SOM_E2E_STUDENT_NAME || "طالب تجريبي"
      }
    };

module.exports = defineConfig({
  testDir: "./tests/e2e/playwright",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: e2eBaseUrl,
    locale: "ar",
    trace: "off",
    screenshot: "only-on-failure",
    video: "off",
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      executablePath: browserExecutablePath
    }
  },
  webServer
});
