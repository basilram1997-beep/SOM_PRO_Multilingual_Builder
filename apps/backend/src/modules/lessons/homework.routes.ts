import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { TeacherHomeworkSchema, TeacherHomeworkSubmissionSchema } from "@som/shared";
import { prisma } from "../../db/prisma";
import { recordAuditLog } from "../../services/auditLog";
import { requirePermissionForWrite } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { getRequestSchoolId } from "../../services/schoolContext";
import { resolveTeacherForRequest } from "../../services/teacherScope";

export const homeworkRouter = Router();

const HomeworkQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  teacherId: z.string().optional()
});

const HomeworkSubmissionSaveSchema = z.object({
  submissions: z.array(TeacherHomeworkSubmissionSchema.omit({ homeworkId: true, id: true }))
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

function homeworkData(body: z.infer<typeof TeacherHomeworkSchema>, teacherId: string) {
  return {
    teacherId,
    classId: body.classId,
    subjectId: body.subjectId,
    date: body.date,
    day: body.day,
    kind: body.kind,
    title: body.title.trim(),
    description: optionalText(body.description),
    dueDate: optionalText(body.dueDate),
    attachment: optionalText(body.attachment),
    notes: optionalText(body.notes)
  };
}

homeworkRouter.get("/", async (req, res) => {
  const parsed = HomeworkQuerySchema.safeParse(req.query);
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
  const homeworks = viewerStudent
    ? await prisma.teacherHomework.findMany({
        where: { schoolId, classId: viewerStudent.classId, date: parsed.data.date },
        include: { teacher: true, class: true, subject: true },
        orderBy: [{ createdAt: "asc" }, { title: "asc" }]
      })
    : teacherId
      ? await prisma.teacherHomework.findMany({
          where: { schoolId, teacherId, date: parsed.data.date },
          include: { teacher: true, class: true, subject: true },
          orderBy: [{ createdAt: "asc" }, { title: "asc" }]
        })
      : [];

  const summary = homeworks.reduce<{ total: number; homework: number; preparation: number }>(
    (acc, item) => {
      acc.total += 1;
      if (item.kind === "HOMEWORK") acc.homework += 1;
      if (item.kind === "PREPARATION") acc.preparation += 1;
      return acc;
    },
    { total: 0, homework: 0, preparation: 0 }
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
      homeworks,
      summary
    }
  });
});

homeworkRouter.get("/:id/submissions", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const homework = await prisma.teacherHomework.findFirst({
    where: { id: String(req.params.id), schoolId },
    include: {
      teacher: true,
      class: true,
      subject: true,
      submissions: { include: { student: true }, orderBy: { createdAt: "asc" } }
    }
  });
  if (!homework) {
    return res.status(404).json({ error: "HOMEWORK_NOT_FOUND", message: "لم يتم العثور على الواجب" });
  }

  const teacher = req.user ? await resolveTeacherForRequest(schoolId, req.user, homework.teacherId) : null;
  if (req.user?.role === "TEACHER" && (!teacher || teacher.id !== homework.teacherId)) {
    return res.status(403).json({ error: "HOMEWORK_FORBIDDEN", message: "هذا الواجب غير مرتبط بهذا المعلم" });
  }

  const students = await prisma.student.findMany({
    where: { schoolId, classId: homework.classId },
    include: { class: true },
    orderBy: { name: "asc" }
  });

  const submissionsByStudent = new Map(homework.submissions.map((item) => [item.studentId, item]));
  const summary = homework.submissions.reduce<{ total: number; solved: number; unsolved: number; late: number }>(
    (acc, item) => {
      acc.total += 1;
      if (item.status === "SOLVED") acc.solved += 1;
      if (item.status === "UNSOLVED") acc.unsolved += 1;
      if (item.status === "LATE") acc.late += 1;
      return acc;
    },
    { total: 0, solved: 0, unsolved: 0, late: 0 }
  );

  res.json({
    data: {
      homework,
      students: students.map((student) => ({
        ...student,
        submission: submissionsByStudent.get(student.id) || null
      })),
      summary
    }
  });
});

