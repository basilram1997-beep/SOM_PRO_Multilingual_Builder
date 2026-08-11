import { prisma } from "../db/prisma";
import { ensureSchoolSettings } from "./schoolSettings";

type DutyStatus = {
  teacherId: string;
  type: string;
  fromPeriod: number;
  toPeriod: number;
  reason?: string | null;
};

type PeriodTime = {
  period: number;
  startTime?: string | null;
  endTime?: string | null;
};

function dutyStatusLabel(type: string) {
  if (type === "ABSENT") return "غياب";
  if (type === "LATE") return "تأخر";
  if (type === "LEFT") return "مغادرة";
  if (type === "UNAVAILABLE") return "في مهمة";
  return type;
}

function timeToMinutes(value?: string | null) {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

export function dutyOverlapsStatus(
  duty: { startTime: string; endTime: string },
  status: DutyStatus,
  periodDefinitions: PeriodTime[],
  periodsPerDay: number
) {
  const dutyStart = timeToMinutes(duty.startTime);
  const dutyEnd = timeToMinutes(duty.endTime);
  if (dutyStart == null || dutyEnd == null || dutyEnd <= dutyStart) {
    return status.fromPeriod <= 1 && status.toPeriod >= periodsPerDay;
  }

  const affectedPeriods = periodDefinitions.filter(
    (period) => period.period >= status.fromPeriod && period.period <= status.toPeriod
  );
  const timedPeriods = affectedPeriods
    .map((period) => ({ start: timeToMinutes(period.startTime), end: timeToMinutes(period.endTime) }))
    .filter(
      (period): period is { start: number; end: number } =>
        period.start != null && period.end != null && period.end > period.start
    );

  if (timedPeriods.length === 0) {
    return status.fromPeriod <= 1 && status.toPeriod >= periodsPerDay;
  }

  return timedPeriods.some((period) => rangesOverlap(dutyStart, dutyEnd, period.start, period.end));
}

export async function buildDailyDutyRows(
  schoolId: string,
  date: string,
  fallbackDay?: string,
  knownStatuses?: DutyStatus[]
) {
  const daily =
    knownStatuses && fallbackDay
      ? null
      : await prisma.dailySchedule.findUnique({
          where: { schoolId_date: { schoolId, date } },
          select: {
            day: true,
            statuses: {
              select: {
                teacherId: true,
                type: true,
                fromPeriod: true,
                toPeriod: true,
                reason: true
              }
            }
          }
        });
  const day = daily?.day || fallbackDay;
  if (!day) return [];

  const settings = await ensureSchoolSettings(schoolId);
  const [duties, periodDefinitions] = await Promise.all([
    prisma.dutyAssignment.findMany({
      where: { schoolId, day, isActive: true },
      select: {
        id: true,
        day: true,
        startTime: true,
        endTime: true,
        place: true,
        notes: true,
        teacherId: true,
        teacher: {
          select: {
            id: true,
            name: true,
            specialty: true
          }
        }
      },
      orderBy: [{ startTime: "asc" }, { endTime: "asc" }, { place: "asc" }]
    }),
    prisma.periodDefinition.findMany({
      where: { schoolId, isActive: true, period: { lte: settings.periodsPerDay } },
      orderBy: { period: "asc" }
    })
  ]);

  const statuses = knownStatuses || daily?.statuses || [];
  return duties.map((duty) => {
    const teacherStatuses = statuses.filter(
      (status) =>
        status.teacherId === duty.teacherId &&
        dutyOverlapsStatus(duty, status, periodDefinitions, settings.periodsPerDay)
    );
    const affected = teacherStatuses.length > 0;
    return {
      ...duty,
      affected,
      teacherStatuses,
      affectedReason: affected ? teacherStatuses.map((status) => dutyStatusLabel(status.type)).join(" / ") : null
    };
  });
}
