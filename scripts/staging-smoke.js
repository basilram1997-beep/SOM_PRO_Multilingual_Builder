const fs = require("fs");
const path = require("path");
const { error, log, success, warn } = require("./cli-output");

const root = path.resolve(__dirname, "..");

function parseEnvFile(file) {
  const values = {};
  if (!fs.existsSync(file)) return values;
  for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    values[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return values;
}

function isPlaceholder(url) {
  return !url || /your-domain\.com|CHANGE_ME|localhost|127\.0\.0\.1/i.test(url);
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const env = {
    ...parseEnvFile(path.join(root, ".env.staging.example")),
    ...parseEnvFile(path.join(root, ".env.staging")),
    ...process.env
  };

  const apiUrl = env.SOM_API_URL || env.VITE_API_URL;
  const licenseUrl = env.SOM_LICENSE_SERVER_URL || env.SOM_PRO_LICENSE_SERVER_URL;
  let failed = false;

  if (env.SOM_RUNTIME_MODE && env.SOM_RUNTIME_MODE !== "saas") {
    error("يجب أن تكون SOM_RUNTIME_MODE بقيمة saas في staging smoke.");
    failed = true;
  }

  for (const [name, value] of [
    ["API URL", apiUrl],
    ["License URL", licenseUrl]
  ]) {
    if (/localhost|127\.0\.0\.1/i.test(value || "")) {
      error(`${name} يشير إلى localhost: ${value}`);
      failed = true;
    }
  }

  if (failed) process.exit(1);

  if (isPlaceholder(apiUrl) || isPlaceholder(licenseUrl)) {
    warn("تم تجاوز فحوصات الشبكة لأن روابط staging ما زالت placeholder.");
    log("اضبط SOM_API_URL و SOM_LICENSE_SERVER_URL على نطاقات HTTPS حقيقية لتشغيل الفحوصات.");
    return;
  }

  const checks = [
    ["backend health", `${apiUrl.replace(/\/$/, "")}/health`],
    ["backend version", `${apiUrl.replace(/\/$/, "")}/api/version`],
    ["license health", `${licenseUrl.replace(/\/$/, "")}/health`]
  ];

  for (const [label, url] of checks) {
    const result = await fetchJson(url);
    if (!result.ok) {
      error(`${label} أعاد HTTP ${result.status}: ${url}`);
      failed = true;
    } else {
      success(`${label}: ${url}`);
    }
  }

  if (failed) process.exit(1);
  success("فحوصات staging smoke نجحت.");
}

main().catch((failure) => {
  error(failure.message);
  process.exit(1);
});
