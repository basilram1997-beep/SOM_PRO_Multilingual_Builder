import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  classifySubstitutionCandidate,
  isTeacherBusyInPeriod,
  RuleSlot,
  RuleTeacher,
  substitutionKindWeight
} from "./scheduleRules";
import { dutyOverlapsStatus } from "./dutySchedule";

type SchoolScoped = { id: string; schoolId: string; [key: string]: unknown };

function visibleForSchool<T extends SchoolScoped>(items: T[], schoolId: string) {
  return items.filter((item) => item.schoolId === schoolId);
}

const schoolA = "school-a";
const schoolB = "school-b";

test("multi-school isolation keeps teachers scoped to the requesting school", () => {
  const teachers = [
    { id: "teacher-a", schoolId: schoolA, name: "Teacher A" },
    { id: "teacher-b", schoolId: schoolB, name: "Teacher B" }
  ];

  assert.deepEqual(
    visibleForSchool(teachers, schoolA).map((item) => item.id),
    ["teacher-a"]
  );
  assert.deepEqual(
    visibleForSchool(teachers, schoolB).map((item) => item.id),
    ["teacher-b"]
  );
});

test("multi-school isolation keeps base schedule and archive scoped", () => {
  const baseSlots = [
    { id: "slot-a", schoolId: schoolA, day: "Monday" },
    { id: "slot-b", schoolId: schoolB, day: "Monday" }
  ];
  const archive = [
    { id: "daily-a", schoolId: schoolA, date: "2026-09-01" },
    { id: "daily-b", schoolId: schoolB, date: "2026-09-01" }
  ];

  assert.deepEqual(
    visibleForSchool(baseSlots, schoolA).map((item) => item.id),
    ["slot-a"]
  );
  assert.deepEqual(
    visibleForSchool(archive, schoolB).map((item) => item.id),
    ["daily-b"]
  );
});

test("multi-school isolation keeps absences and generated daily schedules scoped", () => {
  const statuses = [
    { id: "absence-a", schoolId: schoolA, teacherId: "teacher-a" },
    { id: "absence-b", schoolId: schoolB, teacherId: "teacher-b" }
  ];
  const generatedDaily = [
    { id: "generated-a", schoolId: schoolA, substitutions: ["sub-a"] },
    { id: "generated-b", schoolId: schoolB, substitutions: ["sub-b"] }
  ];

  assert.deepEqual(
    visibleForSchool(statuses, schoolA).map((item) => item.teacherId),
    ["teacher-a"]
  );
  assert.deepEqual(
    visibleForSchool(generatedDaily, schoolA).flatMap((item) => item.substitutions as string[]),
    ["sub-a"]
  );
});

test("school data routes obtain schoolId from request context", () => {
  const routeFiles = [
    "src/modules/teachers/teachers.routes.ts",
    "src/modules/classes/classes.routes.ts",
    "src/modules/subjects/subjects.routes.ts",
    "src/modules/settings/settings.routes.ts",
    "src/modules/schedules/schedules.routes.ts",
    "src/modules/daily/daily.routes.ts",
    "src/modules/lessons/exams.routes.ts",
    "src/modules/archive/archive.routes.ts",
    "src/modules/auditLogs/auditLogs.routes.ts",
    "src/modules/reports/reports.routes.ts",
    "src/modules/homeroom/homeroom.routes.ts",
    "src/modules/duties/duties.routes.ts",
    "src/modules/stats.routes.ts"
  ];

  for (const file of routeFiles) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /getRequestSchoolId\(req\)/, `${file} must use request school context`);
    assert.doesNotMatch(source, /getDefaultSchoolId\(/, `${file} must not use default school fallback directly`);
  }
});

