#!/usr/bin/env node

const { spawn, spawnSync } = require("node:child_process");
const { error, success, warn } = require("../cli-output");
const {
  assertTcpPortFree,
  createE2EEnv,
  createProcessManager,
  runShell,
  startShell,
  trace,
  waitForShutdownSignal,
  waitForUrl
} = require("../e2e-helpers");
const { ensureLocalDataServices } = require("./local-data-services");

const args = new Set(process.argv.slice(2));
const processes = createProcessManager();
const containerName = process.env.SOM_QUICK_TUNNEL_CONTAINER || "sompro-cloudflared-quick";
const proxyUrl = process.env.SOM_QUICK_TUNNEL_PROXY_URL || "http://host.docker.internal:8080";
const backendTimeoutMs = Number(process.env.SOM_QUICK_TUNNEL_BACKEND_TIMEOUT_MS || 45_000);
const frontendTimeoutMs = Number(process.env.SOM_QUICK_TUNNEL_FRONTEND_TIMEOUT_MS || 90_000);
const tunnelTimeoutMs = Number(process.env.SOM_QUICK_TUNNEL_CREATE_TIMEOUT_MS || 90_000);

function runDocker(args, options = {}) {
  return spawnSync("docker", args, {
    encoding: "utf8",
    stdio: options.stdio || "pipe",
    timeout: options.timeoutMs || 30_000,
    windowsHide: true
  });
}

function cleanupDockerContainer() {
  const result = runDocker(["rm", "-f", containerName], { timeoutMs: 20_000 });
  if (result.status === 0) {
    success(`Stopped Cloudflare Quick Tunnel container: ${containerName}`);
  }
}

function cleanupDemoPorts() {
  if (process.platform !== "win32") {
    warn("Demo port cleanup is currently implemented for Windows only.");
    return;
  }

  const script = `
$ports = @(4000, 4188, 8080)
$current = $PID
$nodePid = ${process.pid}
$ids = @()
foreach ($port in $ports) {
  $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    if ($connection.OwningProcess -and $connection.OwningProcess -ne $current -and $connection.OwningProcess -ne $nodePid) {
      $ids += [int]$connection.OwningProcess
    }
  }
}
$ids = $ids | Sort-Object -Unique
foreach ($id in $ids) {
  Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
}
Write-Output $ids.Count
`;
  const result = spawnSync("powershell.exe", ["-NoLogo", "-NoProfile", "-Command", script], {
    encoding: "utf8",
    windowsHide: true
  });
  if (result.status !== 0) {
    warn("Could not stop all demo port processes automatically.");
    if (result.stderr) warn(result.stderr.trim());
    return;
  }
  const stopped = Number(String(result.stdout || "0").trim().split(/\s+/).pop() || 0);
  success(`Stopped ${Number.isFinite(stopped) ? stopped : 0} demo port process(es).`);
}

function cleanup() {
  cleanupDockerContainer();
  cleanupDemoPorts();
}

function assertDockerAvailable() {
  const result = runDocker(["--version"]);
  if (result.status !== 0) {
    throw new Error("Docker is required for the one-command Quick Tunnel demo. Run npm.cmd run staging:tunnel:check first.");
  }
}

function startCloudflared() {
  cleanupDockerContainer();
  const child = spawn(
    "docker",
    [
      "run",
      "--rm",
      "--name",
      containerName,
      "cloudflare/cloudflared:latest",
      "tunnel",
      "--no-autoupdate",
      "--url",
      proxyUrl
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    }
  );

  trace("cloudflared Quick Tunnel spawned", { pid: child.pid, containerName });
  processes.add(child);
  return child;
}

function waitForTunnelUrl(child) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    let buffer = "";
    let tunnelUrl = null;
    let registered = false;
    const timer = setInterval(() => {
      if (Date.now() - startedAt > tunnelTimeoutMs) {
        clearInterval(timer);
        reject(new Error("Timed out waiting for trycloudflare.com URL"));
      }
    }, 1000);

    function handleChunk(chunk) {
      const text = String(chunk);
      process.stdout.write(text);
      buffer += text;
      const match = buffer.match(/https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/i);
      if (match) {
        tunnelUrl = match[0];
      }
      if (/Registered tunnel connection/i.test(buffer)) {
        registered = true;
      }
      if (tunnelUrl && registered) {
        clearInterval(timer);
        resolve(tunnelUrl);
      }
    }

    child.stdout.on("data", handleChunk);
    child.stderr.on("data", handleChunk);
    child.once("exit", (code) => {
      clearInterval(timer);
      reject(new Error(`cloudflared exited before URL was ready, code ${code}`));
    });
    child.once("error", (failure) => {
      clearInterval(timer);
      reject(failure);
    });
  });
}

