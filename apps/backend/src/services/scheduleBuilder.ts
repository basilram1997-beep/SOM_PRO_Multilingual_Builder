import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../db/prisma";
import { ensureSchoolSettings } from "./schoolSettings";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type BaseScheduleConflictSettings = {
  workingDays: unknown;
  periodsPerDay: number;
};

export type BaseScheduleConflictTeacher = {
  name: string;
  workDays?: unknown;
  preferredPeriods?: unknown;
  targetLoad?: number | null;
  releaseHours?: number | null;
};

export type BaseScheduleConflictClass = {
  name: string;
};

export type BaseScheduleConflictSubject = {
  name: string;
};

export type BaseScheduleConflictSlot = {
  id: string;
  day: string;
  period: number;
  teacherId: string;
  classId: string;
  subjectId: string;
  room: string | null;
  teacher: BaseScheduleConflictTeacher;
  class: BaseScheduleConflictClass;
  subject: BaseScheduleConflictSubject;
};

export type BaseScheduleConflictAssignment = {
  schoolId: string;
  teacherId: string;
  classId: string;
  subjectId: string;
  weeklyPeriods?: number | null;
  teacher: BaseScheduleConflictTeacher;
  class: BaseScheduleConflictClass;
  subject: BaseScheduleConflictSubject;
};

function assignmentKey(value: { schoolId: string; teacherId: string; classId: string; subjectId: string }) {
  return `${value.schoolId}:${value.teacherId}:${value.classId}:${value.subjectId}`;
}

/**
 * يتحقق من البرنامج الثابت بناء على ملفات المعلمين وتكليفاتهم.
 * صفحة ملفات المعلمين هي مصدر الحقيقة: المعلم لا يدرّس إلا الصفوف والمواد المسجلة له،
 * والبرنامج الثابت يجب أن يحترم النصاب والتفريغ وعدد الحصص الأسبوعية لكل تكليف.
 */
