require("dotenv").config();

const crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const net = require("node:net");
const { join } = require("node:path");
const { PrismaClient } = require("@prisma/client");
const { generateE2ELicenseCode } = require("./e2e-license");

const prisma = new PrismaClient();
const nodeCommand = process.platform === "win32" ? "node.exe" : "node";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const runId = sanitizeRunId(process.env.STRESS_RUN_ID || `stress-${crypto.randomUUID().slice(0, 8)}`);
const schoolId = process.env.STRESS_SCHOOL_ID || `stress-${runId}`;
const schoolName = process.env.SOM_E2E_SCHOOL_NAME || `Stress School ${runId}`;
const institutionCode = process.env.SOM_E2E_INSTITUTION_CODE || `STR-${runId.slice(0, 8).toUpperCase()}`;
const adminEmail = process.env.SOM_E2E_ADMIN_EMAIL || `admin-${runId}`;
const adminPassword = process.env.SOM_E2E_ADMIN_PASSWORD || "StressAdmin-123!";
const adminName = process.env.SOM_E2E_ADMIN_NAME || `Stress Admin ${runId}`;
const outputDir = process.env.STRESS_OUTPUT_DIR || join("tests", "stress", "artifacts");
const stressReportJson = process.env.STRESS_OUTPUT_JSON || join(outputDir, `stress-report-${runId}.json`);
const stressReportMd = process.env.STRESS_OUTPUT_MD || join(outputDir, `stress-report-${runId}.md`);
const stressSummaryJson = process.env.STRESS_SUMMARY_JSON || join(outputDir, `stress-test-${runId}.json`);
const stressSummaryMd = process.env.STRESS_SUMMARY_MD || join(outputDir, `stress-test-${runId}.md`);
const recoveryTargetRtoMs = Number(process.env.STRESS_RECOVERY_TARGET_RTO_MS || process.env.DR_TARGET_RTO_MS || 300000);

const stressEnv = {
  ...process.env,
  STRESS_RUN_ID: runId,
  STRESS_SCHOOL_ID: schoolId,
  STRESS_SCENARIO: process.env.STRESS_SCENARIO || "all",
  STRESS_KEEP_DATA: "true",
  STRESS_ALLOW_FAILURES: "true",
  SOM_E2E_DISABLE_RATE_LIMIT: "true",
  STRESS_LOGIN_USERS: process.env.STRESS_LOGIN_USERS || "48",
  STRESS_LOGIN_CONCURRENCY: process.env.STRESS_LOGIN_CONCURRENCY || "16",
  STRESS_REQUESTS: process.env.STRESS_REQUESTS || "72",
  STRESS_CONCURRENCY: process.env.STRESS_CONCURRENCY || "16",
  STRESS_OUTAGE_DELAY_MS: process.env.STRESS_OUTAGE_DELAY_MS || "180",
  STRESS_OUTPUT_JSON: stressReportJson,
  STRESS_OUTPUT_MD: stressReportMd,
  SOM_E2E_SCHOOL_NAME: schoolName,
  SOM_E2E_INSTITUTION_CODE: institutionCode,
  SOM_E2E_ADMIN_EMAIL: adminEmail,
  SOM_E2E_ADMIN_PASSWORD: adminPassword,
  SOM_E2E_ADMIN_NAME: adminName,
  SOM_E2E_LICENSE_CODE:
    process.env.SOM_E2E_LICENSE_CODE ||
    generateE2ELicenseCode({
      days: 365,
      schoolName,
      institutionCode,
      secret: process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling"
    }),
  SOM_PRO_LICENSE_SERVER_URL: "",
  SOM_LICENSE_SERVER_URL: "",
  SOM_PRO_REQUIRE_CENTRAL_LICENSE: "false",
  SOM_PRO_LICENSE_SECRET: process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling",
  SOM_PRO_AUTH_SECRET: process.env.SOM_PRO_AUTH_SECRET || "change-this-auth-secret-before-selling",
  CORS_ORIGIN: "http://localhost:4188,http://127.0.0.1:4188"
};

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

function ensureArtifacts() {
  mkdirSync(outputDir, { recursive: true });
}

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function wait(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

async function waitForPortFree(host, port, timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const isFree = await new Promise((resolve) => {
      const socket = net.createConnection({ host, port });
      socket.setTimeout(2000);

      const finish = (value) => {
        socket.removeAllListeners();
        socket.destroy();
        resolve(value);
      };

      socket.once("connect", () => finish(false));
      socket.once("error", () => finish(true));
      socket.once("timeout", () => finish(true));
    });

    if (isFree) {
      return;
    }

    await wait(500);
  }

  throw new Error(`Timed out waiting for ${host}:${port} to become free`);
}

function runProcessCleanup() {
  const result = spawnSync(nodeCommand, ["scripts/runtime/cleanup.js", "--processes", "--processes-only"], {
    stdio: "inherit",
    windowsHide: true,
    shell: false,
    timeout: 15_000
  });

  if (result.error) {
    trace("process cleanup error", result.error.message);
  }
  if (result.signal) {
    trace("process cleanup signaled", { signal: result.signal });
  }
  if (result.status && result.status !== 0) {
    trace("process cleanup exit code", { status: result.status });
  }
}

