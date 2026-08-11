require("dotenv").config();

const crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { performance } = require("node:perf_hooks");
const { PrismaClient } = require("@prisma/client");
const { generateE2ELicenseCode } = require("./e2e-license");
const { error, section, warn } = require("./cli-output");

const prisma = new PrismaClient();
const nodeCommand = process.platform === "win32" ? "node.exe" : "node";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const runId = sanitizeRunId(process.env.STRESS_RUN_ID || process.env.PERF_RUN_ID || crypto.randomUUID().slice(0, 8));
const schoolId = process.env.STRESS_SCHOOL_ID || `stress-${runId}`;
const apiUrl = (process.env.STRESS_API_URL || process.env.SOM_E2E_API_BASE_URL || "http://127.0.0.1:4000").replace(
  /\/$/,
  ""
);
const outputDir = process.env.STRESS_OUTPUT_DIR || join("tests", "stress", "artifacts");
const reportJsonPath = process.env.STRESS_OUTPUT_JSON || join(outputDir, `stress-report-${runId}.json`);
const reportMdPath = process.env.STRESS_OUTPUT_MD || join(outputDir, `stress-report-${runId}.md`);
const scenarioName = (process.env.STRESS_SCENARIO || "all").trim().toLowerCase();
const loginUsersTarget = Number(process.env.STRESS_LOGIN_USERS || 20);
const loginConcurrency = Number(process.env.STRESS_LOGIN_CONCURRENCY || 10);
const burstConcurrency = Number(process.env.STRESS_CONCURRENCY || 10);
const burstCount = Number(process.env.STRESS_REQUESTS || 20);
const outageDelayMs = Number(process.env.STRESS_OUTAGE_DELAY_MS || 300);
const keepData = String(process.env.STRESS_KEEP_DATA || "").toLowerCase() === "true";
const allowExpectedFailures = String(process.env.STRESS_ALLOW_FAILURES || "").toLowerCase() === "true";

const schoolName = process.env.SOM_E2E_SCHOOL_NAME || `Load School ${runId}`;
const institutionCode = process.env.SOM_E2E_INSTITUTION_CODE || `STR-${runId.slice(0, 8).toUpperCase()}`;
const adminName = process.env.SOM_E2E_ADMIN_NAME || `Load Admin ${runId}`;
const adminEmail = process.env.SOM_E2E_ADMIN_EMAIL || `admin-${runId}`;
const adminPassword = process.env.SOM_E2E_ADMIN_PASSWORD || "StressAdmin-123!";
const teacherName = process.env.SOM_E2E_TEACHER_NAME || `Load Teacher ${runId}`;
const teacherEmail = process.env.SOM_E2E_TEACHER_EMAIL || `teacher-${runId}`;
const className = process.env.SOM_E2E_CLASS_NAME || `Load Class ${runId}`;
const subjectName = process.env.SOM_E2E_SUBJECT_NAME || `Load Subject ${runId}`;
const studentName = process.env.SOM_E2E_STUDENT_NAME || `Load Student ${runId}`;
const teacherAssignedPassword = process.env.STRESS_ASSIGNED_TEACHER_PASSWORD || "TeacherStress-123!";
const teacherRejectedName = process.env.STRESS_REJECTED_TEACHER_NAME || `Load Rejected Teacher ${runId}`;
const teacherRejectedEmail = process.env.STRESS_REJECTED_TEACHER_EMAIL || `teacher-rejected-${runId}`;
const teacherRejectedPassword = process.env.STRESS_REJECTED_TEACHER_PASSWORD || "TeacherRejected-123!";

const licenseCode =
  process.env.SOM_E2E_LICENSE_CODE ||
  generateE2ELicenseCode({
    days: 365,
    schoolName,
    institutionCode,
    secret: process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling"
  });