export function validateBaseScheduleConflictRows(input: {
  schoolId: string;
  settings: BaseScheduleConflictSettings;
  slots: BaseScheduleConflictSlot[];
  assignments: BaseScheduleConflictAssignment[];
}) {
  const { schoolId, settings, slots, assignments } = input;
  const workingDays = settings.workingDays as string[];

  const teacherBusy = new Map<string, string>();
  const classBusy = new Map<string, string>();
  const roomBusy = new Map<string, string>();
  const teacherWeeklyLoad = new Map<
    string,
    { name: string; lessons: number; targetLoad: number; releaseHours: number; effectiveLoad: number }
  >();
  const assignmentWeeklyLoad = new Map<string, number>();
  const assignmentSet = new Set(assignments.map((item) => assignmentKey(item)));
  const conflicts: string[] = [];

  for (const slot of slots) {
    if (!workingDays.includes(slot.day)) {
      conflicts.push(`اليوم ${slot.day} مستخدم في البرنامج لكنه ليس ضمن أيام دوام المدرسة`);
    }
    if (slot.period < 1 || slot.period > settings.periodsPerDay) {
      conflicts.push(`الحصة ${slot.period} للصف ${slot.class.name} خارج عدد الحصص المحدد (${settings.periodsPerDay})`);
    }
    if (
      Array.isArray(slot.teacher.workDays) &&
      slot.teacher.workDays.length > 0 &&
      !slot.teacher.workDays.includes(slot.day)
    ) {
      conflicts.push(`المعلم ${slot.teacher.name} غير متاح في اليوم ${slot.day}`);
    }
    if (
      Array.isArray(slot.teacher.preferredPeriods) &&
      slot.teacher.preferredPeriods.length > 0 &&
      !slot.teacher.preferredPeriods.includes(slot.period)
    ) {
      conflicts.push(`المعلم ${slot.teacher.name} غير متاح في الحصة ${slot.period}`);
    }

    const timeKey = `${slot.day}-${slot.period}`;
    const teacherKey = `${timeKey}-${slot.teacherId}`;
    const classKey = `${timeKey}-${slot.classId}`;
    const slotAssignmentKey = assignmentKey({
      schoolId,
      teacherId: slot.teacherId,
      classId: slot.classId,
      subjectId: slot.subjectId
    });

    if (teacherBusy.has(teacherKey)) {
      conflicts.push(`تعارض معلم: ${slot.teacher.name} لديه أكثر من حصة في ${slot.day} الحصة ${slot.period}`);
    }
    if (classBusy.has(classKey)) {
      conflicts.push(`تعارض صف: ${slot.class.name} لديه أكثر من حصة في ${slot.day} الحصة ${slot.period}`);
    }
    if (slot.room) {
      const roomKey = `${timeKey}-${slot.room}`;
      if (roomBusy.has(roomKey)) {
        conflicts.push(`تعارض غرفة: ${slot.room} مستخدمة أكثر من مرة في ${slot.day} الحصة ${slot.period}`);
      }
      roomBusy.set(roomKey, slot.id);
    }

    if (!assignmentSet.has(slotAssignmentKey)) {
      conflicts.push(
        `تكليف غير صحيح: ${slot.teacher.name} لا يعلّم ${slot.subject.name} للصف ${slot.class.name} حسب ملف المعلم`
      );
    }

    teacherBusy.set(teacherKey, slot.id);
    classBusy.set(classKey, slot.id);
    assignmentWeeklyLoad.set(slotAssignmentKey, (assignmentWeeklyLoad.get(slotAssignmentKey) || 0) + 1);

    const current = teacherWeeklyLoad.get(slot.teacherId) || {
      name: slot.teacher.name,
      lessons: 0,
      targetLoad: slot.teacher.targetLoad || 0,
      releaseHours: slot.teacher.releaseHours || 0,
      effectiveLoad: Math.max(0, (slot.teacher.targetLoad || 0) - (slot.teacher.releaseHours || 0))
    };
    current.lessons += 1;
    teacherWeeklyLoad.set(slot.teacherId, current);
  }

  for (const load of teacherWeeklyLoad.values()) {
    if (load.lessons > load.effectiveLoad) {
      conflicts.push(
        `نصاب المعلم ${load.name} متجاوز: لديه ${load.lessons} حصة في البرنامج الثابت، والنصاب الفعلي بعد التفريغ هو ${load.effectiveLoad} (${load.targetLoad} - ${load.releaseHours})`
      );
    }
  }

  for (const assignment of assignments) {
    if (!assignment.weeklyPeriods) continue;
    const actual =
      assignmentWeeklyLoad.get(
        assignmentKey({
          schoolId: assignment.schoolId,
          teacherId: assignment.teacherId,
          classId: assignment.classId,
          subjectId: assignment.subjectId
        })
      ) || 0;
    if (actual !== assignment.weeklyPeriods) {
      conflicts.push(
        `عدد حصص ${assignment.subject.name} للصف ${assignment.class.name} مع ${assignment.teacher.name} لا يطابق ملف المعلم: المطلوب ${assignment.weeklyPeriods}، الموجود ${actual}`
      );
    }
  }

  return conflicts;
}

export async function validateBaseScheduleConflicts(schoolId: string, db: DbClient = prisma) {
  const settings = await ensureSchoolSettings(schoolId);
  const slots = await db.baseScheduleSlot.findMany({
    where: { schoolId },
    include: { teacher: true, class: true, subject: true }
  });
  const assignments = await db.teacherAssignment.findMany({
    where: { schoolId },
    include: { teacher: true, class: true, subject: true }
  });

  return validateBaseScheduleConflictRows({
    schoolId,
    settings,
    slots,
    assignments
  });
}

