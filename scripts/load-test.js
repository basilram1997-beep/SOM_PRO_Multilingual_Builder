require("dotenv").config();

const { spawn, spawnSync } = require("node:child_process");
const { join } = require("node:path");

const nodeCommand = process.platform === "win32" ? "node.exe" : "node";

const runId = String(process.env.STRESS_RUN_ID || `load-${Date.now().toString(36)}`)
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9_-]+/g, "-")
  .replace(/-{2,}/g, "-")
  .replace(/^-|-$/g, "");

const env = {
  ...process.env,
  SOM_E2E_DISABLE_RATE_LIMIT: "true",
  STRESS_RUN_ID: runId,
  STRESS_SCENARIO: process.env.STRESS_SCENARIO || "all",
  STRESS_LOGIN_USERS: process.env.STRESS_LOGIN_USERS || "30",
  STRESS_LOGIN_CONCURRENCY: process.env.STRESS_LOGIN_CONCURRENCY || "10",
  STRESS_REQUESTS: process.env.STRESS_REQUESTS || "40",
  STRESS_CONCURRENCY: process.env.STRESS_CONCURRENCY || "10",
  STRESS_OUTAGE_DELAY_MS: process.env.STRESS_OUTAGE_DELAY_MS || "300",
  STRESS_OUTPUT_DIR: process.env.STRESS_OUTPUT_DIR || join("tests", "load", "artifacts")
};

spawnSync(nodeCommand, ["scripts/runtime/cleanup.js", "--processes", "--processes-only"], {
  stdio: "inherit",
  windowsHide: true,
  shell: false
});

const child = spawn(nodeCommand, ["scripts/stress-run.js"], {
  stdio: "inherit",
  windowsHide: true,
  shell: false,
  env
});

child.once("exit", (code, signal) => {
  if (signal) {
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});

child.once("error", (failure) => {
  console.error("[SOM PRO] load test failed", failure);
  process.exitCode = 1;
});