async function waitForUrl(url, timeoutMs = 120_000) {
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
    await wait(1000);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function httpJson(url, { method = "GET", token, body, timeoutMs = 15_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await response.text().catch(() => "");
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { response, ok: response.ok, status: response.status, text, json };
  } finally {
    clearTimeout(timer);
  }
}

async function bootstrapAndLogin() {
  const licenseCode = stressEnv.SOM_E2E_LICENSE_CODE;
  const bootstrap = await httpJson("http://127.0.0.1:4000/api/auth/bootstrap-license", {
    method: "POST",
    body: { licenseCode, licenseKey: licenseCode },
    timeoutMs: 20_000
  });
  if (!bootstrap.ok && bootstrap.status !== 429) {
    throw new Error(`Bootstrap failed with status ${bootstrap.status}`);
  }

  const login = await httpJson("http://127.0.0.1:4000/api/auth/login", {
    method: "POST",
    body: {
      email: adminEmail,
      password: adminPassword,
      licenseCode,
      licenseKey: licenseCode
    },
    timeoutMs: 20_000
  });
  if (!login.ok) {
    throw new Error(`Recovery login failed with status ${login.status}: ${String(login.text).slice(0, 200)}`);
  }
  const token = login.json?.data?.token || login.json?.token || login.json?.accessToken;
  if (!token) {
    throw new Error("Recovery login succeeded without a token.");
  }
  return token;
}

function startBackend() {
  const command =
    process.platform === "win32"
      ? spawn("cmd.exe", ["/d", "/s", "/c", "npm run dev:backend"], {
          stdio: "inherit",
          windowsHide: true,
          shell: false,
          env: stressEnv
        })
      : spawn(npmCommand, ["run", "dev:backend"], {
          stdio: "inherit",
          windowsHide: true,
          shell: false,
          env: stressEnv
        });

  trace("recovery backend spawned", { pid: command.pid });
  return command;
}

async function terminateProcessTree(child, label) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  trace(`terminating ${label}`, { pid: child.pid });
  if (process.platform === "win32") {
    const result = spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
      shell: false,
      timeout: 10_000
    });
    if (result.error) {
      trace("taskkill error", { pid: child.pid, message: result.error.message });
    }
    if (result.status && result.status !== 0) {
      trace("taskkill exit code", { pid: child.pid, status: result.status });
    }
    child.unref?.();
    return;
  }

  child.kill("SIGTERM");
  await wait(3000);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
  }
  child.unref?.();
}

function cleanupStressData() {
  const deleteOrder = [
    "reportExport",
    "backupJob",
    "auditLog",
    "studentNotification",
    "studentAttendance",
    "studentGradeEntry",
    "studentCertificate",
    "studentAcademicRecord",
    "studentBehaviorRecord",
    "teacherHomeworkSubmission",
    "teacherHomework",
    "teacherExam",
    "teacherLessonToday",
    "dailyEvent",
    "substitution",
    "dailyTeacherStatus",
    "dailySchedule",
    "baseScheduleSlot",
    "homeroomAssignment",
    "teacherAssignment",
    "student",
    "teacher",
    "subject",
    "schoolClass",
    "periodDefinition",
    "schoolSettings",
    "user",
    "school"
  ];

  return (async () => {
    for (const modelName of deleteOrder) {
      if (modelName === "school") {
        await prisma.school.deleteMany({ where: { id: schoolId } }).catch(() => null);
        continue;
      }
      await prisma[modelName].deleteMany({ where: { schoolId } }).catch(() => null);
    }
  })();
}

