import { Router } from "express";
import { Prisma } from "@prisma/client";
import { allowedPagesForRole, SchoolSettingsSchema, PeriodDefinitionSchema, SchoolInfoSchema } from "@som/shared";
import { prisma } from "../../db/prisma";
import { validateBody } from "../../middleware/validate";
import { getRequestSchoolId } from "../../services/schoolContext";
import { ensureSchoolSettings } from "../../services/schoolSettings";
import { hashPassword } from "../../services/authService";
import { recordAuditLog } from "../../services/auditLog";
import { canRole, permissionsForRole } from "../../services/accessPolicy";
import { z } from "zod";
import {
  getParentStudentIds,
  primaryStudentId,
  replaceParentStudentLinks,
  uniqueNonEmpty
} from "../../services/accountLinking";

export const settingsRouter = Router();

const UserRoleSchema = z.enum(["ADMIN", "SCHEDULER", "TEACHER", "STUDENT", "PARENT"]);
const LinkedStudentIdSchema = z.string().trim().min(1).optional().nullable();
const LinkedStudentIdsSchema = z.array(z.string().trim().min(1)).max(12).optional();
const UserIdentifierSchema = z.string().trim().min(3);
const UserCreateSchema = z
  .object({
    name: z.string().min(1),
    email: UserIdentifierSchema,
    password: z.string().min(6, "PASSWORD_TOO_SHORT"),
    role: UserRoleSchema,
    studentId: LinkedStudentIdSchema,
    studentIds: LinkedStudentIdsSchema
  })
  .superRefine((value, context) => {
    const linkedCount = uniqueNonEmpty([value.studentId, ...(value.studentIds || [])]).length;
    if ((value.role === "STUDENT" || value.role === "PARENT") && linkedCount === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["studentId"],
        message: "STUDENT_LINK_REQUIRED"
      });
    }
    if (value.role && value.role !== "STUDENT" && value.role !== "PARENT" && linkedCount > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["studentId"],
        message: "STUDENT_LINK_NOT_ALLOWED"
      });
    }
  });

const UserUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: UserIdentifierSchema.optional(),
    password: z.string().min(6, "PASSWORD_TOO_SHORT").optional(),
    role: UserRoleSchema.optional(),
    studentId: LinkedStudentIdSchema,
    studentIds: LinkedStudentIdsSchema
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "USER_UPDATE_REQUIRED"
  })
  .superRefine((value, context) => {
    const linkedCount = uniqueNonEmpty([value.studentId, ...(value.studentIds || [])]).length;
    if ((value.role === "STUDENT" || value.role === "PARENT") && linkedCount === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["studentId"],
        message: "STUDENT_LINK_REQUIRED"
      });
    }
    if (value.role && value.role !== "STUDENT" && value.role !== "PARENT" && linkedCount > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["studentId"],
        message: "STUDENT_LINK_NOT_ALLOWED"
      });
    }
  });

const UserRoleUpdateSchema = z
  .object({
    role: UserRoleSchema,
    studentId: LinkedStudentIdSchema,
    studentIds: LinkedStudentIdsSchema
  })
  .superRefine((value, context) => {
    const linkedCount = uniqueNonEmpty([value.studentId, ...(value.studentIds || [])]).length;
    if ((value.role === "STUDENT" || value.role === "PARENT") && linkedCount === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["studentId"],
        message: "STUDENT_LINK_REQUIRED"
      });
    }
    if (value.role !== "STUDENT" && value.role !== "PARENT" && linkedCount > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["studentId"],
        message: "STUDENT_LINK_NOT_ALLOWED"
      });
    }
  });

const roleUsernamePrefixes: Record<z.infer<typeof UserRoleSchema>, string> = {
  ADMIN: "admin",
  SCHEDULER: "scheduler",
  TEACHER: "reader",
  STUDENT: "student",
  PARENT: "parent"
};

function sanitizeUsernamePart(value: string | null | undefined, fallback: string) {
  const clean = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return clean || fallback;
}

