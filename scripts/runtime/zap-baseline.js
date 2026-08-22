const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { error, success, warn } = require("../cli-output");

const root = path.resolve(__dirname, "..", "..");
const reportDir = path.resolve(process.env.DAST_REPORT_DIR || path.join(root, "reports", "security"));
const normalizedReportPath = path.join(reportDir, "dast-baseline.json");
const rawZapJsonPath = path.join(reportDir, "dast-zap-raw.json");
const htmlReportPath = path.join(reportDir, "zap-baseline-report.html");
const target = process.env.STAGING_URL || "";

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url;
  } catch {
    return null;
  }
}

function isPlaceholderHost(hostname) {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0|example\.invalid|your-domain|CHANGE_ME|placeholder/i.test(hostname);
}

function validateTarget(rawTarget) {
  const url = normalizeUrl(rawTarget);
  if (!url) return { ok: false, reason: "STAGING_URL must be a valid URL" };
  if (url.protocol !== "https:") return { ok: false, reason: "STAGING_URL must use https://" };
  if (isPlaceholderHost(url.hostname)) {
    return { ok: false, reason: "STAGING_URL must be a real staging host, not localhost or a placeholder" };
  }
  return { ok: true, url };
}

function htmlEscape(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function writeFallbackHtml(report) {
  const rows = report.findings
    .map(
      (finding) =>
        `<tr><td>${htmlEscape(finding.risk)}</td><td>${htmlEscape(finding.name)}</td><td>${htmlEscape(finding.count)}</td></tr>`
    )
    .join("");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>SOM PRO ZAP Baseline Evidence</title>
</head>
<body>
  <h1>SOM PRO ZAP Baseline Evidence</h1>
  <p>Status: ${htmlEscape(report.status)}</p>
  <p>Target: ${htmlEscape(report.target || "not-run")}</p>
  <p>Generated: ${htmlEscape(report.generatedAt)}</p>
  <p>${htmlEscape(report.summary)}</p>
  <table>
    <thead><tr><th>Risk</th><th>Name</th><th>Count</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>
`;
  fs.writeFileSync(htmlReportPath, html);
}

function writeReport(report) {
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(normalizedReportPath, `${JSON.stringify(report, null, 2)}\n`);
  if (!fs.existsSync(htmlReportPath)) writeFallbackHtml(report);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { ...options, shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (failure) => {
      resolve({ code: null, stdout, stderr, error: failure.message });
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function runZap(baseUrl) {
  if (process.env.ZAP_USE_DOCKER === "true") {
    const args = [
      "run",
      "--rm",
      "-v",
      `${reportDir}:/zap/wrk/:rw`,
      process.env.ZAP_DOCKER_IMAGE || "ghcr.io/zaproxy/zaproxy:stable",
      "zap-baseline.py",
      "-t",
      baseUrl.toString(),
      "-J",
      "dast-zap-raw.json",
      "-r",
      "zap-baseline-report.html"
    ];
    return runCommand("docker", args);
  }

  const command = process.env.ZAP_BASELINE_COMMAND || "zap-baseline.py";
  const args = ["-t", baseUrl.toString(), "-J", rawZapJsonPath, "-r", htmlReportPath];
  return runCommand(command, args);
}

function parseZapAlerts() {
  if (!fs.existsSync(rawZapJsonPath)) return [];
  const raw = JSON.parse(fs.readFileSync(rawZapJsonPath, "utf8"));
  const sites = Array.isArray(raw.site) ? raw.site : [];
  return sites.flatMap((site) => {
    const alerts = Array.isArray(site.alerts) ? site.alerts : [];
    return alerts.map((alert) => ({
      name: alert.name || alert.alert || "Unnamed ZAP alert",
      risk: alert.riskdesc || alert.risk || "Unknown",
      riskCode: Number(alert.riskcode ?? alert.riskCode ?? -1),
      count: Number(alert.count ?? alert.instances?.length ?? 0),
      confidence: alert.confidence || alert.confidencedesc || "Unknown"
    }));
  });
}

async function main() {
  const targetCheck = validateTarget(target);
  if (!targetCheck.ok) {
    const report = {
      generatedAt: new Date().toISOString(),
      status: "failed",
      target: null,
      summary: targetCheck.reason,
      scanner: "OWASP ZAP baseline",
      findings: []
    };
    writeReport(report);
    error(targetCheck.reason);
    process.exit(1);
  }

  const zapResult = await runZap(targetCheck.url);
  if (zapResult.error) {
    const report = {
      generatedAt: new Date().toISOString(),
      status: "failed",
      target: targetCheck.url.origin,
      summary: `OWASP ZAP baseline command failed to start: ${zapResult.error}`,
      scanner: process.env.ZAP_USE_DOCKER === "true" ? "OWASP ZAP Docker baseline" : "OWASP ZAP baseline",
      command:
        process.env.ZAP_USE_DOCKER === "true"
          ? "docker run ghcr.io/zaproxy/zaproxy:stable zap-baseline.py"
          : process.env.ZAP_BASELINE_COMMAND || "zap-baseline.py",
      findings: []
    };
    writeReport(report);
    error(report.summary);
    process.exit(1);
  }

  const findings = parseZapAlerts();
  const highOrCritical = findings.filter((finding) => finding.riskCode >= 3 || /high|critical/i.test(finding.risk));
  const medium = findings.filter((finding) => finding.riskCode === 2 || /medium/i.test(finding.risk));
  const passed = [0, 2].includes(zapResult.code) && highOrCritical.length === 0;
  const report = {
    generatedAt: new Date().toISOString(),
    status: passed ? "passed" : "failed",
    target: targetCheck.url.origin,
    summary: passed
      ? "OWASP ZAP baseline completed without high or critical findings"
      : "OWASP ZAP baseline failed or reported high/critical findings",
    scanner: process.env.ZAP_USE_DOCKER === "true" ? "OWASP ZAP Docker baseline" : "OWASP ZAP baseline",
    zapExitCode: zapResult.code,
    thresholds: {
      failOnHighOrCritical: true,
      mediumFindingsRequireReview: true
    },
    findingCounts: {
      total: findings.length,
      medium: medium.length,
      highOrCritical: highOrCritical.length
    },
    findings,
    artifacts: {
      json: path.relative(root, normalizedReportPath).replace(/\\/g, "/"),
      zapJson: path.relative(root, rawZapJsonPath).replace(/\\/g, "/"),
      html: path.relative(root, htmlReportPath).replace(/\\/g, "/")
    }
  };
  writeReport(report);

  if (medium.length) warn(`ZAP reported ${medium.length} medium finding(s); review before release.`);
  if (!passed) {
    error(report.summary);
    process.exit(1);
  }
  success("OWASP ZAP baseline passed:", report.artifacts.json, report.artifacts.html);
}

main().catch((failure) => {
  const report = {
    generatedAt: new Date().toISOString(),
    status: "failed",
    target: null,
    summary: failure.message,
    scanner: "OWASP ZAP baseline",
    findings: []
  };
  writeReport(report);
  error(failure.message);
  process.exit(1);
});
