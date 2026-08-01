import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { TeacherSchema } from "@som/shared";
import { prisma } from "../../db/prisma";
import { requirePermission } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { getRequestSchoolId } from "../../services/schoolContext";
import {
  createTeacherPermissionNotification,
  listTeacherPermissionNotifications
} from "../../services/studentNotifications";
import { resolveTeacherForRequest } from "../../services/teacherScope";
import { buildTeacherDuplicateWhere } from "../../services/teacherIdentity";
import { logSafeError } from "../../lib/safeLog";
import { recordAuditLog } from "../../services/auditLog";

export const teachersRouter = Router();

const WeeklyPeriodsSchema = z.object({
  weeklyPeriods: z.number().int().min(0).max(40)
});

const TeacherAssignSubjectSchema = z.object({
  classId: z.string().trim().min(1),
  subjectId: z.string().trim().min(1),
  weeklyPeriods: z.coerce.number().int().min(0).max(40).optional()
});

const TeacherPermissionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  day: z.string().min(1),
  status: z.enum(["ABSENT", "LATE", "LEFT", "UNAVAILABLE"]),
  fromPeriod: z.coerce.number().int().min(1).max(12),
  toPeriod: z.coerce.number().int().min(1).max(12).optional().nullable(),
  reason: z.string().trim().min(1).max(300),
  note: z.string().trim().max(500).optional().nullable()
});

function assignmentKey(teacherId: string, classId: string, subjectId: string) {
  return `${teacherId}::${classId}::${subjectId}`;
}

async function rejectTeacherIdentityConflict(
  schoolId: string,
  teacher: { nationalId?: string | null; employeeNumber?: string | null },
  excludedTeacherId?: string
) {
  const where = buildTeacherDuplicateWhere(schoolId, teacher, excludedTeacherId);
  if (!where) return null;

  return prisma.teacher.findFirst({
    where,
    select: {
      id: true,
      name: true,
      nationalId: true,
      employeeNumber: true
    }
  });
}

teachersRouter.get("/permissions", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const teacher = req.user?.role === "TEACHER" ? await resolveTeacherForRequest(schoolId, req.user) : null;
  const limit = Math.min(Math.max(Number(req.query.limit || 20) || 20, 1), 100);
  const rows = await listTeacherPermissionNotifications(prisma, schoolId, {
    teacherId: teacher?.id,
    limit
  });
  res.json({ data: rows });
});

teachersRouter.post("/permissions", validateBody(TeacherPermissionSchema), async (req, res) => {
  if (req.user?.role !== "TEACHER") {
    return res.status(403).json({ error: "FORBIDDEN", message: "هذه الصفحة مخصصة للمعلم فقط" });
  }

  const schoolId = await getRequestSchoolId(req);
  const teacher = await resolveTeacherForRequest(schoolId, req.user);
  if (!teacher) {
    return res
      .status(404)
      .json({ error: "TEACHER_NOT_FOUND", message: "لم يتم العثور على ملف المعلم المرتبط بالحساب" });
  }

  const saved = await createTeacherPermissionNotification(prisma, {
    schoolId,
    teacherId: teacher.id,
    teacherName: teacher.name,
    date: req.body.date,
    day: req.body.day,
    status: req.body.status,
    fromPeriod: req.body.fromPeriod,
    toPeriod: req.body.toPeriod || req.body.fromPeriod,
    reason: req.body.reason,
    note: req.body.note || undefined
  });

  recordAuditLog(prisma, {
    schoolId,
    userId: req.user?.id || null,
    action: "TEACHER_PERMISSION_CHANGE",
    entity: "StudentNotification",
    entityId: saved.id,
    after: saved.payload as Prisma.InputJsonValue
  });

  res.status(201).json({ data: saved });
});

teachersRouter.post("/:id/assign-subject", validateBody(TeacherAssignSubjectSchema), async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const teacherId = String(req.params.id);
  const { classId, subjectId } = req.body as z.infer<typeof TeacherAssignSubjectSchema>;
  const weeklyPeriods = typeof req.body.weeklyPeriods === "number" ? req.body.weeklyPeriods : undefined;

  const [teacher, schoolClass, subject] = await Promise.all([
    prisma.teacher.findFirst({ where: { id: teacherId, schoolId } }),
    prisma.schoolClass.findFirst({ where: { id: classId, schoolId } }),
    prisma.subject.findFirst({ where: { id: subjectId, schoolId } })
  ]);

  if (!teacher) {
    return res.status(404).json({ error: "TEACHER_NOT_FOUND", message: "لم يتم العثور على المعلم" });
  }
  if (!schoolClass) {
    return res.status(404).json({ error: "CLASS_NOT_FOUND", message: "لم يتم العثور على الصف" });
  }
  if (!subject) {
    return res.status(404).json({ error: "SUBJECT_NOT_FOUND", message: "لم يتم العثور على المادة" });
  }

  const existing = await prisma.teacherAssignment.findUnique({
    where: {
      schoolId_teacherId_classId_subjectId: {
        schoolId,
        teacherId,
        classId,
        subjectId
      }
    }
  });

  const assignment = await prisma.teacherAssignment.upsert({
    where: {
      schoolId_teacherId_classId_subjectId: {
        schoolId,
        teacherId,
        classId,
        subjectId
      }
    },
    update: { weeklyPeriods: weeklyPeriods ?? existing?.weeklyPeriods ?? 0 },
    create: { schoolId, teacherId, classId, subjectId, weeklyPeriods: weeklyPeriods ?? 0 }
  });

  recordAuditLog(prisma, {
    schoolId,
    userId: req.user?.id || req.user?.userId || null,
    action: existing ? "TEACHER_ASSIGNMENT_UPDATE" : "TEACHER_ASSIGNMENT_CREATE",
    entity: "TeacherAssignment",
    entityId: assignment.id,
    before: existing as Prisma.InputJsonValue | null,
    after: assignment as Prisma.InputJsonValue
  });

  res.status(existing ? 200 : 201).json({ data: assignment });
});

