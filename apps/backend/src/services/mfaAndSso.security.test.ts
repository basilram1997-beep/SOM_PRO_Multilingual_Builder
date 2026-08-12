import test from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { prisma } from "../db/prisma";
import { createAuthToken, hashPassword, verifyPassword } from "./authService";
import { createMfaEnrollment, decryptMfaState, generateTotpCode } from "./mfaService";

function makeRunId() {
  return `${Date.now().toString(36)}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
}

function useSecurityRuntimeEnv() {
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
  const body = text ? JSON.parse(text) : null;
  return { response, body, text };
}

async function seedSecurityUsers(runId: string) {
  const schoolId = `mfa-school-${runId}`;
  const adminId = `mfa-admin-${runId}`;
  const schedulerId = `mfa-scheduler-${runId}`;
  const adminPassword = "Mfa-Admin-123!";
  const schedulerPassword = "Mfa-Scheduler-123!";
  const adminEmail = `mfa-admin-${runId}@example.com`;
  const schedulerEmail = `mfa-scheduler-${runId}@example.com`;
  const enrollment = createMfaEnrollment(adminEmail);

  await prisma.school.create({
    data: {
      id: schoolId,
      name: `MFA School ${runId}`,
      address: "Jerusalem",
      managerName: "MFA Manager",
      institutionCode: `MFA${runId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}`,
      adminMfaRequired: true,
      isActive: true
    }
  });

  await prisma.user.createMany({
    data: [
      {
        id: adminId,
        schoolId,
        name: "MFA Admin",
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
        name: "MFA Scheduler",
        email: schedulerEmail,
        password: hashPassword(schedulerPassword),
        role: "SCHEDULER"
      }
    ]
  });

  return {
    schoolId,
    adminId,
    schedulerId,
    adminPassword,
    schedulerPassword,
    adminEmail,
    schedulerEmail,
    enrollment
  };
}

test("MFA blocks privileged login without a second factor, hashes recovery codes, audits disable, and SSO fails closed", async () => {
  const restoreEnv = useSecurityRuntimeEnv();
  const runId = makeRunId();
  const seeded = await seedSecurityUsers(runId);
  let server: Server | null = null;

  try {
    const state = decryptMfaState(seeded.enrollment.encryptedState);
    assert.equal(state.recoveryCodes.length, seeded.enrollment.recoveryCodes.length);
    assert.equal(
      state.recoveryCodes.some((stored, index) => stored.hash === seeded.enrollment.recoveryCodes[index]),
      false,
      "recovery codes must not be stored as plaintext"
    );
    assert.equal(
      verifyPassword(seeded.enrollment.recoveryCodes[0], state.recoveryCodes[0].hash),
      true,
      "stored recovery codes should be one-way password hashes"
    );

    const { createApp } = await import("../app");
    const app = createApp();
    server = app.listen(0);
    await new Promise<void>((resolve) => server!.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Failed to determine runtime test port");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const loginWithoutMfa = await requestJson(baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: seeded.adminEmail, password: seeded.adminPassword })
    });
    assert.equal(loginWithoutMfa.response.status, 200, loginWithoutMfa.text);
    assert.equal(loginWithoutMfa.body?.data?.mfaRequired, true);
    assert.ok(loginWithoutMfa.body?.data?.mfaToken, "MFA challenge should be issued");
    assert.equal(loginWithoutMfa.body?.data?.token, undefined, "privileged login must not complete without MFA");

    const loginWithMfa = await requestJson(baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: seeded.adminEmail,
        password: seeded.adminPassword,
        mfaCode: generateTotpCode(seeded.enrollment.secret)
      })
    });
    assert.equal(loginWithMfa.response.status, 200, loginWithMfa.text);
    assert.ok(loginWithMfa.body?.data?.token, "valid MFA should complete login");

    const adminToken = String(loginWithMfa.body.data.token);
    const readiness = await requestJson(baseUrl, "/api/auth/mfa/readiness", {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(readiness.response.status, 200, readiness.text);
    assert.equal(readiness.body?.data?.ok, false, "production readiness must fail while privileged MFA is missing");
    assert.ok(
      readiness.body?.data?.missingPrivilegedUsers?.some((user: { id: string }) => user.id === seeded.schedulerId),
      "readiness should identify privileged users missing MFA"
    );

    const schedulerToken = createAuthToken({
      userId: seeded.schedulerId,
      schoolId: seeded.schoolId,
      role: "SCHEDULER",
      tokenVersion: 0
    });
    const forbiddenDisable = await requestJson(baseUrl, "/api/auth/mfa/disable", {
      method: "POST",
      headers: { Authorization: `Bearer ${schedulerToken}` },
      body: JSON.stringify({ userId: seeded.adminId, reason: "security regression test" })
    });
    assert.equal(forbiddenDisable.response.status, 403, forbiddenDisable.text);

    const allowedDisable = await requestJson(baseUrl, "/api/auth/mfa/disable", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ userId: seeded.adminId, reason: "rotating admin MFA device during security test" })
    });
    assert.equal(allowedDisable.response.status, 200, allowedDisable.text);
    const disabledAdmin = await prisma.user.findUnique({ where: { id: seeded.adminId } });
    assert.equal(disabledAdmin?.mfaEnabled, false);
    assert.equal(disabledAdmin?.mfaSecretEncrypted, null);
    const audit = await prisma.auditLog.findFirst({
      where: { schoolId: seeded.schoolId, userId: seeded.adminId, action: "MFA_DISABLED", entityId: seeded.adminId }
    });
    assert.ok(audit, "MFA disable must create an audit log");

    const oidcOverride = await requestJson(baseUrl, "/api/auth/sso/oidc/callback", {
      method: "POST",
      body: JSON.stringify({ idToken: "untrusted", schoolId: "other-school", role: "ADMIN" })
    });
    assert.equal(oidcOverride.response.status, 400, oidcOverride.text);
    assert.equal(oidcOverride.body?.error, "OIDC_CLIENT_CONTEXT_FORBIDDEN");

    const oidcFailClosed = await requestJson(baseUrl, "/api/auth/sso/oidc/callback", {
      method: "POST",
      body: JSON.stringify({ idToken: "untrusted" })
    });
    assert.equal(oidcFailClosed.response.status, 501, oidcFailClosed.text);
    assert.equal(oidcFailClosed.body?.error, "OIDC_NOT_CONFIGURED");
  } finally {
    if (server) await closeServer(server);
    await prisma.auditLog.deleteMany({ where: { schoolId: seeded.schoolId } }).catch(() => null);
    await prisma.user.deleteMany({ where: { schoolId: seeded.schoolId } }).catch(() => null);
    await prisma.schoolSettings.deleteMany({ where: { schoolId: seeded.schoolId } }).catch(() => null);
    await prisma.school.deleteMany({ where: { id: seeded.schoolId } }).catch(() => null);
    restoreEnv();
  }
});
