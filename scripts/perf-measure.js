require("dotenv").config();

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const { PrismaClient } = require("@prisma/client");
const { parseArgs } = require("node:util");

const prisma = new PrismaClient();

const DEFAULT_OUTPUT_JSON = path.join(__dirname, "..", "tests", "perf", "artifacts", "perf-report.json");
const DEFAULT_HEALTH_URL = process.env.PERF_HEALTH_URL || process.env.SOM_E2E_API_BASE_URL || "http://127.0.0.1:4000";
const DEFAULT_API_URL = process.env.PERF_API_URL || process.env.SOM_E2E_API_BASE_URL || "http://127.0.0.1:4000";

const MODE_DEFAULTS = {
  baseline: {
    concurrency: 1,
    durationSeconds: 60,
    warmupIterations: 12
  },
  normal: {
    concurrency: 40,
    durationSeconds: 600,
    warmupIterations: 80
  },
  peak: {
    concurrency: 150,
    durationSeconds: 600,
    warmupIterations: 150
  },
  spike: {
    stages: [
      { label: "spike-low", concurrency: 10, durationSeconds: 120 },
      { label: "spike-peak", concurrency: 250, durationSeconds: 120 },
      { label: "spike-cooldown", concurrency: 10, durationSeconds: 120 }
    ],
    warmupIterations: 50
  },
  soak: {
    concurrency: 50,
    durationSeconds: 3600,
    warmupIterations: 120
  }
};

const ENDPOINTS = [
  {
    name: "health",
    weight: 8,
    timeoutMs: 10_000,
    budgetP95Ms: 100,
    run: async ({ request }) => {
      const response = await request(`${DEFAULT_HEALTH_URL}/health`, { timeoutMs: 10_000 });
      if (!response.ok) {
        throw new Error(`health ${response.status}`);
      }
    }
  },
  {
    name: "classes",
    weight: 14,
    timeoutMs: 15_000,
    budgetP95Ms: 250,
    run: async ({ request }) => {
      const response = await request(`${DEFAULT_API_URL}/api/classes`, { timeoutMs: 15_000 });
      if (!response.ok) {
        throw new Error(`classes ${response.status}`);
      }
    }
  },
  {
    name: "teachers",
    weight: 14,
    timeoutMs: 15_000,
    budgetP95Ms: 350,
    run: async ({ request }) => {
      const response = await request(`${DEFAULT_API_URL}/api/teachers`, { timeoutMs: 15_000 });
      if (!response.ok) {
        throw new Error(`teachers ${response.status}`);
      }
    }
  },
  {
    name: "students by class",
    weight: 16,
    timeoutMs: 15_000,
    budgetP95Ms: 300,
    run: async ({ request, fixture }) => {
      const response = await request(
        `${DEFAULT_API_URL}/api/students?classId=${encodeURIComponent(fixture.firstClass.id)}`,
        {
          timeoutMs: 15_000
        }
      );
      if (!response.ok) {
        throw new Error(`students ${response.status}`);
      }
    }
  },
  {
    name: "daily schedule",
    weight: 16,
    timeoutMs: 15_000,
    budgetP95Ms: 600,
    run: async ({ request, fixture }) => {
      const response = await request(`${DEFAULT_API_URL}/api/daily/${fixture.todayIso}`, { timeoutMs: 15_000 });
      if (!response.ok) {
        throw new Error(`daily schedule ${response.status}`);
      }
    }
  },
  {
    name: "reports index",
    weight: 10,
    timeoutMs: 15_000,
    budgetP95Ms: 300,
    run: async ({ request }) => {
      const response = await request(`${DEFAULT_API_URL}/api/reports`, { timeoutMs: 15_000 });
      if (!response.ok) {
        throw new Error(`reports index ${response.status}`);
      }
    }
  },
  {
    name: "certificate save",
    weight: 1,
    timeoutMs: 20_000,
    budgetP95Ms: 500,
    run: async ({ request, fixture, runId, selectionState }) => {
      const student = selectRotatingStudent(fixture, selectionState, "certificateSave");
      const body = buildCertificatePayload({
        studentId: student.id,
        academicYear: String(new Date().getFullYear()),
        issueDate: fixture.todayIso,
        runId,
        sequence: selectionState.certificateSave
      });
      const response = await request(`${DEFAULT_API_URL}/api/students/certificates`, {
        method: "POST",
        timeoutMs: 20_000,
        json: body
      });

      if (!response.ok) {
        throw new Error(`certificate save ${response.status}: ${response.bodyText.slice(0, 200)}`);
      }
    }
  },
  {
    name: "certificate read",
    weight: 8,
    timeoutMs: 20_000,
    budgetP95Ms: 500,
    run: async ({ request, fixture, selectionState }) => {
      const student = selectRotatingStudent(fixture, selectionState, "certificateRead");
      const response = await request(
        `${DEFAULT_API_URL}/api/students/certificates?studentId=${encodeURIComponent(student.id)}&certificateType=TERM1_BIMONTHLY&academicYear=${encodeURIComponent(String(new Date().getFullYear()))}`,
        { timeoutMs: 20_000 }
      );
      if (!response.ok) {
        throw new Error(`certificate read ${response.status}: ${response.bodyText.slice(0, 200)}`);
      }
    }
  },
  {
    name: "report export event",
    weight: 10,
    timeoutMs: 20_000,
    budgetP95Ms: 750,
    run: async ({ request, runId }) => {
      const response = await request(`${DEFAULT_API_URL}/api/reports/export-events`, {
        method: "POST",
        timeoutMs: 20_000,
        json: buildReportExportEventPayload(runId)
      });
      if (!response.ok) {
        throw new Error(`report export event ${response.status}: ${response.bodyText.slice(0, 200)}`);
      }
    }
  }
];