async function generateSuggestedUsername(schoolId: string, role: z.infer<typeof UserRoleSchema>) {
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { institutionCode: true } });
  const schoolPart = sanitizeUsernamePart(
    school?.institutionCode,
    sanitizeUsernamePart(schoolId, "school").slice(0, 10)
  );
  const prefix = roleUsernamePrefixes[role] || "user";
  const base = `${prefix}${schoolPart}`;
  const users = await prisma.user.findMany({
    where: { schoolId, email: { startsWith: base } },
    select: { email: true }
  });
  if (!users.some((user) => user.email === base)) return base;
  const next =
    users.reduce((max, user) => {
      const match = user.email.match(new RegExp(`^${base}-(\\d+)$`));
      return match ? Math.max(max, Number(match[1])) : max;
    }, 1) + 1;
  return `${base}-${String(next).padStart(2, "0")}`;
}

function linkedStudentIdsFromBody(body: { studentId?: string | null; studentIds?: string[] | null }) {
  return uniqueNonEmpty([body.studentId, ...((body.studentIds || []) as string[])]);
}

async function assertSchoolStudentsExist(schoolId: string, studentIds: string[]) {
  const uniqueIds = uniqueNonEmpty(studentIds);
  if (!uniqueIds.length) return [];
  const students = await prisma.student.findMany({
    where: { id: { in: uniqueIds }, schoolId, status: "ACTIVE" },
    select: { id: true, name: true, classId: true }
  });
  if (students.length !== uniqueIds.length) {
    throw new Error("STUDENT_NOT_FOUND");
  }
  return students;
}

async function existingLinkedStudentIdsForUser(
  schoolId: string,
  user: { id: string; role: string; studentId?: string | null }
) {
  if (user.role === "PARENT") {
    return uniqueNonEmpty([user.studentId, ...(await getParentStudentIds(prisma, schoolId, user.id))]);
  }
  return uniqueNonEmpty([user.studentId]);
}

settingsRouter.get("/", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const settings = await ensureSchoolSettings(schoolId);
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  const periods = await prisma.periodDefinition.findMany({
    where: { schoolId },
    orderBy: { period: "asc" }
  });
  res.json({ data: { settings, school, periods } });
});

settingsRouter.get("/users", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const users = await prisma.user.findMany({
    where: { schoolId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      studentId: true,
      createdAt: true
    },
    orderBy: { createdAt: "asc" }
  });
  res.json({
    data: await Promise.all(
      users.map(async (user) => ({
        ...user,
        studentIds:
          user.role === "PARENT"
            ? uniqueNonEmpty([user.studentId, ...(await getParentStudentIds(prisma, schoolId, user.id))])
            : uniqueNonEmpty([user.studentId])
      }))
    )
  });
});

settingsRouter.get("/users/suggest-username", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const role = UserRoleSchema.catch("SCHEDULER").parse(String(req.query.role || "SCHEDULER"));
  const username = await generateSuggestedUsername(schoolId, role);
  res.json({ data: { username, role } });
});

settingsRouter.post("/users", validateBody(UserCreateSchema), async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const email = req.body.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "USERNAME_EXISTS", message: "اسم المستخدم موجود مسبقًا" });
  }

  const linkedStudentIds = linkedStudentIdsFromBody(req.body);
  const studentId = primaryStudentId(linkedStudentIds);
  if ((req.body.role === "STUDENT" || req.body.role === "PARENT") && !studentId) {
    return res.status(400).json({ error: "STUDENT_LINK_REQUIRED", message: "يجب ربط الحساب بالطالب" });
  }
  if (linkedStudentIds.length) {
    try {
      await assertSchoolStudentsExist(schoolId, req.body.role === "STUDENT" ? [studentId!] : linkedStudentIds);
    } catch {
      return res.status(404).json({ error: "STUDENT_NOT_FOUND", message: "الطالب غير موجود" });
    }
  }

  try {
    const user = await prisma.user.create({
      data: {
        schoolId,
        name: req.body.name,
        email,
        password: hashPassword(req.body.password),
        role: req.body.role,
        ...(studentId ? { studentId } : {})
      },
      select: { id: true, name: true, email: true, role: true, studentId: true, createdAt: true }
    });
    if (req.body.role === "PARENT") {
      await replaceParentStudentLinks(prisma, schoolId, user.id, linkedStudentIds, "ADMIN");
    }
    recordAuditLog(prisma, {
      schoolId,
      userId: req.user?.id || req.user?.userId || null,
      action: "USER_CREATE",
      entity: "SchoolUser",
      entityId: user.id,
      after: user as Prisma.InputJsonValue
    });
    res.status(201).json({
      data: { ...user, studentIds: req.body.role === "PARENT" ? linkedStudentIds : [studentId].filter(Boolean) }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ error: "USERNAME_EXISTS", message: "اسم المستخدم موجود مسبقًا" });
    }
    throw error;
  }
});