teachersRouter.get("/", requirePermission("manageTeachers"), async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const [teachers, baseSlots] = await Promise.all([
    prisma.teacher.findMany({
      where: { schoolId },
      include: {
        assignments: { include: { class: true, subject: true } }
      },
      orderBy: { name: "asc" }
    }),
    prisma.baseScheduleSlot.groupBy({
      by: ["teacherId", "classId", "subjectId"],
      where: { schoolId },
      _count: { _all: true }
    })
  ]);

  const baseCountByAssignment = new Map(
    baseSlots.map((row) => [assignmentKey(row.teacherId, row.classId, row.subjectId), row._count._all])
  );

  const data = teachers.map((teacher) => ({
    ...teacher,
    assignments: teacher.assignments.map((assignment) => ({
      ...assignment,
      baseSchedulePeriods:
        baseCountByAssignment.get(assignmentKey(teacher.id, assignment.classId, assignment.subjectId)) || 0
    }))
  }));

  res.json({ data });
});

teachersRouter.post("/", requirePermission("manageTeachers"), validateBody(TeacherSchema), async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const duplicate = await rejectTeacherIdentityConflict(schoolId, req.body);
  if (duplicate) {
    return res.status(409).json({
      error: "TEACHER_IDENTITY_CONFLICT",
      message: "يوجد معلم آخر يحمل رقم الهوية أو الرقم الوظيفي نفسه"
    });
  }

  const teacher = await prisma.teacher.create({
    data: { ...req.body, schoolId }
  });
  res.status(201).json({ data: teacher });
});

teachersRouter.patch(
  "/:id/assignments/:assignmentId/weekly-periods",
  requirePermission("manageTeachers"),
  validateBody(WeeklyPeriodsSchema),
  async (req, res) => {
    const schoolId = await getRequestSchoolId(req);
    const teacherId = String(req.params.id);
    const assignmentId = String(req.params.assignmentId);

    const assignment = await prisma.teacherAssignment.findFirst({
      where: {
        id: assignmentId,
        teacherId,
        teacher: { schoolId }
      }
    });
    if (!assignment) return res.status(404).json({ error: "NOT_FOUND" });

    const updated = await prisma.teacherAssignment.update({
      where: { id: assignment.id },
      data: { weeklyPeriods: req.body.weeklyPeriods },
      include: { class: true, subject: true }
    });
    res.json({ data: updated });
  }
);

teachersRouter.delete("/:id/assignments/:assignmentId", requirePermission("manageTeachers"), async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const teacherId = String(req.params.id);
  const assignmentId = String(req.params.assignmentId);

  const assignment = await prisma.teacherAssignment.findFirst({
    where: {
      id: assignmentId,
      teacherId,
      teacher: { schoolId }
    },
    include: { teacher: true, class: true, subject: true }
  });
  if (!assignment) return res.status(404).json({ error: "NOT_FOUND" });

  try {
    await prisma.$transaction([
      prisma.baseScheduleSlot.deleteMany({
        where: {
          schoolId,
          teacherId: assignment.teacherId,
          classId: assignment.classId,
          subjectId: assignment.subjectId
        }
      }),
      prisma.teacherAssignment.delete({ where: { id: assignment.id } })
    ]);
    res.status(204).send();
  } catch (error) {
    logSafeError("teachers.assignment.delete", error);
    return res.status(500).json({
      error: "TEACHER_ASSIGNMENT_DELETE_FAILED",
      message: "تعذر حذف هذا التكليف الآن. حاول مرة أخرى بعد قليل."
    });
  }
});

