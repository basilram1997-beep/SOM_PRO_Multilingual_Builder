import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import Redis from "ioredis";
import { env } from "../config/env";
import { prisma } from "../db/prisma";
import { logSafeError } from "../lib/safeLog";

type RateLimitOptions = {
  key: string;
  windowMs: number;
  max: number;
  message: string;
  auditAction?: string;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitRule = {
  match: (req: Request) => boolean;
  middleware: ReturnType<typeof createRateLimitMiddleware>;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();
const sensitiveKeys = new Set([
  "password",
  "currentpassword",
  "newpassword",
  "oldpassword",
  "confirmpassword",
  "passwordconfirmation",
  "passwordconfirm",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "licensekey",
  "licensecode",
  "ownertoken",
  "secret",
  "mfasecret",
  "mfa_secret",
  "session",
  "sessionid",
  "jwt"
]);
const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const redisRateLimitEnabled = process.env.SOM_PRO_RATE_LIMIT_BACKING === "redis";
const redisRateLimitClient = new Redis(env.redisUrl, {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  connectTimeout: 1000
});
let redisConnectStarted = false;

const sensitiveRouteRateLimitRules: RateLimitRule[] = [
  {
    match: (req) => req.method === "POST" && req.path.startsWith("/api/students/import"),
    middleware: createRateLimitMiddleware({
      key: "sensitive:students-import",
      windowMs: 60_000,
      max: 6,
      message: "تم تكرار استيراد الطلاب بسرعة زائدة. حاول مرة أخرى بعد قليل.",
      auditAction: "RATE LIMITED STUDENTS IMPORT"
    })
  },
  {
    match: (req) => writeMethods.has(req.method) && req.path.startsWith("/api/students"),
    middleware: createRateLimitMiddleware({
      key: "sensitive:students-write",
      windowMs: 60_000,
      max: 30,
      message: "تم تكرار عمليات الطلاب بسرعة زائدة. حاول مرة أخرى بعد قليل.",
      auditAction: "RATE LIMITED STUDENTS WRITE"
    })
  },
  {
    match: (req) => writeMethods.has(req.method) && req.path.startsWith("/api/teachers"),
    middleware: createRateLimitMiddleware({
      key: "sensitive:teachers-write",
      windowMs: 60_000,
      max: 20,
      message: "تم تكرار عمليات المعلمين بسرعة زائدة. حاول مرة أخرى بعد قليل.",
      auditAction: "RATE LIMITED TEACHERS WRITE"
    })
  },
  {
    match: (req) => writeMethods.has(req.method) && req.path.startsWith("/api/classes"),
    middleware: createRateLimitMiddleware({
      key: "sensitive:classes-write",
      windowMs: 60_000,
      max: 12,
      message: "تم تكرار عمليات الصفوف بسرعة زائدة. حاول مرة أخرى بعد قليل.",
      auditAction: "RATE LIMITED CLASSES WRITE"
    })
  },
  {
    match: (req) => writeMethods.has(req.method) && req.path.startsWith("/api/settings"),
    middleware: createRateLimitMiddleware({
      key: "sensitive:settings-write",
      windowMs: 60_000,
      max: 10,
      message: "تم تكرار عمليات الإعدادات بسرعة زائدة. حاول مرة أخرى بعد قليل.",
      auditAction: "RATE LIMITED SETTINGS WRITE"
    })
  },
  {
    match: (req) => writeMethods.has(req.method) && req.path.startsWith("/api/uploads"),
    middleware: createRateLimitMiddleware({
      key: "sensitive:uploads-write",
      windowMs: 60_000,
      max: 10,
      message: "تم تكرار عمليات الرفع بسرعة زائدة. حاول مرة أخرى بعد قليل.",
      auditAction: "RATE LIMITED UPLOADS WRITE"
    })
  },
  {
    match: (req) => writeMethods.has(req.method) && req.path.startsWith("/api/daily"),
    middleware: createRateLimitMiddleware({
      key: "sensitive:daily-write",
      windowMs: 60_000,
      max: 25,
      message: "تم تكرار عمليات البرنامج اليومي بسرعة زائدة. حاول مرة أخرى بعد قليل.",
      auditAction: "RATE LIMITED DAILY WRITE"
    })
  },
  {
    match: (req) => writeMethods.has(req.method) && req.path.startsWith("/api/homeroom"),
    middleware: createRateLimitMiddleware({
      key: "sensitive:homeroom-write",
      windowMs: 60_000,
      max: 20,
      message: "تم تكرار عمليات المربين بسرعة زائدة. حاول مرة أخرى بعد قليل.",
      auditAction: "RATE LIMITED HOMEROOM WRITE"
    })
  },
  {
    match: (req) => writeMethods.has(req.method) && req.path.startsWith("/api/duties"),
    middleware: createRateLimitMiddleware({
      key: "sensitive:duties-write",
      windowMs: 60_000,
      max: 20,
      message: "تم تكرار عمليات المناوبة بسرعة زائدة. حاول مرة أخرى بعد قليل.",
      auditAction: "RATE LIMITED DUTIES WRITE"
    })
  },
  {
    match: (req) => writeMethods.has(req.method) && req.path.startsWith("/api/archive"),
    middleware: createRateLimitMiddleware({
      key: "sensitive:archive-write",
      windowMs: 60_000,
      max: 8,
      message: "تم تكرار عمليات الأرشفة بسرعة زائدة. حاول مرة أخرى بعد قليل.",
      auditAction: "RATE LIMITED ARCHIVE WRITE"
    })
  },
  {
    match: (req) => writeMethods.has(req.method) && req.path.startsWith("/api/security-incidents"),
    middleware: createRateLimitMiddleware({
      key: "sensitive:security-incidents-write",
      windowMs: 60_000,
      max: 10,
      message: "تم تكرار تسجيل الحوادث الأمنية بسرعة زائدة. حاول مرة أخرى بعد قليل.",
      auditAction: "RATE LIMITED SECURITY INCIDENTS WRITE"
    })
  },
  {
    match: (req) => req.method === "GET" && req.path.startsWith("/api/audit-logs/export"),
    middleware: createRateLimitMiddleware({
      key: "sensitive:audit-log-export",
      windowMs: 60_000,
      max: 12,
      message: "تم تكرار تصدير سجل التدقيق بسرعة زائدة. حاول مرة أخرى بعد قليل.",
      auditAction: "RATE LIMITED AUDIT LOG EXPORT"
    })
  },
  {
    match: (req) =>
      writeMethods.has(req.method) &&
      req.path.startsWith("/api/schools/") &&
      (req.path.endsWith("/export-data") || req.path.endsWith("/delete-data")),
    middleware: createRateLimitMiddleware({
      key: "sensitive:school-export-delete",
      windowMs: 60_000,
      max: 4,
      message: "تم تكرار عمليات تصدير أو حذف بيانات المدرسة بسرعة زائدة. حاول مرة أخرى بعد قليل.",
      auditAction: "RATE LIMITED SCHOOL EXPORT DELETE"
    })
  },
  {
    match: (req) => req.method === "POST" && req.path === "/api/schools/backups",
    middleware: createRateLimitMiddleware({
      key: "sensitive:product-backup",
      windowMs: 5 * 60_000,
      max: 2,
      message: "تم طلب إنشاء نسخ احتياطية كثيرة خلال وقت قصير. انتظر قليلاً قبل إنشاء نسخة جديدة.",
      auditAction: "RATE LIMITED PRODUCT BACKUP"
    })
  }
];

function getClientKey(req: Request, key: string) {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    ?.trim();
  return `${key}:${forwarded || req.ip || req.socket.remoteAddress || "unknown"}`;
}

function redactSensitive(value: unknown): unknown {
  if (Buffer.isBuffer(value)) {
    return `[BUFFER ${value.length} BYTES]`;
  }
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sensitiveKeys.has(key.toLowerCase()) ? "[REDACTED]" : redactSensitive(item)
    ])
  );
}

