const fs = require("fs");
const path = require("path");
const { error, success } = require("./cli-output");

const root = path.resolve(__dirname, "..");
const exampleEnvPath = path.join(root, ".env.staging.example");
const actualEnvPath = path.join(root, ".env.staging");
const nginxPath = path.join(root, "deploy/nginx/sompro.conf");
const composePath = path.join(root, "docker-compose.production.yml");

const requiredFiles = [
  ".env.staging.example",
  "apps/backend/.env.staging.example",
  "apps/license-server/.env.staging.example",
  "apps/frontend/.env.staging.example",
  "apps/desktop/.env.saas.staging.example",
  "deploy/nginx/sompro.conf",
  "docker-compose.production.yml",
  "docs/PHASE_10_STAGING_DEPLOYMENT_PLAN_AR.md",
  "docs/CLEAN_WINDOWS_INSTALL_TEST_AR.md",
  "docs/STAGING_MULTI_SCHOOL_VERIFICATION_AR.md",
  "docs/STAGING_BACKUP_RESTORE_TEST_AR.md",
  "docs/STAGING_GO_NO_GO_AR.md",
  "docs/PHASE_10_STAGING_VERIFICATION_REPORT.md"
];

const requiredKeys = [
  "NODE_ENV",
  "SOM_RUNTIME_MODE",
  "VITE_SOM_SHOW_OPERATOR_HEALTH",
  "VITE_API_URL",
  "SOM_API_URL",
  "SOM_LICENSE_SERVER_URL",
  "CORS_ORIGIN",
  "DATABASE_URL",
  "JWT_SECRET",
  "SOM_ENABLE_OPERATOR_HEALTH",
  "SOM_NOTIFICATION_WEBHOOK_URL",
  "SOM_SMS_WEBHOOK_URL",
  "SOM_AUTO_BACKUP_INTERVAL_HOURS",
  "SOM_AUTO_BACKUP_RUN_ON_START",
  "SOM_REDUNDANCY_MODE",
  "SOM_REPLICA_DATABASE_URL",
  "SOM_REPLICA_API_URL",
  "SOM_REPLICA_LICENSE_SERVER_URL"
];

const publicUrlKeys = [
  "VITE_API_URL",
  "SOM_API_URL",
  "SOM_LICENSE_SERVER_URL",
  "SOM_PRO_LICENSE_SERVER_URL",
  "CORS_ORIGIN",
  "SOM_NOTIFICATION_WEBHOOK_URL",
  "SOM_SMS_WEBHOOK_URL",
  "SOM_REPLICA_API_URL",
  "SOM_REPLICA_LICENSE_SERVER_URL"
];

const secretLikeKeys = [
  "DATABASE_URL",
  "JWT_SECRET",
  "SOM_PRO_LICENSE_SECRET",
  "LICENSE_ADMIN_TOKEN"
];

