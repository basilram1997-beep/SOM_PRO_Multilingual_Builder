import { Router } from "express";
import { z } from "zod";
import { SubjectSchema } from "@som/shared";
import { prisma } from "../../db/prisma";
import { validateBody } from "../../middleware/validate";
import { getRequestSchoolId } from "../../services/schoolContext";
import { resolveTeacherScopeForRequest } from "../../services/teacherScope";
import { invalidateSchoolReferenceData } from "../../services/schoolReferenceData";

export const subjectsRouter = Router();

subjectsRouter.get("/", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const scope = req.user ? await resolveTeacherScopeForRequest(schoolId, req.user) : null;
  const subjects = await prisma.subject.findMany({
    where: {
      schoolId,
      ...(scope ? { id: { in: scope.subjectIds } } : {})
    },
    orderBy: { name: "asc" }
  });
  res.json({ data: subjects });
});

subjectsRouter.post("/", validateBody(SubjectSchema), async (req, res) => {
  if (req.user?.role === "TEACHER") {
    return res.status(403).json({ error: "FORBIDDEN", message: "لا تملك صلاحية لإضافة مواد" });
  }

  const schoolId = await getRequestSchoolId(req);
  const item = await prisma.subject.create({ data: { ...req.body, schoolId } });
  invalidateSchoolReferenceData(schoolId);
  res.status(201).json({ data: item });
});

const SubjectUpdateSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1).optional(),
    isHomeroom: z.boolean().optional(),
    maxMark: z.coerce.number().int().min(1).max(500).optional().nullable(),
    passMark: z.coerce.number().int().min(0).max(500).optional().nullable()
  })
  .superRefine((value, context) => {
    if (value.maxMark != null && value.passMark != null && value.passMark > value.maxMark) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passMark"],
        message: "passMark must not exceed maxMark"
      });
    }
  });

subjectsRouter.put("/:id", validateBody(SubjectUpdateSchema), async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const existing = await prisma.subject.findFirst({ where: { id: String(req.params.id), schoolId } });
  if (!existing) return res.status(404).json({ error: "NOT_FOUND", message: "المادة غير موجودة" });

  const item = await prisma.subject.update({
    where: { id: existing.id },
    data: req.body
  });
  invalidateSchoolReferenceData(schoolId);
  res.json({ data: item });
});

subjectsRouter.post("/:id/deactivate", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const existing = await prisma.subject.findFirst({ where: { id: String(req.params.id), schoolId } });
  if (!existing) return res.status(404).json({ error: "NOT_FOUND", message: "المادة غير موجودة" });

  await prisma.subject.update({
    where: { id: existing.id },
    data: { status: "ARCHIVED" }
  });
  invalidateSchoolReferenceData(schoolId);
  res.status(204).send();
});
