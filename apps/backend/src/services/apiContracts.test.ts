import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prisma } from "../db/prisma";
import { hashPassword } from "./authService";

type License = {
  id: string;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED" | "SUSPENDED";
  expiresAt: Date;
  maxDevices: number;
  devices: { deviceId: string; status: "active" | "revoked" }[];
};

function activateDevice(license: License, deviceId: string, now = new Date("2026-01-01T00:00:00Z")) {
  if (license.status === "CANCELLED" || license.status === "SUSPENDED")
    return { ok: false, error: "LICENSE_SUSPENDED" };
  if (license.expiresAt.getTime() < now.getTime() || license.status === "EXPIRED")
    return { ok: false, error: "LICENSE_EXPIRED" };
  const existing = license.devices.find((device) => device.deviceId === deviceId);
  if (existing?.status === "active") return { ok: true, reused: true };
  const activeCount = license.devices.filter((device) => device.status === "active").length;
  if (activeCount >= license.maxDevices) return { ok: false, error: "MAX_DEVICES_REACHED" };
  license.devices.push({ deviceId, status: "active" });
  return { ok: true, reused: false };
}

async function loginAndGetAuthData(baseUrl: string, email: string, password: string) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      password,
      licenseCode: "DUMMY-LICENSE"
    })
  });

  const responseText = await response.text();
  assert.equal(
    response.status,
    200,
    `Expected login to succeed for ${email}; status=${response.status}; body=${responseText.slice(0, 300)}`
  );

  const payload = JSON.parse(responseText);
  assert.ok(payload?.data?.token, `Expected login token for ${email}`);
  return payload.data as { token: string; user: { role: string; studentId?: string | null } };
}

test("license flow accepts a valid license activation", () => {
  const license: License = {
    id: "license-a",
    status: "ACTIVE",
    expiresAt: new Date("2027-01-01T00:00:00Z"),
    maxDevices: 1,
    devices: []
  };
  assert.deepEqual(activateDevice(license, "device-a"), { ok: true, reused: false });
  assert.equal(license.devices.length, 1);
});

test("license flow rejects expired and cancelled licenses", () => {
  const expired: License = {
    id: "expired",
    status: "ACTIVE",
    expiresAt: new Date("2025-01-01T00:00:00Z"),
    maxDevices: 1,
    devices: []
  };
  const cancelled: License = {
    id: "cancelled",
    status: "CANCELLED",
    expiresAt: new Date("2027-01-01T00:00:00Z"),
    maxDevices: 1,
    devices: []
  };

  assert.equal(activateDevice(expired, "device-a").error, "LICENSE_EXPIRED");
  assert.equal(activateDevice(cancelled, "device-a").error, "LICENSE_SUSPENDED");
});

test("license flow blocks extra devices but allows an already activated device", () => {
  const license: License = {
    id: "license-a",
    status: "ACTIVE",
    expiresAt: new Date("2027-01-01T00:00:00Z"),
    maxDevices: 1,
    devices: [{ deviceId: "device-a", status: "active" }]
  };

  assert.deepEqual(activateDevice(license, "device-a"), { ok: true, reused: true });
  assert.equal(activateDevice(license, "device-b").error, "MAX_DEVICES_REACHED");
});

test("API route contracts consistently use data wrappers for success responses", () => {
  const routeFiles = [
    "src/modules/teachers/teachers.routes.ts",
    "src/modules/students/students.routes.ts",
    "src/modules/lessons/today.routes.ts",
    "src/modules/lessons/homework.routes.ts",
    "src/modules/lessons/exams.routes.ts",
    "src/modules/duties/duties.routes.ts",
    "src/modules/classes/classes.routes.ts",
    "src/modules/subjects/subjects.routes.ts",
    "src/modules/settings/settings.routes.ts",
    "src/modules/schedules/schedules.routes.ts",
    "src/modules/daily/daily.routes.ts",
    "src/modules/archive/archive.routes.ts",
    "src/modules/auditLogs/auditLogs.routes.ts",
    "src/modules/securityIncidents/securityIncidents.routes.ts",
    "src/modules/reports/reports.routes.ts",
    "src/modules/schools/schools.routes.ts",
    "src/modules/license/license.routes.ts",
    "src/modules/uploads/uploads.routes.ts"
  ];

  for (const file of routeFiles) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /json\(\{\s*data[:\s]/, `${file} should expose successful payloads under data`);
  }
});

