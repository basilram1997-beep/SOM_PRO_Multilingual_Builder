import type { PrismaClient } from "@prisma/client";
import { prisma } from "../db/prisma";
import {
  validateBaseScheduleConflictRows,
  validateBaseScheduleConflicts,
  validateBaseScheduleSlotRules,
  type BaseScheduleConflictSlot
} from "./scheduleBuilder";
import { ensureSchoolSettings } from "./schoolSettings";
import { invalidateDailyScheduleDetailsCache } from "./scheduleCoordinator";
import { invalidateTeacherDirectoryCache } from "./teacherDirectoryCache";

export class ScheduleConflictError extends Error {
  constructor(
    public readonly conflicts: string[],
    message = conflicts[0] || "BASE_SCHEDULE_RULE_VIOLATION"
  ) {
    super(message);
    this.name = "ScheduleConflictError";
  }
}

export type SaveBaseScheduleSlotInput = {
  day: string;
  period: number;
  classId: string;
  subjectId: string;
  teacherId: string;
  room?: string | null;
  expectedUpdatedAt?: string | null;
};

export async function saveBaseScheduleSlotFromRules(
  schoolId: string,
  input: SaveBaseScheduleSlotInput,
  db: PrismaClient = prisma
) {
  const validationConflicts = await validateBaseScheduleSlotRules({ schoolId, ...input }, db);
  if (validationConflicts.length) {
    return {
      error: {
        status: 400,
        body: {
          error: "BASE_SCHEDULE_RULE_VIOLATION",
          message: validationConflicts[0],
          conflicts: validationConflicts
        }
      }
    };
  }

  const existing = await db.baseScheduleSlot.findUnique({
    where: { schoolId_day_period_classId: { schoolId, day: input.day, period: input.period, classId: input.classId } }
  });

  if (existing && input.expectedUpdatedAt && existing.updatedAt.toISOString() !== input.expectedUpdatedAt) {
    return {
      error: {
        status: 409,
        body: {
          error: "STALE_BASE_SCHEDULE_SLOT",
          message: "تم تعديل الحصة من مستخدم آخر. أعد تحميل الجدول ثم حاول مرة أخرى."
        }
      }
    };
  }

  const slot = await db.baseScheduleSlot.upsert({
    where: { schoolId_day_period_classId: { schoolId, day: input.day, period: input.period, classId: input.classId } },
    update: {
      teacherId: input.teacherId,
      subjectId: input.subjectId,
      room: input.room ?? null
    },
    create: {
      schoolId,
      day: input.day,
      period: input.period,
      classId: input.classId,
      subjectId: input.subjectId,
      teacherId: input.teacherId,
      room: input.room ?? null
    }
  });

  invalidateDailyScheduleDetailsCache(schoolId);
  invalidateTeacherDirectoryCache(schoolId);
  return { data: { slot, existing } };
}

export async function copyBaseScheduleDayFromRules(
  schoolId: string,
  input: { fromDay: string; toDay: string; overwriteConflicts?: boolean },
  db: PrismaClient = prisma
) {
  const settings = await ensureSchoolSettings(schoolId, db);
  if (!(settings.workingDays as string[]).includes(input.fromDay)) {
    return {
      error: {
        status: 400,
        body: { error: "INVALID_WORKING_DAY", message: `اليوم ${input.fromDay} غير موجود ضمن أيام دوام المدرسة` }
      }
    };
  }
  if (!(settings.workingDays as string[]).includes(input.toDay)) {
    return {
      error: {
        status: 400,
        body: { error: "INVALID_WORKING_DAY", message: `اليوم ${input.toDay} غير موجود ضمن أيام دوام المدرسة` }
      }
    };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const sourceSlots = await tx.baseScheduleSlot.findMany({
        where: { schoolId, day: input.fromDay, period: { lte: settings.periodsPerDay } },
        orderBy: [{ period: "asc" }],
        include: { teacher: true, class: true, subject: true }
      });
      const targetSlots = await tx.baseScheduleSlot.findMany({
        where: { schoolId, day: input.toDay, period: { lte: settings.periodsPerDay } }
      });

      if (!input.overwriteConflicts && targetSlots.length > 0) {
        throw new ScheduleConflictError([`يوجد برنامج موجود بالفعل في ${input.toDay}. فعّل الاستبدال أولًا`]);
      }

      if (input.overwriteConflicts) {
        await tx.baseScheduleSlot.deleteMany({ where: { schoolId, day: input.toDay } });
      }

      const created = [];
      for (const slot of sourceSlots) {
        const row = await tx.baseScheduleSlot.upsert({
          where: {
            schoolId_day_period_classId: { schoolId, day: input.toDay, period: slot.period, classId: slot.classId }
          },
          update: {
            teacherId: slot.teacherId,
            subjectId: slot.subjectId,
            room: slot.room ?? null
          },
          create: {
            schoolId,
            day: input.toDay,
            period: slot.period,
            classId: slot.classId,
            subjectId: slot.subjectId,
            teacherId: slot.teacherId,
            room: slot.room ?? null
          },
          include: { teacher: true, class: true, subject: true }
        });
        created.push(row);
      }

      const conflicts = await validateBaseScheduleConflicts(schoolId, tx);
      if (conflicts.length) {
        throw new ScheduleConflictError(conflicts);
      }

      return { copied: created.length, slots: created };
    });

    invalidateDailyScheduleDetailsCache(schoolId);
    invalidateTeacherDirectoryCache(schoolId);
    return { data: result };
  } catch (error) {
    if (error instanceof ScheduleConflictError) {
      return {
        error: {
          status: 400,
          body: {
            error: "BASE_SCHEDULE_RULE_VIOLATION",
            message: error.conflicts[0],
            conflicts: error.conflicts
          }
        }
      };
    }
    throw error;
  }
}

