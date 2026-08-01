const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { log, success, warn } = require("../cli-output");

const projectRoot = path.resolve(__dirname, "..", "..");
const generatedTargets = [
  "apps/backend/dist",
  "apps/backend/tmp",
  "apps/frontend/dist",
  "packages/shared/dist",
  "test-results",
  "logs",
  "apps/desktop/release",
  "release",
  "e2e-server-check.err.log",
  "e2e-server-check.out.log",
  "e2e-smoke-core.err.log",
  "e2e-smoke-core.out.log"
];

const staleProcessNeedles = [
  projectRoot,
  "start:license-server",
  "apps/license-server",
  "scripts/e2e-server.js",
  "npm run dev:backend",
  "npm run dev -w apps/backend",
  "tsx watch src/server.ts",
  "vite --host 0.0.0.0 --port 4188"
];

function resolveInsideProject(target) {
  const resolved = path.resolve(projectRoot, target);
  const relative = path.relative(projectRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to clean outside project: ${resolved}`);
  }
  return resolved;
}

function removeGeneratedArtifacts() {
  let removed = 0;
  for (const target of generatedTargets) {
    const resolved = resolveInsideProject(target);
    if (!fs.existsSync(resolved)) {
      continue;
    }
    fs.rmSync(resolved, { recursive: true, force: true });
    removed += 1;
    log(`removed ${target}`);
  }
  success(`Cleaned ${removed} generated artifact target(s).`);
}

function runPowerShell(script) {
  return spawnSync("powershell.exe", ["-NoLogo", "-NoProfile", "-Command", script], {
    cwd: projectRoot,
    encoding: "utf8",
    windowsHide: true
  });
}

function cleanStaleWindowsProcesses() {
  const escapedNeedles = staleProcessNeedles.map((needle) => needle.replace(/'/g, "''"));
  const script = `
$needles = @('${escapedNeedles.join("','")}')
$current = $PID
$nodePid = ${process.pid}
$matches = Get-CimInstance Win32_Process | Where-Object {
  if (-not $_.CommandLine -or $_.ProcessId -eq $current -or $_.ProcessId -eq $nodePid -or $_.Name -notin @('node.exe','cmd.exe')) {
    return $false
  }
  foreach ($needle in $needles) {
    if ($needle -and $_.CommandLine.Contains($needle)) {
      return $true
    }
  }
  return $false
}
$ids = $matches | Select-Object -ExpandProperty ProcessId -Unique
if ($ids.Count -gt 0) {
  $ids | ForEach-Object { Stop-Process -Id $_ -Force }
}
Write-Output $ids.Count
`;

  const result = runPowerShell(script);
  if (result.status !== 0) {
    warn("Could not stop stale Windows processes automatically.");
    if (result.stderr) warn(result.stderr.trim());
    return 0;
  }

  const stopped = Number(
    String(result.stdout || "0")
      .trim()
      .split(/\s+/u)
      .pop() || 0
  );
  success(`Stopped ${Number.isFinite(stopped) ? stopped : 0} stale project process(es).`);
  return Number.isFinite(stopped) ? stopped : 0;
}

function cleanStaleProcesses() {
  if (process.platform === "win32") {
    return cleanStaleWindowsProcesses();
  }

  warn("Automatic stale-process cleanup is currently implemented for Windows only.");
  return 0;
}

function main() {
  const cleanProcesses = process.argv.includes("--processes");
  const cleanArtifacts = !process.argv.includes("--processes-only");

  if (cleanProcesses) {
    cleanStaleProcesses();
  }

  if (cleanArtifacts) {
    removeGeneratedArtifacts();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  cleanStaleProcesses,
  generatedTargets,
  removeGeneratedArtifacts
};
