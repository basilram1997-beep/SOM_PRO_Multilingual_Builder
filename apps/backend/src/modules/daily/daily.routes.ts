import { Router, type Response } from "express";
import { GenerateDailyScheduleSchema } from "@som/shared";
import { prisma } from "../../db/prisma";
import { validateBody } from "../../middleware/validate";
import { getRequestSchoolId } from "../../services/schoolContext";
import { ensureSchoolSettings } from "../../services/schoolSettings";
import { buildTeacherDailyPrograms } from "../../services/teacherDailyPrograms";
import {
  createDailyEventFromRules,
  deleteDailyEventFromRules,
  generateDailyScheduleFromRules,
  getDailyScheduleDetails,
  updateDailySubstitutionTeacher
} from "../../services/scheduleCoordinator";

export const dailyRouter = Router();

type RuleResult<T> = {
  error?: { status: number; body: unknown };
  data?: T;
};

function sendRuleResult<T>(res: Response, result: RuleResult<T>, successStatus = 200) {
  if (result.error) return res.status(result.error.status).json(result.error.body);
  return res.status(successStatus).json({ data: result.data });
}

dailyRouter.post("/generate", validateBody(GenerateDailyScheduleSchema), async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const result = await generateDailyScheduleFromRules(schoolId, req.body);
  return sendRuleResult(res, result);
});

dailyRouter.post("/:date/teacher-programs/generate", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const settings = await ensureSchoolSettings(schoolId);
  let daily = await prisma.dailySchedule.findUnique({
    where: { schoolId_date: { schoolId, date: req.params.date } }
  });

  if (!daily) {
    const requestedDay = String(req.body?.day || "").trim();
    const fallbackDay = requestedDay || (settings.workingDays as string[])[0] || "الاثنين";
    if (!(settings.workingDays as string[]).includes(fallbackDay)) {
      return res.status(400).json({
        error: "INVALID_WORKING_DAY",
        message: `اليوم ${fallbackDay} غير موجود ضمن أيام دوام المدرسة`
      });
    }

    daily = await prisma.dailySchedule.create({
      data: { schoolId, date: req.params.date, day: fallbackDay }
    });
  }

  const result = await buildTeacherDailyPrograms({ schoolId, date: req.params.date });
  res.json({ data: result });
});

dailyRouter.get("/:date/teacher-programs", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const result = await buildTeacherDailyPrograms({ schoolId, date: req.params.date });

  if (!result) return res.json({ data: null });
  res.json({ data: result });
});

dailyRouter.patch("/substitutions/:id", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const result = await updateDailySubstitutionTeacher(schoolId, req.params.id, req.body?.substituteTeacherId || null);
  return sendRuleResult(res, result);
});

dailyRouter.post("/:date/events", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const result = await createDailyEventFromRules(schoolId, req.params.date, req.body);
  return sendRuleResult(res, result, 201);
});

dailyRouter.delete("/events/:id", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const result = await deleteDailyEventFromRules(schoolId, String(req.params.id));
  if (result.error) return res.status(result.error.status).json(result.error.body);
  return res.status(204).send();
});

dailyRouter.get("/:date", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const result = await getDailyScheduleDetails(schoolId, req.params.date);
  return sendRuleResult(res, result);
});
