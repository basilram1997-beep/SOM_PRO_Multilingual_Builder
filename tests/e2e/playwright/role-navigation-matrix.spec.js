const crypto = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { expect, test } = require("@playwright/test");
const { getE2ELicenseCode, clickStable } = require("./e2e-helpers");

const prisma = new PrismaClient();

const SCHOOL_ID = process.env.SOM_E2E_ROLE_MATRIX_SCHOOL_ID || "role-matrix-school";
const SCHOOL_NAME = process.env.SOM_E2E_ROLE_MATRIX_SCHOOL_NAME || "Role Matrix School";
const INSTITUTION_CODE = process.env.SOM_E2E_INSTITUTION_CODE || "TRIAL-4100";
const LICENSE_CODE = getE2ELicenseCode();
const E2E_API_BASE_URL = process.env.SOM_E2E_API_BASE_URL || "http://127.0.0.1:4000";
const TEST_RUN_ID = process.env.SOM_E2E_TEST_RUN_ID || "role-matrix";

const accounts = {
  admin: {
    role: "ADMIN",
    name: "Role Matrix Admin",
    email: "role-matrix-admin@som-e2e.local",
    password: "Role-Matrix-123!"
  },
  manager: {
    role: "MANAGER",
    name: "Role Matrix Manager",
    email: "role-matrix-manager@som-e2e.local",
    password: "Role-Matrix-123!"
  },
  scheduler: {
    role: "SCHEDULER",
    name: "Role Matrix Scheduler",
    email: "role-matrix-scheduler@som-e2e.local",
    password: "Role-Matrix-123!"
  },
  teacher: {
    role: "TEACHER",
    name: "Role Matrix Teacher",
    email: "role-matrix-teacher@som-e2e.local",
    password: "Role-Matrix-123!"
  },
  student: {
    role: "STUDENT",
    name: "Role Matrix Student Account",
    email: "role-matrix-student@som-e2e.local",
    password: "Role-Matrix-123!"
  },
  parent: {
    role: "PARENT",
    name: "Role Matrix Parent",
    email: "role-matrix-parent@som-e2e.local",
    password: "Role-Matrix-123!"
  }
};

