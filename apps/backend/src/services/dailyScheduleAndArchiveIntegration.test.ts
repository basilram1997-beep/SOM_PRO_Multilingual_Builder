import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateSubstitutions } from "./substitutionEngine";
import { prisma } from "../db/prisma";
import { buildTeacherDailyPrograms } from "./teacherDailyPrograms";
import { generateDailyScheduleFromRules, updateDailySubstitutionTeacher } from "./scheduleCoordinator";

type ScheduleState = {
  settings: {
    schoolId: string;
    workingDays: string[];
    offDays: string[];
    periodsPerDay: number;
    maxTeachers: number;
    adminMfaRequired: boolean;
  };
  periodDefinitions: Array<{
    id: string;
    schoolId: string;
    period: number;
    label: string;
    startTime: string;
    endTime: string;
    isActive: boolean;
  }>;
  dailySchedules: Array<{
    id: string;
    schoolId: string;
    date: string;
    day: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  dailyStatuses: Array<{
    id: string;
    schoolId: string;
    dailyScheduleId: string;
    teacherId: string;
    type: string;
    fromPeriod: number;
    toPeriod: number;
    reason: string | null;
  }>;
  substitutions: Array<{
    id: string;
    schoolId: string;
    dailyScheduleId: string;
    period: number;
    baseSlotId: string;
    classId: string;
    subjectId: string;
    absentTeacherId: string;
    substituteTeacherId: string | null;
    kind: string;
    isManual: boolean;
    note: string | null;
    class: { id: string; name: string };
    subject: { id: string; name: string };
    absentTeacher: { id: string; name: string; specialty: string | null } | null;
    substituteTeacher: { id: string; name: string; specialty: string | null } | null;
    dailySchedule: { id: string; schoolId: string; date: string; day: string; updatedAt: Date };
  }>;
  baseSlots: Array<{
    id: string;
    schoolId: string;
    day: string;
    period: number;
    teacherId: string;
    classId: string;
    subjectId: string;
    teacher: { id: string; name: string; specialty: string | null };
    class: { id: string; name: string };
    subject: { id: string; name: string };
  }>;
  teachers: Array<{
    id: string;
    schoolId: string;
    name: string;
    specialty: string | null;
    assignments: Array<{
      classId: string;
      subjectId: string;
      class: { id: string; name: string };
      subject: { id: string; name: string };
    }>;
  }>;
  classes: Array<{ id: string; schoolId: string; name: string }>;
  dailyEvents: Array<{
    id: string;
    schoolId: string;
    dailyScheduleId: string;
    type: string;
    classId: string | null;
    fromPeriod: number;
    toPeriod: number;
    color: string;
    note: string;
  }>;
  dutyAssignments: Array<{
    id: string;
    schoolId: string;
    teacherId: string;
    day: string;
    startTime: string;
    endTime: string;
    place: string;
    notes: string | null;
    isActive: boolean;
    teacher: { id: string; name: string; specialty: string | null };
  }>;
  dailyScheduleIdSequence: number;
  statusIdSequence: number;
  substitutionIdSequence: number;
  periodIdSequence: number;
};

function createScheduleState(): ScheduleState {
  return {
    settings: {
      schoolId: "school-a",
      workingDays: ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "السبت"],
      offDays: ["الأحد", "الجمعة"],
      periodsPerDay: 3,
      maxTeachers: 100,
      adminMfaRequired: false
    },
    periodDefinitions: [
      {
        id: "period-1",
        schoolId: "school-a",
        period: 1,
        label: "الحصة 1",
        startTime: "08:00",
        endTime: "08:45",
        isActive: true
      },
      {
        id: "period-2",
        schoolId: "school-a",
        period: 2,
        label: "الحصة 2",
        startTime: "08:45",
        endTime: "09:30",
        isActive: true
      },
      {
        id: "period-3",
        schoolId: "school-a",
        period: 3,
        label: "الحصة 3",
        startTime: "09:30",
        endTime: "10:15",
        isActive: true
      }
    ],
    dailySchedules: [],
    dailyStatuses: [],
    substitutions: [],
    baseSlots: [
      {
        id: "slot-1",
        schoolId: "school-a",
        day: "الاثنين",
        period: 1,
        teacherId: "teacher-a",
        classId: "class-10a",
        subjectId: "math",
        teacher: { id: "teacher-a", name: "الأستاذ سامر", specialty: "رياضيات" },
        class: { id: "class-10a", name: "العاشر أ" },
        subject: { id: "math", name: "رياضيات" }
      },
      {
        id: "slot-2",
        schoolId: "school-a",
        day: "الاثنين",
        period: 2,
        teacherId: "teacher-a",
        classId: "class-10a",
        subjectId: "math",
        teacher: { id: "teacher-a", name: "الأستاذ سامر", specialty: "رياضيات" },
        class: { id: "class-10a", name: "العاشر أ" },
        subject: { id: "math", name: "رياضيات" }
      },
      {
        id: "slot-3",
        schoolId: "school-a",
        day: "الاثنين",
        period: 3,
        teacherId: "teacher-a",
        classId: "class-10a",
        subjectId: "math",
        teacher: { id: "teacher-a", name: "الأستاذ سامر", specialty: "رياضيات" },
        class: { id: "class-10a", name: "العاشر أ" },
        subject: { id: "math", name: "رياضيات" }
      },
      {
        id: "slot-4",
        schoolId: "school-a",
        day: "الاثنين",
        period: 4,
        teacherId: "teacher-a",
        classId: "class-10a",
        subjectId: "math",
        teacher: { id: "teacher-a", name: "الأستاذ سامر", specialty: "رياضيات" },
        class: { id: "class-10a", name: "العاشر أ" },
        subject: { id: "math", name: "رياضيات" }
      }
    ],
    teachers: [
      {
        id: "teacher-a",
        schoolId: "school-a",
        name: "الأستاذ سامر",
        specialty: "رياضيات",
        assignments: [
          {
            classId: "class-10a",
            subjectId: "math",
            class: { id: "class-10a", name: "العاشر أ" },
            subject: { id: "math", name: "رياضيات" }
          }
        ]
      },
      {
        id: "teacher-b",
        schoolId: "school-a",
        name: "الأستاذ باسل",
        specialty: "رياضيات",
        assignments: [
          {
            classId: "class-10a",
            subjectId: "math",
            class: { id: "class-10a", name: "العاشر أ" },
            subject: { id: "math", name: "رياضيات" }
          }
        ]
      },
      {
        id: "teacher-c",
        schoolId: "school-a",
        name: "الأستاذة ليان",
        specialty: "علوم",
        assignments: [
          {
            classId: "class-11a",
            subjectId: "science",
            class: { id: "class-11a", name: "الحادي عشر أ" },
            subject: { id: "science", name: "علوم" }
          }
        ]
      }
    ],
    classes: [
      { id: "class-10a", schoolId: "school-a", name: "العاشر أ" },
      { id: "class-11a", schoolId: "school-a", name: "الحادي عشر أ" }
    ],
    dailyEvents: [],
    dutyAssignments: [
      {
        id: "duty-1",
        schoolId: "school-a",
        teacherId: "teacher-a",
        day: "الاثنين",
        startTime: "08:40",
        endTime: "09:00",
        place: "البوابة",
        notes: "مناوبة صباحية",
        isActive: true,
        teacher: { id: "teacher-a", name: "الأستاذ سامر", specialty: "رياضيات" }
      },
      {
        id: "duty-2",
        schoolId: "school-a",
        teacherId: "teacher-c",
        day: "الاثنين",
        startTime: "10:30",
        endTime: "10:45",
        place: "الساحة",
        notes: null,
        isActive: true,
        teacher: { id: "teacher-c", name: "الأستاذة ليان", specialty: "علوم" }
      }
    ],
    dailyScheduleIdSequence: 1,
    statusIdSequence: 1,
    substitutionIdSequence: 1,
    periodIdSequence: 4
  };
}

