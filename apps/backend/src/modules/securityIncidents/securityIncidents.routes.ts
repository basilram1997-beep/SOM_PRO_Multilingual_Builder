import { Router, type Request } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { canRole } from "../../services/accessPolicy";
import { recordAuditLog } from "../../services/auditLog";
import { getRequestSchoolId } from "../../services/schoolContext";
import { logSafeError } from "../../lib/safeLog";

export const securityIncidentsRouter = Router();

const SecurityIncidentSeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const SecurityIncidentStatusSchema = z.enum(["SUSPECTED", "UNDER_REVIEW", "CONTAINED", "RESOLVED", "CLOSED"]);
const IncidentTextListSchema = z.array(z.string().trim().min(1).max(120)).default([]);

const SecurityIncidentCreateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(2000),
  severity: SecurityIncidentSeveritySchema.default("MEDIUM"),
  detectedAt: z.string().trim().min(1).optional(),
  systemsAffected: IncidentTextListSchema,
  dataAffected: IncidentTextListSchema,
  attackVector: z.string().trim().min(1).max(200).optional().nullable(),
  vulnerabilities: IncidentTextListSchema,
  evidenceNotes: z.string().trim().min(1).max(2000).optional().nullable()
});

const SecurityIncidentUpdateSchema = SecurityIncidentCreateSchema.partial().extend({
  status: SecurityIncidentStatusSchema.optional(),
  notifiedAt: z.string().trim().min(1).optional().nullable()
});

const SecurityIncidentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  status: SecurityIncidentStatusSchema.optional(),
  severity: SecurityIncidentSeveritySchema.optional()
});

function canManageSecurity(req: Request) {
  return Boolean(req.user && canRole(req.user.role, "manageSettings"));
}

function parseDateOrNow(value?: string | null) {
  if (!value) return new Date();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function mapIncident(incident: {
  id: string;
  schoolId: string;
  title: string;
  summary: string;
  severity: string;
  status: string;
  detectedAt: Date;
  reportedAt: Date;
  notifiedAt: Date | null;
  attackVector: string | null;
  evidenceNotes: string | null;
  systemsAffected: string[];
  dataAffected: string[];
  vulnerabilities: string[];
  reportedBy: string | null;
  reviewedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: incident.id,
    schoolId: incident.schoolId,
    title: incident.title,
    summary: incident.summary,
    severity: incident.severity,
    status: incident.status,
    detectedAt: incident.detectedAt.toISOString(),
    reportedAt: incident.reportedAt.toISOString(),
    notifiedAt: incident.notifiedAt ? incident.notifiedAt.toISOString() : null,
    attackVector: incident.attackVector,
    evidenceNotes: incident.evidenceNotes,
    systemsAffected: incident.systemsAffected,
    dataAffected: incident.dataAffected,
    vulnerabilities: incident.vulnerabilities,
    reportedBy: incident.reportedBy,
    reviewedBy: incident.reviewedBy,
    createdAt: incident.createdAt.toISOString(),
    updatedAt: incident.updatedAt.toISOString()
  };
}

securityIncidentsRouter.get("/", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  if (!canManageSecurity(req)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "Security incident access is restricted to administrators."
    });
  }

  const parsed = SecurityIncidentQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "INVALID_SECURITY_INCIDENT_QUERY",
      message: "Invalid incident filter data."
    });
  }

  const where = {
    schoolId,
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
    ...(parsed.data.severity ? { severity: parsed.data.severity } : {})
  };

  const [total, items] = await Promise.all([
    prisma.securityIncident.count({ where }),
    prisma.securityIncident.findMany({
      where,
      orderBy: { reportedAt: "desc" },
      take: parsed.data.limit || 20
    })
  ]);

  const counts = await prisma.securityIncident.groupBy({
    by: ["status"],
    where: { schoolId },
    _count: { status: true }
  });

  res.json({
    data: {
      total,
      counts: counts.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      }, {}),
      items: items.map(mapIncident)
    }
  });
});

