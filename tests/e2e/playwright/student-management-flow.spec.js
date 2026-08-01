const { expect, test } = require("@playwright/test");
const { getE2ELicenseCode, openSidebarSection } = require("./e2e-helpers");
const { generateE2ELicenseCode } = require("../../../scripts/e2e-license");

const ADMIN_EMAIL = process.env.SOM_E2E_ADMIN_EMAIL || "admin662452";
const ADMIN_PASSWORD = process.env.SOM_E2E_ADMIN_PASSWORD || "E2E-Playwright-123!";
const LICENSE_CODE =
  getE2ELicenseCode() ||
  generateE2ELicenseCode({
    days: 365,
    schoolName: process.env.SOM_E2E_SCHOOL_NAME || "مدرسة تجريبية",
    institutionCode: process.env.SOM_E2E_INSTITUTION_CODE || "TRIAL-4100",
    secret: process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling"
  });
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

async function ensureStudentClasses(page, headers) {
  const response = await page.request.get(`${E2E_API_BASE_URL}/api/classes`, { headers });
  const payload = await response.json();
  const classes = Array.isArray(payload?.data) ? payload.data.slice() : [];

  while (classes.length < 2) {
    const suffix = `${Date.now().toString(36)}-${classes.length + 1}`;
    const createResponse = await page.request.post(`${E2E_API_BASE_URL}/api/classes`, {
      headers,
      data: {
        name: `صف تجريبي ${suffix}`,
        grade: "10",
        section: String(classes.length + 1)
      }
    });
    const createdPayload = await createResponse.json();
    if (!createResponse.ok()) {
      throw new Error(createdPayload?.message || `Could not create a test class (${createResponse.status()})`);
    }
    classes.push(createdPayload.data);
  }

  return classes;
}

async function openStudentsPage(page) {
  await openSidebarSection(page, '[data-e2e="nav-group-toggle-students-management"]', '[data-e2e="nav-student-files"]');
  await expect(page.locator('[data-e2e="students-page"]')).toBeVisible();
}

async function fillStudentForm(page, student) {
  await page.locator('[data-e2e="student-form-name"]').fill(student.name);
  await page.locator('[data-e2e="student-form-national-id"]').fill(student.nationalId);
  await page.locator('[data-e2e="student-form-class"]').selectOption(student.classId);
  await page.locator('[data-e2e="student-form-father-name"]').fill(student.fatherName || "");
  await page.locator('[data-e2e="student-form-mother-name"]').fill(student.motherName || "");
  await page.locator('[data-e2e="student-form-residence"]').fill(student.residence || "");
  await page.locator('[data-e2e="student-form-father-phone"]').fill(student.fatherPhone || "");
  await page.locator('[data-e2e="student-form-mother-phone"]').fill(student.motherPhone || "");
  await page.locator('[data-e2e="student-form-guardian-phone"]').fill(student.guardianPhone || "");
  await page.locator('[data-e2e="student-form-health-fund"]').fill(student.healthFund || "");
  await page.locator('[data-e2e="student-form-student-phone"]').fill(student.studentPhone || "");
}

function getStatusMessage(page) {
  return page.locator('.form-message[role="status"]').first();
}