settingsRouter.delete("/users/:id", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user || user.schoolId !== schoolId) return res.status(404).json({ error: "NOT_FOUND" });

  if (user.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { schoolId, role: "ADMIN" } });
    if (adminCount <= 1) {
      return res.status(400).json({ error: "LAST_ADMIN", message: "لا يمكن حذف آخر مدير في النظام" });
    }
  }

  await prisma.user.delete({ where: { id: user.id } });
  recordAuditLog(prisma, {
    schoolId,
    userId: req.user?.id || req.user?.userId || null,
    action: "USER_DELETE",
    entity: "SchoolUser",
    entityId: user.id,
    before: user as Prisma.InputJsonValue
  });
  res.status(204).send();
});

async function getSchoolUserOr404(schoolId: string, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.schoolId !== schoolId) return null;
  return user;
}

settingsRouter.put("/users/:id", validateBody(UserUpdateSchema), async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const user = await getSchoolUserOr404(schoolId, String(req.params.id));
  if (!user) {
    return res.status(404).json({ error: "NOT_FOUND", message: "لم يتم العثور على المستخدم" });
  }

  const nextRole = req.body.role || user.role;
  const linkFieldsProvided = req.body.studentId !== undefined || req.body.studentIds !== undefined;
  const linkedStudentIds = linkFieldsProvided
    ? linkedStudentIdsFromBody(req.body)
    : await existingLinkedStudentIdsForUser(schoolId, user);
  const studentId = primaryStudentId(linkedStudentIds);
  const email = req.body.email ? req.body.email.trim().toLowerCase() : user.email;
  if (email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== user.id) {
      return res.status(409).json({ error: "USERNAME_EXISTS", message: "اسم المستخدم موجود مسبقًا" });
    }
  }

  if ((nextRole === "STUDENT" || nextRole === "PARENT") && !studentId) {
    return res.status(400).json({ error: "STUDENT_LINK_REQUIRED", message: "يجب ربط الحساب بالطالب" });
  }
  if (linkedStudentIds.length) {
    try {
      await assertSchoolStudentsExist(schoolId, nextRole === "STUDENT" ? [studentId!] : linkedStudentIds);
    } catch {
      return res.status(404).json({ error: "STUDENT_NOT_FOUND", message: "الطالب غير موجود" });
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(req.body.name ? { name: req.body.name.trim() } : {}),
      ...(req.body.email ? { email } : {}),
      ...(req.body.password ? { password: hashPassword(req.body.password) } : {}),
      ...(req.body.role ? { role: req.body.role } : {}),
      ...(req.body.studentId !== undefined || req.body.studentIds !== undefined
        ? { studentId: studentId || null }
        : req.body.role && nextRole !== "STUDENT" && nextRole !== "PARENT"
          ? { studentId: null }
          : {})
    },
    select: { id: true, name: true, email: true, role: true, studentId: true, createdAt: true }
  });

  if (nextRole === "PARENT" && linkFieldsProvided) {
    await replaceParentStudentLinks(prisma, schoolId, updated.id, linkedStudentIds, "ADMIN");
  } else if (req.body.role && nextRole !== "PARENT") {
    await replaceParentStudentLinks(prisma, schoolId, updated.id, [], "ADMIN");
  }

  recordAuditLog(prisma, {
    schoolId,
    userId: req.user?.id || req.user?.userId || null,
    action: "USER_UPDATE",
    entity: "SchoolUser",
    entityId: user.id,
    before: user as Prisma.InputJsonValue,
    after: updated as Prisma.InputJsonValue
  });
  res.json({
    data: {
      ...updated,
      studentIds: nextRole === "PARENT" ? linkedStudentIds : uniqueNonEmpty([updated.studentId])
    }
  });
});