securityIncidentsRouter.post("/", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  if (!canManageSecurity(req)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "Security incident reporting is restricted to administrators."
    });
  }

  const parsed = SecurityIncidentCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "INVALID_SECURITY_INCIDENT",
      message: "Incident details are invalid."
    });
  }

  const detectedAt = parseDateOrNow(parsed.data.detectedAt);
  if (!detectedAt) {
    return res.status(400).json({
      error: "INVALID_SECURITY_INCIDENT_DATE",
      message: "Detected time is invalid."
    });
  }

  try {
    const incident = await prisma.securityIncident.create({
      data: {
        schoolId,
        title: parsed.data.title,
        summary: parsed.data.summary,
        severity: parsed.data.severity,
        status: "SUSPECTED",
        detectedAt,
        attackVector: parsed.data.attackVector || null,
        evidenceNotes: parsed.data.evidenceNotes || null,
        systemsAffected: parsed.data.systemsAffected,
        dataAffected: parsed.data.dataAffected,
        vulnerabilities: parsed.data.vulnerabilities,
        reportedBy: req.user?.id || req.user?.userId || null
      }
    });

    await recordAuditLog(prisma, {
      schoolId,
      userId: req.user?.id || req.user?.userId || null,
      action: "SECURITY_INCIDENT_REPORTED",
      entity: "SecurityIncident",
      entityId: incident.id,
      after: mapIncident(incident)
    });

    return res.status(201).json({ data: mapIncident(incident) });
  } catch (error) {
    logSafeError("securityIncidents.create", error);
    return res.status(500).json({
      error: "SECURITY_INCIDENT_CREATE_FAILED",
      message: "Unable to record the incident right now."
    });
  }
});

securityIncidentsRouter.patch("/:id", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  if (!canManageSecurity(req)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "Security incident updates are restricted to administrators."
    });
  }

  const parsed = SecurityIncidentUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "INVALID_SECURITY_INCIDENT",
      message: "Incident details are invalid."
    });
  }

  const existing = await prisma.securityIncident.findFirst({
    where: { id: String(req.params.id), schoolId }
  });

  if (!existing) {
    return res.status(404).json({
      error: "SECURITY_INCIDENT_NOT_FOUND",
      message: "Incident not found."
    });
  }

  const detectedAt = parsed.data.detectedAt ? parseDateOrNow(parsed.data.detectedAt) : existing.detectedAt;
  if (!detectedAt) {
    return res.status(400).json({
      error: "INVALID_SECURITY_INCIDENT_DATE",
      message: "Detected time is invalid."
    });
  }

  const notifiedAt = parsed.data.notifiedAt ? parseDateOrNow(parsed.data.notifiedAt) : existing.notifiedAt;
  if (parsed.data.notifiedAt && !notifiedAt) {
    return res.status(400).json({
      error: "INVALID_SECURITY_INCIDENT_DATE",
      message: "Notification time is invalid."
    });
  }

  try {
    const incident = await prisma.securityIncident.update({
      where: { id: existing.id },
      data: {
        title: parsed.data.title ?? existing.title,
        summary: parsed.data.summary ?? existing.summary,
        severity: parsed.data.severity ?? existing.severity,
        status: parsed.data.status ?? existing.status,
        detectedAt,
        notifiedAt: parsed.data.notifiedAt === null ? null : notifiedAt,
        attackVector: parsed.data.attackVector === undefined ? existing.attackVector : parsed.data.attackVector || null,
        evidenceNotes:
          parsed.data.evidenceNotes === undefined ? existing.evidenceNotes : parsed.data.evidenceNotes || null,
        systemsAffected: parsed.data.systemsAffected ?? existing.systemsAffected,
        dataAffected: parsed.data.dataAffected ?? existing.dataAffected,
        vulnerabilities: parsed.data.vulnerabilities ?? existing.vulnerabilities,
        reviewedBy: req.user?.id || req.user?.userId || existing.reviewedBy
      }
    });

    await recordAuditLog(prisma, {
      schoolId,
      userId: req.user?.id || req.user?.userId || null,
      action: "SECURITY_INCIDENT_UPDATED",
      entity: "SecurityIncident",
      entityId: incident.id,
      before: mapIncident(existing),
      after: mapIncident(incident)
    });

    return res.json({ data: mapIncident(incident) });
  } catch (error) {
    logSafeError("securityIncidents.update", error);
    return res.status(500).json({
      error: "SECURITY_INCIDENT_UPDATE_FAILED",
      message: "Unable to update the incident right now."
    });
  }
});

securityIncidentsRouter.get("/:id", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  if (!canManageSecurity(req)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "Security incident access is restricted to administrators."
    });
  }

  const incident = await prisma.securityIncident.findFirst({
    where: { id: String(req.params.id), schoolId }
  });

  if (!incident) {
    return res.status(404).json({
      error: "SECURITY_INCIDENT_NOT_FOUND",
      message: "Incident not found."
    });
  }

  res.json({ data: mapIncident(incident) });
});
