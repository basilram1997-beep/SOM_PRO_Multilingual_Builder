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
  return payload.data as {
    token: string;
    user: {
      id: string;
      schoolId: string;
      name: string;
      email: string;
      role: string;
      studentId?: string | null;
    };
  };
}

function useRuntimeIntegrationEnv() {
  const originalRequireCentral = process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE;
  const originalCentralUrl = process.env.SOM_PRO_LICENSE_SERVER_URL;
  const originalLegacyCentralUrl = process.env.SOM_LICENSE_SERVER_URL;
  const originalRuntimeMode = process.env.SOM_RUNTIME_MODE;
  const originalDisableRateLimit = process.env.SOM_E2E_DISABLE_RATE_LIMIT;

  process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE = "false";
  process.env.SOM_PRO_LICENSE_SERVER_URL = "";
  process.env.SOM_LICENSE_SERVER_URL = "";
  process.env.SOM_RUNTIME_MODE = "development";
  process.env.SOM_E2E_DISABLE_RATE_LIMIT = "true";

  return () => {
    process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE = originalRequireCentral;
    process.env.SOM_PRO_LICENSE_SERVER_URL = originalCentralUrl;
    process.env.SOM_LICENSE_SERVER_URL = originalLegacyCentralUrl;
    process.env.SOM_RUNTIME_MODE = originalRuntimeMode;
    process.env.SOM_E2E_DISABLE_RATE_LIMIT = originalDisableRateLimit;
  };
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

  const protectionsSource = readFileSync("src/middleware/requestProtections.ts", "utf8");
  assert.match(
    protectionsSource,
    /req\.path === "\/api\/schools\/backups"/,
    "manual product backup route should be rate limited"
  );
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

test("API exchanges JSON data with stable envelopes across version, login, class create, and protected reads", async () => {
  const runId = `${Date.now().toString(36)}-${process.pid}-api`;
  const schoolId = `api-runtime-${runId}`;
  const managerEmail = `api-manager-${runId}@example.com`;
  const managerPassword = "Api-Manager-123!";
  const className = `API Class ${runId}`;

  await prisma.school.create({
    data: {
      id: schoolId,
      name: `API Runtime ${runId}`,
      address: "",
      managerName: "API Manager",
      institutionCode: `AP${runId.toUpperCase()}`,
      isActive: true
    }
  });

  await prisma.user.create({
    data: {
      id: `api-manager-user-${runId}`,
      schoolId,
      name: "API Manager",
      email: managerEmail,
      password: hashPassword(managerPassword),
      role: "MANAGER"
    }
  });

  const restoreRuntimeEnv = useRuntimeIntegrationEnv();
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

    const versionResponse = await fetch(`${baseUrl}/api/version`);
    assert.equal(versionResponse.status, 200);
    assert.match(versionResponse.headers.get("content-type") || "", /application\/json/i);
    const versionPayload = await versionResponse.json();
    assert.equal(versionPayload?.data?.product, "SOM PRO");
    assert.equal(versionPayload?.error, null);
    assert.ok(String(versionPayload?.data?.version || "").length > 0);

    const auth = await loginAndGetAuthData(baseUrl, managerEmail, managerPassword);
    assert.equal(auth.user.email, managerEmail);
    assert.equal(auth.user.role, "MANAGER");

    const createClassResponse = await fetch(`${baseUrl}/api/classes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: className
      })
    });
    assert.equal(createClassResponse.status, 201);
    assert.match(createClassResponse.headers.get("content-type") || "", /application\/json/i);
    const createClassPayload = await createClassResponse.json();
    assert.equal(createClassPayload?.data?.name, className);
    assert.equal(createClassPayload?.data?.schoolId, schoolId);

    const listClassesResponse = await fetch(`${baseUrl}/api/classes`, {
      headers: {
        Authorization: `Bearer ${auth.token}`
      }
    });
    assert.equal(listClassesResponse.status, 200);
    assert.match(listClassesResponse.headers.get("content-type") || "", /application\/json/i);
    const listClassesPayload = await listClassesResponse.json();
    assert.ok(Array.isArray(listClassesPayload?.data));
    assert.equal(
      listClassesPayload?.data?.some((item: { id?: string; name?: string }) => item.name === className),
      true
    );

    const protectedReadResponse = await fetch(`${baseUrl}/api/teachers`);
    assert.equal(protectedReadResponse.status, 401);
    assert.match(protectedReadResponse.headers.get("content-type") || "", /application\/json/i);
    const protectedReadPayload = await protectedReadResponse.json();
    assert.equal(protectedReadPayload?.error, "AUTH_REQUIRED");
    assert.ok(String(protectedReadPayload?.message || "").length > 0);
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    restoreRuntimeEnv();
    await prisma.user.deleteMany({ where: { schoolId } }).catch(() => null);
    await prisma.schoolClass.deleteMany({ where: { schoolId } }).catch(() => null);
    await prisma.school.delete({ where: { id: schoolId } }).catch(() => null);
  }
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

  const restoreRuntimeEnv = useRuntimeIntegrationEnv();
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

    restoreRuntimeEnv();
    await prisma.user.deleteMany({ where: { schoolId } }).catch(() => null);
    await prisma.school.delete({ where: { id: schoolId } }).catch(() => null);
  }
});

test("teachers, students, and settings flows keep happy paths and forbidden writes separated", async () => {
  const runId = `${Date.now().toString(36)}-${process.pid}-heavy`;
  const schoolId = `heavy-runtime-${runId}`;
  const classId = `heavy-class-${runId}`;
  const linkedStudentId = `heavy-linked-student-${runId}`;
  const importedStudentName = `Imported Student ${runId}`;
  const teacherName = `Runtime Teacher ${runId}`;
  const managerEmail = `heavy-manager-${runId}@example.com`;
  const teacherEmail = `heavy-teacher-${runId}@example.com`;
  const parentEmail = `heavy-parent-${runId}@example.com`;
  const importedNationalId = `994${runId}`;

  await prisma.school.create({
    data: {
      id: schoolId,
      name: `Heavy Runtime ${runId}`,
      address: "",
      managerName: "Heavy Manager",
      institutionCode: `HR${runId.toUpperCase()}`,
      isActive: true
    }
  });

  await prisma.schoolClass.create({
    data: {
      id: classId,
      schoolId,
      name: "Grade 1 A",
      status: "ACTIVE"
    }
  });

  await prisma.student.create({
    data: {
      id: linkedStudentId,
      schoolId,
      classId,
      name: "Linked Student",
      nationalId: `995${runId}`
    }
  });

  await prisma.user.createMany({
    data: [
      {
        id: `heavy-manager-user-${runId}`,
        schoolId,
        name: "Heavy Manager",
        email: managerEmail,
        password: hashPassword("Heavy-Manager-123!"),
        role: "MANAGER"
      },
      {
        id: `heavy-teacher-user-${runId}`,
        schoolId,
        name: teacherName,
        email: teacherEmail,
        password: hashPassword("Heavy-Teacher-123!"),
        role: "TEACHER"
      }
    ]
  });

  const restoreRuntimeEnv = useRuntimeIntegrationEnv();
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
    const managerAuth = await loginAndGetAuthData(baseUrl, managerEmail, "Heavy-Manager-123!");
    const teacherAuth = await loginAndGetAuthData(baseUrl, teacherEmail, "Heavy-Teacher-123!");

    const teacherCreateResponse = await fetch(`${baseUrl}/api/teachers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${managerAuth.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: teacherName,
        employeeNumber: `EMP-${runId}`,
        specialty: "Mathematics",
        employmentRatio: 100,
        workDays: ["Sunday"],
        preferredDays: ["Sunday"],
        preferredClasses: [classId],
        preferredPeriods: [1],
        releaseHours: 0,
        targetLoad: 24
      })
    });
    assert.equal(teacherCreateResponse.status, 201);
    const teacherCreatePayload = await teacherCreateResponse.json();
    const createdTeacherId = teacherCreatePayload?.data?.id;
    assert.ok(createdTeacherId);
    assert.equal(teacherCreatePayload?.data?.name, teacherName);

    const teacherListResponse = await fetch(`${baseUrl}/api/teachers`, {
      headers: {
        Authorization: `Bearer ${managerAuth.token}`
      }
    });
    assert.equal(teacherListResponse.status, 200);
    const teacherListPayload = await teacherListResponse.json();
    assert.ok(Array.isArray(teacherListPayload?.data));
    assert.equal(
      teacherListPayload?.data?.some((item: { id?: string; name?: string }) => item.id === createdTeacherId),
      true
    );

    const teacherListForbidden = await fetch(`${baseUrl}/api/teachers`, {
      headers: {
        Authorization: `Bearer ${teacherAuth.token}`
      }
    });
    assert.equal(teacherListForbidden.status, 403);
    const teacherListForbiddenPayload = await teacherListForbidden.json();
    assert.equal(teacherListForbiddenPayload?.error, "FORBIDDEN");

    const settingsUserResponse = await fetch(`${baseUrl}/api/settings/users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${managerAuth.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Parent Runtime",
        email: parentEmail,
        password: "Parent-12345!",
        role: "PARENT",
        studentId: linkedStudentId
      })
    });
    assert.equal(settingsUserResponse.status, 201);
    const settingsUserPayload = await settingsUserResponse.json();
    assert.equal(settingsUserPayload?.data?.role, "PARENT");
    assert.equal(settingsUserPayload?.data?.studentId, linkedStudentId);

    const teacherSettingsForbidden = await fetch(`${baseUrl}/api/settings/users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${teacherAuth.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Teacher Attempt",
        email: `teacher-attempt-${runId}@example.com`,
        password: "Teacher-12345!",
        role: "PARENT",
        studentId: linkedStudentId
      })
    });
    assert.equal(teacherSettingsForbidden.status, 403);
    const teacherSettingsForbiddenPayload = await teacherSettingsForbidden.json();
    assert.equal(teacherSettingsForbiddenPayload?.error, "FORBIDDEN");

    const studentImportResponse = await fetch(`${baseUrl}/api/students/import`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${managerAuth.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        classId,
        students: [
          {
            name: importedStudentName,
            nationalId: importedNationalId,
            fatherName: "Father",
            motherName: "Mother",
            residence: "City",
            fatherPhone: "0500000000",
            motherPhone: "0500000001",
            guardianPhone: "0500000002",
            healthFund: "Fund",
            studentPhone: "0500000003"
          }
        ]
      })
    });
    assert.equal(studentImportResponse.status, 201);
    const studentImportPayload = await studentImportResponse.json();
    assert.equal(studentImportPayload?.data?.created, 1);
    assert.equal(studentImportPayload?.data?.updated, 0);
    assert.equal(studentImportPayload?.data?.total, 1);
    assert.equal(studentImportPayload?.data?.students?.[0]?.name, importedStudentName);

    const teacherImportForbidden = await fetch(`${baseUrl}/api/students/import`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${teacherAuth.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        classId,
        students: [
          {
            name: `Teacher Import Attempt ${runId}`,
            nationalId: `996${runId}`
          }
        ]
      })
    });
    assert.equal(teacherImportForbidden.status, 403);
    const teacherImportForbiddenPayload = await teacherImportForbidden.json();
    assert.equal(teacherImportForbiddenPayload?.error, "FORBIDDEN");
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    restoreRuntimeEnv();
    await prisma.teacherAssignment.deleteMany({ where: { schoolId } }).catch(() => null);
    await prisma.user.deleteMany({ where: { schoolId } }).catch(() => null);
    await prisma.student.deleteMany({ where: { schoolId } }).catch(() => null);
    await prisma.teacher.deleteMany({ where: { schoolId } }).catch(() => null);
    await prisma.subject.deleteMany({ where: { schoolId } }).catch(() => null);
    await prisma.schoolClass.deleteMany({ where: { schoolId } }).catch(() => null);
    await prisma.school.deleteMany({ where: { id: schoolId } }).catch(() => null);
  }
});

