const fs = require("fs");
const path = require("path");
const { error, success } = require("./cli-output");

const root = path.resolve(__dirname, "..");
const requiredFiles = [
  "apps/desktop/src/main.js",
  "apps/desktop/src/window.js",
  "apps/desktop/src/runtimeConfig.js",
  "apps/desktop/src/desktopDevice.js",
  "apps/desktop/preload.js",
  "apps/desktop/loading.html",
  "apps/desktop/offline.html",
  "apps/desktop/icon.ico",
  "apps/frontend/dist/index.html"
];

function envValue(...keys) {
  for (const key of keys) {
    const value = String(process.env[key] || "").trim();
    if (value) return value;
  }
  return "";
}

function validateHttpsUrl(name, value) {
  if (!value) {
    error(`${name} is required for Desktop SaaS checks.`);
    return false;
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    error(`${name} must be a valid URL:`, value);
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  const forbiddenHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const isPlaceholder =
    forbiddenHosts.has(host) ||
    host.endsWith(".example") ||
    host.includes("example.com") ||
    host.includes("your-domain") ||
    host.includes("sompro.example");

  if (parsed.protocol !== "https:" || isPlaceholder) {
    error(`${name} must be a real HTTPS staging/production URL:`, value);
    return false;
  }

  success(`${name}:`, value);
  return true;
}

let ok = true;

for (const file of requiredFiles) {
  const full = path.join(root, file);
  if (fs.existsSync(full)) {
    success("found:", file);
  } else {
    error("missing:", file);
    ok = false;
  }
}

const runtimeMode = envValue("SOM_RUNTIME_MODE") || "saas";
if (runtimeMode !== "saas") {
  error("SOM_RUNTIME_MODE must be saas for Desktop SaaS checks:", runtimeMode);
  ok = false;
} else {
  success("SOM_RUNTIME_MODE:", runtimeMode);
}

ok = validateHttpsUrl("SOM_API_URL/VITE_API_URL", envValue("SOM_API_URL", "VITE_API_URL")) && ok;
ok = validateHttpsUrl("SOM_LICENSE_SERVER_URL", envValue("SOM_LICENSE_SERVER_URL", "SOM_PRO_LICENSE_SERVER_URL")) && ok;

process.exit(ok ? 0 : 1);
