const { error, warn } = require("./cli-output");
const {
  assertTcpPortFree,
  createE2EEnv,
  createProcessManager,
  runShell,
  startShell,
  trace,
  waitForShutdownSignal,
  waitForUrl
} = require("./e2e-helpers");
const { ensureLocalDataServices } = require("./runtime/local-data-services");

const processes = createProcessManager();

async function main() {
  const env = createE2EEnv();
  trace("بدء تهيئة خادم E2E");

  const dataServices = await ensureLocalDataServices();
  if (!dataServices.ok) {
    throw new Error(dataServices.message);
  }

  const migrate = runShell("npm run prisma:migrate:deploy -w apps/backend", env);
  if ((migrate.status || 0) !== 0) {
    process.exitCode = migrate.status || 1;
    return;
  }

  const bootstrap = runShell("npm run e2e:bootstrap", env);
  if ((bootstrap.status || 0) !== 0) {
    process.exitCode = bootstrap.status || 1;
    return;
  }

  await assertTcpPortFree({ name: "Backend", host: "127.0.0.1", port: 4000 });
  await assertTcpPortFree({ name: "Frontend", host: "127.0.0.1", port: 4188 });

  processes.add(startShell("npm run dev:backend", env, "backend"));
  await waitForUrl("http://127.0.0.1:4000/health", 120_000);

  processes.add(startShell("npm run dev:frontend:e2e", env, "frontend"));
  await waitForUrl("http://127.0.0.1:4188/", 120_000);

  trace("تم تشغيل الخدمات المحلية لـ E2E");
  await waitForShutdownSignal();
}

process.on("SIGINT", () => {
  processes.stopAll();
  process.exit(0);
});

process.on("SIGTERM", () => {
  processes.stopAll();
  process.exit(0);
});

process.on("exit", () => {
  processes.stopAll();
});

main().catch((failure) => {
  error("فشل غير متوقع:", failure instanceof Error ? failure.message : failure);
  warn("تم إيقاف خادم E2E قبل اكتمال التهيئة");
  process.exitCode = 1;
});