test("duties are affected only when their time overlaps the teacher status", () => {
  const periods = [
    { period: 1, startTime: "08:00", endTime: "08:45" },
    { period: 2, startTime: "09:00", endTime: "09:45" }
  ];
  const lateFirstPeriod = { teacherId: "t1", type: "LATE", fromPeriod: 1, toPeriod: 1 };

  assert.equal(dutyOverlapsStatus({ startTime: "08:10", endTime: "08:30" }, lateFirstPeriod, periods, 7), true);
  assert.equal(dutyOverlapsStatus({ startTime: "09:05", endTime: "09:30" }, lateFirstPeriod, periods, 7), false);
});
test("daily schedule smoke avoids absent and busy substitute teachers", () => {
  const absentTeacherId = "teacher-absent";
  const busyTeacherId = "teacher-busy";
  const freeTeacherId = "teacher-free";
  const period = 1;
  const slotNeedingSubstitution: RuleSlot = {
    id: "slot-absent",
    period,
    teacherId: absentTeacherId,
    classId: "class-10a",
    subjectId: "math",
    class: { name: "العاشر أ" }
  };
  const busySlot: RuleSlot = {
    id: "slot-busy",
    period,
    teacherId: busyTeacherId,
    classId: "class-11a",
    subjectId: "english",
    class: { name: "الحادي عشر أ" }
  };
  const candidates: RuleTeacher[] = [
    { id: absentTeacherId, assignments: [{ classId: "class-10a", subjectId: "math", class: { name: "العاشر أ" } }] },
    { id: busyTeacherId, assignments: [{ classId: "class-10a", subjectId: "math", class: { name: "العاشر أ" } }] },
    { id: freeTeacherId, assignments: [{ classId: "class-10a", subjectId: "math", class: { name: "العاشر أ" } }] }
  ];
  const unavailable = new Set([absentTeacherId]);
  const selected = candidates
    .filter((teacher) => !unavailable.has(teacher.id))
    .filter((teacher) => !isTeacherBusyInPeriod(teacher.id, period, [busySlot], new Set()))
    .map((teacher) => ({ teacher, kind: classifySubstitutionCandidate(teacher, slotNeedingSubstitution) }))
    .sort((a, b) => substitutionKindWeight[a.kind] - substitutionKindWeight[b.kind])[0];

  assert.equal(selected.teacher.id, freeTeacherId);
  assert.ok(selected.kind);
});

test("shared week days are readable Arabic", () => {
  const source = readFileSync("../../packages/shared/src/index.ts", "utf8");
  assert.match(source, /الأحد/);
  assert.match(source, /الخميس/);
  assert.doesNotMatch(source, /Ø|Ù|Ã|â€/);
});
test("remember login stays in memory and does not use browser storage", () => {
  const source = readFileSync("../frontend/src/features/auth/useLogin.ts", "utf8");
  assert.doesNotMatch(source, /REMEMBER_LOGIN_KEY/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|writeStoredJson|readStoredJson|removeStoredValue/);
  assert.match(source, /rememberedLoginEmail/);
  assert.match(source, /rememberedLoginEnabled/);
  assert.match(source, /setEmail/);
  const callStart = source.indexOf("saveRememberedLogin({");
  assert.equal(callStart, -1);
});

test("daily export helper uses readable Arabic errors", () => {
  const source = readFileSync("../frontend/src/features/daily/dailyHelpers.ts", "utf8");
  assert.match(source, /تعذر العثور على القسم المطلوب للتصدير/);
  assert.doesNotMatch(source, /\?\? \?\?\?/);
});
test("frontend connection errors are readable Arabic and not mojibake", () => {
  const source = readFileSync("../frontend/src/api/http.ts", "utf8");
  assert.match(source, /تعذر الاتصال بخادم البرنامج المحلي/);
  assert.match(source, /حدث خطأ في الاتصال بالخادم/);
  assert.doesNotMatch(source, /Ø|Ù|Ã|â€/);
});

