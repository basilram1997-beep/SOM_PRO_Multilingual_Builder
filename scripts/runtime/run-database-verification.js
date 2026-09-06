const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { DEFAULT_DATABASE_URL, DEFAULT_REDIS_URL } = require("./database-config");
const { shellCommand } = require("./services");

const projectRoot = path.resolve(__dirname, "..", "..");
const reportDir = path.join(projectRoot, "docs", "test-reports");

const backendTests = [
  "src/services/apiContracts.test.ts",
  "src/services/databaseIntegrity.test.ts",
  "src/services/tenantIsolation.security.test.ts",
  "src/services/mfaAndSso.security.test.ts",
  "src/services/privacyLifecycleAndExport.security.test.ts",
  "src/services/uploadImportIntegration.test.ts",
  "src/services/backupRestoreIntegration.test.ts",
  "src/services/migrationUpgradeIntegration.test.ts"
];

const commands = [
  {
    name: "Prepare PostgreSQL, Redis, and migrations",
    cwd: projectRoot,
    command: "npm run test:db:prepare"
  },
  {
    name: "Backend database-critical suite",
    cwd: path.join(projectRoot, "apps", "backend"),
    command: `node --test --import tsx ${backendTests.join(" ")}`
  },
  {
    name: "License server database flow",
    cwd: path.join(projectRoot, "apps", "license-server"),
    command: "npm test"
  }
];

function runCommand(item) {
  const shell = shellCommand(item.command);
  const startedAt = new Date();
  const result = spawnSync(shell.command, shell.args, {
    cwd: item.cwd,
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
      REDIS_URL: process.env.REDIS_URL || DEFAULT_REDIS_URL
    },
    encoding: "utf8",
    maxBuffer: 80 * 1024 * 1024,
    shell: false,
    windowsHide: true
  });
  const finishedAt = new Date();
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  const skipped = /\bskipped\s+[1-9]\d*|\b# SKIP\b/i.test(output);
  return {
    ...item,
    startedAt,
    finishedAt,
    status: result.status ?? 1,
    output,
    skipped
  };
}

function statusLabel(result) {
  if (result.status !== 0) return "FAIL";
  if (result.skipped) return "INCOMPLETE";
  return "PASS";
}

function writeReport(results) {
  fs.mkdirSync(reportDir, { recursive: true });
  const now = new Date();
  const fileName = `database-verification-${now.toISOString().replace(/[:.]/g, "-")}.md`;
  const latestPath = path.join(reportDir, "database-verification-latest.md");
  const reportPath = path.join(reportDir, fileName);
  const overall = results.every((result) => result.status === 0 && !result.skipped) ? "PASS" : "FAIL";
  const lines = [
    "# Database Verification Report",
    "",
    `Generated at: ${now.toISOString()}`,
    `Overall status: ${overall}`,
    "",
    "## Scope",
    "",
    "- PostgreSQL and Redis local services readiness.",
    "- Prisma migration deployment against the local test database.",
    "- API integration and contracts.",
    "- Tenant isolation runtime.",
    "- MFA and SSO security flow.",
    "- Privacy lifecycle export/delete flow.",
    "- Upload import integration.",
    "- Backup/restore Docker integration.",
    "- Migration upgrade Docker integration.",
    "- License server database-backed security flow.",
    "",
    "## Environment",
    "",
    `- DATABASE_URL: ${process.env.DATABASE_URL ? "provided by environment" : "default local test URL"}`,
    `- REDIS_URL: ${process.env.REDIS_URL ? "provided by environment" : "default local test URL"}`,
    "- Docker: required for backup/restore and migration upgrade checks.",
    "",
    "## Results",
    "",
    "| Check | Status | Exit Code | Started | Finished |",
    "| --- | --- | ---: | --- | --- |",
    ...results.map(
      (result) =>
        `| ${result.name} | ${statusLabel(result)} | ${result.status} | ${result.startedAt.toISOString()} | ${result.finishedAt.toISOString()} |`
    ),
    "",
    "## Raw Output",
    ""
  ];

  for (const result of results) {
    lines.push(`### ${result.name}`, "", "```text", result.output.trim() || "(no output)", "```", "");
  }

  fs.writeFileSync(reportPath, lines.join("\n"), "utf8");
  fs.writeFileSync(latestPath, lines.join("\n"), "utf8");
  return { overall, reportPath, latestPath };
}

const results = commands.map(runCommand);
const report = writeReport(results);
console.log(`Database verification report: ${path.relative(projectRoot, report.latestPath)}`);

if (report.overall !== "PASS") {
  process.exitCode = 1;
}