homeworkRouter.post(
  "/",
  requirePermissionForWrite("manageLessons"),
  validateBody(TeacherHomeworkSchema),
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

    const data = homeworkData(req.body, teacher.id);

    const existingId = typeof req.body.id === "string" ? req.body.id : "";
    if (existingId) {
      const existing = await prisma.teacherHomework.findFirst({ where: { id: existingId, schoolId } });
      if (!existing) {
        return res.status(404).json({ error: "HOMEWORK_NOT_FOUND", message: "لم يتم العثور على الواجب" });
      }
      const homework = await prisma.teacherHomework.update({
        where: { id: existing.id },
        data,
        include: { teacher: true, class: true, subject: true }
      });
      recordAuditLog(prisma, {
        schoolId,
        userId: req.user?.id || req.user?.userId || null,
        action: "HOMEWORK_UPDATE",
        entity: "TeacherHomework",
        entityId: homework.id,
        before: existing as Prisma.InputJsonValue,
        after: homework as Prisma.InputJsonValue
      });
      return res.status(200).json({ data: homework });
    }

    const homework = await prisma.teacherHomework.create({
      data: { schoolId, ...data },
      include: { teacher: true, class: true, subject: true }
    });
    recordAuditLog(prisma, {
      schoolId,
      userId: req.user?.id || req.user?.userId || null,
      action: "HOMEWORK_CREATE",
      entity: "TeacherHomework",
      entityId: homework.id,
      after: homework as Prisma.InputJsonValue
    });

    res.status(201).json({ data: homework });
  }
);

homeworkRouter.put(
  "/:id/submissions",
  requirePermissionForWrite("manageLessons"),
  validateBody(HomeworkSubmissionSaveSchema),
  async (req, res) => {
    const schoolId = await getRequestSchoolId(req);
    const homework = await prisma.teacherHomework.findFirst({
      where: { id: String(req.params.id), schoolId },
      include: { teacher: true, class: true, subject: true }
    });
    if (!homework) {
      return res.status(404).json({ error: "HOMEWORK_NOT_FOUND", message: "لم يتم العثور على الواجب" });
    }

    const teacher = req.user ? await resolveTeacherForRequest(schoolId, req.user, homework.teacherId) : null;
    if (req.user?.role === "TEACHER" && (!teacher || teacher.id !== homework.teacherId)) {
      return res.status(403).json({ error: "HOMEWORK_FORBIDDEN", message: "هذا الواجب غير مرتبط بهذا المعلم" });
    }

    const students = await prisma.student.findMany({
      where: { schoolId, classId: homework.classId },
      select: { id: true }
    });
    const validStudentIds = new Set(students.map((student) => student.id));
    const beforeSubmissions = await prisma.teacherHomeworkSubmission.findMany({
      where: { schoolId, homeworkId: homework.id }
    });

    for (const item of req.body.submissions) {
      if (!validStudentIds.has(item.studentId)) continue;
      await prisma.teacherHomeworkSubmission.upsert({
        where: {
          schoolId_homeworkId_studentId: {
            schoolId,
            homeworkId: homework.id,
            studentId: item.studentId
          }
        },
        create: {
          schoolId,
          homeworkId: homework.id,
          studentId: item.studentId,
          status: item.status,
          note: optionalText(item.note),
          grade: optionalText(item.grade)
        },
        update: {
          status: item.status,
          note: optionalText(item.note),
          grade: optionalText(item.grade)
        }
      });
    }

    const refreshed = await prisma.teacherHomework.findFirst({
      where: { id: homework.id, schoolId },
      include: {
        teacher: true,
        class: true,
        subject: true,
        submissions: { include: { student: true }, orderBy: { createdAt: "asc" } }
      }
    });

    recordAuditLog(prisma, {
      schoolId,
      userId: req.user?.id || req.user?.userId || null,
      action: "HOMEWORK_SUBMISSIONS_UPDATE",
      entity: "TeacherHomeworkSubmission",
      entityId: homework.id,
      before: beforeSubmissions as Prisma.InputJsonValue,
      after: refreshed?.submissions as Prisma.InputJsonValue
    });
    res.json({ data: refreshed });
  }
);

homeworkRouter.delete("/:id", requirePermissionForWrite("manageLessons"), async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const result = await prisma.teacherHomework.deleteMany({
    where: { id: String(req.params.id), schoolId }
  });
  if (result.count === 0) {
    return res.status(404).json({ error: "HOMEWORK_NOT_FOUND", message: "لم يتم العثور على الواجب" });
  }
  res.status(204).send();
});