test.describe.serial("SOM PRO student management flow", () => {
  test("creates, validates, edits, transfers, and deletes student files", async ({ page }) => {
    const directorAuth = await apiLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const headers = { Authorization: `Bearer ${directorAuth.token}` };
    const classes = await ensureStudentClasses(page, headers);
    const primaryClass = classes[0];
    const secondaryClass = classes[1];
    const suffix = Date.now().toString(36);

    await setBrowserAuth(page, directorAuth);
    await openStudentsPage(page);

    await page.locator('[data-e2e="students-class-filter"]').selectOption(primaryClass.id);
    await expect(page.locator('[data-e2e="students-table"]')).toBeVisible();

    const fullName = `طالب تجريبي ${suffix}`;
    const fullNationalId = `31${String(Date.now()).slice(-7)}`;
    const fullStudent = {
      name: fullName,
      nationalId: fullNationalId,
      classId: primaryClass.id,
      fatherName: "\u0628\u0627\u0633\u0644",
      motherName: "\u0633\u0648\u0633\u0648",
      residence: "\u062d\u064a \u0627\u0644\u0645\u062f\u064a\u0646\u0629",
      fatherPhone: "0500000001",
      motherPhone: "0500000002",
      guardianPhone: "0500000003",
      healthFund: "\u0643\u0644\u0627\u0644\u064a\u062a",
      studentPhone: "0500000004"
    };

    await fillStudentForm(page, fullStudent);
    await page.locator('[data-e2e="student-form-save"]').click();
    await expect(getStatusMessage(page)).toContainText(/saved|\u062d\u0641\u0638/i);
    await expect(page.locator('[data-e2e^="student-row-"]').filter({ hasText: fullName })).toBeVisible();
    await expect(page.locator('[data-e2e^="student-row-"]').filter({ hasText: fullNationalId })).toBeVisible();

    const xssName = `<img src=x onerror="window.__somStudentXssProbe='executed'"> ${suffix}`;
    const xssNationalId = `34${String(Date.now()).slice(-7)}`;
    await page.evaluate(() => {
      window.__somStudentXssProbe = undefined;
    });
    await fillStudentForm(page, {
      name: xssName,
      nationalId: xssNationalId,
      classId: primaryClass.id
    });
    await page.locator('[data-e2e="student-form-save"]').click();
    await expect(getStatusMessage(page)).toContainText(/saved|\u062d\u0641\u0638/i);
    const xssRow = page.locator('[data-e2e^="student-row-"]').filter({ hasText: xssNationalId }).first();
    await expect(xssRow).toBeVisible();
    await expect(xssRow).toContainText(xssName);
    const xssProbe = await page.evaluate(() => window.__somStudentXssProbe);
    expect(xssProbe).toBeUndefined();

    await page.locator('[data-e2e="student-form-reset"]').click();
    await page.locator('[data-e2e="student-form-name"]').fill("");
    await page.locator('[data-e2e="student-form-save"]').click();
    await expect(getStatusMessage(page)).toContainText(
      /name|class|required|\u0627\u0644\u0627\u0633\u0645|\u0627\u0644\u0635\u0641/i
    );

    const minimalName = `\u0637\u0627\u0644\u0628 \u0628\u062f\u0648\u0646 \u062a\u0641\u0627\u0635\u064a\u0644 ${suffix}`;
    const minimalNationalId = `32${String(Date.now()).slice(-7)}`;
    await fillStudentForm(page, {
      name: minimalName,
      nationalId: minimalNationalId,
      classId: primaryClass.id
    });
    await page.locator('[data-e2e="student-form-save"]').click();
    await expect(getStatusMessage(page)).toContainText(/saved|\u062d\u0641\u0638/i);
    await expect(page.locator('[data-e2e^="student-row-"]').filter({ hasText: minimalName })).toBeVisible();
    await expect(page.locator('[data-e2e^="student-row-"]').filter({ hasText: minimalNationalId })).toBeVisible();

    await page.locator('[data-e2e="student-form-reset"]').click();
    await fillStudentForm(page, {
      name: `\u062a\u0643\u0631\u0627\u0631 \u0647\u0648\u064a\u0629 ${suffix}`,
      nationalId: fullNationalId,
      classId: primaryClass.id
    });
    await page.locator('[data-e2e="student-form-save"]').click();
    await expect(getStatusMessage(page)).toContainText(/save|حفظ|could not/i);

    await page.locator('[data-e2e="student-form-reset"]').click();
    await fillStudentForm(page, {
      name: fullName,
      nationalId: `33${String(Date.now()).slice(-7)}`,
      classId: primaryClass.id
    });
    await page.locator('[data-e2e="student-form-save"]').click();
    await expect(getStatusMessage(page)).toContainText(/save|حفظ|could not/i);

    const minimalRow = page.locator('[data-e2e^="student-row-"]').filter({ hasText: minimalName }).first();
    await expect(minimalRow).toBeVisible();
    await minimalRow.locator(`[data-e2e^="student-edit-"]`).click();
    await expect(page.locator('[data-e2e="student-form-name"]')).toHaveValue(minimalName);
    await expect(page.locator('[data-e2e="student-form-national-id"]')).toHaveValue(minimalNationalId);
    await page.locator('[data-e2e="student-form-residence"]').fill("\u0627\u0644\u0642\u062f\u0633");
    const editStudentResponse = page.waitForResponse(
      (response) => response.url().includes("/api/students/") && response.request().method() === "PATCH"
    );
    await page.locator('[data-e2e="student-form-save"]').click();
    const editStudentResult = await editStudentResponse;
    if (!editStudentResult.ok()) {
      throw new Error(
        `Student edit failed with status ${editStudentResult.status()}: ${await editStudentResult.text()}`
      );
    }
    await expect(getStatusMessage(page)).toContainText(/saved|\u062d\u0641\u0638/i);
    await expect(page.locator('[data-e2e^="student-row-"]').filter({ hasText: minimalName })).toContainText(
      "\u0627\u0644\u0642\u062f\u0633"
    );

    await minimalRow.locator(`[data-e2e^="student-move-"]`).click();
    await expect(page.locator('[data-e2e="student-move-class"]')).toBeVisible();
    await page.locator('[data-e2e="student-move-class"]').selectOption(secondaryClass.id);
    await page.locator('[data-e2e="student-move-confirm"]').click();
    await expect(getStatusMessage(page)).toContainText(/moved|\u0646\u0642\u0644/i);
    await page.locator('[data-e2e="students-class-filter"]').selectOption(secondaryClass.id);
    await expect(page.locator('[data-e2e^="student-row-"]').filter({ hasText: minimalName })).toBeVisible();

    await page.once("dialog", (dialog) => dialog.accept());
    await page
      .locator('[data-e2e^="student-row-"]')
      .filter({ hasText: minimalName })
      .locator(`[data-e2e^="student-delete-"]`)
      .click();
    await expect(page.locator('[data-e2e^="student-row-"]').filter({ hasText: minimalName })).toHaveCount(0);

    await page.locator('[data-e2e="students-class-filter"]').selectOption(primaryClass.id);
    await page.once("dialog", (dialog) => dialog.accept());
    await page
      .locator('[data-e2e^="student-row-"]')
      .filter({ hasText: fullName })
      .locator(`[data-e2e^="student-delete-"]`)
      .click();
    await expect(page.locator('[data-e2e^="student-row-"]').filter({ hasText: fullName })).toHaveCount(0);
  });
});
