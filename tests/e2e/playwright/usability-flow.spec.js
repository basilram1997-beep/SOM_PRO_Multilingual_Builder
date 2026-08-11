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
    throw new Error("E2E auth token was not available for the usability flow.");
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

async function expectNoHorizontalOverflow(page, label) {
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

const viewports = [
  { label: "desktop", width: 1440, height: 900 },
  { label: "mobile", width: 390, height: 844 }
];

for (const viewport of viewports) {
  test.describe(`SOM PRO usability (${viewport.label})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test(`keeps the flow clear on ${viewport.label}`, async ({ page }) => {
      await page.goto("/");
      await expect(page.locator('[data-e2e="login-screen"]')).toBeVisible();
      await expect(page.locator('[data-e2e="login-form"]')).toBeVisible();
      await expect(page.locator("#login-username-input")).toBeVisible();
      await expect(page.locator("#login-password-input")).toBeVisible();
      await expect(page.locator('[data-e2e="login-form"] button[type="submit"]')).toBeVisible();

      const initialHeading = (await page.locator(".login-card h1").textContent()) || "";
      await page.locator(".login-language-switcher button", { hasText: "EN" }).click();
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
      const englishHeading = (await page.locator(".login-card h1").textContent()) || "";
      expect(englishHeading).not.toBe(initialHeading);

      await page.locator(".login-language-switcher button", { hasText: "HE" }).click();
      await expect(page.locator("html")).toHaveAttribute("lang", "he");
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

      await page.locator(".login-language-switcher button", { hasText: "AR" }).click();
      await expect(page.locator("html")).toHaveAttribute("lang", "ar");
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

      await page.locator("#login-username-input").focus();
      await page.keyboard.press("Tab");
      await expect(page.locator("#login-password-input")).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(page.locator('[data-e2e="login-form"] .login-remember input[type="checkbox"]')).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(page.locator('[data-e2e="login-form"] button[type="submit"]')).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(page.locator('[data-e2e="login-form"] .login-open-create-button')).toBeFocused();

      await authenticate(page);
      await expectNoHorizontalOverflow(page, `${viewport.label} dashboard`);

      await clickStable(page.locator('[data-e2e="nav-teachers"]'));
      await expect(page.locator('[data-e2e="teachers-page"]')).toBeVisible();
      await expect(page.locator("#main-content")).toBeFocused();

      await openSidebarSection(
        page,
        '[data-e2e="nav-group-toggle-students-management"]',
        '[data-e2e="nav-student-files"]'
      );
      await expect(page.locator('[data-e2e="students-page"]')).toBeVisible();
      await expect(page.locator("#main-content")).toBeFocused();

      await openSidebarSection(page, '[data-e2e="nav-group-toggle-school-settings"]', '[data-e2e="nav-reports"]');
      await expect(page.locator('[data-e2e="reports-page"]')).toBeVisible();
      await expect(page.locator("#main-content")).toBeFocused();
      await expectNoHorizontalOverflow(page, `${viewport.label} reports`);
    });
  });
}
