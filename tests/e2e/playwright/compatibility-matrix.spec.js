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
    .post("http://127.0.0.1:4000/api/auth/bootstrap-license", {
      data: { licenseCode, licenseKey: licenseCode }
    })
    .then(async (response) => {
      if (!response.ok() && response.status() !== 429) {
        throw new Error(`Bootstrap failed with status ${response.status()}`);
      }
    });
  await bootstrapPromise;

  const loginResponse = await page.request.post("http://127.0.0.1:4000/api/auth/login", {
    data: { email, password, licenseCode, licenseKey: licenseCode }
  });
  const loginPayload = await loginResponse.json();
  if (!loginResponse.ok()) {
    throw new Error(loginPayload?.message || `Login failed with status ${loginResponse.status()}`);
  }

  const authToken = loginPayload?.data?.token || "";
  if (!authToken) {
    throw new Error("E2E auth token was not available for the compatibility flow.");
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

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));

  expect(metrics.scrollWidth, `${label} should not overflow horizontally`).toBeLessThanOrEqual(metrics.innerWidth + 2);
  expect(metrics.bodyScrollWidth, `${label} body should not overflow horizontally`).toBeLessThanOrEqual(
    metrics.innerWidth + 2
  );
  expect(metrics.clientWidth, `${label} client width should match viewport`).toBeGreaterThan(0);
}

test.describe("SOM PRO compatibility matrix", () => {
  test("keeps the shell usable across layout sizes", async ({ page }) => {
    await authenticate(page);
    await assertNoHorizontalOverflow(page, "dashboard");
    await expect(page.locator('[data-e2e="sidebar-nav"]')).toBeVisible();

    await clickStable(page.locator('[data-e2e="nav-teachers"]'));
    await expect(page.locator('[data-e2e="teachers-page"]')).toBeVisible();
    await assertNoHorizontalOverflow(page, "teachers");

    await openSidebarSection(
      page,
      '[data-e2e="nav-group-toggle-students-management"]',
      '[data-e2e="nav-student-files"]'
    );
    await expect(page.locator('[data-e2e="students-page"]')).toBeVisible();
    await assertNoHorizontalOverflow(page, "students");

    await openSidebarSection(page, '[data-e2e="nav-group-toggle-school-settings"]', '[data-e2e="nav-reports"]');
    await expect(page.locator('[data-e2e="reports-page"]')).toBeVisible();
    await assertNoHorizontalOverflow(page, "reports");
  });
});
