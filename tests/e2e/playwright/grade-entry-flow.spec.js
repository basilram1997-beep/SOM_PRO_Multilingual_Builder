const { expect, test } = require("@playwright/test");
const { getE2ELicenseCode, openSidebarSection } = require("./e2e-helpers");

const ADMIN_EMAIL = process.env.SOM_E2E_ADMIN_EMAIL || "admin662452";
const ADMIN_PASSWORD = process.env.SOM_E2E_ADMIN_PASSWORD || "E2E-Playwright-123!";
const LICENSE_CODE = getE2ELicenseCode();
const PRIMARY_TEACHER_NAME = process.env.SOM_E2E_TEACHER_NAME || "المعلم الأول";
const PRIMARY_TEACHER_EMAIL = process.env.SOM_E2E_TEACHER_EMAIL || "teacher-e2e-primary";
const PRIMARY_TEACHER_PASSWORD = process.env.SOM_E2E_TEACHER_PASSWORD || "TeacherE2E-123!";
const BACKUP_TEACHER_NAME = process.env.SOM_E2E_OTHER_TEACHER_NAME || "المعلم البديل";
const BACKUP_TEACHER_EMAIL = process.env.SOM_E2E_OTHER_TEACHER_EMAIL || "teacher-e2e-backup";
const BACKUP_TEACHER_PASSWORD = process.env.SOM_E2E_OTHER_TEACHER_PASSWORD || "TeacherBackupE2E-123!";
const SUBJECT_NAME = process.env.SOM_E2E_SUBJECT_NAME || "رياضيات";
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

