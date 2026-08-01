require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const { parseArgs } = require("node:util");

const prisma = new PrismaClient();

const DEFAULT_REPORT_JSON = path.join(__dirname, "..", "tests", "perf", "artifacts", "perf-report.json");
const DEFAULT_ANALYSIS_JSON = path.join(__dirname, "..", "tests", "perf", "artifacts", "perf-analysis.json");
const DEFAULT_ANALYSIS_MD = path.join(__dirname, "..", "tests", "perf", "artifacts", "perf-analysis.md");

function trace(message, details) {
  if (details === undefined) {
    console.log(`[${new Date().toISOString()}] ${message}`);
    return;
  }
  console.log(`[${new Date().toISOString()}] ${message}`, details);
}

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      inputJson: { type: "string" },
      outputJson: { type: "string" },
      outputMd: { type: "string" },
      top: { type: "string" },
      explain: { type: "boolean" },
      help: { type: "boolean", short: "h" }
    }
  });

  return values;
}

function readJson(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return JSON.parse(content);
}

function writeFile(filePath, content) {
  if (!filePath) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sortEndpoints(rows) {
  return [...rows].sort((left, right) => {
    const p95Delta = (right.p95 || 0) - (left.p95 || 0);
    if (p95Delta !== 0) return p95Delta;
    const errorDelta = (right.errorRate || 0) - (left.errorRate || 0);
    if (errorDelta !== 0) return errorDelta;
    return (right.count || 0) - (left.count || 0);
  });
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function summarizeRows(rows) {
  return rows.map((row) => ({
    name: row.name,
    count: row.count,
    min: row.min,
    average: row.average,
    p50: row.p50,
    p90: row.p90,
    p95: row.p95,
    p99: row.p99,
    max: row.max,
    requestsPerSecond: row.requestsPerSecond,
    successCount: row.successCount,
    errorCount: row.errorCount,
    errorRate: row.errorRate,
    successMin: row.successMin,
    successAverage: row.successAverage,
    successP50: row.successP50,
    successP90: row.successP90,
    successP95: row.successP95,
    successP99: row.successP99,
    successMax: row.successMax,
    budgetP95Ms: row.budgetP95Ms,
    firstError: row.firstError || "",
    errorBuckets: row.errorBuckets || {}
  }));
}

async function explainQuery(name, report) {
  const schoolId = report.fixture?.schoolId;
  const classId = report.fixture?.classId;
  const studentId = report.fixture?.studentId;
  const todayIso = report.fixture?.todayIso || new Date().toISOString().slice(0, 10);
  const requestedBy = report.fixture?.studentId || null;

  const explainers = {
    classes: () => prisma.$queryRaw`
      EXPLAIN (FORMAT TEXT)
      SELECT id, name, "gradeLevel", status, grade, section, "maxStudents"
      FROM "SchoolClass"
      WHERE "schoolId" = ${schoolId}
      ORDER BY name ASC
    `,
    teachers: () => prisma.$queryRaw`
      EXPLAIN (FORMAT TEXT)
      SELECT id, name, "employeeNumber", status, "adminRole", "employmentRatio"
      FROM "Teacher"
      WHERE "schoolId" = ${schoolId}
      ORDER BY name ASC
    `,
    "students by class": () => prisma.$queryRaw`
      EXPLAIN (FORMAT TEXT)
      SELECT id, name, "classId", status
      FROM "Student"
      WHERE "schoolId" = ${schoolId} AND "classId" = ${classId}
      ORDER BY name ASC
    `,
    "daily schedule": () => prisma.$queryRaw`
      EXPLAIN (FORMAT TEXT)
      SELECT id, "schoolId", date, day
      FROM "DailySchedule"
      WHERE "schoolId" = ${schoolId} AND date = ${todayIso}
    `,
    "certificate read": () => prisma.$queryRaw`
      EXPLAIN (FORMAT TEXT)
      SELECT id, "schoolId", "studentId", "certificateType", "academicYear"
      FROM "StudentCertificate"
      WHERE "schoolId" = ${schoolId} AND "studentId" = ${studentId}
      ORDER BY "updatedAt" DESC
    `,
    "certificate save": () => prisma.$queryRaw`
      EXPLAIN (FORMAT TEXT)
      INSERT INTO "StudentCertificate" (
        "schoolId",
        "studentId",
        "certificateType",
        "academicYear",
        "issueDate",
        "presentDays",
        "absentDays",
        "lateDays",
        "earlyExitDays",
        "behaviorLevel",
        "behaviorNote",
        "teacherNotes",
        "adminNotes",
        "teacherSignature",
        "principalSignature",
        average,
        grade,
        result,
        approved,
        published,
        "subjectRows"
      ) VALUES (
        ${schoolId},
        ${studentId},
        'TERM1_BIMONTHLY',
        '2026',
        ${todayIso},
        10,
        1,
        1,
        0,
        'GOOD',
        'perf-analysis',
        'perf-analysis',
        'perf-analysis',
        'Teacher',
        'Principal',
        91,
        'A',
        'PASS',
        true,
        false,
        ${JSON.stringify([])}::jsonb
      )
      ON CONFLICT ("schoolId", "studentId", "certificateType", "academicYear")
      DO UPDATE SET "updatedAt" = CURRENT_TIMESTAMP
    `,
    "report export event": () => prisma.$queryRaw`
      EXPLAIN (FORMAT TEXT)
      INSERT INTO "reports_exports" (
        "school_id",
        "report_type",
        "file_type",
        "file_path",
        "requested_by",
        status,
        expires_at
      ) VALUES (
        ${schoolId},
        'perf-analysis',
        'PDF',
        ${`reports/perf-analysis/${schoolId}.pdf`},
        ${requestedBy},
        'REQUESTED',
        NOW() + INTERVAL '15 minutes'
      )
    `
  };

  const explain = explainers[name];
  if (!explain) {
    return {
      name,
      available: false,
      reason: "No representative database query is available for this endpoint."
    };
  }

  try {
    const rows = await explain();
    return {
      name,
      available: true,
      plan: rows.map((row) => Object.values(row)[0]).map((value) => String(value)),
      sqlClass: "representative"
    };
  } catch (error) {
    return {
      name,
      available: false,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}

async function main() {
  const values = parseCliArgs();
  if (values.help) {
    console.log(
      [
        "Usage: node scripts/perf-analyze.js [--inputJson=path] [--outputJson=path] [--outputMd=path] [--top=N] [--explain]",
        "Defaults:",
        `  inputJson: ${DEFAULT_REPORT_JSON}`,
        `  outputJson: ${DEFAULT_ANALYSIS_JSON}`,
        `  outputMd: ${DEFAULT_ANALYSIS_MD}`
      ].join("\n")
    );
    return;
  }

  const inputJson = values.inputJson || process.env.PERF_REPORT_JSON || DEFAULT_REPORT_JSON;
  const outputJson = values.outputJson || process.env.PERF_ANALYSIS_OUTPUT_JSON || DEFAULT_ANALYSIS_JSON;
  const outputMd = values.outputMd || process.env.PERF_ANALYSIS_OUTPUT_MD || DEFAULT_ANALYSIS_MD;
  const top = parseNumber(values.top || process.env.PERF_ANALYSIS_TOP, 3);
  const shouldExplain = values.explain || process.env.PERF_EXPLAIN === "1";

  if (!fs.existsSync(inputJson)) {
    throw new Error(`Performance report not found: ${inputJson}`);
  }

  const report = readJson(inputJson);
  const endpointRows = Array.isArray(report.endpointRows) ? report.endpointRows : [];
  const ranked = sortEndpoints(endpointRows);
  const slowestEndpoints = ranked.slice(0, top);
  const troubledEndpoints = ranked.filter((row) => {
    const p95Budget = Number(row.budgetP95Ms || 0);
    return (p95Budget > 0 && Number(row.p95 || 0) > p95Budget) || Number(row.errorRate || 0) > 0.005;
  });
  const explainTargets = (troubledEndpoints.length ? troubledEndpoints : slowestEndpoints).slice(0, top);

  trace("perf analysis started", {
    inputJson,
    top,
    explain: shouldExplain,
    slowestEndpoints: slowestEndpoints.map((item) => item.name)
  });

  const explainPlans = [];
  if (shouldExplain) {
    for (const endpoint of explainTargets) {
      explainPlans.push({
        endpoint: endpoint.name,
        p95: endpoint.p95,
        budgetP95Ms: endpoint.budgetP95Ms,
        errorRate: endpoint.errorRate,
        plan: await explainQuery(endpoint.name, report)
      });
    }
  }

  const analysis = {
    generatedAt: new Date().toISOString(),
    reportPath: inputJson,
    mode: report.mode || null,
    datasetSize: report.datasetSize || null,
    runId: report.runId || null,
    slowestEndpoints: summarizeRows(slowestEndpoints),
    troubledEndpoints: summarizeRows(troubledEndpoints),
    explainPlans,
    notes: [
      "Endpoints are ranked by p95 first, then error rate, then count.",
      "EXPLAIN is only available for endpoints with a representative database query.",
      "Read-only endpoints without a DB query are marked as not applicable."
    ]
  };

  writeFile(outputJson, `${JSON.stringify(analysis, null, 2)}\n`);

  const markdownLines = [];
  markdownLines.push("# Performance Analysis");
  markdownLines.push("");
  markdownLines.push(`- Input report: \`${inputJson}\``);
  markdownLines.push(`- Mode: \`${analysis.mode || "unknown"}\``);
  markdownLines.push(`- Dataset size: \`${analysis.datasetSize || "unknown"}\``);
  markdownLines.push("");
  markdownLines.push("## Slowest Endpoints");
  markdownLines.push("");
  markdownLines.push("| Endpoint | Count | Success p95 ms | All p95 ms | Budget p95 ms | Error rate |");
  markdownLines.push("|---|---:|---:|---:|---:|---:|");
  for (const row of analysis.slowestEndpoints) {
    markdownLines.push(
      `| ${row.name} | ${row.count} | ${row.successP95.toFixed(1)} | ${row.p95.toFixed(1)} | ${row.budgetP95Ms ?? "-"} | ${formatPercent(row.errorRate)} |`
    );
  }
  markdownLines.push("");
  markdownLines.push("## Budget Violations");
  markdownLines.push("");
  if (!analysis.troubledEndpoints.length) {
    markdownLines.push("No budget violations were detected in the current report.");
  } else {
    for (const row of analysis.troubledEndpoints) {
      markdownLines.push(
        `- ${row.name}: p95=${row.p95.toFixed(1)}ms, budget=${row.budgetP95Ms ?? "n/a"}ms, errors=${formatPercent(row.errorRate)}`
      );
    }
  }
  markdownLines.push("");
  markdownLines.push("## Explain Plans");
  markdownLines.push("");
  if (!analysis.explainPlans.length) {
    markdownLines.push("EXPLAIN was not requested.");
  } else {
    for (const entry of analysis.explainPlans) {
      markdownLines.push(`### ${entry.endpoint}`);
      markdownLines.push("");
      if (!entry.plan.available) {
        markdownLines.push(`- EXPLAIN unavailable: ${entry.plan.reason}`);
      } else {
        for (const line of entry.plan.plan) {
          markdownLines.push(`  ${line}`);
        }
      }
      markdownLines.push("");
    }
  }

  writeFile(outputMd, `${markdownLines.join("\n")}\n`);
  trace("perf analysis completed", {
    slowestEndpoints: analysis.slowestEndpoints.map((item) => item.name),
    troubledEndpoints: analysis.troubledEndpoints.map((item) => item.name),
    outputJson,
    outputMd
  });
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
