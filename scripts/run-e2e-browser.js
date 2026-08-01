const { spawn } = require("node:child_process");
const { error, log, success, warn } = require("./cli-output");
const { generateE2ELicenseCode } = require("./e2e-license");

const baseUrl = process.env.SOM_E2E_BASE_URL || "http://127.0.0.1:4188";
const apiUrl = process.env.SOM_E2E_API_BASE_URL || "http://127.0.0.1:4000";
const e2eLicenseCode =
  process.env.SOM_E2E_LICENSE_CODE ||
  generateE2ELicenseCode({
    days: 365,
    schoolName: process.env.SOM_E2E_SCHOOL_NAME || "مدرسة تجريبية",
    institutionCode: process.env.SOM_E2E_INSTITUTION_CODE || "TRIAL-4100",
    secret: process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling"
  });
const sharedEnv = {
  ...process.env,
  SOM_E2E_LICENSE_CODE: e2eLicenseCode,
  PLAYWRIGHT_SKIP_WEB_SERVER: "1"
};

let serverProcess = null;
let playwrightProcess = null;
const lifecycleTimers = new Set();

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

function trackTimer(timer) {
  lifecycleTimers.add(timer);
  return timer;
}

function clearTrackedTimer(timer) {
  if (timer) {
    clearTimeout(timer);
    lifecycleTimers.delete(timer);
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    const timer = trackTimer(
      setTimeout(() => {
        clearTrackedTimer(timer);
        resolve();
      }, ms)
    );
    timer.unref?.();
  });
}

async function waitForClose(child, timeoutMs = 5000) {
  if (!child) return;

  let timer = null;
  try {
    return await Promise.race([
      new Promise((resolve) => {
        const cleanup = () => {
          child.off("close", onClose);
          child.off("error", onError);
          clearTrackedTimer(timer);
        };

        const onClose = (code, signal) => {
          cleanup();
          resolve({ type: "close", code, signal });
        };

        const onError = (failure) => {
          cleanup();
          resolve({ type: "error", failure });
        };

        child.once("close", onClose);
        child.once("error", onError);
      }),
      new Promise((resolve) => {
        timer = trackTimer(
          setTimeout(() => {
            lifecycleTimers.delete(timer);
            resolve({ type: "timeout" });
          }, timeoutMs)
        );
        timer.unref?.();
      })
    ]);
  } finally {
    clearTrackedTimer(timer);
  }
}

async function terminateProcessTree(child, label) {
  if (!child?.pid) return;

  if (child.exitCode !== null || child.signalCode !== null) {
    trace(`skip terminating ${label}; already exited`, {
      pid: child.pid,
      exitCode: child.exitCode,
      signalCode: child.signalCode
    });
    return;
  }

  trace(`before terminating ${label}`, {
    pid: child.pid
  });

  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
        shell: false
      });

      killer.once("exit", (code, signal) => {
        trace(`taskkill finished for ${label}`, { pid: child.pid, code, signal });
        resolve();
      });
      killer.once("error", (failure) => {
        warn(`taskkill error for ${label}:`, failure.message);
        resolve();
      });
    });
    child.unref?.();
    await waitForClose(child, 5000);
  } else {
    child.kill("SIGTERM");
    child.unref?.();
    await waitForClose(child, 3000);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
    }
  }

  trace(`after terminating ${label}`, {
    pid: child.pid,
    exitCode: child.exitCode,
    signalCode: child.signalCode
  });
}

async function waitForServer(url, timeoutMs = 120_000) {
  const startedAt = Date.now();
  const healthUrl = `${url.replace(/\/$/, "")}/`;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(healthUrl, { method: "GET" });
      if (response.ok || response.status === 304) {
        return;
      }
    } catch {
      // Keep waiting until the local services are ready.
    }
    await sleep(1500);
  }

  throw new Error(`Timed out waiting for E2E server at ${healthUrl}`);
}

async function waitForApiHealth(url, timeoutMs = 120_000) {
  const startedAt = Date.now();
  const healthUrl = `${url.replace(/\/$/, "")}/health`;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(healthUrl, { method: "GET" });
      if (response.ok || response.status === 304) {
        return;
      }
    } catch {
      // Keep waiting until the local API is ready.
    }
    await sleep(1500);
  }

  throw new Error(`Timed out waiting for E2E API at ${healthUrl}`);
}

function startServer() {
  serverProcess = spawn(process.execPath, ["scripts/e2e-server.js"], {
    stdio: "inherit",
    windowsHide: true,
    env: sharedEnv,
    shell: false
  });

  trace("backend wrapper spawned", { pid: serverProcess.pid });

  serverProcess.once("exit", (code, signal) => {
    trace("backend wrapper exit", { pid: serverProcess.pid, code, signal });
    if (signal || code !== 0) {
      warn(`E2E server exited with ${signal || code}`);
    }
  });

  serverProcess.once("close", (code, signal) => {
    trace("backend wrapper close", { pid: serverProcess.pid, code, signal });
  });

  serverProcess.once("error", (failure) => {
    trace("backend wrapper error", { pid: serverProcess.pid, message: failure.message });
  });

  return serverProcess;
}

function buildPlaywrightCommand() {
  const headed = process.argv.includes("--headed");
  const commandParts = [
    "npx",
    "playwright",
    "test",
    "--config",
    "playwright.config.cjs",
    ...process.argv.slice(2).filter((arg) => arg !== "--headed"),
    headed ? "--headed" : null
  ].filter(Boolean);

  return commandParts.join(" ");
}

