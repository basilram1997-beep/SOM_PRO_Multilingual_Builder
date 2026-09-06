const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { error, success } = require("./cli-output");

const root = path.resolve(__dirname, "..");
const handoffMode = process.argv.includes("--handoff");

function runGit(args) {
  return spawnSync("git", args, {
    cwd: root,
    stdio: "pipe",
    windowsHide: true,
    encoding: "utf8"
  });
}

function listTrackedFiles() {
  const result = runGit(["ls-files"]);
  if (result.status !== 0) {
    throw new Error("git ls-files failed. Run this check from a valid Git repository.");
  }
  return result.stdout
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isForbiddenEnvFile(file) {
  const normalized = file.replace(/\\/g, "/");
  const name = path.posix.basename(normalized);
  if (!name.startsWith(".env")) return false;
  return !name.endsWith(".example");
}

const sensitivePatterns = [
  { name: "OpenAI/API token", pattern: /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{20,}\b/ },
  { name: "Owner token", pattern: /\bSOM-OWNER-[A-Z0-9]{20,}\b/ },
  { name: "Private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----/ },
  { name: "Production env secret", pattern: /^\s*(?:DATABASE_URL|REDIS_URL|POSTGRES_PASSWORD|REDIS_PASSWORD)=.+$/m }
];
const localEnvCandidates = [
  ".env",
  ".env.production",
  ".env.staging",
  "apps/backend/.env",
  "apps/backend/.env.production",
  "apps/backend/.env.staging",
  "apps/frontend/.env",
  "apps/frontend/.env.production",
  "apps/frontend/.env.staging",
  "apps/license-server/.env",
  "apps/license-server/.env.production",
  "apps/license-server/.env.staging"
];
const forbiddenDeliveryExtensions = new Set([".sql", ".dump", ".sqlite", ".sqlite3"]);

function looksLikePlaceholder(value) {
  return /CHANGE_ME|change-me|example\.com|localhost|127\.0\.0\.1|\/run\/secrets\//i.test(value);
}

function parseEnv(content) {
  const values = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    values.push({ key: line.slice(0, index).trim(), value: line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "") });
  }
  return values;
}

function findLocalEnvRisks() {
  const risks = [];
  for (const file of localEnvCandidates) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) continue;
    const content = fs.readFileSync(full, "utf8");
    const values = parseEnv(content);
    const hasRealValues = values.some(({ key, value }) => {
      if (!value || looksLikePlaceholder(value)) return false;
      return /SECRET|TOKEN|PASSWORD|DATABASE_URL|REDIS_URL|JWT|KEY|PASSPHRASE/i.test(key);
    });
    risks.push({ file, hasRealValues });
  }
  return risks;
}

function findForbiddenDeliveryFiles() {
  const roots = ["deliverables", "reports"];
  const findings = [];
  const ignoredDirectories = new Set(["node_modules", ".git", ".gradle", "build", "dist"]);

  function walk(relativeRoot) {
    const absoluteRoot = path.join(root, relativeRoot);
    if (!fs.existsSync(absoluteRoot)) return;
    for (const entry of fs.readdirSync(absoluteRoot, { withFileTypes: true })) {
      const relativePath = path.join(relativeRoot, entry.name).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) walk(relativePath);
        continue;
      }
      const lower = entry.name.toLowerCase();
      if ((lower.startsWith(".env") && !lower.endsWith(".example")) || forbiddenDeliveryExtensions.has(path.extname(lower))) {
        findings.push(relativePath);
      }
    }
  }

  for (const item of roots) walk(item);
  return findings;
}

let ok = true;
const tracked = listTrackedFiles();

for (const file of tracked) {
  if (isForbiddenEnvFile(file)) {
    error("Forbidden tracked env file:", file);
    ok = false;
  }
}

for (const file of tracked) {
  if (isForbiddenEnvFile(file)) continue;
  if (!/\.(?:js|ts|tsx|json|yml|yaml|md|html|conf|example|env|txt)$/i.test(file)) continue;
  const full = path.join(root, file);
  if (!fs.existsSync(full)) continue;
  const content = fs.readFileSync(full, "utf8");
  for (const item of sensitivePatterns) {
    if (item.name === "Production env secret" && file.endsWith(".md")) continue;
    if (item.pattern.test(content) && !file.endsWith(".example")) {
      error("Possible committed secret:", file, item.name);
      ok = false;
    }
  }
}

if (ok) success("No tracked runtime .env files or obvious secrets found.");
if (handoffMode) {
  for (const risk of findLocalEnvRisks()) {
    if (risk.hasRealValues) {
      error("Local env file contains non-placeholder secret-like values and must be rotated before handoff:", risk.file);
      ok = false;
    }
  }

  for (const file of findForbiddenDeliveryFiles()) {
    error("Forbidden secret-bearing or database dump file inside delivery outputs:", file);
    ok = false;
  }

  if (ok) success("No local handoff secret risks or forbidden delivery dump files found.");
}
process.exit(ok ? 0 : 1);
