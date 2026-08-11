import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../db/prisma";
import { createAuthToken } from "../services/authService";
import { authenticateRequest, requirePermission, requirePermissionForWrite } from "./auth";

function createMockResponse() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    }
  };
}

function createMockRequest(overrides: Record<string, unknown> = {}) {
  return {
    path: "/api/teachers",
    method: "POST",
    headers: {},
    user: undefined,
    body: {},
    ...overrides
  };
}

test("authenticateRequest skips public auth routes", async () => {
  const req = createMockRequest({ path: "/api/auth/login" }) as never;
  const res = createMockResponse();
  let nextCalled = false;

  await authenticateRequest(req, res as never, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test("authenticateRequest rejects missing bearer tokens", async () => {
  const req = createMockRequest({ headers: {} }) as never;
  const res = createMockResponse();
  let nextCalled = false;

  await authenticateRequest(req, res as never, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal((res.body as { error?: string })?.error, "AUTH_REQUIRED");
});

test("authenticateRequest attaches the resolved user on the happy path", async () => {
  const originalFindUnique = prisma.user.findUnique;
  const token = createAuthToken({ userId: "user-1", schoolId: "school-1", role: "ADMIN", tokenVersion: 3 }, 60);
  const req = createMockRequest({
    headers: { authorization: `Bearer ${token}` }
  }) as never;
  const res = createMockResponse();
  let nextCalled = false;

  prisma.user.findUnique = (async () => ({
    id: "user-1",
    schoolId: "school-1",
    studentId: null,
    name: "Admin",
    email: "admin@example.com",
    role: "ADMIN",
    tokenVersion: 3,
    lastActivityAt: new Date()
  })) as unknown as typeof prisma.user.findUnique;

  try {
    await authenticateRequest(req, res as never, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
    assert.equal((req as { user?: { id: string; role: string } }).user?.id, "user-1");
    assert.equal((req as { user?: { id: string; role: string } }).user?.role, "ADMIN");
  } finally {
    prisma.user.findUnique = originalFindUnique;
  }
});

test("authenticateRequest rejects a token when the session belongs to another school", async () => {
  const originalFindUnique = prisma.user.findUnique;
  const token = createAuthToken({ userId: "user-2", schoolId: "school-1", role: "ADMIN", tokenVersion: 1 }, 60);
  const req = createMockRequest({
    headers: { authorization: `Bearer ${token}` }
  }) as never;
  const res = createMockResponse();

  prisma.user.findUnique = (async () => ({
    id: "user-2",
    schoolId: "school-2",
    studentId: null,
    name: "Admin",
    email: "admin2@example.com",
    role: "ADMIN",
    tokenVersion: 1,
    lastActivityAt: null
  })) as unknown as typeof prisma.user.findUnique;

  try {
    await authenticateRequest(req, res as never, () => undefined);
    assert.equal(res.statusCode, 401);
    assert.equal((res.body as { error?: string })?.error, "AUTH_INVALID");
  } finally {
    prisma.user.findUnique = originalFindUnique;
  }
});

test("requirePermission allows admins and blocks lower roles", () => {
  const allowedReq = createMockRequest({
    user: { id: "user-1", role: "ADMIN" }
  }) as never;
  const allowedRes = createMockResponse();
  let allowedNext = false;

  requirePermission("manageTeachers")(allowedReq, allowedRes as never, () => {
    allowedNext = true;
  });

  assert.equal(allowedNext, true);
  assert.equal(allowedRes.statusCode, 200);

  const forbiddenReq = createMockRequest({
    user: { id: "user-2", role: "STUDENT" }
  }) as never;
  const forbiddenRes = createMockResponse();
  let forbiddenNext = false;

  requirePermission("manageTeachers")(forbiddenReq, forbiddenRes as never, () => {
    forbiddenNext = true;
  });

  assert.equal(forbiddenNext, false);
  assert.equal(forbiddenRes.statusCode, 403);
  assert.equal((forbiddenRes.body as { error?: string })?.error, "FORBIDDEN");
});

test("requirePermissionForWrite falls back to read access on GET requests", () => {
  const req = createMockRequest({
    method: "GET",
    user: { id: "user-3", role: "STUDENT" }
  }) as never;
  const res = createMockResponse();
  let nextCalled = false;

  requirePermissionForWrite("manageLessons")(req, res as never, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});
