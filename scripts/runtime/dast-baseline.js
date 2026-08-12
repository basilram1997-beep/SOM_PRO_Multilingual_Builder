const fs = require("node:fs");
const path = require("node:path");
const { error, success } = require("../cli-output");

const root = path.resolve(__dirname, "..", "..");
const reportDir = path.join(root, "reports", "security");
const reportPath = path.join(reportDir, "dast-baseline.json");

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url;
  } catch {
    return null;
  }
}

function assertRealHttpsUrl(url) {
  if (!url) throw new Error("STAGING_URL must be a valid URL");
  if (url.protocol !== "https:") throw new Error("STAGING_URL must use https://");
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0|example\.invalid|your-domain|CHANGE_ME|placeholder/i.test(url.hostname)) {
    throw new Error("STAGING_URL must be a real staging host, not localhost or a placeholder");
  }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      ...options,
      redirect: options.redirect || "manual",
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function checkRedirect(baseUrl) {
  const httpUrl = new URL(baseUrl.toString());
  httpUrl.protocol = "http:";
  const response = await fetchWithTimeout(httpUrl.toString(), { method: "GET" });
  const location = response.headers.get("location") || "";
  return {
    url: httpUrl.toString(),
    status: response.status,
    location,
    ok: [301, 302, 307, 308].includes(response.status) && location.startsWith(baseUrl.origin)
  };
}

async function checkHeaders(baseUrl) {
  const response = await fetchWithTimeout(baseUrl.toString(), { method: "GET", redirect: "follow" });
  const hsts = response.headers.get("strict-transport-security") || "";
  return {
    url: baseUrl.toString(),
    status: response.status,
    hsts,
    nosniff: response.headers.get("x-content-type-options") || "",
    frameOptions: response.headers.get("x-frame-options") || "",
    ok: response.ok && /max-age=31536000/i.test(hsts)
  };
}

async function checkHealth(baseUrl) {
  const healthUrl = new URL("/healthz", baseUrl);
  let response = await fetchWithTimeout(healthUrl.toString(), { method: "GET", redirect: "follow" });
  if (response.status === 404) {
    healthUrl.pathname = "/health";
    response = await fetchWithTimeout(healthUrl.toString(), { method: "GET", redirect: "follow" });
  }
  return {
    url: healthUrl.toString(),
    status: response.status,
    ok: response.ok
  };
}

async function main() {
  const baseUrl = normalizeUrl(process.env.STAGING_URL || "");
  assertRealHttpsUrl(baseUrl);

  const checks = {
    redirect: await checkRedirect(baseUrl),
    headers: await checkHeaders(baseUrl),
    health: await checkHealth(baseUrl)
  };

  const report = {
    generatedAt: new Date().toISOString(),
    target: baseUrl.origin,
    checks
  };

  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  const failures = Object.entries(checks).filter(([, check]) => !check.ok);
  if (failures.length) {
    for (const [name, check] of failures) {
      error(`DAST ${name} failed:`, JSON.stringify(check));
    }
    process.exit(1);
  }

  success("DAST baseline passed:", path.relative(root, reportPath));
}

main().catch((failure) => {
  error(failure.message);
  process.exit(1);
});