function runEvidence(url, env) {
  const attempts = Number(process.env.SOM_QUICK_TUNNEL_EVIDENCE_ATTEMPTS || 12);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = runShell("npm.cmd run staging:tunnel:evidence", {
      ...env,
      SOM_QUICK_TUNNEL_URL: url
    });
    if ((result.status || 0) === 0) {
      return;
    }
    if (attempt < attempts) {
      warn(`Quick Tunnel evidence attempt ${attempt}/${attempts} failed; retrying while tunnel warms up.`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000);
    }
  }
  throw new Error("Quick Tunnel evidence command failed");
}

async function main() {
  if (args.has("--cleanup")) {
    cleanup();
    return;
  }

  const env = createE2EEnv({
    VITE_API_URL: "/api",
    SOM_TUNNEL_FRONTEND_ORIGIN: process.env.SOM_TUNNEL_FRONTEND_ORIGIN || "http://127.0.0.1:4188",
    SOM_TUNNEL_BACKEND_ORIGIN: process.env.SOM_TUNNEL_BACKEND_ORIGIN || "http://127.0.0.1:4000"
  });

  warn("Cloudflare Quick Tunnel is external demo only: not stable staging and not Ministry submission evidence.");
  assertDockerAvailable();

  const dataServices = await ensureLocalDataServices();
  if (!dataServices.ok) throw new Error(dataServices.message);

  await assertTcpPortFree({ name: "Backend", host: "127.0.0.1", port: 4000 });
  await assertTcpPortFree({ name: "Frontend", host: "127.0.0.1", port: 4188 });
  await assertTcpPortFree({ name: "Cloudflare local proxy", host: "127.0.0.1", port: 8080 });

  const migrate = runShell("npm.cmd run prisma:migrate:deploy -w apps/backend", env);
  if ((migrate.status || 0) !== 0) throw new Error("Prisma migrate deploy failed");

  const bootstrap = runShell("npm.cmd run e2e:bootstrap", env);
  if ((bootstrap.status || 0) !== 0) throw new Error("E2E bootstrap failed");

  processes.add(startShell("npm.cmd run dev:backend", env, "backend"));
  await waitForUrl("http://127.0.0.1:4000/health", backendTimeoutMs);

  processes.add(startShell("npm.cmd run dev:frontend:e2e", env, "frontend"));
  await waitForUrl("http://127.0.0.1:4188/", frontendTimeoutMs);

  processes.add(startShell("npm.cmd run staging:tunnel:proxy", env, "cloudflare-local-proxy"));
  await waitForUrl("http://127.0.0.1:8080/api/version", backendTimeoutMs);

  const cloudflared = startCloudflared();
  const tunnelUrl = await waitForTunnelUrl(cloudflared);
  runEvidence(tunnelUrl, env);

  success("SOM PRO external demo is ready:");
  console.log(tunnelUrl);
  success("Evidence artifacts:");
  console.log("reports/security/cloudflare-quick-tunnel-trial.json");
  console.log("reports/security/cloudflare-quick-tunnel-trial.md");
  warn("Keep this terminal running while testing. Press Ctrl+C or run npm.cmd run staging:tunnel:demo:cleanup to stop.");

  await waitForShutdownSignal();
  await processes.stopAll();
  cleanupDockerContainer();
}

process.on("SIGINT", () => {
  void processes.stopAll().finally(() => {
    cleanupDockerContainer();
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  void processes.stopAll().finally(() => {
    cleanupDockerContainer();
    process.exit(0);
  });
});

main().catch((failure) => {
  error(failure.stack || failure.message);
  void processes.stopAll().finally(() => {
    cleanupDockerContainer();
    process.exit(1);
  });
});
