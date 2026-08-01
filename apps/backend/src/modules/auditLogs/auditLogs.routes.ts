import { Router, type Request } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { canRole } from "../../services/accessPolicy";
import { recordAuditLog } from "../../services/auditLog";
import { getRequestSchoolId } from "../../services/schoolContext";
import { exportSecurityEventsAsJsonl, mapAuditLogToSecurityEvent } from "../../services/securityEventExport";

export const auditLogsRouter = Router();

const AuditLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  action: z.string().trim().min(1).max(120).optional(),
  entity: z.string().trim().min(1).max(120).optional(),
  entityId: z.string().trim().min(1).max(120).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
});

function canViewAuditLogs(req: Request) {
  return Boolean(req.user && canRole(req.user.role, "manageSettings"));
}

function normalizeJsonValue(value: unknown) {
  return value ?? null;
}

auditLogsRouter.get("/", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  if (!canViewAuditLogs(req)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "ليس لديك صلاحية تصدير سجل التدقيق"
    });
  }

  const parsed = AuditLogsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "INVALID_AUDIT_LOG_QUERY",
      message: "بيانات فلترة سجل التدقيق غير صحيحة"
    });
  }

  const limit = parsed.data.limit || 50;
  const offset = parsed.data.offset || 0;

  const where = {
    schoolId,
    ...(parsed.data.action ? { action: parsed.data.action } : {}),
    ...(parsed.data.entity ? { entity: parsed.data.entity } : {}),
    ...(parsed.data.entityId ? { entityId: parsed.data.entityId } : {}),
    ...(parsed.data.from || parsed.data.to
      ? {
          createdAt: {
            ...(parsed.data.from ? { gte: new Date(`${parsed.data.from}T00:00:00.000Z`) } : {}),
            ...(parsed.data.to ? { lte: new Date(`${parsed.data.to}T23:59:59.999Z`) } : {})
          }
        }
      : {})
  };

  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit
    })
  ]);

  res.json({
    data: {
      total,
      limit,
      offset,
      items: items.map((item) => ({
        id: item.id,
        schoolId: item.schoolId,
        userId: item.userId,
        action: item.action,
        entity: item.entity,
        entityId: item.entityId,
        before: normalizeJsonValue(item.before),
        after: normalizeJsonValue(item.after),
        createdAt: item.createdAt.toISOString()
      }))
    }
  });
});

auditLogsRouter.get("/export", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  if (!canViewAuditLogs(req)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "ليس لديك صلاحية عرض سجل التدقيق"
    });
  }

  const parsed = AuditLogsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "INVALID_AUDIT_LOG_QUERY",
      message: "بيانات فلترة سجل التدقيق غير صحيحة"
    });
  }

  const where = {
    schoolId,
    ...(parsed.data.action ? { action: parsed.data.action } : {}),
    ...(parsed.data.entity ? { entity: parsed.data.entity } : {}),
    ...(parsed.data.entityId ? { entityId: parsed.data.entityId } : {}),
    ...(parsed.data.from || parsed.data.to
      ? {
          createdAt: {
            ...(parsed.data.from ? { gte: new Date(`${parsed.data.from}T00:00:00.000Z`) } : {}),
            ...(parsed.data.to ? { lte: new Date(`${parsed.data.to}T23:59:59.999Z`) } : {})
          }
        }
      : {})
  };

  const items = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "asc" }
  });

  const exportBody = exportSecurityEventsAsJsonl(
    items.map((item) =>
      mapAuditLogToSecurityEvent({
        createdAt: item.createdAt,
        schoolId: item.schoolId,
        userId: item.userId,
        action: item.action,
        entity: item.entity,
        entityId: item.entityId,
        accessResult: item.accessResult,
        ipAddress: item.ipAddress,
        userAgent: item.userAgent
      })
    )
  );

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="audit-logs-${schoolId}.jsonl"`);
  res.send(exportBody);

  recordAuditLog(prisma, {
    schoolId,
    userId: req.user?.id || req.user?.userId || null,
    action: "AUDIT_LOG_EXPORT",
    entity: "AuditLog",
    entityId: schoolId,
    after: {
      action: parsed.data.action || null,
      entity: parsed.data.entity || null,
      entityId: parsed.data.entityId || null,
      from: parsed.data.from || null,
      to: parsed.data.to || null,
      exportedAt: new Date().toISOString()
    }
  });
});

auditLogsRouter.get("/:id", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  if (!canViewAuditLogs(req)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "ليس لديك صلاحية عرض سجل التدقيق"
    });
  }

  const log = await prisma.auditLog.findFirst({
    where: {
      id: String(req.params.id),
      schoolId
    }
  });

  if (!log) {
    return res.status(404).json({
      error: "AUDIT_LOG_NOT_FOUND",
      message: "سجل التدقيق غير موجود"
    });
  }

  res.json({
    data: {
      id: log.id,
      schoolId: log.schoolId,
      userId: log.userId,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      before: normalizeJsonValue(log.before),
      after: normalizeJsonValue(log.after),
      createdAt: log.createdAt.toISOString()
    }
  });
});
