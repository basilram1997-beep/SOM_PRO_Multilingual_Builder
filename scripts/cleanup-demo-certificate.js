const path = require("node:path");
const dotenv = require("dotenv");
const { PrismaClient } = require("@prisma/client");

dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", "apps", "backend", ".env"), override: false });

const prisma = new PrismaClient();
const schoolId = process.env.DEMO_CERTIFICATE_SCHOOL_ID || "demo-certificate-school";
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://som_user:som_password@127.0.0.1:5432/som?schema=public";

function assertLocalDatabase() {
  const url = new URL(DATABASE_URL);
  const localHosts = new Set(["localhost", "127.0.0.1", "postgres", "sompro_postgres"]);
  if (!localHosts.has(url.hostname)) {
    throw new Error(
      `Refusing to delete demo certificate data from non-local database host "${url.hostname}".`
    );
  }
}

async function main() {
  assertLocalDatabase();

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

  await prisma.$transaction(async (tx) => {
    await tx.teacherAssignment.deleteMany({ where: { schoolId } });
    await tx.studentCertificate.deleteMany({ where: { schoolId } });
    await tx.studentGradeEntry.deleteMany({ where: { schoolId } });
    await tx.studentGradeScheme.deleteMany({ where: { schoolId } });
    await tx.studentAttendance.deleteMany({ where: { schoolId } });
    await tx.studentBehaviorRecord.deleteMany({ where: { schoolId } });
    await tx.student.deleteMany({ where: { schoolId } });
    await tx.schoolClass.deleteMany({ where: { schoolId } });
    await tx.teacher.deleteMany({ where: { schoolId } });
    await tx.subject.deleteMany({ where: { schoolId } });
    await tx.schoolSettings.deleteMany({ where: { schoolId } });
    await tx.user.deleteMany({ where: { schoolId } });
    await tx.school.deleteMany({ where: { id: schoolId } });
  });

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

  console.log("[SOM PRO] Demo certificate data removed");
  console.log(JSON.stringify({ schoolId, before, after }, null, 2));
}

main()
  .catch((failure) => {
    console.error(failure instanceof Error ? failure.stack || failure.message : failure);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect().catch(() => null));
