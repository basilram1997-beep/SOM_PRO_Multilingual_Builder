import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { TeacherLessonTodaySchema } from "@som/shared";
import { prisma } from "../../db/prisma";
import { recordAuditLog } from "../../services/auditLog";
import { requirePermissionForWrite } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { getRequestSchoolId } from "../../services/schoolContext";
import { resolveTeacherForRequest } from "../../services/teacherScope";

export const lessonTodayRouter = Router();

const LessonTodayQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  teacherId: z.string().optional()
});

function optionalText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

async function resolveViewerStudent(req: any, schoolId: string) {
  if (req.user?.role !== "STUDENT" && req.user?.role !== "PARENT") return null;
  if (!req.user?.studentId) return null;
  return prisma.student.findFirst({
    where: { id: req.user.studentId, schoolId },
    include: { class: true }
  });
}

lessonTodayRouter.get("/", async (req, res) => {
  const parsed = LessonTodayQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_QUERY", message: "أدخل التاريخ بشكل صحيح" });
  }

  const schoolId = await getRequestSchoolId(req);
  const viewerStudent = await resolveViewerStudent(req, schoolId);
  const teacher = viewerStudent
    ? null
    : req.user
      ? await resolveTeacherForRequest(schoolId, req.user, parsed.data.teacherId)
      : null;
  if (req.user?.role === "TEACHER" && !teacher) {
    return res.status(404).json({ error: "TEACHER_NOT_FOUND", message: "لم يتم العثور على ملف المعلم" });
  }

  const teacherId = viewerStudent ? null : teacher?.id || parsed.data.teacherId || null;
  const lessons = viewerStudent
    ? await prisma.teacherLessonToday.findMany({
        where: { schoolId, classId: viewerStudent.classId, date: parsed.data.date },
        include: { teacher: true, class: true, subject: true },
        orderBy: [{ period: "asc" }, { createdAt: "asc" }]
      })
    : teacherId
      ? await prisma.teacherLessonToday.findMany({
          where: { schoolId, teacherId, date: parsed.data.date },
          include: { teacher: true, class: true, subject: true },
          orderBy: [{ period: "asc" }, { createdAt: "asc" }]
        })
      : [];

  const summary = lessons.reduce<{ total: number; notStarted: number; inProgress: number; completed: number }>(
    (acc, item) => {
      acc.total += 1;
      if (item.status === "NOT_STARTED") acc.notStarted += 1;
      if (item.status === "IN_PROGRESS") acc.inProgress += 1;
      if (item.status === "COMPLETED") acc.completed += 1;
      return acc;
    },
    { total: 0, notStarted: 0, inProgress: 0, completed: 0 }
  );

  res.json({
    data: {
      teacher: teacher
        ? {
            id: teacher.id,
            name: teacher.name
          }
        : null,
      assignments: viewerStudent
        ? []
        : teacher?.assignments.map((assignment) => ({
            id: assignment.id,
            classId: assignment.classId,
            className: assignment.class.name,
            subjectId: assignment.subjectId,
            subjectName: assignment.subject.name,
            weeklyPeriods: assignment.weeklyPeriods
          })) || [],
      lessons,
      summary
    }
  });
});

