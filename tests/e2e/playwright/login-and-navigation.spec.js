const { expect, test } = require("@playwright/test");
const { clickStable, getE2ELicenseCode, openSidebarSection } = require("./e2e-helpers");

const DEFAULT_ADMIN_EMAIL = "admin662452";
const DEFAULT_ADMIN_PASSWORD = "E2E-Playwright-123!";
let bootstrapPromise;

async function authenticate(page) {
  await page.goto("/");
  await expect(page.locator('[data-e2e="login-screen"]')).toBeVisible();

  const licenseCode = getE2ELicenseCode();
  const email = process.env.SOM_E2E_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  const password = process.env.SOM_E2E_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

  bootstrapPromise ||= page.request
    .post("http://localhost:4000/api/auth/bootstrap-license", {
      data: { licenseCode, licenseKey: licenseCode }
    })
    .then(async (response) => {
      if (!response.ok() && response.status() !== 429) {
        throw new Error(`Bootstrap failed with status ${response.status()}`);
      }
    });
  await bootstrapPromise;

  const loginResponse = await page.request.post("http://localhost:4000/api/auth/login", {
    data: { email, password, licenseCode, licenseKey: licenseCode }
  });
  const loginPayload = await loginResponse.json();
  if (!loginResponse.ok()) {
    throw new Error(
      loginPayload?.message || loginPayload?.error || `Login failed with status ${loginResponse.status()}`
    );
  }

  const authToken = loginPayload?.data?.token || "";
  if (!authToken) {
    throw new Error("E2E auth token was not available for the browser smoke flow.");
  }

  await page.evaluate(
    ({ token, user }) => {
      window.__somSetAuthToken?.(token);
      window.__somSetCurrentUser?.(user);
    },
    {
      token: authToken,
      user: loginPayload?.data?.user || null
    }
  );

  await expect(page.locator('[data-e2e="app-shell"]')).toBeVisible({ timeout: 10_000 });
}

test.describe("SOM PRO browser smoke path", () => {
  test("logs in and reaches the teachers page", async ({ page }) => {
    await authenticate(page);

    await clickStable(page.locator('[data-e2e="nav-teachers"]'));
    await expect(page.locator('[data-e2e="teachers-page"]')).toBeVisible();
  });

  test("opens the student management area and shows the seeded data", async ({ page }) => {
    await authenticate(page);

    await openSidebarSection(
      page,
      '[data-e2e="nav-group-toggle-students-management"]',
      '[data-e2e="nav-student-files"]'
    );
    await expect(page.locator('[data-e2e="students-page"]')).toBeVisible();
    await page.locator('[data-e2e="students-class-filter"]').selectOption({ index: 1 });
    await expect(page.locator('[data-e2e="students-page"] .row-actions').first()).toBeVisible();
  });
});