function nowIso() {
  return new Date().toISOString();
}

function trace(message, details) {
  if (details === undefined) {
    console.log(`[${nowIso()}] ${message}`);
    return;
  }
  console.log(`[${nowIso()}] ${message}`, details);
}

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      mode: { type: "string" },
      concurrency: { type: "string" },
      durationSeconds: { type: "string" },
      iterations: { type: "string" },
      warmupIterations: { type: "string" },
      datasetSize: { type: "string" },
      outputJson: { type: "string" },
      runId: { type: "string" },
      help: { type: "boolean", short: "h" }
    }
  });

  return values;
}

function sanitizeRunId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function isLocalDatabaseUrl(url) {
  return !url || /localhost|127\.0\.0\.1|sqlite:/i.test(url);
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function pickMode(rawMode) {
  const mode = String(rawMode || "baseline").toLowerCase();
  if (MODE_DEFAULTS[mode]) return mode;
  return "baseline";
}

function resolveOutputJson(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return DEFAULT_OUTPUT_JSON;
  }

  if (["0", "false", "off", "no"].includes(String(rawValue).toLowerCase())) {
    return "";
  }

  if (["1", "true", "on", "yes"].includes(String(rawValue).toLowerCase())) {
    return DEFAULT_OUTPUT_JSON;
  }

  return path.isAbsolute(String(rawValue)) ? String(rawValue) : path.join(process.cwd(), String(rawValue));
}

function createSeededRng(seedText) {
  const seed = crypto.createHash("sha256").update(seedText).digest();
  let state = seed.readUInt32LE(0) ^ seed.readUInt32LE(4) ^ seed.readUInt32LE(8) ^ seed.readUInt32LE(12);
  if (!state) {
    state = 0x6d2b79f5;
  }

  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function pickWeightedItem(rng, items) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  const threshold = rng() * totalWeight;
  let cumulative = 0;
  for (const item of items) {
    cumulative += item.weight;
    if (threshold <= cumulative) {
      return item;
    }
  }
  return items[items.length - 1];
}

function createHistogram(capMs = 60_000) {
  const counts = new Uint32Array(capMs + 1);
  return {
    capMs,
    counts,
    count: 0,
    sum: 0,
    min: Number.POSITIVE_INFINITY,
    max: 0,
    push(value) {
      const sample = Math.max(0, Math.round(value));
      const index = Math.min(capMs, sample);
      counts[index] += 1;
      this.count += 1;
      this.sum += sample;
      this.min = Math.min(this.min, sample);
      this.max = Math.max(this.max, sample);
    },
    snapshot() {
      const percentile = (ratio) => {
        if (!this.count) return 0;
        const target = Math.max(1, Math.ceil(this.count * ratio));
        let cumulative = 0;
        for (let index = 0; index < counts.length; index += 1) {
          cumulative += counts[index];
          if (cumulative >= target) {
            return index;
          }
        }
        return capMs;
      };

      return {
        count: this.count,
        average: this.count ? this.sum / this.count : 0,
        min: Number.isFinite(this.min) ? this.min : 0,
        p50: percentile(0.5),
        p90: percentile(0.9),
        p95: percentile(0.95),
        p99: percentile(0.99),
        max: this.max
      };
    }
  };
}

