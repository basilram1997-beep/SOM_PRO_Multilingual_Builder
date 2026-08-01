const { spawn, spawnSync } = require("node:child_process");
const { error, warn } = require("./cli-output");
const { generateE2ELicenseCode } = require("./e2e-license");

const e2eLicenseCode =
  process.env.SOM_E2E_LICENSE_CODE ||
  generateE2ELicenseCode({
    days: 365,
    schoolName: process.env.SOM_E2E_SCHOOL_NAME || "مدرسة تجريبية",
    institutionCode: process.env.SOM_E2E_INSTITUTION_CODE || "TRIAL-4100",
    secret: process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling"
  });

const childProcesses = [];

function timestamp() {
  return new Date().toISOString();
}

function trace(message, details) {
  if (details === undefined) {
    console.log(`[${timestamp()}] ${message}`);
    return;
  }
  console.log(`[${timestamp()}] ${message}`, details);
}

const e2eEnv = {
  ...process.env,
  SOM_PRO_LICENSE_SERVER_URL: "",
  SOM_LICENSE_SERVER_URL: "",
  SOM_PRO_REQUIRE_CENTRAL_LICENSE: "false",
  SOM_PRO_LICENSE_SECRET: process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling",
  SOM_PRO_AUTH_SECRET: process.env.SOM_PRO_AUTH_SECRET || "change-this-auth-secret-before-selling",
  CORS_ORIGIN: "http://localhost:4188,http://127.0.0.1:4188",
  SOM_E2E_LICENSE_CODE: e2eLicenseCode,
  SOM_E2E_ADMIN_EMAIL: process.env.SOM_E2E_ADMIN_EMAIL || "admin@som-e2e.local",
  SOM_E2E_ADMIN_PASSWORD: process.env.SOM_E2E_ADMIN_PASSWORD || "SOM-E2E-Admin-123!",
  SOM_E2E_ADMIN_NAME: process.env.SOM_E2E_ADMIN_NAME || "SOM E2E Admin",
  SOM_E2E_SCHOOL_ID: process.env.SOM_E2E_SCHOOL_ID || "som-e2e-school",
  SOM_E2E_SCHOOL_NAME: process.env.SOM_E2E_SCHOOL_NAME || "SOM E2E School",
  SOM_E2E_INSTITUTION_CODE: process.env.SOM_E2E_INSTITUTION_CODE || "E2E-4100",
  SOM_E2E_CLASS_NAME: process.env.SOM_E2E_CLASS_NAME || "SOM E2E Class A",
  SOM_E2E_SUBJECT_NAME: process.env.SOM_E2E_SUBJECT_NAME || "SOM E2E Subject",
  SOM_E2E_TEACHER_NAME: process.env.SOM_E2E_TEACHER_NAME || "SOM E2E Teacher",
  SOM_E2E_STUDENT_NAME: process.env.SOM_E2E_STUDENT_NAME || "SOM E2E Student"
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(url, timeoutMs = 120_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok || response.status === 304) {
        trace("health check passed", { url, status: response.status });
        return;
      }
    } catch {
      // Keep waiting for the child service to finish booting.
    }
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function runWindowsCommand(commandLine, label) {
  const child = spawn("cmd.exe", ["/d", "/s", "/c", commandLine], {
    stdio: "inherit",
    windowsHide: true,
    env: e2eEnv,
    shell: false
  });

  childProcesses.push(child);
  trace(`${label} spawned`, { pid: child.pid });

  child.on("exit", (code, signal) => {
    trace(`${label} exit`, { pid: child.pid, code, signal });
    if (signal || code !== 0) {
      warn(`${label} خرج بـ`, signal || code);
    }
  });

  child.on("close", (code, signal) => {
    trace(`${label} close`, { pid: child.pid, code, signal });
  });

  child.on("error", (failure) => {
    trace(`${label} error`, { pid: child.pid, message: failure.message });
  });

  return child;
}

function stopChildProcesses() {
  for (const child of childProcesses) {
    if (!child || child.killed || child.exitCode !== null) {
      continue;
    }

    trace(`terminating ${child.pid}`);
    try {
      spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore"
      });
      trace(`terminated ${child.pid}`);
    } catch (failure) {
      warn("فشل إيقاف العملية الفرعية:", failure.message);
    }
  }
}

async function main() {
  trace("بدء تهيئة خادم E2E");
  const migrate = spawnSync("cmd.exe", ["/d", "/s", "/c", "npm run prisma:migrate:deploy -w apps/backend"], {
    stdio: "inherit",
    windowsHide: true,
    env: e2eEnv
  });

  if ((migrate.status || 0) !== 0) {
    process.exitCode = migrate.status || 1;
    return;
  }

  const bootstrap = runWindowsCommand("npm run e2e:bootstrap", "bootstrap");
  const bootstrapCode = await new Promise((resolve) => {
    bootstrap.once("exit", (code) => resolve(code ?? 0));
    bootstrap.once("error", () => resolve(1));
  });

  if (bootstrapCode !== 0) {
    process.exitCode = bootstrapCode;
    return;
  }

  runWindowsCommand("npm run dev:backend", "backend");
  await waitForHealth("http://127.0.0.1:4000/health");
  runWindowsCommand("npm run dev:frontend:e2e", "frontend");
  await waitForHealth("http://127.0.0.1:4188/");
  trace("تم تشغيل الخدمات المحلية لـ E2E");
}

process.on("SIGINT", () => {
  stopChildProcesses();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopChildProcesses();
  process.exit(0);
});

process.on("exit", () => {
  stopChildProcesses();
});

main().catch((failure) => {
  error("فشل غير متوقع:", failure instanceof Error ? failure.message : failure);
  process.exitCode = 1;
});