lessonTodayRouter.post(
  "/",
  requirePermissionForWrite("manageLessons"),
  validateBody(TeacherLessonTodaySchema),
  async (req, res) => {
    const schoolId = await getRequestSchoolId(req);
    const user = req.user!;
    const teacher = await resolveTeacherForRequest(schoolId, user, req.body.teacherId);
    if (!teacher) {
      return res.status(404).json({ error: "TEACHER_NOT_FOUND", message: "لم يتم العثور على ملف المعلم" });
    }

    const allowedAssignment = teacher.assignments.find(
      (assignment) => assignment.classId === req.body.classId && assignment.subjectId === req.body.subjectId
    );
    if (!allowedAssignment) {
      return res.status(400).json({ error: "INVALID_ASSIGNMENT", message: "الصف أو المادة غير مرتبطين بهذا المعلم" });
    }

    const existing = await prisma.teacherLessonToday.findUnique({
      where: {
        schoolId_teacherId_date_period_classId_subjectId: {
          schoolId,
          teacherId: teacher.id,
          date: req.body.date,
          period: req.body.period,
          classId: req.body.classId,
          subjectId: req.body.subjectId
        }
      }
    });
    const lesson = await prisma.teacherLessonToday.upsert({
      where: {
        schoolId_teacherId_date_period_classId_subjectId: {
          schoolId,
          teacherId: teacher.id,
          date: req.body.date,
          period: req.body.period,
          classId: req.body.classId,
          subjectId: req.body.subjectId
        }
      },
      create: {
        schoolId,
        teacherId: teacher.id,
        classId: req.body.classId,
        subjectId: req.body.subjectId,
        date: req.body.date,
        day: req.body.day,
        period: req.body.period,
        title: req.body.title.trim(),
        summary: optionalText(req.body.summary),
        status: req.body.status,
        note: optionalText(req.body.note),
        attachments: optionalText(req.body.attachments)
      },
      update: {
        day: req.body.day,
        title: req.body.title.trim(),
        summary: optionalText(req.body.summary),
        status: req.body.status,
        note: optionalText(req.body.note),
        attachments: optionalText(req.body.attachments)
      },
      include: { teacher: true, class: true, subject: true }
    });

    recordAuditLog(prisma, {
      schoolId,
      userId: req.user?.id || req.user?.userId || null,
      action: existing ? "LESSON_TODAY_UPDATE" : "LESSON_TODAY_CREATE",
      entity: "TeacherLessonToday",
      entityId: lesson.id,
      before: existing as Prisma.InputJsonValue | null,
      after: lesson as Prisma.InputJsonValue
    });
    res.json({ data: lesson });
  }
);

lessonTodayRouter.put(
  "/:id",
  requirePermissionForWrite("manageLessons"),
  validateBody(TeacherLessonTodaySchema),
  async (req, res) => {
    const schoolId = await getRequestSchoolId(req);
    const user = req.user!;
    const teacher = await resolveTeacherForRequest(schoolId, user, req.body.teacherId);
    if (!teacher) {
      return res.status(404).json({ error: "TEACHER_NOT_FOUND", message: "لم يتم العثور على ملف المعلم" });
    }

    const allowedAssignment = teacher.assignments.find(
      (assignment) => assignment.classId === req.body.classId && assignment.subjectId === req.body.subjectId
    );
    if (!allowedAssignment) {
      return res.status(400).json({ error: "INVALID_ASSIGNMENT", message: "الصف أو المادة غير مرتبطين بهذا المعلم" });
    }

    const existing = await prisma.teacherLessonToday.findFirst({
      where: { id: String(req.params.id), schoolId }
    });
    if (!existing) {
      return res.status(404).json({ error: "LESSON_NOT_FOUND", message: "لم يتم العثور على درس اليوم" });
    }

    const lesson = await prisma.teacherLessonToday.update({
      where: { id: existing.id },
      data: {
        teacherId: teacher.id,
        classId: req.body.classId,
        subjectId: req.body.subjectId,
        date: req.body.date,
        day: req.body.day,
        period: req.body.period,
        title: req.body.title.trim(),
        summary: optionalText(req.body.summary),
        status: req.body.status,
        note: optionalText(req.body.note),
        attachments: optionalText(req.body.attachments)
      },
      include: { teacher: true, class: true, subject: true }
    });

    recordAuditLog(prisma, {
      schoolId,
      userId: req.user?.id || req.user?.userId || null,
      action: "LESSON_TODAY_UPDATE",
      entity: "TeacherLessonToday",
      entityId: lesson.id,
      before: existing as Prisma.InputJsonValue,
      after: lesson as Prisma.InputJsonValue
    });
    res.json({ data: lesson });
  }
);

lessonTodayRouter.delete("/:id", requirePermissionForWrite("manageLessons"), async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const result = await prisma.teacherLessonToday.deleteMany({
    where: { id: String(req.params.id), schoolId }
  });
  if (result.count === 0) {
    return res.status(404).json({ error: "LESSON_NOT_FOUND", message: "لم يتم العثور على درس اليوم" });
  }
  res.status(204).send();
});