function createErrorBuckets() {
  return {
    validation: 0,
    authorization: 0,
    rateLimit: 0,
    server: 0,
    timeout: 0,
    network: 0,
    other: 0
  };
}

function classifyError(error) {
  const message = normalizeError(error);
  const lower = message.toLowerCase();

  if (/timeout|timed out|aborterror|deadline exceeded/.test(lower)) {
    return { bucket: "timeout", status: null };
  }
  if (/network|fetch failed|econnrefused|econnreset|enotfound|eaddrinuse/.test(lower)) {
    return { bucket: "network", status: null };
  }

  const statusMatch = message.match(/\b(401|403|408|422|429|5\d{2}|400)\b/);
  const status = statusMatch ? Number(statusMatch[1]) : null;
  if (status === 401 || status === 403) return { bucket: "authorization", status };
  if (status === 429) return { bucket: "rateLimit", status };
  if (status != null && status >= 500) return { bucket: "server", status };
  if (status === 400 || status === 422 || /validation_error|invalid_|required/.test(lower)) {
    return { bucket: "validation", status };
  }

  return { bucket: "other", status };
}

function createEndpointSummary(name, budgetP95Ms) {
  return {
    name,
    budgetP95Ms,
    histogram: createHistogram(),
    successHistogram: createHistogram(),
    successCount: 0,
    errorCount: 0,
    errorBuckets: createErrorBuckets(),
    errors: [],
    requests: 0
  };
}

function summarizeEndpoint(summary, durationMs) {
  const histogram = summary.histogram.snapshot();
  const successHistogram = summary.successHistogram.snapshot();
  return {
    name: summary.name,
    budgetP95Ms: summary.budgetP95Ms,
    count: summary.requests,
    min: histogram.min,
    average: histogram.average,
    p50: histogram.p50,
    p90: histogram.p90,
    p95: histogram.p95,
    p99: histogram.p99,
    max: histogram.max,
    requestsPerSecond: (summary.requests / Math.max(1, durationMs)) * 1000,
    successCount: summary.successCount,
    errorCount: summary.errorCount,
    errorRate: summary.requests ? summary.errorCount / summary.requests : 0,
    firstError: summary.errors[0] || "",
    successMin: successHistogram.min,
    successAverage: successHistogram.average,
    successP50: successHistogram.p50,
    successP90: successHistogram.p90,
    successP95: successHistogram.p95,
    successP99: successHistogram.p99,
    successMax: successHistogram.max,
    errorBuckets: summary.errorBuckets
  };
}

function normalizeError(error) {
  if (!error) return "Unknown error";
  if (error instanceof Error) {
    return error.message || error.name || "Error";
  }
  return String(error);
}

function createRuntimeSampler(sampleEveryMs = 5000) {
  const samples = [];
  let previousCpu = process.cpuUsage();
  let lastTick = performance.now();
  const interval = setInterval(() => {
    const now = performance.now();
    const elapsedSinceLast = now - lastTick;
    const lagMs = Math.max(0, elapsedSinceLast - sampleEveryMs);
    lastTick = now;

    const cpuUsage = process.cpuUsage(previousCpu);
    previousCpu = process.cpuUsage();

    const memory = process.memoryUsage();
    samples.push({
      at: nowIso(),
      rss: memory.rss,
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      external: memory.external,
      arrayBuffers: memory.arrayBuffers || 0,
      cpuUserMs: cpuUsage.user / 1000,
      cpuSystemMs: cpuUsage.system / 1000,
      eventLoopLagMs: lagMs,
      activeHandles: typeof process._getActiveHandles === "function" ? process._getActiveHandles().length : null,
      activeRequests: typeof process._getActiveRequests === "function" ? process._getActiveRequests().length : null
    });
  }, sampleEveryMs);

  interval.unref?.();
  return {
    samples,
    stop() {
      clearInterval(interval);
    }
  };
}

function requestTimeoutController(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`request timed out after ${timeoutMs}ms`)), timeoutMs);
  timer.unref?.();
  return { controller, timer };
}