export async function validateBaseScheduleSlotRules(
  input: {
    schoolId: string;
    day: string;
    period: number;
    classId: string;
    subjectId: string;
    teacherId: string;
    room?: string | null;
  },
  db: DbClient = prisma
) {
  const { schoolId, day, period, classId, subjectId, teacherId, room } = input;
  const conflicts: string[] = [];

  const [teacher, cls, subject, existingClassSlot, teacherBusy, assignment, currentTeacherLoad, currentAssignmentLoad] =
    await Promise.all([
      db.teacher.findUnique({ where: { id: teacherId } }),
      db.schoolClass.findUnique({ where: { id: classId } }),
      db.subject.findUnique({ where: { id: subjectId } }),
      db.baseScheduleSlot.findUnique({ where: { schoolId_day_period_classId: { schoolId, day, period, classId } } }),
      db.baseScheduleSlot.findFirst({
        where: { schoolId, day, period, teacherId, NOT: { classId } },
        include: { class: true, subject: true }
      }),
      db.teacherAssignment.findUnique({
        where: { schoolId_teacherId_classId_subjectId: { schoolId, teacherId, classId, subjectId } }
      }),
      db.baseScheduleSlot.count({ where: { schoolId, teacherId } }),
      db.baseScheduleSlot.count({ where: { schoolId, teacherId, classId, subjectId } })
    ]);

  if (!teacher || teacher.schoolId !== schoolId) conflicts.push("المعلم غير موجود في هذه المدرسة");
  if (!cls || cls.schoolId !== schoolId) conflicts.push("الصف غير موجود في هذه المدرسة");
  if (!subject || subject.schoolId !== schoolId) conflicts.push("المادة غير موجودة في هذه المدرسة");
  if (room) {
    const roomBusy = await db.baseScheduleSlot.findFirst({
      where: { schoolId, day, period, room, NOT: { classId } },
      include: { class: true, subject: true, teacher: true }
    });
    if (roomBusy) {
      conflicts.push(`تعارض غرفة: ${room} مستخدمة مع ${roomBusy.class.name} في ${day} الحصة ${period}`);
    }
  }
  if (Array.isArray(teacher?.workDays) && teacher.workDays.length > 0 && !teacher.workDays.includes(day)) {
    conflicts.push(`المعلم ${teacher?.name || ""} غير متاح في اليوم ${day}`);
  }
  if (
    Array.isArray(teacher?.preferredPeriods) &&
    teacher.preferredPeriods.length > 0 &&
    !teacher.preferredPeriods.includes(period)
  ) {
    conflicts.push(`المعلم ${teacher?.name || ""} غير متاح في الحصة ${period}`);
  }

  if (teacherBusy) {
    conflicts.push(
      "لا يمكن للمعلم " +
        (teacher?.name || "") +
        " إعطاء أكثر من صف في نفس الوقت: لديه " +
        teacherBusy.subject.name +
        " مع " +
        teacherBusy.class.name +
        " في " +
        day +
        " الحصة " +
        period
    );
  }

  if (!assignment) {
    conflicts.push(
      "المعلم " +
        (teacher?.name || "") +
        " لا يعلّم " +
        (subject?.name || "هذه المادة") +
        " لهذا الصف حسب ملف المعلم. أضف التكليف أولًا في صفحة ملفات المعلمين."
    );
  }

  if (teacher) {
    const effectiveLoad = Math.max(0, (teacher.targetLoad || 0) - (teacher.releaseHours || 0));
    const nextLoad = currentTeacherLoad - (existingClassSlot?.teacherId === teacherId ? 1 : 0) + 1;
    if (nextLoad > effectiveLoad) {
      conflicts.push(
        "نصاب المعلم " +
          teacher.name +
          " متجاوز: سيصبح لديه " +
          nextLoad +
          " حصة، والنصاب الفعلي بعد التفريغ هو " +
          effectiveLoad +
          " (" +
          (teacher.targetLoad || 0) +
          " - " +
          (teacher.releaseHours || 0) +
          ")"
      );
    }
  }

  if (assignment?.weeklyPeriods) {
    const replacesSameAssignment =
      existingClassSlot?.teacherId === teacherId &&
      existingClassSlot?.classId === classId &&
      existingClassSlot?.subjectId === subjectId;
    const nextAssignmentLoad = currentAssignmentLoad - (replacesSameAssignment ? 1 : 0) + 1;
    if (nextAssignmentLoad > assignment.weeklyPeriods) {
      conflicts.push(
        "عدد حصص " +
          (subject?.name || "المادة") +
          " للصف " +
          (cls?.name || "") +
          " مع " +
          (teacher?.name || "") +
          " سيتجاوز ملف المعلم: المطلوب " +
          assignment.weeklyPeriods +
          "، وسيصبح " +
          nextAssignmentLoad
      );
    }
  }

  return conflicts;
}

export type HomeroomRuleInput = {
  teacherId: string;
  classId: string;
  day: string;
  period: number;
  existingClassSlot?: { id: string } | null;
  teacherBusySlot?: { id: string; className: string } | null;
  overwriteConflicts: boolean;
};

export function decideHomeroomApplyAction(input: HomeroomRuleInput) {
  if (input.teacherBusySlot && !input.overwriteConflicts) return "CONFLICT_TEACHER_BUSY" as const;
  if (input.teacherBusySlot && input.overwriteConflicts) return "REPLACE_TEACHER_BUSY_SLOT" as const;
  if (input.existingClassSlot && !input.overwriteConflicts) return "CONFLICT_CLASS_BUSY" as const;
  if (input.existingClassSlot && input.overwriteConflicts) return "UPDATE_CLASS_SLOT" as const;
  return "CREATE_HOMEROOM_SLOT" as const;
}
