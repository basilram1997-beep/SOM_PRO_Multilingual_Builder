import { Router } from "express";
import { HomeroomAssignmentSchema } from "@som/shared";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { validateBody } from "../../middleware/validate";
import { getRequestSchoolId } from "../../services/schoolContext";
import { assertValidDayAndPeriod } from "../../services/schoolSettings";
import {
  applyHomeroomsToBaseScheduleFromRules,
  removeHomeroomFromSchedulesFromRules
} from "../../services/scheduleCoordinator";

export const homeroomRouter = Router();

homeroomRouter.get("/", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const rows = await prisma.homeroomAssignment.findMany({
    where: { schoolId },
    include: { teacher: true, class: true },
    orderBy: [{ weeklyDay: "asc" }, { weeklyPeriod: "asc" }]
  });
  res.json({ data: rows });
});

homeroomRouter.post("/", validateBody(HomeroomAssignmentSchema), async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const data = req.body;
  if (data.weeklyDay && data.weeklyPeriod) {
    await assertValidDayAndPeriod(schoolId, data.weeklyDay, data.weeklyPeriod);
  }
  const classId = data.classId;
  const row = await prisma.homeroomAssignment.upsert({
    where: { schoolId_classId: { schoolId, classId: data.classId } },
    update: {
      teacherId: data.teacherId,
      weeklyDay: data.weeklyDay,
      weeklyPeriod: data.weeklyPeriod,
      isActive: data.isActive,
      notes: data.notes
    },
    create: { schoolId, ...data }
  });
  await applyHomeroomsToBaseScheduleFromRules(schoolId, { overwriteConflicts: false, classIds: [classId] });
  res.status(201).json({ data: row });
});

homeroomRouter.delete("/:id", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const row = await prisma.homeroomAssignment.findFirst({ where: { id: req.params.id, schoolId } });
  if (!row) return res.status(404).json({ error: "NOT_FOUND" });
  const result = await removeHomeroomFromSchedulesFromRules(schoolId, row.classId);
  res.json(result);
});

homeroomRouter.post(
  "/apply-to-base-schedule",
  validateBody(
    z.object({ overwriteConflicts: z.boolean().default(false), classIds: z.array(z.string()).optional().default([]) })
  ),
  async (req, res) => {
    const schoolId = await getRequestSchoolId(req);
    const result = await applyHomeroomsToBaseScheduleFromRules(schoolId, {
      overwriteConflicts: req.body.overwriteConflicts,
      classIds: req.body.classIds || []
    });
    res.json({ data: result.data });
  }
);