async function httpRequest(url, options = {}) {
  const timeoutMs = options.timeoutMs || 15_000;
  const { controller, timer } = requestTimeoutController(timeoutMs);
  try {
    const requestHeaders = {
      ...(options.headers || {})
    };
    if (
      options.json !== undefined &&
      !Object.keys(requestHeaders).some((key) => key.toLowerCase() === "content-type")
    ) {
      requestHeaders["Content-Type"] = "application/json";
    }
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: requestHeaders,
      body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
      signal: controller.signal
    });
    const bodyText = await response.text().catch(() => "");
    let body = null;
    try {
      body = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      body = bodyText;
    }
    return {
      ok: response.ok,
      status: response.status,
      headers: response.headers,
      body,
      bodyText
    };
  } finally {
    clearTimeout(timer);
  }
}

async function bootstrapLicense(apiUrl, runKey, licenseCode) {
  const response = await httpRequest(`${apiUrl.replace(/\/$/, "")}/api/auth/bootstrap-license`, {
    method: "POST",
    timeoutMs: 20_000,
    headers: { "Content-Type": "application/json" },
    json: { licenseCode, licenseKey: licenseCode }
  });

  if (!response.ok && response.status !== 429) {
    throw new Error(
      `Bootstrap failed with status ${response.status}: ${String(response.bodyText || "").slice(0, 300)}`
    );
  }

  return response;
}

async function loginAdmin(apiUrl, runKey, licenseCode) {
  const email = process.env.SOM_E2E_ADMIN_EMAIL || `perf-admin-${runKey}@perf.local`;
  const password = process.env.SOM_E2E_ADMIN_PASSWORD || "Perf-Admin-123!";

  await bootstrapLicense(apiUrl, runKey, licenseCode);

  const response = await httpRequest(`${apiUrl.replace(/\/$/, "")}/api/auth/login`, {
    method: "POST",
    timeoutMs: 20_000,
    headers: { "Content-Type": "application/json" },
    json: { email, password, licenseCode, licenseKey: licenseCode }
  });

  if (!response.ok) {
    throw new Error(`Login failed with status ${response.status}: ${String(response.bodyText || "").slice(0, 300)}`);
  }

  const token = response.body?.data?.token || response.body?.token || response.body?.accessToken;
  if (!token) {
    throw new Error("Login succeeded without an access token.");
  }

  return {
    token,
    email,
    headers: { Authorization: `Bearer ${token}` }
  };
}

async function loadFixture(apiUrl, headers, runId) {
  const classesResponse = await httpRequest(`${apiUrl.replace(/\/$/, "")}/api/classes`, {
    headers,
    timeoutMs: 20_000
  });

  if (!classesResponse.ok) {
    throw new Error(`Could not fetch classes (${classesResponse.status})`);
  }

  const classes = Array.isArray(classesResponse.body?.data) ? classesResponse.body.data : [];
  if (!classes.length) {
    throw new Error("No classes available for perf benchmark.");
  }

  const firstClass = classes[0];
  const studentsResponse = await httpRequest(
    `${apiUrl.replace(/\/$/, "")}/api/students?classId=${encodeURIComponent(firstClass.id)}`,
    {
      headers,
      timeoutMs: 20_000
    }
  );

  if (!studentsResponse.ok) {
    throw new Error(`Could not fetch students for perf benchmark (${studentsResponse.status})`);
  }

  let students = Array.isArray(studentsResponse.body?.data) ? studentsResponse.body.data : [];
  let firstStudent = students[0];

  if (!firstStudent) {
    const createResponse = await httpRequest(`${apiUrl.replace(/\/$/, "")}/api/students`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json"
      },
      timeoutMs: 20_000,
      json: {
        name: `Load Student ${runId}`,
        nationalId: `9${Date.now().toString().slice(-9)}`,
        classId: firstClass.id
      }
    });

    if (!createResponse.ok) {
      throw new Error(
        `Could not create perf student (${createResponse.status}): ${String(createResponse.bodyText || "").slice(0, 200)}`
      );
    }

    firstStudent = createResponse.body?.data;
    if (!firstStudent?.id) {
      throw new Error("Load student creation succeeded but returned no student data.");
    }
    students = [firstStudent];
  }

  return {
    firstClass,
    firstStudent,
    classes,
    students,
    todayIso: new Date().toISOString().slice(0, 10)
  };
}

