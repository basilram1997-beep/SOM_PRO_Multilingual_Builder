import { Prisma } from "@prisma/client";
import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { authenticateRequest } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { canRole } from "../../services/accessPolicy";
import {
  changeUserPassword,
  createAuthToken,
  findUsersByLoginIdentifier,
  hashPassword,
  loginWithPassword,
  normalizeLoginIdentifier
} from "../../services/authService";
import {
  createMfaEnrollment,
  decryptMfaState,
  getMfaProductionReadiness,
  verifyTotpCode
} from "../../services/mfaService";
import {
  bootstrapLicenseAccess,
  recoverLicenseAdminAccess,
  syncLicenseAdminAccountForLogin
} from "../../services/licenseService";
import { getDefaultSchoolId } from "../../services/schoolContext";
import { getRequestDeviceInfo } from "../../services/deviceContext";
import { createRateLimitMiddleware, rejectMultipartContent } from "../../middleware/requestProtections";
import { recordAuditLog } from "../../services/auditLog";
import { logSafeError } from "../../lib/safeLog";

export const authRouter = Router();
authRouter.use(rejectMultipartContent);

const loginRateLimit = createRateLimitMiddleware({
  key: "auth:login",
  windowMs: 60_000,
  max: 6,
  message: "تم تجاوز عدد محاولات الدخول المسموح مؤقتًا. حاول مرة أخرى بعد قليل.",
  auditAction: "RATE LIMITED LOGIN"
});

const bootstrapRateLimit = createRateLimitMiddleware({
  key: "auth:bootstrap",
  windowMs: 5 * 60_000,
  max: 2,
  message: "تم تكرار تجهيز حساب الترخيص بسرعة زائدة. حاول مرة أخرى بعد قليل.",
  auditAction: "RATE LIMITED BOOTSTRAP"
});

const registerRateLimit = createRateLimitMiddleware({
  key: "auth:register",
  windowMs: 60_000,
  max: 8,
  message: "تم تكرار إنشاء الحسابات بسرعة زائدة. حاول مرة أخرى بعد قليل.",
  auditAction: "RATE LIMITED REGISTER"
});

const recoverRateLimit = createRateLimitMiddleware({
  key: "auth:recover",
  windowMs: 60_000,
  max: 2,
  message: "تم تكرار طلب الاستعادة بسرعة زائدة. حاول مرة أخرى بعد قليل.",
  auditAction: "RATE LIMITED RECOVER"
});

const passwordChangeRateLimit = createRateLimitMiddleware({
  key: "auth:password-change",
  windowMs: 60_000,
  max: 4,
  message: "تم تكرار محاولة تغيير كلمة المرور بسرعة زائدة. حاول مرة أخرى بعد قليل.",
  auditAction: "RATE LIMITED PASSWORD CHANGE"
});

const authSelfServiceRateLimit = createRateLimitMiddleware({
  key: "auth:self-service",
  windowMs: 60_000,
  max: 12,
  message: "Auth self-service requests are being repeated too quickly. Try again shortly.",
  auditAction: "RATE LIMITED AUTH SELF SERVICE"
});

type BootstrapLicenseAccessResult = Awaited<ReturnType<typeof bootstrapLicenseAccess>>;

