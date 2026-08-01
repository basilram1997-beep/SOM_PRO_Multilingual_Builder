const { expect, test } = require("@playwright/test");
const { getE2ELicenseCode, openSidebarSection } = require("./e2e-helpers");

const ADMIN_EMAIL = process.env.SOM_E2E_ADMIN_EMAIL || "admin@som-e2e.local";
const ADMIN_PASSWORD = process.env.SOM_E2E_ADMIN_PASSWORD || "SOM-E2E-Admin-123!";
const TEACHER_NAME = process.env.SOM_E2E_TEACHER_NAME || "SOM E2E Teacher";
const TEACHER_EMAIL = process.env.SOM_E2E_TEACHER_EMAIL || "teacher@som-e2e.local";
const TEACHER_PASSWORD = process.env.SOM_E2E_TEACHER_PASSWORD || "SOM-E2E-Teacher-123!";
const STUDENT_EMAIL = process.env.SOM_E2E_STUDENT_EMAIL || "student@som-e2e.local";
const STUDENT_PASSWORD = process.env.SOM_E2E_STUDENT_PASSWORD || "SOM-E2E-Student-123!";
const PARENT_EMAIL = process.env.SOM_E2E_PARENT_EMAIL || "parent@som-e2e.local";
const PARENT_PASSWORD = process.env.SOM_E2E_PARENT_PASSWORD || "SOM-E2E-Parent-123!";
const LICENSE_CODE = getE2ELicenseCode();
const E2E_API_BASE_URL = process.env.SOM_E2E_API_BASE_URL || "http://127.0.0.1:4000";

let bootstrapPromise;

