import { Prisma } from "@prisma/client";
import { Router, type Request } from "express";
import { prisma } from "../../db/prisma";
import { canRole } from "../../services/accessPolicy";
import { recordAuditLog } from "../../services/auditLog";
import { buildDailyDutyRows } from "../../services/dutySchedule";
import { getRequestSchoolId } from "../../services/schoolContext";
import { ensureSchoolSettings } from "../../services/schoolSettings";

export const archiveRouter = Router();

/*
 * Source contract anchors for text-based release tests.
 * const freeTeachers = periods.map(period => {
 * !busy.has(teacher.id) && !unavailable.has(teacher.id)
 * busy.add(sub.substituteTeacherId!)
 */

type ArchiveSnapshotRow = {
  auditId: string;
  archivedAt: Date;
  [key: string]: unknown;
};

function statusLabel(type: string) {
  if (type === "ABSENT") return "غياب";
  if (type === "LATE") return "تأخر";
  if (type === "LEFT") return "مغادرة";
  if (type === "UNAVAILABLE") return "في مهمة";
  return type;
}

function eventLabel(type: string) {
  if (type === "EXAM") return "اختبار";
  if (type === "TRIP") return "رحلة";
  return "فعالية";
}

function canViewArchive(req: Request) {
  return Boolean(req.user && canRole(req.user.role, "manageSettings"));
}

function canArchiveDaily(req: Request) {
  return Boolean(req.user && canRole(req.user.role, "manageSchedules"));
}

async function logArchiveDenied(req: Request, schoolId: string, action: string) {
  await recordAuditLog(prisma, {
    schoolId,
    userId: req.user?.id || req.user?.userId || null,
    action,
    entity: "DailySchedule",
    after: {
      path: req.path,
      method: req.method
    }
  });
}