const stressEnv = {
  ...process.env,
  SOM_PRO_LICENSE_SERVER_URL: "",
  SOM_LICENSE_SERVER_URL: "",
  SOM_PRO_REQUIRE_CENTRAL_LICENSE: "false",
  SOM_PRO_LICENSE_SECRET: process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling",
  SOM_PRO_AUTH_SECRET: process.env.SOM_PRO_AUTH_SECRET || "change-this-auth-secret-before-selling",
  SOM_E2E_DISABLE_RATE_LIMIT: "true",
  CORS_ORIGIN: "http://localhost:4188,http://127.0.0.1:4188",
  SOM_E2E_LICENSE_CODE: licenseCode,
  SOM_E2E_ADMIN_EMAIL: adminEmail,
  SOM_E2E_ADMIN_PASSWORD: adminPassword,
  SOM_E2E_ADMIN_NAME: adminName,
  SOM_E2E_SCHOOL_ID: schoolId,
  SOM_E2E_SCHOOL_NAME: schoolName,
  SOM_E2E_INSTITUTION_CODE: institutionCode,
  SOM_E2E_TEACHER_NAME: teacherName,
  SOM_E2E_TEACHER_EMAIL: teacherEmail,
  SOM_E2E_TEACHER_PASSWORD: teacherAssignedPassword,
  SOM_E2E_CLASS_NAME: className,
  SOM_E2E_SUBJECT_NAME: subjectName,
  SOM_E2E_STUDENT_NAME: studentName,
  SOM_E2E_OTHER_TEACHER_NAME: teacherRejectedName,
  SOM_E2E_OTHER_TEACHER_EMAIL: teacherRejectedEmail,
  SOM_E2E_OTHER_TEACHER_PASSWORD: teacherRejectedPassword
};

let backendProcess = null;
let bootstrapPromise = null;

function sanitizeRunId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function timestamp() {
  return new Date().toISOString();
}

function trace(message, details) {
  if (details === undefined) {
    console.log(`[${timestamp()}] ${message}`);
    return;
  }
  console.log(`[${timestamp()}] ${message}`, details);
}

function withTimeout(promise, timeoutMs, label) {
  let timer = null;
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
  await waitForExit(child, 3000);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
  }
  child.unref?.();
}

function startBackend() {
  if (process.platform === "win32") {
    backendProcess = spawn("cmd.exe", ["/d", "/s", "/c", "npm run dev:backend"], {
      stdio: "inherit",
      windowsHide: true,
      shell: false,
      env: stressEnv
    });
  } else {
    backendProcess = spawn(npmCommand, ["run", "dev:backend"], {
      stdio: "inherit",
      windowsHide: true,
      shell: false,
      env: stressEnv
    });
  }

  trace("backend spawned", { pid: backendProcess.pid });
  backendProcess.once("exit", (code, signal) => trace("backend exit", { pid: backendProcess.pid, code, signal }));
  backendProcess.once("close", (code, signal) => trace("backend close", { pid: backendProcess.pid, code, signal }));
  backendProcess.once("error", (failure) =>
    trace("backend error", { pid: backendProcess.pid, message: failure.message })
  );
}

async function stopBackend() {
  await terminateProcessTree(backendProcess, "backend");
  await waitForExit(backendProcess, 5000);
  if (backendProcess) {
    backendProcess.removeAllListeners();
  }
  backendProcess = null;
}

async function waitForUrl(url, timeoutMs = 60_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
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
  if (!bootstrapPromise) {
    bootstrapPromise = fetch(`${apiUrl}/api/auth/bootstrap-license`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseCode, licenseKey: licenseCode })
    }).then(async (response) => {
      const text = await response.text().catch(() => "");
      if (!response.ok && response.status !== 429) {
        throw new Error(`Bootstrap failed with status ${response.status}; body=${text.slice(0, 300)}`);
      }
    });
  }

  await bootstrapPromise;
}

async function apiLogin(email, password) {
  await bootstrapLicense();
  const response = await fetch(`${apiUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, licenseCode, licenseKey: licenseCode })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Login failed with status ${response.status}`);
  }
  return payload.data;
}