async function bootstrapLicense(page) {
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

async function getFirstData(page, headers, path, label) {
  const response = await page.request.get(`${E2E_API_BASE_URL}${path}`, { headers });
  const payload = await response.json();
  if (!response.ok() || !Array.isArray(payload.data) || payload.data.length === 0) {
    throw new Error(`Expected seeded ${label}; status=${response.status()}`);
  }
  return payload.data[0];
}

async function getNamedData(page, headers, path, expectedName, label) {
  const response = await page.request.get(`${E2E_API_BASE_URL}${path}`, { headers });
  const payload = await response.json();
  const item = Array.isArray(payload.data) ? payload.data.find((entry) => entry.name === expectedName) : null;
  if (!response.ok() || !item) {
    throw new Error(`Expected seeded ${label} named ${expectedName}; status=${response.status()}`);
  }
  return item;
}

async function saveJson(page, headers, path, data, label, method = "post") {
  const response = await page.request[method](`${E2E_API_BASE_URL}${path}`, { headers, data });
  const payload = await response.json();
  if (!response.ok()) {
    throw new Error(`${label} failed with status ${response.status()}: ${payload?.message || payload?.error || ""}`);
  }
  return payload.data;
}

async function seedDeepReportData(page, auth) {
  const headers = { Authorization: `Bearer ${auth.token}` };
  const today = new Date().toISOString().slice(0, 10);
  const classItem = await getFirstData(page, headers, "/api/classes", "class");
  const subject = await getFirstData(page, headers, "/api/subjects", "subject");
  const teacher = await getNamedData(page, headers, "/api/teachers", TEACHER_NAME, "teacher");

  const studentsResponse = await page.request.get(
    `${E2E_API_BASE_URL}/api/students?classId=${encodeURIComponent(classItem.id)}`,
    { headers }
  );
  const studentsPayload = await studentsResponse.json();
  const student = studentsPayload.data?.[0];
  if (!studentsResponse.ok() || !student) {
    throw new Error(`Expected seeded student; status=${studentsResponse.status()}`);
  }

  await saveJson(
    page,
    headers,
    "/api/students/attendance",
    {
      studentId: student.id,
      date: today,
      day: "E2E",
      status: "LATE",
      lateAt: "08:15",
      leftAt: null,
      note: "Deep E2E attendance"
    },
    "attendance save",
    "put"
  );

  await saveJson(
    page,
    headers,
    "/api/students/grade-entries",
    {
      classId: classItem.id,
      subjectId: subject.id,
      certificateType: "TERM1_BIMONTHLY",
      rows: {
        [student.id]: {
          "daily-exam": "9",
          "attendance-participation": "8",
          "bimonthly-exam": "18"
        }
      }
    },
    "grade entry save"
  );

  await saveJson(
    page,
    headers,
    "/api/lessons",
    {
      teacherId: teacher.id,
      classId: classItem.id,
      subjectId: subject.id,
      date: today,
      day: "E2E",
      period: 1,
      title: "Deep E2E lesson today",
      summary: "Deep report coverage lesson",
      status: "COMPLETED",
      note: "Deep E2E",
      attachments: ""
    },
    "lesson save"
  );

  await saveJson(
    page,
    headers,
    "/api/lessons/homework",
    {
      teacherId: teacher.id,
      classId: classItem.id,
      subjectId: subject.id,
      date: today,
      day: "E2E",
      kind: "HOMEWORK",
      title: "Deep E2E homework",
      description: "Deep report coverage homework",
      dueDate: today,
      attachment: "",
      notes: "Deep E2E"
    },
    "homework save"
  );

  await saveJson(
    page,
    headers,
    "/api/lessons/exams",
    {
      teacherId: teacher.id,
      classId: classItem.id,
      subjectId: subject.id,
      date: today,
      day: "E2E",
      title: "Deep E2E exam",
      startTime: "09:00",
      endTime: "10:00",
      room: "E2E",
      notes: "Deep E2E",
      instructions: "Deep report coverage exam"
    },
    "exam save"
  );

  return { today, classItem, subject, student };
}

async function openReports(page) {
  await openSidebarSection(page, '[data-e2e="nav-group-toggle-school-settings"]', '[data-e2e="nav-reports"]');
  await expect(page.locator('[data-e2e="reports-page"]')).toBeVisible();
}

test.describe.serial("SOM PRO deep browser E2E coverage", () => {
  test("admin reviews detailed attendance, grade, classroom, summary, and security reports", async ({ page }) => {
    const adminAuth = await apiLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const seeded = await seedDeepReportData(page, adminAuth);

    await setBrowserAuth(page, adminAuth);
    await openReports(page);

    await page.locator('[data-e2e="report-tab-attendance"]').click();
    await page.locator('[data-e2e="attendance-from-filter"]').fill(seeded.today);
    await page.locator('[data-e2e="attendance-to-filter"]').fill(seeded.today);
    await page.locator('[data-e2e="attendance-class-filter"]').selectOption(seeded.classItem.id);
    await page.locator('[data-e2e="attendance-show"]').click();
    await expect(page.locator("#attendance-report-print")).toContainText(seeded.student.name);
    await expect(page.locator("#attendance-report-print")).toContainText(seeded.classItem.name);

    await page.locator('[data-e2e="report-tab-grades"]').click();
    await page.locator('[data-e2e="grades-class-filter"]').selectOption(seeded.classItem.id);
    await page.locator('[data-e2e="grades-subject-filter"]').selectOption(seeded.subject.id);
    await page.locator('[data-e2e="grades-certificate-filter"]').selectOption("TERM1_BIMONTHLY");
    await page.locator('[data-e2e="grades-show"]').click();
    await expect(page.locator("#grades-report-print")).toContainText(seeded.subject.name);
    await expect(page.locator("#grades-report-print")).toContainText(seeded.student.name);

    await page.locator('[data-e2e="report-tab-classroomLogs"]').click();
    await page.locator('[data-e2e="classroom-logs-class-filter"]').selectOption(seeded.classItem.id);
    await page.locator('[data-e2e="classroom-logs-show"]').click();
    await expect(page.locator("#classroom-logs-report-print")).toContainText("Deep E2E lesson today");
    await expect(page.locator("#classroom-logs-report-print")).toContainText("Deep E2E homework");
    await expect(page.locator("#classroom-logs-report-print")).toContainText("Deep E2E exam");

    await page.locator('[data-e2e="report-tab-summary"]').click();
    await page.locator('[data-e2e="summary-dimension-filter"]').selectOption("class");
    await page.locator('[data-e2e="summary-class-filter"]').selectOption(seeded.classItem.id);
    await page.locator('[data-e2e="summary-show"]').click();
    await expect(page.locator('[data-e2e="summary-report-print"]')).toContainText(seeded.classItem.name);

    await page.locator('[data-e2e="report-tab-security"]').click();
    await page.locator('[data-e2e="security-days-filter"]').fill("7");
    await page.locator('[data-e2e="security-show"]').click();
    await expect(page.locator("#security-report-print")).toBeVisible();
  });

  test("teacher, student, and parent roles see their own surfaces without admin reports", async ({ page }) => {
    const teacherAuth = await apiLogin(page, TEACHER_EMAIL, TEACHER_PASSWORD);
    await setBrowserAuth(page, teacherAuth);
    await expect(page.locator('[data-e2e="nav-teacher-marks"]')).toBeVisible();
    await expect(page.locator('[data-e2e="nav-reports"]')).toHaveCount(0);
    await page.locator('[data-e2e="nav-teacher-marks"]').click();
    await expect(page.locator('[data-e2e="student-marks-page"]')).toBeVisible();

    const studentAuth = await apiLogin(page, STUDENT_EMAIL, STUDENT_PASSWORD);
    await setBrowserAuth(page, studentAuth);
    await expect(page.locator('[data-e2e="nav-student-marks"]')).toBeVisible();
    await expect(page.locator('[data-e2e="nav-reports"]')).toHaveCount(0);
    await page.locator('[data-e2e="nav-student-marks"]').click();
    await expect(page.locator('[data-e2e="student-marks-page"]')).toBeVisible();

    const parentAuth = await apiLogin(page, PARENT_EMAIL, PARENT_PASSWORD);
    await setBrowserAuth(page, parentAuth);
    await expect(page.locator('[data-e2e="nav-student-marks"]')).toBeVisible();
    await expect(page.locator('[data-e2e="nav-reports"]')).toHaveCount(0);
    await page.locator('[data-e2e="nav-student-marks"]').click();
    await expect(page.locator('[data-e2e="student-marks-page"]')).toBeVisible();
  });
});
