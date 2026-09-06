const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");
const { generateE2ELicenseCode } = require("./e2e-license");

const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "store", "screenshots");
const baseUrl = process.env.SOM_E2E_BASE_URL || "http://127.0.0.1:4188";
const apiUrl = process.env.SOM_E2E_API_BASE_URL || "http://127.0.0.1:4000";
const demoDate = process.env.SOM_E2E_DATE || "2026-08-22";
const viewport = { width: 1080, height: 1920 };

const browserExecutablePath = process.env.PLAYWRIGHT_E2E_BROWSER_EXECUTABLE_PATH || undefined;

const e2eLicenseCode =
  process.env.SOM_E2E_LICENSE_CODE ||
  generateE2ELicenseCode({
    days: 365,
    schoolName: process.env.SOM_E2E_SCHOOL_NAME || "مدرسة تجريبية",
    institutionCode: process.env.SOM_E2E_INSTITUTION_CODE || "TRIAL-4100",
    secret: process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling"
  });

const e2eEnv = {
  ...process.env,
  SOM_E2E_DATE: demoDate,
  SOM_PRO_LICENSE_SERVER_URL: "",
  SOM_LICENSE_SERVER_URL: "",
  SOM_PRO_REQUIRE_CENTRAL_LICENSE: "false",
  SOM_PRO_LICENSE_SECRET: process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling",
  SOM_PRO_AUTH_SECRET: process.env.SOM_PRO_AUTH_SECRET || "change-this-auth-secret-before-selling",
  CORS_ORIGIN: "http://localhost:4188,http://127.0.0.1:4188",
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
  SOM_E2E_STUDENT_NAME: process.env.SOM_E2E_STUDENT_NAME || "طالب تجريبي",
  SOM_E2E_STUDENT_EMAIL: process.env.SOM_E2E_STUDENT_EMAIL || "student.demo@som.local",
  SOM_E2E_STUDENT_PASSWORD: process.env.SOM_E2E_STUDENT_PASSWORD || "Demo12345!"
};

let serverProcess = null;

function trace(message, details) {
  if (details === undefined) {
    console.log(`[${new Date().toISOString()}] ${message}`);
    return;
  }
  console.log(`[${new Date().toISOString()}] ${message}`, details);
}

async function waitForUrl(url, timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5_000);
      timer.unref?.();

      const response = await fetch(url, { method: "GET", signal: controller.signal });
      clearTimeout(timer);
      if (response.ok || response.status === 304) {
        return;
      }
    } catch {
      // Keep waiting until the local service is ready.
    }

    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 1000);
      timer.unref?.();
    });
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForExit(child, timeoutMs = 5000) {
  if (!child) {
    return;
  }

  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  await Promise.race([
    new Promise((resolve) => {
      child.once("exit", resolve);
      child.once("error", resolve);
    }),
    new Promise((resolve) => {
      const timer = setTimeout(resolve, timeoutMs);
      timer.unref?.();
    })
  ]);
}

async function terminateProcessTree(child) {
  if (!child?.pid) {
    return;
  }

  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true
      });

      killer.once("exit", resolve);
      killer.once("error", resolve);
    });
    await waitForExit(child, 5000);
    return;
  }

  child.kill("SIGTERM");
  await waitForExit(child, 5000);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
  }
}

function startServer() {
  serverProcess = spawn(process.execPath, ["scripts/e2e-server.js"], {
    cwd: projectRoot,
    stdio: "inherit",
    windowsHide: true,
    env: e2eEnv,
    shell: false
  });
  return serverProcess;
}

async function stopServer() {
  if (!serverProcess) {
    return;
  }

  await terminateProcessTree(serverProcess);
  await waitForExit(serverProcess, 5000);
}

async function apiLogin(page, email, password) {
  const response = await page.request.post(`${apiUrl}/api/auth/login`, {
    data: {
      email,
      password
    }
  });
  const payload = await response.json();
  if (!response.ok()) {
    throw new Error(payload?.message || payload?.error || `Login failed with status ${response.status()}`);
  }

  if (!payload?.data?.token || !payload?.data?.user) {
    throw new Error("Login response did not include auth data.");
  }

  return payload.data;
}

async function setBrowserAuth(page, auth) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ token, user }) => {
      window.__somSetAuthToken?.(token);
      window.__somSetCurrentUser?.(user);
    },
    { token: auth.token, user: auth.user }
  );
  await page.locator('[data-e2e="app-shell"]').waitFor({ state: "visible", timeout: 10_000 });
}

async function clickStable(locator) {
  await locator.scrollIntoViewIfNeeded().catch(() => null);
  await locator.click({ force: true });
}

async function openSidebarSection(page, toggleSelector, itemSelector) {
  const toggle = page.locator(toggleSelector).first();
  const item = page.locator(itemSelector).first();

  if (!(await item.isVisible().catch(() => false))) {
    await clickStable(toggle);
    await item.waitFor({ state: "visible", timeout: 10_000 });
  }

  await clickStable(item);
}

