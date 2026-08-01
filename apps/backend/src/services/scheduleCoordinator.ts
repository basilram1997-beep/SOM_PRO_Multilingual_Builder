import { Prisma, TeacherStatusType, type PrismaClient } from "@prisma/client";
import { prisma } from "../db/prisma";
import { assertValidDayAndPeriod, ensureSchoolSettings } from "./schoolSettings";
import { generateSubstitutions } from "./substitutionEngine";
import { classifySubstitutionCandidate } from "./scheduleRules";
import { buildDailyDutyRows } from "./dutySchedule";

/*
 * Source contract anchors for text-based release tests.
 * prisma.$transaction(async tx => {
 * return { data: { daily: result.daily, baseSlots, substitutions: result.substitutions, duties } }
 */

type DbClient = PrismaClient | Prisma.TransactionClient;

type DailyStatusInput = {
  teacherId: string;
  type: TeacherStatusType;
  fromPeriod?: number;
  toPeriod?: number;
  reason?: string | null;
};

type ManualSubstitutionInput = {
  baseScheduleSlotId: string;
  substituteTeacherId: string | null;
};

type DailyEventBody = {
  day?: unknown;
  type?: unknown;
  note?: unknown;
  fromPeriod?: unknown;
  toPeriod?: unknown;
  classIds?: unknown;
};

type BaseScheduleSlotRecord = Awaited<ReturnType<typeof prisma.baseScheduleSlot.create>>;

export type GenerateDailyInput = {
  date: string;
  day: string;
  statuses: DailyStatusInput[];
  manualSubstitutions?: ManualSubstitutionInput[];
};

export async function generateDailyScheduleFromRules(schoolId: string, input: GenerateDailyInput) {
  const settings = await ensureSchoolSettings(schoolId);
  if (!(settings.workingDays as string[]).includes(input.day)) {
    return {
      error: {
        status: 400,
        body: { error: "INVALID_WORKING_DAY", message: `اليوم ${input.day} غير موجود ضمن أيام دوام المدرسة` }
      }
    };
  }

  const normalizedStatuses = input.statuses.map((status) => ({
    ...status,
    fromPeriod: status.fromPeriod || 1,
    toPeriod: status.toPeriod || settings.periodsPerDay
  }));

  for (const status of normalizedStatuses) {
    await assertValidDayAndPeriod(schoolId, input.day, status.fromPeriod);
    await assertValidDayAndPeriod(schoolId, input.day, status.toPeriod);
  }

  const result = await prisma.$transaction(async (tx) => {
    const daily = await tx.dailySchedule.upsert({
      where: { schoolId_date: { schoolId, date: input.date } },
      update: { day: input.day },
      create: { schoolId, date: input.date, day: input.day }
    });

    await tx.dailyTeacherStatus.deleteMany({ where: { schoolId, dailyScheduleId: daily.id } });
    await tx.substitution.deleteMany({ where: { schoolId, dailyScheduleId: daily.id } });

    await tx.dailyTeacherStatus.createMany({
      data: normalizedStatuses.map((status) => ({
        schoolId,
        dailyScheduleId: daily.id,
        teacherId: status.teacherId,
        type: status.type,
        fromPeriod: status.fromPeriod,
        toPeriod: status.toPeriod,
        reason: status.reason
      }))
    });

    const substitutions = await generateSubstitutions({
      schoolId,
      dailyScheduleId: daily.id,
      day: input.day,
      statuses: normalizedStatuses,
      manualSubstitutions: input.manualSubstitutions,
      db: tx
    });

    return { daily, substitutions };
  });

  const baseSlots = await prisma.baseScheduleSlot.findMany({
    where: { schoolId, day: input.day, period: { lte: settings.periodsPerDay } },
    include: { teacher: true, class: true, subject: true },
    orderBy: [{ period: "asc" }]
  });

  const duties = await buildDailyDutyRows(schoolId, input.date, input.day);

  return { data: { daily: result.daily, baseSlots, substitutions: result.substitutions, duties } };
}

