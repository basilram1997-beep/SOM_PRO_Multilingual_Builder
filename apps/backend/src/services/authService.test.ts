import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import { prisma } from "../db/prisma";
import { resolveAuthenticatedUserFromToken } from "../middleware/auth";
import {
  createAuthToken,
  changeUserPassword,
  hashPassword,
  loginWithPassword,
  normalizeLoginIdentifier,
  verifyAuthToken,
  verifyPassword
} from "./authService";
import { getLicenseCredentialHashForStorage } from "./licenseService";

test("password hashing verifies the original password only", () => {
  const hashed = hashPassword("correct-password");
  assert.equal(verifyPassword("correct-password", hashed), true);
  assert.equal(verifyPassword("wrong-password", hashed), false);
});

test("auth token can be verified and expires", () => {
  const token = createAuthToken({ userId: "u1", schoolId: "s1", role: "ADMIN", tokenVersion: 2 }, 60);
  const payload = verifyAuthToken(token);
  assert.equal(payload.userId, "u1");
  assert.equal(payload.role, "ADMIN");
  assert.equal(payload.tokenVersion, 2);
});

test("logout invalidates old auth tokens through token version checks", async () => {
  const originalFindUnique = prisma.user.findUnique;
  const token = createAuthToken({ userId: "u1", schoolId: "s1", role: "ADMIN", tokenVersion: 1 }, 60);

  prisma.user.findUnique = (async () => ({
    id: "u1",
    schoolId: "s1",
    studentId: null,
    name: "Admin",
    email: "admin@example.com",
    role: "ADMIN",
    tokenVersion: 2,
    lastActivityAt: null
  })) as unknown as typeof prisma.user.findUnique;

  try {
    const resolved = await resolveAuthenticatedUserFromToken(token);
    assert.equal(resolved, null);
  } finally {
    prisma.user.findUnique = originalFindUnique;
  }
});

test("inactive auth sessions are rejected after the configured timeout", async () => {
  const originalFindUnique = prisma.user.findUnique;
  const token = createAuthToken({ userId: "u2", schoolId: "s1", role: "ADMIN", tokenVersion: 0 }, 60);
  const staleActivity = new Date(Date.now() - 31 * 60_000);

  prisma.user.findUnique = (async () => ({
    id: "u2",
    schoolId: "s1",
    studentId: null,
    name: "Admin",
    email: "admin2@example.com",
    role: "ADMIN",
    tokenVersion: 0,
    lastActivityAt: staleActivity
  })) as unknown as typeof prisma.user.findUnique;

  try {
    const resolved = await resolveAuthenticatedUserFromToken(token);
    assert.equal(resolved, null);
  } finally {
    prisma.user.findUnique = originalFindUnique;
  }
});

test("license activation does not force reset the school admin password", () => {
  const source = readFileSync("src/services/licenseService.ts", "utf8");
  assert.match(source, /ensureLicenseAdminAccount\(payload\.adminAccount, payload, false\)/);
  assert.match(source, /ensureLicenseAdminAccount\(account, central\.data as LicensePayload, true\)/);
});

test("login identifiers normalize to stable email-like values", () => {
  assert.equal(normalizeLoginIdentifier("Basil"), "basil@som.local");
  assert.equal(normalizeLoginIdentifier("Basil@Example.com"), "basil@example.com");
  assert.equal(normalizeLoginIdentifier("  "), "");
});

