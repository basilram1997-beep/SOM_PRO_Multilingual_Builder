import { prisma } from "../src/db/prisma";
import { logSafeError } from "../src/lib/safeLog";

const schoolId = "default-school";

const defaultWorkingDays = ["السبت", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
const defaultOffDays = ["الأحد", "الجمعة"];
const defaultPeriods = [
  { period: 1, label: "الحصة 1", startTime: "08:10", endTime: "09:00" },
  { period: 2, label: "الحصة 2", startTime: "09:00", endTime: "09:50" },
  { period: 3, label: "الحصة 3", startTime: "09:50", endTime: "10:35" },
  { period: 4, label: "الحصة 4", startTime: "11:00", endTime: "11:45" },
  { period: 5, label: "الحصة 5", startTime: "11:45", endTime: "12:30" },
  { period: 6, label: "الحصة 6", startTime: "12:30", endTime: "13:15" },
  { period: 7, label: "الحصة 7", startTime: "13:15", endTime: "14:00" }
];

async function ensureOptionalMfaColumns() {
  await prisma.$executeRaw`
    ALTER TABLE "School"
    ADD COLUMN IF NOT EXISTS "admin_mfa_required" BOOLEAN NOT NULL DEFAULT false;
  `;

  await prisma.$executeRaw`
    ALTER TABLE "SchoolSettings"
    ADD COLUMN IF NOT EXISTS "admin_mfa_required" BOOLEAN NOT NULL DEFAULT false;
  `;
}

async function main() {
  await ensureOptionalMfaColumns();

  const existingSchool = await prisma.school.findUnique({ where: { id: schoolId } });
  const school =
    existingSchool ||
    (await prisma.school.create({
      data: {
        id: schoolId,
        name: "مدرسة جديدة",
        address: "",
        managerName: "",
        institutionCode: ""
      }
    }));

  const existingSettings = await prisma.schoolSettings.findUnique({ where: { schoolId: school.id } });
  if (!existingSettings) {
    await prisma.schoolSettings.create({
      data: {
        schoolId: school.id,
        workingDays: defaultWorkingDays,
        offDays: defaultOffDays,
        periodsPerDay: 7,
        maxTeachers: 100
      }
    });
  }

  for (const period of defaultPeriods) {
    const existingPeriod = await prisma.periodDefinition.findUnique({
      where: { schoolId_period: { schoolId: school.id, period: period.period } }
    });

    if (!existingPeriod) {
      await prisma.periodDefinition.create({
        data: {
          schoolId: school.id,
          period: period.period,
          label: period.label,
          startTime: period.startTime,
          endTime: period.endTime,
          isActive: true
        }
      });
    }
  }

  console.log(
    "Seed completed: empty school bootstrap only. No demo teachers, classes, subjects, schedules, or daily data were created."
  );
}

main()
  .catch((error) => {
    logSafeError("prisma.seed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
