const crypto = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { expect, test } = require("@playwright/test");
const { generateE2ELicenseCode } = require("../../../scripts/e2e-license");

const prisma = new PrismaClient();

const SCHOOL_ID = process.env.SOM_E2E_SCHOOL_ID || "default-school";
const SCHOOL_NAME = process.env.SOM_E2E_SCHOOL_NAME || "مدرسة صلاحيات تجريبية";
const INSTITUTION_CODE = process.env.SOM_E2E_INSTITUTION_CODE || "TRIAL-4100";
const ADMIN_EMAIL = process.env.SOM_E2E_ADMIN_EMAIL || "admin662452";
const ADMIN_PASSWORD = process.env.SOM_E2E_ADMIN_PASSWORD || "E2E-Playwright-123!";
const ADMIN_NAME = process.env.SOM_E2E_ADMIN_NAME || "مدير النظام";
const MANAGER_EMAIL = process.env.SOM_E2E_MANAGER_EMAIL || "manager662452";
const MANAGER_PASSWORD = process.env.SOM_E2E_MANAGER_PASSWORD || "ManagerE2E-123!";
const MANAGER_NAME = process.env.SOM_E2E_MANAGER_NAME || "مدير المدرسة";
const SCHEDULER_EMAIL = process.env.SOM_E2E_SCHEDULER_EMAIL || "scheduler662452";
const SCHEDULER_PASSWORD = process.env.SOM_E2E_SCHEDULER_PASSWORD || "SchedulerE2E-123!";
const SCHEDULER_NAME = process.env.SOM_E2E_SCHEDULER_NAME || "المنسق";
const TEACHER_A_EMAIL = process.env.SOM_E2E_PERMISSIONS_TEACHER_A_EMAIL || "teacher-a662452";
const TEACHER_A_PASSWORD = process.env.SOM_E2E_PERMISSIONS_TEACHER_A_PASSWORD || "TeacherA-E2E-123!";
const TEACHER_A_NAME = process.env.SOM_E2E_PERMISSIONS_TEACHER_A_NAME || "المعلم الأول";
const TEACHER_B_EMAIL = process.env.SOM_E2E_OTHER_TEACHER_EMAIL || "teacher-b662452";
const TEACHER_B_PASSWORD = process.env.SOM_E2E_OTHER_TEACHER_PASSWORD || "TeacherB-E2E-123!";
const TEACHER_B_NAME = process.env.SOM_E2E_OTHER_TEACHER_NAME || "المعلم الثاني";
const CLASS_A_NAME = process.env.SOM_E2E_CLASS_NAME || "التاسع أ / عبادة";
const CLASS_B_NAME = process.env.SOM_E2E_OTHER_CLASS_NAME || "التاسع ب / عنان";
const SUBJECT_A_NAME = process.env.SOM_E2E_SUBJECT_NAME || "رياضيات";
const SUBJECT_B_NAME = process.env.SOM_E2E_OTHER_SUBJECT_NAME || "علوم";
const LICENSE_CODE =
  process.env.SOM_E2E_LICENSE_CODE ||
  generateE2ELicenseCode({
    days: 365,
    schoolName: SCHOOL_NAME,
    institutionCode: INSTITUTION_CODE,
    secret: process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling"
  });
const E2E_API_BASE_URL = process.env.SOM_E2E_API_BASE_URL || "http://127.0.0.1:4000";
const TEST_RUN_ID = process.env.SOM_E2E_TEST_RUN_ID || Date.now().toString(36);

