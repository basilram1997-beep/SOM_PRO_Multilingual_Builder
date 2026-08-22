import test from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { prisma } from "../db/prisma";
import { createAuthToken, hashPassword } from "./authService";
import { recordAuditLog, redactSensitiveAuditValue } from "./auditLog";
import { createMfaEnrollment, generateTotpCode } from "./mfaService";

function makeRunId() {
  return `${Date.now().toString(36)}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
}

function useAuditSecurityRuntimeEnv() {
  const originalRequireCentral = process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE;
  const originalCentralUrl = process.env.SOM_PRO_LICENSE_SERVER_URL;
  const originalLegacyCentralUrl = process.env.SOM_LICENSE_SERVER_URL;
  const originalRuntimeMode = process.env.SOM_RUNTIME_MODE;
  const originalDisableRateLimit = process.env.SOM_E2E_DISABLE_RATE_LIMIT;

  process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE = "false";
  process.env.SOM_PRO_LICENSE_SERVER_URL = "";
  process.env.SOM_LICENSE_SERVER_URL = "";
  process.env.SOM_RUNTIME_MODE = "development";
  process.env.SOM_E2E_DISABLE_RATE_LIMIT = "true";

  return () => {
    process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE = originalRequireCentral;
    process.env.SOM_PRO_LICENSE_SERVER_URL = originalCentralUrl;
    process.env.SOM_LICENSE_SERVER_URL = originalLegacyCentralUrl;
    process.env.SOM_RUNTIME_MODE = originalRuntimeMode;
    process.env.SOM_E2E_DISABLE_RATE_LIMIT = originalDisableRateLimit;
  };
}

async function closeServer(server: Server) {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function requestJson(baseUrl: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
  const text = await response.text();
  const body = text && response.headers.get("content-type")?.includes("application/json") ? JSON.parse(text) : null;
  return { response, body, text };
}

async function seedAuditSecurityUsers(runId: string) {
  const schoolId = `audit-school-${runId}`;
  const adminId = `audit-admin-${runId}`;
  const schedulerId = `audit-scheduler-${runId}`;
  const auditLogId = `audit-log-${runId}`;
  const adminPassword = "Audit-Admin-123!";
  const schedulerPassword = "Audit-Scheduler-123!";
  const adminEmail = `audit-admin-${runId}@example.com`;
  const schedulerEmail = `audit-scheduler-${runId}@example.com`;
  const enrollment = createMfaEnrollment(adminEmail);

  await prisma.school.create({
    data: {
      id: schoolId,
      name: `Audit School ${runId}`,
      address: "Jerusalem",
      managerName: "Audit Manager",
      institutionCode: `AUD${runId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}`,
      isActive: true
    }
  });

  await prisma.user.createMany({
    data: [
      {
        id: adminId,
        schoolId,
        name: "Audit Admin",
        email: adminEmail,
        password: hashPassword(adminPassword),
        role: "ADMIN",
        mfaEnabled: true,
        mfaMethod: "TOTP",
        mfaSecretEncrypted: enrollment.encryptedState
      },
      {
        id: schedulerId,
        schoolId,
        name: "Audit Scheduler",
        email: schedulerEmail,
        password: hashPassword(schedulerPassword),
        role: "SCHEDULER"
      }
    ]
  });

  await recordAuditLog(prisma, {
    schoolId,
    userId: adminId,
    action: "AUDIT_SECURITY_SEED",
    entity: "AuditLog",
    entityId: auditLogId,
    before: {
      password: "before-password",
      nested: { Authorization: "Bearer secret-token" }
    },
    after: {
      token: "raw-token",
      licenseCode: "raw-license",
      mfaCode: "123456",
      recoveryCode: "AAAA-BBBB-CCCC",
      safeField: "safe-value"
    }
  });

  const seededLog = await prisma.auditLog.findFirstOrThrow({
    where: { schoolId, action: "AUDIT_SECURITY_SEED" },
    orderBy: { createdAt: "desc" }
  });

  return {
    schoolId,
    adminId,
    schedulerId,
    adminPassword,
    schedulerPassword,
    adminEmail,
    schedulerEmail,
    enrollment,
    auditLogId: seededLog.id
  };
}

function assertNoSecret(value: unknown, secrets: string[]) {
  const serialized = JSON.stringify(value);
  for (const secret of secrets) {
    assert.equal(serialized.includes(secret), false, `audit evidence must not contain secret: ${secret}`);
  }
}

test("audit logs are immutable through API, permission-gated, redacted, export-safe, and record security denials", async () => {
  const restoreEnv = useAuditSecurityRuntimeEnv();
  const runId = makeRunId();
  const seeded = await seedAuditSecurityUsers(runId);
  let server: Server | null = null;

  try {
    const redacted = redactSensitiveAuditValue({
      Password: "case-sensitive-risk",
      nested: { recoveryCode: "raw-recovery", mfaSecretEncrypted: "encrypted-secret" },
      safe: "visible"
    });
    assertNoSecret(redacted, ["case-sensitive-risk", "raw-recovery", "encrypted-secret"]);
    assert.equal((redacted as { safe: string }).safe, "visible");

    const seedAudit = await prisma.auditLog.findUniqueOrThrow({ where: { id: seeded.auditLogId } });
    assertNoSecret(seedAudit, [
      "before-password",
      "secret-token",
      "raw-token",
      "raw-license",
      "123456",
      "AAAA-BBBB-CCCC"
    ]);
    assert.equal((seedAudit.after as { safeField?: string })?.safeField, "safe-value");

    const { createApp } = await import("../app");
    const app = createApp();
    server = app.listen(0);
    await new Promise<void>((resolve) => server!.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Failed to determine runtime test port");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const schedulerToken = createAuthToken({
      userId: seeded.schedulerId,
      schoolId: seeded.schoolId,
      role: "SCHEDULER",
      tokenVersion: 0
    });
    const adminLogin = await requestJson(baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: seeded.adminEmail,
        password: seeded.adminPassword,
        mfaCode: generateTotpCode(seeded.enrollment.secret)
      })
    });
    assert.equal(adminLogin.response.status, 200, adminLogin.text);
    const adminToken = String(adminLogin.body?.data?.token || "");
    assert.ok(adminToken);

    const nonAdminAuditList = await requestJson(baseUrl, "/api/audit-logs?limit=20", {
      headers: { Authorization: `Bearer ${schedulerToken}` }
    });
    assert.equal(nonAdminAuditList.response.status, 403, nonAdminAuditList.text);

    const deniedAudit = await prisma.auditLog.findFirst({
      where: { schoolId: seeded.schoolId, userId: seeded.schedulerId, action: "DENIED ACCESS", entity: "HTTP_AUTH" },
      orderBy: { createdAt: "desc" }
    });
    assert.ok(deniedAudit, "non-admin audit access denial must be audited");

    const beforeDelete = await prisma.auditLog.findUnique({ where: { id: seeded.auditLogId } });
    const forbiddenDelete = await requestJson(baseUrl, `/api/audit-logs/${seeded.auditLogId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ password: "delete-secret", mfaCode: "654321" })
    });
    assert.notEqual(forbiddenDelete.response.status, 200, forbiddenDelete.text);
    const afterDelete = await prisma.auditLog.findUnique({ where: { id: seeded.auditLogId } });
    assert.deepEqual(afterDelete?.createdAt, beforeDelete?.createdAt, "audit log must remain after unsupported delete");

    const forbiddenPatch = await requestJson(baseUrl, `/api/audit-logs/${seeded.auditLogId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ after: { token: "patched-token" } })
    });
    assert.notEqual(forbiddenPatch.response.status, 200, forbiddenPatch.text);
    const afterPatch = await prisma.auditLog.findUnique({ where: { id: seeded.auditLogId } });
    assert.deepEqual(afterPatch?.after, afterDelete?.after, "audit log must not be mutable through API");

    const disableMfa = await requestJson(baseUrl, "/api/auth/mfa/disable", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        userId: seeded.adminId,
        reason: "rotating MFA device during audit redaction test",
        recoveryCode: "RAW-RECOVERY-CODE",
        licenseCode: "RAW-LICENSE-CODE",
        nested: { Authorization: "Bearer RAW-AUTHORIZATION" }
      })
    });
    assert.equal(disableMfa.response.status, 200, disableMfa.text);
    const mfaDisableAudit = await prisma.auditLog.findFirst({
      where: { schoolId: seeded.schoolId, userId: seeded.adminId, action: "MFA_DISABLED" },
      orderBy: { createdAt: "desc" }
    });
    assert.ok(mfaDisableAudit, "MFA disable must be audited");
    assertNoSecret(mfaDisableAudit, ["RAW-RECOVERY-CODE", "RAW-LICENSE-CODE", "RAW-AUTHORIZATION"]);

    const loginAfterMfaDisable = await requestJson(baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: seeded.adminEmail, password: seeded.adminPassword })
    });
    assert.equal(loginAfterMfaDisable.response.status, 200, loginAfterMfaDisable.text);
    const refreshedAdminToken = String(loginAfterMfaDisable.body?.data?.token || "");
    assert.ok(refreshedAdminToken, "admin should receive a fresh token after MFA disable invalidates old sessions");

    const oidcForbidden = await requestJson(baseUrl, "/api/auth/sso/oidc/callback", {
      method: "POST",
      body: JSON.stringify({
        idToken: "RAW-ID-TOKEN",
        schoolId: seeded.schoolId,
        role: "ADMIN",
        recoveryCode: "OIDC-RECOVERY-CODE"
      })
    });
    assert.equal(oidcForbidden.response.status, 400, oidcForbidden.text);
    const oidcAudit = await prisma.auditLog.findFirst({
      where: { action: "OIDC_CLIENT_CONTEXT_FORBIDDEN", entity: "SSO" },
      orderBy: { createdAt: "desc" }
    });
    assert.ok(oidcAudit, "OIDC client context override must be audited");
    assertNoSecret(oidcAudit, ["RAW-ID-TOKEN", "OIDC-RECOVERY-CODE"]);

    const auditList = await requestJson(baseUrl, "/api/audit-logs?limit=200", {
      headers: { Authorization: `Bearer ${refreshedAdminToken}` }
    });
    assert.equal(auditList.response.status, 200, auditList.text);
    assertNoSecret(auditList.body, [
      "before-password",
      "secret-token",
      "raw-token",
      "raw-license",
      "123456",
      "AAAA-BBBB-CCCC",
      "RAW-RECOVERY-CODE",
      "RAW-LICENSE-CODE",
      "RAW-AUTHORIZATION"
    ]);

    const exportResponse = await fetch(`${baseUrl}/api/audit-logs/export`, {
      headers: { Authorization: `Bearer ${refreshedAdminToken}` }
    });
    const exportText = await exportResponse.text();
    assert.equal(exportResponse.status, 200, exportText);
    assert.equal(exportResponse.headers.get("content-type")?.includes("application/x-ndjson"), true);
    assertNoSecret(exportText, ["before-password", "raw-token", "RAW-RECOVERY-CODE", "RAW-ID-TOKEN"]);
  } finally {
    if (server) await closeServer(server);
    await prisma.auditLog
      .deleteMany({ where: { OR: [{ schoolId: seeded.schoolId }, { action: "OIDC_CLIENT_CONTEXT_FORBIDDEN" }] } })
      .catch(() => null);
    await prisma.user.deleteMany({ where: { schoolId: seeded.schoolId } }).catch(() => null);
    await prisma.schoolSettings.deleteMany({ where: { schoolId: seeded.schoolId } }).catch(() => null);
    await prisma.school.deleteMany({ where: { id: seeded.schoolId } }).catch(() => null);
    restoreEnv();
  }
});
