require("dotenv").config();

const { spawn, spawnSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");
const { generateE2ELicenseCode } = require("./e2e-license");

const prisma = new PrismaClient();
const nodeCommand = process.platform === "win32" ? "node.exe" : "node";

function trace(message, details) {
  if (details === undefined) {
    console.log(`[${new Date().toISOString()}] ${message}`);
    return;
  }
  console.log(`[${new Date().toISOString()}] ${message}`, details);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    mode: process.env.PERF_MODE || "baseline",
    profile: process.env.PERF_DATASET_SIZE || process.env.PERF_PROFILE || "high",
    runId: process.env.PERF_RUN_ID || "",
    keepData: false,
    concurrency: process.env.PERF_CONCURRENCY || "",
    durationSeconds: process.env.PERF_DURATION_SECONDS || "",
    iterations: process.env.PERF_ITERATIONS || "",
    warmupIterations: process.env.PERF_WARMUP_ITERATIONS || "",
    outputJson: process.env.PERF_OUTPUT_JSON || ""
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--keep-data") {
      result.keepData = true;
      continue;
    }
    if (arg.startsWith("--profile=")) {
      result.profile = arg.slice("--profile=".length);
      continue;
    }
    if (arg === "--profile" && args[index + 1]) {
      result.profile = args[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith("--mode=")) {
      result.mode = arg.slice("--mode=".length);
      continue;
    }
    if (arg === "--mode" && args[index + 1]) {
      result.mode = args[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith("--dataset-size=")) {
      result.profile = arg.slice("--dataset-size=".length);
      continue;
    }
    if (arg === "--dataset-size" && args[index + 1]) {
      result.profile = args[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith("--concurrency=")) {
      result.concurrency = arg.slice("--concurrency=".length);
      continue;
    }
    if (arg === "--concurrency" && args[index + 1]) {
      result.concurrency = args[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith("--durationSeconds=")) {
      result.durationSeconds = arg.slice("--durationSeconds=".length);
      continue;
    }
    if (arg === "--durationSeconds" && args[index + 1]) {
      result.durationSeconds = args[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith("--iterations=")) {
      result.iterations = arg.slice("--iterations=".length);
      continue;
    }
    if (arg === "--iterations" && args[index + 1]) {
      result.iterations = args[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith("--warmupIterations=")) {
      result.warmupIterations = arg.slice("--warmupIterations=".length);
      continue;
    }
    if (arg === "--warmupIterations" && args[index + 1]) {
      result.warmupIterations = args[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith("--outputJson=")) {
      result.outputJson = arg.slice("--outputJson=".length);
      continue;
    }
    if (arg === "--outputJson" && args[index + 1]) {
      result.outputJson = args[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith("--runId=")) {
      result.runId = arg.slice("--runId=".length);
      continue;
    }
    if (arg === "--runId" && args[index + 1]) {
      result.runId = args[index + 1];
      index += 1;
      continue;
    }
  }

  return result;
}

function sanitizeRunId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function isLocalDatabaseUrl(url) {
  return !url || /localhost|127\.0\.0\.1|sqlite:/i.test(url);
}

function resolvePerfApiUrl() {
  return (process.env.PERF_API_URL || process.env.SOM_E2E_API_BASE_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
}

function safeDatabaseHost(url) {
  try {
    if (!url) {
      return "unknown";
    }

    if (/sqlite:/i.test(url)) {
      return "sqlite";
    }

    const parsed = new URL(url);
    return parsed.hostname || "unknown";
  } catch {
    return "unknown";
  }
}

async function waitForUrl(url, timeoutMs = 60_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5_000);
      timer.unref?.();
      const response = await fetch(url, { method: "GET", signal: controller.signal });
      clearTimeout(timer);
      if (response.ok || response.status === 304) {
        return;
      }
    } catch {
      // keep waiting
    }

    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 1000);
      timer.unref?.();
    });
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function spawnBackendProcess(env) {
  return spawn(nodeCommand, ["--import", "tsx", "apps/backend/src/server.ts"], {
    cwd: process.cwd(),
    stdio: "inherit",
    windowsHide: true,
    env,
    shell: false
  });
}

function waitForExit(child, timeoutMs = 5000) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }

  return Promise.race([
    new Promise((resolve) => {
      child.once("exit", resolve);
      child.once("close", resolve);
      child.once("error", resolve);
    }),
    new Promise((resolve) => {
      const timer = setTimeout(resolve, timeoutMs);
      timer.unref?.();
    })
  ]);
}

async function terminateProcessTree(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  child.kill("SIGTERM");
  await waitForExit(child, 3_000);
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T"], { stdio: "ignore" });
    await waitForExit(child, 5000);
    if (child.exitCode === null && child.signalCode === null && typeof child.unref === "function") {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      await waitForExit(child, 5000);
    }
    if (child.exitCode === null && child.signalCode === null && typeof child.unref === "function") {
      child.unref();
    }
    return;
  }

  child.kill("SIGTERM");
  await waitForExit(child, 5000);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    if (typeof child.unref === "function") {
      child.unref();
    }
  }
}

