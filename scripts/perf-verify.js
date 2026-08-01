require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { parseArgs } = require("node:util");

const prisma = new PrismaClient();

const PROFILES = {
  tiny: {
    teachers: 8,
    classes: 4,
    subjects: 6,
    students: 40,
    attendance: 120,
    grades: 320,
    certificates: 80,
    notifications: 200,
    auditLogs: 400,
    dailySchedules: 30
  },
  high: {
    teachers: 500,
    classes: 300,
    subjects: 40,
    students: 10000,
    attendance: 100000,
    grades: 500000,
    certificates: 50000,
    notifications: 100000,
    auditLogs: 250000,
    dailySchedules: 365
  },
  strong: {
    teachers: 2000,
    classes: 800,
    subjects: 60,
    students: 50000,
    attendance: 500000,
    grades: 1000000,
    certificates: 250000,
    notifications: 500000,
    auditLogs: 1000000,
    dailySchedules: 365
  }
};

function trace(message, details) {
  if (details === undefined) {
    console.log(`[${new Date().toISOString()}] ${message}`);
    return;
  }
  console.log(`[${new Date().toISOString()}] ${message}`, details);
}

function sanitizeRunId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function isLocalDatabaseUrl(url) {
  return !url || /localhost|127\.0\.0\.1|sqlite:/i.test(url);
}

function buildCounts(profileName) {
  return PROFILES[profileName] || PROFILES.high;
}

function fail(message) {
  throw new Error(message);
}

async function main() {
  const { values } = parseArgs({
    options: {
      profile: { type: "string" },
      datasetSize: { type: "string" },
      runId: { type: "string" },
      help: { type: "boolean", short: "h" }
    }
  });

  if (values.help) {
    console.log(
      "Usage: node scripts/perf-verify.js --runId=RUN_ID [--profile=tiny|high|strong] [--datasetSize=tiny|high|strong]"
    );
    return;
  }

  const runIdRaw = values.runId || process.env.PERF_RUN_ID;
  if (!runIdRaw) fail("PERF_RUN_ID is required for verification.");
  const runKey = sanitizeRunId(runIdRaw);
  if (!runKey) fail("PERF_RUN_ID must contain at least one alphanumeric character.");

  const profileName = String(
    values.datasetSize || values.profile || process.env.PERF_DATASET_SIZE || process.env.PERF_PROFILE || "high"
  ).toLowerCase();
  if (
    profileName === "strong" &&
    isLocalDatabaseUrl(process.env.DATABASE_URL) &&
    process.env.PERF_ALLOW_STRONG_LOCAL_DB !== "1"
  ) {
    fail(
      "Strong performance seeding must run on a separate perf/staging database, not the local development database."
    );
  }

  const schoolId = `perf-${runKey}`;
  const expected = buildCounts(profileName);

  const counts = {
    school: await prisma.school.count({ where: { id: schoolId } }),
    teachers: await prisma.teacher.count({ where: { schoolId } }),
    classes: await prisma.schoolClass.count({ where: { schoolId } }),
    subjects: await prisma.subject.count({ where: { schoolId } }),
    students: await prisma.student.count({ where: { schoolId } }),
    attendance: await prisma.studentAttendance.count({ where: { schoolId } }),
    grades: await prisma.gradeRecord.count({ where: { schoolId } }),
    certificates: await prisma.studentCertificate.count({ where: { schoolId } }),
    notifications: await prisma.studentNotification.count({ where: { schoolId } }),
    auditLogs: await prisma.auditLog.count({ where: { schoolId } }),
    dailySchedules: await prisma.dailySchedule.count({ where: { schoolId } })
  };

  trace("perf verify counts", { schoolId, profile: profileName, expected, counts });

  if (!counts.school) fail(`Missing perf school ${schoolId}`);
  if (counts.teachers < expected.teachers)
    fail(`Expected at least ${expected.teachers} teachers, found ${counts.teachers}`);
  if (counts.classes < expected.classes) fail(`Expected at least ${expected.classes} classes, found ${counts.classes}`);
  if (counts.subjects < expected.subjects)
    fail(`Expected at least ${expected.subjects} subjects, found ${counts.subjects}`);
  if (counts.students < expected.students)
    fail(`Expected at least ${expected.students} students, found ${counts.students}`);
  if (counts.attendance < expected.attendance)
    fail(`Expected at least ${expected.attendance} attendance rows, found ${counts.attendance}`);
  if (counts.grades < expected.grades) fail(`Expected at least ${expected.grades} grades, found ${counts.grades}`);
  if (counts.certificates < expected.certificates)
    fail(`Expected at least ${expected.certificates} certificates, found ${counts.certificates}`);
  if (counts.notifications < expected.notifications)
    fail(`Expected at least ${expected.notifications} notifications, found ${counts.notifications}`);
  if (counts.auditLogs < expected.auditLogs)
    fail(`Expected at least ${expected.auditLogs} audit logs, found ${counts.auditLogs}`);
  if (counts.dailySchedules < expected.dailySchedules)
    fail(`Expected at least ${expected.dailySchedules} daily schedules, found ${counts.dailySchedules}`);

  console.log("perf verify completed");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