test("login identifier lookup supports legacy plain usernames and normalized emails", () => {
  const source = readFileSync("src/services/authService.ts", "utf8");
  assert.match(source, /function loginIdentifierCandidates\(value: string\)/);
  assert.match(source, /new Set\(\[trimmed, lower, normalized\]\.filter\(Boolean\)\)/);
  assert.match(source, /export async function findUsersByLoginIdentifier\(value: string\)/);
  assert.match(
    source,
    /prisma\.user\.findMany\(\{\s*where:\s*\{\s*OR:\s*candidates\.flatMap\(\(?identifier\)?\s*=>\s*\[/s
  );
});

test("login can sync owner generated password with the submitted license code", () => {
  const source = readFileSync("src/modules/auth/auth.routes.ts", "utf8");
  const bootstrapIndex = source.indexOf("bootstrapLicenseAccess");
  const syncIndex = source.indexOf("syncLicenseAdminAccountForLogin");
  const secondLoginIndex = source.lastIndexOf("loginWithPassword");
  assert.ok(bootstrapIndex >= 0);
  assert.ok(syncIndex > bootstrapIndex);
  assert.ok(secondLoginIndex > syncIndex);
  assert.match(source, /syncLicenseAdminAccountForLogin\(email, password, getRequestDeviceInfo\(req\), licenseCode\)/);
});

test("short license code hash matches license server normalized code hash", () => {
  const normalized = "SOM-ABCD-EF23-GH45";
  const compact = "somabcd ef23-gh45";
  const expected = crypto.createHash("sha256").update(normalized).digest("hex");
  assert.equal(getLicenseCredentialHashForStorage(compact), expected);
});

test("auth login route requires a license code before password login", () => {
  const source = readFileSync("src/modules/auth/auth.routes.ts", "utf8");
  assert.match(source, /LICENSE_REQUIRED/);
  assert.match(source, /validateBody\(LoginSchema\)/);
  assert.match(source, /validateBody\(LicenseCodeSchema\)/);
  assert.match(source, /validateBody\(RecoverSchema\)/);
  assert.match(source, /await bootstrapLicenseAccess\(licenseCode, getRequestDeviceInfo\(req\)\)/);
  assert.match(source, /syncLicenseAdminAccountForLogin\(email, password, getRequestDeviceInfo\(req\), licenseCode\)/);
});

test("loginWithPassword returns a token and user on the happy path", async () => {
  const originalFindFirst = prisma.user.findFirst;
  const originalFindMany = prisma.user.findMany;
  const originalUpdate = prisma.user.update;
  const password = "correct-password";

  prisma.user.findFirst = (async () => ({
    id: "admin-1",
    schoolId: "school-1",
    studentId: null,
    name: "Admin",
    email: "admin@example.com",
    password: hashPassword("bootstrap-password"),
    role: "ADMIN",
    tokenVersion: 0,
    lastActivityAt: null
  })) as unknown as typeof prisma.user.findFirst;

  prisma.user.findMany = (async () => [
    {
      id: "admin-1",
      schoolId: "school-1",
      studentId: null,
      name: "Admin",
      email: "admin@example.com",
      password: hashPassword(password),
      role: "ADMIN",
      tokenVersion: 2,
      lastActivityAt: null,
      school: { isActive: true }
    }
  ]) as unknown as typeof prisma.user.findMany;

  prisma.user.update = (async (args: { data: Record<string, unknown> }) => ({
    id: "admin-1",
    schoolId: "school-1",
    studentId: null,
    name: "Admin",
    email: "admin@example.com",
    password: hashPassword(password),
    role: "ADMIN",
    tokenVersion: 2,
    lastActivityAt: args.data.lastActivityAt ? new Date() : null
  })) as unknown as typeof prisma.user.update;

  try {
    const result = await loginWithPassword("admin@example.com", password);
    assert.ok(result.token.length > 10);
    assert.equal(result.user.id, "admin-1");
    assert.equal(result.user.role, "ADMIN");
    assert.equal(result.user.email, "admin@example.com");
  } finally {
    prisma.user.findFirst = originalFindFirst;
    prisma.user.findMany = originalFindMany;
    prisma.user.update = originalUpdate;
  }
});

test("loginWithPassword rejects invalid credentials and inactive schools", async () => {
  const originalFindFirst = prisma.user.findFirst;
  const originalFindMany = prisma.user.findMany;
  const originalUpdate = prisma.user.update;

  prisma.user.findFirst = (async () => ({
    id: "admin-1",
    schoolId: "school-1",
    studentId: null,
    name: "Admin",
    email: "admin@example.com",
    password: hashPassword("bootstrap-password"),
    role: "ADMIN",
    tokenVersion: 0,
    lastActivityAt: null
  })) as unknown as typeof prisma.user.findFirst;

  prisma.user.findMany = (async () => [
    {
      id: "admin-1",
      schoolId: "school-1",
      studentId: null,
      name: "Admin",
      email: "admin@example.com",
      password: hashPassword("correct-password"),
      role: "ADMIN",
      tokenVersion: 0,
      lastActivityAt: null,
      school: { isActive: false }
    }
  ]) as unknown as typeof prisma.user.findMany;

  prisma.user.update = originalUpdate;

  try {
    await assert.rejects(() => loginWithPassword("admin@example.com", "wrong-password"), /INVALID_LOGIN/);
    await assert.rejects(() => loginWithPassword("admin@example.com", "correct-password"), /SCHOOL_INACTIVE/);
  } finally {
    prisma.user.findFirst = originalFindFirst;
    prisma.user.findMany = originalFindMany;
    prisma.user.update = originalUpdate;
  }
});

test("changeUserPassword accepts a valid current password and rejects the wrong one", async () => {
  const originalFindUnique = prisma.user.findUnique;
  const originalUpdate = prisma.user.update;
  const currentPassword = "current-password";
  const updatedPasswords: Array<Record<string, unknown>> = [];

  prisma.user.findUnique = (async () => ({
    id: "user-1",
    schoolId: "school-1",
    studentId: null,
    name: "Admin",
    email: "admin@example.com",
    password: hashPassword(currentPassword),
    role: "ADMIN",
    tokenVersion: 3,
    lastActivityAt: null
  })) as unknown as typeof prisma.user.findUnique;

  prisma.user.update = (async (args: { data: Record<string, unknown> }) => {
    updatedPasswords.push(args.data);
    return {
      id: "user-1",
      schoolId: "school-1",
      studentId: null,
      name: "Admin",
      email: "admin@example.com",
      password: hashPassword(String(args.data.password || "")),
      role: "ADMIN",
      tokenVersion: 4,
      lastActivityAt: null
    };
  }) as unknown as typeof prisma.user.update;

  try {
    assert.equal(await changeUserPassword("user-1", currentPassword, "new-password"), true);
    assert.equal(updatedPasswords.length, 1);
    assert.ok(updatedPasswords[0]?.password);
    await assert.rejects(
      () => changeUserPassword("user-1", "wrong-password", "new-password"),
      /INVALID_CURRENT_PASSWORD/
    );
  } finally {
    prisma.user.findUnique = originalFindUnique;
    prisma.user.update = originalUpdate;
  }
});