function emptyStringToUndefined(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

const optionalNonEmptyString = () => z.preprocess(emptyStringToUndefined, z.string().trim().min(1).optional());

const LoginSchema = z.object({
  email: z.string().trim().min(1, "USERNAME_REQUIRED"),
  password: z.string().min(1, "PASSWORD_REQUIRED"),
  mfaCode: optionalNonEmptyString(),
  recoveryCode: optionalNonEmptyString(),
  licenseCode: optionalNonEmptyString(),
  licenseKey: optionalNonEmptyString()
});

const LicenseCodeSchema = z
  .object({
    licenseCode: optionalNonEmptyString(),
    licenseKey: optionalNonEmptyString()
  })
  .refine((value) => Boolean(value.licenseCode || value.licenseKey), {
    message: "LICENSE_REQUIRED",
    path: ["licenseCode"]
  });

const RegisterSchema = z.object({
  name: z.string().trim().min(1, "NAME_REQUIRED"),
  email: z.string().trim().min(1, "USERNAME_REQUIRED"),
  password: z.string().min(6, "PASSWORD_TOO_SHORT"),
  role: z.enum(["STUDENT", "PARENT", "TEACHER"]).default("PARENT")
});

const RecoverSchema = z
  .object({
    licenseCode: optionalNonEmptyString(),
    licenseKey: optionalNonEmptyString(),
    email: z.string().trim().email("INVALID_EMAIL").optional()
  })
  .refine((value) => Boolean(value.licenseCode || value.licenseKey), {
    message: "LICENSE_REQUIRED",
    path: ["licenseCode"]
  });

const PasswordChangeSchema = z.object({
  currentPassword: z.string().min(1, "PASSWORD_REQUIRED"),
  newPassword: z.string().min(6, "PASSWORD_TOO_SHORT")
});

const MfaEnableSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "INVALID_MFA_CODE")
});

const MfaDisableSchema = z.object({
  userId: optionalNonEmptyString(),
  reason: z.string().trim().min(8, "REASON_REQUIRED")
});

const OidcCallbackSchema = z
  .object({
    idToken: optionalNonEmptyString(),
    code: optionalNonEmptyString(),
    state: optionalNonEmptyString(),
    schoolId: optionalNonEmptyString(),
    role: optionalNonEmptyString()
  })
  .passthrough();

function sendAuthError(res: Response, code: string, fallback: string) {
  return res.status(400).json({ error: code, message: fallback });
}

function loginFailureResponse(error: unknown, includeLicenseHint = false) {
  const code = error instanceof Error ? error.message : "";
  if (code === "SCHOOL_INACTIVE") {
    return { status: 403, message: "تم تعطيل هذه المدرسة" };
  }
  if (code === "CENTRAL_LICENSE_UNAVAILABLE" || code === "RECOVERY_NOT_AVAILABLE") {
    return { status: 503, message: "تعذر الاتصال بخادم الترخيص. حاول مرة أخرى بعد قليل." };
  }
  return {
    status: 401,
    message: includeLicenseHint
      ? "اسم المستخدم أو كلمة المرور أو كود الترخيص غير صحيح"
      : "اسم المستخدم أو كلمة المرور غير صحيحة"
  };
}

authRouter.post("/login", loginRateLimit, validateBody(LoginSchema), async (req, res) => {
  const email = String(req.body.email || "");
  const password = String(req.body.password || "");
  const licenseCode = String(req.body.licenseCode || req.body.licenseKey || "").trim();
  const secondFactor = {
    mfaCode: req.body.mfaCode ? String(req.body.mfaCode) : undefined,
    recoveryCode: req.body.recoveryCode ? String(req.body.recoveryCode) : undefined
  };

  try {
    const directResult = await loginWithPassword(email, password, secondFactor);
    return res.json({ data: directResult });
  } catch (error) {
    const existingUser = await findUsersByLoginIdentifier(email).catch(() => []);
    if (existingUser.length) {
      const failure = loginFailureResponse(error, false);
      return res.status(failure.status).json({ error: "INVALID_LOGIN", message: failure.message });
    }

    if (!licenseCode) {
      const failure = loginFailureResponse(error, false);
      return res.status(failure.status).json({ error: "INVALID_LOGIN", message: failure.message });
    }

    try {
      const bootstrapResult = await bootstrapLicenseAccess(licenseCode, getRequestDeviceInfo(req));
      await syncLicenseAdminAccountForLogin(email, password, getRequestDeviceInfo(req), licenseCode);
      const result = await loginWithPassword(email, password, secondFactor).catch(async () => {
        if (bootstrapResult.adminAccount?.email && bootstrapResult.adminAccount?.password) {
          return loginWithPassword(
            String(bootstrapResult.adminAccount.email),
            String(bootstrapResult.adminAccount.password),
            secondFactor
          );
        }
        throw new Error("INVALID_LOGIN");
      });
      return res.json({ data: result });
    } catch (licenseError) {
      const failure = loginFailureResponse(licenseError, true);
      return res.status(failure.status).json({ error: "INVALID_LOGIN", message: failure.message });
    }
  }
});

