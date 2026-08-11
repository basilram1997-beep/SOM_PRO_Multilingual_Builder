require("dotenv").config();

const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { join } = require("node:path");

const nodeCommand = process.platform === "win32" ? "node.exe" : "node";

function sanitizeRunId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function main() {
  const runId = sanitizeRunId(process.env.RELIABILITY_RUN_ID || `reliability-${crypto.randomUUID().slice(0, 8)}`);
  const outputJson =
    process.env.RELIABILITY_OUTPUT_JSON || join("tests", "perf", "artifacts", `reliability-report-${runId}.json`);
  const durationSeconds = process.env.RELIABILITY_DURATION_SECONDS || "45";
  const warmupIterations = process.env.RELIABILITY_WARMUP_ITERATIONS || "10";
  const concurrency = process.env.RELIABILITY_CONCURRENCY || "12";
  const profile = process.env.RELIABILITY_PROFILE || "tiny";

  console.log(
    `[SOM PRO] Reliability test started { runId: '${runId}', profile: '${profile}', durationSeconds: '${durationSeconds}', warmupIterations: '${warmupIterations}', concurrency: '${concurrency}' }`
  );

  const result = spawnSync(
    nodeCommand,
    [
      "scripts/perf-run.js",
      "--mode=soak",
      `--profile=${profile}`,
      `--runId=${runId}`,
      `--durationSeconds=${durationSeconds}`,
      `--warmupIterations=${warmupIterations}`,
      `--concurrency=${concurrency}`,
      `--outputJson=${outputJson}`
    ],
    {
      stdio: "inherit",
      shell: false,
      env: {
        ...process.env,
        PERF_RUN_ID: runId,
        PERF_MODE: "soak",
        PERF_PROFILE: profile,
        PERF_DATASET_SIZE: profile,
        PERF_CONCURRENCY: concurrency,
        PERF_DURATION_SECONDS: durationSeconds,
        PERF_WARMUP_ITERATIONS: warmupIterations,
        PERF_OUTPUT_JSON: outputJson
      }
    }
  );

  if (result.error) {
    console.error("[SOM PRO] Reliability test failed", result.error);
    process.exitCode = 1;
    return;
  }

  process.exitCode = result.status || 0;
}

main();
