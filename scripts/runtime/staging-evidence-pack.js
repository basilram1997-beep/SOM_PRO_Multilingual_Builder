const fs = require("node:fs");
const path = require("node:path");
const { error, success, warn } = require("../cli-output");

const root = path.resolve(__dirname, "..", "..");
const reportDir = path.join(root, "reports", "security");
const jsonReportPath = path.join(reportDir, "staging-evidence-pack.json");
const markdownReportPath = path.join(reportDir, "staging-evidence-pack.md");
const strict = process.argv.includes("--strict") || process.env.STAGING_EVIDENCE_STRICT === "true";
const liveDb = process.argv.includes("--live-db") || process.env.STAGING_EVIDENCE_LIVE_DB === "true";

function status(ok, message, evidence = {}) {
  return { status: ok ? "passed" : "failed", message, evidence };
}

function pending(message, evidence = {}) {
  return { status: "pending", message, evidence };
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function hasPlaceholder(value) {
  return /CHANGE_ME|your-domain|example\.invalid|localhost|127\.0\.0\.1|placeholder/i.test(String(value || ""));
}

function parseEnvFile(relativePath) {
  const envPath = path.join(root, relativePath);
  if (!fs.existsSync(envPath)) return null;
  const values = {};
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    values[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return values;
}

function safeUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function assertRealHttpsUrl(value, key) {
  const url = safeUrl(value);
  if (!url) return status(false, `${key} is not a valid URL`);
  if (url.protocol !== "https:") return status(false, `${key} must use https://`, { protocol: url.protocol });
  if (hasPlaceholder(url.hostname)) return status(false, `${key} must not be local or placeholder`, { host: url.hostname });
  if (strict && /\.trycloudflare\.com$/i.test(url.hostname)) {
    return status(false, `${key} must use a stable staging hostname in strict mode, not a temporary Quick Tunnel`, { host: url.hostname });
  }
  return status(true, `${key} is a real HTTPS URL`, { origin: url.origin });
}

function loadPrismaClient() {
  try {
    return require("@prisma/client");
  } catch {
    return require(path.join(root, "apps", "backend", "node_modules", "@prisma", "client"));
  }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function checkHttpsAndHealth() {
  const rawUrl = process.env.STAGING_URL || process.env.SOM_E2E_API_BASE_URL || "";
  if (!rawUrl) return pending("STAGING_URL is not set; live HTTPS checks were not run");
  const urlCheck = assertRealHttpsUrl(rawUrl, "STAGING_URL");
  if (urlCheck.status !== "passed") return urlCheck;
  const baseUrl = safeUrl(rawUrl);

  const httpUrl = new URL(baseUrl.toString());
  httpUrl.protocol = "http:";
  const redirect = await fetchWithTimeout(httpUrl.toString(), { method: "GET", redirect: "manual" });
  const redirectLocation = redirect.headers.get("location") || "";

  const headers = await fetchWithTimeout(baseUrl.toString(), { method: "GET", redirect: "follow" });
  const hsts = headers.headers.get("strict-transport-security") || "";

  const healthUrl = new URL("/health", baseUrl);
  const health = await fetchWithTimeout(healthUrl.toString(), { method: "GET", redirect: "follow" });
  const checks = {
    target: baseUrl.origin,
    redirect: {
      url: httpUrl.toString(),
      status: redirect.status,
      location: redirectLocation,
      ok: [301, 302, 307, 308].includes(redirect.status) && redirectLocation.startsWith(baseUrl.origin)
    },
    headers: {
      url: baseUrl.toString(),
      status: headers.status,
      hsts,
      nosniff: headers.headers.get("x-content-type-options") || "",
      frameOptions: headers.headers.get("x-frame-options") || "",
      ok: headers.ok && /max-age=31536000/i.test(hsts)
    },
    health: {
      url: healthUrl.toString(),
      status: health.status,
      ok: health.ok
    }
  };
  const failed = Object.entries(checks).filter(([, check]) => typeof check === "object" && check.ok === false);
  return failed.length ? status(false, "Live HTTPS/staging health checks failed", checks) : status(true, "Live HTTPS/staging health checks passed", checks);
}

function checkStaticDeploymentBaseline() {
  const nginx = read("deploy/nginx/sompro.conf");
  const compose = read("docker-compose.production.yml");
  const rootEnv = parseEnvFile(".env.staging.example") || {};
  const checks = {
    nginx443: /listen\s+443\s+ssl\s+http2\s+default_server;/.test(nginx),
    nginxRedirect: /return\s+301\s+https:\/\/\$host\$request_uri;/.test(nginx),
    nginxHsts: /Strict-Transport-Security\s+"max-age=31536000; includeSubDomains; preload"\s+always;/.test(nginx),
    compose443: /-\s+"443:443"/.test(compose),
    stagingRuntime: rootEnv.SOM_RUNTIME_MODE === "saas",
    operatorHealth: rootEnv.SOM_ENABLE_OPERATOR_HEALTH === "true"
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok);
  return failed.length ? status(false, "Static staging deployment baseline is incomplete", checks) : status(true, "Static staging deployment baseline is complete", checks);
}

function checkDbMigrationContract() {
  const migrationPath =
    "apps/backend/prisma/migrations/20260812143000_audit_append_only_and_lifecycle_evidence_guards/migration.sql";
  const schema = read("apps/backend/prisma/schema.prisma");
  const migration = read(migrationPath);
  const checks = {
    migrationPresent: exists(migrationPath),
    auditTriggerFunction: /CREATE OR REPLACE FUNCTION prevent_audit_log_mutation\(\)/.test(migration),
    auditUpdateTrigger: /CREATE TRIGGER "AuditLog_prevent_update"[\s\S]*BEFORE UPDATE ON "AuditLog"/.test(migration),
    auditDeleteTrigger: /CREATE TRIGGER "AuditLog_prevent_delete"[\s\S]*BEFORE DELETE ON "AuditLog"/.test(migration),
    reportExportRestrict: /reports_exports[\s\S]*ON DELETE RESTRICT ON UPDATE CASCADE/.test(migration),
    backupJobRestrict: /backup_jobs[\s\S]*ON DELETE RESTRICT ON UPDATE CASCADE/.test(migration),
    schemaReportExportRestrict: /ReportExport[\s\S]*onDelete: Restrict/.test(schema),
    schemaBackupJobRestrict: /BackupJob[\s\S]*onDelete: Restrict/.test(schema)
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok);
  return failed.length ? status(false, "DB guardrail migration contract is incomplete", checks) : status(true, "DB guardrail migration contract is present", checks);
}

async function checkLiveDbGuardrails() {
  if (!liveDb) return pending("Live DB guardrail probes were not requested; run with --live-db on staging");
  const databaseUrl = process.env.DATABASE_URL || "";
  if (!databaseUrl || hasPlaceholder(databaseUrl)) return status(false, "DATABASE_URL is missing or placeholder for live DB probes");

  const { PrismaClient } = loadPrismaClient();
  const prisma = new PrismaClient();
  const probeId = `staging-evidence-${Date.now().toString(36)}`;
  try {
    const migrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at
      FROM "_prisma_migrations"
      WHERE migration_name = '20260812143000_audit_append_only_and_lifecycle_evidence_guards'
    `;
    const triggerRows = await prisma.$queryRaw`
      SELECT trigger_name
      FROM information_schema.triggers
      WHERE event_object_table = 'AuditLog'
        AND trigger_name IN ('AuditLog_prevent_update', 'AuditLog_prevent_delete')
      ORDER BY trigger_name
    `;
    const fkRows = await prisma.$queryRaw`
      SELECT tc.constraint_name, rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_name IN ('reports_exports_school_id_fkey', 'backup_jobs_school_id_fkey')
      ORDER BY tc.constraint_name
    `;
    const auditLog = await prisma.auditLog.create({
      data: {
        schoolId: null,
        userId: null,
        action: "STAGING_EVIDENCE_DB_PROBE",
        entity: "AuditLog",
        entityId: probeId,
        after: { probeId, generatedAt: new Date().toISOString() }
      }
    });
    let updateBlocked = false;
    let deleteBlocked = false;
    try {
      await prisma.auditLog.update({ where: { id: auditLog.id }, data: { action: "STAGING_EVIDENCE_MUTATED" } });
    } catch {
      updateBlocked = true;
    }
    try {
      await prisma.auditLog.delete({ where: { id: auditLog.id } });
    } catch {
      deleteBlocked = true;
    }

    const evidence = {
      migrationApplied: migrations.length === 1,
      triggers: triggerRows.map((row) => row.trigger_name),
      restrictFks: fkRows.map((row) => ({ name: row.constraint_name, deleteRule: row.delete_rule })),
      auditMutationProbe: { id: auditLog.id, updateBlocked, deleteBlocked }
    };
    const ok =
      evidence.migrationApplied &&
      evidence.triggers.includes("AuditLog_prevent_update") &&
      evidence.triggers.includes("AuditLog_prevent_delete") &&
      evidence.restrictFks.length === 2 &&
      evidence.restrictFks.every((row) => row.deleteRule === "RESTRICT") &&
      updateBlocked &&
      deleteBlocked;
    return ok ? status(true, "Live DB guardrail probes passed", evidence) : status(false, "Live DB guardrail probes failed", evidence);
  } finally {
    await prisma.$disconnect();
  }
}

function checkBackupEncryptionEnv() {
  const actualEnv = parseEnvFile(".env.staging");
  const exampleEnv = parseEnvFile(".env.staging.example") || {};
  const source = actualEnv || exampleEnv;
  const evidence = {
    source: actualEnv ? ".env.staging" : ".env.staging.example",
    passphraseConfigured: Boolean(source.SOM_BACKUP_PASSPHRASE || source.SOM_BACKUP_PASSPHRASE_FILE),
    rpoMinutes: source.SOM_BACKUP_RPO_MINUTES || null,
    rtoMinutes: source.SOM_BACKUP_RTO_MINUTES || null,
    autoBackupIntervalHours: source.SOM_AUTO_BACKUP_INTERVAL_HOURS || null
  };
  if (actualEnv) {
    const secret = String(actualEnv.SOM_BACKUP_PASSPHRASE || actualEnv.SOM_BACKUP_PASSPHRASE_FILE || "");
    if (!secret || hasPlaceholder(secret)) return status(false, "Staging backup encryption secret is missing or placeholder", evidence);
  }
  if (!evidence.passphraseConfigured) return status(false, "Backup encryption passphrase or passphrase file is not configured", evidence);
  return status(true, "Backup encryption environment is configured without exposing secret value", evidence);
}

function artifactSummary(relativePath) {
  const full = path.join(root, relativePath);
  if (!fs.existsSync(full)) return { path: relativePath, exists: false };
  const stat = fs.statSync(full);
  return { path: relativePath, exists: true, bytes: stat.size, modifiedAt: stat.mtime.toISOString() };
}

function readJsonArtifact(relativePath) {
  try {
    return JSON.parse(read(relativePath));
  } catch (failure) {
    return { parseError: failure.message };
  }
}

function checkReleaseArtifacts() {
  const alwaysRequired = [
    "reports/security/sbom.cyclonedx.json",
    "reports/security/license-report.json",
    "reports/security/license-report.md",
    "reports/security/npm-audit.json",
    "reports/security/sast-baseline.json"
  ];
  const liveRequired = [
    "reports/security/dast-baseline.json",
    "reports/security/zap-baseline-report.html"
  ];
  const required = [...alwaysRequired, ...liveRequired];
  const optional = ["reports/security/api-route-inventory.json", "reports/security/desktop-signing-report.json"];
  const artifacts = [...required, ...optional].map(artifactSummary);
  const missingAlways = artifacts.filter((item) => alwaysRequired.includes(item.path) && !item.exists);
  const missingLive = artifacts.filter((item) => liveRequired.includes(item.path) && !item.exists);
  const dastReport = exists("reports/security/dast-baseline.json") ? readJsonArtifact("reports/security/dast-baseline.json") : null;
  const failedDast = dastReport && dastReport.status !== "passed";
  if (missingAlways.length) {
    return status(false, "Required release security artifacts are missing", {
      artifacts,
      missingRequired: missingAlways.map((item) => item.path)
    });
  }
  if (failedDast) {
    return status(false, "Live staging DAST artifact is present but not passing", {
      artifacts,
      status: dastReport.status || "unknown",
      summary: dastReport.summary || dastReport.parseError || "No DAST summary"
    });
  }
  if (missingLive.length) {
    return pending("Live staging DAST artifact is missing; run security:dast with STAGING_URL before strict handoff", {
      artifacts,
      missingLiveRequired: missingLive.map((item) => item.path)
    });
  }
  return status(true, "Release security artifacts are present", { artifacts });
}

function writeReports(report) {
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`);
  const lines = [
    "# Staging Evidence Pack",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "| Check | Status | Message |",
    "| ----- | ------ | ------- |"
  ];
  for (const [name, check] of Object.entries(report.checks)) {
    lines.push(`| ${name} | ${check.status} | ${String(check.message).replace(/\|/g, "/")} |`);
  }
  lines.push("", `JSON artifact: \`${path.relative(root, jsonReportPath).replace(/\\/g, "/")}\``);
  fs.writeFileSync(markdownReportPath, `${lines.join("\n")}\n`);
}

async function main() {
  const checks = {
    staticDeploymentBaseline: checkStaticDeploymentBaseline(),
    liveHttpsAndHealth: await checkHttpsAndHealth(),
    dbMigrationContract: checkDbMigrationContract(),
    liveDbGuardrails: await checkLiveDbGuardrails(),
    backupEncryptionEnv: checkBackupEncryptionEnv(),
    releaseSecurityArtifacts: checkReleaseArtifacts()
  };
  const report = {
    generatedAt: new Date().toISOString(),
    mode: { strict, liveDb },
    checks
  };
  writeReports(report);

  const failed = Object.entries(checks).filter(([, check]) => check.status === "failed");
  const pendingChecks = Object.entries(checks).filter(([, check]) => check.status === "pending");
  if (failed.length || (strict && pendingChecks.length)) {
    for (const [name, check] of [...failed, ...(strict ? pendingChecks : [])]) {
      error(`staging evidence ${name}: ${check.status} - ${check.message}`);
    }
    error("Staging evidence pack failed:", path.relative(root, jsonReportPath));
    process.exit(1);
  }

  if (pendingChecks.length) warn("Staging evidence pack has pending live checks:", pendingChecks.map(([name]) => name).join(", "));
  success("Staging evidence pack written:", path.relative(root, jsonReportPath));
  success("Staging evidence pack markdown written:", path.relative(root, markdownReportPath));
}

main().catch((failure) => {
  error(failure.stack || failure.message);
  process.exit(1);
});
