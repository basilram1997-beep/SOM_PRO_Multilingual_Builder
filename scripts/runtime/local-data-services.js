const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { log, success, warn } = require("../cli-output");
const { isTcpReachable, waitForTcp } = require("./ports");
const { shellCommand } = require("./services");

const projectRoot = path.resolve(__dirname, "..", "..");
const defaultServices = [
  { name: "PostgreSQL", host: "127.0.0.1", port: 5432, composeService: "postgres" },
  { name: "Redis", host: "127.0.0.1", port: 6379, composeService: "redis" }
];

function run(commandLine, options = {}) {
  const shell = shellCommand(commandLine);
  return spawnSync(shell.command, shell.args, {
    cwd: projectRoot,
    stdio: options.stdio || "inherit",
    windowsHide: true,
    shell: false,
    timeout: options.timeoutMs,
    encoding: options.encoding
  });
}

function hasDockerComposeFile() {
  return fs.existsSync(path.join(projectRoot, "docker-compose.yml"));
}

function isDockerAvailable() {
  const result = run("docker info", { stdio: "pipe", timeoutMs: 15_000, encoding: "utf8" });
  return result.status === 0;
}

function startDockerDesktopIfPresent() {
  if (process.platform !== "win32") {
    return false;
  }

  const dockerDesktopPath = "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe";
  if (!fs.existsSync(dockerDesktopPath)) {
    return false;
  }

  spawnSync("powershell.exe", ["-NoLogo", "-NoProfile", "-Command", `Start-Process -FilePath '${dockerDesktopPath}'`], {
    stdio: "ignore",
    windowsHide: true,
    timeout: 10_000
  });
  return true;
}

async function waitForDocker(timeoutMs) {
  const startedAt = Date.now();
  if (isDockerAvailable()) {
    return true;
  }

  if (startDockerDesktopIfPresent()) {
    log("Docker Desktop start requested. Waiting for Docker daemon...");
  }

  while (Date.now() - startedAt < timeoutMs) {
    if (isDockerAvailable()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  return false;
}

async function getServiceStatus(services = defaultServices) {
  const status = [];
  for (const service of services) {
    status.push({
      ...service,
      reachable: await isTcpReachable(service.host, service.port, 1000)
    });
  }
  return status;
}

function formatMissing(status) {
  return status
    .filter((service) => !service.reachable)
    .map((service) => `${service.name} (${service.host}:${service.port})`)
    .join(", ");
}

async function waitForServices(services, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (const service of services) {
    const remaining = Math.max(1000, deadline - Date.now());
    await waitForTcp(service.host, service.port, remaining);
  }
}

async function ensureLocalDataServices(options = {}) {
  const services = options.services || defaultServices;
  const autoStart = options.autoStart !== false && process.env.SOM_SKIP_LOCAL_DATA_START !== "true";
  const dockerWaitMs = Number(options.dockerWaitMs || process.env.SOM_LOCAL_DOCKER_WAIT_MS || 120_000);
  const serviceWaitMs = Number(options.serviceWaitMs || process.env.SOM_LOCAL_DATA_WAIT_MS || 120_000);

  let status = await getServiceStatus(services);
  if (status.every((service) => service.reachable)) {
    success("Local data services are reachable.");
    return { ok: true, started: false, status };
  }

  if (!autoStart) {
    const missing = formatMissing(status);
    warn(`Local data services are not reachable: ${missing}.`);
    return { ok: false, started: false, status, message: `Missing local data services: ${missing}` };
  }

  if (!hasDockerComposeFile()) {
    const missing = formatMissing(status);
    return {
      ok: false,
      started: false,
      status,
      message: `Missing ${missing}, and docker-compose.yml was not found.`
    };
  }

  const dockerReady = await waitForDocker(dockerWaitMs);
  if (!dockerReady) {
    const missing = formatMissing(status);
    return {
      ok: false,
      started: false,
      status,
      message:
        `Docker is not ready, so SOM PRO could not start ${missing}. ` +
        "Start Docker Desktop, then run `npm run local:deps`."
    };
  }

  log("Starting PostgreSQL and Redis with docker compose...");
  const composeServices = services.map((service) => service.composeService).filter(Boolean);
  const compose = run(`docker compose up -d ${composeServices.join(" ")}`, { timeoutMs: 120_000 });
  if (compose.status !== 0) {
    const missing = formatMissing(status);
    return {
      ok: false,
      started: false,
      status,
      message: `docker compose failed while starting ${missing}. Check Docker Desktop and docker-compose.yml.`
    };
  }

  await waitForServices(services, serviceWaitMs).catch(() => null);
  status = await getServiceStatus(services);
  const ok = status.every((service) => service.reachable);
  if (!ok) {
    const missing = formatMissing(status);
    return {
      ok: false,
      started: true,
      status,
      message: `Docker started, but these services are still not reachable: ${missing}.`
    };
  }

  success("PostgreSQL and Redis are ready.");
  return { ok: true, started: true, status };
}

async function main() {
  const result = await ensureLocalDataServices();
  for (const service of result.status) {
    console.log(`${service.name}: ${service.reachable ? "OK" : "FAIL"} - ${service.host}:${service.port}`);
  }
  if (!result.ok) {
    console.error(result.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((failure) => {
    console.error(failure instanceof Error ? failure.message : failure);
    process.exitCode = 1;
  });
}

module.exports = {
  ensureLocalDataServices,
  getServiceStatus
};
