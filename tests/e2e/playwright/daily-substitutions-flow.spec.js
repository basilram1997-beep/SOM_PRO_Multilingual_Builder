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
  await expect(page.locator('[data-e2e="daily-status-teacher"]')).toBeVisible();
}

test.describe.serial("SOM PRO end-to-end daily substitutions flow", () => {
  test("director generates daily substitutions and applies a manual substitute", async ({ page }) => {
    const directorAuth = await apiLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await setBrowserAuth(page, directorAuth);
    await openDailyProgram(page);
    await expect.poll(async () => page.evaluate(() => document.documentElement.dir)).toBe("rtl");

    const teacherSelect = page.locator('[data-e2e="daily-status-teacher"]');
    await expect.poll(async () => teacherSelect.evaluate((select) => select.options.length)).toBeGreaterThan(1);

    const fromSelect = page.locator('[data-e2e="daily-status-from"]');
    const toSelect = page.locator('[data-e2e="daily-status-to"]');
    const fromValue = await fromSelect.evaluate((select) => select.options[0]?.value || select.value);
    const toValue = await toSelect.evaluate((select) => {
      const last = select.options[select.options.length - 1];
      return last?.value || select.value;
    });

    const teacherCount = await teacherSelect.evaluate((select) => select.options.length);
    let substitutionRow = null;
    let chosenTeacherName = "";

    for (let index = 1; index < Math.min(teacherCount, 7); index += 1) {
      await teacherSelect.selectOption({ index });
      chosenTeacherName = await teacherSelect.evaluate(
        (select) => select.selectedOptions?.[0]?.textContent?.trim() || ""
      );
      await page.locator('[data-e2e="daily-status-type"]').selectOption("ABSENT");
      if (fromValue) await fromSelect.selectOption({ value: String(fromValue) });
      if (toValue) await toSelect.selectOption({ value: String(toValue) });
      await page.locator('[data-e2e="daily-status-reason"]').fill(`E2E absence for ${chosenTeacherName || index}`);
      await page.locator('[data-e2e="daily-status-add"]').click();
      await page.locator('[data-e2e="daily-generate"]').click();
      await clickStable(page.locator('[data-e2e="nav-program-substitutions"]'));

      const rows = page.locator('[data-e2e^="daily-substitution-row-"]');
      if (await rows.count()) {
        substitutionRow = rows.first();
        break;
      }

      await clickStable(page.locator('[data-e2e="nav-program-daily"]'));
      const removeButtons = page.locator('[data-e2e^="daily-status-remove-"]');
      if (await removeButtons.count()) {
        await removeButtons.last().click();
      }
    }

    expect(substitutionRow, "Expected at least one substitution row after generating daily schedule").not.toBeNull();

    const editableCell = page.locator('[data-e2e^="daily-substitution-edit-"]').first();
    await clickStable(editableCell);
    await expect(page.locator(".modal-card")).toBeVisible();

    const candidateButton = page.locator('[data-e2e^="daily-substitute-option-"]').first();
    await expect(candidateButton).toBeVisible();
    await page.locator(".modal-backdrop").click({ position: { x: 4, y: 4 } });
    await expect(page.locator(".modal-card")).toHaveCount(0);

    await clickStable(page.locator('[data-e2e="nav-program-substitutions"]'));
    await expect(page.locator('[data-e2e^="daily-substitution-row-"]').first()).toBeVisible();
    const substitutionsExport = page.locator('[data-e2e="daily-substitutions-export"]');
    await expect(substitutionsExport).toBeVisible();
    await page.once("dialog", (dialog) => dialog.accept());
    const substitutionsDownloadPromise = page.waitForEvent("download");
    await substitutionsExport.click();
    const substitutionsDownload = await substitutionsDownloadPromise;
    expect(substitutionsDownload.suggestedFilename()).toMatch(/\.html$/i);

    await clickStable(page.locator('[data-e2e="nav-program-daily"]'));
    const fullScheduleExport = page.locator("section.card:has(#daily-full-schedule-section) button");
    await expect(fullScheduleExport).toBeVisible();
    await page.once("dialog", (dialog) => dialog.accept());
    const fullScheduleDownloadPromise = page.waitForEvent("download");
    await fullScheduleExport.click();
    const fullScheduleDownload = await fullScheduleDownloadPromise;
    expect(fullScheduleDownload.suggestedFilename()).toMatch(/\.html$/i);
    await page.locator('[data-e2e="daily-archive"]').click();
    await expect(page.locator('[data-e2e="archive-page"]')).toBeVisible();
    const archiveRow = page.locator(`[data-e2e="archive-row-${new Date().toISOString().slice(0, 10)}"]`);
    await expect(archiveRow).toBeVisible();
    await expect(archiveRow).toContainText(/1|٢|١/);
  });
});
