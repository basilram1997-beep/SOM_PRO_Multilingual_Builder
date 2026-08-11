import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { BaseScheduleSlotSchema } from "@som/shared";
import { prisma } from "../../db/prisma";
import { recordAuditLog } from "../../services/auditLog";
import { validateBody } from "../../middleware/validate";
import { getRequestSchoolId } from "../../services/schoolContext";
import {
  copyBaseScheduleDayFromRules,
  previewBaseScheduleDayCopyFromRules,
  saveBaseScheduleSlotFromRules,
  previewBaseScheduleSwapPeriodsFromRules,
  swapBaseSchedulePeriodsFromRules
} from "../../services/scheduleEditing";
import { validateBaseScheduleConflicts } from "../../services/scheduleBuilder";

export const schedulesRouter = Router();

const BaseScheduleWriteSchema = BaseScheduleSlotSchema.extend({
  expectedUpdatedAt: z.string().trim().optional().nullable()
});

const CopyWeekSchema = z.object({
  fromDay: z.string().min(1),
  toDay: z.string().min(1),
  overwriteConflicts: z.boolean().optional().default(false)
});

const SwapPeriodsSchema = z.object({
  day: z.string().min(1),
  classId: z.string().min(1),
  firstPeriod: z.number().int().min(1),
  secondPeriod: z.number().int().min(1)
});

schedulesRouter.get("/base", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const day = req.query.day as string | undefined;
  const slots = await prisma.baseScheduleSlot.findMany({
    where: {
      schoolId,
      ...(day ? { day } : {})
    },
    select: {
      id: true,
      schoolId: true,
      day: true,
      period: true,
      classId: true,
      subjectId: true,
      teacherId: true,
      room: true,
      updatedAt: true,
      class: {
        select: {
          id: true,
          name: true
        }
      },
      subject: {
        select: {
          id: true,
          name: true
        }
      },
      teacher: {
        select: {
          id: true,
          name: true,
          specialty: true
        }
      }
    },
    orderBy: [{ day: "asc" }, { period: "asc" }]
  });
  res.json({ data: slots });
});

schedulesRouter.post("/base", validateBody(BaseScheduleWriteSchema), async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const result = await saveBaseScheduleSlotFromRules(schoolId, req.body);
  const saveError = "error" in result ? result.error : undefined;
  if (saveError) {
    return res.status(saveError.status).json(saveError.body);
  }
  const data = result.data!;

  recordAuditLog(prisma, {
    schoolId,
    userId: req.user?.id || req.user?.userId || null,
    action: data.existing ? "BASE_SCHEDULE_UPDATE" : "BASE_SCHEDULE_CREATE",
    entity: "BaseScheduleSlot",
    entityId: data.slot.id,
    before: data.existing as Prisma.InputJsonValue | null,
    after: data.slot as Prisma.InputJsonValue
  });
  res.status(201).json({ data: data.slot });
});

schedulesRouter.post("/base/copy-week", validateBody(CopyWeekSchema), async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const result = await copyBaseScheduleDayFromRules(schoolId, req.body);
  const copyError = "error" in result ? result.error : undefined;
  if (copyError) {
    return res.status(copyError.status).json(copyError.body);
  }
  const data = result.data!;

  recordAuditLog(prisma, {
    schoolId,
    userId: req.user?.id || req.user?.userId || null,
    action: "BASE_SCHEDULE_COPY_DAY",
    entity: "BaseScheduleSlot",
    after: {
      fromDay: req.body.fromDay,
      toDay: req.body.toDay,
      overwriteConflicts: req.body.overwriteConflicts,
      copied: data.copied
    } as Prisma.InputJsonValue
  });
  res.json({ data });
});

schedulesRouter.post("/base/copy-week/preview", validateBody(CopyWeekSchema), async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const result = await previewBaseScheduleDayCopyFromRules(schoolId, req.body);
  const previewError = "error" in result ? result.error : undefined;
  if (previewError) {
    return res.status(previewError.status).json(previewError.body);
  }
  const previewData = result.data;
  if (!previewData) {
    return res.status(500).json({ error: "PREVIEW_DATA_MISSING", message: "Copy preview data was not returned" });
  }
  res.json({ data: previewData });
});

schedulesRouter.post("/base/swap-periods", validateBody(SwapPeriodsSchema), async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const result = await swapBaseSchedulePeriodsFromRules(schoolId, req.body);
  const swapError = "error" in result ? result.error : undefined;
  if (swapError) {
    return res.status(swapError.status).json(swapError.body);
  }
  const data = result.data!;

  recordAuditLog(prisma, {
    schoolId,
    userId: req.user?.id || req.user?.userId || null,
    action: "BASE_SCHEDULE_SWAP_PERIODS",
    entity: "BaseScheduleSlot",
    after: {
      day: req.body.day,
      classId: req.body.classId,
      firstPeriod: req.body.firstPeriod,
      secondPeriod: req.body.secondPeriod
    } as Prisma.InputJsonValue
  });
  res.json({ data });
});

schedulesRouter.post("/base/swap-periods/preview", validateBody(SwapPeriodsSchema), async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const result = await previewBaseScheduleSwapPeriodsFromRules(schoolId, req.body);
  res.json({ data: result.data });
});

schedulesRouter.post("/base/validate", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const conflicts = await validateBaseScheduleConflicts(schoolId);
  recordAuditLog(prisma, {
    schoolId,
    userId: req.user?.id || req.user?.userId || null,
    action: "BASE_SCHEDULE_VALIDATE",
    entity: "BaseScheduleSlot",
    after: { ok: conflicts.length === 0, conflicts } as Prisma.InputJsonValue
  });
  res.json({ data: { ok: conflicts.length === 0, conflicts } });
});
