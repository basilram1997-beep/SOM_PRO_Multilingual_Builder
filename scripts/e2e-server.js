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
const { cleanStaleProcesses } = require("./runtime/cleanup");
const { ensureLocalDataServices } = require("./runtime/local-data-services");

const processes = createProcessManager();
const backendTimeoutMs = Math.max(20_000, Number(process.env.SOM_E2E_BACKEND_TIMEOUT_MS || 30_000));
const frontendTimeoutMs = Math.max(20_000, Number(process.env.SOM_E2E_FRONTEND_TIMEOUT_MS || 90_000));
const skipFrontendWait = process.env.E2E_SERVER_SKIP_FRONTEND_WAIT === "1";

async function main() {
  const env = createE2EEnv();
  trace("بدء تهيئة خادم E2E", { phase: "services" });

  const dataServices = await ensureLocalDataServices();
  if (!dataServices.ok) {
    throw new Error(dataServices.message);
  }
  trace("خدمات البيانات المحلية جاهزة", { phase: "services" });
  cleanStaleProcesses();

  trace("تشغيل ترحيل Prisma", { phase: "migrate" });
  const migrate = runShell("npm run prisma:migrate:deploy -w apps/backend", env);
  if ((migrate.status || 0) !== 0) {
    process.exitCode = migrate.status || 1;
    return;
  }
  trace("ترحيل Prisma اكتمل", { phase: "migrate" });

  trace("تشغيل bootstrap E2E", { phase: "bootstrap" });
  const bootstrap = runShell("npm run e2e:bootstrap", env);
  if ((bootstrap.status || 0) !== 0) {
    process.exitCode = bootstrap.status || 1;
    return;
  }
  trace("bootstrap E2E اكتمل", { phase: "bootstrap" });

  await assertTcpPortFree({ name: "Backend", host: "127.0.0.1", port: 4000 });
  await assertTcpPortFree({ name: "Frontend", host: "127.0.0.1", port: 4188 });

  trace("تشغيل backend", { phase: "backend" });
  processes.add(startShell("npm run dev:backend", env, "backend"));
  await waitForUrl("http://127.0.0.1:4000/health", backendTimeoutMs);
  trace("backend جاهز", { phase: "backend" });

  trace("تشغيل frontend", { phase: "frontend" });
  processes.add(startShell("npm run dev:frontend:e2e", env, "frontend"));
  if (skipFrontendWait) {
    trace("frontend بدأ، والتحقق من الجاهزية مفوض إلى Playwright", { phase: "frontend" });
  } else {
    await waitForUrl("http://127.0.0.1:4188/", frontendTimeoutMs);
    trace("frontend جاهز", { phase: "frontend" });
  }

  trace("تم تشغيل الخدمات المحلية لـ E2E");
  await waitForShutdownSignal();
}

process.on("SIGINT", () => {
  void processes.stopAll().finally(() => {
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  void processes.stopAll().finally(() => {
    process.exit(0);
  });
});

main().catch((failure) => {
  error("فشل غير متوقع:", failure instanceof Error ? failure.message : failure);
  warn("تم إيقاف خادم E2E قبل اكتمال التهيئة");
  process.exitCode = 1;
});