function describeActiveResources() {
  const handles = typeof process._getActiveHandles === "function" ? process._getActiveHandles() : [];
  const requests = typeof process._getActiveRequests === "function" ? process._getActiveRequests() : [];

  return {
    handles: handles.map((handle) => ({
      type: handle?.constructor?.name || "Unknown",
      hasRef: typeof handle?.hasRef === "function" ? handle.hasRef() : null
    })),
    requests: requests.map((request) => request?.constructor?.name || "Unknown")
  };
}

function logActiveResources(stage) {
  trace(stage, describeActiveResources());
}

function buildEnv({ runKey }) {
  const schoolId = `perf-${runKey}`;
  const e2eLicenseCode =
    process.env.SOM_E2E_LICENSE_CODE ||
    generateE2ELicenseCode({
      days: 365,
      schoolName: process.env.SOM_E2E_SCHOOL_NAME || `Load School ${runKey}`,
      institutionCode: process.env.SOM_E2E_INSTITUTION_CODE || `PERF-${runKey.toUpperCase().slice(0, 16)}`,
      secret: process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling"
    });

  return {
    ...process.env,
    SOM_PRO_LICENSE_SERVER_URL: "",
    SOM_LICENSE_SERVER_URL: "",
    SOM_PRO_REQUIRE_CENTRAL_LICENSE: "false",
    SOM_PRO_LICENSE_SECRET: process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling",
    SOM_PRO_AUTH_SECRET: process.env.SOM_PRO_AUTH_SECRET || "change-this-auth-secret-before-selling",
    CORS_ORIGIN: "http://localhost:4188,http://127.0.0.1:4188",
    SOM_E2E_LICENSE_CODE: e2eLicenseCode,
    SOM_E2E_ADMIN_EMAIL: process.env.SOM_E2E_ADMIN_EMAIL || `perf-admin-${runKey}@perf.local`,
    SOM_E2E_ADMIN_PASSWORD: process.env.SOM_E2E_ADMIN_PASSWORD || "Perf-Admin-123!",
    SOM_E2E_ADMIN_NAME: process.env.SOM_E2E_ADMIN_NAME || `Perf Admin ${runKey}`,
    SOM_E2E_SCHOOL_ID: schoolId,
    SOM_E2E_SCHOOL_NAME: process.env.SOM_E2E_SCHOOL_NAME || `Load School ${runKey}`,
    SOM_E2E_INSTITUTION_CODE: process.env.SOM_E2E_INSTITUTION_CODE || `PERF-${runKey.toUpperCase().slice(0, 16)}`,
    PERF_RUN_ID: runKey,
    PERF_SCHOOL_ID: schoolId,
    PERF_MODE: process.env.PERF_MODE || "baseline",
    PERF_DATASET_SIZE: process.env.PERF_DATASET_SIZE || process.env.PERF_PROFILE || "high",
    PERF_CONCURRENCY: process.env.PERF_CONCURRENCY || "",
    PERF_DURATION_SECONDS: process.env.PERF_DURATION_SECONDS || "",
    PERF_ITERATIONS: process.env.PERF_ITERATIONS || "",
    PERF_WARMUP_ITERATIONS: process.env.PERF_WARMUP_ITERATIONS || "",
    PERF_OUTPUT_JSON: process.env.PERF_OUTPUT_JSON || "",
    PERF_REPORT_JSON: process.env.PERF_REPORT_JSON || process.env.PERF_OUTPUT_JSON || "",
    PERF_ANALYSIS_OUTPUT_JSON: process.env.PERF_ANALYSIS_OUTPUT_JSON || "",
    PERF_ANALYSIS_OUTPUT_MD: process.env.PERF_ANALYSIS_OUTPUT_MD || "",
    PERF_ANALYSIS_TOP: process.env.PERF_ANALYSIS_TOP || "",
    PERF_EXPLAIN: process.env.PERF_EXPLAIN || ""
  };
}