test("local services startup script normalizes project root before use", () => {
  const source = readFileSync("../../scripts/start-sompro-local-services.ps1", "utf8");
  assert.match(source, /function Normalize-ProjectRoot/);
  assert.match(source, /Resolve-Path -LiteralPath \$clean/);
  assert.match(source, /Test-Path -LiteralPath \$ProjectRoot/);
  assert.match(source, /Add-Content -LiteralPath \$ServiceLog/);
  assert.doesNotMatch(source, /GetFullPath\(\$ProjectRoot\)/);
});
test("offline page has a repair connection action", () => {
  const offline = readFileSync("../../apps/desktop/offline.html", "utf8");
  const preload = readFileSync("../../apps/desktop/preload.js", "utf8");
  const windowSource = readFileSync("../../apps/desktop/src/window.js", "utf8");
  assert.match(offline, /إصلاح الاتصال وإعادة المحاولة/);
  assert.match(offline, /repairConnection/);
  assert.match(preload, /repairConnection/);
  assert.match(windowSource, /som-repair-local-services/);
  assert.doesNotMatch(offline, /Ø|Ù|Ã|â€/);
});
test("desktop trial waits for local backend before loading the app", () => {
  const source = readFileSync("../../apps/desktop/src/window.js", "utf8");
  assert.match(source, /const backendReady = runtimeConfig\.isSaas \? true : await waitForLocalBackend\(1, 8000\);/);
  assert.match(source, /if \(!backendReady\) \{/);
  assert.match(source, /ensureLocalBackend\(\)\.catch\(\(\) => false\);/);
  assert.match(source, /const localBackendMonitor = setInterval/);
  assert.match(source, /offline\.html/);
});

test("duty page and daily schedule expose affected duties", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const app = readFileSync("src/app.ts", "utf8");
  const dutiesRoute = readFileSync("src/modules/duties/duties.routes.ts", "utf8");
  const dutyService = readFileSync("src/services/dutySchedule.ts", "utf8");
  const dailyCoordinator = readFileSync("src/services/scheduleCoordinator.ts", "utf8");
  const frontendPage = readFileSync("../frontend/src/pages/duties/DutiesPage.tsx", "utf8");
  const dailyPage = readFileSync("../frontend/src/pages/daily/DailyPage.tsx", "utf8");

  assert.match(schema, /model DutyAssignment/);
  assert.match(app, /\/api\/duties/);
  assert.match(dutiesRoute, /getRequestSchoolId\(req\)/);
  assert.match(dutiesRoute, /DutyAssignmentSchema/);
  assert.match(dutyService, /affectedReason/);
  assert.match(dailyCoordinator, /buildDailyDutyRows/);
  assert.match(frontendPage, /DutiesPage/);
  assert.match(dailyPage, /DailyDutiesPanel/);
});