test("attendance writes feed the attendance report and enforce role boundaries", async () => {
  const runId = `${Date.now().toString(36)}-${process.pid}-attendance`;
  const schoolId = `attendance-runtime-${runId}`;
  const classId = `attendance-class-${runId}`;
  const otherClassId = `attendance-class-other-${runId}`;
  const subjectId = `attendance-subject-${runId}`;
  const studentId = `attendance-student-${runId}`;
  const teacherEmail = `attendance-teacher-${runId}@example.com`;
  const managerEmail = `attendance-manager-${runId}@example.com`;
  const reportDate = "2026-08-09";

  await prisma.school.create({
    data: {
      id: schoolId,
      name: `Attendance Runtime ${runId}`,
      address: "",
      managerName: "Attendance Manager",
      institutionCode: `AT${runId.toUpperCase()}`,
      isActive: true
    }
  });

  await prisma.schoolClass.createMany({
    data: [
      {
        id: classId,
        schoolId,
        name: "Grade 2 A",
        status: "ACTIVE"
      },
      {
        id: otherClassId,
        schoolId,
        name: "Grade 2 B",
        status: "ACTIVE"
      }
    ]
  });

  await prisma.subject.create({
    data: {
      id: subjectId,
      schoolId,
      name: "Arabic"
    }
  });

  await prisma.student.create({
    data: {
      id: studentId,
      schoolId,
      classId,
      name: "Attendance Student",
      nationalId: `996${runId}`
    }
  });

  await prisma.teacher.create({
    data: {
      id: `attendance-teacher-record-${runId}`,
      schoolId,
      name: `Attendance Teacher ${runId}`,
      employeeNumber: `EMP-A-${runId}`
    }
  });

  await prisma.teacherAssignment.create({
    data: {
      schoolId,
      teacherId: `attendance-teacher-record-${runId}`,
      classId: otherClassId,
      subjectId,
      weeklyPeriods: 2
    }
  });

  await prisma.user.createMany({
    data: [
      {
        id: `attendance-manager-user-${runId}`,
        schoolId,
        name: "Attendance Manager",
        email: managerEmail,
        password: hashPassword("Attendance-Manager-123!"),
        role: "MANAGER"
      },
      {
        id: `attendance-teacher-user-${runId}`,
        schoolId,
        name: `Attendance Teacher ${runId}`,
        email: teacherEmail,
        password: hashPassword("Attendance-Teacher-123!"),
        role: "TEACHER"
      }
    ]
  });

  const restoreRuntimeEnv = useRuntimeIntegrationEnv();
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
    const managerAuth = await loginAndGetAuthData(baseUrl, managerEmail, "Attendance-Manager-123!");
    const teacherAuth = await loginAndGetAuthData(baseUrl, teacherEmail, "Attendance-Teacher-123!");

    const firstAttendance = await fetch(`${baseUrl}/api/students/attendance`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${managerAuth.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        studentId,
        date: reportDate,
        day: "Sunday",
        status: "ABSENT_UNEXCUSED",
        note: "first save"
      })
    });
    assert.equal(firstAttendance.status, 200);
    const firstAttendancePayload = await firstAttendance.json();
    assert.equal(firstAttendancePayload?.data?.status, "ABSENT_UNEXCUSED");

    const secondAttendance = await fetch(`${baseUrl}/api/students/attendance`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${managerAuth.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        studentId,
        date: reportDate,
        day: "Sunday",
        status: "LATE",
        lateAt: "08:10",
        note: "updated save"
      })
    });
    assert.equal(secondAttendance.status, 200);
    const secondAttendancePayload = await secondAttendance.json();
    assert.equal(secondAttendancePayload?.data?.status, "LATE");
    assert.equal(secondAttendancePayload?.data?.lateAt, "08:10");

    const reportResponse = await fetch(
      `${baseUrl}/api/reports/attendance?classId=${encodeURIComponent(classId)}&from=${reportDate}&to=${reportDate}`,
      {
        headers: {
          Authorization: `Bearer ${managerAuth.token}`
        }
      }
    );
    assert.equal(reportResponse.status, 200);
    const reportPayload = await reportResponse.json();
    assert.equal(reportPayload?.data?.classId, classId);
    assert.equal(reportPayload?.data?.summary?.total, 1);
    assert.equal(reportPayload?.data?.summary?.late, 1);
    assert.equal(reportPayload?.data?.summary?.absent, 0);
    assert.equal(reportPayload?.data?.rows?.length, 1);
    assert.equal(reportPayload?.data?.rows?.[0]?.status, "LATE");

    const badReportQuery = await fetch(`${baseUrl}/api/reports/attendance?classId=&from=bad-date&to=${reportDate}`, {
      headers: {
        Authorization: `Bearer ${managerAuth.token}`
      }
    });
    assert.equal(badReportQuery.status, 400);
    const badReportQueryPayload = await badReportQuery.json();
    assert.equal(badReportQueryPayload?.error, "INVALID_ATTENDANCE_REPORT_QUERY");

    const teacherAttendanceForbidden = await fetch(`${baseUrl}/api/students/attendance`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${teacherAuth.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        studentId,
        date: reportDate,
        day: "Sunday",
        status: "PRESENT"
      })
    });
    assert.equal(teacherAttendanceForbidden.status, 403);
    const teacherAttendanceForbiddenPayload = await teacherAttendanceForbidden.json();
    assert.equal(teacherAttendanceForbiddenPayload?.error, "FORBIDDEN");

    const teacherReportForbidden = await fetch(
      `${baseUrl}/api/reports/attendance?classId=${encodeURIComponent(classId)}&from=${reportDate}&to=${reportDate}`,
      {
        headers: {
          Authorization: `Bearer ${teacherAuth.token}`
        }
      }
    );
    assert.equal(teacherReportForbidden.status, 403);
    const teacherReportForbiddenPayload = await teacherReportForbidden.json();
    assert.equal(teacherReportForbiddenPayload?.error, "FORBIDDEN");
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    restoreRuntimeEnv();
    await prisma.studentAttendance.deleteMany({ where: { schoolId } }).catch(() => null);
    await prisma.teacherAssignment.deleteMany({ where: { schoolId } }).catch(() => null);
    await prisma.user.deleteMany({ where: { schoolId } }).catch(() => null);
    await prisma.student.deleteMany({ where: { schoolId } }).catch(() => null);
    await prisma.teacher.deleteMany({ where: { schoolId } }).catch(() => null);
    await prisma.subject.deleteMany({ where: { schoolId } }).catch(() => null);
    await prisma.schoolClass.deleteMany({ where: { schoolId } }).catch(() => null);
    await prisma.school.deleteMany({ where: { id: schoolId } }).catch(() => null);
  }
});