function installScheduleState(state: ScheduleState) {
  const anyPrisma = prisma as any;
  const original = {
    schoolSettingsFindUnique: anyPrisma.schoolSettings.findUnique.bind(anyPrisma.schoolSettings),
    schoolSettingsCreate: anyPrisma.schoolSettings.create.bind(anyPrisma.schoolSettings),
    schoolSettingsFindUniqueOrThrow: anyPrisma.schoolSettings.findUniqueOrThrow.bind(anyPrisma.schoolSettings),
    periodDefinitionFindUnique: anyPrisma.periodDefinition.findUnique.bind(anyPrisma.periodDefinition),
    periodDefinitionFindMany: anyPrisma.periodDefinition.findMany.bind(anyPrisma.periodDefinition),
    periodDefinitionCreate: anyPrisma.periodDefinition.create.bind(anyPrisma.periodDefinition),
    periodDefinitionUpdate: anyPrisma.periodDefinition.update.bind(anyPrisma.periodDefinition),
    periodDefinitionUpdateMany: anyPrisma.periodDefinition.updateMany.bind(anyPrisma.periodDefinition),
    dailyScheduleFindUnique: anyPrisma.dailySchedule.findUnique.bind(anyPrisma.dailySchedule),
    dailyScheduleUpsert: anyPrisma.dailySchedule.upsert.bind(anyPrisma.dailySchedule),
    dailyScheduleUpdate: anyPrisma.dailySchedule.update.bind(anyPrisma.dailySchedule),
    dailyTeacherStatusDeleteMany: anyPrisma.dailyTeacherStatus.deleteMany.bind(anyPrisma.dailyTeacherStatus),
    dailyTeacherStatusCreateMany: anyPrisma.dailyTeacherStatus.createMany.bind(anyPrisma.dailyTeacherStatus),
    substitutionDeleteMany: anyPrisma.substitution.deleteMany.bind(anyPrisma.substitution),
    substitutionCreate: anyPrisma.substitution.create.bind(anyPrisma.substitution),
    substitutionFindFirst: anyPrisma.substitution.findFirst.bind(anyPrisma.substitution),
    substitutionUpdate: anyPrisma.substitution.update.bind(anyPrisma.substitution),
    baseScheduleSlotFindMany: anyPrisma.baseScheduleSlot.findMany.bind(anyPrisma.baseScheduleSlot),
    teacherFindMany: anyPrisma.teacher.findMany.bind(anyPrisma.teacher),
    teacherFindUnique: anyPrisma.teacher.findUnique.bind(anyPrisma.teacher),
    schoolClassFindMany: anyPrisma.schoolClass.findMany.bind(anyPrisma.schoolClass),
    dailyEventFindMany: anyPrisma.dailyEvent.findMany.bind(anyPrisma.dailyEvent),
    dutyAssignmentFindMany: anyPrisma.dutyAssignment.findMany.bind(anyPrisma.dutyAssignment),
    transaction: anyPrisma.$transaction.bind(anyPrisma)
  };

  const buildDailySchedule = (row: ScheduleState["dailySchedules"][number]) => ({
    ...row,
    statuses: state.dailyStatuses
      .filter((status) => status.dailyScheduleId === row.id)
      .map((status) => ({
        ...status,
        teacher: state.teachers.find((teacher) => teacher.id === status.teacherId) || null
      })),
    substitutions: state.substitutions
      .filter((substitution) => substitution.dailyScheduleId === row.id)
      .map((substitution) => ({
        ...substitution,
        dailySchedule: { id: row.id, schoolId: row.schoolId, date: row.date, day: row.day, updatedAt: row.updatedAt }
      })),
    events: state.dailyEvents.filter((event) => event.dailyScheduleId === row.id)
  });

  const buildSubstitution = (data: Record<string, any>) => {
    const row = {
      id: `sub-${state.substitutionIdSequence++}`,
      schoolId: data.schoolId,
      dailyScheduleId: data.dailyScheduleId,
      period: data.period,
      baseSlotId: data.baseSlotId,
      classId: data.classId,
      subjectId: data.subjectId,
      absentTeacherId: data.absentTeacherId,
      substituteTeacherId: data.substituteTeacherId ?? null,
      kind: data.kind,
      isManual: Boolean(data.isManual),
      note: data.note ?? null,
      class: state.classes.find((cls) => cls.id === data.classId) || { id: data.classId, name: data.classId },
      subject: {
        id: data.subjectId,
        name: state.baseSlots.find((slot) => slot.subjectId === data.subjectId)?.subject.name || data.subjectId
      },
      absentTeacher: state.teachers.find((teacher) => teacher.id === data.absentTeacherId) || null,
      substituteTeacher: data.substituteTeacherId
        ? state.teachers.find((teacher) => teacher.id === data.substituteTeacherId) || null
        : null,
      dailySchedule: (() => {
        const rowDaily = state.dailySchedules.find((daily) => daily.id === data.dailyScheduleId);
        return rowDaily
          ? {
              id: rowDaily.id,
              schoolId: rowDaily.schoolId,
              date: rowDaily.date,
              day: rowDaily.day,
              updatedAt: rowDaily.updatedAt
            }
          : { id: data.dailyScheduleId, schoolId: data.schoolId, date: "", day: "", updatedAt: new Date() };
      })()
    };
    state.substitutions.push(row);
    return row;
  };

  const baseScheduleFilter = (where: Record<string, any>) =>
    state.baseSlots.filter((slot) => {
      if (where.schoolId && slot.schoolId !== where.schoolId) return false;
      if (where.day && slot.day !== where.day) return false;
      const maxPeriod = where.period?.lte;
      if (typeof maxPeriod === "number" && slot.period > maxPeriod) return false;
      if (where.id?.in && !where.id.in.includes(slot.id)) return false;
      return true;
    });

  anyPrisma.schoolSettings.findUnique = async ({ where }: { where: { schoolId: string } }) =>
    state.settings.schoolId === where.schoolId ? { ...state.settings } : null;
  anyPrisma.schoolSettings.create = async ({ data }: { data: ScheduleState["settings"] }) => {
    state.settings = { ...data };
    return { ...state.settings };
  };
  anyPrisma.schoolSettings.findUniqueOrThrow = async ({ where }: { where: { schoolId: string } }) => {
    const settings = state.settings.schoolId === where.schoolId ? { ...state.settings } : null;
    if (!settings) throw new Error("school settings not found");
    return settings;
  };

  anyPrisma.periodDefinition.findUnique = async ({
    where
  }: {
    where: { schoolId_period: { schoolId: string; period: number } };
  }) =>
    state.periodDefinitions.find(
      (period) => period.schoolId === where.schoolId_period.schoolId && period.period === where.schoolId_period.period
    ) || null;
  anyPrisma.periodDefinition.findMany = async ({
    where
  }: {
    where?: { schoolId?: string; isActive?: boolean; period?: { lte?: number; gt?: number } };
  }) =>
    state.periodDefinitions.filter((period) => {
      if (where?.schoolId && period.schoolId !== where.schoolId) return false;
      if (typeof where?.isActive === "boolean" && period.isActive !== where.isActive) return false;
      if (typeof where?.period?.lte === "number" && period.period > where.period.lte) return false;
      if (typeof where?.period?.gt === "number" && period.period <= where.period.gt) return false;
      return true;
    });
  anyPrisma.periodDefinition.create = async ({
    data
  }: {
    data: { schoolId: string; period: number; label: string; isActive: boolean };
  }) => {
    const row = { id: `period-${state.periodIdSequence++}`, ...data, startTime: "", endTime: "" };
    state.periodDefinitions.push(row);
    return row;
  };
  anyPrisma.periodDefinition.update = async ({
    where,
    data
  }: {
    where: { id: string };
    data: Partial<ScheduleState["periodDefinitions"][number]>;
  }) => {
    const row = state.periodDefinitions.find((period) => period.id === where.id);
    if (!row) throw new Error("period not found");
    Object.assign(row, data);
    return row;
  };
  anyPrisma.periodDefinition.updateMany = async ({
    where,
    data
  }: {
    where: { schoolId: string; period?: { gt?: number } };
    data: Partial<ScheduleState["periodDefinitions"][number]>;
  }) => {
    let count = 0;
    for (const row of state.periodDefinitions) {
      if (row.schoolId !== where.schoolId) continue;
      if (typeof where.period?.gt === "number" && row.period <= where.period.gt) continue;
      Object.assign(row, data);
      count += 1;
    }
    return { count };
  };

  anyPrisma.dailySchedule.findUnique = async ({
    where
  }: {
    where: { schoolId_date: { schoolId: string; date: string } };
  }) => {
    const row = state.dailySchedules.find(
      (item) => item.schoolId === where.schoolId_date.schoolId && item.date === where.schoolId_date.date
    );
    return row ? buildDailySchedule(row) : null;
  };
  anyPrisma.dailySchedule.upsert = async ({
    where,
    update,
    create
  }: {
    where: { schoolId_date: { schoolId: string; date: string } };
    update: { day: string };
    create: { schoolId: string; date: string; day: string };
  }) => {
    const existing = state.dailySchedules.find(
      (item) => item.schoolId === where.schoolId_date.schoolId && item.date === where.schoolId_date.date
    );
    if (existing) {
      existing.day = update.day;
      existing.updatedAt = new Date(`2026-07-21T10:00:00.000Z`);
      return { ...existing };
    }
    const row = {
      id: `daily-${state.dailyScheduleIdSequence++}`,
      schoolId: create.schoolId,
      date: create.date,
      day: create.day,
      createdAt: new Date(`2026-07-21T09:00:00.000Z`),
      updatedAt: new Date(`2026-07-21T09:00:00.000Z`)
    };
    state.dailySchedules.push(row);
    return { ...row };
  };
  anyPrisma.dailySchedule.update = async ({ where, data }: { where: { id: string }; data: { updatedAt?: Date } }) => {
    const row = state.dailySchedules.find((item) => item.id === where.id);
    if (!row) throw new Error("daily schedule not found");
    Object.assign(row, data);
    return { ...row };
  };

  anyPrisma.dailyTeacherStatus.deleteMany = async ({
    where
  }: {
    where: { schoolId: string; dailyScheduleId: string };
  }) => {
    const before = state.dailyStatuses.length;
    state.dailyStatuses = state.dailyStatuses.filter(
      (status) => !(status.schoolId === where.schoolId && status.dailyScheduleId === where.dailyScheduleId)
    );
    return { count: before - state.dailyStatuses.length };
  };
  anyPrisma.dailyTeacherStatus.createMany = async ({
    data
  }: {
    data: Array<{
      schoolId: string;
      dailyScheduleId: string;
      teacherId: string;
      type: string;
      fromPeriod: number;
      toPeriod: number;
      reason?: string | null;
    }>;
  }) => {
    for (const item of data) {
      state.dailyStatuses.push({
        id: `status-${state.statusIdSequence++}`,
        schoolId: item.schoolId,
        dailyScheduleId: item.dailyScheduleId,
        teacherId: item.teacherId,
        type: item.type,
        fromPeriod: item.fromPeriod,
        toPeriod: item.toPeriod,
        reason: item.reason ?? null
      });
    }
    return { count: data.length };
  };

  anyPrisma.substitution.deleteMany = async ({ where }: { where: { schoolId: string; dailyScheduleId: string } }) => {
    const before = state.substitutions.length;
    state.substitutions = state.substitutions.filter(
      (substitution) =>
        !(substitution.schoolId === where.schoolId && substitution.dailyScheduleId === where.dailyScheduleId)
    );
    return { count: before - state.substitutions.length };
  };
  anyPrisma.substitution.create = async ({ data }: { data: Record<string, any> }) => buildSubstitution(data);
  anyPrisma.substitution.findFirst = async ({ where }: { where: { id?: string; schoolId?: string } }) => {
    const row = state.substitutions.find(
      (substitution) =>
        (where.id ? substitution.id === where.id : true) &&
        (where.schoolId ? substitution.schoolId === where.schoolId : true)
    );
    return row
      ? {
          ...row,
          dailySchedule: row.dailySchedule,
          class: row.class,
          subject: row.subject,
          absentTeacher: row.absentTeacher,
          substituteTeacher: row.substituteTeacher
        }
      : null;
  };
  anyPrisma.substitution.update = async ({
    where,
    data
  }: {
    where: { id: string };
    data: { substituteTeacherId: string | null; kind: string; isManual: boolean };
  }) => {
    const row = state.substitutions.find((substitution) => substitution.id === where.id);
    if (!row) throw new Error("substitution not found");
    row.substituteTeacherId = data.substituteTeacherId;
    row.kind = data.kind;
    row.isManual = data.isManual;
    row.substituteTeacher = data.substituteTeacherId
      ? state.teachers.find((teacher) => teacher.id === data.substituteTeacherId) || null
      : null;
    return {
      ...row,
      dailySchedule: row.dailySchedule,
      class: row.class,
      subject: row.subject,
      absentTeacher: row.absentTeacher,
      substituteTeacher: row.substituteTeacher
    };
  };

  anyPrisma.baseScheduleSlot.findMany = async ({
    where
  }: {
    where: { schoolId: string; day: string; period?: { lte?: number } };
  }) => baseScheduleFilter(where).map((slot) => ({ ...slot }));
  anyPrisma.teacher.findMany = async ({ where }: { where: { schoolId: string } }) =>
    state.teachers.filter((teacher) => teacher.schoolId === where.schoolId).map((teacher) => ({ ...teacher }));
  anyPrisma.teacher.findUnique = async ({ where }: { where: { id: string } }) =>
    state.teachers.find((teacher) => teacher.id === where.id) || null;
  anyPrisma.schoolClass.findMany = async ({ where }: { where: { schoolId: string; id?: { in?: string[] } } }) =>
    state.classes
      .filter((cls) => cls.schoolId === where.schoolId && (!where.id?.in || where.id.in.includes(cls.id)))
      .map((cls) => ({ ...cls }));
  anyPrisma.dailyEvent.findMany = async ({ where }: { where: { schoolId: string; dailyScheduleId: string } }) =>
    state.dailyEvents
      .filter((event) => event.schoolId === where.schoolId && event.dailyScheduleId === where.dailyScheduleId)
      .map((event) => ({ ...event }));
  anyPrisma.dutyAssignment.findMany = async ({
    where
  }: {
    where: { schoolId: string; day: string; isActive: boolean };
  }) =>
    state.dutyAssignments
      .filter((duty) => duty.schoolId === where.schoolId && duty.day === where.day && duty.isActive === where.isActive)
      .map((duty) => ({ ...duty }));

  anyPrisma.$transaction = async <T>(callback: (tx: never) => Promise<T>) =>
    callback({
      dailySchedule: anyPrisma.dailySchedule,
      dailyTeacherStatus: anyPrisma.dailyTeacherStatus,
      substitution: anyPrisma.substitution,
      baseScheduleSlot: anyPrisma.baseScheduleSlot,
      teacher: anyPrisma.teacher,
      schoolClass: anyPrisma.schoolClass,
      dailyEvent: anyPrisma.dailyEvent,
      periodDefinition: anyPrisma.periodDefinition,
      schoolSettings: anyPrisma.schoolSettings,
      dutyAssignment: anyPrisma.dutyAssignment
    } as never);

  return () => {
    anyPrisma.schoolSettings.findUnique = original.schoolSettingsFindUnique;
    anyPrisma.schoolSettings.create = original.schoolSettingsCreate;
    anyPrisma.schoolSettings.findUniqueOrThrow = original.schoolSettingsFindUniqueOrThrow;
    anyPrisma.periodDefinition.findUnique = original.periodDefinitionFindUnique;
    anyPrisma.periodDefinition.findMany = original.periodDefinitionFindMany;
    anyPrisma.periodDefinition.create = original.periodDefinitionCreate;
    anyPrisma.periodDefinition.update = original.periodDefinitionUpdate;
    anyPrisma.periodDefinition.updateMany = original.periodDefinitionUpdateMany;
    anyPrisma.dailySchedule.findUnique = original.dailyScheduleFindUnique;
    anyPrisma.dailySchedule.upsert = original.dailyScheduleUpsert;
    anyPrisma.dailySchedule.update = original.dailyScheduleUpdate;
    anyPrisma.dailyTeacherStatus.deleteMany = original.dailyTeacherStatusDeleteMany;
    anyPrisma.dailyTeacherStatus.createMany = original.dailyTeacherStatusCreateMany;
    anyPrisma.substitution.deleteMany = original.substitutionDeleteMany;
    anyPrisma.substitution.create = original.substitutionCreate;
    anyPrisma.substitution.findFirst = original.substitutionFindFirst;
    anyPrisma.substitution.update = original.substitutionUpdate;
    anyPrisma.baseScheduleSlot.findMany = original.baseScheduleSlotFindMany;
    anyPrisma.teacher.findMany = original.teacherFindMany;
    anyPrisma.teacher.findUnique = original.teacherFindUnique;
    anyPrisma.schoolClass.findMany = original.schoolClassFindMany;
    anyPrisma.dailyEvent.findMany = original.dailyEventFindMany;
    anyPrisma.dutyAssignment.findMany = original.dutyAssignmentFindMany;
    anyPrisma.$transaction = original.transaction;
  };
}