const authState = {};

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:v1:${salt}:${hash}`;
}

async function bootstrapLicense(request) {
  const response = await request.post(`${E2E_API_BASE_URL}/api/auth/bootstrap-license`, {
    data: { licenseCode: LICENSE_CODE, licenseKey: LICENSE_CODE }
  });
  if (!response.ok() && response.status() !== 429) {
    throw new Error(`Bootstrap failed with status ${response.status()}: ${await response.text()}`);
  }
}

async function apiLogin(request, account) {
  await bootstrapLicense(request);
  const response = await request.post(`${E2E_API_BASE_URL}/api/auth/login`, {
    data: { email: account.email, password: account.password, licenseCode: LICENSE_CODE, licenseKey: LICENSE_CODE }
  });
  const payload = await response.json();
  if (!response.ok() || !payload?.data?.token || !payload?.data?.user) {
    throw new Error(payload?.message || payload?.error || `Login failed with status ${response.status()}`);
  }
  return payload.data;
}

async function ensureRoleMatrixFixtures() {
  await prisma.school.upsert({
    where: { id: SCHOOL_ID },
    update: { name: SCHOOL_NAME, institutionCode: INSTITUTION_CODE, isActive: true },
    create: {
      id: SCHOOL_ID,
      name: SCHOOL_NAME,
      address: "",
      managerName: accounts.admin.name,
      institutionCode: INSTITUTION_CODE,
      isActive: true
    }
  });

  await prisma.schoolSettings.upsert({
    where: { schoolId: SCHOOL_ID },
    update: { workingDays: ["Saturday", "Monday", "Tuesday", "Wednesday", "Thursday"], offDays: ["Sunday", "Friday"] },
    create: {
      schoolId: SCHOOL_ID,
      workingDays: ["Saturday", "Monday", "Tuesday", "Wednesday", "Thursday"],
      offDays: ["Sunday", "Friday"],
      periodsPerDay: 7,
      maxTeachers: 100
    }
  });

  const classItem = await prisma.schoolClass.upsert({
    where: { schoolId_name: { schoolId: SCHOOL_ID, name: `Role Matrix Class ${TEST_RUN_ID}` } },
    update: { grade: "10", section: "A", status: "ACTIVE" },
    create: {
      schoolId: SCHOOL_ID,
      name: `Role Matrix Class ${TEST_RUN_ID}`,
      grade: "10",
      section: "A",
      status: "ACTIVE"
    }
  });

  const subject = await prisma.subject.upsert({
    where: { schoolId_name: { schoolId: SCHOOL_ID, name: `Role Matrix Subject ${TEST_RUN_ID}` } },
    update: { status: "ACTIVE", isHomeroom: false },
    create: { schoolId: SCHOOL_ID, name: `Role Matrix Subject ${TEST_RUN_ID}`, status: "ACTIVE", isHomeroom: false }
  });

  const users = {};
  for (const [key, account] of Object.entries(accounts)) {
    users[key] = await prisma.user.upsert({
      where: { email: account.email },
      update: {
        schoolId: SCHOOL_ID,
        name: account.name,
        password: hashPassword(account.password),
        role: account.role,
        status: "ACTIVE"
      },
      create: {
        schoolId: SCHOOL_ID,
        name: account.name,
        email: account.email,
        password: hashPassword(account.password),
        role: account.role,
        status: "ACTIVE"
      }
    });
  }

  await prisma.teacher.updateMany({ where: { userId: users.teacher.id }, data: { userId: null } });
  const teacher = await prisma.teacher.upsert({
    where: { schoolId_name: { schoolId: SCHOOL_ID, name: accounts.teacher.name } },
    update: {
      userId: users.teacher.id,
      specialty: subject.name,
      employmentRatio: 100,
      releaseHours: 0,
      targetLoad: 25,
      workDays: ["Saturday", "Monday", "Tuesday", "Wednesday", "Thursday"]
    },
    create: {
      schoolId: SCHOOL_ID,
      name: accounts.teacher.name,
      userId: users.teacher.id,
      specialty: subject.name,
      employmentRatio: 100,
      releaseHours: 0,
      targetLoad: 25,
      workDays: ["Saturday", "Monday", "Tuesday", "Wednesday", "Thursday"]
    }
  });

  const existingAssignment = await prisma.teacherAssignment.findFirst({
    where: {
      schoolId: SCHOOL_ID,
      teacherId: teacher.id,
      classId: classItem.id,
      subjectId: subject.id
    }
  });
  if (existingAssignment) {
    await prisma.teacherAssignment.update({
      where: { id: existingAssignment.id },
      data: { weeklyPeriods: 6 }
    });
  } else {
    await prisma.teacherAssignment.create({
      data: {
        schoolId: SCHOOL_ID,
        teacherId: teacher.id,
        classId: classItem.id,
        subjectId: subject.id,
        weeklyPeriods: 6
      }
    });
  }

  const existingStudent = await prisma.student.findFirst({
    where: { schoolId: SCHOOL_ID, nationalId: `RM-${TEST_RUN_ID}` }
  });
  const student = existingStudent
    ? await prisma.student.update({
        where: { id: existingStudent.id },
        data: { classId: classItem.id, name: `Role Matrix Student ${TEST_RUN_ID}`, status: "ACTIVE" }
      })
    : await prisma.student.create({
        data: {
          schoolId: SCHOOL_ID,
          classId: classItem.id,
          name: `Role Matrix Student ${TEST_RUN_ID}`,
          nationalId: `RM-${TEST_RUN_ID}`,
          fatherName: accounts.parent.name,
          guardianPhone: "0500000200",
          status: "ACTIVE"
        }
      });

  await prisma.user.update({ where: { id: users.student.id }, data: { studentId: student.id } });
  await prisma.user.update({ where: { id: users.parent.id }, data: { studentId: student.id } });
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

async function expandAvailableGroups(page) {
  for (const selector of [
    '[data-e2e="nav-group-toggle-programs"]',
    '[data-e2e="nav-group-toggle-students-management"]',
    '[data-e2e="nav-group-toggle-permissions"]',
    '[data-e2e="nav-group-toggle-school-settings"]'
  ]) {
    const group = page.locator(selector);
    if ((await group.count()) > 0 && (await group.isVisible())) {
      const expanded = await group.getAttribute("aria-expanded");
      if (expanded !== "true") {
        await clickStable(group);
      }
    }
  }
}

async function expectNavigation(page, visible, hidden) {
  await expandAvailableGroups(page);
  for (const selector of visible) {
    await expect(page.locator(selector), `${selector} should be visible`).toBeVisible();
  }
  for (const selector of hidden) {
    await expect(page.locator(selector), `${selector} should be hidden`).toHaveCount(0);
  }
}

async function openAndExpect(page, navSelector, pageSelector) {
  await expandAvailableGroups(page);
  await clickStable(page.locator(navSelector));
  await expect(page.locator(pageSelector)).toBeVisible({ timeout: 20_000 });
}

test.describe.serial("SOM PRO browser role navigation matrix", () => {
  test.beforeAll(async ({ request }) => {
    await ensureRoleMatrixFixtures();
    for (const [key, account] of Object.entries(accounts)) {
      authState[key] = await apiLogin(request, account);
    }
  });

  test("admin and manager see broad school workflows while internal tools remain developer/admin scoped", async ({
    page
  }) => {
    await setBrowserAuth(page, authState.admin);
    await expectNavigation(
      page,
      [
        '[data-e2e="nav-dashboard"]',
        '[data-e2e="nav-student-files"]',
        '[data-e2e="nav-student-certificates"]',
        '[data-e2e="nav-reports"]',
        '[data-e2e="nav-users"]',
        '[data-e2e="nav-license"]'
      ],
      []
    );
    await openAndExpect(page, '[data-e2e="nav-student-files"]', '[data-e2e="students-page"]');
    await openAndExpect(page, '[data-e2e="nav-student-certificates"]', '[data-e2e="student-certificates-page"]');
    await openAndExpect(page, '[data-e2e="nav-reports"]', '[data-e2e="reports-page"]');

    await setBrowserAuth(page, authState.manager);
    await expectNavigation(
      page,
      [
        '[data-e2e="nav-dashboard"]',
        '[data-e2e="nav-student-files"]',
        '[data-e2e="nav-student-certificates"]',
        '[data-e2e="nav-reports"]',
        '[data-e2e="nav-school-notifications"]'
      ],
      [
        '[data-e2e="nav-users"]',
        '[data-e2e="nav-license"]',
        '[data-e2e="nav-operations"]',
        '[data-e2e="nav-security-monitoring"]'
      ]
    );
    await openAndExpect(page, '[data-e2e="nav-student-files"]', '[data-e2e="students-page"]');
    await openAndExpect(page, '[data-e2e="nav-student-certificates"]', '[data-e2e="student-certificates-page"]');
    await openAndExpect(page, '[data-e2e="nav-reports"]', '[data-e2e="reports-page"]');
  });

  test("scheduler is limited to scheduling surfaces", async ({ page }) => {
    await setBrowserAuth(page, authState.scheduler);
    await expectNavigation(
      page,
      ['[data-e2e="nav-program-daily"]', '[data-e2e="nav-program-duties"]', '[data-e2e="nav-program-homeroom"]'],
      [
        '[data-e2e="nav-dashboard"]',
        '[data-e2e="nav-student-files"]',
        '[data-e2e="nav-student-certificates"]',
        '[data-e2e="nav-reports"]',
        '[data-e2e="nav-users"]',
        '[data-e2e="nav-teacher-permissions"]'
      ]
    );
    await openAndExpect(page, '[data-e2e="nav-program-daily"]', '[data-e2e="daily-page"]');
  });

  test("teacher, student, and parent roles stay inside their own portal workflows", async ({ page }) => {
    await setBrowserAuth(page, authState.teacher);
    await expectNavigation(
      page,
      [
        '[data-e2e="nav-teacher-marks"]',
        '[data-e2e="nav-teacher-attendance"]',
        '[data-e2e="nav-teacher-lesson-today"]',
        '[data-e2e="nav-teacher-permissions"]'
      ],
      [
        '[data-e2e="nav-reports"]',
        '[data-e2e="nav-users"]',
        '[data-e2e="nav-student-files"]',
        '[data-e2e="nav-student-certificates"]'
      ]
    );
    await openAndExpect(page, '[data-e2e="nav-teacher-marks"]', '[data-e2e="student-marks-page"]');

    await setBrowserAuth(page, authState.student);
    await expectNavigation(
      page,
      ['[data-e2e="nav-student-marks"]', '[data-e2e="nav-student-homework"]', '[data-e2e="nav-student-timetable"]'],
      [
        '[data-e2e="nav-reports"]',
        '[data-e2e="nav-users"]',
        '[data-e2e="nav-student-files"]',
        '[data-e2e="nav-student-certificates"]'
      ]
    );
    await openAndExpect(page, '[data-e2e="nav-student-marks"]', '[data-e2e="student-marks-page"]');

    await setBrowserAuth(page, authState.parent);
    await expectNavigation(
      page,
      ['[data-e2e="nav-student-marks"]', '[data-e2e="nav-student-homework"]', '[data-e2e="nav-student-timetable"]'],
      [
        '[data-e2e="nav-reports"]',
        '[data-e2e="nav-users"]',
        '[data-e2e="nav-student-files"]',
        '[data-e2e="nav-student-certificates"]'
      ]
    );
    await openAndExpect(page, '[data-e2e="nav-student-marks"]', '[data-e2e="student-marks-page"]');
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