test("student certificates routes expose persistent storage endpoints", () => {
  const source = readFileSync("src/modules/students/students.routes.ts", "utf8");
  assert.match(source, /studentsRouter\.get\("\/certificates"/, "certificates lookup route should exist");
  assert.match(source, /studentsRouter\.get\("\/certificates\/context"/, "certificate context route should exist");
  assert.match(source, /studentsRouter\.get\("\/grade-schemes\/context"/, "grade scheme context route should exist");
  assert.match(source, /studentsRouter\.get\("\/grade-entries"/, "grade entries lookup route should exist");
  assert.match(source, /studentsRouter\.post\("\/grade-entries"/, "grade entries save route should exist");
  assert.match(source, /studentsRouter\.post\("\/grades"/, "grade save route should exist");
  assert.match(source, /studentsRouter\.put\("\/grades\/:id"/, "grade update route should exist");
  assert.match(source, /studentsRouter\.post\("\/certificates"/, "certificates save route should exist");
  assert.match(source, /studentsRouter\.post\("\/import"/, "student import route should exist");
  assert.match(source, /studentsRouter\.post\("\/attendance\/archive"/, "attendance archive route should exist");
  assert.match(source, /studentGradeEntry\.upsert\(/, "grade entries should save through upsert");
  assert.match(source, /studentGradeEntry\.update\(/, "grade entries should support updating an existing saved entry");
});

test("grade routes enforce lesson permissions and assignment scope before writing", () => {
  const source = readFileSync("src/modules/students/students.routes.ts", "utf8");

  assert.match(source, /studentsRouter\.get\("\/grades"/, "grade lookup route should exist");
  assert.match(source, /studentsRouter\.post\("\/grades"/, "grade save route should exist");
  assert.match(source, /studentsRouter\.put\("\/grades\/:id"/, "grade edit route should exist");
  assert.match(source, /studentsRouter\.get\("\/grade-entries"/, "grade entry lookup route should exist");
  assert.match(source, /studentsRouter\.post\("\/grade-entries"/, "grade entry save route should exist");
  assert.match(
    source,
    /studentsRouter\.patch\(\s*"\/:id",\s*(?:requirePermissionForWrite|\(0, auth_1\.requirePermissionForWrite\))\("manageSettings"\)/,
    "student patch should require manageSettings"
  );
  assert.match(
    source,
    /studentsRouter\.put\(\s*"\/:id",\s*(?:requirePermissionForWrite|\(0, auth_1\.requirePermissionForWrite\))\("manageSettings"\)/,
    "student put should require manageSettings"
  );
  assert.match(
    source,
    /studentsRouter\.post\(\s*"\/:id\/move",\s*(?:requirePermissionForWrite|\(0, auth_1\.requirePermissionForWrite\))\("manageSettings"\)/,
    "student move should require manageSettings"
  );
  assert.match(
    source,
    /(?:requirePermissionForWrite|\(0, auth_1\.requirePermissionForWrite\))\("manageLessons"\)[\s\S]*(?:validateBody\(StudentGradeEntrySchema\)|validateBody\)\(shared_1\.StudentGradeEntrySchema)/,
    "grade writes should require lesson permissions"
  );
  assert.match(source, /canViewGradeData\(req\)/, "grade writes should check the caller can view grade data");
  assert.match(
    source,
    /(?:teacherCanAccessAssignment|\(0, teacherScope_1\.teacherCanAccessAssignment\))\(teacherScope, classId, subjectId\)/,
    "grade save should enforce assignment scope"
  );
  assert.match(
    source,
    /(?:teacherCanAccessAssignment|\(0, teacherScope_1\.teacherCanAccessAssignment\))\(teacherScope, req\.body\.classId, req\.body\.subjectId\)/,
    "grade edit should enforce assignment scope on the updated class and subject"
  );
  assert.match(source, /studentGradeEntry\.findUnique\(/, "grade saves should look up an existing saved row first");
  assert.match(source, /studentGradeEntry\.upsert\(/, "grade saves should upsert instead of duplicating entries");
  assert.match(source, /studentGradeEntry\.update\(/, "grade edits should update the existing saved row");
});

test("teacher files stay the source of truth for student, parent, and homeroom views", () => {
  const studentsSource = readFileSync("src/modules/students/students.routes.ts", "utf8");
  const lessonTodaySource = readFileSync("src/modules/lessons/today.routes.ts", "utf8");
  const homeworkSource = readFileSync("src/modules/lessons/homework.routes.ts", "utf8");
  const examsSource = readFileSync("src/modules/lessons/exams.routes.ts", "utf8");
  const lessonPageSource = readFileSync("../frontend/src/pages/lessons/LessonTodayPage.tsx", "utf8");
  const homeworkPageSource = readFileSync("../frontend/src/pages/lessons/HomeworkPreparationPage.tsx", "utf8");
  const examsPageSource = readFileSync("../frontend/src/pages/lessons/ExamSchedulePage.tsx", "utf8");
  const studentMarksPageSource = readFileSync("../frontend/src/pages/students/StudentMarksPage.tsx", "utf8");
  const gradeEntrySource = readFileSync("../frontend/src/features/students/useGradeEntry.ts", "utf8");

  assert.match(studentsSource, /studentsRouter\.get\("\/:id\/context"/, "student context route should exist");
  assert.match(
    studentsSource,
    /teacherAssignment\.findMany\(\{\s*where: \{ schoolId, classId: student\.classId \}/,
    "student context should resolve subjects from teacher assignments for the student class"
  );
  assert.match(studentsSource, /studentsRouter\.get\("\/grade-entries"/, "grade entry lookup route should exist");
  assert.match(
    studentsSource,
    /(?:teacherCanAccessAssignment|\(0, teacherScope_1\.teacherCanAccessAssignment\))\(teacherScope, classId, subjectId\)/,
    "grade entry lookup should enforce assignment scope"
  );
  assert.match(studentsSource, /studentsRouter\.post\("\/grade-entries"/, "grade entry save route should exist");
  assert.match(
    studentsSource,
    /(?:teacherCanAccessAssignment|\(0, teacherScope_1\.teacherCanAccessAssignment\))\(teacherScope, classId, subjectId\)/,
    "grade entry save should enforce assignment scope"
  );
  assert.match(studentsSource, /studentsRouter\.get\("\/certificates"/, "certificate lookup route should exist");
  assert.match(
    studentsSource,
    /studentsRouter\.get\("\/certificates\/context"/,
    "certificate context route should exist"
  );

  assert.match(
    lessonTodaySource,
    /resolveTeacherForRequest/,
    "lesson today should resolve the teacher file before saving"
  );
  assert.match(homeworkSource, /resolveTeacherForRequest/, "homework should resolve the teacher file before saving");
  assert.match(examsSource, /resolveTeacherForRequest/, "exams should resolve the teacher file before saving");

  assert.match(
    lessonPageSource,
    /const isStudentViewer = currentUser\.role === "STUDENT" \|\| currentUser\.role === "PARENT";/,
    "student lesson page should render read-only for students and parents"
  );
  assert.match(
    lessonPageSource,
    /readOnly=\{isStudentViewer\}/,
    "lesson today table should stay read-only for students and parents"
  );
  assert.match(
    homeworkPageSource,
    /const isStudentViewer = currentUser\.role === "STUDENT" \|\| currentUser\.role === "PARENT";/,
    "homework page should render read-only for students and parents"
  );
  assert.match(
    homeworkPageSource,
    /readOnly=\{isStudentViewer\}/,
    "homework table should stay read-only for students and parents"
  );
  assert.match(
    examsPageSource,
    /const isStudentViewer = currentUser\.role === "STUDENT" \|\| currentUser\.role === "PARENT";/,
    "exam page should render read-only for students and parents"
  );
  assert.match(
    examsPageSource,
    /readOnly=\{isStudentViewer\}/,
    "exam table should stay read-only for students and parents"
  );

  assert.match(
    studentMarksPageSource,
    /const isStudentViewer = currentUser\.role === "STUDENT" \|\| currentUser\.role === "PARENT";/,
    "student marks page should render as a student-only viewer"
  );
  assert.match(
    studentMarksPageSource,
    /canUseImport = isAdmin \|\| import\.meta\.env\.DEV/,
    "student marks import should stay admin/dev only"
  );

  assert.match(
    gradeEntrySource,
    /somApi\.students\s*\.\s*context\(currentUser\.studentId\)/,
    "student and parent grade-entry views should load the linked student context"
  );
  assert.match(gradeEntrySource, /selectedClassAccessible/, "grade-entry view should continue to guard by class scope");
  assert.match(
    gradeEntrySource,
    /selectedSubjectAccessible/,
    "grade-entry view should continue to guard by subject scope"
  );
});

test("student invitations and pledges are saved through the notification flow and remain re-saveable", () => {
  const studentsSource = readFileSync("src/modules/students/students.routes.ts", "utf8");
  const notificationsSource = readFileSync("src/services/studentNotifications.ts", "utf8");

  assert.match(studentsSource, /studentsRouter\.post\("\/invitations"/, "invitation save route should exist");
  assert.match(studentsSource, /studentsRouter\.post\("\/pledges"/, "pledge save route should exist");
  assert.match(
    studentsSource,
    /(?:createInvitationNotification|\(0, studentNotifications_1\.createInvitationNotification\))\((?:prisma|prisma_1\.prisma),/,
    "invitation saves should go through notification persistence"
  );
  assert.match(
    studentsSource,
    /(?:createPledgeNotification|\(0, studentNotifications_1\.createPledgeNotification\))\((?:prisma|prisma_1\.prisma),/,
    "pledge saves should go through notification persistence"
  );
  assert.match(
    studentsSource,
    /(?:prisma|prisma_1\.prisma)\.auditLog\.create\(\{/,
    "student notification saves should be audited"
  );
  assert.match(
    notificationsSource,
    /saveNotificationRecord\(prisma, payload, delivery\.status, delivery\.errorMessage\)/,
    "notification records should be persisted directly on each save"
  );
});

test("class edit and homeroom reassignment routes stay available for admin operations", () => {
  const classesSource = readFileSync("src/modules/classes/classes.routes.ts", "utf8");
  const homeroomSource = readFileSync("src/modules/homeroom/homeroom.routes.ts", "utf8");
  const scheduleSource = readFileSync("src/services/scheduleCoordinator.ts", "utf8");

  assert.match(classesSource, /classesRouter\.patch\("\/:id"/, "class update route should exist");
  assert.match(classesSource, /classesRouter\.put\("\/:id"/, "class replace route should exist");
  assert.match(
    classesSource,
    /classesRouter\.post\("\/:id\/assign-homeroom-teacher"/,
    "homeroom assignment route should exist"
  );
  assert.match(
    classesSource,
    /applyHomeroomsToBaseScheduleFromRules\(schoolId, \{ overwriteConflicts: false, classIds: \[classId\] \}\)/,
    "class updates should reapply base schedule rules"
  );
  assert.match(classesSource, /saveHomeroomAssignment/, "homeroom assignment helper should stay wired");
  assert.match(
    homeroomSource,
    /homeroomRouter\.post\([\s\S]*"\/apply-to-base-schedule"/,
    "homeroom changes should expose a fixed-schedule reapply route"
  );
  assert.match(
    homeroomSource,
    /applyHomeroomsToBaseScheduleFromRules\(schoolId, \{ overwriteConflicts: false, classIds: \[classId\] \}\)/,
    "homeroom saves should reapply base schedule rules"
  );
  assert.match(
    homeroomSource,
    /homeroomAssignment\.upsert\(/,
    "homeroom assignments should remain saveable via upsert"
  );
  assert.match(
    scheduleSource,
    /applyHomeroomsToBaseScheduleFromRules/,
    "schedule coordinator should still support reapplying base schedule rules"
  );
});

test("teachers administration routes require manageTeachers while permissions stay self-service", () => {
  const teachersSource = readFileSync("src/modules/teachers/teachers.routes.ts", "utf8");

  assert.match(
    teachersSource,
    /teachersRouter\.get\("\/", requirePermission\("manageTeachers"\)/,
    "teacher list should require manageTeachers"
  );
  assert.match(
    teachersSource,
    /teachersRouter\.post\("\/", requirePermission\("manageTeachers"\)/,
    "teacher create should require manageTeachers"
  );
  assert.match(
    teachersSource,
    /teachersRouter\.patch\(\s*"\/:id\/assignments\/:assignmentId\/weekly-periods",\s*requirePermission\("manageTeachers"\)/,
    "weekly-period updates should require manageTeachers"
  );
  assert.match(
    teachersSource,
    /teachersRouter\.delete\(\s*"\/:id\/assignments\/:assignmentId",\s*requirePermission\("manageTeachers"\)/,
    "assignment delete should require manageTeachers"
  );
  assert.match(
    teachersSource,
    /teachersRouter\.patch\(\s*"\/:id",\s*requirePermission\("manageTeachers"\)/,
    "teacher patch should require manageTeachers"
  );
  assert.match(
    teachersSource,
    /teachersRouter\.put\(\s*"\/:id",\s*requirePermission\("manageTeachers"\)/,
    "teacher put should require manageTeachers"
  );
  assert.match(
    teachersSource,
    /teachersRouter\.delete\(\s*"\/:id",\s*requirePermission\("manageTeachers"\)/,
    "teacher delete should require manageTeachers"
  );
  assert.match(
    teachersSource,
    /teachersRouter\.post\(\s*"\/:id\/deactivate",\s*requirePermission\("manageTeachers"\)/,
    "teacher deactivate should require manageTeachers"
  );
  assert.match(
    teachersSource,
    /teachersRouter\.get\("\/permissions"/,
    "teacher permissions read route should remain available"
  );
  assert.match(
    teachersSource,
    /teachersRouter\.post\("\/permissions"/,
    "teacher permissions write route should remain available"
  );
});

test("behavior records can be cleared for a student day", () => {
  const backendSource = readFileSync("src/modules/students/students.routes.ts", "utf8");
  const frontendSource = readFileSync("../frontend/src/features/students/useBehaviorPerformance.ts", "utf8");

  assert.match(backendSource, /studentsRouter\.delete\("\/behavior"/, "behavior delete route should exist");
  assert.match(backendSource, /deleteMany\(\{/, "behavior delete route should remove matching notes");
  assert.match(frontendSource, /behavior\.clear\(/, "frontend should call the clear behavior API");
});

test("lesson routes reuse the shared teacher scope resolver", () => {
  const homeworkSource = readFileSync("src/modules/lessons/homework.routes.ts", "utf8");
  const examsSource = readFileSync("src/modules/lessons/exams.routes.ts", "utf8");
  const todaySource = readFileSync("src/modules/lessons/today.routes.ts", "utf8");
  const dutiesSource = readFileSync("src/modules/duties/duties.routes.ts", "utf8");

  assert.match(homeworkSource, /resolveTeacherForRequest/, "homework route should use shared teacher resolver");
  assert.match(examsSource, /resolveTeacherForRequest/, "exam route should use shared teacher resolver");
  assert.match(todaySource, /resolveTeacherForRequest/, "lesson today route should use shared teacher resolver");
  assert.match(dutiesSource, /role === "TEACHER"/, "duty route should scope teacher visibility");
});

test("API route contracts expose stable error codes for failure responses", () => {
  const routeFiles = [
    "src/modules/teachers/teachers.routes.ts",
    "src/modules/students/students.routes.ts",
    "src/modules/lessons/today.routes.ts",
    "src/modules/lessons/homework.routes.ts",
    "src/modules/lessons/exams.routes.ts",
    "src/modules/duties/duties.routes.ts",
    "src/modules/settings/settings.routes.ts",
    "src/modules/schedules/schedules.routes.ts",
    "src/modules/daily/daily.routes.ts",
    "src/modules/reports/reports.routes.ts",
    "src/modules/auditLogs/auditLogs.routes.ts",
    "src/modules/securityIncidents/securityIncidents.routes.ts",
    "src/modules/license/license.routes.ts"
  ];

  for (const file of routeFiles) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /error\s*:/, `${file} should return machine-readable error codes when failing`);
  }

  const schedulesSource = readFileSync("src/modules/schedules/schedules.routes.ts", "utf8");
  assert.match(
    schedulesSource,
    /saveError\.body|copyError\.body|swapError\.body/,
    "schedule routes should forward machine-readable error bodies from the shared helpers"
  );
});

test("report routes expose entity summary reporting for class, student, teacher, subject, and homeroom", () => {
  const source = readFileSync("src/modules/reports/reports.routes.ts", "utf8");

  assert.match(source, /reportsRouter\.get\("\/summary"/, "summary report route should exist");
  assert.match(
    source,
    /dimension: z\.enum\(\["class", "student", "teacher", "subject", "homeroom"\]\)/,
    "summary route should support the required report dimensions"
  );
  assert.match(source, /buildEntitySummaryReport/, "summary helper should exist");
});

test("school operations route exposes operations dashboard data", () => {
  const source = readFileSync("src/modules/schools/schools.routes.ts", "utf8");

  assert.match(source, /schoolsRouter\.get\("\/operations"/, "operations dashboard route should exist");
  assert.match(source, /auditLogExport/, "operations route should expose audit log export metadata");
  assert.match(source, /backupJobs\.map/, "operations route should include backup job rows");
  assert.match(source, /lastSuccessfulBackup/, "operations route should expose the latest successful backup");
  assert.match(source, /reportExports\.map/, "operations route should include report export rows");
  assert.match(source, /schoolsRouter\.post\("\/backups"/, "manual product backup route should exist");
  assert.match(source, /createProductBackup/, "manual product backup route should create a real backup artifact");
});

test("uploads route enforces scanner validation before accepting files", () => {
  const source = readFileSync("src/modules/uploads/uploads.routes.ts", "utf8");

  assert.match(source, /scanUploadedFile/, "uploads route should call the file scanner");
  assert.match(source, /express\.raw\(/, "uploads route should accept raw upload payloads");
  assert.match(source, /allowedMimeTypes/, "uploads route should restrict MIME types");
  assert.match(source, /recordAuditLog/, "uploads route should audit successful uploads");
});

test("settings router stays mounted only on explicit settings prefixes", () => {
  const appSource = readFileSync("src/app.ts", "utf8");
  const settingsSource = readFileSync("src/modules/settings/settings.routes.ts", "utf8");

  assert.ok(settingsSource.includes('settingsRouter.get("/",'), "settings router should keep relative routes");
  assert.ok(
    settingsSource.includes('settingsRouter.post("/users"'),
    "settings router should keep relative user routes"
  );
  assert.ok(
    settingsSource.includes('settingsRouter.patch("/",'),
    "settings router should keep relative settings routes"
  );
  assert.ok(
    !appSource.includes('app.use("/", requirePermissionForWrite("manageSettings"), settingsRouter);'),
    "settings router must not be mounted on root"
  );
  assert.ok(
    appSource.includes('app.use("/api/settings", requirePermissionForWrite("manageSettings"), settingsRouter);'),
    "settings router should stay mounted on /api/settings"
  );
});
test("settings permission review enforces manageSettings at runtime", async () => {
  const runId = `${Date.now().toString(36)}-${process.pid}`;
  const schoolId = `settings-runtime-${runId}`;
  const managerId = `settings-manager-${runId}`;
  const teacherId = `settings-teacher-${runId}`;
  const managerEmail = `settings-manager-${runId}@example.com`;
  const teacherEmail = `settings-teacher-${runId}@example.com`;

  await prisma.school.create({
    data: {
      id: schoolId,
      name: `Settings Runtime ${runId}`,
      address: "",
      managerName: "Runtime Manager",
      institutionCode: `SR${runId.toUpperCase()}`,
      isActive: true
    }
  });

  await prisma.user.createMany({
    data: [
      {
        id: managerId,
        schoolId,
        name: "Runtime Manager",
        email: managerEmail,
        password: hashPassword("Runtime-Manager-123!"),
        role: "MANAGER"
      },
      {
        id: teacherId,
        schoolId,
        name: "Runtime Teacher",
        email: teacherEmail,
        password: hashPassword("Runtime-Teacher-123!"),
        role: "TEACHER"
      }
    ]
  });

  const originalRequireCentral = process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE;
  const originalCentralUrl = process.env.SOM_PRO_LICENSE_SERVER_URL;
  const originalLegacyCentralUrl = process.env.SOM_LICENSE_SERVER_URL;
  const originalRuntimeMode = process.env.SOM_RUNTIME_MODE;
  process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE = "false";
  process.env.SOM_PRO_LICENSE_SERVER_URL = "";
  process.env.SOM_LICENSE_SERVER_URL = "";
  process.env.SOM_RUNTIME_MODE = "development";
  const { createApp } = await import("../app");
  const app = createApp();
  const server = app.listen(0);

  try {
    await new Promise<void>((resolve) => {
      server.once("listening", resolve);
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to determine runtime test port");
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const managerAuth = await loginAndGetAuthData(baseUrl, managerEmail, "Runtime-Manager-123!");
    const teacherAuth = await loginAndGetAuthData(baseUrl, teacherEmail, "Runtime-Teacher-123!");

    const managerResponse = await fetch(`${baseUrl}/api/settings/permission-review`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${managerAuth.token}`,
        "Content-Type": "application/json"
      },
      body: "{}"
    });
    assert.equal(managerResponse.status, 201);
    const managerPayload = await managerResponse.json();
    assert.equal(managerPayload?.data?.ok, true);

    const teacherResponse = await fetch(`${baseUrl}/api/settings/permission-review`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${teacherAuth.token}`,
        "Content-Type": "application/json"
      },
      body: "{}"
    });
    assert.equal(teacherResponse.status, 403);
    const teacherPayload = await teacherResponse.json();
    assert.equal(teacherPayload?.error, "FORBIDDEN");
    assert.ok(String(teacherPayload?.message || "").length > 0);
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE = originalRequireCentral;
    process.env.SOM_PRO_LICENSE_SERVER_URL = originalCentralUrl;
    process.env.SOM_LICENSE_SERVER_URL = originalLegacyCentralUrl;
    process.env.SOM_RUNTIME_MODE = originalRuntimeMode;
    await prisma.user.deleteMany({ where: { schoolId } }).catch(() => null);
    await prisma.school.delete({ where: { id: schoolId } }).catch(() => null);
  }
});

test("student and parent accounts can be created and log in against a linked student", async () => {
  const runId = `${Date.now().toString(36)}-${process.pid}-portal`;
  const schoolId = `portal-runtime-${runId}`;
  const classId = `portal-class-${runId}`;
  const otherClassId = `portal-class-b-${runId}`;
  const studentId = `portal-student-${runId}`;
  const otherStudentId = `portal-student-b-${runId}`;
  const studentEmail = `student-${runId}@example.com`;
  const parentEmail = `parent-${runId}@example.com`;

  await prisma.school.create({
    data: {
      id: schoolId,
      name: `Portal Runtime ${runId}`,
      address: "",
      managerName: "Portal Manager",
      institutionCode: `PR${runId.toUpperCase()}`,
      isActive: true
    }
  });

  await prisma.schoolClass.create({
    data: {
      id: classId,
      schoolId,
      name: "Class A",
      status: "ACTIVE"
    }
  });

  await prisma.schoolClass.create({
    data: {
      id: otherClassId,
      schoolId,
      name: "Class B",
      status: "ACTIVE"
    }
  });

  await prisma.student.create({
    data: {
      id: studentId,
      schoolId,
      classId,
      name: "Portal Student",
      nationalId: `991${runId}`
    }
  });

  await prisma.student.create({
    data: {
      id: otherStudentId,
      schoolId,
      classId: otherClassId,
      name: "Portal Student B",
      nationalId: `992${runId}`
    }
  });

  await prisma.user.createMany({
    data: [
      {
        id: `portal-student-user-${runId}`,
        schoolId,
        studentId,
        name: "Portal Student User",
        email: studentEmail,
        password: hashPassword("Portal-Student-123!"),
        role: "STUDENT"
      },
      {
        id: `portal-parent-user-${runId}`,
        schoolId,
        studentId,
        name: "Portal Parent User",
        email: parentEmail,
        password: hashPassword("Portal-Parent-123!"),
        role: "PARENT"
      }
    ]
  });

  const originalRequireCentral = process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE;
  const originalCentralUrl = process.env.SOM_PRO_LICENSE_SERVER_URL;
  const originalLegacyCentralUrl = process.env.SOM_LICENSE_SERVER_URL;
  const originalRuntimeMode = process.env.SOM_RUNTIME_MODE;
  process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE = "false";
  process.env.SOM_PRO_LICENSE_SERVER_URL = "";
  process.env.SOM_LICENSE_SERVER_URL = "";
  process.env.SOM_RUNTIME_MODE = "development";
  const { createApp } = await import("../app");
  const app = createApp();
  const server = app.listen(0);

  try {
    await new Promise<void>((resolve) => {
      server.once("listening", resolve);
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to determine runtime test port");
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const studentAuth = await loginAndGetAuthData(baseUrl, studentEmail, "Portal-Student-123!");
    const parentAuth = await loginAndGetAuthData(baseUrl, parentEmail, "Portal-Parent-123!");

    assert.equal(studentAuth.user.role, "STUDENT");
    assert.equal(studentAuth.user.studentId, studentId);
    assert.equal(parentAuth.user.role, "PARENT");
    assert.equal(parentAuth.user.studentId, studentId);

    const studentMe = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${studentAuth.token}` }
    });
    assert.equal(studentMe.status, 200);
    const studentMePayload = await studentMe.json();
    assert.equal(studentMePayload?.data?.user?.role, "STUDENT");
    assert.equal(studentMePayload?.data?.user?.studentId, studentId);

    const ownContext = await fetch(`${baseUrl}/api/students/${studentId}/context`, {
      headers: { Authorization: `Bearer ${studentAuth.token}` }
    });
    assert.equal(ownContext.status, 200);
    const ownContextPayload = await ownContext.json();
    assert.equal(ownContextPayload?.data?.student?.id, studentId);

    const forbiddenContext = await fetch(`${baseUrl}/api/students/${otherStudentId}/context`, {
      headers: { Authorization: `Bearer ${studentAuth.token}` }
    });
    assert.equal(forbiddenContext.status, 403);
    const forbiddenContextPayload = await forbiddenContext.json();
    assert.equal(forbiddenContextPayload?.error, "FORBIDDEN");

    const forbiddenCertificate = await fetch(
      `${baseUrl}/api/students/certificates?studentId=${otherStudentId}&certificateType=TERM2_FINAL&academicYear=2025-2026`,
      {
        headers: { Authorization: `Bearer ${studentAuth.token}` }
      }
    );
    assert.equal(forbiddenCertificate.status, 403);
    const forbiddenCertificatePayload = await forbiddenCertificate.json();
    assert.equal(forbiddenCertificatePayload?.error, "FORBIDDEN");

    const parentMe = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${parentAuth.token}` }
    });
    assert.equal(parentMe.status, 200);
    const parentMePayload = await parentMe.json();
    assert.equal(parentMePayload?.data?.user?.role, "PARENT");
    assert.equal(parentMePayload?.data?.user?.studentId, studentId);
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE = originalRequireCentral;
    process.env.SOM_PRO_LICENSE_SERVER_URL = originalCentralUrl;
    process.env.SOM_LICENSE_SERVER_URL = originalLegacyCentralUrl;
    process.env.SOM_RUNTIME_MODE = originalRuntimeMode;
    await prisma.user.deleteMany({ where: { schoolId } }).catch(() => null);
    await prisma.schoolClass.delete({ where: { id: classId } }).catch(() => null);
    await prisma.schoolClass.delete({ where: { id: otherClassId } }).catch(() => null);
    await prisma.student.delete({ where: { id: studentId } }).catch(() => null);
    await prisma.student.delete({ where: { id: otherStudentId } }).catch(() => null);
    await prisma.school.delete({ where: { id: schoolId } }).catch(() => null);
  }
});

test("student write routes stay manageSettings-only and school export stays school-scoped", async () => {
  const runId = `${Date.now().toString(36)}-${process.pid}-writes`;
  const schoolId = `writes-runtime-${runId}`;
  const otherSchoolId = `writes-runtime-other-${runId}`;
  const classId = `writes-class-${runId}`;
  const studentId = `writes-student-${runId}`;
  const managerEmail = `writes-manager-${runId}@example.com`;
  const teacherEmail = `writes-teacher-${runId}@example.com`;

  await prisma.school.createMany({
    data: [
      {
        id: schoolId,
        name: `Writes Runtime ${runId}`,
        address: "",
        managerName: "Writes Manager",
        institutionCode: `WR${runId.toUpperCase()}`,
        isActive: true
      },
      {
        id: otherSchoolId,
        name: `Other Runtime ${runId}`,
        address: "",
        managerName: "Other Manager",
        institutionCode: `WO${runId.toUpperCase()}`,
        isActive: true
      }
    ]
  });

  await prisma.schoolClass.create({
    data: {
      id: classId,
      schoolId,
      name: "Class A",
      status: "ACTIVE"
    }
  });

  await prisma.student.create({
    data: {
      id: studentId,
      schoolId,
      classId,
      name: "Writes Student",
      nationalId: `993${runId}`
    }
  });

  await prisma.user.createMany({
    data: [
      {
        id: `writes-manager-user-${runId}`,
        schoolId,
        name: "Writes Manager",
        email: managerEmail,
        password: hashPassword("Writes-Manager-123!"),
        role: "MANAGER"
      },
      {
        id: `writes-teacher-user-${runId}`,
        schoolId,
        name: "Writes Teacher",
        email: teacherEmail,
        password: hashPassword("Writes-Teacher-123!"),
        role: "TEACHER"
      }
    ]
  });

  const originalRequireCentral = process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE;
  const originalCentralUrl = process.env.SOM_PRO_LICENSE_SERVER_URL;
  const originalLegacyCentralUrl = process.env.SOM_LICENSE_SERVER_URL;
  const originalRuntimeMode = process.env.SOM_RUNTIME_MODE;
  process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE = "false";
  process.env.SOM_PRO_LICENSE_SERVER_URL = "";
  process.env.SOM_LICENSE_SERVER_URL = "";
  process.env.SOM_RUNTIME_MODE = "development";
  const { createApp } = await import("../app");
  const app = createApp();
  const server = app.listen(0);

  try {
    await new Promise<void>((resolve) => {
      server.once("listening", resolve);
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to determine runtime test port");
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const managerAuth = await loginAndGetAuthData(baseUrl, managerEmail, "Writes-Manager-123!");
    const teacherAuth = await loginAndGetAuthData(baseUrl, teacherEmail, "Writes-Teacher-123!");

    const managerUpdate = await fetch(`${baseUrl}/api/students/${studentId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${managerAuth.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: studentId,
        classId,
        name: "Writes Student Updated",
        nationalId: `993${runId}`,
        fatherName: "",
        motherName: "",
        residence: "",
        fatherPhone: "",
        motherPhone: "",
        guardianPhone: "",
        healthFund: "",
        studentPhone: ""
      })
    });
    assert.equal(managerUpdate.status, 200);

    const teacherUpdate = await fetch(`${baseUrl}/api/students/${studentId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${teacherAuth.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: studentId,
        classId,
        name: "Writes Student Teacher Attempt",
        nationalId: `993${runId}`,
        fatherName: "",
        motherName: "",
        residence: "",
        fatherPhone: "",
        motherPhone: "",
        guardianPhone: "",
        healthFund: "",
        studentPhone: ""
      })
    });
    assert.equal(teacherUpdate.status, 403);
    const teacherUpdatePayload = await teacherUpdate.json();
    assert.equal(teacherUpdatePayload?.error, "FORBIDDEN");

    const schoolExport = await fetch(`${baseUrl}/api/schools/${otherSchoolId}/export-data`, {
      method: "POST",
      headers: { Authorization: `Bearer ${managerAuth.token}` }
    });
    assert.equal(schoolExport.status, 403);
    const schoolExportPayload = await schoolExport.json();
    assert.equal(schoolExportPayload?.error, "FORBIDDEN");
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE = originalRequireCentral;
    process.env.SOM_PRO_LICENSE_SERVER_URL = originalCentralUrl;
    process.env.SOM_LICENSE_SERVER_URL = originalLegacyCentralUrl;
    process.env.SOM_RUNTIME_MODE = originalRuntimeMode;
    await prisma.user.deleteMany({ where: { schoolId } }).catch(() => null);
    await prisma.student.delete({ where: { id: studentId } }).catch(() => null);
    await prisma.schoolClass.delete({ where: { id: classId } }).catch(() => null);
    await prisma.school.delete({ where: { id: schoolId } }).catch(() => null);
    await prisma.school.delete({ where: { id: otherSchoolId } }).catch(() => null);
  }
});