function appendAuditLog(req: Request, action: string, details: Record<string, unknown>) {
  const schoolId = req.user?.schoolId || null;
  const userId = req.user?.id || req.user?.userId || null;
  void prisma.auditLog
    .create({
      data: {
        schoolId,
        userId,
        action,
        entity: "HTTP_SECURITY",
        after: details as Prisma.InputJsonValue
      }
    })
    .catch(() => null);
}

function tryStartRedisConnection() {
  if (!redisRateLimitEnabled) return;
  if (redisConnectStarted) return;
  redisConnectStarted = true;
  void redisRateLimitClient.connect().catch(() => null);
}

async function checkRedisRateLimit(bucketKey: string, windowMs: number, max: number) {
  if (!redisRateLimitEnabled) return null;
  tryStartRedisConnection();
  if (redisRateLimitClient.status !== "ready") return null;

  const redisKey = `som-pro:rate-limit:${bucketKey}`;
  const count = await redisRateLimitClient.incr(redisKey);
  if (count === 1) {
    await redisRateLimitClient.pexpire(redisKey, windowMs);
  }

  const ttlMs = await redisRateLimitClient.pttl(redisKey);
  const retryAfterSeconds = ttlMs > 0 ? Math.max(1, Math.ceil(ttlMs / 1000)) : Math.max(1, Math.ceil(windowMs / 1000));

  if (count > max) {
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true, retryAfterSeconds };
}

