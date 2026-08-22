require("dotenv").config();

const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
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

function trace(message, details) {
  if (details === undefined) {
    console.log(`[${new Date().toISOString()}] ${message}`);
    return;
  }
  console.log(`[${new Date().toISOString()}] ${message}`, details);
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeReport(filePath, report) {
  writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function main() {
  const runId = sanitizeRunId(process.env.DR_RUN_ID || `dr-${crypto.randomUUID().slice(0, 8)}`);
  const outputDir = process.env.DR_OUTPUT_DIR || join("tests", "dr", "artifacts");
  const stressOutputDir = process.env.DR_STRESS_OUTPUT_DIR || outputDir;
  const stressReportJson =
    process.env.DR_STRESS_REPORT_JSON || join(stressOutputDir, `dr-stress-report-${runId}.json`);
  const stressReportMd = process.env.DR_STRESS_REPORT_MD || join(stressOutputDir, `dr-stress-report-${runId}.md`);
  const stressSummaryJson =
    process.env.DR_STRESS_SUMMARY_JSON || join(stressOutputDir, `dr-stress-summary-${runId}.json`);
  const stressSummaryMd = process.env.DR_STRESS_SUMMARY_MD || join(stressOutputDir, `dr-stress-summary-${runId}.md`);
  const reportJson = process.env.DR_OUTPUT_JSON || join(outputDir, `dr-report-${runId}.json`);
  const reportMd = process.env.DR_OUTPUT_MD || join(outputDir, `dr-report-${runId}.md`);
  const targetRtoMs = Number(process.env.DR_TARGET_RTO_MS || 300000);

  mkdirSync(outputDir, { recursive: true });
  mkdirSync(stressOutputDir, { recursive: true });

  trace("disaster recovery test started", { runId, targetRtoMs });

  const startedAt = Date.now();
  const env = {
    ...process.env,
    STRESS_RUN_ID: runId,
    STRESS_SCENARIO: "outage",
    STRESS_ALLOW_FAILURES: "true",
    STRESS_KEEP_DATA: "true",
    STRESS_LOGIN_USERS: process.env.DR_LOGIN_USERS || process.env.STRESS_LOGIN_USERS || "4",
    STRESS_LOGIN_CONCURRENCY: process.env.DR_LOGIN_CONCURRENCY || process.env.STRESS_LOGIN_CONCURRENCY || "2",
    STRESS_REQUESTS: process.env.DR_REQUESTS || process.env.STRESS_REQUESTS || "4",
    STRESS_CONCURRENCY: process.env.DR_CONCURRENCY || process.env.STRESS_CONCURRENCY || "1",
    STRESS_OUTAGE_DELAY_MS: process.env.DR_OUTAGE_DELAY_MS || process.env.STRESS_OUTAGE_DELAY_MS || "120",
    STRESS_RECOVERY_TARGET_RTO_MS: String(targetRtoMs),
    STRESS_OUTPUT_DIR: stressOutputDir,
    STRESS_OUTPUT_JSON: stressReportJson,
    STRESS_OUTPUT_MD: stressReportMd,
    STRESS_SUMMARY_JSON: stressSummaryJson,
    STRESS_SUMMARY_MD: stressSummaryMd,
    SOM_E2E_DISABLE_RATE_LIMIT: "true"
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
    throw new Error(`Disaster recovery test failed with exit code ${result.status || 1}`);
  }

  const stressSummary = readJson(stressSummaryJson);
  if (!stressSummary) {
    throw new Error(`Disaster recovery summary not found at ${stressSummaryJson}`);
  }

  const recovery = stressSummary.recovery || {};
  const completedAt = new Date().toISOString();
  const elapsedMs = Date.now() - startedAt;
  const steps = Array.isArray(recovery.steps) ? recovery.steps : [];
  const stepOk = steps.every((step) => step.ok);
  const pass = Boolean(recovery.withinTarget && stepOk);

  const report = {
    runId,
    generatedAt: completedAt,
    elapsedMs,
    targetRtoMs,
    pass,
    stressReportJson,
    stressReportMd,
    stressSummaryJson,
    stressSummaryMd,
    recovery: {
      startedAt: recovery.startedAt || null,
      completedAt: recovery.completedAt || null,
      durationMs: Number.isFinite(recovery.durationMs) ? recovery.durationMs : null,
      targetRtoMs: Number.isFinite(recovery.targetRtoMs) ? recovery.targetRtoMs : targetRtoMs,
      withinTarget: Boolean(recovery.withinTarget),
      operatorHealth: recovery.operatorHealth || null,
      steps
    }
  };

  writeReport(reportJson, report);

  const lines = [];
  lines.push("# Disaster Recovery / Failover Test");
  lines.push("");
  lines.push(`- Run ID: \`${runId}\``);
  lines.push(`- Target RTO: \`${targetRtoMs}ms\``);
  lines.push(`- Result: \`${pass ? "PASS" : "FAIL"}\``);
  lines.push(`- Stress summary: \`${stressSummaryJson}\``);
  lines.push("");
  lines.push("## Recovery");
  lines.push("");
  lines.push(`- Started at: \`${report.recovery.startedAt || "-"}\``);
  lines.push(`- Completed at: \`${report.recovery.completedAt || "-"}\``);
  lines.push(`- Duration: \`${report.recovery.durationMs ?? "-"}ms\``);
  lines.push(`- Within target: \`${report.recovery.withinTarget ? "yes" : "no"}\``);
  if (report.recovery.operatorHealth) {
    lines.push(`- Replica mode: \`${report.recovery.operatorHealth.redundancy?.mode || "-"}\``);
    lines.push(`- Replica ready: \`${report.recovery.operatorHealth.redundancy?.ready ? "yes" : "no"}\``);
    lines.push(`- Backup policy: \`${report.recovery.operatorHealth.backupPolicy?.message || "-"}\``);
  }
  lines.push("");
  lines.push("## Steps");
  lines.push("");
  for (const step of steps) {
    lines.push(`- ${step.label}: ${step.ok ? "OK" : "FAIL"}${step.status ? ` (${step.status})` : ""}`);
  }

  writeFileSync(reportMd, `${lines.join("\n")}\n`, "utf8");

  trace("disaster recovery test completed", {
    runId,
    pass,
    reportJson,
    reportMd
  });

  if (!pass) {
    throw new Error("Disaster recovery test did not meet the recovery target or a recovery step failed.");
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
}
