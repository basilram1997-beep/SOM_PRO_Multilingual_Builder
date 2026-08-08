const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { error, success } = require("./cli-output");

const root = path.resolve(__dirname, "..");

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
process.exit(ok ? 0 : 1);
