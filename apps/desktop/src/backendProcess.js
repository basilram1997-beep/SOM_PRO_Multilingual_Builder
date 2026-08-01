const path = require("path");
const fs = require("fs");
const net = require("net");
const { spawn } = require("child_process");
const { DEFAULT_API_URL, canOpen, waitForUrl, findProjectRoot, runtimeConfig } = require("./paths");

const managedProcesses = [];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function commandExists(command) {
  return new Promise((resolve) => {
    const checker = process.platform === "win32" ? "where" : "which";
    const child = spawn(checker, [command], { windowsHide: true });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}

function canConnectPort(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let finished = false;
    const done = (value) => {
      if (finished) return;
      finished = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(1200);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}

async function waitForPort(port, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    if (await canConnectPort(port)) return true;
    await delay(1500);
  }
  return canConnectPort(port);
}

function runBackground(command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    shell: false,
    detached: true,
    windowsHide: true,
    stdio: "ignore"
  });
  child.on("error", () => null);
  child.unref();
  managedProcesses.push(child);
  return child;
}

function localHealthUrl(baseUrl) {
  return String(baseUrl || "").replace(/\/$/, "") + "/health";
}

function localServiceScript(root) {
  return path.join(root, "scripts", "start-sompro-local-services.ps1");
}

function runPowerShellScript(scriptPath, cwd) {
  return new Promise((resolve) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-ProjectRoot", cwd],
      {
        cwd,
        shell: false,
        detached: false,
        windowsHide: true,
        stdio: "ignore"
      }
    );
    let finished = false;
    child.on("error", () => {
      if (finished) return;
      finished = true;
      resolve(false);
    });
    child.on("exit", (code) => {
      if (finished) return;
      finished = true;
      resolve(code === 0);
    });
  });
}

async function waitForCoreServices() {
  const licenseHealthUrl = localHealthUrl(runtimeConfig.licenseServerUrl);
  const backendHealthUrl = localHealthUrl(DEFAULT_API_URL);
  const checks = [
    waitForUrl(licenseHealthUrl, 40),
    waitForUrl(backendHealthUrl, 60),
    waitForPort(5432, 60),
    waitForPort(6379, 30)
  ];
  const [licenseReady, backendReady, postgresReady, redisReady] = await Promise.all(checks);
  return licenseReady && backendReady && postgresReady && redisReady;
}

async function ensureLocalLicenseServer(root) {
  const licenseHealthUrl = localHealthUrl(runtimeConfig.licenseServerUrl);
  if (await canOpen(licenseHealthUrl)) return true;

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  if (!(await commandExists(npmCommand))) return false;

  runBackground(npmCommand, ["run", "start", "-w", "apps/license-server"], root);
  return waitForUrl(licenseHealthUrl, 20);
}

function runAndWait(command, args, cwd, timeoutMs = 90000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, shell: false, windowsHide: true, stdio: "ignore" });
    let finished = false;
    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      try {
        child.kill();
      } catch {}
      resolve(false);
    }, timeoutMs);
    child.on("error", () => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve(false);
    });
    child.on("exit", (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve(code === 0);
    });
  });
}

async function ensureDockerReady(root) {
  if (!(await commandExists("docker"))) return false;
  if (await runAndWait("docker", ["info"], root, 10000)) return true;

  if (process.platform === "win32") {
    const dockerDesktop = "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe";
    if (fs.existsSync(dockerDesktop)) runBackground(dockerDesktop, [], root);
  }

  for (let i = 0; i < 60; i += 1) {
    if (await runAndWait("docker", ["info"], root, 7000)) return true;
    await delay(3000);
  }
  return false;
}

async function ensureLocalDatabase(root) {
  const hasCompose = fs.existsSync(path.join(root, "docker-compose.yml"));
  if (!hasCompose) return canConnectPort(5432);

  const dockerReady = await ensureDockerReady(root);
  if (!dockerReady) return false;

  await runAndWait("docker", ["compose", "up", "-d", "postgres", "redis"], root, 120000);
  const postgresReady = await waitForPort(5432, 80);
  await waitForPort(6379, 30);
  return postgresReady;
}

async function ensureLocalBackend() {
  const root = findProjectRoot();
  if (root) await ensureLocalLicenseServer(root);
  if ((await canOpen(DEFAULT_API_URL + "/health")) && (await canConnectPort(5432))) return true;
  if (!root) return false;

  const localServicesScript = localServiceScript(root);
  if (process.platform === "win32" && fs.existsSync(localServicesScript)) {
    const scriptStarted = await runPowerShellScript(localServicesScript, root);
    if (scriptStarted && (await waitForCoreServices())) {
      return true;
    }
    if ((await canOpen(DEFAULT_API_URL + "/health")) && (await canConnectPort(5432))) {
      return true;
    }
  }

  const databaseReady = await ensureLocalDatabase(root);
  if (!databaseReady) return false;

  await ensureLocalLicenseServer(root);

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  if (!(await commandExists(npmCommand))) return false;

  await runAndWait(npmCommand, ["run", "setup:env"], root, 60000);
  await runAndWait(npmCommand, ["run", "build:shared"], root, 60000);
  await runAndWait(npmCommand, ["run", "setup:db"], root, 120000);

  if (!(await canOpen(DEFAULT_API_URL + "/health"))) {
    runBackground(npmCommand, ["run", "start", "-w", "apps/backend"], root);
  }
  return waitForUrl(DEFAULT_API_URL + "/health", 45);
}

function stopManagedProcesses() {
  if (runtimeConfig.mode !== "development") return;
  for (const child of managedProcesses) {
    try {
      child.kill();
    } catch {}
  }
}

module.exports = { ensureLocalBackend, stopManagedProcesses, commandExists };
