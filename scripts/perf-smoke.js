const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const { performance } = require("node:perf_hooks");
const { generateE2ELicenseCode } = require("./e2e-license");

const baseUrl = process.env.SOM_E2E_BASE_URL || "http://127.0.0.1:4188";
const apiUrl = process.env.SOM_E2E_API_BASE_URL || "http://127.0.0.1:4000";
const iterations = Number(process.env.SOM_PERF_ITERATIONS || 5);
const concurrency = Number(process.env.SOM_PERF_CONCURRENCY || 2);
const schoolId = process.env.SOM_E2E_SCHOOL_ID || "default-school";

const e2eLicenseCode =
  process.env.SOM_E2E_LICENSE_CODE ||
  generateE2ELicenseCode({
    days: 365,
    schoolName: process.env.SOM_E2E_SCHOOL_NAME || "SOM E2E School",
    institutionCode: process.env.SOM_E2E_INSTITUTION_CODE || "E2E-4100",
    secret: process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling"
  });

const e2eEnv = {
  ...process.env,
  SOM_PRO_LICENSE_SERVER_URL: "",
  SOM_LICENSE_SERVER_URL: "",
  SOM_PRO_REQUIRE_CENTRAL_LICENSE: "false",
  SOM_PRO_LICENSE_SECRET: process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling",
  SOM_PRO_AUTH_SECRET: process.env.SOM_PRO_AUTH_SECRET || "change-this-auth-secret-before-selling",
  CORS_ORIGIN: "http://localhost:4188,http://127.0.0.1:4188",
  SOM_E2E_LICENSE_CODE: e2eLicenseCode,
  SOM_E2E_ADMIN_EMAIL: process.env.SOM_E2E_ADMIN_EMAIL || "admin@som-e2e.local",
  SOM_E2E_ADMIN_PASSWORD: process.env.SOM_E2E_ADMIN_PASSWORD || "SOM-E2E-Admin-123!",
  SOM_E2E_ADMIN_NAME: process.env.SOM_E2E_ADMIN_NAME || "SOM E2E Admin",
  SOM_E2E_SCHOOL_ID: schoolId,
  SOM_E2E_SCHOOL_NAME: process.env.SOM_E2E_SCHOOL_NAME || "SOM E2E School",
  SOM_E2E_INSTITUTION_CODE: process.env.SOM_E2E_INSTITUTION_CODE || "E2E-4100",
  SOM_E2E_CLASS_NAME: process.env.SOM_E2E_CLASS_NAME || "SOM E2E Class A",
  SOM_E2E_SUBJECT_NAME: process.env.SOM_E2E_SUBJECT_NAME || "SOM E2E Subject",
  SOM_E2E_TEACHER_NAME: process.env.SOM_E2E_TEACHER_NAME || "SOM E2E Teacher",
  SOM_E2E_STUDENT_NAME: process.env.SOM_E2E_STUDENT_NAME || "SOM E2E Student"
};

let serverProcess = null;

function trace(message, details) {
  if (details === undefined) {
    console.log(`[${new Date().toISOString()}] ${message}`);
    return;
  }
  console.log(`[${new Date().toISOString()}] ${message}`, details);
}

function withTimeout(promise, timeoutMs, label) {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      timer.unref?.();
    })
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function waitForExit(child, timeoutMs = 5000) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }

  return Promise.race([
    new Promise((resolve) => {
      child.once("exit", resolve);
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

  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true
      });
      killer.once("exit", resolve);
      killer.once("error", resolve);
    });
    await waitForExit(child, 5000);
    return;
  }

  child.kill("SIGTERM");
  await waitForExit(child, 5000);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
  }
}

function startServer() {
  serverProcess = spawn(process.execPath, ["scripts/e2e-server.js"], {
    stdio: "inherit",
    windowsHide: true,
    env: e2eEnv,
    shell: false
  });
  return serverProcess;
}

async function stopServer() {
  if (!serverProcess || serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
    return;
  }

  await terminateProcessTree(serverProcess);
  await waitForExit(serverProcess, 5000);

  if (serverProcess.exitCode === null && serverProcess.signalCode === null) {
    serverProcess.removeAllListeners();
    serverProcess.unref?.();
  }
}

async function waitForUrl(url, timeoutMs = 30_000) {
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

async function bootstrapLicense() {
  const response = await fetch(`${apiUrl}/api/auth/bootstrap-license`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ licenseCode: e2eLicenseCode, licenseKey: e2eLicenseCode })
  });

  if (!response.ok && response.status !== 429) {
    throw new Error(`Bootstrap failed with status ${response.status}`);
  }
}

