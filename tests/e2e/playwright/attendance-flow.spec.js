const { expect, test } = require("@playwright/test");
const { getE2ELicenseCode, openSidebarSection } = require("./e2e-helpers");

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

test.describe.serial("SOM PRO end-to-end attendance flow", () => {
  test("director records attendance, archives it, and sees the same class in reports", async ({ page }) => {
    const directorAuth = await apiLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await setBrowserAuth(page, directorAuth);

    await openSidebarSection(
      page,
      '[data-e2e="nav-group-toggle-students-management"]',
      '[data-e2e="nav-student-attendance"]'
    );
    await expect(page.locator('[data-e2e="attendance-class-select"]')).toBeVisible();

    const attendanceClassSelect = page.locator('[data-e2e="attendance-class-select"]');
    await expect.poll(async () => attendanceClassSelect.evaluate((select) => select.options.length)).toBeGreaterThan(1);
    await attendanceClassSelect.selectOption({ index: 1 });

    const selectedClassId = await attendanceClassSelect.evaluate((select) => select.value);
    const selectedClassName = await attendanceClassSelect.evaluate((select) => {
      const option = select.selectedOptions?.[0] || select.options?.[select.selectedIndex];
      return option?.textContent?.trim() || option?.value || "";
    });
    expect(selectedClassName).toBeTruthy();

    await expect(page.locator('[data-e2e^="attendance-row-"]').first()).toBeVisible();
    const selectedStudentName = (await page.locator(".student-attendance-name").first().textContent())?.trim();
    expect(selectedStudentName).toBeTruthy();

    const firstPresentButton = page.locator('[data-e2e^="attendance-present-"]').first();
    await firstPresentButton.click({ force: true });
    await expect(page.locator('.form-message[role="status"]').first()).toContainText(/حفظ|saved/i);

    await page.locator('[data-e2e="attendance-archive-save"]').click({ force: true });
    await expect(page.locator(".attendance-archive-report")).toContainText(selectedClassName);
    await expect(page.locator(".attendance-archive-report")).toContainText(/حاضر\s*1/);

    await openSidebarSection(page, '[data-e2e="nav-group-toggle-school-settings"]', '[data-e2e="nav-reports"]');
    await expect(page.locator('[data-e2e="reports-page"]')).toBeVisible();
    await page.locator('[data-e2e="report-tab-attendance"]').click();
    await expect
      .poll(async () =>
        page.locator('[data-e2e="attendance-class-filter"]').evaluate((select) => select.options.length)
      )
      .toBeGreaterThan(1);
    await page.locator('[data-e2e="attendance-class-filter"]').selectOption(selectedClassId);
    await page.locator('[data-e2e="attendance-show"]').click();

    const expectedDate = new Date().toISOString().slice(0, 10);
    await expect(page.locator("#attendance-report-print")).toContainText(selectedClassName);
    await expect(page.locator("#attendance-report-print")).toContainText(selectedStudentName);
    await expect(page.locator("#attendance-report-print")).toContainText(expectedDate);
    await expect(page.locator("#attendance-report-print table tbody tr").first()).toContainText(/حاضر|Present/);
  });
});
