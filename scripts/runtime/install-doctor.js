const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { error, log, section, success, warn } = require("../cli-output");
const { resolveRuntimeDataConfig } = require("./database-config");
const { ensureLocalDataServices, getServiceStatus } = require("./local-data-services");
const { shellCommand } = require("./services");

const projectRoot = path.resolve(__dirname, "..", "..");

function run(commandLine, options = {}) {
  const shell = shellCommand(commandLine);
  return spawnSync(shell.command, shell.args, {
    cwd: projectRoot,
    stdio: options.stdio || "inherit",
    windowsHide: true,
    timeout: options.timeoutMs || 120_000,
    shell: false,
    encoding: options.encoding
  });
}

function commandOk(commandLine, timeoutMs = 15_000) {
  return run(commandLine, { stdio: "pipe", timeoutMs, encoding: "utf8" }).status === 0;
}

function statusLine(name, ok, detail) {
  const marker = ok ? "OK" : "FAIL";
  log(`${marker} ${name}${detail ? ` - ${detail}` : ""}`);
}

async function inspectRuntime() {
  const config = resolveRuntimeDataConfig(projectRoot);
  const services = [
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
  const status = await getServiceStatus(services);
  return { config, services, status };
}

function printGuidance({ config, status, dockerOk, composeExists }) {
  section("Install guidance");
  if (!config.backendEnv.exists) {
    warn(`Backend .env was not found at ${config.backendEnv.path}. Run npm run setup:env.`);
  }
  if (!config.database.ok) {
    warn("DATABASE_URL is not a valid URL. Fix apps/backend/.env before running migrations.");
  }
  if (!config.redis.ok) {
    warn("REDIS_URL is not a valid URL. Fix apps/backend/.env before starting the backend.");
  }
  const missing = status.filter((service) => !service.reachable);
  if (missing.length === 0) {
    success("Data services are reachable. You can run npm run setup:db or start the app.");
    return;
  }
  if (composeExists && dockerOk) {
    log("Run npm run install:prepare to start local data services and apply migrations.");
    return;
  }
  if (composeExists && !dockerOk) {
    warn("Docker Desktop is installed or expected, but the Docker daemon is not ready.");
    warn("Open Docker Desktop, wait until it finishes starting, then run npm run install:prepare.");
    return;
  }
  warn("For commercial delivery, configure a managed PostgreSQL URL in apps/backend/.env.");
  warn("Then run npm run install:doctor again to verify connectivity before handover.");
}

async function main() {
  const fix = process.argv.includes("--fix");
  const migrateOnly = process.argv.includes("--migrate-only");
  const composeExists = fs.existsSync(path.join(projectRoot, "docker-compose.yml"));
  const dockerOk = commandOk("docker info");

  section("SOM PRO install doctor");
  statusLine("Project root", true, projectRoot);
  statusLine("docker-compose.yml", composeExists, composeExists ? "found" : "missing");
  statusLine(
    "Docker daemon for local fallback",
    dockerOk,
    dockerOk ? "ready" : "not ready; acceptable when PostgreSQL and Redis are already reachable"
  );

  let inspected = await inspectRuntime();
  statusLine(
    "Backend .env",
    inspected.config.backendEnv.exists,
    inspected.config.backendEnv.exists ? inspected.config.backendEnv.path : "missing"
  );
  statusLine(
    "DATABASE_URL",
    inspected.config.database.ok,
    `${inspected.config.database.host}:${inspected.config.database.port}/${inspected.config.database.database || ""}`
  );
  statusLine("REDIS_URL", inspected.config.redis.ok, `${inspected.config.redis.host}:${inspected.config.redis.port}`);

  section("Service connectivity");
  for (const service of inspected.status) {
    statusLine(service.name, service.reachable, `${service.host}:${service.port}`);
  }

  if (fix && !migrateOnly) {
    section("Starting local data services");
    const startResult = await ensureLocalDataServices({ services: inspected.services });
    if (!startResult.ok) {
      error(startResult.message);
      printGuidance({ ...inspected, dockerOk, composeExists });
      process.exitCode = 1;
      return;
    }
    inspected = await inspectRuntime();
  }

  const allServicesReady = inspected.status.every((service) => service.reachable);
  if (fix && allServicesReady) {
    section("Applying database setup");
    const setup = run("npm run setup:db", { timeoutMs: 180_000 });
    if (setup.status !== 0) {
      error("Database setup failed. Check apps/backend/.env and PostgreSQL permissions.");
      process.exitCode = setup.status || 1;
      return;
    }
    success("Database setup completed.");
  }

  printGuidance({ ...inspected, dockerOk, composeExists });
  process.exitCode = allServicesReady && inspected.config.database.ok && inspected.config.redis.ok ? 0 : 1;
}

if (require.main === module) {
  main().catch((failure) => {
    error(failure instanceof Error ? failure.message : failure);
    process.exitCode = 1;
  });
}