test("report exports persist export records and enforce report permissions", async () => {
  const runId = `${Date.now().toString(36)}-${process.pid}-reports`;
  const schoolId = `reports-runtime-${runId}`;
  const classId = `reports-class-${runId}`;
  const subjectId = `reports-subject-${runId}`;
  const teacherId = `reports-teacher-${runId}`;
  const managerEmail = `reports-manager-${runId}@example.com`;
  const teacherEmail = `reports-teacher-${runId}@example.com`;

  await prisma.school.create({
    data: {
      id: schoolId,
      name: `Reports Runtime ${runId}`,
      address: "",
      managerName: "Reports Manager",
      institutionCode: `RP${runId.toUpperCase()}`,
      isActive: true
    }
  });

  await prisma.schoolClass.create({
    data: {
      id: classId,
      schoolId,
      name: "Reports Class",
      status: "ACTIVE"
    }
  });

  await prisma.subject.create({
    data: {
      id: subjectId,
      schoolId,
      name: "Reports Subject",
      status: "ACTIVE"
    }
  });

  await prisma.teacher.create({
    data: {
      id: teacherId,
      schoolId,
      name: "Reports Teacher",
      nationalId: `992${runId}`
    }
  });

  await prisma.user.createMany({
    data: [
      {
        schoolId,
        name: "Reports Manager",
        email: managerEmail,
        password: hashPassword("Reports-Manager-123!"),
        role: "MANAGER"
      },
      {
        schoolId,
        name: "Reports Teacher",
        email: teacherEmail,
        password: hashPassword("Reports-Teacher-123!"),
        role: "TEACHER"
      }
    ]
  });

  const restoreRuntimeEnv = useRuntimeIntegrationEnv();
  const { createApp } = await import("../app");
  const app = createApp();
  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const managerAuth = await loginAndGetAuthData(baseUrl, managerEmail, "Reports-Manager-123!");
    const teacherAuth = await loginAndGetAuthData(baseUrl, teacherEmail, "Reports-Teacher-123!");

    const exportResponse = await fetch(`${baseUrl}/api/reports/export`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${managerAuth.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        reportType: "attendance",
        title: "Attendance Export",
        fileName: "attendance-export.pdf",
        kind: "PDF",
        permission: "manageSettings",
        expiresInMinutes: 15,
        privacyWarningAccepted: true,
        filters: {
          classId,
          subjectId
        }
      })
    });
    assert.equal(exportResponse.status, 200);
    const exportPayload = await exportResponse.json();
    assert.equal(exportPayload?.data?.ok, true);
    assert.equal(exportPayload?.data?.reportType, "attendance");
    assert.ok(exportPayload?.data?.exportId);
    assert.ok(exportPayload?.data?.expiresAt);

    const exportId = exportPayload.data.exportId as string;
    const exportFilePath = `reports/attendance/${exportId}.pdf`;
    const exportRecord = await prisma.reportExport.findUnique({
      where: {
        schoolId_filePath: {
          schoolId,
          filePath: exportFilePath
        }
      }
    });
    assert.ok(exportRecord, "expected report export row to be created");
    assert.equal(exportRecord?.reportType, "attendance");
    assert.equal(exportRecord?.fileType, "PDF");
    assert.equal(exportRecord?.requestedBy, managerAuth.user.id);
    assert.equal(exportRecord?.status, "REQUESTED");

    const teacherExportForbidden = await fetch(`${baseUrl}/api/reports/export`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${teacherAuth.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        reportType: "attendance",
        title: "Teacher Export Attempt",
        fileName: "teacher-export.pdf",
        kind: "PDF",
        permission: "manageSettings",
        privacyWarningAccepted: true
      })
    });
    assert.equal(teacherExportForbidden.status, 403);
    const teacherExportForbiddenPayload = await teacherExportForbidden.json();
    assert.equal(teacherExportForbiddenPayload?.error, "FORBIDDEN");

    const invalidExport = await fetch(`${baseUrl}/api/reports/export`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${managerAuth.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        reportType: "attendance",
        title: "Invalid Export",
        fileName: "invalid-export.pdf",
        kind: "PDF",
        permission: "manageSettings"
      })
    });
    assert.equal(invalidExport.status, 400);
    const invalidExportPayload = await invalidExport.json();
    assert.equal(invalidExportPayload?.error, "INVALID_REPORT_EXPORT");
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    await prisma.reportExport.deleteMany({ where: { schoolId } }).catch(() => null);
    await prisma.user.deleteMany({ where: { schoolId } }).catch(() => null);
    await prisma.teacher.deleteMany({ where: { schoolId } }).catch(() => null);
    await prisma.subject.deleteMany({ where: { schoolId } }).catch(() => null);
    await prisma.schoolClass.deleteMany({ where: { schoolId } }).catch(() => null);
    await prisma.school.deleteMany({ where: { id: schoolId } }).catch(() => null);

    restoreRuntimeEnv();
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

  const restoreRuntimeEnv = useRuntimeIntegrationEnv();
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

    restoreRuntimeEnv();
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

  const restoreRuntimeEnv = useRuntimeIntegrationEnv();
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

    restoreRuntimeEnv();
    await prisma.user.deleteMany({ where: { schoolId } }).catch(() => null);
    await prisma.student.delete({ where: { id: studentId } }).catch(() => null);
    await prisma.schoolClass.delete({ where: { id: classId } }).catch(() => null);
    await prisma.school.delete({ where: { id: schoolId } }).catch(() => null);
    await prisma.school.delete({ where: { id: otherSchoolId } }).catch(() => null);
  }
});