async function requestJson(path, { method = "GET", token, body, timeoutMs = 15_000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const text = await response.text().catch(() => "");
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { response, status: response.status, ok: response.ok, text, json };
  } catch (failure) {
    return {
      response: null,
      status: 0,
      ok: false,
      text: "",
      json: null,
      error: failure
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureUserAccount(token, { name, email, password, role }) {
  const users = await requestJson("/api/settings/users", { token });
  if (!users.ok) {
    throw new Error(`Could not list users: ${users.status} ${users.text.slice(0, 200)}`);
  }
  const existing = Array.isArray(users.json?.data)
    ? users.json.data.find((item) => String(item.email || "").toLowerCase() === email.toLowerCase())
    : null;
  if (existing) {
    return existing;
  }

  const created = await requestJson("/api/settings/users", {
    method: "POST",
    token,
    body: { name, email, password, role }
  });
  if (!created.ok) {
    throw new Error(`Could not create user ${email}: ${created.status} ${created.text.slice(0, 300)}`);
  }
  return created.json?.data;
}

async function ensureTeacherProfile(token, teacherData) {
  const teachers = await requestJson("/api/teachers", { token });
  if (!teachers.ok) {
    throw new Error(`Could not list teachers: ${teachers.status} ${teachers.text.slice(0, 200)}`);
  }
  const existing = Array.isArray(teachers.json?.data)
    ? teachers.json.data.find((item) => item.name === teacherData.name)
    : null;
  if (existing) {
    return existing;
  }

  const created = await requestJson("/api/teachers", {
    method: "POST",
    token,
    body: teacherData
  });
  if (!created.ok) {
    throw new Error(`Could not create teacher ${teacherData.name}: ${created.status} ${created.text.slice(0, 300)}`);
  }
  return created.json?.data;
}

async function ensureClass(token, classData) {
  const classes = await requestJson("/api/classes", { token });
  if (!classes.ok) {
    throw new Error(`Could not list classes: ${classes.status} ${classes.text.slice(0, 200)}`);
  }
  const existing = Array.isArray(classes.json?.data)
    ? classes.json.data.find((item) => item.name === classData.name)
    : null;
  if (existing) {
    return existing;
  }

  const created = await requestJson("/api/classes", {
    method: "POST",
    token,
    body: classData
  });
  if (!created.ok) {
    throw new Error(`Could not create class ${classData.name}: ${created.status} ${created.text.slice(0, 300)}`);
  }
  return created.json?.data;
}

async function ensureSubject(token, subjectData) {
  const subjects = await requestJson("/api/subjects", { token });
  if (!subjects.ok) {
    throw new Error(`Could not list subjects: ${subjects.status} ${subjects.text.slice(0, 200)}`);
  }
  const existing = Array.isArray(subjects.json?.data)
    ? subjects.json.data.find((item) => item.name === subjectData.name)
    : null;
  if (existing) {
    return existing;
  }

  const created = await requestJson("/api/subjects", {
    method: "POST",
    token,
    body: subjectData
  });
  if (!created.ok) {
    throw new Error(`Could not create subject ${subjectData.name}: ${created.status} ${created.text.slice(0, 300)}`);
  }
  return created.json?.data;
}

async function ensureAssignment(teacherId, classId, subjectId) {
  const existing = await prisma.teacherAssignment.findFirst({
    where: {
      schoolId,
      teacherId,
      classId,
      subjectId
    }
  });

  if (existing) {
    await prisma.teacherAssignment.update({
      where: { id: existing.id },
      data: { weeklyPeriods: 6 }
    });
    return existing;
  }

  return prisma.teacherAssignment.create({
    data: {
      schoolId,
      teacherId,
      classId,
      subjectId,
      weeklyPeriods: 6
    }
  });
}

async function ensureStudents(token, classId, minimumCount) {
  const students = await requestJson(`/api/students?classId=${encodeURIComponent(classId)}`, { token });
  if (!students.ok) {
    throw new Error(`Could not list students: ${students.status} ${students.text.slice(0, 200)}`);
  }
  const existing = Array.isArray(students.json?.data) ? students.json.data : [];
  const missing = Math.max(0, minimumCount - existing.length);
  const created = [];

  for (let index = 0; index < missing; index += 1) {
    const studentNumber = existing.length + index + 1;
    const response = await requestJson("/api/students", {
      method: "POST",
      token,
      body: {
        name: `Load Student ${runId} ${studentNumber}`,
        nationalId: `9${runId.replace(/[^0-9]/g, "").slice(0, 8)}${String(studentNumber).padStart(3, "0")}`,
        classId,
        fatherName: "Father",
        motherName: "Mother",
        guardianPhone: "0500000000"
      }
    });
    if (!response.ok) {
      throw new Error(`Could not create student ${studentNumber}: ${response.status} ${response.text.slice(0, 300)}`);
    }
    created.push(response.json?.data);
  }

  return [...existing, ...created];
}

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);
  const percentile = (ratio) =>
    sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))] || 0;
  return {
    count: sorted.length,
    min: sorted[0] || 0,
    average: sorted.length ? sum / sorted.length : 0,
    p50: percentile(0.5),
    p90: percentile(0.9),
    p95: percentile(0.95),
    p99: percentile(0.99),
    max: sorted[sorted.length - 1] || 0
  };
}

