const path = require("node:path");
const { error, log, success } = require("./cli-output");
const {
  assertLocalService,
  createE2EEnv,
  createProcessManager,
  runShell,
  startProcess,
  waitForUrl
} = require("./e2e-helpers");

const projectRoot = path.resolve(__dirname, "..");
const backendRoot = path.join(projectRoot, "apps", "backend");
const frontendRoot = path.join(projectRoot, "apps", "frontend");
const baseUrl = process.env.SOM_E2E_BASE_URL || "http://127.0.0.1:4188";
const apiUrl = process.env.SOM_E2E_API_BASE_URL || "http://127.0.0.1:4000";
const totalTimeoutMs = Number(process.env.SOM_E2E_TIMEOUT_MS || 120_000);
const processes = createProcessManager();

function quoteArg(arg) {
  if (!/[\s"]/u.test(arg)) {
    return arg;
  }
  return `"${arg.replace(/"/g, '\\"')}"`;
}

function buildPlaywrightCommand() {
  const headed = process.argv.includes("--headed");
  const args = [
    "playwright",
    "test",
    "--config",
    "playwright.config.cjs",
    ...process.argv.slice(2).filter((arg) => arg !== "--headed"),
    headed ? "--headed" : null
  ].filter(Boolean);

  return `npx ${args.map(quoteArg).join(" ")}`;
}

function startBackend(env) {
  return processes.add(
    startProcess(
      process.execPath,
      [path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs"), "src/server.ts"],
      { cwd: backendRoot, env, label: "backend" }
    )
  );
}

function startFrontend(env) {
  return processes.add(
    startProcess(
      process.execPath,
      [
        path.join(projectRoot, "node_modules", "vite", "bin", "vite.js"),
        "--host",
        "0.0.0.0",
        "--port",
        "4188",
        "--strictPort"
      ],
      { cwd: frontendRoot, env, label: "frontend" }
    )
  );
}

async function main() {
  if (!Number.isFinite(totalTimeoutMs) || totalTimeoutMs < 10_000) {
    throw new Error("SOM_E2E_TIMEOUT_MS must be at least 10000 milliseconds");
  }

  const env = createE2EEnv({ PLAYWRIGHT_SKIP_WEB_SERVER: "1" });
  log(`Starting Playwright browser smoke path with ${Math.round(totalTimeoutMs / 1000)}s timeout`);

  await assertLocalService({
    name: "PostgreSQL",
    host: process.env.SOM_E2E_POSTGRES_HOST || "127.0.0.1",
    port: Number(process.env.SOM_E2E_POSTGRES_PORT || 5432),
    timeoutMs: Math.min(totalTimeoutMs, 30_000),
    hint: "Start it with `docker compose up -d postgres redis` before running browser E2E."
  });

  const migrate = runShell("npm run prisma:migrate:deploy -w apps/backend", env, { timeoutMs: totalTimeoutMs });
  if ((migrate.status || 0) !== 0) {
    process.exitCode = migrate.status || 1;
    return;
  }

  const bootstrap = runShell("npm run e2e:bootstrap", env, { timeoutMs: totalTimeoutMs });
  if ((bootstrap.status || 0) !== 0) {
    process.exitCode = bootstrap.status || 1;
    return;
  }

  startBackend(env);
  await waitForUrl(`${apiUrl.replace(/\/$/, "")}/health`, totalTimeoutMs);

  startFrontend(env);
  await waitForUrl(`${baseUrl.replace(/\/$/, "")}/`, totalTimeoutMs);

  success("Local services are ready");

  const playwright = runShell(buildPlaywrightCommand(), env, { timeoutMs: totalTimeoutMs });
  if (playwright.error) {
    throw playwright.error;
  }
  process.exitCode = playwright.status || 0;
}

process.on("exit", () => processes.stopAll());
process.on("SIGINT", () => {
  processes.stopAll();
  process.exit(130);
});
process.on("SIGTERM", () => {
  processes.stopAll();
  process.exit(143);
});

main()
  .catch((failure) => {
    error("Browser smoke path failed:", failure instanceof Error ? failure.message : failure);
    process.exitCode = 1;
  })
  .finally(() => {
    processes.stopAll();
    process.exit(process.exitCode || 0);
  });
