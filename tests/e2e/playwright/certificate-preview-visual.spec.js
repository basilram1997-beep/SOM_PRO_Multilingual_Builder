const { expect, test } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { getE2ELicenseCode, openSidebarSection } = require("./e2e-helpers");

const ADMIN_EMAIL = process.env.SOM_E2E_ADMIN_EMAIL || "admin662452";
const ADMIN_PASSWORD = process.env.SOM_E2E_ADMIN_PASSWORD || "E2E-Playwright-123!";
const LICENSE_CODE = getE2ELicenseCode();
const E2E_API_BASE_URL = process.env.SOM_E2E_API_BASE_URL || "http://127.0.0.1:4000";
const VISUAL_OUTPUT_DIR = path.resolve("tests/e2e/artifacts");
const VISUAL_SCREENSHOT_PATH = path.join(VISUAL_OUTPUT_DIR, "certificate-preview.png");
const VISUAL_SOURCE_PATH = path.join(VISUAL_OUTPUT_DIR, "certificate-preview.html");

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

async function ensurePreviewStudent(page, headers, classId) {
  const response = await page.request.get(`${E2E_API_BASE_URL}/api/students?classId=${encodeURIComponent(classId)}`, {
    headers
  });
  const payload = await response.json();
  const students = Array.isArray(payload?.data) ? payload.data : [];
  if (students.length > 0) {
    return students[0];
  }

  const suffix = Date.now().toString(36);
  const createResponse = await page.request.post(`${E2E_API_BASE_URL}/api/students`, {
    headers,
    data: {
      name: `\u0637\u0627\u0644\u0628 \u0627\u0644\u0644\u0642\u0637\u0629 ${suffix}`,
      nationalId: `39${String(Date.now()).slice(-7)}`,
      classId
    }
  });
  const createPayload = await createResponse.json();
  if (!createResponse.ok()) {
    throw new Error(
      createPayload?.message || `Could not create a certificate preview student (${createResponse.status()})`
    );
  }
  return createPayload.data;
}

test.describe.serial("SOM PRO certificate preview visual render", () => {
  test("captures the printable certificate preview as a visual artifact", async ({ page }, testInfo) => {
    const directorAuth = await apiLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const headers = { Authorization: `Bearer ${directorAuth.token}` };
    const classesResponse = await page.request.get(`${E2E_API_BASE_URL}/api/classes`, { headers });
    const classesPayload = await classesResponse.json();
    const classes = Array.isArray(classesPayload?.data) ? classesPayload.data : [];
    if (classes.length === 0) {
      throw new Error("No classes were available for the certificate preview visual test.");
    }

    const previewClass = classes[0];
    await ensurePreviewStudent(page, headers, previewClass.id);
    await setBrowserAuth(page, directorAuth);

    await openSidebarSection(
      page,
      '[data-e2e="nav-group-toggle-students-management"]',
      '[data-e2e="nav-student-certificates"]'
    );
    await expect(page.locator('[data-e2e="student-certificates-page"]')).toBeVisible();

    const classSelect = page.locator('[data-e2e="certificate-class-select"]');
    await expect.poll(async () => classSelect.evaluate((select) => select.options.length)).toBeGreaterThan(1);
    await classSelect.selectOption(previewClass.id);

    const firstStudentRow = page.locator('[data-e2e^="certificate-student-row-"]').first();
    await expect(firstStudentRow).toBeVisible();
    await firstStudentRow.click();

    await page.locator('[data-e2e="certificate-save"]').click({ force: true });
    await expect(page.locator('.form-message[role="status"]').first()).toContainText(/saved|حفظ/i);

    const downloadPromise = page.waitForEvent("download");
    await page.locator('[data-e2e="certificate-export"]').click({ force: true });
    const download = await downloadPromise;

    await fs.mkdir(VISUAL_OUTPUT_DIR, { recursive: true });
    await download.saveAs(VISUAL_SOURCE_PATH);

    await page.goto(pathToFileURL(VISUAL_SOURCE_PATH).href);
    const previewSheet = page.locator(".certificate-print-sheet");
    await expect(previewSheet).toBeVisible({ timeout: 10_000 });

    const screenshotPath = testInfo.outputPath("certificate-preview.png");
    await previewSheet.screenshot({
      path: screenshotPath,
      animations: "disabled"
    });

    await fs.copyFile(screenshotPath, VISUAL_SCREENSHOT_PATH);
    await expect(page.locator(".certificate-print-center h1")).toBeVisible();
    await expect(page.locator(".certificate-print-table")).toBeVisible();
    await expect(page.locator(".certificate-print-signatures")).toBeVisible();
  });
});