function writeReport(summary) {
  ensureArtifacts();
  writeFileSync(stressSummaryJson, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  const lines = [];
  lines.push("# Stress Test Report");
  lines.push("");
  lines.push(`- Run ID: \`${runId}\``);
  lines.push(`- School ID: \`${schoolId}\``);
  lines.push(`- Stress phase report: \`${stressReportJson}\``);
  lines.push(`- Recovery report: \`${summary.recovery?.report || "-"}\``);
  lines.push("");
  lines.push("## Stress Phase");
  lines.push("");
  lines.push(`- Exit code: \`${summary.stressPhase.exitCode}\``);
  lines.push(`- Unsafe failure tolerated: \`${summary.stressPhase.unsafeFailureAllowed ? "yes" : "no"}\``);
  lines.push("");
  lines.push("## Recovery Phase");
  lines.push("");
  if (summary.recovery.startedAt) {
    lines.push(`- Recovery started: \`${summary.recovery.startedAt}\``);
  }
  if (summary.recovery.completedAt) {
    lines.push(`- Recovery completed: \`${summary.recovery.completedAt}\``);
  }
  if (Number.isFinite(summary.recovery.durationMs)) {
    lines.push(`- Recovery duration: \`${summary.recovery.durationMs}ms\``);
  }
  if (Number.isFinite(summary.recovery.targetRtoMs)) {
    lines.push(`- Target RTO: \`${summary.recovery.targetRtoMs}ms\``);
    lines.push(`- Within target: \`${summary.recovery.withinTarget ? "yes" : "no"}\``);
  }
  if (summary.recovery.operatorHealth) {
    lines.push(`- Replica mode: \`${summary.recovery.operatorHealth.redundancy?.mode || "-"}\``);
    lines.push(`- Replica ready: \`${summary.recovery.operatorHealth.redundancy?.ready ? "yes" : "no"}\``);
    lines.push(`- Backup policy: \`${summary.recovery.operatorHealth.backupPolicy?.message || "-"}\``);
  }
  for (const step of summary.recovery.steps) {
    lines.push(`- ${step.label}: ${step.ok ? "OK" : "FAIL"}${step.status ? ` (${step.status})` : ""}`);
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- The stress phase is intentionally pushed past the normal load envelope.");
  lines.push("- Recovery is only counted when the backend comes back, accepts login, and serves core API reads again.");

  writeFileSync(stressSummaryMd, `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  ensureArtifacts();
  trace("stress test started", { runId, schoolId });

  runProcessCleanup();
  await waitForPortFree("127.0.0.1", 4000, 30_000);

  const stressRun = spawnSync(nodeCommand, ["scripts/stress-run.js"], {
    stdio: "inherit",
    windowsHide: true,
    shell: false,
    env: stressEnv
  });

  if ((stressRun.status || 0) !== 0) {
    throw new Error(`Stress phase failed with exit code ${stressRun.status || 1}`);
  }

  const stressReport = readJsonIfExists(stressReportJson);
  runProcessCleanup();
  await waitForPortFree("127.0.0.1", 4000, 30_000);
  const recoveryStartedAt = new Date().toISOString();
  const backend = startBackend();
  try {
    await waitForUrl("http://127.0.0.1:4000/health", 120_000);
    const token = await bootstrapAndLogin();
    const operatorHealth = await httpJson("http://127.0.0.1:4000/api/schools/operator-health", {
      token,
      timeoutMs: 20_000
    });
    const classes = await httpJson("http://127.0.0.1:4000/api/classes", { token, timeoutMs: 20_000 });
    if (!classes.ok) {
      throw new Error(`Recovery classes request failed with status ${classes.status}`);
    }

    const reports = await httpJson("http://127.0.0.1:4000/api/reports", { token, timeoutMs: 20_000 });
    if (!reports.ok) {
      throw new Error(`Recovery reports request failed with status ${reports.status}`);
    }

    const classId = stressReport?.context?.classId || null;
    let studentsOk = true;
    if (classId) {
      const students = await httpJson(`http://127.0.0.1:4000/api/students?classId=${encodeURIComponent(classId)}`, {
        token,
        timeoutMs: 20_000
      });
      studentsOk = students.ok;
    }

    const recoveryCompletedAt = new Date().toISOString();
    const durationMs = new Date(recoveryCompletedAt).getTime() - new Date(recoveryStartedAt).getTime();

    const summary = {
      runId,
      schoolId,
      generatedAt: new Date().toISOString(),
      stressPhase: {
        exitCode: stressRun.status || 0,
        report: stressReportJson,
        mdReport: stressReportMd,
        unsafeFailureAllowed: true,
        status: stressReport?.results || []
      },
      recovery: {
        report: stressSummaryJson,
        startedAt: recoveryStartedAt,
        completedAt: recoveryCompletedAt,
        durationMs,
        targetRtoMs: recoveryTargetRtoMs,
        withinTarget: Number.isFinite(durationMs) ? durationMs <= recoveryTargetRtoMs : false,
        operatorHealth: operatorHealth.ok ? operatorHealth.json?.data || null : null,
        steps: [
          { label: "health", ok: true, status: "200" },
          { label: "login", ok: Boolean(token), status: token ? "200" : "no-token" },
          { label: "operator-health", ok: operatorHealth.ok, status: String(operatorHealth.status) },
          { label: "classes", ok: classes.ok, status: String(classes.status) },
          { label: "reports", ok: reports.ok, status: String(reports.status) },
          { label: "students", ok: studentsOk, status: classId ? "checked" : "skipped" }
        ]
      }
    };

    writeReport(summary);
    trace("stress test completed", {
      runId,
      stressReportJson,
      stressSummaryJson,
      recoveryOk: summary.recovery.steps.every((step) => step.ok)
    });
  } finally {
    await terminateProcessTree(backend, "recovery backend");
    await cleanupStressData().catch((failure) =>
      trace("stress cleanup failed", failure instanceof Error ? failure.message : String(failure))
    );
    await prisma.$disconnect().catch(() => null);
  }
}

main().catch((failure) => {
  console.error(failure instanceof Error ? failure.stack || failure.message : failure);
  process.exitCode = 1;
});