function buildCertificatePayload({ studentId, academicYear, issueDate, runId, sequence = 0 }) {
  return {
    studentId,
    certificateType: "TERM1_BIMONTHLY",
    academicYear,
    issueDate,
    schoolNumber: null,
    presentDays: 10,
    absentDays: 1,
    lateDays: 2,
    earlyExitDays: 0,
    behaviorLevel: "GOOD",
    behaviorNote: `Load certificate ${runId} #${sequence}`,
    teacherNotes: `Load certificate teacher note ${runId} #${sequence}`,
    adminNotes: `Load certificate admin note ${runId} #${sequence}`,
    teacherSignature: "Teacher",
    principalSignature: "Principal",
    average: 91,
    grade: "A",
    result: "PASS",
    saved: true,
    published: false,
    subjectRows: []
  };
}

function buildReportExportEventPayload(runId) {
  return {
    page: "grades",
    title: `Load export ${runId}`,
    fileName: `perf-export-${runId}.pdf`,
    kind: "PDF",
    permission: "manageSettings",
    expiresInMinutes: 15,
    privacyWarningAccepted: true
  };
}

function selectRotatingStudent(fixture, state, purpose) {
  const students =
    Array.isArray(fixture.students) && fixture.students.length
      ? fixture.students
      : fixture.firstStudent
        ? [fixture.firstStudent]
        : [];

  if (!students.length) {
    throw new Error("No students were available in the perf fixture.");
  }

  const currentIndex = Number(state[purpose] || 0);
  state[purpose] = currentIndex + 1;
  return students[currentIndex % students.length];
}

function createOperationsContext({ apiUrl, headers, fixture, runId, endpointCollectors }) {
  const request = async (url, options = {}) =>
    httpRequest(url, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {})
      }
    });

  return {
    apiUrl,
    headers,
    fixture,
    runId,
    endpointCollectors,
    selectionState: {
      certificateSave: 0,
      certificateRead: 0
    },
    request
  };
}

async function runPerfPreflight(context) {
  const academicYear = String(new Date().getFullYear());
  const certificateStudent = selectRotatingStudent(context.fixture, context.selectionState, "certificateSave");
  const certificatePayload = buildCertificatePayload({
    studentId: certificateStudent.id,
    academicYear,
    issueDate: context.fixture.todayIso,
    runId: context.runId,
    sequence: 0
  });

  trace("perf preflight started", {
    certificateStudentId: certificateStudent.id,
    academicYear
  });

  const certificateResponse = await context.request(`${DEFAULT_API_URL}/api/students/certificates`, {
    method: "POST",
    timeoutMs: 20_000,
    json: certificatePayload
  });
  const certificateBody = certificateResponse.bodyText || "";
  if (!certificateResponse.ok) {
    trace("perf preflight certificate save failed", {
      status: certificateResponse.status,
      body: certificateBody.slice(0, 300)
    });
    throw new Error(`Load preflight certificate save failed with status ${certificateResponse.status}`);
  }

  const certificateReadResponse = await context.request(
    `${DEFAULT_API_URL}/api/students/certificates?studentId=${encodeURIComponent(certificateStudent.id)}&certificateType=${encodeURIComponent(certificatePayload.certificateType)}&academicYear=${encodeURIComponent(certificatePayload.academicYear)}`,
    { timeoutMs: 20_000 }
  );
  const certificateReadBody = certificateReadResponse.bodyText || "";
  if (!certificateReadResponse.ok) {
    trace("perf preflight certificate read failed", {
      status: certificateReadResponse.status,
      body: certificateReadBody.slice(0, 300)
    });
    throw new Error(`Load preflight certificate read failed with status ${certificateReadResponse.status}`);
  }

  const exportPayload = buildReportExportEventPayload(context.runId);
  const exportResponse = await context.request(`${DEFAULT_API_URL}/api/reports/export-events`, {
    method: "POST",
    timeoutMs: 20_000,
    json: exportPayload
  });
  const exportBody = exportResponse.bodyText || "";
  if (!exportResponse.ok) {
    trace("perf preflight export event failed", {
      status: exportResponse.status,
      body: exportBody.slice(0, 300)
    });
    throw new Error(`Load preflight report export event failed with status ${exportResponse.status}`);
  }

  trace("perf preflight completed", {
    certificateStatus: certificateResponse.status,
    certificateReadStatus: certificateReadResponse.status,
    exportStatus: exportResponse.status
  });

  const teacherWarmup = await context.request(`${DEFAULT_API_URL}/api/teachers`, { timeoutMs: 20_000 });
  if (!teacherWarmup.ok) {
    trace("perf preflight teachers warmup failed", {
      status: teacherWarmup.status,
      body: (teacherWarmup.bodyText || "").slice(0, 300)
    });
    throw new Error(`Load preflight teachers warmup failed with status ${teacherWarmup.status}`);
  }
}

