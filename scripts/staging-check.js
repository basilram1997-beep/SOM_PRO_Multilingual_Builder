const fs = require("fs");
const path = require("path");
const { error, success } = require("./cli-output");

const root = path.resolve(__dirname, "..");
const requiredFiles = [
  ".env.staging.example",
  "apps/backend/.env.staging.example",
  "apps/license-server/.env.staging.example",
  "apps/frontend/.env.staging.example",
  "apps/desktop/.env.saas.staging.example",
  "docs/PHASE_10_STAGING_DEPLOYMENT_PLAN_AR.md",
  "docs/CLEAN_WINDOWS_INSTALL_TEST_AR.md",
  "docs/STAGING_MULTI_SCHOOL_VERIFICATION_AR.md",
  "docs/STAGING_BACKUP_RESTORE_TEST_AR.md",
  "docs/STAGING_GO_NO_GO_AR.md",
  "docs/PHASE_10_STAGING_VERIFICATION_REPORT.md"
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

for (const file of requiredFiles) {
  const fullPath = path.join(root, file);
  if (fs.existsSync(fullPath)) success("موجود:", file);
  else fail(`${file} is missing`);
}

const envPath = path.join(root, ".env.staging.example");
const env = parseEnv(fs.readFileSync(envPath, "utf8"));
const requiredKeys = [
  "NODE_ENV",
  "SOM_RUNTIME_MODE",
  "VITE_API_URL",
  "SOM_API_URL",
  "SOM_LICENSE_SERVER_URL",
  "CORS_ORIGIN",
  "DATABASE_URL",
  "JWT_SECRET"
];
for (const key of requiredKeys) {
  if (env[key]) success("موثق:", key);
  else fail(`${key} is missing from .env.staging.example`);
}

for (const key of ["VITE_API_URL", "SOM_API_URL", "SOM_LICENSE_SERVER_URL", "CORS_ORIGIN"]) {
  const value = env[key] || "";
  if (/localhost|127\.0\.0\.1/i.test(value)) fail(`${key} must not point to localhost in staging`);
}

if (env.SOM_RUNTIME_MODE !== "saas") fail("SOM_RUNTIME_MODE must be saas for staging");
if (env.NODE_ENV !== "production") fail("NODE_ENV must be production for staging");

if (process.exitCode) process.exit(process.exitCode);
success("قائمة إعدادات staging اكتملت. استبدل CHANGE_ME و your-domain.com على الخادم الحقيقي قبل النشر.");
