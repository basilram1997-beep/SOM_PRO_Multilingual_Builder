const { spawn, spawnSync } = require("node:child_process");

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProcessRunning(pid) {
  if (!pid) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
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

function createProcessManager() {
  const childProcesses = [];
  let cleanupCompleted = false;

  async function stopChild(child) {
    if (!child?.pid || child.exitCode !== null) {
      return;
    }

    trace("terminating child process", { pid: child.pid });

    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T"], {
        stdio: "ignore",
        timeout: 5000
      });
      await sleep(300);

      if (isProcessRunning(child.pid)) {
        trace("forcing child process shutdown", { pid: child.pid });
        spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
          stdio: "ignore",
          timeout: 5000
        });
        await sleep(300);
      }

      return;
    }

    child.kill("SIGTERM");
    await sleep(300);

    if (isProcessRunning(child.pid)) {
      child.kill("SIGKILL");
      await sleep(300);
    }
  }

  return {
    add(child) {
      childProcesses.push(child);
      return child;
    },
    async stopAll() {
      if (cleanupCompleted) {
        return;
      }
      cleanupCompleted = true;

      for (const child of childProcesses.reverse()) {
        await stopChild(child);
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

async function waitForUrl(url, timeoutMs, options = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET", ...options });
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

module.exports = {
  createProcessManager,
  normalizeWindowsEnv,
  runShell,
  shellCommand,
  startProcess,
  startShell,
  trace,
  waitForShutdownSignal,
  waitForUrl
};
