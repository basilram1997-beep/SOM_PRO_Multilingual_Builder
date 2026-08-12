const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { shellCommand } = require("./services");

const projectRoot = path.resolve(__dirname, "..", "..");
const reportDir = path.join(projectRoot, "reports", "security");
const reportPath = path.join(reportDir, "npm-audit.json");

function writeReport(status, result, output, details = {}) {
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        command: "npm audit --omit=dev",
        status,
        exitStatus: result.status,
        output: output.trim(),
        ...details
      },
      null,
      2
    )}\n`
  );
}

function runAudit() {
  const npmCache = process.env.NPM_CONFIG_CACHE || path.join(process.env.TEMP || "C:\\tmp", "som-pro-npm-cache");
  fs.mkdirSync(npmCache, { recursive: true });

  const commandLine = "npm audit --omit=dev";
  const shell = shellCommand(commandLine);
  const result = spawnSync(shell.command, shell.args, {
    cwd: projectRoot,
    windowsHide: true,
    shell: false,
    encoding: "utf8",
    timeout: 120_000,
    env: {
      ...process.env,
      NPM_CONFIG_CACHE: npmCache,
      npm_config_cache: npmCache
    }
  });

  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  const networkUnavailable =
    /audit endpoint returned an error|EAI_AGAIN|ENOTFOUND|ECONNRESET|ETIMEDOUT|getaddrinfo|fetch failed/i.test(output);

  if (result.status === 0) {
    writeReport("passed", result, output);
    console.log("npm audit --omit=dev: OK");
    return 0;
  }

  if (networkUnavailable) {
    writeReport("skipped", result, output, { reason: "registry unavailable from this environment" });
    console.warn("npm audit --omit=dev: SKIP - registry unavailable from this environment");
    return 0;
  }

  writeReport("failed", result, output);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  console.error("npm audit --omit=dev: FAIL");
  return result.status || 1;
}

process.exitCode = runAudit();
