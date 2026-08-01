import { Router } from "express";
import { DutyAssignmentSchema } from "@som/shared";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { validateBody } from "../../middleware/validate";
import { getRequestSchoolId } from "../../services/schoolContext";
import { buildDailyDutyRows } from "../../services/dutySchedule";
import { ensureSchoolSettings } from "../../services/schoolSettings";
import { resolveTeacherForRequest } from "../../services/teacherScope";

export const dutiesRouter = Router();

const SaveDutySchema = DutyAssignmentSchema.extend({ id: z.string().optional() });

async function ensureTeacherBelongsToSchool(schoolId: string, teacherId: string) {
  const teacher = await prisma.teacher.findFirst({ where: { id: teacherId, schoolId } });
  return Boolean(teacher);
}

dutiesRouter.get("/", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const teacher = req.user?.role === "TEACHER" ? await resolveTeacherForRequest(schoolId, req.user) : null;
  const rows = await prisma.dutyAssignment.findMany({
    where: {
      schoolId,
      ...(teacher ? { teacherId: teacher.id } : {})
    },
    include: { teacher: true },
    orderBy: [{ day: "asc" }, { startTime: "asc" }, { place: "asc" }]
  });
  res.json({ data: rows });
});

dutiesRouter.get("/daily/:date", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const settings = await ensureSchoolSettings(schoolId);
  const fallbackDay = String(req.query.day || "") || (settings.workingDays as string[])[0];
  const teacher = req.user?.role === "TEACHER" ? await resolveTeacherForRequest(schoolId, req.user) : null;
  const rows = await buildDailyDutyRows(schoolId, req.params.date, fallbackDay);
  res.json({
    data: teacher ? rows.filter((row) => row.teacherId === teacher.id) : rows
  });
});

dutiesRouter.post("/", validateBody(SaveDutySchema), async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const data = req.body;

  if (!(await ensureTeacherBelongsToSchool(schoolId, data.teacherId))) {
    return res.status(400).json({ error: "INVALID_TEACHER", message: "المعلم غير صحيح" });
  }

  const payload = {
    teacherId: data.teacherId,
    day: data.day,
    startTime: data.startTime,
    endTime: data.endTime,
    place: data.place,
    notes: data.notes || null,
    isActive: data.isActive ?? true
  };

  if (data.id) {
    const existing = await prisma.dutyAssignment.findFirst({ where: { id: data.id, schoolId } });
    if (!existing) return res.status(404).json({ error: "NOT_FOUND" });
    const updated = await prisma.dutyAssignment.update({
      where: { id: data.id },
      data: payload,
      include: { teacher: true }
    });
    return res.json({ data: updated });
  }

  const created = await prisma.dutyAssignment.create({ data: { schoolId, ...payload }, include: { teacher: true } });
  res.status(201).json({ data: created });
});

dutiesRouter.delete("/:id", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const result = await prisma.dutyAssignment.deleteMany({ where: { id: req.params.id, schoolId } });
  if (result.count === 0) return res.status(404).json({ error: "NOT_FOUND" });
  res.status(204).send();
});
