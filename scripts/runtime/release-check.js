const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { isTcpReachable } = require("./ports");
const { cleanStaleProcesses } = require("./cleanup");
const { ensureLocalDataServices } = require("./local-data-services");

const projectRoot = path.resolve(__dirname, "..", "..");
const checks = [];

function record(name, ok, details = "") {
  checks.push({ name, ok, details });
  const status = ok ? "OK" : "FAIL";
  console.log(`${name}: ${status}${details ? ` - ${details}` : ""}`);
}

function quoteArg(arg) {
  if (!/[\s"]/u.test(arg)) {
    return arg;
  }
  return `"${arg.replace(/"/g, '\\"')}"`;
}

function shellCommand(commandLine) {
  return process.platform === "win32"
    ? { command: "cmd.exe", args: ["/d", "/s", "/c", commandLine] }
    : { command: "sh", args: ["-c", commandLine] };
}

function run(command, args, options = {}) {
  const commandLine = [command, ...args].map(quoteArg).join(" ");
  const shell = shellCommand(commandLine);
  const npmCache = process.env.NPM_CONFIG_CACHE || path.join(process.env.TEMP || "C:\\tmp", "som-pro-npm-cache");
  fs.mkdirSync(npmCache, { recursive: true });
  const result = spawnSync(shell.command, shell.args, {
    cwd: projectRoot,
    stdio: options.stdio || "inherit",
    shell: false,
    windowsHide: true,
    env: { ...process.env, NPM_CONFIG_CACHE: npmCache, npm_config_cache: npmCache, ...options.env },
    timeout: options.timeoutMs
  });

  return {
    ok: result.status === 0,
    status: result.status,
    error: result.error,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function npmRun(script, options = {}) {
  return run("npm", ["run", script], options);
}

async function main() {
  const quick = process.argv.includes("--quick");
  const skipBaseline = process.argv.includes("--skip-baseline");
  const e2eCommandTimeoutMs = Number(
    process.env.SOM_E2E_COMMAND_TIMEOUT_MS || process.env.SOM_E2E_TIMEOUT_MS || 150_000
  );

  const staleStopped = cleanStaleProcesses();
  record("Old processes", true, staleStopped ? `stopped ${staleStopped}` : "none");

  const dataServices = await ensureLocalDataServices({ dockerWaitMs: 120_000, serviceWaitMs: 120_000 });
  const postgres = dataServices.status.find((service) => service.name === "PostgreSQL")?.reachable || false;
  const redis = dataServices.status.find((service) => service.name === "Redis")?.reachable || false;
  record(
    "Database reachable",
    postgres,
    postgres ? "127.0.0.1:5432" : dataServices.message || "PostgreSQL unavailable"
  );
  record("Redis reachable", redis, redis ? "127.0.0.1:6379" : dataServices.message || "Redis unavailable");

  const license = await isTcpReachable("127.0.0.1", Number(process.env.SOM_LICENSE_PORT || 4100), 1000);
  record("License server", true, license ? "already running on 4100" : "not running; E2E can use local license bypass");

  const alertingChannels = [process.env.SOM_NOTIFICATION_WEBHOOK_URL, process.env.SOM_SMS_WEBHOOK_URL]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  record(
    "Alerting",
    true,
    alertingChannels.length
      ? `${alertingChannels.length} channel(s) configured${alertingChannels.length ? `: ${alertingChannels.join(", ")}` : ""}`
      : "not configured yet"
  );

  const autoBackupIntervalHours = Number(process.env.SOM_AUTO_BACKUP_INTERVAL_HOURS || 0);
  const autoBackupEnabled = Number.isFinite(autoBackupIntervalHours) && autoBackupIntervalHours > 0;
  const autoBackupRunOnStart = String(process.env.SOM_AUTO_BACKUP_RUN_ON_START || "").toLowerCase() === "true";
  record(
    "Backup automation",
    true,
    autoBackupEnabled
      ? `scheduled every ${autoBackupIntervalHours}h${autoBackupRunOnStart ? " and runs on start" : ""}`
      : "manual only"
  );

  const redundancyMode = String(process.env.SOM_REDUNDANCY_MODE || "single-region").trim() || "single-region";
  const configuredReplicaTargets = [
    process.env.SOM_REPLICA_DATABASE_URL,
    process.env.SOM_REPLICA_API_URL,
    process.env.SOM_REPLICA_LICENSE_SERVER_URL
  ]
    .map((value) => String(value || "").trim())
    .filter((value) => value && !/CHANGE_ME|YOUR_DOMAIN|PLACEHOLDER/i.test(value));
  record(
    "Redundancy",
    true,
    redundancyMode === "single-region"
      ? "single-region recovery only; add replicas for active-passive failover"
      : configuredReplicaTargets.length
        ? `${configuredReplicaTargets.length} replica endpoint(s) configured`
        : "replica mode selected but endpoints are not configured"
  );

  record("Frontend port", !(await isTcpReachable("127.0.0.1", 4188, 500)), "4188 free for E2E");
  record("Backend port", !(await isTcpReachable("127.0.0.1", 4000, 500)), "4000 free for E2E");

  if (!skipBaseline) {
    const audit = run("node", ["scripts/runtime/audit-baseline.js"], { timeoutMs: 120_000 });
    record("npm audit --omit=dev", audit.ok);

    const installDoctor = npmRun("install:doctor", { timeoutMs: 120_000 });
    record("Install doctor", installDoctor.ok);

    const secrets = npmRun("security:secrets", { timeoutMs: 120_000 });
    record("Secrets scan", secrets.ok);
  } else {
    record("npm audit --omit=dev", true, "skipped because CI already ran the baseline checks");
    record("Install doctor", true, "skipped because CI already ran the baseline checks");
    record("Secrets scan", true, "skipped because CI already ran the baseline checks");
  }

  const compliance = npmRun("compliance:test", { timeoutMs: 120_000 });
  record("Compliance", compliance.ok);

  const destructive = npmRun("destructive:test", { timeoutMs: 120_000 });
  record("Destructive", destructive.ok);

  const lint = npmRun("lint", { timeoutMs: 120_000 });
  record("Lint", lint.ok);

  const format = npmRun("format:check", { timeoutMs: 120_000 });
  record("Format", format.ok);

  const typecheck = npmRun("typecheck", { timeoutMs: 120_000 });
  record("Typecheck", typecheck.ok);

  const build = npmRun("build", { timeoutMs: 180_000 });
  record("Build", build.ok);

  if (!quick && postgres && redis) {
    const smoke = npmRun("test:e2e:browser:smoke:core", {
      env: { SOM_E2E_TIMEOUT_MS: process.env.SOM_E2E_TIMEOUT_MS || "60000" },
      timeoutMs: Math.max(90_000, e2eCommandTimeoutMs)
    });
    record("Browser smoke", smoke.ok);

    const smokeStudents = npmRun("test:e2e:browser:smoke:students", {
      env: { SOM_E2E_TIMEOUT_MS: process.env.SOM_E2E_TIMEOUT_MS || "90000" },
      timeoutMs: Math.max(120_000, e2eCommandTimeoutMs)
    });
    record("Browser smoke students", smokeStudents.ok);

    const smokeDaily = npmRun("test:e2e:browser:smoke:daily", {
      env: { SOM_E2E_TIMEOUT_MS: process.env.SOM_E2E_TIMEOUT_MS || "90000" },
      timeoutMs: Math.max(120_000, e2eCommandTimeoutMs)
    });
    record("Browser smoke daily", smokeDaily.ok);

    const deep = npmRun("test:e2e:browser:deep", {
      env: { SOM_E2E_TIMEOUT_MS: process.env.SOM_E2E_TIMEOUT_MS || "120000" },
      timeoutMs: Math.max(150_000, e2eCommandTimeoutMs)
    });
    record("Deep E2E", deep.ok);
  } else if (quick) {
    record("Browser smoke", true, "skipped in --quick mode");
    record("Deep E2E", true, "skipped in --quick mode");
  } else {
    record("Browser smoke", false, "skipped because PostgreSQL or Redis is not reachable");
    record("Deep E2E", false, "skipped because PostgreSQL or Redis is not reachable");
  }

  const gitStatus = run("git", ["status", "--short"], { stdio: "pipe", timeoutMs: 10_000 });
  const cleanGit = gitStatus.ok && !String(gitStatus.stdout || "").trim();
  record("Git status", cleanGit, cleanGit ? "clean" : "working tree has changes");

  const failed = checks.filter((check) => !check.ok);
  console.log("");
  console.log(`Release doctor summary: ${failed.length === 0 ? "READY" : "NOT READY"}`);
  process.exitCode = failed.length === 0 ? 0 : 1;
}

main().catch((failure) => {
  console.error(failure instanceof Error ? failure.message : failure);
  process.exitCode = 1;
});