settingsRouter.post("/users/:id/roles", validateBody(UserRoleUpdateSchema), async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const user = await getSchoolUserOr404(schoolId, String(req.params.id));
  if (!user) {
    return res.status(404).json({ error: "NOT_FOUND", message: "لم يتم العثور على المستخدم" });
  }

  const linkedStudentIds =
    req.body.studentId !== undefined || req.body.studentIds !== undefined
      ? linkedStudentIdsFromBody(req.body)
      : await existingLinkedStudentIdsForUser(schoolId, user);
  const studentId = primaryStudentId(linkedStudentIds);
  if ((req.body.role === "STUDENT" || req.body.role === "PARENT") && !studentId) {
    return res.status(400).json({ error: "STUDENT_LINK_REQUIRED", message: "يجب ربط الحساب بالطالب" });
  }
  if (linkedStudentIds.length) {
    try {
      await assertSchoolStudentsExist(schoolId, req.body.role === "STUDENT" ? [studentId!] : linkedStudentIds);
    } catch {
      return res.status(404).json({ error: "STUDENT_NOT_FOUND", message: "الطالب غير موجود" });
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      role: req.body.role,
      ...(req.body.studentId !== undefined || req.body.studentIds !== undefined
        ? { studentId: studentId || null }
        : req.body.role !== "STUDENT" && req.body.role !== "PARENT"
          ? { studentId: null }
          : {})
    },
    select: { id: true, name: true, email: true, role: true, studentId: true, createdAt: true }
  });
  if (req.body.role === "PARENT") {
    await replaceParentStudentLinks(prisma, schoolId, updated.id, linkedStudentIds, "ADMIN");
  } else {
    await replaceParentStudentLinks(prisma, schoolId, updated.id, [], "ADMIN");
  }
  recordAuditLog(prisma, {
    schoolId,
    userId: req.user?.id || req.user?.userId || null,
    action: "USER_ROLE_UPDATE",
    entity: "SchoolUser",
    entityId: user.id,
    before: user as Prisma.InputJsonValue,
    after: updated as Prisma.InputJsonValue
  });
  res.json({
    data: {
      ...updated,
      studentIds: req.body.role === "PARENT" ? linkedStudentIds : uniqueNonEmpty([updated.studentId])
    }
  });
});

settingsRouter.post("/users/:id/deactivate", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const user = await getSchoolUserOr404(schoolId, String(req.params.id));
  if (!user) {
    return res.status(404).json({ error: "NOT_FOUND", message: "لم يتم العثور على المستخدم" });
  }

  if (user.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { schoolId, role: "ADMIN" } });
    if (adminCount <= 1) {
      return res.status(400).json({ error: "LAST_ADMIN", message: "لا يمكن تعطيل آخر مدير في النظام" });
    }
  }

  await prisma.user.delete({ where: { id: user.id } });
  recordAuditLog(prisma, {
    schoolId,
    userId: req.user?.id || req.user?.userId || null,
    action: "USER_DEACTIVATE",
    entity: "SchoolUser",
    entityId: user.id,
    before: user as Prisma.InputJsonValue
  });
  res.status(204).send();
});

settingsRouter.get("/roles", async (_req, res) => {
  res.json({
    data: [
      { value: "ADMIN", label: "مدير كامل" },
      { value: "SCHEDULER", label: "مسؤول جداول" },
      { value: "TEACHER", label: "معلم" },
      { value: "STUDENT", label: "طالب" },
      { value: "PARENT", label: "ولي أمر" }
    ]
  });
});

settingsRouter.get("/permissions", async (_req, res) => {
  res.json({
    data: ["read", "manageTeachers", "manageSchedules", "manageSettings", "manageLicense", "manageLessons"].map(
      (permission) => ({
        value: permission,
        label: permission
      })
    )
  });
});

settingsRouter.get("/permission-review", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const role = req.user?.role || "ADMIN";
  const lastReview = await prisma.auditLog.findFirst({
    where: { schoolId, action: "PERMISSION_REVIEW" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, userId: true }
  });
  res.json({
    data: {
      schoolId,
      role,
      lastPermissionsReviewAt: lastReview?.createdAt || null,
      lastPermissionsReviewBy: lastReview?.userId || null,
      canManageTeachers: canRole(role, "manageTeachers"),
      canManageSchedules: canRole(role, "manageSchedules"),
      canManageSettings: canRole(role, "manageSettings"),
      canManageLicense: canRole(role, "manageLicense"),
      canManageLessons: canRole(role, "manageLessons"),
      permissions: permissionsForRole(role),
      allowedPages: allowedPagesForRole(role)
    }
  });
});