authRouter.post("/mfa/setup", authenticateRequest, authSelfServiceRateLimit, async (req, res) => {
  const actor = req.user!;
  if (!["ADMIN", "MANAGER", "SCHEDULER"].includes(actor.role)) {
    return res.status(403).json({ error: "MFA_NOT_ALLOWED", message: "MFA is required only for privileged accounts" });
  }

  const enrollment = createMfaEnrollment(actor.email || actor.name || actor.id);
  await prisma.user.update({
    where: { id: actor.id },
    data: {
      mfaEnabled: false,
      mfaMethod: "TOTP_PENDING",
      mfaSecretEncrypted: enrollment.encryptedState,
      tokenVersion: { increment: 1 }
    }
  });

  await recordAuditLog(prisma, {
    schoolId: actor.schoolId,
    userId: actor.id,
    action: "MFA_SETUP_STARTED",
    entity: "SchoolUser",
    entityId: actor.id,
    after: { method: "TOTP" } as Prisma.InputJsonValue
  });

  res.status(201).json({
    data: {
      method: "TOTP",
      secret: enrollment.secret,
      otpauthUrl: enrollment.otpauthUrl,
      recoveryCodes: enrollment.recoveryCodes
    }
  });
});

authRouter.post("/mfa/enable", authenticateRequest, authSelfServiceRateLimit, validateBody(MfaEnableSchema), async (req, res) => {
  const actor = req.user!;
  const user = await prisma.user.findFirst({
    where: { id: actor.id, schoolId: actor.schoolId },
    select: { id: true, schoolId: true, mfaSecretEncrypted: true, mfaMethod: true }
  });
  if (!user?.mfaSecretEncrypted || user.mfaMethod !== "TOTP_PENDING") {
    return res.status(400).json({ error: "MFA_SETUP_REQUIRED", message: "Start MFA setup before enabling MFA" });
  }

  const state = decryptMfaState(user.mfaSecretEncrypted);
  if (!verifyTotpCode(state.secret, String(req.body.code || ""))) {
    return res.status(400).json({ error: "INVALID_MFA_CODE", message: "MFA code is invalid" });
  }

  await prisma.user.update({
    where: { id: actor.id },
    data: { mfaEnabled: true, mfaMethod: "TOTP", tokenVersion: { increment: 1 } }
  });

  await recordAuditLog(prisma, {
    schoolId: actor.schoolId,
    userId: actor.id,
    action: "MFA_ENABLED",
    entity: "SchoolUser",
    entityId: actor.id,
    after: { method: "TOTP" } as Prisma.InputJsonValue
  });

  res.json({ data: { ok: true, method: "TOTP" } });
});

authRouter.get("/mfa/readiness", authenticateRequest, async (req, res) => {
  const actor = req.user!;
  if (!canRole(actor.role, "manageSettings")) {
    return res.status(403).json({ error: "FORBIDDEN", message: "MFA readiness requires settings authority" });
  }

  const readiness = await getMfaProductionReadiness(actor.schoolId);
  res.json({ data: readiness });
});

authRouter.post("/mfa/disable", authenticateRequest, authSelfServiceRateLimit, validateBody(MfaDisableSchema), async (req, res) => {
  const actor = req.user!;
  if (!canRole(actor.role, "manageSettings")) {
    return res.status(403).json({ error: "FORBIDDEN", message: "Disabling MFA requires settings authority" });
  }

  const targetUserId = String(req.body.userId || actor.id);
  const target = await prisma.user.findFirst({
    where: { id: targetUserId, schoolId: actor.schoolId },
    select: { id: true, schoolId: true, role: true, mfaEnabled: true, mfaMethod: true }
  });
  if (!target) {
    return res.status(404).json({ error: "USER_NOT_FOUND", message: "User was not found for the current school" });
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { mfaEnabled: false, mfaMethod: null, mfaSecretEncrypted: null, tokenVersion: { increment: 1 } }
  });

  await recordAuditLog(prisma, {
    schoolId: actor.schoolId,
    userId: actor.id,
    action: "MFA_DISABLED",
    entity: "SchoolUser",
    entityId: target.id,
    before: { mfaEnabled: target.mfaEnabled, mfaMethod: target.mfaMethod } as Prisma.InputJsonValue,
    after: { reason: String(req.body.reason || ""), targetRole: target.role } as Prisma.InputJsonValue
  });

  res.json({ data: { ok: true } });
});

