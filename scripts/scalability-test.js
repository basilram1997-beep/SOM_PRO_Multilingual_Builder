require("dotenv").config();

const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const nodeCommand = process.platform === "win32" ? "node.exe" : "node";
const runKey = sanitizeRunId(process.env.SCALABILITY_RUN_ID || crypto.randomUUID().slice(0, 8));
const reportDir = process.env.SCALABILITY_OUTPUT_DIR || join("tests", "perf", "artifacts");
const reportJsonPath = process.env.SCALABILITY_OUTPUT_JSON || join(reportDir, `scalability-report-${runKey}.json`);
const reportMdPath = process.env.SCALABILITY_OUTPUT_MD || join(reportDir, `scalability-report-${runKey}.md`);

const stages = [
  {
    label: "tiny-baseline",
    mode: "baseline",
    datasetSize: "tiny",
    concurrency: process.env.SCALABILITY_BASELINE_CONCURRENCY || "1",
    durationSeconds: process.env.SCALABILITY_BASELINE_DURATION_SECONDS || "8",
    warmupIterations: process.env.SCALABILITY_BASELINE_WARMUP_ITERATIONS || "4"
  },
  {
    label: "high-normal",
    mode: "normal",
    datasetSize: "high",
    concurrency: process.env.SCALABILITY_NORMAL_CONCURRENCY || "10",
    durationSeconds: process.env.SCALABILITY_NORMAL_DURATION_SECONDS || "10",
    warmupIterations: process.env.SCALABILITY_NORMAL_WARMUP_ITERATIONS || "6"
  },
  {
    label: "high-peak",
    mode: "peak",
    datasetSize: "high",
    concurrency: process.env.SCALABILITY_PEAK_CONCURRENCY || "18",
    durationSeconds: process.env.SCALABILITY_PEAK_DURATION_SECONDS || "10",
    warmupIterations: process.env.SCALABILITY_PEAK_WARMUP_ITERATIONS || "8"
  }
];

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

function runPerfStage(stage) {
  const stageRunId = `${runKey}-${stage.label}`;
  const outputJson =
    process.env[`SCALABILITY_OUTPUT_JSON_${stage.label.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`] ||
    join(reportDir, `scalability-${stageRunId}.json`);
  const result = spawnSync(
    nodeCommand,
    [
      "scripts/perf-run.js",
      `--mode=${stage.mode}`,
      `--datasetSize=${stage.datasetSize}`,
      `--concurrency=${stage.concurrency}`,
      `--durationSeconds=${stage.durationSeconds}`,
      `--warmupIterations=${stage.warmupIterations}`,
      `--runId=${stageRunId}`,
      `--outputJson=${outputJson}`
    ],
    {
      stdio: "inherit",
      shell: false,
      env: {
        ...process.env,
        PERF_RUN_ID: stageRunId,
        PERF_MODE: stage.mode,
        PERF_DATASET_SIZE: stage.datasetSize,
        PERF_CONCURRENCY: stage.concurrency,
        PERF_DURATION_SECONDS: stage.durationSeconds,
        PERF_WARMUP_ITERATIONS: stage.warmupIterations,
        PERF_OUTPUT_JSON: outputJson
      }
    }
  );

  if ((result.status || 0) !== 0) {
    throw new Error(`Scalability stage ${stage.label} failed with exit code ${result.status || 1}`);
  }

  const report = JSON.parse(readFileSync(outputJson, "utf8"));
  const worstEndpoint =
    [...(report.endpointRows || [])].sort((left, right) => (right.p95 || 0) - (left.p95 || 0))[0] || null;

  return {
    label: stage.label,
    mode: stage.mode,
    datasetSize: stage.datasetSize,
    runId: stageRunId,
    outputJson,
    overall: report.overall,
    worstEndpoint: worstEndpoint
      ? {
          name: worstEndpoint.name,
          p95: worstEndpoint.p95,
          p99: worstEndpoint.p99,
          errorRate: worstEndpoint.errorRate
        }
      : null,
    violations: report.violations || []
  };
}

function writeReport(results) {
  mkdirSync(reportDir, { recursive: true });

  const payload = {
    runId: runKey,
    generatedAt: new Date().toISOString(),
    stages: results
  };

  writeFileSync(reportJsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const lines = [];
  lines.push("# Scalability Test Report");
  lines.push("");
  lines.push(`- Run ID: \`${runKey}\``);
  lines.push(`- Output JSON: \`${reportJsonPath}\``);
  lines.push("");
  lines.push("| Stage | Mode | Dataset | Requests | Error rate | RPS | Worst endpoint | Worst p95 ms |");
  lines.push("|---|---|---|---:|---:|---:|---|---:|");

  for (const result of results) {
    lines.push(
      `| ${result.label} | ${result.mode} | ${result.datasetSize} | ${result.overall.count} | ${(result.overall.errorRate * 100).toFixed(1)}% | ${result.overall.requestsPerSecond.toFixed(2)} | ${result.worstEndpoint?.name || "-"} | ${result.worstEndpoint?.p95?.toFixed(1) || "-"} |`
    );
  }

  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- `tiny-baseline` checks the low-data/low-user floor.");
  lines.push("- `high-normal` checks growth under a larger dataset and moderate concurrency.");
  lines.push("- `high-peak` checks that the same larger dataset still behaves under heavier concurrency.");

  writeFileSync(reportMdPath, `${lines.join("\n")}\n`, "utf8");
}

function main() {
  trace("scalability test started", { runId: runKey });
  const results = stages.map((stage) => {
    trace("stage started", stage);
    const result = runPerfStage(stage);
    trace("stage completed", {
      label: result.label,
      requests: result.overall.count,
      errorRate: result.overall.errorRate,
      worstEndpoint: result.worstEndpoint?.name || "-"
    });
    return result;
  });

  writeReport(results);
  trace("scalability test completed", { runId, reportJsonPath, reportMdPath });
}

main();
