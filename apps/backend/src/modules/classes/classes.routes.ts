import { Router, type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import { ClassSchema, HomeroomAssignmentSchema, sortSchoolClasses } from "@som/shared";
import { prisma } from "../../db/prisma";
import { recordAuditLog } from "../../services/auditLog";
import { validateBody } from "../../middleware/validate";
import { getRequestSchoolId } from "../../services/schoolContext";
import { assertValidDayAndPeriod } from "../../services/schoolSettings";
import { applyHomeroomsToBaseScheduleFromRules } from "../../services/scheduleCoordinator";
import { resolveTeacherScopeForRequest } from "../../services/teacherScope";
import { logSafeError } from "../../lib/safeLog";
import { buildClassDuplicateWhere } from "../../services/classIdentity";

export const classesRouter = Router();

async function removeClassById(req: Request, res: Response, classId: string) {
  if (req.user?.role === "TEACHER") {
    recordAuditLog(prisma, {
      schoolId: req.user?.schoolId || null,
      userId: req.user?.id || req.user?.userId || null,
      action: "DENIED ACCESS",
      entity: "SchoolClass",
      entityId: classId,
      after: { path: req.path, method: req.method, reason: "teacher_delete_class" } as Prisma.InputJsonValue
    });
    return res.status(403).json({ error: "FORBIDDEN", message: "?? ???? ?????? ???? ??????" });
  }

  const schoolId = await getRequestSchoolId(req);
  const existing = await prisma.schoolClass.findFirst({ where: { id: classId, schoolId } });
  if (!existing) return res.status(404).json({ error: "NOT_FOUND", message: "???? ??????? ??? ?????" });

  try {
    await prisma.$transaction([
      prisma.teacherLessonToday.deleteMany({ where: { schoolId, classId } }),
      prisma.teacherHomework.deleteMany({ where: { schoolId, classId } }),
      prisma.teacherExam.deleteMany({ where: { schoolId, classId } }),
      prisma.studentGradeScheme.deleteMany({ where: { schoolId, classId } }),
      prisma.studentGradeEntry.deleteMany({ where: { schoolId, classId } }),
      prisma.dailyEvent.deleteMany({ where: { schoolId, classId } }),
      prisma.substitution.deleteMany({ where: { schoolId, classId } }),
      prisma.baseScheduleSlot.deleteMany({ where: { schoolId, classId } }),
      prisma.teacherAssignment.deleteMany({ where: { schoolId, classId } }),
      prisma.homeroomAssignment.deleteMany({ where: { schoolId, classId } }),
      prisma.student.deleteMany({ where: { schoolId, classId } }),
      prisma.schoolClass.delete({ where: { id: classId } })
    ]);
    recordAuditLog(prisma, {
      schoolId,
      userId: req.user?.id || req.user?.userId || null,
      action: "CLASS_DELETE",
      entity: "SchoolClass",
      entityId: classId,
      before: existing as Prisma.InputJsonValue
    });
    return res.status(204).send();
  } catch (error) {
    logSafeError("classes.delete", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return res.status(409).json({
        error: "CLASS_DELETE_CONFLICT",
        message: "?? ???? ??? ???? ???? ??? ???? ?????? ?????? ??. ??? ?????????? ????? ?? ??? ????????."
      });
    }
    return res.status(500).json({
      error: "CLASS_DELETE_FAILED",
      message: "???? ??? ???? ????. ???? ??? ???? ??? ????."
    });
  }
}

async function saveHomeroomAssignment(req: Request, res: Response, classId: string) {
  if (req.user?.role === "TEACHER") {
    recordAuditLog(prisma, {
      schoolId: req.user?.schoolId || null,
      userId: req.user?.id || req.user?.userId || null,
      action: "DENIED ACCESS",
      entity: "HomeroomAssignment",
      entityId: classId,
      after: { path: req.path, method: req.method, reason: "teacher_assign_homeroom" } as Prisma.InputJsonValue
    });
    return res.status(403).json({ error: "FORBIDDEN", message: "ØºÙŠØ± Ù…Ø³Ù…ÙˆØ­ Ø¨Ø¥Ø³Ù†Ø§Ø¯ Ù…Ø±Ø¨ÙŠ Ø§Ù„ØµÙ" });
  }

  const schoolId = await getRequestSchoolId(req);
  const parsed = HomeroomAssignmentSchema.safeParse({
    ...req.body,
    classId
  });
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "INVALID_HOMEROOM_ASSIGNMENT", message: "Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø±Ø¨ÙŠ ØºÙŠØ± ØµØ­ÙŠØ­Ø©" });
  }
  const data = parsed.data;
  if (data.weeklyDay && data.weeklyPeriod) {
    await assertValidDayAndPeriod(schoolId, data.weeklyDay, data.weeklyPeriod);
  }

  const before = await prisma.homeroomAssignment.findUnique({ where: { schoolId_classId: { schoolId, classId } } });
  const row = await prisma.homeroomAssignment.upsert({
    where: { schoolId_classId: { schoolId, classId } },
    update: {
      teacherId: data.teacherId,
      weeklyDay: data.weeklyDay,
      weeklyPeriod: data.weeklyPeriod,
      isActive: data.isActive,
      notes: data.notes
    },
    create: { schoolId, ...data }
  });

  recordAuditLog(prisma, {
    schoolId,
    userId: req.user?.id || req.user?.userId || null,
    action: before ? "HOMEROOM_UPDATE" : "HOMEROOM_CREATE",
    entity: "HomeroomAssignment",
    entityId: row.id,
    before: before as Prisma.InputJsonValue | null,
    after: row as Prisma.InputJsonValue
  });
  await applyHomeroomsToBaseScheduleFromRules(schoolId, { overwriteConflicts: false, classIds: [classId] });
  return res.status(201).json({ data: row });
}