authRouter.get("/sso/oidc/config", (_req, res) => {
  res.json({
    data: {
      enabled: false,
      provider: "OIDC",
      authority: null,
      clientId: null,
      callbackPath: "/api/auth/sso/oidc/callback"
    }
  });
});

authRouter.post("/sso/oidc/callback", validateBody(OidcCallbackSchema), async (req, res) => {
  if (req.body.schoolId || req.body.role) {
    await recordAuditLog(prisma, {
      schoolId: null,
      userId: null,
      action: "OIDC_CLIENT_CONTEXT_FORBIDDEN",
      entity: "SSO",
      after: {
        attemptedSchoolId: req.body.schoolId || null,
        attemptedRole: req.body.role || null,
        hasIdToken: Boolean(req.body.idToken),
        hasCode: Boolean(req.body.code)
      } as Prisma.InputJsonValue
    });

    return res.status(400).json({
      error: "OIDC_CLIENT_CONTEXT_FORBIDDEN",
      message: "OIDC school and role must be resolved from trusted provider claims, not client input"
    });
  }

  res.status(501).json({
    error: "OIDC_NOT_CONFIGURED",
    message: "OIDC/SSO is intentionally fail-closed until a trusted Ministry identity provider is configured"
  });
});

authRouter.post("/register", registerRateLimit, validateBody(RegisterSchema), async (req, res) => {
  try {
    const schoolId = await getDefaultSchoolId();
    const email = normalizeLoginIdentifier(String(req.body.email || ""));
    const name = String(req.body.name || "").trim();
    const existing = await findUsersByLoginIdentifier(String(req.body.email || ""));
    if (existing.length) {
      return res.status(409).json({ error: "USERNAME_EXISTS", message: "اسم المستخدم موجود مسبقًا" });
    }

    const linkedStudents = await prisma.student.findMany({
      where: {
        schoolId,
        name,
        status: "ACTIVE"
      },
      select: { id: true },
      take: 2
    });
    const linkedStudentId = linkedStudents.length === 1 ? linkedStudents[0]?.id || null : null;

    const created = await prisma.user.create({
      data: {
        schoolId,
        name,
        email,
        password: hashPassword(String(req.body.password || "")),
        role: req.body.role,
        ...(linkedStudentId ? { studentId: linkedStudentId } : {})
      },
      select: { id: true, schoolId: true, studentId: true, name: true, email: true, role: true, tokenVersion: true }
    });

    recordAuditLog(prisma, {
      schoolId,
      userId: null,
      action: "USER_REGISTER",
      entity: "SchoolUser",
      entityId: created.id,
      after: created as Prisma.InputJsonValue
    });

    const token = createAuthToken({
      userId: created.id,
      schoolId: created.schoolId,
      role: created.role,
      tokenVersion: created.tokenVersion
    });
    return res.status(201).json({
      data: {
        token,
        user: {
          id: created.id,
          schoolId: created.schoolId,
          studentId: created.studentId,
          name: created.name,
          email: created.email,
          role: created.role
        }
      }
    });
  } catch (error) {
    logSafeError("auth.register", error);
    sendAuthError(res, "REGISTER_FAILED", "تعذر إنشاء الحساب");
  }
});

authRouter.post("/logout", authenticateRequest, authSelfServiceRateLimit, async (_req, res) => {
  await prisma.user.update({
    where: { id: _req.user!.id },
    data: { tokenVersion: { increment: 1 } }
  });
  await recordAuditLog(prisma, {
    schoolId: _req.user!.schoolId,
    userId: _req.user!.id,
    action: "USER_LOGOUT",
    entity: "SchoolUser",
    entityId: _req.user!.id,
    after: { tokenRevoked: true } as Prisma.InputJsonValue
  });
  res.json({ data: { ok: true } });
});

