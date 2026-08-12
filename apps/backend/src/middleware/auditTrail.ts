import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { getRequestSchoolId } from "../services/schoolContext";
import { redactSensitiveAuditValue } from "../services/auditLog";

const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function auditTrail(req: Request, res: Response, next: NextFunction) {
  if (!writeMethods.has(req.method) || req.path.startsWith("/api/license/status")) return next();
  const startedAt = Date.now();

  res.on("finish", async () => {
    if (res.statusCode >= 400) return;
    try {
      const body = Buffer.isBuffer(req.body)
        ? {
            type: "buffer",
            sizeBytes: req.body.length
          }
        : redactSensitiveAuditValue(req.body || null);
      await prisma.auditLog.create({
        data: {
          schoolId: await getRequestSchoolId(req),
          userId: req.user?.id || req.user?.userId || null,
          action: `${req.method} ${req.path}`,
          entity: "HTTP",
          accessResult: "SUCCESS",
          after: {
            statusCode: res.statusCode,
            durationMs: Date.now() - startedAt,
            body: body as Prisma.InputJsonValue
          }
        }
      });
    } catch {
      // Audit logging must never break the main request.
    }
  });

  next();
}
