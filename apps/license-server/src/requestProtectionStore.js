const crypto = require("crypto");
const Redis = require("ioredis");

const REDIS_KEY_PREFIX = "som-license-server";

function isTestRuntime() {
  const nodeEnv = String(process.env.NODE_ENV || process.env.APP_ENV || "").trim().toLowerCase();
  return nodeEnv === "test" || process.argv.includes("--test") || process.execArgv.includes("--test");
}

function getBackingMode() {
  return String(process.env.LICENSE_REQUEST_BACKING || "").trim().toLowerCase();
}

function resolveRedisUrl() {
  return String(process.env.LICENSE_REDIS_URL || process.env.REDIS_URL || "").trim();
}

function hash(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function clientAddress(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function routeBucketName(url) {
  if (url.pathname.startsWith("/api/admin/")) return "admin";
  if (url.pathname.startsWith("/api/client/") || url.pathname.startsWith("/api/license/")) return "client";
  return "general";
}

function createRedisClient(redisUrl) {
  if (!redisUrl) return null;
  return new Redis(redisUrl, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 1000
  });
}

function getRetryAfterSeconds(ttlMs, windowMs) {
  const effectiveTtl = ttlMs > 0 ? ttlMs : windowMs;
  return Math.max(1, Math.ceil(effectiveTtl / 1000));
}

function pruneExpiredEntries(map, now) {
  for (const [key, item] of map.entries()) {
    if (item.expiresAt <= now) map.delete(key);
  }
}

function createRequestProtectionStore(options = {}) {
  const mode = options.mode || getBackingMode() || "auto";
  const redisUrl = options.redisUrl || resolveRedisUrl();
  const allowMemoryFallback =
    options.allowMemoryFallback !== undefined
      ? options.allowMemoryFallback
      : mode === "memory" || (!redisUrl && !options.redisClient) || isTestRuntime();
  const rateLimits = options.rateLimits || {
    admin: { limit: Number(process.env.LICENSE_ADMIN_RATE_LIMIT || 120), windowMs: 60_000 },
    client: { limit: Number(process.env.LICENSE_CLIENT_RATE_LIMIT || 180), windowMs: 60_000 },
    general: { limit: Number(process.env.LICENSE_GENERAL_RATE_LIMIT || 300), windowMs: 60_000 }
  };
  const requestNonceTtlMs = Number(options.requestNonceTtlMs || process.env.LICENSE_REQUEST_NONCE_TTL_MS || 5 * 60_000);
  const redisClient =
    options.redisClient || (!isTestRuntime() && mode !== "memory" ? createRedisClient(redisUrl) : null);
  const rateLimitBuckets = new Map();
  const requestNonces = new Map();
  let redisConnectStarted = false;

  function tryStartRedisConnection() {
    if (!redisClient || redisConnectStarted) return;
    redisConnectStarted = true;
    void redisClient.connect().catch(() => null);
  }

  function getRateLimitRule(url) {
    const bucket = routeBucketName(url);
    return { bucket, limit: rateLimits[bucket] || rateLimits.general };
  }

  function getRateLimitKey(url, req) {
    const bucket = routeBucketName(url);
    return `${bucket}:${clientAddress(req)}`;
  }

  function getNonceKey(req, url, nonce) {
    return `${routeBucketName(url)}:${clientAddress(req)}:${hash(nonce)}`;
  }

  async function checkRedisRateLimit(key, windowMs, max) {
    if (!redisClient) return null;
    try {
      tryStartRedisConnection();
      if (redisClient.status !== "ready") return null;

      const redisKey = `${REDIS_KEY_PREFIX}:rate-limit:${key}`;
      const count = await redisClient.incr(redisKey);
      if (count === 1) {
        await redisClient.pexpire(redisKey, windowMs);
      }
      const ttlMs = await redisClient.pttl(redisKey);
      const retryAfterSeconds = getRetryAfterSeconds(ttlMs, windowMs);
      return count > max
        ? { ok: false, status: 429, error: "RATE_LIMITED", retryAfterSeconds }
        : { ok: true, retryAfterSeconds };
    } catch {
      return allowMemoryFallback ? null : { ok: false, status: 503, error: "RATE_LIMIT_BACKEND_UNAVAILABLE" };
    }
  }

  async function isRateLimited(req, url) {
    const { limit } = getRateLimitRule(url);
    const key = getRateLimitKey(url, req);
    const redisDecision = await checkRedisRateLimit(key, limit.windowMs, limit.limit);
    if (redisDecision) return redisDecision;

    if (!allowMemoryFallback) {
      return { ok: false, status: 503, error: "RATE_LIMIT_BACKEND_UNAVAILABLE" };
    }

    const now = Date.now();
    const current = rateLimitBuckets.get(key);
    if (!current || current.resetAt <= now) {
      rateLimitBuckets.set(key, { count: 1, resetAt: now + limit.windowMs });
      return { ok: true };
    }

    current.count += 1;
    if (current.count > limit.limit) {
      return {
        ok: false,
        status: 429,
        error: "RATE_LIMITED",
        retryAfterSeconds: getRetryAfterSeconds(current.resetAt - now, limit.windowMs)
      };
    }

    return { ok: true };
  }

  async function checkRequestNonce(req, url) {
    if (!url.pathname.startsWith("/api/client/") && !url.pathname.startsWith("/api/license/")) return { ok: true };
    if (req.method !== "POST") return { ok: true };

    const nonce = String(req.headers["x-request-nonce"] || "").trim();
    const requireNonce = String(process.env.LICENSE_REQUIRE_CLIENT_NONCE || "").toLowerCase() === "true";
    if (!nonce) return requireNonce ? { ok: false, status: 409, error: "MISSING_NONCE" } : { ok: true };
    if (nonce.length < 16 || nonce.length > 128) {
      return { ok: false, status: 409, error: "INVALID_NONCE" };
    }

    const key = getNonceKey(req, url, nonce);
    if (redisClient) {
      try {
        tryStartRedisConnection();
        if (redisClient.status === "ready") {
          const redisKey = `${REDIS_KEY_PREFIX}:nonce:${key}`;
          const result = await redisClient.set(redisKey, "1", "PX", requestNonceTtlMs, "NX");
          if (result === "OK") return { ok: true };
          return { ok: false, status: 409, error: "REPLAYED_NONCE" };
        }
      } catch {
        if (!allowMemoryFallback) {
          return { ok: false, status: 503, error: "NONCE_BACKEND_UNAVAILABLE" };
        }
      }
    }

    if (!allowMemoryFallback) {
      return { ok: false, status: 503, error: "NONCE_BACKEND_UNAVAILABLE" };
    }

    const now = Date.now();
    pruneExpiredEntries(requestNonces, now);
    const existing = requestNonces.get(key);
    if (existing && existing.expiresAt > now) {
      return { ok: false, status: 409, error: "REPLAYED_NONCE" };
    }
    requestNonces.set(key, { expiresAt: now + requestNonceTtlMs });
    return { ok: true };
  }

  function clearRequestProtectionState() {
    rateLimitBuckets.clear();
    requestNonces.clear();
  }

  return {
    checkRequestNonce,
    clearRequestProtectionState,
    isRateLimited,
    redisClient
  };
}

module.exports = {
  createRedisClient,
  createRequestProtectionStore,
  clientAddress,
  getBackingMode,
  isTestRuntime,
  routeBucketName,
  resolveRedisUrl
};