settingsRouter.post("/permission-review", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const role = req.user?.role || "ADMIN";
  if (!canRole(role, "manageSettings")) {
    return res.status(403).json({ error: "FORBIDDEN", message: "لا تملك صلاحية مراجعة الصلاحيات" });
  }

  const now = new Date();
  recordAuditLog(prisma, {
    schoolId,
    userId: req.user?.id || req.user?.userId || null,
    action: "PERMISSION_REVIEW",
    entity: "SchoolPermissions",
    entityId: schoolId,
    after: {
      reviewedAt: now.toISOString(),
      reviewerRole: role
    } as Prisma.InputJsonValue
  });

  res.status(201).json({
    data: {
      ok: true,
      reviewedAt: now.toISOString()
    }
  });
});

settingsRouter.patch("/", validateBody(SchoolSettingsSchema), async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const data = req.body;
  const before = await prisma.schoolSettings.findUnique({ where: { schoolId } });
  const settings = await prisma.schoolSettings.upsert({
    where: { schoolId },
    update: data,
    create: { schoolId, ...data }
  });

  for (let i = 1; i <= settings.periodsPerDay; i++) {
    const existingPeriod = await prisma.periodDefinition.findUnique({
      where: { schoolId_period: { schoolId, period: i } }
    });
    if (existingPeriod) {
      await prisma.periodDefinition.update({
        where: { id: existingPeriod.id },
        data: { isActive: true }
      });
    } else {
      await prisma.periodDefinition.create({
        data: { schoolId, period: i, label: `الحصة ${i}`, isActive: true }
      });
    }
  }
  await prisma.periodDefinition.updateMany({
    where: { schoolId, period: { gt: settings.periodsPerDay } },
    data: { isActive: false }
  });

  recordAuditLog(prisma, {
    schoolId,
    userId: req.user?.id || req.user?.userId || null,
    action: "SETTINGS_UPDATE",
    entity: "SchoolSettings",
    entityId: schoolId,
    before: before as Prisma.InputJsonValue | null,
    after: settings as Prisma.InputJsonValue
  });
  res.json({ data: settings });
});

settingsRouter.patch("/school", validateBody(SchoolInfoSchema), async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const before = await prisma.school.findUnique({ where: { id: schoolId } });
  const school = await prisma.school.update({
    where: { id: schoolId },
    data: {
      name: req.body.name,
      managerName: req.body.managerName,
      institutionCode: req.body.institutionCode,
      address: req.body.address
    }
  });
  recordAuditLog(prisma, {
    schoolId,
    userId: req.user?.id || req.user?.userId || null,
    action: "SCHOOL_UPDATE",
    entity: "School",
    entityId: schoolId,
    before: before as Prisma.InputJsonValue | null,
    after: school as Prisma.InputJsonValue
  });
  res.json({ data: school });
});

settingsRouter.put("/periods", validateBody(z.array(PeriodDefinitionSchema)), async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const items = req.body;
  const before = await prisma.periodDefinition.findMany({ where: { schoolId } });
  const saved = [];
  for (const p of items) {
    saved.push(
      await prisma.periodDefinition.upsert({
        where: { schoolId_period: { schoolId, period: p.period } },
        update: {
          label: p.label,
          startTime: p.startTime,
          endTime: p.endTime,
          isActive: p.isActive
        },
        create: {
          schoolId,
          period: p.period,
          label: p.label,
          startTime: p.startTime,
          endTime: p.endTime,
          isActive: p.isActive
        }
      })
    );
  }
  recordAuditLog(prisma, {
    schoolId,
    userId: req.user?.id || req.user?.userId || null,
    action: "PERIODS_UPDATE",
    entity: "PeriodDefinition",
    entityId: schoolId,
    before: before as Prisma.InputJsonValue,
    after: saved as Prisma.InputJsonValue
  });
  res.json({ data: saved });
});