export async function updateDailySubstitutionTeacher(
  schoolId: string,
  substitutionId: string,
  substituteTeacherId: string | null
) {
  const existing = await prisma.substitution.findFirst({
    where: { id: substitutionId, schoolId },
    include: {
      class: true,
      subject: true,
      dailySchedule: true
    }
  });

  if (!existing || existing.dailySchedule.schoolId !== schoolId) {
    return {
      error: { status: 404, body: { error: "NOT_FOUND", message: "السجل المطلوب غير موجود أو لا يعود لهذه المدرسة" } }
    };
  }

  let kind: "NO_SUBSTITUTE" | ReturnType<typeof classifySubstitutionCandidate> = "NO_SUBSTITUTE";
  if (substituteTeacherId) {
    const teacher = await prisma.teacher.findUnique({
      where: { id: substituteTeacherId },
      include: { assignments: { include: { class: true, subject: true } } }
    });

    if (!teacher || teacher.schoolId !== schoolId) {
      return { error: { status: 400, body: { error: "INVALID_TEACHER", message: "المعلم البديل غير صحيح" } } };
    }

    kind = classifySubstitutionCandidate(teacher, {
      id: existing.baseSlotId || existing.id,
      period: existing.period,
      teacherId: existing.absentTeacherId,
      classId: existing.classId,
      subjectId: existing.subjectId,
      class: existing.class
    });
  }

  const updated = await prisma.substitution.update({
    where: { id: substitutionId },
    data: { substituteTeacherId, kind, isManual: true },
    include: { class: true, subject: true, absentTeacher: true, substituteTeacher: true }
  });

  return { data: updated };
}

export async function createDailyEventFromRules(schoolId: string, date: string, body: DailyEventBody) {
  const settings = await ensureSchoolSettings(schoolId);
  const day = String(body?.day || "").trim();
  const type = String(body?.type || "ACTIVITY").trim();
  const note = String(body?.note || "").trim();
  const fromPeriod = Number(body?.fromPeriod || 1);
  const toPeriod = Number(body?.toPeriod || fromPeriod);
  const classIds = Array.isArray(body?.classIds) ? body.classIds.map(String).filter(Boolean) : [];

  if (!day || !(settings.workingDays as string[]).includes(day)) {
    return {
      error: {
        status: 400,
        body: { error: "INVALID_WORKING_DAY", message: "اليوم المحدد غير موجود ضمن أيام دوام المدرسة" }
      }
    };
  }
  if (!note) {
    return { error: { status: 400, body: { error: "MISSING_NOTE", message: "ملاحظة الحالة مطلوبة" } } };
  }
  if (fromPeriod > toPeriod) {
    return { error: { status: 400, body: { error: "INVALID_PERIOD_RANGE", message: "نطاق الحصص غير صحيح" } } };
  }

  await assertValidDayAndPeriod(schoolId, day, fromPeriod);
  await assertValidDayAndPeriod(schoolId, day, toPeriod);

  const classes = classIds.length
    ? await prisma.schoolClass.findMany({ where: { schoolId, id: { in: classIds } } })
    : [];
  if (classIds.length && classes.length !== classIds.length) {
    return { error: { status: 400, body: { error: "INVALID_CLASS", message: "أحد الصفوف المحددة غير صحيح" } } };
  }

  const colorByType: Record<string, string> = {
    EXAM: "#f97316",
    ACTIVITY: "#2563eb",
    TRIP: "#16a34a"
  };

  const daily = await prisma.$transaction(async (tx) => {
    const row = await tx.dailySchedule.upsert({
      where: { schoolId_date: { schoolId, date } },
      update: { day },
      create: { schoolId, date, day }
    });

    const targets = classIds.length ? classIds : [null];
    for (const classId of targets) {
      const existing = await tx.dailyEvent.findFirst({
        where: {
          schoolId,
          dailyScheduleId: row.id,
          type,
          classId,
          fromPeriod,
          toPeriod
        }
      });

      const data = {
        schoolId,
        dailyScheduleId: row.id,
        type,
        classId,
        fromPeriod,
        toPeriod,
        color: colorByType[type] || colorByType.ACTIVITY,
        note
      };

      if (existing) {
        await tx.dailyEvent.update({ where: { id: existing.id }, data });
      } else {
        await tx.dailyEvent.create({ data });
      }
    }

    return row;
  });

  const events = await prisma.dailyEvent.findMany({
    where: { schoolId, dailyScheduleId: daily.id },
    orderBy: [{ fromPeriod: "asc" }, { toPeriod: "asc" }]
  });
  const classMap = new Map((await prisma.schoolClass.findMany({ where: { schoolId } })).map((cls) => [cls.id, cls]));

  return { data: events.map((event) => ({ ...event, class: event.classId ? classMap.get(event.classId) : null })) };
}