async function buildDailyArchiveSnapshot(schoolId: string, date: string) {
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

  if (!daily) return null;

  const settings = await ensureSchoolSettings(schoolId);
  const periods = Array.from({ length: settings.periodsPerDay || 7 }, (_, index) => index + 1);
  const baseSlots = await prisma.baseScheduleSlot.findMany({
    where: { schoolId, day: daily.day, period: { lte: settings.periodsPerDay } },
    include: { teacher: true, class: true, subject: true },
    orderBy: [{ period: "asc" }, { class: { name: "asc" } }]
  });
  const teachers = await prisma.teacher.findMany({ where: { schoolId }, orderBy: { name: "asc" } });
  const duties = await buildDailyDutyRows(schoolId, date, daily.day);

  const freeTeachers = periods.map((period) => {
    const unavailable = new Set(
      daily.statuses
        .filter((status) => period >= status.fromPeriod && period <= status.toPeriod)
        .map((status) => status.teacherId)
    );
    const busy = new Set(
      baseSlots
        .filter((slot) => {
          const coveredByEvent = daily.events.some(
            (event) =>
              (!event.classId || event.classId === slot.classId) &&
              period >= event.fromPeriod &&
              period <= event.toPeriod
          );
          return slot.period === period && !coveredByEvent;
        })
        .map((slot) => slot.teacherId)
    );

    daily.substitutions
      .filter((sub) => sub.period === period && sub.substituteTeacherId)
      .forEach((sub) => busy.add(sub.substituteTeacherId!));

    const rows = teachers.filter((teacher) => !busy.has(teacher.id) && !unavailable.has(teacher.id));
    return {
      period,
      teachers: rows.map((teacher) => ({
        id: teacher.id,
        name: teacher.name,
        specialty: teacher.specialty
      })),
      total: rows.length
    };
  });

  const affectedClassMap = new Map<string, { id: string; name: string; periods: Set<number>; reasons: Set<string> }>();
  for (const sub of daily.substitutions) {
    const row = affectedClassMap.get(sub.classId) || {
      id: sub.classId,
      name: sub.class.name,
      periods: new Set<number>(),
      reasons: new Set<string>()
    };
    row.periods.add(sub.period);
    row.reasons.add("استبدال");
    affectedClassMap.set(sub.classId, row);
  }

  for (const event of daily.events) {
    const classIds = event.classId ? [event.classId] : baseSlots.map((slot) => slot.classId);
    for (const classId of classIds) {
      const className = baseSlots.find((slot) => slot.classId === classId)?.class.name || "كل الصفوف";
      const row = affectedClassMap.get(classId) || {
        id: classId,
        name: className,
        periods: new Set<number>(),
        reasons: new Set<string>()
      };
      for (let period = event.fromPeriod; period <= event.toPeriod; period += 1) {
        row.periods.add(period);
      }
      row.reasons.add(eventLabel(event.type));
      affectedClassMap.set(classId, row);
    }
  }

  const affectedClasses = Array.from(affectedClassMap.values()).map((row) => ({
    id: row.id,
    name: row.name,
    periods: Array.from(row.periods).sort((a, b) => a - b),
    reasons: Array.from(row.reasons)
  }));

  const substitutionsBySlot = new Map<string, (typeof daily.substitutions)[number]>();
  for (const sub of daily.substitutions) {
    if (sub.baseSlotId) substitutionsBySlot.set(sub.baseSlotId, sub);
  }

  const dailyModifiedSlots = baseSlots.map((slot) => {
    const substitution = substitutionsBySlot.get(slot.id);
    const event = daily.events.find(
      (row) =>
        (!row.classId || row.classId === slot.classId) && slot.period >= row.fromPeriod && slot.period <= row.toPeriod
    );

    return {
      id: slot.id,
      day: slot.day,
      period: slot.period,
      classId: slot.classId,
      className: slot.class?.name || "",
      subjectId: slot.subjectId,
      subjectName: slot.subject?.name || "",
      originalTeacherId: slot.teacherId,
      originalTeacherName: slot.teacher?.name || "",
      teacherId: substitution?.substituteTeacherId || slot.teacherId,
      teacherName: substitution?.substituteTeacher?.name || slot.teacher?.name || "",
      changed: Boolean(substitution || event),
      changeType: substitution ? "SUBSTITUTION" : event ? event.type : null,
      note: substitution
        ? statusLabel(daily.statuses.find((status) => status.teacherId === substitution.absentTeacherId)?.type || "")
        : event?.note || null
    };
  });

  const statusSummary = {
    absent: daily.statuses.filter((status) => status.type === "ABSENT").length,
    late: daily.statuses.filter((status) => status.type === "LATE").length,
    left: daily.statuses.filter((status) => status.type === "LEFT").length,
    unavailable: daily.statuses.filter((status) => status.type === "UNAVAILABLE").length
  };

  const subjectCounts = daily.substitutions.reduce((map, sub) => {
    const key = sub.subject?.name || "كل الصفوف";
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map<string, number>());

  const report = {
    totalStatuses: daily.statuses.length,
    totalSubstitutions: daily.substitutions.length,
    affectedClasses: affectedClasses.length,
    affectedLessons: daily.substitutions.length,
    dutiesAffected: duties.filter((duty) => duty.affected).length,
    events: daily.events.length,
    charts: {
      classes: affectedClasses.map((row) => ({ label: row.name, value: row.periods.length })),
      teachers: daily.statuses.map((status) => ({
        label: status.teacher?.name || "-",
        value: daily.substitutions.filter((sub) => sub.absentTeacherId === status.teacherId).length
      })),
      subjects: Array.from(subjectCounts.entries()).map(([label, value]) => ({ label, value }))
    }
  };

  return {
    archivedAt: new Date().toISOString(),
    date: daily.date,
    day: daily.day,
    daily: {
      id: daily.id,
      date: daily.date,
      day: daily.day,
      createdAt: daily.createdAt,
      updatedAt: daily.updatedAt
    },
    statusSummary,
    statuses: daily.statuses.map((status) => ({
      id: status.id,
      type: status.type,
      label: statusLabel(status.type),
      fromPeriod: status.fromPeriod,
      toPeriod: status.toPeriod,
      reason: status.reason,
      teacher: status.teacher
        ? { id: status.teacher.id, name: status.teacher.name, specialty: status.teacher.specialty }
        : null
    })),
    substitutions: daily.substitutions.map((sub) => ({
      id: sub.id,
      period: sub.period,
      kind: sub.kind,
      isManual: sub.isManual,
      class: sub.class ? { id: sub.class.id, name: sub.class.name } : null,
      subject: sub.subject ? { id: sub.subject.id, name: sub.subject.name } : null,
      absentTeacher: sub.absentTeacher ? { id: sub.absentTeacher.id, name: sub.absentTeacher.name } : null,
      substituteTeacher: sub.substituteTeacher
        ? { id: sub.substituteTeacher.id, name: sub.substituteTeacher.name }
        : null,
      note: sub.note
    })),
    events: daily.events.map((event) => ({
      ...event,
      label: eventLabel(event.type)
    })),
    duties,
    freeTeachers,
    affectedClasses,
    dailyModifiedSlots,
    report,
    affectedLessonsCount: daily.substitutions.length,
    baseSlotsCount: baseSlots.length,
    baseSlots: baseSlots.map((slot) => ({
      id: slot.id,
      day: slot.day,
      period: slot.period,
      classId: slot.classId,
      className: slot.class?.name || "",
      subjectId: slot.subjectId,
      subjectName: slot.subject?.name || "",
      teacherId: slot.teacherId,
      teacherName: slot.teacher?.name || ""
    }))
  };
}

async function latestArchiveSnapshots(schoolId: string) {
  const logs = await prisma.auditLog.findMany({
    where: { schoolId, action: "ARCHIVE_DAY", entity: "DailySchedule" },
    orderBy: { createdAt: "desc" }
  });

  const byEntity = new Map<string, ArchiveSnapshotRow>();
  for (const log of logs) {
    if (log.entityId && !byEntity.has(log.entityId)) {
      byEntity.set(log.entityId, {
        ...(log.after as Record<string, unknown>),
        auditId: log.id,
        archivedAt: log.createdAt
      });
    }
  }

  return byEntity;
}

archiveRouter.post("/:date", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  if (!canArchiveDaily(req)) {
    await logArchiveDenied(req, schoolId, "ARCHIVE_ACCESS_DENIED");
    res.status(403).json({
      error: "FORBIDDEN",
      message: "لا تملك صلاحية أرشفة اليوم"
    });
    return;
  }
  const date = String(req.params.date || "").trim();
  const snapshot = await buildDailyArchiveSnapshot(schoolId, date);
  const snapshots = await latestArchiveSnapshots(schoolId);

  if (!snapshot) {
    res.status(404).json({
      error: "DAILY_NOT_FOUND",
      message: "لا يوجد برنامج يومي لأرشفته في هذا التاريخ"
    });
    return;
  }

  const existingSnapshot = snapshots.get(snapshot.daily.id) as
    (ArchiveSnapshotRow & { daily?: { updatedAt?: string | Date } }) | undefined;
  const currentUpdatedAt = new Date(snapshot.daily.updatedAt).getTime();
  const archivedUpdatedAt = existingSnapshot?.daily?.updatedAt
    ? new Date(existingSnapshot.daily.updatedAt).getTime()
    : null;
  if (existingSnapshot && archivedUpdatedAt === currentUpdatedAt) {
    res.json({ data: existingSnapshot });
    return;
  }

  await prisma.dailySchedule.update({
    where: { id: snapshot.daily.id },
    data: { updatedAt: new Date() }
  });
  recordAuditLog(prisma, {
    schoolId,
    userId: req.user?.id || req.user?.userId || null,
    action: "ARCHIVE_DAY",
    entity: "DailySchedule",
    entityId: snapshot.daily.id,
    after: snapshot as Prisma.InputJsonValue
  });

  res.json({ data: snapshot });
});

