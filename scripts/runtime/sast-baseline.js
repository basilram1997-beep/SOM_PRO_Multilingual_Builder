const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { error, success, warn } = require("../cli-output");
const { shellCommand } = require("./services");

const root = path.resolve(__dirname, "..", "..");
const reportDir = path.join(root, "reports", "security");
const reportPath = path.join(reportDir, "sast-baseline.json");

const requiredWorkflowSignals = [
  /github\/codeql-action\/init@v\d+/,
  /github\/codeql-action\/analyze@v\d+/,
  /language:\s*javascript-typescript/,
  /security-events:\s*write/
];

const sensitivePatterns = [
  {
    id: "javascript-eval",
    severity: "high",
    pattern: /\beval\s*\(/,
    message: "Avoid eval; use structured parsing or a constrained interpreter."
  },
  {
    id: "new-function",
    severity: "high",
    pattern: /\bnew\s+Function\s*\(/,
    message: "Avoid dynamic function construction."
  },
  {
    id: "tls-disabled",
    severity: "critical",
    pattern: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0["']?/,
    message: "TLS certificate verification must not be disabled."
  },
  {
    id: "dangerous-inner-html",
    severity: "medium",
    pattern: /dangerouslySetInnerHTML/,
    message: "Review HTML injection carefully and sanitize content."
  }
];

const excludedDirs = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "reports",
  "test-results",
  "playwright-report",
  "deliverables"
]);

const includedExtensions = new Set([".js", ".cjs", ".mjs", ".ts", ".tsx", ".jsx"]);

function listFiles(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (excludedDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...listFiles(full));
      continue;
    }
    if (includedExtensions.has(path.extname(entry.name))) result.push(full);
  }
  return result;
}

function runEslint() {
  const shell = shellCommand("npm run lint");
  return spawnSync(shell.command, shell.args, {
    cwd: root,
    shell: false,
    windowsHide: true,
    encoding: "utf8",
    timeout: 120_000
  });
}

function scanFiles() {
  const findings = [];
  for (const file of listFiles(root)) {
    if (path.relative(root, file).replace(/\\/g, "/") === "scripts/runtime/sast-baseline.js") continue;
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    for (const rule of sensitivePatterns) {
      lines.forEach((line, index) => {
        if (rule.pattern.test(line)) {
          findings.push({
            ruleId: rule.id,
            severity: rule.severity,
            message: rule.message,
            file: path.relative(root, file).replace(/\\/g, "/"),
            line: index + 1
          });
        }
      });
    }
  }
  return findings;
}

function verifyCodeqlWorkflow() {
  const workflowPath = path.join(root, ".github", "workflows", "ci.yml");
  const text = fs.readFileSync(workflowPath, "utf8");
  return requiredWorkflowSignals.map((pattern) => ({
    pattern: pattern.source,
    present: pattern.test(text)
  }));
}

function main() {
  const eslint = runEslint();
  const findings = scanFiles();
  const codeqlSignals = verifyCodeqlWorkflow();
  const missingCodeqlSignals = codeqlSignals.filter((signal) => !signal.present);
  const blockingFindings = findings.filter((finding) => ["critical", "high"].includes(finding.severity));

  fs.mkdirSync(reportDir, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    eslintStatus: eslint.status,
    codeqlWorkflowConfigured: missingCodeqlSignals.length === 0,
    codeqlSignals,
    findings
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  if (eslint.status !== 0) {
    if (eslint.stdout) process.stdout.write(eslint.stdout);
    if (eslint.stderr) process.stderr.write(eslint.stderr);
    error("SAST baseline failed: eslint failed");
    process.exit(1);
  }

  if (missingCodeqlSignals.length) {
    error("SAST baseline failed: CodeQL CI workflow is incomplete");
    process.exit(1);
  }

  if (blockingFindings.length) {
    for (const finding of blockingFindings) {
      error(`${finding.severity.toUpperCase()} ${finding.ruleId} ${finding.file}:${finding.line}`);
    }
    error("SAST baseline failed: high or critical findings found");
    process.exit(1);
  }

  if (findings.length) warn("SAST baseline found review-level findings:", String(findings.length));
  success("SAST baseline passed:", path.relative(root, reportPath));
}

main();