export function clearRequestProtectionState() {
  rateLimitBuckets.clear();
}

export function rejectMultipartContent(req: Request, res: Response, next: NextFunction) {
  if (req.is("multipart/form-data")) {
    appendAuditLog(req, "BLOCKED MULTIPART", {
      path: req.path,
      method: req.method,
      contentType: String(req.headers["content-type"] || "multipart/form-data"),
      body: redactSensitive(req.body || null)
    });
    return res.status(415).json({
      error: "UNSUPPORTED_MEDIA_TYPE",
      message: "لا يمكن إرسال ملفات في هذه العملية. استخدم نموذجًا نصيًا فقط."
    });
  }

  return next();
}

function bodyContainsSchoolOverride(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => bodyContainsSchoolOverride(item));
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key === "schoolId" || key === "school_id") return true;
    if (bodyContainsSchoolOverride(item)) return true;
  }
  return false;
}

function bodyContainsUserOverride(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => bodyContainsUserOverride(item));
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key === "userId" || key === "user_id") return true;
    if (bodyContainsUserOverride(item)) return true;
  }
  return false;
}

export function rejectSchoolContextOverride(req: Request, res: Response, next: NextFunction) {
  if (!writeMethods.has(req.method)) return next();
  if (!bodyContainsSchoolOverride(req.body)) return next();

  appendAuditLog(req, "BLOCKED SCHOOL OVERRIDE", {
    path: req.path,
    method: req.method,
    body: redactSensitive(req.body || null)
  });

  return res.status(400).json({
    error: "INVALID_SCHOOL_CONTEXT",
    message: "لا يمكن تغيير مدرسة الجلسة من الطلب"
  });
}

export function rejectUserContextOverride(req: Request, res: Response, next: NextFunction) {
  if (!writeMethods.has(req.method)) return next();
  if (!bodyContainsUserOverride(req.body)) return next();

  appendAuditLog(req, "BLOCKED USER OVERRIDE", {
    path: req.path,
    method: req.method,
    body: redactSensitive(req.body || null)
  });

  return res.status(400).json({
    error: "INVALID_USER_CONTEXT",
    message: "لا يمكن تغيير هوية المستخدم من الطلب"
  });
}

export function createRateLimitMiddleware(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.SOM_E2E_DISABLE_RATE_LIMIT === "true") {
      next();
      return;
    }

    const bucketKey = getClientKey(req, options.key);

    void (async () => {
      const redisDecision = await checkRedisRateLimit(bucketKey, options.windowMs, options.max);
      if (redisDecision) {
        if (!redisDecision.allowed) {
          res.setHeader("Retry-After", String(redisDecision.retryAfterSeconds));
          appendAuditLog(req, options.auditAction || "RATE LIMITED", {
            path: req.path,
            method: req.method,
            key: options.key,
            windowMs: options.windowMs,
            max: options.max,
            retryAfterSeconds: redisDecision.retryAfterSeconds,
            store: "redis",
            body: redactSensitive(req.body || null)
          });
          res.status(429).json({
            error: "RATE_LIMITED",
            message: options.message
          });
          return;
        }
        next();
        return;
      }

      const now = Date.now();
      const existing = rateLimitBuckets.get(bucketKey);

      if (!existing || now >= existing.resetAt) {
        rateLimitBuckets.set(bucketKey, { count: 1, resetAt: now + options.windowMs });
        next();
        return;
      }

      existing.count += 1;

      if (existing.count > options.max) {
        const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
        res.setHeader("Retry-After", String(retryAfterSeconds));
        appendAuditLog(req, options.auditAction || "RATE LIMITED", {
          path: req.path,
          method: req.method,
          key: options.key,
          windowMs: options.windowMs,
          max: options.max,
          retryAfterSeconds,
          store: "memory",
          body: redactSensitive(req.body || null)
        });
        res.status(429).json({
          error: "RATE_LIMITED",
          message: options.message
        });
        return;
      }

      next();
    })().catch((error) => {
      logSafeError("requestProtections.rateLimit", error);
      next();
    });
  };
}

export function sensitiveWriteRateLimit(req: Request, res: Response, next: NextFunction) {
  if (!writeMethods.has(req.method)) return next();
  const rule = sensitiveRouteRateLimitRules.find((entry) => entry.match(req));
  if (!rule) return next();
  return rule.middleware(req, res, next);
}
