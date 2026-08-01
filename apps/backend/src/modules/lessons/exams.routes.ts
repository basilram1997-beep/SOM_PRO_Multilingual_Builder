import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { TeacherExamSchema } from "@som/shared";
import { prisma } from "../../db/prisma";
import { recordAuditLog } from "../../services/auditLog";
import { requirePermissionForWrite } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { getRequestSchoolId } from "../../services/schoolContext";
import { findExamConflicts } from "../../services/examSchedule";
import { resolveTeacherForRequest } from "../../services/teacherScope";

export const examsRouter = Router();

const ExamQuerySchema = z.object({
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

function examData(body: z.infer<typeof TeacherExamSchema>, teacherId: string) {
  return {
    teacherId,
    classId: body.classId,
    subjectId: body.subjectId,
    date: body.date,
    day: body.day,
    title: body.title.trim(),
    startTime: body.startTime,
    endTime: body.endTime,
    room: optionalText(body.room),
    notes: optionalText(body.notes),
    instructions: optionalText(body.instructions)
  };
}

function conflictMessage(count: number) {
  if (count <= 0) return null;
  return count === 1
    ? "يوجد امتحان آخر لنفس الصف يتقاطع مع هذا الوقت"
    : `يوجد ${count} امتحانات أخرى لنفس الصف تتقاطع مع هذا الوقت`;
}

function serializeExam(
  exam: {
    id: string;
    teacherId: string;
    classId: string;
    subjectId: string;
    date: string;
    day: string;
    title: string;
    startTime: string;
    endTime: string;
    room: string | null;
    notes: string | null;
    instructions: string | null;
    teacher: { id: string; name: string };
    class: { id: string; name: string };
    subject: { id: string; name: string };
  },
  conflictCount = 0
) {
  return {
    ...exam,
    hasConflict: conflictCount > 0,
    conflictCount
  };
}

examsRouter.get("/", async (req, res) => {
  const parsed = ExamQuerySchema.safeParse(req.query);
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

  const allExams = viewerStudent
    ? await prisma.teacherExam.findMany({
        where: { schoolId, classId: viewerStudent.classId, date: parsed.data.date },
        include: { teacher: true, class: true, subject: true },
        orderBy: [{ startTime: "asc" }, { title: "asc" }, { createdAt: "asc" }]
      })
    : await prisma.teacherExam.findMany({
        where: { schoolId, date: parsed.data.date },
        include: { teacher: true, class: true, subject: true },
        orderBy: [{ startTime: "asc" }, { title: "asc" }, { createdAt: "asc" }]
      });

  const teacherId = viewerStudent ? null : teacher?.id || parsed.data.teacherId || null;
  const visibleExams = viewerStudent
    ? allExams
    : teacherId
      ? allExams.filter((item) => item.teacherId === teacherId)
      : [];
  const conflictMap = new Map<string, number>();

  for (const exam of visibleExams) {
    conflictMap.set(exam.id, findExamConflicts(allExams, exam).length);
  }

  const summary = visibleExams.reduce<{ total: number; conflicts: number }>(
    (acc, item) => {
      acc.total += 1;
      if ((conflictMap.get(item.id) || 0) > 0) acc.conflicts += 1;
      return acc;
    },
    { total: 0, conflicts: 0 }
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
      exams: visibleExams.map((exam) => serializeExam(exam, conflictMap.get(exam.id) || 0)),
      summary
    }
  });
});

examsRouter.post("/", requirePermissionForWrite("manageLessons"), validateBody(TeacherExamSchema), async (req, res) => {
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

  const data = examData(req.body, teacher.id);
  const existingId = typeof req.body.id === "string" ? req.body.id : "";

  let exam;
  if (existingId) {
    const existing = await prisma.teacherExam.findFirst({ where: { id: existingId, schoolId } });
    if (!existing) {
      return res.status(404).json({ error: "EXAM_NOT_FOUND", message: "لم يتم العثور على الامتحان" });
    }
    exam = await prisma.teacherExam.update({
      where: { id: existing.id },
      data,
      include: { teacher: true, class: true, subject: true }
    });
    recordAuditLog(prisma, {
      schoolId,
      userId: req.user?.id || req.user?.userId || null,
      action: "EXAM_UPDATE",
      entity: "TeacherExam",
      entityId: exam.id,
      before: existing as Prisma.InputJsonValue,
      after: exam as Prisma.InputJsonValue
    });
  } else {
    exam = await prisma.teacherExam.create({
      data: { schoolId, ...data },
      include: { teacher: true, class: true, subject: true }
    });
    recordAuditLog(prisma, {
      schoolId,
      userId: req.user?.id || req.user?.userId || null,
      action: "EXAM_CREATE",
      entity: "TeacherExam",
      entityId: exam.id,
      after: exam as Prisma.InputJsonValue
    });
  }

  const sameClassExams = await prisma.teacherExam.findMany({
    where: { schoolId, classId: exam.classId, date: exam.date },
    include: { teacher: true, class: true, subject: true }
  });
  const conflicts = findExamConflicts(sameClassExams, exam);
  const warning = conflictMessage(conflicts.length);

  res.status(existingId ? 200 : 201).json({
    data: {
      exam: serializeExam(exam, conflicts.length),
      conflicts: conflicts.map((item) => ({
        id: item.id,
        title: item.title,
        className: item.class.name,
        subjectName: item.subject.name,
        date: item.date,
        startTime: item.startTime,
        endTime: item.endTime
      })),
      warning
    }
  });
});

examsRouter.delete("/:id", requirePermissionForWrite("manageLessons"), async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const result = await prisma.teacherExam.deleteMany({
    where: { id: String(req.params.id), schoolId }
  });
  if (result.count === 0) {
    return res.status(404).json({ error: "EXAM_NOT_FOUND", message: "لم يتم العثور على الامتحان" });
  }
  res.status(204).send();
});