async function runWarmup(operations, context, warmupIterations, modeName) {
  if (!warmupIterations || warmupIterations <= 0) {
    return { iterations: 0, errors: 0 };
  }

  let errors = 0;
  const rng = createSeededRng(`${context.runId}:${modeName}:warmup`);
  for (let index = 0; index < warmupIterations; index += 1) {
    const operation = pickWeightedItem(rng, operations);
    try {
      await operation.run(context);
    } catch (error) {
      errors += 1;
      trace("warmup request failed", {
        endpoint: operation.name,
        message: normalizeError(error).slice(0, 200)
      });
    }
  }

  return { iterations: warmupIterations, errors };
}

async function runIterationPhase(operations, context, totalIterations, concurrency, phaseName, collector) {
  if (!totalIterations || totalIterations <= 0) {
    return { total: 0, errors: 0 };
  }

  const rng = createSeededRng(`${context.runId}:${phaseName}:iterations`);
  let remaining = totalIterations;
  let errors = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (remaining > 0) {
      remaining -= 1;
      if (remaining < 0) break;
      const operation = pickWeightedItem(rng, operations);
      await executeOperation(operation, context, collector).catch(() => {
        errors += 1;
      });
    }
  });

  await Promise.all(workers);
  return { total: totalIterations, errors };
}

async function runDurationPhase(operations, context, durationSeconds, concurrency, phaseName, collector) {
  const durationMs = Math.max(1, durationSeconds * 1000);
  const deadline = performance.now() + durationMs;
  const rng = createSeededRng(`${context.runId}:${phaseName}:duration`);
  let errors = 0;
  let total = 0;

  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (performance.now() < deadline) {
      const operation = pickWeightedItem(rng, operations);
      total += 1;
      await executeOperation(operation, context, collector).catch(() => {
        errors += 1;
      });
    }
  });

  await Promise.all(workers);
  return { total, errors, durationMs };
}

async function executeOperation(operation, context, collector) {
  const startedAt = performance.now();
  try {
    await operation.run(context);
    const durationMs = performance.now() - startedAt;
    if (collector) {
      collector.requests += 1;
      collector.successCount += 1;
    }
    const endpointCollector = context.endpointCollectors?.get(operation.name);
    if (endpointCollector) {
      endpointCollector.requests += 1;
      endpointCollector.successCount += 1;
      endpointCollector.histogram.push(durationMs);
      endpointCollector.successHistogram.push(durationMs);
    }
    return { ok: true, durationMs };
  } catch (error) {
    const durationMs = performance.now() - startedAt;
    if (collector) {
      collector.requests += 1;
      collector.errorCount += 1;
      if (collector.errors.length < 10) {
        collector.errors.push(normalizeError(error).slice(0, 300));
      }
    }
    const endpointCollector = context.endpointCollectors?.get(operation.name);
    if (endpointCollector) {
      endpointCollector.requests += 1;
      endpointCollector.errorCount += 1;
      endpointCollector.histogram.push(durationMs);
      if (endpointCollector.errors.length < 10) {
        endpointCollector.errors.push(normalizeError(error).slice(0, 300));
      }
      const classification = classifyError(error);
      if (classification.bucket && endpointCollector.errorBuckets[classification.bucket] !== undefined) {
        endpointCollector.errorBuckets[classification.bucket] += 1;
      } else {
        endpointCollector.errorBuckets.other += 1;
      }
    }
    return { ok: false, durationMs, error };
  }
}

function buildModePhases(modeName, settings) {
  if (modeName === "spike") {
    return settings.stages.map((stage) => ({
      label: stage.label,
      concurrency: stage.concurrency,
      durationSeconds: settings.durationSeconds || stage.durationSeconds,
      warmupIterations: settings.warmupIterations,
      iterations: 0
    }));
  }

  return [
    {
      label: modeName,
      concurrency: settings.concurrency,
      durationSeconds: settings.durationSeconds,
      warmupIterations: settings.warmupIterations,
      iterations: settings.iterations || 0
    }
  ];
}

