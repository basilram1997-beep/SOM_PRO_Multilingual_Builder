require("dotenv").config();

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

function readModeArg() {
  const raw = process.argv.slice(2);
  for (const arg of raw) {
    if (arg.startsWith("--mode=")) {
      return String(arg.slice("--mode=".length)).trim().toLowerCase();
    }
  }
  return String(process.env.RESILIENCE_MODE || "chaos")
    .trim()
    .toLowerCase();
}

function trace(message, details) {
  if (details === undefined) {
    console.log(`[${new Date().toISOString()}] ${message}`);
    return;
  }
  console.log(`[${new Date().toISOString()}] ${message}`, details);
}

function main() {
  const mode = readModeArg();
  const scenario = mode === "redundancy" ? "outage" : "outage";
  const runId = sanitizeRunId(process.env.RESILIENCE_RUN_ID || `resilience-${mode}-${Date.now()}`);
  const outputDir = process.env.RESILIENCE_OUTPUT_DIR || join("tests", "stress", "artifacts");
  const reportJson = process.env.RESILIENCE_OUTPUT_JSON || join(outputDir, `resilience-report-${runId}.json`);
  const reportMd = process.env.RESILIENCE_OUTPUT_MD || join(outputDir, `resilience-report-${runId}.md`);
  const summaryJson = process.env.RESILIENCE_SUMMARY_JSON || join(outputDir, `resilience-summary-${runId}.json`);
  const summaryMd = process.env.RESILIENCE_SUMMARY_MD || join(outputDir, `resilience-summary-${runId}.md`);

  trace("resilience test started", { runId, mode, scenario });

  const env = {
    ...process.env,
    STRESS_RUN_ID: runId,
    STRESS_SCENARIO: scenario,
    STRESS_ALLOW_FAILURES: "true",
    STRESS_KEEP_DATA: "true",
    STRESS_LOGIN_USERS: process.env.RESILIENCE_LOGIN_USERS || process.env.STRESS_LOGIN_USERS || "4",
    STRESS_LOGIN_CONCURRENCY: process.env.RESILIENCE_LOGIN_CONCURRENCY || process.env.STRESS_LOGIN_CONCURRENCY || "2",
    STRESS_REQUESTS: process.env.RESILIENCE_REQUESTS || process.env.STRESS_REQUESTS || "4",
    STRESS_CONCURRENCY: process.env.RESILIENCE_CONCURRENCY || process.env.STRESS_CONCURRENCY || "1",
    STRESS_OUTAGE_DELAY_MS: process.env.RESILIENCE_OUTAGE_DELAY_MS || process.env.STRESS_OUTAGE_DELAY_MS || "120",
    STRESS_OUTPUT_JSON: reportJson,
    STRESS_OUTPUT_MD: reportMd,
    STRESS_SUMMARY_JSON: summaryJson,
    STRESS_SUMMARY_MD: summaryMd
  };

  const result = spawnSync(nodeCommand, ["scripts/stress-test.js"], {
    stdio: "inherit",
    windowsHide: true,
    shell: false,
    env
  });

  if (result.error) {
    throw result.error;
  }
  if ((result.status || 0) !== 0) {
    throw new Error(`Resilience test failed with exit code ${result.status || 1}`);
  }

  trace("resilience test completed", {
    runId,
    reportJson,
    reportMd,
    summaryJson,
    summaryMd
  });
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
}
