import { Router, type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import { DesktopLicenseSetupSchema } from "@som/shared";
import { authenticateRequest, requirePermission } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { createRateLimitMiddleware, rejectMultipartContent } from "../../middleware/requestProtections";
import { prisma } from "../../db/prisma";
import {
  activateLicense,
  getLicenseState,
  getPersistedLicenseSetup,
  savePersistedLicenseSetup
} from "../../services/licenseService";
import { getRequestDeviceInfo } from "../../services/deviceContext";
import { recordAuditLog } from "../../services/auditLog";
import { logSafeError } from "../../lib/safeLog";
import { resolveAuthenticatedUserFromToken } from "../../middleware/auth";
import { z } from "zod";

export const licenseRouter = Router();
const LicenseActivationSchema = z
  .object({
    licenseCode: z.string().trim().min(1).optional(),
    licenseKey: z.string().trim().min(1).optional()
  })
  .refine((value) => Boolean(value.licenseCode || value.licenseKey), {
    message: "LICENSE_REQUIRED",
    path: ["licenseCode"]
  });
const licenseStatusRateLimit = createRateLimitMiddleware({
  key: "license:status",
  windowMs: 60_000,
  max: 20,
  message: "تم تكرار فحص حالة الترخيص بسرعة زائدة. انتظر قليلًا ثم حاول مرة أخرى.",
  auditAction: "RATE LIMITED LICENSE STATUS"
});
const licenseActivateRateLimit = createRateLimitMiddleware({
  key: "license:activate",
  windowMs: 5 * 60_000,
  max: 3,
  message: "تم تكرار تفعيل الترخيص بسرعة زائدة. انتظر قليلًا ثم حاول مرة أخرى.",
  auditAction: "RATE LIMITED LICENSE ACTIVATE"
});

licenseRouter.use(rejectMultipartContent);

async function attachOptionalAuth(req: Request, _res: Response, next: () => void) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) return next();

  try {
    const user = await resolveAuthenticatedUserFromToken(token);
    if (user) {
      req.user = req.user || {
        id: user.id,
        userId: user.id,
        schoolId: user.schoolId,
        name: user.name,
        email: user.email,
        role: user.role
      };
    }
  } catch {
    // Keep license status accessible without auth; fall back to development/default school.
  }
  return next();
}

async function sendLicenseState(req: Request, res: Response) {
  const state = await getLicenseState(req.user?.schoolId, getRequestDeviceInfo(req));
  recordAuditLog(prisma, {
    schoolId: req.user?.schoolId || null,
    userId: req.user?.id || req.user?.userId || null,
    action: "LICENSE_STATUS_CHECK",
    entity: "License",
    after: state as Prisma.InputJsonValue
  });
  res.json({ data: state });
}

licenseRouter.get("/status", licenseStatusRateLimit, attachOptionalAuth, async (req, res) => {
  await sendLicenseState(req, res);
});

licenseRouter.post("/status", licenseStatusRateLimit, attachOptionalAuth, async (req, res) => {
  await sendLicenseState(req, res);
});

licenseRouter.get("/setup", authenticateRequest, requirePermission("manageLicense"), async (req, res) => {
  const setup = await getPersistedLicenseSetup(req.user!.schoolId);
  res.json({ data: setup });
});

licenseRouter.put(
  "/setup",
  authenticateRequest,
  requirePermission("manageLicense"),
  validateBody(DesktopLicenseSetupSchema),
  async (req, res) => {
    try {
      const setup = await savePersistedLicenseSetup(req.body, req.user!.schoolId, getRequestDeviceInfo(req));
      recordAuditLog(prisma, {
        schoolId: req.user!.schoolId,
        userId: req.user?.id || req.user?.userId || null,
        action: "LICENSE_SETUP_SAVE",
        entity: "License",
        entityId: req.user!.schoolId,
        after: setup as Prisma.InputJsonValue
      });
      res.json({ data: setup });
    } catch (error: unknown) {
      logSafeError("license.setup.save", error);
      res.status(400).json({
        error: "LICENSE_SETUP_SAVE_FAILED",
        message: "تعذر حفظ إعدادات الترخيص"
      });
    }
  }
);

licenseRouter.post(
  "/activate",
  authenticateRequest,
  requirePermission("manageLicense"),
  licenseActivateRateLimit,
  validateBody(LicenseActivationSchema),
  async (req, res) => {
    try {
      const license = await activateLicense(
        String(req.body.licenseCode || req.body.licenseKey || ""),
        req.user!.schoolId,
        getRequestDeviceInfo(req)
      );
      recordAuditLog(prisma, {
        schoolId: req.user!.schoolId,
        userId: req.user?.id || req.user?.userId || null,
        action: "LICENSE_ACTIVATE",
        entity: "License",
        entityId: req.user!.schoolId,
        after: license as Prisma.InputJsonValue
      });
      res.status(201).json({ data: license });
    } catch (error: unknown) {
      logSafeError("license.activate", error);
      res.status(400).json({
        error: "LICENSE_ACTIVATION_FAILED",
        message: "تعذر تفعيل الترخيص"
      });
    }
  }
);