export async function previewBaseScheduleDayCopyFromRules(
  schoolId: string,
  input: { fromDay: string; toDay: string; overwriteConflicts?: boolean },
  db: PrismaClient = prisma
) {
  const settings = await ensureSchoolSettings(schoolId, db);
  if (!(settings.workingDays as string[]).includes(input.fromDay)) {
    return {
      error: {
        status: 400,
        body: { error: "INVALID_WORKING_DAY", message: `اليوم ${input.fromDay} غير موجود ضمن أيام دوام المدرسة` }
      }
    };
  }
  if (!(settings.workingDays as string[]).includes(input.toDay)) {
    return {
      error: {
        status: 400,
        body: { error: "INVALID_WORKING_DAY", message: `اليوم ${input.toDay} غير موجود ضمن أيام دوام المدرسة` }
      }
    };
  }

  const [sourceSlots, targetSlots, assignments] = await Promise.all([
    db.baseScheduleSlot.findMany({
      where: { schoolId, day: input.fromDay, period: { lte: settings.periodsPerDay } },
      orderBy: [{ period: "asc" }],
      include: { teacher: true, class: true, subject: true }
    }),
    db.baseScheduleSlot.findMany({
      where: { schoolId, day: input.toDay, period: { lte: settings.periodsPerDay } },
      include: { teacher: true, class: true, subject: true }
    }),
    db.teacherAssignment.findMany({
      where: { schoolId },
      include: { teacher: true, class: true, subject: true }
    })
  ]);

  if (!input.overwriteConflicts && targetSlots.length > 0) {
    return {
      data: {
        ok: false,
        canCopy: false,
        conflicts: [`يوجد برنامج موجود بالفعل في ${input.toDay}. فعّل الاستبدال أولًا`],
        copiedCount: 0
      }
    };
  }

  const previewSlots = sourceSlots.map((slot) => ({
    ...slot,
    day: input.toDay
  }));
  const mergedSlots: BaseScheduleConflictSlot[] = input.overwriteConflicts
    ? previewSlots
    : [...targetSlots, ...previewSlots];

  const conflicts = validateBaseScheduleConflictRows({
    schoolId,
    settings,
    slots: mergedSlots,
    assignments
  });

  return {
    data: {
      ok: conflicts.length === 0,
      canCopy: conflicts.length === 0,
      conflicts,
      copiedCount: sourceSlots.length
    }
  };
}

export async function swapBaseSchedulePeriodsFromRules(
  schoolId: string,
  input: { day: string; classId: string; firstPeriod: number; secondPeriod: number }
) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const firstSlot = await tx.baseScheduleSlot.findUnique({
        where: {
          schoolId_day_period_classId: { schoolId, day: input.day, period: input.firstPeriod, classId: input.classId }
        }
      });
      const secondSlot = await tx.baseScheduleSlot.findUnique({
        where: {
          schoolId_day_period_classId: { schoolId, day: input.day, period: input.secondPeriod, classId: input.classId }
        }
      });

      if (!firstSlot && !secondSlot) {
        return { swapped: 0 };
      }

      const tempPeriod = 0;
      if (firstSlot && secondSlot) {
        await tx.baseScheduleSlot.update({ where: { id: firstSlot.id }, data: { period: tempPeriod } });
        await tx.baseScheduleSlot.update({ where: { id: secondSlot.id }, data: { period: input.firstPeriod } });
        await tx.baseScheduleSlot.update({ where: { id: firstSlot.id }, data: { period: input.secondPeriod } });
      } else if (firstSlot) {
        await tx.baseScheduleSlot.update({ where: { id: firstSlot.id }, data: { period: input.secondPeriod } });
      } else if (secondSlot) {
        await tx.baseScheduleSlot.update({ where: { id: secondSlot.id }, data: { period: input.firstPeriod } });
      }

      const conflicts = await validateBaseScheduleConflicts(schoolId, tx);
      if (conflicts.length) {
        throw new ScheduleConflictError(conflicts);
      }

      return { swapped: 1 };
    });

    invalidateDailyScheduleDetailsCache(schoolId);
    invalidateTeacherDirectoryCache(schoolId);
    return { data: result };
  } catch (error) {
    if (error instanceof ScheduleConflictError) {
      return {
        error: {
          status: 400,
          body: {
            error: "BASE_SCHEDULE_RULE_VIOLATION",
            message: error.conflicts[0],
            conflicts: error.conflicts
          }
        }
      };
    }
    throw error;
  }
}

export async function previewBaseScheduleSwapPeriodsFromRules(
  schoolId: string,
  input: { day: string; classId: string; firstPeriod: number; secondPeriod: number },
  db: PrismaClient = prisma
) {
  const settings = await ensureSchoolSettings(schoolId, db);
  const [slots, assignments] = await Promise.all([
    db.baseScheduleSlot.findMany({
      where: { schoolId },
      include: { teacher: true, class: true, subject: true }
    }),
    db.teacherAssignment.findMany({
      where: { schoolId },
      include: { teacher: true, class: true, subject: true }
    })
  ]);

  const swappedSlots = slots.map((slot) => {
    if (slot.day !== input.day || slot.classId !== input.classId) return slot;
    if (slot.period === input.firstPeriod) return { ...slot, period: input.secondPeriod };
    if (slot.period === input.secondPeriod) return { ...slot, period: input.firstPeriod };
    return slot;
  });

  const conflicts = validateBaseScheduleConflictRows({
    schoolId,
    settings,
    slots: swappedSlots,
    assignments
  });

  return {
    data: {
      ok: conflicts.length === 0,
      conflicts,
      canSwap: conflicts.length === 0,
      affectedPeriods: [input.firstPeriod, input.secondPeriod]
    }
  };
}