function bucketStatus(status) {
  if (status >= 200 && status < 300) return "2xx";
  if (status === 401) return "401";
  if (status === 403) return "403";
  if (status === 409) return "409";
  if (status === 422) return "422";
  if (status === 429) return "429";
  if (status >= 400 && status < 500) return "4xx";
  if (status >= 500) return "5xx";
  return "network";
}

async function runBurst(label, total, concurrency, runner) {
  const latencies = [];
  const successLatencies = [];
  const statuses = [];
  const samples = [];
  let cursor = 0;
  const startedAt = performance.now();

  async function worker() {
    while (true) {
      const current = cursor++;
      if (current >= total) {
        return;
      }

      const sampleStarted = performance.now();
      try {
        const result = await runner(current);
        const status = result?.status ?? 0;
        const body = result?.bodyText || result?.text || "";
        statuses.push(status);
        latencies.push(performance.now() - sampleStarted);
        if (status >= 200 && status < 300) {
          successLatencies.push(performance.now() - sampleStarted);
        }
        samples.push({
          index: current,
          status,
          body: body.slice(0, 200),
          bucket: bucketStatus(status)
        });
      } catch (failure) {
        latencies.push(performance.now() - sampleStarted);
        statuses.push(0);
        samples.push({
          index: current,
          status: 0,
          body: failure instanceof Error ? failure.message.slice(0, 200) : String(failure).slice(0, 200),
          bucket: "network"
        });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));

  const durationMs = Math.max(1, performance.now() - startedAt);
  const successCount = statuses.filter((status) => status >= 200 && status < 300).length;
  const errorCount = total - successCount;
  const statusBuckets = statuses.reduce((accumulator, status) => {
    const bucket = bucketStatus(status);
    accumulator[bucket] = (accumulator[bucket] || 0) + 1;
    return accumulator;
  }, {});

  return {
    label,
    count: total,
    durationMs,
    requestsPerSecond: (total / durationMs) * 1000,
    ...stats(latencies),
    success: {
      ...stats(successLatencies)
    },
    successCount,
    errorCount,
    errorRate: total ? errorCount / total : 0,
    statusBuckets,
    sampleErrors: samples.filter((sample) => sample.status === 0 || sample.status >= 400).slice(0, 5)
  };
}

async function runLoginBurst(adminToken) {
  section("login burst");
  const accounts = [];

  for (let index = 0; index < loginUsersTarget; index += 1) {
    const role = index % 2 === 0 ? "TEACHER" : "SCHEDULER";
    const name = `Load Login ${runId} ${index + 1}`;
    const email = `stress-login-${runId}-${index + 1}`;
    const password = `StressLogin-${runId}-${index + 1}!`;
    await ensureUserAccount(adminToken, { name, email, password, role });
    accounts.push({ email, password });
  }

  const results = await runBurst("login burst", accounts.length, loginConcurrency, async (index) => {
    const account = accounts[index];
    const response = await requestJson("/api/auth/login", {
      method: "POST",
      body: {
        email: account.email,
        password: account.password,
        licenseCode,
        licenseKey: licenseCode
      },
      timeoutMs: 12_000
    });

    return {
      status: response.status,
      bodyText: response.text
    };
  });

  return {
    ...results,
    safeFailure: (results.statusBuckets["5xx"] || 0) === 0 && (results.statusBuckets.network || 0) === 0
  };
}

async function runGradeBurst(adminToken, teacherAllowedAuth, teacherRejectedAuth, schoolClass, subject, student) {
  section("grade burst");
  await ensureAssignment(teacherAllowedAuth.teacherId, schoolClass.id, subject.id);

  const certificateTypes = ["TERM1_BIMONTHLY", "TERM1_FINAL", "TERM2_BIMONTHLY", "TERM2_FINAL"];
  const gradeVariants = certificateTypes.map((certificateType) => ({
    certificateType,
    rows: {
      [student.id]: { section1: "8" }
    }
  }));

  const results = await runBurst("grade burst", burstCount, burstConcurrency, async (index) => {
    const allowed = index % 2 === 0;
    const auth = allowed ? teacherAllowedAuth : teacherRejectedAuth;
    const variant = gradeVariants[Math.floor(index / 2) % gradeVariants.length];
    const response = await requestJson("/api/students/grade-entries", {
      method: "POST",
      token: auth.token,
      body: {
        classId: schoolClass.id,
        subjectId: subject.id,
        certificateType: variant.certificateType,
        rows: variant.rows
      },
      timeoutMs: 12_000
    });

    return {
      status: response.status,
      bodyText: response.text
    };
  });

  const rowCount = await prisma.studentGradeEntry.count({
    where: {
      schoolId,
      classId: schoolClass.id,
      subjectId: subject.id,
      certificateType: { in: certificateTypes }
    }
  });
  const entries = await prisma.studentGradeEntry.findMany({
    where: {
      schoolId,
      classId: schoolClass.id,
      subjectId: subject.id,
      certificateType: { in: certificateTypes }
    }
  });

  return {
    ...results,
    dbRowCount: rowCount,
    persistedRows: Object.fromEntries(entries.map((entry) => [entry.certificateType, entry.rows])),
    safeFailure:
      rowCount === gradeVariants.length &&
      entries.length === gradeVariants.length &&
      results.statusBuckets["2xx"] === Math.ceil(burstCount / 2) &&
      results.statusBuckets["403"] === Math.floor(burstCount / 2) &&
      (results.statusBuckets["5xx"] || 0) === 0
  };
}

async function runAttendanceBurst(teacherAuth, schoolClass, students) {
  section("attendance burst");
  const date = new Date().toISOString().slice(0, 10);
  const day = "Monday";
  const statuses = ["PRESENT", "LATE", "ABSENT_EXCUSED", "ABSENT_UNEXCUSED", "LEFT_EARLY"];

  const results = await runBurst(
    "attendance burst",
    Math.max(burstCount, students.length * 2),
    burstConcurrency,
    async (index) => {
      const student = students[index % students.length];
      const status = statuses[index % statuses.length];
      const payload = {
        studentId: student.id,
        date,
        day,
        status,
        lateAt: status === "LATE" ? "08:15" : null,
        leftAt: status === "LEFT_EARLY" ? "10:30" : null,
        note: `Load attendance ${index + 1}`
      };

      const response = await requestJson("/api/students/attendance", {
        method: "PUT",
        token: teacherAuth.token,
        body: payload,
        timeoutMs: 12_000
      });

      return {
        status: response.status,
        bodyText: response.text
      };
    }
  );

  const rows = await prisma.studentAttendance.findMany({
    where: {
      schoolId,
      date
    },
    select: {
      id: true,
      studentId: true,
      status: true,
      lateAt: true,
      leftAt: true,
      note: true
    }
  });

  const uniqueStudentIds = new Set(rows.map((row) => row.studentId));
  const duplicatesSafe = uniqueStudentIds.size === rows.length;
  const allValidStatuses = rows.every((row) =>
    ["PRESENT", "LATE", "ABSENT_EXCUSED", "ABSENT_UNEXCUSED", "LEFT_EARLY"].includes(row.status)
  );

  return {
    ...results,
    dbRowCount: rows.length,
    safeFailure:
      duplicatesSafe &&
      allValidStatuses &&
      (results.statusBuckets["5xx"] || 0) === 0 &&
      (results.statusBuckets.network || 0) === 0,
    dbSnapshot: rows.slice(0, 5)
  };
}

async function runReportBurst(adminToken) {
  section("report export burst");
  const payload = {
    page: "stress-reports",
    title: `Load Report ${runId}`,
    fileName: `stress-report-${runId}.pdf`,
    kind: "PDF",
    permission: "manageSettings",
    expiresInMinutes: 15,
    privacyWarningAccepted: true
  };

  const results = await runBurst("report export burst", burstCount, burstConcurrency, async () => {
    const response = await requestJson("/api/reports/export-events", {
      method: "POST",
      token: adminToken,
      body: payload,
      timeoutMs: 12_000
    });

    return {
      status: response.status,
      bodyText: response.text
    };
  });

  return {
    ...results,
    safeFailure: results.errorCount === 0
  };
}

async function runOutageSimulation(teacherAuth, schoolClass, students) {
  section("outage simulation");
  const date = new Date().toISOString().slice(0, 10);
  const statuses = ["PRESENT", "LATE", "LEFT_EARLY"];
  let outageTriggered = false;
  const saveBursts = students.map((student, index) => ({
    studentId: student.id,
    date,
    day: "Monday",
    status: statuses[index % statuses.length],
    lateAt: index % statuses.length === 1 ? "08:20" : null,
    leftAt: index % statuses.length === 2 ? "10:10" : null,
    note: `Outage simulation ${index + 1}`
  }));

  const burstPromise = runBurst(
    "outage save burst",
    Math.max(burstCount * 2, saveBursts.length * 4),
    Math.min(burstConcurrency, Math.max(1, saveBursts.length)),
    async (index) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const payload = saveBursts[index % saveBursts.length];
      const response = await requestJson("/api/students/attendance", {
        method: "PUT",
        token: teacherAuth.token,
        body: payload,
        timeoutMs: 8_000
      });

      return {
        status: response.status,
        bodyText: response.text
      };
    }
  );

  const outageTimer = setTimeout(() => {
    trace("triggering backend outage simulation", { pid: backendProcess?.pid });
    outageTriggered = true;
    void terminateProcessTree(backendProcess, "backend");
  }, outageDelayMs);
  outageTimer.unref?.();

  const results = await burstPromise;
  clearTimeout(outageTimer);

  const rows = await prisma.studentAttendance.findMany({
    where: {
      schoolId,
      date
    },
    select: {
      studentId: true,
      status: true,
      lateAt: true,
      leftAt: true,
      note: true
    }
  });

  const duplicatesSafe = new Set(rows.map((row) => row.studentId)).size === rows.length;
  const noMissingState = rows.every((row) => row.status && (row.status !== "LATE" || row.lateAt !== undefined));
  const outageWasObserved = outageTriggered || backendProcess?.exitCode !== null || backendProcess?.signalCode !== null;

  return {
    ...results,
    dbRowCount: rows.length,
    safeFailure: duplicatesSafe && noMissingState && outageWasObserved,
    dbSnapshot: rows.slice(0, 5)
  };
}

