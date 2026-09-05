const test = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";

const { createRequestProtectionStore } = require("./requestProtectionStore");

function createFakeRedisClient() {
  const store = new Map();

  function pruneExpired(key) {
    const item = store.get(key);
    if (item && item.expiresAt !== null && item.expiresAt <= Date.now()) {
      store.delete(key);
      return null;
    }
    return item || null;
  }

  return {
    status: "ready",
    async connect() {
      return this;
    },
    async incr(key) {
      const current = pruneExpired(key);
      const nextValue = (Number(current?.value || 0) || 0) + 1;
      store.set(key, {
        value: String(nextValue),
        expiresAt: current?.expiresAt ?? null
      });
      return nextValue;
    },
    async pexpire(key, ttlMs) {
      const current = pruneExpired(key);
      if (!current) return 0;
      store.set(key, {
        value: current.value,
        expiresAt: Date.now() + Number(ttlMs)
      });
      return 1;
    },
    async pttl(key) {
      const current = pruneExpired(key);
      if (!current) return -2;
      if (current.expiresAt === null) return -1;
      return Math.max(0, current.expiresAt - Date.now());
    },
    async set(key, value, ...args) {
      const options = new Set(args.map((item) => String(item).toUpperCase()));
      const nx = options.has("NX");
      const pxIndex = args.findIndex((item) => String(item).toUpperCase() === "PX");
      const ttlMs = pxIndex === -1 ? null : Number(args[pxIndex + 1]);
      const current = pruneExpired(key);
      if (nx && current) return null;
      store.set(key, {
        value: String(value),
        expiresAt: ttlMs ? Date.now() + ttlMs : null
      });
      return "OK";
    }
  };
}

function makeRequest(headers = {}) {
  return {
    method: "POST",
    headers,
    socket: {
      remoteAddress: "127.0.0.1"
    }
  };
}

test("Redis-backed rate limits are shared across store instances", async () => {
  const redis = createFakeRedisClient();
  const storeA = createRequestProtectionStore({
    redisClient: redis,
    mode: "redis",
    allowMemoryFallback: false,
    rateLimits: {
      admin: { limit: 1, windowMs: 60_000 },
      client: { limit: 2, windowMs: 60_000 },
      general: { limit: 3, windowMs: 60_000 }
    },
    requestNonceTtlMs: 60_000
  });
  const storeB = createRequestProtectionStore({
    redisClient: redis,
    mode: "redis",
    allowMemoryFallback: false,
    rateLimits: {
      admin: { limit: 1, windowMs: 60_000 },
      client: { limit: 2, windowMs: 60_000 },
      general: { limit: 3, windowMs: 60_000 }
    },
    requestNonceTtlMs: 60_000
  });

  const url = new URL("http://localhost/api/client/activate");
  const req = makeRequest();

  assert.equal((await storeA.isRateLimited(req, url)).ok, true);
  assert.equal((await storeB.isRateLimited(req, url)).ok, true);

  const limited = await storeA.isRateLimited(req, url);
  assert.equal(limited.ok, false);
  assert.equal(limited.status, 429);
  assert.equal(limited.error, "RATE_LIMITED");
});

test("Redis-backed nonce replay protection is shared across store instances", async () => {
  const redis = createFakeRedisClient();
  const storeA = createRequestProtectionStore({
    redisClient: redis,
    mode: "redis",
    allowMemoryFallback: false,
    requestNonceTtlMs: 60_000
  });
  const storeB = createRequestProtectionStore({
    redisClient: redis,
    mode: "redis",
    allowMemoryFallback: false,
    requestNonceTtlMs: 60_000
  });

  const url = new URL("http://localhost/api/client/activate");
  const req = makeRequest({ "x-request-nonce": "activate-nonce-00001" });

  assert.equal((await storeA.checkRequestNonce(req, url)).ok, true);
  const replay = await storeB.checkRequestNonce(req, url);
  assert.equal(replay.ok, false);
  assert.equal(replay.status, 409);
  assert.equal(replay.error, "REPLAYED_NONCE");
});