test("school-scoped detail tables carry schoolId directly", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  assert.match(
    schema,
    /model TeacherAssignment \{[\s\S]*schoolId\s+String[\s\S]*@@unique\(\[schoolId, teacherId, classId, subjectId\]\)/
  );
  assert.match(
    schema,
    /model DailyTeacherStatus \{[\s\S]*schoolId\s+String[\s\S]*@@index\(\[schoolId, dailyScheduleId\]\)/
  );
  assert.match(
    schema,
    /model Substitution \{[\s\S]*schoolId\s+String[\s\S]*@@index\(\[schoolId, dailyScheduleId, period\]\)/
  );
  assert.match(schema, /model DailyEvent \{[\s\S]*schoolId\s+String[\s\S]*@@index\(\[schoolId, dailyScheduleId\]\)/);
});

test("teacher delete route clears dependent records before removing the teacher", () => {
  const source = readFileSync("src/modules/teachers/teachers.routes.ts", "utf8");

  assert.match(source, /dailyTeacherStatus\.deleteMany/);
  assert.match(source, /substitution\.deleteMany/);
  assert.match(source, /baseScheduleSlot\.deleteMany/);
  assert.match(source, /homeroomAssignment\.deleteMany/);
  assert.match(source, /dutyAssignment\.deleteMany/);
  assert.match(source, /teacherAssignment\.deleteMany/);
  assert.match(source, /teacherLessonToday\.deleteMany/);
  assert.match(source, /teacherHomework\.deleteMany/);
  assert.match(source, /teacherExam\.deleteMany/);
  assert.match(source, /teacher\.delete\(\{ where: \{ id: teacherId \} \}\)/);
  assert.match(source, /TEACHER_DELETE_CONFLICT/);
});

test("teacher assignment delete route removes the matching assignment and base schedule rows", () => {
  const source = readFileSync("src/modules/teachers/teachers.routes.ts", "utf8");

  assert.match(source, /teachersRouter\.delete\("\/:id\/assignments\/:assignmentId"/);
  assert.match(source, /baseScheduleSlot\.deleteMany\(\{/);
  assert.match(source, /teacherAssignment\.delete\(\{ where: \{ id: assignment\.id \} \}\)/);
  assert.match(source, /TEACHER_ASSIGNMENT_DELETE_FAILED/);
});

test("scheduler users can access only schedule operation pages in the frontend", () => {
  const sharedSource = readFileSync("../../packages/shared/src/index.ts", "utf8");
  const accessSource = readFileSync("../frontend/src/app/pageAccess.ts", "utf8");
  const appSource = readFileSync("../frontend/src/app/main.tsx", "utf8");
  const layoutSource = readFileSync("../frontend/src/components/layout/Layout.tsx", "utf8");
  const css = readFileSync("../frontend/src/styles/layout.css", "utf8");

  assert.match(sharedSource, /export const ROLE_ALLOWED_PAGES = {/);
  assert.match(sharedSource, /SCHEDULER: \["daily", "homeroom", "duties"\]/);
  assert.match(sharedSource, /TEACHER: \[/);
  assert.match(sharedSource, /export function allowedPagesForRole\(role: string \| undefined\)/);
  assert.match(accessSource, /schedulerAllowedPages:\s*PageKey\[\]\s*=\s*\["daily", "homeroom", "duties"\]/);
  assert.match(accessSource, /allowedPagesForRole\(role\)/);
  assert.match(appSource, /canAccessPage\(user\.role, nextPage\)/);
  assert.match(appSource, /fallbackPageForRole\(user\.role\)/);
  assert.match(layoutSource, /visibleMainItems = mainItems\.filter/);
  assert.match(layoutSource, /visibleProgramsItems = programsGroup\.items\.filter/);
  assert.match(
    layoutSource,
    /visibleStudentsItems\s*=\s*(?:\(isStudentAreaUser \|\| isTeacherUser\)|isStudentAreaUser \|\| isTeacherUser)\s*\?\s*\[\]\s*:\s*studentsGroup\.items\.filter/
  );
  assert.match(layoutSource, /visibleSettingsItems = settingsGroup\.items\.filter/);
  assert.match(layoutSource, /sidebar-group-header/);
  assert.match(layoutSource, /nav\.programsGroup/);
  assert.doesNotMatch(layoutSource, /const disabled = !canAccessPage\(currentUser\.role, item\.page\)/);
  assert.doesNotMatch(layoutSource, /disabled=\{disabled\}/);
  assert.match(css, /\.sidebar button\.nav-disabled/);
});
test("users page exposes supported account types through i18n", () => {
  const pageSource = readFileSync("../frontend/src/pages/users/UsersPage.tsx", "utf8");
  const hookSource = readFileSync("../frontend/src/features/users/useUsers.ts", "utf8");
  const formSource = readFileSync("../frontend/src/features/users/UsersFormPanel.tsx", "utf8");
  const routeSource = readFileSync("src/modules/settings/settings.routes.ts", "utf8");
  const enDict = readFileSync("../frontend/src/i18n/dictionaries/en.ts", "utf8");
  const heDict = readFileSync("../frontend/src/i18n/dictionaries/he.ts", "utf8");
  assert.match(pageSource, /useI18n/);
  assert.match(hookSource, /users\.fullAdmin/);
  assert.match(hookSource, /users\.homeroomTeacher/);
  assert.match(hookSource, /users\.student/);
  assert.match(hookSource, /users\.parent/);
  assert.doesNotMatch(hookSource, /\{ value: "SCHEDULER"/);
  assert.doesNotMatch(formSource, /users\.scheduler/);
  assert.doesNotMatch(pageSource + hookSource + formSource, /users\.readOnly/);
  assert.doesNotMatch(pageSource + hookSource + formSource, /changePassword|passwordForm|changingPassword/);
  assert.match(enDict, /"users\.homeroomTeacher": "Homeroom teacher"/);
  assert.match(heDict, /buildGeneratedLocaleDictionary\(en, "he"\)/);
  assert.match(routeSource, /ADMIN: "admin"/);
  assert.match(routeSource, /SCHEDULER: "scheduler"/);
  assert.doesNotMatch(routeSource, /"MANAGER"/);
});
test("users page uses generated usernames by role", () => {
  const routeSource = readFileSync("src/modules/settings/settings.routes.ts", "utf8");
  assert.match(routeSource, /\/users\/suggest-username/);
  assert.match(routeSource, /ADMIN: "admin"/);
  assert.match(routeSource, /SCHEDULER: "scheduler"/);
  assert.match(routeSource, /const base = `\$\{prefix\}\$\{schoolPart\}`/);
  assert.match(routeSource, /USERNAME_EXISTS/);

  const hookSource = readFileSync("../frontend/src/features/users/useUsers.ts", "utf8");
  const formSource = readFileSync("../frontend/src/features/users/UsersFormPanel.tsx", "utf8");
  assert.match(hookSource, /somApi\.settings\.suggestUsername/);
  assert.match(formSource, /const role = e\.target\.value as UserRole/);
  assert.match(formSource, /suggestUsername\(role\)/);
  assert.match(formSource, /saving \? labels\.saving : labels\.add/);
});

test("users page focus styling does not grow focused inputs", () => {
  const css = readFileSync("../frontend/src/styles/global.css", "utf8");
  assert.match(css, /\.users-page input:focus/);
  assert.match(css, /outline: 0/);
  assert.match(css, /box-shadow: 0 0 0 3px/);
  assert.match(css, /box-sizing: border-box/);
});

test("teachers page stays clean from dead weekly-load comments", () => {
  const source = readFileSync("../frontend/src/pages/teachers/TeachersPage.tsx", "utf8");
  assert.doesNotMatch(source, /BaseScheduleSlotWithDetails/);
  assert.doesNotMatch(source, /DailyScheduleSummary/);
  assert.doesNotMatch(source, /useState<any/);
  assert.doesNotMatch(source, /\(s: any\)/);
});
test("login page requires license code and removes password recovery flow", () => {
  const source = readFileSync("../frontend/src/features/auth/useLogin.ts", "utf8");
  const pageSource = readFileSync("../frontend/src/pages/auth/LoginPage.tsx", "utf8");
  assert.match(source, /missingLicense/);
  assert.match(source, /somApi\.auth\.login\(email, password, enteredLicense\)/);
  assert.match(source, /normalizeCode\(enteredLicense\) !== normalizeCode\(setupLicenseCode\)/);
  assert.match(source, /createCardHelp/);
  assert.doesNotMatch(source, /recoverCode|recoverAccess|showRecover|forgot-button|somApi\.auth\.recover/);
  assert.doesNotMatch(source, /bootstrapLicense\(enteredLicense\)/);
  assert.doesNotMatch(pageSource, /نسيت اسم المستخدم|استعادة|توليد كلمة مرور/);
});

test("auth and license routes apply multipart rejection and rate limiting", () => {
  const authRoutes = readFileSync("src/modules/auth/auth.routes.ts", "utf8");
  const licenseRoutes = readFileSync("src/modules/license/license.routes.ts", "utf8");
  const reportRoutes = readFileSync("src/modules/reports/reports.routes.ts", "utf8");
  const archiveRoutes = readFileSync("src/modules/archive/archive.routes.ts", "utf8");
  const auditLogsRoutes = readFileSync("src/modules/auditLogs/auditLogs.routes.ts", "utf8");
  const securityIncidentsRoutes = readFileSync("src/modules/securityIncidents/securityIncidents.routes.ts", "utf8");
  const appSource = readFileSync("src/app.ts", "utf8");
  const requestProtections = readFileSync("src/middleware/requestProtections.ts", "utf8");
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  assert.match(authRoutes, /rejectMultipartContent/);
  assert.match(authRoutes, /createRateLimitMiddleware/);
  assert.match(licenseRoutes, /rejectMultipartContent/);
  assert.match(licenseRoutes, /createRateLimitMiddleware/);
  assert.match(reportRoutes, /reportsRouter\.get\("\/security"/);
  assert.match(reportRoutes, /reportsRouter\.get\("\/daily\/:date"/);
  assert.match(reportRoutes, /reportsRouter\.get\("\/attendance"/);
  assert.match(reportRoutes, /reportsRouter\.get\("\/grades"/);
  assert.match(reportRoutes, /reportsRouter\.get\("\/classroom-logs"/);
  assert.match(reportRoutes, /reportsRouter\.post\("\/export"/);
  assert.match(reportRoutes, /getRequestSchoolId\(req\)/);
  assert.match(reportRoutes, /schoolId_date/);
  assert.match(reportRoutes, /entity: "HTTP_SECURITY"/);
  assert.match(reportRoutes, /manageSettings/);
  assert.match(reportRoutes, /canViewReports\(req\)/);
  assert.match(reportRoutes, /REPORT_DAILY_ACCESS_DENIED/);
  assert.match(reportRoutes, /createReportExportRecord\(prisma, \{/);
  assert.match(reportRoutes, /reportExportId = crypto\.randomUUID\(\)/);
  assert.match(archiveRoutes, /canViewArchive\(req\)/);
  assert.match(archiveRoutes, /canArchiveDaily\(req\)/);
  assert.match(archiveRoutes, /ARCHIVE_LIST_DENIED/);
  assert.match(archiveRoutes, /const snapshots = await latestArchiveSnapshots\(schoolId\);/);
  assert.match(archiveRoutes, /archivedUpdatedAt === currentUpdatedAt/);
  assert.match(auditLogsRoutes, /auditLogsRouter\.get\("\/", async \(req, res\) => \{/);
  assert.match(auditLogsRoutes, /auditLogsRouter\.get\("\/export", async \(req, res\) => \{/);
  assert.match(auditLogsRoutes, /auditLogsRouter\.get\("\/:id", async \(req, res\) => \{/);
  assert.match(auditLogsRoutes, /canViewAuditLogs\(req\)/);
  assert.match(auditLogsRoutes, /manageSettings/);
  assert.match(auditLogsRoutes, /getRequestSchoolId\(req\)/);
  assert.match(securityIncidentsRoutes, /securityIncidentsRouter\.get\("\/", async \(req, res\) => \{/);
  assert.match(securityIncidentsRoutes, /securityIncidentsRouter\.post\("\/", async \(req, res\) => \{/);
  assert.match(securityIncidentsRoutes, /securityIncidentsRouter\.patch\("\/:id", async \(req, res\) => \{/);
  assert.match(securityIncidentsRoutes, /SecurityIncidentStatusSchema/);
  assert.match(securityIncidentsRoutes, /SECURITY_INCIDENT_REPORTED/);
  assert.match(securityIncidentsRoutes, /SECURITY_INCIDENT_UPDATED/);
  assert.match(securityIncidentsRoutes, /manageSettings/);
  assert.match(securityIncidentsRoutes, /getRequestSchoolId\(req\)/);
  assert.match(appSource, /\/api\/audit-logs/);
  assert.match(appSource, /\/api\/security-incidents/);
  assert.match(appSource, /requirePermission\("manageSettings"\), auditLogsRouter/);
  assert.match(appSource, /requirePermission\("manageSettings"\), securityIncidentsRouter/);
  const securityExport = readFileSync("src/services/securityEventExport.ts", "utf8");
  assert.match(securityExport, /exportSecurityEventsAsJsonl/);
  assert.match(securityExport, /SecurityEventExporter/);
  assert.match(requestProtections, /rejectSchoolContextOverride/);
  assert.match(requestProtections, /schoolId/);
  assert.match(requestProtections, /school_id/);
  assert.match(schema, /model SecurityIncident/);
  assert.match(schema, /enum SecurityIncidentSeverity/);
  assert.match(schema, /enum SecurityIncidentStatus/);
  const incidentPolicy = readFileSync("../../docs/INCIDENT_RESPONSE_POLICY.md", "utf8");
  const securityTesting = readFileSync("../../docs/SECURITY_TESTING.md", "utf8");
  const owaspChecklist = readFileSync("../../docs/OWASP_CHECKLIST_AR.md", "utf8");
  assert.match(incidentPolicy, /Incident Response Policy/);
  assert.match(securityTesting, /Security Testing and SSDLC/);
  assert.match(owaspChecklist, /OWASP/);
});

test("student routes apply explicit write permissions while public auth routes stay narrow", () => {
  const studentsRoutes = readFileSync("src/modules/students/students.routes.ts", "utf8");
  const authRoutes = readFileSync("src/modules/auth/auth.routes.ts", "utf8");
  const licenseRoutes = readFileSync("src/modules/license/license.routes.ts", "utf8");
  const teachersRoutes = readFileSync("src/modules/teachers/teachers.routes.ts", "utf8");
  const classesRoutes = readFileSync("src/modules/classes/classes.routes.ts", "utf8");
  const dailyRoutes = readFileSync("src/modules/daily/daily.routes.ts", "utf8");

  assert.match(
    studentsRoutes,
    /(?:requirePermissionForWrite|\(0, auth_1\.requirePermissionForWrite\))\("manageLessons"\)[\s\S]*(?:validateBody\(StudentAttendanceSchema\)|validateBody\)\(shared_1\.StudentAttendanceSchema\))/
  );
  assert.match(
    studentsRoutes,
    /(?:requirePermissionForWrite|\(0, auth_1\.requirePermissionForWrite\))\("manageSettings"\)[\s\S]*(?:validateBody\(StudentSchema\)|validateBody\)\(shared_1\.StudentSchema\))/
  );
  assert.match(
    studentsRoutes,
    /(?:requirePermissionForWrite|\(0, auth_1\.requirePermissionForWrite\))\("manageLessons"\)[\s\S]*(?:validateBody\(StudentAcademicRecordSchema\)|validateBody\)\(shared_1\.StudentAcademicRecordSchema\))/
  );
  assert.match(
    studentsRoutes,
    /(?:requirePermissionForWrite|\(0, auth_1\.requirePermissionForWrite\))\("manageLessons"\)[\s\S]*(?:validateBody\(StudentBehaviorRecordSchema\)|validateBody\)\(shared_1\.StudentBehaviorRecordSchema\))/
  );
  assert.match(
    studentsRoutes,
    /(?:requirePermissionForWrite|\(0, auth_1\.requirePermissionForWrite\))\("manageLessons"\)[\s\S]*validateBody\(GradeSchemeSchema\)/
  );
  assert.match(
    studentsRoutes,
    /(?:requirePermissionForWrite|\(0, auth_1\.requirePermissionForWrite\))\("manageSettings"\)[\s\S]*(?:validateBody\(StudentCertificateSchema\)|validateBody\)\(shared_1\.StudentCertificateSchema\))/
  );
  assert.match(
    studentsRoutes,
    /requirePermissionForWrite\("manageSettings"\), async \(req, res\) =>|\(0, auth_1\.requirePermissionForWrite\)\("manageSettings"\), async \(req, res\) =>/
  );
  assert.match(studentsRoutes, /canViewGradeData\(req\)/);
  assert.match(studentsRoutes, /teacherWriteForbidden\(res\)/);
  assert.match(studentsRoutes, /studentsRouter\.get\("\/", async \(req, res\) => \{/);
  assert.match(studentsRoutes, /where: \{\s*schoolId,/);
  assert.match(studentsRoutes, /teacherScope/);
  assert.match(
    studentsRoutes,
    /teacherCanAccessClass\(teacherScope, classId\)|\(0, teacherScope_1\.teacherCanAccessClass\)\(teacherScope, classId\)/
  );
  assert.match(teachersRoutes, /getRequestSchoolId\(req\)/);
  assert.match(teachersRoutes, /data: \{ \.\.\.req\.body, schoolId \}/);
  assert.match(classesRoutes, /getRequestSchoolId\(req\)/);
  assert.match(classesRoutes, /data: \{ \.\.\.req\.body, schoolId \}/);
  assert.match(dailyRoutes, /getRequestSchoolId\(req\)/);
  assert.doesNotMatch(dailyRoutes, /req\.body\.schoolId/);
  assert.doesNotMatch(authRoutes, /requirePermissionForWrite/);
  assert.match(authRoutes, /authenticateRequest,\s*passwordChangeRateLimit/);
  assert.match(licenseRoutes, /authenticateRequest,\s*requirePermission\("manageLicense"\)/);
});
test("database seed is clean and non-destructive for new installations", () => {
  const source = readFileSync("prisma/seed.ts", "utf8");
  assert.match(source, /empty school bootstrap only/);
  assert.match(source, /مدرسة جديدة/);
  assert.doesNotMatch(source, /teacherProfiles|baseScheduleSlots|teacherAssignments|homeroomDefaults/);
  assert.doesNotMatch(
    source,
    /dailySchedule\.deleteMany|baseScheduleSlot\.deleteMany|teacherAssignment\.deleteMany|homeroomAssignment\.deleteMany/
  );
  assert.doesNotMatch(source, /أحمد سامح|SEED_MVP6_DATA|20 teachers/);
});

test("hebrew locale and layout are configured for RTL rendering", () => {
  const indexHtml = readFileSync("../frontend/index.html", "utf8");
  const localeRegistry = readFileSync("../frontend/src/i18n/localeRegistry.ts", "utf8");
  const i18nProvider = readFileSync("../frontend/src/i18n/i18n.tsx", "utf8");

  assert.match(indexHtml, /<html lang="ar" dir="rtl">/);
  assert.match(localeRegistry, /if \(code === "he"\) return \{ code, label: .* dir: "rtl" \};/s);
  assert.match(localeRegistry, /dir: /);
  assert.match(i18nProvider, /document\.documentElement\.dir = option\.dir;/);
  assert.match(i18nProvider, /document\.body\.dir = option\.dir;/);
});

test("the MVP intentionally excludes AI features", () => {
  const readme = readFileSync("../../README.md", "utf8");
  const saleReport = readFileSync("../../SALE_READINESS_REPORT.md", "utf8");

  assert.match(readme, /includes no AI features/i);
  assert.match(saleReport, /No AI features are included in the MVP/i);
});

test("local persistence stays limited to non-sensitive preferences", () => {
  const loginHook = readFileSync("../frontend/src/features/auth/useLogin.ts", "utf8");
  const gradeDraft = readFileSync("../frontend/src/features/students/gradeEntryDraft.ts", "utf8");
  const i18nProvider = readFileSync("../frontend/src/i18n/i18n.tsx", "utf8");
  const browserStorage = readFileSync("../frontend/src/lib/browserStorage.ts", "utf8");
  const httpApi = readFileSync("../frontend/src/api/http.ts", "utf8");

  assert.doesNotMatch(
    loginHook,
    /localStorage|sessionStorage|readStoredValue|writeStoredValue|writeStoredJson|readStoredJson/
  );
  assert.match(loginHook, /rememberedLoginEmail/);
  assert.match(loginHook, /rememberedLoginEnabled/);
  assert.match(gradeDraft, /const draftMemory = new Map/);
  assert.doesNotMatch(gradeDraft, /localStorage|sessionStorage/);
  assert.match(i18nProvider, /som-pro-language/);
  assert.match(browserStorage, /type StorageKind = "localStorage" \| "sessionStorage"/);
  assert.match(httpApi, /authTokenMemory/);
  assert.doesNotMatch(httpApi, /localStorage\.setItem|sessionStorage\.setItem/);
});

test("daily page reloads statuses per selected date instead of carrying them to another day", () => {
  const source = readFileSync("../frontend/src/features/daily/useDailySchedule.ts", "utf8");
  assert.match(source, /somApi\.daily\.get\(date\)/);
  assert.match(source, /setStatuses\(mapStatuses\(normalized\?\.statuses \|\| \[\]\)\)/);
  assert.match(source, /setStatuses\(\[\]\)/);
  assert.match(source, /setResult\(null\)/);
});
test("school settings preserve saved period labels and times", () => {
  const settingsService = readFileSync("src/services/schoolSettings.ts", "utf8");
  const settingsRoutes = readFileSync("src/modules/settings/settings.routes.ts", "utf8");

  assert.match(settingsService, /data: \{ isActive: true \}/);
  assert.match(settingsRoutes, /data: \{ isActive: true \}/);
  assert.doesNotMatch(settingsService, /update: \{ isActive: true, label/);
  assert.doesNotMatch(settingsRoutes, /update: \{ isActive: true, label/);
  assert.match(settingsRoutes, /periodDefinition\.updateMany/);
  assert.match(settingsRoutes, /period: \{ gt: settings\.periodsPerDay \}/);
});

test("base and daily schedules follow current school working days and periods", () => {
  const schedulesRoute = readFileSync("src/modules/schedules/schedules.routes.ts", "utf8");
  const schedulesEditing = readFileSync("src/services/scheduleEditing.ts", "utf8");
  const dailyCoordinator = readFileSync("src/services/scheduleCoordinator.ts", "utf8");
  const substitutionEngine = readFileSync("src/services/substitutionEngine.ts", "utf8");
  const teacherPrograms = readFileSync("src/services/teacherDailyPrograms.ts", "utf8");

  assert.match(schedulesRoute, /copy-week/);
  assert.match(schedulesRoute, /swap-periods/);
  assert.match(schedulesEditing, /ensureSchoolSettings\(schoolId,\s*db\)/);
  assert.match(schedulesEditing, /room/);
  assert.match(schedulesEditing, /periodsPerDay/);
  assert.match(dailyCoordinator, /period: \{ lte: settings\.periodsPerDay \}/);
  assert.match(substitutionEngine, /period: \{ lte: settings\.periodsPerDay \}/);
  assert.match(teacherPrograms, /period: \{ lte: settings\.periodsPerDay \}/);
  assert.match(teacherPrograms, /activeSubstitutions/);
});

test("schedule coordinator rewrites the daily plan inside one transaction before regenerating substitutions", () => {
  const source = readFileSync("src/services/scheduleCoordinator.ts", "utf8");

  assert.match(source, /prisma\.\$transaction\(async tx => \{/);
  assert.match(source, /dailySchedule\.upsert\(/);
  assert.match(source, /dailyTeacherStatus\.deleteMany\(/);
  assert.match(source, /substitution\.deleteMany\(/);
  assert.match(source, /generateSubstitutions\(\{\s*[\s\S]*db: tx[\s\S]*\}\)/);
  assert.match(
    source,
    /return \{ data: \{ daily: result\.daily, baseSlots, substitutions: result\.substitutions, duties \} \}/
  );
});
test("settings working days translate real Arabic day names", () => {
  const source = readFileSync("../frontend/src/i18n/displayNames.ts", "utf8");
  const settingsPage = readFileSync("../frontend/src/pages/settings/SettingsPage.tsx", "utf8");
  assert.match(source, /"السبت": \{ en: "Saturday", he: "שבת" \}/);
  assert.match(source, /"الاثنين": \{ en: "Monday", he: "שני" \}/);
  assert.match(source, /"الخميس": \{ en: "Thursday", he: "חמישי" \}/);
  assert.match(settingsPage, /localizeDay\(day, language\)/);
});