test("daily schedule substitution planning stays stable across manual and auto-picked substitutes", async () => {
  const created: Array<{
    baseSlotId: string;
    substituteTeacherId: string | null;
    isManual: boolean;
    kind: string;
  }> = [];

  const fakeDb = {
    baseScheduleSlot: {
      findMany: async () => [
        {
          id: "slot-1",
          period: 1,
          teacherId: "teacher-a",
          classId: "class-10a",
          subjectId: "math",
          teacher: { id: "teacher-a", name: "المعلم الغائب" },
          class: { name: "العاشر أ" },
          subject: { name: "رياضيات" }
        },
        {
          id: "slot-2",
          period: 2,
          teacherId: "teacher-a",
          classId: "class-10a",
          subjectId: "math",
          teacher: { id: "teacher-a", name: "المعلم الغائب" },
          class: { name: "العاشر أ" },
          subject: { name: "رياضيات" }
        },
        {
          id: "slot-3",
          period: 3,
          teacherId: "teacher-a",
          classId: "class-10a",
          subjectId: "math",
          teacher: { id: "teacher-a", name: "المعلم الغائب" },
          class: { name: "العاشر أ" },
          subject: { name: "رياضيات" }
        }
      ]
    },
    teacher: {
      findMany: async () => [
        {
          id: "teacher-b",
          name: "المعلم البديل",
          assignments: [
            {
              classId: "class-10a",
              subjectId: "math",
              class: { name: "العاشر أ" },
              subject: { name: "رياضيات" }
            }
          ]
        },
        {
          id: "teacher-c",
          name: "معلم متفرغ",
          assignments: [
            {
              classId: "class-10a",
              subjectId: "math",
              class: { name: "العاشر أ" },
              subject: { name: "رياضيات" }
            }
          ]
        }
      ]
    },
    dailyEvent: {
      findMany: async () => [{ classId: "class-10a", fromPeriod: 2, toPeriod: 2 }]
    },
    substitution: {
      create: async ({
        data
      }: {
        data: { baseSlotId: string; substituteTeacherId: string | null; isManual: boolean; kind: string };
      }) => {
        created.push(data);
        return { ...data } as never;
      }
    }
  } as never;

  const result = await generateSubstitutions({
    schoolId: "school-a",
    dailyScheduleId: "daily-a",
    day: "الاثنين",
    statuses: [{ teacherId: "teacher-a", type: "ABSENT", fromPeriod: 1, toPeriod: 3 }],
    manualSubstitutions: [{ baseScheduleSlotId: "slot-1", substituteTeacherId: "teacher-b" }],
    settings: { periodsPerDay: 7 },
    db: fakeDb
  });

  assert.equal(created.length, 2);
  assert.equal(result.length, 2);
  assert.equal(result[0].baseSlotId, "slot-1");
  assert.equal(result[0].substituteTeacherId, "teacher-b");
  assert.equal(result[0].isManual, true);
  assert.equal(result[1].baseSlotId, "slot-3");
  assert.notEqual(result[1].substituteTeacherId, null);
  assert.equal(result[1].isManual, false);
  assert.equal(
    created.some((row) => row.baseSlotId === "slot-2"),
    false,
    "covered event slots should not create substitutions"
  );
});