function writeReport(results, context) {
  mkdirSync(outputDir, { recursive: true });

  const payload = {
    runId,
    schoolId,
    apiUrl,
    scenarioName,
    context,
    results,
    createdAt: new Date().toISOString()
  };

  writeFileSync(reportJsonPath, JSON.stringify(payload, null, 2), "utf8");

  const lines = [];
  lines.push(`# Load Test Report`);
  lines.push("");
  lines.push(`- Run ID: \`${runId}\``);
  lines.push(`- School ID: \`${schoolId}\``);
  lines.push(`- API URL: \`${apiUrl}\``);
  lines.push(`- Scenario: \`${scenarioName}\``);
  lines.push("");
  lines.push("| Scenario | Requests | Success | Errors | Error rate | p95 ms | p99 ms | Safe failure |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---|");

  for (const result of results) {
    lines.push(
      `| ${result.label} | ${result.count} | ${result.successCount} | ${result.errorCount} | ${(result.errorRate * 100).toFixed(1)}% | ${result.p95.toFixed(1)} | ${result.p99.toFixed(1)} | ${result.safeFailure ? "Yes" : "No"} |`
    );
  }

  lines.push("");
  lines.push("## Safe Failure Notes");
  lines.push("");
  lines.push("- Login burst should return clean 200 responses once accounts exist.");
  lines.push("- Grade burst is safe when allowed saves persist one row and rejected saves stay 403.");
  lines.push("- Attendance burst is safe when rows remain unique by student/date.");
  lines.push(
    "- The outage simulation is a local fault-injection run that stops the backend mid-save; it is considered safe when the backend interruption is observed and the stored rows stay consistent."
  );

  writeFileSync(reportMdPath, `${lines.join("\n")}\n`, "utf8");
}

