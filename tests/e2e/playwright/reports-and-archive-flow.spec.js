const { expect, test } = require("@playwright/test");
const { getE2ELicenseCode, clickStable } = require("./e2e-helpers");

const ADMIN_EMAIL = process.env.SOM_E2E_ADMIN_EMAIL || "admin662452";
const ADMIN_PASSWORD = process.env.SOM_E2E_ADMIN_PASSWORD || "E2E-Playwright-123!";
const LICENSE_CODE = getE2ELicenseCode();
const E2E_API_BASE_URL = process.env.SOM_E2E_API_BASE_URL || "http://127.0.0.1:4000";

let bootstrapPromise;

async function bootstrapLicense(page) {
  if (!LICENSE_CODE) {
    throw new Error("Missing E2E license code.");
  }

  bootstrapPromise ||= page.request
    .post(`${E2E_API_BASE_URL}/api/auth/bootstrap-license`, {
      data: { licenseCode: LICENSE_CODE, licenseKey: LICENSE_CODE }
    })
    .then(async (response) => {
      if (!response.ok() && response.status() !== 429) {
        throw new Error(`Bootstrap failed with status ${response.status()}`);
      }
    });

  await bootstrapPromise;
}

async function apiLogin(page, email, password) {
  await bootstrapLicense(page);
  const response = await page.request.post(`${E2E_API_BASE_URL}/api/auth/login`, {
    data: { email, password, licenseCode: LICENSE_CODE, licenseKey: LICENSE_CODE }
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
  await page.goto("/");
  await page.evaluate(
    ({ token, user }) => {
      window.__somSetAuthToken?.(token);
      window.__somSetCurrentUser?.(user);
    },
    { token: auth.token, user: auth.user }
  );
  await expect(page.locator('[data-e2e="app-shell"]')).toBeVisible({ timeout: 10_000 });
}

async function openDailyProgram(page) {
  await clickStable(page.locator('[data-e2e="nav-program-daily"]'));
  await expect(page.locator('[data-e2e="daily-page"]')).toBeVisible();
}

test.describe.serial("SOM PRO end-to-end reports and archive flow", () => {
  test("director archives a daily change and reviews reports", async ({ page }) => {
    const directorAuth = await apiLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await setBrowserAuth(page, directorAuth);
    await openDailyProgram(page);

    const teacherSelect = page.locator('[data-e2e="daily-status-teacher"]');
    await expect.poll(async () => teacherSelect.evaluate((select) => select.options.length)).toBeGreaterThan(1);
    const teacherName = await teacherSelect.evaluate((select) => {
      const option = select.options[1];
      return option?.textContent?.trim() || option?.value || "";
    });
    await teacherSelect.selectOption({ index: 1 });
    expect(teacherName).toBeTruthy();

    await page.locator('[data-e2e="daily-status-type"]').selectOption("ABSENT");
    await page.locator('[data-e2e="daily-status-reason"]').fill("E2E administrative archive review");
    await page.locator('[data-e2e="daily-status-add"]').click();
    await page.locator('[data-e2e="daily-generate"]').click();
    await page.locator('[data-e2e="daily-archive"]').click();

    const today = new Date().toISOString().slice(0, 10);
    await expect(page.locator('[data-e2e="archive-page"]')).toBeVisible();
    const archiveRow = page.locator(`[data-e2e="archive-row-${today}"]`);
    await expect(archiveRow).toBeVisible();
    await expect(archiveRow).toContainText(today);

    await clickStable(page.locator('[data-e2e="nav-reports"]'));
    await expect(page.locator('[data-e2e="reports-page"]')).toBeVisible();
    await page.locator('[data-e2e="report-tab-daily"]').click();
    await page.locator('[data-e2e="report-daily-date"]').fill(today);
    await page.locator('[data-e2e="report-daily-show"]').click();

    const dailyReport = page.locator("#daily-report-print");
    await expect(dailyReport).toBeVisible();
    await expect(dailyReport).toContainText(today);
    await expect.poll(async () => dailyReport.locator(".chart-row").count()).toBeGreaterThan(0);
    await expect(dailyReport.locator(".report-triple-grid")).toBeVisible();
  });
});
