const path = require("node:path");
const { error, log, success } = require("./cli-output");
const {
  assertTcpPortFree,
  createE2EEnv,
  createProcessManager,
  normalizeWindowsEnv,
  runShell,
  startProcess,
  waitForUrl
} = require("./e2e-helpers");
const { cleanStaleProcesses } = require("./runtime/cleanup");
const { ensureLocalDataServices } = require("./runtime/local-data-services");

const projectRoot = path.resolve(__dirname, "..");
const backendRoot = path.join(projectRoot, "apps", "backend");
const frontendRoot = path.join(projectRoot, "apps", "frontend");
const baseUrl = process.env.SOM_E2E_BASE_URL || "http://127.0.0.1:4188";
const apiUrl = process.env.SOM_E2E_API_BASE_URL || "http://127.0.0.1:4000";
const suiteArgs = process.argv.slice(2);
const hasHeavySuite = suiteArgs.some((arg) =>
  ["deep-reports-and-roles.spec.js", "role-navigation-matrix.spec.js", "student-management-flow.spec.js"].some(
    (token) => arg.includes(token)
  )
);
const totalTimeoutMs = Number(process.env.SOM_E2E_TIMEOUT_MS || (hasHeavySuite ? 360_000 : 120_000));
const backendTimeoutMs = Math.max(
  20_000,
  Math.min(totalTimeoutMs, Number(process.env.SOM_E2E_BACKEND_TIMEOUT_MS || 30_000))
);
const frontendTimeoutMs = Math.max(
  20_000,
  Math.min(totalTimeoutMs, Number(process.env.SOM_E2E_FRONTEND_TIMEOUT_MS || 90_000))
);
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

  const skipLocalServices = process.env.SOM_E2E_SKIP_LOCAL_SERVICES === "true";
  const env = skipLocalServices
    ? normalizeWindowsEnv({
        ...process.env,
        PLAYWRIGHT_SKIP_WEB_SERVER: "1"
      })
    : createE2EEnv({ PLAYWRIGHT_SKIP_WEB_SERVER: "1" });
  log(`Starting Playwright browser smoke path with ${Math.round(totalTimeoutMs / 1000)}s timeout`);
  log(`Backend timeout is ${Math.round(backendTimeoutMs / 1000)}s`);
  log(`Frontend timeout is ${Math.round(frontendTimeoutMs / 1000)}s`);

  if (!skipLocalServices) {
    const dataServices = await ensureLocalDataServices({
      dockerWaitMs: backendTimeoutMs,
      serviceWaitMs: backendTimeoutMs
    });
    if (!dataServices.ok) {
      throw new Error(dataServices.message);
    }
    log("Local data services are ready");
    cleanStaleProcesses();
  } else {
    log("Skipping local data services because SOM_E2E_SKIP_LOCAL_SERVICES=true");
    await waitForUrl(`${apiUrl.replace(/\/$/, "")}/health`, backendTimeoutMs);
    await waitForUrl(`${baseUrl.replace(/\/$/, "")}/`, frontendTimeoutMs);
  }

  if (!skipLocalServices) {
    log("Running Prisma migrations");
    const migrate = runShell("npm run prisma:migrate:deploy -w apps/backend", env, { timeoutMs: totalTimeoutMs });
    if ((migrate.status || 0) !== 0) {
      process.exitCode = migrate.status || 1;
      return;
    }
    log("Prisma migrations completed");

    log("Running E2E bootstrap");
    const bootstrap = runShell("npm run e2e:bootstrap", env, { timeoutMs: totalTimeoutMs });
    if ((bootstrap.status || 0) !== 0) {
      process.exitCode = bootstrap.status || 1;
      return;
    }
    log("E2E bootstrap completed");

    await assertTcpPortFree({ name: "Backend", host: "127.0.0.1", port: 4000 });
    await assertTcpPortFree({ name: "Frontend", host: "127.0.0.1", port: 4188 });

    log("Starting backend service");
    startBackend(env);
    await waitForUrl(`${apiUrl.replace(/\/$/, "")}/health`, backendTimeoutMs);
    log("Backend service is ready");

    log("Starting frontend service");
    startFrontend(env);
    await waitForUrl(`${baseUrl.replace(/\/$/, "")}/`, frontendTimeoutMs);
    log("Frontend service is ready");

    success("Local services are ready");
  } else {
    success("External acceptance target is ready");
  }

  log("Launching Playwright");
  const playwright = runShell(buildPlaywrightCommand(), env, { timeoutMs: totalTimeoutMs });
  if (playwright.error) {
    throw playwright.error;
  }
  if (playwright.status === null) {
    log("Playwright finished without an exit code");
  }
  process.exitCode = playwright.status || 0;
}

process.on("SIGINT", () => {
  void processes.stopAll().finally(() => {
    process.exit(130);
  });
});
process.on("SIGTERM", () => {
  void processes.stopAll().finally(() => {
    process.exit(143);
  });
});

main()
  .catch((failure) => {
    error("Browser smoke path failed:", failure instanceof Error ? failure.message : failure);
    process.exitCode = 1;
  })
  .finally(async () => {
    await processes.stopAll();
    process.exit(process.exitCode || 0);
  });
