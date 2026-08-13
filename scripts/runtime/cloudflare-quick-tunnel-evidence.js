#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { error, success } = require("../cli-output");

const root = path.resolve(__dirname, "..", "..");
const reportDir = path.resolve(process.env.SOM_QUICK_TUNNEL_REPORT_DIR || path.join(root, "reports", "security"));
const jsonReportPath = path.join(reportDir, "cloudflare-quick-tunnel-trial.json");
const markdownReportPath = path.join(reportDir, "cloudflare-quick-tunnel-trial.md");
const rawUrl = process.env.SOM_QUICK_TUNNEL_URL || process.env.STAGING_QUICK_TUNNEL_URL || "";

function parseQuickTunnelUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("SOM_QUICK_TUNNEL_URL must be a valid https://*.trycloudflare.com URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("Quick Tunnel evidence URL must use https://");
  }
  if (!/\.trycloudflare\.com$/i.test(url.hostname)) {
    throw new Error("Quick Tunnel evidence only accepts temporary *.trycloudflare.com demo URLs");
  }
  return url;
}

async function fetchProbe(url, options = {}) {
  const controller = new AbortController();
  const startedAt = Date.now();
  const timer = setTimeout(() => controller.abort(), Number(process.env.SOM_QUICK_TUNNEL_TIMEOUT_MS || 15_000));
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, redirect: "follow" });
    const text = await response.text();
    return {
      url,
      status: response.status,
      ok: response.ok,
      elapsedMs: Date.now() - startedAt,
      contentType: response.headers.get("content-type") || "",
      bodyBytes: Buffer.byteLength(text),
      title: (text.match(/<title>(.*?)<\/title>/i) || [null, null])[1],
      version: safeVersion(text)
    };
  } finally {
    clearTimeout(timer);
  }
}

function safeVersion(text) {
  try {
    const parsed = JSON.parse(text);
    return parsed && parsed.data ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeReports(report) {
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`);

  const lines = [
    "# Cloudflare Quick Tunnel Trial Evidence",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "This is temporary external reachability proof only. It is not final Ministry staging evidence.",
    "",
    `Tunnel URL: \`${report.tunnel.origin}\``,
    "",
    "| Probe | Status | OK | Elapsed ms | Detail |",
    "| --- | --- | --- | --- | --- |",
    `| Frontend / | ${report.probes.frontend.status} | ${report.probes.frontend.ok ? "yes" : "no"} | ${report.probes.frontend.elapsedMs} | ${report.probes.frontend.title || report.probes.frontend.contentType} |`,
    `| API /api/version | ${report.probes.apiVersion.status} | ${report.probes.apiVersion.ok ? "yes" : "no"} | ${report.probes.apiVersion.elapsedMs} | ${report.probes.apiVersion.version ? report.probes.apiVersion.version.version : report.probes.apiVersion.contentType} |`,
    "",
    "For Ministry/strict staging submission, use a stable Named Tunnel or VPS hostname and run strict evidence gates."
  ];
  fs.writeFileSync(markdownReportPath, `${lines.join("\n")}\n`);
}

async function main() {
  const url = parseQuickTunnelUrl(rawUrl);
  const frontendUrl = new URL("/", url).toString();
  const apiVersionUrl = new URL("/api/version", url).toString();

  const [frontend, apiVersion] = await Promise.all([
    fetchProbe(frontendUrl, { method: "GET" }),
    fetchProbe(apiVersionUrl, { method: "GET", headers: { accept: "application/json" } })
  ]);

  const report = {
    generatedAt: new Date().toISOString(),
    classification: "temporary-external-reachability-proof",
    ministrySubmissionEvidence: false,
    tunnel: {
      origin: url.origin,
      hostname: url.hostname,
      provider: "cloudflare-quick-tunnel",
      stableHostname: false
    },
    probes: { frontend, apiVersion },
    summary: {
      passed: frontend.ok && apiVersion.ok && Boolean(apiVersion.version),
      warning: "Quick Tunnel URLs are temporary and must not be used for strict Ministry submission."
    }
  };

  writeReports(report);

  if (!report.summary.passed) {
    error("Cloudflare Quick Tunnel trial evidence failed:", path.relative(root, jsonReportPath));
    process.exit(1);
  }

  success("Cloudflare Quick Tunnel trial evidence written:", path.relative(root, jsonReportPath));
  success("Cloudflare Quick Tunnel trial evidence markdown written:", path.relative(root, markdownReportPath));
}

main().catch((failure) => {
  error(failure.stack || failure.message);
  process.exit(1);
});