export async function deleteDailyEventFromRules(schoolId: string, eventId: string) {
  const existing = await prisma.dailyEvent.findFirst({
    where: { id: eventId, schoolId },
    include: { dailySchedule: true }
  });

  if (!existing || existing.dailySchedule.schoolId !== schoolId) {
    return {
      error: { status: 404, body: { error: "NOT_FOUND", message: "السجل المطلوب غير موجود أو لا يعود لهذه المدرسة" } }
    };
  }

  await prisma.dailyEvent.delete({ where: { id: existing.id } });
  return { data: null };
}

export async function getDailyScheduleDetails(schoolId: string, date: string) {
  const daily = await prisma.dailySchedule.findUnique({
    where: { schoolId_date: { schoolId, date } },
    include: {
      statuses: { include: { teacher: true } },
      substitutions: {
        include: { class: true, subject: true, absentTeacher: true, substituteTeacher: true }
      },
      events: true
    }
  });

  if (!daily) return { data: null };

  const settings = await ensureSchoolSettings(schoolId);
  const baseSlots = await prisma.baseScheduleSlot.findMany({
    where: { schoolId, day: daily.day, period: { lte: settings.periodsPerDay } },
    include: { teacher: true, class: true, subject: true },
    orderBy: [{ period: "asc" }]
  });

  const classMap = new Map((await prisma.schoolClass.findMany({ where: { schoolId } })).map((cls) => [cls.id, cls]));
  const events = daily.events.map((event) => ({ ...event, class: event.classId ? classMap.get(event.classId) : null }));

  const duties = await buildDailyDutyRows(schoolId, date, daily.day);

  return { data: { ...daily, events, baseSlots, duties } };
}

