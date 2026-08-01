import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../db/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

export const DEFAULT_WORKING_DAYS = ["السبت", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
export const DEFAULT_OFF_DAYS = ["الأحد", "الجمعة"];

export async function ensureSchoolSettings(schoolId: string, db: DbClient = prisma) {
  let settings = await db.schoolSettings.findUnique({ where: { schoolId } });
  if (!settings) {
    settings = await db.schoolSettings.create({
      data: {
        schoolId,
        workingDays: DEFAULT_WORKING_DAYS,
        offDays: DEFAULT_OFF_DAYS,
        periodsPerDay: 7,
        maxTeachers: 100,
        adminMfaRequired: false
      }
    });
  }

  const periodCount = settings.periodsPerDay || 7;
  for (let i = 1; i <= periodCount; i++) {
    const existing = await db.periodDefinition.findUnique({
      where: { schoolId_period: { schoolId, period: i } }
    });

    if (existing) {
      await db.periodDefinition.update({
        where: { id: existing.id },
        data: { isActive: true }
      });
    } else {
      await db.periodDefinition.create({
        data: { schoolId, period: i, label: `الحصة ${i}`, isActive: true }
      });
    }
  }

  await db.periodDefinition.updateMany({
    where: { schoolId, period: { gt: periodCount } },
    data: { isActive: false }
  });

  return db.schoolSettings.findUniqueOrThrow({ where: { schoolId } });
}

export async function assertValidDayAndPeriod(schoolId: string, day: string, period: number, db: DbClient = prisma) {
  const settings = await ensureSchoolSettings(schoolId, db);
  const workingDays = settings.workingDays as string[];
  if (!workingDays.includes(day)) {
    throw new Error(`اليوم ${day} غير موجود ضمن أيام دوام المدرسة`);
  }
  if (period < 1 || period > settings.periodsPerDay) {
    throw new Error(`الحصة ${period} خارج عدد حصص المدرسة (${settings.periodsPerDay})`);
  }
}
