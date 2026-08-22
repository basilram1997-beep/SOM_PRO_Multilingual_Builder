const path = require("node:path");
const dotenv = require("dotenv");
const { PrismaClient } = require("@prisma/client");

dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", "apps", "backend", ".env"), override: false });

const prisma = new PrismaClient();
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://som_user:som_password@127.0.0.1:5432/som?schema=public";
const patterns = ["demo", "trial", "stress", "perf", "e2e", "runtime", "tmp"];

function assertLocalDatabase() {
  const url = new URL(DATABASE_URL);
  const localHosts = new Set(["localhost", "127.0.0.1", "postgres", "sompro_postgres"]);
  if (!localHosts.has(url.hostname)) {
    throw new Error(`Refusing to delete experimental schools from non-local database host "${url.hostname}".`);
  }
}

function matchesExperimentalSchool(value) {
  const text = String(value || "").toLowerCase();
  return patterns.some((pattern) => text.includes(pattern));
}

async function deleteMany(modelName, where) {
  await prisma[modelName].deleteMany({ where }).catch(() => null);
}

async function cleanupSchool(schoolId) {
  const deleteOrder = [
    "rolePermission",
    "userRoleAssignment",
    "parentStudentLink",
    "reportExport",
    "backupJob",
    "securityIncident",
    "auditLog",
    "studentNotification",
    "studentCertificate",
    "studentGradeEntry",
    "studentGradeScheme",
    "studentAttendance",
    "studentBehaviorRecord",
    "studentAcademicRecord",
    "teacherHomeworkSubmission",
    "teacherHomework",
    "teacherExam",
    "teacherLessonToday",
    "dailyEvent",
    "substitution",
    "dailyTeacherStatus",
    "dailySchedule",
    "lesson",
    "attendanceRecord",
    "gradeRecord",
    "classroomLog",
    "teacherAssignment",
    "teacherSubject",
    "baseScheduleSlot",
    "homeroomAssignment",
    "dutyAssignment",
    "schoolClass",
    "student",
    "teacher",
    "subject",
    "periodDefinition",
    "schoolSettings",
    "user",
    "role",
    "licenseActivation"
  ];

  for (let pass = 0; pass < 3; pass += 1) {
    for (const modelName of deleteOrder) {
      await deleteMany(modelName, { schoolId });
    }
  }

  await prisma.school.deleteMany({ where: { id: schoolId } });
}

async function main() {
  assertLocalDatabase();

  const schools = await prisma.school.findMany({
    select: { id: true, name: true, institutionCode: true, managerName: true }
  });
  const targets = schools
    .filter(
      (school) =>
        matchesExperimentalSchool(school.id) ||
        matchesExperimentalSchool(school.name) ||
        matchesExperimentalSchool(school.institutionCode) ||
        matchesExperimentalSchool(school.managerName)
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  const targetIds = targets.map((school) => school.id);

  console.log(`[SOM PRO] Experimental schools found: ${targets.length}`);
  console.log(JSON.stringify(targets, null, 2));

  const deleteOrder = [
    "rolePermission",
    "userRoleAssignment",
    "parentStudentLink",
    "reportExport",
    "backupJob",
    "securityIncident",
    "auditLog",
    "studentNotification",
    "studentCertificate",
    "studentGradeEntry",
    "studentGradeScheme",
    "studentAttendance",
    "studentBehaviorRecord",
    "studentAcademicRecord",
    "teacherHomeworkSubmission",
    "teacherHomework",
    "teacherExam",
    "teacherLessonToday",
    "attendanceRecord",
    "gradeRecord",
    "classroomLog",
    "teacherAssignment",
    "teacherSubject",
    "baseScheduleSlot",
    "homeroomAssignment",
    "dutyAssignment",
    "dailyEvent",
    "substitution",
    "dailyTeacherStatus",
    "lesson",
    "dailySchedule",
    "student",
    "teacher",
    "subject",
    "schoolClass",
    "periodDefinition",
    "schoolSettings",
    "user",
    "role",
    "licenseActivation"
  ];

  for (let pass = 0; pass < 3; pass += 1) {
    for (const modelName of deleteOrder) {
      await deleteMany(modelName, { schoolId: { in: targetIds } });
    }
  }

  await prisma.school.deleteMany({ where: { id: { in: targetIds } } });

  const remaining = await prisma.school.count({
    where: {
      OR: patterns.flatMap((pattern) => [
        { id: { contains: pattern, mode: "insensitive" } },
        { name: { contains: pattern, mode: "insensitive" } },
        { institutionCode: { contains: pattern, mode: "insensitive" } },
        { managerName: { contains: pattern, mode: "insensitive" } }
      ])
    }
  });

  console.log(`[SOM PRO] Remaining experimental schools: ${remaining}`);
  console.log("[SOM PRO] Experimental cleanup completed.");
}

main()
  .catch((failure) => {
    console.error(failure instanceof Error ? failure.stack || failure.message : failure);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
