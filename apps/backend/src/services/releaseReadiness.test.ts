import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
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

const repoRoot = resolve(__dirname, "../../../../");

function readRepoFile(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

function parseEnvFile(text: string) {
  const values: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    values[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return values;
}

function assertEnvEquals(values: Record<string, string>, key: string, expected: string) {
  assert.equal(values[key], expected, `${key} should match`);
}

function assertEnvMatches(values: Record<string, string>, key: string, pattern: RegExp) {
  assert.match(values[key] || "", pattern, `${key} should match ${pattern}`);
}

function assertCommercialInstallDependencies() {
  const gitignore = readRepoFile(".gitignore");
  const packageJson = readRepoFile("package.json");
  const readme = readRepoFile("README.md");
  const ciWorkflow = readRepoFile(".github/workflows/ci.yml");
  const compose = readRepoFile("docker-compose.yml");
  const productionCompose = readRepoFile("docker-compose.production.yml");
  const productionGuide = readRepoFile("docs/PRODUCTION_DEPLOYMENT_GUIDE_AR.md");
  const backendApp = readRepoFile("apps/backend/src/app.ts");
  const complianceDoc = readRepoFile("docs/COMPLIANCE_AND_DESTRUCTIVE_TESTING.md");
  const externalReviewPack = readRepoFile("docs/EXTERNAL_REVIEW_PACK_AR.md");
  const retentionPolicy = readRepoFile("docs/RETENTION_AND_DELETION_POLICY.md");
  const decisionLog = readRepoFile("docs/DECISION_LOG_TEMPLATE.md");
  const productionEnv = parseEnvFile(readRepoFile(".env.production.example"));
  const backendProductionEnv = parseEnvFile(readRepoFile("apps/backend/.env.production.example"));
  const secretsCheck = readRepoFile("scripts/security-secrets-check.js");
  const doctor = readRepoFile("scripts/runtime/install-doctor.js");
  const releaseCheck = readRepoFile("scripts/runtime/release-check.js");
  const localServices = readRepoFile("scripts/runtime/local-data-services.js");
  const databaseConfig = readRepoFile("scripts/runtime/database-config.js");
  const operatorHealthTypes = readRepoFile("apps/frontend/src/features/operatorHealth/operatorHealthTypes.ts");
  const operatorHealthPage = readRepoFile("apps/frontend/src/pages/settings/OperatorHealthPage.tsx");
  const stagingEnv = parseEnvFile(readRepoFile(".env.staging.example"));
  const backendStagingEnv = parseEnvFile(readRepoFile("apps/backend/.env.staging.example"));
  const frontendStagingEnv = parseEnvFile(readRepoFile("apps/frontend/.env.staging.example"));

  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^\.env\.\*$/m);
  assert.match(gitignore, /^apps\/\*\/\.env\.\*$/m);
  assert.match(packageJson, /"security:secrets": "node scripts\/security-secrets-check\.js"/);
  assert.match(packageJson, /"node": ">=22\.12\.0"/);
  assert.match(readme, /Node\.js 22\.12\.0\+/);
  assert.doesNotMatch(readme, /Node\.js 20\+/);
  assert.match(ciWorkflow, /resilience_smoke/);
  assert.match(ciWorkflow, /chaos:test/);
  assert.match(secretsCheck, /runGit\(\["ls-files"\]\)/);
  assert.match(secretsCheck, /Forbidden tracked env file/);
  assert.match(packageJson, /"install:doctor": "node scripts\/runtime\/install-doctor\.js"/);
  assert.match(packageJson, /"install:prepare": "node scripts\/runtime\/install-doctor\.js --fix"/);
  assert.match(packageJson, /"compliance:test": "npm run test:compliance -w apps\/backend"/);
  assert.match(packageJson, /"destructive:test": "npm run test:destructive -w apps\/backend"/);
  assert.match(compose, /"127\.0\.0\.1:5432:5432"/);
  assert.doesNotMatch(compose, /"\s*5432:5432\s*"/);
  assert.match(compose, /pg_isready -U som_user -d som/);
  assert.match(compose, /redis-cli", "ping"/);
  assert.doesNotMatch(productionCompose, /5432:5432/);
  assert.doesNotMatch(productionCompose, /127\.0\.0\.1:5432:5432/);
  assert.match(productionCompose, /REDIS_PASSWORD/);
  assert.match(productionCompose, /redis\.production\.conf/);
  assert.match(productionCompose, /REDISCLI_AUTH/);
  assert.match(productionCompose, /REDIS_PASSWORD: \$\{REDIS_PASSWORD:\?set REDIS_PASSWORD in \.env\.production\}/);
  assert.doesNotMatch(productionCompose, /6379:6379/);
  assertEnvEquals(productionEnv, "REDIS_PASSWORD", "change-me-strong-redis-password");
  assertEnvEquals(productionEnv, "REDIS_URL", "redis://:change-me-strong-redis-password@redis:6379");
  assertEnvEquals(backendProductionEnv, "REDIS_URL", "redis://:change-me-strong-redis-password@redis:6379");
  assertEnvEquals(productionEnv, "SOM_PRO_RATE_LIMIT_BACKING", "redis");
  assertEnvEquals(backendProductionEnv, "SOM_PRO_RATE_LIMIT_BACKING", "redis");
  assertEnvEquals(productionEnv, "SOM_FILE_UPLOAD_SCANNING_ENABLED", "true");
  assertEnvEquals(backendProductionEnv, "SOM_FILE_UPLOAD_SCANNING_ENABLED", "true");
  assertEnvMatches(productionEnv, "SOM_FILE_UPLOAD_SCANNER_URL", /^(tcp|clamav):\/\//);
  assertEnvMatches(backendProductionEnv, "SOM_FILE_UPLOAD_SCANNER_URL", /^(tcp|clamav):\/\//);
  assert.match(backendApp, /morgan\(env\.appEnv === "production" \? "combined" : "dev"\)/);
  assert.match(productionGuide, /لا تضف `ports: 5432:5432`/);
  assert.match(productionGuide, /127\.0\.0\.1:5432:5432/);
  assert.match(productionGuide, /docker compose --env-file \.env\.production -f docker-compose\.production\.yml/);
  assert.match(productionGuide, /up migrate/);
  assert.match(productionGuide, /لا يوجد rollback migration تلقائي/);
  assert.match(doctor, /SOM PRO install doctor/);
  assert.match(doctor, /initialServicesReady/);
  assert.match(doctor, /SKIP/);
  assert.match(doctor, /not needed because PostgreSQL and Redis are already reachable/);
  assert.match(doctor, /npm run setup:db/);
  assert.match(releaseCheck, /Alerting/);
  assert.match(releaseCheck, /Backup automation/);
  assert.match(releaseCheck, /Redundancy/);
  assert.match(releaseCheck, /Compliance/);
  assert.match(releaseCheck, /Destructive/);
  assert.match(localServices, /createLocalDataServices/);
  assert.match(databaseConfig, /resolveRuntimeDataConfig/);
  assert.match(complianceDoc, /GDPR/);
  assert.match(complianceDoc, /HIPAA/);
  assert.match(complianceDoc, /PCI-DSS/);
  assert.match(complianceDoc, /legal certification/i);
  assert.match(complianceDoc, /external review and approval/i);
  assert.match(externalReviewPack, /external privacy, security, and commercial review/i);
  assert.match(externalReviewPack, /ready for external review and approval/i);
  assert.match(retentionPolicy, /explicit, logged, school-scoped/i);
  assert.match(decisionLog, /compliance, security, or release readiness/i);
  assertEnvEquals(stagingEnv, "VITE_SOM_SHOW_OPERATOR_HEALTH", "true");
  assertEnvEquals(stagingEnv, "SOM_PRO_RATE_LIMIT_BACKING", "redis");
  assertEnvEquals(stagingEnv, "SOM_ENABLE_OPERATOR_HEALTH", "true");
  assertEnvEquals(stagingEnv, "SOM_AUTO_BACKUP_INTERVAL_HOURS", "24");
  assertEnvEquals(stagingEnv, "SOM_REDUNDANCY_MODE", "single-region");
  assertEnvMatches(stagingEnv, "SOM_REPLICA_DATABASE_URL", /^postgresql:\/\/replica_user/);
  assertEnvEquals(backendStagingEnv, "SOM_ENABLE_OPERATOR_HEALTH", "true");
  assertEnvEquals(backendStagingEnv, "SOM_PRO_RATE_LIMIT_BACKING", "redis");
  assertEnvEquals(backendStagingEnv, "SOM_REDUNDANCY_MODE", "single-region");
  assertEnvEquals(frontendStagingEnv, "VITE_SOM_SHOW_OPERATOR_HEALTH", "true");
  assert.match(operatorHealthTypes, /backupPolicy/);
  assert.match(operatorHealthTypes, /redundancy/);
  assert.match(operatorHealthPage, /Alerting/);
  assert.match(operatorHealthPage, /Redundancy \/ failover/);
}

function assertLicenseServerSecurityControls() {
  const source = readRepoFile("apps/license-server/src/server.js");
  const runtime = readRepoFile("apps/license-server/src/runtime.js");
  const store = readRepoFile("apps/license-server/src/store.js");
  const db = readRepoFile("apps/license-server/src/db.js");
  const routes = readRepoFile("apps/license-server/src/routes/index.js");
  const productionEnv = parseEnvFile(readRepoFile("apps/license-server/.env.production.example"));

  assert.match(source, /LICENSE_ADMIN_TOKEN is required in production/);
  assert.match(source, /LICENSE_ADMIN_TOKEN must be at least 32 characters/);
  assert.match(source, /disconnectLicenseServerDb/);
  assert.match(db, /new PrismaClient\(/);
  assert.match(store, /prisma\.licenseActivation/);
  assert.match(runtime, /crypto\.timingSafeEqual/);
  assert.match(runtime, /MAX_BODY_BYTES/);
  assert.match(source, /BODY_TOO_LARGE/);
  assert.match(runtime, /RATE_LIMITS/);
  assert.match(routes, /RATE_LIMITED/);
  assert.match(runtime, /X-Content-Type-Options/);
  assert.match(runtime, /Content-Security-Policy/);
  assert.doesNotMatch(source, /"Access-Control-Allow-Origin": "\*"/);
  assert.doesNotMatch(runtime, /LICENSE_DATA_FILE|LICENSE_ACCOUNTS_FILE|LICENSE_RESET_TOKENS_FILE|LICENSE_SECURITY_EVENTS_FILE|TOKEN_FILE/);
  assert.doesNotMatch(store, /readDb\(|writeDb\(|LICENSE_DATA_FILE|LICENSE_ACCOUNTS_FILE|LICENSE_RESET_TOKENS_FILE|LICENSE_SECURITY_EVENTS_FILE/);
  assertEnvEquals(productionEnv, "LICENSE_ADMIN_TOKEN", "change-me-long-random-owner-token");
  assertEnvEquals(productionEnv, "LICENSE_REQUEST_BACKING", "redis");
  assertEnvMatches(productionEnv, "LICENSE_REDIS_URL", /^redis:\/\/:/);
}

function assertFrontendLocalPersistencePolicy() {
  const loginHook = readRepoFile("apps/frontend/src/features/auth/useLogin.ts");
  const gradeDraft = readRepoFile("apps/frontend/src/features/students/gradeEntryDraft.ts");
  const i18nProvider = readRepoFile("apps/frontend/src/i18n/i18n.tsx");
  const browserStorage = readRepoFile("apps/frontend/src/lib/browserStorage.ts");
  const httpApi = readRepoFile("apps/frontend/src/api/http.ts");
  const authTokenStorage = readRepoFile("apps/frontend/src/lib/authTokenStorage.ts");

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
  assert.match(httpApi, /authTokenStorage/);
  assert.doesNotMatch(httpApi, /localStorage\.setItem|sessionStorage\.setItem|readStoredValue|writeStoredValue|removeStoredValue/);
  assert.match(authTokenStorage, /sessionStorage/);
  assert.match(authTokenStorage, /writeStoredValue\("sessionStorage"/);
  assert.match(authTokenStorage, /migrateLegacyAuthToken/);
  assert.match(authTokenStorage, /removeStoredValue\("localStorage"/);
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
    "apps/backend/src/modules/teachers/teachers.routes.ts",
    "apps/backend/src/modules/classes/classes.routes.ts",
    "apps/backend/src/modules/subjects/subjects.routes.ts",
    "apps/backend/src/modules/settings/settings.routes.ts",
    "apps/backend/src/modules/schedules/schedules.routes.ts",
    "apps/backend/src/modules/daily/daily.routes.ts",
    "apps/backend/src/modules/lessons/exams.routes.ts",
    "apps/backend/src/modules/archive/archive.routes.ts",
    "apps/backend/src/modules/auditLogs/auditLogs.routes.ts",
    "apps/backend/src/modules/reports/reports.routes.ts",
    "apps/backend/src/modules/homeroom/homeroom.routes.ts",
    "apps/backend/src/modules/duties/duties.routes.ts",
    "apps/backend/src/modules/stats.routes.ts"
  ];

  for (const file of routeFiles) {
    const source = readRepoFile(file);
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
  const source = readRepoFile("apps/frontend/src/i18n/displayNames.ts");
  assert.match(source, /الأحد/);
  assert.match(source, /الخميس/);
});
test("remember login stays in memory and does not use browser storage", () => {
  const source = readRepoFile("apps/frontend/src/features/auth/useLogin.ts");
  assert.doesNotMatch(source, /REMEMBER_LOGIN_KEY/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|writeStoredJson|readStoredJson|removeStoredValue/);
  assert.match(source, /rememberedLoginEmail/);
  assert.match(source, /rememberedLoginEnabled/);
  assert.match(source, /setEmail/);
  const callStart = source.indexOf("saveRememberedLogin({");
  assert.equal(callStart, -1);
});

test("daily export helper uses readable Arabic errors", () => {
  const source = readRepoFile("apps/frontend/src/features/daily/dailyHelpers.ts");
  assert.match(source, /تعذر العثور على القسم المطلوب للتصدير/);
  assert.doesNotMatch(source, /\?\? \?\?\?/);
});
test("frontend connection errors are readable Arabic and not mojibake", () => {
  const source = readRepoFile("apps/frontend/src/api/http.ts");
  assert.match(source, /تعذر الاتصال بخادم البرنامج المحلي/);
  assert.match(source, /حدث خطأ في الاتصال بالخادم/);
  assert.doesNotMatch(source, /Ø|Ù|Ã|â€/);
});

test("local services startup script normalizes project root before use", () => {
  const source = readRepoFile("scripts/start-sompro-local-services.ps1");
  assert.match(source, /function Normalize-ProjectRoot/);
  assert.match(source, /Resolve-Path -LiteralPath \$clean/);
  assert.match(source, /Test-Path -LiteralPath \$ProjectRoot/);
  assert.match(source, /Add-Content -LiteralPath \$ServiceLog/);
  assert.doesNotMatch(source, /GetFullPath\(\$ProjectRoot\)/);
});
test("offline page has a repair connection action", () => {
  const offline = readRepoFile("apps/desktop/offline.html");
  const preload = readRepoFile("apps/desktop/preload.js");
  const windowSource = readRepoFile("apps/desktop/src/window.js");
  assert.match(offline, /إصلاح الاتصال وإعادة المحاولة/);
  assert.match(offline, /repairConnection/);
  assert.match(preload, /repairConnection/);
  assert.match(windowSource, /som-repair-local-services/);
  assert.doesNotMatch(offline, /Ø|Ù|Ã|â€/);
});
test("desktop trial waits for local backend before loading the app", () => {
  const source = readRepoFile("apps/desktop/src/window.js");
  assert.match(source, /const backendReady = runtimeConfig\.isSaas \? true : await waitForLocalBackend\(1, 8000\);/);
  assert.match(source, /if \(!backendReady\) \{/);
  assert.match(source, /ensureLocalBackend\(\)\.catch\(\(\) => false\);/);
  assert.match(source, /const localBackendMonitor = setInterval/);
  assert.match(source, /offline\.html/);
});

test("duty page and daily schedule expose affected duties", () => {
  const schema = readRepoFile("apps/backend/prisma/schema.prisma");
  const app = readRepoFile("apps/backend/src/app.ts");
  const dutiesRoute = readRepoFile("apps/backend/src/modules/duties/duties.routes.ts");
  const dutyService = readRepoFile("apps/backend/src/services/dutySchedule.ts");
  const dailyCoordinator = readRepoFile("apps/backend/src/services/scheduleCoordinator.ts");
  const frontendPage = readRepoFile("apps/frontend/src/pages/duties/DutiesPage.tsx");
  const dailyPage = readRepoFile("apps/frontend/src/pages/daily/DailyPage.tsx");

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
  const schema = readRepoFile("apps/backend/prisma/schema.prisma");

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
  const source = readRepoFile("apps/backend/src/modules/teachers/teachers.routes.ts");

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
  const source = readRepoFile("apps/backend/src/modules/teachers/teachers.routes.ts");

  assert.match(source, /teachersRouter\.delete\("\/:id\/assignments\/:assignmentId"/);
  assert.match(source, /baseScheduleSlot\.deleteMany\(\{/);
  assert.match(source, /teacherAssignment\.delete\(\{ where: \{ id: assignment\.id \} \}\)/);
  assert.match(source, /TEACHER_ASSIGNMENT_DELETE_FAILED/);
});

test("scheduler users can access only schedule operation pages in the frontend", () => {
  const pageAccess = readRepoFile("apps/frontend/src/app/pageAccess.ts");
  const accessTest = readRepoFile("apps/frontend/src/app/pageAccess.test.mjs");
  const browserMatrix = readRepoFile("tests/e2e/playwright/role-navigation-matrix.spec.js");
  const appSource = readRepoFile("apps/frontend/src/app/main.tsx");
  const layoutSource = readRepoFile("apps/frontend/src/components/layout/Layout.tsx");
  const css = readRepoFile("apps/frontend/src/styles/layout.css");

  assert.match(pageAccess, /schedulerAllowedPages:\s*PageKey\[\]\s*=\s*\["daily", "homeroom", "duties"\]/);
  assert.match(pageAccess, /allowedPagesForRole\(role\)/);
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
  assert.match(browserMatrix, /nav-security-monitoring/);
  assert.match(accessTest, /developer tools or license/);
});
test("users page exposes supported account types through i18n", () => {
  const pageSource = readRepoFile("apps/frontend/src/pages/users/UsersPage.tsx");
  const hookSource = readRepoFile("apps/frontend/src/features/users/useUsers.ts");
  const formSource = readRepoFile("apps/frontend/src/features/users/UsersFormPanel.tsx");
  const routeSource = readRepoFile("apps/backend/src/modules/settings/settings.routes.ts");
  const enDict = readRepoFile("apps/frontend/src/i18n/dictionaries/en.ts");
  const heDict = readRepoFile("apps/frontend/src/i18n/dictionaries/he.ts");
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
  assert.match(heDict, /buildReviewedLocaleDictionary\(en, "he"\)/);
  assert.match(routeSource, /ADMIN: "admin"/);
  assert.match(routeSource, /SCHEDULER: "scheduler"/);
  assert.doesNotMatch(routeSource, /"MANAGER"/);
});
test("users page uses generated usernames by role", () => {
  const routeSource = readRepoFile("apps/backend/src/modules/settings/settings.routes.ts");
  assert.match(routeSource, /\/users\/suggest-username/);
  assert.match(routeSource, /ADMIN: "admin"/);
  assert.match(routeSource, /SCHEDULER: "scheduler"/);
  assert.match(routeSource, /const base = `\$\{prefix\}\$\{schoolPart\}`/);
  assert.match(routeSource, /USERNAME_EXISTS/);

  const hookSource = readRepoFile("apps/frontend/src/features/users/useUsers.ts");
  const formSource = readRepoFile("apps/frontend/src/features/users/UsersFormPanel.tsx");
  assert.match(hookSource, /somApi\.settings\.suggestUsername/);
  assert.match(formSource, /const role = e\.target\.value as UserRole/);
  assert.match(formSource, /suggestUsername\(role\)/);
  assert.match(formSource, /saving \? labels\.saving : labels\.add/);
});

test("users page focus styling does not grow focused inputs", () => {
  const css = readRepoFile("apps/frontend/src/styles/global.css");
  assert.match(css, /\.users-page input:focus/);
  assert.match(css, /outline: 0/);
  assert.match(css, /box-shadow: 0 0 0 3px/);
  assert.match(css, /box-sizing: border-box/);
});

test("teachers page stays clean from dead weekly-load comments", () => {
  const source = readRepoFile("apps/frontend/src/pages/teachers/TeachersPage.tsx");
  assert.doesNotMatch(source, /BaseScheduleSlotWithDetails/);
  assert.doesNotMatch(source, /DailyScheduleSummary/);
  assert.doesNotMatch(source, /useState<any/);
  assert.doesNotMatch(source, /\(s: any\)/);
});
test("login page requires license code and removes password recovery flow", () => {
  const source = readRepoFile("apps/frontend/src/features/auth/useLogin.ts");
  const pageSource = readRepoFile("apps/frontend/src/pages/auth/LoginPage.tsx");
  assert.match(source, /missingLicense/);
  assert.match(source, /somApi\.auth\.login\(email, password, enteredLicense\)/);
  assert.match(source, /normalizeCode\(enteredLicense\) !== normalizeCode\(setupLicenseCode\)/);
  assert.match(source, /createCardHelp/);
  assert.doesNotMatch(source, /recoverCode|recoverAccess|showRecover|forgot-button|somApi\.auth\.recover/);
  assert.doesNotMatch(source, /bootstrapLicense\(enteredLicense\)/);
  assert.doesNotMatch(pageSource, /نسيت اسم المستخدم|استعادة|توليد كلمة مرور/);
});

test("auth and license routes apply multipart rejection and rate limiting", () => {
  const authRoutes = readRepoFile("apps/backend/src/modules/auth/auth.routes.ts");
  const licenseRoutes = readRepoFile("apps/backend/src/modules/license/license.routes.ts");
  const reportRoutes = readRepoFile("apps/backend/src/modules/reports/reports.routes.ts");
  const archiveRoutes = readRepoFile("apps/backend/src/modules/archive/archive.routes.ts");
  const auditLogsRoutes = readRepoFile("apps/backend/src/modules/auditLogs/auditLogs.routes.ts");
  const securityIncidentsRoutes = readRepoFile("apps/backend/src/modules/securityIncidents/securityIncidents.routes.ts");
  const appSource = readRepoFile("apps/backend/src/app.ts");
  const requestProtections = readRepoFile("apps/backend/src/middleware/requestProtections.ts");
  const schema = readRepoFile("apps/backend/prisma/schema.prisma");

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
  const securityExport = readRepoFile("apps/backend/src/services/securityEventExport.ts");
  assert.match(securityExport, /exportSecurityEventsAsJsonl/);
  assert.match(securityExport, /SecurityEventExporter/);
  assert.match(requestProtections, /rejectSchoolContextOverride/);
  assert.match(requestProtections, /schoolId/);
  assert.match(requestProtections, /school_id/);
  assert.match(schema, /model SecurityIncident/);
  assert.match(schema, /enum SecurityIncidentSeverity/);
  assert.match(schema, /enum SecurityIncidentStatus/);
  const incidentPolicy = readRepoFile("docs/INCIDENT_RESPONSE_POLICY.md");
  const securityTesting = readRepoFile("docs/SECURITY_TESTING.md");
  const owaspChecklist = readRepoFile("docs/OWASP_CHECKLIST_AR.md");
  assert.match(incidentPolicy, /Incident Response Policy/);
  assert.match(securityTesting, /Security Testing and SSDLC/);
  assert.match(owaspChecklist, /OWASP/);
});

test("student routes apply explicit write permissions while public auth routes stay narrow", () => {
  const studentsRoutes = readRepoFile("apps/backend/src/modules/students/students.routes.ts");
  const authRoutes = readRepoFile("apps/backend/src/modules/auth/auth.routes.ts");
  const licenseRoutes = readRepoFile("apps/backend/src/modules/license/license.routes.ts");
  const teachersRoutes = readRepoFile("apps/backend/src/modules/teachers/teachers.routes.ts");
  const classesRoutes = readRepoFile("apps/backend/src/modules/classes/classes.routes.ts");
  const dailyRoutes = readRepoFile("apps/backend/src/modules/daily/daily.routes.ts");

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
  const source = readRepoFile("apps/backend/prisma/seed.ts");
  assert.match(source, /مدرسة جديدة/);
  assert.match(source, /schoolSettings\.upsert/);
  assert.doesNotMatch(source, /teacherProfiles|baseScheduleSlots|teacherAssignments|homeroomDefaults/);
  assert.doesNotMatch(
    source,
    /dailySchedule\.deleteMany|baseScheduleSlot\.deleteMany|teacherAssignment\.deleteMany|homeroomAssignment\.deleteMany/
  );
  assert.doesNotMatch(source, /أحمد سامح|SEED_MVP6_DATA|20 teachers/);
});

test("commercial install database checks are explicit and local-only by default", () => {
  assertCommercialInstallDependencies();
});

test("license server keeps production security controls in place", () => {
  assertLicenseServerSecurityControls();
});

test("trial license creation tolerates concurrent first-load requests", () => {
  const source = readRepoFile("apps/backend/src/services/licenseRepository.ts");
  assert.match(source, /catch \(error\)/);
  assert.match(source, /code !== "P2002"/);
  assert.match(source, /findUnique\(\{ where: \{ licenseKeyHash \} \}\)/);
});

test("role coverage matches every supported user role", () => {
  const pageAccess = readRepoFile("apps/frontend/src/app/pageAccess.ts");
  const browserMatrix = readRepoFile("tests/e2e/playwright/role-navigation-matrix.spec.js");
  const accessTest = readRepoFile("apps/frontend/src/app/pageAccess.test.mjs");

  for (const role of ["ADMIN", "MANAGER", "SCHEDULER", "TEACHER", "STUDENT", "PARENT"]) {
    assert.match(browserMatrix, new RegExp(`role: "${role}"`));
  }
  assert.match(pageAccess, /schedulerAllowedPages/);
  assert.doesNotMatch(pageAccess, /DEVELOPER:/);
  assert.match(browserMatrix, /nav-security-monitoring/);
  assert.match(accessTest, /developer tools or license/);
});

test("hebrew locale and layout are configured for RTL rendering", () => {
  const indexHtml = readRepoFile("apps/frontend/index.html");
  const localeRegistry = readRepoFile("apps/frontend/src/i18n/localeRegistry.ts");
  const i18nProvider = readRepoFile("apps/frontend/src/i18n/i18n.tsx");

  assert.match(indexHtml, /<html lang="ar" dir="rtl">/);
  assert.match(localeRegistry, /if \(code === "he"\) return \{ code, label: .* dir: "rtl" \};/s);
  assert.match(localeRegistry, /dir: /);
  assert.match(i18nProvider, /document\.documentElement\.dir = option\.dir;/);
  assert.match(i18nProvider, /document\.body\.dir = option\.dir;/);
});

test("the MVP intentionally excludes AI features", () => {
  const readme = readRepoFile("README.md");
  const saleReport = readRepoFile("SALE_READINESS_REPORT.md");

  assert.match(readme, /includes no AI features/i);
  assert.match(saleReport, /No AI features are included in the MVP/i);
});

test("local persistence stays limited to non-sensitive preferences", () => {
  assertFrontendLocalPersistencePolicy();
});

test("daily page reloads statuses per selected date instead of carrying them to another day", () => {
  const source = readRepoFile("apps/frontend/src/features/daily/useDailySchedule.ts");
  assert.match(source, /somApi\.daily\.get\(date\)/);
  assert.match(source, /setStatuses\(mapStatuses\(normalized\?\.statuses \|\| \[\]\)\)/);
  assert.match(source, /setStatuses\(\[\]\)/);
  assert.match(source, /setResult\(null\)/);
});
test("school settings preserve saved period labels and times", () => {
  const settingsService = readRepoFile("apps/backend/src/services/schoolSettings.ts");
  const settingsRoutes = readRepoFile("apps/backend/src/modules/settings/settings.routes.ts");

  assert.match(settingsService, /data: \{ isActive: true \}/);
  assert.match(settingsRoutes, /data: \{ isActive: true \}/);
  assert.doesNotMatch(settingsService, /update: \{ isActive: true, label/);
  assert.doesNotMatch(settingsRoutes, /update: \{ isActive: true, label/);
  assert.match(settingsRoutes, /periodDefinition\.updateMany/);
  assert.match(settingsRoutes, /period: \{ gt: settings\.periodsPerDay \}/);
});

test("base and daily schedules follow current school working days and periods", () => {
  const schedulesRoute = readRepoFile("apps/backend/src/modules/schedules/schedules.routes.ts");
  const schedulesEditing = readRepoFile("apps/backend/src/services/scheduleEditing.ts");
  const dailyCoordinator = readRepoFile("apps/backend/src/services/scheduleCoordinator.ts");
  const substitutionEngine = readRepoFile("apps/backend/src/services/substitutionEngine.ts");
  const teacherPrograms = readRepoFile("apps/backend/src/services/teacherDailyPrograms.ts");

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
  const source = readRepoFile("apps/backend/src/services/scheduleCoordinator.ts");

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
  const source = readRepoFile("apps/frontend/src/i18n/displayNames.ts");
  const settingsPage = readRepoFile("apps/frontend/src/pages/settings/SettingsPage.tsx");
  assert.match(source, /"السبت": \{ en: "Saturday", he: "שבת" \}/);
  assert.match(source, /"الاثنين": \{ en: "Monday", he: "שני" \}/);
  assert.match(source, /"الخميس": \{ en: "Thursday", he: "חמישי" \}/);
  assert.match(settingsPage, /localizeDay\(day, language\)/);
});