async function verifyDataset(runKey, profile) {
  const result = spawnSync(nodeCommand, ["scripts/perf-verify.js", `--runId=${runKey}`, `--datasetSize=${profile}`], {
    stdio: "inherit",
    env: { ...process.env, PERF_RUN_ID: runKey, PERF_PROFILE: profile, PERF_DATASET_SIZE: profile },
    shell: false
  });

  if ((result.status || 0) !== 0) {
    throw new Error(`perf verify failed with exit code ${result.status || 1}`);
  }
}

async function main() {
  const { mode, profile, runId, keepData, concurrency, durationSeconds, iterations, warmupIterations, outputJson } =
    parseArgs();
  const runKey = sanitizeRunId(runId);
  if (!runKey) {
    throw new Error("PERF_RUN_ID is required for the perf orchestrator.");
  }

  const apiUrl = resolvePerfApiUrl();
  if (
    profile === "strong" &&
    isLocalDatabaseUrl(process.env.DATABASE_URL) &&
    process.env.PERF_ALLOW_STRONG_LOCAL_DB !== "1"
  ) {
    throw new Error("Strong profile must use a separate perf/staging database, not the local development database.");
  }

  const env = buildEnv({ runKey });
  env.PERF_MODE = mode;
  env.PERF_DATASET_SIZE = profile;
  env.PERF_PROFILE = profile;
  env.PERF_CONCURRENCY = concurrency;
  env.PERF_DURATION_SECONDS = durationSeconds;
  env.PERF_ITERATIONS = iterations;
  env.PERF_WARMUP_ITERATIONS = warmupIterations;
  env.PERF_OUTPUT_JSON = outputJson;
  env.PERF_API_URL = apiUrl;
  env.PERF_HEALTH_URL = apiUrl;
  let backendProcess;
  let exitCode = 0;

  trace("perf run started", {
    environment: "local",
    databaseHost: safeDatabaseHost(process.env.DATABASE_URL),
    databaseNameMasked: true,
    apiUrl,
    mode,
    profile,
    runKey,
    keepData,
    concurrency,
    durationSeconds,
    iterations,
    warmupIterations,
    outputJson
  });

  try {
    spawnSync(nodeCommand, ["scripts/runtime/cleanup.js", "--processes", "--processes-only"], {
      stdio: "inherit",
      env,
      shell: false
    });

    const seedResult = spawnSync(
      nodeCommand,
      ["scripts/perf-seed.js", `--runId=${runKey}`, `--datasetSize=${profile}`],
      {
        stdio: "inherit",
        env,
        shell: false
      }
    );
    if ((seedResult.status || 0) !== 0) {
      throw new Error(`perf seed failed with exit code ${seedResult.status || 1}`);
    }

    await verifyDataset(runKey, profile);

    backendProcess = spawnBackendProcess(env);
    await waitForUrl(`${apiUrl}/health`, 60_000);

    const measure = spawnSync(nodeCommand, ["scripts/perf-measure.js", `--mode=${mode}`, `--datasetSize=${profile}`], {
      stdio: "inherit",
      env,
      shell: false
    });
    if ((measure.status || 0) !== 0) {
      throw new Error(`perf measure failed with exit code ${measure.status || 1}`);
    }

    const analyze = spawnSync(nodeCommand, ["scripts/perf-analyze.js"], {
      stdio: "inherit",
      env,
      shell: false
    });
    if ((analyze.status || 0) !== 0) {
      throw new Error(`perf analyze failed with exit code ${analyze.status || 1}`);
    }
    trace("benchmark completed", { runKey, profile, mode });
  } catch (error) {
    exitCode = 1;
    throw error;
  } finally {
    trace("entering finally", { runKey, profile, keepData });
    logActiveResources("active resources before cleanup");
    if (backendProcess) {
      trace("child termination started", { pid: backendProcess.pid });
      await terminateProcessTree(backendProcess);
      await waitForExit(backendProcess, 5_000);
      trace("child termination completed", {
        pid: backendProcess.pid,
        code: backendProcess.exitCode,
        signal: backendProcess.signalCode
      });
    }

    if (!keepData) {
      trace("cleanup seed started", { runKey, profile });
      spawnSync(nodeCommand, ["scripts/perf-seed.js", "--cleanup", `--runId=${runKey}`, `--datasetSize=${profile}`], {
        stdio: "inherit",
        env,
        shell: false
      });
      trace("cleanup seed completed", { runKey, profile });
    }

    logActiveResources("active resources after cleanup");
    process.exitCode = exitCode;
    trace("wrapper returning exit code", { exitCode });
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