async function ensureTeacherFixtures(page) {
  const admin = await apiLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  const headers = { Authorization: `Bearer ${admin.token}` };

  const usersResponse = await page.request.get(`${E2E_API_BASE_URL}/api/settings/users`, { headers });
  const usersPayload = await usersResponse.json();
  const users = usersPayload.data || [];

  if (!users.some((user) => String(user.email || "").toLowerCase() === PRIMARY_TEACHER_EMAIL.toLowerCase())) {
    const createTeacherResponse = await page.request.post(`${E2E_API_BASE_URL}/api/settings/users`, {
      headers,
      data: {
        name: PRIMARY_TEACHER_NAME,
        email: PRIMARY_TEACHER_EMAIL,
        password: PRIMARY_TEACHER_PASSWORD,
        role: "TEACHER"
      }
    });
    if (!createTeacherResponse.ok()) {
      const payload = await createTeacherResponse.json().catch(() => ({}));
      throw new Error(payload?.message || `Could not create primary teacher user (${createTeacherResponse.status()})`);
    }
  }

  if (!users.some((user) => String(user.email || "").toLowerCase() === BACKUP_TEACHER_EMAIL.toLowerCase())) {
    const createBackupUserResponse = await page.request.post(`${E2E_API_BASE_URL}/api/settings/users`, {
      headers,
      data: {
        name: BACKUP_TEACHER_NAME,
        email: BACKUP_TEACHER_EMAIL,
        password: BACKUP_TEACHER_PASSWORD,
        role: "TEACHER"
      }
    });
    if (!createBackupUserResponse.ok()) {
      const payload = await createBackupUserResponse.json().catch(() => ({}));
      throw new Error(
        payload?.message || `Could not create backup teacher user (${createBackupUserResponse.status()})`
      );
    }
  }

  const teachersResponse = await page.request.get(`${E2E_API_BASE_URL}/api/teachers`, { headers });
  const teachersPayload = await teachersResponse.json();
  const teachers = teachersPayload.data || [];

  if (!teachers.some((teacher) => teacher.name === BACKUP_TEACHER_NAME)) {
    const createBackupTeacherResponse = await page.request.post(`${E2E_API_BASE_URL}/api/teachers`, {
      headers,
      data: {
        name: BACKUP_TEACHER_NAME,
        specialty: SUBJECT_NAME,
        adminRole: "",
        employmentRatio: 100,
        workDays: ["السبت", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"],
        preferredDays: [],
        preferredClasses: [],
        preferredPeriods: [],
        releaseHours: 0,
        targetLoad: 20,
        notes: "المعلم البديل"
      }
    });
    if (!createBackupTeacherResponse.ok()) {
      const payload = await createBackupTeacherResponse.json().catch(() => ({}));
      throw new Error(
        payload?.message || `Could not create backup teacher record (${createBackupTeacherResponse.status()})`
      );
    }
  }
}

test.describe.serial("SOM PRO end-to-end grade flow", () => {
  test("director saves marks, the director sees them, and another teacher is blocked", async ({ page }) => {
    await ensureTeacherFixtures(page);

    const directorAuth = await apiLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await setBrowserAuth(page, directorAuth);

    await openSidebarSection(
      page,
      '[data-e2e="nav-group-toggle-students-management"]',
      '[data-e2e="nav-student-marks"]'
    );
    await expect(page.locator('[data-e2e="student-marks-page"]')).toBeVisible();

    const classSelect = page.locator('[data-e2e="grade-entry-class-select"]');
    await expect(classSelect).toBeVisible();
    const classValue = await classSelect.locator("option").nth(1).getAttribute("value");
    if (classValue) {
      await classSelect.selectOption(classValue);
    }

    const subjectButtons = page.locator('[data-e2e^="grade-entry-subject-"]');
    await expect(subjectButtons.first()).toBeVisible();
    await subjectButtons.first().click();
    await expect(page.locator('[data-e2e="grade-entry-term-term1"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-e2e="grade-entry-marks-table"]')).toBeVisible();

    const markInputs = page.locator('[data-e2e^="grade-entry-mark-"]');
    await expect(markInputs.first()).toBeVisible();
    const firstThreeValues = ["9", "8", "7"];
    for (let index = 0; index < Math.min(3, await markInputs.count()); index += 1) {
      await markInputs.nth(index).fill(firstThreeValues[index]);
    }

    await page.locator('[data-e2e="grade-entry-save"]').click({ force: true });
    await expect(page.locator('.form-message[role="status"]').first()).toContainText(/حفظ|saved/i);

    await page.reload();
    await setBrowserAuth(page, directorAuth);
    await expect(page.locator('[data-e2e="app-shell"]')).toBeVisible();
    await openSidebarSection(
      page,
      '[data-e2e="nav-group-toggle-students-management"]',
      '[data-e2e="nav-student-marks"]'
    );
    await expect(classSelect).toBeVisible();
    if (classValue) {
      await classSelect.selectOption(classValue);
    }
    await expect(subjectButtons.first()).toBeVisible();
    await subjectButtons.first().click();
    await expect(page.locator('[data-e2e="grade-entry-marks-table"]')).toBeVisible();
    await expect(page.locator('[data-e2e^="grade-entry-mark-"]').first()).toHaveValue("9");

    const adminAuth = await apiLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await setBrowserAuth(page, adminAuth);

    await openSidebarSection(page, '[data-e2e="nav-group-toggle-school-settings"]', '[data-e2e="nav-reports"]');
    await expect(page.locator('[data-e2e="reports-page"]')).toBeVisible();
    await page.locator('[data-e2e="report-tab-grades"]').click();
    await page.locator('[data-e2e="grades-show"]').click();
    await expect(page.locator("#grades-report-print")).toContainText("رياضيات");

    const backupAuth = await apiLogin(page, BACKUP_TEACHER_EMAIL, BACKUP_TEACHER_PASSWORD);
    await setBrowserAuth(page, backupAuth);

    await openSidebarSection(
      page,
      '[data-e2e="nav-group-toggle-students-management"]',
      '[data-e2e="nav-student-marks"]'
    );
    await expect(page.locator('[data-e2e="student-marks-page"]')).toBeVisible();
    await expect(page.locator(".grade-entry-warning")).toBeVisible();
  });
});