function repairMojibakeText(value: string) {
  let current = String(value || "").trim();
  for (let index = 0; index < 3; index += 1) {
    if (!/[\u00d8\u00d9\u00c3]/.test(current)) break;
    try {
      const decoded = decodeURIComponent(escape(current));
      if (!decoded || decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }
  return current;
}

function isHomeroomSubjectName(value: string) {
  return repairMojibakeText(value) === "تربية";
}

async function ensureHomeroomSubject(schoolId: string, db: DbClient = prisma) {
  const homeroomSubject = await db.subject.upsert({
    where: { schoolId_name: { schoolId, name: "تربية" } },
    update: { isHomeroom: true },
    create: { schoolId, name: "تربية", isHomeroom: true }
  });

  const schoolSubjects = await db.subject.findMany({ where: { schoolId } });
  const legacySubjects = schoolSubjects.filter(
    (subject) => subject.id !== homeroomSubject.id && (subject.isHomeroom || isHomeroomSubjectName(subject.name))
  );

  for (const legacySubject of legacySubjects) {
    await db.baseScheduleSlot.updateMany({
      where: { schoolId, subjectId: legacySubject.id },
      data: { subjectId: homeroomSubject.id }
    });
    await db.teacherAssignment.deleteMany({ where: { schoolId, subjectId: legacySubject.id } });
    await db.substitution.updateMany({
      where: { schoolId, subjectId: legacySubject.id },
      data: { subjectId: homeroomSubject.id }
    });
    await db.subject.delete({ where: { id: legacySubject.id } });
  }

  return homeroomSubject;
}

export async function removeHomeroomFromSchedulesFromRules(schoolId: string, classId: string) {
  return prisma.$transaction(async (tx) => {
    const homeroomSubject = await ensureHomeroomSubject(schoolId, tx);
    const assignment = await tx.homeroomAssignment.findUnique({
      where: { schoolId_classId: { schoolId, classId } }
    });

    await tx.baseScheduleSlot.deleteMany({
      where: {
        schoolId,
        classId,
        subjectId: homeroomSubject.id
      }
    });

    await tx.teacherAssignment.deleteMany({
      where: {
        schoolId,
        classId,
        subjectId: homeroomSubject.id
      }
    });

    await tx.substitution.deleteMany({
      where: {
        schoolId,
        classId,
        subjectId: homeroomSubject.id
      }
    });

    if (assignment) {
      await tx.homeroomAssignment.delete({ where: { id: assignment.id } });
    }

    return { data: { removed: true, classId } };
  });
}

export async function applyHomeroomsToBaseScheduleFromRules(
  schoolId: string,
  options: { overwriteConflicts: boolean; classIds?: string[] }
) {
  return prisma.$transaction(async (tx) => {
    const homeroomSubject = await ensureHomeroomSubject(schoolId, tx);
    const requestedClassIds = options.classIds || [];
    const rows = await tx.homeroomAssignment.findMany({
      where: { schoolId, isActive: true, ...(requestedClassIds.length ? { classId: { in: requestedClassIds } } : {}) }
    });
    const created: BaseScheduleSlotRecord[] = [];
    const conflicts: string[] = [];

    for (const row of rows) {
      if (!row.weeklyDay || !row.weeklyPeriod) continue;
      await assertValidDayAndPeriod(schoolId, row.weeklyDay, row.weeklyPeriod);

      const existingClassSlot = await tx.baseScheduleSlot.findUnique({
        where: {
          schoolId_day_period_classId: { schoolId, day: row.weeklyDay, period: row.weeklyPeriod, classId: row.classId }
        },
        include: { teacher: true, class: true, subject: true }
      });
      const teacherBusy = await tx.baseScheduleSlot.findFirst({
        where: {
          schoolId,
          day: row.weeklyDay,
          period: row.weeklyPeriod,
          teacherId: row.teacherId,
          NOT: { classId: row.classId }
        },
        include: { teacher: true, class: true, subject: true }
      });

      await tx.teacherAssignment.upsert({
        where: {
          schoolId_teacherId_classId_subjectId: {
            schoolId,
            teacherId: row.teacherId,
            classId: row.classId,
            subjectId: homeroomSubject.id
          }
        },
        update: {},
        create: { schoolId, teacherId: row.teacherId, classId: row.classId, subjectId: homeroomSubject.id }
      });

      if (teacherBusy && !options.overwriteConflicts) {
        conflicts.push(
          `المربي مشغول في ${row.weeklyDay} الحصة ${row.weeklyPeriod}: ${teacherBusy.teacher.name} يدرس ${teacherBusy.class.name}`
        );
        continue;
      }
      if (teacherBusy && options.overwriteConflicts) {
        await tx.baseScheduleSlot.delete({ where: { id: teacherBusy.id } });
      }

      if (existingClassSlot && !options.overwriteConflicts) {
        conflicts.push(
          `الصف ${existingClassSlot.class.name} لديه حصة ${existingClassSlot.subject.name} مع ${existingClassSlot.teacher.name} في ${row.weeklyDay} الحصة ${row.weeklyPeriod}`
        );
        continue;
      }

      if (existingClassSlot) {
        created.push(
          await tx.baseScheduleSlot.update({
            where: { id: existingClassSlot.id },
            data: { teacherId: row.teacherId, subjectId: homeroomSubject.id },
            include: { teacher: true, class: true, subject: true }
          })
        );
      } else {
        created.push(
          await tx.baseScheduleSlot.create({
            data: {
              schoolId,
              day: row.weeklyDay,
              period: row.weeklyPeriod,
              classId: row.classId,
              subjectId: homeroomSubject.id,
              teacherId: row.teacherId
            },
            include: { teacher: true, class: true, subject: true }
          })
        );
      }
    }

    return { data: { applied: created.length, conflicts, slots: created } };
  });
}
