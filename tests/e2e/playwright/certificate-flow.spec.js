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

test.describe.serial("SOM PRO end-to-end certificate flow", () => {
  test("director prepares, approves, and exports a certificate", async ({ page }) => {
    const directorAuth = await apiLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await setBrowserAuth(page, directorAuth);
    await expect.poll(async () => page.evaluate(() => document.documentElement.dir)).toBe("rtl");

    await openSidebarSection(
      page,
      '[data-e2e="nav-group-toggle-students-management"]',
      '[data-e2e="nav-student-certificates"]'
    );
    await expect(page.locator('[data-e2e="student-certificates-page"]')).toBeVisible();

    const classSelect = page.locator('[data-e2e="certificate-class-select"]');
    await expect.poll(async () => classSelect.evaluate((select) => select.options.length)).toBeGreaterThan(1);
    const classOptions = await classSelect.evaluate((select) =>
      Array.from(select.options)
        .map((option) => ({ value: option.value, label: option.textContent?.trim() || option.value || "" }))
        .filter((option) => option.value)
    );

    let selectedClassName = "";
    for (const option of classOptions) {
      await classSelect.selectOption(option.value);
      try {
        await expect
          .poll(
            async () => {
              await page.waitForTimeout(500);
              return page.locator('[data-e2e^="certificate-student-row-"]').count();
            },
            { timeout: 15000 }
          )
          .toBeGreaterThan(0);
        selectedClassName = option.label;
        break;
      } catch {
        selectedClassName = "";
      }
    }
    expect(selectedClassName).toBeTruthy();

    await expect(page.locator('[data-e2e^="certificate-student-row-"]').first()).toBeVisible();
    const selectedStudentName = (
      await page.locator(".certificate-student-row td:nth-child(2)").first().textContent()
    )?.trim();
    expect(selectedStudentName).toBeTruthy();

    await page.locator('[data-e2e^="certificate-student-row-"]').first().click();

    const typeSelect = page.locator('[data-e2e="certificate-type-select"]');
    await expect(typeSelect).toBeVisible();

    await page.locator('[data-e2e="certificate-save"]').click({ force: true });
    await expect(page.locator('.form-message[role="status"]').first()).toContainText(/حفظ|saved/i);

    await page.locator('[data-e2e="certificate-approve"]').click({ force: true });
    await expect(page.locator('[data-e2e="certificate-publish"]')).toBeEnabled();

    await page.locator('[data-e2e="certificate-publish"]').click({ force: true });
    await expect(page.locator('[data-e2e="certificate-export"]')).toBeEnabled();

    const downloadPromise = page.waitForEvent("download");
    await page.locator('[data-e2e="certificate-export"]').click({ force: true });
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.html$/i);

    await expect(page.locator('[data-e2e="certificate-preview-shell"]')).toBeVisible();
    await expect(page.locator('[data-e2e="certificate-preview-shell"]')).toContainText(selectedStudentName);
    await expect(page.locator('[data-e2e="certificate-preview-shell"]')).toContainText(selectedClassName);
    await expect(page.locator('[data-e2e="certificate-preview-shell"]')).not.toContainText("common.none");
  });
});