classesRouter.get("/", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const scope = req.user ? await resolveTeacherScopeForRequest(schoolId, req.user) : null;
  const classes = await prisma.schoolClass.findMany({
    where: {
      schoolId,
      ...(scope ? { id: { in: scope.classIds } } : {})
    }
  });
  res.json({ data: sortSchoolClasses(classes) });
});

classesRouter.post("/", validateBody(ClassSchema), async (req, res) => {
  if (req.user?.role === "TEACHER") {
    recordAuditLog(prisma, {
      schoolId: req.user?.schoolId || null,
      userId: req.user?.id || req.user?.userId || null,
      action: "DENIED ACCESS",
      entity: "SchoolClass",
      after: { path: req.path, method: req.method, reason: "teacher_create_class" } as Prisma.InputJsonValue
    });
    return res.status(403).json({ error: "FORBIDDEN", message: "?? ???? ?????? ?????? ????" });
  }

  const schoolId = await getRequestSchoolId(req);
  const duplicate = await prisma.schoolClass.findFirst({
    where: buildClassDuplicateWhere(schoolId, { name: req.body.name }),
    select: { id: true }
  });
  if (duplicate) {
    return res.status(409).json({
      error: "CLASS_ALREADY_EXISTS",
      message: "الصف موجود بالفعل"
    });
  }

  try {
    const item = await prisma.schoolClass.create({ data: { ...req.body, schoolId } });
    recordAuditLog(prisma, {
      schoolId,
      userId: req.user?.id || req.user?.userId || null,
      action: "CLASS_CREATE",
      entity: "SchoolClass",
      entityId: item.id,
      after: item as Prisma.InputJsonValue
    });
    res.status(201).json({ data: item });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({
        error: "CLASS_ALREADY_EXISTS",
        message: "الصف موجود بالفعل"
      });
    }
    throw error;
  }
});

