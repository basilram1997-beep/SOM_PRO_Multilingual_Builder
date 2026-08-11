import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../db/prisma";
import {
  clearRequestProtectionState,
  createRateLimitMiddleware,
  rejectMultipartContent,
  rejectSchoolContextOverride,
  rejectUserContextOverride,
  sensitiveWriteRateLimit
} from "./requestProtections";

function createMockResponse() {
  const headers: Record<string, string> = {};
  return {
    statusCode: 200,
    headers,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      headers[name] = value;
      return this;
    },
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

function createMockRequest(isMultipart = false) {
  return {
    ip: "127.0.0.1",
    headers: {},
    socket: { remoteAddress: "127.0.0.1" },
    method: "POST",
    path: "/api/students",
    body: {},
    is(contentType: string) {
      return isMultipart && contentType === "multipart/form-data";
    }
  };
}

test("rejectMultipartContent blocks file uploads on sensitive JSON routes", () => {
  const req = createMockRequest(true) as never;
  const res = createMockResponse();
  let nextCalled = false;

  rejectMultipartContent(req, res as never, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 415);
  assert.equal((res.body as { error?: string })?.error, "UNSUPPORTED_MEDIA_TYPE");
});

test("createRateLimitMiddleware blocks repeated requests beyond the limit", async () => {
  clearRequestProtectionState();
  const middleware = createRateLimitMiddleware({
    key: "auth-test",
    windowMs: 60_000,
    max: 2,
    message: "تم تجاوز الحد المسموح"
  });
  const req = createMockRequest(false) as never;
  const res = createMockResponse();
  let nextCalls = 0;
  const next = () => {
    nextCalls += 1;
  };

  middleware(req, res as never, next);
  middleware(req, res as never, next);
  middleware(req, res as never, next);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(nextCalls, 2);
  assert.equal(res.statusCode, 429);
  assert.equal((res.body as { error?: string })?.error, "RATE_LIMITED");
  assert.equal(typeof res.headers["Retry-After"], "string");
});

test("rate limit violations are written to audit logs", async () => {
  clearRequestProtectionState();
  const originalCreate = prisma.auditLog.create;
  const calls: Array<Record<string, unknown>> = [];
  prisma.auditLog.create = (async (args: { data: Record<string, unknown> }) => {
    calls.push(args.data);
    return args.data as never;
  }) as unknown as typeof prisma.auditLog.create;

  try {
    const middleware = createRateLimitMiddleware({
      key: "auth-audit",
      windowMs: 60_000,
      max: 1,
      message: "تم تجاوز الحد المسموح",
      auditAction: "RATE LIMITED LOGIN"
    });
    const req = createMockRequest(false) as never;
    const res = createMockResponse();
    const next = () => undefined;

    middleware(req, res as never, next);
    middleware(req, res as never, next);

    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.ok(calls.length >= 1);
    assert.equal(calls[0]?.action, "RATE LIMITED LOGIN");
    assert.equal(calls[0]?.entity, "HTTP_SECURITY");
  } finally {
    prisma.auditLog.create = originalCreate;
  }
});

test("multipart rejections are written to audit logs", async () => {
  const originalCreate = prisma.auditLog.create;
  const calls: Array<Record<string, unknown>> = [];
  prisma.auditLog.create = (async (args: { data: Record<string, unknown> }) => {
    calls.push(args.data);
    return args.data as never;
  }) as unknown as typeof prisma.auditLog.create;

  try {
    const req = createMockRequest(true) as never;
    const res = createMockResponse();
    rejectMultipartContent(req, res as never, () => undefined);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(calls.length >= 1);
    assert.equal(calls[0]?.action, "BLOCKED MULTIPART");
    assert.equal(calls[0]?.entity, "HTTP_SECURITY");
  } finally {
    prisma.auditLog.create = originalCreate;
  }
});

test("school context override in the request body is rejected", async () => {
  const req = createMockRequest(false) as never;
  (req as { body: Record<string, unknown> }).body = { school_id: "school-b" };
  const res = createMockResponse();
  let nextCalled = false;

  rejectSchoolContextOverride(req, res as never, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal((res.body as { error?: string })?.error, "INVALID_SCHOOL_CONTEXT");
});

test("user context override in the request body is rejected", async () => {
  const req = createMockRequest(false) as never;
  (req as { body: Record<string, unknown> }).body = { userId: "user-b" };
  const res = createMockResponse();
  let nextCalled = false;

  rejectUserContextOverride(req, res as never, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal((res.body as { error?: string })?.error, "INVALID_USER_CONTEXT");
});

test("general student write routes are rate limited beyond auth and license", async () => {
  clearRequestProtectionState();
  const req = createMockRequest(false) as never;
  (req as { method: string; path: string }).method = "POST";
  (req as { method: string; path: string }).path = "/api/students/123/deactivate";
  const res = createMockResponse();
  let nextCalls = 0;
  const next = () => {
    nextCalls += 1;
  };

  for (let index = 0; index < 31; index += 1) {
    sensitiveWriteRateLimit(req, res as never, next);
  }
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(nextCalls, 30);
  assert.equal(res.statusCode, 429);
  assert.equal((res.body as { error?: string })?.error, "RATE_LIMITED");
});

test("student certificate writes use a dedicated higher-volume rate limit bucket", async () => {
  clearRequestProtectionState();
  const req = createMockRequest(false) as never;
  (req as { method: string; path: string }).method = "POST";
  (req as { method: string; path: string }).path = "/api/students/certificates";
  const res = createMockResponse();
  let nextCalls = 0;
  const next = () => {
    nextCalls += 1;
  };

  for (let index = 0; index < 241; index += 1) {
    sensitiveWriteRateLimit(req, res as never, next);
  }
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(nextCalls, 240);
  assert.equal(res.statusCode, 429);
  assert.equal((res.body as { error?: string })?.error, "RATE_LIMITED");
});

test("student import route is rate limited", async () => {
  clearRequestProtectionState();
  const req = createMockRequest(false) as never;
  (req as { method: string; path: string }).method = "POST";
  (req as { method: string; path: string }).path = "/api/students/import";
  const res = createMockResponse();
  let nextCalls = 0;
  const next = () => {
    nextCalls += 1;
  };

  for (let index = 0; index < 7; index += 1) {
    sensitiveWriteRateLimit(req, res as never, next);
  }
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(nextCalls, 6);
  assert.equal(res.statusCode, 429);
  assert.equal((res.body as { error?: string })?.error, "RATE_LIMITED");
});

test("school export and delete routes are rate limited", async () => {
  clearRequestProtectionState();
  const req = createMockRequest(false) as never;
  (req as { method: string; path: string }).method = "POST";
  (req as { method: string; path: string }).path = "/api/schools/123/export-data";
  const res = createMockResponse();
  let nextCalls = 0;
  const next = () => {
    nextCalls += 1;
  };

  for (let index = 0; index < 5; index += 1) {
    sensitiveWriteRateLimit(req, res as never, next);
  }
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(nextCalls, 4);
  assert.equal(res.statusCode, 429);
  assert.equal((res.body as { error?: string })?.error, "RATE_LIMITED");
});
