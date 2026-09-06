const dns = require("node:dns/promises");
const fs = require("node:fs");
const path = require("node:path");
const { error, success, warn } = require("../cli-output");

const root = path.resolve(__dirname, "..", "..");
const reportDir = path.join(root, "reports", "security");
const jsonReportPath = path.join(reportDir, "production-external-evidence.json");
const markdownReportPath = path.join(reportDir, "production-external-evidence.md");

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url;
  } catch {
    return null;
  }
}

function hasPlaceholder(value) {
  return /CHANGE_ME|your-domain|example\.invalid|localhost|127\.0\.0\.1|placeholder/i.test(String(value || ""));
}

function targetUrl() {
  return normalizeUrl(process.env.PRODUCTION_URL || process.env.STAGING_URL || process.env.SOM_PRO_APP_URL || "");
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.PRODUCTION_EVIDENCE_TIMEOUT_MS || 10_000));
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function record(ok, message, evidence = {}) {
  return { status: ok ? "passed" : "failed", message, evidence };
}

function pending(message, evidence = {}) {
  return { status: "pending", message, evidence };
}

async function checkDns(url) {
  try {
    const [addresses, cname] = await Promise.all([
      dns.lookup(url.hostname, { all: true }).catch((failure) => ({ error: failure.message })),
      dns.resolveCname(url.hostname).catch((failure) => ({ error: failure.message }))
    ]);
    const resolved = {
      hostname: url.hostname,
      addresses: Array.isArray(addresses) ? addresses.map((item) => item.address) : [],
      cname: Array.isArray(cname) ? cname : [],
      lookupError: addresses.error || null,
      cnameError: cname.error || null
    };
    return record(Boolean(resolved.addresses.length || resolved.cname.length), "DNS resolution completed", resolved);
  } catch (failure) {
    return record(false, "DNS resolution failed", { hostname: url.hostname, error: failure.message });
  }
}

async function checkHttps(url) {
  const httpUrl = new URL(url.toString());
  httpUrl.protocol = "http:";
  const redirect = await fetchWithTimeout(httpUrl.toString(), { method: "GET", redirect: "manual" });
  const https = await fetchWithTimeout(url.toString(), { method: "GET", redirect: "follow" });
  const hsts = https.headers.get("strict-transport-security") || "";
  const evidence = {
    target: url.origin,
    httpRedirect: {
      url: httpUrl.toString(),
      status: redirect.status,
      location: redirect.headers.get("location") || ""
    },
    https: {
      status: https.status,
      hsts,
      nosniff: https.headers.get("x-content-type-options") || "",
      frameOptions: https.headers.get("x-frame-options") || ""
    }
  };
  const redirectOk =
    [301, 302, 307, 308].includes(evidence.httpRedirect.status) &&
    evidence.httpRedirect.location.startsWith(url.origin);
  const httpsOk = https.ok && /max-age=31536000/i.test(hsts);
  return record(redirectOk && httpsOk, "HTTPS, redirect, and HSTS checks completed", evidence);
}

async function checkHealth(url) {
  const candidates = ["/healthz", "/health", "/api/version"];
  const attempts = [];
  for (const pathname of candidates) {
    const healthUrl = new URL(pathname, url);
    const response = await fetchWithTimeout(healthUrl.toString(), { method: "GET", redirect: "follow" }).catch(
      (failure) => ({ ok: false, status: 0, error: failure.message, headers: new Headers() })
    );
    attempts.push({
      url: healthUrl.toString(),
      status: response.status,
      ok: Boolean(response.ok),
      error: response.error || null
    });
    if (response.ok) {
      return record(true, "Production health endpoint is reachable", { attempts });
    }
  }
  return record(false, "No production health endpoint was reachable", { attempts });
}

async function checkCloudflare(url) {
  const requireCloudflare = String(process.env.PRODUCTION_EXPECT_CLOUDFLARE || "true").toLowerCase() !== "false";
  const response = await fetchWithTimeout(url.toString(), { method: "GET", redirect: "follow" });
  const evidence = {
    server: response.headers.get("server") || "",
    cfRay: response.headers.get("cf-ray") || "",
    cfCacheStatus: response.headers.get("cf-cache-status") || "",
    nel: response.headers.get("nel") || "",
    reportTo: response.headers.get("report-to") || ""
  };
  const detected = /cloudflare/i.test(evidence.server) || Boolean(evidence.cfRay);
  if (!requireCloudflare && !detected) return pending("Cloudflare edge headers were not required", evidence);
  return record(detected, "Cloudflare edge headers detected", evidence);
}

function checkDatabaseEvidence() {
  const reportPath = path.join(root, "docs", "test-reports", "database-verification-latest.md");
  if (!fs.existsSync(reportPath)) return record(false, "Database verification report is missing");
  const report = fs.readFileSync(reportPath, "utf8");
  return record(
    /Overall status: PASS/.test(report) && /skipped 0/.test(report),
    "Database verification evidence is closed locally",
    { report: path.relative(root, reportPath).replace(/\\/g, "/") }
  );
}

function writeReports(report) {
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`);
  const lines = [
    "# Production External Evidence",
    "",
    `Generated at: ${report.generatedAt}`,
    `Target: ${report.target}`,
    "",
    "| Check | Status | Message |",
    "| --- | --- | --- |"
  ];
  for (const [name, check] of Object.entries(report.checks)) {
    lines.push(`| ${name} | ${check.status} | ${String(check.message).replace(/\|/g, "/")} |`);
  }
  lines.push("", `JSON artifact: \`${path.relative(root, jsonReportPath).replace(/\\/g, "/")}\``);
  fs.writeFileSync(markdownReportPath, `${lines.join("\n")}\n`);
}

async function main() {
  const url = targetUrl();
  if (!url || url.protocol !== "https:" || hasPlaceholder(url.hostname)) {
    throw new Error("Set PRODUCTION_URL to a real HTTPS Cloudflare hostname before running this check.");
  }

  const checks = {
    dns: await checkDns(url),
    https: await checkHttps(url),
    health: await checkHealth(url),
    cloudflare: await checkCloudflare(url),
    databaseEvidence: checkDatabaseEvidence()
  };
  const report = { generatedAt: new Date().toISOString(), target: url.origin, checks };
  writeReports(report);

  const failures = Object.entries(checks).filter(([, check]) => check.status === "failed");
  if (failures.length) {
    for (const [name, check] of failures) error(`production evidence ${name}: ${check.message}`);
    error("Production external evidence failed:", path.relative(root, jsonReportPath));
    process.exit(1);
  }

  const pendingChecks = Object.entries(checks).filter(([, check]) => check.status === "pending");
  if (pendingChecks.length) warn("Production external evidence has pending checks:", pendingChecks.map(([n]) => n).join(", "));
  success("Production external evidence written:", path.relative(root, jsonReportPath));
  success("Production external evidence markdown written:", path.relative(root, markdownReportPath));
}

main().catch((failure) => {
  error(failure.message);
  process.exit(1);
});
