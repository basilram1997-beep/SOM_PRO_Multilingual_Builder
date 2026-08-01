const { spawn, spawnSync } = require("node:child_process");
const net = require("node:net");
const { generateE2ELicenseCode } = require("./e2e-license");

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

function normalizeWindowsEnv(env) {
  if (process.platform !== "win32") {
    return env;
  }

  const normalized = {};
  for (const [key, value] of Object.entries(env)) {
    const existingKey = Object.keys(normalized).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    if (existingKey) {
      delete normalized[existingKey];
    }
    normalized[key] = value;
  }

  return normalized;
}

function createE2EEnv(overrides = {}) {
  const e2eLicenseCode =
    process.env.SOM_E2E_LICENSE_CODE ||
    generateE2ELicenseCode({
      days: 365,
      schoolName: process.env.SOM_E2E_SCHOOL_NAME || "مدرسة تجريبية",
      institutionCode: process.env.SOM_E2E_INSTITUTION_CODE || "TRIAL-4100",
      secret: process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling"
    });

  return normalizeWindowsEnv({
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
    SOM_E2E_STUDENT_NAME: process.env.SOM_E2E_STUDENT_NAME || "SOM E2E Student",
    ...overrides
  });
}

function shellCommand(commandLine) {
  return process.platform === "win32"
    ? { command: "cmd.exe", args: ["/d", "/s", "/c", commandLine] }
    : { command: "sh", args: ["-c", commandLine] };
}

function runShell(commandLine, env, options = {}) {
  const shell = shellCommand(commandLine);
  return spawnSync(shell.command, shell.args, {
    stdio: options.stdio || "inherit",
    windowsHide: true,
    env,
    timeout: options.timeoutMs,
    shell: false
  });
}

function startProcess(command, args, options) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    stdio: options.stdio || "inherit",
    windowsHide: true,
    env: options.env,
    shell: false
  });

  trace(`${options.label} spawned`, { pid: child.pid });
  child.once("exit", (code, signal) => {
    trace(`${options.label} exit`, { pid: child.pid, code, signal });
  });
  child.once("error", (failure) => {
    trace(`${options.label} error`, { pid: child.pid, message: failure.message });
  });

  return child;
}

function startShell(commandLine, env, label) {
  const shell = shellCommand(commandLine);
  return startProcess(shell.command, shell.args, { env, label });
}

async function waitForUrl(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok || response.status === 304) {
        trace("health check passed", { url, status: response.status });
        return;
      }
    } catch {
      // Keep waiting for the service to finish booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function waitForTcp(host, port, timeoutMs) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.createConnection({ host, port });
      socket.setTimeout(2000);

      const cleanup = () => {
        socket.removeAllListeners();
        socket.destroy();
      };

      socket.once("connect", () => {
        cleanup();
        trace("tcp check passed", { host, port });
        resolve();
      });

      const retry = () => {
        cleanup();
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }
        setTimeout(tryConnect, 1000);
      };

      socket.once("error", retry);
      socket.once("timeout", retry);
    };

    tryConnect();
  });
}

async function assertLocalService({ name, host, port, timeoutMs, hint }) {
  try {
    await waitForTcp(host, port, timeoutMs);
  } catch (failure) {
    const suffix = hint ? ` ${hint}` : "";
    throw new Error(`${name} is not reachable at ${host}:${port}.${suffix}`, { cause: failure });
  }
}

function createProcessManager() {
  const childProcesses = [];
  let cleanupCompleted = false;

  return {
    add(child) {
      childProcesses.push(child);
      return child;
    },
    stopAll() {
      if (cleanupCompleted) {
        return;
      }
      cleanupCompleted = true;

      for (const child of childProcesses.reverse()) {
        if (!child?.pid || child.exitCode !== null) {
          continue;
        }

        trace("terminating child process", { pid: child.pid });
        if (process.platform === "win32") {
          spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
            stdio: "ignore",
            timeout: 5000
          });
          continue;
        }

        child.kill("SIGTERM");
        spawnSync(process.execPath, ["-e", "setTimeout(() => process.exit(0), 500)"], {
          stdio: "ignore",
          timeout: 1000
        });
        if (child.exitCode === null) {
          child.kill("SIGKILL");
        }
      }
    }
  };
}

function waitForShutdownSignal() {
  return new Promise((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
}

module.exports = {
  assertLocalService,
  createE2EEnv,
  createProcessManager,
  normalizeWindowsEnv,
  runShell,
  shellCommand,
  startProcess,
  startShell,
  trace,
  waitForShutdownSignal,
  waitForTcp,
  waitForUrl
};