async function cleanupStressData() {
  if (keepData) {
    trace("keeping stress data because STRESS_KEEP_DATA=true");
    return;
  }

  trace("stress cleanup started", { schoolId });
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

  for (const modelName of deleteOrder) {
    if (modelName === "school") {
      await prisma.school.deleteMany({ where: { id: schoolId } }).catch(() => null);
      continue;
    }
    await prisma[modelName].deleteMany({ where: { schoolId } }).catch(() => null);
  }
  trace("stress cleanup completed", { schoolId });
}

function printSummary(results) {
  section("stress summary");
  console.log("| scenario | requests | success | errors | error rate | p95 ms | p99 ms | safe failure |");
  console.log("|---|---:|---:|---:|---:|---:|---:|---|");
  for (const result of results) {
    console.log(
      `| ${result.label} | ${result.count} | ${result.successCount} | ${result.errorCount} | ${(result.errorRate * 100).toFixed(1)}% | ${result.p95.toFixed(1)} | ${result.p99.toFixed(1)} | ${result.safeFailure ? "Yes" : "No"} |`
    );
    if (result.statusBuckets) {
      console.log(`  - buckets: ${JSON.stringify(result.statusBuckets)}`);
    }
    if (result.sampleErrors?.length) {
      console.log(`  - samples: ${JSON.stringify(result.sampleErrors)}`);
    }
  }
}

