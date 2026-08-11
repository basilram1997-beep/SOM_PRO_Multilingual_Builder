const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", "..");

function shellCommand(commandLine) {
  return process.platform === "win32"
    ? { command: "cmd.exe", args: ["/d", "/s", "/c", commandLine] }
    : { command: "sh", args: ["-c", commandLine] };
}

function run(commandLine, env, timeoutMs = 120_000) {
  const shell = shellCommand(commandLine);
  return spawnSync(shell.command, shell.args, {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
    shell: false,
    env,
    timeout: timeoutMs
  });
}

function hasFile(file) {
  return fs.existsSync(path.join(root, file));
}

function isPlaceholder(url) {
  return !url || /your-domain\.com|CHANGE_ME|localhost|127\.0\.0\.1/i.test(url);
}

function main() {
  const runAcceptance = process.argv.includes("--run") || process.env.SOM_ACCEPTANCE_RUN === "true";
  const env = { ...process.env };
  let failed = false;

  for (const file of [
    "docs/ACCEPTANCE_TEST_PLAN_AR.md",
    "docs/ACCEPTANCE_RESULTS_TEMPLATE_AR.md",
    "docs/STAGING_PEN_TEST_HANDOFF_AR.md"
  ]) {
    if (hasFile(file)) {
      console.log(`OK ${file}`);
    } else {
      console.error(`FAIL ${file} is missing`);
      failed = true;
    }
  }

  if (!runAcceptance) {
    const baseUrl = env.SOM_E2E_BASE_URL || "";
    const apiUrl = env.SOM_E2E_API_BASE_URL || "";
    if (baseUrl && !isPlaceholder(baseUrl)) console.log(`OK SOM_E2E_BASE_URL=${baseUrl}`);
    else console.log("INFO SOM_E2E_BASE_URL not set yet; UAT run will need a staging URL.");
    if (apiUrl && !isPlaceholder(apiUrl)) console.log(`OK SOM_E2E_API_BASE_URL=${apiUrl}`);
    else console.log("INFO SOM_E2E_API_BASE_URL not set yet; UAT run will need a staging API URL.");

    console.log("");
    console.log("Acceptance readiness checklist:");
    console.log("- Staging URL configured.");
    console.log("- Staging API URL configured.");
    console.log("- Test accounts prepared.");
    console.log("- Acceptance report template ready.");
    process.exitCode = failed ? 1 : 0;
    return;
  }

  if (isPlaceholder(env.SOM_E2E_BASE_URL) || isPlaceholder(env.SOM_E2E_API_BASE_URL)) {
    console.error("FAIL acceptance run requires real SOM_E2E_BASE_URL and SOM_E2E_API_BASE_URL values.");
    process.exitCode = 1;
    return;
  }

  const acceptanceEnv = {
    ...env,
    SOM_E2E_SKIP_LOCAL_SERVICES: "true",
    PLAYWRIGHT_SKIP_WEB_SERVER: "1",
    SOM_E2E_TIMEOUT_MS: env.SOM_ACCEPTANCE_TIMEOUT_MS || env.SOM_E2E_TIMEOUT_MS || "240000"
  };

  const steps = [
    ["npm run staging:check", 120_000],
    ["npm run staging:smoke", 120_000],
    ["npm run test:e2e:browser:smoke:core", 240_000],
    ["npm run test:e2e:browser:smoke:students", 240_000],
    ["npm run test:e2e:browser:smoke:daily", 240_000],
    ["npm run test:e2e:browser:deep", 360_000]
  ];

  for (const [command, timeoutMs] of steps) {
    const result = run(command, acceptanceEnv, timeoutMs);
    if (result.status !== 0) {
      failed = true;
      break;
    }
  }

  process.exitCode = failed ? 1 : 0;
}

main();