authRouter.post("/password-reset/request", recoverRateLimit, validateBody(RecoverSchema), async (req, res) => {
  try {
    const licenseCode = String(req.body.licenseCode || req.body.licenseKey || "");
    const email = req.body.email ? String(req.body.email) : undefined;
    const result = await recoverLicenseAdminAccess(licenseCode, email);
    res.json({ data: result });
  } catch (error: unknown) {
    logSafeError("auth.password-reset.request", error);
    sendAuthError(res, "PASSWORD_RESET_REQUEST_FAILED", "تعذر إنشاء طلب إعادة تعيين كلمة المرور");
  }
});

authRouter.post(
  "/password-reset/confirm",
  authenticateRequest,
  passwordChangeRateLimit,
  validateBody(PasswordChangeSchema),
  async (req, res) => {
    try {
      await changeUserPassword(
        req.user!.id,
        String(req.body.currentPassword || ""),
        String(req.body.newPassword || "")
      );
      await recordAuditLog(prisma, {
        schoolId: req.user!.schoolId,
        userId: req.user!.id,
        action: "PASSWORD_RESET_CONFIRM",
        entity: "SchoolUser",
        entityId: req.user!.id,
        after: { passwordChanged: true } as Prisma.InputJsonValue
      });
      res.json({ data: { ok: true } });
    } catch (error: unknown) {
      logSafeError("auth.password-reset.confirm", error);
      sendAuthError(res, "PASSWORD_RESET_CONFIRM_FAILED", "تعذر تأكيد إعادة تعيين كلمة المرور");
    }
  }
);

authRouter.post("/bootstrap-license", bootstrapRateLimit, validateBody(LicenseCodeSchema), async (req, res) => {
  try {
    const licenseCode = String(req.body.licenseCode || req.body.licenseKey || "");
    const result: BootstrapLicenseAccessResult = await bootstrapLicenseAccess(licenseCode, getRequestDeviceInfo(req));
    res
      .status(201)
      .json({ data: { ok: true, adminAccount: result.adminAccount || null, adminUser: result.adminUser || null } });
  } catch (error: unknown) {
    logSafeError("auth.bootstrap-license", error);
    sendAuthError(res, "BOOTSTRAP_FAILED", "تعذر تجهيز حساب الترخيص");
  }
});

authRouter.post("/recover", recoverRateLimit, validateBody(RecoverSchema), async (req, res) => {
  try {
    const licenseCode = String(req.body.licenseCode || req.body.licenseKey || "");
    const email = req.body.email ? String(req.body.email) : undefined;
    const result = await recoverLicenseAdminAccess(licenseCode, email);
    res.json({ data: result });
  } catch (error: unknown) {
    logSafeError("auth.recover", error);
    sendAuthError(res, "RECOVERY_FAILED", "تعذرت استعادة بيانات الدخول");
  }
});

authRouter.post(
  "/change-password",
  authenticateRequest,
  passwordChangeRateLimit,
  validateBody(PasswordChangeSchema),
  async (req, res) => {
    try {
      await changeUserPassword(
        req.user!.id,
        String(req.body.currentPassword || ""),
        String(req.body.newPassword || "")
      );
      await recordAuditLog(prisma, {
        schoolId: req.user!.schoolId,
        userId: req.user!.id,
        action: "PASSWORD_CHANGE",
        entity: "SchoolUser",
        entityId: req.user!.id,
        after: { passwordChanged: true } as Prisma.InputJsonValue
      });
      res.json({ data: { ok: true } });
    } catch (error: unknown) {
      logSafeError("auth.change-password", error);
      sendAuthError(res, "PASSWORD_CHANGE_FAILED", "تعذر تغيير كلمة المرور");
    }
  }
);

authRouter.get("/me", authenticateRequest, async (req, res) => {
  res.json({ data: { user: req.user } });
});