function runPlaywright() {
  const commandLine = buildPlaywrightCommand();
  trace("playwright command", commandLine);

  playwrightProcess = spawn("cmd.exe", ["/d", "/s", "/c", commandLine], {
    stdio: "inherit",
    env: sharedEnv,
    shell: false,
    windowsHide: true
  });

  trace("playwright spawned", { pid: playwrightProcess.pid });

  return new Promise((resolve, reject) => {
    let settled = false;
    let seenExit = false;
    let exitResult = null;
    let fallbackTimer = null;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      playwrightProcess.off("exit", onExit);
      playwrightProcess.off("close", onClose);
      playwrightProcess.off("error", onError);
      clearTrackedTimer(fallbackTimer);
      resolve(result);
    };

    const scheduleFallback = () => {
      if (fallbackTimer || !seenExit) return;
      fallbackTimer = trackTimer(
        setTimeout(() => {
          if (!settled) {
            finish(
              exitResult || { kind: "exit", code: playwrightProcess.exitCode, signal: playwrightProcess.signalCode }
            );
          }
        }, 2000)
      );
      fallbackTimer.unref?.();
    };

    const onExit = (code, signal) => {
      trace("playwright exit", { pid: playwrightProcess.pid, code, signal });
      seenExit = true;
      exitResult = { kind: "exit", code, signal };
      playwrightProcess.unref?.();
      scheduleFallback();
    };

    const onClose = (code, signal) => {
      trace("playwright close", { pid: playwrightProcess.pid, code, signal });
      playwrightProcess.unref?.();
      finish(exitResult || { kind: "close", code, signal });
    };

    const onError = (failure) => {
      trace("playwright error", { pid: playwrightProcess.pid, message: failure.message });
      settled = true;
      reject(failure);
    };

    if (playwrightProcess.exitCode !== null || playwrightProcess.signalCode !== null) {
      trace("playwright already exited", {
        pid: playwrightProcess.pid,
        exitCode: playwrightProcess.exitCode,
        signalCode: playwrightProcess.signalCode
      });
      finish({ kind: "already-exited", code: playwrightProcess.exitCode, signal: playwrightProcess.signalCode });
      return;
    }

    playwrightProcess.once("exit", onExit);
    playwrightProcess.once("close", onClose);
    playwrightProcess.once("error", onError);
  });
}

async function dumpActiveHandles() {
  trace(
    "[E2E active handles]",
    process._getActiveHandles().map((handle) => ({
      type: handle?.constructor?.name,
      hasRef: typeof handle?.hasRef === "function" ? handle.hasRef() : null
    }))
  );
  trace(
    "[E2E active requests]",
    process._getActiveRequests().map((request) => request?.constructor?.name)
  );
}

async function main() {
  let exitCode = 1;
  const cleanupGuardTimer = setTimeout(() => {}, 15000);

  try {
    log("Starting Playwright browser smoke path");
    startServer();
    await waitForServer(baseUrl);
    await waitForApiHealth(apiUrl);
    success("Local services are ready");

    const result = await runPlaywright();
    if (result.kind === "exit" || result.kind === "close" || result.kind === "already-exited") {
      exitCode = result.code || 0;
      if (result.signal && exitCode === 0) {
        exitCode = 1;
      }
    }
  } catch (failure) {
    error("Browser smoke path failed:", failure instanceof Error ? failure.message : failure);
    exitCode = 1;
  } finally {
    trace("entering finally");
    for (const timer of lifecycleTimers) {
      clearTimeout(timer);
    }
    lifecycleTimers.clear();

    await Promise.allSettled([
      terminateProcessTree(playwrightProcess, "playwright"),
      terminateProcessTree(serverProcess, "backend-wrapper")
    ]);

    await Promise.allSettled([waitForClose(playwrightProcess, 5000), waitForClose(serverProcess, 5000)]);

    if (playwrightProcess) {
      playwrightProcess.removeAllListeners();
    }
    if (serverProcess) {
      serverProcess.removeAllListeners();
    }
    playwrightProcess = null;
    serverProcess = null;

    trace("cleanup completed");
    await dumpActiveHandles();

    const activeHandles = process._getActiveHandles();
    if (activeHandles.length > 0) {
      const forceExitTimer = setTimeout(() => {
        console.error("[SOM PRO] Forced exit after cleanup timeout");
        process.exit(exitCode);
      }, 3000);
      forceExitTimer.unref?.();
    }

    trace("wrapper returning exit code", exitCode);
    process.exitCode = exitCode;
    clearTimeout(cleanupGuardTimer);
  }
}

process.on("SIGINT", () => {
  if (serverProcess) {
    void terminateProcessTree(serverProcess, "backend-wrapper");
  }
  if (playwrightProcess) {
    void terminateProcessTree(playwrightProcess, "playwright");
  }
  process.exit(130);
});

process.on("SIGTERM", () => {
  if (serverProcess) {
    void terminateProcessTree(serverProcess, "backend-wrapper");
  }
  if (playwrightProcess) {
    void terminateProcessTree(playwrightProcess, "playwright");
  }
  process.exit(143);
});

main().catch((failure) => {
  error("Browser smoke path failed:", failure instanceof Error ? failure.message : failure);
  process.exitCode = 1;
});
