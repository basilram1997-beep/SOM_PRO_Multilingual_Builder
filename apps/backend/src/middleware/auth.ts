import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../db/prisma";
import { canRole, Permission } from "../services/accessPolicy";
import { verifyAuthToken } from "../services/authService";
import { recordAuditLog } from "../services/auditLog";

const publicPaths = new Set([
  "/health",
  "/api/auth/login",
  "/api/auth/register",
  "/auth/register",
  "/api/license/status"
]);
const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const authInactivityTimeoutMs = Math.max(
  5 * 60_000,
  Math.floor((Number.isFinite(env.authInactivityTimeoutSeconds) ? env.authInactivityTimeoutSeconds : 30 * 60) * 1000)
);

function logDeniedAccess(req: Request, reason: string, requiredPermission?: Permission) {
  recordAuditLog(prisma, {
    schoolId: req.user?.schoolId || null,
    userId: req.user?.id || req.user?.userId || null,
    action: "DENIED ACCESS",
    entity: "HTTP_AUTH",
    before: null,
    after: {
      path: req.path,
      method: req.method,
      reason,
      requiredPermission: requiredPermission || null,
      role: req.user?.role || null
    } as unknown as Prisma.InputJsonValue
  });
}

export async function resolveAuthenticatedUserFromToken(token: string) {
  const payload = verifyAuthToken(token);
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.schoolId !== payload.schoolId) return null;

  const payloadTokenVersion = (payload as { tokenVersion?: number }).tokenVersion;
  const userTokenVersion = (user as { tokenVersion?: number }).tokenVersion ?? 0;
  if (payloadTokenVersion != null && userTokenVersion !== payloadTokenVersion) return null;
  if (payloadTokenVersion == null && userTokenVersion !== 0) return null;

  const lastActivityAtMs = user.lastActivityAt ? user.lastActivityAt.getTime() : null;
  if (lastActivityAtMs != null && Date.now() - lastActivityAtMs > authInactivityTimeoutMs) return null;

  void prisma.user
    .update({
      where: { id: user.id },
      data: { lastActivityAt: new Date() }
    })
    .catch(() => null);

  return user;
}

export async function authenticateRequest(req: Request, res: Response, next: NextFunction) {
  if (publicPaths.has(req.path)) return next();

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) {
    logDeniedAccess(req, "missing_token");
    return res.status(401).json({ error: "AUTH_REQUIRED", message: "تسجيل الدخول مطلوب" });
  }

  try {
    const user = await resolveAuthenticatedUserFromToken(token);
    if (!user) {
      logDeniedAccess(req, "invalid_session");
      return res.status(401).json({ error: "AUTH_INVALID", message: "جلسة الدخول غير صالحة" });
    }
    req.user = {
      id: user.id,
      userId: user.id,
      schoolId: user.schoolId,
      studentId: user.studentId,
      name: user.name,
      email: user.email,
      role: user.role
    };
    return next();
  } catch {
    logDeniedAccess(req, "invalid_token");
    return res.status(401).json({ error: "AUTH_INVALID", message: "جلسة الدخول منتهية أو غير صالحة" });
  }
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      logDeniedAccess(req, "missing_user", permission);
      return res.status(401).json({ error: "AUTH_REQUIRED", message: "تسجيل الدخول مطلوب" });
    }
    if (!canRole(req.user.role, permission)) {
      logDeniedAccess(req, "forbidden_permission", permission);
      return res.status(403).json({ error: "FORBIDDEN", message: "لا تملك صلاحية لتنفيذ هذه العملية" });
    }
    return next();
  };
}

export function requirePermissionForWrite(writePermission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const permission = writeMethods.has(req.method) ? writePermission : "read";
    return requirePermission(permission as Permission)(req, res, next);
  };
}
