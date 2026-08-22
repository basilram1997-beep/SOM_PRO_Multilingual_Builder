require("dotenv").config();

const { spawnSync } = require("node:child_process");

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    mode: process.env.RESOURCE_TEST_MODE || "baseline",
    profile: process.env.RESOURCE_TEST_PROFILE || process.env.PERF_DATASET_SIZE || "high",
    runId: process.env.RESOURCE_TEST_RUN_ID || `resource-${Date.now()}`,
    durationSeconds: process.env.RESOURCE_TEST_DURATION_SECONDS || "20",
    warmupIterations: process.env.RESOURCE_TEST_WARMUP_ITERATIONS || "4",
    iterations: process.env.RESOURCE_TEST_ITERATIONS || "",
    concurrency: process.env.RESOURCE_TEST_CONCURRENCY || "",
    sampleIntervalMs: process.env.RESOURCE_SAMPLE_INTERVAL_MS || "2500",
    maxRssMb: process.env.RESOURCE_MAX_RSS_MB || "700",
    maxCpuPercent: process.env.RESOURCE_MAX_CPU_PERCENT || "250",
    maxPrivateMb: process.env.RESOURCE_MAX_PRIVATE_MB || "650"
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith("--mode=")) {
      result.mode = arg.slice("--mode=".length);
      continue;
    }
    if (arg === "--mode" && args[index + 1]) {
      result.mode = args[index + 1];
      index += 1;
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
    if (arg.startsWith("--runId=")) {
      result.runId = arg.slice("--runId=".length);
      continue;
    }
    if (arg === "--runId" && args[index + 1]) {
      result.runId = args[index + 1];
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
    if (arg.startsWith("--warmupIterations=")) {
      result.warmupIterations = arg.slice("--warmupIterations=".length);
      continue;
    }
    if (arg === "--warmupIterations" && args[index + 1]) {
      result.warmupIterations = args[index + 1];
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
    if (arg.startsWith("--concurrency=")) {
      result.concurrency = arg.slice("--concurrency=".length);
      continue;
    }
    if (arg === "--concurrency" && args[index + 1]) {
      result.concurrency = args[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith("--sampleIntervalMs=")) {
      result.sampleIntervalMs = arg.slice("--sampleIntervalMs=".length);
      continue;
    }
    if (arg === "--sampleIntervalMs" && args[index + 1]) {
      result.sampleIntervalMs = args[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith("--maxRssMb=")) {
      result.maxRssMb = arg.slice("--maxRssMb=".length);
      continue;
    }
    if (arg === "--maxRssMb" && args[index + 1]) {
      result.maxRssMb = args[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith("--maxCpuPercent=")) {
      result.maxCpuPercent = arg.slice("--maxCpuPercent=".length);
      continue;
    }
    if (arg === "--maxCpuPercent" && args[index + 1]) {
      result.maxCpuPercent = args[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith("--maxPrivateMb=")) {
      result.maxPrivateMb = arg.slice("--maxPrivateMb=".length);
      continue;
    }
    if (arg === "--maxPrivateMb" && args[index + 1]) {
      result.maxPrivateMb = args[index + 1];
      index += 1;
      continue;
    }
  }

  return result;
}

function main() {
  const args = parseArgs();
  const env = {
    ...process.env,
    PERF_MODE: args.mode,
    PERF_PROFILE: args.profile,
    PERF_DATASET_SIZE: args.profile,
    PERF_RUN_ID: args.runId,
    PERF_DURATION_SECONDS: args.durationSeconds,
    PERF_WARMUP_ITERATIONS: args.warmupIterations,
    PERF_ITERATIONS: args.iterations,
    PERF_CONCURRENCY: args.concurrency,
    RESOURCE_SAMPLE_INTERVAL_MS: args.sampleIntervalMs,
    RESOURCE_MAX_RSS_MB: args.maxRssMb,
    RESOURCE_MAX_CPU_PERCENT: args.maxCpuPercent,
    RESOURCE_MAX_PRIVATE_MB: args.maxPrivateMb
  };

  const result = spawnSync(
    process.execPath,
    ["scripts/perf-run.js", `--mode=${args.mode}`, `--profile=${args.profile}`, `--runId=${args.runId}`],
    {
      cwd: process.cwd(),
      stdio: "inherit",
      env,
      shell: false,
      windowsHide: true
    }
  );

  process.exit(result.status ?? 1);
}

main();
