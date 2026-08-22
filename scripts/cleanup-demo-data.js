const path = require("node:path");
const dotenv = require("dotenv");
const { PrismaClient } = require("@prisma/client");

dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", "apps", "backend", ".env"), override: false });

const prisma = new PrismaClient();
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://som_user:som_password@127.0.0.1:5432/som?schema=public";
const demoSchoolIds = [
  process.env.DEMO_PORTAL_SCHOOL_ID || "demo-portal-school",
  process.env.DEMO_CERTIFICATE_SCHOOL_ID || "demo-certificate-school"
];

function assertLocalDatabase() {
  const url = new URL(DATABASE_URL);
  const localHosts = new Set(["localhost", "127.0.0.1", "postgres", "sompro_postgres"]);
  if (!localHosts.has(url.hostname)) {
    throw new Error(`Refusing to delete demo data from non-local database host "${url.hostname}".`);
  }
}

async function deleteMany(modelName, where) {
  await prisma[modelName].deleteMany({ where }).catch(() => null);
}

async function cleanupSchool(schoolId) {
  const before = {
    school: await prisma.school.count({ where: { id: schoolId } }),
    schoolSettings: await prisma.schoolSettings.count({ where: { schoolId } }),
    teacher: await prisma.teacher.count({ where: { schoolId } }),
    class: await prisma.schoolClass.count({ where: { schoolId } }),
    subject: await prisma.subject.count({ where: { schoolId } }),
    assignment: await prisma.teacherAssignment.count({ where: { schoolId } }),
    student: await prisma.student.count({ where: { schoolId } }),
    gradeScheme: await prisma.studentGradeScheme.count({ where: { schoolId } }),
    gradeEntry: await prisma.studentGradeEntry.count({ where: { schoolId } }),
    attendance: await prisma.studentAttendance.count({ where: { schoolId } }),
    behavior: await prisma.studentBehaviorRecord.count({ where: { schoolId } }),
    certificate: await prisma.studentCertificate.count({ where: { schoolId } }),
    user: await prisma.user.count({ where: { schoolId } })
  };

  const deleteOrder = [
    "reportExport",
    "backupJob",
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
    "securityIncident",
    "licenseActivation"
  ];

  for (const modelName of deleteOrder) {
    await prisma[modelName].deleteMany({ where: { schoolId } }).catch(() => null);
  }

  const blockers = {
    schoolClass: await prisma.schoolClass.count({ where: { schoolId } }),
    teacherAssignment: await prisma.teacherAssignment.count({ where: { schoolId } }),
    teacherSubject: await prisma.teacherSubject.count({ where: { schoolId } }),
    baseScheduleSlot: await prisma.baseScheduleSlot.count({ where: { schoolId } }),
    homeroomAssignment: await prisma.homeroomAssignment.count({ where: { schoolId } }),
    dutyAssignment: await prisma.dutyAssignment.count({ where: { schoolId } }),
    teacherLessonToday: await prisma.teacherLessonToday.count({ where: { schoolId } }),
    teacherHomework: await prisma.teacherHomework.count({ where: { schoolId } }),
    teacherHomeworkSubmission: await prisma.teacherHomeworkSubmission.count({ where: { schoolId } }),
    teacherExam: await prisma.teacherExam.count({ where: { schoolId } }),
    lesson: await prisma.lesson.count({ where: { schoolId } }),
    attendanceRecord: await prisma.attendanceRecord.count({ where: { schoolId } }),
    gradeRecord: await prisma.gradeRecord.count({ where: { schoolId } }),
    classroomLog: await prisma.classroomLog.count({ where: { schoolId } })
  };

  console.log(`[SOM PRO] Remaining class blockers for ${schoolId}:`, blockers);

  await prisma.school.deleteMany({ where: { id: schoolId } });

  const after = {
    school: await prisma.school.count({ where: { id: schoolId } }),
    schoolSettings: await prisma.schoolSettings.count({ where: { schoolId } }),
    teacher: await prisma.teacher.count({ where: { schoolId } }),
    class: await prisma.schoolClass.count({ where: { schoolId } }),
    subject: await prisma.subject.count({ where: { schoolId } }),
    assignment: await prisma.teacherAssignment.count({ where: { schoolId } }),
    student: await prisma.student.count({ where: { schoolId } }),
    gradeScheme: await prisma.studentGradeScheme.count({ where: { schoolId } }),
    gradeEntry: await prisma.studentGradeEntry.count({ where: { schoolId } }),
    attendance: await prisma.studentAttendance.count({ where: { schoolId } }),
    behavior: await prisma.studentBehaviorRecord.count({ where: { schoolId } }),
    certificate: await prisma.studentCertificate.count({ where: { schoolId } }),
    user: await prisma.user.count({ where: { schoolId } })
  };

  return { schoolId, before, after };
}

async function main() {
  assertLocalDatabase();

  const results = [];
  for (const schoolId of demoSchoolIds) {
    results.push(await cleanupSchool(schoolId));
  }

  console.log("[SOM PRO] Demo data removed");
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((failure) => {
    console.error(failure instanceof Error ? failure.stack || failure.message : failure);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
