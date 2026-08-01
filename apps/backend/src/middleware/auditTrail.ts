import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { getRequestSchoolId } from "../services/schoolContext";

const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const sensitiveKeys = new Set(["password", "token", "authorization", "licenseKey", "licenseCode", "ownerToken"]);

function redactSensitive(value: unknown): unknown {
  if (Buffer.isBuffer(value)) {
    return `[BUFFER ${value.length} BYTES]`;
  }
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sensitiveKeys.has(key) ? "[REDACTED]" : redactSensitive(item)
    ])
  );
}

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
        : redactSensitive(req.body || null);
      await prisma.auditLog.create({
        data: {
          schoolId: await getRequestSchoolId(req),
          action: `${req.method} ${req.path}`,
          entity: "HTTP",
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
