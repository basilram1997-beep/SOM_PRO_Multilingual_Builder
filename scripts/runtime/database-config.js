const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_DATABASE_URL = "postgresql://som_user:som_password@127.0.0.1:5432/som?schema=public";
const DEFAULT_REDIS_URL = "redis://127.0.0.1:6379";

function stripQuotes(value) {
  return String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function parseDotEnv(source) {
  const values = {};
  for (const rawLine of String(source || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = stripQuotes(line.slice(separator + 1));
    if (key) values[key] = value;
  }
  return values;
}

function readBackendEnv(projectRoot) {
  const envPath = path.join(projectRoot, "apps", "backend", ".env");
  if (!fs.existsSync(envPath)) {
    return { path: envPath, exists: false, values: {} };
  }
  return {
    path: envPath,
    exists: true,
    values: parseDotEnv(fs.readFileSync(envPath, "utf8"))
  };
}

function hostForDisplay(hostname) {
  if (!hostname || hostname === "localhost") return "127.0.0.1";
  return hostname;
}

function parseServiceUrl(rawUrl, fallbackUrl, defaultPort) {
  const value = stripQuotes(rawUrl || fallbackUrl);
  try {
    const parsed = new URL(value);
    return {
      ok: true,
      url: value,
      protocol: parsed.protocol.replace(/:$/, ""),
      host: hostForDisplay(parsed.hostname),
      port: Number(parsed.port || defaultPort),
      database: parsed.pathname.replace(/^\//, "")
    };
  } catch {
    return {
      ok: false,
      url: value,
      host: "127.0.0.1",
      port: defaultPort,
      database: ""
    };
  }
}

function resolveRuntimeDataConfig(projectRoot, env = process.env) {
  const backendEnv = readBackendEnv(projectRoot);
  const databaseUrl = env.DATABASE_URL || backendEnv.values.DATABASE_URL || DEFAULT_DATABASE_URL;
  const redisUrl = env.REDIS_URL || backendEnv.values.REDIS_URL || DEFAULT_REDIS_URL;
  return {
    backendEnv,
    database: parseServiceUrl(databaseUrl, DEFAULT_DATABASE_URL, 5432),
    redis: parseServiceUrl(redisUrl, DEFAULT_REDIS_URL, 6379)
  };
}

function createLocalDataServices(projectRoot, env = process.env) {
  const config = resolveRuntimeDataConfig(projectRoot, env);
  return [
    {
      name: "PostgreSQL",
      host: config.database.host,
      port: config.database.port,
      composeService: "postgres",
      configuredUrl: config.database.url,
      configOk: config.database.ok
    },
    {
      name: "Redis",
      host: config.redis.host,
      port: config.redis.port,
      composeService: "redis",
      configuredUrl: config.redis.url,
      configOk: config.redis.ok
    }
  ];
}

module.exports = {
  DEFAULT_DATABASE_URL,
  DEFAULT_REDIS_URL,
  createLocalDataServices,
  parseDotEnv,
  resolveRuntimeDataConfig
};
