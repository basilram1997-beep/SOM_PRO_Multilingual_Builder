import { Router } from "express";
import { prisma } from "../db/prisma";
import { getRequestSchoolId } from "../services/schoolContext";
import { ensureSchoolSettings } from "../services/schoolSettings";

export const statsRouter = Router();

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

statsRouter.get("/", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const date = String(req.query.date || todayIso());
  const settings = await ensureSchoolSettings(schoolId);
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  const teacherIds = (await prisma.teacher.findMany({ where: { schoolId }, select: { id: true } })).map((t) => t.id);

  const [teachers, classes, subjects, baseSlots, assignments, archiveDays, homeroomAssignments, daily] =
    await Promise.all([
      prisma.teacher.count({ where: { schoolId } }),
      prisma.schoolClass.count({ where: { schoolId } }),
      prisma.subject.count({ where: { schoolId } }),
      prisma.baseScheduleSlot.count({ where: { schoolId } }),
      prisma.teacherAssignment.count({ where: { teacherId: { in: teacherIds } } }),
      prisma.dailySchedule.count({ where: { schoolId } }),
      prisma.homeroomAssignment.count({ where: { schoolId } }),
      prisma.dailySchedule.findUnique({
        where: { schoolId_date: { schoolId, date } },
        include: { statuses: true, substitutions: true }
      })
    ]);

  const absent = daily?.statuses.filter((s) => s.type === "ABSENT").length || 0;
  const late = daily?.statuses.filter((s) => s.type === "LATE").length || 0;
  const left = daily?.statuses.filter((s) => s.type === "LEFT").length || 0;
  const substitutions = daily?.substitutions.length || 0;
  const affectedClasses = daily ? new Set(daily.substitutions.map((s) => s.classId)).size : 0;

  res.json({
    data: {
      school: {
        id: school?.id,
        name: school?.name || "-",
        address: school?.address || "-",
        managerName: school?.managerName || "مدير المدرسة",
        institutionCode: school?.institutionCode || "000000"
      },
      teachers,
      classes,
      subjects,
      baseSlots,
      assignments,
      archiveDays,
      homeroomAssignments,
      periodsPerDay: settings.periodsPerDay,
      workingDays: settings.workingDays,
      offDays: settings.offDays,
      maxTeachers: settings.maxTeachers,
      today: {
        date,
        absent,
        late,
        left,
        substitutions,
        affectedClasses
      },
      schoolDetails: {
        classes,
        subjects,
        weeklyLessons: baseSlots,
        monthlyLessons: baseSlots * 4,
        termLessons: baseSlots * 16,
        yearlyLessons: baseSlots * 32,
        homeroomTeachers: homeroomAssignments
      }
    }
  });
});