async function apiLogin(email, password) {
  await bootstrapLicense();
  const response = await fetch(`${apiUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, licenseCode: e2eLicenseCode, licenseKey: e2eLicenseCode })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Login failed with status ${response.status}`);
  }
  return payload.data;
}

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);
  const p = (ratio) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))] || 0;
  return {
    count: samples.length,
    avg: sorted.length ? sum / sorted.length : 0,
    min: sorted[0] || 0,
    p50: p(0.5),
    p90: p(0.9),
    p95: p(0.95),
    p99: p(0.99),
    max: sorted[sorted.length - 1] || 0
  };
}

async function measure(label, runner, rounds = iterations, parallelism = concurrency) {
  const samples = [];
  const errors = [];
  const startedAt = performance.now();
  const batches = Math.max(1, Math.ceil(rounds / Math.max(1, parallelism)));
  let completed = 0;

  for (let batchIndex = 0; batchIndex < batches; batchIndex += 1) {
    const batchSize = Math.min(parallelism, rounds - completed);
    if (batchSize <= 0) break;

    const settled = await Promise.allSettled(
      Array.from({ length: batchSize }, async () => {
        const startedAt = performance.now();
        try {
          await runner();
        } catch (error) {
          errors.push(error);
        } finally {
          samples.push(performance.now() - startedAt);
        }
      })
    );

    for (const item of settled) {
      if (item.status === "rejected") {
        errors.push(item.reason);
      }
    }

    completed += batchSize;
  }

  const durationMs = Math.max(1, performance.now() - startedAt);
  const successCount = samples.length - errors.length;
  const errorCount = errors.length;

  return {
    label,
    ...stats(samples),
    durationMs,
    requestsPerSecond: (samples.length / durationMs) * 1000,
    successCount,
    errorCount,
    errorRate: samples.length ? errorCount / samples.length : 0,
    firstError: errors[0] ? (errors[0] instanceof Error ? errors[0].message : String(errors[0])) : ""
  };
}