async function main() {
  const results = [];
  const context = {};
  let adminAuth;
  let teacherAllowedAuth;
  let teacherRejectedAuth;
  let schoolClass;
  let subject;
  let students;
  let teacherRejectedProfile = null;
  let exitCode = 1;

  trace("stress run started", {
    runId,
    scenarioName,
    schoolId,
    apiUrl
  });

  try {
    section("preparing database");
    const migrate = spawnSync(npmCommand, ["run", "prisma:migrate:deploy", "-w", "apps/backend"], {
      stdio: "inherit",
      windowsHide: true,
      shell: false,
      env: stressEnv
    });

    if ((migrate.status || 0) !== 0) {
      throw new Error(`Database migration failed with exit code ${migrate.status || 1}`);
    }

    const bootstrap = spawnSync(nodeCommand, ["scripts/e2e-bootstrap.js"], {
      stdio: "inherit",
      windowsHide: true,
      shell: false,
      env: stressEnv
    });

    if ((bootstrap.status || 0) !== 0) {
      throw new Error(`E2E bootstrap failed with exit code ${bootstrap.status || 1}`);
    }

    startBackend();
    await withTimeout(waitForUrl(`${apiUrl}/health`, 120_000), 120_000, "backend readiness");

    adminAuth = await withTimeout(apiLogin(adminEmail, adminPassword), 20_000, "admin login");
    context.adminUserId = adminAuth.user?.id || null;

    const adminToken = adminAuth.token;

    await ensureUserAccount(adminToken, {
      name: teacherName,
      email: teacherEmail,
      password: teacherAssignedPassword,
      role: "TEACHER"
    });
    const teacherProfile = await ensureTeacherProfile(adminToken, {
      name: teacherName,
      nationalId: `3185${runId.replace(/[^0-9]/g, "").slice(0, 8) || "000001"}`,
      employeeNumber: `EMP-${runId.slice(0, 8).toUpperCase()}`,
      specialty: subjectName,
      adminRole: "",
      employmentRatio: 100,
      workDays: ["السبت", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"],
      preferredDays: ["الإثنين", "الثلاثاء"],
      preferredClasses: [className],
      preferredPeriods: [1, 2],
      releaseHours: 0,
      targetLoad: 25,
      notes: "Load assigned teacher"
    });

    await ensureUserAccount(adminToken, {
      name: teacherRejectedName,
      email: teacherRejectedEmail,
      password: teacherRejectedPassword,
      role: "TEACHER"
    });
    teacherAllowedAuth = await apiLogin(teacherEmail, teacherAssignedPassword);
    teacherAllowedAuth.teacherId = teacherProfile.id;

    teacherRejectedProfile = await ensureTeacherProfile(adminToken, {
      name: teacherRejectedName,
      nationalId: `3186${runId.replace(/[^0-9]/g, "").slice(0, 8) || "000002"}`,
      employeeNumber: `EMP-REJ-${runId.slice(0, 8).toUpperCase()}`,
      specialty: subjectName,
      adminRole: "",
      employmentRatio: 100,
      workDays: ["السبت", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"],
      preferredDays: [],
      preferredClasses: [],
      preferredPeriods: [],
      releaseHours: 0,
      targetLoad: 25,
      notes: "Load rejected teacher"
    });
    teacherRejectedAuth = await apiLogin(teacherRejectedEmail, teacherRejectedPassword);
    teacherRejectedAuth.teacherId = teacherRejectedProfile.id;

    schoolClass = await ensureClass(adminToken, {
      name: className,
      grade: "10",
      section: "A",
      maxStudents: 40
    });
    subject = await ensureSubject(adminToken, {
      name: subjectName,
      isHomeroom: false,
      maxMark: 100,
      passMark: 50
    });
    await ensureAssignment(teacherProfile.id, schoolClass.id, subject.id);
    students = await ensureStudents(adminToken, schoolClass.id, Math.max(10, Math.ceil(burstCount / 2)));
    const coreStudent = students[0];
    context.teacherAssigned = teacherProfile.id;
    context.teacherRejected = teacherRejectedProfile.id;
    context.classId = schoolClass.id;
    context.subjectId = subject.id;
    context.coreStudentId = coreStudent.id;

    if (scenarioName === "login" || scenarioName === "all") {
      results.push(await runLoginBurst(adminToken));
    }

    if (scenarioName === "grades" || scenarioName === "all") {
      results.push(
        await runGradeBurst(adminToken, teacherAllowedAuth, teacherRejectedAuth, schoolClass, subject, coreStudent)
      );
    }

    if (scenarioName === "attendance" || scenarioName === "all") {
      results.push(
        await runAttendanceBurst(
          teacherAllowedAuth,
          schoolClass,
          students.slice(0, Math.max(5, Math.min(10, students.length)))
        )
      );
    }

    if (scenarioName === "reports" || scenarioName === "all") {
      results.push(await runReportBurst(adminToken));
    }

    if (scenarioName === "outage" || scenarioName === "all") {
      results.push(
        await runOutageSimulation(
          teacherAllowedAuth,
          schoolClass,
          students.slice(0, Math.max(5, Math.min(10, students.length)))
        )
      );
    }

    printSummary(results);
    writeReport(results, context);

    const anyUnsafeFailure = results.some((result) => result.safeFailure === false);

    if (anyUnsafeFailure && !allowExpectedFailures) {
      throw new Error("One or more stress scenarios did not fail safely.");
    }

    if (anyUnsafeFailure && allowExpectedFailures) {
      warn("stress run recorded unsafe failure(s), but they were allowed for collapse analysis.");
    }

    exitCode = 0;
  } catch (failure) {
    error("stress run failed", failure instanceof Error ? failure.message : failure);
    if (failure instanceof Error && failure.stack) {
      trace("failure stack", failure.stack);
    }
    exitCode = 1;
  } finally {
    trace("entering finally");
    await stopBackend().catch((failure) =>
      warn("backend cleanup failed", failure instanceof Error ? failure.message : String(failure))
    );
    await cleanupStressData().catch((failure) =>
      warn("stress cleanup failed", failure instanceof Error ? failure.message : String(failure))
    );
    await prisma.$disconnect().catch(() => null);
    trace("cleanup completed");
    process.exitCode = exitCode;
  }
}

main().catch((failure) => {
  error("stress run failed", failure instanceof Error ? failure.message : failure);
  process.exitCode = 1;
});
