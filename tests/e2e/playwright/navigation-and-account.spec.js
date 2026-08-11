const { expect, test } = require("@playwright/test");
const { getE2ELicenseCode, clickStable, openSidebarSection, postJsonWithRetry } = require("./e2e-helpers");

const DEFAULT_ADMIN_EMAIL = "admin662452";
const DEFAULT_ADMIN_PASSWORD = "E2E-Playwright-123!";
let bootstrapPromise;

async function authenticate(page) {
  await page.goto("/");

  const licenseCode = getE2ELicenseCode();
  const email = process.env.SOM_E2E_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  const password = process.env.SOM_E2E_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

  if (!licenseCode) throw new Error("Missing E2E license code.");

  bootstrapPromise ||= postJsonWithRetry(page.request, "http://127.0.0.1:4000/api/auth/bootstrap-license", {
    licenseCode,
    licenseKey: licenseCode
  }).then(async (response) => {
    if (!response.ok() && response.status() !== 429) throw new Error(`Bootstrap failed: ${response.status()}`);
  });
  await bootstrapPromise;

  const loginResponse = await postJsonWithRetry(page.request, "http://127.0.0.1:4000/api/auth/login", {
    email,
    password,
    licenseCode,
    licenseKey: licenseCode
  });
  const loginPayload = await loginResponse.json();
  if (!loginResponse.ok()) throw new Error(loginPayload?.message || `Login failed: ${loginResponse.status()}`);

  const authToken = loginPayload?.data?.token || "";
  if (!authToken) throw new Error("Missing auth token for E2E smoke.");

  await page.evaluate(
    ([token]) => {
      window.__somSetAuthToken?.(token);
    },
    [authToken]
  );

  const currentUser = loginPayload?.data?.user || null;
  await page.evaluate(
    ([user]) => {
      window.__somSetCurrentUser?.(user);
    },
    [currentUser]
  );

  await expect(page.locator('[data-e2e="app-shell"]')).toBeVisible({ timeout: 10_000 });
}

test.describe("SOM PRO browser smoke - extended navigation", () => {
  test("moves through the main operational pages and logs out cleanly", async ({ page }) => {
    await authenticate(page);

    await clickStable(page.locator('[data-e2e="nav-teachers"]'));
    await expect(page.locator('[data-e2e="teachers-page"]')).toBeVisible();

    await openSidebarSection(
      page,
      '[data-e2e="nav-group-toggle-students-management"]',
      '[data-e2e="nav-student-files"]'
    );
    await expect(page.locator('[data-e2e="students-page"]')).toBeVisible();

    await clickStable(page.locator('[data-e2e="nav-program-daily"]'));
    await expect(page.locator(".daily-page")).toBeVisible();

    await openSidebarSection(page, '[data-e2e="nav-group-toggle-school-settings"]', '[data-e2e="nav-license"]');
    await expect(page.locator(".license-page")).toBeVisible();

    await page.locator(".logout-button").click();
    await expect(page.locator('[data-e2e="login-screen"]')).toBeVisible();
  });
});