teachersRouter.patch(
  "/:id",
  requirePermission("manageTeachers"),
  validateBody(TeacherSchema.partial()),
  async (req, res) => {
    const schoolId = await getRequestSchoolId(req);
    const existing = await prisma.teacher.findFirst({ where: { id: String(req.params.id), schoolId } });
    if (!existing) return res.status(404).json({ error: "NOT_FOUND" });

    const duplicate = await rejectTeacherIdentityConflict(schoolId, req.body, existing.id);
    if (duplicate) {
      return res.status(409).json({
        error: "TEACHER_IDENTITY_CONFLICT",
        message: "يوجد معلم آخر يحمل رقم الهوية أو الرقم الوظيفي نفسه"
      });
    }

    const teacher = await prisma.teacher.update({
      where: { id: existing.id },
      data: req.body
    });
    res.json({ data: teacher });
  }
);

teachersRouter.put(
  "/:id",
  requirePermission("manageTeachers"),
  validateBody(TeacherSchema.partial()),
  async (req, res) => {
    const schoolId = await getRequestSchoolId(req);
    const existing = await prisma.teacher.findFirst({ where: { id: String(req.params.id), schoolId } });
    if (!existing) return res.status(404).json({ error: "NOT_FOUND" });

    const duplicate = await rejectTeacherIdentityConflict(schoolId, req.body, existing.id);
    if (duplicate) {
      return res.status(409).json({
        error: "TEACHER_IDENTITY_CONFLICT",
        message: "يوجد معلم آخر يحمل رقم الهوية أو الرقم الوظيفي نفسه"
      });
    }

    const teacher = await prisma.teacher.update({
      where: { id: existing.id },
      data: req.body
    });
    res.json({ data: teacher });
  }
);

teachersRouter.delete("/:id", requirePermission("manageTeachers"), async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const teacherId = String(req.params.id);
  const existing = await prisma.teacher.findFirst({ where: { id: teacherId, schoolId }, select: { id: true } });
  if (!existing) return res.status(404).json({ error: "NOT_FOUND" });

  try {
    await prisma.$transaction([
      prisma.dailyTeacherStatus.deleteMany({ where: { schoolId, teacherId } }),
      prisma.substitution.deleteMany({
        where: { schoolId, OR: [{ absentTeacherId: teacherId }, { substituteTeacherId: teacherId }] }
      }),
      prisma.baseScheduleSlot.deleteMany({ where: { teacherId } }),
      prisma.homeroomAssignment.deleteMany({ where: { teacherId } }),
      prisma.dutyAssignment.deleteMany({ where: { teacherId } }),
      prisma.teacherAssignment.deleteMany({ where: { schoolId, teacherId } }),
      prisma.teacherLessonToday.deleteMany({ where: { teacherId } }),
      prisma.teacherHomework.deleteMany({ where: { teacherId } }),
      prisma.teacherExam.deleteMany({ where: { teacherId } }),
      prisma.teacher.delete({ where: { id: teacherId } })
    ]);
    res.status(204).send();
  } catch (error) {
    logSafeError("teachers.delete", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return res.status(409).json({
        error: "TEACHER_DELETE_CONFLICT",
        message: "لا يمكن حذف المعلم الآن لأن هناك بيانات مرتبطة به. أزل الارتباطات أولًا ثم أعد المحاولة."
      });
    }
    return res.status(500).json({
      error: "TEACHER_DELETE_FAILED",
      message: "تعذر حذف المعلم الآن. حاول مرة أخرى بعد قليل."
    });
  }
});

teachersRouter.post("/:id/deactivate", requirePermission("manageTeachers"), async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const teacherId = String(req.params.id);
  const existing = await prisma.teacher.findFirst({ where: { id: teacherId, schoolId }, select: { id: true } });
  if (!existing) return res.status(404).json({ error: "NOT_FOUND" });

  try {
    await prisma.$transaction([
      prisma.dailyTeacherStatus.deleteMany({ where: { schoolId, teacherId } }),
      prisma.substitution.deleteMany({
        where: { schoolId, OR: [{ absentTeacherId: teacherId }, { substituteTeacherId: teacherId }] }
      }),
      prisma.baseScheduleSlot.deleteMany({ where: { teacherId } }),
      prisma.homeroomAssignment.deleteMany({ where: { teacherId } }),
      prisma.dutyAssignment.deleteMany({ where: { teacherId } }),
      prisma.teacherAssignment.deleteMany({ where: { schoolId, teacherId } }),
      prisma.teacherLessonToday.deleteMany({ where: { teacherId } }),
      prisma.teacherHomework.deleteMany({ where: { teacherId } }),
      prisma.teacherExam.deleteMany({ where: { teacherId } }),
      prisma.teacher.delete({ where: { id: teacherId } })
    ]);
    res.status(204).send();
  } catch (error) {
    logSafeError("teachers.deactivate", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return res.status(409).json({
        error: "TEACHER_DELETE_CONFLICT",
        message: "لا يمكن تعطيل المعلم الآن لأن هناك بيانات مرتبطة به. أزل الارتباطات أولًا ثم أعد المحاولة."
      });
    }
    return res.status(500).json({
      error: "TEACHER_DELETE_FAILED",
      message: "تعذر تعطيل المعلم الآن. حاول مرة أخرى بعد قليل."
    });
  }
});