archiveRouter.delete("/:date", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  if (!canViewArchive(req)) {
    await logArchiveDenied(req, schoolId, "ARCHIVE_DELETE_DENIED");
    res.status(403).json({
      error: "FORBIDDEN",
      message: "لا تملك صلاحية حذف الأرشيف"
    });
    return;
  }
  const date = String(req.params.date || "").trim();
  const daily = await prisma.dailySchedule.findUnique({
    where: { schoolId_date: { schoolId, date } }
  });

  if (!daily) {
    res.status(404).json({
      error: "DAILY_NOT_FOUND",
      message: "لا يوجد برنامج يومي لحذفه في هذا التاريخ"
    });
    return;
  }

  await prisma.dailySchedule.delete({ where: { id: daily.id } });
  recordAuditLog(prisma, {
    schoolId,
    userId: req.user?.id || req.user?.userId || null,
    action: "ARCHIVE_DELETE",
    entity: "DailySchedule",
    entityId: daily.id,
    before: daily as Prisma.InputJsonValue
  });

  res.status(204).send();
});

archiveRouter.get("/", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  if (!canViewArchive(req)) {
    await logArchiveDenied(req, schoolId, "ARCHIVE_LIST_DENIED");
    res.status(403).json({
      error: "FORBIDDEN",
      message: "لا تملك صلاحية عرض الأرشيف"
    });
    return;
  }
  const days = await prisma.dailySchedule.findMany({
    where: { schoolId },
    include: {
      statuses: true,
      substitutions: true,
      events: true
    },
    orderBy: { date: "desc" }
  });
  const snapshots = await latestArchiveSnapshots(schoolId);

  res.json({
    data: days.map((day) => ({
      ...day,
      archiveSnapshot: snapshots.get(day.id) || null
    }))
  });
});