function resolveSettings(values) {
  const mode = pickMode(values.mode || process.env.PERF_MODE);
  const defaults = MODE_DEFAULTS[mode];
  const concurrencyOverride = values.concurrency ?? process.env.PERF_CONCURRENCY;
  const durationOverride = values.durationSeconds ?? process.env.PERF_DURATION_SECONDS;
  const iterationsOverride = values.iterations ?? process.env.PERF_ITERATIONS;
  const warmupOverride = values.warmupIterations ?? process.env.PERF_WARMUP_ITERATIONS;
  const datasetSize = String(
    values.datasetSize || process.env.PERF_DATASET_SIZE || process.env.PERF_PROFILE || "high"
  ).toLowerCase();
  const runId = sanitizeRunId(values.runId || process.env.PERF_RUN_ID || "");
  const outputJson = resolveOutputJson(values.outputJson ?? process.env.PERF_OUTPUT_JSON);

  return {
    mode,
    runId,
    datasetSize,
    concurrency: parseNumber(concurrencyOverride, defaults.concurrency || 1),
    durationSeconds: parseNumber(durationOverride, defaults.durationSeconds || 0),
    iterations: parseNumber(iterationsOverride, defaults.iterations || 0),
    warmupIterations: parseNumber(warmupOverride, defaults.warmupIterations || 0),
    outputJson
  };
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function printSummary(rows) {
  console.log("");
  console.log("Performance summary:");
  console.log("| endpoint | count | success p95 ms | all p95 ms | rps | success | error | error rate |");
  console.log("|---|---:|---:|---:|---:|---:|---:|---:|");
  for (const row of rows) {
    console.log(
      `| ${row.name} | ${row.count} | ${row.successP95.toFixed(1)} | ${row.p95.toFixed(1)} | ${row.requestsPerSecond.toFixed(2)} | ${row.successCount} | ${row.errorCount} | ${formatPercent(row.errorRate)}${row.firstError ? ` (${row.firstError})` : ""} |`
    );
  }
}

function evaluateBudgets(rows, overall) {
  const violations = [];

  for (const row of rows) {
    if (row.budgetP95Ms && row.p95 > row.budgetP95Ms) {
      violations.push(`${row.name} p95 ${row.p95.toFixed(1)}ms exceeded budget ${row.budgetP95Ms}ms`);
    }
  }

  if (overall.errorRate > 0.005) {
    violations.push(`overall error rate ${formatPercent(overall.errorRate)} exceeded 0.50%`);
  }

  return violations;
}

async function writeReport(reportPath, report) {
  if (!reportPath) return;
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function main() {
  const values = parseCliArgs();
  if (values.help) {
    console.log(
      [
        "Usage: node scripts/perf-measure.js [--mode=baseline|normal|peak|spike|soak]",
        "                                     [--concurrency=N]",
        "                                     [--durationSeconds=N]",
        "                                     [--iterations=N]",
        "                                     [--warmupIterations=N]",
        "                                     [--datasetSize=high|strong]",
        "                                     [--outputJson=path]",
        "                                     [--runId=RUN_ID]"
      ].join("\n")
    );
    return;
  }

  const settings = resolveSettings(values);
  if (!settings.runId) {
    throw new Error("PERF_RUN_ID is required for perf measurement.");
  }

  if (
    settings.datasetSize === "strong" &&
    isLocalDatabaseUrl(process.env.DATABASE_URL) &&
    process.env.PERF_ALLOW_STRONG_LOCAL_DB !== "1"
  ) {
    throw new Error(
      "Strong performance seeding must run on a separate perf/staging database, not the local development database."
    );
  }

  const licenseCode = process.env.SOM_E2E_LICENSE_CODE || "";
  const modeSettings = MODE_DEFAULTS[settings.mode];
  const phases = buildModePhases(settings.mode, {
    ...modeSettings,
    concurrency: settings.concurrency,
    durationSeconds: settings.durationSeconds,
    iterations: settings.iterations,
    warmupIterations: settings.warmupIterations
  });

  trace("perf measure started", {
    mode: settings.mode,
    datasetSize: settings.datasetSize,
    concurrency: settings.concurrency,
    durationSeconds: settings.durationSeconds,
    iterations: settings.iterations,
    warmupIterations: settings.warmupIterations,
    outputJson: settings.outputJson || ""
  });

  const admin = await loginAdmin(DEFAULT_API_URL, settings.runId, licenseCode);
  const fixture = await loadFixture(DEFAULT_API_URL, admin.headers, settings.runId);
  const endpointCollectors = new Map(
    ENDPOINTS.map((item) => [item.name, createEndpointSummary(item.name, item.budgetP95Ms)])
  );
  const context = createOperationsContext({
    apiUrl: DEFAULT_API_URL,
    headers: admin.headers,
    fixture,
    runId: settings.runId,
    endpointCollectors
  });
  const stageResults = [];
  let warmupErrors = 0;
  let runtimeSampler;
  let overallStartedAt = 0;

  try {
    await runPerfPreflight(context);
    trace("warmup started", { iterations: settings.warmupIterations });
    warmupErrors += (await runWarmup(ENDPOINTS, context, settings.warmupIterations, settings.mode)).errors;
    trace("warmup completed", { errors: warmupErrors });

    runtimeSampler = createRuntimeSampler(5000);
    overallStartedAt = performance.now();

    const classWarmup = await httpRequest(`${DEFAULT_API_URL}/api/classes`, {
      headers: admin.headers,
      timeoutMs: 20_000
    });
    if (!classWarmup.ok) {
      throw new Error(`Load preflight classes warmup failed with status ${classWarmup.status}`);
    }

    for (const phase of phases) {
      trace("official phase started", phase);
      const phaseCollector = {
        requests: 0,
        successCount: 0,
        errorCount: 0,
        errors: []
      };

      if (phase.iterations && phase.iterations > 0) {
        await runIterationPhase(ENDPOINTS, context, phase.iterations, phase.concurrency, phase.label, phaseCollector);
      } else {
        await runDurationPhase(
          ENDPOINTS,
          context,
          phase.durationSeconds,
          phase.concurrency,
          phase.label,
          phaseCollector
        );
      }

      stageResults.push({
        ...phase,
        requests: phaseCollector.requests,
        successCount: phaseCollector.successCount,
        errorCount: phaseCollector.errorCount,
        errorRate: phaseCollector.requests ? phaseCollector.errorCount / phaseCollector.requests : 0
      });

      trace("official phase completed", {
        label: phase.label,
        requests: phaseCollector.requests,
        errors: phaseCollector.errorCount
      });
    }
  } finally {
    runtimeSampler?.stop();
  }

  const durationMs = Math.max(1, performance.now() - overallStartedAt);
  const endpointRows = ENDPOINTS.map((endpoint) => {
    const summary = endpointCollectors.get(endpoint.name);
    return summarizeEndpoint(summary, durationMs);
  });

  let successCount = 0;
  let errorCount = 0;
  for (const row of endpointRows) {
    successCount += row.successCount;
    errorCount += row.errorCount;
  }
  const overall = {
    count: successCount + errorCount,
    successCount,
    errorCount,
    errorRate: successCount + errorCount ? errorCount / (successCount + errorCount) : 0,
    requestsPerSecond: ((successCount + errorCount) / durationMs) * 1000
  };

  const overallErrorBuckets = createErrorBuckets();
  for (const row of endpointRows) {
    for (const [bucket, count] of Object.entries(row.errorBuckets || {})) {
      overallErrorBuckets[bucket] = (overallErrorBuckets[bucket] || 0) + count;
    }
  }
  overall.errorBuckets = overallErrorBuckets;

  const violations = evaluateBudgets(endpointRows, overall);
  const report = {
    generatedAt: nowIso(),
    runId: settings.runId,
    mode: settings.mode,
    datasetSize: settings.datasetSize,
    config: {
      concurrency: settings.concurrency,
      durationSeconds: settings.durationSeconds,
      iterations: settings.iterations,
      warmupIterations: settings.warmupIterations,
      phases
    },
    fixture: {
      schoolId: `perf-${settings.runId}`,
      classId: fixture.firstClass.id,
      studentId: fixture.firstStudent.id
    },
    overall,
    endpointRows,
    warmup: {
      iterations: settings.warmupIterations,
      errors: warmupErrors
    },
    runtimeSamples: runtimeSampler.samples,
    stages: stageResults,
    violations
  };

  if (settings.outputJson) {
    await writeReport(settings.outputJson, report);
    trace("perf JSON report written", { path: settings.outputJson });
  }

  printSummary(endpointRows);
  console.log("");
  console.log(`runtime samples captured: ${runtimeSampler.samples.length}`);
  console.log(`overall requests: ${overall.count}`);
  console.log(`overall error rate: ${formatPercent(overall.errorRate)}`);

  if (violations.length) {
    console.error("");
    console.error("Performance budget violations:");
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    throw new Error("Performance budgets were exceeded.");
  }

  trace("perf measure completed", {
    requests: overall.count,
    durationMs: Math.round(durationMs)
  });
}

main()
  .catch((failure) => {
    console.error(failure instanceof Error ? failure.stack || failure.message : failure);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