const fixtureState = {
  admin: null,
  manager: null,
  scheduler: null,
  teacherA: null,
  teacherB: null,
  classA: null,
  classB: null,
  subjectA: null,
  subjectB: null,
  crudStudent: null,
  trackedStudent: null,
  teacherARecord: null,
  teacherBRecord: null
};

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:v1:${salt}:${hash}`;
}

async function bootstrapLicense(request) {
  const url = `${E2E_API_BASE_URL}/api/auth/bootstrap-license`;
  try {
    const response = await request.post(url, {
      data: { licenseCode: LICENSE_CODE, licenseKey: LICENSE_CODE }
    });

    const bodyText = await response.text().catch(() => "");
    const safeBody = bodyText ? bodyText.slice(0, 400) : "<empty>";

    if (!response.ok() && response.status() !== 429) {
      throw new Error(`Bootstrap failed: url=${url} status=${response.status()} body=${safeBody}`);
    }
  } catch (failure) {
    throw new Error(`Bootstrap failed: url=${url}`, { cause: failure });
  }
}

async function apiLogin(request, email, password) {
  await bootstrapLicense(request);
  const response = await request.post(`${E2E_API_BASE_URL}/api/auth/login`, {
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

function headersFor(auth) {
  return { Authorization: `Bearer ${auth.token}` };
}

async function expectForbidden(response, context = "request") {
  const status = response.status();
  const bodyText = await response.text().catch(() => "");

  let payload = {};
  try {
    payload = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    payload = {};
  }

  expect(status, `${context} expected 403 but received ${status}; body=${bodyText.slice(0, 300)}`).toBe(403);

  const code =
    payload?.code ||
    payload?.errorCode ||
    payload?.error?.code ||
    (typeof payload?.error === "string" ? payload.error : "") ||
    "";

  const message =
    payload?.message ||
    payload?.error?.message ||
    (typeof payload?.error === "string" ? payload.error : "") ||
    bodyText;

  const hasForbiddenContract =
    code === "FORBIDDEN" ||
    code === "PERMISSION_DENIED" ||
    /لا تملك صلاحية|غير مصرح|ممنوع|forbidden|permission denied|not authorized/i.test(message);

  expect(
    hasForbiddenContract,
    `${context} returned 403 without a recognizable forbidden payload; body=${bodyText.slice(0, 300)}`
  ).toBeTruthy();

  return payload;
}

async function ensureCoreFixtures() {
  await prisma.school.upsert({
    where: { id: SCHOOL_ID },
    update: {
      name: SCHOOL_NAME,
      institutionCode: INSTITUTION_CODE,
      managerName: ADMIN_NAME,
      isActive: true
    },
    create: {
      id: SCHOOL_ID,
      name: SCHOOL_NAME,
      address: "",
      managerName: ADMIN_NAME,
      institutionCode: INSTITUTION_CODE,
      isActive: true
    }
  });

  await prisma.schoolSettings.upsert({
    where: { schoolId: SCHOOL_ID },
    update: {
      workingDays: ["Saturday", "Monday", "Tuesday", "Wednesday", "Thursday"],
      offDays: ["Sunday", "Friday"],
      periodsPerDay: 7,
      maxTeachers: 100
    },
    create: {
      schoolId: SCHOOL_ID,
      workingDays: ["Saturday", "Monday", "Tuesday", "Wednesday", "Thursday"],
      offDays: ["Sunday", "Friday"],
      periodsPerDay: 7,
      maxTeachers: 100
    }
  });

  await prisma.periodDefinition.upsert({
    where: { schoolId_period: { schoolId: SCHOOL_ID, period: 1 } },
    update: { label: "Period 1", startTime: "08:10", endTime: "09:00", isActive: true },
    create: { schoolId: SCHOOL_ID, period: 1, label: "Period 1", startTime: "08:10", endTime: "09:00", isActive: true }
  });

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL.trim().toLowerCase() },
    update: {
      schoolId: SCHOOL_ID,
      name: ADMIN_NAME,
      password: hashPassword(ADMIN_PASSWORD),
      role: "ADMIN"
    },
    create: {
      schoolId: SCHOOL_ID,
      name: ADMIN_NAME,
      email: ADMIN_EMAIL.trim().toLowerCase(),
      password: hashPassword(ADMIN_PASSWORD),
      role: "ADMIN"
    }
  });

  fixtureState.manager = await prisma.user.upsert({
    where: { email: MANAGER_EMAIL.trim().toLowerCase() },
    update: {
      schoolId: SCHOOL_ID,
      name: MANAGER_NAME,
      password: hashPassword(MANAGER_PASSWORD),
      role: "MANAGER"
    },
    create: {
      schoolId: SCHOOL_ID,
      name: MANAGER_NAME,
      email: MANAGER_EMAIL.trim().toLowerCase(),
      password: hashPassword(MANAGER_PASSWORD),
      role: "MANAGER"
    }
  });

  fixtureState.scheduler = await prisma.user.upsert({
    where: { email: SCHEDULER_EMAIL.trim().toLowerCase() },
    update: {
      schoolId: SCHOOL_ID,
      name: SCHEDULER_NAME,
      password: hashPassword(SCHEDULER_PASSWORD),
      role: "SCHEDULER"
    },
    create: {
      schoolId: SCHOOL_ID,
      name: SCHEDULER_NAME,
      email: SCHEDULER_EMAIL.trim().toLowerCase(),
      password: hashPassword(SCHEDULER_PASSWORD),
      role: "SCHEDULER"
    }
  });

  fixtureState.teacherA = await prisma.user.upsert({
    where: { email: TEACHER_A_EMAIL.trim().toLowerCase() },
    update: {
      schoolId: SCHOOL_ID,
      name: TEACHER_A_NAME,
      password: hashPassword(TEACHER_A_PASSWORD),
      role: "TEACHER"
    },
    create: {
      schoolId: SCHOOL_ID,
      name: TEACHER_A_NAME,
      email: TEACHER_A_EMAIL.trim().toLowerCase(),
      password: hashPassword(TEACHER_A_PASSWORD),
      role: "TEACHER"
    }
  });

  fixtureState.teacherB = await prisma.user.upsert({
    where: { email: TEACHER_B_EMAIL.trim().toLowerCase() },
    update: {
      schoolId: SCHOOL_ID,
      name: TEACHER_B_NAME,
      password: hashPassword(TEACHER_B_PASSWORD),
      role: "TEACHER"
    },
    create: {
      schoolId: SCHOOL_ID,
      name: TEACHER_B_NAME,
      email: TEACHER_B_EMAIL.trim().toLowerCase(),
      password: hashPassword(TEACHER_B_PASSWORD),
      role: "TEACHER"
    }
  });

  fixtureState.classA = await prisma.schoolClass.upsert({
    where: { schoolId_name: { schoolId: SCHOOL_ID, name: CLASS_A_NAME } },
    update: { grade: "10", section: "A", status: "ACTIVE" },
    create: { schoolId: SCHOOL_ID, name: CLASS_A_NAME, grade: "10", section: "A", status: "ACTIVE" }
  });

  fixtureState.classB = await prisma.schoolClass.upsert({
    where: { schoolId_name: { schoolId: SCHOOL_ID, name: CLASS_B_NAME } },
    update: { grade: "11", section: "B", status: "ACTIVE" },
    create: { schoolId: SCHOOL_ID, name: CLASS_B_NAME, grade: "11", section: "B", status: "ACTIVE" }
  });

  fixtureState.subjectA = await prisma.subject.upsert({
    where: { schoolId_name: { schoolId: SCHOOL_ID, name: SUBJECT_A_NAME } },
    update: { isHomeroom: false, status: "ACTIVE" },
    create: { schoolId: SCHOOL_ID, name: SUBJECT_A_NAME, isHomeroom: false, status: "ACTIVE" }
  });

  fixtureState.subjectB = await prisma.subject.upsert({
    where: { schoolId_name: { schoolId: SCHOOL_ID, name: SUBJECT_B_NAME } },
    update: { isHomeroom: false, status: "ACTIVE" },
    create: { schoolId: SCHOOL_ID, name: SUBJECT_B_NAME, isHomeroom: false, status: "ACTIVE" }
  });

  await prisma.teacher.updateMany({
    where: {
      userId: { in: [fixtureState.teacherA.id, fixtureState.teacherB.id] }
    },
    data: { userId: null }
  });

  fixtureState.teacherARecord = await prisma.teacher.upsert({
    where: { schoolId_name: { schoolId: SCHOOL_ID, name: TEACHER_A_NAME } },
    update: {
      userId: fixtureState.teacherA.id,
      specialty: SUBJECT_A_NAME,
      employmentRatio: 100,
      releaseHours: 0,
      targetLoad: 25,
      workDays: ["Saturday", "Monday", "Tuesday", "Wednesday", "Thursday"]
    },
    create: {
      schoolId: SCHOOL_ID,
      name: TEACHER_A_NAME,
      userId: fixtureState.teacherA.id,
      specialty: SUBJECT_A_NAME,
      employmentRatio: 100,
      releaseHours: 0,
      targetLoad: 25,
      workDays: ["Saturday", "Monday", "Tuesday", "Wednesday", "Thursday"]
    }
  });

  fixtureState.teacherBRecord = await prisma.teacher.upsert({
    where: { schoolId_name: { schoolId: SCHOOL_ID, name: TEACHER_B_NAME } },
    update: {
      userId: fixtureState.teacherB.id,
      specialty: SUBJECT_B_NAME,
      employmentRatio: 100,
      releaseHours: 0,
      targetLoad: 25,
      workDays: ["Saturday", "Monday", "Tuesday", "Wednesday", "Thursday"]
    },
    create: {
      schoolId: SCHOOL_ID,
      name: TEACHER_B_NAME,
      userId: fixtureState.teacherB.id,
      specialty: SUBJECT_B_NAME,
      employmentRatio: 100,
      releaseHours: 0,
      targetLoad: 25,
      workDays: ["Saturday", "Monday", "Tuesday", "Wednesday", "Thursday"]
    }
  });

  const assignmentPairs = [
    {
      teacherId: fixtureState.teacherARecord.id,
      classId: fixtureState.classA.id,
      subjectId: fixtureState.subjectA.id
    },
    {
      teacherId: fixtureState.teacherBRecord.id,
      classId: fixtureState.classB.id,
      subjectId: fixtureState.subjectB.id
    }
  ];

  for (const assignment of assignmentPairs) {
    const existingAssignment = await prisma.teacherAssignment.findFirst({
      where: {
        schoolId: SCHOOL_ID,
        teacherId: assignment.teacherId,
        classId: assignment.classId,
        subjectId: assignment.subjectId
      }
    });

    if (existingAssignment) {
      await prisma.teacherAssignment.update({
        where: { id: existingAssignment.id },
        data: { weeklyPeriods: 6 }
      });
      continue;
    }

    await prisma.teacherAssignment.create({
      data: {
        schoolId: SCHOOL_ID,
        teacherId: assignment.teacherId,
        classId: assignment.classId,
        subjectId: assignment.subjectId,
        weeklyPeriods: 6
      }
    });
  }
}

async function postStudent(request, headers, data) {
  const response = await request.post(`${E2E_API_BASE_URL}/api/students`, {
    headers,
    data
  });
  return response;
}

async function createStudent(request, headers, data) {
  const response = await postStudent(request, headers, data);
  const payload = await response.json();
  if (!response.ok()) {
    throw new Error(`${response.status()} ${payload?.message || payload?.error || "Student create failed"}`);
  }
  return payload.data;
}

async function saveAttendance(request, headers, data) {
  const response = await request.put(`${E2E_API_BASE_URL}/api/students/attendance`, {
    headers,
    data
  });
  const payload = await response.json();
  if (!response.ok()) {
    throw new Error(payload?.message || payload?.error || `Attendance save failed with status ${response.status()}`);
  }
  return payload.data;
}

async function postGradeEntry(request, headers, data) {
  const response = await request.post(`${E2E_API_BASE_URL}/api/students/grade-entries`, {
    headers,
    data
  });
  return response;
}

async function saveGradeEntry(request, headers, data) {
  const response = await postGradeEntry(request, headers, data);
  const payload = await response.json();
  if (!response.ok()) {
    throw new Error(`${response.status()} ${payload?.message || payload?.error || "Grade save failed"}`);
  }
  return payload.data;
}

async function postCertificate(request, headers, data) {
  const response = await request.post(`${E2E_API_BASE_URL}/api/students/certificates`, {
    headers,
    data
  });
  return response;
}

async function saveCertificate(request, headers, data) {
  const response = await postCertificate(request, headers, data);
  const payload = await response.json();
  if (!response.ok()) {
    throw new Error(payload?.message || payload?.error || `Certificate save failed with status ${response.status()}`);
  }
  return payload.data;
}

async function saveLessonToday(request, headers, data) {
  const response = await request.post(`${E2E_API_BASE_URL}/api/lessons`, {
    headers,
    data
  });
  const payload = await response.json();
  if (!response.ok()) {
    throw new Error(payload?.message || payload?.error || `Lesson today save failed with status ${response.status()}`);
  }
  return payload.data;
}

async function saveHomework(request, headers, data) {
  const response = await request.post(`${E2E_API_BASE_URL}/api/lessons/homework`, {
    headers,
    data
  });
  const payload = await response.json();
  if (!response.ok()) {
    throw new Error(payload?.message || payload?.error || `Homework save failed with status ${response.status()}`);
  }
  return payload.data;
}

async function saveExam(request, headers, data) {
  const response = await request.post(`${E2E_API_BASE_URL}/api/lessons/exams`, {
    headers,
    data
  });
  const payload = await response.json();
  if (!response.ok()) {
    throw new Error(payload?.message || payload?.error || `Exam save failed with status ${response.status()}`);
  }
  return payload.data;
}

test.describe.serial("SOM PRO permissions and access control", () => {
  test.beforeAll(async ({ request }) => {
    await ensureCoreFixtures();
    fixtureState.admin = await apiLogin(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    fixtureState.manager = await apiLogin(request, MANAGER_EMAIL, MANAGER_PASSWORD);
    fixtureState.scheduler = await apiLogin(request, SCHEDULER_EMAIL, SCHEDULER_PASSWORD);
    fixtureState.teacherA = await apiLogin(request, TEACHER_A_EMAIL, TEACHER_A_PASSWORD);
    fixtureState.teacherB = await apiLogin(request, TEACHER_B_EMAIL, TEACHER_B_PASSWORD);
  });

  test("server-side permissions separate student CRUD, grades, and result approval", async ({ request }) => {
    const managerHeaders = headersFor(fixtureState.manager);
    const schedulerHeaders = headersFor(fixtureState.scheduler);
    const teacherAHeaders = headersFor(fixtureState.teacherA);
    const teacherBHeaders = headersFor(fixtureState.teacherB);
    const adminHeaders = headersFor(fixtureState.admin);

    const crudStudent = await createStudent(request, managerHeaders, {
      name: `Permissions CRUD Student ${TEST_RUN_ID}`,
      nationalId: `991${TEST_RUN_ID}`,
      classId: fixtureState.classA.id,
      fatherName: "Father",
      motherName: "Mother",
      fatherPhone: "0500000001",
      motherPhone: "0500000002",
      guardianPhone: "0500000003",
      healthFund: "Fund",
      studentPhone: "0500000004"
    });
    fixtureState.crudStudent = crudStudent;

    await expectForbidden(
      await postStudent(request, schedulerHeaders, {
        name: `Scheduler Student ${TEST_RUN_ID}`,
        nationalId: `992${TEST_RUN_ID}`,
        classId: fixtureState.classA.id
      }),
      "scheduler cannot create student"
    );

    await expectForbidden(
      await postStudent(request, teacherAHeaders, {
        name: `Teacher Student ${TEST_RUN_ID}`,
        nationalId: `993${TEST_RUN_ID}`,
        classId: fixtureState.classA.id
      }),
      "teacher cannot create student"
    );

    const deleteResponse = await request.delete(`${E2E_API_BASE_URL}/api/students/${crudStudent.id}`, {
      headers: managerHeaders
    });
    expect(deleteResponse.ok()).toBeTruthy();

    await createStudent(request, adminHeaders, {
      name: `Admin Student ${TEST_RUN_ID}`,
      nationalId: `994${TEST_RUN_ID}`,
      classId: fixtureState.classA.id
    });

    const trackedStudent = await createStudent(request, managerHeaders, {
      name: `Tracked Permissions Student ${TEST_RUN_ID}`,
      nationalId: `995${TEST_RUN_ID}`,
      classId: fixtureState.classA.id,
      fatherName: "Guardian Father",
      motherName: "Guardian Mother",
      fatherPhone: "0500000101",
      motherPhone: "0500000102",
      guardianPhone: "0500000103",
      healthFund: "Fund",
      studentPhone: "0500000104"
    });
    fixtureState.trackedStudent = trackedStudent;

    const gradePayload = {
      classId: fixtureState.classA.id,
      subjectId: fixtureState.subjectA.id,
      certificateType: "TERM1_BIMONTHLY",
      rows: {
        [trackedStudent.id]: { section1: "8" }
      }
    };

    await saveGradeEntry(request, managerHeaders, gradePayload);
    await saveGradeEntry(request, teacherAHeaders, {
      ...gradePayload,
      rows: {
        [trackedStudent.id]: { section1: "9" }
      }
    });

    await expectForbidden(
      await postGradeEntry(request, schedulerHeaders, gradePayload),
      "scheduler cannot save grade entry"
    );

    await expectForbidden(
      await postGradeEntry(request, teacherBHeaders, gradePayload),
      "teacher B cannot save grade entry"
    );

    const certificatePayload = {
      studentId: trackedStudent.id,
      certificateType: "TERM1_BIMONTHLY",
      academicYear: "2026",
      issueDate: "2026-07-22",
      presentDays: 10,
      absentDays: 1,
      lateDays: 2,
      earlyExitDays: 0,
      behaviorLevel: "GOOD",
      behaviorNote: "Good",
      teacherNotes: "Teacher note",
      adminNotes: "Manager approval",
      teacherSignature: "Teacher",
      principalSignature: "Principal",
      average: 91,
      grade: "A",
      result: "PASS",
      approved: true,
      published: false,
      subjectRows: []
    };

    await saveCertificate(request, managerHeaders, certificatePayload);
    await saveCertificate(request, adminHeaders, {
      ...certificatePayload,
      grade: "A+",
      average: 95,
      approved: true
    });

    const teacherCertificateResponse = await postCertificate(request, teacherAHeaders, certificatePayload);
    await expectForbidden(teacherCertificateResponse, "teacher cannot create certificate outside assigned class");

    await expectForbidden(
      await postCertificate(request, schedulerHeaders, certificatePayload),
      "scheduler cannot create certificate"
    );
  });

  test("teachers only see their assigned classes and cannot see another teacher's classes", async ({ request }) => {
    const managerHeaders = headersFor(fixtureState.manager);
    const teacherAHeaders = headersFor(fixtureState.teacherA);
    const teacherBHeaders = headersFor(fixtureState.teacherB);
    const schedulerHeaders = headersFor(fixtureState.scheduler);
    const adminHeaders = headersFor(fixtureState.admin);

    const adminClasses = await request.get(`${E2E_API_BASE_URL}/api/classes`, { headers: adminHeaders });
    const adminClassesPayload = await adminClasses.json();
    expect(adminClasses.ok()).toBeTruthy();
    expect(adminClassesPayload.data.map((item) => item.id)).toEqual(
      expect.arrayContaining([fixtureState.classA.id, fixtureState.classB.id])
    );

    const managerClasses = await request.get(`${E2E_API_BASE_URL}/api/classes`, { headers: managerHeaders });
    const managerClassesPayload = await managerClasses.json();
    expect(managerClasses.ok()).toBeTruthy();
    expect(managerClassesPayload.data.map((item) => item.id)).toEqual(
      expect.arrayContaining([fixtureState.classA.id, fixtureState.classB.id])
    );

    const teacherAClasses = await request.get(`${E2E_API_BASE_URL}/api/classes`, { headers: teacherAHeaders });
    const teacherAClassesPayload = await teacherAClasses.json();
    expect(teacherAClasses.ok()).toBeTruthy();
    expect(teacherAClassesPayload.data.map((item) => item.id)).toEqual([fixtureState.classA.id]);

    const teacherBClasses = await request.get(`${E2E_API_BASE_URL}/api/classes`, { headers: teacherBHeaders });
    const teacherBClassesPayload = await teacherBClasses.json();
    expect(teacherBClasses.ok()).toBeTruthy();
    expect(teacherBClassesPayload.data.map((item) => item.id)).toEqual([fixtureState.classB.id]);

    const schedulerClasses = await request.get(`${E2E_API_BASE_URL}/api/classes`, { headers: schedulerHeaders });
    const schedulerClassesPayload = await schedulerClasses.json();
    expect(schedulerClasses.ok()).toBeTruthy();
    expect(schedulerClassesPayload.data.map((item) => item.id)).toEqual(
      expect.arrayContaining([fixtureState.classA.id, fixtureState.classB.id])
    );

    const schedulerTeachers = await request.get(`${E2E_API_BASE_URL}/api/teachers`, { headers: schedulerHeaders });
    expect(schedulerTeachers.status()).toBe(403);
  });

  test("front-end direct navigation does not reveal forbidden pages", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-e2e="login-screen"]')).toBeVisible();

    await page.evaluate(
      ({ token, user }) => {
        window.__somSetAuthToken?.(token);
        window.__somSetCurrentUser?.(user);
      },
      { token: fixtureState.scheduler.token, user: fixtureState.scheduler.user }
    );

    await expect(page.locator('[data-e2e="app-shell"]')).toBeVisible();

    await page.evaluate(() => history.pushState({}, "", "/teachers"));
    await expect(page.locator('[data-e2e="teachers-page"]')).toHaveCount(0);
    await expect(page.locator('[data-e2e="nav-teachers"]')).toHaveCount(0);
    await expect(page.evaluate(() => window.location.pathname)).resolves.toBe("/teachers");
  });

  test("attendance creates parent-facing notification records", async ({ request }) => {
    const teacherHeaders = headersFor(fixtureState.teacherA);
    const managerHeaders = headersFor(fixtureState.manager);

    const attendanceStudent =
      fixtureState.trackedStudent ||
      (await createStudent(request, managerHeaders, {
        name: `Attendance Notification Student ${TEST_RUN_ID}`,
        nationalId: `996${TEST_RUN_ID}`,
        classId: fixtureState.classA.id,
        fatherName: "Father",
        motherName: "Mother",
        fatherPhone: "0500000111",
        motherPhone: "0500000112",
        guardianPhone: "0500000113",
        healthFund: "Fund",
        studentPhone: "0500000114"
      }));

    const attendance = await saveAttendance(request, teacherHeaders, {
      studentId: attendanceStudent.id,
      date: "2026-07-22",
      day: "Tuesday",
      status: "LATE",
      lateAt: "08:15",
      leftAt: null,
      note: "Late arrival"
    });
    expect(attendance.id).toBeTruthy();

    const notification = await prisma.studentNotification.findFirst({
      where: {
        schoolId: SCHOOL_ID,
        studentId: attendanceStudent.id,
        eventType: "ATTENDANCE"
      },
      orderBy: { createdAt: "desc" }
    });

    expect(notification).toBeTruthy();
    expect(notification?.status).toMatch(/QUEUED|SENT/);

    const recipientPhones = Array.isArray(notification?.recipientPhones) ? notification.recipientPhones : [];
    expect(recipientPhones.map((item) => item.label)).toEqual(expect.arrayContaining(["father", "mother", "guardian"]));
  });

  test("teacher A can save assigned lessons, homework, and exams while teacher B cannot see them", async ({
    request
  }) => {
    const teacherAHeaders = headersFor(fixtureState.teacherA);
    const teacherBHeaders = headersFor(fixtureState.teacherB);

    const lesson = await saveLessonToday(request, teacherAHeaders, {
      teacherId: fixtureState.teacherARecord.id,
      classId: fixtureState.classA.id,
      subjectId: fixtureState.subjectA.id,
      date: "2026-07-22",
      day: "Tuesday",
      period: 1,
      title: "Lesson Today Permission Test",
      summary: "Lesson summary",
      status: "IN_PROGRESS",
      note: "Keep it scoped",
      attachments: ""
    });
    expect(lesson.id).toBeTruthy();

    const homework = await saveHomework(request, teacherAHeaders, {
      teacherId: fixtureState.teacherARecord.id,
      classId: fixtureState.classA.id,
      subjectId: fixtureState.subjectA.id,
      date: "2026-07-22",
      day: "Tuesday",
      kind: "HOMEWORK",
      title: "Homework Permission Test",
      description: "Describe task",
      dueDate: "2026-07-23",
      attachment: "",
      notes: "Teacher A only"
    });
    expect(homework.id).toBeTruthy();

    const exam = await saveExam(request, teacherAHeaders, {
      teacherId: fixtureState.teacherARecord.id,
      classId: fixtureState.classA.id,
      subjectId: fixtureState.subjectA.id,
      date: "2026-07-22",
      day: "Tuesday",
      title: "Exam Permission Test",
      startTime: "08:00",
      endTime: "09:00",
      room: "A1",
      notes: "Teacher A only",
      instructions: "Follow rules"
    });
    expect(exam.exam?.id || exam.id).toBeTruthy();

    const lessonListForTeacherB = await request.get(
      `${E2E_API_BASE_URL}/api/lessons?date=2026-07-22&teacherId=${encodeURIComponent(fixtureState.teacherARecord.id)}`,
      {
        headers: teacherBHeaders
      }
    );
    const lessonListPayload = await lessonListForTeacherB.json();
    expect(lessonListForTeacherB.ok()).toBeTruthy();
    expect(JSON.stringify(lessonListPayload)).not.toContain("Lesson Today Permission Test");

    const homeworkListForTeacherB = await request.get(
      `${E2E_API_BASE_URL}/api/lessons/homework?date=2026-07-22&teacherId=${encodeURIComponent(fixtureState.teacherARecord.id)}`,
      {
        headers: teacherBHeaders
      }
    );
    const homeworkListPayload = await homeworkListForTeacherB.json();
    expect(homeworkListForTeacherB.ok()).toBeTruthy();
    expect(JSON.stringify(homeworkListPayload)).not.toContain("Homework Permission Test");

    const examListForTeacherB = await request.get(
      `${E2E_API_BASE_URL}/api/lessons/exams?date=2026-07-22&teacherId=${encodeURIComponent(fixtureState.teacherARecord.id)}`,
      {
        headers: teacherBHeaders
      }
    );
    const examListPayload = await examListForTeacherB.json();
    expect(examListForTeacherB.ok()).toBeTruthy();
    expect(JSON.stringify(examListPayload)).not.toContain("Exam Permission Test");
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
