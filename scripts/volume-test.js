require("dotenv").config();

const { spawnSync } = require("node:child_process");

const nodeCommand = process.platform === "win32" ? "node.exe" : "node";

function trace(message, details) {
  if (details === undefined) {
    console.log(`[${new Date().toISOString()}] ${message}`);
    return;
  }
  console.log(`[${new Date().toISOString()}] ${message}`, details);
}

function main() {
  const runId = String(process.env.VOLUME_RUN_ID || process.env.PERF_RUN_ID || `volume-${Date.now()}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

  const mode = String(process.env.VOLUME_MODE || "normal").trim();
  const datasetSize = String(process.env.VOLUME_DATASET_SIZE || "high").trim();
  const concurrency = String(process.env.VOLUME_CONCURRENCY || process.env.PERF_CONCURRENCY || "6").trim();
  const durationSeconds = String(
    process.env.VOLUME_DURATION_SECONDS || process.env.PERF_DURATION_SECONDS || "20"
  ).trim();
  const iterations = String(process.env.VOLUME_ITERATIONS || process.env.PERF_ITERATIONS || "").trim();
  const warmupIterations = String(
    process.env.VOLUME_WARMUP_ITERATIONS || process.env.PERF_WARMUP_ITERATIONS || ""
  ).trim();
  const outputJson = String(process.env.VOLUME_OUTPUT_JSON || process.env.PERF_OUTPUT_JSON || "").trim();

  trace("volume test started", {
    runId,
    mode,
    datasetSize,
    concurrency,
    durationSeconds
  });

  const args = [
    "scripts/perf-run.js",
    `--runId=${runId}`,
    `--mode=${mode}`,
    `--datasetSize=${datasetSize}`,
    `--concurrency=${concurrency}`,
    `--durationSeconds=${durationSeconds}`
  ];

  if (iterations) {
    args.push(`--iterations=${iterations}`);
  }
  if (warmupIterations) {
    args.push(`--warmupIterations=${warmupIterations}`);
  }
  if (outputJson) {
    args.push(`--outputJson=${outputJson}`);
  }

  const result = spawnSync(nodeCommand, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    env: {
      ...process.env,
      PERF_RUN_ID: runId,
      PERF_MODE: mode,
      PERF_DATASET_SIZE: datasetSize,
      PERF_PROFILE: datasetSize,
      PERF_CONCURRENCY: concurrency,
      PERF_DURATION_SECONDS: durationSeconds,
      PERF_ITERATIONS: iterations,
      PERF_WARMUP_ITERATIONS: warmupIterations,
      PERF_OUTPUT_JSON: outputJson
    }
  });

  if ((result.status || 0) !== 0) {
    throw new Error(`Volume test failed with exit code ${result.status || 1}`);
  }

  trace("volume test completed", { runId });
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
}