test("daily schedule and archive flows keep upsert, rebuild, and snapshot reuse behavior wired together", () => {
  const scheduleSource = readFileSync("src/services/scheduleCoordinator.ts", "utf8");
  const archiveSource = readFileSync("src/modules/archive/archive.routes.ts", "utf8");
  const reportsSource = readFileSync("src/modules/reports/reports.routes.ts", "utf8");

  assert.match(scheduleSource, /dailySchedule\.upsert\(/, "daily generation should keep using a stable daily row");
  assert.match(
    scheduleSource,
    /dailyTeacherStatus\.deleteMany\(/,
    "daily generation should clear the previous status set"
  );
  assert.match(
    scheduleSource,
    /substitution\.deleteMany\(/,
    "daily generation should clear the previous substitution set"
  );
  assert.match(
    scheduleSource,
    /dailyTeacherStatus\.createMany\(/,
    "daily generation should rewrite the active status rows"
  );
  assert.match(scheduleSource, /generateSubstitutions\(/, "daily generation should still feed the substitution engine");
  assert.match(
    scheduleSource,
    /dailyEvent\.findFirst\(\{/,
    "daily event creation should update-or-create matching rows"
  );

  assert.match(
    archiveSource,
    /existingSnapshot && archivedUpdatedAt === currentUpdatedAt/,
    "archive saves should reuse the snapshot when nothing changed"
  );
  assert.match(archiveSource, /ARCHIVE_DAY/, "archive saves should still be tracked in audit logs");
  assert.match(archiveSource, /recordAuditLog\(prisma,/, "archive operations should stay logged");

  assert.match(reportsSource, /reportsRouter\.get\("\/security"/, "security report route should stay available");
  assert.match(reportsSource, /reportsRouter\.get\("\/attendance"/, "attendance report route should stay available");
  assert.match(reportsSource, /reportsRouter\.get\("\/grades"/, "grades report route should stay available");
  assert.match(
    reportsSource,
    /reportsRouter\.get\("\/classroom-logs"/,
    "classroom logs report route should stay available"
  );
  assert.match(
    reportsSource,
    /createReportExportRecord\(prisma,/,
    "export actions should stay written to artifact records"
  );
});

test("daily schedule generation rewrites the same daily row, trims long days, and keeps teacher programs aligned", async () => {
  const state = createScheduleState();
  const restore = installScheduleState(state);

  try {
    const firstResult = await generateDailyScheduleFromRules("school-a", {
      date: "2026-07-20",
      day: "الاثنين",
      statuses: [
        { teacherId: "teacher-a", type: "ABSENT", fromPeriod: 2, toPeriod: 3, reason: "مرض" },
        { teacherId: "teacher-b", type: "UNAVAILABLE", fromPeriod: 3, toPeriod: 3, reason: "مناوبة" }
      ],
      manualSubstitutions: [{ baseScheduleSlotId: "slot-2", substituteTeacherId: "teacher-b" }]
    });

    if ("error" in firstResult) {
      const firstError = firstResult.error;
      assert.ok(firstError);
      assert.fail(firstError.body ? JSON.stringify(firstError.body) : "unexpected daily schedule error");
    }

    assert.equal(firstResult.data.daily.id, "daily-1");
    assert.equal(firstResult.data.baseSlots.length, 3, "periods after the configured day length should be trimmed");
    assert.equal(firstResult.data.duties.length, 2, "duty rows should still be returned");
    assert.equal(firstResult.data.duties[0].affected, true, "overlapping duty should be marked as affected");
    assert.equal(firstResult.data.duties[1].affected, false, "non-overlapping duty should stay clear");
    assert.equal(state.dailySchedules.length, 1, "daily schedule should reuse the same row");
    assert.equal(state.dailyStatuses.length, 2, "daily statuses should be rewritten, not duplicated");
    assert.equal(state.substitutions.length, 2, "each affected lesson should still create only one substitution row");

    const teacherPrograms = await buildTeacherDailyPrograms({ schoolId: "school-a", date: "2026-07-20" });
    assert.ok(teacherPrograms);
    assert.equal(teacherPrograms?.daily.day, "الاثنين");

    const teacherAProgram = teacherPrograms?.programs.find((program) => program.teacherId === "teacher-a");
    const teacherBProgram = teacherPrograms?.programs.find((program) => program.teacherId === "teacher-b");
    const teacherCProgram = teacherPrograms?.programs.find((program) => program.teacherId === "teacher-c");

    assert.ok(teacherAProgram);
    assert.ok(teacherBProgram);
    assert.ok(teacherCProgram);
    assert.match(teacherAProgram!.status || "", /مرض/, "teacher status summary should keep the daily reason");
    assert.equal(teacherAProgram!.lessons.filter((lesson) => lesson.lessonType === "ORIGINAL").length, 1);
    assert.equal(teacherAProgram!.lessons.filter((lesson) => lesson.lessonType === "UNAVAILABLE_ORIGINAL").length, 2);
    assert.equal(teacherAProgram!.totalOriginalLessons, 1);
    assert.equal(teacherAProgram!.totalSubstitutions, 0);
    assert.equal(teacherBProgram!.lessons.filter((lesson) => lesson.lessonType === "SUBSTITUTION").length, 1);
    assert.equal(teacherCProgram!.lessons.filter((lesson) => lesson.lessonType === "SUBSTITUTION").length, 1);

    const manualEdit = await updateDailySubstitutionTeacher("school-a", state.substitutions[0].id, "teacher-c");
    if ("error" in manualEdit) {
      const manualEditError = manualEdit.error;
      assert.ok(manualEditError);
      assert.fail(manualEditError.body ? JSON.stringify(manualEditError.body) : "unexpected substitution update error");
    }
    assert.equal(manualEdit.data.isManual, true);
    assert.equal(manualEdit.data.substituteTeacherId, "teacher-c");

    const secondResult = await generateDailyScheduleFromRules("school-a", {
      date: "2026-07-20",
      day: "الاثنين",
      statuses: [{ teacherId: "teacher-a", type: "LEFT", fromPeriod: 1, toPeriod: 1, reason: "انصراف مبكر" }]
    });

    if ("error" in secondResult) {
      const secondError = secondResult.error;
      assert.ok(secondError);
      assert.fail(secondError.body ? JSON.stringify(secondError.body) : "unexpected daily schedule error");
    }

    assert.equal(secondResult.data.daily.id, "daily-1", "rebuilding the same day should keep the same daily row");
    assert.equal(state.dailySchedules.length, 1, "rebuilding should not create a second daily row");
    assert.equal(state.dailyStatuses.length, 1, "rebuilding should replace the previous status rows");
    assert.equal(state.substitutions.length, 1, "rebuilding should replace the previous substitution rows");
  } finally {
    restore();
  }
});

test("daily schedule generation rejects off-days with a clear error", async () => {
  const state = createScheduleState();
  const restore = installScheduleState(state);

  try {
    const result = await generateDailyScheduleFromRules("school-a", {
      date: "2026-07-19",
      day: "الأحد",
      statuses: []
    });

    assert.ok("error" in result);
    if (!("error" in result)) {
      assert.fail("expected an error result for the off-day");
    }
    const offDayError = result.error;
    assert.ok(offDayError);
    assert.equal(offDayError.status, 400);
    assert.equal(offDayError.body.error, "INVALID_WORKING_DAY");
    assert.match(String(offDayError.body.message), /الأحد/);
    assert.equal(state.dailySchedules.length, 0, "off-day validation should stop before creating a daily row");
  } finally {
    restore();
  }
});

test("archive free teacher rows keep busy and unavailable teachers out of the available list", () => {
  const archiveSource = readFileSync("src/modules/archive/archive.routes.ts", "utf8");

  assert.match(archiveSource, /const freeTeachers = periods\.map\(period => \{/);
  assert.match(archiveSource, /!busy\.has\(teacher\.id\) && !unavailable\.has\(teacher\.id\)/);
  assert.match(archiveSource, /busy\.add\(sub\.substituteTeacherId!\)/);
});