async function main() {
  const adminEmail = e2eEnv.SOM_E2E_ADMIN_EMAIL;
  const adminPassword = e2eEnv.SOM_E2E_ADMIN_PASSWORD;
  let auth;

  let firstClass;
  let firstStudent;

  trace("perf smoke started", { iterations, concurrency });
  startServer();

  try {
    await withTimeout(
      Promise.all([waitForUrl(`${baseUrl}/`, 30_000), waitForUrl(`${apiUrl}/health`, 30_000)]),
      45_000,
      "local server startup"
    );

    auth = await withTimeout(apiLogin(adminEmail, adminPassword), 20_000, "admin login");
    const headers = { Authorization: `Bearer ${auth.token}` };

    const classesResponse = await fetch(`${apiUrl}/api/classes`, {
      headers,
      signal: AbortSignal.timeout(15_000)
    });
    const classesPayload = await classesResponse.json();
    const classes = Array.isArray(classesPayload?.data) ? classesPayload.data : [];
    if (!classes.length) {
      throw new Error("No classes available for performance smoke.");
    }
    firstClass = classes[0];

    const studentsResponse = await fetch(`${apiUrl}/api/students?classId=${encodeURIComponent(firstClass.id)}`, {
      headers,
      signal: AbortSignal.timeout(15_000)
    });
    const studentsPayload = await studentsResponse.json();
    const students = Array.isArray(studentsPayload?.data) ? studentsPayload.data : [];
    firstStudent = students[0] || null;

    if (!firstStudent) {
      const createResponse = await fetch(`${apiUrl}/api/students`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: `Performance Smoke Student ${crypto.randomUUID().slice(0, 8)}`,
          nationalId: `88${Date.now().toString().slice(-9)}`,
          classId: firstClass.id
        })
      });
      const createPayload = await createResponse.json();
      if (!createResponse.ok) {
        throw new Error(
          createPayload?.message || `Could not create performance smoke student (${createResponse.status})`
        );
      }
      firstStudent = createPayload.data;
    }

    const certificatePayload = {
      studentId: firstStudent.id,
      certificateType: "TERM1_BIMONTHLY",
      academicYear: "2026",
      issueDate: new Date().toISOString().slice(0, 10),
      presentDays: 10,
      absentDays: 1,
      lateDays: 2,
      earlyExitDays: 0,
      behaviorLevel: "GOOD",
      behaviorNote: "Performance smoke",
      teacherNotes: "Performance smoke",
      adminNotes: "Performance smoke",
      teacherSignature: "Teacher",
      principalSignature: "Principal",
      average: 91,
      grade: "A",
      result: "PASS",
      approved: true,
      published: false,
      subjectRows: []
    };

    const reportPayload = {
      page: "performance-smoke",
      title: "Performance Smoke Export",
      fileName: "performance-smoke.pdf",
      kind: "PDF",
      permission: "manageSettings",
      expiresInMinutes: 15,
      privacyWarningAccepted: true
    };

    const summaries = [];
    summaries.push(
      await measure(
        "health",
        async () => {
          const response = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(10_000) });
          if (!response.ok) throw new Error(`health ${response.status}`);
          await response.text();
        },
        8,
        4
      )
    );

    summaries.push(
      await measure(
        "classes",
        async () => {
          const response = await fetch(`${apiUrl}/api/classes`, { headers, signal: AbortSignal.timeout(15_000) });
          if (!response.ok) throw new Error(`classes ${response.status}`);
          await response.text();
        },
        6,
        3
      )
    );

    summaries.push(
      await measure(
        "teachers",
        async () => {
          const response = await fetch(`${apiUrl}/api/teachers`, { headers, signal: AbortSignal.timeout(15_000) });
          if (!response.ok) throw new Error(`teachers ${response.status}`);
          await response.text();
        },
        6,
        3
      )
    );

    summaries.push(
      await measure(
        "students by class",
        async () => {
          const response = await fetch(`${apiUrl}/api/students?classId=${encodeURIComponent(firstClass.id)}`, {
            headers,
            signal: AbortSignal.timeout(15_000)
          });
          if (!response.ok) throw new Error(`students ${response.status}`);
          await response.text();
        },
        6,
        3
      )
    );

    summaries.push(
      await measure(
        "daily schedule",
        async () => {
          const today = new Date().toISOString().slice(0, 10);
          const response = await fetch(`${apiUrl}/api/daily/${today}`, {
            headers,
            signal: AbortSignal.timeout(15_000)
          });
          if (!response.ok) throw new Error(`daily ${response.status}`);
          await response.text();
        },
        6,
        2
      )
    );

    summaries.push(
      await measure(
        "reports index",
        async () => {
          const response = await fetch(`${apiUrl}/api/reports`, { headers, signal: AbortSignal.timeout(15_000) });
          if (!response.ok) throw new Error(`reports index ${response.status}`);
          await response.text();
        },
        5,
        2
      )
    );

    summaries.push(
      await measure(
        "certificate save",
        async () => {
          const response = await fetch(`${apiUrl}/api/students/certificates`, {
            method: "POST",
            headers: {
              ...headers,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(certificatePayload),
            signal: AbortSignal.timeout(20_000)
          });
          const body = await response.text().catch(() => "");
          if (!response.ok) throw new Error(`certificate save ${response.status}; ${body.slice(0, 200)}`);
        },
        4,
        1
      )
    );

    summaries.push(
      await measure(
        "report export event",
        async () => {
          const response = await fetch(`${apiUrl}/api/reports/export-events`, {
            method: "POST",
            headers: {
              ...headers,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(reportPayload),
            signal: AbortSignal.timeout(20_000)
          });
          const body = await response.text().catch(() => "");
          if (!response.ok) throw new Error(`export event ${response.status}; ${body.slice(0, 200)}`);
        },
        4,
        1
      )
    );

    console.log("\nPerformance summary:");
    console.log(
      "| endpoint | count | min ms | avg ms | p50 ms | p90 ms | p95 ms | p99 ms | max ms | rps | success | error | error rate |"
    );
    console.log("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
    for (const row of summaries) {
      console.log(
        `| ${row.label} | ${row.count} | ${row.min.toFixed(1)} | ${row.avg.toFixed(1)} | ${row.p50.toFixed(1)} | ${row.p90.toFixed(1)} | ${row.p95.toFixed(1)} | ${row.p99.toFixed(1)} | ${row.max.toFixed(1)} | ${row.requestsPerSecond.toFixed(2)} | ${row.successCount} | ${row.errorCount} | ${(row.errorRate * 100).toFixed(1)}%${row.firstError ? ` (${row.firstError})` : ""} |`
      );
    }
  } finally {
    await stopServer().catch((error) => {
      trace("perf cleanup failed", {
        message: error instanceof Error ? error.message : String(error)
      });
    });
  }
}

main().catch((failure) => {
  console.error(failure instanceof Error ? failure.stack || failure.message : failure);
  process.exitCode = 1;
});