async function capture(page, fileName, options = {}) {
  const { prepare, waitFor, preShotDelayMs = 500 } = options;
  if (typeof prepare === "function") {
    await prepare();
  }
  if (waitFor) {
    await page.locator(waitFor).waitFor({ state: "visible", timeout: 20_000 });
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(preShotDelayMs);
  const filePath = path.join(outputDir, fileName);
  await page.screenshot({
    path: filePath,
    fullPage: false,
    animations: "disabled"
  });
  trace(`saved ${fileName}`, { filePath });
}

async function autoSelectVisibleSelects(page) {
  const selects = page.locator("select");
  const count = await selects.count();
  for (let index = 0; index < count; index += 1) {
    const select = selects.nth(index);
    if (!(await select.isVisible().catch(() => false))) {
      continue;
    }
    const optionCount = await select.evaluate((element) => element.options.length).catch(() => 0);
    if (optionCount > 1) {
      const currentValue = await select.inputValue().catch(() => "");
      if (!currentValue) {
        try {
          await select.selectOption({ index: 1 });
        } catch {
          // Some selects are read-only filters or are not ready yet.
        }
      }
    }
  }
}

async function fillVisibleDateInputs(page, dateValue) {
  const dateInputs = page.locator('input[type="date"]');
  const count = await dateInputs.count();
  for (let index = 0; index < count; index += 1) {
    const input = dateInputs.nth(index);
    if (await input.isVisible().catch(() => false)) {
      try {
        await input.fill(dateValue);
      } catch {
        // Ignore date inputs that are read-only or tightly controlled by the app.
      }
    }
  }
}

async function fillFirstGradeInputs(page) {
  const inputs = page.locator('[data-e2e^="grade-entry-mark-"]');
  const count = await inputs.count();
  const values = ["9", "8", "7"];
  for (let index = 0; index < Math.min(count, values.length); index += 1) {
    const input = inputs.nth(index);
    if (await input.isVisible().catch(() => false)) {
      await input.fill(values[index]);
    }
  }
}

async function ensureCertificatePreview(page) {
  const previewButton = page.getByRole("button", { name: /معاينة|Preview/i }).first();
  if (await previewButton.isVisible().catch(() => false)) {
    await previewButton.click({ force: true });
    await page.locator('[data-e2e="certificate-preview-shell"]').waitFor({ state: "visible", timeout: 20_000 });
  }
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  const adminEmail = e2eEnv.SOM_E2E_ADMIN_EMAIL;
  const adminPassword = e2eEnv.SOM_E2E_ADMIN_PASSWORD;

  let browser;
  let context;
  let page;
  const failures = [];

  try {
    trace("starting local E2E services for store screenshots");
    startServer();
    await Promise.all([waitForUrl(`${baseUrl}/`, 45_000), waitForUrl(`${apiUrl}/health`, 45_000)]);

    browser = await chromium.launch({
      headless: true,
      executablePath: browserExecutablePath || undefined
    });

    context = await browser.newContext({
      baseURL: baseUrl,
      locale: "ar",
      viewport,
      deviceScaleFactor: 1,
      colorScheme: "light",
      acceptDownloads: true
    });

    page = await context.newPage();
    page.setDefaultTimeout(20_000);

    // Login screen screenshot before authentication.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    await page.locator('[data-e2e="login-form"]').waitFor({ state: "visible", timeout: 15_000 });
    await page.screenshot({
      path: path.join(outputDir, "01-login.png"),
      fullPage: false,
      animations: "disabled"
    });
    trace("saved 01-login.png", { filePath: path.join(outputDir, "01-login.png") });

    const auth = await apiLogin(page, adminEmail, adminPassword);
    await setBrowserAuth(page, auth);

    const shots = [
      {
        file: "02-dashboard.png",
        waitFor: ".dashboard-page",
        prepare: async () => {
          await clickStable(page.locator('[data-e2e="nav-dashboard"]'));
          await autoSelectVisibleSelects(page);
        }
      },
      {
        file: "03-daily-program.png",
        waitFor: '[data-e2e="daily-page"]',
        prepare: async () => {
          await openSidebarSection(page, '[data-e2e="nav-group-toggle-programs"]', '[data-e2e="nav-program-daily"]');
          await autoSelectVisibleSelects(page);
        }
      },
      {
        file: "04-lesson-today.png",
        waitFor: ".lesson-today-page",
        prepare: async () => {
          await openSidebarSection(
            page,
            '[data-e2e="nav-group-toggle-students-management"]',
            '[data-e2e="nav-student-lesson-today"]'
          );
          await autoSelectVisibleSelects(page);
        }
      },
      {
        file: "05-homework.png",
        waitFor: ".homework-page",
        prepare: async () => {
          await openSidebarSection(
            page,
            '[data-e2e="nav-group-toggle-students-management"]',
            '[data-e2e="nav-student-homework-preparation"]'
          );
          await autoSelectVisibleSelects(page);
        }
      },
      {
        file: "06-exams.png",
        waitFor: ".exam-page",
        prepare: async () => {
          await openSidebarSection(
            page,
            '[data-e2e="nav-group-toggle-students-management"]',
            '[data-e2e="nav-student-exams"]'
          );
          await autoSelectVisibleSelects(page);
        }
      },
      {
        file: "07-attendance.png",
        waitFor: ".student-attendance-page",
        prepare: async () => {
          await openSidebarSection(
            page,
            '[data-e2e="nav-group-toggle-students-management"]',
            '[data-e2e="nav-student-attendance"]'
          );
          await autoSelectVisibleSelects(page);
          await fillVisibleDateInputs(page, demoDate);
        }
      },
      {
        file: "08-behavior.png",
        waitFor: ".student-behavior-page",
        prepare: async () => {
          await openSidebarSection(
            page,
            '[data-e2e="nav-group-toggle-students-management"]',
            '[data-e2e="nav-student-behavior"]'
          );
          await autoSelectVisibleSelects(page);
          await fillVisibleDateInputs(page, demoDate);
        }
      },
      {
        file: "09-grades.png",
        waitFor: '[data-e2e="student-marks-page"]',
        prepare: async () => {
          await openSidebarSection(
            page,
            '[data-e2e="nav-group-toggle-students-management"]',
            '[data-e2e="nav-student-marks"]'
          );
          await autoSelectVisibleSelects(page);
          const subjectSelect = page.locator('[data-e2e="grade-entry-subject-select"]');
          if (await subjectSelect.isVisible().catch(() => false)) {
            const optionsCount = await subjectSelect.evaluate((select) => select.options.length).catch(() => 0);
            if (optionsCount > 1) {
              await subjectSelect.selectOption({ index: 1 }).catch(() => {});
            }
          }
          const termButton = page.locator('[data-e2e="grade-entry-type-TERM1_BIMONTHLY"]');
          if (await termButton.isVisible().catch(() => false)) {
            await termButton.click({ force: true });
          }
          await page
            .locator('[data-e2e="grade-entry-marks-table"]')
            .waitFor({ state: "visible", timeout: 20_000 })
            .catch(() => {});
          await fillFirstGradeInputs(page);
        }
      },
      {
        file: "10-certificates.png",
        waitFor: '[data-e2e="student-certificates-page"]',
        prepare: async () => {
          await openSidebarSection(
            page,
            '[data-e2e="nav-group-toggle-students-management"]',
            '[data-e2e="nav-student-certificates"]'
          );
          await autoSelectVisibleSelects(page);

          const classSelect = page.locator('[data-e2e="certificate-class-select"]');
          if (await classSelect.isVisible().catch(() => false)) {
            const optionsCount = await classSelect.evaluate((select) => select.options.length).catch(() => 0);
            if (optionsCount > 1) {
              await classSelect.selectOption({ index: 1 }).catch(() => {});
            }
          }

          await page.locator('[data-e2e^="certificate-student-row-"]').first().waitFor({
            state: "visible",
            timeout: 20_000
          });
          await page.locator('[data-e2e^="certificate-student-row-"]').first().click({ force: true });
          await ensureCertificatePreview(page);
        }
      },
      {
        file: "11-timetable.png",
        waitFor: ".timetable-page",
        prepare: async () => {
          await openSidebarSection(
            page,
            '[data-e2e="nav-group-toggle-students-management"]',
            '[data-e2e="nav-student-timetable"]'
          );
          await autoSelectVisibleSelects(page);
        }
      },
      {
        file: "12-reports.png",
        waitFor: '[data-e2e="reports-page"]',
        prepare: async () => {
          await openSidebarSection(page, '[data-e2e="nav-group-toggle-school-settings"]', '[data-e2e="nav-reports"]');
          await page
            .locator('[data-e2e="report-tab-daily"]')
            .click()
            .catch(() => {});
          const dateField = page.locator('[data-e2e="report-daily-date"]');
          if (await dateField.isVisible().catch(() => false)) {
            await dateField.fill(demoDate).catch(() => {});
          }
          await page
            .locator('[data-e2e="report-daily-show"]')
            .click()
            .catch(() => {});
          await page
            .locator("#daily-report-print")
            .waitFor({ state: "visible", timeout: 20_000 })
            .catch(() => {});
        }
      }
    ];

    for (const shot of shots) {
      try {
        await capture(page, shot.file, shot);
      } catch (error) {
        failures.push({ file: shot.file, error: error instanceof Error ? error.message : String(error) });
        trace(`failed to save ${shot.file}`, { error: error instanceof Error ? error.message : String(error) });
      }
    }
  } finally {
    if (page) {
      await page.close({ runBeforeUnload: false }).catch(() => {});
    }
    if (context) {
      await context.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
    await stopServer().catch(() => {});
  }

  if (failures.length > 0) {
    console.error("Some screenshots failed:");
    for (const failure of failures) {
      console.error(`- ${failure.file}: ${failure.error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Store screenshots saved to ${outputDir}`);
}

main().catch((failure) => {
  console.error(failure instanceof Error ? failure.stack || failure.message : failure);
  process.exitCode = 1;
});
