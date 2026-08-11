const { expect, test } = require("@playwright/test");
const { clickStable, getE2ELicenseCode, openSidebarSection } = require("./e2e-helpers");

const DEFAULT_ADMIN_EMAIL = "admin662452";
const DEFAULT_ADMIN_PASSWORD = "E2E-Playwright-123!";

async function authenticate(page) {
  const licenseCode = getE2ELicenseCode();
  const email = process.env.SOM_E2E_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  const password = process.env.SOM_E2E_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

  const loginResponse = await page.request.post("http://127.0.0.1:4000/api/auth/login", {
    data: { email, password, licenseCode, licenseKey: licenseCode }
  });
  const loginPayload = await loginResponse.json();
  if (!loginResponse.ok()) {
    throw new Error(loginPayload?.message || `Login failed with status ${loginResponse.status()}`);
  }

  const authToken = loginPayload?.data?.token || "";
  if (!authToken) {
    throw new Error("E2E auth token was not available for the mobile accessibility flow.");
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
    bodyScrollWidth: document.body.scrollWidth
  }));

  expect(metrics.scrollWidth, `${label} should not overflow horizontally`).toBeLessThanOrEqual(metrics.innerWidth + 2);
  expect(metrics.bodyScrollWidth, `${label} body should not overflow horizontally`).toBeLessThanOrEqual(
    metrics.innerWidth + 2
  );
}

test.describe("SOM PRO mobile accessibility", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps skip links, landmarks, and offline status usable on mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-e2e="login-screen"]')).toBeVisible();
    await expect(page.locator('[data-e2e="login-system-status"]')).toHaveAttribute("role", "status");

    await page.keyboard.press("Tab");
    await expect(page.locator(".skip-link")).toBeFocused();

    await page.context().setOffline(true);
    await page.waitForTimeout(250);
    await expect(page.locator('[data-e2e="login-system-status"]')).toContainText(/Offline|غير متصل|לא מחובר/);

    await page.context().setOffline(false);
    await page.waitForTimeout(250);
    await authenticate(page);
    await expect(page.locator('[data-e2e="shell-connection-status"]')).toHaveAttribute("role", "status");
    await expect(page.locator('[data-e2e="shell-connection-status"]')).toContainText(/Connected|متصل|מחובר/);
    await expect(page.locator('[data-e2e="sidebar-nav"]')).toBeVisible();
    await expect(page.locator("#main-content")).toBeVisible();

    await clickStable(page.locator('[data-e2e="nav-teachers"]'));
    await expect(page.locator('[data-e2e="teachers-page"]')).toBeVisible();
    await expect(page.locator("#main-content")).toBeFocused();

    await page.context().setOffline(true);
    await page.waitForTimeout(250);
    await expect(page.locator('[data-e2e="shell-connection-status"]')).toContainText(/Offline|غير متصل|לא מחובר/);

    await page.context().setOffline(false);
    await page.waitForTimeout(250);
    await openSidebarSection(
      page,
      '[data-e2e="nav-group-toggle-students-management"]',
      '[data-e2e="nav-student-files"]'
    );
    await expect(page.locator('[data-e2e="students-page"]')).toBeVisible();
    await assertNoHorizontalOverflow(page, "mobile shell");
  });
});