function parseEnv(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    values[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return values;
}

function fail(message) {
  error(message);
  process.exitCode = 1;
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function hasPlaceholder(value) {
  return /CHANGE_ME|your-domain|example\.invalid|localhost|127\.0\.0\.1|placeholder/i.test(value);
}

function assertContains(text, pattern, message) {
  if (pattern.test(text)) success("verified:", message);
  else fail(message);
}

for (const file of requiredFiles) {
  const fullPath = path.join(root, file);
  if (fs.existsSync(fullPath)) success("present:", file);
  else fail(`${file} is missing`);
}

const nginx = fs.readFileSync(nginxPath, "utf8");
assertContains(nginx, /listen\s+80\s+default_server;/, "nginx listens on port 80");
assertContains(nginx, /return\s+301\s+https:\/\/\$host\$request_uri;/, "nginx redirects HTTP to HTTPS");
assertContains(nginx, /listen\s+443\s+ssl\s+http2\s+default_server;/, "nginx listens on HTTPS 443");
assertContains(nginx, /ssl_certificate\s+\/etc\/letsencrypt\/live\/sompro\/fullchain\.pem;/, "nginx TLS certificate path is configured");
assertContains(nginx, /ssl_certificate_key\s+\/etc\/letsencrypt\/live\/sompro\/privkey\.pem;/, "nginx TLS private key path is configured");
assertContains(nginx, /Strict-Transport-Security\s+"max-age=31536000; includeSubDomains; preload"\s+always;/, "production HSTS is configured");
assertContains(nginx, /X-Content-Type-Options\s+"nosniff"\s+always;/, "nginx sends nosniff");
assertContains(nginx, /X-Frame-Options\s+"DENY"\s+always;/, "nginx sends frame denial");
assertContains(nginx, /X-Forwarded-Proto\s+https;/, "nginx forwards HTTPS scheme to upstreams");
assertContains(nginx, /resolver\s+127\.0\.0\.11/, "nginx resolves Docker upstream names at runtime");
if (/HTTPS placeholder|your-domain\.com|TODO\s+HTTPS/i.test(nginx)) {
  fail("nginx config must not contain HTTPS placeholders");
}

const compose = fs.readFileSync(composePath, "utf8");
assertContains(compose, /-\s+"443:443"/, "production compose publishes 443");
assertContains(compose, /https:\/\/127\.0\.0\.1\/healthz/, "nginx healthcheck uses HTTPS health endpoint");
assertContains(compose, /VITE_API_URL:\s+\$\{VITE_API_URL:\?set VITE_API_URL to the public HTTPS API origin\}/, "frontend build requires explicit HTTPS API URL");
if (/https:\/\/api\.your-domain\.com/i.test(compose)) {
  fail("production compose must not include a placeholder API URL fallback");
}

const exampleEnv = parseEnv(fs.readFileSync(exampleEnvPath, "utf8"));
for (const key of requiredKeys) {
  if (exampleEnv[key]) success("documented:", key);
  else fail(`${key} is missing from .env.staging.example`);
}

for (const key of publicUrlKeys) {
  const value = exampleEnv[key] || "";
  if (!isHttpsUrl(value)) fail(`${key} must use https:// in .env.staging.example`);
  if (/localhost|127\.0\.0\.1|your-domain/i.test(value)) {
    fail(`${key} must not point to localhost or your-domain in staging examples`);
  }
}

if (exampleEnv.SOM_RUNTIME_MODE !== "saas") fail("SOM_RUNTIME_MODE must be saas for staging");
if (exampleEnv.NODE_ENV !== "production") fail("NODE_ENV must be production for staging");
if (exampleEnv.SOM_ENABLE_OPERATOR_HEALTH !== "true") fail("SOM_ENABLE_OPERATOR_HEALTH must be true for staging");
if (exampleEnv.VITE_SOM_SHOW_OPERATOR_HEALTH !== "true") fail("VITE_SOM_SHOW_OPERATOR_HEALTH must be true for staging");

const backupInterval = Number(exampleEnv.SOM_AUTO_BACKUP_INTERVAL_HOURS || 0);
if (!Number.isFinite(backupInterval) || backupInterval <= 0) fail("SOM_AUTO_BACKUP_INTERVAL_HOURS must be a positive number");

if (!["single-region", "active-passive"].includes(exampleEnv.SOM_REDUNDANCY_MODE)) {
  fail('SOM_REDUNDANCY_MODE must be either "single-region" or "active-passive"');
}

if (fs.existsSync(actualEnvPath)) {
  const actualEnv = parseEnv(fs.readFileSync(actualEnvPath, "utf8"));
  for (const key of requiredKeys) {
    if (!actualEnv[key]) fail(`${key} is missing from .env.staging`);
  }
  for (const key of publicUrlKeys) {
    const value = actualEnv[key] || "";
    if (!isHttpsUrl(value)) fail(`${key} must use https:// in .env.staging`);
    if (hasPlaceholder(value)) fail(`${key} contains a placeholder or local host in .env.staging`);
  }
  for (const key of secretLikeKeys) {
    const value = actualEnv[key] || "";
    if (!value || hasPlaceholder(value)) fail(`${key} must be replaced with a real staging secret in .env.staging`);
  }
  success("verified:", ".env.staging contains HTTPS URLs and no placeholder secrets");
} else {
  success("skipped:", ".env.staging is absent; checked examples and deployment gates only");
}

if (process.exitCode) process.exit(process.exitCode);
success("staging verification baseline passed. Real deployment evidence still requires a live HTTPS domain smoke run and attached TLS report.");