classesRouter.patch("/:id", validateBody(ClassSchema.partial()), async (req, res) => {
  if (req.user?.role === "TEACHER") {
    recordAuditLog(prisma, {
      schoolId: req.user?.schoolId || null,
      userId: req.user?.id || req.user?.userId || null,
      action: "DENIED ACCESS",
      entity: "SchoolClass",
      entityId: String(req.params.id),
      after: { path: req.path, method: req.method, reason: "teacher_update_class" } as Prisma.InputJsonValue
    });
    return res.status(403).json({ error: "FORBIDDEN", message: "?? ???? ?????? ?????? ??????" });
  }

  const schoolId = await getRequestSchoolId(req);
  const classId = String(req.params.id);
  const existing = await prisma.schoolClass.findFirst({ where: { id: classId, schoolId } });
  if (!existing) return res.status(404).json({ error: "NOT_FOUND", message: "???? ??????? ??? ?????" });

  const data = req.body as {
    name?: string;
    grade?: string | null;
    section?: string | null;
    maxStudents?: number | null;
  };
  if (data.name) {
    const duplicate = await prisma.schoolClass.findFirst({
      where: buildClassDuplicateWhere(schoolId, { name: data.name }, classId),
      select: { id: true }
    });
    if (duplicate) {
      return res.status(409).json({
        error: "CLASS_ALREADY_EXISTS",
        message: "الصف موجود بالفعل"
      });
    }
  }
  try {
    const item = await prisma.schoolClass.update({
      where: { id: classId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.grade !== undefined ? { grade: data.grade?.trim() || null } : {}),
        ...(data.section !== undefined ? { section: data.section?.trim() || null } : {}),
        ...(data.maxStudents !== undefined ? { maxStudents: data.maxStudents ?? null } : {})
      }
    });

    recordAuditLog(prisma, {
      schoolId,
      userId: req.user?.id || req.user?.userId || null,
      action: "CLASS_UPDATE",
      entity: "SchoolClass",
      entityId: classId,
      before: existing as Prisma.InputJsonValue,
      after: item as Prisma.InputJsonValue
    });

    await applyHomeroomsToBaseScheduleFromRules(schoolId, { overwriteConflicts: false, classIds: [classId] });

    res.json({ data: item });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({
        error: "CLASS_ALREADY_EXISTS",
        message: "الصف موجود بالفعل"
      });
    }
    throw error;
  }
});

classesRouter.put("/:id", validateBody(ClassSchema.partial()), async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const classId = String(req.params.id);
  const existing = await prisma.schoolClass.findFirst({ where: { id: classId, schoolId } });
  if (!existing) return res.status(404).json({ error: "NOT_FOUND", message: "Ø§Ù„ØµÙ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯" });

  const data = req.body as {
    name?: string;
    grade?: string | null;
    section?: string | null;
    maxStudents?: number | null;
  };
  if (data.name) {
    const duplicate = await prisma.schoolClass.findFirst({
      where: buildClassDuplicateWhere(schoolId, { name: data.name }, classId),
      select: { id: true }
    });
    if (duplicate) {
      return res.status(409).json({
        error: "CLASS_ALREADY_EXISTS",
        message: "الصف موجود بالفعل"
      });
    }
  }
  try {
    const item = await prisma.schoolClass.update({
      where: { id: classId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.grade !== undefined ? { grade: data.grade?.trim() || null } : {}),
        ...(data.section !== undefined ? { section: data.section?.trim() || null } : {}),
        ...(data.maxStudents !== undefined ? { maxStudents: data.maxStudents ?? null } : {})
      }
    });

    recordAuditLog(prisma, {
      schoolId,
      userId: req.user?.id || req.user?.userId || null,
      action: "CLASS_UPDATE",
      entity: "SchoolClass",
      entityId: classId,
      before: existing as Prisma.InputJsonValue,
      after: item as Prisma.InputJsonValue
    });

    await applyHomeroomsToBaseScheduleFromRules(schoolId, { overwriteConflicts: false, classIds: [classId] });

    res.json({ data: item });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({
        error: "CLASS_ALREADY_EXISTS",
        message: "الصف موجود بالفعل"
      });
    }
    throw error;
  }
});

classesRouter.delete("/:id", async (req, res) => removeClassById(req, res, String(req.params.id)));
classesRouter.post("/:id/delete", async (req, res) => removeClassById(req, res, String(req.params.id)));
classesRouter.post("/:id/deactivate", async (req, res) => removeClassById(req, res, String(req.params.id)));
classesRouter.post("/:id/assign-homeroom-teacher", async (req, res) =>
  saveHomeroomAssignment(req, res, String(req.params.id))
);
