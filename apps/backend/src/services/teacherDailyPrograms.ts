import { prisma } from "../db/prisma";
import { ensureSchoolSettings } from "./schoolSettings";

const teacherDailySelect = {
  id: true,
  name: true,
  specialty: true
} as const;

const dailySlotSelect = {
  id: true,
  schoolId: true,
  day: true,
  period: true,
  classId: true,
  subjectId: true,
  teacherId: true,
  room: true,
  class: {
    select: {
      id: true,
      name: true
    }
  },
  subject: {
    select: {
      id: true,
      name: true
    }
  },
  teacher: {
    select: teacherDailySelect
  }
} as const;

const dailyStatusSelect = {
  teacherId: true,
  type: true,
  fromPeriod: true,
  toPeriod: true,
  reason: true
} as const;

const dailySubstitutionSelect = {
  id: true,
  period: true,
  baseSlotId: true,
  classId: true,
  subjectId: true,
  absentTeacherId: true,
  substituteTeacherId: true,
  note: true,
  class: {
    select: {
      id: true,
      name: true
    }
  },
  subject: {
    select: {
      id: true,
      name: true
    }
  },
  absentTeacher: {
    select: teacherDailySelect
  },
  substituteTeacher: {
    select: teacherDailySelect
  }
} as const;

export type TeacherProgramLesson = {
  period: number;
  className: string;
  subjectName: string;
  lessonType: "ORIGINAL" | "SUBSTITUTION" | "UNAVAILABLE_ORIGINAL";
  originalTeacherName?: string | null;
  substituteForName?: string | null;
  note?: string | null;
};

export type TeacherDailyProgram = {
  teacherId: string;
  teacherName: string;
  specialty?: string | null;
  status?: string | null;
  lessons: TeacherProgramLesson[];
  totalOriginalLessons: number;
  totalSubstitutions: number;
  totalLessons: number;
};

function statusLabel(statuses: Array<{ type: string; fromPeriod: number; toPeriod: number; reason?: string | null }>) {
  if (!statuses.length) return null;
  return statuses
    .map((s) => {
      if (s.type === "ABSENT") return s.reason || "غياب";
      if (s.type === "LATE") return s.reason || `تأخر من حصة ${s.fromPeriod} إلى حصة ${s.toPeriod}`;
      if (s.type === "LEFT") return s.reason || `مغادرة من حصة ${s.fromPeriod} إلى حصة ${s.toPeriod}`;
      return s.reason || `في مهمة من حصة ${s.fromPeriod} إلى حصة ${s.toPeriod}`;
    })
    .join("، ");
}

export async function buildTeacherDailyPrograms(params: { schoolId: string; date: string }) {
  const { schoolId, date } = params;

  const daily = await prisma.dailySchedule.findUnique({
    where: { schoolId_date: { schoolId, date } },
    select: {
      id: true,
      schoolId: true,
      date: true,
      day: true,
      createdAt: true,
      updatedAt: true,
      statuses: {
        select: dailyStatusSelect
      },
      substitutions: {
        select: dailySubstitutionSelect
      }
    }
  });

  if (!daily) {
    return null;
  }

  const settings = await ensureSchoolSettings(schoolId);

  const [teachers, baseSlots] = await Promise.all([
    prisma.teacher.findMany({
      where: { schoolId },
      select: teacherDailySelect,
      orderBy: { name: "asc" }
    }),
    prisma.baseScheduleSlot.findMany({
      where: { schoolId, day: daily.day, period: { lte: settings.periodsPerDay } },
      select: dailySlotSelect,
      orderBy: [{ period: "asc" }]
    })
  ]);

  const activeSubstitutions = daily.substitutions.filter((sub) => sub.period <= settings.periodsPerDay);
  const substitutionsByBaseSlotId = new Map(
    activeSubstitutions.filter((s) => !!s.baseSlotId).map((s) => [s.baseSlotId as string, s])
  );
  const substitutionsByTeacherId = new Map<string, typeof activeSubstitutions>();
  for (const substitution of activeSubstitutions) {
    if (!substitution.substituteTeacherId) {
      continue;
    }
    if (!substitutionsByTeacherId.has(substitution.substituteTeacherId)) {
      substitutionsByTeacherId.set(substitution.substituteTeacherId, []);
    }
    substitutionsByTeacherId.get(substitution.substituteTeacherId)!.push(substitution);
  }

  const statusesByTeacherId = new Map<string, typeof daily.statuses>();
  for (const st of daily.statuses) {
    if (!statusesByTeacherId.has(st.teacherId)) statusesByTeacherId.set(st.teacherId, []);
    statusesByTeacherId.get(st.teacherId)!.push(st);
  }

  const programs: TeacherDailyProgram[] = teachers.map((teacher) => {
    const teacherStatuses = statusesByTeacherId.get(teacher.id) || [];
    const lessons: TeacherProgramLesson[] = [];

    for (const slot of baseSlots) {
      const substitution = substitutionsByBaseSlotId.get(slot.id);
      const originalUnavailable = substitution && substitution.absentTeacherId === teacher.id;

      if (slot.teacherId === teacher.id && !originalUnavailable) {
        lessons.push({
          period: slot.period,
          className: slot.class.name,
          subjectName: slot.subject.name,
          lessonType: "ORIGINAL",
          originalTeacherName: slot.teacher.name,
          note: "حصة أصلية"
        });
      }

      if (slot.teacherId === teacher.id && originalUnavailable) {
        lessons.push({
          period: slot.period,
          className: slot.class.name,
          subjectName: slot.subject.name,
          lessonType: "UNAVAILABLE_ORIGINAL",
          originalTeacherName: slot.teacher.name,
          note: substitution.note || "حصة أصلية متأثرة بالغياب أو التأخر أو المغادرة"
        });
      }
    }

    for (const sub of substitutionsByTeacherId.get(teacher.id) || []) {
      if (sub.substituteTeacherId === teacher.id) {
        lessons.push({
          period: sub.period,
          className: sub.class.name,
          subjectName: sub.subject.name,
          lessonType: "SUBSTITUTION",
          substituteForName: sub.absentTeacher.name,
          note: `استبدال عن ${sub.absentTeacher.name}`
        });
      }
    }

    lessons.sort((a, b) => a.period - b.period || a.className.localeCompare(b.className, "ar"));

    let totalOriginalLessons = 0;
    let totalSubstitutions = 0;
    for (const lesson of lessons) {
      if (lesson.lessonType === "ORIGINAL") totalOriginalLessons += 1;
      if (lesson.lessonType === "SUBSTITUTION") totalSubstitutions += 1;
    }

    return {
      teacherId: teacher.id,
      teacherName: teacher.name,
      specialty: teacher.specialty,
      status: statusLabel(teacherStatuses),
      lessons,
      totalOriginalLessons,
      totalSubstitutions,
      totalLessons: totalOriginalLessons + totalSubstitutions
    };
  });

  return {
    daily: {
      id: daily.id,
      date: daily.date,
      day: daily.day,
      createdAt: daily.createdAt,
      updatedAt: daily.updatedAt
    },
    programs
  };
}
