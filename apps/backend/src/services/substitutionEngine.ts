import { prisma } from "../db/prisma";
import { Prisma, SubstitutionKind, TeacherStatusType, type PrismaClient } from "@prisma/client";
import { ensureSchoolSettings } from "./schoolSettings";
import {
  classifySubstitutionCandidate,
  isEventCoveredSlot,
  isTeacherBusyInPeriod,
  statusReason,
  substitutionKindWeight
} from "./scheduleRules";

type ManualSubstitution = {
  baseScheduleSlotId: string;
  substituteTeacherId: string | null;
};

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function generateSubstitutions(params: {
  schoolId: string;
  dailyScheduleId: string;
  day: string;
  statuses: Array<{
    teacherId: string;
    type: TeacherStatusType;
    fromPeriod: number;
    toPeriod: number;
    reason?: string | null;
  }>;
  manualSubstitutions?: ManualSubstitution[];
  settings?: { periodsPerDay: number };
  db?: DbClient;
}) {
  const { schoolId, dailyScheduleId, day, statuses, manualSubstitutions = [], db = prisma } = params;

  const settings = params.settings || (await ensureSchoolSettings(schoolId));

  const baseSlots = await db.baseScheduleSlot.findMany({
    where: { schoolId, day, period: { lte: settings.periodsPerDay } },
    select: {
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
      }
    }
  });

  const teachers = await db.teacher.findMany({
    where: { schoolId },
    select: {
      id: true,
      schoolId: true,
      name: true,
      assignments: {
        select: {
          classId: true,
          subjectId: true,
          class: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });

  const manualBySlot = new Map(manualSubstitutions.map((item) => [item.baseScheduleSlotId, item.substituteTeacherId]));

  const dailyEvents = await db.dailyEvent.findMany({ where: { schoolId, dailyScheduleId } });
  const eventCoveredSlots = new Set(
    baseSlots.filter((slot) => isEventCoveredSlot(slot, dailyEvents)).map((slot) => slot.id)
  );

  const affectedSlots = baseSlots.filter(
    (slot) =>
      !eventCoveredSlots.has(slot.id) &&
      statuses.some(
        (status) =>
          status.teacherId === slot.teacherId && slot.period >= status.fromPeriod && slot.period <= status.toPeriod
      )
  );

  const created = [];
  const usedByPeriod = new Map<number, Set<string>>();

  for (const slot of affectedSlots) {
    if (!usedByPeriod.has(slot.period)) usedByPeriod.set(slot.period, new Set());
    const used = usedByPeriod.get(slot.period)!;

    const manualTeacherId = manualBySlot.get(slot.id);
    let selectedTeacherId: string | null = null;
    let kind: SubstitutionKind = "NO_SUBSTITUTE";
    let isManual = false;

    const unavailableTeacherIds = new Set(
      statuses
        .filter((status) => slot.period >= status.fromPeriod && slot.period <= status.toPeriod)
        .map((status) => status.teacherId)
    );

    const isActuallyFree = (teacherId: string) =>
      teacherId !== slot.teacherId &&
      !unavailableTeacherIds.has(teacherId) &&
      !isTeacherBusyInPeriod(teacherId, slot.period, baseSlots, eventCoveredSlots) &&
      !used.has(teacherId);

    const classify = (teacher: (typeof teachers)[number]): SubstitutionKind =>
      classifySubstitutionCandidate(teacher, slot);

    if (manualTeacherId) {
      const teacher = teachers.find((item) => item.id === manualTeacherId);
      if (teacher && isActuallyFree(teacher.id)) {
        selectedTeacherId = teacher.id;
        kind = classify(teacher);
        isManual = true;
      }
    }

    if (!selectedTeacherId) {
      const candidates = teachers
        .filter((teacher) => isActuallyFree(teacher.id))
        .map((teacher) => ({ teacher, kind: classify(teacher) }));

      candidates.sort((left, right) => substitutionKindWeight[left.kind] - substitutionKindWeight[right.kind]);

      if (candidates[0]) {
        selectedTeacherId = candidates[0].teacher.id;
        kind = candidates[0].kind;
      }
    }

    if (selectedTeacherId) used.add(selectedTeacherId);

    const status = statuses.find(
      (item) => item.teacherId === slot.teacherId && slot.period >= item.fromPeriod && slot.period <= item.toPeriod
    );

    created.push(
      await db.substitution.create({
        data: {
          schoolId,
          dailyScheduleId,
          period: slot.period,
          baseSlotId: slot.id,
          classId: slot.classId,
          subjectId: slot.subjectId,
          absentTeacherId: slot.teacherId,
          substituteTeacherId: selectedTeacherId,
          kind,
          isManual,
          note: status ? status.reason || statusReason(status.type, status.fromPeriod, status.toPeriod) : null
        },
        include: {
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
            select: {
              id: true,
              name: true,
              specialty: true
            }
          },
          substituteTeacher: {
            select: {
              id: true,
              name: true,
              specialty: true
            }
          }
        }
      })
    );
  }

  return created;
}
